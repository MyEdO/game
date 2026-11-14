/**
 * Génère hotes/godot/pont/CONTRAT.md — le contrat du pont `wfrpPont` entre Godot et le noyau (#3816). Tout son texte
 * vit dans les commentaires du code qui produit ce qu'il décrit, sous les racines `RACINES` :
 *  - une JSDoc d'un `.ts` ou d'un `.mjs` dont une ligne est `@contrat <Titre>` : bloc de DÉCLARATION quand elle précède
 *    immédiatement une `interface` ou un `type` (son texte, la déclaration sans ses commentaires, puis une puce par
 *    membre, ou par variante d'une union nommée par son discriminant, dont la JSDoc est exigée), bloc LIBRE sinon (son
 *    texte, en Markdown tel quel) ;
 *  - chaque méthode de l'objet `methodes` de `creerPont` (`PONT`) : sa JSDoc décrit l'entrée, son `@returns` la réponse
 *    `ok: true`, exigés tous deux ;
 *  - une ligne `## @contrat <Titre>` d'un `.gd` et les lignes `##` contiguës qui la suivent : bloc libre.
 * La seule liste en dur est l'ordre des sections (`SECTIONS`) ; dans une section, les blocs se rangent par chemin puis
 * par position. Abandon nommé (`fichier:ligne`) : titre hors de `SECTIONS`, section sans bloc, déclaration ni
 * interface, ni littéral d'objet, ni union, membre, variante ou méthode sans JSDoc, méthode sans `@returns`, ligne de
 * commentaire extraite de plus de `LARGEUR_MAX` caractères.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-contrat-du-pont.mjs
 */
import { readFileSync } from 'node:fs'
import { analyserCorpus, typescript } from '../guards/lib/dialecte.mjs'
import { listerArbre, parUnitesDeCode } from '../guards/lib/lister.mjs'
import { codeSeul, commentairesDe } from '../guards/lib/commentPoison.mjs'
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'

const OUTIL = 'build-contrat-du-pont'
const OUT = 'hotes/godot/pont/CONTRAT.md'
const PONT = 'hotes/godot/pont/pont.ts'
const RACINES = ['hotes/godot', 'src/hote', 'src/noyau']
const EXTENSIONS = ['.ts', '.mjs', '.gd']
const LARGEUR_MAX = 160
const METHODES = 'Méthodes'

/** Les sections dans l'ordre du rendu, chacune avec le niveau de son titre (0 : sans titre, sous celui du document). */
const SECTIONS = new Map([
  ['En-tête', 0], ['Transport', 2], ['Erreurs', 2], [METHODES, 2], ['Suite', 2], ['Vue', 2], ['Monde', 2],
  ['Éditeur', 2], ['Lumière', 2], ['Effets', 2], ['Musique', 2], ["L'écran de Godot", 2], ["Corps d'un combattant", 2],
  ['Atelier 3D', 2], ["Gabarit d'une base", 3], ["Composition d'un personnage", 2], ['Pile des couches', 2],
  ['Écran publié', 2],
])

const TAG = /^@contrat\s+(.+?)\s*$/

function abandon(ou, msg) {
  throw new Error(`${OUTIL} — ${ou} : ${msg}`)
}

const ligneDe = (texte, pos) => texte.slice(0, pos).split('\n').length

/** Les lignes extraites d'un commentaire qui commence à la ligne `ligne` de `rel`, chacune sous `LARGEUR_MAX`. */
function bornees(rel, ligne, lignes) {
  lignes.forEach((l, i) => {
    if (l.length > LARGEUR_MAX) abandon(`${rel}:${ligne + i}`, `ligne de commentaire de ${l.length} caractères (au plus ${LARGEUR_MAX})`)
  })
  return lignes
}

/** Les lignes d'une JSDoc brute, préfixes `/**`, ` * ` et `*\/` retirés, une par ligne de source. */
const lignesDeJsdoc = (brut) =>
  brut.slice(3, -2).split('\n').map((l, i) => (i === 0 ? l.replace(/^ /, '') : l.replace(/^\s*(?:\* ?)?/, '')).trimEnd())

/** Le texte d'un bloc : ses lignes sans les lignes vides de bord. */
function texteDe(lignes) {
  const debut = lignes.findIndex(Boolean)
  return debut < 0 ? '' : lignes.slice(debut, lignes.findLastIndex(Boolean) + 1).join('\n')
}

/** La JSDoc qui précède immédiatement `noeud` (la dernière plage de commentaire de tête, si c'est une JSDoc). */
function jsdocDe(texte, noeud) {
  const plage = typescript().getLeadingCommentRanges(texte, noeud.pos)?.at(-1)
  return plage && texte.startsWith('/**', plage.pos) ? { brut: texte.slice(plage.pos, plage.end), pos: plage.pos } : null
}

/** Le texte source d'une déclaration, débarrassé de ses commentaires et réindenté. */
function sourceSansCommentaires(texte, noeud, sf) {
  const source = texte.slice(texte.lastIndexOf('\n', noeud.getStart(sf) - 1) + 1, noeud.end)
  const brutes = source.split('\n')
  const lignes = codeSeul(source).split('\n').map((l) => l.trimEnd()).filter((l, i) => l || !brutes[i].trim())
  const marge = Math.min(...lignes.filter(Boolean).map((l) => l.length - l.trimStart().length))
  return lignes.map((l) => l.slice(marge)).join('\n')
}

/** Une puce de liste dont le texte tient sur plusieurs lignes : les suivantes indentées sous la puce. */
const puce = (tete, lignes) => `- ${tete}${lignes.map((l, i) => (i === 0 ? l : l && `  ${l}`)).join('\n')}`

/** La dernière JSDoc du texte entre `de` et `a`, celle qui précède une variante d'union et son `|` (lecture de
 *  `readUnionMembers`, scripts/docs/lib/jsdocUnion.mjs). */
function jsdocEntre(texte, de, a) {
  const pos = texte.lastIndexOf('/**', a)
  const fin = texte.indexOf('*/', pos + 3) + 2
  return pos >= de && fin <= a ? { brut: texte.slice(pos, fin), pos } : null
}

/** Le nom d'une variante d'union : son discriminant (`quoi: 'coup'`, la première propriété de son littéral d'objet
 *  typée d'un littéral ou d'une union de littéraux, intersection et parenthèses traversées), sinon son texte source. */
function nomDeVariante(texte, sf, v) {
  const ts = typescript()
  const interne = ts.isParenthesizedTypeNode(v) ? v.type : v
  const litteral = ts.isTypeLiteralNode(interne) ? interne : ts.isIntersectionTypeNode(interne) ? interne.types.find((t) => ts.isTypeLiteralNode(t)) : null
  const estLitteral = (t) => ts.isLiteralTypeNode(t) || (ts.isUnionTypeNode(t) && t.types.every((u) => ts.isLiteralTypeNode(u)))
  const discriminant = litteral?.members.find((m) => m.type && estLitteral(m.type))
  return texte.slice((discriminant ?? v).getStart(sf), (discriminant?.type ?? v).end)
}

/** Le rendu d'un bloc de déclaration : son texte, la déclaration, une puce par membre ou par variante d'union. */
function blocDeDeclaration(rel, texte, sf, noeud, lignes) {
  const ts = typescript()
  const source = (n) => texte.slice(n.getStart(sf), n.end)
  const exige = (n, quoi, nom, doc) => {
    if (!doc) abandon(`${rel}:${ligneDe(texte, n.getStart(sf))}`, `${quoi} \`${nom}\` sans JSDoc`)
    return puce(`\`${nom}\` : `, texteDe(bornees(rel, ligneDe(texte, doc.pos), lignesDeJsdoc(doc.brut))).split('\n'))
  }
  if (ts.isTypeAliasDeclaration(noeud) && !ts.isTypeLiteralNode(noeud.type) && !ts.isUnionTypeNode(noeud.type)) {
    abandon(`${rel}:${ligneDe(texte, noeud.getStart(sf))}`, `déclaration \`${noeud.name.text}\` ni interface, ni littéral d'objet, ni union`)
  }
  const membres = ts.isInterfaceDeclaration(noeud) ? noeud.members : ts.isTypeLiteralNode(noeud.type) ? noeud.type.members : []
  const puces = membres.map((m) => {
    const nom = m.name ? source(m.name) : `[${source(m.parameters[0])}]`
    return exige(m, 'membre', nom, jsdocDe(texte, m))
  })
  if (ts.isTypeAliasDeclaration(noeud) && ts.isUnionTypeNode(noeud.type)) {
    let fin = noeud.type.pos
    for (const v of noeud.type.types) {
      puces.push(exige(v, 'variante', nomDeVariante(texte, sf, v), jsdocEntre(texte, fin, v.getStart(sf))))
      fin = v.end
    }
  }
  const declaration = `\`\`\`ts\n${sourceSansCommentaires(texte, noeud, sf)}\n\`\`\``
  return [texteDe(lignes), declaration, puces.join('\n')].filter(Boolean).join('\n\n')
}

/** Les blocs `@contrat` d'un `.ts` ou d'un `.mjs`, et, pour `PONT`, ses méthodes. */
function lireScript(rel, texte, sf, blocs, methodes) {
  const ts = typescript()
  const declarations = new Map()
  const marcher = (n) => {
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) {
      const doc = jsdocDe(texte, n)
      if (doc) declarations.set(doc.pos, n)
    }
    n.forEachChild(marcher)
  }
  marcher(sf)
  for (const { start } of commentairesDe(rel, texte)) {
    if (!texte.startsWith('/**', start)) continue
    const fin = texte.indexOf('*/', start + 2) + 2
    const ligne = ligneDe(texte, start)
    const lignes = lignesDeJsdoc(texte.slice(start, fin))
    const iTag = lignes.findIndex((l) => TAG.test(l))
    if (iTag < 0) continue
    bornees(rel, ligne, lignes)
    const titre = titreConnu(rel, ligne + iTag, TAG.exec(lignes[iTag])[1])
    const corps = lignes.filter((_, i) => i !== iTag)
    const noeud = declarations.get(start)
    blocs.get(titre).push({ rel, pos: start, texte: noeud ? blocDeDeclaration(rel, texte, sf, noeud, corps) : texteDe(corps) })
  }
  if (rel === PONT) methodes.push(...methodesDuPont(texte, sf))
}

function titreConnu(rel, ligne, titre) {
  if (!SECTIONS.has(titre)) abandon(`${rel}:${ligne}`, `titre de section inconnu « ${titre} » (titres : ${[...SECTIONS.keys()].join(', ')})`)
  return titre
}

/** Les méthodes de l'objet `methodes` de `creerPont`, dans l'ordre du code, chacune rendue en sous-section. */
function methodesDuPont(texte, sf) {
  const ts = typescript()
  let objet = null
  const chercher = (n) => {
    if (ts.isVariableDeclaration(n) && n.name.text === 'methodes' && n.initializer && ts.isObjectLiteralExpression(n.initializer)) objet = n.initializer
    else n.forEachChild(chercher)
  }
  for (const st of sf.statements) if (ts.isFunctionDeclaration(st) && st.name?.text === 'creerPont') chercher(st)
  if (!objet) abandon(PONT, 'objet `methodes` de `creerPont` introuvable')
  return objet.properties.map((p) => {
    const nom = texte.slice(p.name.getStart(sf), p.name.end)
    const ou = `${PONT}:${ligneDe(texte, p.getStart(sf))}`
    const doc = jsdocDe(texte, p)
    if (!doc) abandon(ou, `méthode \`${nom}\` sans JSDoc`)
    const lignes = bornees(PONT, ligneDe(texte, doc.pos), lignesDeJsdoc(doc.brut))
    const iRetour = lignes.findIndex((l) => /^@returns\b/.test(l))
    if (iRetour < 0) abandon(ou, `méthode \`${nom}\` sans \`@returns\``)
    const entree = texteDe(lignes.slice(0, iRetour))
    const reponse = texteDe([lignes[iRetour].replace(/^@returns\s*/, ''), ...lignes.slice(iRetour + 1)])
    return `### \`${nom}\`\n\nEntrée : ${entree}\n\nRéponse \`ok: true\` : ${reponse}`
  })
}

/** Les blocs `## @contrat` d'un `.gd` : la ligne du tag et les lignes `##` contiguës qui la suivent. */
function lireGdscript(rel, texte, blocs) {
  for (const { line, start, end } of commentairesDe(rel, texte)) {
    const brutes = texte.slice(start, end).split('\n')
    brutes.forEach((l, i) => {
      const tag = /^\s*## (@contrat .*)$/.exec(l)
      if (!tag || !TAG.test(tag[1])) return
      const titre = titreConnu(rel, line + i, TAG.exec(tag[1])[1])
      const suite = []
      for (let k = i + 1; k < brutes.length && /^\s*##(?!#)/.test(brutes[k]) && !/^\s*## @contrat /.test(brutes[k]); k++) {
        suite.push(brutes[k].replace(/^\s*## ?/, '').trimEnd())
      }
      blocs.get(titre).push({ rel, pos: start + i, texte: texteDe(bornees(rel, line + i + 1, suite)) })
    })
  }
}

/**
 * Le contrat rendu depuis `fichiers` (`{ rel, text }`, chemins relatifs POSIX), sans rien lire ni écrire.
 * @param {{ rel: string, text: string }[]} fichiers @returns {string}
 */
export function contratDe(fichiers) {
  const blocs = new Map([...SECTIONS.keys()].map((titre) => [titre, []]))
  const methodes = []
  const scripts = fichiers.filter((f) => !f.rel.endsWith('.gd') && (f.rel === PONT || f.text.includes('@contrat')))
  for (const { fichier, sourceFile } of analyserCorpus(scripts)) lireScript(fichier.rel, fichier.text, sourceFile, blocs, methodes)
  if (!scripts.some((f) => f.rel === PONT)) abandon(PONT, 'fichier introuvable')
  for (const f of fichiers) if (f.rel.endsWith('.gd') && f.text.includes('@contrat')) lireGdscript(f.rel, f.text, blocs)
  let out = '# Contrat du pont `wfrpPont`\n\n'
  out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/${OUTIL}.mjs\` (\`npm run docs:contrat-du-pont\`) — NE PAS ÉDITER À LA MAIN.\n\n`
  for (const [titre, niveau] of SECTIONS) {
    const textes = blocs.get(titre).sort((a, b) => parUnitesDeCode(a.rel, b.rel) || a.pos - b.pos).map((b) => b.texte)
    if (titre === METHODES) textes.push(...methodes)
    if (!textes.length) abandon(`section « ${titre} »`, 'aucun bloc `@contrat` ne la remplit')
    if (niveau) out += `${'#'.repeat(niveau)} ${titre}\n\n`
    out += `${textes.join('\n\n')}\n\n`
  }
  return `${out.trimEnd()}\n`
}

/** Le corps rendu et les messages de `ecrireOuVerifier`, sans rien écrire. */
function rendu() {
  const fichiers = RACINES.flatMap((racine) =>
    listerArbre(racine, { filtre: (rel) => EXTENSIONS.some((ext) => rel.endsWith(ext)) }).map((rel) => {
      const chemin = `${racine}/${rel}`
      return { rel: chemin, text: readFileSync(chemin, 'utf8') }
    }),
  )
  const out = contratDe(fichiers)
  return {
    out,
    path: OUT,
    staleMsg: `docs:contrat-du-pont — ${OUT} est PÉRIMÉ (diverge des blocs \`@contrat\` de ${RACINES.join(', ')}).`,
    rerunMsg: '  → relancer `npm run docs:contrat-du-pont` (dérivé jamais commité, #2203).',
    okMsg: `docs:contrat-du-pont — OK (${OUT} à jour)`,
    writeMsg: `${OUT} — ${SECTIONS.size} sections.`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path, out } = rendu()
  return new Map([[path, out]])
}

if (import.meta.main) ecrireOuVerifier({ ...rendu(), check: process.argv.includes('--check') })

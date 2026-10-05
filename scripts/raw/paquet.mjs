// PAQUET AUTOSUFFISANT d'un système de règles (#1887, lot 7) : le relevé de ses termes (`releve.mjs`)
// rendu en Markdown DÉTERMINISTE, que l'agent de tri reçoit dans sa consigne sans relire le livre.
//  - `regle` : chaque section, dédupliquée par adresse, en-tête `NNN l.X — titre [origines]`, puis le
//    texte RÉSOLU de son adresse (`resoudreAdresse`), verbatim, sans troncature ;
//  - `entite` : la liste des déclencheurs, titre et réf, sans texte ;
//  - `ambigus` et `introuvables`, nommés.
// Forme `tri` (#1887, lot 8) : `## Règle` SEULE, aucune adresse. Une section à origine `mention` SEULE
// est réduite à ses PASSAGES qui nomment un de ses termes (`nomme`) : en prose la phrase (`debutDePhrase`,
// `finDePhrase` de `renvoi.ts`), dans une table ses lignes d'en-tête et celles qui nomment le terme,
// jamais la ligne séparatrice ; verbatim, dans l'ordre, séparés par une ligne `[…]` là où du texte est élidé,
// par leur blanc d'origine sinon. Toute autre section est rendue entière. La consigne de tri
// (`tri-consigne.md`) reçoit ce paquet (`promptDeTri`).
//
// Lancer : node scripts/raw/paquet.mjs <id du livre> [--sans-mention] [--tri [--consigne <système>]] <terme>…
//          (paquet ou prompt sur la sortie standard, tailles sur la sortie d'erreur)
import { readFileSync } from 'node:fs'
import { ORIGINES, cleDAdresse, livreDuReleve, nomme, releve } from './releve.mjs'
import { estErreur, estSeparateur, resoudreAdresse, unitesDe } from '../../src/data/source/decoupe.ts'
import { debutDePhrase, finDePhrase } from '../../src/data/source/renvoi.ts'
import { parUnitesDeCode } from '../../src/lib/ordre.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

/** Les sections relevées de plusieurs termes, fusionnées par adresse, origines marquées du terme. */
function fusion(liste) {
  const parAdresse = new Map()
  for (const { terme, it } of liste) {
    const k = cleDAdresse(it.adresse)
    if (!parAdresse.has(k)) parAdresse.set(k, { ...it, origines: [] })
    const fu = parAdresse.get(k)
    for (const o of it.origines) fu.origines.push({ origine: o, terme })
  }
  return [...parAdresse.values()]
}

/** Ordre du livre : rang du fichier, puis ligne. */
function trier(livre, items) {
  const rangs = new Map([...livre.indexe.chapitres.keys()].map((f, i) => [f, i]))
  return [...items].sort((a, b) => rangs.get(a.fichier) - rangs.get(b.fichier) || a.ligne - b.ligne || parUnitesDeCode(cleDAdresse(a.adresse), cleDAdresse(b.adresse)))
}

/** Une adresse de blocs INCLUSE dans une autre de la même section se replie sur elle, origines
 *  comprises : le paquet ne porte jamais deux fois le même texte. */
function replier(items) {
  const bornes = (it) => {
    const [f] = it.adresse.parts
    return it.adresse.parts.length === 1 && f.kind === 'blocs' ? { cle: `${it.fichier}\u0000${f.sec}#${f.secOcc}`, b0: f.b0, b1: f.b1 } : null
  }
  const contient = (o, b) => {
    const c = bornes(o)
    return c != null && c.cle === b.cle && c.b0 <= b.b0 && b.b1 <= c.b1
  }
  const hoteDe = (it) => {
    const b = bornes(it)
    return b ? items.find((o) => o !== it && contient(o, b)) : undefined
  }
  const gardes = items.filter((it) => !hoteDe(it))
  for (const it of items) {
    let hote = hoteDe(it)
    while (hote && hoteDe(hote)) hote = hoteDe(hote)
    if (hote) hote.origines.push(...it.origines.filter((o) => !hote.origines.some((h) => h.origine === o.origine && h.terme === o.terme)))
  }
  return gardes
}

const etiquettes = (it) => it.origines.map(({ origine, terme }) => `${origine} « ${terme} »`).join(', ')

/** Texte verbatim d'une adresse ; une adresse qui ne résout pas est une ERREUR. */
export function texteDe(livre, it) {
  const r = resoudreAdresse(livre.indexe.chapitres.get(it.fichier), it.adresse)
  if (estErreur(r)) throw new Error(`paquet : ${it.ref} ne résout pas — ${r.error} : ${r.detail}`)
  return r.md
}

/** Le relevé fusionné de plusieurs termes : sections de règle et d'entité, ambigus, introuvables. */
export function releveDesTermes(livre, termes, { origines } = {}) {
  const releves = termes.map((t) => releve(livre, t, { origines }))
  const de = (cle) => releves.flatMap((r) => r[cle].map((it) => ({ terme: r.terme, it })))
  return {
    regle: trier(livre, fusion(de('regle'))),
    entite: trier(livre, fusion(de('entite'))),
    ambigus: releves.flatMap((r) => r.ambigus.map((a) => ({ terme: r.terme, ...a }))),
    introuvables: releves.flatMap((r) => r.introuvables.map((i) => ({ terme: r.terme, ...i }))),
  }
}

/** Les sections de règle d'un paquet : le relevé fusionné de ses termes, replié, dans l'ordre du livre. */
export const sectionsDuPaquet = (livre, termes, options = {}) => replier(releveDesTermes(livre, termes, options).regle)

/** Une section est FORTE quand une de ses origines n'est pas `mention` : elle est rendue entière. */
export const estForte = (it) => it.origines.some((o) => o.origine !== 'mention')

/** Le prédicat « ce texte nomme-t-il un des termes de la section ? » (`nomme`, termes de ses origines). */
export function nommeUnDeSesTermes(livre, it) {
  const termes = [...new Set(it.origines.map((o) => o.terme))]
  return (x) => termes.some((t) => nomme(livre, x, t))
}

/** Phrases d'un texte, `[début, fin)`, aux bornes de `renvoi.ts`. */
function phrasesDe(texte) {
  const out = []
  for (let p = 0; p < texte.length;) {
    const fin = finDePhrase(texte, p)
    out.push([debutDePhrase(texte, p), fin])
    p = fin + 1
  }
  return out
}

/** Lignes gardées d'un bloc-table, `[début, fin)` : celles d'en-tête (avant la séparatrice) et celles
 *  qui nomment, jamais la séparatrice ; aucune quand aucune ligne ne nomme. */
function lignesGardees(lignes, nommeUn) {
  if (!lignes.some((l) => nommeUn(l.md))) return []
  const sep = lignes.findIndex((l) => estSeparateur(l.md))
  return lignes.filter((l, i) => !estSeparateur(l.md) && (i < sep || nommeUn(l.md))).map((l) => [l.debut, l.fin])
}

/**
 * PASSAGES d'une section qui nomment un de ses termes : `{ debut, fin, md }`, sous-chaînes de son
 * texte résolu sans blanc de bord, dans l'ordre ; dans un même bloc, deux passages que ne sépare
 * qu'une borne (`.` ou saut de ligne) n'en font qu'un.
 */
export function passagesDe(livre, it) {
  const texte = texteDe(livre, it)
  const [frag, ...reste] = it.adresse.parts
  if (reste.length || frag.kind !== 'blocs') throw new Error(`paquet : ${it.ref} n'est pas une adresse d'un fragment de blocs`)
  const u = unitesDe(livre.indexe.chapitres.get(it.fichier), frag)
  if (estErreur(u)) throw new Error(`paquet : ${it.ref} ne résout pas — ${u.error} : ${u.detail}`)
  const nommeUn = nommeUnDeSesTermes(livre, it)
  const spans = []
  let table = []
  const fermerTable = () => { spans.push(...lignesGardees(table, nommeUn)); table = [] }
  let at = 0
  for (const x of u.unites) {
    at += x.sep.length
    const debut = at
    at += x.md.length
    if (x.kind !== 'ligne' || x.pos.ligne === 0) fermerTable()
    if (x.kind === 'ligne') table.push({ md: x.md, debut, fin: at })
    else for (const [a, b] of phrasesDe(x.md)) if (nommeUn(x.md.slice(a, b))) spans.push([debut + a, debut + b])
  }
  fermerTable()
  if (at !== texte.length) throw new Error(`paquet : ${it.ref} — ses unités n'assemblent pas son texte résolu`)
  const joints = []
  for (const s of spans) {
    const der = joints.at(-1)
    if (der && s[0] - der[1] <= 1) der[1] = s[1]
    else joints.push([...s])
  }
  return joints.flatMap(([a, b]) => {
    const md = texte.slice(a, b)
    const debut = a + md.length - md.trimStart().length
    const fin = b - (md.length - md.trimEnd().length)
    return debut < fin ? [{ debut, fin, md: texte.slice(debut, fin) }] : []
  })
}

/** Séparateur de deux passages d'une section réduite. */
export const ELISION = '[…]'

/** Texte RÉDUIT d'une section : ses passages, joints par le blanc qui les sépare dans le texte quand
 *  rien n'est élidé, par une ligne `ELISION` sinon. */
export function texteReduit(livre, it) {
  const texte = texteDe(livre, it)
  let out = ''
  let precedent = null
  for (const p of passagesDe(livre, it)) {
    if (precedent) {
      const entre = texte.slice(precedent.fin, p.debut)
      out += entre.trim() === '' ? entre : `\n\n${ELISION}\n\n`
    }
    out += p.md
    precedent = p
  }
  return out
}

/** Texte d'une section dans un paquet : entier, ou réduit à ses passages en forme `tri`. */
const texteRendu = (livre, it, forme) => (forme === 'tri' && !estForte(it) ? texteReduit(livre, it) : texteDe(livre, it))

const enTete = (it) => `### ${it.ref} — ${it.titre} [${etiquettes(it)}]`

/** Paquet Markdown d'un système : ses termes relevés, avec `options.origines` (`releve`) ; en forme
 *  `tri`, ses seules sections de règle, réduites (`texteRendu`). */
export function paquet(livre, termes, { forme, ...options } = {}) {
  const { ambigus, introuvables, ...r } = releveDesTermes(livre, termes, options)
  const [regle, entite] = [replier(r.regle), replier(r.entite)]
  const out = [`# Paquet — ${livre.book} — ${termes.map((t) => `« ${t} »`).join(', ')}`, '', `## Règle (${regle.length})`, '']
  for (const it of regle) out.push(enTete(it), '', texteRendu(livre, it, forme), '')
  if (forme === 'tri') return `${out.join('\n')}\n`
  out.push(`## Entités (${entite.length})`, '')
  for (const it of entite) out.push(`- ${it.ref} — ${it.titre} [${etiquettes(it)}]`)
  out.push('', `## Ambigus (${ambigus.length})`, '')
  for (const a of ambigus) out.push(`- « ${a.entree.terme} » p.${a.page} (${a.niveau}, terme « ${a.terme} ») : ${a.candidats.join(' ; ')}`)
  out.push('', `## Introuvables (${introuvables.length})`, '')
  for (const i of introuvables) out.push(`- ${i.section ?? `« ${i.entree.terme} » p.${i.page}`} (${i.origine}, terme « ${i.terme} ») : ${i.erreur}${i.detail ? ` — ${i.detail}` : ''}`)
  return `${out.join('\n')}\n`
}

/** Tailles en caractères : le paquet entier, et le texte des sections de règle par origine (une
 *  section à plusieurs origines compte dans chacune) ; en forme `tri`, par forme rendue : en-têtes de
 *  section, sections `fortes` entières, sections `reduites` à leurs passages. */
export function taillesDuPaquet(livre, termes, { forme, ...options } = {}) {
  const regle = sectionsDuPaquet(livre, termes, options)
  const taille = { paquet: paquet(livre, termes, { forme, ...options }).length, sections: regle.length }
  if (forme === 'tri') {
    const parForme = { enTetes: 0, fortes: { sections: 0, caracteres: 0 }, reduites: { sections: 0, passages: 0, caracteres: 0, sansPassage: [] } }
    for (const it of regle) {
      parForme.enTetes += enTete(it).length
      if (estForte(it)) { parForme.fortes.sections++; parForme.fortes.caracteres += texteDe(livre, it).length; continue }
      const passages = passagesDe(livre, it)
      parForme.reduites.sections++
      parForme.reduites.passages += passages.length
      parForme.reduites.caracteres += texteRendu(livre, it, forme).length
      if (!passages.length) parForme.reduites.sansPassage.push(it.ref)
    }
    return { forme, ...taille, parForme }
  }
  const parOrigine = tableTotale(ORIGINES, () => 0)
  for (const it of regle) {
    const n = texteDe(livre, it).length
    for (const o of new Set(it.origines.map((x) => x.origine))) parOrigine[o] += n
  }
  return { ...taille, parOrigine }
}

/** La consigne de tri : gabarit à trous `{{systeme}}`, `{{termes}}`, `{{paquet}}`. */
export const CONSIGNE_DE_TRI = new URL('./tri-consigne.md', import.meta.url)

/** Le gabarit rempli ; un trou qui n'y figure pas exactement une fois est une erreur. */
export function remplir(gabarit, valeurs) {
  let out = gabarit
  for (const [trou, valeur] of Object.entries(valeurs)) {
    const marque = `{{${trou}}}`
    if (out.split(marque).length !== 2) throw new Error(`paquet : le trou ${marque} ne figure pas une fois dans la consigne`)
    out = out.replace(marque, () => valeur)
  }
  return out
}

/** Le prompt d'un agent de tri : la consigne remplie du système, de ses termes et de son paquet `tri`. */
export function promptDeTri(livre, systeme, termes, gabarit = readFileSync(CONSIGNE_DE_TRI, 'utf8')) {
  return remplir(gabarit, { systeme, termes: termes.map((t) => `« ${t} »`).join(', '), paquet: paquet(livre, termes, { forme: 'tri' }) })
}

/** La ligne de commande : drapeaux, système de `--consigne`, livre et termes. */
function lireArguments(args) {
  const reste = []
  const o = { sansMention: false, tri: false, systeme: null }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sans-mention') o.sansMention = true
    else if (args[i] === '--tri') o.tri = true
    else if (args[i] === '--consigne') o.systeme = args[++i] ?? ''
    else reste.push(args[i])
  }
  const [bookId, ...termes] = reste
  return { ...o, bookId, termes }
}

function main() {
  const { sansMention, tri, systeme, bookId, termes } = lireArguments(process.argv.slice(2))
  if (!bookId || !termes.length || systeme === '' || (systeme != null && (!tri || sansMention))) {
    console.error('Usage : node scripts/raw/paquet.mjs <id du livre> [--sans-mention] [--tri [--consigne <système>]] <terme>…')
    process.exitCode = 2
    return
  }
  const livre = livreDuReleve(bookId)
  const options = { ...(sansMention ? { origines: ORIGINES.filter((o) => o !== 'mention') } : {}), ...(tri ? { forme: 'tri' } : {}) }
  process.stdout.write(systeme != null ? promptDeTri(livre, systeme, termes) : paquet(livre, termes, options))
  console.error(JSON.stringify(taillesDuPaquet(livre, termes, options)))
}

if (import.meta.main) main()

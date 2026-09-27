/**
 * Génère docs/rendu-pipeline.md — la carte du pipeline de rendu : « une scène, une apparence,
 * N projections ».
 *
 * Part FACTUELLE, DÉRIVÉE à chaque génération :
 *  - le PIVOT : l'union `SceneEl` et les interfaces `GP`/`MaterialRef`/`Face`/`ElBase`/`ElStates`
 *    de `src/gameIso/builders/types.ts` (champs + 1re phrase de JSDoc) ;
 *  - les BUILDERS : les fonctions `build*` réellement exportées sous `src/gameIso/builders/`, avec
 *    leur type de sortie, leur site et leur JSDoc ;
 *  - l'ARBORESCENCE de `src/gameIso/` : nombre de modules directs par sous-dossier ;
 *  - les clés d'AMBIANCE lues à `src/data/ambiance.json` ;
 *  - la COUVERTURE réelle de la garde anti-couleur, lue dans la garde elle-même (arborescences
 *    balayées, renderers nommés à la racine, blocs à part) ;
 *  - la population des CATALOGUES de matériaux.
 * La part ÉDITORIALE (contrat de perf, doctrine, « où ajouter… ») vit ICI, en dur.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-rendu-pipeline.mjs
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { listerDossier, listerArbre } from '../guards/lib/lister.mjs'
import ts from 'typescript'
import { loadSource, firstSentence, jsdocBody } from './lib/jsdocUnion.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'
import { fileExports } from './lib/engineExports.mjs'

const OUTIL = 'build-rendu-pipeline'
const ISO = 'src/gameIso'
const TYPES = `${ISO}/builders/types.ts`
const BUILDERS = `${ISO}/builders`
const GARDE = `${ISO}/renderer-no-hardcoded-color.test.ts`
const AMBIANCE = 'src/data/ambiance.json'
const DETAIL = `${ISO}/detail/types.ts`

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}
const ancre = (p, quoi) => {
  if (!existsSync(p)) abandon(`${quoi} : \`${p}\` introuvable (renommé/supprimé ?)`)
  return p
}
const plat = (s) => s.replace(/\s+/g, ' ').trim().replaceAll('|', '\\|')
for (const p of [TYPES, BUILDERS, GARDE, AMBIANCE, DETAIL]) ancre(p, 'source du générateur')

const { text: T_SRC, sf: T_SF } = loadSource(TYPES)
const ligne = (sf, pos) => sf.getLineAndCharacterOfPosition(pos).line + 1

// ── Le PIVOT : union `SceneEl` + les interfaces qui la composent ─────────────────────────────────

function alias(nom) {
  let a
  T_SF.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === nom) a = n
  })
  if (!a) abandon(`\`${nom}\` introuvable dans ${TYPES}`)
  return a
}

const SCENE_EL = (() => {
  const a = alias('SceneEl')
  if (!ts.isUnionTypeNode(a.type)) abandon(`\`SceneEl\` n'est plus une union dans ${TYPES}`)
  return { membres: a.type.types.map((t) => plat(t.getText(T_SF))), l: ligne(T_SF, a.name.getStart(T_SF)) }
})()
const PROP_EL = (() => {
  const a = alias('PropEl')
  return { membres: ts.isUnionTypeNode(a.type) ? a.type.types.map((t) => plat(t.getText(T_SF))) : [plat(a.type.getText(T_SF))], l: ligne(T_SF, a.name.getStart(T_SF)) }
})()

/** Champs d'une interface : nom (+ `?`), type aplati, 1re phrase de JSDoc. */
function champs(nom) {
  let decl
  T_SF.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n) && n.name.text === nom) decl = n
  })
  if (!decl) abandon(`interface \`${nom}\` introuvable dans ${TYPES}`)
  const rows = []
  let prevEnd = decl.members.pos
  for (const m of decl.members) {
    if (!ts.isPropertySignature(m)) continue
    const doc = jsdocBody(T_SRC.slice(prevEnd, m.getStart(T_SF)))
    rows.push({
      nom: m.name.getText(T_SF) + (m.questionToken ? '?' : ''),
      type: m.type ? plat(m.type.getText(T_SF)) : '—',
      role: doc ? plat(firstSentence(doc)) : null,
    })
    prevEnd = m.getEnd()
  }
  if (!rows.length) abandon(`interface \`${nom}\` sans propriété lisible (${TYPES})`)
  return { rows, l: ligne(T_SF, decl.name.getStart(T_SF)) }
}

const GP = champs('GP')
const MATERIAL = champs('MaterialRef')
const FACE = champs('Face')
const ELBASE = champs('ElBase')
const ELSTATES = champs('ElStates')

/** Domaines de matériau — l'univers FERMÉ lu au champ `domain` de `MaterialRef`. */
const DOMAINES = (() => {
  const d = MATERIAL.rows.find((r) => r.nom === 'domain' || r.nom === 'domain?')
  if (!d) abandon(`\`MaterialRef\` n'expose plus de champ \`domain\` (${TYPES})`)
  const vals = [...d.type.matchAll(/'([\w-]+)'/g)].map((m) => m[1])
  if (!vals.length) abandon(`le champ \`domain\` de \`MaterialRef\` n'est plus une union de littéraux`)
  return vals
})()

// ── Les BUILDERS réellement exportés ─────────────────────────────────────────────────────────────

const LISTE_BUILDERS = listerDossier(BUILDERS)
  .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
  .flatMap((f) =>
    fileExports(`${BUILDERS}/${f}`)
      .filter((e) => (e.kind === 'function' || e.kind === 'const') && /^build/.test(e.name))
      .map((e) => ({ ...e, fichier: `${BUILDERS}/${f}` })),
  )
if (LISTE_BUILDERS.length < 6) abandon(`moins de 6 builders exportés sous ${BUILDERS}/ — le pipeline a changé de forme`)

/** Type de sortie déclaré d'un builder (`FloorEl[]`…). Deux formes co-existent : `export function`
 *  (type de retour à la signature) et `export const b: (…) => X` (type de retour du TYPE FONCTION). */
function sortieDe(fichier, nom) {
  const { sf } = loadSource(fichier)
  let sortie = null
  const visite = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nom && n.type) sortie = n.type
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nom && n.type) {
      sortie = ts.isFunctionTypeNode(n.type) ? n.type.type : n.type
    }
    n.forEachChild(visite)
  }
  sf.forEachChild(visite)
  return sortie ? plat(sortie.getText(sf)) : '—'
}
const BUILDERS_MESURES = LISTE_BUILDERS.map((b) => ({ ...b, sortie: sortieDe(b.fichier, b.name) }))

// ── L'arborescence de gameIso : modules DIRECTS par sous-dossier ─────────────────────────────────

const estDossier = (p) => statSync(p).isDirectory()
const SOUS_DOSSIERS = listerDossier(ISO)
  .filter((nom) => estDossier(`${ISO}/${nom}`))
  .map((nom) => {
    const enfants = listerDossier(`${ISO}/${nom}`).map((f) => ({ f, dossier: estDossier(`${ISO}/${nom}/${f}`) }))
    return {
      nom,
      n: enfants.filter((e) => !e.dossier && /\.tsx?$/.test(e.f) && !e.f.includes('.test.')).length,
      sous: enfants.filter((e) => e.dossier).length,
    }
  })
if (SOUS_DOSSIERS.length < 5) abandon(`moins de 5 sous-dossiers sous ${ISO}/ — l'arborescence a changé`)

/** Rôle de chaque sous-dossier — ÉDITORIAL, mais la CLÉ est ancrée : un dossier renommé (ou neuf)
 *  fait échouer la génération plutôt que de laisser la carte mentir par omission. */
const ROLES = {
  authoring: 'peintres SVG (plan de station, aperçu d’éditeur, oracles de parité) — pilotés par `Dims`, seul pont monde→écran',
  backends: 'le MONDE, cuit en géométrie et rendu par une caméra réelle (three) — LE moteur du jeu en toutes vues',
  builders: 'dérivation PURE de la Scène en éléments sémantiques, en espace MONDE (aucun import de caméra ni d’écran)',
  catalog: 'catalogues d’apparence : ambiance, décor, dégradés — la couleur y est une DONNÉE',
  detail: 'détail de surface (matériaux v2) : recettes dépliées en primitives UV, déterministes au seed',
  fx: 'effets de combat — hors périmètre de la garde anti-couleur (couleur d’intention, pas d’identité de matériau)',
  pov: 'première personne : caméra, brume, boîtes de billboard, voiles d’écran',
  rig: 'art des sujets (bestiaire, équipement, véhicules) — hors périmètre de la garde anti-couleur',
  stage: 'hôtes de montage : le monde et ses surcouches React, le plan de station, le tri des objets',
}
const inconnus = SOUS_DOSSIERS.filter((d) => !ROLES[d.nom]).map((d) => d.nom)
if (inconnus.length) abandon(`sous-dossier(s) de ${ISO}/ sans rôle décrit dans ce script : ${inconnus.join(', ')} — décrire, ou corriger le renommage`)

// ── AMBIANCE : les clés de la donnée ─────────────────────────────────────────────────────────────

const AMB = JSON.parse(readFileSync(AMBIANCE, 'utf8'))
const CLES_AMB = Object.keys(AMB).filter((k) => !['id', 'type', 'label', 'desc', 'source', 'maison'].includes(k))
if (!CLES_AMB.length) abandon(`${AMBIANCE} ne porte plus aucune clé d'ambiance hors enveloppe`)

// ── DÉTAIL de surface : les sections d'une `DetailRecipe` ────────────────────────────────────────

const RECETTE = (() => {
  const { text, sf } = loadSource(DETAIL)
  let decl
  sf.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n) && n.name.text === 'DetailRecipe') decl = n
  })
  if (!decl) abandon(`interface \`DetailRecipe\` introuvable dans ${DETAIL}`)
  const rows = []
  let prevEnd = decl.members.pos
  for (const m of decl.members) {
    if (!ts.isPropertySignature(m)) continue
    const doc = jsdocBody(text.slice(prevEnd, m.getStart(sf)))
    rows.push({ nom: m.name.getText(sf) + (m.questionToken ? '?' : ''), role: doc ? plat(firstSentence(doc)) : null })
    prevEnd = m.getEnd()
  }
  if (!rows.length) abandon(`\`DetailRecipe\` sans section lisible (${DETAIL})`)
  return { rows, l: ligne(sf, decl.name.getStart(sf)) }
})()

// ── La GARDE anti-couleur : sa couverture RÉELLE, lue dans la garde ──────────────────────────────

const COUVERTURE = (() => {
  const src = readFileSync(GARDE, 'utf8')
  const liste = (nom) => {
    const m = src.match(new RegExp(`const ${nom} = \\[([\\s\\S]*?)\\]`))
    if (!m) abandon(`\`${nom}\` illisible dans ${GARDE} — la couverture de la garde ne se dérive plus`)
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }
  return { balayees: liste('SWEEP_DIRS'), racine: liste('ROOT_RENDERERS'), chrome: liste('CHROME_RENDERERS') }
})()
for (const d of COUVERTURE.balayees) ancre(`${ISO}/${d}`, `arborescence balayée par la garde anti-couleur`)
for (const f of [...COUVERTURE.racine, ...COUVERTURE.chrome]) ancre(`${ISO}/${f}`, `renderer nommé par la garde anti-couleur`)
const HORS = SOUS_DOSSIERS.filter((d) => !COUVERTURE.balayees.includes(d.nom)).map((d) => d.nom)

// ── Catalogues de matériaux : population mesurée ─────────────────────────────────────────────────

const CATALOGUES = ['structureAppearance', 'materials', 'decorPalette']
  .map((n) => ({ n, p: `src/data/${n}.json` }))
  .filter(({ p }) => existsSync(p))
  .map(({ n, p }) => {
    const d = JSON.parse(readFileSync(p, 'utf8'))
    const entrees = Array.isArray(d) ? d.length : d && typeof d === 'object' && d.entries ? Object.keys(d.entries).length : Object.keys(d).length
    return { n, p, entrees }
  })
if (CATALOGUES.length < 3) abandon(`moins de 3 catalogues de matériaux trouvés sous src/data/ — les noms ont changé`)

// ── APPENDICES du rig : le registre, ses defs, et qui les référence PAR ID ─────────────────────

const APPENDAGES = ancre(`${ISO}/rig/parts/appendages`, 'registre des appendices')
const APPENDAGES_DEFS = ancre(`${APPENDAGES}/defs`, 'defs du registre des appendices')

/** 1 appendice = 1 def qui porte SON art : l'id est LU au def et confronté au nom de fichier. */
const APPENDICES = listerDossier(APPENDAGES_DEFS)
  .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
  .map((f) => {
    const fichier = `${APPENDAGES_DEFS}/${f}`
    const t = readFileSync(fichier, 'utf8')
    const id = t.match(/\bid:\s*'([^']+)'/)?.[1]
    const label = t.match(/\blabel:\s*'([^']+)'/)?.[1]
    if (!id || !label) abandon(`def d'appendice \`${fichier}\` sans \`id\`/\`label\` lisible`)
    if (id !== f.replace(/\.ts$/, '')) abandon(`def d'appendice \`${fichier}\` : id « ${id} » ≠ nom de fichier`)
    return { id, label, fichier, dos: /^\s*back:/m.test(t), profil: /^\s*profile:/m.test(t) }
  })
if (APPENDICES.length < 3) abandon(`moins de 3 defs sous ${APPENDAGES_DEFS}/ — le registre a changé de forme`)

/** Références PAR ID hors du paquet registre : c'est la mesure du « référencé partout par id ». */
const CONSOMMATEURS = (() => {
  const fichiers = listerArbre(ISO, { filtre: (rel) => /\.tsx?$/.test(rel) && !rel.includes('.test.') })
    .map((rel) => `${ISO}/${rel}`)
    .filter((f) => !f.startsWith(`${APPENDAGES}/`))
  const parId = new Map(APPENDICES.map((a) => [a.id, new Set()]))
  for (const f of fichiers) {
    const t = readFileSync(f, 'utf8')
    for (const a of APPENDICES) if (t.includes(`'${a.id}'`)) parId.get(a.id).add(f)
  }
  return parId
})()

/** La primitive UNIQUE de résolution vue→art, et les coutures qui l'appellent sur un appendice. */
const PICKVIEW = (() => {
  const p = ancre(`${ISO}/rig/parts/types.ts`, 'primitive de résolution par vue')
  const { sf, text } = loadSource(p)
  const i = text.indexOf('export function pickView')
  if (i < 0) abandon(`\`pickView\` introuvable dans ${p} — la résolution des appendices ne se dérive plus`)
  return { fichier: p, ligne: ligne(sf, i) }
})()
const COUTURES = listerArbre(ISO, { filtre: (rel) => /\.tsx?$/.test(rel) && !rel.includes('.test.') })
  .map((rel) => `${ISO}/${rel}`)
  .filter((f) => !f.startsWith(`${APPENDAGES}/`) && readFileSync(f, 'utf8').includes('appendageArt('))
if (!COUTURES.length) abandon(`aucune couture n'appelle \`appendageArt(\` hors du registre — forme changée`)

const CAPTURE = ancre('scripts/qc/capture-jeu.mjs', 'capture QC du jeu')

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const table = (rows, entete, l) => `| ${entete.join(' | ')} |\n|${entete.map(() => '---').join('|')}|\n${rows.map(l).join('\n')}`
const tableChamps = (c) => table(c.rows, ['Champ', 'Type', 'Rôle (JSDoc)'], (r) => `| \`${r.nom}\` | \`${r.type}\` | ${r.role ?? '—'} |`)

const out = `# Pipeline de rendu — « une scène, une apparence, N projections »

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-rendu-pipeline.mjs\` (\`npm run docs:rendu-pipeline\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : les ${SCENE_EL.membres.length} membres
de \`SceneEl\` et les champs de \`GP\`/\`MaterialRef\`/\`Face\`/\`ElBase\`/\`ElStates\`
(\`${TYPES}\`), les ${BUILDERS_MESURES.length} builders exportés sous \`${BUILDERS}/\` avec leur type
de sortie, les ${SOUS_DOSSIERS.length} sous-dossiers de \`${ISO}/\` et leur nombre de modules directs, les
${CLES_AMB.length} clés d'ambiance de \`${AMBIANCE}\`, les ${RECETTE.rows.length} sections d'une
\`DetailRecipe\`, les ${APPENDICES.length} appendices du registre du rig avec leurs références par id, la
couverture RÉELLE de la garde anti-couleur (lue dans la garde) et la population
des ${CATALOGUES.length} catalogues de matériaux. **Angles morts** : ce doc décrit la FORME du
pipeline, pas le RÉSULTAT — aucune mesure ici ne dit qu'une scène est belle ou juste (c'est le rôle
de la QC visuelle et des oracles de parité) ; le comptage de modules est NON récursif (un
sous-dossier n'est pas replié dans le total de son parent) ; le rôle de chaque sous-dossier et la
section « où ajouter… » sont de l'ÉDITORIAL fixé dans le script — mais leurs CLÉS sont ancrées, un
dossier neuf ou renommé fait échouer la génération.

Le rendu du monde part d'UN document de scène et d'UNE couche d'apparence EN DONNÉE, et se projette
dans plusieurs vues sans dupliquer la logique. Deux étages nets :

\`\`\`
Scene ──(builders, PURS, espace MONDE)──▶ SceneEl[] ──┬─(monde volumique)──▶ canevas WebGL
                                                     └─(peintres d’authoring)──▶ SVG
\`\`\`

**Contrat de perf** : un builder n'importe ni dimensions d'écran ni caméra. Sa sortie survit à toute
rotation ou changement de projection ; la première personne n'hérite d'aucun concept d'écran.

## 1. Le pivot — \`${TYPES}\`

\`SceneEl\` (\`${TYPES}:${SCENE_EL.l}\`) = ${SCENE_EL.membres.map((m) => `\`${m}\``).join(' | ')} — union
discriminée par \`kind\`. \`PropEl\` (\`${TYPES}:${PROP_EL.l}\`) se subdivise elle-même en
${PROP_EL.membres.map((m) => `\`${m}\``).join(' | ')}.

### \`GP\` — un point en espace MONDE

${tableChamps(GP)}

### \`MaterialRef\` — une RÉFÉRENCE de matériau, jamais une couleur

${tableChamps(MATERIAL)}

Domaines fermés : ${DOMAINES.map((d) => `\`${d}\``).join(' · ')}. Le \`part\` distingue les faces d'un
même matériau ; la couleur est résolue au RENDU, depuis la donnée d'apparence et la lumière.

### \`Face\` — un polygone porteur d'un matériau

${tableChamps(FACE)}

### \`ElBase\` — l'identité MONDE commune à tous les éléments

${tableChamps(ELBASE)}

### \`ElStates\` — les vérités de SCÈNE, camera-free

${tableChamps(ELSTATES)}

La vérité de VUE (estompe d'occlusion, révélation, assombrissement d'un étage) reste une
**décoration** du rendu, jamais du pivot.

## 2. Les builders (${BUILDERS_MESURES.length})

${table(BUILDERS_MESURES, ['Builder', 'Sortie', 'Site', 'Rôle (JSDoc)'], (b) => `| \`${b.name}\` | \`${b.sortie}\` | \`${b.fichier}:${b.line}\` | ${b.role ? plat(b.role) : '—'} |`)}

## 3. L'arborescence de \`${ISO}/\`

${table(SOUS_DOSSIERS, ['Dossier', 'Modules directs', 'Sous-dossiers', 'Rôle'], (d) => `| \`${ISO}/${d.nom}/\` | ${d.n} | ${d.sous} | ${ROLES[d.nom]} |`)}

### Appendices du rig — UN registre, ${APPENDICES.length} ids, une seule résolution

Cornes et queues ne sont pas de l'art posé au cas par cas : \`${APPENDAGES}/\` est le registre UNIQUE, et
**1 appendice = 1 def \`defs/<id>.ts\` qui porte SON art** (\`front\` + \`profile\` dédié, \`back\` = \`front\` par
défaut) — aucune string SVG de corne ou de queue hors des defs. Les consommateurs les référencent **PAR ID**
et la résolution passe par la primitive unique \`pickView\` (\`${PICKVIEW.fichier}:${PICKVIEW.ligne}\`), appelée
sur un appendice par ${COUTURES.map((f) => `\`${f}\``).join(', ')}.

${table(APPENDICES, ['Appendice', 'id', 'Def', 'Dos propre', 'Référencé par'], (a) => {
  const c = [...CONSOMMATEURS.get(a.id)]
  return `| ${a.label} | \`${a.id}\` | \`${a.fichier}\` | ${a.dos ? 'oui' : '= face'} | ${c.length ? `${c.length} — ${c.map((f) => `\`${f}\``).join(', ')}` : '**0**'} |`
})}

Un **0** en « Référencé par » est une PISTE, pas une preuve de mort : la colonne compte les fichiers de
\`${ISO}/\` (hors tests et hors registre) qui citent l'id — un id choisi en donnée de scène ou au Codex n'y
apparaît pas. Ajouter un type d'appendice = déposer un def + \`npm run gen\` ; jamais un 4ᵉ mécanisme d'art.

## 4. Détail de surface — la recette (\`${DETAIL}:${RECETTE.l}\`)

Une \`DetailRecipe\` est une donnée PURE portée par les defs d'apparence ; ses dimensions sont en
mètres, et son dépliage en primitives UV est **déterministe au seed** — le SVG d'authoring et le
monde volumique retombent donc sur le MÊME détail.

${table(RECETTE.rows, ['Section', 'Rôle (JSDoc)'], (r) => `| \`${r.nom}\` | ${r.role ?? '—'} |`)}

## 5. Ambiance — \`${AMBIANCE}\`

${CLES_AMB.length} clés d'ambiance en donnée : ${CLES_AMB.map((k) => `\`${k}\``).join(' · ')}. Les deux
regards du monde et la QC headless consomment les MÊMES defs, assemblées une fois.

## 6. Garde anti-couleur — \`${GARDE}\`

Aucun renderer d'environnement ne porte de **littéral** de couleur : toute couleur vient de la
DONNÉE ou de la LUMIÈRE. La couverture ci-dessous est lue DANS la garde (aucune liste tenue ici) :

- **balayage récursif** de ${COUVERTURE.balayees.map((d) => `\`${ISO}/${d}/\``).join(', ')} — tout
  fichier NEUF y est couvert d'office ;
- **renderers nommés** à la racine : ${COUVERTURE.racine.map((f) => `\`${ISO}/${f}\``).join(', ')} ;
- **bloc à part** (chrome d'ÉTAT des jetons, allowlist neutre) :
  ${COUVERTURE.chrome.map((f) => `\`${ISO}/${f}\``).join(', ')} — un fichier passe par un bloc ou par
  l'autre, jamais par les deux.

${HORS.length ? `Hors balayage (couleur LÉGITIME : art de sujet, effets, ou donnée d'identité) : ${HORS.map((d) => `\`${ISO}/${d}/\``).join(', ')}.` : 'Tous les sous-dossiers sont balayés.'}

## 7. QC visuelle — \`${CAPTURE}\`

Instrument de **non-régression visuelle** : les planches se capturent DANS l'app (le jeu réel, son
monde et son écran), jamais par un rendu parallèle hors app — un second chemin de rendu jugerait
autre chose que ce que le joueur voit. Copier les planches AVANT un changement d'apparence,
relancer, comparer : une migration donnée-neutre doit rester identique.

## 8. Où ajouter…

${table(CATALOGUES, ['Catalogue', 'Entrées'], (c) => `| \`${c.p}\` | ${c.entrees} |`)}

- **un matériau** (structure / relief / toit) : une entrée dans le catalogue correspondant ci-dessus
  (id + couleurs par \`part\` + \`detail\` optionnelle). Les éléments le référencent par id ; le rendu
  résout les couleurs par \`part\`.
- **un ton de décor** : une entrée dans la palette — jamais un hex dans un renderer (§6).
- **un terrain** : une entrée dans \`src/data/terrains.json\` (règle ET rendu dans la même entrée).
- **un prop / décor** : une def sous \`${ISO}/catalog/decor/defs/\`, puis \`npm run gen\`. Symétrique →
  un seul dessin ; directionnel → il DÉCLARE ses vues, et la sélection vue + miroir + repli se fait
  dans la MACHINERIE partagée, jamais dans la def.
- **un TYPE d'élément** (au-delà des ${SCENE_EL.membres.length} membres de \`SceneEl\`) : ajouter le variant au pivot,
  son builder, sa cuisson dans le monde volumique, et — s'il doit se voir à l'authoring — son peintre
  SVG avec sa profondeur de tri.
`

ecrireOuVerifier({
  out,
  path: 'docs/rendu-pipeline.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:rendu-pipeline — docs/rendu-pipeline.md est PÉRIMÉ (diverge de src/gameIso/, de src/data/ambiance.json, de la garde anti-couleur, ou du script).',
  rerunMsg: '  → relancer `npm run docs:rendu-pipeline` et committer le résultat.',
  okMsg: 'docs:rendu-pipeline — OK (docs/rendu-pipeline.md à jour)',
  writeMsg: `docs/rendu-pipeline.md — ${SCENE_EL.membres.length} membres de SceneEl, ${BUILDERS_MESURES.length} builders, ${SOUS_DOSSIERS.length} sous-dossiers, ${CATALOGUES.length} catalogues.`,
})

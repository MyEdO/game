#!/usr/bin/env node
// SONDE du classement des tests de `src/state` (#3058, lot 1) : range chaque test du périmètre (arbre d'une
// révision) dans UNE classe de `classeur.mjs`, signale minuteries et cadence `auto`, et compte les chemins de tests
// de `src/state` que citent stocks et docs. LECTURE SEULE : elle imprime le rapport sur la sortie standard. Mode
// d'emploi : `README.md` du même dossier.
import { posix } from 'node:path'
import { RACINE } from '../audit-2026-09-01/_socle.mjs'
import { depotDe, fichiersDuGrep, lireEnLot, listerImage, shaDe } from '../../../guards/lib/gitPorte.mjs'
import { CHEMIN_TSCONFIG, aliasDe, analyserEnLots, clotureDImports } from '../../../guards/lib/importGraph.mjs'
import { libererSessions, repoProgram } from '../../../guards/lib/tsProgram.mjs'
import { zoneDe } from '../../../guards/lib/couches.mjs'
import { tableTotale } from '../../../../src/lib/tableTotale.ts'
import {
  CLASSES, STORE, TYPES_DE_L_ADAPTATEUR, TYPE_DE_L_ETAT, arcsDuTest, cheminsCites, classer, clesDesTypes, clesDuStore,
  estBanc, estHorsStore, estTest, lireUnTest, nomsNusCites, proceduresDeLHote, signauxDuTest,
} from './classeur.mjs'

const USAGE = `Usage : node scripts/ops/sondes/classement-tests-state/sonde.mjs [<révision>]
  <révision> : l'arbre classé (défaut HEAD).
`
/** Les dossiers où vivent les tests et les zones. */
const DOSSIERS = ['src', 'hotes']
const SCRIPT = /\.(?:[cm]?[jt]sx?)$/
/** Les sources du programme qui résout les types du store : le code et les données que le code importe. */
const SOURCE_DU_PROGRAMME = /\.(?:tsx?|json)$/
/** Les zones dont la logique de jeu relève de #3059 (décision nommée du design v2.1). */
const RENVOI = Object.freeze({ ui: '#3059', gameIso: '#3059' })
/** Les stocks, docs et sources qui peuvent citer un test de `src/state`, par son chemin ou par son nom nu. */
const PATHSPECS_DES_CITATIONS = ['scripts/guards', 'docs', 'src']
const MOTIF_DES_CITATIONS = String.raw`[A-Za-z0-9_-]+\.test\.[a-z]+`

const [revision = 'HEAD', ...trop] = process.argv.slice(2)
if (trop.length || revision.startsWith('-')) {
  process.stderr.write(USAGE)
  process.exit(2)
}
const racine = posix.normalize(RACINE.split('\\').join('/')).replace(/\/$/, '')
const depot = depotDe(racine)
const sha = shaDe(depot, revision)
if (!sha) {
  process.stderr.write(`révision introuvable : ${revision}\n${USAGE}`)
  process.exit(2)
}

const arbre = listerImage(depot, sha, ...DOSSIERS)
const presents = new Set(arbre)
const tests = arbre.filter((c) => estTest(c) && SCRIPT.test(c))
const textes = lireEnLot(depot, sha, [CHEMIN_TSCONFIG, ...new Set([...arbre.filter((c) => SOURCE_DU_PROGRAMME.test(c)), ...tests])])
const texteDe = (rel) => {
  const t = textes.get(rel)
  if (t === null || t === undefined) throw new Error(`${rel} illisible à ${sha}`)
  return t
}

// Les clés du store, lues par le vérificateur sur les sources de la révision.
const recouvrement = tableTotale([CHEMIN_TSCONFIG, ...arbre.filter((c) => SOURCE_DU_PROGRAMME.test(c))], texteDe)
const session = repoProgram(racine, () => [STORE], recouvrement)
let cles
try {
  cles = clesDuStore(clesDesTypes(session, `${racine}/${STORE}`, [TYPE_DE_L_ETAT, ...TYPES_DE_L_ADAPTATEUR]))
} finally {
  libererSessions([session])
}

// Les tests lus : ceux de `src/state`, ceux dont un spécificateur peut viser `src/state`, ceux qui ouvrent une partie
// sans store.
const aLire = tests.filter((c) => zoneDe(c) === 'state' || estHorsStore(c) || texteDe(c).includes('state'))
const existe = (abs) => presents.has(posix.relative(racine, abs)) || abs === `${racine}/${CHEMIN_TSCONFIG}`
const alias = aliasDe(texteDe(CHEMIN_TSCONFIG), racine)
/** @type {Map<string, { lecture: ReturnType<typeof lireUnTest>, arcs: ReturnType<typeof arcsDuTest> }>} */
const lus = new Map()
for (const { fichier, sourceFile, diagnostics } of analyserEnLots(aLire.map((rel) => ({ rel, text: texteDe(rel) })))) {
  const lecture = lireUnTest(fichier.rel, sourceFile, diagnostics)
  lus.set(fichier.rel, { lecture, arcs: arcsDuTest(lecture, { racine, existe, alias }) })
}

// Ce qu'un arc d'exécution hors de `src/state` charge en transit : sa clôture STATIQUE d'exécution (`clotureDImports`,
// types effacés, sans `import()`), marchée dans `src/` sur l'arbre de la révision ; le store s'il y est, sinon le
// premier module de `src/state` hors banc.
const ensemble = {
  existe,
  lire: (abss) => {
    const rels = abss.map((abs) => posix.relative(racine, abs))
    const manquants = lireEnLot(depot, sha, rels.filter((rel) => !textes.has(rel)))
    return new Map(abss.map((abs, i) => [abs, textes.get(rels[i]) ?? manquants.get(rels[i]) ?? null]))
  },
  fichiers: arbre.map((rel) => `${racine}/${rel}`),
}
const marche = { racine, cache: new Map(), typesEffaces: true, dynamiques: false, arbre: ensemble, retenir: (abs) => abs.startsWith(`${racine}/src/`) }
/** @type {Map<string, string | null>} */
const transitDe = new Map()
const chargeLeStore = (cible) => {
  if (!transitDe.has(cible)) {
    const atteints = [...clotureDImports([cible], marche)].filter((m) => zoneDe(m) === 'state' && !estBanc(m)).sort()
    transitDe.set(cible, atteints.includes(STORE) ? STORE : atteints[0] ?? null)
  }
  return transitDe.get(cible)
}

/** @type {Map<string, string[]>} */
const horsStore = new Map()
for (const [rel, { arcs }] of lus) {
  if (!estHorsStore(rel)) continue
  for (const p of proceduresDeLHote(arcs)) horsStore.set(p, [...(horsStore.get(p) ?? []), rel].sort())
}

const perimetre = [...lus.keys()]
  .filter((rel) => zoneDe(rel) === 'state' || lus.get(rel).arcs.some((a) => a.zone === 'state'))
  .sort()
const classes = perimetre.map((rel) => {
  const t = lus.get(rel)
  return { rel, zone: zoneDe(rel), ...classer(t, { ...cles, horsStore, chargeLeStore }),
    sansTransit: classer(t, { ...cles, horsStore, chargeLeStore: () => null }).classe, ...signauxDuTest(t.lecture),
    zonesImportees: [...new Set(t.arcs.filter((a) => !a.typeSeul).map((a) => a.zone ?? 'hors zone'))].sort() }
})
const nonClasses = classes.filter((c) => !CLASSES.includes(c.classe))
const reclasses = classes.filter((c) => c.sansTransit !== c.classe)

// Les citations de tests de `src/state` : par chemin, et par nom nu (le nom de base d'un test de `src/state`).
const nomsDeBase = new Set(tests.filter((c) => zoneDe(c) === 'state').map((c) => posix.basename(c)))
const citants = fichiersDuGrep(depot, [sha], MOTIF_DES_CITATIONS, PATHSPECS_DES_CITATIONS).sort()
const textesCitants = lireEnLot(depot, sha, citants)
const citations = citants.map((f) => {
  const texte = textesCitants.get(f) ?? ''
  const chemins = cheminsCites(texte)
  return { f, chemins: chemins.length, absents: chemins.filter((c) => !presents.has(c)).length, nus: nomsNusCites(texte, nomsDeBase) }
}).filter((c) => c.chemins || c.nus.length).sort((a, b) => b.chemins - a.chemins || b.nus.length - a.nus.length || (a.f < b.f ? -1 : 1))

// Le rapport.
const zones = [...new Set(classes.map((c) => c.zone))].sort()
const compte = (filtre) => classes.filter(filtre).length
const liste = (xs) => (xs.length ? xs.join(', ') : '—')
const sortie = [
  `# Classement des tests de src/state (#3058) à \`${sha}\``,
  '',
  `Commande : \`node scripts/ops/sondes/classement-tests-state/sonde.mjs ${revision}\`.`,
  `Périmètre : ${classes.length} fichiers — ${compte((c) => c.zone === 'state')} sous src/state, ${compte((c) => c.zone !== 'state')} hors src/state qui importent src/state.`,
  `Clés : adaptateur ${cles.adaptateur.size} (${TYPES_DE_L_ADAPTATEUR.join(' + ')}), jeu ${cles.jeu.size} (${TYPE_DE_L_ETAT} hors adaptateur). Procédures de src/hote importées par un test hors store : ${horsStore.size}.`,
  `Non classés : ${nonClasses.length}.`,
  `Transit : ${compte((c) => c.transits.length > 0)} fichiers chargent src/state par un arc hors de src/state ; ${reclasses.length} en changent de classe (${liste([...new Set(reclasses.map((c) => `${c.sansTransit} → ${c.classe}`))].sort())}).`,
  '',
  '## Par classe',
  '',
  '| Classe | Fichiers | dont sous src/state |',
  '|---|---|---|',
  ...CLASSES.map((k) => `| ${k} | ${compte((c) => c.classe === k)} | ${compte((c) => c.classe === k && c.zone === 'state')} |`),
  `| total | ${classes.length} | ${compte((c) => c.zone === 'state')} |`,
  '',
  '## Par zone du test',
  '',
  `| Zone | ${CLASSES.join(' | ')} | Total | Renvoi |`,
  `|---|${CLASSES.map(() => '---|').join('')}---|---|`,
  ...zones.map((z) => `| ${z} | ${CLASSES.map((k) => compte((c) => c.zone === z && c.classe === k)).join(' | ')} | ${compte((c) => c.zone === z)} | ${RENVOI[z] ?? '—'} |`),
  '',
  '## Signaux',
  '',
  `- \`useFakeTimers\` : ${compte((c) => c.poseLHorloge)} fichiers ; horloge avancée (\`advanceTimers*\`, \`runAllTimers\`, \`runOnlyPendingTimers\`) : ${compte((c) => c.avanceLHorloge.length > 0)}.`,
  `- Cadence \`auto\` : ${compte((c) => c.cadenceAuto)} fichiers.`,
  '',
  `## Citations de tests de src/state (${PATHSPECS_DES_CITATIONS.join(', ')})`,
  '',
  '| Fichier | Chemins cités | dont absents de l\'arbre | Noms nus cités |',
  '|---|---|---|---|',
  ...citations.map((c) => `| \`${c.f}\` | ${c.chemins} | ${c.absents} | ${liste(c.nus)} |`),
  '',
  '## Fichiers',
  '',
  '| Fichier | Classe | Base | Zones importées | Clés d\'adaptateur | Clés du jeu | Modules web | Transit vers src/state | Doublon de | Minuteries | Auto | Renvoi |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...classes.map((c) => `| \`${c.rel}\` | ${c.classe} | ${c.base} | ${liste(c.zonesImportees)} | ${liste(c.clesAdaptateur)} | ${c.clesJeu} | ${liste(c.modulesWeb)} | ${liste(c.transits)} | ${liste(c.doublons.map((d) => `${d.procedure} (${d.tests.join(', ')})`))} | ${liste([...(c.poseLHorloge ? ['useFakeTimers'] : []), ...c.avanceLHorloge])} | ${c.cadenceAuto ? 'oui' : '—'} | ${RENVOI[c.zone] ?? '—'} |`),
  '',
].join('\n')
process.stdout.write(sortie)
if (nonClasses.length) {
  process.stderr.write(`${nonClasses.length} fichier(s) non classé(s) :\n${nonClasses.map((c) => `  ${c.rel}\n`).join('')}`)
  process.exit(1)
}

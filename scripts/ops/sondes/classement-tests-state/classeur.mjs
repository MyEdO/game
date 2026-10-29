// FONCTIONS PURES du classement des tests de `src/state` (#3058, lot 1) : lecture d'un test sur son arbre TypeScript
// (sites d'import, noms lus, marqueurs), arcs résolus contre un ensemble de fichiers, clés d'un type lues par le
// vérificateur, classe d'un test, chemins de tests cités par un texte. Aucune ne touche le disque ni git : `sonde.mjs`
// les compose. Testées par `classeur.test.mjs`.
import { posix } from 'node:path'
import { typescript } from '../../../guards/lib/dialecte.mjs'
import { resolveImport, sitesDeModule } from '../../../guards/lib/importGraph.mjs'
import { zoneDe } from '../../../guards/lib/couches.mjs'
import { SUFFIXE_SUITE, estKitDeTest, estSuiteVitest } from '../../../guards/lib/fichierVitest.mjs'
import { estDeLaSuiteDuNoyau } from '../../../guards/lib/racinesDeLaSuite.mjs'
import { tableTotale } from '../../../../src/lib/tableTotale.ts'

/** Les classes, dans l'ordre du rapport. */
export const CLASSES = Object.freeze(['noyau', 'web', 'mixte', 'moteur', 'doublon'])

/** Le store web : le module de `src/state` qui compose `GameState`. */
export const STORE = 'src/state/store.ts'

/** Les types de `STORE` qui donnent les clés : l'état complet, et les deux interfaces de l'adaptateur. */
export const TYPE_DE_L_ETAT = 'GameState'
export const TYPES_DE_L_ADAPTATEUR = Object.freeze(['EtatDeLAdaptateur', 'ActionsDeLAdaptateur'])

/** Un fichier de test (`estSuiteVitest`), et un test qui ouvre une partie sans store (`estDeLaSuiteDuNoyau`). */
export const estTest = estSuiteVitest
export const estHorsStore = estDeLaSuiteDuNoyau

/** Un module de banc (`estKitDeTest`, `*.fixture.*`) : il porte le store au test, il n'est pas une liaison web. */
export const estBanc = (rel) => estKitDeTest(rel) || /\.fixture\.[^/]+$/.test(rel)

/** Les noms de minuteries de Vitest qu'un test appelle : la pose de l'horloge, puis ce qui l'avance. */
const POSE_DE_L_HORLOGE = 'useFakeTimers'
const AVANCE_DE_L_HORLOGE = /^(?:advanceTimers\w*|runAllTimers|runOnlyPendingTimers)$/

/**
 * Les clés (propriétés) de chaque type nommé de `noms`, déclaré (interface ou alias) au premier niveau du fichier
 * `fichier` du programme : le vérificateur résout héritages, intersections et types dérivés. Triées. LÈVE si le
 * fichier ou un type manque.
 * @param {{ program: any, checker: any }} session @param {string} fichier chemin du fichier dans le programme
 * @param {readonly string[]} noms @returns {Record<string, string[]>}
 */
export function clesDesTypes({ program, checker }, fichier, noms) {
  const ts = typescript()
  const sf = program.getSourceFile(fichier)
  if (!sf) throw new Error(`clesDesTypes : ${fichier} absent du programme`)
  const declarations = new Map()
  sf.forEachChild((n) => {
    if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && noms.includes(n.name.text)) declarations.set(n.name.text, n)
  })
  return tableTotale(noms, (nom) => {
    const n = declarations.get(nom)
    if (!n) throw new Error(`clesDesTypes : type \`${nom}\` introuvable au premier niveau de ${fichier}`)
    const type = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(n.name))
    return checker.getPropertiesOfType(type).map((p) => p.name).sort()
  })
}

/**
 * Les clés de l'adaptateur et du jeu à partir des clés des types de `STORE` : l'adaptateur est l'union des
 * `TYPES_DE_L_ADAPTATEUR`, le jeu est `TYPE_DE_L_ETAT` privé de l'adaptateur.
 * @param {Record<string, string[]>} cles @returns {{ adaptateur: Set<string>, jeu: Set<string> }}
 */
export function clesDuStore(cles) {
  const adaptateur = new Set(TYPES_DE_L_ADAPTATEUR.flatMap((t) => cles[t]))
  return { adaptateur, jeu: new Set(cles[TYPE_DE_L_ETAT].filter((k) => !adaptateur.has(k))) }
}

/**
 * La lecture d'un test sur son arbre : ses sites d'import (`sitesDeModule`, liaisons comprises), les noms de
 * propriété qu'il lit ou écrit (`a.k`, `a['k']`, `{ k } = …`, `{ k: v }`), ses identifiants et ses chaînes.
 * @param {string} rel @param {any} sourceFile @param {readonly any[]} diagnostics
 */
export function lireUnTest(rel, sourceFile, diagnostics) {
  const ts = typescript()
  const sites = sitesDeModule(rel, sourceFile, diagnostics)
    .filter((s) => s.acquisition && s.spec !== null)
    .map((s) => ({
      spec: s.spec,
      nature: s.nature,
      typeSeul: s.nature === 'type' || (s.liaisons.length > 0 && s.liaisons.every((l) => l.typeSeul)),
      importes: s.genre === 'import' ? s.liaisons.filter((l) => !l.typeSeul).map((l) => l.importe?.nom ?? '*') : [],
    }))
  const noms = new Set()
  const identifiants = new Set()
  const chaines = new Set()
  const nomDe = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteralLikeNode(n)) ? n.text : null)
  const poser = (n) => { const k = nomDe(n); if (k !== null) noms.add(k) }
  const visiter = (n) => {
    if (ts.isPropertyAccessExpression(n)) poser(n.name)
    else if (ts.isElementAccessExpression(n)) poser(n.argumentExpression)
    else if (ts.isObjectBindingPattern(n)) for (const e of n.elements) poser(e.propertyName ?? e.name)
    else if (ts.isObjectLiteralExpression(n)) for (const p of n.properties) poser(p.name)
    if (ts.isIdentifier(n)) identifiants.add(n.text)
    else if (ts.isStringLiteralLikeNode(n)) chaines.add(n.text)
    n.forEachChild(visiter)
  }
  visiter(sourceFile)
  return { rel, sites, noms, identifiants, chaines }
}

/**
 * Les arcs d'une lecture, résolus (`resolveImport`) contre l'ensemble que dit `existe` (chemins absolus POSIX) sous
 * `racine` : cible relative, zone (`zoneDe`), arc de type seul, liaisons importées en valeur. Un spécificateur qui ne
 * se résout pas (paquet) ne fait pas d'arc.
 * @param {ReturnType<typeof lireUnTest>} lecture
 * @param {{ racine: string, existe: (abs: string) => boolean, alias: readonly { prefixe: string, vers: string }[] }} arbre
 */
export function arcsDuTest(lecture, { racine, existe, alias }) {
  const arcs = []
  for (const site of lecture.sites) {
    const cible = resolveImport(`${racine}/${lecture.rel}`, site.spec, existe, alias, site.nature)
    if (!cible) continue
    const rel = posix.relative(racine, cible)
    arcs.push({ cible: rel, zone: zoneDe(rel), typeSeul: site.typeSeul, importes: site.importes })
  }
  return arcs
}

/** Les procédures de `src/hote` qu'importent ces arcs, en valeur : `<module>#<nom>`, triées. Un test ou un banc de
 *  `src/hote` n'est pas une procédure. */
export const proceduresDeLHote = (arcs) => [...new Set(arcs
  .filter((a) => a.zone === 'hote' && !a.typeSeul && !estTest(a.cible) && !estBanc(a.cible))
  .flatMap((a) => a.importes.map((nom) => `${a.cible}#${nom}`)))].sort()

/**
 * Les signaux d'une lecture : les noms de minuteries appelés (`useFakeTimers`, ceux qui avancent l'horloge), et la
 * cadence `auto` — `initCombatAuto`, ou la chaîne `'auto'` à côté d'une écriture de cadence (`setCadence`, champ
 * `cadence`, préférence `'combat-cadence'`).
 * @param {ReturnType<typeof lireUnTest>} lecture
 */
export function signauxDuTest({ noms, identifiants, chaines }) {
  const appeles = new Set([...noms, ...identifiants])
  const ecritLaCadence = appeles.has('setCadence') || noms.has('cadence') || chaines.has('combat-cadence')
  return {
    poseLHorloge: appeles.has(POSE_DE_L_HORLOGE),
    avanceLHorloge: [...appeles].filter((n) => AVANCE_DE_L_HORLOGE.test(n)).sort(),
    cadenceAuto: appeles.has('initCombatAuto') || (chaines.has('auto') && ecritLaCadence),
  }
}

/**
 * La CLASSE d'un test, par critères mécaniques, dans cet ordre :
 *  - `doublon` : il importe une procédure de `src/hote` qu'un test hors store importe déjà ;
 *  - `moteur` : aucun arc d'exécution vers `src/state`, ni direct ni en transit ;
 *  - sinon, part web (une clé de l'adaptateur lue, un module de `src/state` hors store et hors banc importé, ou un
 *    arc d'exécution hors de `src/state` qui charge `src/state` en transit) et part jeu (une clé du jeu lue) : les
 *    deux → `mixte`, la part web seule → `web`, sinon `noyau`.
 * `base` : la classe que le test aurait sans le critère `doublon`.
 * @param {{ lecture: ReturnType<typeof lireUnTest>, arcs: ReturnType<typeof arcsDuTest> }} test
 * @param {{ adaptateur: Set<string>, jeu: Set<string>, horsStore: Map<string, string[]>,
 *   chargeLeStore: (cible: string) => string | null }} contexte `horsStore` : `<module>#<nom>` → tests hors store qui
 *   l'importent ; `chargeLeStore` : le module de `src/state` (le store, ou un module hors banc) que la cible hors de
 *   `src/state` charge à l'exécution, `null` si aucun
 */
export function classer({ lecture, arcs }, { adaptateur, jeu, horsStore, chargeLeStore }) {
  const etat = arcs.filter((a) => a.zone === 'state' && !a.typeSeul)
  const clesAdaptateur = [...lecture.noms].filter((k) => adaptateur.has(k)).sort()
  const clesJeu = [...lecture.noms].filter((k) => jeu.has(k)).sort()
  const modulesWeb = [...new Set(etat.map((a) => a.cible).filter((c) => c !== STORE && !estBanc(c)))].sort()
  const transits = [...new Set(arcs.filter((a) => a.zone !== 'state' && !a.typeSeul).map((a) => a.cible))].sort()
    .flatMap((cible) => { const via = chargeLeStore(cible); return via ? [`${cible} → ${via}`] : [] })
  const web = clesAdaptateur.length > 0 || modulesWeb.length > 0 || transits.length > 0
  const base = etat.length === 0 && transits.length === 0 ? 'moteur' : web && clesJeu.length ? 'mixte' : web ? 'web' : 'noyau'
  const doublons = proceduresDeLHote(arcs).filter((p) => horsStore.has(p))
  return {
    classe: doublons.length ? 'doublon' : base,
    base,
    clesAdaptateur,
    clesJeu: clesJeu.length,
    modulesWeb,
    transits,
    doublons: doublons.map((p) => ({ procedure: p, tests: horsStore.get(p) })),
  }
}

/** Un chemin de test de `src/state` cité dans un texte : `src/state/…` puis `SUFFIXE_SUITE`. */
const CITATION = new RegExp(String.raw`src/state/[\w./-]*?${SUFFIXE_SUITE}(?![\w])`, 'g')

/** Les chemins de tests de `src/state` que cite `texte`, sans doublon, triés. */
export function cheminsCites(texte) {
  return [...new Set(texte.match(CITATION) ?? [])].sort()
}

/** Un nom de fichier de test NU (sans dossier) dans un texte : ni précédé d'un chemin ni d'un mot. */
const NOM_NU = new RegExp(String.raw`(?<![\w./-])[\w-]+(?:\.[\w-]+)*?${SUFFIXE_SUITE}(?!\w|\.\w)`, 'g')

/** Les noms de base de `noms` (`<nom>.test.<ext>` de tests de `src/state`) que `texte` cite NUS, sans dossier :
 *  une citation qu'un renommage ne retrouve pas par son chemin, et qu'un homonyme d'une autre zone rend ambiguë.
 *  Sans doublon, triés. */
export function nomsNusCites(texte, noms) {
  return [...new Set((texte.match(NOM_NU) ?? []).filter((n) => noms.has(n)))].sort()
}

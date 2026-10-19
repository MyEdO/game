import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, posix, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MessageChannel, Worker, receiveMessageOnPort } from 'node:worker_threads'
import { typescript, analyserCorpus } from '../guards/lib/dialecte.mjs'
import { LOT_D_ANALYSE, analyserEnLots, clotureDImports, grapheInverse, resolveImport, aliasDuDepot, estModule, liaisonsDe, CHEMIN_TSCONFIG } from '../guards/lib/importGraph.mjs'
import { APPEL_DE_LECTURE, certifierLecture, evaluerLotDuDepot, evaluer, lecteurDExpressions, lectureDeModule, partiesDeRequete, encoderLecture, mesureLecture } from '../guards/lib/racinesBalayees.mjs'
import { estDeLaSuiteVitest } from '../guards/lib/racinesDeLaSuite.mjs'
import { estTestNode } from '../gates/testsParGate.mjs'
import { baseCommune, ceQuiChange, depotDe, entreesDe, lireEnLot, listerImage, SUIVI, TRAVAIL, TRONC } from '../guards/lib/gitPorte.mjs'
import { ancetresDe, LECTURES_DES_DEPENDANCES } from '../git-hooks/selection-des-derives.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { memosDe, PAQUETS_VERSIONNANTS, texteSiPresent } from '../guards/lib/memosDAnalyse.mjs'
import { empreinteDe, fermetureSurDisque } from '../guards/lib/porteDEre.mjs'
const RACINE = fileURLToPath(new URL('../..', import.meta.url))
/** Les fichiers dont un changement invalide toute dérivation : la suite entière est retenue. */
const TOOLCHAIN = Object.freeze([...LECTURES_DES_DEPENDANCES, 'vite.config.ts', 'tsconfig.json', 'scripts/guards/lib/racinesDeLaSuite.mjs'])

/** Le RANG d'un lien, du plus proche au plus lointain : touché, racine balayée (à rang égal, la plus
 *  SPÉCIFIQUE : `specificite`), import par distance, puis `setup` (le fichier n'est atteint que par les
 *  `setupFiles`, racine de TOUT test Vitest) et toolchain. */
export const RANG_SETUP = 1_000_000
export const RANG_TOOLCHAIN = RANG_SETUP + 1
const rangDe = (lien) => lien.nature === 'touché' ? 0 : lien.nature === 'racine balayée' ? 1
  : lien.nature === 'import' ? 1 + lien.distance : lien.nature === 'setup' ? RANG_SETUP : RANG_TOOLCHAIN
/** La config Vitest d'où se lisent les `setupFiles`. */
const CONFIG_VITEST = 'vite.config.ts'

/** Les VARIANTES gardées par évaluation de module (`evaluations`) : une par jeu de réponses, les tours du
 *  point fixe des lecteurs en posant plusieurs. */
const VARIANTES = 8

/** Le dossier des mémos, relatif à la racine du dépôt. */
export const CACHE = 'node_modules/.cache/perimetre'
/** L'empreinte de blob git d'un texte (`git hash-object`). */
const blobDe = (texte) => {
  const octets = Buffer.from(texte, 'utf8')
  return createHash('sha1').update(`blob ${octets.length}\0`).update(octets).digest('hex')
}

/** La racine `r` couvre-t-elle `chemin` (égalité, ou ANCÊTRE : `ancetresDe`) ? */
const couvre = (r, chemin) => chemin === r || ancetresDe(chemin).includes(r)

/**
 * Les fichiers touchés et les images d'un diff. `tete` absente : l'arbre de travail contre la base
 * commune avec `origin/main` (ou `base`), index, suivis modifiés et non suivis compris.
 * @returns {{ base: string, tete: string | null, touches: string[], post: string[], avant: string[] }}
 */
function imagesDuDiff(depot, { base, tete } = {}) {
  const borne = base ?? baseCommune(depot, TRONC.suivi, 'HEAD')
  if (!borne) throw new Error(`perimetre : base commune avec ${TRONC.suivi} introuvable — nommer --base`)
  const avant = listerImage(depot, borne)
  if (tete) return { base: borne, tete, touches: ceQuiChange(depot, borne, tete).chemins(), post: listerImage(depot, tete), avant }
  const post = listerImage(depot, TRAVAIL)
  const tete0 = new Set(listerImage(depot, 'HEAD'))
  const touches = [...new Set([...ceQuiChange(depot, borne, SUIVI).chemins(), ...post.filter((f) => !tete0.has(f))])].sort()
  return { base: borne, tete: null, touches, post, avant }
}

/** Les `setupFiles` de la config Vitest (`CONFIG_VITEST`), lus sur son arbre syntaxique (`analyser`). */
function setupFilesDe(texte, analyser) {
  if (texte === null) return []
  const ts = typescript()
  const [{ sourceFile }] = [...analyser([{ rel: CONFIG_VITEST, text: texte }])]
  const { expr, lambdas } = lecteurDExpressions(CONFIG_VITEST, sourceFile)
  const vus = []
  const visiter = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'setupFiles') vus.push(...evaluer(expr(n.initializer), { lambdas }))
    n.forEachChild(visiter)
  }
  visiter(sourceFile)
  const non = vus.find((v) => !('chemin' in v))
  if (non) throw new Error(`perimetre : setupFiles de ${CONFIG_VITEST} illisible (${non.non ?? 'hors du dépôt'})`)
  return vus.map((v) => v.chemin)
}

/** @typedef {{ site: string, fichier: string, helper: string, raison: string, moduleBalaieLeDepot: boolean }} NonResolu */

/**
 * DÉRIVATION du périmètre. PURE hormis `lire` et les mémos. Chaque lot s'évalue par `evaluerLot` sur la
 * clôture de ses lectures. `tailleLot` (questions par lot d'évaluation), `analyser`, `evaluerLot` et
 * `limiteIR` valent ceux de la production par défaut. `analyser` sert aussi la clôture d'imports (`clotureDImports`) ;
 * `stade` observe aussi chaque certification (`certifierLecture`) et chaque lot (`evaluerLot`).
 * @param {{ racine: string, touches: string[], post: string[], avant: string[], lire: (rels: string[]) => Map<string, string | null>, memos?: ReturnType<typeof memosDeDerivation> }} entree
 * @returns {{ retenus: Map<string, Lien>, toolchain: string[], nonResolus: NonResolu[], vitest: string[], node: string[], modules: number }}
 */
export function deriverPerimetre({ racine, touches, post, avant, lire, lireAvant, memos, stade = () => {},
  tailleLot = LOT_D_ANALYSE, analyser = analyserEnLots, evaluerLot = evaluerLotDuDepot, limiteIR = LIMITE_IR }) {
  stade('graphe', null)
  const base = resolve(racine).split(sep).join('/')
  const abs = (rel) => `${base}/${rel}`
  const rel = (a) => a.slice(base.length + 1)
  const presents = new Set(post)
  const ensemble = new Set([...post, ...avant])
  const vitest = post.filter(estDeLaSuiteVitest)
  const node = post.filter(estTestNode)
  const setup = setupFilesDe(lire([CONFIG_VITEST]).get(CONFIG_VITEST) ?? null, analyser)
  const textes = new Map()
  const lireAbs = (abss) => {
    const lus = lire(abss.map(rel))
    return new Map(abss.map((a) => {
      const t = lus.get(rel(a)) ?? null
      if (t !== null && estModule(rel(a))) textes.set(rel(a), t)
      return [a, t]
    }))
  }
  const cache = new Map()
  clotureDImports([...vitest, ...node, ...setup], {
    racine, typesEffaces: true, cache, analyser,
    arbre: { existe: (a) => ensemble.has(rel(a)), lire: lireAbs, fichiers: [...ensemble].map(abs) },
    specificateurs: memos && {
      lire: (a, t) => memos.lire('specificateurs', `${posix.extname(a)}:${blobDe(t)}`),
      ecrire: (a, t, sites) => memos.ecrire('specificateurs', `${posix.extname(a)}:${blobDe(t)}`, sites.map(({ spec, motifs, nature, ligne }) => ({ spec, motifs, nature, ligne }))),
    },
  })
  memos?.sauver?.()
  /** @type {Map<string, { importeur: string, spec: string }[]>} */
  const inverse = new Map()
  for (const [cible, arcs] of grapheInverse(cache))
    inverse.set(rel(cible), arcs.map((a) => ({ importeur: rel(a.importeur), spec: a.spec })))
  /** La clôture des `setupFiles` : ce que tout test Vitest atteint par eux, hors des distances. */
  const clotureSetup = new Set()
  const pile = setup.map(abs)
  while (pile.length) {
    const a = pile.pop()
    if (clotureSetup.has(rel(a))) continue
    clotureSetup.add(rel(a))
    for (const arc of cache.get(a) ?? []) pile.push(arc.cible)
  }
  const estTest = (f) => presents.has(f) && (estDeLaSuiteVitest(f) || estTestNode(f))

  /** Tests qui atteignent `depart`, avec leur distance et la chaîne la plus courte (test → … → depart). */
  const remontees = new Map()
  const remonter = (depart) => {
    if (remontees.has(depart)) return remontees.get(depart)
    const precedent = new Map([[depart, null]])
    let vague = [depart]
    const atteints = new Map()
    for (let d = 0; vague.length; d += 1) {
      const suivante = []
      for (const f of vague) {
        if (estTest(f) && !atteints.has(f)) {
          const chaine = []
          for (let x = f; x !== null; x = precedent.get(x)) chaine.push(x)
          atteints.set(f, { distance: d, chaine })
        }
        for (const { importeur } of inverse.get(f) ?? [])
          if (!precedent.has(importeur)) { precedent.set(importeur, f); suivante.push(importeur) }
      }
      vague = suivante
    }
    remontees.set(depart, atteints)
    return atteints
  }

  /** @typedef {{ nature: 'touché' | 'toolchain' | 'import' | 'racine balayée' | 'setup', distance: number, rang?: number, chaine?: string[], racine?: string, specificite?: number, site?: string, touche: string }} Lien */
  /** @type {Map<string, Lien>} */
  const retenus = new Map()
  const retenir = (test, lien) => {
    const deja = retenus.get(test)
    const neuf = { ...lien, rang: rangDe(lien) }
    if (!deja || (neuf.rang - deja.rang || (neuf.specificite ?? 0) - (deja.specificite ?? 0) || neuf.distance - deja.distance) < 0) retenus.set(test, neuf)
  }
  /** La SPÉCIFICITÉ d'une racine : le nombre de fichiers de la post-image qu'elle couvre (`couvre`). */
  let couverts = null
  const specificiteDe = (racine) => {
    if (!couverts) {
      couverts = new Map()
      for (const f of post) for (const a of [f, ...ancetresDe(f)]) couverts.set(a, (couverts.get(a) ?? 0) + 1)
    }
    return couverts.get(racine) ?? 0
  }
  const parSetup = (lien) => { for (const t of vitest) retenir(t, { nature: 'setup', distance: 0, ...lien }) }
  const toolchain = touches.filter((t) => TOOLCHAIN.includes(t))
  if (toolchain.length) for (const t of [...vitest, ...node]) retenir(t, { nature: 'toolchain', distance: 0, touche: toolchain[0] })
  for (const t of touches) {
    if (estTest(t)) retenir(t, { nature: 'touché', distance: 0, touche: t })
    for (const [test, { distance, chaine }] of remonter(t)) if (distance > 0) retenir(test, { nature: 'import', distance, chaine, touche: t })
    if (clotureSetup.has(t)) parSetup({ touche: t })
  }

  const lectures = new Map()
  /** L'IR de `f` prélue par sa vague de clôture (`clotureDesLectures`) ; `null` pour un module illisible ou un fichier
   *  hors modules. */
  const lectureDe = (f) => lectures.get(f) ?? null
  /** Lit d'un coup les modules `fichiers` absents des mémos : un programme d'analyse par lot. */
  const prelire = (fichiers) => {
    const aLire = []
    const horsGraphe = [...fichiers].filter((f) => !lectures.has(f) && !textes.has(f) && estModule(f))
    const lusHorsGraphe = horsGraphe.length ? lire(horsGraphe) : new Map()
    for (const f of fichiers) {
      const texte = textes.get(f) ?? lusHorsGraphe.get(f) ?? undefined
      if (lectures.has(f) || texte === undefined) continue
      const lu = memos?.lire('lectures', `${f}:${blobDe(texte)}`)
      if (lu) {
        bornerIR(f, lu, limiteIR)
        lectures.set(f, lu)
      }
      else aLire.push({ rel: f, text: texte })
    }
    for (const { fichier, sourceFile } of analyser(aLire)) {
      stade('prélire', fichier.rel)
      const lu = encoderLecture(lectureDeModule(fichier.rel, sourceFile))
      bornerIR(fichier.rel, lu, limiteIR)
      memos?.ecrire('lectures', `${fichier.rel}:${blobDe(fichier.text)}`, lu)
      lectures.set(fichier.rel, lu)
    }
  }
  const alias = aliasDuDepot(racine)
  const cibleDe = (f, spec) => {
    const arc = (cache.get(abs(f)) ?? []).find((a) => a.spec === spec)
    const cible = arc?.cible ?? resolveImport(abs(f), spec, (a) => ensemble.has(rel(a)), alias)
    return cible ? rel(cible) : null
  }
  /** Les modules LECTEURS : ceux qui appellent une lecture, puis, au point fixe, les importeurs qui
   *  nomment un relais exporté d'un lecteur. L'ensemble reste stable pendant chaque tour : un relais se juge
   *  sur l'ensemble final. */
  const lecteurs = new Set([...textes].filter(([, t]) => APPEL_DE_LECTURE.test(t)).map(([f]) => f))
  /** La réponse COURANTE à une requête de l'évaluateur (`partiesDeRequete`) : l'empreinte de la lecture
   *  d'un module (blob, `null` s'il n'est pas un module lisible), la cible d'un spécificateur — stables
   *  le temps d'une dérivation —, `peutLire`, qui suit les tours des lecteurs. */
  const stables = new Map()
  const reponseA = (requete) => {
    if (stables.has(requete)) return stables.get(requete)
    const [nature, f, spec] = partiesDeRequete(requete)
    if (nature === 'peutLire') return lecteurs.has(f)
    const texte = nature === 'lecture' ? textes.get(f) ?? lire([f]).get(f) ?? null : null
    return stables.set(requete, nature === 'cible' ? cibleDe(f, spec) : texte === null || !estModule(f) ? null : blobDe(texte)).get(requete)
  }
  /** L'évaluation `nature` (`sitesDe`, `relaisExportes`) du module `f`, mémoïsée sous `evaluations` avec
   *  les réponses de ses requêtes : une variante vaut tant que chacune de ses réponses tient. */
  const variante = (nature, f) => (memos?.lire('evaluations', `${nature}:${f}`) ?? [])
    .find(({ requetes }) => requetes.every(([r, reponse]) => reponseA(r) === reponse))
  /** La lecture CERTIFIÉE (`certifierLecture`) de `f` depuis son IR (`lectureDe`), une fois par module et par
   *  dérivation : les lots la partagent, la dérivation la relâche à sa fin. */
  const certifiees = new Map()
  const certifiee = (f) => certifiees.has(f) ? certifiees.get(f) : certifiees.set(f, certifierLecture(f, lectureDe(f), stade)).get(f)
  /** Les spécificateurs qu'importe la lecture de `f`, ceux de ses `importe` puis ses étoiles : une lecture se visite une
   *  fois par dérivation, pas une fois par lot (`stade('visite', f)`). */
  const specificateursDesLectures = new Map()
  const specificateursDeLaLecture = (f) => {
    if (specificateursDesLectures.has(f)) return specificateursDesLectures.get(f)
    stade('visite', f)
    const lu = certifiee(f)
    const specs = new Set()
    const vus = new WeakSet()
    const visiter = (v) => {
      if (!v || typeof v !== 'object' || vus.has(v)) return
      vus.add(v)
      if (v.k === 'importe') specs.add(v.spec)
      for (const enfant of Object.values(v)) visiter(enfant)
    }
    visiter(lu)
    for (const spec of lu?.etoiles ?? []) specs.add(spec)
    return specificateursDesLectures.set(f, [...specs]).get(f)
  }
  /** La clôture des lectures de `departs` par leurs spécificateurs, vague par vague : chaque vague est prélue d'un
   *  coup par `analyser`, en lots pleins. */
  const clotureDesLectures = (departs) => {
    const lecturesDuLot = new Set()
    const resolutions = new Map()
    for (let vague = [...new Set(departs)]; vague.length;) {
      prelire(vague)
      const suivante = new Set()
      for (const f of vague) {
        lecturesDuLot.add(f)
        for (const spec of specificateursDeLaLecture(f)) {
          const cle = JSON.stringify([f, spec])
          if (resolutions.has(cle)) continue
          const cible = cibleDe(f, spec)
          resolutions.set(cle, [f, spec, cible])
          if (cible !== null && !lecturesDuLot.has(cible)) suivante.add(cible)
        }
      }
      vague = [...suivante].filter((f) => !lecturesDuLot.has(f))
    }
    return { lecturesDuLot, resolutions }
  }
  function* evaluationsEnLots(nature, fichiers) {
    clotureDesLectures(fichiers.filter((f) => !variante(nature, f)))
    for (let debut = 0; debut < fichiers.length; debut += tailleLot) {
      const lot = fichiers.slice(debut, debut + tailleLot)
      const vues = new Map(lot.map((f) => [f, variante(nature, f)]))
      const manquants = lot.filter((f) => !vues.get(f))
      const { lecturesDuLot, resolutions } = clotureDesLectures(manquants)
      memos?.sauver?.()
      const resultats = new Map()
      if (manquants.length) {
        stade(nature, manquants.length === 1 ? manquants[0] : null)
        const lecteursDuTour = [...lecteurs]
        const rendus = evaluerLot({ lectures: [...lecturesDuLot].map((f) => [f, certifiee(f)]), resolutions: [...resolutions.values()], lecteurs: lecteursDuTour, questions: manquants.map((f) => ({ nature, f })) }, stade)
        for (const { f, resultat, requetes } of rendus) {
          resultats.set(f, resultat)
          const cle = `${nature}:${f}`
          memos?.ecrire('evaluations', cle, [{ requetes: requetes.map((r) => [r, reponseA(r)]), resultat }, ...(memos.lire('evaluations', cle) ?? [])].slice(0, VARIANTES))
        }
      }
      memos?.sauver?.()
      for (const f of lot) yield [f, vues.get(f)?.resultat ?? resultats.get(f)]
    }
  }
  for (let frontiere = [...lecteurs]; ;) {
    const suivante = new Set()
    for (const [f, noms] of evaluationsEnLots('relaisExportes', frontiere)) {
      if (!noms.length) continue
      const motif = new RegExp(`\\b(?:${noms.join('|')})\\b|export\\s*\\*`)
      for (const { importeur } of inverse.get(f) ?? [])
        if (!lecteurs.has(importeur) && textes.has(importeur) && motif.test(textes.get(importeur))) suivante.add(importeur)
    }
    if (!suivante.size) break
    for (const f of suivante) lecteurs.add(f)
    frontiere = [...lecteurs]
  }

  const nonResolus = []
  /** Les modules dont un site balaie la RACINE du dépôt : tout fichier touché retient les tests qui les atteignent. */
  const balaientLeDepot = new Set()
  const tries = [...lecteurs].sort()
  for (const [f, sites] of evaluationsEnLots('sitesDe', tries)) {
    for (const site of sites) {
      const ici = `${f}:${site.ligne}`
      for (const v of site.valeurs) if ('non' in v) nonResolus.push({ site: ici, fichier: f, helper: site.appel, raison: v.non })
      for (const v of site.valeurs) {
        if (!('chemin' in v)) continue
        if (v.chemin === '') balaientLeDepot.add(f)
        const touche = touches.find((t) => couvre(v.chemin, t))
        if (!touche) continue
        const lien = { racine: v.chemin || '.', specificite: specificiteDe(v.chemin), site: `${ici} ${site.appel}`, touche }
        for (const [test, { distance }] of remonter(f)) retenir(test, { nature: 'racine balayée', distance, ...lien })
        if (clotureSetup.has(f)) parSetup(lien)
      }
    }
  }
  /** Le SIGNAL de chaque test d'import (`signalDe`) : exports touchés du module touché (base contre
   *  post-image), liaisons du dernier maillon de sa chaîne. */
  const cibles = [...new Set([...retenus.values()].filter((l) => l.nature === 'import' && estModule(l.touche)).map((l) => l.touche))]
  const avantDe = cibles.length && lireAvant ? lireAvant(cibles) : new Map()
  const [declarationsAvant, declarationsApres] = [(m) => avantDe.get(m) ?? null, (m) => textes.get(m) ?? null]
    .map((texte) => parBlob(cibles.map((rel) => ({ rel, text: texte(rel) })), 'declarations', { memos, analyser, limiteIR },
      (rel, sourceFile) => [...declarationsDeLArbre(sourceFile)]))
  const exportsDe = new Map(cibles.map((m) => [m, nomsTouches(new Map(declarationsAvant.get(m) ?? []), new Map(declarationsApres.get(m) ?? []))]))
  const importeurs = [...new Set([...retenus.values()].filter((l) => l.nature === 'import').map((l) => l.chaine[l.chaine.length - 2]))]
  const liaisonsPar = parBlob(importeurs.map((rel) => ({ rel, text: textes.get(rel) ?? '' })), 'liaisons', { memos, analyser, limiteIR }, (rel, sourceFile, diagnostics) => {
    try {
      return liaisonsDe(rel, sourceFile, diagnostics).map(({ spec, forme, importe }) => ({ spec, forme, importe: importe ? { nom: importe.nom } : null }))
    } catch (cause) { throw new Error(`perimetre : liaisons de ${rel} illisibles`, { cause }) }
  })
  const signaux = new Map()
  for (const [test, lien] of retenus) {
    if (lien.nature !== 'import') continue
    const importeur = lien.chaine[lien.chaine.length - 2]
    const liaisons = (liaisonsPar.get(importeur) ?? []).filter((l) => l.spec && cibleDe(importeur, l.spec) === lien.touche)
    signaux.set(test, signalDe(lien, liaisons, exportsDe.get(lien.touche) ?? new Set()))
  }
  /** La FERMETURE d'imports des balayeurs du dépôt : tout module qui en importe un, même transitivement (#2586). */
  const fermeture = new Set(balaientLeDepot)
  for (const pile = [...balaientLeDepot]; pile.length;)
    for (const { importeur } of inverse.get(pile.pop()) ?? []) if (!fermeture.has(importeur)) { fermeture.add(importeur); pile.push(importeur) }
  for (const n of nonResolus) n.moduleBalaieLeDepot = fermeture.has(n.fichier)
  memos?.elaguer?.()
  return { retenus, toolchain, nonResolus, vitest, node, modules: cache.size, setup, signaux }
}
/**
 * `extraire(rel, sourceFile, diagnostics)` de chaque module `entrees`, mémoïsé sous la famille `famille`
 * par chemin et blob ; les absents des mémos s'analysent par lots (`analyser`). Un texte `null` rend `null`.
 * @returns {Map<string, unknown>}
 */
function parBlob(entrees, famille, { memos, analyser, limiteIR }, extraire) {
  const rendus = new Map()
  const aLire = []
  for (const e of entrees) {
    if (e.text === null) { rendus.set(e.rel, null); continue }
    const vu = memos?.lire(famille, `${e.rel}:${blobDe(e.text)}`)
    if (vu !== undefined) { bornerIR(e.rel, encoderLecture(vu), limiteIR); rendus.set(e.rel, vu) }
    else aLire.push(e)
  }
  for (const { fichier, sourceFile, diagnostics } of analyser(aLire)) {
    const rendu = extraire(fichier.rel, sourceFile, diagnostics)
    bornerIR(fichier.rel, encoderLecture(rendu), limiteIR)
    memos?.ecrire(famille, `${fichier.rel}:${blobDe(fichier.text)}`, rendu)
    rendus.set(fichier.rel, rendu)
  }
  return rendus
}
/**
 * Les déclarations EXPORTÉES d'un module, nom → texte (`export *` sous `*`, l'export par défaut sous
 * `default`) ; un export local `export { a as b }` porte le texte de la déclaration de `a`. `null` : aucune.
 * @param {string} rel @param {string | null} texte @returns {Map<string, string>}
 */
export function declarationsExportees(rel, texte) {
  if (texte === null) return new Map()
  const [{ sourceFile }] = [...analyserCorpus([{ rel, text: texte }])]
  return declarationsDeLArbre(sourceFile)
}

/** `declarationsExportees` d'un arbre déjà analysé. */
function declarationsDeLArbre(sourceFile) {
  const exportees = new Map()
  const ts = typescript()
  const texteDe = (n) => n.getText(sourceFile)
  const nomsDe = (s) => ts.isVariableStatement(s) ? s.declarationList.declarations.flatMap((d) => ts.isIdentifier(d.name) ? [d.name.text] : [])
    : s.name && ts.isIdentifier(s.name) ? [s.name.text] : []
  const locales = new Map()
  for (const s of sourceFile.statements) for (const nom of nomsDe(s)) locales.set(nom, texteDe(s))
  for (const s of sourceFile.statements) {
    const modificateurs = s.modifiers ?? []
    if (ts.isExportAssignment(s)) exportees.set('default', texteDe(s))
    else if (ts.isExportDeclaration(s)) {
      if (!s.exportClause) exportees.set('*', `${exportees.get('*') ?? ''}${texteDe(s)}`)
      else if (ts.isNamespaceExport(s.exportClause)) exportees.set(s.exportClause.name.text, texteDe(s))
      else for (const e of s.exportClause.elements)
        exportees.set(e.name.text, s.moduleSpecifier ? texteDe(s) : locales.get((e.propertyName ?? e.name).text) ?? texteDe(s))
    } else if (modificateurs.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      for (const nom of modificateurs.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ? ['default'] : nomsDe(s)) exportees.set(nom, texteDe(s))
  }
  return exportees
}

/** Les exports TOUCHÉS d'un module entre deux images (`null` : absent) : ajoutés, supprimés ou modifiés. PURE. */
export function exportsTouches(rel, avant, apres) {
  return nomsTouches(declarationsExportees(rel, avant), declarationsExportees(rel, apres))
}

/** Les noms dont la déclaration diffère entre deux tables (`declarationsExportees`). PURE. */
const nomsTouches = (a, b) => new Set([...new Set([...a.keys(), ...b.keys()])].filter((nom) => a.get(nom) !== b.get(nom)))

/**
 * Le SIGNAL d'un test d'import (`SIGNAUX`) : le dernier maillon de sa chaîne (`importeur` → `touche`)
 * importe-t-il par nom un export touché ? Oui : `symbole` à d=1, `module` au-delà. Non : `module` à d=1,
 * `reste` au-delà : un import par espace de noms, par défaut ou `export *` n'est pas un import par nom. PURE.
 * @param {{ distance: number }} lien @param {{ forme: string, importe: { nom: string } | null }[]} liaisons
 *   les liaisons du maillon vers `touche` @param {Set<string>} touches les exports touchés de `touche`
 */
export function signalDe(lien, liaisons, touches) {
  const noms = [...new Set(liaisons.filter((l) => l.forme === 'nommee' && l.importe && touches.has(l.importe.nom)).map((l) => l.importe.nom))].sort()
  if (noms.length) return lien.distance === 1 ? { signal: 'symbole', noms } : { signal: 'module', noms }
  return lien.distance === 1 ? { signal: 'module', noms: [] } : { signal: 'reste', noms: [] }
}

/** Le lecteur des fichiers `rels` de l'arbre de travail de `racine` (`null` : absent ; `texteSiPresent`). */
export const lireDuDisque = (racine) => (rels) => new Map(rels.map((r) => [r, texteSiPresent(join(racine, r), readFileSync, null)]))


export const FORMAT_DES_MEMOS = 'derivation-dto-1-ir-texte-1'
export const LIMITE_IR = 64 * 1024 * 1024
export const LIMITE_FAMILLE = 256 * 1024 * 1024

export function signatureDeProducteur(texte, { sourceFile, diagnostics, fichier }, stade = () => {}) {
  try {
    stade('normalisation', fichier?.rel ?? null)
    const ts = typescript()
    if (!sourceFile || diagnostics.length) return { signature: texte, persistable: false }
    const directives = texte.match(/^\s*(?:#![^\r\n]*|\/\/\/[^\r\n]*|\/\/[^\r\n]*@ts-[^\r\n]*|\/\*[^]*?@ts-[^]*?\*\/)/gm) ?? []
    const tokens = []
    let fin = 0
    let curseur = -1
    let eof = false
    let token = ts.getTokenAtPosition(sourceFile, 0)
    while (token) {
      let jsdoc
      for (let parent = token; parent; parent = parent.parent)
        if (ts.isJSDocNodeKind(parent.kind) || parent.flags & ts.NodeFlags.JSDoc) jsdoc = parent
      if (jsdoc) token = jsdoc
      if (!Number.isSafeInteger(token.pos) || !Number.isSafeInteger(token.end) || token.pos < 0 || token.pos > token.end || token.end > texte.length) return { signature: texte, persistable: false }
      if (!jsdoc && ts.isEndOfFile(token)) {
        eof = token.end === texte.length && token.end >= fin
        break
      }
      if (token.end <= curseur) return { signature: texte, persistable: false }
      const precedent = curseur
      curseur = token.end
      if (!jsdoc) {
        const debut = token.kind === ts.SyntaxKind.JsxText ? token.pos : token.getStart(sourceFile)
        if (!ts.isToken(token) || !Number.isSafeInteger(debut) || debut < Math.max(fin, precedent) || token.end <= debut) return { signature: texte, persistable: false }
        tokens.push([token.kind, texte.slice(debut, token.end), /[\r\n\u2028\u2029]/.test(texte.slice(fin, debut))])
        fin = token.end
      }
      token = curseur === texte.length
        ? sourceFile.endOfFileToken
        : ts.getTokenAtPosition(sourceFile, curseur)
    }
    if (!eof) return { signature: texte, persistable: false }
    return { signature: JSON.stringify([directives, tokens, /[\r\n\u2028\u2029]/.test(texte.slice(fin))]), persistable: true }
  } catch {
    // #2603
    return { signature: texte, persistable: false }
  }
}

/** Le manifeste du paquet `paquet`, relatif à la racine du dépôt. */
const manifesteDe = (paquet) => posix.join('node_modules', paquet, 'package.json')

/** Les fichiers HORS fermeture que lit `versionDesMemosDeDerivation` : le tsconfig du dépôt et le manifeste de chaque
 *  `PAQUETS_VERSIONNANTS`. */
export const FICHIERS_DE_CONTEXTE = Object.freeze([CHEMIN_TSCONFIG, ...PAQUETS_VERSIONNANTS.map(manifesteDe)])

/** La version des mémos de la dérivation : les producteurs (la fermeture de ce module sous `racineDuCode`, par défaut le
 *  dépôt qui l'exécute), le contexte de `racine` et `format`. `analyser` (`analyserCorpus` par défaut) analyse les
 *  producteurs ; `stade('analyse' | 'normalisation', module)` observe chaque producteur analysé puis normalisé. Une panne
 *  de l'analyse, libération comprise, ou de la normalisation rend la version non persistable. */
export function versionDesMemosDeDerivation(racine, { fermeture = fermetureSurDisque, lire = readFileSync, analyser = analyserCorpus, format = FORMAT_DES_MEMOS, dossierDesMemos = join(racine, CACHE), lectureSeule = false, racineDuCode = RACINE, stade = () => {} } = {}) {
  const texte = (f) => texteSiPresent(f, lire)
  const versions = PAQUETS_VERSIONNANTS.map((p) => [`<${p}>`, JSON.parse(texte(join(racineDuCode, manifesteDe(p))) || '{}').version ?? ''])
  const bootstrap = empreinteDe([
    ...fermetureSurDisque('scripts/guards/lib/importGraph.mjs', racineDuCode),
    ...versions, ['<extraction>', 'specificateurs-typage-dynamiques-1'],
  ])
  const extractions = memosDeDerivation(dossierDesMemos, bootstrap, { lectureSeule })
  const cle = (abs, brut) => `${posix.extname(abs)}:${blobDe(brut)}`
  const textes = fermeture('scripts/test/perimetreDerivation.mjs', racineDuCode, { specificateurs: {
    lire: (abs, brut) => {
      const sites = extractions.lire('extractionProducteurs', cle(abs, brut))
      return Array.isArray(sites) && sites.every((s) => s && typeof s.spec === 'string' &&
        typeof s.nature === 'string' && Number.isSafeInteger(s.ligne) && s.ligne > 0 &&
        (s.motifs === undefined || Array.isArray(s.motifs) && s.motifs.every((m) => typeof m === 'string'))) ? sites : undefined
    },
    ecrire: (abs, brut, sites) => extractions.ecrire('extractionProducteurs', cle(abs, brut), sites.map(({ spec, motifs, nature, ligne }) => ({ spec, motifs, nature, ligne }))),
  } })
  extractions.sauver()
  const contexte = [['<tsconfig>', texte(join(racine, CHEMIN_TSCONFIG))], ...versions, ['<format>', format]]
  const versionsMemoisees = fermeture === fermetureSurDisque && lire === readFileSync
    ? memosDeDerivation(dossierDesMemos, empreinteDe([...textes, ...contexte]), { lectureSeule }) : null
  const versionMemoisee = versionsMemoisees?.lire('versionProducteurs', 'version')
  if (typeof versionMemoisee === 'string' && /^[a-f0-9]{64}$/.test(versionMemoisee)) return versionMemoisee
  const signatures = new Map()
  const modules = textes.filter(([f]) => estModule(f)).map(([rel, text]) => ({ rel, text }))
  let persistable = true
  try {
    for (const analyse of analyser(modules)) {
      const f = analyse.fichier.rel
      stade('analyse', f)
      const resultat = signatureDeProducteur(analyse.fichier.text, analyse, stade)
      signatures.set(f, resultat.signature)
      persistable &&= resultat.persistable
    }
    persistable &&= signatures.size === modules.length
  } catch {
    // #2603
    signatures.clear()
    persistable = false
  }
  const version = empreinteDe([
    ...textes.map(([f, t]) => [f, signatures.get(f) ?? t]),
    ...contexte,
  ])
  if (persistable) {
    versionsMemoisees?.ecrire('versionProducteurs', 'version', version)
    versionsMemoisees?.sauver()
  }
  return version
}

export function bornerIR(module, valeur, limite = LIMITE_IR) {
  let octets
  try { octets = mesureLecture(valeur, limite) } catch (erreur) {
    if (erreur.message.startsWith('IR_POOL_HORS_BORNE:')) throw new Error(`perimetre : pool IR de ${module} > limite ${limite}`, { cause: erreur })
    throw erreur
  }
  if (octets > limite) throw new Error(`perimetre : IR de ${module} : ${octets} octets > limite ${limite}`)
  return valeur
}

/** Les mémos de la dérivation sous `dossier`, signés par `version` (`versionDesMemosDeDerivation`) ; `sauver` élague
 *  d'abord les mémos par blob hors des `imagesVivantes` (#2603). */
export function memosDeDerivation(dossier, version, { lectureSeule = false, limiteFamille = LIMITE_FAMILLE, diagnostic = () => {}, imagesVivantes } = {}) {
  const memos = memosDe(dossier, version, { lectureSeule, limiteFamille, diagnostic, depassementStrict: true, finDeLigne: '\n' })
  const elaguer = () => {
    if (lectureSeule || !imagesVivantes) return
    memos.parcourir((nom, cle) => {
      if (!['lectures', 'declarations', 'liaisons'].includes(nom)) return
      const colon = cle.lastIndexOf(':')
      if (!imagesVivantes.get(cle.slice(0, colon))?.has(cle.slice(colon + 1))) memos.supprimer(nom, cle)
    })
  }
  return {
    ...memos,
    elaguer,
    sauver: () => {
      elaguer()
      memos.sauver()
    },
  }
}

export const FORMAT_DTO = 1
export function enDTO(images, derive) {
  return { format: FORMAT_DTO, images, ...derive, retenus: [...derive.retenus], signaux: [...derive.signaux] }
}
export function depuisDTO(dto) {
  const tableauDeTextes = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string')
  const paires = (v) => Array.isArray(v) && v.every((x) => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && x[1] && typeof x[1] === 'object')
  if (!dto || dto.format !== FORMAT_DTO || !dto.images || !['touches', 'post', 'avant'].every((k) => tableauDeTextes(dto.images[k])) || !['toolchain', 'vitest', 'node', 'setup'].every((k) => tableauDeTextes(dto[k])) || !Array.isArray(dto.nonResolus) || !paires(dto.retenus) || !paires(dto.signaux) || !Number.isSafeInteger(dto.modules) || dto.modules < 0)
    throw new Error('perimetre : DTO absent, tronqué ou invalide')
  if ([dto.images.base, dto.images.tete].some((v) => v !== null && typeof v !== 'string')) throw new Error('perimetre : image DTO invalide')
  const natures = ['touché', 'toolchain', 'import', 'racine balayée', 'setup']
  if (dto.retenus.some(([, lien]) => !natures.includes(lien.nature) || !Number.isSafeInteger(lien.distance) || lien.distance < 0 || !Number.isSafeInteger(lien.rang) || typeof lien.touche !== 'string')
    || dto.signaux.some(([, signal]) => !['symbole', 'module', 'reste'].includes(signal.signal) || !tableauDeTextes(signal.noms))
    || dto.nonResolus.some((n) => !n || !['site', 'fichier', 'helper', 'raison'].every((k) => typeof n[k] === 'string') || typeof n.moduleBalaieLeDepot !== 'boolean'))
    throw new Error('perimetre : contenu DTO invalide')
  return { ...dto.images, retenus: new Map(dto.retenus), signaux: new Map(dto.signaux), toolchain: dto.toolchain, vitest: dto.vitest, node: dto.node, setup: dto.setup, modules: dto.modules, nonResolus: dto.nonResolus }
}

export function produireDTO({ racine, base, tete, dossierDesMemos = join(racine, CACHE), lectureSeule = false, mode = 'perimetre' }, stade = () => {}) {
  const depot = depotDe(racine)
  stade('images', null)
  const images = mode === 'balayages' ? { base: null, tete: null, touches: [], post: listerImage(depot, TRAVAIL), avant: [] } : imagesDuDiff(depot, { base, tete })
  const lire = images.tete ? (rels) => lireEnLot(depot, images.tete, rels) : lireDuDisque(racine)
  const chemins = [...new Set([...images.post, ...images.avant])].filter(estModule)
  const persistables = entreesDe(depot, 'HEAD', chemins)
  const imagesVivantes = new Map()
  const garder = (rel, sha) => {
    if (!imagesVivantes.has(rel)) imagesVivantes.set(rel, new Set())
    imagesVivantes.get(rel).add(sha)
  }
  for (const [rel, { sha }] of persistables) garder(rel, sha)
  for (const [borne, fichiers] of [[images.base, images.avant], [images.tete, images.post]])
    if (borne) for (const [rel, { sha }] of entreesDe(depot, borne, fichiers.filter(estModule))) garder(rel, sha)
  if (!images.tete) for (const rel of images.post.filter(estModule)) {
    const texte = lire([rel]).get(rel)
    if (texte !== null && texte !== undefined) garder(rel, blobDe(texte))
  }
  stade('version', null)
  const memos = memosDeDerivation(dossierDesMemos, versionDesMemosDeDerivation(racine, { dossierDesMemos, lectureSeule, stade }), { lectureSeule, imagesVivantes, diagnostic: (famille, raison) => console.log(`[mémo] ${famille} : ${raison}`) })
  const lireAvant = images.base ? (rels) => lireEnLot(depot, images.base, rels) : undefined
  const derive = deriverPerimetre({ racine, touches: images.touches, post: images.post, avant: images.avant, lire, lireAvant, memos, stade })
  stade('sauvegarde', null)
  memos.sauver()
  return enDTO(images, derive)
}

/** Le PAS du marqueur de stade (ms) : la période de publication du guetteur une fois chargé (`marqueurDeStade`). */
const PAS_DU_MARQUEUR = 100
/** Les octets d'un stade sérialisé (`marqueurDeStade`). */
const CAPACITE_DU_MARQUEUR = 4096
const [SEQUENCE, LONGUEUR, ARRET, ACQUIT] = [0, 1, 2, 3]
/** Les états de la cellule `ACQUIT` posés par le guetteur : dernier stade publié, ou guetteur mort (sa panne sur `pannes`). */
const [ACQUITTE, EN_PANNE] = [1, 2]
/** Le GUETTEUR du marqueur, seul écrivain du fichier : il publie le dernier stade posé à chaque pas, puis à l'arrêt. Ses
 *  lectures, comme les écritures de `stade`, sont toutes atomiques : la séquence paire relue à l'identique prouve un texte
 *  entier (ECMA-262, Memory Model). Un renommage refusé (`RENOMMAGE_REFUSE`) se rejoue à son pas, jamais sous les paliers
 *  de `renommerResilient` ; toute autre levée le tue : il la poste sur `pannes` puis pose `EN_PANNE`. */
const GUETTEUR = `
const { workerData: { ecriture, renommage, chemin, partage, pas, pannes } } = require('node:worker_threads')
const entete = new Int32Array(partage, 0, 4)
const octets = new Uint8Array(partage, 16)
const decodeur = new TextDecoder()
const lire = () => {
  for (;;) {
    const sequence = Atomics.load(entete, ${SEQUENCE})
    if (sequence % 2) continue
    const lus = new Uint8Array(Atomics.load(entete, ${LONGUEUR}))
    for (let i = 0; i < lus.length; i += 1) lus[i] = Atomics.load(octets, i)
    const texte = decodeur.decode(lus)
    if (Atomics.load(entete, ${SEQUENCE}) === sequence) return { sequence, texte }
  }
}
const poser = (etat) => { Atomics.store(entete, ${ACQUIT}, etat); Atomics.notify(entete, ${ACQUIT}) }
Promise.all([import(ecriture), import(renommage)]).then(([{ ecrireTexteAtomique }, { RENOMMAGE_REFUSE }]) => {
  const attendre = () => Atomics.wait(entete, ${ACQUIT}, 0, pas)
  for (let publiee = 0; ;) {
    Atomics.wait(entete, ${ARRET}, 0, pas)
    const arret = Atomics.load(entete, ${ARRET}) === 1
    const { sequence, texte } = lire()
    if (sequence !== publiee) {
      try {
        ecrireTexteAtomique(chemin, texte + '\\n', { attendre })
        publiee = sequence
      } catch (e) {
        if (!RENOMMAGE_REFUSE.has(e?.code)) throw e
        if (arret) attendre()
        continue
      }
    }
    if (arret) return poser(${ACQUITTE})
  }
}).catch((e) => {
  pannes.postMessage(String(e?.stack ?? e))
  poser(${EN_PANNE})
})
`

/**
 * Le MARQUEUR DE STADE de l'enfant de `derivationBornee` (`perimetre.mjs`), qui le relit à sa mort pour nommer le stade
 * atteint. `stade(nom, module)` pose le stade en mémoire partagée ; le guetteur (`GUETTEUR`, un `Worker`), dès son
 * chargement, publie sous `chemin` le dernier posé à chaque `pas` ms, thread principal bloqué compris ; `fermer` publie
 * le dernier et attend l'acquit du guetteur au plus `delaiDArretMs` ms, sinon lève ; un guetteur mort lève sa panne.
 * @param {string} chemin @param {{ pas?: number, delaiDArretMs?: number }} [options]
 */
export function marqueurDeStade(chemin, { pas = PAS_DU_MARQUEUR, delaiDArretMs = 10_000 } = {}) {
  const partage = new SharedArrayBuffer(16 + CAPACITE_DU_MARQUEUR)
  const entete = new Int32Array(partage, 0, 4)
  const octets = new Uint8Array(partage, 16)
  const encodeur = new TextEncoder()
  const [ecriture, renommage] = ['ecritureJsonAtomique', 'renommageResilient'].map((m) => new URL(`../guards/lib/${m}.mjs`, import.meta.url).href)
  const { port1: pannes, port2 } = new MessageChannel()
  const guetteur = new Worker(GUETTEUR, { eval: true, workerData: { ecriture, renommage, chemin, partage, pas, pannes: port2 }, transferList: [port2] })
  guetteur.unref()
  pannes.unref()
  return {
    /** @param {string} nom @param {string | null} module */
    stade(nom, module) {
      const encode = encodeur.encode(JSON.stringify({ stade: nom, module }))
      if (encode.length > CAPACITE_DU_MARQUEUR) throw new Error(`perimetre : stade ${nom} de ${encode.length} octets > ${CAPACITE_DU_MARQUEUR}`)
      Atomics.add(entete, SEQUENCE, 1)
      for (let i = 0; i < encode.length; i += 1) Atomics.store(octets, i, encode[i])
      Atomics.store(entete, LONGUEUR, encode.length)
      Atomics.add(entete, SEQUENCE, 1)
    },
    fermer() {
      Atomics.store(entete, ARRET, 1)
      Atomics.notify(entete, ARRET)
      Atomics.wait(entete, ACQUIT, 0, delaiDArretMs)
      const etat = Atomics.load(entete, ACQUIT)
      void guetteur.terminate()
      if (etat === EN_PANNE) throw new Error(`perimetre : guetteur du marqueur de stade ${chemin} mort : ${receiveMessageOnPort(pannes)?.message ?? '—'}`)
      if (etat !== ACQUITTE) throw new Error(`perimetre : marqueur de stade ${chemin} sans acquit en ${delaiDArretMs} ms`)
    },
  }
}

/**
 * L'ENFANT de `derivationBornee` : le DTO de `produire` sur l'entrée `entree` écrit sous `sortie`, stade posé sur le
 * marqueur `chemin` (`marqueurDe`). REND son code de sortie, celui de la dérivation seule : la panne du marqueur, diagnostic
 * pur, s'imprime sans le changer (#2586).
 * @param {string[]} argv `[entree, sortie, chemin]` @returns {number}
 */
export function deriverDansLEnfant([entree, sortie, chemin], { produire = produireDTO, marqueurDe = marqueurDeStade } = {}) {
  const marqueur = marqueurDe(chemin)
  let code = 0
  try {
    ecrireJsonAtomique(sortie, produire(JSON.parse(readFileSync(entree, 'utf8')), marqueur.stade), { indentation: 0 })
  } catch (e) {
    console.error(e.stack ?? e)
    code = 1
  } finally {
    try { marqueur.fermer() } catch (e) { console.error(e.message) }
  }
  return code
}

if (import.meta.main) process.exitCode = deriverDansLEnfant(process.argv.slice(2))

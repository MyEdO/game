/**
 * RÉPARATION d'adresse de prose — le pendant « adresses » du `reanchor` de l'Atlas (#1389 item 7).
 *
 * Le geste humain qu'il sert : une extraction du `Source/` est corrigée (table cassée, césure, page
 * perdue), le texte du chapitre BOUGE, et les `descRef` qui le visaient ne résolvent plus. Cet outil
 * RELOCALISE chaque adresse cassée PAR SON TEXTE D'ORIGINE — celui que la même adresse rendait sur
 * la version `--depuis` du chapitre, lue par `git show` — et propose l'adresse corrigée. Aucune IA,
 * aucune devinette : absent, multiple ou non re-prouvé → SKIP nommé, jamais une pose au jugé
 * (discipline d'`anchor-fill.mjs` l.32-33).
 *
 * Usage :
 *   node scripts/source/reparer-adresses.mjs [--dataset <nom>] [--depuis <ref-git>] [--apply]
 *   sans `--apply` : rapport seul, sortie 1 s'il reste une adresse cassée (garde humaine, comme
 *   `reanchor` sans `--apply`). `--depuis` vaut `HEAD` par défaut : la Source d'AVANT l'édition en
 *   cours. `--dataset` = nom de fichier sans `.json` (`psychology`).
 *
 * Quatre verdicts, et quatre seulement :
 *   RECALÉE        un seul emplacement rend le texte d'origine, et l'adresse neuve le re-rend À
 *                  L'OCTET — la seule que `--apply` écrit ;
 *   AMBIGUË        le texte d'origine apparaît à N ≥ 2 emplacements, listés : c'est à l'humain de
 *                  trancher (ou d'étendre les bornes du passage cité) ;
 *   PERDUE         le texte d'origine n'est plus nulle part : le passage a été supprimé ou réécrit,
 *                  c'est une relecture au PDF, pas un recalage ;
 *   IRRÉCUPÉRABLE  l'adresse ne résolvait déjà plus à `--depuis` (ou son chapitre n'y est pas) : il
 *                  n'existe aucun texte d'origine à relocaliser.
 *
 * UNE définition par nature, rien n'est recopié ici : l'inventaire des adresses vient de
 * `adresses.mjs`, la résolution et le verdict de relocalisation du parseur PUR
 * `src/data/source/decoupe.ts`, la réécriture textuelle de `reecriture-ancree.mjs`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  estErreur, findAllRuns, findCells, cellRefFor, normText, parseChapitre,
  resoudreAdresse, resoudreFragment,
} from '../../src/data/source/decoupe.ts'
import { RACINES_PAR_DEFAUT, RACINE_DEPOT, adressesDuDepot } from './adresses.mjs'
import { lireChapitre } from './lecteur-fs.mjs'
import { cheminChapitre } from './resoudre.mjs'
import { ancresDObjet, jsonIndente, remplacerAncre } from './reecriture-ancree.mjs'

/** Désignation lisible d'un fragment — même forme que les détails d'erreur du parseur. */
const ouDe = (frag) =>
  frag.kind === 'cellule'
    ? `§${frag.sec}#${frag.secOcc} [${frag.row}]×[${frag.col}]`
    : `§${frag.sec}#${frag.secOcc} blocs ${frag.b0}-${frag.b1}`

/** Adresse entière en une ligne lisible. */
const adresseLisible = (ref) => `${ref.book} ch.${ref.ch} ${ref.parts.map(ouDe).join(' + ')}`

/** Chemin de chapitre en séparateurs POSIX : c'est la forme que `git show` attend. */
const versPosix = (chemin) => String(chemin).split('\\').join('/')

/** Première ligne d'une erreur, sans sa pile. */
const premiereLigne = (e) => String(e instanceof Error ? e.message : e).split('\n')[0].trim()

/**
 * Emplacements du chapitre COURANT qui rendent `cible` (texte normalisé du fragment d'origine).
 * Un emplacement = la liste des fragments qui le composent (un run de blocs peut traverser deux
 * sections) ; leurs empreintes `sum` sont POSÉES par `empreinteDe` au fond de `findAllRuns` /
 * `cellRefFor`, jamais recopiées de l'ancienne adresse — c'est le texte d'AUJOURD'HUI qu'elles
 * scellent.
 *
 * `raisonVide` dit POURQUOI il n'y a aucun emplacement, et les deux causes ne se confondent pas : le
 * texte n'est plus là, ou il est là mais sa ligne de table n'offre aucune clé sûre (`cellRefFor`
 * refuse une clé ambiguë ou positionnelle) — dans ce second cas le passage existe, il n'est pas
 * ADRESSABLE, et c'est ce que l'humain doit lire.
 * @returns {{ emplacements: { fragments: object[], ou: string }[], raisonVide: string }}
 */
function emplacementsDe(chapitre, frag, cible) {
  if (frag.kind === 'cellule') {
    const vus = new Set()
    const emplacements = []
    const hits = findCells(chapitre, cible)
    for (const hit of hits) {
      const ref = cellRefFor(chapitre, hit)
      if (!ref) continue
      const cle = ouDe(ref)
      if (vus.has(cle)) continue
      vus.add(cle)
      emplacements.push({ fragments: [ref], ou: cle })
    }
    const raisonVide = hits.length
      ? `son texte d'origine est bien dans le chapitre (${hits.length} cellule(s)), mais aucune ligne ne porte de clé sûre — le passage n'est pas adressable en l'état`
      : "son texte d'origine n'est plus dans le chapitre"
    return { emplacements, raisonVide }
  }
  return {
    emplacements: findAllRuns(chapitre, cible).map((run) => ({ fragments: run, ou: run.map(ouDe).join(' + ') })),
    raisonVide: "son texte d'origine n'est plus dans le chapitre",
  }
}

/**
 * Relocalise UNE adresse dans son chapitre courant, fragment par fragment.
 * Un montage ne se recale JAMAIS à moitié : un seul fragment non unique et l'adresse entière est
 * `AMBIGUË`/`PERDUE` (une adresse à moitié recalée rendrait un texte que personne n'a relu).
 */
function relocaliser(courant, origine, ref, depuis) {
  const parts = []
  const raisons = []
  let verdict = 'RECALÉE'
  for (const [i, frag] of ref.parts.entries()) {
    const orig = resoudreFragment(origine, frag)
    if (estErreur(orig)) {
      return {
        verdict: 'IRRÉCUPÉRABLE',
        raison: `fragment ${i + 1} (${ouDe(frag)}) ne résolvait déjà pas à \`${depuis}\` : ${orig.error} — ${orig.detail}`,
      }
    }
    const { emplacements, raisonVide } = emplacementsDe(courant, frag, normText(orig.md))
    if (emplacements.length === 0) {
      // PERDUE prime sur AMBIGUË : un fragment dont le texte a disparu ne se tranche pas à la main
      // entre deux candidats, il se relit au PDF — c'est le verdict le plus coûteux qui gouverne.
      verdict = 'PERDUE'
      raisons.push(`fragment ${i + 1} (${ouDe(frag)}) : ${raisonVide}`)
      continue
    }
    if (emplacements.length > 1) {
      verdict = verdict === 'PERDUE' ? 'PERDUE' : 'AMBIGUË'
      raisons.push(
        `fragment ${i + 1} (${ouDe(frag)}) : ${emplacements.length} emplacements rendent ce texte — ` +
        emplacements.map((e) => e.ou).join(' | '),
      )
      continue
    }
    parts.push(...emplacements[0].fragments)
  }
  if (verdict !== 'RECALÉE') return { verdict, raison: raisons.join(' ; ') }

  // PREUVE : l'adresse neuve doit re-rendre, dans le chapitre courant, le texte que l'ancienne
  // rendait à `--depuis`, À L'OCTET. Sans elle, « relocalisé » ne voudrait dire que « trouvé ».
  const nouvelle = { ...ref, parts }
  const attendu = resoudreAdresse(origine, ref)
  if (estErreur(attendu)) {
    return { verdict: 'IRRÉCUPÉRABLE', raison: `l'adresse entière ne résolvait pas à \`${depuis}\` : ${attendu.error} — ${attendu.detail}` }
  }
  const rendu = resoudreAdresse(courant, nouvelle)
  if (estErreur(rendu)) {
    return { verdict: 'IRRÉCUPÉRABLE', raison: `l'adresse proposée (${adresseLisible(nouvelle)}) ne résout pas : ${rendu.error} — ${rendu.detail}` }
  }
  if (rendu.md !== attendu.md) {
    return {
      verdict: 'IRRÉCUPÉRABLE',
      raison: `l'adresse proposée rend un AUTRE texte que l'original (${attendu.md.length} car. attendus, ${rendu.md.length} rendus)`,
    }
  }
  return { verdict: 'RECALÉE', nouvelle, proposition: adresseLisible(nouvelle) }
}

/**
 * Inventorie, juge et — sur `apply` — répare les adresses du dépôt.
 * @param {{ racine?: string, racines?: string[], dataset?: string|null, depuis?: string,
 *           apply?: boolean, lecteur?: Function, chemin?: Function }} [options]
 *   `racine` = racine du dépôt lu ET écrit (une fixture injecte la sienne) ; `lecteur`/`chemin`
 *   = accès au `Source/` de cette racine (`lireChapitre`/`cheminChapitre` par défaut).
 */
export function reparerAdresses({
  racine = RACINE_DEPOT,
  racines = RACINES_PAR_DEFAUT,
  dataset = null,
  depuis = 'HEAD',
  apply = false,
  lecteur = lireChapitre,
  chemin = cheminChapitre,
} = {}) {
  const retenue = (a) => !dataset || a.fichier.endsWith(`/${dataset}.json`)
  const inventaire = () => adressesDuDepot(racines, racine).filter(retenue)

  /** @type {Map<string, { chapitre: object|null, raison: string|null }>} */
  const memoOrigine = new Map()
  const chapitreOrigine = (book, ch) => {
    const cle = `${book}|${ch}`
    const memo = memoOrigine.get(cle)
    if (memo) return memo
    const rel = chemin(book, ch)
    let sortie = { chapitre: null, raison: `aucun fichier de chapitre pour ${book} ch.${ch}` }
    if (rel) {
      const cible = `${depuis}:${versPosix(rel)}`
      try {
        const texte = execFileSync('git', ['show', cible], { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
        sortie = { chapitre: parseChapitre(texte.replace(/\r\n|\r/g, '\n')), raison: null }
      } catch (e) {
        sortie = { chapitre: null, raison: `git show ${cible} : ${premiereLigne(e)}` }
      }
    }
    memoOrigine.set(cle, sortie)
    return sortie
  }

  /** Adresses cassées AUJOURD'HUI, avec leur verdict de relocalisation. */
  const juger = (adresses) => {
    const cassees = []
    for (const a of adresses) {
      const courant = lecteur(a.ref?.book, a.ref?.ch)
      if (!courant) {
        cassees.push({ ...a, code: 'chapitre-introuvable', detail: `${a.ref?.book} ch.${a.ref?.ch}`, verdict: 'IRRÉCUPÉRABLE', raison: 'le chapitre visé n\'est pas dans le `Source/` courant' })
        continue
      }
      const res = resoudreAdresse(courant, a.ref)
      if (!estErreur(res)) continue
      const origine = chapitreOrigine(a.ref.book, a.ref.ch)
      if (!origine.chapitre) {
        cassees.push({ ...a, code: res.error, detail: res.detail, verdict: 'IRRÉCUPÉRABLE', raison: origine.raison })
        continue
      }
      cassees.push({ ...a, code: res.error, detail: res.detail, ...relocaliser(courant, origine.chapitre, a.ref, depuis) })
    }
    return cassees
  }

  const adresses = inventaire()
  const cassees = juger(adresses)
  const recalees = cassees.filter((c) => c.verdict === 'RECALÉE')
  const echecs = []
  let ecrits = 0

  if (apply && recalees.length > 0) {
    // Un fichier à la fois : le compte TEXTUEL des remplacements est confronté au compte STRUCTUREL
    // des adresses recalées, et rien n'est écrit dès qu'un compte diverge.
    const parFichier = new Map()
    for (const r of recalees) parFichier.set(r.fichier, [...(parFichier.get(r.fichier) ?? []), r])
    for (const [fichier, gestes] of parFichier) {
      const absolu = join(racine, fichier)
      const brut = readFileSync(absolu, 'utf8')
      let texte = brut
      let remplacements = 0
      const locaux = []
      for (const geste of gestes) {
        const attendu = JSON.stringify(geste.ref)
        const ancres = ancresDObjet(texte, 'descRef', (v) => JSON.stringify(v) === attendu)
        if (ancres.length !== 1) {
          locaux.push(`${fichier} ${geste.id} : bloc \`"descRef"\` ${ancres.length === 0 ? 'introuvable' : `vu ${ancres.length} fois`} sur le disque`)
          continue
        }
        const ancre = ancres[0]
        const prefixe = ancre.slice(0, ancre.indexOf('{'))
        const pose = remplacerAncre(texte, ancre, ({ indentation }) => `${prefixe}${jsonIndente(geste.nouvelle, indentation)}`)
        if (pose.erreur) {
          locaux.push(`${fichier} ${geste.id} : ${pose.erreur}`)
          continue
        }
        texte = pose.texte
        remplacements += 1
      }
      if (locaux.length === 0 && remplacements !== gestes.length) {
        locaux.push(`${fichier} : compte TEXTUEL (${remplacements}) ≠ compte STRUCTUREL (${gestes.length})`)
      }
      // Le document réécrit doit PARSER avant de toucher le disque : la réécriture est textuelle, donc
      // c'est ici, et nulle part ailleurs, que le résultat redevient du JSON.
      if (locaux.length === 0) {
        try {
          JSON.parse(texte)
        } catch (e) {
          locaux.push(`${fichier} : le document réécrit ne parse plus (${premiereLigne(e)}) — aucun octet écrit`)
        }
      }
      if (locaux.length > 0) {
        echecs.push(...locaux)
        continue
      }
      writeFileSync(absolu, texte, 'utf8')
      ecrits += remplacements
    }
  }

  // Après écriture, tout est REJOUÉ sur le disque : le bilan dit ce qui reste cassé, pas ce qu'on
  // croit avoir réparé. Un document que le re-parse refuse est BRUYANT (`adressesDuDepot` lève) et
  // entre dans les échecs : un ré-jugement impossible n'est jamais un bilan vert.
  let apres = cassees
  if (ecrits > 0) {
    try {
      apres = juger(inventaire())
    } catch (e) {
      echecs.push(`ré-jugement impossible après écriture : ${premiereLigne(e)}`)
    }
  }
  return { adresses: adresses.length, cassees, recalees: recalees.length, ecrits, echecs, restantes: apres, depuis, dataset, apply }
}

/** Rapport texte d'un run — une ligne par adresse cassée. */
export function rapport(bilan) {
  const lignes = [
    `ADRESSES — ${bilan.adresses} inventoriée(s)${bilan.dataset ? ` (dataset ${bilan.dataset})` : ''}, ` +
    `${bilan.cassees.length} cassée(s), origine lue à \`${bilan.depuis}\``,
  ]
  for (const c of bilan.cassees) {
    lignes.push(
      `  ${c.fichier} ${c.id} — ${c.code} : ${c.detail}\n` +
      `    ${c.verdict} : ${c.verdict === 'RECALÉE' ? c.proposition : c.raison}`,
    )
  }
  if (bilan.apply) {
    lignes.push(`Écritures : ${bilan.ecrits} adresse(s) recalée(s) sur ${bilan.recalees} proposée(s) ; reste ${bilan.restantes.length} adresse(s) cassée(s).`)
    for (const e of bilan.echecs) lignes.push(`  ÉCHEC D'ÉCRITURE ${e}`)
  } else if (bilan.cassees.length > 0) {
    lignes.push(`(--apply écrirait ${bilan.recalees} adresse(s) RECALÉE(s) ; les autres verdicts se règlent à la main, au PDF.)`)
  }
  return lignes.join('\n')
}

/**
 * Options de la ligne de commande — fonction PURE, donc éprouvable sans lancer de processus.
 * @param {string[]} argv @returns {{ dataset: string|null, depuis: string, apply: boolean }}
 */
export function optionsDe(argv) {
  const valeur = (nom) => {
    const i = argv.indexOf(nom)
    return i >= 0 ? argv[i + 1] : undefined
  }
  return {
    dataset: valeur('--dataset') ?? null,
    depuis: valeur('--depuis') ?? 'HEAD',
    apply: argv.includes('--apply'),
  }
}

function main(argv = process.argv.slice(2)) {
  const bilan = reparerAdresses(optionsDe(argv))
  console.log(rapport(bilan))
  if (bilan.restantes.length > 0 || bilan.echecs.length > 0) process.exitCode = 1
}

if (import.meta.main) main()

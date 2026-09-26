// Empreinte de SOURCES d'un doc dérivé (#1679 L1b) — socle partagé par `scripts/docs/build-all.mjs`
// (pose l'empreinte, écrit `docs/.sources-lues.json`, joue `--empreinte`) et par le hook pre-commit.
//
// CHAÎNE : `enregistreur-lectures.mjs` MESURE ce que le générateur lit → `docs/.sources-lues.json`
// est le dérivé GÉNÉRÉ de ces mesures (jamais édité à la main) → le pied de chaque doc porte
// l'empreinte des sources TELLES QU'ELLES ÉTAIENT SUR LE DISQUE au moment de la génération →
// `--empreinte` recalcule la même empreinte depuis l'INDEX git. Les deux coïncident si, et seulement
// si, chaque source lue est identique à ce que le commit embarque. C'est la classe visée : un doc
// régénéré depuis un arbre où une source lue n'est pas stagée décrit un arbre qui n'existe nulle part.
//
// L'empreinte de génération se calcule sur le DISQUE (hash de blob git du contenu réellement lu) et
// celle de vérification sur l'index : mêmes lignes, même sha1, donc toute divergence de contenu ou de
// listing de dossier se voit. `* text=auto eol=lf` (.gitattributes:5) garde arbre et index à la même
// graphie de fin de ligne — mesuré 2026-09-02 : 6 526 fichiers `i/lf w/lf`, 34 binaires, 0 mixte.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { listerDossier } from '../../guards/lib/lister.mjs'
import { dansLaMesure } from './chemin-mesure.mjs'
import path from 'node:path'

const sha1 = (donnee) => createHash('sha1').update(donnee).digest('hex')

/**
 * Format UNIQUE du pied, dernière ligne du doc généré. Il signe DEUX choses : l'empreinte des
 * SOURCES lues à la génération, et le sha1 du CORPS signé (le doc sans son pied).
 * Le corps est signé parce que les sources ne le disent pas : aucune cible n'est mesurée comme
 * source d'elle-même (0 générateur sur 30, sonde `q3b.mjs` 2026-09-04), si bien qu'un doc dérivé
 * ÉDITÉ À LA MAIN resterait « frais » par ses seules sources, et pour toujours.
 * Le groupe `corps` est optionnel À LA LECTURE : les pieds d'avant #1679 T1d ne le portent pas, et
 * `retirerPied` doit savoir les retirer pour qu'une re-signature n'en empile pas deux.
 */
export const PIED_RX =
  /<!-- sources-empreinte: ([0-9a-f]{40}) \((\d+) fichiers, (\d+) dossiers\)(?: corps: ([0-9a-f]{40}))? -->\n?$/

/** `{ empreinte, fichiers, dossiers, corps }` du pied, ou `null` si le doc n'en porte pas. `corps`
 *  vaut `null` sur la graphie d'avant T1d : le juge de fraîcheur la traite comme NON signée. */
export function lirePied(texte) {
  const m = PIED_RX.exec(texte)
  return m ? { empreinte: m[1], fichiers: Number(m[2]), dossiers: Number(m[3]), corps: m[4] ?? null } : null
}

/** Le doc SANS son pied, À L'OCTET — la forme que le générateur produit et compare en `--check`. */
export const retirerPied = (texte) => texte.replace(PIED_RX, '')

/** sha1 du CORPS d'un doc : ce que le pied signe, et ce qu'un lecteur recalcule pour savoir si le
 *  fichier a été touché par autre chose que son générateur. */
export const sha1Corps = (texte) => sha1(retirerPied(texte))

/** Le doc AVEC son pied, en dernière ligne, en un seul exemplaire, le corps INTACT. `corps` se
 *  calcule ICI, sur le texte effectivement signé : il ne se passe pas en paramètre, sans quoi un
 *  appelant pourrait signer un corps qu'il n'écrit pas. */
export function avecPied(texte, { empreinte, fichiers, dossiers }) {
  const corps = retirerPied(texte)
  if (!corps.endsWith('\n')) throw new Error('empreinte : ce doc ne finit pas par un saut de ligne, le pied y altérerait la dernière ligne')
  return `${corps}<!-- sources-empreinte: ${empreinte} (${fichiers} fichiers, ${dossiers} dossiers) corps: ${sha1(corps)} -->\n`
}

/**
 * Pourquoi ce doc doit être REJOUÉ, ou `null` s'il est frais. Frais = son pied signe les MÊMES
 * sources (`empreinteSources`, calculée par l'appelant) ET le corps qu'il porte. Les deux sont
 * nécessaires : les sources seules laisseraient passer une édition à la main du dérivé, le corps
 * seul laisserait passer une source modifiée.
 */
export function motifDeRejeu(texte, empreinteSources) {
  const pied = lirePied(texte)
  if (!pied) return 'sans pied « sources-empreinte »'
  if (pied.corps === null) return 'pied sans « corps: » (graphie d’avant la signature du corps)'
  if (pied.empreinte !== empreinteSources)
    return `sources ${pied.empreinte.slice(0, 12)} au pied, ${empreinteSources.slice(0, 12)} mesurées`
  const corps = sha1Corps(texte)
  if (pied.corps !== corps)
    return `corps divergent (pied ${pied.corps.slice(0, 12)}, doc ${corps.slice(0, 12)}) — ce dérivé a été édité hors de son générateur`
  return null
}

/**
 * Écrit un doc généré en CONSERVANT le pied qu'il portait. Un générateur joué SEUL (`npm run
 * raw:catalogs` en CI, suivi d'un `git diff --exit-code`) réécrit sa cible : sans cela il effacerait
 * la signature posée par `docs:build`, et le dépôt sortirait sale. Le pied redevient juste au
 * prochain `docs:build` ; s'il ment sur un doc STAGÉ, `--empreinte` le nomme.
 *
 * N'ÉCRIT QUE SI LE RENDU DIFFÈRE. Les trois rapports d'Atlas réécrivaient leur `.md` à CHAQUE run
 * (`coverage.mjs:422`, `reconcile.mjs:367`, `reanchor.mjs:344`) pendant que la suite lit ce même
 * dossier (`src/oversize-search-blindspot.test.ts:86`, `scripts/docs/manual-docs-ratchet.test.mjs:32`) :
 * jouées en LANES parallèles (`scripts/gates/toutes.mjs`), c'était un lecteur sur un fichier en
 * cours d'écriture. Patron : `scripts/gen-registry.mjs:417,702` (`if (changed) writeFileSync`).
 */
export function ecrireDoc(chemin, contenu) {
  let actuel
  try { actuel = readFileSync(chemin, 'utf8') } catch { actuel = null }
  const pied = actuel === null ? null : lirePied(actuel)
  const rendu = pied ? avecPied(contenu, pied) : contenu
  if (actuel !== rendu) writeFileSync(chemin, rendu)
}

/** Hash de BLOB git du contenu d'un fichier du disque — comparable à la colonne de `git ls-files -s`. */
export function hashBlobDisque(chemin) {
  const octets = readFileSync(chemin)
  return sha1(Buffer.concat([Buffer.from(`blob ${octets.length}\0`), octets]))
}

/** Hash d'un listing de dossier (noms d'entrées triés). */
export const hashListing = (entrees) => sha1([...entrees].sort().join('\n'))

/** Fusion des fichiers `<base>.<pid>.json` d'un dossier : le set du générateur, PID compris. */
export function fusionnerLectures(dossier) {
  const fichiers = new Set()
  const ecrits = new Set()
  const dossiers = new Map()
  // Chemins LUS hors racine, refusés par les enveloppes : sans ce compte, un rejet est indiscernable
  // d'une absence de lecture. UNITÉ : des chemins canoniques distincts PAR PROCESSUS, sommés entre
  // PID — un même fichier hors racine lu par deux processus compte 2. Le thread des hooks n'en rend
  // aucun : il n'appende que ce qu'il retient.
  let cheminsRejetes = 0
  for (const nom of listerDossier(dossier, { absent: 'vide' })) {
    if (nom.endsWith('.hooks.jsonl')) {
      for (const rel of readFileSync(path.join(dossier, nom), 'utf8').split('\n')) if (rel) fichiers.add(rel)
      continue
    }
    if (!nom.endsWith('.json')) continue
    const lu = JSON.parse(readFileSync(path.join(dossier, nom), 'utf8'))
    cheminsRejetes += lu.cheminsRejetes ?? 0
    for (const f of lu.fichiers ?? []) fichiers.add(f)
    for (const e of lu.ecrits ?? []) ecrits.add(e)
    // Un dossier listé par DEUX processus (un dumper et son parent) : le premier PID lu gagne, et
    // les PID sont parcourus dans l'ordre des noms de fichiers. Deux listings du même dossier au
    // cours d'un même `docs:build` ne divergent que si un tiers écrit dedans pendant la génération.
    for (const [d, entrees] of Object.entries(lu.dossiers ?? {})) if (!dossiers.has(d)) dossiers.set(d, entrees)
  }
  for (const e of ecrits) fichiers.delete(e)
  return { fichiers: [...fichiers].sort(), dossiers, ecrits: [...ecrits].sort(), cheminsRejetes }
}

/**
 * Blobs de l'INDEX, une seule invocation. Sous la forme à lignes, `core.quotepath` (non défini =
 * `true`) rend tout chemin non-ASCII entre guillemets et échappé en octal — `Source/…/01 -
 * CR\303\211DITS.md` — et 875 des sources mesurées tombaient en « non suivie » (mesuré 2026-09-02).
 * C'est `-z` qui mord : il rend les chemins BRUTS, terminés par NUL (la mutation qui retire le seul
 * `core.quotepath=false` reste verte ; celle qui revient à la forme à lignes rougit). Le drapeau
 * reste, il dit l'intention au lecteur ; NUL règle en plus les noms porteurs d'un saut de ligne.
 */
export function indexGit(racine) {
  const sortie = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-s', '-z'], {
    cwd: racine, encoding: 'utf8', maxBuffer: 1 << 28,
  })
  const blobs = new Map()
  for (const entree of sortie.split('\0')) {
    const m = /^\d+ ([0-9a-f]{40}) \d+\t([\s\S]+)$/.exec(entree)
    if (m) blobs.set(m[2], m[1])
  }
  return blobs
}

/** Noms des enfants DIRECTS d'un dossier tels que l'index les porte (fichiers et sous-dossiers). */
export function enfantsDeLIndex(blobs, dossier) {
  const prefixe = `${dossier}/`
  const noms = new Set()
  for (const chemin of blobs.keys()) if (chemin.startsWith(prefixe)) noms.add(chemin.slice(prefixe.length).split('/')[0])
  return [...noms]
}

/** Lignes `<chemin> <hash>` / `<dossier>/ <hash>` d'un set de lectures, dans l'ordre de l'empreinte. */
function lignes(fichiers, dossiers) {
  return [
    ...[...fichiers].sort().map(([p, h]) => `${p} ${h}`),
    ...[...dossiers].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, h]) => `${d}/ ${h}`),
  ]
}

export const empreinteDe = (fichiers, dossiers) => sha1(lignes(fichiers, dossiers).join('\n'))

/**
 * Empreinte du set MESURÉ, hashée sur le contenu du DISQUE. `ignores` (`ignoresGit`) retire du
 * listing d'un dossier ce qui n'entre pas dans la mesure (`dansLaMesure`) : le reste (un fichier non
 * suivi) est exactement ce que l'index ne porte pas.
 */
export function empreinteDuDisque(racine, lues, ignores) {
  const fichiers = new Map(lues.fichiers.map((p) => [p, hashBlobDisque(path.join(racine, p))]))
  const dossiers = new Map(
    [...lues.dossiers].map(([d, entrees]) => [d, hashListing(entrees.filter((n) => dansLaMesure(`${d}/${n}`, ignores)))]),
  )
  return { empreinte: empreinteDe(fichiers, dossiers), fichiers, dossiers }
}

/**
 * Empreinte du MÊME set, hashée sur l'INDEX. `manquants` = les chemins lus que l'index ne porte pas :
 * une source non suivie ne peut pas être vérifiée, elle se nomme au lieu d'être hashée à vide.
 */
export function empreinteDeLIndex(blobs, lues) {
  const manquants = []
  const fichiers = new Map()
  for (const p of lues.fichiers) {
    const h = blobs.get(p)
    if (h) fichiers.set(p, h)
    else manquants.push(p)
  }
  const dossiers = new Map([...lues.dossiers].map(([d]) => [d, hashListing(enfantsDeLIndex(blobs, d))]))
  return { empreinte: empreinteDe(fichiers, dossiers), fichiers, dossiers, manquants }
}

/** Sérialisation de `docs/.sources-lues.json` : trié, UN chemin par ligne (diff lisible). */
export function serialiserSourcesLues(parGenerateur) {
  const cles = Object.keys(parGenerateur).sort()
  const bloc = (nom, valeurs) =>
    valeurs.length ? `    "${nom}": [\n${valeurs.map((v) => `      ${JSON.stringify(v)}`).join(',\n')}\n    ]` : `    "${nom}": []`
  const corps = cles.map((cle) => {
    const e = parGenerateur[cle]
    return `  ${JSON.stringify(cle)}: {\n${[bloc('cibles', [...e.cibles].sort()), bloc('fichiers', [...e.fichiers].sort()), bloc('dossiers', [...e.dossiers].sort())].join(',\n')}\n  }`
  })
  return `{\n${corps.join(',\n')}\n}\n`
}

/** Les trois champs qu'une entrée de `docs/.sources-lues.json` porte, dans l'ordre du rendu. */
const CHAMPS = ['cibles', 'dossiers', 'fichiers']

const listeDe = (entree, champ) => (Array.isArray(entree?.[champ]) ? entree[champ] : [])

/**
 * Delta entre deux `parGenerateur` déjà parsés : `{ generateur, champ, ajoutes, retires }` pour chaque
 * champ qui diffère, un générateur absent d'un côté rendant tout son champ en ajout ou en retrait.
 * Le rouge de fraîcheur (`build-all.mjs --check`) NOMME ainsi ce qui a bougé — sans quoi la CI d'un
 * autre OS ne dit que « PÉRIMÉ » (run 33717131460 : vert sous Windows, rouge muet sous ubuntu).
 * Tri : par générateur, puis par champ, chemins triés en unités de code.
 */
export function deltaSourcesLues(avant, apres) {
  const noms = [...new Set([...Object.keys(avant ?? {}), ...Object.keys(apres ?? {})])].sort()
  const deltas = []
  for (const generateur of noms) {
    for (const champ of CHAMPS) {
      const a = new Set(listeDe(avant?.[generateur], champ))
      const b = new Set(listeDe(apres?.[generateur], champ))
      const ajoutes = [...b].filter((v) => !a.has(v)).sort()
      const retires = [...a].filter((v) => !b.has(v)).sort()
      if (ajoutes.length || retires.length) deltas.push({ generateur, champ, ajoutes, retires })
    }
  }
  return deltas
}

/** Largeur maximale d'un côté rendu dans l'aperçu : au-delà, la ligne est coupée et suffixée « … ». */
const LARGEUR = 240

/** Un côté d'une ligne dans l'aperçu : rendu JSON borné, `<absente>` quand ce côté n'a pas la ligne. */
const cote = (ligne) => (ligne === undefined ? '<absente>' : JSON.stringify(ligne.length > LARGEUR ? `${ligne.slice(0, LARGEUR)}…` : ligne))

/** La première divergence, NOMMÉE : ligne présente des deux côtés, ou d'un seul (manque / en trop). */
function premiereDivergence(k, regeneree, committee) {
  if (committee === undefined) return `ligne ${k + 1} MANQUE au committé : ${cote(regeneree)}`
  if (regeneree === undefined) return `ligne ${k + 1} EN TROP au committé : ${cote(committee)}`
  return `ligne ${k + 1} — committé : ${cote(committee)} / régénéré : ${cote(regeneree)}`
}

/**
 * L'écart entre un corps RÉGÉNÉRÉ et le corps COMMITTÉ, en clair : la première divergence NOMMÉE,
 * puis l'aperçu des `max` premières lignes divergentes des DEUX côtés, puis le compte du reste.
 * Vide = les deux corps sont identiques ; `committe` à `null` = le doc n'est pas sur le disque.
 * Sœur de `deltaSourcesLues` pour l'autre moitié du rouge de fraîcheur — les SOURCES d'un côté, le
 * CORPS de l'autre, quand un générateur compare son rendu au fichier (`emitOrCheck`, jsdocUnion.mjs).
 */
export function apercuDivergences(regenere, committe, max = 10) {
  if (committe === null) return 'le doc committé est ABSENT du dépôt'
  const attendues = regenere.split('\n')
  const lues = committe.split('\n')
  const total = Math.max(attendues.length, lues.length)
  const blocs = []
  let premiere = null
  let restantes = 0
  for (let k = 0; k < total; k++) {
    if (attendues[k] === lues[k]) continue
    if (premiere === null) premiere = premiereDivergence(k, attendues[k], lues[k])
    if (blocs.length >= max) {
      restantes++
      continue
    }
    blocs.push(`l.${k + 1}\n  committé : ${cote(lues[k])}\n  régénéré : ${cote(attendues[k])}`)
  }
  if (premiere === null) return ''
  if (restantes > 0) blocs.push(`… et ${restantes} autre(s) ligne(s) divergente(s)`)
  return [premiere, ...blocs].join('\n')
}

/** Le doc EXISTE-t-il sur le disque (une cible en glob peut ne rien viser). */
export const existeFichier = (p) => { try { return statSync(p).isFile() } catch { return false } }

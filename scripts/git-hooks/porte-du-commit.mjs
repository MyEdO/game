// Porte du COMMIT, jugée par le hook git `commit-msg` (`scripts/git-hooks/commit-msg.mjs`, #2071) sur le
// message et l'index que git enregistre : demande utilisateur 2026-07-14 (verbatim) — « J'en ai marre
// que tu donne un ticket a un agent, commit et consigne les résultats dans le ticket tout en le
// fermant, et oubliant que potentiellement il n'a pas bien fait son boulot ou qu'il a detecter un
// problème qu'il a consiédéré comme hors périmetre et que tu n'as pas mis dans un nouveau ticket ».
// La FERMETURE d'un ticket au commit devient mécaniquement impossible sans un SOLDE écrit
// (`.claude/soldes/<N>.md`) : preuve de vérification orchestrateur + disposition de chaque reste.
// Le solde est exigé dans l'INDEX du commit de fermeture (pas seulement sur le disque) et n'est plus
// jamais supprimé après coup : les messages de commit le citent par chemin, git est son archive.
//
// Extension même jour (verbatim) — « De la même maniere, apres un certain nombre de ticket fermé,
// il faudrait lancer une review adversarial. Ou a chaque ticket ... c'est peut etre la même régle
// finalement. A toi de voir » : chaque solde porte sa propre réfutation adversariale (verdict
// CONFIRMÉ/PARTIEL/RÉFUTÉ). La revue PAR TICKET est la seule : décision utilisateur du 2026-10-05
// (#2365, verbatim) — « Pour moi la revue de palier de 10 tickets n'a plus aucun sens. Autant une
// review sur le ticket sur son ensemble OK, mais pas un mélange de commit entre ticket de chantier
// séparé ».
//
// Extension 2026-07-14 (constat utilisateur, verbatim) — « je pensais que tu avais un hook qui te
// forceait a faire une review reversal, elle ne doit clairement pas marcher » puis « Ou alors
// seulement sur les tickets ? » : un commit « ref #N » (rattaché SANS fermer) échappait à tout
// regard adversarial. Anti-esquive — un commit `ref #N` qui touche `src/**` (≥10 lignes de diff
// staged) exige lui aussi sa réfutation (ligne `REFUTATION:` dans le message, ou fichier
// `.claude/soldes/ref-<N>.md`).
// Le déclencheur du mécanisme REFUTATION est le TICKET explicitement rattaché (fermeture ou `ref #N`),
// et c'est la PORTE DU TICKET qui le précède : un commit de substance cite un ticket, donc tout commit
// de substance arrive ici avec le sien.
//
// Porte du ticket (option retenue par l'utilisateur le 2026-09-11, verbatim) — « Tout commit de
// substance cite un ticket — un commit qui touche src/ ou scripts/ sans `refs #N`/`corrige #N` est
// refusé par le pre-commit ; le ticket est l'unité de travail, même pour un fix d'une ligne. »
//
// Ce que la porte exige, par volet (chacun a son évaluateur PUR et ses tests) :
//   `evaluate`                    solde conforme pour chaque ticket fermé — dont, dans « ## Restes »,
//                                 UN SEUL reste routé (skill orchestrer § Fermeture), une preuve au
//                                 site (`fichier:ligne`) pour « corrigé dans ce commit », un état
//                                 lisible pour « inventaire #<épic> », une « ## Recette visuelle »
//                                 à capture vérifiée quand un ÉCRAN est touché, et la preuve de sa
//                                 NATURE (`NATURE: <nature> [#M]`, scripts/guards/lib/nature.mjs, qui
//                                 fait le `state_reason` de la fermeture) : « ## Sonde » d'un `caduc`,
//                                 « ## Décision » d'un `décidé` ;
//   `evaluatePorteDuTicket`       commit de substance (`src`/`scripts`) dont le message ne cite
//                                 AUCUN ticket ;
//   `evaluateAntiEsquive`         réfutation d'un commit « ref #N » de substance ;
//   `evaluateJuge`                preuve de juge adversarial (+ JUGE-VISION sur un écran) ;
//   `evaluateRegistresPorteurs`   ticket encore porté par un registre de `registres-porteurs.json` ;
//   `evaluateTombale`             (scripts/git-hooks/solde-tombale.mjs) commentaire de dette citant le
//                                 ticket fermé ;
//   `evaluateBudgetContexte`      contexte permanent qui grandit sans `CLIQUET:` au message ;
//   `evaluateStocksQuiGrandissent` stock nominatif qui naît ou grandit sans `CLIQUET:` au message ;
//   `evaluateReclassementsCss`    module qui FRANCHIT la frontière CSS (`reclassementCss.mjs`) sans
//                                 `RECLASSEMENT:` au message, ou ligne sans franchissement ;
//   `evaluateHunksEmportes`       chemin dont l'index du dépôt porte un stage que le commit écrase
//                                 (`git commit -a`, `-i`, `-- <chemins>` : incidents acf2a447, bb824bafb).
//
// FUSION EN COURS (`MERGE_HEAD`, #2328, Attendu) — « Sauver une fusion résolue est un geste de
// CONSERVATION, pas une livraison. Il se commite et se pousse sans les trailers de livraison. » :
// `evaluateAntiEsquive` et `evaluateJuge` se TAISENT ; toutes les évaluations qui lisent le DIFF du
// commit jugent son APPORT PROPRE (de sa fusion automatique à l'image qu'elle commite, `diffDuCommit`),
// jamais ce que ses parents fusionnés apportent. Une fusion PROPRE n'apporte rien ; son message ferme
// toujours ses tickets par leur solde. Le pre-commit lit le même apport (`scripts/git-hooks/pre-commit.mjs`).
// Sa RÉSOLUTION se juge à la PUBLICATION (`fusionsNonJugees`, scripts/guards/lib/livraison.mjs) : au moins
// `SUBSTANTIVE_MIN_LINES` lignes changées sous src/ exigent `JUGE:` et `REFUTATION:` (plus `JUGE-VISION:`
// sur un écran), portés par le message de la fusion elle-même, sinon par un commit postérieur de la plage
// ou le solde d'un ticket qu'il cite, qui nomment son sha.
//
// Lectures git par lot, comptées au processus (`lancesDeGit`, `scripts/test/gitDeBanc.mjs`) : #2294.
// Version de git : `versionManquante`, `exigerMergeTree` (`scripts/guards/lib/gitPorte.mjs`).
// Hors de la porte : les formes qui n'appellent pas `commit-msg` (en-tête de
// `scripts/git-hooks/commit-msg.mjs`) ; `--no-verify` de `commit`/`merge`/`pull` et `core.hooksPath`
// (`scripts/hooks/hooks-git-contournes-guard.mjs`) ; `git push --no-verify` : #2184.
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { estPorteurDeStock, nonCouvertesDuBilan, raisonDeRefus } from '../guards/lib/stocksNominatifs.mjs'
import { bilanDuCommit, entreeDeFusion, lecturesDeFusion } from '../guards/lib/plageStock.mjs'
import {
  deplaceLaFrontiere, lignesDeReclassement, raisonDeRefusDeReclassement, reclassementsNonDeclares,
} from '../guards/lib/reclassementCss.mjs'
import { coteCss, sourceGit } from '../guards/lib/cssImages.mjs'
import {
  estCheminDuBudget, importsDe, mesurerBudget, refusDeBudget,
} from '../guards/budget-contexte.mjs'
import {
  GitIndisponible, INDEX, INDEX_DU_DEPOT, apportDeLaFusionEnCours, depotAuxPannes, racineSurDisque, ceQueFontLesCommits, ceQuiChange, cheminsIgnores, depotDe, enfantsDirects,
  entreesDe, fichiersDuGrep, fusionnesEnCours, histoireDeHead, imageDeHead, indexEmprunte, listerImage, shaDe, refusDeGit,
} from '../guards/lib/gitPorte.mjs'
import { hunksDe } from '../guards/lib/hunks.mjs'
import { SUBSTANTIVE_MIN_LINES, TRAILERS, corpsDuTrailer, estFichierEcran, sectionDe } from '../guards/lib/livraison.mjs'
import { motifRattachement, numerosCites, numerosDeLaChaine, numerosFermes, numerosNusEnumeres } from '../guards/lib/fermetures.mjs'
import { lectureDuMessage } from '../guards/lib/sujetDeCommit.mjs'
import { decisionCumulee } from '../guards/lib/contratGarde.mjs'
import { grammaireDesNatures, natureDuSolde } from '../guards/lib/nature.mjs'
import { DATE } from '../guards/memoire-forme.mjs'

/** Des numéros canoniques (`fermetures.mjs`) en nombres, dédupliqués et triés. PURE. */
const enNombres = (numeros) => [...new Set(numeros.map(Number))].sort((a, b) => a - b)

/** Les numéros que les chaînes de rattachement (`motifRattachement`) de `texte` citent. PURE. */
const numerosRattaches = (texte) => enNombres([...texte.matchAll(motifRattachement())].flatMap((m) => numerosDeLaChaine(m[0])))

/**
 * Ce que lit une décision de la porte dans le `message` que git enregistre (`lectureDuMessage`, sous le
 * caractère de commentaire `commentaire`) : ses fermetures sur ses `exigences`, ses rattachements et ses
 * trailers sur ses `satisfactions`. PURE.
 * @param {{ message: string, commentaire?: string }} entree
 * @returns {{ satisfactions: string, fermes: () => number[], nus: () => number[], refs: () => number[] }}
 */
function lectureDeLaPorte({ message, commentaire = '#' }) {
  const { exigences, satisfactions } = lectureDuMessage(message, { commentaire })
  return {
    satisfactions,
    fermes: () => enNombres(numerosFermes(exigences)),
    nus: () => enNombres(numerosNusEnumeres(exigences)),
    refs: () => numerosRattaches(satisfactions),
  }
}

const VERIFIE_RE = /VERIFIE\s*:\s*(.+)/i
const MIN_VERIFIE_LEN = 40
// Une section d'un solde court de son titre de niveau 2 jusqu'au PROCHAIN titre de niveau 2, ou la
// fin du fichier : une ligne VIDE n'y termine rien, et les sous-titres `###` en font partie. Borne
// unique des trois sections (« Restes », « Recette visuelle », « Réfutation ») — la borne à la
// première ligne blanche rendait 1 reste vu pour 5 réels dès qu'une liste était aérée, et cachait la
// grammaire de tout ce qui suivait le blanc (sonde D1 : 4 dispositions invalides sur 5 acceptées).
const TITRE_RESTES = 'Restes'
const TITRE_RECETTE_VISUELLE = 'Recette visuelle'
const TITRE_REFUTATION = TRAILERS.REFUTATION.section


/** Nombre de fois que le titre `## <titre>` apparaît dans le document. Une section DUPLIQUÉE n'est pas
 *  une section plus longue : `sectionDe` rend la PREMIÈRE, et tout ce que porte la seconde échappe au
 *  plafond comme à la grammaire — elle se refuse, elle ne se devine pas. */
export function compteSections(content, titre) {
  return String(content ?? '').match(new RegExp(`(?:^|\\n)##\\s*${titre}\\s*\\n`, 'gi'))?.length ?? 0
}
// Cinq dispositions, et cinq seulement.
//   `#N`                                   le reste ÉMET un ticket (plafonné, voir ci-dessous) ;
//   `corrigé dans ce commit <f>:<l>`       la correction part AVEC le solde ;
//   `corrigé par <sha> <f>:<l>`            la correction est DÉJÀ dans l'histoire (un solde écrit
//                                          après coup ne peut pas dire « ce commit » sans mentir) ;
//   `RAS : <justification>`                rien à router ;
//   `inventaire #<épic> : <état>`          écart PORTÉ à un programme (aucun ticket neuf émis).
const DISPOSITION_RE = /^-\s*.+->\s*(#\d+|corrigé dans ce commit\b.*|corrigé par\s+[0-9a-f]{7,40}\s+\S+:\d+|RAS\s*:\s*\S.*|inventaire\s+#\d+\s*:\s*\S.*)\s*$/iu
// Le plafond compte les tickets ÉMIS : un item qui route vers `#N` en compte un, que la ligne soit
// bien formée ou non (une queue de prose derrière le numéro est refusée à part, par la grammaire).
const ROUTANT_RE = /->\s*#\d+/
const CORRIGE_RE = /->\s*corrigé dans ce commit\b(.*)$/iu
const CORRIGE_PAR_RE = /->\s*corrigé par\s+([0-9a-f]{7,40})\s+(\S+):(\d+)\s*$/iu
const INVENTAIRE_RE = /->\s*inventaire\s+#(\d+)\s*:\s*(\S.*)$/iu
// `fichier.ext:ligne` — le point d'extension distingue un chemin d'une prose à deux-points.
const REF_SITE_RE = /([A-Za-z0-9_@./\\-]+\.[A-Za-z0-9]+):(\d+)/g
// Skill orchestrer § Fermeture (audit 2026-08-30) : « une fermeture qui émettrait PLUS D'UN ticket
// de reste n'est PAS fermable : soit le lot GROSSIT pour absorber le reste, soit le ticket RESTE
// OUVERT avec la formule historique des soldes #829/#900 ».
const MAX_RESTES_ROUTANTS = 1
const MIN_ETAT_INVENTAIRE = 20
// Recette visuelle : la capture vit sous `public/qc/` (convention de `scripts/qc/capture-jeu.mjs`).
const CAPTURE_RE = /capture\s*:\s*(\S+)/i
const DOSSIER_CAPTURES = 'public/qc/'
const ENTETE_PNG = [0x89, 0x50, 0x4e, 0x47]
const ENTETE_JPEG = [0xff, 0xd8, 0xff]
// Une capture d'écran de jeu pèse des dizaines de Kio ; 1 Kio est le plancher sous lequel il n'y a
// pas d'image, et 200 px la plus petite dimension dont on puisse JUGER quoi que ce soit.
const TAILLE_MIN_CAPTURE = 1024
const COTE_MIN_CAPTURE = 200
const VERDICT_RE = /verdict\s*:\s*([A-Za-zÀ-ÖØ-öø-ÿ]+)/i
const MIN_REFUTATION_LEN = 40

/** `CONFIRMÉ`/`confirme`/`CONFIRME` → `CONFIRME` (compare sans accent, insensible à la casse). */
function normalizeVerdict(word) {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

/** Longueur de texte hors la ligne `verdict: …` elle-même (mesure la SYNTHÈSE, pas le mot-clef). */
function lenWithoutVerdictLine(text) {
  return text.replace(VERDICT_RE, '').trim().length
}

/** Section `## Réfutation` d'un solde : présence, verdict reconnu, longueur de synthèse.
 *  `refuted: true` si le verdict est RÉFUTÉ — porte alors sa propre entrée dans `problems`
 *  (« un ticket réfuté ne se ferme pas »), le solde est TOUJOURS non conforme dans ce cas. */
function checkRefutationSection(content) {
  const problems = []
  const body = sectionDe(content, TITRE_REFUTATION)
  if (body === null) {
    problems.push('section "## Réfutation" absente (verdict adversarial obligatoire)')
    return { problems, refuted: false }
  }
  const vMatch = VERDICT_RE.exec(body)
  if (!vMatch) {
    problems.push('ligne "verdict: CONFIRMÉ|PARTIEL|RÉFUTÉ" absente dans "## Réfutation"')
    return { problems, refuted: false }
  }
  const verdict = normalizeVerdict(vMatch[1])
  if (!['CONFIRME', 'PARTIEL', 'REFUTE'].includes(verdict)) {
    problems.push(`verdict "${vMatch[1]}" non reconnu dans "## Réfutation" (attendu CONFIRMÉ/PARTIEL/RÉFUTÉ)`)
    return { problems, refuted: false }
  }
  const descLen = lenWithoutVerdictLine(body)
  if (descLen < MIN_REFUTATION_LEN) {
    problems.push(`"## Réfutation" trop maigre (${descLen} car. hors verdict, ${MIN_REFUTATION_LEN} requis — qui a attaqué quoi, sur le diff/DoD du ticket)`)
  }
  const refuted = verdict === 'REFUTE'
  if (refuted) problems.push('verdict RÉFUTÉ : un ticket réfuté ne se ferme pas')
  return { problems, refuted }
}

/** Items de la section « ## Restes » d'un solde, un par ligne (`[]` si la section est absente ou
 *  vaut « RAS » pour le tout). Point d'entrée UNIQUE des mesures de stock et de la porte. */
export function restesItems(content) {
  const body = sectionDe(content, TITRE_RESTES)
  if (body === null) return []
  const lignes = lignesUtiles(body)
  return estRAS(lignes) ? [] : lignes
}

/** Lignes PORTEUSES d'une section : un sous-titre la STRUCTURE (il n'en est pas un item) et une ligne
 *  vide ne fait que séparer. */
function lignesUtiles(section) {
  return section.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
}

/** « RAS » pour le TOUT : le seul contenu de la section est ce mot. */
function estRAS(lignes) {
  return lignes.length === 1 && lignes[0] === 'RAS'
}

/** Items ROUTANTS (`-> #N`) : ceux qui émettent un ticket de reste. */
export function restesRoutants(content) {
  return restesItems(content).filter((l) => ROUTANT_RE.test(l))
}

/** Lignes RECEVABLES comme site d'une correction dans un diff unifié à zéro contexte
 *  (`git diff --cached -U0 -- <fichier>`) : les lignes du côté DESTINATION (`+a,b`, du code ajouté
 *  ou modifié) ET celles du côté SOURCE (`-a,b`). Le côté source compte parce qu'une correction est
 *  souvent une SUPPRESSION (le geste « chemin mort retiré » n'ajoute rien) : sans lui, prouver la
 *  correction à son site était impossible pour toute une classe de gestes. */
export function lignesDeHunks(diffU0) {
  const lignes = new Set()
  for (const { a, b, c, d } of hunksDe(diffU0)) {
    for (const [debut, n] of [[a, b], [c, d]]) for (let k = 0; k < n; k++) lignes.add(debut + k)
  }
  return [...lignes].sort((a, b) => a - b)
}

/**
 * Contrôle d'une capture de recette visuelle : sous `public/qc/`, présente, d'un poids d'image, PNG
 * ou JPEG à ses octets de tête, aux dimensions lisibles (PNG : l'en-tête IHDR porte largeur et
 * hauteur), non IGNORÉE par git, et pas plus ANCIENNE que le dernier fichier d'écran stagé
 * (`mtimeMin`, millisecondes). `racine` = arbre où le chemin se résout.
 *
 * CE QUE CETTE PORTE PROUVE : qu'une image d'écran plausible existe et vient d'être produite —
 * garde-fou d'ÉTOURDERIE (chemin périmé, fichier vide, capture d'avant le geste), PAS de
 * CONTREFAÇON. Rien ici ne dit que l'image montre l'écran modifié : c'est la recette qui le juge.
 * `verifierCaptures` d'une seule capture.
 */
export const verifierCapture = (chemin, options) => verifierCaptures([chemin], options).get(chemin)

/** Le chemin d'une capture tel que la porte le lit : séparateurs POSIX, sans `./` de tête. PUR. */
const cheminDeCapture = (chemin) => String(chemin ?? '').replace(/\\/g, '/').replace(/^\.\//, '')

/**
 * Le contrôle de chacune des `chemins` (`verifierCapture`) : chemin ↦ `{ ok, problemes }`. Le sort
 * de TOUTES au commit se lit en UN lot (`cheminsIgnores`) dans `depot` (celui de `racine` par
 * défaut, ses pannes dans `pannes`), quel que soit leur nombre.
 * @param {readonly string[]} chemins
 * @param {{ racine?: string, mtimeMin?: number, pannes?: string[], depot?: import('../guards/lib/gitPorte.mjs').Depot }} [options]
 * @returns {Map<string, { ok: boolean, problemes: string[] }>}
 */
export function verifierCaptures(chemins, { racine = process.cwd(), mtimeMin = 0, pannes = [], depot = depotAuxPannes(racine, pannes) } = {}) {
  const sousLeDossier = chemins.map(cheminDeCapture).filter((norm) => norm.startsWith(DOSSIER_CAPTURES))
  const ignorees = cheminsIgnores(depot, [...new Set(sousLeDossier)], { suivisCompris: true })
  return new Map(chemins.map((chemin) => [chemin, jugerCapture(chemin, { racine, mtimeMin, ignorees })]))
}

/** Le contrôle d'UNE capture (`verifierCapture`), son sort au commit lu dans `ignorees`. */
function jugerCapture(chemin, { racine, mtimeMin, ignorees }) {
  const problemes = []
  const norm = cheminDeCapture(chemin)
  if (!norm.startsWith(DOSSIER_CAPTURES)) {
    problemes.push(`capture "${chemin}" hors de ${DOSSIER_CAPTURES} (les captures de recette y vivent, cf. scripts/qc/capture-jeu.mjs)`)
    return { ok: false, problemes }
  }
  // Une capture qu'un `.gitignore` retient ne part PAS avec le commit : quiconque relit le solde
  // y trouve une preuve inouvrable. Le refus vient AVANT la lecture du disque — exister sur la
  // machine du geste ne la rend pas opposable. Hors dépôt, la porte ne juge que le disque : le banc
  // de `verifierCapture` travaille hors git.
  if (ignorees.has(norm)) {
    problemes.push(`capture "${norm}" IGNORÉE par git (.gitignore) — un solde ne cite qu'une preuve versionnée : la poser sous public/qc/soldes/`)
    return { ok: false, problemes }
  }
  let info
  let octets
  try {
    const abs = join(racine, norm)
    info = statSync(abs)
    octets = readFileSync(abs)
  } catch {
    problemes.push(`capture "${norm}" introuvable sur le disque`)
    return { ok: false, problemes }
  }
  const estPng = ENTETE_PNG.every((b, i) => octets[i] === b)
  const estJpeg = ENTETE_JPEG.every((b, i) => octets[i] === b)
  if (!estPng && !estJpeg) {
    problemes.push(`capture "${norm}" n'est ni un PNG ni un JPEG à ses octets de tête`)
    return { ok: false, problemes }
  }
  if (info.size < TAILLE_MIN_CAPTURE) {
    problemes.push(`capture "${norm}" trop légère (${info.size} octets, ${TAILLE_MIN_CAPTURE} minimum) — un en-tête d'image n'est pas une capture`)
  }
  if (estPng) {
    // En-tête IHDR : largeur à l'octet 16, hauteur à l'octet 20. Un fichier plus court que ça n'a pas
    // d'en-tête du tout — dimensions nulles, refus (un hook ne lève jamais).
    const largeur = octets.length >= 24 ? octets.readUInt32BE(16) : 0
    const hauteur = octets.length >= 24 ? octets.readUInt32BE(20) : 0
    if (largeur < COTE_MIN_CAPTURE || hauteur < COTE_MIN_CAPTURE) {
      problemes.push(`capture "${norm}" trop petite (${largeur}×${hauteur} px, ${COTE_MIN_CAPTURE} minimum par côté) — rien n'y est jugeable`)
    }
  }
  if (mtimeMin && info.mtimeMs < mtimeMin) {
    problemes.push(`capture "${norm}" plus ANCIENNE que le dernier fichier d'écran stagé — recapturer APRÈS le geste`)
  }
  return { ok: problemes.length === 0, problemes }
}

/** Section « ## Restes » : grammaire des dispositions, plafond de restes routants, preuve au site
 *  des corrections, garde de l'inventaire. Voir `validateSolde` pour le contexte injecté. */
function checkRestesSection(content, ctx) {
  const problems = []
  const section = sectionDe(content, TITRE_RESTES)
  if (section === null) {
    problems.push('section "## Restes" absente')
    return problems
  }
  const occurrences = compteSections(content, TITRE_RESTES)
  if (occurrences > 1) {
    problems.push(`section "## Restes" DUPLIQUÉE (${occurrences} fois) : seule la PREMIÈRE est lue — les items des suivantes échappent au plafond et à la grammaire. Fusionner en une seule section.`)
    return problems
  }

  if (estRAS(lignesUtiles(section))) return problems

  const lines = restesItems(content)
  if (lines.length === 0) {
    problems.push('section "## Restes" vide (attendu "RAS" ou des items "- <reste> -> <disposition>")')
    return problems
  }

  const routants = lines.filter((l) => ROUTANT_RE.test(l))
  if (routants.length > MAX_RESTES_ROUTANTS) {
    problems.push(
      `${routants.length} restes ROUTÉS vers un ticket neuf (plafond ${MAX_RESTES_ROUTANTS}) : le ticket reste ouvert ` +
      `sur ce reste — soit le lot GROSSIT pour absorber les restes, soit la fermeture attend (skill orchestrer ` +
      `§ Fermeture ; formule historique des soldes #829/#900)`,
    )
  }

  for (const [i, line] of lines.entries()) {
    if (!DISPOSITION_RE.test(line)) {
      problems.push(`item sans disposition valide dans "## Restes" (ligne ${i + 1} du bloc) : "${line}" — attendu "-> #N" / "-> corrigé dans ce commit (<fichier>:<ligne>)" / "-> corrigé par <sha> <fichier>:<ligne>" / "-> RAS : <justification>" / "-> inventaire #<épic> : <état>"`)
      continue
    }
    const corrige = CORRIGE_RE.exec(line)
    if (corrige) problems.push(...problemesCorrige(corrige[1], i + 1, ctx))
    const corrigePar = CORRIGE_PAR_RE.exec(line)
    if (corrigePar) problems.push(...problemesCorrigePar(corrigePar, i + 1, ctx))
    const inventaire = INVENTAIRE_RE.exec(line)
    if (inventaire) problems.push(...problemesInventaire(inventaire, i + 1, ctx))
  }
  return problems
}

/** « -> corrigé dans ce commit » : la correction se PROUVE à son site (`fichier:ligne`), le fichier
 *  doit être dans le diff STAGÉ et la ligne dans un de ses hunks. Les contrôles dont le contexte
 *  n'est pas fourni (appel PUR) ne se jouent pas — la grammaire, elle, est toujours exigée. */
function problemesCorrige(queue, rang, { fichiersEmportes, lignesEmportees }) {
  const problems = []
  const refs = [...String(queue).matchAll(REF_SITE_RE)]
    .map((m) => ({ fichier: m[1].replace(/\\/g, '/'), ligne: Number(m[2]) }))
  if (refs.length === 0) {
    problems.push(`item "corrigé dans ce commit" sans référence <fichier>:<ligne> (ligne ${rang} du bloc) — une correction annoncée se prouve à son site`)
    return problems
  }
  for (const ref of refs) {
    if (fichiersEmportes && !fichiersEmportes.some((f) => f.replace(/\\/g, '/') === ref.fichier)) {
      problems.push(`"corrigé dans ce commit" (ligne ${rang} du bloc) cite ${ref.fichier}, ABSENT de ce que ce commit emporte`)
      continue
    }
    if (!lignesEmportees) continue
    const lignes = lignesEmportees(ref.fichier)
    if (lignes && !lignes.includes(ref.ligne)) {
      problems.push(`"corrigé dans ce commit" (ligne ${rang} du bloc) cite ${ref.fichier}:${ref.ligne}, hors des lignes que ce commit modifie`)
    }
  }
  return problems
}

/** « -> corrigé par <sha> <fichier>:<ligne> » : la correction est DÉJÀ dans l'histoire. Trois faits se
 *  vérifient contre git, jamais sur parole : le commit cité est un ANCÊTRE de HEAD (il est bien dans
 *  cette histoire), il TOUCHE le fichier cité, et la LIGNE citée est dans un de ses hunks — la même
 *  preuve au site que « corrigé dans ce commit » exige, sans quoi « :999999 » passait. Cas fondateur :
 *  `.claude/soldes/584.md:7` — le fix vit dans 4d6e1ff78, le solde dans 8a2807134, aucune des autres
 *  dispositions ne le dit sans mentir. Fichier et ligne se lisent sur CE QUE FAIT le commit
 *  (`ceQueFaitLeCommit`) : une fusion ne prouve que son apport propre, jamais le travail qu'elle
 *  amène d'une autre branche. Un fichier touché sans hunk (binaire, mode seul) ne tranche pas la
 *  ligne. Contrôles non fournis (appel PUR) = non joués ; la grammaire, elle, est toujours exigée. */
function problemesCorrigePar([, sha, fichier, ligne], rang, { commitEstAncetre, fichiersDuCommit, lignesDuCommit }) {
  const problems = []
  const cite = fichier.replace(/\\/g, '/')
  if (commitEstAncetre && commitEstAncetre(sha) !== true) {
    problems.push(`"corrigé par ${sha}" (ligne ${rang} du bloc) cite un commit qui n'est pas un ANCÊTRE de HEAD — la correction annoncée n'est pas dans cette histoire`)
    return problems
  }
  if (fichiersDuCommit) {
    const touches = fichiersDuCommit(sha)
    if (touches && !touches.some((f) => f.replace(/\\/g, '/') === cite)) {
      problems.push(`"corrigé par ${sha}" (ligne ${rang} du bloc) cite ${cite}:${ligne}, que ce commit ne touche PAS`)
      return problems
    }
  }
  if (lignesDuCommit) {
    const lignes = lignesDuCommit(sha, cite)
    if (lignes && lignes.length > 0 && !lignes.includes(Number(ligne))) {
      problems.push(`"corrigé par ${sha}" (ligne ${rang} du bloc) cite ${cite}:${ligne}, hors des lignes que ce commit y modifie`)
    }
  }
  return problems
}

/** « -> inventaire #<épic> : <état> » : un écart PORTÉ, pas un reste routé. Le porter à un épic que
 *  LE MÊME commit ferme laisserait l'écart sans destinataire — il se convertit alors en ticket. */
function problemesInventaire([, epic, etat], rang, { issuesFermees }) {
  const problems = []
  const texte = etat.trim()
  if (texte.length < MIN_ETAT_INVENTAIRE) {
    problems.push(`"inventaire #${epic}" (ligne ${rang} du bloc) sans état lisible (${texte.length} car., ${MIN_ETAT_INVENTAIRE} requis)`)
  }
  if (issuesFermees.includes(Number(epic)) && /écart/i.test(texte)) {
    problems.push(`"inventaire #${epic}" (ligne ${rang} du bloc) porte un écart à un épic que CE COMMIT ferme : convertir en ticket par CLASSE avant la clôture`)
  }
  return problems
}

/** Section « ## Recette visuelle » : exigée dès que le diff stagé touche un fichier d'écran
 *  (`src/ui/**` / `src/gameIso/**`, hors tests) — décision E1, un écran ne se solde pas sur parole. */
function checkRecetteVisuelle(content, { touchesUi, verifierCaptureDe }) {
  if (!touchesUi) return []
  const section = sectionDe(content, TITRE_RECETTE_VISUELLE)
  if (section === null) {
    return ['section "## Recette visuelle" absente alors que le commit touche un écran (src/ui/** ou src/gameIso/**) — y porter "capture: public/qc/<fichier>.png"']
  }
  const capture = captureDuSolde(content)
  if (!capture) {
    return ['"## Recette visuelle" sans ligne "capture: <chemin sous public/qc/>"']
  }
  return verifierCaptureDe(capture).problemes
}

const TITRE_SONDE = 'Sonde'
const TITRE_DECISION = 'D[ée]cision'
const BLOC_DE_CODE_RE = /^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*\r?$/gm
const SHA_RE = /\b[0-9a-f]{7,40}\b/g
const CITATION_RE = /«[^»]+»/

/** Les shas que cite la section « ## Sonde » d'un solde `caduc` (`natureDuSolde`), `[]` pour toute
 *  autre nature. PUR. @param {string | null} content @returns {string[]} */
function shasDeLaSonde(content) {
  if (natureDuSolde(content).nature !== 'caduc') return []
  return [...new Set(sectionDe(content, TITRE_SONDE)?.match(SHA_RE) ?? [])]
}

/** La NATURE du solde (`natureDuSolde`) et sa preuve : `doublon` nomme `#M` ≠ `numero` ;
 *  `caduc` porte une « ## Sonde » à deux blocs de code (commande, sortie) qui nomme un sha ANCÊTRE de
 *  HEAD (`commitEstAncetre`, non joué sur un appel PUR) ; `décidé` porte une « ## Décision » dont une
 *  ligne cite `«…»` avec sa date (`DATE`, scripts/guards/memoire-forme.mjs). */
function checkNature(content, { numero, commitEstAncetre }) {
  const lu = natureDuSolde(content, numero)
  if (lu.erreur) return [lu.erreur]
  if (lu.nature === 'caduc') {
    const sonde = sectionDe(content, TITRE_SONDE)
    if (sonde === null) return ['"NATURE: caduc" sans section "## Sonde" (bloc de code de la commande, bloc de code de sa sortie, sha où le constat ne se reproduit pas)']
    const blocs = sonde.match(BLOC_DE_CODE_RE)?.length ?? 0
    if (blocs < 2) return [`"## Sonde" porte ${blocs} bloc(s) de code — la commande PUIS sa sortie, deux blocs clôturés`]
    const shas = shasDeLaSonde(content)
    if (shas.length === 0) return ['"## Sonde" ne nomme aucun sha — le commit où le constat ne se reproduit pas']
    if (commitEstAncetre && !shas.some((sha) => commitEstAncetre(sha) === true)) {
      return [`"## Sonde" ne nomme aucun commit ANCÊTRE de HEAD (${shas.join(', ')}) — la sonde n'a pas été jouée dans cette histoire`]
    }
  }
  if (lu.nature === 'décidé') {
    const decision = sectionDe(content, TITRE_DECISION)
    if (decision === null) return ['"NATURE: décidé" sans section "## Décision" (la décision utilisateur, citée « … » avec sa date AAAA-MM-JJ sur la même ligne)']
    if (!decision.split('\n').some((l) => CITATION_RE.test(l) && DATE.test(l))) {
      return ['"## Décision" sans ligne qui cite la décision « … » ET porte sa date AAAA-MM-JJ']
    }
  }
  return []
}

/** La capture que cite la section « ## Recette visuelle » d'un solde, `null` sans section ni ligne
 *  `capture:`. PUR. @param {string | null} content @returns {string | null} */
function captureDuSolde(content) {
  const section = content ? sectionDe(content, TITRE_RECETTE_VISUELLE) : null
  return section === null ? null : CAPTURE_RE.exec(section)?.[1] ?? null
}

/**
 * Valide le CONTENU d'un solde. `today` = date du jour en `YYYY-MM-DD`.
 * Contexte INJECTÉ (`decisionsDuCommit` le remplit depuis git/le disque, un appel nu ne joue que la grammaire) :
 * `fichiersEmportes` = chemins que le commit emporte ; `lignesEmportees(fichier)` = lignes que le commit y
 * modifie ; `issuesFermees` = tickets fermés par CE commit ; `touchesUi` = le diff touche un écran ;
 * `verifierCaptureDe(chemin)` = contrôle de la capture de recette (voir `verifierCapture`) ;
 * `commitEstAncetre(sha)` / `fichiersDuCommit(sha)` / `lignesDuCommit(sha, fichier)` = l'histoire
 * git, pour « corrigé par <sha> » et la « ## Sonde » d'un solde `caduc` ; `numero` = le ticket que le
 * solde ferme (`checkNature`).
 */
export function validateSolde(content, today, {
  fichiersEmportes = null,
  lignesEmportees = null,
  issuesFermees = [],
  touchesUi = false,
  verifierCaptureDe = () => ({ ok: true, problemes: [] }),
  commitEstAncetre = null,
  fichiersDuCommit = null,
  lignesDuCommit = null,
  numero,
} = {}) {
  if (!content) return { ok: false, problems: ['fichier absent'], refuted: false }

  const problems = []

  const vMatch = VERIFIE_RE.exec(content)
  if (!vMatch) {
    problems.push('ligne "VERIFIE:" absente')
  } else if (vMatch[1].trim().length < MIN_VERIFIE_LEN) {
    problems.push(`"VERIFIE:" trop court (${vMatch[1].trim().length} car., ${MIN_VERIFIE_LEN} requis — décrire concrètement la vérification faite)`)
  }

  problems.push(...checkRestesSection(content, { fichiersEmportes, lignesEmportees, issuesFermees, commitEstAncetre, fichiersDuCommit, lignesDuCommit }))
  problems.push(...checkRecetteVisuelle(content, { touchesUi, verifierCaptureDe }))
  problems.push(...checkNature(content, { numero, commitEstAncetre }))

  const { problems: refutationProblems, refuted } = checkRefutationSection(content)
  problems.push(...refutationProblems)

  if (!content.includes(today)) {
    problems.push(`date du jour (${today}) absente du fichier — solde réchauffé refusé`)
  }

  return { ok: problems.length === 0, problems, refuted }
}

/**
 * Décision du hook (PURE, testable). `readSoldes(ns)` rend, dans l'ordre de `ns` et en UNE lecture
 * pour tous les tickets fermés, le contenu que le commit EMPORTE de chaque `.claude/soldes/<n>.md`, ou
 * `null`/`''` s'il n'y est pas. `soldeOnDisk(n)` renvoie le
 * contenu du même fichier sur le DISQUE : il ne sert qu'à distinguer « jamais écrit » de « écrit mais
 * non stagé » dans le message. `contexteSolde` = le contexte injecté de
 * `validateSolde` (diff stagé, hunks, écran touché), où `verifierCapturesDe(chemins)` contrôle d'un
 * coup les captures de TOUS les soldes (`verifierCaptures`) et `histoireDe(shas)` lit d'un coup les
 * shas que TOUS les soldes citent par « corrigé par » (`histoireDesCitations`) — `issuesFermees` y est
 * posé ICI, c'est cette décision qui connaît les tickets fermés.
 * @returns {{ reason: string } | null} — non-null = refus, null = silence.
 */
export function evaluate({ message, commentaire, today, readSoldes, soldeOnDisk = () => null, contexteSolde = {} }) {
  const lu = lectureDeLaPorte({ message, commentaire })
  const nus = lu.nus()
  if (nus.length > 0) {
    const cites = nus.map((n) => `#${n}`).join(', ')
    return {
      reason:
        `⛔ ${cites} suit une clause de fermeture sans son propre mot-clef : seul le premier \`#N\` d'une `
        + 'clause se ferme (`numerosFermes`, scripts/guards/lib/fermetures.mjs). '
        + `Geste : écrire \`corrige ${nus.map((n) => `#${n}`).join('`, `corrige ')}\` `
        + `pour chacun, ou \`refs ${nus.map((n) => `#${n}`).join(' ')}\` s'il n'est pas fermé.`,
    }
  }

  const issues = lu.fermes()
  if (issues.length === 0) return null

  const lus = readSoldes(issues)
  const emportes = new Map(issues.map((n, i) => [n, lus[i]]))
  const { verifierCapturesDe, histoireDe, ...contexte } = contexteSolde
  let captures = null
  const verifierCaptureDe = verifierCapturesDe && ((chemin) => {
    captures ??= verifierCapturesDe([...new Set([...emportes.values()].map(captureDuSolde).filter(Boolean))])
    return captures.get(chemin)
  })
  let histoire = null
  const lue = () => (histoire ??= histoireDe([...new Set([...emportes.values()].flatMap(shasCitesDuSolde))]))
  const citations = histoireDe ? {
    commitEstAncetre: (sha) => lue().commitEstAncetre(sha),
    fichiersDuCommit: (sha) => lue().fichiersDuCommit(sha),
    lignesDuCommit: (sha, fichier) => lue().lignesDuCommit(sha, fichier),
  } : {}
  const failures = []
  for (const n of issues) {
    const emporte = emportes.get(n)
    if (!emporte && soldeOnDisk(n)) {
      failures.push({
        n,
        problems: [
          `écrit sur le disque mais NON EMPORTÉ par ce commit — \`git add .claude/soldes/${n}.md\` ; et si `
          + `la commande nomme des chemins (\`git commit … -- <chemins>\`), y AJOUTER `
          + `\`.claude/soldes/${n}.md\` : un commit par pathspec n'emporte QUE ces chemins-là, la preuve `
          + 'reste sur le disque et le commit part sans elle',
        ],
      })
      continue
    }
    const { ok, problems } = validateSolde(emporte, today, { ...contexte, ...citations, verifierCaptureDe, issuesFermees: issues, numero: n })
    if (!ok) failures.push({ n, problems })
  }
  if (failures.length === 0) return null

  const detail = failures.map(({ n, problems }) => `#${n} (.claude/soldes/${n}.md) — ${problems.join(' ; ')}`).join(' | ')
  return {
    reason:
      `⚠ Fermeture de ticket au commit sans SOLDE conforme : ${detail}. Écrire (ou compléter) le fichier ` +
      `avec une ligne "VERIFIE: <ce que l'orchestrateur a concrètement vérifié, ≥${MIN_VERIFIE_LEN} caractères>", ` +
      `une section "## Restes" ("RAS" seul, ou des items "- <reste signalé par l'agent> -> <#N nouveau ticket ` +
      `(un SEUL par fermeture) | corrigé dans ce commit (<fichier>:<ligne>) | corrigé par <sha> ` +
      `<fichier>:<ligne> | RAS : justification | inventaire #<épic> : <état>>"), au plus une ligne ` +
      `"NATURE: ${grammaireDesNatures()}" en tête de ligne (absente = corrigé ; elle fait le state_reason ` +
      `de la fermeture : caduc exige une section "## Sonde" — bloc de la commande, bloc de sa sortie, sha ` +
      `ancêtre de HEAD —, décidé une section "## Décision" dont une ligne cite « … » avec sa date AAAA-MM-JJ), une section ` +
      `"## Réfutation" (ligne "verdict: ` +
      `CONFIRMÉ|PARTIEL|RÉFUTÉ", ≥${MIN_REFUTATION_LEN} caractères — qui a attaqué quoi sur le diff/DoD), et ` +
      `la date du jour (demande 2026-07-14), puis le STAGER (\`git add .claude/soldes/<N>.md\`) : la preuve ` +
      `citée par le message de commit vit dans git.`,
  }
}

/** Lecture du solde d'un ticket sur le DISQUE de `dir` — le répertoire où le commit s'exécute, comme
 *  tout ce que cette porte lit. `null` si absent/illisible. */
export function readSoldeFile(n, dir = process.cwd()) {
  try { return readFileSync(join(dir, cheminDuSolde(n)), 'utf8') } catch { return null }
}

/** Le chemin du solde du ticket `n`, relatif à la racine du dépôt. */
const cheminDuSolde = (n) => `.claude/soldes/${n}.md`

/** Le solde de chacun des tickets `ns` que `commit` (`diffDuCommit`) EMPORTE, dans leur ordre, `null`
 *  s'il n'y est pas : UNE lecture pour tous (`contenus`). @param {number[]} ns @returns {(string | null)[]} */
export function soldesEmportes(commit, ns) {
  const lus = commit.contenus(ns.map(cheminDuSolde))
  return ns.map((n) => lus.get(cheminDuSolde(n)) ?? null)
}

// ── Porte du TICKET (option retenue par l'utilisateur le 2026-09-11) ──────────────────────────────
// Le ticket est l'unité de travail : un commit qui touche `src` ou `scripts` cite au moins un ticket.
// Le critère de SUBSTANCE (`estCheminDeSubstance`) est le même pour la porte et pour le pré-filtre des
// commentaires de dette (`fichiersCitantTickets`) : une seule définition. La grammaire des références
// est celle de `scripts/guards/lib/fermetures.mjs` (`numerosCites`), jamais une regex de plus.
const MAX_FICHIERS_NOMMES = 3

/** Les dossiers qui font la SUBSTANCE d'un commit : le moteur et l'outillage. */
const DOSSIERS_DE_SUBSTANCE = ['src', 'scripts']

/** Ce chemin est-il de SUBSTANCE ? PUR — le pendant par-chemin de `DOSSIERS_DE_SUBSTANCE`, pour qui
 *  tient déjà la liste des fichiers (le contenu qu'un commit EMPORTE) plutôt qu'un pathspec git. */
function estCheminDeSubstance(chemin) {
  const p = String(chemin ?? '').replace(/\\/g, '/')
  return DOSSIERS_DE_SUBSTANCE.some((d) => p === d || p.startsWith(`${d}/`))
}

/**
 * Décision de la porte du ticket (PURE, testable). `fichiersEmportes` = les chemins que le commit
 * emporte (`analyzeDiffDuCommit(...).fichiers`). Un commit de substance dont le message ne cite aucun
 * ticket (`numerosCites`) est refusé, ses premiers fichiers de substance nommés.
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluatePorteDuTicket({ message, commentaire, fichiersEmportes = [] }) {
  const substance = fichiersEmportes.filter(estCheminDeSubstance)
  if (substance.length === 0) return null
  if (numerosCites(lectureDeLaPorte({ message, commentaire }).satisfactions).length > 0) return null
  const nommes = substance.slice(0, MAX_FICHIERS_NOMMES).join(', ')
  const reste = substance.length > MAX_FICHIERS_NOMMES ? ` (+${substance.length - MAX_FICHIERS_NOMMES})` : ''
  return {
    reason:
      `⚠ Commit de SUBSTANCE sans ticket : ${nommes}${reste}. Ajouter \`refs #N\` au message (ou `
      + '`corrige #N` à la fermeture, avec son solde). '
      + 'Option retenue par l’utilisateur le 2026-09-11 (verbatim) — « Tout commit de substance cite un '
      + 'ticket — un commit qui touche src/ ou scripts/ sans `refs #N`/`corrige #N` est refusé par le '
      + 'pre-commit ; le ticket est l’unité de travail, même pour un fix d’une ligne. »',
  }
}

// ── Anti-esquive (extension 2026-07-14) ────────────────────────────────────────────────
// Un commit `ref #N`/`refs #N` (rattaché SANS fermer), qui touche `src/**` pour un diff STAGED de
// substance, doit lui aussi porter sa réfutation — sinon la fermeture reste le SEUL chemin regardé
// et « ref #N » devient l'esquive mécanique. Le mécanisme REFUTATION porte sur le ticket
// EXPLICITEMENT rattaché ; le commit de substance qui n'en cite AUCUN est refusé en amont par
// `evaluatePorteDuTicket`.
const REFUTATION_LINE_RE = TRAILERS.REFUTATION.ligne
const MIN_REFUTATION_LINE_LEN = TRAILERS.REFUTATION.min

/** `true` si le message porte une ligne "REFUTATION: <...>" d'au moins `MIN_REFUTATION_LINE_LEN`
 *  caractères après le mot-clef. */
function hasInlineRefutation(texte) {
  const m = REFUTATION_LINE_RE.exec(texte)
  return !!m && m[1].trim().length >= MIN_REFUTATION_LINE_LEN
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` : seule la section "## Réfutation" (même gabarit
 *  que les soldes de fermeture) est exigée — pas de VERIFIE/Restes, ce n'est pas une fermeture. */
export function validateRefFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkRefutationSection(content)
  return { ok: problems.length === 0, problems }
}

/**
 * Décision anti-esquive (PURE, testable). `stagedTouchesSrc`/`stagedTotalLines` = état du diff
 * STAGED (`git diff --cached`), injectés par `decisionsDuCommit`. `readRefFile(n)` lit
 * `.claude/soldes/ref-<n>.md` (ou `null`). `fusionEnCours` (`MERGE_HEAD`, `diffDuCommit(…).enFusion()`) :
 * silence — sauver une fusion n'est pas une livraison (#2328 A1).
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluateAntiEsquive({ message, commentaire, fusionEnCours = false, stagedTouchesSrc, stagedTotalLines, readRefFile = () => null }) {
  const lu = lectureDeLaPorte({ message, commentaire })
  if (fusionEnCours) return null
  if (!stagedTouchesSrc) return null
  if (typeof stagedTotalLines === 'number' && stagedTotalLines < SUBSTANTIVE_MIN_LINES) return null

  // Une fermeture est déjà couverte par `evaluate()` (solde complet, réfutation comprise) — pas de
  // double exigence ici.
  if (lu.fermes().length > 0) return null

  if (hasInlineRefutation(lu.satisfactions)) return null

  const refIssues = lu.refs()
  // Aucun ticket rattaché (ni fermeture, ni `ref #N`) : hors du déclencheur — l'absence de ticket se
  // juge sur la SUBSTANCE, et c'est `evaluatePorteDuTicket` qui la juge.
  if (refIssues.length === 0) return null

  const failures = []
  for (const n of refIssues) {
    const { ok, problems } = validateRefFile(readRefFile(n))
    if (!ok) failures.push({ n, problems })
  }
  if (failures.length === 0) return null
  const detail = failures.map(({ n, problems }) => `#${n} (.claude/soldes/ref-${n}.md) — ${problems.join(' ; ')}`).join(' | ')
  return {
    reason:
      `⚠ Commit "ref #N" (src/** touché, ≥${SUBSTANTIVE_MIN_LINES} lignes de diff staged) sans réfutation : ${detail}. ` +
      `Ajouter une ligne "REFUTATION: <qui a attaqué quoi, ≥${MIN_REFUTATION_LINE_LEN} caractères>" dans le ` +
      `message de commit, ou écrire .claude/soldes/ref-<N>.md avec une section "## Réfutation" conforme ` +
      `(verdict + synthèse — extension anti-esquive 2026-07-14).`,
  }
}

// ── JUGE adversarial (extension du mécanisme REFUTATION, générale à tout domaine) ──────────────────
// EXACTEMENT le même déclencheur qu'`evaluateAntiEsquive` (un `ref #N` rattaché sans fermer,
// jamais un commit sans ticket du tout, jamais une fermeture — déjà couverte par sa propre section
// "## Réfutation" à verdict) : un `ref #N` qui touche `src/**` en substance doit en plus porter la
// preuve qu'un agent juge adversarial est passé sur le diff. Si le diff touche `src/ui/**`, une
// preuve DISTINCTE de jugement sur captures (JUGE-VISION) est exigée en plus.
const JUGE_LINE_RE = TRAILERS.JUGE.ligne
const MIN_JUGE_LINE_LEN = TRAILERS.JUGE.min
const JUGE_VISION_LINE_RE = TRAILERS['JUGE-VISION'].ligne
const MIN_JUGE_VISION_LINE_LEN = TRAILERS['JUGE-VISION'].min

/** `true` si le message porte une ligne "JUGE: <...>" d'au moins `MIN_JUGE_LINE_LEN` caractères
 *  après le mot-clef (n'accroche jamais "JUGE-VISION:", le tiret casse le motif `JUGE\s*:`). */
function hasInlineJuge(texte) {
  const m = JUGE_LINE_RE.exec(texte)
  return !!m && m[1].trim().length >= MIN_JUGE_LINE_LEN
}

/** `true` si le message porte une ligne "JUGE-VISION: <...>" d'au moins `MIN_JUGE_VISION_LINE_LEN`
 *  caractères après le mot-clef. */
function hasInlineJugeVision(texte) {
  const m = JUGE_VISION_LINE_RE.exec(texte)
  return !!m && m[1].trim().length >= MIN_JUGE_VISION_LINE_LEN
}

/** La section du trailer `nom` d'un solde (`corpsDuTrailer`, la grammaire de la publication) : présence
 *  + longueur minimale du corps. */
function checkNamedSection(content, nom) {
  const { section: label, min } = TRAILERS[nom]
  const body = corpsDuTrailer(content, nom)
  if (body === null) return { problems: [`section "## ${label}" absente`] }
  return { problems: body.length < min ? [`"## ${label}" trop maigre (${body.length} car., ${min} requis)`] : [] }
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` pour sa section "## Juge" (symétrie exacte de
 *  `validateRefFile`, mécanisme distinct — n'exige pas de "## Réfutation"). */
export function validateJugeFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkNamedSection(content, 'JUGE')
  return { ok: problems.length === 0, problems }
}

/** Valide un fichier `.claude/soldes/ref-<N>.md` pour sa section "## Juge-Vision". */
export function validateJugeVisionFile(content) {
  if (!content) return { ok: false, problems: ['fichier absent'] }
  const { problems } = checkNamedSection(content, 'JUGE-VISION')
  return { ok: problems.length === 0, problems }
}

/**
 * Décision JUGE (PURE, testable). Même périmètre de déclenchement qu'`evaluateAntiEsquive` (silence
 * sur les fermetures, déjà couvertes par leur propre solde ; silence aussi sur un commit sans AUCUN
 * ticket rattaché — #591). `stagedTouchesUi` = le diff staged touche `src/ui/**` (tests compris).
 * `fusionEnCours` : silence, comme `evaluateAntiEsquive` (#2328 A1).
 * @returns {{ reason: string } | null} — non-null = `deny`, null = silence.
 */
export function evaluateJuge({ message, commentaire, fusionEnCours = false, stagedTouchesSrc, stagedTotalLines, stagedTouchesUi, readRefFile = () => null }) {
  const lu = lectureDeLaPorte({ message, commentaire })
  if (fusionEnCours) return null
  if (!stagedTouchesSrc) return null
  if (typeof stagedTotalLines === 'number' && stagedTotalLines < SUBSTANTIVE_MIN_LINES) return null
  if (lu.fermes().length > 0) return null

  const refIssues = lu.refs()
  // Aucun ticket rattaché (ni fermeture, ni `ref #N`) : hors du déclencheur — l'absence de ticket se
  // juge sur la SUBSTANCE, et c'est `evaluatePorteDuTicket` qui la juge.
  if (refIssues.length === 0) return null

  const needsVision = !!stagedTouchesUi

  const jugeSatisfied =
    hasInlineJuge(lu.satisfactions) ||
    (refIssues.length > 0 && refIssues.every((n) => validateJugeFile(readRefFile(n)).ok))
  const visionSatisfied =
    !needsVision ||
    hasInlineJugeVision(lu.satisfactions) ||
    (refIssues.length > 0 && refIssues.every((n) => validateJugeVisionFile(readRefFile(n)).ok))

  if (jugeSatisfied && visionSatisfied) return null

  const missing = []
  if (!jugeSatisfied) {
    missing.push(
      `ligne "JUGE: <qui a jugé quoi, verdict — ≥${MIN_JUGE_LINE_LEN} caractères>" (ou section ` +
      `"## Juge" dans .claude/soldes/ref-<N>.md)`,
    )
  }
  if (!visionSatisfied) {
    missing.push(
      `ligne "JUGE-VISION: <captures jugées — ≥${MIN_JUGE_VISION_LINE_LEN} caractères>" (ou section ` +
      `"## Juge-Vision" dans .claude/soldes/ref-<N>.md) — un ÉCRAN est touché (src/ui/** ou src/gameIso/**)`,
    )
  }

  return {
    reason:
      `⚠ Commit touchant src/** (≥${SUBSTANTIVE_MIN_LINES} lignes de diff staged) sans juge ` +
      `adversarial : ajouter ${missing.join(' et ')} dans le message de commit (extension juge de la ` +
      `porte du commit).`,
  }
}

/** Lecture d'un fichier de réfutation `ref-<n>` sur le DISQUE de `dir` — le répertoire où le commit
 *  s'exécute. `null` si absent/illisible. */
export function readRefFile(n, dir = process.cwd()) {
  try { return readFileSync(join(dir, '.claude/soldes', `ref-${n}.md`), 'utf8') } catch { return null }
}


// ── Registres PORTEURS de ticket (prévention #434/#487, généralisée #1825) ────────────────────────
// Certains registres du dépôt portent, entrée par entrée, la DETTE que doit un ticket : le manifeste
// éditorial porte la dette d'IMPLÉMENTATION d'un topic (`ticket: "#N"` / `bloque: "…#N…"`), le
// registre des domaines de l'Atlas porte la dette d'EXTRACTION d'une aire. Fermer #N en le laissant
// dans l'un d'eux laisse une marque « dette : #N » dans ce que ces registres alimentent, et l'issue
// fermée à tort : la marque se retire dans le MÊME commit que la fermeture.
//
// La LISTE de ces registres est de la DONNÉE (`scripts/hooks/registres-porteurs.json`) : ce hook n'en
// NOMME aucun, il boucle et cherche `#N` dans le contenu EMPORTÉ de chacun. Un registre porteur de
// plus = une ligne de donnée, zéro ligne ici. Chaque entrée porte son `chemin` et, quand le registre
// alimente un artefact généré, la commande `apres` qui le régénère.
// Pourquoi un SCANNER D'OCTETS et pas les lecteurs typés de chaque registre : ce qui se juge est le
// contenu que le commit EMPORTE (`commit.contenu`, l'index du commit), pas le
// disque de travail que ces lecteurs lisent — deux sources différentes, deux verdicts différents.
// La LISTE se lit par CETTE MÊME couture, et AU MOMENT de l'évaluation — jamais à l'import : un
// hook ne lève jamais (une lecture à l'import rendrait la porte ENTIÈRE muette sur une liste cassée), et
// la liste jugée est celle du COMMIT, comme les registres qu'elle nomme — pas celle d'un autre arbre.
// Liste illisible ou absente : seule l'évaluation de FERMETURE refuse, en nommant la cause (on ne
// peut pas prouver qu'aucun registre ne porte le ticket) ; toutes les autres portes restent intactes.
const LISTE_DES_PORTEURS = 'scripts/hooks/registres-porteurs.json'
const TICKET_RE = /#(\d+)/g

/** La liste des registres porteurs telle que le commit l'EMPORTE. LÈVE en nommant la cause —
 *  `evaluateRegistresPorteurs` la rattrape et la transforme en refus de FERMETURE. */
export function registresPorteursDuCommit(lireRegistreEmporte) {
  const brut = lireRegistreEmporte(LISTE_DES_PORTEURS)
  if (typeof brut !== 'string' || !brut.trim()) throw new Error('absente du contenu emporté par le commit')
  let liste
  try {
    liste = JSON.parse(brut)
  } catch (e) {
    throw new Error(`JSON illisible — ${String(e.message ?? e)}`, { cause: e })
  }
  if (!Array.isArray(liste)) throw new Error('la liste n’est pas un tableau')
  const fautives = liste.filter((r) => !r || typeof r.chemin !== 'string' || !r.chemin)
  if (fautives.length) throw new Error(`${fautives.length} entrée(s) sans \`chemin\``)
  return liste
}

/** Tickets `#N` référencés par le CONTENU d'un registre porteur. `null`/vide → ensemble vide. */
export function ticketsDuRegistre(contenu) {
  const nums = new Set()
  if (!contenu) return nums
  for (const m of contenu.matchAll(TICKET_RE)) nums.add(Number(m[1]))
  return nums
}

/**
 * Décision « fermeture d'un ticket encore porté par un registre » (PURE, testable).
 * `lireRegistreEmporte(chemin)` renvoie la version que le commit EMPORTE (ou `null`) — la LISTE des
 * registres porteurs se lit par cette même couture, ici, jamais à l'import.
 * Le refus NOMME le fichier qui porte encore `#N` — sans quoi il faudrait deviner lequel.
 * @param {{ message: string, commentaire?: string, lireRegistreEmporte?: (chemin: string) => string|null }} entree
 * @returns {{ reason: string } | null}
 */
export function evaluateRegistresPorteurs({ message, commentaire, lireRegistreEmporte = () => null }) {
  const issues = lectureDeLaPorte({ message, commentaire }).fermes()
  if (issues.length === 0) return null
  let registres
  try {
    registres = registresPorteursDuCommit(lireRegistreEmporte)
  } catch (e) {
    // On ne peut pas PROUVER qu'aucun registre ne porte ces tickets : la fermeture se refuse, en
    // nommant la cause. Le reste de la porte ne dépend pas de cette liste et reste intact.
    return {
      reason:
        `⚠ Fermeture de ${issues.map((n) => `#${n}`).join(', ')} impossible à juger : la liste des `
        + `registres PORTEURS de ticket (\`${LISTE_DES_PORTEURS}\`) est inexploitable — ${String(e.message ?? e)}. `
        + `Sans elle, rien ne prouve qu'aucun registre ne porte encore ce(s) ticket(s) : rétablir la `
        + `liste dans le commit, puis re-committer.`,
    }
  }
  const retenus = []
  for (const registre of registres) {
    const tickets = ticketsDuRegistre(lireRegistreEmporte(registre.chemin))
    const stuck = issues.filter((n) => tickets.has(n))
    if (stuck.length) retenus.push({ registre, stuck })
  }
  if (!retenus.length) return null
  const detail = retenus
    .map(({ registre, stuck }) =>
      `${stuck.map((n) => `#${n}`).join(', ')} dans ${registre.chemin}`
      + (registre.apres ? ` (puis \`${registre.apres}\`)` : ''))
    .join(' ; ')
  return {
    reason:
      `⚠ Fermeture de ${[...new Set(retenus.flatMap((r) => r.stuck))].sort((a, b) => a - b).map((n) => `#${n}`).join(', ')} `
      + `alors que ce(s) ticket(s) figure(nt) encore dans un registre PORTEUR (contenu emporté par le `
      + `commit) : ${detail}. La marque se retire dans le MÊME commit que la fermeture — retirer `
      + `l'entrée, rejouer la régénération quand il y en a une, puis re-committer.`,
  }
}

/** Analyse du `--numstat` du diff que le commit va produire (`diffDuCommit(...).numstat()`, entrées de
 *  `ceQuiChange`) : touche-t-il `src/**` ? un ÉCRAN (`estFichierEcran`, rendu par `touchesUi`) ?
 *  combien de lignes (insertions+suppressions) au total ? Fichiers binaires (`plus`/`moins` nuls)
 *  comptés 0 ligne mais peuvent toucher `src/**`. Aucune entrée → aucune touche, 0 ligne ; une
 *  PANNE de lecture n'est pas « aucune entrée » : `refusDesPannes` la refuse au rendu.
 *
 * AUCUN filtrage de chemins ici (#591 défaut 1) : le lot est celui de l'index que git a préparé.
 *
 * `fichiers` porte les DEUX bouts d'un renommage (`chemins` de l'entrée) : c'est par eux que la porte
 * des stocks voit le porteur source ET le porteur cible, qu'un solde prouve sa correction au NOUVEAU chemin, et qu'un `.tsx` renommé reste un ÉCRAN (#1720).
 * `totalLines` compte le renommage replié : c'est le VOLUME écrit, et un renommage n'écrit rien.
 * `ecranParInsertion` (l'apport d'une fusion en cours, #2328 A5) : un écran ne compte que s'il y gagne
 * des lignes (`plus > 0`).
 * @param {readonly { plus: number | null, moins: number | null, chemins: string[] }[]} [entrees]
 * @param {{ ecranParInsertion?: boolean }} [options] */
export function analyzeDiffDuCommit(entrees = [], { ecranParInsertion = false } = {}) {
  const totalLines = entrees.reduce((n, e) => n + (e.plus ?? 0) + (e.moins ?? 0), 0)
  const fichiers = entrees.flatMap((e) => e.chemins)
  return {
    touchesSrc: fichiers.some((f) => /^src\//.test(f)),
    touchesUi: entrees.some((e) => (!ecranParInsertion || e.plus > 0) && e.chemins.some(estFichierEcran)),
    totalLines,
    fichiers,
  }
}

/**
 * Le refus UNIQUE de ce que git n'a pas lu : les `pannes` de lecture de l'appel, chacune nommée une
 * fois, en UN refus — `null` s'il n'y en a aucune. La CAUSE se nomme telle qu'elle est : un répertoire
 * qui existe mais n'est gouverné par aucun dépôt (`horsDepot`) n'est ni un git absent ni un cwd
 * manquant, et le renvoyer vers « un arbre où git répond » désignait la mauvaise correction (#1729).
 * @param {readonly string[]} pannes @param {{ cwd?: string|null, horsDepot?: boolean }} [ou] répertoire où la lecture a été tentée
 * @returns {{ reason: string } | null}
 */
export function refusDesPannes(pannes, { cwd = null, horsDepot = false } = {}) {
  if (!pannes.length) return null
  const cause = [horsDepot ? `hors dépôt : ${cwd}` : null, ...new Set(pannes)].filter(Boolean).join(' ; ')
  const geste = horsDepot
    ? 'Geste : rejouer depuis un arbre git (ce répertoire n’est gouverné par aucun dépôt).'
    : 'Geste : rejouer le commit depuis un arbre où git répond.'
  return { reason: `⛔ lecture git indisponible : ${cause} — la porte ne juge pas ce que git n'a pas lu. ${geste}` }
}

// ── Le contenu que le commit EMPORTE ──────────────────────────────────────────────────────────────

/**
 * Lectures de ce que le commit EMPORTE dans `dir` : l'INDEX que git a préparé pour lui, `-a`, `-i` et
 * `-- <chemins>` compris (`GIT_INDEX_FILE`, hérité par `depotDe` sans `env`). `numstat()` (les champs du
 * `--numstat`, `analyzeDiffDuCommit`), `diff(chemins)` (le `-U0` `--no-renames` de ces chemins, de tout le
 * commit sans argument, comme la plage : `croissancesDeLaPlage`), `contenu(f)`/`lirePreImage(f)` (le fichier APRÈS le commit, et dans sa BASE),
 * `contenus(rels)`/`preImages(rels)` puis `images(chemins)` (les mêmes, lus par lot : `lireEnLot`).
 * Diffs, chemins et renommages lus par `ceQuiChange` (plomberie), contre `base()` : l'image de HEAD
 * (`imageDeHead`), l'arbre vide dans un dépôt sans premier commit ; sous une fusion EN COURS
 * (`enFusion()`), sa fusion automatique : le commit se lit par son APPORT PROPRE (`apport()`,
 * `apportDeLaFusionEnCours`, une lecture), jamais par ce que ses parents fusionnés apportent (#2328 A2).
 * Une fusion que git ne rejoue pas LÈVE `GitIndisponible` à la lecture de `base()`. `depot` : celui de
 * `dir` par défaut, ses pannes dans `pannes`.
 * @param {string} [dir]
 * @param {{ pannes?: string[], depot?: import('../guards/lib/gitPorte.mjs').Depot }} [options]
 */
export function diffDuCommit(dir = process.cwd(), { pannes = [], depot = depotAuxPannes(dir, pannes) } = {}) {
  let head
  /** Le sha de HEAD, lu une fois ; `null` sans premier commit (ou en panne, confiée à `pannes`). */
  const shaDeHead = () => (head === undefined ? (head = shaDe(depot, 'HEAD')) : head)
  const aHead = () => shaDeHead() !== null
  // Sous `MERGE_HEAD`, le commit à venir est une FUSION de HEAD et de `fusionnesEnCours`.
  let fusionnes
  const enFusion = () => (fusionnes ??= aHead() ? fusionnesEnCours(depot) : []).length > 0
  let apportLu
  const apport = () => (apportLu ??= enFusion() ? apportDeLaFusionEnCours(depot, INDEX, fusionnes) : null)
  let imageDeBase
  const base = () => (imageDeBase ??= enFusion() ? apport().change.base : imageDeHead(depot))
  /** Ce que l'index change contre `avant` (la base du commit par défaut). */
  const vers = (avant = base()) => ceQuiChange(depot, avant, INDEX)
  const sourceA = (arbre) => sourceGit({ cwd: dir, arbre, depot })
  const sourceDeLaBase = () => sourceA(base())
  let source = null
  const sourceDuCommit = () => (source ??= sourceA(INDEX))
  // La fusion en cours se lit aussi comme la plage lit une fusion (`lecturesDeFusion`), son image étant
  // ce que le commit emporte.
  let enCours
  const fusion = () => {
    if (enCours !== undefined) return enCours
    if (!enFusion()) return (enCours = null)
    try {
      const { parents, change } = apport()
      const lus = lecturesDeFusion(depot, { apres: INDEX, parents, fait: change, lireDepuis: vers })
      return (enCours = { ...lus, entree: entreeDeFusion(depot, lus.fusion, (f) => sourceDuCommit().lire(f)) })
    } catch (e) {
      if (!(e instanceof GitIndisponible)) throw e
      pannes.push(refusDeGit(e))
      return (enCours = null)
    }
  }
  /** Les textes de `rels` que le commit EMPORTE, en un lot. */
  const contenus = (rels) => sourceDuCommit().lireTout(rels)
  /** Les textes de `rels` dans sa BASE, en un lot ; aucun sans premier commit. */
  const preImages = (rels) => (aHead() ? sourceDeLaBase().lireTout(rels) : new Map())
  /** Les entrées de `chemins` dans HEAD, dans l'index du dépôt et dans ce que le commit emporte, quand
   *  git lui a préparé un index EMPRUNTÉ (`indexEmprunte`) ; `null` sous l'index du dépôt. */
  const stages = (chemins) => (indexEmprunte(depot) ? {
    tete: entreesDe(depot, imageDeHead(depot), chemins),
    depot: entreesDe(depot, INDEX, chemins, { index: INDEX_DU_DEPOT }),
    emporte: entreesDe(depot, INDEX, chemins),
  } : null)
  return {
    base,
    stages,
    numstat: () => vers().numstat([]),
    diff: (chemins) => (chemins?.length === 0 ? '' : vers().diff(chemins ?? [])),
    contenu: (f) => sourceDuCommit().lire(f),
    lirePreImage: (f) => (aHead() ? sourceDeLaBase().lire(f) : null),
    contenus,
    preImages,
    images: (chemins) => {
      const post = contenus(chemins)
      const pre = preImages(chemins)
      return {
        lirePostImage: (f) => (post.has(f) ? post.get(f) : sourceDuCommit().lire(f)),
        lirePreImage: (f) => (pre.has(f) ? pre.get(f) : aHead() ? sourceDeLaBase().lire(f) : null),
      }
    },
    renommages: () => new Map(vers().renommages([])),
    enFusion,
    apport,
    fusion,
    deplaceLaFrontiereCss: (chemins) => {
      const f = fusion()
      return deplaceLaFrontiere(f
        ? { chemins: f.fait.chemins(), nesOuMorts: () => f.fait.chemins('AD'), base: sourceA(f.fusion.commune), commit: sourceDuCommit(), racine: dir }
        : { chemins, nesOuMorts: () => vers().chemins('AD', []), base: sourceDeLaBase(), commit: sourceDuCommit(), racine: dir })
    },
    cotesCss: () => {
      const f = fusion()
      const cote = (s) => coteCss(s, { racine: dir })
      return f
        ? { base: cote(sourceA(f.fusion.commune)), commit: cote(sourceDuCommit()), parents: f.fusion.parents.map((p) => cote(sourceA(p))) }
        : { base: cote(sourceDeLaBase()), commit: cote(sourceDuCommit()) }
    },
  }
}

/** Fichiers de l'INDEX qui citent un des `numeros` (pré-filtre `git grep --cached -l`) : le scan de
 *  commentaires ne s'applique qu'à eux, jamais à l'arbre entier. */
export function fichiersCitantTickets(numeros, dir = process.cwd(), { pannes = [] } = {}) {
  if (numeros.length === 0) return []
  const motif = `#(${numeros.join('|')})([^0-9]|$)`
  return fichiersDuGrep(depotAuxPannes(dir, pannes), ['--cached'], motif, DOSSIERS_DE_SUBSTANCE)
}

/**
 * Le verdict PUR, ou `null` quand git n'a pas pu lire : sa raison (`GitIndisponible`) va à `pannes`,
 * que `refusDesPannes` refuse au rendu, en UN refus avec les autres pannes de l'appel. Une lecture
 * indisponible n'est pas un « non » : la conclure ferait refuser un solde juste (ou passer un solde
 * faux) sur rien. Toute autre erreur remonte.
 * @param {() => ({ reason: string } | null)} juger @param {string[]} pannes
 */
export function jugerOuConfier(juger, pannes) {
  try {
    return juger()
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    pannes.push(refusDeGit(e))
    return null
  }
}

/**
 * L'HISTOIRE que lit « corrigé par <sha> <fichier>:<ligne> » (`problemesCorrigePar`) pour les `shas`
 * cités, tous annoncés d'avance (`shasCitesDuSolde`) : le commit est-il dans HEAD (`histoire`,
 * `histoireDeHead`), quels chemins touche-t-il, quelles lignes de `fichier` — lus sur CE QUE FAIT le
 * commit (`ceQueFontLesCommits`), dans `depot`. Chaque lecture porte sur TOUS les shas cités à la
 * fois, au plus une fois : un sha cité de plus ne lance aucun processus. Une histoire vit le temps
 * d'UNE évaluation : aucun cache ne survit d'un appel du hook au suivant. Le diff est celui d'UN SHA
 * DÉJÀ POSÉ, à ne pas confondre avec `diffDuCommit`, qui lit ce que la commande EN COURS va emporter.
 * Un sha hors de HEAD n'a ni chemins ni lignes (`null`) ; sous `depotAuxPannes`, une panne de git rend
 * `[]`, et `refusDesPannes` la refuse au rendu.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot @param {readonly string[]} shas
 * @param {{ histoire?: ReturnType<typeof histoireDeHead> }} [options] l'histoire de HEAD de l'évaluation
 * @throws {Error} une question sur un sha que `shas` n'annonce pas.
 */
export function histoireDesCitations(depot, shas, { histoire = histoireDeHead(depot) } = {}) {
  const annonces = [...new Set(shas)]
  let lus = null
  const lire = () => {
    if (lus) return lus
    const commits = histoire.commits(annonces)
    lus = { parSha: new Map(annonces.map((sha, i) => [sha, commits[i]])), fait: ceQueFontLesCommits(depot, commits.filter(Boolean)) }
    return lus
  }
  /** Le commit du graphe de HEAD que nomme `sha`, `null` hors de HEAD. */
  const commitDe = (sha) => {
    const { parSha } = lire()
    if (!parSha.has(sha)) throw new Error(`histoireDesCitations : « ${sha} » n'est aucun des shas annoncés (${annonces.join(', ')})`)
    return parSha.get(sha)
  }
  return {
    commitEstAncetre: (sha) => commitDe(sha) !== null,
    fichiersDuCommit: (sha) => {
      const commit = commitDe(sha)
      return commit && lire().fait.chemins().get(commit.sha)
    },
    lignesDuCommit: (sha, fichier) => {
      const commit = commitDe(sha)
      return commit && lignesDeHunks(lire().fait.patchs().get(commit.sha).get(fichier) ?? '')
    },
  }
}

/** Les shas que cite un solde par « corrigé par <sha> <fichier>:<ligne> » (`CORRIGE_PAR_RE`, la lecture
 *  de `checkRestesSection`) et par la « ## Sonde » d'un solde `caduc` (`shasDeLaSonde`, la lecture de
 *  `checkNature`). PUR. @param {string | null} content @returns {string[]} */
export function shasCitesDuSolde(content) {
  if (!content) return []
  return [...restesItems(content).map((l) => CORRIGE_PAR_RE.exec(l)?.[1]).filter(Boolean), ...shasDeLaSonde(content)]
}

/** Date de dernière écriture la plus RÉCENTE parmi `fichiers` (ms, `0` si aucune lisible). */
export function mtimeMaxDe(fichiers, racine = process.cwd()) {
  let max = 0
  for (const f of fichiers) {
    try { max = Math.max(max, statSync(join(racine, f)).mtimeMs) } catch { /* fichier supprimé */ }
  }
  return max
}

// ── Stock nominatif qui naît ou grandit ───────────────────────────────────────────────────
// Un stock nominatif est une DETTE vers zéro (`scripts/guards/lib/stock.mjs`) ; l'append y est
// toujours le chemin le plus court vers une CI verte. La porte le rend VISIBLE au commit : la
// croissance passe si, et seulement si, le message la DIT.

/**
 * Décision « un stock nominatif a grossi sans que le message le dise ». `diff` = diff unifié de ce que
 * le commit emporte (les fichiers porteurs suffisent), `images` = les lecteurs de pré/post-image qui
 * décident la PORTÉE DE MODULE d'une entrée ; sous une fusion en cours, `fusion` (`entreeDeFusion`)
 * remplace les deux : son APPORT est jugé (`bilanDuCommit`).
 * @returns {{ reason: string } | null}
 */
export function evaluateStocksQuiGrandissent({ message, commentaire, diff, images, fusion = null }) {
  const lu = lectureDeLaPorte({ message, commentaire })
  if (!fusion && !diff) return null
  const restantes = nonCouvertesDuBilan(bilanDuCommit({ diff, images, fusion }), lu.satisfactions)
  return restantes.length ? { reason: raisonDeRefus(restantes) } : null
}

/**
 * Décision « un module FRANCHIT la frontière CSS sans que le message le dise, ou le message déclare un
 * franchissement qui n'a pas lieu » (`RECLASSEMENT:`, #1806 D2″). `cotes()` rend les côtés base et
 * commit (`coteCss`) ; ne se prononce que sur un commit dont le message porte une ligne ou qui peut
 * déplacer la frontière (`deplace()`, `deplaceLaFrontiere`). Une lecture qui lève est un refus NOMMÉ,
 * jamais un passage muet.
 * @param {{ message: string, commentaire?: string, deplace: () => boolean, cotes: () => { base: object, commit: object } }} p
 * @returns {{ reason: string } | null}
 */
export function evaluateReclassementsCss({ message, commentaire, deplace, cotes }) {
  const lu = lectureDeLaPorte({ message, commentaire })
  let ecarts
  try {
    if (!lignesDeReclassement(lu.satisfactions).length && !deplace()) return null
    ecarts = reclassementsNonDeclares({ message: lu.satisfactions }, cotes())
  } catch (e) {
    return { reason: `⛔ RECLASSEMENT CSS injugeable : ${e.message}` }
  }
  return ecarts.length ? { reason: raisonDeRefusDeReclassement([{ ecarts }]) } : null
}

/**
 * Le refus d'un commit qui fait GRANDIR le contexte permanent au-delà du plafond de sa pré-image sans
 * le DIRE (`CLIQUET:`). La mesure vient de ce que le commit EMPORTE, la référence et le plafond de sa
 * pré-image : c'est la même discipline de lecture que `evaluateStocksQuiGrandissent`.
 * @returns {{ reason: string } | null}
 */
export function evaluateBudgetContexte({ message, commentaire, mesure, reference }) {
  return refusDeBudget({ mesure, reference, message: lectureDeLaPorte({ message, commentaire }).satisfactions })
}

/**
 * Le listeur d'entrées DIRECTES d'une IMAGE git (`listerImage` puis `enfantsDirects`, `gitPorte.mjs`)
 * qu'attend `mesurerBudget` : `INDEX` pour ce que le commit emporte, sa BASE (`diffDuCommit(…).base()`,
 * `imageDeHead`) pour sa pré-image.
 * @param {string} arbre @param {string} dir @returns {(dossier: string) => string[]}
 */
export function listeurDuBudget(arbre, dir, { pannes = [] } = {}) {
  const depot = depotAuxPannes(dir, pannes)
  return (dossier) => enfantsDirects(listerImage(depot, arbre, dossier), dossier)
}

// ── Le stage écrasé par le commit ─────────────────────────────────────────────────────────────────

/** Deux entrées d'image (`entreesDe`) désignent-elles le même contenu ? Absente = absente. PURE. */
const memeEntree = (a, b) => a?.sha === b?.sha && a?.mode === b?.mode

/**
 * Décision « le commit écrase un stage » : un chemin dont l'index du DÉPÔT porte une modification
 * stagée (`depot` ≠ `tete`) et dont le commit emporte un autre contenu (`emporte` ≠ `depot`) — `git
 * commit -a`, `-i` ou `-- <chemins>` prennent l'arbre de travail de ce chemin, le stage par hunk est
 * annulé et le non-stagé emporté (incidents acf2a447, bb824bafb). `stages` : `diffDuCommit().stages`,
 * `null` sous l'index du dépôt. PURE.
 * @param {{ stages: { tete: Map<string, { mode: string, sha: string }>, depot: Map<string, { mode: string, sha: string }>, emporte: Map<string, { mode: string, sha: string }> } | null }} p
 * @returns {{ reason: string } | null}
 */
export function evaluateHunksEmportes({ stages }) {
  if (!stages) return null
  const { tete, depot, emporte } = stages
  const ecrases = [...new Set([...tete.keys(), ...depot.keys(), ...emporte.keys()])].sort()
    .filter((f) => !memeEntree(depot.get(f), tete.get(f)) && !memeEntree(emporte.get(f), depot.get(f)))
  if (!ecrases.length) return null
  return {
    reason:
      `⛔ Ce commit (\`git commit -a\`, \`-i\` ou \`-- <chemins>\`) prend l'ARBRE de travail et ignore l'index : `
      + `${ecrases.join(', ')} porte(nt) À LA FOIS des modifications stagées et non stagées — le stage par hunk `
      + `serait annulé et le reste emporté. Committer sans \`-a\` ni pathspec (l'index fait foi), ou stager tout `
      + `le fichier avant.`,
  }
}

// ── Le verdict de la porte ────────────────────────────────────────────────────────────────────────

/** Le répertoire où la lecture a été tentée, pour `refusDesPannes` : hors dépôt (`racineSurDisque`), la
 *  cause est là. */
const ouDeLaLecture = (dir) => ({ cwd: dir, horsDepot: racineSurDisque(dir) === null })

/** Les décisions de la porte sur `commit` (`diffDuCommit`) pour `entree` = `{ message, commentaire }`.
 *  Tout ce qui se lit sur DISQUE se lit dans `dir`, la racine de l'arbre qui committe. */
async function decisionsDuCommit(entree, { commit, dir, today, pannes }) {
  const lu = lectureDeLaPorte(entree)
  const { touchesSrc, touchesUi, totalLines, fichiers } = analyzeDiffDuCommit(commit.numstat(), { ecranParInsertion: commit.enFusion() })
  // Le mtime plancher de la capture de recette est celui du DERNIER fichier d'écran stagé : une
  // capture antérieure au geste montre l'écran d'avant.
  const mtimeEcrans = mtimeMaxDe(fichiers.filter(estFichierEcran), dir)
  // UNE histoire de HEAD pour l'évaluation, que les citations « corrigé par » de tous les soldes
  // partagent ; lue PARESSEUSEMENT, DANS le juge : une indisponibilité de git y est rattrapée et NOMMÉE.
  const histoire = histoireDeHead(depotDe(dir))
  const decision = jugerOuConfier(() => evaluate({
    ...entree,
    today,
    // Le solde LU est celui que le commit EMPORTE (`commit.contenus`, un lot pour tous les soldes).
    readSoldes: (ns) => soldesEmportes(commit, ns),
    soldeOnDisk: (n) => readSoldeFile(n, dir),
    contexteSolde: {
      fichiersEmportes: fichiers,
      lignesEmportees: (f) => lignesDeHunks(commit.diff([f])),
      touchesUi,
      verifierCapturesDe: (chemins) => verifierCaptures(chemins, { racine: dir, mtimeMin: mtimeEcrans, pannes }),
      histoireDe: (shas) => histoireDesCitations(depotAuxPannes(dir, pannes), shas, { histoire }),
    },
  }), pannes)
  const porteDuTicket = evaluatePorteDuTicket({ ...entree, fichiersEmportes: fichiers })
  const antiEsquive = evaluateAntiEsquive({
    ...entree,
    fusionEnCours: commit.enFusion(),
    stagedTouchesSrc: touchesSrc,
    stagedTotalLines: totalLines,
    readRefFile: (n) => readRefFile(n, dir),
  })
  const juge = evaluateJuge({
    ...entree,
    fusionEnCours: commit.enFusion(),
    stagedTouchesSrc: touchesSrc,
    stagedTotalLines: totalLines,
    stagedTouchesUi: touchesUi,
    readRefFile: (n) => readRefFile(n, dir),
  })
  const registresPorteurs = evaluateRegistresPorteurs({ ...entree, lireRegistreEmporte: (chemin) => commit.contenu(chemin) })
  // Volet anti-tombale : `commentPoison` tire le vocabulaire RAW derrière lui — chargé SEULEMENT
  // quand le commit ferme un ticket.
  const fermes = lu.fermes()
  let tombale = null
  if (fermes.length > 0) {
    const { evaluateTombale } = await import('./solde-tombale.mjs')
    tombale = evaluateTombale({
      issuesFermees: fermes,
      fichiers: fichiersCitantTickets(fermes, dir, { pannes }),
      lire: (p) => commit.contenu(p),
    })
  }
  const importsDuContexte = [
    ...importsDe(commit.contenu('CLAUDE.md')),
    ...importsDe(commit.lirePreImage('CLAUDE.md')),
  ]
  const budget = fichiers.some((f) => estCheminDuBudget(f, importsDuContexte))
    ? evaluateBudgetContexte({
      ...entree,
      mesure: mesurerBudget(dir, { lireTout: commit.contenus, lister: listeurDuBudget(INDEX, dir, { pannes }) }),
      reference: mesurerBudget(dir, { lireTout: commit.preImages, lister: listeurDuBudget(commit.base(), dir, { pannes }) }),
    })
    : null
  // UN `git diff -U0` de ce que le commit emporte (`croissanceDesStocks` n'en lit que les porteurs), et
  // les images des porteurs par lot (`lireEnLot`). Sans porteur, rien n'est lu. Sous une fusion en
  // cours, les porteurs sont ceux de son APPORT (`commit.fusion`).
  const fusion = commit.fusion()
  const porteursDeStock = (fusion ? fusion.entree.fichiers : fichiers).filter(estPorteurDeStock)
  const stocks = porteursDeStock.length ? evaluateStocksQuiGrandissent({
    ...entree,
    ...(fusion
      ? { fusion: fusion.entree }
      : { diff: commit.diff(), images: { ...commit.images(porteursDeStock), renommages: commit.renommages() } }),
  }) : null
  const reclassements = evaluateReclassementsCss({
    ...entree,
    deplace: () => commit.deplaceLaFrontiereCss(fichiers),
    cotes: commit.cotesCss,
  })
  const hunks = jugerOuConfier(() => evaluateHunksEmportes({ stages: commit.stages(fichiers) }), pannes)
  return [decision, porteDuTicket, antiEsquive, juge, registresPorteurs, tombale, budget, stocks, reclassements, hunks]
}

/**
 * Le verdict UNIQUE de la porte sur le commit que git prépare (`scripts/git-hooks/commit-msg.mjs`) :
 * `message` = le message qu'il enregistre (`lectureDuMessage(…).texte`), `commentaire` = son caractère
 * de commentaire (`caractereDeCommentaire`) ; `commit` = ce qu'il emporte (`diffDuCommit`) ; `dir` = la racine
 * de l'arbre qui committe ; `today` = date locale ; `pannes` = les pannes de lecture git, refusées au
 * rendu (`refusDesPannes`). Toutes les décisions en UN cumul (`decisionCumulee`).
 * @param {{ message: string, commentaire?: string, commit?: ReturnType<typeof diffDuCommit>, dir?: string, today: string, pannes?: string[] }} p
 * @returns {Promise<{ reason: string } | null>}
 */
export async function jugerLeCommit({ message, commentaire = '#', dir = process.cwd(), today, pannes = [], commit = diffDuCommit(dir, { pannes }) }) {
  try {
    const decisions = await decisionsDuCommit({ message, commentaire }, { commit, dir, today, pannes })
    return decisionCumulee([...decisions, refusDesPannes(pannes, ouDeLaLecture(dir))])
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    return refusDesPannes([...pannes, refusDeGit(e)], ouDeLaLecture(dir))
  }
}

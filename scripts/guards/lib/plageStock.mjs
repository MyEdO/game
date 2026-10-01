// STOCKS NOMINATIFS SUR UNE PLAGE de commits — la porte a posteriori du PUSH.
//
// Le garde au commit et la mesure du DERNIER commit ne voient qu'une tête : sur un push en lot,
// tout commit qui n'est pas la tête est invisible, et la croissance de `429b9a1a2` a traversé les
// deux portes six heures après leur pose (revue de palier n°2, 2026-09-03). Cette lib juge la PLAGE
// réellement poussée.
//
// La plage d'un PUSH est ce qu'il APPORTE au tronc : l'appelant passe la ref poussée (`vers`), et un
// commit déjà sur le tronc n'y est pas rejugé (stocks-nominatifs.test.mjs:33-36). Une FENÊTRE mesurée
// (palier) ne passe pas de `vers`. Le tronc est lu tel que le dépôt qui juge le connaît : un
// `origin/main` local périmé retranche moins au cumul (le pre-push), la CI refetche le sien.
//
// DEUX NIVEAUX, tous deux nécessaires (discriminés par sonde le 2026-09-03) :
//   · PAR COMMIT, parce que `CLIQUET: <fichier> +N — <motif>` vit dans UN message : jugée en cumulé,
//     une plage de deux commits cliquetés `+2` et `+2` demanderait un cliquet `+4` qu'aucun message
//     ne porte — faux rouge ;
//   · FILTRE CUMULÉ, parce qu'un stock ajouté puis RETIRÉ dans la même plage ne grandit rien :
//     jugée par commit seule, la plage refuserait un travail dont le solde est nul — faux rouge.
// Donc : les croissances non couvertes se lèvent PAR COMMIT, et l'on n'en retient que les fichiers
// dont la croissance CUMULÉE sur toute la plage reste positive.
//
// Le filtre CUMULÉ est un bilan d'ÉTATS, clé par clé (`bilanDesStocks`, renommages de chaque paire de
// bouts, #1806 D5″) : `debut..fin`, moins ce que le tronc a changé entre l'état qu'en connaît `debut`
// et celui qu'en connaît `fin` (`merge-base` de chacun avec le tronc). Une dette neuve dans X qu'une
// baisse dans Q du même porteur compenserait reste en croissance, et se refuse ; une baisse faite par
// le tronc ne paie rien.
//
// Chaque commit de la plage se lit par CE QU'IL FAIT, en ENTRÉES (#2223) : un commit ordinaire contre
// sa base (`ceQueFaitLeCommit`) ; une FUSION contre la fusion automatique de ses parents, rejouée
// entrée par entrée sur les images de `^1`, `^2` et de leur base commune (`lecturesDuCommit`,
// `bilanDeFusion`), jamais contre un TEXTE fusionné, qui porte les marqueurs d'un conflit. Une fusion
// n'y porte que son apport propre : ce qu'elle ajoute en résolvant s'y voit, une entrée qu'un côté a
// soldée et qu'elle ressuscite aussi.
//
// `RECLASSEMENT: <module> +N — <motif>` (`reclassementCss.mjs`) se juge PAR COMMIT seulement (#1806 D3″) :
// la ligne vit dans UN message et nomme le franchissement de CE commit. Une fusion se lit à TROIS
// VOIES : contre leur base commune, moins ce que la fusion automatique de ses parents exempte déjà
// (`franchisDuCommit`).
//
// La lib CALCULE ; le VERDICT appartient à l'appelant (le pre-push refuse, la mesure a posteriori
// échoue). Elle reste PURE dans son cœur (`refusDeLaPlage`, `reclassementsDeLaPlage`) : les lectures
// git passent par les questions du dépôt de `cwd` (`depotDe`, `gitPorte.mjs`).
import { GitIndisponible, TRONC, arbreVide, baseCommune, ceQueFaitLeCommit, ceQuiChange, depotDe, journalDe, lireEnLot, parentsDe, shasDe } from './gitPorte.mjs'
import { bilanDeFusion, bilanDesStocks, croissanceDesCles, nonCouvertesDuBilan } from './stocksNominatifs.mjs'
import { modulesExemptes } from './cssCouches.mjs'
import { deplaceLaFrontiere, ecartsDeReclassement, franchisDesCotes, lignesDeReclassement } from './reclassementCss.mjs'
import { coteCss, sourceGit } from './cssImages.mjs'

/** Le sha nul que git écrit sur stdin du pre-push pour une branche NEUVE. */
export const SHA_NUL = '0'.repeat(40)

/**
 * Bilan signé `de` MOINS `moins`, porteur par porteur et clé par clé, PUR.
 * @param {{ fichier: string, parCle: Map<string, number> }[]} de
 * @param {{ fichier: string, parCle: Map<string, number> }[]} [moins]
 * @returns {{ fichier: string, parCle: Map<string, number> }[]}
 */
export function bilanSoustrait(de, moins = []) {
  /** @type {Map<string, Map<string, number>>} */
  const parFichier = new Map()
  const porter = (bilan, signe) => {
    for (const { fichier, parCle } of bilan) {
      const cles = parFichier.get(fichier) ?? new Map()
      for (const [cle, n] of parCle) cles.set(cle, (cles.get(cle) ?? 0) + signe * n)
      parFichier.set(fichier, cles)
    }
  }
  porter(de, 1)
  porter(moins, -1)
  return [...parFichier].map(([fichier, parCle]) => ({ fichier, parCle }))
}

/**
 * Bilan d'un commit, PUR : `bilanDesStocks(diff, images)` contre sa base, ou `bilanDeFusion(fusion)`
 * pour une fusion (#2223).
 * @param {{ diff?: string, images?: Parameters<typeof bilanDesStocks>[1], fusion?: Parameters<typeof bilanDeFusion>[0] | null }} c
 * @returns {ReturnType<typeof bilanDesStocks>}
 */
export const bilanDuCommit = ({ diff, images, fusion = null }) => (fusion ? bilanDeFusion(fusion) : bilanDesStocks(diff, images))

/**
 * Franchissements d'un commit, PUR : `franchisDesCotes(base, commit)` ; pour une FUSION (`parents` =
 * les côtés de `^1` et `^2`, `base` = celui de leur base commune), à TROIS VOIES (#2223) : un module
 * que la fusion automatique de ses parents exempte déjà — le côté qui a changé son exemption, l'autre
 * sinon — n'est pas franchi par la fusion.
 * @param {{ base: Parameters<typeof franchisDesCotes>[0], commit: Parameters<typeof franchisDesCotes>[1], parents?: Parameters<typeof franchisDesCotes>[0][] }} cotes
 * @returns {ReturnType<typeof franchisDesCotes>}
 */
export function franchisDuCommit({ base, commit, parents = [] }) {
  const franchis = franchisDesCotes(base, commit)
  if (!parents.length) return franchis
  const [exB, ex1, ex2] = [base, ...parents].map(modulesExemptes)
  const exempteALaFusionAutomatique = (m) => (ex1.has(m) === exB.has(m) ? ex2.has(m) : ex1.has(m))
  return franchis.filter((f) => !exempteALaFusionAutomatique(f.module))
}

/**
 * Refus d'une plage, PUR. `commits` = `[{ sha, message, diff, images, fusion }]` (`bilanDuCommit`) dans
 * l'ordre de l'histoire, les seuls commits JUGÉS ;
 * `cumul` = le bilan cumulé SIGNÉ de la plage (`bilanDesStocks`, `bilanSoustrait`).
 * Chaque `images` porte un `lirePostImage` : `bilanDesStocks` refuse nommément sinon.
 * @param {{ commits?: object[], cumul: { fichier: string, parCle: Map<string, number> }[] }} p
 * @returns {{ sha: string, fichier: string, net: number, declare: number | null, exemples: string[] }[]}
 * @throws {TypeError} sans `cumul` : un filtre absent rendrait zéro refus, un verdict qui ment.
 * @throws {Error} propagé de `bilanDesStocks` : sans lecteur d'image post, le compte ment.
 */
export function refusDeLaPlage({ commits = [], cumul } = {}) {
  if (!Array.isArray(cumul)) throw new TypeError('refusDeLaPlage : `cumul` (le bilan cumulé signé de la plage) est exigé')
  const enCroissance = new Set(cumul.filter((b) => croissanceDesCles(b.parCle) > 0).map((b) => b.fichier))
  const refus = []
  for (const { sha, message, ...lu } of commits) {
    for (const c of nonCouvertesDuBilan(bilanDuCommit(lu), message)) {
      if (enCroissance.has(c.fichier)) refus.push({ sha, fichier: c.fichier, net: c.net, declare: c.declare, exemples: c.exemples })
    }
  }
  return refus
}

/**
 * Reclassements CSS non déclarés d'une plage, PUR : chaque commit contre sa base (#1806 D3″), une fusion
 * à trois voies (`franchisDuCommit`, #2223). `cotes()` rend `{ base, commit, parents? }` (`coteCss`),
 * ou `null` si le commit ne touche pas la frontière ; une image illisible est un refus NOMMÉ par son
 * commit, jamais une levée.
 * @param {{ commits?: { sha: string, message: string, cotes: () => ({ base: object, commit: object, parents?: object[] } | null) }[] }} p
 * @returns {({ sha: string, ecarts: ReturnType<typeof ecartsDeReclassement> } | { sha: string, illisible: string })[]}
 */
export function reclassementsDeLaPlage({ commits = [] } = {}) {
  const refus = []
  for (const { sha, message, cotes } of commits) {
    let lus
    try {
      lus = cotes()
    } catch (e) {
      refus.push({ sha, illisible: e.message })
      continue
    }
    const lignes = lignesDeReclassement(message)
    if (!lus && !lignes.length) continue
    const ecarts = ecartsDeReclassement(lus ? franchisDuCommit(lus) : [], lignes)
    if (ecarts.length) refus.push({ sha, ecarts })
  }
  return refus
}

/** Refus lisible : quel commit, quel fichier, de combien, trois exemples, et les deux gestes. */
export function raisonDeRefusDePlage(refus) {
  const lignes = refus.map((r) => {
    const declare = r.declare === null ? '' : ` (le message annonce \`+${r.declare}\`)`;
    return `${r.sha.slice(0, 9)} ${r.fichier} +${r.net} entrée(s)${declare} — ex. ${r.exemples.join(' · ')}`
  })
  return (
    `⛔ STOCK NOMINATIF qui GRANDIT dans la plage poussée : ${lignes.join(' || ')}. Geste : ` +
    '`git rebase -i` pour porter `CLIQUET: <fichier> +N — <motif>` au message du commit fautif, ' +
    "ou retirer l'entrée (un stock nominatif est une DETTE vers zéro, jamais un registre). `+N` " +
    "compte les ENTRÉES du stock — ses éléments —, jamais ce qu'elles dénombrent."
  )
}

/** `fait` (`ceQuiChange`) restreint aux `chemins` : rien hors d'eux, rien du tout sans eux. */
const restreinte = (fait, chemins) => {
  const specs = chemins.map((c) => `:(literal)${c}`)
  return {
    ...fait,
    chemins: (filtre = '') => (specs.length ? fait.chemins(filtre, specs) : []),
    diff: () => (specs.length ? fait.diff(specs) : ''),
    renommages: () => (specs.length ? fait.renommages(specs) : new Map()),
  }
}

/**
 * Les lectures d'un commit : `fait` = ce qu'il fait contre sa base (`ceQueFaitLeCommit`) ; pour une
 * FUSION, `fait` = ce qu'elle fait contre la base commune de ses deux parents (l'arbre vide sans ancêtre
 * commun), `parents` et `commune` = les arbres de la fusion à trois voies, le tout restreint aux chemins
 * que la fusion touche ELLE-MÊME — ceux où elle s'écarte de la fusion automatique
 * (`ceQueFaitLeCommit(…).chemins()`, des NOMS : aucun texte à marqueurs n'est lu).
 * @param {import('./gitPorte.mjs').Depot} depot @param {string} sha
 * @returns {{ fait: ReturnType<typeof ceQuiChange>, fusion: { parents: string[], commune: string } | null }}
 * @throws {GitIndisponible} propagée de `ceQueFaitLeCommit` (fusion à plus de deux parents, git
 *   sans `merge-tree --write-tree --stdin`).
 */
function lecturesDuCommit(depot, sha) {
  const fait = ceQueFaitLeCommit(depot, sha)
  const parents = parentsDe(depot, sha) ?? []
  if (parents.length < 2) return { fait, fusion: null }
  const commune = baseCommune(depot, parents[0], parents[1]) ?? arbreVide(depot)
  return { fait: restreinte(ceQuiChange(depot, commune, sha), fait.chemins()), fusion: { parents, commune } }
}

/**
 * Lecture de la plage réelle `<fin>`, privée de `<debut>`, dans `cwd`, et refus qu'elle porte.
 * `vers` = la ref POUSSÉE. Le tronc d'avant est `debut` quand `vers` est `TRONC.branche` ; sinon, et
 * dès que `debut` est nul (branche NEUVE sur stdin du hook, tête hors CI), c'est `TRONC.suivi`, que la
 * plage exclut aussi. Une FENÊTRE (`vers` absent, `debut` donné) n'exclut que `debut`. Un tronc
 * illisible est NOMMÉ dans `notes`, et sans aucune borne `fin` seul est jugé (`fin^!`).
 * `null` = l'OBJET demandé n'existe pas (le contrat des lecteurs d'image) ; une INDISPONIBILITÉ de
 * git est rendue à part (`indisponible`), et l'appelant la NOMME : une plage illisible ne se juge
 * pas, elle se dit.
 * @param {{ cwd?: string, debut: string, fin: string, vers?: string | null }} p
 * @returns {{ refus: [], reclassements: [], notes: string[], plage: string, indisponible: string|null, commits?: number }}
 */
export function croissancesDeLaPlage({ cwd = process.cwd(), debut, fin, vers = null } = {}) {
  const pannes = []
  const depot = depotDe(cwd, { enPanne: (raison) => pannes.push(raison) })
  const notes = []
  const avecLeTronc = (sha) => baseCommune(depot, sha, TRONC.suivi)
  if (debut === SHA_NUL) debut = null
  let tronc = null
  if (debut && vers === TRONC.branche) {
    notes.push(`push vers le tronc (\`${vers}\`) : \`debut\` est le tronc d'avant, rien d'autre n'est exclu`)
  } else if (!debut || vers !== null) {
    tronc = avecLeTronc(fin) && TRONC.suivi
    if (!tronc) notes.push(`tronc \`${TRONC.suivi}\` illisible depuis ${fin.slice(0, 9)} : ses commits ne sont PAS exclus de la plage`)
  }
  const seul = !debut && !tronc
  if (seul) notes.push(`plage inconnue : ni sha distant ni tronc — ${fin.slice(0, 9)} seul est jugé, sans ses parents`)
  const revisions = seul ? [`${fin}^!`] : [debut ? `${debut}..${fin}` : fin, ...(tronc ? [`^${tronc}`] : [])]
  const plage = revisions.join(' ')
  const shas = shasDe(depot, revisions)
  if (shas === null) {
    notes.push(`plage \`${plage}\` illisible : rien n'est jugé`)
    return { refus: [], reclassements: [], notes, plage, indisponible: pannes[0] ?? null }
  }
  const messages = new Map((journalDe(depot, revisions) ?? []).map((c) => [c.sha, c.message]))
  const texteA = (arbre) => (f) => lireEnLot(depot, arbre, [f]).get(f) ?? null
  let commits
  try {
    commits = shas.map((sha) => {
      const { fait, fusion } = lecturesDuCommit(depot, sha)
      const source = (arbre) => sourceGit({ cwd, arbre, depot })
      const base = source(fait.base)
      const commit = source(sha)
      const cote = (s) => coteCss(s, { racine: cwd })
      return {
        sha,
        message: messages.get(sha) ?? '',
        ...(fusion
          ? { fusion: { fichiers: fait.chemins(), lire: { fusion: texteA(sha), parents: fusion.parents.map(texteA), commune: texteA(fusion.commune) } } }
          : { diff: fait.diff(), images: { lirePostImage: texteA(sha), lirePreImage: fait.lirePreImage, renommages: fait.renommages() } }),
        cotes: () => (deplaceLaFrontiere({ chemins: fait.chemins(), nesOuMorts: () => fait.chemins('AD'), base, commit, racine: cwd })
          ? { base: cote(base), commit: cote(commit), ...(fusion ? { parents: fusion.parents.map((p) => cote(source(p))) } : {}) }
          : null),
      }
    })
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    notes.push(`plage \`${plage}\` illisible : rien n'est jugé`)
    return { refus: [], reclassements: [], notes, plage, indisponible: e.raison }
  }
  const bilanEntre = (a, b) => {
    const change = ceQuiChange(depot, a, b)
    return bilanDesStocks(change.diff(), { lirePostImage: texteA(b), lirePreImage: change.lirePreImage, renommages: change.renommages() })
  }
  const troncDeFin = tronc && avecLeTronc(fin)
  const bout = debut ?? troncDeFin
  const troncDuBout = tronc && avecLeTronc(bout)
  if (tronc && !troncDuBout) notes.push(`\`${bout.slice(0, 9)}\` sans ancêtre commun avec \`${tronc}\` : le cumul ne retranche rien du tronc`)
  const cumul = seul
    ? commits.flatMap((c) => bilanDuCommit(c))
    : bilanSoustrait(bilanEntre(bout, fin), troncDuBout ? bilanEntre(troncDuBout, troncDeFin) : [])
  return {
    refus: refusDeLaPlage({ commits, cumul }),
    reclassements: reclassementsDeLaPlage({ commits }),
    notes,
    commits: shas.length,
    plage,
    indisponible: pannes[0] ?? null,
  }
}

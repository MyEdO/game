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
// clé par clé sur les COMPTES d'entrées de `^1`, `^2` et de leur base commune (`lecturesDuCommit`,
// `bilanDuCommit`), jamais contre un TEXTE fusionné, qui porte les marqueurs d'un conflit. Une fusion n'y porte que son apport propre :
// ce qu'elle ajoute en résolvant s'y voit, une entrée qu'un côté a soldée et qu'elle ressuscite aussi.
//
// `RECLASSEMENT: <module> +N — <motif>` (`reclassementCss.mjs`) se juge PAR COMMIT seulement (#1806 D3″) :
// la ligne vit dans UN message et nomme le franchissement de CE commit. Une fusion franchit ce
// qu'elle franchit contre CHACUN de ses parents (`franchisCommuns`).
//
// La lib CALCULE ; le VERDICT appartient à l'appelant (le pre-push refuse, la mesure a posteriori
// échoue). Elle reste PURE dans son cœur (`refusDeLaPlage`, `reclassementsDeLaPlage`) : les lectures
// git passent par les questions du dépôt de `cwd` (`depotDe`, `gitPorte.mjs`).
import { GitIndisponible, TRONC, arbreVide, baseCommune, ceQueFaitLeCommit, ceQuiChange, depotDe, journalDe, lireEnLot, parentsDe, shasDe } from './gitPorte.mjs'
import { bilanDesStocks, croissanceDesCles, nonCouvertesDuBilan } from './stocksNominatifs.mjs'
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
 * Ce qu'une FUSION ajoute, sous UNE clé, à la fusion automatique de ses parents, PUR (#2223). Chaque
 * écart est le compte de la fusion MOINS celui d'un côté : `d1` contre `^1`, `d2` contre `^2`, `dB`
 * contre leur base commune. La fusion automatique d'un compte prend le côté qui a CHANGÉ (l'autre est
 * resté à la base), le côté commun si les deux ont fait le MÊME changement, la somme des deux
 * changements sinon.
 * @param {number} d1 @param {number} d2 @param {number} dB @returns {number}
 */
export function apportDeFusion(d1, d2, dB) {
  if (d1 === dB) return d2
  if (d2 === dB || d1 === d2) return d1
  return d1 + d2 - dB
}

/**
 * Bilan d'un commit, PUR : son bilan contre son parent (`contre`, une lecture `{ diff, images }`) ;
 * pour une FUSION (`contre` = ses deux parents, `commune` = leur base commune), clé par clé, ce qu'elle
 * ajoute à leur fusion automatique (`apportDeFusion`). Les entrées citées sont celles des parents sous
 * une clé qui croît.
 * @param {{ contre: { diff: string, images: Parameters<typeof bilanDesStocks>[1] }[], commune?: { diff: string, images: Parameters<typeof bilanDesStocks>[1] } | null }} p
 * @returns {ReturnType<typeof bilanDesStocks>}
 */
export function bilanDuCommit({ contre, commune = null }) {
  const [b1, b2] = contre.map(({ diff, images }) => bilanDesStocks(diff, images))
  if (!commune) return b1
  const bB = bilanDesStocks(commune.diff, commune.images)
  const fichiers = [...new Set([...b1, ...b2, ...bB].map((b) => b.fichier))]
  const de = (bilan, fichier) => bilan.find((b) => b.fichier === fichier) ?? { retenues: [], perdues: [], parCle: new Map() }
  return fichiers.map((fichier) => {
    const [c1, c2, cB] = [de(b1, fichier), de(b2, fichier), de(bB, fichier)]
    const cles = new Set([...c1.parCle.keys(), ...c2.parCle.keys(), ...cB.parCle.keys()])
    const n = (c, k) => c.parCle.get(k) ?? 0
    const parCle = new Map([...cles].map((k) => [k, apportDeFusion(n(c1, k), n(c2, k), n(cB, k))]))
    const retenues = [...c1.retenues, ...c2.retenues.filter((t) => !c1.retenues.some((r) => r.texte === t.texte))]
    return { fichier, retenues: retenues.filter((t) => parCle.get(t.cle) > 0), perdues: [], parCle }
  })
}

/**
 * Franchissements d'un commit lu contre CHACUN de ses parents, PUR : les modules franchis contre TOUS,
 * au MOINDRE prix (#2223) — un module qu'un parent revendique déjà a franchi dans l'histoire de ce
 * parent. Une seule liste se rend telle quelle.
 * @param {ReturnType<typeof franchisDesCotes>[]} listes une par parent, au moins une
 * @returns {ReturnType<typeof franchisDesCotes>}
 */
export function franchisCommuns([premiere, ...autres]) {
  return premiere.flatMap((f) => {
    const ailleurs = autres.map((l) => l.find((g) => g.module === f.module))
    return ailleurs.every(Boolean) ? [[f, ...ailleurs].reduce((a, b) => (b.n < a.n ? b : a))] : []
  })
}

/**
 * Refus d'une plage, PUR. `commits` = `[{ sha, message, contre, commune }]` (`bilanDuCommit`) dans
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
 * Reclassements CSS non déclarés d'une plage, PUR : chaque commit contre ses parents (#1806 D3″, #2223).
 * `cotes()` rend un `{ base, commit }` (`coteCss`) par parent, ou `null` si le commit ne déplace pas la
 * frontière contre l'un d'eux ; une image illisible est un refus NOMMÉ par son commit, jamais une levée.
 * @param {{ commits?: { sha: string, message: string, cotes: () => ({ base: object, commit: object }[] | null) }[] }} p
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
    const ecarts = ecartsDeReclassement(lus ? franchisCommuns(lus.map((c) => franchisDesCotes(c.base, c.commit))) : [], lignes)
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
 * Les lectures d'un commit pour `bilanDuCommit` : `contre` sa base (`ceQueFaitLeCommit`) ; pour une
 * fusion, `contre` chacun de ses deux parents et `commune` leur base commune (l'arbre vide sans
 * ancêtre commun), restreintes aux chemins que la fusion touche ELLE-MÊME — ceux où elle s'écarte de la
 * fusion automatique (`ceQueFaitLeCommit(…).chemins()`, des NOMS : aucun texte à marqueurs n'est lu).
 * @param {import('./gitPorte.mjs').Depot} depot @param {string} sha
 * @returns {{ contre: ReturnType<typeof ceQuiChange>[], commune: ReturnType<typeof ceQuiChange> | null }}
 * @throws {GitIndisponible} propagée de `ceQueFaitLeCommit` (fusion à plus de deux parents, git
 *   sans `merge-tree --write-tree --stdin`).
 */
function lecturesDuCommit(depot, sha) {
  const fait = ceQueFaitLeCommit(depot, sha)
  const parents = parentsDe(depot, sha) ?? []
  if (parents.length < 2) return { contre: [fait], commune: null }
  const touches = fait.chemins()
  const commune = baseCommune(depot, parents[0], parents[1]) ?? arbreVide(depot)
  return {
    contre: parents.map((p) => restreinte(ceQuiChange(depot, p, sha), touches)),
    commune: restreinte(ceQuiChange(depot, commune, sha), touches),
  }
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
      const { contre: parents, commune } = lecturesDuCommit(depot, sha)
      const source = (arbre) => sourceGit({ cwd, arbre, depot })
      const commit = source(sha)
      const lu = (fait) => ({
        diff: fait.diff(),
        images: { lirePostImage: texteA(sha), lirePreImage: fait.lirePreImage, renommages: fait.renommages() },
      })
      return {
        sha,
        message: messages.get(sha) ?? '',
        contre: parents.map(lu),
        commune: commune && lu(commune),
        cotes: () => {
          const deplacees = parents.map((fait) => ({ fait, base: source(fait.base) })).filter(({ fait, base }) => deplaceLaFrontiere({
            chemins: fait.chemins(),
            nesOuMorts: () => fait.chemins('AD'),
            base,
            commit,
            racine: cwd,
          }))
          return deplacees.length === parents.length
            ? deplacees.map(({ base }) => ({ base: coteCss(base, { racine: cwd }), commit: coteCss(commit, { racine: cwd }) }))
            : null
        },
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

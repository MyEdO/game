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
// Chaque commit de la plage, fusions comprises, se lit par CE QU'IL FAIT (`ceQueFaitLeCommit`) contre
// sa BASE : diff, textes des stocks dans la base et côté `base` des reclassements. Une fusion n'y porte
// que son apport propre, et ce qu'elle ajoute en résolvant s'y voit.
//
// `RECLASSEMENT: <module> +N — <motif>` (`reclassementCss.mjs`) se juge PAR COMMIT seulement, contre sa
// base (#1806 D3″) : la ligne vit dans UN message et nomme le franchissement de CE commit.
//
// La lib CALCULE ; le VERDICT appartient à l'appelant (le pre-push refuse, la mesure a posteriori
// échoue). Elle reste PURE dans son cœur (`refusDeLaPlage`, `reclassementsDeLaPlage`) : les lectures
// git sont injectées.
import { GitIndisponible, TRONC, ceQueFaitLeCommit, lireGit, sortieOuNull } from './gitPorte.mjs'
import { bilanDesStocks, croissanceDesCles, nonCouvertesDuBilan } from './stocksNominatifs.mjs'
import { deplaceLaFrontiere, ecartsDeReclassement, franchisDesCotes, lignesDeReclassement } from './reclassementCss.mjs'
import { coteCss, renommagesDe, sourceGit } from './cssImages.mjs'

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
 * Refus d'une plage, PUR. `commits` = `[{ sha, message, diff, images }]` dans l'ordre de l'histoire,
 * les seuls commits JUGÉS ; `cumul` = le bilan cumulé SIGNÉ de la plage (`bilanDesStocks`, `bilanSoustrait`).
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
  for (const { sha, message, diff, images } of commits) {
    for (const c of nonCouvertesDuBilan(bilanDesStocks(diff, images), message)) {
      if (enCroissance.has(c.fichier)) refus.push({ sha, fichier: c.fichier, net: c.net, declare: c.declare, exemples: c.exemples })
    }
  }
  return refus
}

/**
 * Reclassements CSS non déclarés d'une plage, PUR : chaque commit contre sa base (#1806 D3″).
 * `cotes()` rend `{ base, commit }` (`coteCss`), ou `null` si le commit ne touche pas la frontière ;
 * une image illisible est un refus NOMMÉ par son commit, jamais une levée.
 * @param {{ commits?: { sha: string, message: string, cotes: () => ({ base: object, commit: object } | null) }[] }} p
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
    const ecarts = ecartsDeReclassement(lus ? franchisDesCotes(lus.base, lus.commit) : [], lignes)
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

/**
 * Lecture de la plage réelle `<fin>`, privée de `<debut>`, dans `cwd`, et refus qu'elle porte.
 * `vers` = la ref POUSSÉE. Le tronc d'avant est `debut` quand `vers` est `TRONC.branche` ; sinon, et
 * dès que `debut` est nul (branche NEUVE sur stdin du hook, tête hors CI), c'est `TRONC.suivi`, que la
 * plage exclut aussi. Une FENÊTRE (`vers` absent, `debut` donné) n'exclut que `debut`. Un tronc
 * illisible est NOMMÉ dans `notes`, et sans aucune borne `fin` seul est jugé (`fin^!`).
 * `null` = l'OBJET demandé n'existe pas (le contrat des lecteurs d'image) ; une INDISPONIBILITÉ de
 * git est rendue à part (`indisponible`), et l'appelant la NOMME : une plage illisible ne se juge
 * pas, elle se dit.
 * @param {{ cwd?: string, debut: string, fin: string, vers?: string | null,
 *           git?: (args: string[]) => string | null }} p
 * @returns {{ refus: [], reclassements: [], notes: string[], plage: string, indisponible: string|null, commits?: number }}
 */
export function croissancesDeLaPlage({ cwd = process.cwd(), debut, fin, vers = null, git } = {}) {
  const pannes = []
  const lire = git ?? ((args, { entree } = {}) => {
    const vu = lireGit(args, { cwd, entree })
    if (!vu.disponible) {
      pannes.push(vu.raison)
      return null
    }
    return sortieOuNull(vu)
  })
  const notes = []
  const avecLeTronc = (sha) => lire(['merge-base', sha, TRONC.suivi])?.trim() || null
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
  const liste = lire(['rev-list', '--reverse', ...revisions])
  if (liste === null) {
    notes.push(`plage \`${plage}\` illisible : rien n'est jugé`)
    return { refus: [], reclassements: [], notes, plage, indisponible: pannes[0] ?? null }
  }
  const shas = liste.split('\n').map((l) => l.trim()).filter(Boolean)
  let commits
  try {
    commits = shas.map((sha) => {
      const fait = ceQueFaitLeCommit(lire, sha)
      const source = (arbre) => sourceGit({ cwd, arbre, git: lire })
      const base = source(fait.base)
      return {
        sha,
        message: lire(['show', '-s', '--format=%B', sha]) ?? '',
        diff: fait.diff(),
        images: {
          lirePostImage: (f) => lire(['show', `${sha}:${f}`]),
          lirePreImage: fait.texteDeBase,
          renommages: fait.renommages(),
        },
        cotes: () => (deplaceLaFrontiere({
          chemins: fait.chemins(),
          nesOuMorts: () => fait.chemins(['--diff-filter=AD']),
          base,
          commit: source(sha),
          racine: cwd,
        }) ? { base: coteCss(base, { racine: cwd }), commit: coteCss(source(sha), { racine: cwd }) } : null),
      }
    })
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    notes.push(`plage \`${plage}\` illisible : rien n'est jugé`)
    return { refus: [], reclassements: [], notes, plage, indisponible: e.raison }
  }
  const bilanEntre = (a, b) => bilanDesStocks(lire(['diff', '-U0', '--no-renames', `${a}..${b}`]) ?? '', {
    lirePostImage: (f) => lire(['show', `${b}:${f}`]),
    lirePreImage: (f) => lire(['show', `${a}:${f}`]),
    renommages: renommagesDe(lire, [a, b]),
  })
  const troncDeFin = tronc && avecLeTronc(fin)
  const bout = debut ?? troncDeFin
  const troncDuBout = tronc && avecLeTronc(bout)
  if (tronc && !troncDuBout) notes.push(`\`${bout.slice(0, 9)}\` sans ancêtre commun avec \`${tronc}\` : le cumul ne retranche rien du tronc`)
  const cumul = seul
    ? commits.flatMap((c) => bilanDesStocks(c.diff, c.images))
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

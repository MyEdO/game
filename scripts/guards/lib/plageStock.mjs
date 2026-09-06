// STOCKS NOMINATIFS SUR UNE PLAGE de commits — la porte a posteriori du PUSH.
//
// Le garde au commit et la mesure du DERNIER commit ne voient qu'une tête : sur un push en lot,
// tout commit qui n'est pas la tête est invisible, et la croissance de `429b9a1a2` a traversé les
// deux portes six heures après leur pose (revue de palier n°2, 2026-09-03). Cette lib juge la PLAGE
// réellement poussée.
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
// La lib CALCULE ; le VERDICT appartient à l'appelant (le pre-push refuse, la mesure a posteriori
// échoue). Elle reste PURE dans son cœur (`refusDeLaPlage`) : les lectures git sont injectées.
import { lireGit, sortieOuNull } from './gitPorte.mjs'
import { croissanceDesStocks, croissancesNonCouvertes } from './stocksNominatifs.mjs'
import { CHEMIN_REGISTRE, parserRegistre } from './stocksRegistre.mjs'

/** Le sha nul que git écrit sur stdin du pre-push pour une branche NEUVE. */
export const SHA_NUL = '0'.repeat(40)

/**
 * Refus d'une plage, PUR. `commits` = `[{ sha, message, diff, images? }]` dans l'ordre de l'histoire,
 * `cumule` = le diff `<avant>..<apres>` d'un bloc, `imagesCumul` = les lecteurs d'image de ses deux
 * bouts.
 * @returns {{ sha: string, cle: string, fichier: string, net: number, declare: number | null,
 *   exemples: string[] }[]} `cle` = `<fichier>#<LIAISON>` (le FICHIER seul quand l'image ne se lit
 *   pas) : un fichier porte plusieurs stocks, et un cumul par fichier laisserait « +1 ici, −1 là »
 *   se compenser. `fichier` est rendu à part — un contrôle négatif porte souvent sur le FICHIER.
 */
export function refusDeLaPlage({ commits = [], cumule = '', imagesCumul } = {}) {
  const enCroissance = new Set(croissanceDesStocks(cumule, imagesCumul).map((c) => c.cle))
  const refus = []
  for (const { sha, message, diff, images } of commits) {
    for (const c of croissancesNonCouvertes({ diff, message }, images)) {
      if (!enCroissance.has(c.cle)) continue
      refus.push({ sha, cle: c.cle, fichier: c.fichier, net: c.net, declare: c.declare, exemples: c.exemples })
    }
  }
  return refus
}

/** Refus lisible : quel commit, quel fichier, de combien, trois exemples, et les deux gestes. */
export function raisonDeRefusDePlage(refus) {
  const lignes = refus.map((r) => {
    const declare = r.declare === null ? '' : ` (le message annonce \`+${r.declare}\`)`;
    return `${r.sha.slice(0, 9)} ${r.cle} +${r.net} entrée(s)${declare} — ex. ${r.exemples.join(' · ')}`
  })
  return (
    `⛔ STOCK NOMINATIF qui GRANDIT dans la plage poussée : ${lignes.join(' || ')}. Geste : ` +
    '`git rebase -i` pour porter `CLIQUET: <fichier>#<LIAISON> +N — <motif>` au message du commit fautif, ' +
    "ou retirer l'entrée (un stock nominatif est une DETTE vers zéro, jamais un registre). `+N` " +
    "compte les ENTRÉES du stock — ses éléments —, jamais ce qu'elles dénombrent."
  )
}

/**
 * Lecture d'une plage réelle dans `cwd` et refus qu'elle porte.
 * `avant` nul (branche NEUVE, forme observée sur stdin du hook) → `origin/main` : la plage jugée est
 * ce que la branche ajoute au tronc.
 * `null` = l'OBJET demandé n'existe pas (le contrat des lecteurs d'image) ; une INDISPONIBILITÉ de
 * git est rendue à part (`indisponible`), et l'appelant la NOMME : une plage illisible ne se juge
 * pas, elle se dit.
 * `registre` = le registre des stocks à lire. Par défaut, CELUI DU COMMIT JUGÉ (`git show
 * <sha>:scripts/hooks/stocks.json`) : une porte juge les commits qui la PORTENT, et le registre EST
 * la porte — une déclaration posée aujourd'hui ne rougit pas une croissance d'hier, qu'aucun message
 * ne pouvait déclarer. Rien à tenir à jour : la condition s'éteint d'elle-même dès le commit qui
 * embarque la déclaration (même patron que `porteEnVigueur` dans `stocks-nominatifs.test.mjs`). Le
 * paramètre FORCE un registre — c'est ainsi qu'un test juge un dépôt jetable ou une fenêtre figée.
 * @param {{ cwd?: string, avant: string, apres: string,
 *           git?: (args: string[]) => string | null,
 *           registre?: { entrees: object[] } }} p
 * @returns {{ refus: [], notes: string[], plage: string, indisponible: string|null, commits?: number }}
 */
export function croissancesDeLaPlage({ cwd = process.cwd(), avant, apres, git, registre = null } = {}) {
  const pannes = []
  const lire = git ?? ((args) => {
    const vu = lireGit(args, { cwd })
    if (!vu.disponible) {
      pannes.push(vu.raison)
      return null
    }
    return sortieOuNull(vu)
  })
  const notes = []
  let base = avant
  if (!base || base === SHA_NUL) {
    base = 'origin/main'
    if (lire(['rev-parse', '--verify', '--quiet', `${base}^{commit}`]) === null) {
      notes.push(`plage inconnue : ni sha distant ni \`origin/main\` — ${apres.slice(0, 9)} seul est jugé`)
      base = `${apres}^`
    }
  }
  const plage = `${base}..${apres}`
  // `--no-merges` : `git show` ne rend aucun diff propre d'une fusion, et la croissance qu'elle
  // porte a déjà été jugée sur le commit d'ORIGINE.
  const liste = lire(['rev-list', '--reverse', '--no-merges', plage])
  if (liste === null) {
    notes.push(`plage \`${plage}\` illisible : rien n'est jugé`)
    return { refus: [], notes, plage, indisponible: pannes[0] ?? null }
  }
  const shas = liste.split('\n').map((l) => l.trim()).filter(Boolean)
  /** Le registre TEL QU'IL EST À CE COMMIT, ou `null` : ce commit ne déclare aucun stock. */
  const registreA = (ref) => {
    if (registre) return registre
    const brut = lire(['show', `${ref}:${CHEMIN_REGISTRE}`])
    if (brut === null) return { entrees: [] }
    try { return parserRegistre(brut, `${ref}:${CHEMIN_REGISTRE}`) } catch { return { entrees: [] } }
  }
  const commits = shas.map((sha) => ({
    sha,
    message: lire(['show', '-s', '--format=%B', sha]) ?? '',
    diff: lire(['show', '--format=', '-U0', '--no-renames', sha]) ?? '',
    images: {
      registre: registreA(sha),
      lirePostImage: (f) => lire(['show', `${sha}:${f}`]),
      lirePreImage: (f) => lire(['show', `${sha}^:${f}`]),
    },
  }))
  const cumule = lire(['diff', '-U0', '--no-renames', `${base}..${apres}`]) ?? ''
  const imagesCumul = {
    registre: registreA(apres),
    lirePostImage: (f) => lire(['show', `${apres}:${f}`]),
    lirePreImage: (f) => lire(['show', `${base}:${f}`]),
  }
  return {
    refus: refusDeLaPlage({ commits, cumule, imagesCumul }),
    notes,
    commits: shas.length,
    plage,
    indisponible: pannes[0] ?? null,
  }
}

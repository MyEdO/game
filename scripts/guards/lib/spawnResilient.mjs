// REJEU D'UN PROCESSUS QUI N'A PAS DÉMARRÉ (#1679 L2 T1d) — module UNIQUE, jamais recopié : deux
// sites de spawn en dépendent, `scripts/gates/toutes.mjs` (les gates du rejeu local et la photo
// de l'arbre) et `scripts/docs/build-all.mjs` (chaque générateur de doc dérivée).
//
// LE CAS : sous des lanes parallèles, le loader Windows peut refuser d'initialiser des processus
// NEUFS et rendre `3221225794` = `STATUS_DLL_INIT_FAILED` (0xC0000142) : un générateur qui ne démarre
// pas, un `tsc -b` perdu, des tests qui échouent sur `expected 3221225794` — autant de rouges qui ne
// disent rien du contenu poussé.
//
// POURQUOI REJOUER EST SÛR ICI, et seulement ici : ce code vient du LOADER, avant que le processus
// n'exécute la moindre instruction de son `main` — il n'a rien lu, rien écrit, rien verrouillé.
// Rejouer est donc idempotent PAR CONSTRUCTION, quel que soit l'effet de bord du programme visé.
// La porte est NOMINATIVE (ce seul code, deux essais, avec attente) : tout autre code de sortie est
// un VRAI verdict et remonte tel quel : un rejeu ne peut donc pas transformer un rouge en vert.
//
// CE QUI SE MESURE : chaque rejeu imprime `MARQUE_REJEU` sur stderr. C'est le compteur de PRESSION
// du lanceur — la mémoire système, elle, ne discrimine rien.
import { execFileSync } from 'node:child_process'

/** `STATUS_DLL_INIT_FAILED` (0xC0000142) : le loader a refusé d'initialiser le processus. */
export const STATUS_DLL_INIT_FAILED = 3221225794

/** Attentes entre les essais, en millisecondes. Deux rejeux, pas plus : au-delà, ce n'est plus une
 *  pointe de charge, c'est un système à bout, et l'appelant doit le voir. */
export const BACKOFFS_MS = [2000, 5000]

/** Marque imprimée à chaque rejeu — comptée par le résumé de `npm run gates`, y compris dans la
 *  sortie des gates, qui sont des processus SÉPARÉS et n'ont aucun compteur à partager. */
export const MARQUE_REJEU = '[spawn] rejeu — le processus n’a pas démarré'

/** `true` si ce code de sortie dit « le processus n'a jamais démarré ». */
export const estEchecDeChargement = (status) => status === STATUS_DLL_INIT_FAILED

/** Compteur de rejeux du processus COURANT (le résumé y ajoute ceux lus dans les sorties de gate). */
export const rejeux = { total: 0 }

/** Attente BLOQUANTE, sans dépendance ni minuterie : les sites synchrones (git, générateurs) ne
 *  peuvent pas rendre la main à la boucle d'événements. */
export function attendreSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Le code de sortie porté par une erreur d'`execFileSync`/`spawnSync`, ou `null`. */
const codeDeLErreur = (e) => (typeof e?.status === 'number' ? e.status : null)

/**
 * `execFileSync` qui REJOUE quand le processus n'a pas démarré. Même signature, même valeur de
 * retour, mêmes exceptions pour tout autre échec. `site` nomme l'appelant dans la marque de rejeu.
 * `executer` est le lanceur injectable (défaut : `execFileSync`) — même patron que l'`attendre` de
 * `reessayerAuChargement` : il rend la boucle de rejeu vérifiable sans fabriquer de processus réel.
 */
export function execFileResilient(
  commande,
  args,
  options = {},
  { site = '?', journal = process.stderr, executer = execFileSync } = {},
) {
  for (let essai = 0; ; essai += 1) {
    try {
      return executer(commande, args, options)
    } catch (e) {
      if (!estEchecDeChargement(codeDeLErreur(e)) || essai >= BACKOFFS_MS.length) throw e
      rejeux.total += 1
      journal.write(`${MARQUE_REJEU} : ${site} — ${commande} (essai ${essai + 2}/${BACKOFFS_MS.length + 1})\n`)
      attendreSync(BACKOFFS_MS[essai])
    }
  }
}

/**
 * Rejoue un lancement ASYNCHRONE tant qu'il rend le code du loader. `lancer()` doit RE-CRÉER tout ce
 * qui est jeté par un essai (un descripteur de fichier de sortie se réouvre en `'w'`, sans quoi le
 * second essai écrirait à la suite du premier). REND le dernier résultat, rejoué ou non.
 */
export async function reessayerAuChargement(lancer, { site = '?', journal = process.stderr, attendre } = {}) {
  const patienter = attendre ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  for (let essai = 0; ; essai += 1) {
    const resultat = await lancer(essai)
    if (!estEchecDeChargement(resultat?.code) || essai >= BACKOFFS_MS.length) return resultat
    rejeux.total += 1
    journal.write(`${MARQUE_REJEU} : ${site} (essai ${essai + 2}/${BACKOFFS_MS.length + 1})\n`)
    await patienter(BACKOFFS_MS[essai])
  }
}

/** Rejeux LUS dans une sortie de gate : ces processus-là ont leur propre compteur, hors du nôtre. */
export const compterRejeux = (texte) => (texte ? texte.split(MARQUE_REJEU).length - 1 : 0)

// Contrat d'état du mod `harnais` (#2279) : la forme de `node scripts/ops/suivi.mjs --session <id> --json`
// (`etatDeSession`, scripts/ops/suivi.mjs), et ce que le mod garde dans `$.state`.

/** Un suivi lié à la session : son épique, son chemin et les lignes de sa situation (le bandeau). */
export type HarnaisSuiviLie = { epique: number; chemin: string; lignes: string[] }

/** L'état d'une session (`etatDeSession`), prêt à rendre. */
export type HarnaisEtatDeSession = {
  session: string
  suivis: HarnaisSuiviLie[]
  contexte: string
  ajout: string
  cle: string
}

/** Une situation datée rendue par le lecteur, en attente du prochain tour, et la clé qu'elle porte. */
export type HarnaisAjout = { ajout: string; cle: string }

/**
 * L'atome UNIQUE de la fonction `suivi`, modifié par une seule `update` à chaque transition :
 * - `etat` : le dernier état de session VALIDE lu (`null` avant toute lecture réussie) ;
 * - `cle` : la clé du dernier état porté en contexte, ajouté ou rendu par l'outil, le `--depuis` du lecteur ;
 * - `enAttente` : la situation datée que le lecteur a rendue depuis `cle`, en attente du prochain tour ;
 * - `generation` : le jeton, tiré neuf, de la dernière transition qui a retenu une clé ; une relecture
 *   lancée sous une autre génération est ignorée.
 */
export type HarnaisSuivi = {
  etat: HarnaisEtatDeSession | null
  cle: string | null
  enAttente: HarnaisAjout | null
  generation: string
}

declare module 'claude-code' {
  interface PluginState {
    harnais: {
      suivi: HarnaisSuivi
    }
  }
}

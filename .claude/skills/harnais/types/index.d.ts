// Types du mod `harnais` : fonction `suivi` (#2279), l'état de session que rend `node scripts/ops/suivi.mjs
// --session <id> --json` (`etatDeSession`, scripts/ops/suivi.mjs) et l'atome `harnais.suivi` ; fonction `vigie`
// (#2280), la mesure que rend `node scripts/ops/vigie.mjs --json --arbre <racine>` et l'atome `harnais.vigie`.

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

/** La mesure de `vigie.mjs --json` : la status line, une phrase de toast par transition, l'état opaque à repasser en `--depuis`. */
export type HarnaisMesureDeVigie = { ligne: string; transitions: string[]; etat: string }

/** L'atome de la fonction `vigie` : l'`etat` de la dernière mesure VALIDE (`null` avant la première), le `--depuis` suivant. */
export type HarnaisVigie = { etat: string | null }

declare module 'claude-code' {
  interface PluginState {
    harnais: {
      suivi: HarnaisSuivi
      vigie: HarnaisVigie
    }
  }
}

// Contrat d'état du mod `harnais` (#2279) : la forme de `node scripts/ops/suivi.mjs --session <id> --json`
// (`etatDeSession`, scripts/ops/suivi.mjs), et ce que le mod garde dans `$.state`.

/** Un suivi lié à la session : son épique, son chemin et les lignes de son bandeau. */
export type HarnaisSuiviLie = { epique: number; chemin: string; lignes: string[] }

/** L'état d'une session, prêt à rendre. */
export type HarnaisSuivi = {
  session: string
  suivis: HarnaisSuiviLie[]
  contexte: string
  ajout: string
  cle: string
}

/** Un ajout rendu par le lecteur, en attente du prochain tour, et la clé de l'état qu'il porte. */
export type HarnaisAjout = { ajout: string; cle: string }

declare module 'claude-code' {
  interface PluginState {
    harnais: {
      /** Le dernier état lu, `null` avant la première lecture ou après un échec. */
      suivi: HarnaisSuivi | null
      /** La clé du dernier état porté en contexte, ajouté ou rendu par l'outil : le `--depuis` du lecteur. */
      cle: string | null
      /** L'ajout que le lecteur a rendu depuis `cle`, en attente du prochain tour. */
      enAttente: HarnaisAjout | null
    }
  }
}

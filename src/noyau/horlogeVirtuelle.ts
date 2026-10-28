/**
 * L'HORLOGE VIRTUELLE d'un hôte sans minuteur (#2928, #3058) : elle rejoue, dans l'ordre de leurs échéances, les jetons
 * numérotés que programme la plateforme du noyau (`plateforme.ts`), sans `setTimeout`. Un hôte (`src/hote/partie.ts`)
 * la vide après chaque geste ; un banc de test (`banc.testkit.ts`) l'avance par ses trois gestes.
 */

/** Un jeton programmé, numéroté : un jeton du noyau est une identité d'objet (`partie.ts`), qui ne traverse pas JSON. */
export interface Programme {
  id: number;
  delai: number;
}

/** Le plafond de reprises d'un geste de l'horloge : au-delà, la partie boucle. */
const PLAFOND_DE_REPRISES = 100_000;

/** L'horloge virtuelle sur `reprendre`, qui rejoue le jeton d'un numéro et rend ceux que sa reprise programme ;
 *  `premiers` sont armés à l'instant zéro. Chaque geste reprend par échéance puis par numéro (l'ordre d'arrivée), rend
 *  son nombre de reprises, et lève au-delà de `PLAFOND_DE_REPRISES`. `vider` est la reprise d'un hôte ; les trois autres
 *  gestes sont ceux des minuteurs factices de Vitest 5.0.3 (`tick`, `runToLast`, `next` puis `tick(0)` de son
 *  `FakeTimers`), dont un délai nul armé pendant le geste échoit une milliseconde plus tard. */
export function horlogeVirtuelle(reprendre: (id: number) => readonly Programme[], premiers: readonly Programme[] = []) {
  let file: { id: number; echeance: number }[] = [];
  let maintenant = 0;
  let pendantUnTick = false;
  const armer = (programmes: readonly Programme[]): void => {
    for (const p of programmes) file.push({ id: p.id, echeance: maintenant + (p.delai || (pendantUnTick ? 1 : 0)) });
  };
  /** Reprend, tant que le prochain jeton de la file échoit au plus `jusqua`, ce jeton, l'horloge portée à son échéance. */
  const jouer = (jusqua: number, tick: boolean): number => {
    let reprises = 0;
    pendantUnTick = tick;
    try {
      for (;;) {
        file.sort((a, b) => a.echeance - b.echeance || a.id - b.id);
        const prochain = file[0];
        if (!prochain || prochain.echeance > jusqua) return reprises;
        if (reprises >= PLAFOND_DE_REPRISES) throw new Error(`[hôte] plus de ${PLAFOND_DE_REPRISES} reprises : la partie boucle`);
        file.shift();
        maintenant = prochain.echeance;
        armer(reprendre(prochain.id));
        reprises++;
      }
    } finally {
      pendantUnTick = false;
    }
  };
  /** Avance de `ms` (`tick`) : chaque jeton d'échéance au plus `maintenant + ms`, ceux que les reprises arment dans la
   *  fenêtre compris, puis l'horloge portée à `maintenant + ms`. */
  const avancer = (ms: number): number => {
    const cible = maintenant + ms;
    const reprises = jouer(cible, true);
    maintenant = cible;
    return reprises;
  };
  const echeances = () => file.map((p) => p.echeance);
  armer(premiers);
  return {
    /** Arme `programmes` à l'instant présent. */
    armer,
    /** Le nombre de jetons armés, non repris. */
    enAttente: (): number => file.length,
    /** Reprend tout, ceux que chaque reprise programme compris, jusqu'à ce qu'il n'en reste aucun. */
    vider: (): number => jouer(Infinity, false),
    avancer,
    /** Avance jusqu'à l'échéance du dernier jeton armé à l'appel (`runToLast`). */
    reprendreLesEnAttente: (): number => (file.length ? avancer(Math.max(...echeances()) - maintenant) : 0),
    /** Avance jusqu'à la prochaine échéance et la reprend entière, ex æquo compris (`next` puis `tick(0)`). */
    jusquALaProchaine: (): number => (file.length ? avancer(Math.min(...echeances()) - maintenant) : 0),
    /** Abandonne tous les jetons armés, sans les reprendre (`clearAllTimers`). */
    abandonner: (): void => { file = []; },
  };
}

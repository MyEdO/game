/**
 * LE GABARIT RÉSOLU d'un corps (#2972) : la carrure appliquée au squelette de référence.
 * Seule composition du gabarit — tout hôte la lit ici.
 */
import { findGabaritById, type GabaritId, type RaceAppearanceData } from '../../data';

export type RaceDuGabarit = Pick<RaceAppearanceData, 'gabarit' | 'gabaritOverride'>;
export type TrouverGabarit = (id: GabaritId) => ReturnType<typeof findGabaritById>;

/** Carrure résolue : tous les facteurs posés, `arms` et `head` à 1 quand le gabarit les tait. */
export interface GabaritResolu {
  sl: number;
  st: number;
  legs: number;
  arms: number;
  head: number;
}

function gabaritConnu(id: GabaritId, trouver: TrouverGabarit) {
  const g = trouver(id);
  if (!g) throw new Error(`gabaritResolu : « ${id} » n'est aucun gabarit de \`gabarits.json\`.`);
  return g;
}

/**
 * Un `gabarit` explicite remplace la carrure ENTIÈRE : la surcharge de la race, réglée pour son gabarit
 * par défaut, ne s'y applique pas. Sinon, le gabarit de la race recouvert par sa surcharge. Le
 * multiplicateur de jambes se compose en dernier (#3186).
 */
export function gabaritResolu({ gabarit, race, legsMult }: {
  gabarit?: GabaritId;
  race: RaceDuGabarit;
  legsMult: number;
}, trouver: TrouverGabarit = findGabaritById): GabaritResolu {
  const { sl, st, legs, arms = 1, head = 1 } = gabarit
    ? gabaritConnu(gabarit, trouver)
    : { ...gabaritConnu(race.gabarit.id, trouver), ...race.gabaritOverride };
  return { sl, st, legs: legs * legsMult, arms, head };
}

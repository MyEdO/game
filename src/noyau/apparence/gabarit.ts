/**
 * LE GABARIT RÉSOLU d'un corps (#2972) : la carrure appliquée au squelette de référence.
 * Seule composition du gabarit — tout hôte la lit ici.
 */
import { findGabaritById, type GabaritId, type SurchargeDeGabarit } from '../../data';

/** Carrure résolue : tous les facteurs posés, `arms` et `head` à 1 quand le gabarit les tait. */
export interface GabaritResolu {
  sl: number;
  st: number;
  legs: number;
  arms: number;
  head: number;
}

function gabaritConnu(id: GabaritId) {
  const g = findGabaritById(id);
  if (!g) throw new Error(`gabaritResolu : « ${id} » n'est aucun gabarit de \`gabarits.json\`.`);
  return g;
}

/**
 * Un `gabarit` explicite remplace la carrure ENTIÈRE : la surcharge de la race, réglée pour son gabarit
 * par défaut, ne s'y applique pas. Sinon, le gabarit de la race recouvert par sa surcharge. Le
 * multiplicateur de jambes (`Appearance.legs` × morpho des difformités) se compose en dernier.
 */
export function gabaritResolu({ gabarit, race, legsMult }: {
  gabarit?: GabaritId;
  race: { gabarit: { id: GabaritId }; gabaritOverride?: SurchargeDeGabarit };
  legsMult: number;
}): GabaritResolu {
  const { sl, st, legs, arms = 1, head = 1 } = gabarit
    ? gabaritConnu(gabarit)
    : { ...gabaritConnu(race.gabarit.id), ...race.gabaritOverride };
  return { sl, st, legs: legs * legsMult, arms, head };
}

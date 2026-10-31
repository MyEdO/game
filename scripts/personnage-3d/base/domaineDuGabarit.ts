import { gabarits, raceAppearance } from '../../../src/data/index.ts';
import { facteursDeComposition } from '../../../src/noyau/apparence/composition.ts';
import type { RaceDuGabarit } from '../../../src/noyau/apparence/gabarit.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';
import { CLES_DU_GABARIT, type BornesDuGabarit } from '../../../hotes/godot/asset/manifesteDeBase.ts';

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function domaineDuGabarit(catalogue: {
  readonly gabarits: readonly (typeof gabarits)[number][];
  readonly races: readonly RaceDuGabarit[];
} = { gabarits, races: raceAppearance }): BornesDuGabarit {
  const trouver = (id: (typeof gabarits)[number]['id']) => catalogue.gabarits.find((g) => g.id === id);
  const facteurs = catalogue.races.flatMap((race) => [undefined, ...catalogue.gabarits.map((g) => g.id)]
    .map((gabarit) => facteursDeComposition(gabarit, race, trouver)));
  return tableTotale(CLES_DU_GABARIT, (cle) => ({
    min: Math.min(1, ...facteurs.map((f) => f[cle])),
    max: Math.max(1, ...facteurs.map((f) => f[cle])),
  }));
}

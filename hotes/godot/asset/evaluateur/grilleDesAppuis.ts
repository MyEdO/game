import type { GabaritResolu } from '../../../../src/noyau/index.ts';
import { coinsDeSilhouettesAtteignables, sensCuitsDuGabarit } from '../gabarit.ts';
import { FACTEURS_NEUTRES } from '../facteursDuGabarit.ts';
import { CLES_DU_GABARIT, type ManifesteDeBase } from '../manifesteDeBase.ts';

export function grilleDesAppuis(manifeste: Pick<ManifesteDeBase, 'gabarit' | 'silhouettes'>) {
  let facteurs: GabaritResolu[] = [{ ...FACTEURS_NEUTRES }];
  const sens = sensCuitsDuGabarit(manifeste.gabarit.bornes);
  for (const cle of CLES_DU_GABARIT) facteurs = facteurs.flatMap((f) => [FACTEURS_NEUTRES[cle], ...sens.filter((s) => s.cle === cle).map((s) => s.extremite)].map((v) => ({ ...f, [cle]: v })));
  const silhouettes = coinsDeSilhouettesAtteignables(manifeste.gabarit, manifeste.silhouettes);
  return facteurs.flatMap((f) => silhouettes.map((s) => ({ facteurs: f, silhouettes: s })));
}

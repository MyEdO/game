/**
 * LE COMMERCE DE CARGAISON (#3371) : un verbe par geste — acheter, vendre, jeter un lot —, dont le marché ouvert
 * donne la formule : le port (MDG 15, `portFlow.ts`) ou la halle (MSRC 13, `landMarketFlow.ts`), le port d'abord comme
 * dans `SURFACES_HORS_PENDING` (`modalArbiter.ts`). Le porteur qui reçoit un achat est désigné ; un lot se désigne par
 * son `uid` (`CargoLot`).
 */
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { IdDeCargaison, IdDePorteurDeCargaison, IdDOffreDeCargaison } from './designations';
import { acheterAuPort, jeterAuPort, vendreAuPort } from './portFlow';
import { acheterALaHalle, jeterALaHalle, vendreALaHalle } from './landMarketFlow';

/** Les offres et les corps d'une formule de marché. */
interface FormuleDeMarche {
  offres: (s: Pick<Jeu, 'port' | 'landMarket'>) => readonly { cargoId: string; label: string }[];
  acheter: (get: Get, set: Set, porteurId: IdDePorteurDeCargaison, cargoId: IdDOffreDeCargaison, enc: number) => void;
  vendre: (get: Get, set: Set, lotId: IdDeCargaison) => void;
  jeter: (get: Get, set: Set, lotId: IdDeCargaison) => void;
}

const PORT: FormuleDeMarche = { offres: (s) => s.port?.offers ?? [], acheter: acheterAuPort, vendre: vendreAuPort, jeter: jeterAuPort };
const HALLE: FormuleDeMarche = { offres: (s) => s.landMarket?.offers ?? [], acheter: acheterALaHalle, vendre: vendreALaHalle, jeter: jeterALaHalle };

/** La formule du marché ouvert, `null` sans marché. */
const formuleOuverte = (s: Pick<Jeu, 'port' | 'landMarket'>): FormuleDeMarche | null => (s.port ? PORT : s.landMarket ? HALLE : null);

/** Les offres du marché ouvert. */
export const offresDeCargaison = (s: Pick<Jeu, 'port' | 'landMarket'>): readonly { cargoId: string; label: string }[] =>
  formuleOuverte(s)?.offres(s) ?? [];

export function creerActionsDeLaCargaison(get: Get, set: Set) {
  return {
    acheterLaCargaison: (porteurId, cargoId, enc) => formuleOuverte(get())?.acheter(get, set, porteurId, cargoId, enc),
    vendreLaCargaison: (lotId) => formuleOuverte(get())?.vendre(get, set, lotId),
    jeterLaCargaison: (lotId) => formuleOuverte(get())?.jeter(get, set, lotId),
  } satisfies FabriqueDuNoyau;
}

/**
 * LA PROCÉDURE DU ROSTER d'un hôte (#3041), sur le `Stockage` qu'il fournit : charger, ajouter, retirer, mettre à
 * jour un héros. La forme et ses transformations sont celles du noyau (`noyau/persistance/roster.ts`). Tout
 * chargement qui retire ou élague le roster stocké écrit son TÉMOIN dans le même `Stockage` (#1463 LD.1), quel
 * que soit le geste qui charge ; `prendreLesTemoinsDuRoster` le consomme. Un stockage absent (`null`) ou qui
 * lève : le roster est vide, l'écriture ne se fait pas.
 */
import { cumulerLesRetraits, ecrireLeRoster, lireLesRetraits, lireLeRoster, rosterAvecLeHeros, type Combatant, type RetraitsDElagage, type RosterEntry } from '../noyau/index';
import type { Stockage } from '../lib/stockage';
import { prendreLeTemoin, temoigner, type FormeDeTemoin } from './temoin';

const CLE = 'wfrp4.roster';
const CLE_TEMOINS = 'wfrp4.roster.temoins';

/** Les retraits constatés par les chargements du roster, cumulés jusqu'à leur prise : `retire` : un roster d'un
 *  autre format, ou illisible, est sorti du stockage ; `elagage` : les ids élagués de ses héros (#1463 LD.1). */
export interface TemoinsDuRoster {
  retire: boolean;
  elagage: RetraitsDElagage | null;
}

const TEMOINS_DU_ROSTER: FormeDeTemoin<TemoinsDuRoster> = {
  lire: (v) => {
    if (v === null || typeof v !== 'object') return null;
    const t = v as Partial<Record<keyof TemoinsDuRoster, unknown>>;
    return { retire: t.retire === true, elagage: lireLesRetraits(t.elagage) };
  },
  cumuler: (avant, nouveau) => ({
    retire: !!avant?.retire || nouveau.retire,
    elagage: cumulerLesRetraits(avant?.elagage ?? null, nouveau.elagage),
  }),
};

/** Le roster de `stockage` ; ce que son chargement retire ou élague est témoigné (`TemoinsDuRoster`). */
export function chargerLeRoster(stockage: Stockage | null): RosterEntry[] {
  const brut = lire(stockage, CLE);
  if (!brut) return [];
  const lu = lireLeRoster(brut);
  if (!lu) {
    try {
      stockage?.removeItem(CLE);
    } catch {
      // stockage indisponible : rien à supprimer
    }
    temoigner(stockage, CLE_TEMOINS, TEMOINS_DU_ROSTER, { retire: true, elagage: null });
    return [];
  }
  if (lu.retraits) {
    ecrire(stockage, lu.heros);
    temoigner(stockage, CLE_TEMOINS, TEMOINS_DU_ROSTER, { retire: false, elagage: lu.retraits });
  }
  return lu.heros;
}

/** Les témoins cumulés du roster de `stockage`, RETIRÉS du stockage : `null` sans retrait depuis la dernière prise. */
export function prendreLesTemoinsDuRoster(stockage: Stockage | null): TemoinsDuRoster | null {
  return prendreLeTemoin(stockage, CLE_TEMOINS, TEMOINS_DU_ROSTER);
}

/** Ajoute `entry` au roster de `stockage`, en remplaçant l'entrée du même héros. */
export function ajouterAuRoster(stockage: Stockage | null, entry: RosterEntry): void {
  ecrire(stockage, [...chargerLeRoster(stockage).filter((e) => e.hero.id !== entry.hero.id), entry]);
}

/** Retire du roster de `stockage` l'entrée du héros `heroId`. */
export function retirerDuRoster(stockage: Stockage | null, heroId: string): void {
  ecrire(stockage, chargerLeRoster(stockage).filter((e) => e.hero.id !== heroId));
}

/** Met à jour l'entrée du héros `hero` DÉJÀ au roster de `stockage` (`rosterAvecLeHeros`) ; un héros absent n'y
 *  entre pas. Le service `persisterLeHeros` d'un hôte qui a un stockage (`EntreesDeLaPartie`). */
export function mettreAJourLeRoster(stockage: Stockage | null, hero: Combatant): void {
  const heros = rosterAvecLeHeros(chargerLeRoster(stockage), hero);
  if (heros) ecrire(stockage, heros);
}

function lire(stockage: Stockage | null, cle: string): string | null {
  try {
    return stockage?.getItem(cle) ?? null;
  } catch {
    return null;
  }
}

function ecrire(stockage: Stockage | null, heros: RosterEntry[]): void {
  try {
    stockage?.setItem(CLE, ecrireLeRoster(heros));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas la création pour ça
  }
}

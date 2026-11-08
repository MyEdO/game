/**
 * LA PROCÉDURE DU ROSTER d'un hôte (#3041), sur le `Stockage` qu'il fournit : charger, ajouter, importer, retirer, mettre à
 * jour, engager un héros. La forme et ses transformations sont celles du noyau (`noyau/persistance/roster.ts`). Tout
 * chargement qui retire ou élague le roster stocké écrit son TÉMOIN dans le même `Stockage` (#1463 LD.1), quel
 * que soit le geste qui charge ; `prendreLesTemoinsDuRoster` le consomme. Un stockage absent (`null`) ou qui
 * lève : le roster est vide, l'écriture ne se fait pas.
 */
import {
  cumulerLesRetraits, ecrireLeRoster, engagement, lireLesRetraits, lireLeRoster, refusDEngagement, rosterAvecLeHeros,
  type Combatant, type CreatorDraft, type FabriqueDId, type JeuDuNoyau, type RetraitsDElagage, type RosterEntry,
} from '../noyau/index';
import { lireLeTexte, retirerLaCle, type Stockage } from '../lib/stockage';
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
  const brut = lireLeTexte(stockage, CLE);
  if (!brut) return [];
  const lu = lireLeRoster(brut);
  if (!lu) {
    retirerLaCle(stockage, CLE);
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

/** Importe `entry` au roster de `stockage` : un héros dont l'id y est déjà prend un id neuf de `idDuRoster`, au lieu
 *  d'écraser l'autre (#2907). */
export function importerAuRoster(stockage: Stockage | null, entry: RosterEntry, idDuRoster: FabriqueDId): void {
  const heros = chargerLeRoster(stockage);
  const hero = heros.some((e) => e.hero.id === entry.hero.id) ? { ...entry.hero, id: idDuRoster('hero') } : entry.hero;
  ecrire(stockage, [...heros, { ...entry, hero }]);
}

/** Le jeu qu'engager lit et appelle, sans le compteur d'ids de l'état, que seul l'hôte écrit. */
type JeuDeLEngagement = Omit<JeuDuNoyau, 'forgerUnId'>;

/** ENGAGE le brouillon `d` dans le groupe de `jeu` (#3059) : refusé par `refusDEngagement`, rendu sans rien écrire ;
 *  sinon son entrée (`engagement`) entre au roster de `stockage`, aux ids de `idDuRoster`, l'entropie de la plateforme
 *  (#2907) : le roster traverse parties, sessions et sièges. Puis le brouillon entre au groupe sous l'id de son entrée,
 *  où le noyau bâtit le héros, en place de `heroId` (`remplacerLeHeros`) ou ajouté avec sa Richesse (`recruterLeHeros`).
 *  `null` : engagé. */
export function engagerLeHeros(stockage: Stockage | null, jeu: JeuDeLEngagement, d: CreatorDraft, idDuRoster: FabriqueDId, heroId?: string): string | null {
  const refus = refusDEngagement(jeu, d, heroId);
  if (refus) return refus;
  const entree = engagement(d, idDuRoster, heroId);
  ajouterAuRoster(stockage, entree);
  const heros = { brouillon: d, id: entree.hero.id };
  if (heroId) jeu.remplacerLeHeros(heroId, heros);
  else jeu.recruterLeHeros(heros);
  return null;
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

function ecrire(stockage: Stockage | null, heros: RosterEntry[]): void {
  try {
    stockage?.setItem(CLE, ecrireLeRoster(heros));
  } catch {
    // quota plein / stockage indisponible : on ne casse pas la création pour ça
  }
}

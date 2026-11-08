/**
 * LA PROCÉDURE DU ROSTER d'un hôte (#3041), sur le `Stockage` qu'il fournit : charger, ajouter, retirer, mettre à
 * jour, engager un héros. La forme et ses transformations sont celles du noyau (`noyau/persistance/roster.ts`). Tout
 * chargement qui retire ou élague le roster stocké écrit son TÉMOIN dans le même `Stockage` (#1463 LD.1), quel
 * que soit le geste qui charge ; `prendreLesTemoinsDuRoster` le consomme. Un stockage absent (`null`) ou qui
 * lève : le roster est vide, l'écriture ne se fait pas.
 */
import {
  cumulerLesRetraits, ecrireLeRoster, engagement, idDeRosterDuHeros, lireLesRetraits, lireLeRoster, refusDEngagement,
  rosterAvecLeHeros, type Combatant, type CreatorDraft, type FabriqueDuRoster, type JeuDuNoyau, type RetraitsDElagage,
  type RosterEntry,
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

/** Le jeu qu'engager lit et appelle, sans le compteur d'ids de l'état, que seul l'hôte écrit. */
type JeuDeLEngagement = Omit<JeuDuNoyau, 'forgerUnId'>;

/** ENGAGE le brouillon `d` dans le groupe de `jeu` (#3059) : refusé par `refusDEngagement`, rendu sans rien écrire ;
 *  sinon son entrée (`engagement`) entre au roster de `stockage`, aux ids de `idDuRoster`, l'entropie de la plateforme
 *  (#2907) : le roster traverse parties, sessions et sièges. Puis le brouillon entre au groupe, où le noyau bâtit le
 *  héros : ajouté avec sa Richesse sous l'id de son entrée (`recruterLeHeros`), ou, en édition, en place du héros
 *  `heroId` qui garde son id (`remplacerLeHeros`). Le héros édité garde son entrée de roster (`idDeRosterDuHeros`), ou
 *  en reçoit une neuve, que son `idDeRoster` désigne quand son id n'est pas celui de l'entrée. `null` : engagé. */
export function engagerLeHeros(stockage: Stockage | null, jeu: JeuDeLEngagement, d: CreatorDraft, idDuRoster: FabriqueDuRoster, heroId?: string): string | null {
  const refus = refusDEngagement(jeu, d, heroId);
  if (refus) return refus;
  const edite = heroId === undefined ? undefined : jeu.party.find((h) => h.id === heroId);
  const entree = engagement(d, idDuRoster, edite && idDeRosterDuHeros(chargerLeRoster(stockage), edite));
  ajouterAuRoster(stockage, entree);
  if (!heroId) {
    jeu.recruterLeHeros({ brouillon: d, id: entree.hero.id });
    return null;
  }
  jeu.remplacerLeHeros(heroId, { brouillon: d, id: heroId, ...(entree.hero.id === heroId ? {} : { idDeRoster: entree.hero.id }) });
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

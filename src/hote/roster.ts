/**
 * LA PROCÉDURE DU ROSTER d'un hôte (#3041), sur le `Stockage` qu'il fournit : charger, montrer, ajouter, retirer,
 * mettre à jour, engager un héros, l'exporter en fichier, en importer un. La forme et ses transformations sont celles du noyau
 * (`noyau/persistance/roster.ts`). Tout chargement qui retire ou élague le roster stocké écrit son TÉMOIN dans le
 * même `Stockage` (#1463 LD.1), quel que soit le geste qui charge ; `prendreLesTemoinsDuRoster` le consomme. Un
 * stockage absent (`null`) ou qui lève : le roster est vide, l'écriture ne se fait pas.
 */
import {
  cumulerLesRetraits, ecrireLeRoster, engagement, idDeRosterDuHeros, intentionDEngagement, lireLesRetraits, lireLeRoster,
  nommerLesRetraits, refusDEngagement, rosterAvecLeHeros, rosterExport, rosterImport, type Combatant, type CreatorDraft,
  type FabriqueDuRoster, type IntentionDEngagement, type Jeu, type RetraitsDElagage, type RosterEntry,
} from '../noyau/index';
import { t } from '../i18n';
import { fileSlug } from '../lib/normalize';
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

/** Ce que disent les témoins `temoins` du roster : ses héros élagués, sinon son retrait ; `null` sans témoin. */
export function avisDuRoster(temoins: TemoinsDuRoster | null): string | null {
  if (temoins?.elagage) return t('picker.roster.elague', { liste: nommerLesRetraits(temoins.elagage) });
  return temoins?.retire ? t('picker.roster.retire') : null;
}

/** Le roster qu'un écran montre : ses entrées, et l'avis de ce que leur chargement a retiré (`null` : rien). */
export interface RosterMontre {
  heros: readonly RosterEntry[];
  avis: string | null;
}

/** Le roster d'un écran qui n'en montre aucun. */
export const SANS_ROSTER: RosterMontre = { heros: [], avis: null };

/** Le roster de `stockage` à montrer : ses entrées, et l'avis des témoins de son chargement (`avisDuRoster`), pris ;
 *  sans témoin neuf, l'avis `dit` jusque-là reste. */
export function rosterAMontrer(stockage: Stockage | null, dit: string | null): RosterMontre {
  const heros = chargerLeRoster(stockage);
  return { heros, avis: avisDuRoster(prendreLesTemoinsDuRoster(stockage)) ?? dit };
}

/** Ajoute `entry` au roster de `stockage`, en remplaçant l'entrée du même héros. */
export function ajouterAuRoster(stockage: Stockage | null, entry: RosterEntry): void {
  ecrire(stockage, [...chargerLeRoster(stockage).filter((e) => e.hero.id !== entry.hero.id), entry]);
}

/** ENGAGE le brouillon `d` dans le groupe de `etat` (#3059) : refusé par `refusDEngagement`, rendu `{ refus }` sans
 *  rien écrire ; sinon son entrée (`engagement`) entre au roster de `stockage`, aux ids de `idDuRoster`, l'entropie de
 *  la plateforme (#2907) : le roster traverse parties, sessions et sièges. L'`intention` rendue
 *  (`intentionDEngagement`, surface du noyau), que l'hôte envoie à sa partie, fait entrer le brouillon au groupe, où le
 *  noyau bâtit le héros : ajouté avec sa Richesse sous l'id de son entrée, ou, en édition, en place du héros `heroId`,
 *  qui garde son id. Le héros édité garde son entrée de roster (`idDeRosterDuHeros`), ou en reçoit une neuve. */
export function engagerLeHeros(stockage: Stockage | null, etat: Pick<Jeu, 'battle' | 'party' | 'net'>, d: CreatorDraft, idDuRoster: FabriqueDuRoster, heroId?: string): { refus: string } | { intention: IntentionDEngagement } {
  const refus = refusDEngagement(etat, d, heroId);
  if (refus) return { refus };
  const edite = heroId === undefined ? undefined : etat.party.find((h) => h.id === heroId);
  const entree = engagement(d, idDuRoster, edite && idDeRosterDuHeros(chargerLeRoster(stockage), edite));
  ajouterAuRoster(stockage, entree);
  return { intention: intentionDEngagement(d, entree.hero.id, heroId) };
}

/** Retire du roster de `stockage` l'entrée du héros `heroId`. */
export function retirerDuRoster(stockage: Stockage | null, heroId: string): void {
  ecrire(stockage, chargerLeRoster(stockage).filter((e) => e.hero.id !== heroId));
}

/** Un fichier qu'un hôte remet au joueur : son nom, son texte. */
export interface FichierARemettre {
  nom: string;
  texte: string;
}

/** Le fichier d'export du héros `heroId` du roster de `stockage` (`rosterExport`), nommé de son nom ; `null` si le
 *  roster ne le porte pas. */
export function fichierDuHeros(stockage: Stockage | null, heroId: string): FichierARemettre | null {
  const entree = chargerLeRoster(stockage).find((e) => e.hero.id === heroId);
  return entree ? { nom: `wfrp4-perso-${fileSlug(entree.hero.label)}.json`, texte: rosterExport(entree) } : null;
}

/** Importe au roster de `stockage` le héros du fichier d'export `texte` (`rosterImport`), en remplaçant l'entrée du
 *  même héros : `{ refus }`, l'erreur d'un fichier refusé, rien n'étant écrit ; sinon `{ avis }`, ce que l'élagage a
 *  retiré du héros importé, `null` s'il entre entier. */
export function importerAuRoster(stockage: Stockage | null, texte: string): { refus: string } | { avis: string | null } {
  const lu = rosterImport(texte);
  if (!lu.entry) return { refus: lu.error };
  ajouterAuRoster(stockage, lu.entry);
  return { avis: lu.retraits ? t('picker.import.elague', { liste: nommerLesRetraits(lu.retraits) }) : null };
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

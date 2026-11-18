/**
 * LE COMBAT DU DÔME (#4411) : ce que les états de la famille combat partagent : les combattants de la cour, les tours
 * qui s'y jouent, les gestes d'un jet avant et après le dé, les réserves des deux héros (`../combat/socle.js`).
 */
import type { Combat, Combattant, EntreeDuJournal, Geste, Reserve } from './maquette.ts';

/** Les combattants de la cour. */
export const COMBATTANTS: Record<string, Combattant> = {
  ilyanwe: { nom: 'Ilyanwe la Voilée', buste: 'ilyanwe', ennemi: false, blessures: 17, max: 17, etats: [] },
  berta: { nom: 'Berta', buste: 'berta', ennemi: false, blessures: 12, max: 12, etats: [] },
  orc: { nom: 'Orc', buste: 'orc', ennemi: true, blessures: 14, max: 14, etats: [] },
  gobelin: { nom: 'Tireur gobelin', buste: 'gobelin', ennemi: true, blessures: 11, max: 11, etats: [] },
  chamane: { nom: 'Chamane gobelin', buste: 'gobelin', ennemi: true, blessures: 11, max: 11, etats: [] },
};

/** Les lignes du journal que les tours du dôme répètent. */
export const DIT = {
  gobelin: 'Tireur gobelin maîtrise sa psychologie (Animosité).',
  orc: 'Orc maîtrise sa psychologie (Animosité).',
  charge: 'Ilyanwe la Voilée charge Orc (+1 Avantage).',
  tir: 'Tireur gobelin tire sur Berta et la manque.',
  defensive: 'Berta se met en Défensive.',
};

/** Un tour du premier round : le `rang`-ième des `sur` tours, l'ordre à jouer, l'actif en tête, le journal. */
const tour = (rang: number, sur: number, ordre: string[], journal: EntreeDuJournal[]): Combat => ({ round: 1, tour: { rang, sur }, ordre, suivant: ['ilyanwe', 'berta'], journal });

/** Le tour d'Ilyanwe, dont le journal dit `journal`. */
export const TOUR_D_ILYANWE = (journal: EntreeDuJournal[] = [DIT.gobelin, DIT.orc, DIT.charge]): Combat => tour(1, 4, ['ilyanwe', 'berta', 'gobelin', 'orc'], journal);
/** Le tour de Berta. */
export const TOUR_DE_BERTA = (journal: EntreeDuJournal[]): Combat => tour(2, 4, ['berta', 'gobelin', 'orc'], journal);
/** Le tour de l'Orc, le dernier du round. */
export const TOUR_DE_L_ORC = (journal: EntreeDuJournal[]): Combat => tour(4, 4, ['orc'], journal);
/** Le tour `rang` sur `sur` de l'ordre `ordre`. */
export const TOUR = tour;

/** Les raisons de fermeture des gestes d'un jet (`src/i18n/messages/fr.ts:146-149`). */
const FERME = { jetReussi: 'Le jet est réussi.', dejaRelance: 'Ce Test a déjà été relancé.', sansChance: 'Plus de Point de Chance.', sansResilience: 'Plus de Point de Résilience.' };

/** Les réserves d'un héros. */
export interface Reserves {
  chance: number;
  resilience: number;
  determination: number;
}
/** Les réserves des deux héros de la cour ; Ilyanwe : la fiche validée (`../../../maquettes/fiche-du-heros.jpg`). */
export const RESERVES: Record<'ilyanwe' | 'berta', Reserves> = { ilyanwe: { chance: 4, resilience: 3, determination: 3 }, berta: { chance: 2, resilience: 1, determination: 1 } };

/** Les trois réserves d'un héros, à gauche des gestes qui les dépensent. */
export const reserves = ({ chance, resilience, determination }: Reserves): Reserve[] => [
  { nom: 'Chance', valeur: chance },
  { nom: 'Résilience', valeur: resilience },
  { nom: 'Détermination', valeur: determination },
];

/** Un geste fermé de la raison `refus`, ouvert sans elle ; `survol`, la raison se lit. */
const ferme = (libelle: string, refus: string | null, survol: boolean): Geste => ({ libelle, ...(refus ? { refus } : {}), ...(survol ? { survol: true } : {}) });

/** Les gestes d'un jet avant le dé : « Lancer », « Résilience », « Annuler » quand le flux le permet (LDB 17 l.68). */
export const avantLeDe = (r: Reserves, { annuler = false } = {}): Geste[] => [
  { libelle: 'Lancer', principal: true },
  ferme('Résilience', r.resilience > 0 ? null : FERME.sansResilience, false),
  ...(annuler ? [{ libelle: 'Annuler' }] : []),
];

/** Les gestes d'un jet après le dé : « Appliquer », « Relancer », « Chance : +1 DR », « Pacte », « Résilience »,
 *  fermés sur une réussite, un Test déjà relancé ou une réserve vide (LDB 17 l.23-24, l.68) ; `survol`, le geste fermé
 *  dont la raison se lit. */
export const apresLeDe = (r: Reserves, { echec = false, relance = false, survol = null as 'relancer' | null } = {}): Geste[] => [
  { libelle: 'Appliquer', principal: true },
  ferme('Relancer', relance ? FERME.dejaRelance : !echec ? FERME.jetReussi : r.chance > 0 ? null : FERME.sansChance, survol === 'relancer'),
  ferme('Chance : +1 DR', r.chance > 0 ? null : FERME.sansChance, false),
  { libelle: 'Pacte' },
  ferme('Résilience', !echec ? FERME.jetReussi : r.resilience > 0 ? null : FERME.sansResilience, false),
];

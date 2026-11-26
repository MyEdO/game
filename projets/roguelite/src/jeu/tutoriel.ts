/**
 * Le tutoriel d'une partie neuve : des quêtes courtes et successives qui mènent le joueur aux écrans du hameau, puis
 * à travers sa première expédition. Chaque quête se solde par l'état de la partie ou par l'écran ouvert ; la
 * dernière soldée, le tutoriel s'efface. Quêtes, ordre et textes : valeurs d'adaptation, MyEdO/game#5129.
 */
import type { Etat } from './etat';
import type { IdBatiment } from './valeurs';
import { noter } from './outils';

/** Un écran que le tutoriel demande d'ouvrir (un bâtiment, le départ préparé au Cartographe), ou le retour d'une
 *  expédition. */
export type EcranVu = IdBatiment | 'depart' | 'retour';
/** `vus` : les écrans que le joueur a ouverts et les retours qu'il a vécus depuis le début de la partie. */
export interface Tutoriel { vus: EcranVu[] }

/** `mene` : l'écran que le geste de la quête ouvre ; sans lui, la quête se joue sur l'écran où l'on est. */
export interface Quete { id: string; titre: string; consigne: string; mene?: IdBatiment | 'depart'; soldee: (e: Etat) => boolean }

const vu = (e: Etat, ecran: EcranVu): boolean => !!e.tutoriel?.vus.includes(ecran);
const dejaParti = (e: Etat): boolean => !!e.expedition || vu(e, 'retour');

export const QUETES: readonly Quete[] = [
  { id: 'auberge', titre: 'Le hameau en ruine', mene: 'relais',
    consigne: 'Seuls l’Auberge, la Forge et le Cartographe tiennent debout. L’auberge engage et loge vos héros.',
    soldee: (e) => vu(e, 'relais') },
  { id: 'forge', titre: 'S’équiper', mene: 'forge',
    consigne: 'La Forge vend armes et armures : comparez-les à ce que porte chaque héros.',
    soldee: (e) => vu(e, 'forge') },
  { id: 'route', titre: 'Choisir une route', mene: 'cartographe',
    consigne: 'Le Cartographe connaît la lisière du Reikwald : préparez-y le départ.',
    soldee: (e) => vu(e, 'depart') || dejaParti(e) },
  { id: 'partir', titre: 'Partir', mene: 'depart',
    consigne: 'Choisissez quatre héros par rôle : front, tireur, soigneur, lanceur. Puis partez.',
    soldee: dejaParti },
  { id: 'salle', titre: 'Franchir une salle',
    consigne: 'Avancez. Dans une salle à choix, le héros que vous désignez tente l’action et en subit l’échec.',
    soldee: (e) => !!e.expedition?.salles.some((s) => s.faite) || vu(e, 'retour') },
  { id: 'rentrer', titre: 'Rentrer à temps',
    consigne: 'Rentrez avant que le groupe ne tombe : l’or, les trophées et les PX reviennent avec lui.',
    soldee: (e) => vu(e, 'retour') },
  { id: 'batir', titre: 'Relever une ruine', mene: 'temple',
    consigne: 'L’or rapporté relève les ruines : l’Hospice soigne, la Salle d’armes fait progresser.',
    soldee: (e) => e.batiments.temple > 0 || e.batiments.salle > 0 || e.batiments.peage > 0 },
];

/** La quête en cours : la première que la partie n'a pas soldée ; `null` sans tutoriel. */
export const queteEnCours = (e: Etat): Quete | null => (e.tutoriel ? QUETES.find((q) => !q.soldee(e)) ?? null : null);

/** Note l'écran ouvert ou le retour vécu ; si plus aucune quête n'attend, le tutoriel s'efface. */
export function voir(e: Etat, ecran: EcranVu): void {
  if (!e.tutoriel) return;
  if (!e.tutoriel.vus.includes(ecran)) e.tutoriel.vus.push(ecran);
  solderLeTutoriel(e);
}

/** Efface le tutoriel dont toutes les quêtes sont soldées, et le dit à la chronique. */
export function solderLeTutoriel(e: Etat): void {
  if (!e.tutoriel || queteEnCours(e)) return;
  e.tutoriel = null;
  noter(e, 'La compagnie connaît le métier : à elle de relever Grisefosse.');
}

/** Passe le tutoriel, depuis les réglages. */
export function passerLeTutoriel(e: Etat): void { e.tutoriel = null; }

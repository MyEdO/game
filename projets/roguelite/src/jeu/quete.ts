/**
 * Les quêtes de la partie, successives, en étapes qui mènent le joueur aux écrans : d'abord le tutoriel d'une partie
 * neuve (le hameau, puis la première expédition), puis une quête par route, l'ouvrir au Cartographe et en vaincre le
 * maître, jusqu'à la dernière, abattre l'Autel du Chaos. Chaque étape se solde par l'état de la partie ou par l'écran
 * ouvert. Quêtes, étapes, ordre et textes : valeurs d'adaptation, MyEdO/game#5129.
 */
import type { Etat } from './etat';
import { DESTINATIONS, type IdBatiment } from './valeurs';
import { noter } from './outils';

/** Un écran que le tutoriel demande d'ouvrir (un bâtiment, le départ préparé au Cartographe), ou le retour d'une
 *  expédition. */
export type EcranVu = IdBatiment | 'depart' | 'retour';
/** `vus` : les écrans que le joueur a ouverts et les retours qu'il a vécus depuis le début de la partie. */
export interface Tutoriel { vus: EcranVu[] }

/** `quete` : le nom de la quête dont l'étape fait partie ; `mene` : l'écran que le geste de l'étape ouvre, sans lui
 *  l'étape se joue sur l'écran où l'on est. */
export interface Etape { id: string; quete: string; titre: string; consigne: string; mene?: IdBatiment | 'depart'; soldee: (e: Etat) => boolean }

/** Le nom de la quête de la route `d`, la `i`-ième : la dernière abat l'Autel. */
const quete = (d: (typeof DESTINATIONS)[number], i: number): string => (i === DESTINATIONS.length - 1 ? `Abattre l’${d.nom}` : d.nom);

const vu = (e: Etat, ecran: EcranVu): boolean => !!e.tutoriel?.vus.includes(ecran);
const dejaParti = (e: Etat): boolean => !!e.expedition || vu(e, 'retour');

/** La première quête d'une partie neuve, le tutoriel. */
const RELEVER_GRISEFOSSE = 'Relever Grisefosse';
export const TUTORIEL: readonly Etape[] = ([
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
    soldee: (e) => e.batiments.temple > 0 || e.batiments.salle > 0 },
] satisfies Omit<Etape, 'quete'>[]).map((q) => ({ ...q, quete: RELEVER_GRISEFOSSE }));

/** Les quêtes des routes, une par route jusqu'à l'Autel, qui porte la dernière : la route fermée s'ouvre au
 *  Cartographe, puis son maître se vainc. */
export const ROUTES: readonly Etape[] = DESTINATIONS.flatMap((d, i): Etape[] => [
  ...(d.palier ? [{ id: `ouvrir-${d.id}`, quete: quete(d, i), titre: 'Ouvrir la route', mene: 'cartographe' as const,
    consigne: 'Le Cartographe ouvre la route suivante contre de l’or et des trophées rapportés.',
    soldee: (e: Etat) => e.batiments.cartographe >= d.palier }] : []),
  { id: `maitre-${d.id}`, quete: quete(d, i), titre: 'Vaincre son maître', mene: 'depart',
    consigne: d.recit,
    soldee: (e) => e.bossVaincus.includes(d.id) },
]);

/** L'étape en cours : la première que la partie n'a pas soldée, le tutoriel d'abord s'il court ; `null` une fois
 *  l'Autel abattu. Sa quête est la quête en cours. */
export const etapeEnCours = (e: Etat): Etape | null => (e.tutoriel ? [...TUTORIEL, ...ROUTES] : ROUTES).find((q) => !q.soldee(e)) ?? null;

/** Note l'écran ouvert ou le retour vécu ; le tutoriel soldé s'efface. */
export function voir(e: Etat, ecran: EcranVu): void {
  if (!e.tutoriel) return;
  if (!e.tutoriel.vus.includes(ecran)) e.tutoriel.vus.push(ecran);
  solderLeTutoriel(e);
}

/** Efface le tutoriel dont toutes les étapes sont soldées, et le dit à la chronique. */
export function solderLeTutoriel(e: Etat): void {
  if (!e.tutoriel || !TUTORIEL.every((q) => q.soldee(e))) return;
  e.tutoriel = null;
  noter(e, 'La compagnie connaît le métier : à elle de relever Grisefosse.');
}

/** Passe le tutoriel, depuis les réglages. */
export function passerLeTutoriel(e: Etat): void { e.tutoriel = null; }

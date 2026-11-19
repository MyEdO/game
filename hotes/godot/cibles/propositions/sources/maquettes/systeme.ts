/**
 * LE SYSTÈME (#4411) : l'instant de la partie en cours et la séance de la compagnie, communs aux écrans posés hors du jeu
 * (menu de la partie, sauvegardes, fin de séance, fin de chapitre). Motivations et Ambitions écrites : les exemples de
 * LDB 05 l.444, l.776-778, l.786-788 ; ce qu'octroie une Ambition accomplie : LDB 05 l.795-799, l.837-841.
 */
import type { HerosDeLaSeance, Instant, Seance } from './maquette.ts';

/** L'instant de la partie en cours. */
export const MAINTENANT: Instant = { lieu: 'Steinbruck', jour: 14, mois: 'Pflugzeit', annee: 2512, heure: '18:20' };

const HEROS: HerosDeLaSeance[] = [
  { id: 'bjorn', nom: 'Bjorn', carriere: 'Chasseur', motivation: '« Amateur de sensations fortes »', courte: 'Venger un camarade tombé au combat.', longue: 'Posséder votre propre relais de diligences.', determination: { n: 1, sur: 1 }, coches: { courte: true }, nouvelle: 'courte' },
  { id: 'mira', nom: 'Mira', carriere: 'Éclaireuse', motivation: '« Rebelle »', courte: 'Ruiner la réputation d’un rival amoureux.', longue: 'Faire de votre village une ville prospère', determination: { n: 1, sur: 2 }, coches: { motivation: true } },
  { id: 'aldric', nom: 'Aldric', carriere: 'Érudit', motivation: '« Esprit brillant »', courte: 'Se lier d’amitié avec un érudit solitaire', longue: 'Débarrasser les Collèges de Magie de l’influence des elfes.', determination: { n: 1, sur: 1 }, coches: {} },
  { id: 'greta', nom: 'Greta Hartmann', carriere: 'Soldate', motivation: '« Protectrice »', determination: { n: 2, sur: 2 }, coches: {} },
];

/** La séance de la compagnie : l'Ambition de groupe à court terme accomplie ; `chance`, la phrase de la Chance. */
export const seance = (chance: string): Seance => ({ heros: HEROS, groupe: { courte: true }, px: { courte: 50, longue: 500 }, chance });

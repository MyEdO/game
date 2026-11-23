/**
 * Les outils internes de la boucle de jeu : tirage à graine, journal, recherche d'un héros, appel au noyau. Jamais
 * exposés hors de `jeu/`, sauf le refus d'un prix (`refusDuPrix`), que l'interface dit avant le clic.
 */
import { makeRNG, type RNG, auHameau, type Geste } from '../noyau';

import { PROFILS, Profil } from './valeurs';
import { Etat, Heros } from './etat';

export const tirer = (e: Etat): RNG => makeRNG(e.graine++);

export const choisir = <T>(rng: RNG, l: readonly T[]): T => l[rng.int(0, l.length - 1)];

/** Le refus d'un prix que `avoir` ne couvre pas, `null` s'il le couvre : l'interface le dit avant le clic, le geste au clic. */
export const refusDuPrix = (avoir: number, prix: number, monnaie: 'CO' | 'PX' = 'CO'): string | null => (avoir < prix ? `Il faut ${prix} ${monnaie}.` : null);

export const noter = (e: Etat, ligne: string) => { e.journal = [`Jour ${e.jour} — ${ligne}`, ...e.journal].slice(0, 40); };

export const heros = (e: Etat, id: string): Heros | undefined => e.roster.find((h) => h.c.id === id);

export const profil = (id: string): Profil | undefined => PROFILS.find((p) => p.id === id);

/** Joue `gestes` du noyau sur le héros `h` et le remplace par ce que le noyau rend ; rend la dernière ligne écrite. */
export function auNoyau(e: Etat, h: Heros, gestes: Geste[]): string {
  const r = auHameau([h.c], gestes, e.graine++);
  h.c = r.groupe[0];
  return r.journal[r.journal.length - 1] ?? '';
}

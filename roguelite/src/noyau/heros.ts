/**
 * Les héros hors d'une partie : la recrue que le moteur crée, ses Caractéristiques, ses libellés.
 */
import { createHero } from '../../../src/engine/character';
import { fabriqueLocale } from '../../../src/engine/fabriqueDId';
import { effectiveChar } from '../../../src/engine/characteristics';
import { findCareerById, characteristics, conditionLabel } from '../../../src/data';
import type { Combatant, CharKey } from '../../../src/engine/types';

/** Ce qui fait l'identité d'une recrue à sa création : le Talent de carrière choisi (et sa spécialisation : le dieu
 *  d'un Béni), les Sorts mineurs d'un lanceur. */
export interface Identite { talent: { id: string; spec?: string }; sortsMineurs?: readonly string[] }

/** Un héros neuf de la carrière `carriere`, tiré par la création du moteur (`createHero`) à la graine `graine`. */
export function nouvelleRecrue(graine: number, carriere: string, espece: string, nom: string, identite: Identite): Combatant {
  return createHero({
    idNeuf: fabriqueLocale(`r${graine}`), speciesId: espece, careerId: carriere, label: nom, seed: graine,
    careerTalent: identite.talent, ...(identite.sortsMineurs ? { pettySpells: [...identite.sortsMineurs] } : {}),
  });
}

/** Valeur courante d'une Caractéristique, Augmentations et effets compris. */
export const carac = (c: Combatant, k: CharKey): number => effectiveChar(c, k);


/** Hors de combat : à 0 PB ou Inconscient. */
export const horsDeCombat = (c: Combatant): boolean => !!c.dead || c.wounds.current <= 0 || c.conditions.some((e) => e.id === 'inconscient');

/** Libellé d'une carrière (`careers.json`). */
export const nomDeCarriereDuLivre = (id: string): string => findCareerById(id)?.label ?? id;

/** Abréviation et libellé d'une Caractéristique, tels que la donnée les porte (`characteristics.json`). */
export function libelleDeCarac(k: CharKey): { abr: string; label: string } {
  const d = characteristics.find((x) => x.id === k);
  return { abr: d?.abr ?? k, label: d?.label ?? k };
}

/** Libellé d'un État porté (`etats.json`), sa valeur comprise. */
export const libelleDEtat = (id: string, valeur: number): string => {
  const nom = conditionLabel(id);
  return valeur > 1 ? `${nom} ${valeur}` : nom;
};

/**
 * Les héros hors d'une partie : la recrue que le moteur crée, ses Caractéristiques, ses libellés.
 */
import { createHero } from '../../../src/engine/character';
import { fabriqueLocale } from '../../../src/engine/fabriqueDId';
import { effectiveChar } from '../../../src/engine/characteristics';
import { findCareerById, findSpeciesById, characteristics, conditionLabel, skills, carrieresAleatoires, colonneDeCarrieres, especesAleatoires } from '../../../src/data';
import type { RNG } from '../../../src/engine/dice';
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

/** Une espèce de `especes` tirée pour la carrière `carriere` : parmi celles dont la colonne du Tableau des Classes et
 *  Carrières aléatoires porte la carrière, ou porte celle de sa variante quand la carrière admet leur race, au poids
 *  de leur rangée au Tableau des Races aléatoires. LDB 05 l.214-299 ; AA 02 l.109-128 ; LDB 04 l.93-101 */
export function tirerUneEspece(rng: RNG, carriere: string, especes: readonly string[]): string {
  const variante = carrieresAleatoires.find((d) => d.kind === 'variante' && d.entries.some((r) => r.id === carriere));
  const races = findCareerById(carriere)?.races;
  const permise = (id: string) => {
    const sp = findSpeciesById(id);
    if (!sp) return false;
    const colonne = colonneDeCarrieres(sp.refCareer).entries;
    return colonne.some((r) => r.id === carriere) || (!!variante && variante.kind === 'variante' && colonne.some((r) => r.id === variante.carriere) && (races?.includes(sp.refChar) ?? true));
  };
  const rangees = especesAleatoires.find((t) => t.id === 'races-ldb')!.entries.filter((r) => especes.includes(r.id) && permise(r.id));
  let jet = rng.int(1, rangees.reduce((n, r) => n + r.max - r.min + 1, 0));
  return rangees.find((r) => (jet -= r.max - r.min + 1) <= 0)!.id;
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

/** Ce que le livre dit d'une Caractéristique (`characteristics.json`), verbatim. */
export const texteDeCarac = (k: CharKey): string => characteristics.find((x) => x.id === k)?.desc ?? '';
/** Ce que le livre dit d'une Compétence (`skills.json`) : son texte verbatim, et la Caractéristique qui la porte. */
export function ficheDeCompetence(id: string): { texte: string; carac?: CharKey } {
  const d = skills.find((x) => x.id === id);
  return { texte: d?.desc ?? '', ...(d?.characteristic ? { carac: d.characteristic as CharKey } : {}) };
}

/** Libellé d'un État porté (`etats.json`), sa valeur comprise. */
export const libelleDEtat = (id: string, valeur: number): string => {
  const nom = conditionLabel(id);
  return valeur > 1 ? `${nom} ${valeur}` : nom;
};

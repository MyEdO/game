/**
 * Cases de carrière (`Combatant.casesDeCarriere`) d'un modèle à passage par cases (`PassageDeNiveau`), cochées au
 * niveau courant de la carrière courante, jamais remises à zéro. CRB 018 l.19-27 ; CRB 045 l.54, l.62 ; CRB 048 l.25
 */
import type { CasesDuNiveau, Combatant } from './types';
import { modeleDe } from './modeleDeProgression';
import { armesChoisissables, levelsForCareer, type BrancheDeDotation, type TrappingRef } from '../data';
import type { DotationDePossession, ObjetDeCatalogue } from '../data/schemas/grammaire/reference';

/** Les cases du niveau `niveau` de la carrière `careerId` de `hero` : achats et dotations acquises. */
export function casesDuNiveau(hero: Pick<Combatant, 'casesDeCarriere'>, careerId: string, niveau: number): number {
  const c = hero.casesDeCarriere?.[careerId]?.[niveau];
  return c ? c.achats + c.dotations.length : 0;
}

/** Les cases du niveau courant de `hero`, posées vides si absentes ; `undefined` hors d'un modèle à cases. Mute `hero`. */
function casesCourantes(hero: Combatant): CasesDuNiveau | undefined {
  if (modeleDe(hero).passage.type !== 'cases') return undefined;
  const career = hero.career ?? '';
  const niveau = hero.careerLevel ?? 1;
  const parNiveau = (hero.casesDeCarriere ??= {})[career] ??= {};
  return (parNiveau[niveau] ??= { achats: 0, dotations: [] });
}

/** Coche la case d'une Augmentation ou d'un Talent de carrière acheté. Mute `hero`. CRB 018 l.23-24 */
export function cocherUnAchat(hero: Combatant): void {
  const cases = casesCourantes(hero);
  if (cases) cases.achats += 1;
}

/** La dotation `ref` couvre-t-elle l'objet ou la possession d'id de catalogue `id` : son id, une branche d'un « 1
 *  parmi » ou d'un lot, ou une arme choisissable du joker (`armesChoisissables`, son Groupe s'il en nomme un) ? */
function couvre(ref: TrappingRef | BrancheDeDotation | ObjetDeCatalogue | DotationDePossession, id: string): boolean {
  if ('pick' in ref) return ref.of.some((b) => couvre(b, id));
  if ('lot' in ref) return ref.lot.some((b) => couvre(b, id));
  if ('wildcard' in ref) return armesChoisissables().some((a) => a.id === id && (ref.groupe === undefined || a.groupe === ref.groupe.id));
  return 'id' in ref && ref.id === id;
}

/** Coche, une seule fois par dotation, la case de la dotation du niveau SUIVANT de la carrière courante qui couvre
 *  l'objet ou la possession `id` (`couvre`) ; la clé d'une dotation est son id, ou son rang `#i` pour un choix ou un
 *  joker. Rend vrai si une case est cochée. Mute `hero`. CRB 018 l.25 */
export function cocherLaDotation(hero: Combatant, id: string | undefined): boolean {
  if (!id) return false;
  const suivant = levelsForCareer(hero.career ?? '').find((l) => l.level === (hero.careerLevel ?? 1) + 1);
  const i = suivant?.trappings.findIndex((r) => couvre(r, id)) ?? -1;
  if (!suivant || i < 0) return false;
  const ref = suivant.trappings[i];
  const cle = 'id' in ref ? ref.id : `#${i}`;
  const cases = casesCourantes(hero);
  if (!cases || cases.dotations.includes(cle)) return false;
  cases.dotations.push(cle);
  return true;
}

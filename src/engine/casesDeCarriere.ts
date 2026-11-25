/**
 * Cases de carrière (`Combatant.casesDeCarriere`) d'un modèle à passage par cases (`PassageDeNiveau`), cochées au
 * niveau courant de la carrière courante, jamais remises à zéro. CRB 018 l.19-27 ; CRB 045 l.54, l.62 ; CRB 048 l.25
 */
import type { CasesDuNiveau, Combatant } from './types';
import { modeleDe } from './modeleDeProgression';
import { armesChoisissables, bandeDe, findTrappingById, levelsForCareer, type BrancheDeDotation, type TrappingRef } from '../data';
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

/** La dotation `ref` couvre-t-elle l'objet ou la possession d'id de catalogue `id` : son id, l'armure d'une pièce qui
 *  remplace la sienne (`bandeDe`, #4208), une branche d'un « 1 parmi » ou d'un lot, ou une arme choisissable du joker
 *  (`armesChoisissables`, son Groupe s'il en nomme un) ? */
function couvre(ref: TrappingRef | BrancheDeDotation | ObjetDeCatalogue | DotationDePossession, id: string): boolean {
  if ('pick' in ref) return ref.of.some((b) => couvre(b, id));
  if ('lot' in ref) return ref.lot.some((b) => couvre(b, id));
  if ('wildcard' in ref) return armesChoisissables().some((a) => a.id === id && (ref.groupe === undefined || a.groupe === ref.groupe.id));
  return 'id' in ref && (ref.id === id || bandeDe(ref.id)?.id === id);
}

/** Les dotations du niveau SUIVANT de la carrière courante de `hero`. */
const dotationsDuNiveauSuivant = (hero: Combatant): readonly TrappingRef[] =>
  levelsForCareer(hero.career ?? '').find((l) => l.level === (hero.careerLevel ?? 1) + 1)?.trappings ?? [];

/** Coche, une seule fois par dotation, la case de la dotation du niveau SUIVANT de la carrière courante qui couvre
 *  l'objet ou la possession `id` (`couvre`) ; celles de toutes les dotations qu'elle couvre pour une armure d'une
 *  pièce (`remplace`). Rend vrai si une case est cochée. Mute `hero`. CRB 018 l.25 ; CRB 048 l.45 ; #4208 */
export function cocherLaDotation(hero: Combatant, id: string | undefined): boolean {
  if (!id) return false;
  const dotations = dotationsDuNiveauSuivant(hero);
  if (!findTrappingById(id)?.remplace) return cocherLaDotationDeRang(hero, dotations.findIndex((r) => couvre(r, id)));
  return dotations.reduce((cochee, r, i) => (couvre(r, id) && cocherLaDotationDeRang(hero, i)) || cochee, false);
}

/** Coche, une seule fois, la case de la dotation de rang `i` du niveau SUIVANT de la carrière courante ; la clé d'une
 *  dotation est son id, ou son rang `#i` pour un choix ou un joker. Rend vrai si une case est cochée. Mute `hero`.
 *  CRB 013 l.15 ; CRB 018 l.25 */
export function cocherLaDotationDeRang(hero: Combatant, i: number): boolean {
  const ref = dotationsDuNiveauSuivant(hero)[i];
  if (!ref) return false;
  const cle = 'id' in ref ? ref.id : `#${i}`;
  const cases = casesCourantes(hero);
  if (!cases || cases.dotations.includes(cle)) return false;
  cases.dotations.push(cle);
  return true;
}

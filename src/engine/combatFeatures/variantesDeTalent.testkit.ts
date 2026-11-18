import { findTalentById, talents } from '../../data';
import type { RegleOptionnelleId } from '../policy';

/** Tous les porteurs de variante du catalogue — DÉRIVÉ (une curation qui en ajoute un entre
 *  automatiquement dans les preuves qui le lisent, quelle que soit la règle qui le gate). */
export const ALL_VARIANT_CARRIERS = talents
  .filter((t) => t.variants?.length).map((t) => t.id).sort();

/** Règle optionnelle qui gate la variante d'un porteur, LUE dans la donnée — jamais un id de règle
 *  écrit en dur dans la preuve (deux variantes co-activables sont déjà interdites par
 *  `src/data/variants-integrity.test.ts`, la première suffit). */
export const ruleOf = (id: string): RegleOptionnelleId =>
  findTalentById(id)!.variants![0].when.rule;

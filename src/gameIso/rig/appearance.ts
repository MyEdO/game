import type { Combatant } from '../../engine/types';
import { hashSeed } from '../../engine/dice';
import { rigSpeciesId, species, raceAppearance, vehicles, siegeEngines } from '../../data';
import { creatureSpeciesOptions } from './creatures';
import { SWARM_FORMS } from './swarm/forms';
import type { Appearance, RigSpeciesId } from '../../engine/authoringAppearance';

/** Vocabulaire CANONIQUE des ids d'espèce rig — DÉRIVÉ des 6 registres qui en produisent un, jamais
 *  authoré : espèces jouables, defs de créature, races d'apparence, formes de nuée (plan swarm),
 *  véhicules et affûts de siège (`resolveRender` sort `veh.id` / `siegeRig` comme espèce).
 *  Recalculé à chaque appel (les registres sont relus live pour suivre les éditions du Compendium). */
export function rigSpeciesVocab(): Set<string> {
  return new Set<string>([
    ...species.map((s) => s.id),
    ...creatureSpeciesOptions().map((o) => o.id),
    ...raceAppearance.map((r) => r.id),
    ...Object.keys(SWARM_FORMS),
    ...vehicles.map((v) => v.id),
    ...siegeEngines().map((t) => t.siegeRig).filter((r): r is string => typeof r === 'string'),
  ]);
}

/** SEUL site sanctionné d'assertion vers `RigSpeciesId` pour un id d'origine CODE (résolution de
 *  rendu, def, littéral de galerie) : l'espèce d'AUTEUR est jugée en amont, par le schéma et par
 *  `resolveRender` (corps d'erreur `manquant`). Producteur VALIDANT : en DEV/test un id hors
 *  `rigSpeciesVocab()` lève nominativement — assertion d'invariant, sa levée est un bug de code ; en
 *  prod c'est un passe-plat. Un id RULES passe par `rigSpeciesId` (src/data/index.ts). */
export function asRigSpeciesId(id: string): RigSpeciesId {
  if (import.meta.env?.DEV && !rigSpeciesVocab().has(id))
    throw new Error(`[appearance] espèce « ${id} » hors vocabulaire rig (species.json ∪ defs rig ∪ raceAppearance ∪ formes de nuée ∪ véhicules ∪ siegeRig) — donnée à corriger.`);
  return id as RigSpeciesId;
}

/** Apparence par défaut dérivée d'un Combatant (espèce + seed stable sur l'id). `appearance.species`
 *  est un id d'espèce RIG (slug) : `rigSpeciesId` mappe un id rules (héros) vers son slug d'espèce, et
 *  laisse passer un slug déjà rig (ennemi/créature) tel quel (idempotent). */
export function defaultAppearance(c: Combatant): Appearance {
  return {
    species: rigSpeciesId(c.species),
    sex: 'M',
    build: 0.5,
    seed: hashSeed(c.id),
  };
}

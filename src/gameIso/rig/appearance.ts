import type { Slot } from './bones';
import type { Combatant } from '../../engine/types';
import { hashSeed } from '../../engine/dice';
import { rigSpeciesId, species, raceAppearance, vehicles, trappings } from '../../data';
import { creatureSpeciesOptions } from './creatures';
import { SWARM_FORMS } from './swarm/forms';
import type { MonsterParts } from './parts/monstrous';
import type { Palette } from './palette';
import type { Sexe } from '../../data/schemas/grammaire/valeurs';

/** Vocabulaire (marque NOMINALE, #406) : id RIG (slug d'espèce `species.json`, id de créature/race/
 *  véhicule/affût-de-siège) — jamais un `SpeciesData.label` (« Humains (Reiklander) »). UNE seule
 *  monnaie : un littéral `string` (dont un `.label`) n'est plus assignable à `Appearance.species`
 *  (échec STRUCTUREL). Deux producteurs sanctionnés : `rigSpeciesId` (pont rules→rig) et
 *  `asRigSpeciesId` (validation d'un id déjà RIG). */
export type RigSpeciesId = string & { readonly __rigSpeciesId: unique symbol };

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
    ...trappings.map((t) => t.siegeRig).filter((r): r is string => typeof r === 'string'),
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

/** Descripteur d'apparence COSMÉTIQUE (type pur ; l'engine ne le lit jamais). */
export interface Appearance {
  species: RigSpeciesId;
  gabarit?: string;                                 // id de carrure résolu (sinon dérivé de l'espèce)
  sex: Sexe;
  build: number;                                   // 0..1
  legs?: number;                                   // multiplicateur de longueur de jambes (mutation Court sur pattes)
  faceFlip?: boolean;                              // visage retourné tête en bas (mutation Visage inversé)
  eyes?: { G?: string; D?: string };               // remplacement d'œil EN PLACE (art centré, cf. parts/eyes.ts)
  parts?: Partial<Record<Slot, number>>;           // overrides éditeur (index dans le pool par slot)
  hairstyle?: string;                              // coiffure IMPOSÉE par id stable (hairstyles/defs) — prime sur parts.cheveux/seed ; sinon tirage sexe+ordre
  monster?: MonsterParts;                          // parts monstrueux par slot (mutant modulaire)
  features?: string[];                             // CLÉS du catalogue d'éléments (parts/elements.ts) — traits ADDITIFS (queue, cornes, crocs…)
  colors?: Palette;                                // personnalisation couleur (peau/cheveux/vêtements)
  seed?: number;
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

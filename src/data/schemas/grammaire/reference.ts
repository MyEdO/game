/**
 * RÉFÉRENCES de la grammaire de document (#1466 L1a) — les formes ACTUELLES de désignation d'une
 * entité par son id (réf simple, réf de Qualité, dotation, emplacement d'avancement, Trait posé).
 * Les fabriques FERMÉES qui les remplaceront vivent dans `ref.ts` ; leur adoption par les defs et
 * la migration de la donnée se font aux lots L2/L3 (#1463).
 */
import { z } from 'zod';
import { countSpecSchema } from './valeurs';

/**
 * `TraitInstance` (`src/engine/statEntry.ts`) — Trait STRUCTURÉ partagé entre le bestiaire
 * (`creatures.json` `traits`/`optionals`) et l'espèce jouable (`species.json` `traits`, #572 :
 * trait RACIAL posé sur `Combatant.traits` à `createHero`, ex. Ogre `{id:'ogre'}` — encombrance/
 * consommation ×2 ; la Taille, elle, est portée par le TALENT Massif/Petit, pas un Trait). MÊME
 * forme partout — jamais recopiée.
 */
export const traitInstanceSchema = z.strictObject({
  id: z.string(),
  value: z.number().optional(),
  arg: z.string().optional(),
  count: z.number().optional(),
  range: z.number().optional(),
  natural: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

/**
 * `Ref` (`src/data/index.ts`) — réf structurée par id + spec optionnelle (talent/sort/manœuvre/dieu
 * ciblé). Dupliqué à l'identique dans `careerLevels`/`classes`/`creatures`/`gods`/`species`/`traits`.
 */
export const refSchema = z.strictObject({ id: z.string(), spec: z.string().optional() });

/** `TalentRef` (`src/data/index.ts`) — référence + niveau facultatif (« Maîtrise du combat 2 »).
 *  Porte UNIQUE de la forme `{id, spec?, times?}` : `creatures` et les profils embarqués de scène en
 *  dépendent.
 *  Les trois clés sont ÉCRITES, jamais `...refSchema.shape` : le mesureur de redéclarations lit les
 *  littéraux par AST et ne résout pas un spread — la forme épandue lui présenterait la signature
 *  `times` seule, qu'il attribuerait à ce schéma sur tout littéral à clé `times` unique. */
export const talentRefSchema = z.strictObject({ id: z.string(), spec: z.string().optional(), times: z.number().optional() });

/** Référence par id portant une MAGNITUDE, et rien d'autre — forme CANONIQUE de la « référence
 *  indicée » du dépôt (`scripts/guards/lib/structuresStock.mjs`, signature `id,value` : Traits de
 *  créature, Atouts de `trappings.json`, Améliorations de navire). UNE graphie pour ce concept : les
 *  schémas qui l'expriment la RÉFÉRENCENT, ils ne la re-tapent pas (volet `redeclaration` de
 *  `src/data/grammaire-guard.test.ts`). Elle ne dérive PAS de `refSchema` : ce qu'une magnitude qualifie
 *  n'est pas une SPÉCIALISATION. */
export const refIndiceSchema = z.strictObject({ id: z.string(), value: z.number().optional() });

/** `QualityRef` (`src/data/index.ts`) — id + Indice éventuel (« Solide 3 », « Taillade (1A) » →
 *  `value`). Vue COMMUNE du joker de qualité d'une dotation (`TrappingRef.qualities`, #657 Lot 1) ET du
 *  catalogue `trappings.json` lui-même, qui l'importe (#1463 L-gram-2). C'est la référence INDICÉE
 *  ci-dessus : ce que le livre imprime entre parenthèses (`AA 08 l.87` « Taillade (XA) ») est une
 *  MAGNITUDE, portée par `value` et déclarée par la qualité (`QualityData.indice`) ; `spec` y était une
 *  seconde graphie de la même chose, que rien ne lisait — elle est désormais REFUSÉE au parse. */
export const qualityRefSchema = refIndiceSchema;


/** `TrappingRef` (`src/data/index.ts`) — par id de catalogue (+ quantité, + Atouts ATTACHÉS `qualities`
 *  ou joker « Atout au choix » `qualityChoice` — « X de qualité » LDB 60 Fabrication, #657 Lot 1),
 *  texte narratif hors catalogue (+ quantité), dotation VÉHICULE (`vehicleId`, foyer `vehicles.json` —
 *  grant de POSSESSION, matérialisé en T1), dotation BÊTE (`creatureId`, foyer `creatures.json` — SOCLE
 *  POSSESSIONS #615/#617 §9), choix « A ou B » (`choice`, RÉCURSIF, EN MIROIR d'`advancementRefSchema`),
 *  ou joker (`wildcard`). Dupliqué dans `careerLevels`/`classes`/`creatures`. */
type CountSpecInfer = z.infer<typeof countSpecSchema>;
type QualityRefInfer = z.infer<typeof qualityRefSchema>;
export const trappingRefSchema: z.ZodType<
  | { id: string; spec?: string; count?: CountSpecInfer; qualities?: QualityRefInfer[]; qualityChoice?: true }
  | { text: string; count?: CountSpecInfer }
  | { vehicleId: string; count?: CountSpecInfer; label?: string }
  | { creatureId: string; count?: CountSpecInfer; label?: string }
  | { choice: unknown[] }
  | { wildcard: string }
> = z.union([
  refSchema.extend({
    count: countSpecSchema.optional(),
    qualities: z.array(qualityRefSchema).optional(),
    qualityChoice: z.literal(true).optional(),
  }),
  z.strictObject({ text: z.string(), count: countSpecSchema.optional() }),
  z.strictObject({ vehicleId: z.string(), count: countSpecSchema.optional(), label: z.string().optional() }),
  z.strictObject({ creatureId: z.string(), count: countSpecSchema.optional(), label: z.string().optional() }),
  z.strictObject({ choice: z.array(z.lazy(() => trappingRefSchema)) }),
  z.strictObject({ wildcard: z.string() }),
]);


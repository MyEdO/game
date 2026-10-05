/**
 * RÉFÉRENCES de la grammaire de document (#1466 L1a) — les formes ACTUELLES de désignation d'une
 * entité par son id (réf simple, réf de Qualité, dotation, emplacement d'avancement, Trait posé).
 * Les fabriques FERMÉES qui les remplaceront vivent dans `ref.ts` ; leur adoption par les defs et
 * la migration de la donnée se font aux lots L2/L3 (#1463).
 */
import { z } from 'zod';
import { countSpecSchema } from './valeurs';
import { porteLeMarqueur, refusDeSpec } from './ref';

/**
 * `TraitInstance` (`src/engine/statEntry.ts`) — Trait STRUCTURÉ partagé entre le bestiaire
 * (`creatures.json` `traits`/`optionals`) et l'espèce jouable (`species.json` `traits`, #572 :
 * trait RACIAL posé sur `Combatant.traits` à `createHero`, ex. Ogre `{id:'ogre'}` — encombrance/
 * consommation ×2 ; la Taille, elle, est portée par le TALENT Massif/Petit, pas un Trait). MÊME
 * forme partout — jamais recopiée.
 */
/** Ce que l'`arg` d'un Trait ne peut pas porter quand sa def DÉCLARE le champ qui le reçoit
 *  (`LDB 85` l.94, l.209) : le marqueur du def (`defs/traits.ts`), la forme de la valeur, son champ. */
const ARG_DECLARE_AILLEURS = [
  { marqueur: 'indice', forme: /^\+?\d+\+?$/, nature: 'un Indice', champ: 'value' },
  { marqueur: 'range', forme: /^\d+(?:[.,]\d+)?\s*(?:m|mètres?)$/i, nature: 'une Portée', champ: 'range' },
] as const;

/** Prédicats « le Trait déclare ce marqueur », construits à la PREMIÈRE validation : `npm run gen`
 *  importe les defs avant d'avoir écrit la sous-liste que `porteLeMarqueur` exige à sa construction. */
const declarants = new Map<string, (id: string) => boolean>();

/**
 * Refus de l'`arg` `arg` sur le Trait `id` quand cet `arg` n'est qu'un Indice ou qu'une Portée que la
 * def du Trait DÉCLARE — message nommé (id, valeur, champ attendu), sinon `null`. Appelé par le schéma
 * d'instance ci-dessous.
 */
export function refusDArgDeTrait(id: string, arg: string): string | null {
  for (const r of ARG_DECLARE_AILLEURS) {
    if (!r.forme.test(arg.trim())) continue;
    if (declare(r.marqueur, id)) return `Trait « ${id} » : « ${arg} » est ${r.nature} — il s'écrit en « ${r.champ} » (nombre), jamais en « arg ».`;
  }
  return null;
}

/** Joker d'un `arg` de Trait d'un statbloc RAW (« Animosité (un au choix) », « Peur (Au choix) ») : il
 *  désigne un choix, jamais une entrée du registre. */
export const ARG_JOKER = /^(un |une |deux )?au choix$/i;

/** Le prédicat « le Trait déclare ce marqueur », construit à la PREMIÈRE lecture (voir `declarants`). */
function declare(marqueur: string, id: string): boolean {
  let pred = declarants.get(marqueur);
  if (!pred) declarants.set(marqueur, (pred = porteLeMarqueur('trait', marqueur)));
  return pred(id);
}

/** Parts de l'`arg` `arg` du Trait `id` : liste séparée par virgules si la def déclare `specsMulti`,
 *  sinon l'arg entier ; jokers et parts vides écartés. */
export function partsDArg(id: string, arg: string): string[] {
  if (ARG_JOKER.test(arg.trim())) return [];
  return (declare('specsMulti', id) ? arg.split(',') : [arg]).map((s) => s.trim()).filter((s) => s && !ARG_JOKER.test(s));
}

/**
 * Refus de l'`arg` `arg` sur le Trait `id` dont le registre (`specsSource`) est FERMÉ : chaque part qui
 * n'y résout pas — message nommé, sinon `null`. Prédicat UNIQUE, lu par le schéma d'instance ci-dessous
 * et par `src/data/trait-args-derived.test.ts` ; un registre OUVERT (`specsOpen`) admet le texte libre.
 */
export function refusDArgHorsRegistre(id: string, arg: string): string | null {
  const horsRegistre = partsDArg(id, arg).filter((part) => refusDeSpec('trait', id, part) === 'horsCatalogue');
  return horsRegistre.length
    ? `Trait « ${id} » : ${horsRegistre.map((x) => `« ${x} »`).join(', ')} ne résout aucune entrée de son registre — un id du registre, jamais un libellé.`
    : null;
}

export const traitInstanceSchema = z.strictObject({
  id: z.string(),
  value: z.number().optional(),
  arg: z.string().optional(),
  count: z.number().optional(),
  range: z.number().optional(),
  natural: z.boolean().optional(),
  hidden: z.boolean().optional(),
}).superRefine((t, ctx) => {
  if (t.arg === undefined) return;
  for (const refus of [refusDArgDeTrait(t.id, t.arg), refusDArgHorsRegistre(t.id, t.arg)]) {
    if (refus) ctx.addIssue({ code: 'custom', path: ['arg'], message: refus });
  }
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


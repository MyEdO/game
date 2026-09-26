// Périmètre RETENU du rapport « consommateurs par champ » (#903) — PARTAGÉ entre le générateur
// (`scripts/docs/build-field-consumers.mts`) et la garde (`src/data/field-consumers.test.ts`) :
// une seule source pour `TARGETS`, jamais une liste dupliquée entre les deux. Périmètre candidat et
// raisons d'exclusion : en-tête de `scripts/docs/build-field-consumers.mts`.
import { enfantsDe } from '../../../src/data/schemas/grammaire/descente'
import * as valeurs from '../../../src/data/schemas/grammaire/valeurs'
import * as reference from '../../../src/data/schemas/grammaire/reference'
import { avancement } from '../../../src/data/schemas/grammaire/avancement'
import * as mecanique from '../../../src/data/schemas/grammaire/mecanique'
import { critEscalationSchema, amputationSchema } from '../../../src/data/schemas/defs/criticals'
import {
  cles as propCles, propVolumeRecipeSchema, propPrimitiveSchema, propSeatSlotSchema,
  propPoint3Schema, propSize3Schema,
} from '../../../src/data/schemas/defs/props'

/** `type` + `home` = l'IDENTITÉ de la cible : `scanFieldReads` résout la déclaration de ce type DANS
 *  ce module et compare des SYMBOLES — un homonyme d'un autre module n'entre pas, et aucune
 *  annotation littérale n'est cherchée (#1620). Un `home` qui ne déclare pas le type est une ERREUR
 *  levée, jamais une table muette. */
export const TARGETS = [
  { schema: reference.traitInstanceSchema, type: 'TraitInstance', home: 'src/engine/statEntry.ts' },
  { schema: valeurs.sourceRefSchema, type: 'SourceRef', home: 'src/data/schemas/grammaire/valeurs.ts' },
  { schema: valeurs.detailRecipeSchema, type: 'DetailRecipe', home: 'src/gameIso/detail/types.ts' },
  { schema: valeurs.diceSpecSchema, type: 'DiceSpec', home: 'src/engine/dice.ts' },
  { schema: reference.refSchema, type: 'RefDesignee', home: 'src/data/schemas/grammaire/ref.ts' },
  { schema: reference.qualityRefSchema, type: 'QualityRef', home: 'src/data/index.ts' },
  { schema: valeurs.castingNumberModSchema, type: 'CastingNumberMod', home: 'src/engine/castingNumber.ts' },
  { schema: valeurs.countSpecSchema, type: 'CountSpec', home: 'src/data/index.ts' },
  { schema: reference.trappingRefSchema, type: 'TrappingRef', home: 'src/data/index.ts' },
  { schema: avancement('skill'), type: 'AdvancementRef', home: 'src/data/index.ts' },
  { schema: valeurs.entityAppearanceSchema, type: 'EntityAppearance', home: 'src/engine/authoringAppearance.ts' },
  { schema: mecanique.flowTestSchema, type: 'FlowTest', home: 'src/engine/flowCore.ts' },
  { schema: mecanique.travelTableEntrySchema, type: 'TravelTableEntry', home: 'src/engine/travelTables.ts' },
  { schema: mecanique.shipCrewHitSchema, type: 'ShipCrewHit', home: 'src/data/shipCriticals.ts' },
  { schema: mecanique.shipCritEntrySchema, type: 'ShipCritEntry', home: 'src/data/shipCriticals.ts' },
  // `PropData` est l'ENTRÉE d'un def adopté par `document()` : son nœud est SCELLé (pas de `.shape`).
  // Ses clés viennent donc du handle (`cles`, relevées avant le sceau) — un `schema:` ici rendrait
  // zéro champ EN SILENCE, et le rapport perdrait le type sans le dire.
  { cles: propCles, type: 'PropData', home: 'src/data/props.types.ts' },
  { schema: propVolumeRecipeSchema, type: 'PropVolumeRecipe', home: 'src/data/props.types.ts' },
  { schema: propPrimitiveSchema, type: 'PropPrimitive', home: 'src/data/props.types.ts' },
  { schema: propSeatSlotSchema, type: 'PropSeatSlot', home: 'src/data/props.types.ts' },
  { schema: propPoint3Schema, type: 'PropPoint3', home: 'src/data/props.types.ts' },
  { schema: propSize3Schema, type: 'PropSize3', home: 'src/data/props.types.ts' },
  { schema: critEscalationSchema, type: 'CritEscalation', home: 'src/data/criticals.ts' },
  { schema: amputationSchema, type: 'Amputation', home: 'src/data/criticals.ts' },
]

/** Champs top-level d'un schéma zod (`.shape`), fusionnés à travers les branches d'une union
 *  (`z.union`/`z.discriminatedUnion` — un champ présent sur UNE SEULE branche compte pour le type
 *  entier). PÉRIMÈTRE : les clés top-level. ANGLE MORT : le rapport ne distingue pas « lu sur la
 *  branche A » de « lu sur la branche B ». */
export function fieldsOf(schema) {
  // Une cible peut fournir ses clés TELLES QUELLES (`cles` d'un handle `document()`) : le nœud scellé
  // n'expose plus de `.shape`, et un rendu vide serait une perte muette.
  if (Array.isArray(schema)) return [...schema]
  const enfants = enfantsDe(schema)
  const cles = enfants.flatMap((e) => (e.cle === undefined ? [] : [e.cle]))
  if (cles.length) return cles
  return [...new Set(enfants.filter((e) => e.segment.startsWith('|')).flatMap((e) => fieldsOf(e.noeud)))]
}

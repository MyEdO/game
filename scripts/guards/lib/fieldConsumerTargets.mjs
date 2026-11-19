// Cibles de GRAMMAIRE du rapport « consommateurs par champ » (#903) : les sous-schémas NOMMÉS, partagés
// entre documents ou internes à une entrée, qui n'ont pas de dataset propre. Les cibles de CATALOGUE ne
// s'écrivent pas ici : `ciblesDeCatalogue` (`schemaFieldConsumers.mjs`) les dérive de la jointure des
// chargements. Lecteurs : le générateur (`scripts/docs/build-field-consumers.mts`) et la mesure des
// champs de schéma (`LIENS_SCHEMA_TYPES`).
import { markSchema } from '../../../src/data/schemas/defs/progression-schemas-derived'
import { enfantsDe } from '../../../src/data/schemas/grammaire/descente'
import * as valeurs from '../../../src/data/schemas/grammaire/valeurs'
import * as reference from '../../../src/data/schemas/grammaire/reference'
import { avancement } from '../../../src/data/schemas/grammaire/avancement'
import * as mecanique from '../../../src/data/schemas/grammaire/mecanique'
import { critEscalationSchema, amputationSchema } from '../../../src/data/schemas/defs/criticals'
import {
  propVolumeRecipeSchema, propPrimitiveSchema, propSeatSlotSchema, propPoint3Schema, propSize3Schema,
} from '../../../src/data/schemas/defs/props'

/** `type` + `home` = l'IDENTITÉ de la cible : `scanFieldReads` résout la déclaration de ce type DANS
 *  ce module et compare des SYMBOLES — un homonyme d'un autre module n'entre pas, et aucune
 *  annotation littérale n'est cherchée. Un `home` qui ne déclare pas le type est une ERREUR
 *  levée, jamais une table muette. */
export const CIBLES_DE_GRAMMAIRE = [
  { schema: reference.traitInstanceSchema, type: 'TraitInstance', home: 'src/engine/statEntry.ts' },
  { schema: valeurs.sourceRefSchema, type: 'SourceRef', home: 'src/data/schemas/grammaire/valeurs.ts' },
  { schema: valeurs.secondarySourceRefSchema, type: 'SecondaryRef', home: 'src/data/schemas/grammaire/valeurs.ts' },
  { schema: valeurs.detailRecipeSchema, type: 'DetailRecipe', home: 'src/data/materials.types.ts' },
  { schema: valeurs.diceSpecSchema, type: 'DiceSpec', home: 'src/engine/dice.ts' },
  { schema: reference.qualityRefSchema, type: 'QualityRef', home: 'src/data/schemas/grammaire/reference.ts' },
  { schema: valeurs.castingNumberModSchema, type: 'CastingNumberMod', home: 'src/engine/castingNumber.ts' },
  { schema: valeurs.countSpecSchema, type: 'CountSpec', home: 'src/data/schemas/grammaire/valeurs.ts' },
  { schema: reference.trappingRefSchema, type: 'TrappingRef', home: 'src/data/schemas/grammaire/reference.ts' },
  { schema: avancement('skill'), type: 'AdvancementRef', home: 'src/data/index.ts' },
  { schema: valeurs.entityAppearanceSchema, type: 'EntityAppearance', home: 'src/engine/authoringAppearance.ts' },
  { schema: mecanique.flowTestSchema, type: 'FlowTest', home: 'src/engine/flowCore.ts' },
  { schema: mecanique.travelTableEntrySchema, type: 'TravelTableEntry', home: 'src/engine/travelTables.ts' },
  { schema: mecanique.shipCrewHitSchema, type: 'ShipCrewHit', home: 'src/data/shipCriticals.ts' },
  { schema: mecanique.shipCritEntrySchema, type: 'ShipCritEntry', home: 'src/data/shipCriticals.ts' },
  { schema: propVolumeRecipeSchema, type: 'PropVolumeRecipe', home: 'src/data/props.types.ts' },
  { schema: propPrimitiveSchema, type: 'PropPrimitive', home: 'src/data/props.types.ts' },
  { schema: propSeatSlotSchema, type: 'PropSeatSlot', home: 'src/data/props.types.ts' },
  { schema: propPoint3Schema, type: 'PropPoint3', home: 'src/data/props.types.ts' },
  { schema: propSize3Schema, type: 'PropSize3', home: 'src/data/props.types.ts' },
  { schema: critEscalationSchema, type: 'CritEscalation', home: 'src/data/criticals.ts' },
  { schema: amputationSchema, type: 'Amputation', home: 'src/data/criticals.ts' },
]

export const LIENS_SCHEMA_TYPES = [
  ...CIBLES_DE_GRAMMAIRE,
  { schema: markSchema, type: 'ProgressionMark', home: 'scripts/guards/lib/progressionSchemas.d.mts' },
]

/** Champs top-level d'un schéma zod (`.shape`), fusionnés à travers les branches d'une union
 *  (`z.union`/`z.discriminatedUnion` — un champ présent sur UNE SEULE branche compte pour le type
 *  entier). PÉRIMÈTRE : les clés top-level. ANGLE MORT : le rapport ne distingue pas « lu sur la
 *  branche A » de « lu sur la branche B ». */
export function fieldsOf(schema) {
  const enfants = enfantsDe(schema)
  const cles = enfants.flatMap((e) => (e.cle === undefined ? [] : [e.cle]))
  if (cles.length) return cles
  return [...new Set(enfants.filter((e) => e.segment.startsWith('|')).flatMap((e) => fieldsOf(e.noeud)))]
}

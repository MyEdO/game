/** LDB 14 l.21-34 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { nommerChamps } from '../grammaire/meta';
import { enumNomme, plageSchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'oups.json';
export const famille = 'config';

/** Effets mécaniques que le moteur sait jouer (`OupsKind` + `misfire`, `src/engine/oups.ts`), NOMMÉS :
 *  les options de l'enum SONT les clés de cette table (#1694). */
const KINDS = {
  selfWound: 'Auto-blessure',
  weaponDamageActLast: 'Arme abîmée + agit en dernier',
  actionPenalty: 'Malus d’Action',
  loseMovement: 'Perte de Mouvement',
  loseAction: 'Perte d’Action',
  trauma: 'Traumatisme',
  hitAlly: 'Touche un allié',
  misfire: 'Incident de Tir',
} as const;

const chargeParDiscriminant = {
  selfWound: ['min', 'max'],
  weaponDamageActLast: ['min', 'max'],
  actionPenalty: ['min', 'max', 'mod'],
  loseMovement: ['min', 'max'],
  loseAction: ['min', 'max'],
  trauma: ['min', 'max'],
  hitAlly: ['min', 'max'],
  misfire: [],
} as const satisfies Record<keyof typeof KINDS, readonly string[]>;

export const rangee = nommerChamps(z.strictObject({
  id: z.string(),
  ...plageSchema.partial().shape,
  kind: enumNomme(KINDS),
  label: z.string(),
  mod: z.number().optional(),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  min: { label: 'Borne basse du dé' },
  max: { label: 'Borne haute du dé' },
  kind: {
    label: 'Effet mécanique',
    hint: 'misfire = Incident de Tir, HORS table (LDB 14 folio 160)',
  },
  label: { label: 'libellé' },
  mod: { label: 'Modificateur de l’Action suivante', hint: 'Malus d’Action seulement' },
  source: { label: 'source' },
});

const doc = document(
  'oups',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { oups: 'entries' } } },
  },
  // LDB 14 l.23-30
  { rangee, deDeTirage: true, espace: { discriminant: 'kind', chargeParDiscriminant } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

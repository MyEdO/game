import { nommerChamps } from '../grammaire/meta';
/** EDOC 7 l.25. */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'montures.json';
export const famille = 'config';

/** Une monture ou bête de trait : Mouvement, Endurance, trot et capacité de charge en voyage. */
const montureSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Réfs `CreatureData.id` du bestiaire (SOCLE POSSESSIONS #617/#618) — peut être vide (« Cheval de
   *  trait lourd »/« Bœuf » n'ont pas de profil de bête possédable dédié). */
  creatureIds: z.array(z.string()),
  /** Mouvement (M). */
  m: z.number(),
  /** EDOC 07 l.229. */
  e: z.number(),
  /** EDOC 7. */
  trot: z.boolean(),
  /** EDOC 07 l.97-110. */
  encPortee: z.number(),
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  creatureIds: { label: 'créatures' },
  m: { label: 'Mouvement' },
  e: { label: 'Endurance' },
  trot: { label: 'trot' },
  encPortee: { label: 'encombrement porté' },
});

const doc = document(
  'montures',
  famille,
  {},
  {},
  {
    codex: { keys: ['montures'] },
    edit: { niche: { categories: { montures: 'entries' } } },
  },
  { rangee: montureSchema },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

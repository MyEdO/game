import { nommerChamps } from '../grammaire/meta';
/** VDM 02 l.205-215 ; VDM 02 l.198 */
import { z } from 'zod';
import { document, type DocumentARangees } from '../grammaire/document';

export const file = 'surincantation.json';
export const famille = 'config';

/** Un palier : des DR dépensés sur UNE colonne. */
const palierSchema = nommerChamps(z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  dr: z.number().int().min(1),
  targets: z.number().int().min(0),
  damage: z.number().int().min(0),
  range: z.number().int().min(1),
  zone: z.number().int().min(1),
  duration: z.number().int().min(1),
}), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  dr: { label: 'Degrés de Réussite' },
  targets: { label: 'Cibles' },
  damage: { label: 'Dégâts' },
  range: { label: 'Portée' },
  zone: { label: 'Zone' },
  duration: { label: 'Durée' },
});

const doc = document(
  'surincantation',
  famille,
  {},
  {},
  {
    codex: { keys: ['surincantation'] },
    edit: { niche: { categories: { surincantation: 'entries' } } },
  },
  { rangee: palierSchema },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type SurincantationData = DocumentARangees<z.infer<typeof palierSchema>>;

import { nommerChamps } from '../grammaire/meta';
/** VDM 02 l.205-215 ; VDM 02 l.198 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { palierSchema } from '../grammaire/valeurs';

export const file = 'surincantation.json';
export const famille = 'config';

/** Un palier (`palierSchema`) : `seuil` = DR dépensés sur UNE colonne. */
export const rangee = nommerChamps(z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  ...palierSchema.shape,
  targets: z.number().int().min(0),
  damage: z.number().int().min(0),
  range: z.number().int().min(1),
  zone: z.number().int().min(1),
  duration: z.number().int().min(1),
}).refine((r) => r.seuil >= 1, { path: ['seuil'], message: 'un palier de Surincantation coûte au moins 1 DR' }), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  seuil: { label: 'Degrés de Réussite' },
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
    edit: { niche: { categories: { surincantation: 'entries' } } },
  },
  { rangee },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;

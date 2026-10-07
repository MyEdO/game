import { nommerChamps } from '../grammaire/meta';
/** MDG ; MSRC ; MSRC 07 l.86 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { shipCritEntrySchema } from '../grammaire/mecanique';
import { replisSansExposeSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'river-criticals.json';
export const famille = 'config';


const doc = document(
  'river-criticals',
  famille,
  {
    replisSansExpose: replisSansExposeSchema,
    tables: nommerChamps(z.strictObject({
      greement: listeCle(shipCritEntrySchema, 'id'),
      avirons: listeCle(shipCritEntrySchema, 'id'),
      gouvernail: listeCle(shipCritEntrySchema, 'id'),
      coque: listeCle(shipCritEntrySchema, 'id'),
      superstructure: listeCle(shipCritEntrySchema, 'id'),
    }), {
      greement: { label: 'Gréement' },
      avirons: { label: 'Avirons' },
      gouvernail: { label: 'Gouvernail' },
      coque: { label: 'Coque' },
      superstructure: { label: 'Superstructure' },
    }),
  },
  {
    replisSansExpose: {
      label: 'Repli sans équipage exposé',
      hint: 'Localisation qui encaisse le coup à l’Équipage quand aucun marin n’est exposé',
    },
    tables: { label: 'Critiques par Localisation', hint: 'Cinq tables sœurs : gréement, avirons, gouvernail, coque, superstructure' },
  },
  {
    codex: { keys: ['riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure'] },
    edit: { niche: { categories: { riverCriticalsGreement: 'tables.greement', riverCriticalsAvirons: 'tables.avirons', riverCriticalsGouvernail: 'tables.gouvernail', riverCriticalsCoque: 'tables.coque', riverCriticalsSuperstructure: 'tables.superstructure' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

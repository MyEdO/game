import { z } from 'zod';
import { document } from '../grammaire/document';
import { metaDesChamps } from '../grammaire/meta';
import { affinerAvecCatalogues, ref } from '../grammaire/ref';
import { availabilitySchema, moneySchema } from '../grammaire/valeurs';
import { categorieDArmeSchema, lireLesGroupesDeSiege, profilDArmeDeCatalogueSchema } from './trappings';

export const file = 'siege-engines.json';
export const famille = 'entite';

const doc = document(
  'siege-engines',
  famille,
  {
    ...profilDArmeDeCatalogueSchema.shape,
    categorie: categorieDArmeSchema,
    subType: ref('weaponGroup'),
    siegeFootprint: z.number().optional(),
    enc: z.number().optional(),
    availability: availabilitySchema,
    price: moneySchema,
  },
  {
    ...metaDesChamps(profilDArmeDeCatalogueSchema, { exigees: true }),
    categorie: { label: 'Catégorie' },
    subType: { label: 'Sous-type' },
    siegeFootprint: { label: 'Empreinte au sol' },
    enc: { label: 'Encombrement' },
    availability: { label: 'Disponibilité' },
    price: { label: 'Prix' },
  },
  {
    codex: { keys: ['siegeEngines', 'massBattleWarMachines'] },
    edit: { dataset: 'siegeEngines' },
  },
  {
    exiges: ['source'],
    affinerEntree: (entree) =>
      affinerAvecCatalogues(entree, (lire) => {
        const estGroupeDeSiege = lireLesGroupesDeSiege(lire);
        return (v, ctx) => {
          const { subType, qualities } = v as z.output<typeof profilDArmeDeCatalogueSchema> & { subType: { id: string } };
          if (!estGroupeDeSiege(subType.id)) {
            ctx.addIssue({ code: 'custom', path: ['subType', 'id'], message: 'Un engin de siège appartient à un Groupe de siège' });
          }
          qualities.forEach((qualite, i) => {
            if ('majoration' in qualite) {
              ctx.addIssue({ code: 'custom', path: ['qualities', i, 'majoration'], message: 'Seule une munition majore la qualité d’une arme' });
            }
          });
        };
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;

import { nommerChamps } from '../grammaire/meta';
/** MDG 13 ; MDG */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema, shipCritEntrySchema } from '../grammaire/mecanique';
import { formulaSchema, replisSansExposeSchema, shipSizeSchema } from '../grammaire/valeurs';
import { idDe } from '../grammaire/ref';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'ship-criticals.json';
export const famille = 'config';


/** MDG 13 l.684-688 */
const bandeDeChuteSchema = nommerChamps(z.strictObject({
  tailles: z.array(shipSizeSchema).min(1),
  hauteurs: z.record(idDe('shipStation'), formulaSchema),
}), { tailles: { label: 'Tailles' }, hauteurs: { label: 'Hauteurs' } });

/** Table de hauteur de chute, référencée par son id depuis l'op `fall` (`{ hauteur: { table } }`). */
const tableDeChuteSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  bandes: z.array(bandeDeChuteSchema).min(1),
}), { id: { label: 'Identifiant' }, label: { label: 'Libellé' }, bandes: { label: 'Bandes' } });

const doc = document(
  'ship-criticals',
  famille,
  {
    die: z.string(),
    shrapnelHit: z.array(gameOpSchema),
    replisSansExpose: replisSansExposeSchema,
    tablesDeChute: z.array(tableDeChuteSchema),
    tables: nommerChamps(z.strictObject({
      cargaison: listeCle(shipCritEntrySchema, 'id'),
      greement: listeCle(shipCritEntrySchema, 'id'),
      coque: listeCle(shipCritEntrySchema, 'id'),
      avirons: listeCle(shipCritEntrySchema, 'id'),
      equipements: listeCle(shipCritEntrySchema, 'id'),
    }), {
      cargaison: { label: 'Cargaison' },
      greement: { label: 'Gréement' },
      coque: { label: 'Coque' },
      avirons: { label: 'Avirons' },
      equipements: { label: 'Équipements' },
    }),
  },
  {
    die: { label: 'Dé de tirage', hint: 'Expression du dé lancé pour tirer un critique de coque' },
    shrapnelHit: { label: 'Éclats', hint: 'Effets posés sur les occupants touchés par les éclats' },
    replisSansExpose: {
      label: 'Repli sans équipage exposé',
      hint: 'Localisation qui encaisse le coup à l’Équipage quand aucun marin n’est exposé',
    },
    tablesDeChute: {
      label: 'Tables de hauteur de chute',
      hint: 'Hauteur dont tombe un membre d’équipage, par Taille de bateau et par présence à bord',
    },
    tables: { label: 'Critiques par Localisation', hint: 'Cinq tables sœurs : cargaison, gréement, coque, avirons, équipements' },
  },
  {
    codex: { keys: ['shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements'] },
    edit: { niche: { categories: { shipCriticalsCargaison: 'tables.cargaison', shipCriticalsGreement: 'tables.greement', shipCriticalsCoque: 'tables.coque', shipCriticalsAvirons: 'tables.avirons', shipCriticalsEquipements: 'tables.equipements' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

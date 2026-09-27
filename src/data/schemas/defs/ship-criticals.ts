/**
 * Schéma de `ship-criticals.json` — Critiques de coque navale (MDG 13, p.124). Reflet de
 * `ShipCritEntry`/`ShipCritSet` (`src/data/shipCriticals.ts`), PROMU dans `grammaire/mecanique.ts`
 * (`shipCritEntrySchema`/`shipCrewHitSchema` — partagé avec `river-criticals.ts`).
 * Jeu MDG : 5 Localisations (cargaison/greement/coque/avirons/equipements).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema, shipCritEntrySchema } from '../grammaire/mecanique';
import { formulaSchema, replisSansExposeSchema, shipSizeSchema } from '../grammaire/valeurs';
import { idDe } from '../grammaire/ref';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'ship-criticals.json';
export const famille = 'config';


/**
 * UNE BANDE de la table « Tomber du gréement » (`MDG 13 l.684-688`) : les Tailles de bateau qu'elle
 * couvre, et la hauteur de chute PAR PRÉSENCE à bord (`ship-stations.json`) — le gréement tombe d'un
 * jet de dés, le nid-de-pie d'une hauteur fixe, et c'est la clé de STATION qui choisit la colonne
 * (aucun branchement par id côté moteur). La hauteur est une `Formula` (`src/engine/ops.ts`), la
 * quantité canonique du moteur : un nombre (12) ou un tirage (`{dice:{n:2,sides:10}}`).
 */
const bandeDeChuteSchema = z.strictObject({
  tailles: z.array(shipSizeSchema).min(1),
  hauteurs: z.record(idDe('shipStation'), formulaSchema),
});

/** Table de hauteur de chute, référencée par son id depuis l'op `fall` (`{ hauteur: { table } }`). */
const tableDeChuteSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  bandes: z.array(bandeDeChuteSchema).min(1),
});

const doc = document(
  'ship-criticals',
  famille,
  {
    die: z.string(),
    shrapnelHit: z.array(gameOpSchema),
    replisSansExpose: replisSansExposeSchema,
    tablesDeChute: z.array(tableDeChuteSchema),
    tables: z.strictObject({
      cargaison: listeCle(shipCritEntrySchema, 'id'),
      greement: listeCle(shipCritEntrySchema, 'id'),
      coque: listeCle(shipCritEntrySchema, 'id'),
      avirons: listeCle(shipCritEntrySchema, 'id'),
      equipements: listeCle(shipCritEntrySchema, 'id'),
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
    edit: { niche: { categories: ['shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

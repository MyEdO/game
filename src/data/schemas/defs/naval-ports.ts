/**
 * Schéma de `naval-ports.json` — Index des ports de la Mer des Griffes (#217, MDG 15 l.439-506) :
 * catalogue par id STABLE, consommé par référence (`MapPlace.port.ref`) depuis la carte du monde
 * (`src/noyau/worldMap.ts`). `production`/`surplus`/`demande` sont keyés par id de `sea-cargo.json`
 * (+ marqueurs `commerce`/`minimum-vital`, cf. `PortProfile`, `src/engine/seaVoyage.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'naval-ports.json';
export const famille = 'entite';

const doc = document(
  'naval-ports',
  famille,
  {
    /** Région/nation de la colonne « Lieu » de l'Index (regroupement RAW, ex. « Nordland », « Tilée »). */
    region: z.string(),
    taille: z.number(),
    richesse: z.number(),
    production: z.array(z.string()).optional(),
    surplus: z.record(z.string(), z.number()).optional(),
    demande: z.record(z.string(), z.number()).optional(),
    /** Grand port cosmopolite (Marienburg/Lothern, MDG 15 l.343-349). */
    cosmopolite: z.boolean().optional(),
    /** Colonne Dirigeant, verbatim. */
    dirigeant: z.string().optional(),
  },
  {
    region: { label: 'Région', hint: 'Regroupement RAW de la colonne Lieu de l’Index (ex. Nordland, Tilée)' },
    taille: { label: 'Taille', hint: 'Échelle de taille du port (colonne de l’Index)' },
    richesse: { label: 'Richesse', hint: 'Échelle de richesse du port (colonne de l’Index)' },
    production: {
      label: 'Production',
      hint: 'Cargaisons que le port produit, plus les marqueurs de commerce et de minimum vital',
    },
    surplus: {
      label: 'Surplus',
      hint: 'Cargaisons en excédent, avec leur indice — augmente la quantité disponible à l’achat',
    },
    demande: {
      label: 'Demande',
      hint: 'Cargaisons que le port demande, avec leur indice ; relève la cible et le DR de vente, le prix d’offre, et autorise le bradage',
    },
    cosmopolite: {
      label: 'Port cosmopolite',
      hint: 'Grand port cosmopolite (Marienburg, Lothern) : marchands plus généreux, seuil de Négociateur abaissé',
    },
    dirigeant: { label: 'Dirigeant', hint: 'Colonne Dirigeant de l’Index, verbatim' },
  },
  {
    codex: { keys: ['navalPorts'] },
    edit: { dataset: 'navalPorts' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

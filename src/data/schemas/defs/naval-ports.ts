/**
 * Schéma de `naval-ports.json` — Index des ports de la Mer des Griffes (#217, MDG 15 l.439-506) :
 * catalogue par id STABLE, consommé par référence (`MapPlace.port.ref`) depuis la carte du monde
 * (`src/noyau/worldMap.ts`). `production`/`surplus`/`demande` sont keyés par id de la voie
 * `mer` de `cargoes.json` (marqueurs compris, cf. `PortProfile`, `src/engine/seaVoyage.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { recordDIds, refs } from '../grammaire/ref';
import { sourceRefSchema } from '../grammaire/valeurs';

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
    production: refs('cargo', { sousListe: 'mer' }).optional(),
    surplus: recordDIds('cargo', z.number(), 'mer').optional(),
    demande: recordDIds('cargo', z.number(), 'mer').optional(),
    /** Grand port cosmopolite (Marienburg/Lothern, MDG 15 l.343-349). */
    cosmopolite: z.boolean().optional(),
    /** Colonne Dirigeant, verbatim. */
    dirigeant: z.string().optional(),
    /** Valeur d'ADAPTATION : présent, le port a un chantier où le Blindage se pose ; cite son passage. MDG 12 l.230 */
    chantierNavalSpecialise: sourceRefSchema.optional(),
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
    chantierNavalSpecialise: {
      label: 'Chantier naval spécialisé',
      hint: 'Présent : le port a un chantier où le Blindage se pose, cité à son passage (MDG 12 l.230)',
    },
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

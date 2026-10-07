import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 13 l.137-145 ; LDB 76 l.15-29 ; MDG 13 ; MSRC 7. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema, sourceRefSchema } from '../grammaire/valeurs';

export const file = 'localisation.json';
// Les 3 familles de table sont des CLÉS FIXES du document, donc des CHAMPS : `config`, jamais un
// `record` à clés libres (#1467 L1b V-FLIP-CONFIG).
export const famille = 'config';

const hitLocation = z.enum(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']);
const shipLocation = z.enum([
  'equipage',
  'avirons',
  'greement',
  'coque',
  'equipements',
  'cargaison',
  'gouvernail',
  'superstructure',
]);

const bodyLocEntry = nommerChamps(z.strictObject({ ...plageSchema.shape, loc: hitLocation }), { ...metaDesChamps(plageSchema, { exigees: true }), loc: { label: 'localisation' } });
const shipLocEntry = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  avirons: shipLocation,
  voile: shipLocation,
  mixte: shipLocation,
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  avirons: { label: 'navire à avirons' },
  voile: { label: 'navire à voile' },
  mixte: { label: 'navire mixte' },
});

const doc = document(
  'localisation',
  famille,
  {
  personnage: nommerChamps(z.strictObject({
    source: sourceRefSchema,
    /** Clé = `BodyShape` (`src/engine/types.ts`) — seules `humanoide`/`serpent`/`araignee` sont
     *  présentes dans le JSON (les autres formes retombent sur `humanoide`, cf. `hitLocationByShape`). */
    shapes: z.record(z.string(), z.array(bodyLocEntry)),
  }), { source: { label: 'source' }, shapes: { label: 'formes corporelles' } }),
  navire: nommerChamps(z.strictObject({
    source: sourceRefSchema,
    rigs: z.array(z.string()),
    entries: z.array(shipLocEntry),
  }), {
    source: { label: 'source' },
    rigs: { label: 'gréements' },
    entries: { label: 'rangées' },
  }),
  'navire-fluvial': nommerChamps(z.strictObject({
    source: sourceRefSchema,
    rigs: z.array(z.string()),
    entries: z.array(shipLocEntry),
  }), {
    source: { label: 'source' },
    rigs: { label: 'gréements' },
    entries: { label: 'rangées' },
  }),
  },
  {
    personnage: { label: 'Localisation — Personnage', hint: 'Table de Localisation humaine/créature par Forme de corps' },
    navire: { label: 'Localisation — Navire', hint: 'Table de Localisation navale (MDG 13)' },
    'navire-fluvial': { label: 'Localisation — Navire fluvial', hint: 'Table de Localisation navale fluviale (MSRC 7)' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'table de dé inversé (résultat→zone de touche) — vocabulaire structurel du moteur ; les zones sont déjà exposées via les Critiques par Localisation (`criticalsTete`/…).',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

/**
 * Schéma de `systemes.manifest.json` — manifeste éditorial des systèmes implémentés (#298), consommé
 * par `scripts/docs/build-systemes.mjs` pour générer `docs/systemes.md`. Vocabulaire app-interne
 * (tooling), pas une donnée RAW — cf. `SANS_LIVRE_DEFINITIF` (`grammaire/sans-livre.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'systemes.manifest.json';
export const famille = 'entite';

const doc = document(
  'systemes.manifest',
  famille,
  {
    modules: z.array(z.string()),
    etat: z.enum(['complet', 'partiel']),
    ticket: z.string().nullable(),
    notes: z.string(),
  },
  {
    modules: { label: 'Modules', hint: 'Fichiers composant le système' },
    etat: { label: 'État d’avancement', hint: 'complet ou partiel' },
    ticket: { label: 'Ticket', hint: 'Ticket de suivi (dette ou reste à faire)' },
    notes: { label: 'Notes' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: 'manifeste TOOLING (#298) éditorial des systèmes implémentés — vocabulaire app-interne.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

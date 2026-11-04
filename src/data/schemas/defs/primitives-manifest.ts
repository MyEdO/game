/**
 * Schéma de `primitives.manifest.json` — manifeste des primitives partagées (#298), source unique de
 * « qu'est-ce qui est canonique » consommée par `scripts/docs/build-systemes.mjs`. Vocabulaire
 * app-interne (tooling), pas une donnée RAW — cf. `SANS_LIVRE_DEFINITIF` (`grammaire/sans-livre.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'primitives.manifest.json';
export const famille = 'entite';

const doc = document(
  'primitives.manifest',
  famille,
  {
    fichier: z.string(),
    css: z.string().optional(),
    poseurs: z.array(z.string()).optional(),
    nature: z.literal('organisme').optional(),
    concept: z.string(),
    perimetre: z.string(),
    verrou: z.string(),
  },
  {
    fichier: { label: 'Fichier', hint: 'Chemin source de la primitive' },
    css: { label: 'CSS possédé', hint: 'Module de src/ui/styles que la primitive POSSÈDE (#1800)' },
    poseurs: { label: 'Poseurs déclarés', hint: 'Fichiers (ou préfixes finis par /) autorisés à poser une classe du module, hors `fichier` (#1806)' },
    nature: { label: 'Nature', hint: 'ORGANISME de domaine (panneau, plateau) : entré au manifeste pour le module CSS qu’il possède, il assume ses imports de domaine (#1806)' },
    concept: { label: 'Concept', hint: 'Besoin couvert par la primitive' },
    perimetre: { label: 'Périmètre', hint: 'Ce que la primitive couvre' },
    verrou: { label: 'Verrou', hint: 'Ce qui empêche une réinvention concurrente' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: 'manifeste TOOLING (#298) des primitives partagées du code — vocabulaire app-interne.',
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

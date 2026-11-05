/**
 * Schéma de `raw.manifest.json` — manifeste éditorial du champ Implémente de l'Atlas RAW (#487),
 * généré par `scripts/raw/build-implemente.mjs` : par `id`, ticket de dette ou raison de blocage.
 * Un `id` désigne soit un TOPIC de fiche (`<coeur>/<fiche>#<slug>`), soit une FICHE entière
 * (`<coeur>/<fiche>`), dont l'entrée couvre alors tout topic sans entrée propre — l'Atlas est
 * PARTITIONNÉ par cœur, et l'`id` le porte. Le `label` (clé d'ENVELOPPE) est le titre
 * VERBATIM que l'`id` adresse — accord gardé par `scripts/raw/build-implemente.test.mjs` (`libelleDe`).
 * Vocabulaire app-interne (tooling), pas une donnée RAW — cf. `SANS_LIVRE_DEFINITIF` (`grammaire/sans-livre.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'raw.manifest.json';
export const famille = 'entite';

const doc = document(
  'raw.manifest',
  famille,
  {
    ticket: z.string().optional(),
    bloque: z.string().optional(),
  },
  {
    ticket: { label: 'Ticket', hint: 'Ticket de dette portant l’implémentation manquante' },
    bloque: { label: 'Raison de blocage', hint: 'Motif de non-implémentation quand aucun ticket n’est ouvert' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          "manifeste TOOLING (#487) éditorial du champ Implémente de l'Atlas RAW (id/ticket/bloque) — vocabulaire app-interne.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
  {
    affinerEntree: (entree) =>
      entree
        .refine((entry) => (entry as { ticket?: string }).ticket !== undefined || (entry as { bloque?: string }).bloque !== undefined, {
          message: 'ticket ou bloque requis',
        })
        // Une entrée de FICHE (`id` sans `#`) couvre TOUS les topics de sa fiche : sa portée large
        // n'est bornée que par la vie de son ticket, qui est donc obligatoire (#1825). La forme de
        // l'`id` suffit à le dire ici ; la résolution contre les fiches réelles vit dans
        // `validerDette` (scripts/raw/build-implemente.mjs).
        .refine(
          (entry) => {
            const e = entry as { id?: string; ticket?: string };
            return typeof e.id !== 'string' || e.id.includes('#') || e.ticket !== undefined;
          },
          { message: 'entrée de fiche (id sans #) : ticket requis' },
        ),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

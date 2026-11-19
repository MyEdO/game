/**
 * Schéma de `peripeties.json` — Table des Péripéties de voyage (`Source/…/51 - Magie du Chaos.md`
 * l.210-221 — le fichier mélange 2 chapitres réels du LDB post-ré-extraction Marker, cette table
 * appartient au conseil MJ « Voyage », pas aux sorts du Chaos, #309 phase 3), document mono-table :
 * une rangée par face de son dé `die`. Son `tirageQuotidien` (`sousTirage`) est le dé lancé chaque jour de voyage,
 * dont la face `perilDie` de la route fait survenir une Péripétie.
 */
import { z } from 'zod';
import { document, sousTirage } from '../grammaire/document';
import { nommerChamps } from '../grammaire/meta';
import { sourceRefSchema } from '../grammaire/valeurs';

export const file = 'peripeties.json';
export const famille = 'config';

/** Une Péripétie, à sa face du dé de la table. */
export const rangee = nommerChamps(z.strictObject({
  id: z.string(),
  roll: z.number(),
  label: z.string(),
  /** Ce que le MOTEUR sait jouer sans rien inventer (cf. `src/data/peripeties.ts`). */
  kind: z.enum(['reposant', 'narratif', 'ereintant', 'attaque']),
  desc: z.string().min(1),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  roll: { label: 'Face du dé', hint: 'Valeur du dé de la table qui déclenche cette Péripétie' },
  label: { label: 'libellé' },
  kind: { label: 'Nature de la Péripétie', hint: 'Ce que le moteur sait jouer sans rien inventer' },
  desc: { label: 'texte' },
  source: { label: 'source' },
});

const doc = document(
  'peripeties',
  famille,
  {
    // LDB 51 l.208
    tirageQuotidien: sousTirage,
  },
  {
    tirageQuotidien: { label: 'Tirage quotidien', hint: 'Dé lancé chaque jour de voyage : la face `perilDie` de la route fait survenir une Péripétie' },
  },
  {
    edit: { niche: { categories: { peripeties: 'entries' } } },
  },
  // LDB 51 l.210
  { rangee, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

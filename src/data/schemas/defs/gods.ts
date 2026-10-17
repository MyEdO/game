import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `gods.json` — dérivé du contenu RÉEL (41 entrées, script d'inventaire) et de
 * `GodData` (`src/data/index.ts`). `blessings`/`miracles`/`chaosSpells` = ids de sort (`refs('spell')`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { refs } from '../grammaire/ref';

export const file = 'gods.json';
export const famille = 'entite';

const doc = document(
  'gods',
  famille,
  {
    /** Ids de `groups.json` accordés au fidèle de ce culte — poussés par un Talent qui porte
     *  `grantSpecGroups` et dont le `spec` nomme ce dieu (`groupsFor`). Absent = aucun Groupe. */
    grantGroups: z.array(z.string()).optional(),
    title: z.string().optional(),
    blessings: refs('spell'),
    miracles: refs('spell'),
    /** LDB 10. */
    chaosSpells: refs('spell').optional(),
    /** MDG 11 l.148. */
    sinLocks: nommerChamps(z.strictObject({ beni: z.number().optional(), invocation: z.number().optional() }), { beni: { label: 'Béni' }, invocation: { label: 'Invocation' } }).optional(),
  },
  {
    grantGroups: { label: 'Groupes accordés' },
    title: { label: 'Épithète', hint: 'Sous-titre affiché sous le nom du dieu' },
    blessings: { label: 'Bénédictions' },
    miracles: { label: 'Miracles' },
    chaosSpells: { label: 'Sorts du Chaos accordés' },
    sinLocks: {
      label: 'Verrou de Péché',
      hint: 'Seuil de Points de Péché à partir duquel le dieu retire l’usage d’un Talent de Prière',
    },
  },
  {
    codex: { keys: ['gods'] },
    edit: { dataset: 'gods' },
  },
  // Pools des sources `cultBlessings`/`cultMiracles`/`cultChaos` (`grammaire/sourcesDeSpecs.ts`).
  { espace: { marqueurs: ['blessings', 'miracles', 'chaosSpells'] } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

/**
 * Schéma de `locations.json` — Lieux de la carte du monde, miroir strict de `LocationData`
 * (`src/data/index.ts`). `parent` désigne un autre Lieu (`ref('location')`), ou vaut `null` si racine.
 *
 * `prefix`/`suffix` : AUCUN consommateur mesuré dans `src/**` hors ce def, et `prefix` vaut `null`
 * sur 100 % des entrées — leur libellé d'atelier reste donc DESCRIPTIF de la forme, pas de l'usage
 * (aucune JSDoc d'origine ne les documentait). Champs candidats à la mort, pas à l'invention d'un
 * sens : #1540.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';

export const file = 'locations.json';
export const famille = 'entite';

const doc = document(
  'locations',
  famille,
  {
    parent: ref('location').nullable(),
    prefix: z.string().nullable(),
    suffix: z.string().nullable(),
  },
  {
    parent: { label: 'Lieu parent', hint: 'Lieu englobant dans la hiérarchie de la carte ; absent = racine' },
    prefix: { label: 'Préfixe du nom', hint: 'Aucun consommateur mesuré, valeur nulle sur toutes les entrées' },
    suffix: { label: 'Suffixe du nom', hint: 'Aucun consommateur mesuré hors de ce document' },
  },
  {
    codex: { keys: ['locations'] },
    edit: { dataset: 'locations' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

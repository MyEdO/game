/**
 * Registre des Traits de créature (LDB 85) — DÉRIVÉ de la DONNÉE (`src/data/traits.json`, via
 * `data.traits`). Plus de `defs/` mécaniques : toute la mécanique (passive/effects/grantsManeuvers/
 * capabilities) vit dans `traits.json`, lue PAR ID. `TRAITS` porte seulement le libellé d'affichage
 * (`{ key }`) ; ses ids sont EXACTEMENT ceux de `traits.json` (« traits du registre »).
 * Les helpers de `dispatch.ts` lisent `TRAITS` ; spawn/combat/IA les appellent aux moments de jeu.
 */
import type { TraitDef } from './types';
import { traits } from '../../data';
import { memoParVersion } from '../../data/versionDataset';

export type { TraitDef } from './types';

/** Table des traits. Clé = `id` STABLE (slug du libellé canonique) — indépendant de la langue.
 *  Le `key`/libellé reste pour l'affichage. Dérivée 1:1 de `traits.json`. */
export const TRAITS: () => Record<string, TraitDef> = memoParVersion('traits', () =>
  Object.fromEntries(traits.map((t) => [t.id, { key: t.label }])),
);

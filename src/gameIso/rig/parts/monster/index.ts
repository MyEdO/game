import { MONSTER_PARTS } from './_registry.generated';
import type { MonsterPartDef, MonsterPartSlot } from './types';
import type { PartArt } from '../types';
import { parUnitesDeCode } from '../../../../lib/ordre.mjs';

export type { MonsterPartDef, MonsterPartSlot } from './types';

/** Parts d'un slot, triées par `order` (puis clé) — l'ordre pilote le sélecteur de l'éditeur. */
const bySlot = (slot: MonsterPartSlot): MonsterPartDef[] =>
  MONSTER_PARTS.filter((p) => p.slot === slot).sort(
    (a, b) => (a.order ?? 999) - (b.order ?? 999) || parUnitesDeCode(a.key, b.key),
  );

const toMap = (slot: MonsterPartSlot): Record<string, PartArt> =>
  Object.fromEntries(bySlot(slot).map((p) => [p.key, p.art]));

/** Tables DÉRIVÉES des fichiers defs/ (jamais un Record codé en dur). Clé libre → art. */
export const HEADS: Record<string, PartArt> = toMap('tete');
export const ARMS: Record<string, PartArt> = toMap('bras');
export const LEGS: Record<string, PartArt> = toMap('jambe');

/** Cornes/queue DÉCLARÉES par la part de tête (clé de tête → calque) — remplace le name-matcher
 *  `m.tete === 'taureau'` de monsterInjection : la forme vit sur la donnée de la tête. */
export const HEAD_CORNES: Record<string, string> = Object.fromEntries(
  MONSTER_PARTS.filter((p) => p.slot === 'tete' && p.cornes != null).map((p) => [p.key, p.cornes!]),
);
export const HEAD_QUEUE: Record<string, string> = Object.fromEntries(
  MONSTER_PARTS.filter((p) => p.slot === 'tete' && p.queue != null).map((p) => [p.key, p.queue!]),
);

/** Catalogues pour l'éditeur (libellés FR). '' = humain / aucun (en tête de liste). */
const opts = (slot: MonsterPartSlot, none: string): { key: string; label: string }[] => [
  { key: '', label: none },
  ...bySlot(slot).map((p) => ({ key: p.key, label: p.label })),
];
export const MONSTER_HEAD_OPTIONS = opts('tete', 'Humaine');
export const MONSTER_ARM_OPTIONS = opts('bras', 'Humain');
export const MONSTER_LEG_OPTIONS = opts('jambe', 'Humaines');

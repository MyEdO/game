/**
 * Durée d'un sort — donnée STRUCTURÉE (LDB 47), lue telle quelle par le moteur ; l'affichage est
 * dérivé (`spellRangeFormat.formatSpellDuration`). La MESURE est une `Formula` (engine/ops).
 */
import type { SpellData } from '../data';

/** Durée d'un sort (`spellDurationSchema`, `data/schemas/defs/spells.ts`) ; LDB 47 l.311. */
export type SpellDuration = NonNullable<SpellData['duration']>;

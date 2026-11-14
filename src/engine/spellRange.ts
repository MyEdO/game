/**
 * Portée et Cible d'un sort — données STRUCTURÉES (LDB 46/47), lues telles quelles par le moteur ;
 * l'affichage est dérivé par `spellRangeFormat.ts`. La MESURE est une `FormuleSansTirage` (engine/ops).
 */
import type { SpellData } from '../data';

/** Portée d'un sort — d'OÙ il peut être lancé (`spellRangeSchema`, `data/schemas/defs/spells.ts`). */
export type SpellRange = NonNullable<SpellData['range']>;

/** Cible d'un sort — QUI/QUOI il affecte (`spellTargetSchema`, `data/schemas/defs/spells.ts`). Une ZONE
 *  (`area`) n'admet que le candidat dont `affects` est vraie (`target` = le candidat, `caster` = le
 *  lanceur) ; absent = LDB 47 l.28. `maison` : AGENTS.md règle 7. */
export type SpellTarget = NonNullable<SpellData['target']>;

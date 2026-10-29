/**
 * Le TEXTE d'une Difficulté affichée, SOURCE UNIQUE pour tout hôte : la modale de jet du web (`ui/RollLine`), le
 * réticule et les badges du stage (`gameIso/stage`), et tout hôte qui lit la partie sans écran. Le cran de
 * l'échelle quand la composition en atteint un, sinon le modificateur RÉEL nommé par le catalogue
 * (`difficulty.combinee`, `LDB 14 l.91-96`). Jamais le cran VOISIN, jamais la Difficulté déclarée seule quand
 * `combined` est posé.
 *
 * Le moteur et l'état transportent la DONNÉE (`difficulty` + `difficultyCombined`, `engine/combat.ts`
 * `DifficultyShown`) ; ce module la met en mots par `t()`, et il est la seule maison du mot hors du catalogue
 * i18n (garde `noyau/roll-line-combat.hors-store.test.ts`).
 */
import { avecSigne, DIFFICULTY_LABELS, type Difficulty } from '../engine/types';
import type { DifficultyShown, ModLine } from '../engine/combat';
import { t } from '../i18n';

/** Un modificateur TEL QU'IL SE LIT (« +10 Soutien », « −20 Localisation visée ») — source UNIQUE : la chip du web le
 *  rend, le popover du palier dérivé énumère sa composition avec la MÊME écriture, et tout hôte l'écrit ainsi. */
export const texteDuMod = (m: ModLine): string => `${avecSigne(m.value)} ${m.label}`;

export function difficultyText(difficulty: Difficulty, combined?: number): string {
  return combined != null
    ? t('difficulty.combinee', { mod: avecSigne(combined) })
    : DIFFICULTY_LABELS[difficulty];
}

/** Même texte depuis la Difficulté transportée : `null` quand aucune n'a été résolue. */
export function difficultyShownText(d: DifficultyShown | undefined): string | null {
  return d ? difficultyText(d.difficulty, d.difficultyCombined) : null;
}

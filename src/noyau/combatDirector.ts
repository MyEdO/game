/**
 * Réalisateur de combat — couche de CADENCE pure (le « rythme » lisible des beats).
 *
 * Module FEUILLE : n'importe RIEN de combatFlow ; tout passe par `get()`. Unique
 * rôle = calculer la TENUE d'un beat = base `TEMPO` recentrée × facteur d'importance du dernier
 * évènement marquant (un critique / une mise à mort / une Peur tiennent plus longtemps à l'écran).
 * C'est la SOURCE UNIQUE du couplage cadence × importance : les sites d'IA (`combatFlow`) et
 * d'auto-cadence (`combatAuto`) l'appellent au lieu d'un délai `TEMPO` brut.
 *
 * Pas d'état nouveau : le ton est dérivé de `battle.log` (source unique des résultats) via `lastEventTone`.
 */
import type { Get } from './flowTypes';
import { TEMPO } from './monde/tempo';
import { walkMs } from '../geometry/walk';
import { lastEventTone, type CombatTone } from './combatLog';

type Pt = { x: number; y: number };

/** Facteur de tenue par ton : un temps fort reste affiché plus longtemps. */
const TONE_HOLD: Record<CombatTone, number> = { normal: 1, strong: 1.25, grave: 1.5 };

/** Tenue (ms) d'un beat : base `TEMPO[base]` × facteur de ton de la dernière ligne importante du combat. */
export function beatHold(get: Get, base: keyof typeof TEMPO): number {
  const b = get().battle;
  const tone: CombatTone = b ? lastEventTone(b.log) : 'normal';
  return Math.round(TEMPO[base] * TONE_HOLD[tone]);
}

/** Le beat « APPROCHE puis AGIS » — source UNIQUE de la durée « rejoindre la cible avant de résoudre » : durée
 *  réelle de marche (`walkMs`) + un beat lisible (`afterMove`), 0 sans déplacement (déjà au contact → résolution
 *  immédiate). La frappe différée du joueur comme celle de l'IA s'y tient (`combatFlow.armerLaSuite`). */
export function approachMs(get: Get, path: Pt[] | null | undefined): number {
  return path && path.length > 1 ? walkMs(path) + beatHold(get, 'afterMove') : 0;
}

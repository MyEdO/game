/**
 * Ivresse — Résistance à l'alcool (Livre de base, Compétences, LDB 09 l.471-487). Rien d'inventé :
 *
 *  - « Après chaque boisson alcoolisée, faites un Test de Résistance à l'alcool, modifié par la
 *    puissance de la boisson. Pour chaque Test auquel vous échouez, vous subissez une pénalité de −10
 *    à vos CC, CT, Ag, Dex et Int, jusqu'à un maximum de −30 par Caractéristique. » → `drunkCharPenalties`
 *    (−10 × min(3, échecs), kind `ivresse`, sommé LDB 14 l.95).
 *  - « Si vous échouez à un nombre de Tests égal à votre Bonus d'Endurance, vous êtes Ivre. » → seuil
 *    `alcoholFailures(c) >= BE` ⇒ 1d10 sur le Tableau d'Ivresse (`drunkenness.json`).
 *  - « Après une heure passée sans boire, effectuez un Test de Résistance à l'alcool Intermédiaire (+0).
 *    Les effets de l'ivresse se dissiperont après 10 − DR heures … Une fois tous les effets dissipés,
 *    effectuez un nouveau Test … Vous avez à présent la gueule de bois, qui correspond à l'État Exténué
 *    et ne peut pas être retiré pendant 5 − DR heures. » → `soberUpDissipate` (dissipation) + `soberUpHangover` (gueule de bois) =
 *    Exténué à durée d'horloge (`addClockCondition`, purgée par l'entretien).
 *  - « Vous pouvez dépenser 1 Point de Détermination pour ignorer les modificateurs négatifs de
 *    l'ivresse jusqu'à la fin du prochain Round. » → flag `drunkIgnore` (ActiveEffect 1 Round) lu par
 *    le collecteur `passiveMods` (kind `ivresse` non émis tant qu'il dure).
 *
 * L'Ivresse n'est pas un système optionnel (elle ne vit pas au registre `OPTIONAL_RULES`) : elle
 * n'a d'effet que si un personnage BOIT de l'alcool (consommable Flow d'une boisson alcoolisée →
 * op `intoxicate` sur un Test raté). PUR : mute
 * `c`, renvoie journaux ; le RNG est injecté ; la valeur du Test de Résistance à l'alcool et le Bonus
 * d'Endurance sont passés par l'appelant (comme `provisions.ts`).
 */
import type { Combatant, CharKey } from './types';
import { RNG, d10 } from './dice';
import { findTableEntry } from './tables';
import type { GameOp } from './ops';
import { addClockCondition, removeActiveEffects } from './conditions'; // cycle runtime (conditions→characteristics→trauma→drunkenness) : appelés au dessoûlage, jamais à l'init
import drunkennessJson from '../data/drunkenness.json';
import { t } from '../i18n';

// La MÉCANIQUE d'un résultat d'Ivresse (Bravoure/meilleur ami/belligérant) est RENDUE en `GameOp[]`
// (`DrunkEntry.ops`, données de `drunkenness.json`) et appliquée par l'APPELANT, sous le ctx imbriqué de
// son op (`case 'intoxicate'` d'`applyOps`, le seul).

/** Caractéristiques pénalisées par l'Ivresse (LDB 09 l.475). */
export const DRUNK_CARACS: CharKey[] = ['capacite-de-combat', 'capacite-de-tir', 'agilite', 'dexterite', 'intelligence'];

/** État d'ivresse d'un personnage (absent = sobre). */
export interface DrunkState {
  /** Tests de Résistance à l'alcool ratés (−10/échec aux DRUNK_CARACS, plafond −30). */
  failedTests: number;
  /** Seuil d'Ivresse franchi (échecs ≥ BE) : un résultat du Tableau d'Ivresse a été tiré. */
  drunk?: boolean;
  /** id du résultat d'Ivresse tiré (`drunkenness.json`). */
  result?: string;
}

/** Entrée du Tableau d'Ivresse — MÊME schéma que `drunkenness.json::entries` (exportée pour l'exposition
 *  Codex, #422 : `data/overrides.ts` la réutilise pour typer la table live). */
export interface DrunkEntry { id: string; min: number; max: number; label: string; outcome: string; desc: string; ops?: GameOp[] }
const DRUNK_TABLE = (drunkennessJson as { entries: DrunkEntry[] }).entries;

/** Nombre d'échecs de Résistance à l'alcool accumulés. */
export function alcoholFailures(c: Combatant): number {
  return c.drunk?.failedTests ?? 0;
}

/** Ivre (seuil BE d'échecs franchi) ? */
export function isDrunk(c: Combatant): boolean {
  return c.drunk?.drunk === true;
}

/** Pénalité d'Ivresse aux DRUNK_CARACS : −10 par échec, plafond −30 (LDB 09 l.475). 0 sinon. */
export function drunkPenalty(c: Combatant): number {
  const f = alcoholFailures(c);
  return f > 0 ? -10 * Math.min(3, f) : 0;
}

/** Pénalités de Caractéristique dues à l'Ivresse (injectées dans `effectiveChar` via `passiveMods`).
 *  Seules CC/CT/Ag/Dex/Int sont touchées (l.475). Retourne [] pour les autres. */
export function drunkCharPenalties(c: Combatant, key: CharKey): number[] {
  const p = drunkPenalty(c);
  return p < 0 && DRUNK_CARACS.includes(key) ? [p] : [];
}

/**
 * Applique le résultat d'UN Test de Résistance à l'alcool consécutif à une boisson (l.475). Sur un
 * échec : +1 échec (donc −10 supplémentaire aux DRUNK_CARACS, plafond géré par `drunkPenalty`). Si le
 * nombre d'échecs atteint le Bonus d'Endurance `be` et que le personnage n'était pas déjà Ivre : il
 * devient Ivre → tirage 1d10 sur le Tableau d'Ivresse (effet appliqué par `applyDrunkResult`). Mute `c`.
 */
export function applyAlcoholTest(c: Combatant, success: boolean, be: number, rng: RNG): { log: string[]; becameDrunk?: DrunkEntry; drunkOps?: GameOp[] } {
  const s: DrunkState = c.drunk ?? { failedTests: 0 };
  const log: string[] = [];
  if (success) { c.drunk = s; return { log }; }
  s.failedTests += 1;
  c.drunk = s;
  log.push(t('drunk.failedTest', { name: c.label, n: s.failedTests, cap: s.failedTests >= 3 ? t('drunk.fragCap') : '' }));
  if (!s.drunk && s.failedTests >= Math.max(1, be)) {
    const entry = applyDrunkResult(c, rng);
    log.push(t('drunk.isDrunk', { name: c.label, desc: entry.desc }));
    return { log, becameDrunk: entry, drunkOps: entry.ops };
  }
  return { log };
}

/** Passe le personnage Ivre : tire 1d10 sur le Tableau d'Ivresse et enregistre le résultat (`c.drunk`).
 *  La MÉCANIQUE (Bravoure → +20 Calme ; « meilleur ami » → ignore Préjugés/Animosités ; « tous » →
 *  Animosité (Tout le monde)) est `entry.ops` (`GameOp[]` de `drunkenness.json`) — RENDUE, pas exécutée
 *  ici (cf. en-tête) ; c'est `applyAlcoholTest`/l'appelant qui la joue via `applyOps`. La gueule de bois
 *  et le risque d'Empoisonné du résultat « blackout » restent résolus au dessoûlage (`soberUpDissipate`, `soberUpHangover`). Mute `c`. */
export function applyDrunkResult(c: Combatant, rng: RNG): DrunkEntry {
  const roll = d10(rng);
  const entry = findTableEntry(DRUNK_TABLE, roll);
  const s = c.drunk ?? { failedTests: 0 };
  s.drunk = true;
  s.result = entry.id;
  c.drunk = s;
  // 'staggering' (Mvt OU Action) : lu par le tour de combat via `drunkStaggers` ; 'blackout' résolu au dessoûlage.
  return entry;
}

/** Résultat d'Ivresse « la pièce tourne » (l.481) : le tour n'autorise QUE Mouvement OU Action, pas les
 *  deux. Prédicat lu par la couche de tour de combat. */
export function drunkStaggers(c: Combatant): boolean {
  return c.drunk?.result === 'piece-tourne';
}

/** Id des ActiveEffect d'ivresse : posé par l'op d'alcool (`applyOps`), retiré au dessoûlage. */
export const EFFET_D_IVRESSE = 'ivresse';

/** 1ᵉʳ Test du dessoûlage (l.485) : le DR fixe la dissipation (10 − DR h). Lève l'état d'Ivresse et retire
 *  les ActiveEffect d'ivresse (marqués `effectId:'ivresse'` — identité, jamais le libellé). `{ log: [] }`
 *  si le combattant n'était pas ivre (no-op). Mute `c`. */
export function soberUpDissipate(c: Combatant, drDissipation: number): { log: string[] } {
  if (!c.drunk) return { log: [] };
  const dissipH = Math.max(0, 10 - drDissipation);
  removeActiveEffects(c, (e) => e.effectId === EFFET_D_IVRESSE);
  c.drunk = undefined;
  return { log: [t('drunk.soberUp', { name: c.label, h: dissipH })] };
}

/** 2ᵉ Test du dessoûlage (l.485) : le DR fixe la gueule de bois, posée ici : Exténué à durée d'horloge
 *  (`addClockCondition`, purgée à l'entretien) pendant 5 − DR h. `now` = minute `gameTime`. Mute `c`. */
export function soberUpHangover(c: Combatant, now: number, drHangover: number): { log: string[] } {
  const hangoverH = Math.max(1, 5 - drHangover);
  addClockCondition(c, 'extenue', 1, now + hangoverH * 60);
  return { log: [t('drunk.hangover', { name: c.label, h: hangoverH })] };
}

/**
 * Événements de combat STRUCTURÉS — le journal ne porte JAMAIS de chaîne libre.
 *
 * Source unique de vérité pour le journal, le bandeau d'événements, et (à venir) le feedback
 * flottant et le cadrage caméra : `kind` (type d'événement) + `actorId`/`targetId` + texte FR
 * déjà composé. L'icône et l'importance se déduisent du `kind` (plus aucun devinage par mots-clés).
 */
import { conditionIdInText, conditionSeverity } from '../engine/conditions';
import { fixedJetOpen, markFixedDie } from './fixedDieMark';
// Alias LOCAL du `set` de Zustand : ce fichier déclare déjà un `Set<CombatEventKind>` (le Set global),
// que le nom importé masquerait.
import type { Get, Set as SetFn } from './flowTypes';

export type CombatEventKind =
  | 'charge' | 'attack' | 'shoot' | 'cast' | 'item' | 'heal' | 'move' | 'flee'
  | 'defensive' | 'aim' | 'focus' | 'frenzy' | 'reload'
  | 'parry' | 'dodge' | 'damage' | 'crit'
  | 'condition' | 'fear' | 'death' | 'round' | 'detail' | 'info';

export interface CombatEvent {
  kind: CombatEventKind;
  text: string;
  actorId?: string;
  targetId?: string;
  /** AUDIENCE (#700) : l'id du porteur dont SEUL le siège qui le tient voit la ligne
   *  (`netOwnership.traceVisible`). Absente = tous les sièges. */
  audience?: string;
}

/** Télégraphe d'intention d'un combattant IA (réticule + ligne sur la carte) : qui vise qui, et de
 *  quelle manière. `kind` choisit le trait (mêlée/charge = ligne PLEINE ; tir/sort = POINTILLÉE) ET
 *  narre la bannière (« charge / attaque / vise / lance un sort »). Une seule source pour les deux. */
export type ActorAimKind = 'melee' | 'charge' | 'ranged' | 'cast';
export interface ActorAim {
  fromId: string;
  toId: string;
  kind: ActorAimKind;
}

/** Construit un événement. */
export function ev(kind: CombatEventKind, text: string, actorId?: string, targetId?: string): CombatEvent {
  return { kind, text, actorId, targetId };
}

/**
 * Enveloppe une liste de lignes (souvent renvoyées par le moteur en `string[]`) en événements.
 * Les sous-lignes indentées « ↳ … » deviennent des `detail` ; les autres prennent `mainKind`.
 */
export function evLines(
  lines: string[],
  mainKind: CombatEventKind,
  actorId?: string,
  targetId?: string,
  audience?: string,
): CombatEvent[] {
  return lines.map((t) => ({
    kind: /^\s*↳/.test(t) ? 'detail' : mainKind,
    text: t,
    actorId,
    targetId,
    ...(audience != null ? { audience } : {}),
  }));
}

/**
 * ROUTAGE UNIQUE d'une conséquence écrite : EN COMBAT elle va au `battle.log` — la surface que le
 * joueur regarde (panneau « Journal de combat » + toast) —, HORS combat au `journal` d'exploration.
 *
 * Pourquoi ici et une seule fois : une ligne jouée pendant un combat qui n'atterrit que dans
 * `state.journal` « finit en rien » (le journal d'exploration n'est pas ouvrable en combat).
 *
 * Consommateurs : `cascade.ts` `commitStep`, `corruptionFlow.ts` `resolveRenounce`, et les deux
 * sorties de `state/combatFlow.ts` — `finishPlayerAction` (qui garde `markActed` / `action:null` au
 * site et passe le drain de `pendingLogQueue` en `extra`) et `castRefused`.
 *
 * MARQUE « dé fixé » sur les DEUX branches : `store.log` la pose pour le journal, `markFixedDie` la
 * pose ici pour le `battle.log` — une conséquence de dé POSÉ garde sa provenance, combat ouvert ou
 * non. Le DRAIN de `pendingLogQueue` n'est PAS fait ici (il vit dans `state/combatEffects.ts`,
 * module lourd) : le site qui en a besoin le passe en `extra`.
 */
export function journaliser(
  get: Get,
  set: SetFn,
  lines: string[],
  kind: CombatEventKind = 'info',
  opts?: { actorId?: string; extra?: CombatEvent[]; audience?: string },
): void {
  const extra = opts?.extra ?? [];
  if (!lines.length && !extra.length) return;
  const b = get().battle;
  if (!b) {
    // `journal: string[]` ne porte pas d'audience (#700) : une ligne réservée n'y entre pas en clair.
    if (opts?.audience != null && lines.length) {
      const m = `[journaliser] ${lines.length} ligne(s) d'audience « ${opts.audience} » hors combat : le journal d'exploration ne porte pas d'audience (#700).`;
      console.error(m);
      if (import.meta.env?.DEV) throw new Error(m);
      return;
    }
    get().log(lines);
    return;
  }
  const dites = fixedJetOpen(get()) ? lines.map(markFixedDie) : lines;
  set({ battle: { ...b, log: [...b.log, ...evLines(dites, kind, opts?.actorId, undefined, opts?.audience), ...extra] } });
}

/**
 * Intensité d'un évènement → CADENCE (le Réalisateur `state/combatDirector` allonge les temps forts)
 * ET emphase visuelle de la bannière (`gameIso/combatNarration`). `grave` = un critique / une mise à
 * mort ; `strong` = une Peur. (#161 : vit ici parce que la cadence du combat en a
 * besoin, ce n'est pas QUE de l'affichage ; le rendu la reprend pour sa propre emphase, sens normal.)
 */
export type CombatTone = 'normal' | 'strong' | 'grave';

const KIND_TONE: Partial<Record<CombatEventKind, CombatTone>> = { crit: 'grave', death: 'grave', fear: 'strong' };
export function toneOf(k: CombatEventKind): CombatTone {
  return KIND_TONE[k] ?? 'normal';
}

/** Types d'événements « temps forts » (bandeau haut ET cadence) — le reste (dégâts bruts, mouvement…)
 *  reste au journal sans ralentir/marquer le rythme. */
const IMPORTANT: Set<CombatEventKind> = new Set([
  'charge', 'attack', 'shoot', 'cast', 'item', 'heal', 'flee',
  'defensive', 'aim', 'focus', 'frenzy', 'crit', 'fear', 'death', 'round',
]);

/** Un évènement `condition`/`detail` est important s'il applique un État INCAPACITANT (Sonné, À terre…
 *  — sévérité ≥ 50, `conditionSeverity`). Le texte est en FRANÇAIS (journal) : l'État nommé se retrouve
 *  par `conditionIdInText` (`engine/conditions`, scan UNIQUE partagé avec `gameIso/combatNarration`),
 *  et tout ce qui suit ne manipule qu'un id. */
function isImportantConditionText(text: string): boolean {
  const id = conditionIdInText(text);
  return id !== undefined && conditionSeverity(id) >= 50;
}

/** Un évènement est-il un « temps fort » (bandeau haut ET cadence) ? */
export function isImportantEvent(e: CombatEvent): boolean {
  if (IMPORTANT.has(e.kind)) return true;
  if (e.kind === 'condition') return isImportantConditionText(e.text);
  return false;
}

/** Ton du DERNIER évènement important du journal (ou `'normal'` si aucun / journal vide) — SOURCE
 *  UNIQUE de cadence pour `combatDirector.beatHold` (le bandeau, lui, garde `gameIso/combatNarration`
 *  pour l'icône/la coloration par camp, hors du périmètre `state`). */
export function lastEventTone(events: CombatEvent[]): CombatTone {
  for (let i = events.length - 1; i >= 0; i--) if (isImportantEvent(events[i])) return toneOf(events[i].kind);
  return 'normal';
}

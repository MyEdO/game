/**
 * Narration du combat — couche AFFICHAGE pure (aucune règle).
 *
 * À partir d'un ÉVÉNEMENT structuré (`CombatEvent` : `kind` + acteur/cible + texte) et de la liste
 * des combattants, dérive :
 *  - une ICÔNE unifiée, déduite du `kind` ; pour les états
 *    appliqués (`condition`/`detail`) on réutilise l'icône de `effectIcons` (source unique),
 *  - les NOMS colorés par camp (allié vert / ennemi rouge) sous forme de segments,
 *  - l'IMPORTANCE (les événements importants remontent dans le bandeau haut ; le reste reste au journal).
 */
import { conditionMeta } from './effectIcons';
import type { IconId } from '../ui/icons';
import type { RecapLine } from '../state/recapLine';
import type { RefusIHM } from '../state/refusVisible';
import {
  type CombatEvent, type CombatEventKind, type ActorAim, type ActorAimKind,
  type CombatTone, toneOf, isImportantEvent,
} from '../state/combatLog';
import { conditionIdInText } from '../engine/conditions';
import { alternationDe } from '../lib/regex';

export interface NarratedSegment {
  text: string;
  team?: 'ally' | 'enemy';
}

export interface NarratedLine {
  raw: string;
  /** Id d'icône du registre `src/ui/icons/` — rendu par `<Icon>` (HTML) ou `<IconG>` (SVG). */
  icon: IconId;
  important: boolean;
  tone: CombatTone;
  segments: NarratedSegment[];
}

interface ComLite {
  id: string;
  label: string;
  kind: string;
}

/** Icône par type d'événement (source unique pour journal + bandeau + pastilles). */
const KIND_ICON: Record<CombatEventKind, IconId> = {
  charge: 'journal/charge', attack: 'action/attack', shoot: 'action/shoot', cast: 'action/cast', item: 'item/consumable', heal: 'journal/heal',
  move: 'journal/move', flee: 'journal/flee', defensive: 'flag/defensive', aim: 'action/aim', focus: 'flag/focus', frenzy: 'flag/frenzy',
  reload: 'journal/reload', parry: 'action/defend', dodge: 'journal/dodge', damage: 'journal/damage', crit: 'journal/critical',
  condition: 'condition/bleeding', fear: 'flag/fear', death: 'journal/death', round: 'journal/round', detail: 'journal/detail', info: 'journal/info',
};

/** États (LDB 16) reconnus dans le texte d'un événement `condition`/`detail` → icône via la
 *  source unique `conditionMeta` (jeu de noms FERMÉ, pas du devinage de verbe libre). Le texte d'un
 *  événement est en FRANÇAIS (journal) → l'État nommé se retrouve par `conditionIdInText`
 *  (`engine/conditions`, scan UNIQUE partagé avec `state/combatLog.isImportantEvent`), puis l'`id`
 *  donne l'icône. Data-driven (zéro liste figée). */
function iconOfState(text: string): IconId | null {
  const id = conditionIdInText(text);
  return id ? conditionMeta(id).icon : null;
}

function iconOf(e: CombatEvent): IconId {
  if (e.kind === 'condition' || e.kind === 'detail') {
    const icon = iconOfState(e.text);
    if (icon) return icon;
  }
  return KIND_ICON[e.kind];
}

/** Découpe le texte en segments, colorant chaque occurrence d'un nom de combattant par son camp. */
function colorize(text: string, combatants: ComLite[]): NarratedSegment[] {
  const named = combatants.filter((c) => c.label && c.label.trim());
  if (!named.length) return [{ text }];

  const teamOf = new Map<string, 'ally' | 'enemy'>();
  // Index de TEXTE (le nom est ce qui apparaît dans la prose narrée) : construction seule, sans
  // interrogation par libellé (#602) — parcours inversé pour que le PREMIER combattant l'emporte.
  for (let i = named.length - 1; i >= 0; i--) teamOf.set(named[i].label, named[i].kind === 'hero' ? 'ally' : 'enemy');

  const re = new RegExp(`(${alternationDe(named.map((c) => c.label))})`, 'g');

  const segs: NarratedSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    segs.push({ text: m[0], team: teamOf.get(m[0]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs.length ? segs : [{ text }];
}

/** Narre un événement de combat : icône unifiée + importance + ton + segments colorés par camp. */
export function narrateEvent(e: CombatEvent, combatants: ComLite[] = []): NarratedLine {
  return { raw: e.text, icon: iconOf(e), important: isImportantEvent(e), tone: toneOf(e.kind), segments: colorize(e.text, combatants) };
}

/** Un événement de combat en LIGNE DE RÉCAP structurée (#1078) : même narration que le journal
 *  (`narrateEvent` — aucun texte n'est composé ici), reversée dans le vocabulaire partagé `RecapLine`
 *  (texte plat + segments tonés par camp + icône). C'est le pont qui permet au renderer unique
 *  (`RecapLineRow`) de rendre une issue de jet comme le journal (`NarratedSegments`) rend sa ligne. */
export function recapLineOfEvent(e: CombatEvent, combatants: ComLite[] = []): RecapLine {
  const n = narrateEvent(e, combatants);
  return { text: n.raw, icon: n.icon, segments: n.segments.map((s) => (s.team ? { text: s.text, team: s.team } : { text: s.text })) };
}

/** Le même pont pour une SUITE d'événements (pile d'issues d'une étape, récap de fin de fenêtre). */
export function recapLinesOfEvents(events: CombatEvent[], combatants: ComLite[] = []): RecapLine[] {
  return events.map((e) => recapLineOfEvent(e, combatants));
}

/** Verbe + kind (icône/ton) pour chaque manière de télégraphe d'intention. */
const INTENT: Record<ActorAimKind, { verb: string; kind: CombatEventKind }> = {
  charge: { verb: 'charge', kind: 'charge' },
  melee: { verb: 'attaque', kind: 'attack' },
  ranged: { verb: 'vise', kind: 'shoot' },
  cast: { verb: 'lance un sort sur', kind: 'cast' },
};

/** Narre l'INTENTION télégraphiée d'un combattant IA (« X charge / attaque / vise / lance un sort sur
 *  Y »). N'est PAS journalisée (doublon de la ligne de résultat) : la bannière la projette le temps du
 *  télégraphe. Réutilise la coloration par camp + l'icône/le ton par kind, comme un évènement. */
export function narrateIntent(aim: ActorAim, combatants: ComLite[] = []): NarratedLine | null {
  const from = combatants.find((c) => c.id === aim.fromId);
  const to = combatants.find((c) => c.id === aim.toId);
  if (!from || !to) return null;
  const { verb, kind } = INTENT[aim.kind];
  const text = `${from.label} ${verb} ${to.label}`;
  return { raw: text, icon: KIND_ICON[kind], important: true, tone: toneOf(kind), segments: colorize(text, combatants) };
}

/** Narre un REFUS de geste (`state/refusVisible`) — MÊME patron que le télégraphe ci-dessus : une
 *  ligne PROJETÉE, jamais journalisée (un clic refusé n'est pas un fait de jeu). Ton `strong` : c'est
 *  une réponse à un geste du joueur, elle doit se remarquer sans crier comme un critique. */
export function narrateRefus(refus: RefusIHM, combatants: ComLite[] = []): NarratedLine {
  return { raw: refus.texte, icon: 'ui/forbidden', important: true, tone: 'strong', segments: colorize(refus.texte, combatants) };
}

/** Les `max` derniers événements IMPORTANTS (pour le bandeau haut), ordre chronologique préservé. */
export function combatFeed(events: CombatEvent[], combatants: ComLite[] = [], max = 3): NarratedLine[] {
  const important = events.filter((e) => isImportantEvent(e)).map((e) => narrateEvent(e, combatants));
  return important.slice(-max);
}

/**
 * Narration du combat — couche AFFICHAGE pure (aucune règle).
 *
 * À partir d'un ÉVÉNEMENT structuré (`CombatEvent` : `kind` + acteur/cible + texte) et de la liste
 * des combattants, dérive :
 *  - une ICÔNE unifiée, déduite du `kind` (plus aucun devinage par mots-clés) ; pour les états
 *    appliqués (`condition`/`detail`) on réutilise l'icône de `effectIcons` (source unique),
 *  - les NOMS colorés par camp (allié vert / ennemi rouge) sous forme de segments,
 *  - l'IMPORTANCE (les événements importants remontent dans le bandeau haut ; le reste reste au journal).
 */
import type { Equipe } from '../engine/relations';
import { conditionMeta } from './effectIcons';
import type { IconId } from '../data/icons';
import type { RecapLine } from '../noyau/recapLine';
import type { RefusIHM } from '../noyau/refusVisible';
import {
  type CombatEvent, type CombatEventKind, type ActorAim, type ActorAimKind,
  type CombatTone, toneOf, isImportantEvent,
} from '../noyau/combatLog';
import { conditionIdInText } from '../engine/conditions';

export interface NarratedSegment {
  text: string;
  team?: Equipe;
}

export interface NarratedLine {
  raw: string;
  /** Id d'icône du registre `src/data/icons/` — rendu par `<Icon>` (HTML) ou `<IconG>` (SVG). */
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
  charge: 'journal/charge', attaque: 'action/attaquer', tir: 'action/tirer', sort: 'action/incanter', objet: 'objet/consommable', soin: 'journal/soin',
  deplacement: 'journal/mouvement', fuite: 'journal/fuite', defensive: 'drapeau/posture-defensive', visee: 'action/viser', focalisation: 'drapeau/focalisation', frenesie: 'drapeau/frenesie',
  rechargement: 'journal/rechargement', parade: 'action/se-defendre', esquive: 'journal/esquive', degats: 'journal/degats', critique: 'journal/critique',
  etat: 'etat/hemorragique', peur: 'drapeau/peur', mort: 'journal/mort', round: 'journal/fin-de-round', detail: 'journal/detail', information: 'journal/information',
};

/** L'icône de l'État (LDB 16) que nomme un événement `condition`/`detail`, par `conditionMeta`. L'État est
 *  son `etat` ; un évènement d'un site encore sans id le retrouve dans son texte (`conditionIdInText`, scan
 *  partagé avec `noyau/combatLog.isImportantEvent`, stock de `condition-event-counter.test.ts`, #1330). */
function iconOfState(e: CombatEvent): IconId | null {
  const id = e.etat ?? conditionIdInText(e.text);
  return id ? conditionMeta(id).icon : null;
}

function iconOf(e: CombatEvent): IconId {
  if (e.kind === 'etat' || e.kind === 'detail') {
    const icon = iconOfState(e);
    if (icon) return icon;
  }
  return KIND_ICON[e.kind];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Découpe le texte en segments, colorant chaque occurrence d'un nom de combattant par son camp. */
function colorize(text: string, combatants: ComLite[]): NarratedSegment[] {
  const named = combatants.filter((c) => c.label && c.label.trim());
  if (!named.length) return [{ text }];

  const teamOf = new Map<string, Equipe>();
  // Index de TEXTE (le nom est ce qui apparaît dans la prose narrée) : construction seule, sans
  // interrogation par libellé (#602) — parcours inversé pour que le PREMIER combattant l'emporte.
  for (let i = named.length - 1; i >= 0; i--) teamOf.set(named[i].label, named[i].kind === 'heros' ? 'allie' : 'ennemi');

  // Noms uniques, du plus long au plus court (évite « Rat » de mordre dans « Rat géant »).
  const names = [...new Set(named.map((c) => c.label))].sort((a, b) => b.length - a.length);
  const re = new RegExp('(' + names.map(escapeRe).join('|') + ')', 'g');

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
  melee: { verb: 'attaque', kind: 'attaque' },
  tir: { verb: 'vise', kind: 'tir' },
  incantation: { verb: 'lance un sort sur', kind: 'sort' },
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

/** Narre un REFUS de geste (`noyau/refusVisible`) — MÊME patron que le télégraphe ci-dessus : une
 *  ligne PROJETÉE, jamais journalisée (un clic refusé n'est pas un fait de jeu). Ton `strong` : c'est
 *  une réponse à un geste du joueur, elle doit se remarquer sans crier comme un critique. */
export function narrateRefus(refus: RefusIHM, combatants: ComLite[] = []): NarratedLine {
  return { raw: refus.texte, icon: 'interface/interdit', important: true, tone: 'strong', segments: colorize(refus.texte, combatants) };
}

/** Les `max` derniers événements IMPORTANTS (pour le bandeau haut), ordre chronologique préservé. */
export function combatFeed(events: CombatEvent[], combatants: ComLite[] = [], max = 3): NarratedLine[] {
  const important = events.filter((e) => isImportantEvent(e)).map((e) => narrateEvent(e, combatants));
  return important.slice(-max);
}

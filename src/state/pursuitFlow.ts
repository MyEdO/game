/**
 * POURSUITE TERRESTRE jouable (LDB 15 l.88-108 — « Poursuites » ; fiche `docs/raw/4e/deplacement.md`).
 *
 * INSTANCIATION DU SOCLE DE SÉQUENCE (`state/sequenceCore`, #1279) : l'état de manche, la persistance,
 * la borne anti-boucle et le cycle ouvrir→clore→rouvrir appartiennent au socle ; ce module ne fournit
 * que ce qui est PROPRE à la poursuite — sa charge utile (Distance, coureurs, adversaires), sa fabrique
 * de manche et son RÉDUCTEUR de clôture, enregistrés sous l'id `pursuit`. Les jugements purs (issue,
 * bonus de vitesse, plus lent, politique de camp PNJ) vivent dans `engine/pursuit.ts`.
 *
 * DRAMATURGIE : une MANCHE par FENÊTRE. Une manche de course est UNE BANDE (`purpose` du socle,
 * `aggregate:'none'`) dont les coureurs sont les RANGÉES (`BatchParticipant`) — LDB 15 l.92 : « Tout
 * participant à la poursuite effectue un Test pour son Mouvement ». Compétence de Mouvement en DONNÉE
 * (`skill` : Athlétisme/Chevaucher/Conduite d'attelages, aucun nom en dur), rangée influençable
 * (Chance/Résilience/Pacte) pour tout coureur dont un siège tient le jet (`jetSurfaced`, fenêtre de
 * GROUPE), rangée AUTO-ROULÉE à la construction sinon (héros conduit par l'IA, cadence Auto/Rapide) ;
 * les adversaires (PNJ) roulent dans le réducteur de clôture. On compare (l.93) le DR le plus BAS des
 * poursuivis au DR le plus HAUT des poursuivants — par les FORMULES DE SCORE du socle (`min`/`max` en
 * donnée) —, la Distance varie de la différence, puis l'issue est jugée par `pursuitOutcome`.
 *
 * RATTRAPÉS (Distance ≤ 0, l.94) : la manche suivante n'est pas une course mais une DÉCISION —
 *  (a) les poursuivis sacrifient leur plus lent OU s'arrêtent et affrontent ;
 *  (b) les poursuivants décident qui s'arrête pour l'affronter et qui continue ;
 *  (c) ou bien le retardataire, qui n'est pas une cible prioritaire, est purement et simplement ignoré ;
 *  (d) la Distance se RECALCULE sans le sacrifié (exemple l.100-102).
 * Un camp tenu par un joueur y ouvre une étape de CHOIX ; un camp PNJ tranche par sa POLITIQUE
 * (`PursuitPolicy`, valeur maison éditable à l'Effet `startPursuit` — règle 7, jamais un MJ implicite).
 */
import type { Get, Set } from './flowTypes';
import { rollTest } from '../engine/tests';
import { effectiveMovement } from '../engine/encumbrance';
import { pursuitTargetMovementBonus } from '../engine/combatFeatures/dispatch';
import type { Combatant, Difficulty } from '../engine/types';
import { byId, combatStakeRef } from '../data/index';
import { battleRng } from './battleRng';
import { registerCascadeApplier, rollBatchParticipant } from './cascade';
import { actorIn } from './combatants';
import { spawnEnemy } from './spawn';
import { testValue } from '../engine/skills';
import type { LivingRef } from '../engine/possession';
import { jetSurfaced } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';
import { freeCons, bandStep, bandRowOfStep, choiceStep, makeBandFactory, rollStep, type BuiltCascadeStep } from './rollSeam';
import {
  pursuitOutcome, pursuitMoveBonus, pursuitLaggard, npcSacrificeChoice, npcPursuerChoice,
  PURSUIT_ESCAPE_DISTANCE, type PursuitFoe, type PursuitPolicy, type PursuitRunner,
} from '../engine/pursuit';
import {
  registerSequence, startSequence, abandonSequence, sequenceScoreOf,
  SEQUENCE_BORNE, type SequenceRound, type SequenceState, type SequenceVerdict,
} from './sequenceCore';
import type { RNG } from '../engine/dice';
import type { BatchParticipant, CascadeStep, PendingCascade } from './pendings';
import type { GameState } from './store';
import { traceLineOf } from '../engine/traceLine';
import { t } from '../i18n';
import { dataLabel } from '../data';
import { stepDetail, stepManche, stepPrecision, idDansLaSequence } from './rollSeam';
import type { PlayerText } from '../i18n/playerText';

/** Adversaire AUTHORÉ d'une poursuite : une RÉFÉRENCE de vivant (bestiaire ou statbloc d'éditeur) et
 *  son identité de course. Ses stats vivent sur la fiche référencée — l'Effet n'en recopie aucune. */
export interface PursuitFoeRef {
  /** Identité dans la course (cibles prioritaires, `LDB 15 l.94`) — posée à l'ouverture si absente. */
  id?: string;
  ref: LivingRef;
}

/** Spécification d'auteur d'une poursuite (posée par l'Effet `startPursuit`). */
export interface PursuitSpec {
  /** Le GROUPE fuit (défaut) ou poursuit. */
  partyRole?: 'fleeing' | 'pursuing';
  /** Distance de départ (LDB 15 l.90 : 1 = presque à portée … 8 = presque hors de portée). */
  distance: number;
  /** Seuil d'évasion (défaut `PURSUIT_ESCAPE_DISTANCE` = 10, l.94). */
  escapeAt?: number;
  /** Compétence de Mouvement testée par le groupe (id STABLE : Athlétisme à pied / Chevaucher / Conduite d'attelages). */
  skill: string;
  /** Adversaires du groupe — des RÉFÉRENCES, résolues sur leur fiche par `resolvePursuitFoe`. */
  foes: PursuitFoeRef[];
  /** Rencontre ouverte au RATTRAPAGE (Distance ≤ 0) — combat. Absente : la poursuite se dénoue au récit. */
  encounter?: string;
  /** Politique du camp PNJ pour les trois décisions de l.94 — valeurs maison, éditables par scène. */
  policy?: PursuitPolicy;
}

/**
 * POLITIQUE PNJ PAR DÉFAUT — valeur MAISON (le RAW l.94 confie ces choix aux camps ; sans MJ, un camp
 * joué par le moteur a besoin d'une politique, cf. règle 7). Chaque valeur est éditable à l'Effet
 * `startPursuit`, par scène.
 *  · `sacrifice:'toujours'` — les poursuivis PNJ abandonnent leur plus lent : « sacrifier le plus lent
 *    d'entre eux afin de RALENTIR les poursuivants et de poursuivre leur fuite » (l.94). Le sacrifié
 *    occupe la chasse ; sa vitesse propre n'entre pas dans ce calcul, et l'exemple canonique le joue
 *    sur un camp où aucun Mouvement ne distingue les trois cultistes (l.98-100). La retenue reste
 *    disponible en donnée (`sacrifice:'si-ecart'` + `ecartM`, ou `'jamais'`).
 *  · `arret:'le-plus-lent'` — le poursuivant le plus lent s'arrête pour l'affronter, les plus rapides
 *    restent en chasse (« les poursuivants décident de qui s'arrête pour l'affronter et qui continue »).
 *  · `prioritaires` non déclaré — aucune cible prioritaire nommée, donc personne n'est ignoré ; une
 *    scène qui nomme ses cibles rend l'abandon du retardataire possible (« Si le pauvre retardataire
 *    n'est pas une cible prioritaire, il se peut qu'il soit purement et simplement ignoré ! »).
 */
export const PURSUIT_POLICY_DEFAUT: Required<Pick<PursuitPolicy, 'sacrifice' | 'arret'>> = {
  sacrifice: 'toujours',
  arret: 'le-plus-lent',
};

/** Le camp d'un rattrapage, gelé le temps des décisions (l.94) : les DR TOTAUX de la manche par camp et
 *  la Distance d'AVANT la manche — le recalcul (d) rejoue l'étape 3 sur cette même Distance. */
interface PursuitPris {
  laggard: PursuitRunner & { side: 'party' | 'foes' };
  fleeing: PursuitRunner[];
  pursuers: PursuitRunner[];
  distanceAvant: number;
}

/** CHARGE UTILE de la séquence de poursuite (le socle la transporte sans jamais la lire). */
export interface PursuitPayload {
  partyRole: 'fleeing' | 'pursuing';
  distance: number;
  escapeAt: number;
  skill: string;
  foes: PursuitFoe[];
  encounter?: string;
  policy: PursuitPolicy;
  /** Numéro de MANCHE DE COURSE (les fenêtres de décision n'en consomment pas). */
  manche: number;
  /** Ce que la prochaine fenêtre met en jeu : la course, ou l'une des deux décisions de l.94. */
  phase: 'course' | 'choix-fuyards' | 'choix-poursuivants';
  /** Héros SORTIS de la course (sacrifiés, ou arrêtés pour affronter le sacrifié). */
  retires: string[];
  pris?: PursuitPris;
}

/** L'état de séquence d'une poursuite. */
export type PursuitSequence = SequenceState<PursuitPayload>;

/** Id de la définition de séquence de la poursuite (donnée : il est écrit dans les sauvegardes). */
export const PURSUIT_SEQUENCE = 'pursuit';

const PURSUIT_MOVE_KIND = 'pursuitMove';
const PURSUIT_CHOICE_KIND = 'pursuitChoice';

/** Difficulté du Test de Mouvement d'une manche : LDB 15 l.92 n'en pose aucune — le Test est nu. */
const PURSUIT_DIFFICULTY: Difficulty = 'intermediaire';

/** DR SIGNÉ — la forme sous laquelle la poursuite chiffre un Degré de Réussite (rangée, issue de jet). */
const drSigne = (sl: number): string => `${sl >= 0 ? '+' : ''}${sl}`;

/** L'issue en clair d'un jet d'adversaire : son DR (`TraceRow.issue`). */
const drDit = (sl: number): PlayerText => t('pursuit.dr', { dr: drSigne(sl) });

/** La DISTANCE en cours, telle que les TITRES DE MANCHE la précisent (`SequenceRound.title`). */
const distanceDite = (p: PursuitPayload): PlayerText => t('pursuit.titreDistance', { distance: p.distance, evasion: p.escapeAt });

/** La poursuite EN COURS (charge utile de la séquence), ou `null` — lecture partagée avec l'UI. */
export function pursuitOf(s: GameState): PursuitPayload | null {
  const seq = s.sequence as PursuitSequence | null;
  return seq && seq.def === PURSUIT_SEQUENCE ? seq.payload : null;
}

/** Applier de la BANDE de manche : MUET côté conséquence (la résolution de la manche est GLOBALE — elle
 *  compare tous les DR à la clôture, le réducteur de séquence) ; ne pousse qu'une ligne de journal
 *  lisible PAR RANGÉE. Une bande sans rangées RENONCE (fail-closed, patron `registerNightBandApplier`). */
registerCascadeApplier(PURSUIT_MOVE_KIND, (get, _set, step) => {
  if (!step.participants) return;
  const lines: string[] = [];
  for (const row of step.participants) {
    const dr = row.result?.sl ?? 0;
    const who = actorIn(get(), row.id)?.label ?? row.id;
    lines.push(t('pursuit.row', { who, label: row.label ?? t('step.pursuitMouvement'), dr: drSigne(dr) }));
  }
  return { consequences: freeCons(lines) };
});

/** Applier de l'étape de DÉCISION (l.94) : la voie choisie est lue par le réducteur de clôture — ici,
 *  seule la phrase de ce qui a été décidé entre au récit. */
registerCascadeApplier(PURSUIT_CHOICE_KIND, (_get, _set, step) => {
  const choisi = step.options?.find((o) => o.key === step.chosen);
  return choisi ? { consequences: freeCons([choisi.label]) } : undefined;
});

/** Héros du groupe ENCORE en course (vivants, dans la rencontre, non retirés par une décision de l.94). */
function runners(get: Get, retires: readonly string[] = []): Combatant[] {
  return get().party.filter((h) => !h.dead && !h.outOfRencontre && !retires.includes(h.id));
}

/** Mouvement d'un héros DANS la course (LDB 15 l.104-108) : son Mouvement effectif, +1 pour la Cible
 *  d'une Poursuite quand une capacité le confère (Fuite ! variante AA 13 l.68 — `pursuitTargetBonus`,
 *  active en mode « Avantage de groupe »). Le groupe est la Cible quand il FUIT. SOURCE UNIQUE du M de
 *  poursuite : le plus lent de la course et le DR de vitesse en découlent tous deux. */
export function pursuedMovement(h: Combatant, partyRole: 'fleeing' | 'pursuing'): number {
  return effectiveMovement(h) + (partyRole === 'fleeing' ? pursuitTargetMovementBonus(h) : 0);
}

/** RANGÉE d'un coureur dans la manche : son Test de Mouvement, monté par le MONTEUR CANONIQUE
 *  (`rollSeam.rollStep`, hors canal combat — la poursuite se joue hors arène) : `base` NUE, tout écart
 *  en `mods` NOMMÉS, cible dérivée.
 *
 *  SURFAÇAGE par `jetSurfaced` (SEAT-AGNOSTIQUE, patron `combatFlow.ts` — rangées de Contre-sort et
 *  d'opposition de cible) : le coureur d'un AUTRE siège garde une rangée à JOUER, c'est son joueur qui
 *  la roulera (`pilotedByHuman`/`humanControlled` sont des prédicats d'affordance LOCALE : ils
 *  voleraient le jet de l'invité). Reste TÉMOIN (`interactive:false`) le coureur qu'aucun siège ne
 *  tient — héros conduit par l'IA — et toute rangée en cadence Auto/Rapide, où les jets se lancent
 *  sans influence. Une rangée témoin NAÎT avec son `result` (roulé ici) : son DR compte dans la
 *  comparaison de la manche et `stepReady` ne l'attend jamais. */
function pursuitRow(get: Get, h: Combatant, skill: string, label: string): BatchParticipant {
  const row: BatchParticipant = {
    id: h.id, label, skillId: skill, difficulty: PURSUIT_DIFFICULTY, result: null, interactive: true,
    ...rollStep({ actor: h, test: { skill }, difficulty: PURSUIT_DIFFICULTY }),
  };
  if (!cadenceAuto() && jetSurfaced(get(), h)) return row;
  return { ...row, interactive: false, result: rollBatchParticipant(row, battleRng()) };
}

/** Ouvre une manche de COURSE : UNE bande, une RANGÉE par coureur (LDB 15 l.92). `undefined` sans
 *  coureur. La POSSESSION est posée par le mint (`bandStep`) : plusieurs coureurs → fenêtre de GROUPE
 *  (l.92, « tout participant » — sans elle l'arbitre rend `undefined` et l'invité ne verrait jamais la
 *  manche où se tient son Test), un seul coureur → SON `actorId`. */
function pursuitRoundBand(get: Get, p: PursuitPayload, label: string): BuiltCascadeStep | undefined {
  const participants = runners(get, p.retires).map((h) => pursuitRow(get, h, p.skill, label));
  return bandStep({
    // L'id est une ADRESSE (rang dans la séquence) ; la MANCHE, elle, voyage sur `meta.round` (#1852).
    id: idDansLaSequence(get, 'pursuit'),
    kind: PURSUIT_MOVE_KIND,
    icon: 'travel/foot',
    label: stepManche(p.manche, dataLabel(label)),
    stake: combatStakeRef('pursuitMove', { values: { distance: p.distance, evasion: p.escapeAt } }),
    meta: { round: p.manche },
  }, participants);
}

/** RÉSOUT un adversaire authoré en coureur : sa fiche est projetée par la couture UNIQUE de spawn
 *  (bestiaire ou statbloc — les deux canaux de `spawnEnemy`), puis LUE : Mouvement effectif et valeur
 *  de Test de LA Compétence de la course (`skillId`, la même que celle des héros, `LDB 15 l.92`). */
function resolvePursuitFoe(f: PursuitFoeRef, index: number, skillId: string): PursuitFoe {
  const id = f.id ?? `foe-${index + 1}`;
  const ref = f.ref;
  const fiche = spawnEnemy('creatureId' in ref ? { ref: ref.creatureId } : { statblock: ref.custom }, id, { x: 0, y: 0 });
  return { id, label: fiche.label, movement: effectiveMovement(fiche), skill: testValue(fiche, skillId) };
}

/** Démarre une poursuite terrestre (Effet `startPursuit`) : instancie le socle puis ouvre la 1ʳᵉ manche. */
export function startGroundPursuit(get: Get, set: Set, spec: PursuitSpec): void {
  if (!spec.foes.length || !runners(get).length) { get().log(t('pursuit.none')); return; }
  const escapeAt = spec.escapeAt ?? PURSUIT_ESCAPE_DISTANCE;
  // Distance de départ bornée dans la course (1 .. escapeAt−1) — hors bornes = déjà rattrapé/semé.
  const distance = Math.max(1, Math.min(escapeAt - 1, Math.round(spec.distance)));
  const partyRole = spec.partyRole ?? 'fleeing';
  const payload: PursuitPayload = {
    partyRole, distance, escapeAt, skill: spec.skill,
    foes: spec.foes.map((f, i) => resolvePursuitFoe(f, i, spec.skill)),
    ...(spec.encounter ? { encounter: spec.encounter } : {}),
    policy: { ...PURSUIT_POLICY_DEFAUT, ...(spec.policy ?? {}) },
    manche: 0, phase: 'course', retires: [],
  };
  get().log(t('pursuit.open', {
    camp: t(partyRole === 'fleeing' ? 'pursuit.openFleeing' : 'pursuit.openPursuing'),
    distance, evasion: escapeAt,
  }));
  startSequence(get, set, {
    def: PURSUIT_SEQUENCE,
    // FORMULES DE SCORE EN DONNÉE (l.93) : les poursuivis comptent leur DR le plus BAS, les
    // poursuivants le plus HAUT — le socle applique, ce module ne compare pas à la main.
    params: { score: { fleeing: 'min', pursuers: 'max' } },
    payload,
  });
}

/** Ouvre une manche : la fabrique DÉCLARÉE au socle. Une manche de COURSE est une bande ; une manche de
 *  DÉCISION (l.94) est une étape de choix portée par un héros du camp qui décide. */
function pursuitRoundFactory(get: Get, seq: PursuitSequence): SequenceRound<PursuitPayload> | undefined {
  const p = seq.payload;
  const label = byId('skill', p.skill)?.label ?? p.skill;
  if (p.phase === 'course') {
    // Le rang de MANCHE DE COURSE avance ici et repart avec la charge utile (le socle l'applique) : les
    // fenêtres de décision de l.94 n'en consomment aucun.
    const manche = p.manche + 1;
    const band = pursuitRoundBand(get, { ...p, manche }, label);
    if (!band) return undefined;
    return {
      title: stepPrecision(t('pursuit.titreManche', { n: manche }), distanceDite(p)),
      icon: 'travel/foot',
      steps: [band],
      payload: { ...p, manche },
    };
  }
  const pris = p.pris;
  if (!pris) return undefined;
  const step = p.phase === 'choix-fuyards' ? choixFuyards(get, p, pris) : choixPoursuivants(get, p, pris);
  if (!step) return undefined;
  return { title: stepPrecision(t('pursuit.titreRattrapes'), distanceDite(p)), icon: 'travel/foot', steps: [step] };
}

/** DÉCISION (a) des poursuivis, l.94 — portée par un coureur du camp AUTRE que le retardataire (on ne
 *  demande pas à l'abandonné de décider de son sort). */
function choixFuyards(get: Get, p: PursuitPayload, pris: PursuitPris): BuiltCascadeStep | undefined {
  const camp = runners(get, p.retires);
  const porteur = camp.find((h) => h.id !== pris.laggard.id) ?? camp[0];
  if (!porteur) return undefined;
  return choiceStep({
    id: `pursuit-${p.manche}-fuyards`,
    kind: PURSUIT_CHOICE_KIND,
    icon: 'travel/foot',
    label: t('step.pursuitRattrapes'),
    actorId: porteur.id,
    options: [
      { key: 'sacrifier', label: t('opt.abandonner', { who: pris.laggard.label }), detail: 'Le plus lent est laissé derrière pour ralentir les poursuivants — la fuite continue (LDB 15 l.94).' },
      { key: 'affronter', label: t('opt.affronter'), detail: 'Le groupe fait face aux poursuivants (LDB 15 l.94).' },
    ],
  });
}

/** DÉCISIONS (b)+(c) des poursuivants, l.94 — une voie par poursuivant qui peut s'arrêter, plus
 *  l'abandon pur et simple du retardataire. */
function choixPoursuivants(get: Get, p: PursuitPayload, pris: PursuitPris): BuiltCascadeStep | undefined {
  const camp = runners(get, p.retires);
  if (!camp.length) return undefined;
  return choiceStep({
    id: `pursuit-${p.manche}-poursuivants`,
    kind: PURSUIT_CHOICE_KIND,
    icon: 'travel/foot',
    label: stepDetail(t('step.abandonne', { who: pris.laggard.label }), t('step.quiSarrete')),
    actorId: camp[0].id,
    options: [
      ...camp.map((h) => ({ key: `arreter:${h.id}`, label: t('opt.sarrete', { who: h.label }), detail: 'Les autres continuent la poursuite (LDB 15 l.94).' })),
      { key: 'ignorer', label: t('opt.ignorer', { who: pris.laggard.label }), detail: 'Le retardataire n\'est pas une cible prioritaire — tous continuent (LDB 15 l.94).' },
    ],
  });
}

/** Rang de manche d'une étape MONO de poursuite (`pursuit-<manche>-<coureur>`), `null` si l'étape n'en
 *  est pas une (autre kind, bande déjà formée, pas de porteur ni de cible). */
function monoPursuitRound(step: CascadeStep): string | null {
  if (step.kind !== PURSUIT_MOVE_KIND || step.participants || typeof step.actorId !== 'string' || step.target == null) return null;
  // La manche est une DONNÉE de l'étape (`meta.round`), jamais un rang parsé dans son id (#1852).
  return String(step.meta?.round ?? 0);
}

/**
 * FABRIQUE de bandification des étapes MONO de manche — SOURCE UNIQUE de la conversion : une manche
 * où chaque coureur porterait SA propre étape redevient UNE bande par manche, sans quoi son applier —
 * qui exige des RANGÉES — l'abandonnerait, et la clôture comparerait une manche SANS aucun DR de
 * groupe. Les étapes hors périmètre traversent INTACTES, à leur place (MÊME référence : l'appelant
 * peut comparer pour savoir si rien n'a bougé).
 *
 * DÉCLARATION au socle (`makeBandFactory`, #1262 V2) : la manche restaurée sort MINTÉE comme la manche
 * vive (`pursuitRoundBand`) — même clé de regroupement, même possession posée par `bandStep`. Avant ce
 * mint, une manche venue d'une save n'en portait AUCUNE : l'arbitre rendait la fenêtre à l'hôte seul
 * et l'invité ne voyait pas la manche où se tient son Test (classe #1268).
 */
export const pursuitBands = makeBandFactory<BuiltCascadeStep>({
  passe: (step) => (monoPursuitRound(step) == null ? step : null),
  cle: (step) => monoPursuitRound(step)!,
  rangee: bandRowOfStep,
  situation: (step) => ({
    id: `pursuit-${monoPursuitRound(step)}`, kind: PURSUIT_MOVE_KIND, icon: step.icon,
    label: stepManche(String(monoPursuitRound(step)), step.rollLabel ? dataLabel(step.rollLabel) : t('step.pursuitMouvement')),
    ...(step.stake ? { stake: step.stake } : {}),
    meta: { round: Number(monoPursuitRound(step)) },
  }),
});

/** Les deux camps de la manche, DR totaux compris (Test + bonus de vitesse l.105-108). */
function campsOf(get: Get, p: PursuitPayload, done: PendingCascade, rng: RNG, log: string[]): { fleeing: PursuitRunner[]; pursuers: PursuitRunner[] } {
  // Les DR du groupe sont ceux des RANGÉES de la bande de manche (une par coureur).
  const partyRolls = done.participants
    .filter((s) => s.kind === PURSUIT_MOVE_KIND)
    .flatMap((s) => (s.participants ?? []).map((r) => ({ actorId: r.id, sl: r.result?.sl ?? 0 })));
  const skillLabel = byId('skill', p.skill)?.label ?? p.skill;
  const heros = runners(get, p.retires).map((h) => ({ id: h.id, label: h.label, m: pursuedMovement(h, p.partyRole) }));
  // Plus lent de la course = min des Mouvements de TOUS les participants (héros + adversaires).
  const slowest = Math.min(...heros.map((h) => h.m), ...p.foes.map((f) => f.movement));
  const party: PursuitRunner[] = heros.map((h) => ({
    id: h.id, label: h.label, movement: h.m,
    total: (partyRolls.find((r) => r.actorId === h.id)?.sl ?? 0) + pursuitMoveBonus(h.m, slowest),
  }));
  const foes: PursuitRunner[] = p.foes.map((f) => {
    // Adversaires (pas des PJ) : aucune rangée nulle part pour leur jet — le journal est la SEULE
    // surface, et sa ligne se DÉRIVE (`traceLineOf`) comme toute ligne de dé. Le libellé NOMME la
    // Compétence de la manche — la MÊME que celle des rangées des coureurs. L'issue de CE jet est son DR.
    const t = rollTest(f.skill, PURSUIT_DIFFICULTY, rng);
    log.push(traceLineOf({ who: f.label, label: skillLabel, roll: t.roll, target: t.target, success: t.success, issue: drDit(t.sl) }));
    return { id: f.id ?? f.label, label: f.label, movement: f.movement, total: t.sl + pursuitMoveBonus(f.movement, slowest) };
  });
  return p.partyRole === 'fleeing' ? { fleeing: party, pursuers: foes } : { fleeing: foes, pursuers: party };
}

/** Variation de Distance d'une manche (l.93) — par les FORMULES DE SCORE déclarées en donnée. */
function deltaOf(seq: PursuitSequence, camps: { fleeing: PursuitRunner[]; pursuers: PursuitRunner[] }): number {
  const totaux = (rs: PursuitRunner[]) => rs.map((r) => r.total);
  return sequenceScoreOf(seq.params.score?.fleeing, totaux(camps.fleeing))
    - sequenceScoreOf(seq.params.score?.pursuers, totaux(camps.pursuers));
}

/** Le camp des poursuivis est-il celui du GROUPE (donc décidé par un joueur) ? */
const fuyardsSontLeGroupe = (p: PursuitPayload) => p.partyRole === 'fleeing';

/** RÉDUCTEUR DE CLÔTURE (enregistré sous `pursuit`) : lit les rangées closes, roule les adversaires,
 *  actualise la Distance (l.93), juge l'issue (l.94) et route les décisions de rattrapage. Ne mute rien. */
function pursuitClose(ctx: { get: Get; seq: PursuitSequence; done: PendingCascade; rng: RNG }): SequenceVerdict<PursuitPayload> {
  const { get, seq, done, rng } = ctx;
  const p = seq.payload;
  if (p.phase !== 'course') return closeDecision(seq, done);

  const log: string[] = [];
  const camps = campsOf(get, p, done, rng, log);
  const delta = deltaOf(seq, camps);
  const distance = p.distance + delta;
  log.push(t('pursuit.round', {
    round: p.manche, mouvement: t(delta >= 0 ? 'pursuit.roundGain' : 'pursuit.roundLoss'),
    delta: `${delta >= 0 ? '+' : ''}${delta}`, distance, evasion: p.escapeAt,
  }));
  const outcome = pursuitOutcome(distance, p.escapeAt);
  if (outcome === 'ongoing') return { go: 'continue', payload: { ...p, distance, phase: 'course' }, log };
  if (outcome === 'escaped') return { go: 'end', outcome: 'escaped', payload: { ...p, distance }, log };

  // RATTRAPÉS (l.94) — le camp des poursuivis décide d'abord.
  const laggard = pursuitLaggard(camps.fleeing);
  const apres: PursuitPayload = { ...p, distance, pris: laggard ? {
    laggard: { ...laggard, side: fuyardsSontLeGroupe(p) ? 'party' : 'foes' },
    fleeing: camps.fleeing, pursuers: camps.pursuers, distanceAvant: p.distance,
  } : undefined };
  if (!laggard) return { go: 'end', outcome: 'caught', payload: apres, log };
  if (fuyardsSontLeGroupe(p)) return { go: 'continue', payload: { ...apres, phase: 'choix-fuyards' }, log };
  // Camp PNJ : sa POLITIQUE tranche (a), puis on enchaîne sur (b)/(c).
  if (npcSacrificeChoice(p.policy, laggard, camps.fleeing) === 'affronter') {
    log.push(t('pursuit.stand', { who: laggard.label }));
    return { go: 'end', outcome: 'caught', payload: apres, log };
  }
  log.push(t('pursuit.sacrifice', { who: laggard.label }));
  return decisionPoursuivants(seq, { ...apres, phase: 'choix-poursuivants' }, log);
}

/** Étape (b)/(c) : le camp des poursuivants décide — fenêtre de CHOIX s'il est tenu par le groupe,
 *  POLITIQUE sinon. Puis le recalcul (d). */
function decisionPoursuivants(seq: PursuitSequence, p: PursuitPayload, log: string[]): SequenceVerdict<PursuitPayload> {
  const pris = p.pris!;
  if (!fuyardsSontLeGroupe(p)) return { go: 'continue', payload: p, log }; // le GROUPE poursuit : il choisit
  const choix = npcPursuerChoice(p.policy, pris.laggard, pris.pursuers);
  if (choix.go === 'ignorer') {
    log.push(t('pursuit.ignored', { who: pris.laggard.label }));
    return recalcul(seq, p, undefined, log);
  }
  log.push(t('pursuit.stops', { who: choix.who.label, laggard: pris.laggard.label }));
  return recalcul(seq, p, choix.who.id, log);
}

/** Clôture d'une fenêtre de DÉCISION : la voie choisie par le joueur. */
function closeDecision(seq: PursuitSequence, done: PendingCascade): SequenceVerdict<PursuitPayload> {
  const p = seq.payload;
  const pris = p.pris;
  const chosen = done.participants.find((s) => s.kind === PURSUIT_CHOICE_KIND)?.chosen;
  if (!pris) return { go: 'end', outcome: 'caught' };
  const log: string[] = [];
  if (p.phase === 'choix-fuyards') {
    if (chosen !== 'sacrifier') {
      log.push(t('pursuit.partyStand'));
      return { go: 'end', outcome: 'caught', payload: p, log };
    }
    log.push(t('pursuit.partySacrifice', { who: pris.laggard.label }));
    return decisionPoursuivants(seq, { ...p, phase: 'choix-poursuivants' }, log);
  }
  // (b)/(c) tranchées par le groupe poursuivant.
  if (chosen === 'ignorer' || !chosen) {
    log.push(t('pursuit.partyIgnores', { who: pris.laggard.label }));
    return recalcul(seq, p, undefined, log);
  }
  const whoId = chosen.slice('arreter:'.length);
  const who = pris.pursuers.find((r) => r.id === whoId);
  log.push(t('pursuit.heroStops', { who: who?.label ?? whoId, laggard: pris.laggard.label }));
  return recalcul(seq, p, whoId, log);
}

/**
 * RECALCUL (d) de la Distance après l'abandon du plus lent (exemple l.100-102) : l'étape 3 se REJOUE
 * sur la Distance d'AVANT la manche, le sacrifié retiré du pool des poursuivis ; le poursuivant qui
 * s'arrête quitte la chasse pour les manches suivantes (il est déjà compté dans CE recalcul, comme
 * Sigrid dans l'exemple). Si la Distance reste ≤ 0, les poursuivis sont rejoints — le RAW n'ouvre la
 * manœuvre qu'une fois « pour ce Round ».
 */
function recalcul(seq: PursuitSequence, p: PursuitPayload, arreteId: string | undefined, log: string[]): SequenceVerdict<PursuitPayload> {
  const pris = p.pris!;
  const fleeing = pris.fleeing.filter((r) => r.id !== pris.laggard.id);
  const delta = deltaOf(seq, { fleeing, pursuers: pris.pursuers });
  const distance = pris.distanceAvant + delta;
  log.push(t('pursuit.recompute', {
    who: pris.laggard.label, delta: `${delta >= 0 ? '+' : ''}${delta}`, distance, evasion: p.escapeAt,
  }));
  // Sorties de course : le sacrifié, et le poursuivant qui s'est arrêté.
  const sortis = [pris.laggard, ...(arreteId ? pris.pursuers.filter((r) => r.id === arreteId) : [])];
  const retires = [...p.retires, ...sortis.filter((r) => estHeros(p, r)).map((r) => r.id)];
  const foes = p.foes.filter((f) => !sortis.some((r) => r.id === (f.id ?? f.label)));
  const suite: PursuitPayload = { ...p, distance, retires, foes, phase: 'course', pris: undefined };
  if (pursuitOutcome(distance, p.escapeAt) === 'caught') return { go: 'end', outcome: 'caught', payload: suite, log };
  if (pursuitOutcome(distance, p.escapeAt) === 'escaped') return { go: 'end', outcome: 'escaped', payload: suite, log };
  return { go: 'continue', payload: suite, log };
}

/** Un coureur du camp du GROUPE (donc un héros) ? Les adversaires vivent dans `foes`. */
function estHeros(p: PursuitPayload, r: PursuitRunner): boolean {
  return !p.foes.some((f) => (f.id ?? f.label) === r.id);
}

/** DÉNOUEMENT de la poursuite (l.94) — l'état est déjà retiré : on ne fait que raconter et enchaîner. */
function pursuitSettle(get: Get, _set: Set, seq: PursuitSequence, outcome: string): void {
  const p = seq.payload;
  if (outcome === 'escaped') {
    get().log(t(p.partyRole === 'fleeing' ? 'pursuit.escaped' : 'pursuit.preyEscaped'));
    return;
  }
  if (outcome === SEQUENCE_BORNE) { get().log(t('pursuit.exhausted')); return; }
  if (outcome === 'abandon') {
    if (p.partyRole === 'pursuing') { get().log(t('pursuit.giveUpChase')); return; }
    // Renoncer à fuir = se laisser rattraper (l.94) : combat si une rencontre est fournie.
    get().log(t('pursuit.giveUpFlight'));
    if (p.encounter) get().startCombat(p.encounter);
    return;
  }
  // 'caught' (Distance ≤ 0, l.94) : rattrapage → combat si une rencontre est fournie, sinon récit.
  get().log(t(p.partyRole === 'fleeing' ? 'pursuit.caught' : 'pursuit.caughtPrey'));
  if (p.encounter) get().startCombat(p.encounter);
}

registerSequence<PursuitPayload>(PURSUIT_SEQUENCE, {
  round: (get, seq) => pursuitRoundFactory(get, seq),
  close: (ctx) => pursuitClose(ctx),
  settle: (get, set, seq, outcome) => pursuitSettle(get, set, seq, outcome),
});

/** Abandon de la poursuite (le groupe renonce à courir/traquer) — dénoue sans manche supplémentaire. */
export function pursuitAbandon(get: Get, set: Set): void {
  if (!pursuitOf(get())) return;
  abandonSequence(get, set, 'abandon');
}

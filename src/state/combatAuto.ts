/**
 * Pilote d'AUTO-CADENCE (« Cadence de combat » Rapide / Auto-combat) — brique FEUILLE.
 *
 * `tickCombatAuto` regarde la modale ACTIVE (`pickActiveModalKey`) et, si le mode l'autorise et qu'elle
 * est pilotée LOCALEMENT, la résout en enchaînant ses résolveurs de store — SANS jamais toucher aux
 * actions d'influence (`reroll`/`forceSuccess`/`darkPact`/`bonusSL`) → « zéro dépense » par construction.
 *
 * Deux couches de politique (cf. critique : la granularité réelle des jets de combat est l'étape de
 * cascade, pas une clé modale) :
 *  - `MODAL_DEFS.auto` (modalArbiter) pour les modales STANDALONE (frénésie, course, focalisation, Destin…) ;
 *  - `JET_AUTO` (ici) pour les étapes-JET de la `cascade` de COMBAT (attaque/défense/… bespoke) — leur
 *    résolution passe par leur propre flux (`xRoll`→`xConfirm`, qui fait avancer la cascade), PAS par le
 *    résolveur générique `cascadeResolveAll` (réservé aux jets de NUIT/VOYAGE, qui ont un `target`).
 *
 * Module FEUILLE : n'importe RIEN de `combatFlow` ; tout passe par `get().xxx`. INERT tant que la chaîne
 * de reprise (C3/C4) ne l'appelle pas — `cadenceAuto()` est faux par défaut (mode « manuel »).
 */
import type { Get, Set } from './flowTypes';
import { useGame, type GameState } from './store';
import type { CascadeStep } from './pendings';
import { pickActiveModalKey, modalOwnerOf, autoPolicyOf, type AutoPolicy } from './modalArbiter';
import { stepInteraction } from './cascade';
import { seatOwns, influencesLocally } from './netOwnership';
import { cadenceAuto, cadenceAutoCombat } from '../engine/cadence';
import { beatHold } from './combatDirector';
import { scheduleCombatTimer } from './combatTimers';
import { fateSaveOptions } from '../engine/fortune';

/**
 * Politique d'auto-résolution par TYPE de jet de cascade de COMBAT. `self` = jet propre piloté par son
 * flux bespoke (`drive` = roll → confirm, qui avance la cascade) ; `choice` = vrai choix laissé au joueur
 * en Rapide (Surincantation, menu de Désengagement) ou multi-participant rare (Test étendu, Enfoncer la
 * porte) — tranché par l'IA en Auto-combat (C4). Record exhaustif : ajouter un `jet` force une politique.
 */
export const JET_AUTO: Record<NonNullable<CascadeStep['jet']>, AutoPolicy> = {
  attack: { mode: 'self', drive: ['attackRoll', 'attackConfirm'] },
  trample: { mode: 'self', drive: ['trampleRoll', 'trampleConfirm'] }, // Piétinement : jet propre → Lancer puis Appliquer (comme l'attaque)
  defense: { mode: 'self', drive: ['defenseRoll', 'defenseConfirm'] },
  fumble: { mode: 'self', drive: ['fumbleRoll', 'fumbleConfirm'] },
  test: { mode: 'self', drive: ['testRoll', 'resolveTest'] },
  cast: { mode: 'choice', autoDrive: ['castRoll', 'castConfirm'] }, // Rapide : le joueur décide (surincantation) ; Auto-combat : l'IA incante (sans surincanter)
  disengage: { mode: 'choice' },  // menu d'options (Fuir / Esquiver) — initié par le joueur, n'arrive pas en Auto
  extended: { mode: 'choice' },   // multi-participant (rare en combat)
  forceDoor: { mode: 'choice' },  // multi groupOwner (rare en combat)
};

/**
 * FENÊTRES RÉACTIVES ouvertes DANS l'étape `jet:'cast'` (Contre-sort #1028, opposition de cible #949)
 * et leur drive d'auto-cadence (#1030). Le drive de l'ÉTAPE ne peut traverser ni l'une ni l'autre :
 * `castConfirm` s'abstient sous Contre-sort (la Dissipation se résout AVANT, `LDB 46 l.156`) et
 * `oppositionConfirm` refuse d'agréger tant qu'une rangée interactive n'a pas jeté — `autoDrive` y
 * re-tirait donc à vide (l'opposition allant jusqu'à se RÉOUVRIR à chaque passage, jets compris).
 * POLITIQUE du drive (pas une règle) : chaque rangée jouable ICI jette, puis « Appliquer » — les issues
 * restent tranchées par les agrégations canoniques (`counterspellConfirm` #1040, `oppositionConfirm`),
 * et les rangées non surfacées par leurs chemins existants (`applyCounterspellFallback`, jets témoins
 * roulés à l'ouverture). ORDRE = celui de la chaîne réelle (`resolveCastChain`) : le Contre-sort
 * précède l'opposition (une incantation n'ouvre jamais la seconde tant que la première est posée).
 * Hors cadence auto, rien ne bouge : la fenêtre attend son joueur.
 */
const STEP_WINDOW_AUTO: readonly { rows: (s: GameState) => Row[] | undefined; drive: readonly (keyof GameState)[] }[] = [
  // Contre-sort : la fenêtre a une PHASE 1 de déclaration (#1042/#1059) — la cadence déclare les
  // rangées de CE siège (« contrer seul » = le geste que le joueur posait en lançant) avant de rouler.
  { rows: (s) => s.pendingCounterspell?.participants, drive: ['counterspellDeclareAll', 'counterspellRollAll', 'counterspellConfirm'] },
  { rows: (s) => s.pendingCastOpposition?.participants, drive: ['oppositionRollAll', 'oppositionConfirm'] },
];

/** Rangée d'une fenêtre multi, vue par le pilote : son porteur et son état de jet. */
type Row = { id: string; interactive?: boolean; result: unknown; declared?: string };

/**
 * Drive de la fenêtre réactive OUVERTE, ou `ATTENDRE` quand ce siège n'a pas à la résoudre.
 * GARDE DE POSSESSION (#1005) : l'owner de l'étape `cast` partagée est `'*'` — vrai pour TOUS les
 * sièges — donc `ownerLocal` ne dit RIEN de la fenêtre. Un siège qui « appliquerait » une fenêtre dont
 * une rangée DUE appartient à un autre (le MJ, un autre joueur) la refermerait SANS son jet : sa
 * Dissipation/son Test opposé seraient forfaits. La fenêtre ne se drive donc que si TOUTE rangée
 * encore due est influençable ICI ; sinon elle ATTEND son siège, exactement comme en manuel — et le
 * pilote ne planifie AUCUN beat (pas de poll) : c'est le jet distant, appliqué par le réseau, qui
 * change l'état et re-déclenche le tick (`initCombatAuto`).
 */
const ATTENDRE = 'attendre';
function stepWindowDrive(s: GameState): readonly (keyof GameState)[] | typeof ATTENDRE | null {
  for (const w of STEP_WINDOW_AUTO) {
    const rows = w.rows(s);
    if (!rows) continue;
    // Rangée RÉGLÉE = jetée, PASSÉE (déclaration terminale : elle ne jettera pas) ou non surfacée.
    return rows.every((p) => p.result || p.declared === 'pass' || !p.interactive || influencesLocally(s, p.id)) ? w.drive : ATTENDRE;
  }
  return null; // aucune fenêtre ouverte : l'étape garde son propre drive
}

/** Jeton anti-ré-entrance / double-advance : chaque séquence lancée invalide les précédentes. */
let gen = 0;

/**
 * Le SIÈGE LOCAL possède-t-il la modale active ? MÊME routage que la validation d'intent
 * (`seatOwns`/`intentAllowedFor`) : un ennemi/une étape MONDE appartient au siège MJ (`gmSeat`) quand il
 * existe, jamais « à l'hôte par défaut » — sinon l'hôte auto-résout en Rapide une fenêtre dont le MJ
 * tient la main. Solo (`net` par défaut : mySeat 0, aucun ownership, pas de MJ) : inchangé, tout est à
 * soi. `null`/`'*'` = aucun concerné / moment partagé → résolu localement, comme avant.
 */
function ownerLocal(s: GameState): boolean {
  const owner = modalOwnerOf(s);
  if (owner == null || owner === '*') return true; // hôte / moment partagé (résolu par l'hôte)
  return seatOwns(s, s.net.mySeat, owner);
}

/** Enchaîne les actions `drive` (roll → confirm…) sur des ticks espacés, puis re-tick pour la suite. */
function driveSelf(get: Get, set: Set, drive: readonly (keyof GameState)[]): void {
  const myGen = ++gen;
  let i = 0;
  const step = () => {
    if (myGen !== gen) return;                 // supersédé par un tick plus récent
    if (!ownerLocal(get())) return;
    if (i >= drive.length) { tickCombatAuto(get, set); return; } // séquence finie → continuer (étape/modale suivante)
    const fn = get()[drive[i++]] as undefined | (() => void);
    if (typeof fn === 'function') fn();        // roll() idempotent, puis confirm() (ferme/avance)
    scheduleCombatTimer(step, beatHold(get, 'autoResolve'));
  };
  step();
}

/** Auto-résout la cascade active : jet de COMBAT bespoke (JET_AUTO) ou jet générique nuit/voyage. */
function autoResolveCascade(get: Get, set: Set): void {
  const pc = get().pendingCascade;
  if (!pc) return;
  if (pc.cursor >= pc.participants.length) {
    // BILAN : combat → fermer ; voyage/nuit/test → laisser le RÉSUMÉ au joueur (« Terminer »).
    if (pc.purpose === 'combat') get().cascadeFinish();
    return;
  }
  const cur = pc.participants[pc.cursor];
  if (cur.jet) {
    const pol = JET_AUTO[cur.jet];
    if (pol.mode === 'self') { driveSelf(get, set, pol.drive); return; }
    // 'choice' (cast/disengage/…) : en Auto-combat, l'IA résout via `autoDrive` (incantation) ; en Rapide,
    // on LAISSE la modale au joueur (surincantation = vrai choix). Une fenêtre RÉACTIVE ouverte dans
    // l'étape prend la main sur son drive, et `ATTENDRE` = fenêtre d'un AUTRE siège : on ne touche à
    // RIEN et on ne planifie aucun beat (`STEP_WINDOW_AUTO`/`stepWindowDrive` ci-dessus).
    if (pol.mode === 'choice' && cadenceAutoCombat()) {
      const w = stepWindowDrive(get());
      if (w === ATTENDRE) return;
      const drive = w ?? pol.autoDrive;
      if (drive) driveSelf(get, set, drive);
    }
    return;
  }
  // Étape GÉNÉRIQUE non-jet. Un CHOIX : laissé au joueur en Rapide. En Auto-combat, tranché via le DÉFAUT
  // authoré (`defaultChoice`, ex. déviation Critique → 'devier') ; SANS défaut authoré → laissé au joueur
  // (jamais de hang : `stepAutoResolved` ne masque pas une telle modale).
  if (stepInteraction(cur) === 'choix') {
    if (!cadenceAutoCombat()) return;
    if (cur.chosen == null) {
      if (cur.defaultChoice == null) return; // pas de défaut → décision au joueur (la modale reste visible)
      get().cascadeChoose(cur.id, cur.defaultChoice);
    }
    // Combat : avancer d'UNE étape (comme le joueur) → les étapes-jet en aval (Maladresse…) gardent leur
    // driver bespoke au tick suivant, au lieu d'être écrasées par un `cascadeResolveAll` global.
    if (pc.purpose === 'combat') { get().cascadeNext(); scheduleCombatTimer(() => tickCombatAuto(get, set), beatHold(get, 'autoResolve')); return; }
  }
  get().cascadeResolveAll();
  scheduleCombatTimer(() => tickCombatAuto(get, set), beatHold(get, 'autoResolve')); // gérer le bilan / l'étape suivante
}

/** Une étape de cascade sera-t-elle auto-résolue ? (sert à MASQUER la modale, cf. `willAutoResolve`). */
function stepAutoResolved(s: GameState, step: CascadeStep): boolean {
  if (step.jet) {
    const pol = JET_AUTO[step.jet];
    if (pol.mode === 'self') return true;
    if (pol.mode !== 'choice' || !cadenceAutoCombat()) return false;
    const w = stepWindowDrive(s);
    if (w === ATTENDRE) return false; // fenêtre d'un AUTRE siège : elle RESTE visible (elle n'est pas résolue ici)
    return !!(w ?? pol.autoDrive); // incantation en Auto
  }
  if (stepInteraction(step) === 'choix') return cadenceAutoCombat() && step.defaultChoice != null; // choix : auto SEULEMENT si un défaut est authoré (sinon décision au joueur, pas de hang)
  return true; // jet/affichage générique (nuit/voyage) → cascadeResolveAll
}

/**
 * La modale ACTIVE va-t-elle être auto-résolue par le driver ? PURE (zéro effet) — lue par `ActiveModal`
 * pour NE PAS la rendre du tout (fini le flash de quelques ms en Rapide/Auto). On NE masque PAS : le BILAN
 * d'une cascade voyage/nuit (le joueur veut voir le résumé), ni un vrai choix laissé au joueur (surincantation
 * ou Destin en Rapide), ni la modale d'un combattant non piloté localement (coop).
 */
export function willAutoResolve(s: GameState): boolean {
  if (!cadenceAuto() || !ownerLocal(s)) return false;
  const pol = autoPolicyOf(s);
  if (!pol) return false;
  switch (pol.mode) {
    case 'hostOnly': return false;
    case 'self': return true;
    case 'choice': return cadenceAutoCombat() && (pickActiveModalKey(s) === 'fateSave' || !!pol.autoDrive);
    case 'partial': {
      const pc = s.pendingCascade;
      if (!pc) return false;
      if (pc.cursor >= pc.participants.length) return pc.purpose === 'combat'; // bilan : combat masqué ; voyage/nuit MONTRÉ
      return stepAutoResolved(s, pc.participants[pc.cursor]);
    }
  }
}

/**
 * TICK du pilote d'auto-cadence. Appelé depuis la chaîne de reprise GARDÉE (C3/C4) — JAMAIS un pilote
 * async parallèle. No-op hors Rapide/Auto, sur une modale non pilotée localement, ou `hostOnly`/`choice`
 * (le `choice` en Auto-combat est tranché par `runActorAI` / la politique Destin — C4).
 */
export function tickCombatAuto(get: Get, set: Set): void {
  if (!cadenceAuto()) return;
  const s = get();
  if (!ownerLocal(s)) return;
  const pol = autoPolicyOf(s);
  if (!pol) return;
  switch (pol.mode) {
    case 'hostOnly':
      return;
    case 'choice':
      // Auto-combat seul : le Sauvetage par Destin est dépensé automatiquement pour éviter la mort,
      // `negate` s'il est offert (`fateSaveOptions`), sinon `survive`. En Rapide, on NE touche PAS (la
      // modale reste — vrai choix du joueur).
      if (cadenceAutoCombat() && pickActiveModalKey(s) === 'fateSave' && s.pendingFateSave) {
        const negate = fateSaveOptions(s.pendingFateSave.source).includes('negate');
        scheduleCombatTimer(() => (negate ? get().fateNegate() : get().fateSurvive()), beatHold(get, 'autoResolve'));
      }
      return;
    case 'partial':
      autoResolveCascade(get, set);
      return;
    case 'self':
      driveSelf(get, set, pol.drive);
      return;
  }
}

/**
 * Branche le pilote sur le store (appelé UNE fois au démarrage — cf. `initAudioWiring`). À chaque
 * changement d'état, si la Cadence n'est pas « manuel », un tick est planifié (hors du cycle de `set`,
 * coalescé par `scheduled`). En mode manuel (défaut) : zéro overhead (la souscription sort aussitôt).
 */
let scheduled = false;
export function initCombatAuto(): void {
  useGame.subscribe(() => {
    if (!cadenceAuto() || scheduled) return;
    scheduled = true;
    scheduleCombatTimer(() => { scheduled = false; tickCombatAuto(useGame.getState, useGame.setState); }, 0);
  });
}

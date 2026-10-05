/**
 * Registre UNIQUE des raccourcis clavier de TOUTE l'application — jeu ET éditeur. Source de vérité du
 * hook `useGameKeyboard` (monté une seule fois, au niveau application) ET du remap de l'écran Options :
 * zéro handler éparpillé.
 *
 * 100 % `e.code` = POSITION physique de la touche, pas le caractère → AZERTY-safe d'office (la touche
 * au même ENDROIT que Q/E/C sur QWERTY est A/Z/E/C sur AZERTY).
 *
 * Ce qui reste HORS de ce registre PAR NATURE (ce ne sont pas des raccourcis d'application : la touche
 * appartient au CONTRÔLE ou à la COUCHE qui a le focus, et n'est donc pas remappable) :
 *  • le roving tabindex des listes/onglets/radiogroupes (`ui/rovingFocus.ts`) ;
 *  • le focus-trap des modales (`ui/Modal.tsx`) et la pile d'annulation des couches (`ui/useDismissLayer.ts`) ;
 *  • l'Entrée qui valide un champ de renommage (`ui/editor/Inspector.tsx`) ;
 *  • le geste secondaire de l'alvéole FOCALISÉE (`ui/CombatConsole.tsx`, `ContextMenu`/Shift+F10),
 *    jumelé au clic droit et à l'appui long ;
 *  • le geste secondaire du PORTRAIT focalisé — inspecter (`ui/PortraitTile.tsx`, `ContextMenu`/Shift+F10),
 *    jumelé au clic droit et à l'appui long ;
 *  • la CAPTURE de touche du panneau de remap lui-même (`ui/KeyBindingsPanel.tsx`).
 */
import type { GameState } from './store';
import { useGame, activeCombatant } from './store';
import { controlsActive } from './netOwnership';
import { reponsesDuNoeud, conversationRepond, COUCHE_CONVERSATION } from './dialogue';
import { modaleDuDessus } from './dismissStack';
import { modalHolds } from './modalArbiter';
import { modalBlocksMapHover } from './mapHover';
import { hotbar } from './hotbarBridge';
import { editeur } from './editeurBridge';
import { TOUCHES_IMPRIMEES } from './dispositionConsole';
import { runAction, currentInterludeAction, actionGate } from './actionRegistry';
import { validTargets, preemptShooterIds } from './targeting';
import type { ScreenDir } from './combatCursor';
import { combatantAtTile } from './combatGeometry';
import { SEUIL_MAINTIEN_MS, arreterLacet, demarrerLacet, pasYaw } from './stageYaw';
import { arreterMarche, demarrerMarche } from './stageWalk';
import { clearTrackedTimer, scheduleFlowTimer } from './combatTimers';
import { t, type MsgKey } from '../i18n';

/** Section d'affichage de l'écran Options (remap) — REGROUPE les raccourcis par contexte de jeu.
 *  Purement présentationnel (le `when` de chaque binding reste l'unique arbitre d'exécution). */
export type KeyBindingSection = 'pov' | 'camera' | 'combat' | 'curseur' | 'hotbar' | 'exploration' | 'dialogue' | 'systeme' | 'editeur';
const KEY_SECTION_KEY: Record<KeyBindingSection, MsgKey> = {
  pov: 'key.section.pov',
  camera: 'key.section.camera',
  combat: 'key.section.combat',
  curseur: 'key.section.curseur',
  hotbar: 'key.section.hotbar',
  exploration: 'key.section.exploration',
  dialogue: 'key.section.dialogue',
  systeme: 'key.section.systeme',
  editeur: 'key.section.editeur',
};

/** Libellé d'une section de l'écran Options, résolu À L'APPEL (la carte ci-dessus porte des clés). */
export const keySectionLabel = (s: KeyBindingSection): string => t(KEY_SECTION_KEY[s]);

/** Modificateur tenu pendant l'appui. Deux natures, distinguées par `modsMatch` :
 *  • `ctrl` et `alt` sont des modificateurs de COMMANDE — ils changent la touche (`ctrl` matche
 *    `ctrlKey` OU `metaKey`, Cmd sur Mac : une seule notion, déclarée ici et nulle part ailleurs) ;
 *  • `shift` est un modificateur de COUCHE — il change le CARACTÈRE produit, pas la position de la
 *    touche (sur un clavier AZERTY, la rangée de chiffres EST la couche Maj : « 1 » se frappe
 *    Maj+`Digit1`). */
export type KeyMod = 'ctrl' | 'alt' | 'shift';

/** Modificateurs EFFECTIFS d'un événement clavier, dans l'ordre canonique (`ctrl`, `alt`, `shift`). */
export function eventMods(e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): KeyMod[] {
  const out: KeyMod[] = [];
  if (e.ctrlKey || e.metaKey) out.push('ctrl');
  if (e.altKey) out.push('alt');
  if (e.shiftKey) out.push('shift');
  return out;
}

/** Modificateur qu'une touche porte ELLE-MÊME, par POSITION physique — le registre est 100 % `e.code`,
 *  donc les deux positions de chaque modificateur sont nommées ici, une fois. Une touche N+1 de cette
 *  nature (une `Meta`, un pédalier) coûte une ligne. */
const MOD_DE_LA_TOUCHE: Record<string, KeyMod> = {
  AltLeft: 'alt', AltRight: 'alt',
  ControlLeft: 'ctrl', ControlRight: 'ctrl',
  ShiftLeft: 'shift', ShiftRight: 'shift',
};

/** Le modificateur que CETTE touche porte elle-même (`AltLeft` → `alt`), ou `null` si c'en est une
 *  ordinaire. */
export function modsDeLaTouche(code: string): KeyMod | null {
  return MOD_DE_LA_TOUCHE[code] ?? null;
}

/** La touche tenue est-elle celle qu'un raccourci déclare ? Deux régimes, selon `KeyMod` :
 *  • binding AVEC `mods` : correspondance EXACTE (`Ctrl+KeyZ` n'est pas `Ctrl+Maj+KeyZ` — ce sont
 *    deux touches différentes, qui peuvent porter deux raccourcis) ;
 *  • binding SANS `mods` (touche NUE) : la POSITION physique suffit, quelle que soit la COUCHE — Maj
 *    est donc toléré (sur AZERTY, `Digit1` ne produit « 1 » qu'avec Maj tenu : sans cette tolérance,
 *    les cases 1-8 de la grille de capacités seraient injouables), tandis que `ctrl` et `alt` tenus
 *    la refusent (Alt+D ne déclenche pas le pas d'exploration de D). AltGr vaut `ctrl`+`alt` : une
 *    touche nue le refuse — AltGr COMPOSE un caractère, il ne frappe pas un raccourci. Sous Windows,
 *    AltGr émet DEUX événements (`ControlLeft`, puis `AltRight` avec `ctrl` tenu) : côté `AltRight`
 *    il reste `ctrl` dans les `restants`, donc refus ; côté `ControlLeft`, un binding NU sur ce code
 *    répondrait — Ctrl est son propre modificateur, c'est la même loi que pour Alt. Aucun raccourci
 *    du registre n'est sur `ControlLeft`, et `KeyBindingsPanel` refuse d'y remapper.
 *
 *  Le `code` de l'ÉVÉNEMENT entre dans le comparatif parce qu'une touche-modificateur EST son propre
 *  modificateur : l'appui d'`AltLeft` porte `altKey` vrai, et le relâchement d'une touche pendant
 *  qu'Alt est tenu porte `altKey` vrai aussi. Le modificateur de la touche frappée est donc retiré
 *  des `tenus` — un raccourci `AltLeft` nu répond à son propre appui, tandis que `KeyA` nu sous Alt
 *  reste refusé (même loi : `KeyA` ne porte aucun modificateur). */
export function modsMatch(declares: readonly KeyMod[], tenus: readonly KeyMod[], code: string): boolean {
  const propre = modsDeLaTouche(code);
  const restants = propre === null ? tenus : tenus.filter((m) => m !== propre);
  if (declares.length > 0) return declares.length === restants.length && declares.every((m) => restants.includes(m));
  return !restants.includes('ctrl') && !restants.includes('alt');
}

export interface KeyBinding {
  id: string;
  /** Touche(s) par DÉFAUT, par POSITION physique (event.code), jamais le caractère. */
  codes: string[];
  /** Modificateurs tenus EXIGÉS, et exhaustifs : absent = touche NUE, qui refuse Ctrl/Alt tenus mais
   *  tolère la couche Maj (voir `modsMatch`). */
  mods?: readonly KeyMod[];
  /** Ids avec lesquels le partage d'une MÊME TOUCHE (code ET modificateurs) est DÉLIBÉRÉ — leurs
   *  `when` s'excluent (POV ⇄ vue iso, éditeur ⇄ caméra de jeu,
   *  pause de Round ⇄ fin de tour ⇄ curseur, les portes d'Échap). Toute autre collision de
   *  touche dans le registre est un accident, et la garde `keybindings.test.ts` la refuse. La
   *  déclaration est SYMÉTRIQUE : chaque membre d'une paire nomme l'autre. */
  sharedBy?: string[];
  /** Clé de libellé pour l'écran Options (remap) — résolue à l'affichage (`bindingLabel`), jamais au
   *  chargement : ce tableau est construit à l'évaluation du module. */
  labelKey: MsgKey;
  /** Paramètres du patron de libellé (slot de barre d'action : son numéro). */
  labelParams?: Record<string, string | number>;
  /** Section de regroupement de l'écran Options (remap) — voir `keySectionLabel`. */
  section: KeyBindingSection;
  /** Contexte d'application (lit l'état du jeu). */
  when: (s: GameState) => boolean;
  /** Action : reçoit l'accès au store (`get`) pour appeler ses actions. */
  run: (get: () => GameState) => void;
  /** La touche appartient au CONTRÔLE focalisé (bouton/lien) quand c'est la touche de SON geste :
   *  son ACTIVATION (Espace/Entrée), ou sa navigation quand il est l'item d'un conteneur à roving
   *  tabindex (flèches d'une liste, d'un menu, d'onglets). Le partage est tranché par le hook
   *  (`ui/useGameKeyboard.ts`), une seule fois pour tout le registre. */
  notWhenControlFocused?: boolean;
  /** Le raccourci APPARTIENT à la couche de la CONVERSATION (`COUCHE_CONVERSATION`). Sous une modale
   *  de la pile, SEULS les raccourcis qu'elle déclare répondent — les autres se taisent, même si leur
   *  `when` est vrai (la grille de capacités en plein combat, la fin de tour, la caméra,
   *  l'exploration). La loi est tranchée par `bindingApplies` ci-dessous, porte COMMUNE au clavier et
   *  à la manette. */
  coucheDialogue?: boolean;
  /** RELÂCHEMENT de la touche. Un raccourci qui en porte un est un geste MAINTENU : il agit à
   *  l'enfoncement, dure tant que la touche est tenue, et se termine ici. La répétition automatique du
   *  clavier ne le rejoue pas (`useGameKeyboard`) — la durée est mesurée par le geste, pas par l'OS. */
  runUp?: (get: () => GameState) => void;
  /** Geste d'UNE PRESSION : la touche tenue ne le rejoue pas non plus, et il n'a rien à terminer au
   *  relâchement (pivot du regard en vue subjective). La répétition automatique de l'OS est un artefact
   *  de saisie de texte : aucune cadence de jeu ne s'en déduit. */
  unePression?: boolean;
}

const inBattle = (s: GameState) => s.mode === 'battle' && !!s.battle && !s.battle.over;
/** Aucune modale de combat ouverte (sinon Espace/Entrée doivent rester à la modale). Garde des
 *  gestes qui ENGAGENT ou QUITTENT le tour (fin de tour, barre d'action, menu système). */
const noModal = (s: GameState) => !modalHolds(s as Parameters<typeof modalHolds>[0]);
/** La CARTE accepte-t-elle un geste de ciblage ? MÊME verdict que la souris (`modalBlocksMapHover`,
 *  arbitre) : une modale PILOTÉE PAR LA CARTE (désignation de cibles d'un sort) laisse la scène
 *  vivante — la souris y cible, le curseur clavier/manette doit pouvoir en faire autant. */
const mapLive = (s: GameState) => !modalBlocksMapHover(s);
/** Minuterie qui transforme l'appui en MAINTIEN — une seule, le geste de rotation est unique. */
let minuterieMaintien: ReturnType<typeof setTimeout> | null = null;
/** APPUI de rotation caméra — SOURCE UNIQUE du geste de l'écran de jeu, au CLAVIER (Q/E) : la caméra
 *  du jeu se pilote au geste et au clavier, sans plaque de boutons (l'éditeur garde son cycle par
 *  cran, local à `ui/editor/EditorCanvas`).
 *  Le lacet est LIBRE (#1176) : la caméra accepte n'importe quel angle, et le geste a DEUX régimes,
 *  distingués par la seule durée de l'appui — un appui bref pousse d'un PAS FIN (`pasYaw`), et
 *  au-delà de `SEUIL_MAINTIEN_MS` la caméra part en rotation continue jusqu'au relâchement
 *  (`relacherCamera`). Le pas agit dès l'enfoncement : le geste bref ne se paie aucune attente.
 *  Le régime par CRAN du store (`rotateCam`) ne sert plus l'écran de jeu depuis la mort de la voie
 *  affine (#1176, P3-4 commit C5a) : il reste la rotation de l'ÉDITEUR et des bancs. */
export const tournerCamera = (_g: () => GameState, dir: 1 | -1): void => {
  pasYaw(dir);
  if (minuterieMaintien) clearTrackedTimer(minuterieMaintien);
  // Timer TRACÉ (`state/combatTimers.ts`) : un `setTimeout` nu sous `src/state` est inexprimable
  // (garde structurelle #415, `naked-timer-guard.test.ts`), et le registre annule les timers en vol
  // au teardown de test. Ce geste d'ENTRÉE n'est ni un beat de combat ni une cascade de flux : les
  // deux exports du registre sont le MÊME `track`, et le renommer relève d'un lot transverse.
  minuterieMaintien = scheduleFlowTimer(() => {
    minuterieMaintien = null;
    demarrerLacet(dir);
  }, SEUIL_MAINTIEN_MS);
};
/** RELÂCHEMENT du geste de rotation : désarme le maintien à venir, et arrête celui qui court. */
export const relacherCamera = (): void => {
  if (minuterieMaintien) {
    clearTrackedTimer(minuterieMaintien);
    minuterieMaintien = null;
  }
  arreterLacet();
};
/** Contexte de PILOTAGE du combat (fin de tour, barre d'action) : en combat, c'est bien ton tour
 *  (coop), aucune modale ouverte. */
const cur = (s: GameState) => inBattle(s) && controlsActive(s) && noModal(s);
/** Contexte du CURSEUR de combat (viser / valider SUR LA CARTE) : ton tour et carte vivante — le
 *  ciblage clavier survit donc à une modale pilotée par la carte, comme la souris. */
const curMap = (s: GameState) => inBattle(s) && controlsActive(s) && mapLive(s);
/** Contexte de VISÉE Tir rapide (pause de début de Round, LDB 11 l.97-103) : une visée est ARMÉE (`preemptAiming`),
 *  carte vivante — le curseur/Tab/Entrée pilotent le tir d'interruption HORS TOUR comme un ciblage normal. */
const preemptCur = (s: GameState) => inBattle(s) && !!s.preemptAiming && mapLive(s);
/** Curseur de combat actif : tour normal OU visée Tir rapide armée (le même curseur pilote les deux). */
const curOrPreempt = (s: GameState) => curMap(s) || preemptCur(s);
/** Un mode de `battle.action` est ARMÉ SANS SORTIE déclarée : le registre n'expose aucune action
 *  d'interlude pour le mode de ciblage courant (Dissiper, Soigner, Incanter, Munition, Poussée), là
 *  où bordée et téléportation ont la leur — que `interlude-exit` prend. Sans ce prédicat, Échap
 *  n'avait aucun barreau pour ces armés-là et retombait sur le menu système. */
const armeSansInterlude = (s: GameState) => inBattle(s) && !!s.battle!.action && !currentInterludeAction(() => s);
/** Contexte d'EXPLORATION (carte hors combat) : écran de jeu, mode exploration. La conversation et
 *  toute autre modale le taisent à la porte (`bindingApplies`). */
const exploring = (s: GameState) => s.screen === 'campaign' && s.mode === 'exploration';
/** Contexte d'exploration en vue SUBJECTIVE (POV) : les ZQSD deviennent cap-relatifs et A/E pivotent le
 *  regard → shadow des raccourcis caméra/pas-iso (mêmes touches) tant que le POV est actif. */
const exploringPov = (s: GameState) => exploring(s) && s.povActive;
/** L'entité que désigne la touche `inspecter` : en combat l'occupant de la case du CURSEUR
 *  clavier/manette, sinon le combattant survolé (portrait ou Tab, puis jeton) ; hors combat l'entité
 *  survolée (`hovered`). `null` = rien à inspecter, la touche se tait. */
export const cibleDInspection = (s: GameState): string | null => {
  if (inBattle(s)) {
    const t = s.combatCursor?.tile;
    const sousCurseur = t ? combatantAtTile(s.battle!.combatants, t.x, t.y, t.z ?? 0)?.id : undefined;
    return sousCurseur ?? s.hoverCombatantId ?? s.hovered;
  }
  return exploring(s) ? s.hovered : null;
};
/** Pas clavier d'exploration ISO (ZQSD) : code physique → direction ÉCRAN. Réservé à la vue iso (hors POV,
 *  où ces mêmes touches sont cap-relatives — cf. `exploringPov` ci-dessus, résolu AVANT par ordre de tableau). */
const EXPLORE_STEP: { code: string; dir: ScreenDir; labelKey: MsgKey; povId: string }[] = [
  { code: 'KeyW', dir: 'up', labelKey: 'key.exploreUp', povId: 'pov-forward' },
  { code: 'KeyS', dir: 'down', labelKey: 'key.exploreDown', povId: 'pov-back' },
  { code: 'KeyA', dir: 'left', labelKey: 'key.exploreLeft', povId: 'pov-strafe-l' },
  { code: 'KeyD', dir: 'right', labelKey: 'key.exploreRight', povId: 'pov-strafe-r' },
];
/** Pas clavier d'exploration en vue SUBJECTIVE (ZQSD cap-relatifs) : mêmes touches physiques, autre
 *  vocabulaire de direction — un seul mécanisme de marche tenue pour les deux vues (`stageWalk`). */
const POV_STEP: { id: string; code: string; rel: 'forward' | 'back' | 'left' | 'right'; labelKey: MsgKey; isoId: string }[] = [
  { id: 'pov-forward', code: 'KeyW', rel: 'forward', labelKey: 'key.povForward', isoId: 'explore-up' },
  { id: 'pov-back', code: 'KeyS', rel: 'back', labelKey: 'key.povBack', isoId: 'explore-down' },
  { id: 'pov-strafe-l', code: 'KeyA', rel: 'left', labelKey: 'key.povStrafeL', isoId: 'explore-left' },
  { id: 'pov-strafe-r', code: 'KeyD', rel: 'right', labelKey: 'key.povStrafeR', isoId: 'explore-right' },
];

/** Contexte de l'ÉDITEUR de scène — le hook est monté au niveau application, l'écran arbitre. */
const enEditeur = (s: GameState) => s.screen === 'editor';
/** Décalage de la sélection d'une case, au sens ÉCRAN (mêmes flèches que le curseur de combat). */
const EDITEUR_NUDGE: { dir: string; code: string; dx: number; dy: number; labelKey: MsgKey; curseurId: string }[] = [
  { dir: 'up', code: 'ArrowUp', dx: 0, dy: -1, labelKey: 'key.editeurNudgeUp', curseurId: 'cursor-up' },
  { dir: 'down', code: 'ArrowDown', dx: 0, dy: 1, labelKey: 'key.editeurNudgeDown', curseurId: 'cursor-down' },
  { dir: 'left', code: 'ArrowLeft', dx: -1, dy: 0, labelKey: 'key.editeurNudgeLeft', curseurId: 'cursor-left' },
  { dir: 'right', code: 'ArrowRight', dx: 1, dy: 0, labelKey: 'key.editeurNudgeRight', curseurId: 'cursor-right' },
];

export const KEYBINDINGS: KeyBinding[] = [
  // ── Vue SUBJECTIVE (POV) — AVANT les cam-*/pas-iso (mêmes codes physiques) : find = 1er `when` vrai, donc
  //    tant que `povActive`, ces raccourcis GAGNENT (ZQSD cap-relatif, A/E pivotent le regard) ; hors POV
  //    `exploringPov` est faux → cam-* et pas-iso reprennent la main. `toggle-pov` (F) commute la vue. ──
  ...POV_STEP.map(({ id, code, rel, labelKey, isoId }): KeyBinding => ({
    id, codes: [code], labelKey, section: 'pov', sharedBy: [isoId], when: exploringPov,
    run: (g) => demarrerMarche(g, { vue: 'pov', rel }), runUp: () => arreterMarche({ vue: 'pov', rel }),
  })),
  { id: 'pov-turn-l', codes: ['KeyQ'], labelKey: 'key.povTurnL', section: 'pov', sharedBy: ['cam-left', 'editeur-rot-l'], when: exploringPov, unePression: true, run: (g) => g().pivotParty(-1) },
  { id: 'pov-turn-r', codes: ['KeyE'], labelKey: 'key.povTurnR', section: 'pov', sharedBy: ['cam-right', 'editeur-rot-r'], when: exploringPov, unePression: true, run: (g) => g().pivotParty(1) },
  { id: 'toggle-pov', codes: ['KeyF'], labelKey: 'key.togglePov', section: 'pov', when: exploring, run: (g) => g().togglePov() },
  // `when` : l'ÉCRAN DE JEU. Le hook est monté au niveau application (tous les écrans) — la caméra du
  // jeu ne tourne donc pas depuis l'éditeur, qui a la sienne sur les mêmes touches physiques.
  { id: 'cam-left', codes: ['KeyQ'], labelKey: 'key.camLeft', section: 'camera', sharedBy: ['pov-turn-l', 'editeur-rot-l'], when: (s) => s.screen === 'campaign', run: (g) => tournerCamera(g, -1), runUp: () => relacherCamera() },
  { id: 'cam-right', codes: ['KeyE'], labelKey: 'key.camRight', section: 'camera', sharedBy: ['pov-turn-r', 'editeur-rot-r'], when: (s) => s.screen === 'campaign', run: (g) => tournerCamera(g, 1), runUp: () => relacherCamera() },
  // Recentrer : le panoramique manuel ET le zoom reviennent au repos d'un seul geste. Le zoom y est
  // joint parce que la molette avance par incréments continus (`useStageCamera`, `deltaY × 0.0015`) —
  // aucune suite de crans ne retombe exactement sur 1. Hors combat le focal est le leader du groupe
  // (`stageFocus`), en combat l'unité active : `resetCamPan` suffit dans les deux cas.
  { id: 'cam-recenter', codes: ['KeyC'], labelKey: 'key.camRecenter', section: 'camera', when: (s) => s.screen === 'campaign', run: (g) => { g().resetCamPan(); g().setZoom(1); } },
  // Vue ISO ⇄ TOP au clavier. Muette en POV : la vue subjective a sa propre bascule (`toggle-pov`).
  { id: 'toggle-view', codes: ['KeyV'], labelKey: 'key.toggleView', section: 'camera', when: (s) => s.screen === 'campaign' && !s.povActive, run: (g) => g().toggleViewMode() },
  // RÉVÉLER les utilisables (#1687) : geste MAINTENU sur les deux positions d'Alt — il dure ce que dure
  // l'appui, en exploration comme en combat (ce que le monde offre ne dépend pas du mode). L'état qu'il
  // pose est lu par les halos et les plaques de nom (`builders/interactHalos`, `stage/PlaquesDeNom`).
  {
    id: 'decor.reveler', codes: ['AltLeft', 'AltRight'], mods: [], labelKey: 'key.reveler', section: 'exploration',
    when: (s) => exploring(s) || inBattle(s),
    run: (g) => g().setReveler(true), runUp: (g) => g().setReveler(false),
  },
  // INSPECTER : la surface CLAVIER du geste secondaire d'une entité (clic droit, appui long, touche
  // Menu sur un portrait) — elle ouvre la fiche de ce que le joueur désigne, en combat comme hors
  // combat (`cibleDInspection`). La manette l'atteint par R3 (`ui/useGamepad`).
  {
    id: 'inspecter', codes: ['KeyI'], labelKey: 'key.inspecter', section: 'exploration',
    when: (s) => !!cibleDInspection(s),
    run: (g) => { const id = cibleDInspection(g()); if (id) g().setInspectId(id); },
  },
  // Commuter le SET d'armes au poing (LDB 13 l.106 — Action gratuite ; plafond maison 1×/tour porté
  // par `battleSwitchLoadout`) : la touche FAIT TOURNER les sets de la colonne de la console, dans
  // l'ordre où ils y sont dessinés. Gardée sur ≥ 2 sets — un porteur d'un seul set n'a rien à commuter.
  {
    id: 'switch-loadout', codes: ['KeyX'], labelKey: 'key.switchLoadout', section: 'combat',
    when: (s) => cur(s) && (activeCombatant(s.battle!)?.loadouts?.length ?? 0) >= 2,
    // La touche CHOISIT le set suivant (geste de clavier) ; l'EXÉCUTION passe par le registre
    // d'actions (`runAction('switch-loadout')`) — le clavier est un CONSOMMATEUR du registre, pas
    // un 5ᵉ espace d'ids qui appellerait le store en direct.
    run: (g) => {
      const s = g();
      const active = s.battle ? activeCombatant(s.battle) : undefined;
      const sets = active?.loadouts ?? [];
      if (!active || sets.length < 2) return;
      const i = sets.findIndex((l) => l.id === active.activeLoadoutId);
      runAction('switch-loadout', g, { loadoutId: sets[(i + 1) % sets.length].id });
    },
  },
  // Pause d'initiative de début de Round (LDB 17 l.25) : Espace/Entrée = « Commencer le round » (le SEUL
  // geste possible) → passage de Round jouable SANS souris. AVANT les bindings curseur/fin-de-tour (mêmes
  // touches) : sa garde `pendingRoundStart` arbitre. notWhenControlFocused : si le bouton « Commencer » est
  // focalisé, son activation native suffit (pas de double appel). La touche est un CONSOMMATEUR du
  // registre d'actions (`round-start`) : l'arbitrage solo/coop vit dans SON dispatcher, une seule fois.
  {
    id: 'round-start', codes: ['Space', 'Enter', 'NumpadEnter'], labelKey: 'key.roundStart', section: 'combat', notWhenControlFocused: true, sharedBy: ['end-turn', 'cursor-commit', 'editeur-pan'],
    when: (s) => inBattle(s) && !!s.pendingRoundStart && !s.preemptAiming, // visée Tir rapide armée → Entrée TIRE (curseur), pas « commencer »
    run: (g) => runAction('round-start', g),
  },
  // Tir rapide (talent, LDB 11 l.97-103) au CLAVIER : pendant la pause, `T` arme la visée d'interruption du 1ᵉʳ tireur
  // éligible (puis cycle les suivants, puis désarme) et pose le curseur sur la cible la plus proche → flèches/Tab
  // visent, Entrée TIRE, Échap annule. Réutilise le curseur de combat existant (aucun chemin parallèle).
  {
    id: 'preempt-arm', codes: ['KeyT'], labelKey: 'key.preemptArm', section: 'combat',
    when: (s) => inBattle(s) && !!s.pendingRoundStart && preemptShooterIds(() => s).length > 0,
    run: (g) => {
      const shooters = preemptShooterIds(g);
      const i = g().preemptAiming ? shooters.indexOf(g().preemptAiming!) : -1;
      const next = i + 1 < shooters.length ? shooters[i + 1] : null; // tireur suivant, puis désarme après le dernier
      g().armPreempt(next);
      if (next) g().snapCursorToTarget(1); else g().clearCursor(); // pose le curseur sur la cible la plus proche
    },
  },
  // ── Curseur de combat (flèches) — la MANETTE réutilise ces mêmes ids via runBindingById. Le curseur
  //    « suit les yeux » (direction écran). Le 1er appui le pose sur le combattant actif.
  //    `notWhenControlFocused` : un CONTRÔLE focalisé possède ses propres flèches (menu, infobulle de
  //    règle d'un bouton de pool, liste à roving tabindex). Sans cette garde, le curseur tactique
  //    court AVEC lui sur la même touche — le ↓ qui devait ouvrir la porte de la fiche déplaçait
  //    aussi la visée (recette B3a, capture 04). Même doctrine que `round-start`/`end-turn` pour
  //    Espace/Entrée, étendue aux flèches : la touche appartient au contrôle qui a le focus.
  { id: 'cursor-up', codes: ['ArrowUp'], labelKey: 'key.cursorUp', section: 'curseur', notWhenControlFocused: true, sharedBy: ['editeur-nudge-up'], when: curOrPreempt, run: (g) => g().moveCursor('up') },
  { id: 'cursor-down', codes: ['ArrowDown'], labelKey: 'key.cursorDown', section: 'curseur', notWhenControlFocused: true, sharedBy: ['editeur-nudge-down'], when: curOrPreempt, run: (g) => g().moveCursor('down') },
  { id: 'cursor-left', codes: ['ArrowLeft'], labelKey: 'key.cursorLeft', section: 'curseur', notWhenControlFocused: true, sharedBy: ['editeur-nudge-left'], when: curOrPreempt, run: (g) => g().moveCursor('left') },
  { id: 'cursor-right', codes: ['ArrowRight'], labelKey: 'key.cursorRight', section: 'curseur', notWhenControlFocused: true, sharedBy: ['editeur-nudge-right'], when: curOrPreempt, run: (g) => g().moveCursor('right') },
  // Tab : aimante le curseur sur la cible valide suivante (cycle proche→loin) ; gardé sur ≥1 cible
  // (sinon Tab garde sa nav normale). `²/~` = cible précédente.
  {
    id: 'target-next', codes: ['Tab'], labelKey: 'key.targetNext', section: 'curseur',
    when: (s) => curOrPreempt(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(1),
  },
  {
    id: 'target-prev', codes: ['Backquote'], labelKey: 'key.targetPrev', section: 'curseur',
    when: (s) => curOrPreempt(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(-1),
  },
  // Valider/annuler le curseur — AVANT end-turn/clear-preview : avec un curseur posé, Entrée commet
  // et Échap désélectionne ; sans curseur, Entrée finit le tour et Échap purge l'aperçu (1er match).
  // PAS `notWhenControlFocused` (#199) : un `combatCursor` n'existe QUE si une flèche a déjà été
  // pressée (bindings `cursor-*`, gardés par `curOrPreempt`) — on est donc DÉJÀ dans un flux clavier,
  // jamais dans le cas « Tab a posé le focus sur un bouton, Entrée doit l'activer » que la garde protège
  // ailleurs. Sans ce retrait, le focus RÉSIDUEL d'un bouton de barre d'action cliqué à la souris (ex.
  // « Pousser ») pour ENTRER dans le mode-CASE masquait `cursor-commit` : Entrée retombait sur
  // l'activation native du bouton encore focalisé (qui ferme le mode, aucune poussée commise).
  {
    id: 'cursor-commit', codes: ['Enter', 'NumpadEnter'], labelKey: 'key.cursorCommit', section: 'curseur', sharedBy: ['round-start', 'end-turn'],
    when: (s) => curOrPreempt(s) && !!s.combatCursor,
    run: (g) => g().commitCursor(),
  },
  // INTENTION armée depuis l'interface (spec HUD zone 4) : Échap la dissout AVANT tout autre usage de
  // la touche — c'est l'annulation la plus récente, celle que le joueur vient d'ouvrir.
  {
    id: 'intent-cancel', codes: ['Escape'], labelKey: 'key.intentCancel', section: 'combat', sharedBy: ['cursor-cancel', 'clear-preview', 'toggle-menu', 'interlude-exit', 'action-disarm', 'editeur-echap'],
    when: (s) => !!s.localIntent,
    run: (g) => g().battleArmIntent(null),
  },
  {
    id: 'cursor-cancel', codes: ['Escape'], labelKey: 'key.cursorCancel', section: 'curseur', sharedBy: ['clear-preview', 'toggle-menu', 'intent-cancel', 'interlude-exit', 'action-disarm', 'editeur-echap'],
    when: (s) => !!s.combatCursor || preemptCur(s), // armé sans cible en vue : Échap désarme quand même le Tir rapide
    run: (g) => { if (g().preemptAiming) g().armPreempt(null); g().clearCursor(); const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
  {
    id: 'end-turn', codes: ['Space', 'Enter', 'NumpadEnter'], labelKey: 'key.endTurn', section: 'combat', notWhenControlFocused: true, sharedBy: ['round-start', 'cursor-commit', 'editeur-pan'],
    // Fin du tour : action NOMMÉE du registre (`actions.json`), exécutée par `runAction` — la touche
    // ne connaît plus la méthode du store.
    when: (s) => cur(s), run: (g) => runAction('end-turn', g),
  },
  {
    id: 'clear-preview', codes: ['Escape'], labelKey: 'key.clearPreview', section: 'combat', sharedBy: ['cursor-cancel', 'toggle-menu', 'intent-cancel', 'interlude-exit', 'action-disarm', 'editeur-echap'],
    when: (s) => !!s.battle?.preview,
    run: (g) => { const s = g(); if (s.battle?.preview) useGame.setState({ battle: { ...s.battle, preview: null } }); },
  },
  // ANNULER LE DÉPLACEMENT du tour (`undo-move`) : la touche du geste adossé à la gouttière de
  // Mouvement de la console. Sa garde EST le gate du registre (`deplacement-annulable`) — la touche
  // ne recopie aucun prédicat, et elle se tait exactement quand le geste n'est pas rendu à l'écran.
  {
    id: 'undo-move', codes: ['Backspace'], labelKey: 'key.undoMove', section: 'combat', sharedBy: ['editeur-supprimer'],
    when: (s) => {
      if (!cur(s)) return false;
      const active = activeCombatant(s.battle!);
      return !!active && actionGate('undo-move', { active, battle: s.battle!, netMode: s.net.mode }).ok;
    },
    run: (g) => runAction('undo-move', g),
  },
  // ── RÉPONSES d'un DIALOGUE (1-9) : la touche du RANG choisit la réponse NUMÉROTÉE à l'écran.
  //    Le rang est celui de la liste VISIBLE (`reponsesDuNoeud`, source unique partagée avec la
  //    fenêtre) : une réponse masquée par son `when` ne consomme pas de numéro, et une réponse
  //    FERMÉE (siège qui ne décide pas, bourse trop courte) est inerte à la touche comme au clic —
  //    c'est le MÊME `enabled`. Déclarées AVANT `hotbar-N` (mêmes codes physiques) : un dialogue
  //    ouvert EN COMBAT donne les chiffres à la conversation, pas à la grille de capacités.
  //    `coucheDialogue` les rend audibles pendant la conversation, où tout le reste se tait.
  //    `conversationRepond` (siège + `surfaceTientLaMain`) est le prédicat du VERBE : la touche ne
  //    s'offre pas quand `chooseDialogue` refuserait — sous la fenêtre de jet, le marché ou l'écran
  //    plein qu'une réponse vient d'ouvrir.
  ...Array.from({ length: 9 }, (_, i): KeyBinding => ({
    id: `dialogue-choice-${i + 1}`, codes: [`Digit${i + 1}`], labelKey: 'key.dialogueChoice', labelParams: { n: i + 1 }, section: 'dialogue',
    ...(i < TOUCHES_IMPRIMEES ? { sharedBy: [`hotbar-${i + 1}`] } : {}),
    coucheDialogue: true,
    when: conversationRepond,
    run: (g) => {
      const r = reponsesDuNoeud(g()).find((x) => x.rang === i + 1);
      if (r?.enabled) g().chooseDialogue(r.index); // `index` = position dans la DONNÉE, jamais le rang
    },
  })),
  // Cases de la GRILLE de capacités : 1-8 = case au RANG n de la grille (adresse, pas rang d'action
  // — spec HUD zone 8, `docs/plans/2026-08-16-spec-hud-combat.md`), via le pont `hotbar` publié par la
  // `CombatConsole`. La touche d'un rang vide ou fermé ne déclenche rien, et ne glisse pas au voisin.
  // Inactif hors de son tour / pendant une modale.
  ...Array.from({ length: TOUCHES_IMPRIMEES }, (_, i): KeyBinding => ({
    id: `hotbar-${i + 1}`, codes: [`Digit${i + 1}`], labelKey: 'key.hotbarSlot', labelParams: { n: i + 1 }, section: 'hotbar',
    sharedBy: [`dialogue-choice-${i + 1}`],
    when: (s) => inBattle(s) && controlsActive(s) && noModal(s),
    run: () => { const sl = hotbar.capacites[i]; if (sl?.run && !sl.disabled) sl.run(); },
  })),
  // ── Pas clavier d'EXPLORATION ISO (ZQSD) : un pas du groupe vers la surface voisine CONNECTÉE dans le
  //    sens écran poussé (rampes/tabliers via exploreStepDest) → le multi-couche, injouable au clic
  //    (l'emprise d'un pont vise la couche du dessous), devient jouable. Garde `!povActive` : en POV, les
  //    mêmes ZQSD sont cap-relatifs (bindings pov-* ci-dessus, résolus AVANT). Les flèches restent au SEUL
  //    curseur de combat (garde `cur`) — plus de partage de codes avec l'exploration.
  ...EXPLORE_STEP.map(({ code, dir, labelKey, povId }): KeyBinding => ({
    id: `explore-${dir}`, codes: [code], labelKey, section: 'exploration', sharedBy: [povId], when: (s) => exploring(s) && !s.povActive,
    run: (g) => demarrerMarche(g, { vue: 'iso', dir }), runUp: () => arreterMarche({ vue: 'iso', dir }),
  })),
  // Menu système PLEIN ÉCRAN (pause) : Échap l'OUVRE quand rien d'autre ne réclame la touche. Placé
  // EN DERNIER → cursor-cancel/clear-preview (mêmes codes, gardes propres) gagnent d'abord en combat.
  // N'OUVRE que si aucune modale de combat n'est active (`noModal`) et que le menu est fermé — le menu
  // OUVERT (`gameMenuOpen`) rend la main à son propre focus-trap (Modal.a11y : Échap = Retour/Fermer,
  // qui stoppe la propagation avant ce hook). Les écrans/modales plein-champ (role=dialog) consomment
  // déjà Échap et coupent la propagation → ils ne rouvrent jamais ce menu par mégarde.
  // INTERLUDE de ciblage par la carte (Frappe Mortelle, 2ᵉ frappe, Surincantation, pose de zone,
  // bordée, téléportation) : Échap prend la SORTIE que le registre déclare pour le mode courant —
  // la même que le bandeau de la console, jamais un chemin parallèle. Seules les sorties `exitSafe`
  // y sont atteignables : une sortie qui COMMET (renoncer à un enchaînement, se poser sur sa case)
  // se clique, la touche d'annulation ne la déclenche pas.
  {
    id: 'interlude-exit', codes: ['Escape'], labelKey: 'key.interludeExit', section: 'combat',
    sharedBy: ['cursor-cancel', 'clear-preview', 'intent-cancel', 'toggle-menu', 'action-disarm', 'editeur-echap'],
    when: (s) => inBattle(s) && controlsActive(s) && !!currentInterludeAction(() => s)?.exitSafe,
    run: (g) => { const def = currentInterludeAction(g); if (def) runAction(def.id, g); },
  },
  // MODE ARMÉ SANS INTERLUDE (Dissiper, Soigner, Incanter, Munition, Poussée) : le seul désarmement
  // était le re-clic sur la case (`toggleOff`), et Échap ouvrait le menu système par-dessus le mode
  // resté armé. La touche prend ici le désarmement CANONIQUE du store (`battleSelectAction(null)`,
  // celui-là même qu'exécute `battery-cancel` par le registre) — jamais un `set` recopié.
  {
    id: 'action-disarm', codes: ['Escape'], labelKey: 'key.actionDisarm', section: 'combat',
    sharedBy: ['cursor-cancel', 'clear-preview', 'intent-cancel', 'interlude-exit', 'toggle-menu', 'editeur-echap'],
    when: (s) => cur(s) && armeSansInterlude(s),
    run: (g) => g().battleSelectAction(null),
  },
  {
    id: 'toggle-menu', codes: ['Escape'], labelKey: 'key.toggleMenu', section: 'systeme', sharedBy: ['cursor-cancel', 'clear-preview', 'intent-cancel', 'interlude-exit', 'action-disarm', 'editeur-echap'],
    // Un interlude de ciblage OCCUPE Échap, même quand sa sortie n'est pas atteignable à la touche
    // (`exitSafe: false`) : la touche ne doit pas ouvrir le menu par-dessus un ciblage en cours.
    // MAIS il ne l'occupe QU'AU SIÈGE QUI LE TIENT : `interlude-exit` exige `controlsActive`, donc
    // pendant le ciblage d'un AUTRE joueur, un siège qui n'a pas la main n'aurait ni sortie ni menu.
    // Garde COMPLÉMENTAIRE d'`action-disarm` : un mode armé sans interlude occupe la touche au siège
    // qui le tient, et la rend au menu chez les autres (même frontière que ci-dessus).
    when: (s) =>
      s.screen === 'campaign' && !s.gameMenuOpen && noModal(s) &&
      (!currentInterludeAction(() => s) || !controlsActive(s)) &&
      !(cur(s) && armeSansInterlude(s)),
    run: (g) => g().setGameMenu(true),
  },
  // ── ÉDITEUR de scène ───────────────────────────────────────────────────────────────────────────
  // Mêmes lois que le reste du registre : touches par POSITION physique (`e.code`, jamais le caractère) et
  // remappables à l'écran Options. Ctrl+Z est donc `Ctrl` + la touche à la POSITION du Z QWERTY (le W
  // d'un clavier AZERTY) — la doctrine du registre l'emporte sur l'habitude du raccourci système.
  // L'état de l'éditeur (sélection, presse-papier, pile d'annulation) est LOCAL à React : ces `run`
  // passent par le pont `editeurBridge`, et ne font rien tant que l'éditeur n'a pas publié.
  { id: 'editeur-rot-l', codes: ['KeyQ'], labelKey: 'key.editeurRotL', section: 'editeur', sharedBy: ['cam-left', 'pov-turn-l'], when: enEditeur, run: () => editeur.tourner?.(-1) },
  { id: 'editeur-rot-r', codes: ['KeyE'], labelKey: 'key.editeurRotR', section: 'editeur', sharedBy: ['cam-right', 'pov-turn-r'], when: enEditeur, run: () => editeur.tourner?.(1) },
  // Geste MAINTENU : le panoramique dure tant que la touche est tenue (`runUp` le termine, et le
  // relâchement de sécurité du hook le termine aussi quand la fenêtre perd le focus).
  {
    id: 'editeur-pan', codes: ['Space'], labelKey: 'key.editeurPan', section: 'editeur', notWhenControlFocused: true,
    sharedBy: ['round-start', 'end-turn'], when: enEditeur,
    run: () => editeur.pan?.(true), runUp: () => editeur.pan?.(false),
  },
  { id: 'editeur-annuler', codes: ['KeyZ'], mods: ['ctrl'], labelKey: 'key.editeurAnnuler', section: 'editeur', when: enEditeur, run: () => editeur.annuler?.() },
  { id: 'editeur-retablir', codes: ['KeyY'], mods: ['ctrl'], labelKey: 'key.editeurRetablir', section: 'editeur', when: enEditeur, run: () => editeur.retablir?.() },
  // Rétablir a DEUX touches, comme partout ailleurs : Ctrl+Y et Ctrl+Maj+Z. Deux ENTRÉES et non deux
  // `codes`, parce que les modificateurs font partie de la touche — et aucun `sharedBy` avec
  // `editeur-annuler` : Ctrl+Z et Ctrl+Maj+Z sont deux touches distinctes au sens (code, mods).
  { id: 'editeur-retablir-maj', codes: ['KeyZ'], mods: ['ctrl', 'shift'], labelKey: 'key.editeurRetablirMaj', section: 'editeur', when: enEditeur, run: () => editeur.retablir?.() },
  { id: 'editeur-copier', codes: ['KeyC'], mods: ['ctrl'], labelKey: 'key.editeurCopier', section: 'editeur', when: enEditeur, run: () => editeur.copier?.() },
  { id: 'editeur-coller', codes: ['KeyV'], mods: ['ctrl'], labelKey: 'key.editeurColler', section: 'editeur', when: enEditeur, run: () => editeur.coller?.() },
  { id: 'editeur-dupliquer', codes: ['KeyD'], mods: ['ctrl'], labelKey: 'key.editeurDupliquer', section: 'editeur', when: enEditeur, run: () => editeur.dupliquer?.() },
  { id: 'editeur-supprimer', codes: ['Delete', 'Backspace'], labelKey: 'key.editeurSupprimer', section: 'editeur', sharedBy: ['undo-move'], when: enEditeur, run: () => editeur.supprimer?.() },
  ...EDITEUR_NUDGE.map(({ dir, code, dx, dy, labelKey, curseurId }): KeyBinding => ({
    id: `editeur-nudge-${dir}`, codes: [code], labelKey, section: 'editeur', notWhenControlFocused: true,
    sharedBy: [curseurId], when: enEditeur, run: () => editeur.deplacer?.(dx, dy),
  })),
  // UNE seule entrée d'annulation pour l'éditeur : c'est le PONT qui arbitre, par la PRÉSENCE de sa
  // commande — le menu fichier ne publie `fermerMenuFichier` que tant qu'il est ouvert.
  {
    id: 'editeur-echap', codes: ['Escape'], labelKey: 'key.editeurEchap', section: 'editeur',
    sharedBy: ['cursor-cancel', 'clear-preview', 'intent-cancel', 'interlude-exit', 'action-disarm', 'toggle-menu'],
    when: enEditeur,
    run: () => { if (editeur.fermerMenuFichier) editeur.fermerMenuFichier(); else editeur.deselectionner?.(); },
  },
];

/** Code physique de la touche d'ANNULATION — le registre en est la source, `resoudreEchap` et la
 *  pile de couches s'y réfèrent (aucun autre module ne réécrit ce littéral). */
export const CODE_ECHAP = 'Escape';

/** Une touche remappée s'écrit `ctrl+alt+shift+Code` (modificateurs dans l'ordre canonique, code en
 *  dernier) — forme UNIQUE de `keyOverrides`, lisible par `effectiveCodes`/`effectiveMods`. */
export function formatCombo(code: string, mods: readonly KeyMod[]): string {
  const ordre: KeyMod[] = ['ctrl', 'alt', 'shift'];
  return [...ordre.filter((m) => mods.includes(m)), code].join('+');
}

/** Lecture d'une surcharge — un code nu (sans `+`) est une surcharge SANS modificateur. */
export function parseCombo(combo: string): { code: string; mods: KeyMod[] } {
  const parts = combo.split('+');
  return { code: parts[parts.length - 1], mods: parts.slice(0, -1) as KeyMod[] };
}

/** Touche(s) EFFECTIVE(s) d'un raccourci : la surcharge utilisateur remplace les codes par défaut. */
export function effectiveCodes(b: KeyBinding, overrides: Record<string, string>): string[] {
  return overrides[b.id] ? [parseCombo(overrides[b.id]).code] : b.codes;
}

/** Modificateurs EFFECTIFS d'un raccourci : la surcharge utilisateur remplace ceux déclarés. */
export function effectiveMods(b: KeyBinding, overrides: Record<string, string>): readonly KeyMod[] {
  return overrides[b.id] ? parseCombo(overrides[b.id]).mods : (b.mods ?? []);
}

/**
 * CE RACCOURCI RÉPOND-IL, dans cet état ? Porte UNIQUE des DEUX dispatchers (clavier
 * `ui/useGameKeyboard`, manette `ui/useGamepad` via `runBindingById`) — une loi énoncée au registre
 * qu'une seule des deux portes appliquerait ne serait pas une loi.
 *
 * Deux étages, dans cet ordre : la COUCHE (sous la modale du dessus sur l'écran de CE siège,
 * `modaleDuDessus`, seules répondent les touches qu'elle déclare — `coucheDialogue` pour la
 * conversation, aucune pour les autres —, même si leur `when` est vrai), puis le CONTEXTE (`when`).
 * `notWhenControlFocused` n'est PAS de cette classe et reste à la porte clavier : il ne dépend pas de
 * l'ÉTAT mais du FOCUS DOM, que la manette ne subit pas (elle déplace le focus elle-même et active
 * le contrôle focalisé par un clic, `padButton`).
 */
export function bindingApplies(b: KeyBinding, s: GameState): boolean {
  const dessus = modaleDuDessus();
  if (dessus && !(dessus.kind === COUCHE_CONVERSATION && b.coucheDialogue === true)) return false;
  return b.when(s);
}

/** ÉLECTION d'un raccourci pour une touche : le 1ᵉʳ du registre dont la touche (remappée) et les
 *  modificateurs tenus répondent, que le contrôle focalisé ne tait pas (`notWhenControlFocused`), et
 *  que la porte commune laisse passer (`bindingApplies`). Unique pour le clavier (`useGameKeyboard`)
 *  et l'annulation (`resoudreEchap`). */
export function elireBinding(
  code: string,
  s: GameState,
  { controlFocused = false, mods = [] }: { controlFocused?: boolean; mods?: readonly KeyMod[] } = {},
): KeyBinding | undefined {
  return KEYBINDINGS.find(
    (k) =>
      effectiveCodes(k, s.keyOverrides).includes(code) &&
      modsMatch(effectiveMods(k, s.keyOverrides), mods, code) &&
      (!k.notWhenControlFocused || !controlFocused) &&
      bindingApplies(k, s),
  );
}

/** Le raccourci d'`id` donné (ids uniques au registre, garde `keybindings.test.ts`). */
export const bindingParId = (id: string): KeyBinding | undefined => KEYBINDINGS.find((k) => k.id === id);

/** Exécute un raccourci par son `id` (s'il s'applique au contexte courant) — table d'intentions PARTAGÉE
 *  par le clavier ET la manette : un seul endroit porte les couches, la garde `when` et l'action `run`. */
export function runBindingById(id: string, get: () => GameState): void {
  const b = bindingParId(id);
  if (b && bindingApplies(b, get())) b.run(get);
}

/** RELÂCHE un raccourci par son `id` — pendant du précédent pour les gestes MAINTENUS (`runUp`), que
 *  la manette doit signaler comme le clavier : sans lui, un geste tenu armé par `runBindingById` n'a
 *  aucune fin. Sans garde `when` : un geste s'arrête même si le contexte a changé pendant qu'il durait. */
export function runBindingUpById(id: string, get: () => GameState): void {
  bindingParId(id)?.runUp?.(get);
}

/** Libellé d'un raccourci pour l'écran Options, résolu À L'APPEL depuis sa clé (+ ses paramètres). */
export const bindingLabel = (b: KeyBinding): string => t(b.labelKey, b.labelParams);

/** Touches dont le nom lisible EST un texte (traduisible) — les autres sont des SYMBOLES (`NAMED_SYMBOLS`). */
const NAMED_KEY_KEY: Record<string, MsgKey> = {
  Space: 'key.named.space', Enter: 'key.named.enter', NumpadEnter: 'key.named.numpadEnter', Escape: 'key.named.escape',
  Backspace: 'key.named.backspace', Delete: 'key.named.delete',
};
/** Glyphes de touche : aucun texte de langue (le nom `Tab` est celui gravé sur la touche). */
const NAMED_SYMBOLS: Record<string, string> = {
  Tab: 'Tab',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '²/~', Minus: '-', Equal: '=',
};

/** Libellé lisible d'un `event.code` pour l'UI de remap (KeyC→C, Digit1→1, Space→Espace…). NB : on
 *  affiche la lettre QWERTY de la position (le clavier AZERTY de l'utilisateur étiquette parfois
 *  autrement la MÊME position physique — c'est la position qui compte pour le binding).
 *  Les touches NOMMÉES sont résolues AVANT le préfixe `Numpad` : `NumpadEnter` rend « Entrée (pavé) »
 *  (son entrée nommée était inatteignable derrière le préfixe, qui en faisait « Pavé Enter »). */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const named = NAMED_KEY_KEY[code];
  if (named) return t(named);
  if (code.startsWith('Numpad')) return t('key.named.numpad', { n: code.slice(6) });
  return NAMED_SYMBOLS[code] ?? code;
}

/** Nom des modificateurs à l'écran — ceux GRAVÉS sur la touche (aucun texte de langue). */
const MOD_LABEL: Record<KeyMod, string> = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Maj' };

/** Libellé lisible d'une touche COMPLÈTE (modificateurs + code) pour l'UI de remap : « Ctrl + Z ». */
export function comboLabel(code: string, mods: readonly KeyMod[]): string {
  const ordre: KeyMod[] = ['ctrl', 'alt', 'shift'];
  return [...ordre.filter((m) => mods.includes(m)).map((m) => MOD_LABEL[m]), keyLabel(code)].join(' + ');
}

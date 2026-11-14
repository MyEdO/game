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
 *  • le roving tabindex des listes/onglets/radiogroupes (`ui/composites/rovingFocus.ts`) ;
 *  • le focus-trap des modales (`ui/Modal.tsx`) et la pile d'annulation des couches (`ui/useDismissLayer.ts`) ;
 *  • l'Entrée qui valide un champ de renommage (`ui/editor/Inspector.tsx`) ;
 *  • le geste secondaire de l'alvéole FOCALISÉE (`ui/console/CombatConsole.tsx`, `ContextMenu`/Shift+F10),
 *    jumelé au clic droit et à l'appui long ;
 *  • le geste secondaire du PORTRAIT focalisé — inspecter (`ui/PortraitTile.tsx`, `ContextMenu`/Shift+F10),
 *    jumelé au clic droit et à l'appui long ;
 *  • la CAPTURE de touche du panneau de remap lui-même (`ui/KeyBindingsPanel.tsx`).
 */
import type { GameState } from '../store';
import type { PasRelatif } from '../../noyau/actionsDuNoyau';
import { activeCombatant } from '../../noyau/combatFlow';
import { controlsActive } from '../../noyau/netOwnership';
import { reponsesDuNoeud, conversationRepond, COUCHE_CONVERSATION } from '../../noyau/dialogue';
import { modaleDuDessus } from '../dismissStack';
import { modalHolds } from '../../noyau/modalArbiter';
import { modalBlocksMapHover } from '../mapHover';
import { hotbar } from '../hotbarBridge';
import { editeur } from '../editeurBridge';
import { TOUCHES_IMPRIMEES } from '../dispositionConsole';
import { currentInterludeAction, actionGate } from '../../noyau/actionRegistry';
import { validTargets, preemptShooterIds } from '../../noyau/targeting';
import type { ScreenDir } from '../combatCursor';
import { combatantAtTile } from '../../noyau/monde/combatGeometry';
import { SEUIL_MAINTIEN_MS, arreterLacet, demarrerLacet, pasYaw } from '../stageYaw';
import { arreterMarche, demarrerMarche, type PasTenu } from '../stageWalk';
import { clearTrackedTimer, scheduleFlowTimer } from '../../web/minuteries';
import { t, type MsgKey } from '../../i18n';
import type { Segments, VerrouDesMots } from '../../noyau/fabriquesDuNoyau';
import { fouilleOuverte } from '../../noyau/interactionsDExploration';
import { jouerLOffreDeLEcran } from '../registreOffres';

/** Code physique de la touche d'ANNULATION — le registre en est la source, `resoudreEchap` et la
 *  pile de couches s'y réfèrent ; seule écriture du littéral sous `src/` (mur `murs/echap`). */
export const CODE_ECHAP = 'Escape';

/** Section d'affichage de l'écran Options (remap) — REGROUPE les raccourcis par contexte de jeu.
 *  Purement présentationnel (le `when` de chaque binding reste l'unique arbitre d'exécution). */
export type KeyBindingSection = 'subjectif' | 'camera' | 'combat' | 'curseur' | 'capacite' | 'exploration' | 'dialogue' | 'systeme' | 'editeur';
const KEY_SECTION_KEY: Record<KeyBindingSection, MsgKey> = {
  subjectif: 'raccourci.section.subjectif',
  camera: 'raccourci.section.camera',
  combat: 'raccourci.section.combat',
  curseur: 'raccourci.section.curseur',
  capacite: 'raccourci.section.capacite',
  exploration: 'raccourci.section.exploration',
  dialogue: 'raccourci.section.dialogue',
  systeme: 'raccourci.section.systeme',
  editeur: 'raccourci.section.editeur',
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

/** Le rang d'une touche de chiffre (`Digit1` à `Digit9`). */
const RANGS_DE_TOUCHE = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
type RangDeTouche = (typeof RANGS_DE_TOUCHE)[number];

/** L'id d'un raccourci du registre : la clé de sa surcharge persistée (`keyOverrides`) et de son appel par la manette
 *  (`runBindingById`). */
export type IdDeRaccourci =
  | 'subjectif-avant' | 'subjectif-arriere' | 'subjectif-gauche' | 'subjectif-droite' | 'subjectif-pivot-gauche'
  | 'subjectif-pivot-droite' | 'subjectif-basculer' | 'camera-gauche' | 'camera-droite' | 'camera-recentrer' | 'vue-basculer'
  | 'decor-reveler' | 'fouiller-piece' | 'inspecter' | 'panoplie-changer' | 'debut-de-round' | 'tir-rapide-armer'
  | `curseur-${ScreenDir}` | 'cible-suivante' | 'cible-precedente' | 'curseur-valider' | 'intention-annuler' | 'curseur-annuler'
  | 'fin-de-tour' | 'apercu-effacer' | 'annulation-deplacement' | `dialogue-reponse-${RangDeTouche}` | `capacite-${RangDeTouche}`
  | `exploration-${ScreenDir}` | 'interlude-sortie' | 'mode-desarmer' | 'menu-ouvrir' | 'editeur-pivot-gauche'
  | 'editeur-pivot-droite' | 'editeur-panoramique' | 'editeur-annuler' | 'editeur-retablir' | 'editeur-retablir-maj'
  | 'editeur-copier' | 'editeur-coller' | 'editeur-dupliquer' | 'editeur-supprimer' | `editeur-decaler-${ScreenDir}`
  | 'editeur-echap';

/** VERROU : un id de raccourci ne prend que des mots du lexique (#3924), ses rangs de chiffre à part. */
const verrouDesRaccourcis: VerrouDesMots<IdDeRaccourci> = true;
void verrouDesRaccourcis;
/** VERROU : une vue de marche ne prend que des mots du lexique (#3928). */
const verrouDesVues: VerrouDesMots<PasTenu['vue']> = true;
void verrouDesVues;
/** VERROU : une section et une clé de libellé de raccourci (`raccourci.*`) ne prennent que des mots du lexique (#3928). */
const verrouDesLibellesDeRaccourci: [VerrouDesMots<KeyBindingSection>, VerrouDesMots<Segments<Extract<MsgKey, `raccourci.${string}`>>>] = [true, true];
void verrouDesLibellesDeRaccourci;

export interface KeyBinding {
  id: IdDeRaccourci;
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
  sharedBy?: IdDeRaccourci[];
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
   *  (`ui/clavier/useGameKeyboard.ts`), une seule fois pour tout le registre. */
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
  // Timer TRACÉ (`web/minuteries.ts`, mur `murs/minuteries`, #415) : le registre annule les timers en
  // vol au teardown de test. Ce geste d'ENTRÉE n'est ni un beat de combat ni une cascade de flux : les
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
 *  où bordée et téléportation ont la leur — que `interlude-sortie` prend. Sans ce prédicat, Échap
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
const EXPLORE_STEP: { code: string; dir: ScreenDir; labelKey: MsgKey; povId: IdDeRaccourci }[] = [
  { code: 'KeyW', dir: 'haut', labelKey: 'raccourci.explorationHaut', povId: 'subjectif-avant' },
  { code: 'KeyS', dir: 'bas', labelKey: 'raccourci.explorationBas', povId: 'subjectif-arriere' },
  { code: 'KeyA', dir: 'gauche', labelKey: 'raccourci.explorationGauche', povId: 'subjectif-gauche' },
  { code: 'KeyD', dir: 'droite', labelKey: 'raccourci.explorationDroite', povId: 'subjectif-droite' },
];
/** Pas clavier d'exploration en vue SUBJECTIVE (ZQSD cap-relatifs) : mêmes touches physiques, autre
 *  vocabulaire de direction — un seul mécanisme de marche tenue pour les deux vues (`stageWalk`). */
const POV_STEP: { id: IdDeRaccourci; code: string; rel: PasRelatif; labelKey: MsgKey; isoId: IdDeRaccourci }[] = [
  { id: 'subjectif-avant', code: 'KeyW', rel: 'avant', labelKey: 'raccourci.subjectifAvant', isoId: 'exploration-haut' },
  { id: 'subjectif-arriere', code: 'KeyS', rel: 'arriere', labelKey: 'raccourci.subjectifArriere', isoId: 'exploration-bas' },
  { id: 'subjectif-gauche', code: 'KeyA', rel: 'gauche', labelKey: 'raccourci.subjectifGauche', isoId: 'exploration-gauche' },
  { id: 'subjectif-droite', code: 'KeyD', rel: 'droite', labelKey: 'raccourci.subjectifDroite', isoId: 'exploration-droite' },
];

/** Contexte de l'ÉDITEUR de scène — le hook est monté au niveau application, l'écran arbitre. */
const enEditeur = (s: GameState) => s.screen === 'editor';
/** Décalage de la sélection d'une case, au sens ÉCRAN (mêmes flèches que le curseur de combat). */
const EDITEUR_NUDGE: { dir: ScreenDir; code: string; dx: number; dy: number; labelKey: MsgKey; curseurId: IdDeRaccourci }[] = [
  { dir: 'haut', code: 'ArrowUp', dx: 0, dy: -1, labelKey: 'raccourci.editeurDecalerHaut', curseurId: 'curseur-haut' },
  { dir: 'bas', code: 'ArrowDown', dx: 0, dy: 1, labelKey: 'raccourci.editeurDecalerBas', curseurId: 'curseur-bas' },
  { dir: 'gauche', code: 'ArrowLeft', dx: -1, dy: 0, labelKey: 'raccourci.editeurDecalerGauche', curseurId: 'curseur-gauche' },
  { dir: 'droite', code: 'ArrowRight', dx: 1, dy: 0, labelKey: 'raccourci.editeurDecalerDroite', curseurId: 'curseur-droite' },
];

export const KEYBINDINGS: KeyBinding[] = [
  // ── Vue SUBJECTIVE (POV) — AVANT les cam-*/pas-iso (mêmes codes physiques) : find = 1er `when` vrai, donc
  //    tant que `povActive`, ces raccourcis GAGNENT (ZQSD cap-relatif, A/E pivotent le regard) ; hors POV
  //    `exploringPov` est faux → cam-* et pas-iso reprennent la main. `subjectif-basculer` (F) commute la vue. ──
  ...POV_STEP.map(({ id, code, rel, labelKey, isoId }): KeyBinding => ({
    id, codes: [code], labelKey, section: 'subjectif', sharedBy: [isoId], when: exploringPov,
    run: (g) => demarrerMarche(g, { vue: 'subjectif', rel }), runUp: () => arreterMarche({ vue: 'subjectif', rel }),
  })),
  { id: 'subjectif-pivot-gauche', codes: ['KeyQ'], labelKey: 'raccourci.subjectifPivotGauche', section: 'subjectif', sharedBy: ['camera-gauche', 'editeur-pivot-gauche'], when: exploringPov, unePression: true, run: (g) => g().pivoterLeGroupe(-1) },
  { id: 'subjectif-pivot-droite', codes: ['KeyE'], labelKey: 'raccourci.subjectifPivotDroite', section: 'subjectif', sharedBy: ['camera-droite', 'editeur-pivot-droite'], when: exploringPov, unePression: true, run: (g) => g().pivoterLeGroupe(1) },
  { id: 'subjectif-basculer', codes: ['KeyF'], labelKey: 'raccourci.subjectifBasculer', section: 'subjectif', when: exploring, run: (g) => g().togglePov() },
  // `when` : l'ÉCRAN DE JEU. Le hook est monté au niveau application (tous les écrans) — la caméra du
  // jeu ne tourne donc pas depuis l'éditeur, qui a la sienne sur les mêmes touches physiques.
  { id: 'camera-gauche', codes: ['KeyQ'], labelKey: 'raccourci.cameraGauche', section: 'camera', sharedBy: ['subjectif-pivot-gauche', 'editeur-pivot-gauche'], when: (s) => s.screen === 'campaign', run: (g) => tournerCamera(g, -1), runUp: () => relacherCamera() },
  { id: 'camera-droite', codes: ['KeyE'], labelKey: 'raccourci.cameraDroite', section: 'camera', sharedBy: ['subjectif-pivot-droite', 'editeur-pivot-droite'], when: (s) => s.screen === 'campaign', run: (g) => tournerCamera(g, 1), runUp: () => relacherCamera() },
  // Recentrer : le panoramique manuel ET le zoom reviennent au repos d'un seul geste. Le zoom y est
  // joint parce que la molette avance par incréments continus (`useStageCamera`, `deltaY × 0.0015`) —
  // aucune suite de crans ne retombe exactement sur 1. Hors combat le focal est le leader du groupe
  // (`stageFocus`), en combat l'unité active : `resetCamPan` suffit dans les deux cas.
  { id: 'camera-recentrer', codes: ['KeyC'], labelKey: 'raccourci.cameraRecentrer', section: 'camera', when: (s) => s.screen === 'campaign', run: (g) => { g().resetCamPan(); g().setZoom(1); } },
  // Vue ISO ⇄ TOP au clavier. Muette en POV : la vue subjective a sa propre bascule (`subjectif-basculer`).
  { id: 'vue-basculer', codes: ['KeyV'], labelKey: 'raccourci.vueBasculer', section: 'camera', when: (s) => s.screen === 'campaign' && !s.povActive, run: (g) => g().toggleViewMode() },
  // RÉVÉLER les utilisables (#1687) : geste MAINTENU sur les deux positions d'Alt — il dure ce que dure
  // l'appui, en exploration comme en combat (ce que le monde offre ne dépend pas du mode). L'état qu'il
  // pose est lu par les halos et les plaques de nom (`builders/interactHalos`, `stage/PlaquesDeNom`).
  {
    id: 'decor-reveler', codes: ['AltLeft', 'AltRight'], mods: [], labelKey: 'raccourci.decorReveler', section: 'exploration',
    when: (s) => exploring(s) || inBattle(s),
    run: (g) => g().setReveler(true), runUp: (g) => g().setReveler(false),
  },
  // FOUILLER LA PIÈCE : geste d'exploration du GROUPE, offert là où le verbe l'ouvre (`fouilleOuverte`).
  {
    id: 'fouiller-piece', codes: ['KeyR'], labelKey: 'fouille.geste', section: 'exploration',
    when: (s) => exploring(s) && !('refus' in fouilleOuverte(s)),
    run: (g) => g().fouillerLaPiece(),
  },
  // INSPECTER : la surface CLAVIER du geste secondaire d'une entité (clic droit, appui long, touche
  // Menu sur un portrait) — elle ouvre la fiche de ce que le joueur désigne, en combat comme hors
  // combat (`cibleDInspection`). La manette l'atteint par R3 (`ui/useGamepad`).
  {
    id: 'inspecter', codes: ['KeyI'], labelKey: 'raccourci.inspecter', section: 'exploration',
    when: (s) => !!cibleDInspection(s),
    run: (g) => { const id = cibleDInspection(g()); if (id) g().setInspectId(id); },
  },
  // Commuter le SET d'armes au poing (LDB 13 l.106) : la touche FAIT TOURNER les sets de la colonne de la
  // console, dans l'ordre où ils y sont dessinés. Sa garde EST le gate du registre (`set-commutable`).
  {
    id: 'panoplie-changer', codes: ['KeyX'], labelKey: 'raccourci.panoplieChanger', section: 'combat',
    when: (s) => {
      if (!cur(s)) return false;
      const active = activeCombatant(s.battle!);
      return !!active && actionGate('panoplie', { active, battle: s.battle!, scene: s.scene, netMode: s.net.mode, gameTime: s.gameTime }).ok;
    },
    // La touche CHOISIT le set suivant (geste de clavier) ; l'EXÉCUTION passe par le registre
    // d'actions (le geste de `panoplie`) — le clavier est un CONSOMMATEUR du registre, pas
    // un 5ᵉ espace d'ids qui appellerait le store en direct.
    run: (g) => {
      const s = g();
      const active = s.battle ? activeCombatant(s.battle) : undefined;
      const sets = active?.loadouts ?? [];
      if (!active || !sets.length) return;
      const i = sets.findIndex((l) => l.id === active.activeLoadoutId);
      jouerLOffreDeLEcran(s, 'panoplie', { loadoutId: sets[(i + 1) % sets.length].id });
    },
  },
  // Pause d'initiative de début de Round (LDB 17 l.25) : Espace/Entrée = « Commencer le round » (le SEUL
  // geste possible) → passage de Round jouable SANS souris. AVANT les bindings curseur/fin-de-tour (mêmes
  // touches) : sa garde `pendingRoundStart` arbitre. notWhenControlFocused : si le bouton « Commencer » est
  // focalisé, son activation native suffit (pas de double appel). La touche est un CONSOMMATEUR du
  // registre d'actions (`debut-de-round`) : l'arbitrage solo/coop vit dans SON dispatcher, une seule fois.
  {
    id: 'debut-de-round', codes: ['Space', 'Enter', 'NumpadEnter'], labelKey: 'verbe.debutDuRound.valider', section: 'combat', notWhenControlFocused: true, sharedBy: ['fin-de-tour', 'curseur-valider', 'editeur-panoramique'],
    when: (s) => inBattle(s) && !!s.pendingRoundStart && !s.preemptAiming, // visée Tir rapide armée → Entrée TIRE (curseur), pas « commencer »
    run: (g) => jouerLOffreDeLEcran(g(), 'debut-de-round'),
  },
  // Tir rapide (talent, LDB 11 l.97-103) au CLAVIER : pendant la pause, `T` arme la visée d'interruption du 1ᵉʳ tireur
  // éligible (puis cycle les suivants, puis désarme) et pose le curseur sur la cible la plus proche → flèches/Tab
  // visent, Entrée TIRE, Échap annule. Réutilise le curseur de combat existant (aucun chemin parallèle).
  {
    id: 'tir-rapide-armer', codes: ['KeyT'], labelKey: 'raccourci.tirRapideArmer', section: 'combat',
    when: (s) => inBattle(s) && !!s.pendingRoundStart && preemptShooterIds(() => s).length > 0,
    run: (g) => {
      const shooters = preemptShooterIds(g);
      const i = g().preemptAiming ? shooters.indexOf(g().preemptAiming!) : -1;
      const next = i + 1 < shooters.length ? shooters[i + 1] : null; // tireur suivant, puis désarme après le dernier
      g().fenetreChoisir('debutDuRound', 'viser', next);
      if (next) g().snapCursorToTarget(1); else g().clearCursor(); // pose le curseur sur la cible la plus proche
    },
  },
  // ── Curseur de combat (flèches) — la MANETTE réutilise ces mêmes ids via runBindingById. Le curseur
  //    « suit les yeux » (direction écran). Le 1er appui le pose sur le combattant actif.
  //    `notWhenControlFocused` : un CONTRÔLE focalisé possède ses propres flèches (menu, infobulle de
  //    règle d'un bouton de pool, liste à roving tabindex). Sans cette garde, le curseur tactique
  //    court AVEC lui sur la même touche — le ↓ qui devait ouvrir la porte de la fiche déplaçait
  //    aussi la visée (recette B3a, capture 04). Même doctrine que `debut-de-round`/`fin-de-tour` pour
  //    Espace/Entrée, étendue aux flèches : la touche appartient au contrôle qui a le focus.
  { id: 'curseur-haut', codes: ['ArrowUp'], labelKey: 'raccourci.curseurHaut', section: 'curseur', notWhenControlFocused: true, sharedBy: ['editeur-decaler-haut'], when: curOrPreempt, run: (g) => g().moveCursor('haut') },
  { id: 'curseur-bas', codes: ['ArrowDown'], labelKey: 'raccourci.curseurBas', section: 'curseur', notWhenControlFocused: true, sharedBy: ['editeur-decaler-bas'], when: curOrPreempt, run: (g) => g().moveCursor('bas') },
  { id: 'curseur-gauche', codes: ['ArrowLeft'], labelKey: 'raccourci.curseurGauche', section: 'curseur', notWhenControlFocused: true, sharedBy: ['editeur-decaler-gauche'], when: curOrPreempt, run: (g) => g().moveCursor('gauche') },
  { id: 'curseur-droite', codes: ['ArrowRight'], labelKey: 'raccourci.curseurDroite', section: 'curseur', notWhenControlFocused: true, sharedBy: ['editeur-decaler-droite'], when: curOrPreempt, run: (g) => g().moveCursor('droite') },
  // Tab : aimante le curseur sur la cible valide suivante (cycle proche→loin) ; gardé sur ≥1 cible
  // (sinon Tab garde sa nav normale). `²/~` = cible précédente.
  {
    id: 'cible-suivante', codes: ['Tab'], labelKey: 'raccourci.cibleSuivante', section: 'curseur',
    when: (s) => curOrPreempt(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(1),
  },
  {
    id: 'cible-precedente', codes: ['Backquote'], labelKey: 'raccourci.ciblePrecedente', section: 'curseur',
    when: (s) => curOrPreempt(s) && validTargets(() => s).length > 0,
    run: (g) => g().snapCursorToTarget(-1),
  },
  // Valider/annuler le curseur — AVANT end-turn/clear-preview : avec un curseur posé, Entrée commet
  // et Échap désélectionne ; sans curseur, Entrée finit le tour et Échap purge l'aperçu (1er match).
  // PAS `notWhenControlFocused` (#199) : un `combatCursor` n'existe QUE si une flèche a déjà été
  // pressée (bindings `curseur-*`, gardés par `curOrPreempt`) — on est donc DÉJÀ dans un flux clavier,
  // jamais dans le cas « Tab a posé le focus sur un bouton, Entrée doit l'activer » que la garde protège
  // ailleurs. Sans ce retrait, le focus RÉSIDUEL d'un bouton de barre d'action cliqué à la souris (ex.
  // « Pousser ») pour ENTRER dans le mode-CASE masquait `curseur-valider` : Entrée retombait sur
  // l'activation native du bouton encore focalisé (qui ferme le mode, aucune poussée commise).
  {
    id: 'curseur-valider', codes: ['Enter', 'NumpadEnter'], labelKey: 'raccourci.curseurValider', section: 'curseur', sharedBy: ['debut-de-round', 'fin-de-tour'],
    when: (s) => curOrPreempt(s) && !!s.combatCursor,
    run: (g) => g().commitCursor(),
  },
  // INTENTION armée depuis l'interface (spec HUD zone 4) : Échap la dissout AVANT tout autre usage de
  // la touche — c'est l'annulation la plus récente, celle que le joueur vient d'ouvrir.
  {
    id: 'intention-annuler', codes: [CODE_ECHAP], labelKey: 'raccourci.intentionAnnuler', section: 'combat', sharedBy: ['curseur-annuler', 'apercu-effacer', 'menu-ouvrir', 'interlude-sortie', 'mode-desarmer', 'editeur-echap'],
    when: (s) => !!s.localIntent,
    run: (g) => g().desarmerLeMode(),
  },
  {
    id: 'curseur-annuler', codes: [CODE_ECHAP], labelKey: 'raccourci.curseurAnnuler', section: 'curseur', sharedBy: ['apercu-effacer', 'menu-ouvrir', 'intention-annuler', 'interlude-sortie', 'mode-desarmer', 'editeur-echap'],
    when: (s) => !!s.combatCursor || preemptCur(s), // armé sans cible en vue : Échap désarme quand même le Tir rapide
    run: (g) => { if (g().preemptAiming) g().fenetreChoisir('debutDuRound', 'viser', null); g().clearCursor(); if (g().battle?.preview) g().effacerLApercu(); },
  },
  {
    id: 'fin-de-tour', codes: ['Space', 'Enter', 'NumpadEnter'], labelKey: 'raccourci.finDeTour', section: 'combat', notWhenControlFocused: true, sharedBy: ['debut-de-round', 'curseur-valider', 'editeur-panoramique'],
    // Fin du tour : action NOMMÉE du registre (`actions.json`), jouée par son geste — la touche
    // ne connaît plus la méthode du store.
    when: (s) => cur(s), run: (g) => jouerLOffreDeLEcran(g(), 'fin-de-tour'),
  },
  {
    id: 'apercu-effacer', codes: [CODE_ECHAP], labelKey: 'raccourci.apercuEffacer', section: 'combat', sharedBy: ['curseur-annuler', 'menu-ouvrir', 'intention-annuler', 'interlude-sortie', 'mode-desarmer', 'editeur-echap'],
    when: (s) => !!s.battle?.preview,
    run: (g) => g().effacerLApercu(),
  },
  // ANNULER LE DÉPLACEMENT du tour (`annulation-deplacement`) : la touche du geste adossé à la gouttière de
  // Mouvement de la console. Sa garde EST le gate du registre (`deplacement-annulable`) — la touche
  // ne recopie aucun prédicat, et elle se tait exactement quand le geste n'est pas rendu à l'écran.
  {
    id: 'annulation-deplacement', codes: ['Backspace'], labelKey: 'raccourci.annulationDeplacement', section: 'combat', sharedBy: ['editeur-supprimer'],
    when: (s) => {
      if (!cur(s)) return false;
      const active = activeCombatant(s.battle!);
      return !!active && actionGate('annulation-deplacement', { active, battle: s.battle!, scene: s.scene, netMode: s.net.mode, gameTime: s.gameTime }).ok;
    },
    run: (g) => jouerLOffreDeLEcran(g(), 'annulation-deplacement'),
  },
  // ── RÉPONSES d'un DIALOGUE (1-9) : la touche du RANG choisit la réponse NUMÉROTÉE à l'écran.
  //    Le rang est celui de la liste VISIBLE (`reponsesDuNoeud`, source unique partagée avec la
  //    fenêtre) : une réponse masquée par son `when` ne consomme pas de numéro, et une réponse
  //    FERMÉE (siège qui ne décide pas, bourse trop courte) est inerte à la touche comme au clic —
  //    c'est le MÊME `enabled`. Déclarées AVANT `capacite-N` (mêmes codes physiques) : un dialogue
  //    ouvert EN COMBAT donne les chiffres à la conversation, pas à la grille de capacités.
  //    `coucheDialogue` les rend audibles pendant la conversation, où tout le reste se tait.
  //    `conversationRepond` (siège + `surfaceTientLaMain`) est le prédicat que lit aussi le refus du choix
  //    `dialogue.reponse` (`OUVERTS_DU_CHOIX`) : la touche ne s'offre pas quand le choix refuserait — sous la
  //    fenêtre de jet, le marché ou l'écran plein qu'une réponse vient d'ouvrir.
  ...RANGS_DE_TOUCHE.map((n): KeyBinding => ({
    id: `dialogue-reponse-${n}`, codes: [`Digit${n}`], labelKey: 'raccourci.dialogueReponse', labelParams: { n }, section: 'dialogue',
    ...(n <= TOUCHES_IMPRIMEES ? { sharedBy: [`capacite-${n}`] } : {}),
    coucheDialogue: true,
    when: conversationRepond,
    run: (g) => {
      const r = reponsesDuNoeud(g()).find((x) => x.rang === n);
      if (r?.enabled) g().fenetreChoisir('dialogue', 'reponse', r.id); // l'`id` de la DONNÉE, jamais le rang
    },
  })),
  // Cases de la GRILLE de capacités : 1-8 = case au RANG n de la grille (adresse, pas rang d'action
  // — spec HUD zone 8, `docs/plans/2026-08-16-spec-hud-combat.md`), via le pont `hotbar` publié par la
  // `CombatConsole`. La touche d'un rang vide ou fermé ne déclenche rien, et ne glisse pas au voisin.
  // Inactif hors de son tour / pendant une modale.
  ...RANGS_DE_TOUCHE.slice(0, TOUCHES_IMPRIMEES).map((n): KeyBinding => ({
    id: `capacite-${n}`, codes: [`Digit${n}`], labelKey: 'raccourci.capacite', labelParams: { n }, section: 'capacite',
    sharedBy: [`dialogue-reponse-${n}`],
    when: (s) => inBattle(s) && controlsActive(s) && noModal(s),
    run: () => { const sl = hotbar.capacites[n - 1]; if (sl?.run && !sl.disabled) sl.run(); },
  })),
  // ── Pas clavier d'EXPLORATION ISO (ZQSD) : un pas du groupe vers la surface voisine CONNECTÉE dans le
  //    sens écran poussé (rampes/tabliers via exploreStepDest) → le multi-couche, injouable au clic
  //    (l'emprise d'un pont vise la couche du dessous), devient jouable. Garde `!povActive` : en POV, les
  //    mêmes ZQSD sont cap-relatifs (bindings pov-* ci-dessus, résolus AVANT). Les flèches restent au SEUL
  //    curseur de combat (garde `cur`) — plus de partage de codes avec l'exploration.
  ...EXPLORE_STEP.map(({ code, dir, labelKey, povId }): KeyBinding => ({
    id: `exploration-${dir}`, codes: [code], labelKey, section: 'exploration', sharedBy: [povId], when: (s) => exploring(s) && !s.povActive,
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
    id: 'interlude-sortie', codes: [CODE_ECHAP], labelKey: 'raccourci.interludeSortie', section: 'combat',
    sharedBy: ['curseur-annuler', 'apercu-effacer', 'intention-annuler', 'menu-ouvrir', 'mode-desarmer', 'editeur-echap'],
    when: (s) => inBattle(s) && controlsActive(s) && !!currentInterludeAction(() => s)?.exitSafe,
    run: (g) => { const def = currentInterludeAction(g); if (def) jouerLOffreDeLEcran(g(), def.id); },
  },
  // MODE ARMÉ SANS INTERLUDE (Dissiper, Soigner, Incanter, Munition, Poussée) : la touche prend le
  // désarmement CANONIQUE du noyau (`desarmerLeMode`, celui du re-clic sur la case et de
  // `annulation-bordee`), sans quoi Échap ouvrirait le menu système par-dessus le mode resté armé.
  {
    id: 'mode-desarmer', codes: [CODE_ECHAP], labelKey: 'raccourci.modeDesarmer', section: 'combat',
    sharedBy: ['curseur-annuler', 'apercu-effacer', 'intention-annuler', 'interlude-sortie', 'menu-ouvrir', 'editeur-echap'],
    when: (s) => cur(s) && armeSansInterlude(s),
    run: (g) => g().desarmerLeMode(),
  },
  {
    id: 'menu-ouvrir', codes: [CODE_ECHAP], labelKey: 'raccourci.menuOuvrir', section: 'systeme', sharedBy: ['curseur-annuler', 'apercu-effacer', 'intention-annuler', 'interlude-sortie', 'mode-desarmer', 'editeur-echap'],
    // Un interlude de ciblage OCCUPE Échap, même quand sa sortie n'est pas atteignable à la touche
    // (`exitSafe: false`) : la touche ne doit pas ouvrir le menu par-dessus un ciblage en cours.
    // MAIS il ne l'occupe QU'AU SIÈGE QUI LE TIENT : `interlude-sortie` exige `controlsActive`, donc
    // pendant le ciblage d'un AUTRE joueur, un siège qui n'a pas la main n'aurait ni sortie ni menu.
    // Garde COMPLÉMENTAIRE d'`mode-desarmer` : un mode armé sans interlude occupe la touche au siège
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
  { id: 'editeur-pivot-gauche', codes: ['KeyQ'], labelKey: 'raccourci.editeurPivotGauche', section: 'editeur', sharedBy: ['camera-gauche', 'subjectif-pivot-gauche'], when: enEditeur, run: () => editeur.tourner?.(-1) },
  { id: 'editeur-pivot-droite', codes: ['KeyE'], labelKey: 'raccourci.editeurPivotDroite', section: 'editeur', sharedBy: ['camera-droite', 'subjectif-pivot-droite'], when: enEditeur, run: () => editeur.tourner?.(1) },
  // Geste MAINTENU : le panoramique dure tant que la touche est tenue (`runUp` le termine, et le
  // relâchement de sécurité du hook le termine aussi quand la fenêtre perd le focus).
  {
    id: 'editeur-panoramique', codes: ['Space'], labelKey: 'raccourci.editeurPanoramique', section: 'editeur', notWhenControlFocused: true,
    sharedBy: ['debut-de-round', 'fin-de-tour'], when: enEditeur,
    run: () => editeur.pan?.(true), runUp: () => editeur.pan?.(false),
  },
  { id: 'editeur-annuler', codes: ['KeyZ'], mods: ['ctrl'], labelKey: 'raccourci.editeurAnnuler', section: 'editeur', when: enEditeur, run: () => editeur.annuler?.() },
  { id: 'editeur-retablir', codes: ['KeyY'], mods: ['ctrl'], labelKey: 'raccourci.editeurRetablir', section: 'editeur', when: enEditeur, run: () => editeur.retablir?.() },
  // Rétablir a DEUX touches, comme partout ailleurs : Ctrl+Y et Ctrl+Maj+Z. Deux ENTRÉES et non deux
  // `codes`, parce que les modificateurs font partie de la touche — et aucun `sharedBy` avec
  // `editeur-annuler` : Ctrl+Z et Ctrl+Maj+Z sont deux touches distinctes au sens (code, mods).
  { id: 'editeur-retablir-maj', codes: ['KeyZ'], mods: ['ctrl', 'shift'], labelKey: 'raccourci.editeurRetablirMaj', section: 'editeur', when: enEditeur, run: () => editeur.retablir?.() },
  { id: 'editeur-copier', codes: ['KeyC'], mods: ['ctrl'], labelKey: 'raccourci.editeurCopier', section: 'editeur', when: enEditeur, run: () => editeur.copier?.() },
  { id: 'editeur-coller', codes: ['KeyV'], mods: ['ctrl'], labelKey: 'raccourci.editeurColler', section: 'editeur', when: enEditeur, run: () => editeur.coller?.() },
  { id: 'editeur-dupliquer', codes: ['KeyD'], mods: ['ctrl'], labelKey: 'raccourci.editeurDupliquer', section: 'editeur', when: enEditeur, run: () => editeur.dupliquer?.() },
  { id: 'editeur-supprimer', codes: ['Delete', 'Backspace'], labelKey: 'raccourci.editeurSupprimer', section: 'editeur', sharedBy: ['annulation-deplacement'], when: enEditeur, run: () => editeur.supprimer?.() },
  ...EDITEUR_NUDGE.map(({ dir, code, dx, dy, labelKey, curseurId }): KeyBinding => ({
    id: `editeur-decaler-${dir}`, codes: [code], labelKey, section: 'editeur', notWhenControlFocused: true,
    sharedBy: [curseurId], when: enEditeur, run: () => editeur.deplacer?.(dx, dy),
  })),
  // UNE seule entrée d'annulation pour l'éditeur : c'est le PONT qui arbitre, par la PRÉSENCE de sa
  // commande — le menu fichier ne publie `fermerMenuFichier` que tant qu'il est ouvert.
  {
    id: 'editeur-echap', codes: [CODE_ECHAP], labelKey: 'raccourci.editeurEchap', section: 'editeur',
    sharedBy: ['curseur-annuler', 'apercu-effacer', 'intention-annuler', 'interlude-sortie', 'mode-desarmer', 'menu-ouvrir'],
    when: enEditeur,
    run: () => { if (editeur.fermerMenuFichier) editeur.fermerMenuFichier(); else editeur.deselectionner?.(); },
  },
];

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

/** La surcharge du raccourci `b`, lue sous SON id : seule une combinaison canonique (`formatCombo` de
 *  sa propre lecture, code non vide) compte ; toute autre valeur est ignorée, la touche déclarée
 *  s'applique. Une surcharge d'un id absent du registre n'est jamais lue. */
export function surchargeDe(b: KeyBinding, overrides: Readonly<Record<string, string>>): string | undefined {
  const combo = overrides[b.id];
  if (combo === undefined) return undefined;
  const { code, mods } = parseCombo(combo);
  return code !== '' && formatCombo(code, mods) === combo ? combo : undefined;
}

/** Touche(s) EFFECTIVE(s) d'un raccourci : la surcharge utilisateur remplace les codes par défaut. */
export function effectiveCodes(b: KeyBinding, overrides: Record<string, string>): string[] {
  const combo = surchargeDe(b, overrides);
  return combo ? [parseCombo(combo).code] : b.codes;
}

/** Modificateurs EFFECTIFS d'un raccourci : la surcharge utilisateur remplace ceux déclarés. */
export function effectiveMods(b: KeyBinding, overrides: Record<string, string>): readonly KeyMod[] {
  const combo = surchargeDe(b, overrides);
  return combo ? parseCombo(combo).mods : (b.mods ?? []);
}

/**
 * CE RACCOURCI RÉPOND-IL, dans cet état ? Porte UNIQUE des DEUX dispatchers (clavier
 * `ui/clavier/useGameKeyboard`, manette `ui/useGamepad` via `runBindingById`) — une loi énoncée au registre
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
export const bindingParId = (id: IdDeRaccourci): KeyBinding | undefined => KEYBINDINGS.find((k) => k.id === id);

/** Exécute un raccourci par son `id` (s'il s'applique au contexte courant) — table d'intentions PARTAGÉE
 *  par le clavier ET la manette : un seul endroit porte les couches, la garde `when` et l'action `run`. */
export function runBindingById(id: IdDeRaccourci, get: () => GameState): void {
  const b = bindingParId(id);
  if (b && bindingApplies(b, get())) b.run(get);
}

/** RELÂCHE un raccourci par son `id` — pendant du précédent pour les gestes MAINTENUS (`runUp`), que
 *  la manette doit signaler comme le clavier : sans lui, un geste tenu armé par `runBindingById` n'a
 *  aucune fin. Sans garde `when` : un geste s'arrête même si le contexte a changé pendant qu'il durait. */
export function runBindingUpById(id: IdDeRaccourci, get: () => GameState): void {
  bindingParId(id)?.runUp?.(get);
}

/** Libellé d'un raccourci pour l'écran Options, résolu À L'APPEL depuis sa clé (+ ses paramètres). */
export const bindingLabel = (b: KeyBinding): string => t(b.labelKey, b.labelParams);

/** Touches dont le nom lisible EST un texte (traduisible) — les autres sont des SYMBOLES (`NAMED_SYMBOLS`). */
const NAMED_KEY_KEY: Record<string, MsgKey> = {
  Space: 'raccourci.touche.espace', Enter: 'raccourci.touche.entree', NumpadEnter: 'raccourci.touche.entreePave', Escape: 'raccourci.touche.echap',
  Backspace: 'raccourci.touche.retourArriere', Delete: 'raccourci.touche.supprimer',
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
  if (code.startsWith('Numpad')) return t('raccourci.touche.pave', { n: code.slice(6) });
  return NAMED_SYMBOLS[code] ?? code;
}

/** Nom des modificateurs à l'écran — ceux GRAVÉS sur la touche (aucun texte de langue). */
const MOD_LABEL: Record<KeyMod, string> = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Maj' };

/** Libellé lisible d'une touche COMPLÈTE (modificateurs + code) pour l'UI de remap : « Ctrl + Z ». */
export function comboLabel(code: string, mods: readonly KeyMod[]): string {
  const ordre: KeyMod[] = ['ctrl', 'alt', 'shift'];
  return [...ordre.filter((m) => mods.includes(m)).map((m) => MOD_LABEL[m]), keyLabel(code)].join(' + ');
}

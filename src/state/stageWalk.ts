/**
 * MARCHE TENUE du groupe en exploration — la loi « tenir la touche enchaîne les pas », hors du store
 * (aucune donnée de partie : un geste d'entrée en cours n'a rien à faire dans une sauvegarde). Même
 * patron que `state/stageYaw.ts` : le clavier/la manette ARMENT et DÉSARMENT, le module cadence.
 *
 * DEUX états, et pas d'intégrateur :
 *  - `tenues`      : la PILE des directions enfoncées, par ordre de pression. Le sommet marche : presser
 *                    une direction de plus la prend au pas SUIVANT, la relâcher revient à la plus récente
 *                    encore tenue, relâcher la dernière arrête.
 *  - `glissement`  : le pas COMMIS est en vol. Tant qu'il l'est, aucun autre pas ne se commet — la
 *                    cadence est la DURÉE DU GLISSEMENT (`walkMs`, la même que le rendu joue via
 *                    `EVT.ANIM_MOVE`), jamais la répétition automatique du clavier ni une vitesse
 *                    inventée. Aucune file : à l'arrivée, on regarde ce qui est tenu MAINTENANT.
 *
 * Chaque case traversée est une ARRIVÉE : le pas passe par `stepPartyDir`/`stepPartyRelative` du store
 * (donc `moveParty` — facing, déclencheurs, déplacement-puis-fouille). Une porte qui s'ouvre pendant la
 * marche (dialogue, combat, écran, modale, fenêtre hors-modale) la termine sur la case atteinte.
 */
import type { GameState } from './store';
import type { ScreenDir } from './combatCursor';
import { surfaceTientLaMain, type ArbiterState } from './modalArbiter';
import { modalLayerOpen } from './dismissStack';
import { walkMs } from '../geometry/walk';
import { clearTrackedTimer, scheduleFlowTimer } from './combatTimers';

/** Pas TENU, dans le vocabulaire de la vue qui l'a armé : sens ÉCRAN en vue iso, cadran CAP-RELATIF en
 *  vue subjective. Les deux vues empruntent le même mécanisme, jamais deux. */
export type PasTenu =
  | { vue: 'iso'; dir: ScreenDir }
  | { vue: 'pov'; rel: 'forward' | 'back' | 'left' | 'right' };

/** Identité d'un pas tenu : deux armements du MÊME pas ne se relâchent pas l'un l'autre. */
const cle = (p: PasTenu): string => (p.vue === 'iso' ? `iso:${p.dir}` : `pov:${p.rel}`);

/**
 * La carte accepte-t-elle un pas MAINTENANT ? Deux sources, aucune liste : les surfaces PARTAGÉES
 * (`surfaceTientLaMain`, l'arbitre) et l'écran de CE siège (une couche MODALE de la pile
 * `dismissStack` — fiche, menu système, codex, écran plein-champ ; un popover ne l'arrête pas). S'y ajoute ce que la MARCHE
 * exige : le mode exploration et aucune conversation (une surface pour la marche, jamais pour
 * elle-même).
 * `pas` fourni : la vue qui a armé doit être encore celle qui joue (bascule POV en plein maintien).
 */
export function marcheAutorisee(s: GameState, pas?: PasTenu): boolean {
  if (s.mode !== 'exploration' || s.dialogue) return false;
  if (surfaceTientLaMain(s as ArbiterState) || modalLayerOpen()) return false;
  if (!pas) return true;
  return pas.vue === 'pov' ? !!s.povActive : !s.povActive;
}

/** PILE des directions TENUES, par ordre de pression : le SOMMET marche. Presser une direction de plus
 *  la met au sommet ; la relâcher revient à la plus récente encore enfoncée ; relâcher la dernière
 *  arrête. Un ensemble, jamais une direction unique — tenir W, presser puis lâcher D repart vers W. */
let tenues: PasTenu[] = [];
/** Directions COUPÉES par une porte alors qu'elles étaient tenues : elles ne remarchent qu'après un
 *  NOUVEAU front (relâchement puis pression). Le clavier l'obtient gratuitement — un `keydown` ne
 *  revient pas tout seul ; la manette, qui répète sa direction tant que le stick est poussé, repartirait
 *  sinon toute seule dès la fermeture de la fenêtre. Même loi pour les deux entrées. */
let coupees = new Set<string>();
let glissement: ReturnType<typeof setTimeout> | null = null;

/** Un pas est-il EN VOL (glissement en cours) ? */
export const marcheEnVol = (): boolean => glissement !== null;

/** COMMET un pas et arme la fin de son glissement — le seul endroit qui touche le store. */
function commettre(get: () => GameState): void {
  const pas = tenues[tenues.length - 1];
  if (!pas) return;
  const s = get();
  if (!marcheAutorisee(s, pas)) {
    for (const p of tenues) coupees.add(cle(p));
    tenues = [];
    return;
  }
  const depart = s.partyPos;
  if (pas.vue === 'iso') s.stepPartyDir(pas.dir);
  else s.stepPartyRelative(pas.rel);
  const arrivee = get().partyPos;
  // Timer TRACÉ (`state/combatTimers.ts`) : un `setTimeout` nu sous `src/state` est inexprimable
  // (garde structurelle #415). La durée vient de `walkMs`, la fonction même dont le rendu déduit la fin
  // du glissement (`fx/useWalkAnim`) : un pas d'une case vaut donc STEP_MS, mur compris — un pas refusé
  // se retente au rythme des autres au lieu de marteler.
  glissement = scheduleFlowTimer(() => {
    glissement = null;
    commettre(get);
  }, walkMs([depart, arrivee]));
}

/** ARME la direction (enfoncement). Le premier pas part TOUT DE SUITE ; si un pas est en vol, seul
 *  l'armement change — le suivant partira à l'arrivée, dans cette direction-ci. */
export function demarrerMarche(get: () => GameState, pas: PasTenu): void {
  if (coupees.has(cle(pas))) return;
  tenues = [...tenues.filter((p) => cle(p) !== cle(pas)), pas];
  if (glissement) return;
  commettre(get);
}

/** DÉSARME (relâchement) : le pas EN VOL va jusqu'à sa case, et rien ne s'enchaîne après lui. Ne
 *  désarme que le pas relâché — lâcher une direction n'annule pas celle qu'on tient encore. */
export function arreterMarche(pas: PasTenu): void {
  tenues = tenues.filter((p) => cle(p) !== cle(pas));
  coupees.delete(cle(pas)); // le relâchement EST le front qui rouvre cette direction
  // Le glissement en vol n'est PAS annulé : c'est lui qui porte la cadence. L'annuler ferait partir
  // hors rythme un pas re-pressé dans la foulée (deux cases en moins d'un glissement).
}

/** Coupe TOUT (armement et pas en vol) : remise à zéro des mesures. */
export function resetStageWalk(): void {
  tenues = [];
  coupees = new Set();
  if (glissement) clearTrackedTimer(glissement);
  glissement = null;
}

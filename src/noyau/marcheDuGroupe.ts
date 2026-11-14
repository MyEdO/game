/** Marche du groupe en exploration : pas, pivot, pas relatif au regard, saut et porte. */
import { groupePosable, toggleDoorIn, type Scene } from './monde/scene';
import { releaseSeat, RANG_MENEUR, memeCase } from './monde/seating';
import { poserCapDuGroupe, meneurDuMonde, capDuGroupe } from './monde/combatants';
import { facingToward, rotateDir8 } from '../geometry/dir8';
import { bus, EVT } from './bus';
import { checkTriggers, jouerFlowEntier, runFlow } from './combatEffects';
import { exploreStepDest, mouvementDuGroupe, optionsDeCheminDuGroupe, povStepDest } from './monde/exploreNav';
import { atterrissagesDeSaut, walkNeighbors, type Pt } from './monde/path';
import { planJump } from './monde/jumpMove';
import { chebyshev } from '../engine/grid';
import { refuserGeste } from './refusVisible';
import { t } from '../i18n';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { FabriqueDuNoyau, JeuDuNoyau } from './machinerieDuNoyau';
import { portalsForParty, type RoomPortal } from './monde/roomPortals';
import { activeCombatant } from './combatFlow';
import type { IdDePorte } from './designations';

/** Le pas du groupe vers `pt` est-il une MARCHE : une case voisine à pied de la sienne (`walkNeighbors`, la
 *  connectivité du pathfinder) ? La garde du verbe `deplacerLeGroupe`, que l'écran lit avant d'animer un pas. */
export const pasDuGroupe = (s: Pick<Jeu, 'scene' | 'partyPos'>, pt: Pt): boolean =>
  !!s.scene && walkNeighbors(s.scene, s.partyPos).some((n) => memeCase(n, pt));

/** POSE le groupe sur `pt`, sans garde de contiguïté : le pas validé (`deplacerLeGroupe`), le saut, l'escalade, la chute et
 *  les téléports d'outil. `false` : la case ne reçoit pas le groupe (`groupePosable`). */
export function poserLeGroupe(get: Get, set: Set, pt: Pt): boolean {
  const { scene, mode, partyPos } = get();
  if (!scene || mode !== 'exploration' || !groupePosable(scene, pt)) return false;
  const from = partyPos; // case quittée → oriente le meneur le long du pas
  // MARCHER, C'EST SE LEVER : le meneur assis qui fait un pas quitte sa place. Libéré AVANT
  // l'écriture de `partyPos`, dans la MÊME écriture — aucun état intermédiaire ne le montre assis
  // à une place dont il s'est déjà éloigné. Scène sans assise → aucun delta (même référence).
  const debout = get().party.length ? releaseSeat(scene, { kind: 'groupe', rang: RANG_MENEUR }) : scene;
  set(debout === scene ? { partyPos: pt } : { partyPos: pt, scene: debout });
  // CAP DU GROUPE le long du pas (écrivain unique) — `orienterSelonLeChemin` reste la couture des caps
  // INDIVIDUELS du combat. DELTA NUL : un pas qui ne change que l'ÉTAGE (escalier, `z` seul) ne
  // touche pas au regard ; `facingToward` y rendrait son défaut sud et claquerait la vue.
  if (from.x !== pt.x || from.y !== pt.y) set((s) => ({ facing: poserCapDuGroupe(s.facing, facingToward(from, pt)) }));
  bus.emit(EVT.SCENE_DIRTY);
  checkTriggers(get, set);
  // Déplacement-puis-interaction : l'interaction s'ouvre à la case D'ARRIVÉE du plan qui l'a
  // armée (`pendingInteract.at`), jamais à une adjacence croisée en chemin — le chemin vers l'abord
  // d'une place passe par des cases voisines du meuble qui ne SONT pas cet abord.
  const pi = get().pendingInteract;
  if (pi) {
    const target = scene.entities.find((e) => e.id === pi.id);
    if (!target) set({ pendingInteract: null });
    else if (memeCase(pt, pi.at)) {
      set({ pendingInteract: null });
      // L'offre VISÉE au clic si le décor n'en portait qu'une ; sinon l'arbitrage de proximité
      // (relevage, unique offre recalculée à l'arrivée) — à N offres, la pastille les sert.
      if (pi.actionId) get().jouerAction(pi.id, pi.actionId);
      else get().interagirAvecLEntite(pi.id);
    }
  }
  return true;
}

/** Le pas `i` d'un chemin du groupe : un saut quand il franchit plus d'une case, sinon un pas de marche. */
export const gesteDuPas = (chemin: readonly Pt[], i: number): { verbe: 'sauter'; args: [readonly Pt[], number] } | { verbe: 'deplacerLeGroupe'; args: [Pt] } =>
  chebyshev(chemin[i], chemin[i - 1]) > 1 ? { verbe: 'sauter', args: [chemin, i] } : { verbe: 'deplacerLeGroupe', args: [chemin[i]] };

/** Le chemin se marche-t-il de bout en bout : chaque pas un saut (`gesteDuPas`), ou une case voisine à pied
 *  (`walkNeighbors`) ? Un chemin du pathfinder peut emprunter ce que la marche ne joue pas (nage, escalade). */
export const cheminMarchable = (scene: Scene, chemin: readonly Pt[]): boolean =>
  chemin.every((p, i) => i === 0 || gesteDuPas(chemin, i).verbe === 'sauter' || walkNeighbors(scene, chemin[i - 1]).some((n) => memeCase(n, p)));

/** La marche du groupe est-elle ouverte : en exploration, hors dialogue. La garde de tout pas du groupe (`pasDeLaMarche`,
 *  `avancerDUnPas`, `pasAligneDuGroupe`), de la marche tenue de l'écran et de son aperçu au survol. */
export const marcheOuverte = (s: Pick<Jeu, 'mode' | 'dialogue'>): boolean => s.mode === 'exploration' && !s.dialogue;

/** Le pas d'une case du groupe vers `dest` : refusé (`MOVE_BLOCKED`) sans case, sinon le meneur glisse d'une case par
 *  l'anim de marche (`ANIM_MOVE`) et le groupe s'y pose (`deplacerLeGroupe`). Rend `false` au refus. */
function faireLePas(s: JeuDuNoyau, dest: Pt | null): boolean {
  if (!dest) { bus.emit(EVT.MOVE_BLOCKED, {}); return false; }
  const leader = meneurDuMonde(s);
  if (leader) bus.emit(EVT.ANIM_MOVE, { id: leader.id, path: [s.partyPos, dest] });
  s.deplacerLeGroupe(dest);
  return true;
}

/** Le pas du groupe vers la case voisine la mieux alignée sur `alignement` (`exploreStepDest`) : l'hôte fournit
 *  l'alignement de chaque voisine sur la direction qu'il a lue à l'écran. */
export function pasAligneDuGroupe(get: Get, alignement: (voisin: Pt) => number): void {
  const s = get();
  if (!marcheOuverte(s) || !s.scene) return;
  faireLePas(s, exploreStepDest(s.scene, s.partyPos, alignement));
}

/** Le pas `i` d'une marche du groupe sur `chemin`, dans la scène `sceneId`, s'il se joue encore (`gesteDuPas`) : le
 *  groupe explore cette scène, hors dialogue (`marcheOuverte`), depuis la case d'avant, et le pas passe sa garde (`pasDuGroupe`) ; un saut
 *  se garde lui-même. `null` : la marche s'arrête. La garde de `marcherLeChemin`. */
export function pasDeLaMarche(s: Pick<Jeu, 'mode' | 'dialogue' | 'scene' | 'partyPos'>, sceneId: string, chemin: readonly Pt[], i: number): ReturnType<typeof gesteDuPas> | null {
  if (!marcheOuverte(s) || s.scene?.id !== sceneId || i >= chemin.length || !memeCase(s.partyPos, chemin[i - 1])) return null;
  const pas = gesteDuPas(chemin, i);
  return pas.verbe === 'sauter' || pasDuGroupe(s, chemin[i]) ? pas : null;
}

/** La marche du groupe sur `chemin`, en une passe, pas à pas, sauts compris (`pasDeLaMarche`) : elle s'arrête au premier
 *  pas qui ne se joue plus (porte refermée, déclencheur, saut à Test). Le meneur glisse ensuite le long du chemin
 *  réellement parcouru (`ANIM_MOVE`), tant que le groupe est encore dans la scène où il a marché. */
export function marcherLeChemin(get: Get, chemin: readonly Pt[]): void {
  const depart = get();
  if (!depart.scene) return;
  const sceneId = depart.scene.id;
  const meneur = meneurDuMonde(depart);
  const parcouru: Pt[] = [depart.partyPos];
  for (let i = 1; ; i++) {
    const pas = pasDeLaMarche(get(), sceneId, chemin, i);
    if (!pas) break;
    const continuer = pas.verbe === 'sauter' ? get().sauter(...pas.args) : (get().deplacerLeGroupe(...pas.args), true);
    if (get().scene?.id !== sceneId || !memeCase(get().partyPos, chemin[i])) break;
    parcouru.push(chemin[i]);
    if (!continuer) break;
  }
  if (meneur && parcouru.length > 1 && get().scene?.id === sceneId) bus.emit(EVT.ANIM_MOVE, { id: meneur.id, path: parcouru });
}

/** L'accès s'actionne-t-il ? En combat tout battant (un passage n'en a pas), en exploration la porte fermée seule :
 *  un accès ouvert se franchit en marchant. */
export const porteActionnable = (mode: Jeu['mode'], portail: Pick<RoomPortal, 'kind'>): boolean =>
  mode === 'battle' ? portail.kind !== 'passage' : mode === 'exploration' && portail.kind === 'door-closed';

/** Les accès que le mobile du monde emprunte (`portalsForParty`) : depuis la case du groupe, en combat depuis celle de
 *  l'actif. */
export function portesDuMobile(s: Pick<Jeu, 'scene' | 'mode' | 'partyPos' | 'battle'>): RoomPortal[] {
  const depuis = s.mode === 'battle' ? (s.battle && activeCombatant(s.battle))?.pos : s.partyPos;
  return s.scene && depuis ? portalsForParty(s.scene, depuis) : [];
}

/** Le geste qu'ouvre l'activation d'un accès. */
export type GesteDuPortail = { verbe: 'actionnerLaPorte'; args: [IdDePorte] } | { verbe: 'cliquerLaCase'; args: [Pt] };

/** Le geste qu'ouvre l'activation d'un accès : l'actionner s'il s'actionne (`porteActionnable`), sinon, la marche
 *  ouverte (`marcheOuverte`), marcher jusqu'à sa case d'en face ; `null` en dialogue ou sans scène. */
export function gesteDuPortail(s: Pick<Jeu, 'mode' | 'dialogue' | 'scene'>, portail: RoomPortal): GesteDuPortail | null {
  if (s.dialogue || !s.scene) return null;
  if (porteActionnable(s.mode, portail)) return { verbe: 'actionnerLaPorte', args: [portail.id] };
  return marcheOuverte(s) ? { verbe: 'cliquerLaCase', args: [portail.to] } : null;
}

export function creerActionsDeMarche(get: Get, set: Set) {
  return {
    deplacerLeGroupe: (pt) => {
      const etat = get();
      if (!etat.scene || etat.mode !== 'exploration') return;
      if (!pasDuGroupe(etat, pt)) {
        const etage = walkNeighbors(etat.scene, etat.partyPos).find((n) => n.x === pt.x && n.y === pt.y);
        return void refuserGeste(get, set, etage ? t('marche.autreEtage', { z: etage.z ?? 0 }) : t('marche.horsDePas'));
      }
      poserLeGroupe(get, set, pt);
    },
    pivoterLeGroupe: (turn) => {
      if (!meneurDuMonde(get())) return; // groupe vide : personne à faire pivoter
      // Pivot du regard SEUL (aucun déplacement → pas de réorientation par `orienterSelonLeChemin`). ±1 cran = 45°.
      set((s) => ({ facing: poserCapDuGroupe(s.facing, rotateDir8(capDuGroupe(s) ?? 'S', turn)) }));
    },
    avancerDUnPas: (rel) => {
      const s = get();
      if (!marcheOuverte(s)) return;
      const scene = s.scene;
      if (!scene || !meneurDuMonde(s)) return;
      const cur = capDuGroupe(s) ?? 'S';
      // Cap MONDE du pas = regard tourné de 0/2/4/6 crans (2 crans = 90° par cadran relatif).
      const worldDir = rotateDir8(cur, { avant: 0, droite: 2, arriere: 4, gauche: 6 }[rel]);
      if (!faireLePas(s, povStepDest(scene, s.partyPos, worldDir))) return;
      // Un pas ≠ avant ne doit pas tourner le regard : `deplacerLeGroupe` a posé le cap du groupe le long du
      // pas → on restaure le cap d'origine (l'avance, elle, aligne naturellement regard et déplacement).
      if (rel !== 'avant') set((st) => ({ facing: poserCapDuGroupe(st.facing, cur) }));
    },
    sauter: (chemin, indice) => {
      const { scene, mode, partyPos, party } = get();
      const cur = chemin[indice];
      if (!scene || mode !== 'exploration' || !cur) return false;
      // Le saut part de la case du groupe, vers un atterrissage que le pathfinder offrirait (LDB 15 l.76).
      if (indice < 1 || !memeCase(chemin[indice - 1], partyPos)) {
        refuserGeste(get, set, t('saut.horsDuGroupe'));
        return false;
      }
      if (!atterrissagesDeSaut(scene, partyPos, optionsDeCheminDuGroupe(party)).some((a) => memeCase(a, cur))) {
        refuserGeste(get, set, t('saut.horsDePortee'));
        return false;
      }
      // Élan = pas contigus en ligne droite menant au décollage.
      const jdx = Math.sign(cur.x - partyPos.x), jdy = Math.sign(cur.y - partyPos.y);
      let runUp = 0;
      for (let k = indice - 1; k > 0; k--) {
        const a = chemin[k], b = chemin[k - 1];
        if (Math.sign(a.x - b.x) === jdx && Math.sign(a.y - b.y) === jdy && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) runUp++;
        else break;
      }
      const plan = planJump(scene, partyPos, cur, mouvementDuGroupe(party), runUp);
      if (plan.kind === 'none') {
        refuserGeste(get, set, t('saut.aucuneSurface'));
        return false;
      }
      poserLeGroupe(get, set, cur);
      if (plan.kind !== 'test') return true;
      jouerFlowEntier(runFlow(get, set, plan.flow));
      return false;
    },
    actionnerLaPorte: (porte) => {
      const { scene, mode, dialogue } = get();
      if (dialogue || !scene) return false;
      const portail = portesDuMobile(get()).find((p) => p.id === porte);
      if (!portail) { refuserGeste(get, set, t('porte.refus.inconnue', { id: porte })); return false; }
      if (!porteActionnable(mode, portail)) {
        if (mode === 'exploration') refuserGeste(get, set, t('porte.refus.ouverte'));
        return false;
      }
      set({ scene: toggleDoorIn(scene, portail.edge.x, portail.edge.y, portail.edge.side, portail.z) });
      bus.emit(EVT.SCENE_DIRTY);
      return true;
    },
  } satisfies FabriqueDuNoyau;
}

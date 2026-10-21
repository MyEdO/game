/** Marche du groupe en exploration : pas, pivot, pas relatif au regard, saut et porte. */
import { groupePosable, toggleDoorIn } from './monde/scene';
import { releaseSeat, RANG_MENEUR, memeCase } from './monde/seating';
import { poserCapDuGroupe, meneurDuMonde, capDuGroupe } from './monde/combatants';
import { facingToward, rotateDir8 } from '../geometry/dir8';
import { bus, EVT } from './bus';
import { checkTriggers, jouerFlowEntier, runFlow } from './combatEffects';
import { mouvementDuGroupe, optionsDeCheminDuGroupe, povStepDest } from './monde/exploreNav';
import { atterrissagesDeSaut, walkNeighbors, type Pt } from './monde/path';
import { planJump } from './monde/jumpMove';
import { refuserGeste } from './refusVisible';
import { t } from '../i18n';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';

/** Le pas du groupe vers `pt` est-il une MARCHE : une case voisine à pied de la sienne (`walkNeighbors`, la
 *  connectivité du pathfinder) ? La garde du verbe `moveParty`, que l'écran lit avant d'animer un pas. */
export const pasDuGroupe = (s: Pick<Jeu, 'scene' | 'partyPos'>, pt: Pt): boolean =>
  !!s.scene && walkNeighbors(s.scene, s.partyPos).some((n) => memeCase(n, pt));

/** POSE le groupe sur `pt`, sans garde de contiguïté : le pas validé (`moveParty`), le saut, l'escalade, la chute et
 *  les téléports d'outil. `false` : la case ne reçoit pas le groupe (`groupePosable`). */
export function poserLeGroupe(get: Get, set: Set, pt: Pt): boolean {
  const { scene, mode, partyPos } = get();
  if (!scene || mode !== 'exploration' || !groupePosable(scene, pt)) return false;
  const from = partyPos; // case quittée → oriente le meneur le long du pas
  // MARCHER, C'EST SE LEVER : le meneur assis qui fait un pas quitte sa place. Libéré AVANT
  // l'écriture de `partyPos`, dans la MÊME écriture — aucun état intermédiaire ne le montre assis
  // à une place dont il s'est déjà éloigné. Scène sans assise → aucun delta (même référence).
  const debout = get().party.length ? releaseSeat(scene, { kind: 'party', rang: RANG_MENEUR }) : scene;
  set(debout === scene ? { partyPos: pt } : { partyPos: pt, scene: debout });
  // CAP DU GROUPE le long du pas (écrivain unique) — `faceFromPath` reste la couture des caps
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
      else get().interactEntity(pi.id);
    }
  }
  return true;
}

export function creerActionsDeMarche(get: Get, set: Set) {
  return {
    moveParty: (pt) => {
      const etat = get();
      if (!etat.scene || etat.mode !== 'exploration') return;
      if (!pasDuGroupe(etat, pt)) return void refuserGeste(get, set, t('marche.horsDePas'));
      poserLeGroupe(get, set, pt);
    },
    pivotParty: (turn) => {
      if (!meneurDuMonde(get())) return; // groupe vide : personne à faire pivoter
      // Pivot du regard SEUL (aucun déplacement → pas de réorientation par `faceFromPath`). ±1 cran = 45°.
      set((s) => ({ facing: poserCapDuGroupe(s.facing, rotateDir8(capDuGroupe(s) ?? 'S', turn)) }));
    },
    stepPartyRelative: (rel) => {
      const s = get();
      if (s.mode !== 'exploration') return;
      const scene = s.scene;
      if (!scene || !meneurDuMonde(s)) return;
      const cur = capDuGroupe(s) ?? 'S';
      // Cap MONDE du pas = regard tourné de 0/2/4/6 crans (2 crans = 90° par cadran relatif).
      const worldDir = rotateDir8(cur, { forward: 0, right: 2, back: 4, left: 6 }[rel]);
      const dest = povStepDest(scene, s.partyPos, worldDir);
      if (!dest) { bus.emit(EVT.MOVE_BLOCKED, {}); return; }
      // Glisse d'1 case via l'anim de marche EXISTANTE (même forme d'émission que stepPartyDir).
      const leader = meneurDuMonde(s);
      if (leader) bus.emit(EVT.ANIM_MOVE, { id: leader.id, path: [s.partyPos, dest] });
      s.moveParty(dest);
      // Un pas ≠ avant ne doit pas tourner le regard : `moveParty` a posé le cap du groupe le long du
      // pas → on restaure le cap d'origine (l'avance, elle, aligne naturellement regard et déplacement).
      if (rel !== 'forward') set((st) => ({ facing: poserCapDuGroupe(st.facing, cur) }));
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
      const meneur = meneurDuMonde(get());
      if (meneur) bus.emit(EVT.ANIM_MOVE, { id: meneur.id, path: [partyPos, cur] });
      poserLeGroupe(get, set, cur);
      if (plan.kind !== 'test') return true;
      jouerFlowEntier(runFlow(get, set, plan.flow));
      return false;
    },
    actionnerLaPorte: (portail) => {
      const { scene, mode, dialogue } = get();
      if (dialogue || !scene) return false;
      const actionnable = mode === 'battle' ? portail.kind !== 'passage' : mode === 'exploration' && portail.kind === 'door-closed';
      if (!actionnable) return false;
      set({ scene: toggleDoorIn(scene, portail.edge.x, portail.edge.y, portail.edge.side, portail.z) });
      bus.emit(EVT.SCENE_DIRTY);
      return true;
    },
  } satisfies Partial<ActionsDuNoyau>;
}

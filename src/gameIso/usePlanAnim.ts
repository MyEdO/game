import { useEffect, useRef, useState } from 'react';
import { bus, EVT } from '../noyau/bus';
import { useGame } from '../state/store';
import { hasLeap } from '../engine/traits/dispatch';
import { planById, type BodyPlanId, type BodyPlan, type WingState } from './rig/bodyPlan';
import { project, type View } from './rig/facing';
import type { Dir8 } from '../geometry/dir8';
import { walkMs } from '../geometry/walk';
import { isTileVisible } from './viewport';
import type { GroundState } from './groundPose';
import type { BonePose } from './rig/poses';
import {
  clipTotalMs,
  planAttackDef,
  planDyingDef,
  planFlinchDef,
  planRenderPose,
  planRestDef,
  planWalkDef,
  type PlanClipDef,
} from './rig/anim/actorAnimSelect';

/** Geste courant : sa définition PURE (`actorAnimSelect`), son départ, et — pour la marche — la fin
 *  dictée par le chemin parcouru (la marche dure le trajet, pas une durée de clip). */
type Mode = { def: PlanClipDef; start: number; until?: number };

const restMode = (): Mode => ({ def: planRestDef(), start: performance.now() });

/**
 * Pilote l'ANIMATION d'un gabarit rigué non-bipède (quadrupède/ailé/serpentin/…) : repos en
 * continu (idlePose) + marche/attaque pilotées par le bus, projeté en vue 8-dir. Renvoie le
 * `plan` (null si monolithique), l'espèce, la `pose` courante, et `view`+`mirror`. Consommé par
 * `AnimatedPlanToken` (monté par `tokenBodyKind`) : le câblage bus et l'horloge rAF vivent ici, le
 * CHOIX du geste et son échantillonnage sont purs (`rig/anim/actorAnimSelect`).
 */
export function usePlanAnim(id: string, planId: BodyPlanId, species: string, dead?: boolean, facing?: Dir8, pos?: { x: number; y: number }, prone?: boolean): {
  plan: BodyPlan | null;
  species: string;
  pose: BonePose;
  view: View;
  mirror: boolean;
  /** Gabarit AILÉ : ailes PLIÉES au repos, DÉPLOYÉES en vol/attaque/mort étalée — à passer
   *  dans `ResolveOpts.wings` (les autres plans l'ignorent). */
  wings: WingState;
} {
  const camRot = useGame((s) => s.camRot);
  const worldDir = useGame((s) => s.facing?.[id]) ?? facing;
  const [, force] = useState(0);
  const modeRef = useRef<Mode>(restMode());
  const rafRef = useRef(0);
  const wasDown = useRef(!!(dead || prone)); // état initial : pas d'effondrement au montage
  const posRef = useRef(pos); // CULLING : tuile lue dans le rAF sans re-souscrire (pos stable)
  posRef.current = pos;

  const plan = planById(planId);
  const hasIdle = !!plan?.idlePose;

  useEffect(() => {
    if (!plan) return;
    const loop = () => {
      const m = modeRef.current;
      const t = performance.now();
      // La marche dure le TRAJET (`until`) ; les autres gestes, leur durée de définition.
      const ended = m.def.kind === 'walk' ? t > (m.until ?? 0) : m.def.kind !== 'rest' && t - m.start > clipTotalMs(m.def);
      if (ended) modeRef.current = restMode();
      // CULLING viewport : hors-champ → on saute le re-rendu (donc resolveRig) mais on GARDE la
      // boucle vivante (reprise auto en revenant dans le cadre). Le mode (walk/attack→rest) avance
      // quand même, donc aucune désync de timing. Coût hors-champ = un simple test de cadre.
      if (!posRef.current || isTileVisible(posRef.current.x, posRef.current.y)) force((n) => n + 1);
      rafRef.current = modeRef.current.def.kind === 'rest' && (!hasIdle || dead || prone) ? 0 : requestAnimationFrame(loop);
    };
    const ensureLoop = () => { if (!rafRef.current) rafRef.current = requestAnimationFrame(loop); };
    if (hasIdle && !dead && !prone) ensureLoop();
    // Transition debout → au sol : EFFONDREMENT animé (interpolation vers la pose couchée),
    // pas une téléportation. Un token monté déjà au sol (chargement) ne s'anime pas.
    const downNow = !!(dead || prone);
    if (downNow && !wasDown.current) {
      modeRef.current = { def: planDyingDef(dead ? 'corpse' : 'prone'), start: performance.now() };
      ensureLoop();
    }
    wasDown.current = downNow;
    const offMove = bus.on(EVT.ANIM_MOVE, (d: { id: string; path?: { x: number; y: number }[] }) => {
      if (d.id !== id) return;
      const p = d.path;
      // BOND (trait LDB 85) : le combattant qui l'a se déplace en BONDISSANT (leapPose du plan).
      const traits = useGame.getState().battle?.combatants.find((c) => c.id === id)?.traits;
      modeRef.current = { def: planWalkDef(hasLeap(traits)), start: performance.now(), until: performance.now() + Math.max(1, walkMs(p ?? [])) }; // s'arrête à l'arrivée réelle (plus d'off-by-one)
      ensureLoop();
    });
    const offAttack = bus.on(EVT.ANIM_ATTACK, (d: { from: string; to: string; creatureAttack?: string; result?: { hit?: boolean } }) => {
      if (d.from === id) {
        modeRef.current = { def: planAttackDef(d.creatureAttack), start: performance.now() };
        ensureLoop();
      } else if (d.to === id && !d.result?.hit) {
        // Attaque ESQUIVÉE : dérobade (les bipèdes jouent 'dodge' — les gabarits reculent).
        modeRef.current = { def: planFlinchDef(), start: performance.now() };
        ensureLoop();
      }
    });
    const offImpact = bus.on(EVT.ANIM_IMPACT, (d: { to: string; result?: { hit?: boolean } }) => {
      if (d.to !== id || !d.result?.hit) return;
      // TOUCHÉ : recul d'impact (les bipèdes jouent 'hit' — les gabarits n'avaient RIEN).
      modeRef.current = { def: planFlinchDef(), start: performance.now() };
      ensureLoop();
    });
    // IMPORTANT : remettre rafRef à 0 au cleanup. Sinon, après le démontage/remontage de
    // StrictMode (dev), `ensureLoop` voit l'ancien id (truthy) et NE relance JAMAIS la boucle
    // → l'anim de repos (battement d'ailes…) reste figée tant qu'un re-rendu externe (la marche)
    // ne pousse pas de nouvelles poses. cf. useRigClip qui relance inconditionnellement (humanoïdes OK).
    return () => { offMove(); offAttack(); offImpact(); if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; } };
  }, [id, plan, hasIdle, dead, prone]);

  const speciesName = plan ? (species || plan.speciesNames()[0] || '') : ''; // espèce résolue (passée), repli 1re du plan
  const m = modeRef.current;
  const now = performance.now();
  // Le CHOIX de pose au rendu est pur (`planRenderPose`) : l'état au sol y est lu MAINTENANT, et un
  // geste en BOUCLE (repos, marche) prend sa phase sur l'horloge globale — tous les gabarits y
  // battent en phase commune.
  const ground: GroundState = dead ? 'corpse' : prone ? 'prone' : null;
  const pose: BonePose = plan ? planRenderPose(plan, m.def, ground, now, m.start) : {};
  // AILES : pliées posé/flinch, DÉPLOYÉES dès que la bête vole (marche/bond), attaque, ou
  // s'effondre (QUAD_DEATH les étale au sol).
  const wings: WingState = dead || prone || m.def.wings === 'spread' ? 'spread' : 'folded';
  const fv = worldDir ? project(worldDir, camRot) : { view: 'front' as View, mirror: false };
  return { plan, species: speciesName, pose, view: fv.view, mirror: fv.mirror, wings };
}

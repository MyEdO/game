import type { Pose } from '../poses';
import { ease, type Easing } from './tween';
import { lerpPose } from '../poses';
import type { RoleDeCombat } from '../../../noyau/animation';

export interface ClipStep {
  pose: Pose;
  ms: number;
  easing?: Easing;
}
export interface Clip {
  steps: ClipStep[];
  onImpact?: number;
  loop?: boolean;
}

const REST: Pose = {};

/** Clips d'animation (deltas d'angles d'os). Valeurs initiales — réglées à la recette navigateur. */
export const CLIPS: Record<RoleDeCombat, Clip> = {
  // Bras droit (arme) en arrière puis fente avant ; léger pivot du torse.
  melee: {
    steps: [
      { pose: { epauleD: -35, avantBrasD: -25, torse: -6 }, ms: 130, easing: 'easeOut' },
      { pose: { epauleD: 55, avantBrasD: 20, torse: 8, bassin: 4 }, ms: 90, easing: 'easeOutBack' },
      { pose: REST, ms: 200, easing: 'easeInOut' },
    ],
    onImpact: 220, // début du strike
  },
  // Bras tendu vers la cible, petite détente.
  ranged: {
    steps: [
      { pose: { epauleD: 70, avantBrasD: -10, torse: -4 }, ms: 160, easing: 'easeOut' },
      { pose: { epauleD: 60, avantBrasD: 5 }, ms: 70, easing: 'easeOut' },
      { pose: REST, ms: 180, easing: 'easeInOut' },
    ],
    onImpact: 180, // relâche
  },
  // Bras levés, canalisation.
  cast: {
    steps: [
      { pose: { epauleG: -60, epauleD: -60, avantBrasG: -30, avantBrasD: -30, tete: -6 }, ms: 220, easing: 'easeOut' },
      { pose: { epauleG: -70, epauleD: -70, torse: -4 }, ms: 160, easing: 'easeInOut' },
      { pose: REST, ms: 200, easing: 'easeInOut' },
    ],
    onImpact: 380,
  },
  // Bascule latérale rapide + retour.
  dodge: {
    steps: [
      { pose: { bassin: -16, torse: -10, tete: -6 }, ms: 110, easing: 'easeOut' },
      { pose: REST, ms: 220, easing: 'easeInOut' },
    ],
  },
  // Arme/bouclier levés en garde.
  parry: {
    steps: [
      { pose: { epauleG: -50, avantBrasG: -40, torse: 4 }, ms: 90, easing: 'easeOut' },
      { pose: REST, ms: 260, easing: 'easeInOut' },
    ],
  },
  // Recul du buste à l'impact.
  hit: {
    steps: [
      { pose: { torse: 14, tete: 12, bassin: 6 }, ms: 90, easing: 'easeOut' },
      { pose: REST, ms: 240, easing: 'easeInOut' },
    ],
  },
  // Cycle de marche (boucle) : jambes/bras alternés.
  walk: {
    steps: [
      { pose: { cuisseG: 18, cuisseD: -18, epauleG: -12, epauleD: 12, bassin: 1 }, ms: 200, easing: 'easeInOut' },
      { pose: { cuisseG: -18, cuisseD: 18, epauleG: 12, epauleD: -12, bassin: 1 }, ms: 200, easing: 'easeInOut' },
    ],
    loop: true,
  },
  // Respiration subtile (boucle) — remplace le « bob » perdu au passage au rig.
  idle: {
    steps: [
      { pose: { torse: 1.5, tete: 1 }, ms: 1500, easing: 'easeInOut' },
      { pose: REST, ms: 1500, easing: 'easeInOut' },
    ],
    loop: true,
  },
};

export function clipDuration(clip: Clip): number {
  return clip.steps.reduce((a, s) => a + s.ms, 0);
}

/** Pose échantillonnée à `elapsed` ms depuis le début (départ = repos). PUR. */
export function sampleClip(clip: Clip, elapsed: number): { pose: Pose; done: boolean } {
  const total = clipDuration(clip);
  if (clip.loop) return { pose: sampleAt(clip, ((elapsed % total) + total) % total), done: false };
  if (elapsed >= total) return { pose: clip.steps[clip.steps.length - 1].pose, done: true };
  return { pose: sampleAt(clip, Math.max(0, elapsed)), done: false };
}

function sampleAt(clip: Clip, e: number): Pose {
  let t = 0;
  let prev: Pose = REST;
  for (const step of clip.steps) {
    if (e < t + step.ms) {
      const local = ease(step.easing ?? 'easeOut', (e - t) / step.ms);
      return lerpPose(prev, step.pose, local);
    }
    t += step.ms;
    prev = step.pose;
  }
  return prev;
}

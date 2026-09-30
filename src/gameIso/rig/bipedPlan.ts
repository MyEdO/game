/**
 * Plan corporel BIPÈDE — enveloppe le rig héros existant (resolveRig) sans le réécrire.
 * Le rendu des héros/PNJ humanoïdes continue via `resolveRig`/`rigComposition` ; ce plan expose le
 * bipède au registre de gabarits (parité d'interface avec quadruped/winged).
 */
import type { BonePose } from './poses';
import type { BodyPlan, ResolveOpts } from './bodyPlan';
import type { View } from './facing';
import type { Appearance } from './appearance';
import { asRigSpeciesId } from './appearance';
import type { EquipCtx } from './parts/equipment';
import { resolveRig, type ResolvedBone } from './composeRig';
import { bipedSpeciesNames } from './creatures';

const DEFAULT_BIPED: Omit<Appearance, 'species'> = { sex: 'M', build: 0.5, seed: 1 };
const EMPTY_EQUIP: EquipCtx = { weapons: [], armour: [] };

function resolveBiped(species: string, view: View, pose: BonePose, opts?: ResolveOpts): ResolvedBone[] {
  const appearance: Appearance = opts?.appearance ?? { ...DEFAULT_BIPED, species: asRigSpeciesId(species), colors: opts?.colors };
  const equip: EquipCtx = opts?.equip ?? EMPTY_EQUIP;
  return resolveRig(appearance, equip, pose, opts?.tenue, view);
}

// Pose de mort bipède (alignée sur CORPSE_POSE de RigToken : membres au sol).
const BIPED_DEATH = {
  tete: 18, torse: 6, epauleG: -30, epauleD: 24, avantBrasG: -14, avantBrasD: 10,
  cuisseG: 14, cuisseD: -10, tibiaG: 18, tibiaD: 6,
};
const sw = (ph: number) => Math.sin(ph * Math.PI * 2);

export const bipedPlan: BodyPlan = {
  id: 'biped',
  resolve: resolveBiped,
  speciesNames: bipedSpeciesNames,
  restPose: () => ({}),
  walkPose: (phase) => ({ cuisseG: sw(phase) * 14, cuisseD: sw(phase + 0.5) * 14, tibiaG: Math.max(0, sw(phase)) * 12, tibiaD: Math.max(0, sw(phase + 0.5)) * 12 }),
  attackPose: (phase) => ({ epauleD: -40 * Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI), avantBrasD: -20 * Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI) }),
  deathPose: () => BIPED_DEATH,
  hasView: () => true,
};

/**
 * Compose du gabarit QUADRUPÈDE → ResolvedBone[] (MÊME format que le rig héros) : chaque
 * créature devient des os animables par-bone, recoloriés via le moteur de palette partagé.
 */
import { addPose, type BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import { worldTransformsG, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap, type Palette } from '../palette';
import {
  QUAD_SPECIES, buildQuadSkeleton, groundQuad, quadSkeletonForView,
  type QBone, type QuadBoneId, type QuadDecoValue, type QuadProps,
} from './quadSkeleton';
import { quadParts, quadDecoFragments } from './quadParts';
import { quadHarnaisDeco } from './harnais';
import { applyEyes } from '../parts/eyes';
import { QUAD_REST, quadWalkPose, quadBitePose, quadLeapPose, quadFlinchPose, QUAD_DEATH } from './quadPose';
import { quadAttackPose } from '../anim/creatureAttackPoses';
import { sortByZ } from '../composite';

const LEG_REF_TH = 9; // épaisseur de réf d'un os porteur (haut) → léger scale x des membres
/**
 * Agrandissement de la tête vue de PROFIL, porté par l'OS (jamais par le repère de l'art) : à
 * l'échelle nue la tête lisait « minuscule/sombre » au bout de l'encolure. Il vit ici, avec les
 * autres échelles d'os (membres, carrure), et non dans `quadAnchor` — l'art de tête et le décor de
 * tête partagent ainsi une seule unité, celle de l'os (`src/gameIso/rig/PART-CONTRACT.md` l.137).
 */
const TETE_PROFIL = 1.3;
/** Os qui portent l'art de tête (`QBone.head`), pour ITÉRER — `nuque` est le calque BAS du MÊME
 *  art (cf. `quadParts`). Le rendu, lui, lit le champ de l'os, jamais cette liste. */
export const OS_TETE: QuadBoneId[] = ['tete', 'nuque'];

/**
 * Échelle d'OS d'un os quadrupède — SOURCE UNIQUE : tête (`headScale`, agrandie de profil),
 * carrure des os de corps, épaisseur des membres. Le rendu la pose sur `ResolvedBone.scale` ; une
 * garde qui projette un point du squelette au monde la lit ICI, jamais une copie.
 */
export function quadBoneScale(p: QuadProps, b: QBone, view: View): [number, number] {
  if (b.head) {
    const k = (p.headScale ?? 1) * (view === 'profile' ? TETE_PROFIL : 1);
    return [k, k];
  }
  return [b.limb ? (b.thickness / LEG_REF_TH) * (0.7 + 0.4 * p.girth) : 1, b.girth ? p.girth : 1];
}

/**
 * Déco de l'espèce ⊕ déco d'un SET d'équipement : par clé `os#vue`, les fragments du set s'AJOUTENT
 * à ceux de l'espèce, après eux dans l'ordre d'apposition (leur `plan` décide de l'empilement, cf.
 * `composeQuad`). Une clé que l'espèce ne porte pas entre telle quelle. PURE.
 */
export function mergeQuadDeco(
  base: QuadProps['deco'],
  set: NonNullable<QuadProps['deco']>,
): NonNullable<QuadProps['deco']> {
  const out = { ...(base ?? {}) } as Record<string, QuadDecoValue | undefined>;
  for (const [cle, val] of Object.entries(set) as [string, QuadDecoValue | undefined][]) {
    if (!val) continue;
    const prev = out[cle];
    out[cle] = prev ? [...quadDecoFragments(prev), ...quadDecoFragments(val)] : val;
  }
  return out as NonNullable<QuadProps['deco']>;
}

/**
 * Props d'espèce HABILLÉES du set déclaré par la donnée (`ResolveOpts.harnais`) — SOURCE UNIQUE des
 * deux gabarits servis par ce pipeline (`quadruped` et `winged`, qui est un quadrupède + ailes).
 * `harnais` vide (absent ou `''`, nu explicite d'un override) = les props d'espèce, intactes. PURE.
 */
export function quadPropsWithHarnais(p: QuadProps, espece: string, harnais?: string): QuadProps {
  return harnais ? { ...p, deco: mergeQuadDeco(p.deco, quadHarnaisDeco(harnais, espece)) } : p;
}

/** (espèce, vue, pose, couleurs, ailes, yeux, set d'équipement) → os résolus, triés z croissant
 *  (peintre). C'est ICI que les props d'ESPÈCE deviennent le rendu : le set déclaré par la donnée
 *  y fusionne sa déco, résolu contre l'espèce qui le porte. PUR. */
export function resolveQuad(
  species: string,
  view: View = 'profile',
  pose: BonePose = {},
  colors?: Palette,
  wings: 'folded' | 'spread' = 'folded',
  eyes?: { G?: string; D?: string },
  harnais?: string,
): ResolvedBone[] {
  const p = QUAD_SPECIES[species] ?? QUAD_SPECIES.cheval;
  return resolveQuadFromProps(quadPropsWithHarnais(p, species, harnais), view, pose, colors, wings, eyes);
}

/** Même rendu, mais à partir d'un PROPS direct (réutilisé par le gabarit AILÉ qui a son propre
 *  catalogue d'espèces : un ailé = quadrupède + ailes via la même machinerie). PUR. */
export function resolveQuadFromProps(
  p: QuadProps,
  view: View = 'profile',
  pose: BonePose = {},
  colors?: Palette,
  wings: 'folded' | 'spread' = 'folded',
  eyes?: { G?: string; D?: string },
): ResolvedBone[] {
  // Posture propre (p.stance) : deltas additifs SOUS la pose d'anim, en PROFIL seulement
  // (les vues de bout refigent leurs angles dans quadSkeletonForView).
  if (p.stance && view === 'profile') {
    pose = addPose(p.stance as BonePose, pose);
  }
  const sk = groundQuad(quadSkeletonForView(buildQuadSkeleton(p), view), pose);
  const world = worldTransformsG(sk, pose) as Record<QuadBoneId, Matrix>;
  const parts = quadParts(p, view, wings);
  // Yeux custom (catalogue) sur les ancres data-eye de la tête (no-op sans ancre — hydre…).
  if (eyes && parts.tete) parts.tete = parts.tete.map((l) => ({ ...l, svg: applyEyes(l.svg, eyes) }));
  // `aile` suit `corps` (table des clés de palette) : pégase déclare la sienne.
  const tmap = buildTokenMap([p.palette], colors ?? {});
  // Un os → N os RÉSOLUS, un par PLAN distinct de ses calques : le plan déclaré d'un calque est
  // RELATIF à celui de l'os (`QuadDecoFragment.plan`), et le tri peintre unique ci-dessous
  // l'intercale dans la pile de la vue. Les calques sans plan déclaré restent groupés avec l'art
  // de l'os, dans leur ordre d'apposition — même rendu qu'avant le canal de calques.
  return sortByZ((Object.keys(parts) as QuadBoneId[])
    .filter((id) => parts[id]?.length)
    .flatMap((id) => {
      const b = sk[id];
      const [sx, sy] = quadBoneScale(p, b, view);
      const parPlan = new Map<number, string[]>();
      for (const l of parts[id]!) {
        const plan = l.plan ?? 0;
        (parPlan.get(plan) ?? parPlan.set(plan, []).get(plan)!).push(l.svg);
      }
      return [...parPlan.entries()]
        .sort(([a], [c]) => a - c)
        .map(([plan, svgs]) => ({
          id,
          matrix: world[id],
          scale: [sx, sy] as [number, number],
          z: b.z + plan,
          parts: svgs.map((svg) => ({ svg: applyTokenMap(svg, tmap), layer: 0 })),
        }));
    }));
}

export const quadrupedPlan: BodyPlan = {
  id: 'quadruped',
  resolve: (sp, view, pose, opts) => resolveQuad(sp, view, pose, opts?.colors, opts?.wings, opts?.eyes, opts?.harnais),
  speciesNames: () => Object.keys(QUAD_SPECIES),
  restPose: () => QUAD_REST,
  walkPose: quadWalkPose,
  attackPose: quadBitePose,
  attackKindPose: quadAttackPose,
  flinchPose: quadFlinchPose,
  deathPose: () => QUAD_DEATH,
  leapPose: quadLeapPose, // Bond (LDB 85) : démarche bondissante
  hasView: () => true,
};


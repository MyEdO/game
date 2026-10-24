/**
 * Galerie BESTIAIRE ANIMÉE — rendu RÉEL en jeu (rig), chaque créature jouant son anim de REPOS
 * en boucle (SVG + CSS, pas de GIF). Même chemin que l'IsoStage : gabarit non-bipède (plan.idlePose
 * — battement/ondulation/dodelinement) ou rig humanoïde (clip idle / respiration). Une entrée par
 * créature, groupée par plan corporel ; grandes espèces remises à l'échelle (matrices pré-scalées
 * pour rester dans la boîte sans transform de wrapper → alignement CSS view-box conservé).
 * Lancer : npx tsx scripts/gen-bestiary-gallery.mts → public/bestiary-gallery.html
 */
import { writeFileSync } from 'node:fs';
import { resolveRig, type ResolvedBone } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import { addPose } from '../src/gameIso/rig/poses';
import { CLIPS, sampleClip, clipDuration } from '../src/gameIso/rig/anim/clips';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { planById, bodyPlanById, resolveById, planOptsForRecord, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { mul, translate, type Matrix } from '../src/gameIso/rig/kinematics';
import { animatedRig } from './_lib-anim-rig';
import { creatures } from '../src/data/index';
import { findTrappingById } from '../src/data';

const IDLE_MS = 1600;
const NB = 12; // échantillons idle non-bipède
const styles: string[] = [];
let uidN = 0;

const PLAN_LABEL: Record<string, string> = {
  biped: 'Humanoïdes (rig)', quadruped: 'Quadrupèdes', winged: 'Ailés', serpentine: 'Serpentins',
  arachnid: 'Arachnides', avian: 'Volatiles', cephalopod: 'Céphalopodes', spectral: 'Spectraux / éthérés',
  squig: 'Squigs', amorphous: 'Amorphes', jabberslythe: 'Jabberslythe',
};
const PLAN_ORDER = ['biped', 'quadruped', 'winged', 'serpentine', 'arachnid', 'avian', 'cephalopod', 'spectral', 'squig', 'amorphous', 'jabberslythe'];
const planOf = (id: string): string => resolveById(id).plan;

/** Pré-scale (autour du centre) chaque os pour faire tenir les grandes espèces dans la boîte. */
function scaleBones(bones: ResolvedBone[], z: number, cx = 60, cy = 78): ResolvedBone[] {
  if (z === 1) return bones;
  const S = mul(translate(cx, cy), mul([z, 0, 0, z, 0, 0] as Matrix, translate(-cx, -cy)));
  return bones.map((b) => ({ ...b, matrix: mul(S, b.matrix) }));
}

/** Échantillons d'os animés d'une créature (par ID de record) + durée du cycle (idle), comme l'IsoStage. */
function creatureFrames(id: string): { samples: ResolvedBone[][]; dur: number } {
  const z = (() => { const s = resolveById(id).scale; return s > 1 ? +(1 / s).toFixed(3) : 1; })();
  const planId = bodyPlanById(id);
  if (planId !== 'biped') {
    const plan = planById(planId as BodyPlanId);
    const species = resolveById(id).species;
    if (plan.idlePose) {
      const samples = Array.from({ length: NB }, (_, i) => scaleBones(plan.resolve(species, 'front', plan.idlePose!(i / (NB - 1)), planOptsForRecord(id)), z));
      return { samples, dur: IDLE_MS };
    }
    return { samples: [scaleBones(plan.resolve(species, 'front', plan.restPose(), planOptsForRecord(id)), z)], dur: IDLE_MS };
  }
  // Humanoïde → rig + respiration (clip idle).
  const prof = entityRigProfile(findTrappingById, id, 7);
  const dur = clipDuration(CLIPS.idle);
  if (!prof) return { samples: [[]], dur };
  const N = 8;
  const samples = Array.from({ length: N }, (_, i) =>
    scaleBones(resolveRig(prof.appearance, prof.equip, addPose({}, sampleClip(CLIPS.idle, (i / (N - 1)) * dur).pose), prof.tenue, 'front', []), z));
  return { samples, dur };
}

function cell(c: { id: string; label: string }): string {
  const { samples, dur } = creatureFrames(c.id);
  const uid = `b${uidN++}`;
  const { css, svg } = animatedRig(samples, dur, uid);
  styles.push(css);
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 120 150" width="116" height="145"><defs>${defsGlobaux()}</defs><rect width="120" height="150" fill="#171b26"/>${svg}</svg>
    <figcaption style="color:#cdd;font:11px sans-serif">${c.label}</figcaption></figure>`;
}

const groups = new Map<string, { id: string; label: string }[]>();
for (const c of creatures) {
  const p = planOf(c.id);
  (groups.get(p) ?? groups.set(p, []).get(p)!).push({ id: c.id, label: c.label });
}
const sections = PLAN_ORDER.filter((p) => groups.has(p))
  .map((p) => {
    const names = groups.get(p)!;
    return `<h2 style="color:#d8a93b;font:15px sans-serif;margin:24px 0 8px">${PLAN_LABEL[p] ?? p} <span style="color:#7e8aa0;font-size:12px">(${names.length})</span></h2>` +
      `<div style="display:grid;grid-template-columns:repeat(auto-fill,120px);gap:14px">${names.map(cell).join('')}</div>`;
  })
  .join('');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bestiaire — animé</title>
<style>${styles.join('')}</style></head>
<body style="background:#11141c;padding:18px;margin:0">
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Bestiaire — ${creatures.length} créatures, ANIMÉES (rendu en jeu, en boucle)</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 6px">Chaque créature joue son anim de repos (battement/ondulation/respiration) en CSS pur — le rendu RÉEL de l'IsoStage. Aucun GIF, aucun sprite monolithique.</p>
${sections}
</body></html>`;
writeFileSync('public/bestiary-gallery.html', html);
console.log(`OK: public/bestiary-gallery.html (${creatures.length} créatures animées, ${groups.size} plans)`);

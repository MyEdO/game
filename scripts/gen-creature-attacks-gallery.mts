/**
 * Galerie BESTIAIRE — ATTAQUES (SVG + CSS, en boucle). Pour chaque créature non-bipède, une
 * tuile animée PAR ATTAQUE listée dans ses TRAITS canon (Morsure, Attaque caudale, Cornes,
 * Souffle, Arme/griffes…) — cf. engine/creatureAttacks. Un gabarit qui DÉCLARE `attackKindPose` joue
 * sa pose dédiée au type d'attaque ; les autres jouent leur `attackPose`. Aucune invention : tout vient des
 * traits. Lancer : npx tsx scripts/gen-creature-attacks-gallery.mts → public/creature-attacks.html
 */
import { writeFileSync } from 'node:fs';
import { defsGlobaux } from '../src/gameIso/sprites';
import { planById, bodyPlanById, resolveById, planOptsForRecord, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { mul, translate, type Matrix } from '../src/gameIso/rig/kinematics';
import type { ResolvedBone } from '../src/gameIso/rig/composeRig';
import { creatureAttacks, type AttackKind } from '../src/engine/creatureAttacks';
import { traitsDuPorteur } from '../src/engine/statEntry';
import { porteurDuProfil } from '../src/noyau/monde/spawn';
import { libelleDeValeur } from '../src/data/schemas/grammaire/meta';
import { attackKindSchema } from '../src/data/schemas/defs/maneuvers';

/** Libellé de FAMILLE d'attaque, lu sur le nœud qui la déclare (`enumNomme`, #1694). */
const familleFR = (kind: AttackKind): string => libelleDeValeur(attackKindSchema, kind);
import { animatedRig } from './_lib-anim-rig';
import { creatures } from '../src/data/index';

const ATTACK_MS = 760;
const N = 14;
const styles: string[] = [];
let uidN = 0;

function scaleBones(bones: ResolvedBone[], z: number, cx = 60, cy = 78): ResolvedBone[] {
  if (z === 1) return bones;
  const S = mul(translate(cx, cy), mul([z, 0, 0, z, 0, 0] as Matrix, translate(-cx, -cy)));
  return bones.map((b) => ({ ...b, matrix: mul(S, b.matrix) }));
}

/** Échantillons d'os d'une attaque (profil, face à la cible) ou null si bipède/monolithique. */
function attackFrames(id: string, kind: AttackKind): { samples: ResolvedBone[][] } | null {
  const planId = bodyPlanById(id);
  if (planId === 'biped') return null;
  const plan = planById(planId as BodyPlanId);
  const r = resolveById(id);
  const species = r.species;
  const sc = r.scale;
  const z = sc > 1 ? +(1 / sc).toFixed(3) : 1;
  const poseAt = (p: number) => plan.attackKindPose?.(kind, p) ?? plan.attackPose(p);
  const samples = Array.from({ length: N }, (_, i) => scaleBones(plan.resolve(species, 'profile', poseAt(i / (N - 1)), { ...planOptsForRecord(id), wings: 'spread' }), z));
  return { samples };
}

function cell(id: string, kind: AttackKind, label: string): string {
  const f = attackFrames(id, kind);
  if (!f) return '';
  const uid = `a${uidN++}`;
  const { css, svg } = animatedRig(f.samples, ATTACK_MS, uid);
  styles.push(css);
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 120 150" width="116" height="145"><defs>${defsGlobaux()}</defs><rect width="120" height="150" fill="#221a1a"/>${svg}</svg>
    <figcaption style="color:#e9b;font:10px sans-serif">${familleFR(kind)}<br><span style="color:#9a8">${label.replace(familleFR(kind), '').trim() || ''}</span></figcaption></figure>`;
}

const rows: string[] = [];
let nCreatures = 0, nAttacks = 0;
for (const c of creatures) {
  const planId = bodyPlanById(c.id);
  if (planId === 'biped') continue; // bipèdes → armes (anim-gallery)
  const attacks = creatureAttacks(traitsDuPorteur(c.traits ?? [], porteurDuProfil(c.id, c.char)));
  if (!attacks.length) continue;
  nCreatures++;
  nAttacks += attacks.length;
  const cells = attacks.map((a) => cell(c.id, a.kind, a.label)).join('');
  rows.push(`<div style="display:flex;align-items:center;gap:10px;margin:8px 0;border-bottom:1px solid #222;padding-bottom:6px">
    <div style="width:150px;color:#eee;font:12px sans-serif">${c.label}<br><span style="color:#888;font-size:10px">${attacks.length} attaque(s)</span></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">${cells}</div></div>`);
}

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bestiaire — attaques</title>
<style>${styles.join('')}</style></head>
<body style="background:#11141c;padding:18px;margin:0">
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Bestiaire — attaques par créature (depuis les TRAITS), animées</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 8px">Une tuile par attaque listée dans les traits canon (Morsure, Attaque caudale, Cornes, Souffle, Arme/griffes…), jouée en boucle. ${nCreatures} créatures · ${nAttacks} attaques. Aucune invention : tout vient des traits.</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/creature-attacks.html', html);
console.log(`OK: public/creature-attacks.html (${nCreatures} créatures, ${nAttacks} attaques animées)`);

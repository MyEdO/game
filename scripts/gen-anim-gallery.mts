/**
 * Galerie ANIMÉE des animations par arme (SVG + CSS, pas de GIF) : pour chaque arme canonique
 * (une par CLASSE DE MANIEMENT), le rig joue en boucle « porté » (statique) · « attaque » ·
 * « parade ». 1 rig + @keyframes CSS par os mobile (cf. _lib-anim-rig). Forme résolue par
 * `trappingId` (`formeResolue`), geste naturel par `attackKind`. Lancer : npx tsx scripts/gen-anim-gallery.mts → public/anim-gallery.html
 */
import type { Pose } from '../src/gameIso/rig/poses';
import { writeFileSync } from 'node:fs';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { defsGlobaux } from '../src/gameIso/sprites';
import { addPose } from '../src/gameIso/rig/poses';
import { weaponRest, weaponAttackClip, weaponParryClip } from '../src/gameIso/rig/anim/weaponClips';
import { sampleClip, clipDuration, type Clip } from '../src/gameIso/rig/anim/clips';
import { animatedRig, sampleTimes } from './_lib-anim-rig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import type { Weapon } from '../src/engine/types';
import { armeDeDessin, equipDe } from '../src/gameIso/rig/parts/equipment';
import { itemFromTrappingById, weaponFromItem } from '../src/engine/items';
import { weaponFromTrait } from '../src/engine/creatureEquip';
import type { EquipCtx } from '../src/gameIso/rig/parts/equipment';
import { assertWardrobeId } from './_lib-wardrobe';

// Mannequin de la planche : ID de garde-robe (carrière ∪ classe ∪ tenue), validé fail-fast —
// un id qui retombe sur « nu » déshabillerait toutes les tuiles en silence (#1338).
const MANNEQUIN = 'soldat';
assertWardrobeId(MANNEQUIN, 'anim-gallery');

const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.55, seed: 4 };
const N = 16;
const styles: string[] = [];
let uidN = 0;

function wep(arme: ArmeDePlanche): Weapon {
  const w = 'trappingId' in arme ? weaponFromItem(itemFromTrappingById(arme.trappingId)!) : weaponFromTrait({ id: arme.trait, value: 4 });
  if (!w) throw new Error(`[anim-gallery] « ${arme.label} » ne s'arme pas`);
  return w;
}

function svgTile(inner: string, label: string, css = '', bg = '#1d2230') {
  if (css) styles.push(css);
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 120 150" width="92" height="115"><defs>${defsGlobaux()}</defs><rect width="120" height="150" fill="${bg}"/>${inner}</svg>
    <figcaption style="color:#bcd;font:10px sans-serif">${label}</figcaption></figure>`;
}
/** Tuile STATIQUE (pose figée). */
function still(_w: Weapon, equip: EquipCtx, pose: Pose, label: string, bg?: string) {
  return svgTile(bonesToSvg(resolveRig(app, equip, pose, MANNEQUIN)), label, '', bg);
}
/** Tuile ANIMÉE (clip joué en boucle). */
function anim(_w: Weapon, equip: EquipCtx, hold: Pose, clip: Clip, label: string, bg?: string) {
  const dur = Math.max(clipDuration(clip), 1);
  const samples = sampleTimes(dur, N).map((t) => resolveRig(app, equip, addPose(hold, sampleClip(clip, t).pose), MANNEQUIN));
  const uid = `w${uidN++}`;
  const { css, svg } = animatedRig(samples, dur, uid);
  return svgTile(svg, label, css, bg);
}

// Une arme par CLASSE DE MANIEMENT (silhouette/clip distincts) — dont les armes NATURELLES
// de mutation (Tentacule = classe fouet, Cornes = coup de tête).
/** Une Possession du catalogue (`trappingId`) ou un trait d'arme naturelle (`trait`), armés COMME EN JEU. */
type ArmeDePlanche = { label: string; trappingId: string } | { label: string; trait: string };
const WEAPONS: ArmeDePlanche[] = [
  { label: 'Dague', trappingId: 'dague' }, { label: 'Rapière', trappingId: 'rapiere' },
  { label: 'Lance de cavalerie', trappingId: 'lance-de-cavalerie' }, { label: 'Grande hache', trappingId: 'grande-hache' },
  { label: 'Hallebarde', trappingId: 'hallebarde' }, { label: "Fléau d'armes", trappingId: 'fleau-d-armes' },
  { label: 'Main Gauche', trappingId: 'main-gauche' }, { label: 'Mains nues', trappingId: 'mains-nues' },
  { label: 'Arc long', trappingId: 'arc-long' }, { label: 'Arbalète', trappingId: 'arbalete' },
  { label: 'Pistolet', trappingId: 'pistolet' }, { label: 'Fronde', trappingId: 'fronde' },
  { label: 'Javelot', trappingId: 'javelot' }, { label: 'Fouet', trappingId: 'fouet' },
  { label: 'Bombe', trappingId: 'bombe' },
  { label: 'Tentacule', trait: 'tentacules' }, { label: 'Cornes', trait: 'cornes' },
];

const rows: string[] = [];
for (const arme of WEAPONS) {
  const name = arme.label;
  const w = wep(arme);
  const equip: EquipCtx = equipDe([w], []);
  const dessin = armeDeDessin(w);
  const hold = weaponRest(dessin);
  const cells = [
    still(w, equip, hold, 'porté'),
    anim(w, equip, hold, weaponAttackClip(dessin), 'attaque', '#2a1d22'),
    anim(w, equip, hold, weaponParryClip(dessin, false), 'parade', '#1d2a22'),
  ].join('');
  rows.push(`<div style="display:flex;align-items:center;gap:8px;margin:6px 0">
    <div style="width:130px;color:#eee;font:12px sans-serif">${name}</div>
    <div style="display:flex;gap:8px">${cells}</div></div>`);
}

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Animations par arme</title>
<style>${styles.join('')}</style></head>
<body style="background:#11141c;padding:16px;margin:0">
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Animations par arme (classe de maniement) — SVG/CSS en boucle</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 8px">Colonnes : porté (statique) · attaque · parade (en boucle). Une arme par classe de maniement (forme). Aucun GIF.</p>
${rows.join('')}
</body></html>`;
writeFileSync('public/anim-gallery.html', html);
console.log(`OK: public/anim-gallery.html (${WEAPONS.length} armes, ${uidN} tuiles animées)`);

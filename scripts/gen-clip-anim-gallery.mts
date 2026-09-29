/**
 * Galerie ANIMÉE (SVG + CSS, pas de GIF) des clips du moteur d'animation : les 8 clips de base
 * (idle/walk/melee/ranged/dodge/parry/hit/cast) joués en boucle sur un rig, plus les
 * clips de sort (bolt arcane / bénédiction divine). Chaque tuile = un rig + des @keyframes CSS
 * par os mobile (cf. _lib-anim-rig). Lancer : npx tsx scripts/gen-clip-anim-gallery.mts
 */
import type { Pose } from '../src/gameIso/rig/poses';
import { writeFileSync } from 'node:fs';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { defsGlobaux } from '../src/gameIso/sprites';
import { addPose } from '../src/gameIso/rig/poses';
import { CLIPS, sampleClip, clipDuration, type Clip } from '../src/gameIso/rig/anim/clips';
import { spellCastClip } from '../src/gameIso/rig/anim/spellClips';
import { weaponRest, mountedAttackClip, mountedParryClip, seatedClip } from '../src/gameIso/rig/anim/weaponClips';
import { seatRiderOnMount, mountedRest, harnaisDeMonture } from '../src/gameIso/rig/mountedRig';
import { planById, planOptsForRecord, resolveSpecies } from '../src/gameIso/rig/bodyPlan';
import { sizeTokenScale } from '../src/gameIso/sizeScale';
import { animatedRig, sampleTimes } from './_lib-anim-rig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import { asRigSpeciesId } from '../src/gameIso/rig/appearance';
import type { Weapon } from '../src/engine/types';
import type { EquipCtx } from '../src/gameIso/rig/parts/equipment';
import { assertWardrobeId } from './_lib-wardrobe';

// Tenues des mannequins : IDS de garde-robe (carrière ∪ classe ∪ tenue), validés fail-fast —
// un id qui retombe sur « nu » déshabillerait les tuiles en silence (#1338).
const TENUE_SOLDAT = 'soldat', TENUE_SORCIER = 'sorcier', TENUE_NONNE = 'nonne';
for (const id of [TENUE_SOLDAT, TENUE_SORCIER, TENUE_NONNE])
  assertWardrobeId(id, 'clip-anim-gallery');

const N = 16; // échantillons par cycle
const styles: string[] = [];
let uidN = 0;

function tile(label: string, clip: Clip, app: Appearance, equip: EquipCtx, career: string, hold: Pose = {}, bg = '#1d2230') {
  const dur = Math.max(clipDuration(clip), 1);
  const samples = sampleTimes(dur, N).map((t) => resolveRig(app, equip, addPose(hold, sampleClip(clip, t).pose), career));
  const uid = `k${uidN++}`;
  const { css, svg } = animatedRig(samples, dur, uid);
  styles.push(css);
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 120 150" width="104" height="130"><defs>${defsGlobaux()}</defs><rect width="120" height="150" fill="${bg}"/>${svg}</svg>
    <figcaption style="color:#bcd;font:11px sans-serif">${label}</figcaption></figure>`;
}

const soldat: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.55, seed: 4 };
const sorcier: Appearance = { species: asRigSpeciesId('humain'), sex: 'F', build: 0.45, seed: 5 };
const epee: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] };
const arc: Weapon = { label: 'Arc long', type: 'ranged', damage: { plusBF: false, flat: 4 }, qualities: [] };
const baton: Weapon = { label: 'Bâton', type: 'melee', damage: { plusBF: false, flat: 2 }, qualities: [] };
const eqEpee: EquipCtx = { weapons: [epee], armour: [] };
const eqArc: EquipCtx = { weapons: [arc], armour: [] };
const eqBaton: EquipCtx = { weapons: [baton], armour: [] };
const eqNu: EquipCtx = { weapons: [], armour: [] };

const meleeClips: [string, Clip][] = [
  ['idle', CLIPS.idle], ['walk', CLIPS.walk], ['melee', CLIPS.melee],
  ['dodge', CLIPS.dodge], ['parry', CLIPS.parry], ['hit', CLIPS.hit],
];
const rowSoldat = meleeClips.map(([l, c]) => tile(l, c, soldat, l === 'idle' || l === 'walk' ? eqEpee : eqEpee, TENUE_SOLDAT, weaponRest(epee))).join('');
const rowArc = tile('ranged (arc)', CLIPS.ranged, soldat, eqArc, TENUE_SOLDAT, weaponRest(arc)).concat(
  tile('cast', CLIPS.cast, sorcier, eqBaton, TENUE_SORCIER, weaponRest(baton)),
  tile('bolt (arcane)', spellCastClip('bolt'), sorcier, eqNu, TENUE_SORCIER, {}, '#231a30'),
  tile('blessing (divin)', spellCastClip('blessing'), sorcier, eqNu, TENUE_NONNE, {}, '#2a2618'),
);

// ── EN SELLE — clips MONTÉS (mountedAttackClip/mountedParryClip sur la tenue mountedRest),
// cavalier composé sur cheval (composite trié par os). Les ids d'os cavalier/monture
// COLLISIONNENT (tete des deux côtés) → suffixe par index APRÈS fusion (ordre stable).
const quad = planById('quadruped');
const horse = resolveSpecies('cheval').species; // id d'espèce quad canonique (data)
function mountedTile(label: string, weapon: Weapon | undefined, clip: Clip) {
  const dur = Math.max(clipDuration(clip), 1);
  const equip: EquipCtx = { weapons: weapon ? [weapon] : [], armour: [] };
  const samples = sampleTimes(dur, N).map((t) => {
    // Monture PORTÉE : le harnachement vient de la couture montée (canal DONNÉE), jamais réexprimé ici.
    const mountBones = quad.resolve(horse, 'profile', quad.restPose(), harnaisDeMonture(planOptsForRecord(undefined)));
    const riderPose = addPose(mountedRest('profile', weapon), sampleClip(clip, t).pose);
    const riderBones = resolveRig(soldat, equip, riderPose, TENUE_SOLDAT, 'profile', [], false);
    // Ratio cavalier DÉRIVÉ comme en jeu (`backends/webgl/sceneMeshes`, couple monté) : cavalier ÷ (art monture × Taille).
    const rideK = 1 / (resolveSpecies(horse).scale * sizeTokenScale('grande'));
    return seatRiderOnMount(mountBones, riderBones, { view: 'profile', mountScale: 1, riderScale: rideK }).map((b, i) => ({ ...b, id: `${b.id}_${i}` }));
  });
  const uid = `k${uidN++}`;
  const { css, svg } = animatedRig(samples, dur, uid);
  styles.push(css);
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 120 150" width="140" height="175"><defs>${defsGlobaux()}</defs><rect width="120" height="150" fill="#1d2230"/>${svg}</svg>
    <figcaption style="color:#bcd;font:11px sans-serif">${label}</figcaption></figure>`;
}
const wm = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon => ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);
const rowMonte = [
  mountedTile('charge (lance couchée)', wm('Lance de cavalerie'), mountedAttackClip(wm('Lance de cavalerie'))),
  mountedTile('taille (épée)', wm('Épée'), mountedAttackClip(wm('Épée'))),
  mountedTile('estoc (rapière)', wm('Rapière'), mountedAttackClip(wm('Rapière'))),
  mountedTile('coup 2 mains (gr. hache)', wm('Grande hache'), mountedAttackClip(wm('Grande hache'))),
  mountedTile('en joue (arbalète)', wm('Arbalète', 'ranged'), mountedAttackClip(wm('Arbalète', 'ranged'))),
  mountedTile('en joue (pistolet)', wm('Pistolet', 'ranged'), mountedAttackClip(wm('Pistolet', 'ranged'))),
  mountedTile('parade (épée)', wm('Épée'), mountedParryClip(wm('Épée'), false)),
  mountedTile('dérobade (assis)', wm('Épée'), seatedClip(CLIPS.dodge)),
].join('');

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Clips animés</title>
<style>${styles.join('')}</style></head>
<body style="background:#11141c;padding:18px;margin:0">
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Animations — clips du moteur (SVG/CSS, en boucle)</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 8px">Chaque rig joue son clip en boucle, animé en CSS pur (1 rig + @keyframes par os mobile). Aucun GIF.</p>
<div style="display:flex;flex-wrap:wrap;gap:12px">${rowSoldat}${rowArc}</div>
<h2 style="color:#eee;font:15px sans-serif;margin:18px 0 4px">En selle — clips montés (lance couchée, taille à cheval, en joue ; gestes sans bassin/jambes)</h2>
<div style="display:flex;flex-wrap:wrap;gap:12px">${rowMonte}</div>
</body></html>`;
writeFileSync('public/clip-anim-gallery.html', html);
console.log(`OK: public/clip-anim-gallery.html (${uidN} tuiles animées)`);

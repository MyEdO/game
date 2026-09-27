/**
 * Rend chaque arme (48) + bouclier (3) en SILHOUETTE ISOLÉE → public/qc/w-<slug>.png
 * + public/qc/weapons-manifest.json, pour l'audit aveugle de reconnaissabilité.
 * Usage : npx tsx scripts/_qc-render-weapons.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { defsGlobaux } from '../src/gameIso/sprites';
import { weaponPart, shieldPart, objetSansPorteur } from '../src/gameIso/rig/parts/equipment';
import { pickView } from '../src/gameIso/rig/parts/types';
import { WEAPON_FORMS, SHIELD_FORMS } from '../src/gameIso/rig/parts/weaponForms';
import type { Weapon } from '../src/engine/types';

mkdirSync('public/qc', { recursive: true });
const manifest: { id: string; slug: string; label: string; kind: string; path: string }[] = [];
const raster = (frag: string, path: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -56 40 72"><defs>${defsGlobaux()}</defs><rect x="-20" y="-56" width="40" height="72" fill="#222831"/>${frag}</svg>`;
  writeFileSync(path, new Resvg(svg, { background: '#222831', fitTo: { mode: 'width', value: 180 } }).render().asPng());
};

for (const f of WEAPON_FORMS) {
  const w: Weapon = { label: f.label, type: f.type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon;
  const path = `public/qc/w-${f.slug}.png`;
  raster(pickView(objetSansPorteur(weaponPart(w)), 'front'), path);
  manifest.push({ id: `w-${f.slug}`, slug: f.slug, label: f.label, kind: 'weapon', path });
}
for (const s of SHIELD_FORMS) {
  const path = `public/qc/w-shield_${s.slug}.png`;
  raster(pickView(objetSansPorteur(shieldPart({ label: s.label, type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] } as Weapon)), 'front'), path);
  manifest.push({ id: `w-shield_${s.slug}`, slug: `shield_${s.slug}`, label: s.label, kind: 'shield', path });
}
writeFileSync('public/qc/weapons-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`OK: ${manifest.length} PNG → public/qc/  (manifest weapons-manifest.json)`);

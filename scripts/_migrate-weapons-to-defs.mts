/**
 * One-shot (jetable) : migre les 48 FORMES d'arme vers le registre auto-chargé.
 * Lit la métadonnée (WEAPON_FORMS) + l'art EFFECTIF actuel (weaponPart = generated + overrides
 * lisibilité) et émet 1 fichier `weapons/defs/<slug>.ts` par arme (WeaponDef unifié, sans perte).
 * Usage : npx tsx scripts/_migrate-weapons-to-defs.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { WEAPON_FORMS } from '../src/gameIso/rig/parts/weaponForms';
import { weaponPart } from '../src/gameIso/rig/parts/equipment';
import type { Weapon } from '../src/engine/types';

const dir = 'src/gameIso/rig/parts/weapons/defs';
mkdirSync(dir, { recursive: true });

let n = 0;
for (const f of WEAPON_FORMS) {
  const art = weaponPart({ label: f.label, type: f.type, damage: { plusBF: false, flat: 0 }, qualities: [] } as Weapon);
  if (typeof art !== 'string' || !art) throw new Error(`art absent/orienté pour ${f.slug}`);
  const body =
    `import type { WeaponDef } from '../types';\n\n` +
    `export const weapon: WeaponDef = {\n` +
    `  slug: ${JSON.stringify(f.slug)},\n` +
    `  label: ${JSON.stringify(f.label)},\n` +
    `  type: ${JSON.stringify(f.type)},\n` +
    `  group: ${JSON.stringify(f.group)},\n` +
    `  target: ${JSON.stringify(f.target)},\n` +
    `  art: ${JSON.stringify(art)},\n` +
    `};\n`;
  writeFileSync(`${dir}/${f.slug}.ts`, body);
  n++;
}
console.log(`OK → ${n} fichiers dans ${dir}/`);

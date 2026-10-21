import { describe, it, expect } from 'vitest';
import { resolveRig } from './composeRig';
import type { Appearance } from '../../engine/authoringAppearance';
import { asRigSpeciesId } from './appearance';

const NO_EQUIP = { weapons: [], armour: [] };
const HUMAN: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 3 };
// début du path du crâne arrière plein (`BACK_CRANE`, cf. parts/cosmetic.ts).
const BACK_CRANE = 'M-9 6.6 Q-9.4 -2 0 -2.6';
// motif du path du cou (`NECK`, cf. parts/resolve.ts) — ordonnée du bas de crâne, commune aux 3 vues.
const NECK_MARK = '-16.4';
const TORSE_Z = 5; // skeletons.ts : torse.z
const COU_Z = 4.5; // skeletons.ts : cou.z (#633 P2 — SOUS le torse)
const TETE_Z = 7; // skeletons.ts : tete.z

describe('composeRig — corps de base garanti crâne+cou (#633 P2, D4)', () => {
  it("vue 'back' : le crâne arrière plein est présent sur l'os tete, à son z normal (7) — plus de tête chauve flottante", () => {
    const bones = resolveRig(HUMAN, NO_EQUIP, {}, 'Nu', 'back');
    const skullBones = bones.filter((b) => b.id === 'tete' && b.parts.some((p) => p.svg.includes(BACK_CRANE)));
    expect(skullBones.length, 'aucune entrée bones ne porte le crâne arrière').toBeGreaterThan(0);
    for (const b of skullBones) expect(b.z).toBe(TETE_Z);
  });

  it("vue 'back' : le cou (os `cou`) est présent, sous le torse — un col de torse le couvre naturellement", () => {
    const bones = resolveRig(HUMAN, NO_EQUIP, {}, 'Nu', 'back');
    const neckBones = bones.filter((b) => b.id === 'cou' && b.parts.some((p) => p.svg.includes(NECK_MARK)));
    expect(neckBones.length, 'aucune entrée bones ne porte le cou').toBeGreaterThan(0);
    for (const b of neckBones) expect(b.z).toBe(COU_Z);
    const torseBones = bones.filter((b) => b.id === 'torse');
    expect(torseBones.length).toBeGreaterThan(0);
    for (const t of torseBones) {
      expect(t.z).toBe(TORSE_Z);
      expect(t.z).toBeGreaterThan(COU_Z); // le torse (col) peint APRÈS (dessus) le cou
    }
  });

  it("vue 'profile' : crâne + cou présents (même corps de base, aucune vue sans cou)", () => {
    const bones = resolveRig(HUMAN, NO_EQUIP, {}, 'Nu', 'profile');
    expect(bones.some((b) => b.id === 'cou' && b.parts.some((p) => p.svg.includes(NECK_MARK)))).toBe(true);
    expect(bones.some((b) => b.id === 'tete')).toBe(true);
  });

  it("vue 'front' : la part de visage reste sur l'entrée tete à z=7, aucun crâne de dos plaqué (anti-régression)", () => {
    const bones = resolveRig(HUMAN, NO_EQUIP, {}, 'Nu', 'front');
    const teteBones = bones.filter((b) => b.id === 'tete' && b.z === TETE_Z);
    expect(teteBones.length, "aucune entrée bones 'tete' à z=7 en vue front").toBeGreaterThan(0);
    const skullInFront = bones.some((b) => b.parts.some((p) => p.svg.includes(BACK_CRANE)));
    expect(skullInFront).toBe(false);
  });
});

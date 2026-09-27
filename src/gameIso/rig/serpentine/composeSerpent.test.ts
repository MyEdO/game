import type { View } from '../facing';
import { describe, it, expect } from 'vitest';
import {
  resolveSerpentFromProps, serpentSway, serpentStrike, SERPENT_REST, SERPENT_DEATH, SERPENT_DEFAULT,
} from './composeSerpent';

describe('gabarit serpentin', () => {
  it('résout corps + cou + tête, triés z, pieds/coil en bas de boîte', () => {
    const bones = resolveSerpentFromProps(SERPENT_DEFAULT, 'profile', {});
    expect(bones.map((b) => b.id)).toEqual(['corps', 'cou', 'tete']); // z croissant
    expect(bones.every((b) => b.parts[0].svg.includes('<'))).toBe(true);
    const corps = bones.find((b) => b.id === 'corps')!;
    expect(corps.matrix[5]).toBeGreaterThan(100); // coil ancré bas
  });

  it('recolor : colors.corps change le markup', () => {
    const a = JSON.stringify(resolveSerpentFromProps(SERPENT_DEFAULT, 'profile', {}));
    const b = JSON.stringify(resolveSerpentFromProps(SERPENT_DEFAULT, 'profile', {}, { corps: '#aa1133' }));
    expect(a).not.toEqual(b);
  });

  it('le capuchon (hood) n’apparaît que si demandé', () => {
    const hooded = resolveSerpentFromProps({ ...SERPENT_DEFAULT, hood: true }, 'profile', {});
    const plain = resolveSerpentFromProps({ ...SERPENT_DEFAULT, hood: false }, 'profile', {});
    expect(JSON.stringify(hooded).length).toBeGreaterThan(JSON.stringify(plain).length);
  });

  it('les poses diffèrent (sway ≠ repos, lunge projette le cou, mort affaisse)', () => {
    expect(serpentSway(0.25)).not.toEqual(SERPENT_REST);
    expect(serpentStrike(0.5).cou).toBeGreaterThan(20);
    expect(SERPENT_DEATH.cou).toBeGreaterThan(60);
  });

  it('les 3 vues produisent une tête distincte (front/back/profile)', () => {
    const headOf = (v: View) =>
      resolveSerpentFromProps(SERPENT_DEFAULT, v, {}).find((b) => b.id === 'tete')!.parts[0].svg;
    expect(headOf('front')).not.toEqual(headOf('profile'));
    expect(headOf('back')).not.toEqual(headOf('profile'));
  });
});

import { describe, it, expect } from 'vitest';
import { rollDrivingMishap, mishapCausesCrash, drivingAccidentDamage } from './drivingMishap';
import { deFixe } from './dice.testkit';

const fixed = deFixe;

describe('Accidents de Conduite d’attelage EN SCÈNE (LDB 09 l.140-149)', () => {
  it('1d10 mappe la table : 1→Harnais, 4→Cahots, 7→Roue brisée, 10→Essieu', () => {
    expect(rollDrivingMishap(fixed(1)).entry.outcome).toBe('harness');
    expect(rollDrivingMishap(fixed(4)).entry.outcome).toBe('jolt');
    expect(rollDrivingMishap(fixed(7)).entry.outcome).toBe('wheel');
    expect(rollDrivingMishap(fixed(10)).entry.outcome).toBe('crash');
  });
  it('Accidenté : Essieu cassé toujours ; Roue brisée seulement sur un 2-roues', () => {
    expect(mishapCausesCrash('crash')).toBe(true);
    expect(mishapCausesCrash('wheel', false)).toBe(false);
    expect(mishapCausesCrash('wheel', true)).toBe(true);
    expect(mishapCausesCrash('jolt')).toBe(false);
  });
  it('Dégâts d’accident : 2d10 − BE − PA (min 0) ; 0 si le véhicule roulait doucement', () => {
    expect(drivingAccidentDamage(3, 2, fixed(10))).toBe(15); // 10+10 − 3 − 2
    expect(drivingAccidentDamage(3, 2, fixed(1))).toBe(0); // 1+1 − 5 < 0 → 0
    expect(drivingAccidentDamage(0, 0, fixed(10), true)).toBe(0); // roulait doucement
  });
});

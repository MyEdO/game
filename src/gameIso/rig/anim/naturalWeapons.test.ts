import { describe, it, expect } from 'vitest';
import { handlingClass } from './handling';
import { weaponAttackClip, weaponParryClip, weaponRest } from './weaponClips';
import { findTrappingById } from '../../../data';
import type { Weapon } from '../../../engine/types';

// Arme construite comme au SPAWN : id de Possession → shape et Groupe (`subType`) ; les attaques naturelles portent
// leur kind STABLE (`attackKind`) — c'est lui qui route le maniement, jamais le libellé.
const w = (id: string, extra: Partial<Weapon> = {}): Weapon =>
  ({ label: findTrappingById(id)?.label ?? id, type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], shape: findTrappingById(id)?.shape, subType: findTrappingById(id)?.subType ?? undefined, ...extra });
const tentacule = w('tentacule', { attackKind: 'tentacules', natural: true });
const cornes = w('cornes', { attackKind: 'cornes', natural: true });

describe('maniement des armes naturelles (mutations/traits)', () => {
  it('Tentacule → classe fouet (entraves) ; Cornes → coup de tête (cornes)', () => {
    expect(handlingClass(tentacule)).toBe('entraves');
    expect(handlingClass(cornes)).toBe('cornes');
    expect(handlingClass(w('fouet'))).toBe('entraves'); // l'arme Fouet inchangée
  });

  it('le geste se joue sur LE BRAS QUI TIENT L’ARME : tentacule et main gauche → miroité', () => {
    const lash = weaponAttackClip(tentacule);
    const all = lash.steps.flatMap((s) => Object.keys(s.pose));
    expect(all).toContain('epauleG');
    expect(all).not.toContain('epauleD'); // pas le bras d'arme droit
    expect(all).not.toContain('arme'); // rien en main
    // L'arme Fouet (main directrice), elle, fouette du bras droit.
    expect(weaponAttackClip(w('fouet')).steps.flatMap((s) => Object.keys(s.pose))).toContain('epauleD');
    // 2e frappe du Maniement de deux armes : la dague en MAIN GAUCHE frappe du bras gauche.
    const off = weaponAttackClip({ ...w('dague'), hand: 'off' });
    const offBones = off.steps.flatMap((s) => Object.keys(s.pose));
    expect(offBones).toContain('epauleG');
    expect(offBones).not.toContain('epauleD');
  });

  it('Cornes : coup de TÊTE (tête/cou/torse), pas un coup de bras ; parade = se couvrir', () => {
    const butt = weaponAttackClip(cornes);
    const strike = butt.steps[1].pose;
    expect(strike.tete).toBeGreaterThan(0);
    expect(strike.torse).toBeGreaterThan(0);
    expect(weaponRest(cornes)).toEqual({});
    expect(weaponParryClip(cornes)).toBe(weaponParryClip(w('mains-nues'))); // BARE_BLOCK
  });

  it('la PARADE aussi se joue sur le bras qui tient l’arme (main-gauche → bras gauche)', () => {
    const off = weaponParryClip({ ...w('main-gauche'), hand: 'off' });
    const bones = off.steps.flatMap((s) => Object.keys(s.pose));
    expect(bones).toContain('epauleG');
    expect(bones).not.toContain('epauleD');
    // En main directrice, la même arme pare à droite.
    expect(weaponParryClip(w('main-gauche')).steps.flatMap((s) => Object.keys(s.pose))).toContain('epauleD');
  });
});

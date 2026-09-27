import { describe, it, expect } from 'vitest';
import {
  resolveBirdFromProps, birdBob, birdPeck, BIRD_REST, BIRD_DEATH, BIRD_DEFAULT,
} from './composeBird';

describe('gabarit aviaire', () => {
  it('résout corps puis tête (z), avec pattes (cuir) + bec + œil cerclé', () => {
    const bones = resolveBirdFromProps(BIRD_DEFAULT, 'profile', {});
    expect(bones.map((b) => b.id)).toEqual(['corps', 'tete']);
    const corps = bones.find((b) => b.id === 'corps')!.parts[0].svg;
    expect(corps).toContain(BIRD_DEFAULT.palette.cuir); // pattes teintées via le token @cuir
    const tete = bones.find((b) => b.id === 'tete')!.parts[0].svg;
    expect(tete).toContain('#c86018'); // cercle oculaire / bec orangé (profil)
  });

  it('recolor : colors.corps change le markup (pigeon→corbeau)', () => {
    const a = JSON.stringify(resolveBirdFromProps(BIRD_DEFAULT, 'profile', {}));
    const b = JSON.stringify(resolveBirdFromProps(BIRD_DEFAULT, 'profile', {}, { corps: '#2a2e36' }));
    expect(a).not.toEqual(b);
  });

  it('de dos : pas de bec/œil de face', () => {
    const back = resolveBirdFromProps(BIRD_DEFAULT, 'back', {}).find((b) => b.id === 'tete')!.parts[0].svg;
    expect(back).not.toContain('#c86018');
  });

  it('les poses diffèrent (dodeline ≠ repos, bec plonge, mort sur le flanc)', () => {
    expect(birdBob(0.25)).not.toEqual(BIRD_REST);
    expect(birdPeck(0.5).tete).toBeGreaterThan(20);
    expect(BIRD_DEATH.corps).toBeGreaterThan(60);
  });
});

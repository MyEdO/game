import { describe, it, expect } from 'vitest';
import { nearestView, type ViewArt } from './viewArt';

const full: ViewArt = { front: () => 'F', profile: () => 'P', back: () => 'B' };
const profileOnly: ViewArt = { profile: () => 'P' };
const frontBack: ViewArt = { front: () => 'F', back: () => 'B' };

describe('viewArt — repli d’un art orienté sur la vue déclarée la plus proche', () => {
  it('mono-vue → toute vue demandée rend la seule déclarée', () => {
    expect(nearestView(profileOnly, 'front')()).toBe('P');
    expect(nearestView(profileOnly, 'back')()).toBe('P');
    expect(nearestView(profileOnly, 'profile')()).toBe('P');
  });

  it('le profil est mitoyen ; face↔dos passent par lui d’abord', () => {
    expect(nearestView(frontBack, 'profile')()).toBe('F'); // profil absent → 1re déclarée (face)
    expect(nearestView({ front: () => 'F', profile: () => 'P' }, 'back')()).toBe('P');
    expect(nearestView(full, 'back')()).toBe('B'); // déclarée → elle-même
  });

  it('art sans aucune vue = erreur de donnée (lève)', () => {
    expect(() => nearestView({}, 'front')).toThrow();
  });
});

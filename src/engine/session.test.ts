import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { ambitionXp, heroSessionXp, regainDetermination } from './session';

describe('Fin de séance — Ambitions (LDB 05) & Détermination (LDB 17)', () => {
  it('ambitionXp : +50 court terme, +500 long terme', () => {
    expect(ambitionXp('short')).toBe(50);
    expect(ambitionXp('long')).toBe(500);
  });

  it('heroSessionXp : cumule perso + groupe (chaque Joueur reçoit la récompense de groupe)', () => {
    expect(heroSessionXp({ short: true }, {})).toBe(50);
    expect(heroSessionXp({ long: true }, {})).toBe(500);
    expect(heroSessionXp({ short: true, long: true }, {})).toBe(550);
    expect(heroSessionXp({}, { short: true })).toBe(50); // ambition de groupe seule
    expect(heroSessionXp({ short: true }, { long: true })).toBe(550); // perso court + groupe long
    expect(heroSessionXp({}, {})).toBe(0);
  });

  it('regainDetermination : +1 plafonné au max du héros (resolveMax)', () => {
    const hero = { kind: 'heros', resolve: 0, resilience: 2, talents: [], skills: [], activeEffects: [] } as unknown as Combatant;
    expect(regainDetermination(hero, 1)).toBe(1);
    hero.resolve = 2; // resolveMax = resilience = 2 → déjà au max
    expect(regainDetermination(hero, 1)).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import type { Combatant } from '../engine/types';
import { persisterLeHeros, poserLaPlateforme, programmer, retirerLaPlateforme } from './plateforme';

/** #2817 (D6) : la plateforme que le noyau demande à son hôte ; la plateforme web se prouve à
 *  `src/state/plateforme-web.test.ts`. */
describe('plateforme du noyau', () => {
  it('un appel sans plateforme posée lève', () => {
    const web = retirerLaPlateforme();
    try {
      expect(() => programmer(() => {}, 0)).toThrow(/Plateforme absente/);
      expect(() => persisterLeHeros({ id: 'h' } as Combatant)).toThrow(/Plateforme absente/);
      expect(() => retirerLaPlateforme()).toThrow(/Plateforme absente/);
    } finally {
      poserLaPlateforme(web);
    }
  });
});

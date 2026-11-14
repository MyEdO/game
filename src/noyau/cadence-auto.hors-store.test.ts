import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { aiDriven } from './netOwnership';

import type { Combatant } from '../engine/types';
import { setCadence } from '../engine/cadence';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Auto-combat — base AGNOSTIQUE AU CAMP. `aiDriven` décide qui l'IA joue : les ennemis TOUJOURS
 * (inchangé), les héros UNIQUEMENT en mode « auto » ET contrôlés localement (coop), jamais en
 * manuel/rapide ni les PNJ. C'est la seule bascule de l'auto-combat ; un héros auto-piloté reste un
 * héros pour la résolution (Destin/Corruption/déviation inchangés).
 */
const c = (kind: Combatant['kind'], id: string) => ({ kind, id } as Combatant);

describe('aiDriven — qui l’IA pilote (Auto-combat)', () => {
  it('un ENNEMI est toujours piloté par l’IA (même en manuel)', () => {
    expect(aiDriven(banc.getState(), c('ennemi', 'e1'))).toBe(true);
  });

  it('un HÉROS n’est PAS piloté hors Auto-combat (manuel ET rapide)', () => {
    expect(aiDriven(banc.getState(), c('heros', 'h1'))).toBe(false); // manuel (défaut)
    setCadence('rapide');
    expect(aiDriven(banc.getState(), c('heros', 'h1'))).toBe(false); // rapide = jets auto, pas l’IA
  });

  it('un HÉROS est piloté en Auto-combat s’il est contrôlé localement', () => {
    setCadence('auto');
    expect(aiDriven(banc.getState(), c('heros', 'h1'))).toBe(true); // solo : ownsLocal = vrai
  });

  it('un PNJ n’est jamais auto-piloté', () => {
    setCadence('auto');
    expect(aiDriven(banc.getState(), c('pnj', 'n1'))).toBe(false);
  });
});

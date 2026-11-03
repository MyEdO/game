import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { inBattleId } from '../noyau/monde/combatants';
import { seedBattleRng, battleRng } from '../noyau/battleRng';
import { contractDisease, tickDisease } from '../engine/disease';
import { buildApi } from './devtools';

// Coutures d'entrée et de retour d'un héros dans le combat (#2312), côté web : `__wfrp.disease`. Le reste se joue
// au banc du noyau (`src/noyau/couture-de-retour.hors-store.test.ts`).

const tirages = (n = 6) => Array.from({ length: n }, () => battleRng().int(1, 100));
const cbt = (id: string) => inBattleId(useGame.getState().battle, id)!;

function combat(): string {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  hero.talents.push({ talentId: 'magie-mineure', times: 1 });
  hero.spells = [];
  useGame.setState({ battle: null, party: [hero], pendingCascade: null, pendingRoundStart: null, journal: [] });
  useGame.getState().startScene(testScene());
  seedBattleRng(777);
  useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
  vi.clearAllTimers();
  return hero.id;
}

describe('coutures du héros en combat (#2312)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('devtools.disease en phase active laisse le flux RNG du corps de base', () => {
    let id = combat(); seedBattleRng(99);
    buildApi().disease(id, 'vers-de-carie', { phase: 'active' });
    const nouv = tirages();
    expect(cbt(id).diseases?.find((d) => d.id === 'vers-de-carie')?.phase).toBe('active');
    id = combat(); seedBattleRng(99);
    const c = cbt(id); const dz = contractDisease('vers-de-carie', battleRng())!;
    c.diseases = [...(c.diseases ?? []), dz];
    tickDisease(c, dz.minutesLeft, battleRng(), () => {});
    expect(nouv).toEqual(tirages());
  });
});

/**
 * Gate PRÉ-clic du tir (parité avec le refus de sort) : cliquer une cible hors LdV ou au-delà de
 * la Portée ×3 est REFUSÉ au clic (journal) — la modale ne s'ouvre plus sur un raté garanti qui
 * consommait l'Action (resolveRanged fabriquait un échec synthétique `attackerRoll: 0`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';

/** Arène 20×8, MUR vertical en x=10 percé d'une brèche en y=0. */
function wallScene() {
  const w = 20, h = 8;
  const tiles: string[] = new Array(w * h).fill('herbe');
  for (let y = 1; y < h; y++) tiles[y * w + 10] = 'mur';
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
}

function setup() {
  const a = makePregens()[0];
  a.pos = { x: 2, y: 0 };
  a.weapons = [{ name: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 12, qualities: [] }] as never; // ×3 = 36 m = 18 cases
  const seen = spawnEnemy({ ref: 'brigand' }, 'e-vu', { x: 6, y: 0 });
  const hidden = spawnEnemy({ ref: 'brigand' }, 'e-cache', { x: 16, y: 4 }); // mur intercalé
  const battle = {
    combatants: [a, seen, hidden], order: [a.id, 'e-vu', 'e-cache'], baseOrder: [a.id, 'e-vu', 'e-cache'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  useGame.setState({ battle, scene: wallScene(), party: [] });
  return { a, seen, hidden };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingAttack: null });
  useGame.getState().seedRng(29);
});

describe('battleClickEntity — tir refusé AVANT la modale', () => {
  it('cible hors LdV → refus DIT « ligne de vue », pas de pendingAttack ni d’aperçu', () => {
    setup();
    useGame.getState().battleClickEntity('e-cache');
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(useGame.getState().battle?.preview ?? null).toBeNull();
    // Le refus d'un clic se dit au CANAL VISIBLE du combat (`state.refus` → bannière), pas au journal
    // de partie que le tiroir n'affiche pas pendant un combat (spec HUD § ARBITRAGE 2026-08-19).
    expect(useGame.getState().refus?.texte ?? '').toMatch(/ligne de vue/i);
  });

  it('cible au-delà de Portée ×3 → refus DIT « hors de portée », pas de pendingAttack', () => {
    const { a } = setup();
    a.weapons = [{ name: 'Arc court', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 4, qualities: [] }] as never; // ×3 = 6 cases
    useGame.getState().battleClickEntity('e-cache'); // à 14 cases — ET sans LdV, mais la portée seule suffirait
    expect(useGame.getState().pendingAttack).toBeNull();
    const b2 = spawnEnemy({ ref: 'brigand' }, 'e-loin', { x: 10, y: 0 }); // brèche : LdV ok, 8 cases > 6
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, combatants: [...b.combatants, b2] } });
    useGame.getState().battleClickEntity('e-loin');
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(useGame.getState().refus?.texte ?? '').toMatch(/hors de portée/i);
  });

  it('cible VALIDE (LdV + portée) → l’aperçu tap-1 se pose normalement', () => {
    setup();
    useGame.getState().battleClickEntity('e-vu');
    expect(useGame.getState().battle?.preview).toMatchObject({ kind: 'attack', targetId: 'e-vu' });
  });

});

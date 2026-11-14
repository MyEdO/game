/**
 * Gate PRÉ-clic du tir (parité avec le refus de sort) : cliquer une cible hors LdV ou au-delà de
 * la Portée ×3 est REFUSÉ au clic (journal) — aucune modale ne s'ouvre sur un raté garanti qui
 * consommerait l'Action.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { spawnEnemy } from './monde/spawn';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Arène 20×8, MUR vertical en x=10 percé d'une brèche en y=0. */
function wallScene() {
  const w = 20, h = 8;
  const tiles: string[] = new Array(w * h).fill('herbe');
  for (let y = 1; y < h; y++) tiles[y * w + 10] = 'mur';
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
}

function setup() {
  const a = tousLesHerosDeScenario(idsDeTest)[0];
  a.pos = { x: 2, y: 0 };
  a.weapons = [{ name: 'Arc', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 12, qualities: [] }] as never; // ×3 = 36 m = 18 cases
  const seen = spawnEnemy({ ref: 'humain' }, 'e-vu', { x: 6, y: 0 });
  const hidden = spawnEnemy({ ref: 'humain' }, 'e-cache', { x: 16, y: 4 }); // mur intercalé
  const battle = {
    combatants: [a, seen, hidden], order: [a.id, 'e-vu', 'e-cache'], baseOrder: [a.id, 'e-vu', 'e-cache'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  banc.setState({ battle, scene: wallScene(), party: [] });
  return { a, seen, hidden };
}

beforeEach(() => {
  banc.getState().ensemencerLeTirage(29);
});

describe('cliquerLaCase — tir refusé AVANT la modale', () => {
  it('cible hors LdV → refus DIT « ligne de vue », pas de pendingAttack ni d’aperçu', () => {
    setup();
    cliquerSurLeCombattant(banc.getState, 'e-cache');
    expect(banc.getState().pendingAttack).toBeNull();
    expect(banc.getState().battle?.preview ?? null).toBeNull();
    // Le refus d'un clic se dit au CANAL VISIBLE du combat (`state.refus` → bannière), pas au journal
    // de partie que le tiroir n'affiche pas pendant un combat (spec HUD § ARBITRAGE 2026-08-19).
    expect(banc.getState().refus?.texte ?? '').toMatch(/ligne de vue/i);
  });

  it('cible au-delà de Portée ×3 → refus DIT « hors de portée », pas de pendingAttack', () => {
    const { a } = setup();
    a.weapons = [{ name: 'Arc court', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 4, qualities: [] }] as never; // ×3 = 6 cases
    cliquerSurLeCombattant(banc.getState, 'e-cache'); // à 14 cases — ET sans LdV, mais la portée seule suffirait
    expect(banc.getState().pendingAttack).toBeNull();
    const b2 = spawnEnemy({ ref: 'humain' }, 'e-loin', { x: 10, y: 0 }); // brèche : LdV ok, 8 cases > 6
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, combatants: [...b.combatants, b2] } });
    cliquerSurLeCombattant(banc.getState, 'e-loin');
    expect(banc.getState().pendingAttack).toBeNull();
    expect(banc.getState().refus?.texte ?? '').toMatch(/hors de portée/i);
  });

  it('cible VALIDE (LdV + portée) → l’aperçu tap-1 se pose normalement', () => {
    setup();
    cliquerSurLeCombattant(banc.getState, 'e-vu');
    expect(banc.getState().battle?.preview).toMatchObject({ kind: 'attaque', targetId: 'e-vu' });
  });

});

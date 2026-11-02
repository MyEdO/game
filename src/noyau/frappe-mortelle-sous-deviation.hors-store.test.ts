/**
 * Frappe Mortelle sous une étape de Blessure critique : la chaîne suspendue reprend à la fermeture, une
 * fois, et seulement sur une mise à mort (LDB 14 l.9 ; LDB 63 l.30 ; #1595 7d-B, #1858).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { autoCleave } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, ItemInstance } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { isOutOfAction } from '../engine/conditions';
import { setRule } from '../engine/policy';
import { bus, EVT } from './bus';
import { draineCascade, type ChoisitCle } from './cascade.testkit';
import { LOCALISATIONS_DE_COUP } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const LIEUX = LOCALISATIONS_DE_COUP;
const harnois = (): ItemInstance =>
  ({ uid: 'harnois', name: 'Harnois', kind: 'armor', equipped: true, pa: 3, locs: [...LIEUX], qualities: [] } as unknown as ItemInstance);

/** Graines du battleRng : le Critique subi par H2 la tue (244), ou la laisse en vie et en action (3). */
const SEED_LETAL = 244;
const SEED_NON_LETAL = 3;

/** H1 tuée d'un coup par E, qui prend sa case : H2 et H3 au contact, H3 encore au contact depuis la case de H2. Toutes à 1 PB, tenues Surprises. */
function monte() {
  const heros = [1, 2, 3].map((i) => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i }));
  banc.setState({ party: heros });
  banc.getState().startScene(testScene());
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  const b = banc.getState().battle!;
  const [H1, H2, H3] = b.combatants.filter((c) => c.kind === 'hero');
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies[0];
  const cases = [{ x: 10, y: 10 }, { x: 11, y: 11 }, { x: 10, y: 11 }];
  [H1, H2, H3].forEach((H, i) => {
    H.pos = cases[i]; H.size = 'moyenne';
    H.wounds = blessuresDeBase(60, 1, H);
    H.items = [harnois()];
    H.armour = { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 };
    H.conditions = [{ id: 'surpris', value: 1 }];
    H.fate = 0;
  });
  H1.dead = true; H1.wounds.current = 0;
  E.pos = { x: 11, y: 10 }; E.size = 'moyenne';
  E.characteristics['capacite-de-combat'] = 85; E.characteristics.force = 45;
  E.advantage = 4;
  banc.setState({ battle: { ...b, turn: b.order.indexOf(E.id), acted: true } });
  return { H1, H2, H3, E };
}

const voie = (cle: 'devier' | 'subir'): ChoisitCle => (etape) => (etape.kind === 'deviation' ? cle : undefined);
const etapesDeDeviation = () => (banc.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'deviation');
const enJeu = (id: string): Combatant => banc.getState().battle!.combatants.find((c) => c.id === id)!;

/** Le maillon sur H2 suspend sur son étape ; rend les cibles frappées, dans l'ordre, après la fermeture. */
function frappeMortelle(seed: number, cle: 'devier' | 'subir'): { H2: Combatant; frappes: string[] } {
  banc.getState().seedRng(seed);
  const { H1, H2, H3, E } = monte();
  const frappes: string[] = [];
  const off = bus.on(EVT.ANIM_ATTACK, (e: { to: string }) => frappes.push(e.to === H2.id ? 'H2' : e.to === H3.id ? 'H3' : e.to));
  try {
    expect(autoCleave(banc.getState, banc.setState, E, H1, { hit: true, cleave: false } as AttackResult), 'la chaîne suspend sur l’étape').toBe(true);
    expect(etapesDeDeviation().map((s) => s.actorId), 'une étape, celle de H2').toEqual([H2.id]);
    expect(isOutOfAction(enJeu(H2.id)), 'rien d’appliqué avant la décision').toBe(false);
    draineCascade(banc.getState, 200, undefined, voie(cle));
  } finally { off?.(); }
  return { H2, frappes };
}

describe('Frappe Mortelle sous une étape de Blessure critique (LDB 14 l.9 ; LDB 63 l.30)', () => {
  beforeEach(() => { setRule('combat-frappe-mortelle', true); });

  it('Subir un Critique qui tue : la chaîne reprend à la fermeture et frappe la suivante une fois', () => {
    const { H2, frappes } = frappeMortelle(SEED_LETAL, 'subir');
    expect(enJeu(H2.id).dead, 'le Critique subi tue H2').toBe(true);
    expect(frappes).toEqual(['H2', 'H3']);
  });

  it('Subir un Critique qui laisse en vie : la chaîne s’arrête', () => {
    const { H2, frappes } = frappeMortelle(SEED_NON_LETAL, 'subir');
    expect(isOutOfAction(enJeu(H2.id))).toBe(false);
    expect(frappes, 'H3 reste au contact, et n’est pas frappée').toEqual(['H2']);
  });

  it('Dévier : le Critique est ignoré, la cible vit, la chaîne s’arrête', () => {
    const { H2, frappes } = frappeMortelle(SEED_LETAL, 'devier');
    expect(isOutOfAction(enJeu(H2.id))).toBe(false);
    expect(frappes, 'H3 reste au contact, et n’est pas frappée').toEqual(['H2']);
  });
});

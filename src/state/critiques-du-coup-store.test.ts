import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult, applyOpposedCritical } from './combatFlow';
import { draineCascade, type ChoisitCle } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { rederivePassiveAttack } from '../engine/combat';
import { setRule, resetRule } from '../engine/policy';
import { hasCondition } from '../engine/conditions';
import { critTableRows, critTableKeyFor } from '../engine/critical';
import { findTableEntry } from '../engine/tables';
import { recomputeLoadout } from '../engine/items';
import { testScene } from '../scenes/test-fixture';
import { t as tr } from '../i18n';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';

/** Le compte des Blessures critiques d'un coup, joué par le store : LDB 18 l.17, l.44, l.53 ; AA 07 l.36. */

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;

interface Coup { seed?: number; roll?: number; double?: boolean; current?: number; important?: boolean; chanceux?: boolean; pa?: number; endurance?: number; pieces?: ItemInstance[]; de?: number; tenu?: boolean; choisir?: ChoisitCle }

/** Un coup (de double, sauf `double: false`) sur la cible, par la couture du jeu (`rederivePassiveAttack` → `applyAttackResult`),
 *  la cascade drainée au dé `de` et au choix `choisir`. `tenu` = un siège MJ tient la cible. `pieces` = l'armure portée par la cible, à la place de sa PA plate. */
function coup({ seed = 7, roll = 44, double = true, current = 2, important = true, chanceux = false, pa = 0, endurance, pieces = [], de = 1, tenu = false, choisir }: Coup = {}) {
  useGame.getState().seedRng(seed);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
  useGame.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...useGame.getState().net, mode: tenu ? 'host' : 'local', mySeat: 0, gmSeat: tenu ? 1 : undefined } });
  useGame.getState().startScene(structuredClone(testScene()));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const cible = b.combatants.find((c) => c.kind === 'enemy')!;
  cible.items = [...(cible.items ?? []).filter((i) => i.kind !== 'armor'), ...structuredClone(pieces)];
  cible.armour = { tete: pa, corps: pa, brasG: pa, brasD: pa, jambeG: pa, jambeD: pa };
  if (pieces.length) recomputeLoadout(cible);
  if (endurance != null) cible.characteristics = { ...cible.characteristics, endurance };
  cible.wounds = { current, max: 20 } as Combatant['wounds'];
  cible.important = important;
  if (chanceux) cible.talents = [...(cible.talents ?? []), { talentId: 'chanceux', times: 1 }];
  const res = rederivePassiveAttack(H, cible, epee, { roll, target: 90, success: true, sl: 0, isDouble: double } as never, 'melee', 'corps');
  const auJet = { critical: res.critical, woundsLost: res.woundsLost ?? 0 };
  applyAttackResult(useGame.getState, useGame.setState, H, cible, epee, res, {});
  draineCascade(useGame.getState, 200, () => de, choisir);
  return { res, H, auJet, cible: useGame.getState().battle!.combatants.find((c) => c.id === cible.id)! };
}

/** Un Coup Critique (double 44) qui DÉPASSE les 2 Blessures restantes de la cible. */
function coupQuiDepasse(important: boolean, opts: Omit<Coup, 'important'> = {}) {
  const r = coup({ ...opts, important });
  expect(r.auJet.critical, 'le double fait le Coup Critique').toBe(true);
  expect(r.auJet.woundsLost, 'le coup dépasse les Blessures restantes').toBeGreaterThan(2);
  return r;
}

const LOCS = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'] as const;
const piece = (qualites: string[], pa: number, locs: readonly string[] = LOCS): ItemInstance =>
  ({ uid: 'p1', label: 'Pièce', kind: 'armor', equipped: true, pa, locs: [...locs], qualities: qualites.map((id) => ({ id })) }) as unknown as ItemInstance;

const totalPA = (c: Combatant) => Object.values(c.armour ?? {}).reduce((t, n) => t + n, 0);

describe('le store joue le compte des Blessures critiques du coup', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  it("'ldb' : Coup Critique ET dépassement — deux Blessures critiques, à la même Localisation (LDB 18 l.17, l.53)", () => {
    const { res, cible } = coupQuiDepasse(true);
    expect(cible.criticalWounds).toBe(2);
    expect(res.critLocation).toBeDefined();
    expect(res.location).toBe(res.critLocation);
  });

  for (const [endurance, be, seconde] of [[35, 3, 30], [10, 1, 50]] as const) {
    it(`'ldb' : BE ${be} — deux lignes de table, la seconde au d100 ${seconde} (LDB 18 l.17 ; #1595 c.6222318751)`, () => {
      const { res, cible } = coupQuiDepasse(true, { endurance, de: 50 });
      const depassement = (res.woundsLost ?? 0) - 2;
      expect(depassement > 0 && depassement < be, `dépassement ${depassement}, BE ${be}`).toBe(seconde === 30);
      const rangee = (r: number) => findTableEntry(critTableRows('ldb', critTableKeyFor(res.critLocation!)), r).id;
      expect(cible.critEntriesSuffered).toEqual([rangee(50), rangee(seconde)]);
    });
  }

  it("'ldb' : la Déviation du premier Critique laisse le second (LDB 63 l.30 ; LDB 18 l.17)", () => {
    const { cible } = coupQuiDepasse(true, { pa: 1, endurance: 10 });
    expect(totalPA(cible), 'un PA sacrifié').toBe(5);
    expect(cible.criticalWounds).toBe(1);
  });

  it("'aa' : une seule Blessure critique par coup, pour le Chanceux hors Mort subite (AA 07 l.36, l.67)", () => {
    setRule('combat-aa-blessures', 'aa');
    expect(coupQuiDepasse(true, { chanceux: true }).cible.criticalWounds).toBe(1);
  });

  it("'ldb' : le figurant tombe par la Mort subite, sans Blessure critique (LDB 18 l.44, l.46)", () => {
    const { cible } = coupQuiDepasse(false);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(cible.wounds.current).toBe(0);
    expect(hasCondition(cible, 'inconscient')).toBe(true);
  });

  it("Mort subite : le double en mêlée sur un figurant blindé n'ouvre ni Critique ni Déviation, la PA reste (LDB 18 l.44)", () => {
    const { cible } = coupQuiDepasse(false, { pa: 1, endurance: 10 });
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(totalPA(cible)).toBe(6);
    expect(useGame.getState().pendingCascade ?? null).toBeNull();
  });

  it("Mort subite : le Critique d'un Test opposé ne frappe pas le figurant (LDB 14 l.3 ; LDB 18 l.44)", () => {
    const { H, cible } = coupQuiDepasse(false, { pa: 1, endurance: 10 });
    const log: string[] = [];
    applyOpposedCritical(useGame.getState, useGame.setState, cible, 44, { attackerId: H.id, weapon: epee.label, weaponObj: epee }, log);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(totalPA(cible)).toBe(6);
    expect(useGame.getState().pendingCascade ?? null).toBeNull();
  });

  it("Impénétrable se lit à la Localisation RELANCÉE du Critique, pas à celle de la touche (LDB 63 l.78 ; LDB 18 l.53)", () => {
    const { res, auJet, cible } = coup({ seed: 1, roll: 33, current: 20, pieces: [piece(['impenetrable'], 1, ['corps'])] });
    expect(auJet.critical, 'le double impair reste un Coup Critique au jet').toBe(true);
    expect(res.critLocation, 'la relance quitte la pièce Impénétrable').not.toBe('corps');
    expect(cible.criticalWounds).toBe(1);
  });

  it("Partielle et Impénétrable : le double impair ignore les PA de Partielle et la Blessure critique (LDB 63 l.78, l.86)", () => {
    const temoin = coup({ roll: 33, current: 20, pieces: [piece(['impenetrable'], 2)] });
    const partielle = coup({ roll: 33, current: 20, pieces: [piece(['partielle', 'impenetrable'], 2)] });
    expect(partielle.cible.criticalWounds ?? 0).toBe(0);
    expect(partielle.auJet.woundsLost).toBe(temoin.auJet.woundsLost + 2);
  });
});

describe('Bâclée : la casse suit le Coup Critique, dévié, subi ou ignoré (LDB 60 l.50 ; #1595 c.6225326419)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  const portee = (c: Combatant, uid: string) => c.items!.find((i) => i.uid === uid)!;
  const casse = (c: Combatant, uid: string) => (portee(c, uid).damageTaken ?? 0) > (portee(c, uid).pa ?? 0);
  const journal = () => useGame.getState().battle!.log.map((l) => l.text);

  it('Bâclée seule, le porteur dévie : la pièce casse, la Déviation est jouée, aucun Critique', () => {
    const { cible } = coup({ roll: 44, current: 20, tenu: true, choisir: () => 'devier', pieces: [piece(['bacle'], 1)] });
    expect(casse(cible, 'p1')).toBe(true);
    expect(journal()).toContain(tr('cf.deflect', { name: cible.label }));
    expect(cible.criticalWounds ?? 0).toBe(0);
  });

  it('Bâclée seule, le porteur refuse : la pièce casse, le Critique est subi', () => {
    const { cible } = coup({ roll: 44, current: 20, tenu: true, choisir: () => 'subir', pieces: [piece(['bacle'], 1)] });
    expect(casse(cible, 'p1')).toBe(true);
    expect(cible.criticalWounds).toBe(1);
  });

  it('une autre pièce dévie : elle perd 1 PA, la Bâclée casse', () => {
    const autre = { ...piece([], 2), uid: 'p2' } as ItemInstance;
    const { cible } = coup({ roll: 44, current: 20, pieces: [piece(['bacle'], 1), autre] });
    expect(portee(cible, 'p2').damageTaken).toBe(1);
    expect(casse(cible, 'p1')).toBe(true);
    expect(cible.criticalWounds ?? 0).toBe(0);
  });

  it('le dépassement seul ne casse rien (LDB 13 l.161)', () => {
    const { auJet, cible } = coup({ roll: 45, double: false, current: 1, pieces: [piece(['bacle'], 1)] });
    expect(auJet.critical, 'aucun double : pas de Coup Critique').toBe(false);
    expect(portee(cible, 'p1').damageTaken, 'la Blessure critique du dépassement est déviée').toBe(1);
    expect(casse(cible, 'p1')).toBe(false);
  });

  it('Bâclée et Impénétrable, double impair : la Blessure critique est ignorée, la pièce casse (LDB 63 l.78)', () => {
    const { auJet, cible } = coup({ roll: 33, current: 20, pieces: [piece(['bacle', 'impenetrable'], 1)] });
    expect(auJet.critical).toBe(true);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(casse(cible, 'p1')).toBe(true);
  });
});

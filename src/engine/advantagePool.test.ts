import { describe, it, expect, afterEach } from 'vitest';
import {
  advantageCampOf, emptyPools, addToPool, mirrorPools, initialAdvantagePools, outnumberAdvantage,
  dominationTransfer, groupAdvantage,
} from './advantagePool';
import {
  hasStealAdvantage, stealsOneAdvantage, advantageTransferWeight, reloadGrantsAssessAdvantage,
  fearSizeAsMount, shieldAdvantageLevel,
} from './combatFeatures/dispatch';
import { setRule, resetRule } from './policy';
import type { Combatant, Weapon } from './types';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({ kind: 'hero', advantage: 0, talents: [], activeEffects: [], ...over }) as unknown as Combatant;
const withTalent = (id: string, kind: Combatant['kind'] = 'hero') =>
  mk({ kind, talents: [{ talentId: id, times: 1 }] as never });

describe('advantagePool — camp & réserves (AA 11 l.11-13)', () => {
  it('advantageCampOf : héros/allié → alliés ; enemy/npc → adversaires', () => {
    expect(advantageCampOf({ kind: 'hero' })).toBe('allies');
    expect(advantageCampOf({ kind: 'enemy' })).toBe('foes');
    expect(advantageCampOf({ kind: 'npc' })).toBe('foes');
  });

  it('addToPool ajoute et ne descend jamais sous 0', () => {
    const p = emptyPools();
    addToPool(p, 'allies', 3);
    expect(p.allies).toBe(3);
    addToPool(p, 'allies', -5);
    expect(p.allies).toBe(0);
  });

  it('mirrorPools projette la réserve du camp sur chaque combattant', () => {
    const a = mk({ kind: 'hero', advantage: 0 });
    const b = mk({ kind: 'enemy', advantage: 0 });
    const p = { allies: 4, foes: 2 };
    mirrorPools(p, [a, b]);
    expect(a.advantage).toBe(4);
    expect(b.advantage).toBe(2);
  });
});

describe('initialAdvantagePools — table d’Avantage initial (AA 11 l.53-65)', () => {
  it('paliers de Surnombre (AA 11 l.60-62)', () => {
    expect(outnumberAdvantage(1)).toBe(0);
    expect(outnumberAdvantage(1.5)).toBe(1);
    expect(outnumberAdvantage(2)).toBe(2);
    expect(outnumberAdvantage(3)).toBe(3);
    expect(outnumberAdvantage(5)).toBe(3);
  });

  it('exemple canon (AA 11 l.67) : surprise alliés +2 ; surnombre ×2 foes +2 ; menace manticore foes +3', () => {
    // 5 aventuriers surprennent, mais 10 gobelins (×2) + chamane sur manticore (menace très dangereuse).
    const p = initialAdvantagePools({
      surprise: 'allies',
      outnumber: { camp: 'foes', ratio: 11 / 5 },
      threat: { camp: 'foes', tier: 'tresDangereuse' },
    });
    expect(p.allies).toBe(2); // surprise
    expect(p.foes).toBe(5); // 2 (surnombre) + 3 (manticore)
  });

  it('Terrain léger/lourd et Manœuvrabilité', () => {
    expect(initialAdvantagePools({ terrain: { camp: 'allies', heavy: false } }).allies).toBe(1);
    expect(initialAdvantagePools({ terrain: { camp: 'allies', heavy: true } }).allies).toBe(2);
    expect(initialAdvantagePools({ maneuverability: 'foes' }).foes).toBe(2);
  });
});

describe('dominationTransfer — perte d’Avantage (AA 11 l.44)', () => {
  const always = () => true;
  const one = () => 1;

  it('camp majoritaire prend 1 Avantage au défavorisé', () => {
    const pools = { allies: 2, foes: 3 };
    // 2 alliés vs 1 adversaire → alliés dominent.
    const r = dominationTransfer(pools, [mk({ kind: 'hero' }), mk({ kind: 'hero' }), mk({ kind: 'enemy' })], always, one);
    expect(r.dominant).toBe('allies');
    expect(pools).toEqual({ allies: 3, foes: 2 });
  });

  it('réserve du défavorisé vide → le dominant gagne 1 (sans transfert)', () => {
    const pools = { allies: 0, foes: 0 };
    dominationTransfer(pools, [mk({ kind: 'enemy' }), mk({ kind: 'enemy' }), mk({ kind: 'hero' })], always, one);
    expect(pools).toEqual({ allies: 0, foes: 1 }); // foes dominent (2 vs 1), alliés vides
  });

  it('égalité de combattants → pas de transfert (arbitrage MJ non modélisé)', () => {
    const pools = { allies: 2, foes: 2 };
    const r = dominationTransfer(pools, [mk({ kind: 'hero' }), mk({ kind: 'enemy' })], always, one);
    expect(r.dominant).toBeNull();
    expect(pools).toEqual({ allies: 2, foes: 2 });
  });

  it('Coude-à-coude compte pour deux (l.4387) : 1 allié pondéré 2 égale 2 adversaires → égalité', () => {
    const pools = { allies: 1, foes: 1 };
    const weightOf = (c: Combatant) => (c.kind === 'hero' ? 2 : 1);
    const r = dominationTransfer(pools, [mk({ kind: 'hero' }), mk({ kind: 'enemy' }), mk({ kind: 'enemy' })], always, weightOf);
    expect(r.dominant).toBeNull(); // 2 (allié Coude-à-coude) == 2 (deux adversaires)
    expect(pools).toEqual({ allies: 1, foes: 1 });
  });
});

describe('CombatFeature — variante AA lue selon le toggle (aucun code ne nomme un Talent)', () => {
  afterEach(() => resetRule('combat-aa-avantage-groupe'));

  it('groupAdvantage suit la règle', () => {
    expect(groupAdvantage()).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(groupAdvantage()).toBe(true);
  });

  it('Renversement : LDB = vol total (stealAdvantage) ; AA = vol de 1 dans la réserve (stealOne)', () => {
    const c = withTalent('renversement');
    expect(hasStealAdvantage(c)).toBe(true);
    expect(stealsOneAdvantage(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(hasStealAdvantage(c)).toBe(false); // la variante AA désactive le vol total
    expect(stealsOneAdvantage(c)).toBe(true);
  });

  it('Porte-Bouclier : gain d’Avantage LDB, désactivé en mode groupe (variante AA)', () => {
    const shield = { name: 'Bouclier', trappingId: 'bouclier-targe', qualities: [{ id: 'protectrice', value: 1 }] } as unknown as Weapon;
    const c = withTalent('porte-bouclier');
    expect(shieldAdvantageLevel(c, shield)).toBe(1);
    setRule('combat-aa-avantage-groupe', true);
    expect(shieldAdvantageLevel(c, shield)).toBe(0);
  });

  it('Coude-à-coude : poids de transfert 1 (LDB) → 2 (mode groupe)', () => {
    const c = withTalent('coude-a-coude');
    expect(advantageTransferWeight(c)).toBe(1);
    setRule('combat-aa-avantage-groupe', true);
    expect(advantageTransferWeight(c)).toBe(2);
  });

  it('Artilleur/Rechargement rapide : +1 Avantage au rechargement seulement en mode groupe', () => {
    const art = withTalent('artilleur');
    const reload = withTalent('rechargement-rapide');
    expect(reloadGrantsAssessAdvantage(art)).toBe(false);
    expect(reloadGrantsAssessAdvantage(reload)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(reloadGrantsAssessAdvantage(art)).toBe(true);
    expect(reloadGrantsAssessAdvantage(reload)).toBe(true);
  });

  it('Cavalier émérite : Taille de la monture contre la peur de Taille, mode groupe seulement', () => {
    const c = withTalent('cavalier-emerite');
    expect(fearSizeAsMount(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(fearSizeAsMount(c)).toBe(true);
  });
});

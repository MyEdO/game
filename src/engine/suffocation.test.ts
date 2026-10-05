/**
 * Noyade et Suffocation (LDB 18 l.346) : « Vous perdez 1 Point de blessure par Round que
 * vous passez à suffoquer. Si vos Points de blessure passent à 0, gagnez immédiatement l'État
 * Inconscient. Après cela, et au bout d'un nombre de Rounds égal à votre Bonus d'Endurance,
 * vous mourez par suffocation ou par noyade. »
 * Bénédiction de Souffle (LDB 41) : « n'a pas besoin de respirer et ignore les règles de suffocation ».
 */
import { describe, expect, it } from 'vitest';
import type { Combatant, ItemInstance } from './types';
import { suffocationTick, prepareBreathHold, breathHoldSeconds, hasWaterContainer, isWaterSprayTarget, waterSprayCandidates } from './suffocation';
import { inDeathCondition, hasCondition } from './conditions';
import { applyOps } from './ops';
import { findSpell } from '../data';
import { spellOps } from '../state/flow';
import { setRule, resetRule } from './policy';
import { objetDeTest } from './objetDeTest.testkit';

/** Ops `on:'target'` d'un sort par label (les EFFETS vivent sur `SpellData.effects`, plus sur la spec). */
const opsOf = (label: string) => spellOps(findSpell(label)?.effects, 'target');

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'Noyé', kind: 'hero', size: 'moyenne', advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    conditions: [], skills: [], talents: [], traits: [], groups: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, wounds: { current: 2, max: 12 },
    activeEffects: [{ label: 'Ombres étrangleuses', bonus: 0, duration: { scale: 'rounds', left: 8 }, suffocates: true }],
    ...over,
  } as unknown as Combatant;
}

describe('suffocationTick — Noyade et Suffocation (LDB 18 l.346)', () => {
  it('perd 1 PB par Round de suffocation', () => {
    const c = mk();
    suffocationTick(c);
    expect(c.wounds.current).toBe(1);
  });
  it('à 0 PB : Inconscient immédiat + compte à rebours de BE Rounds', () => {
    const c = mk({ wounds: { current: 1, max: 12 } });
    suffocationTick(c);
    expect(c.wounds.current).toBe(0);
    expect(hasCondition(c, 'inconscient')).toBe(true);
    expect(c.suffocationCountdown).toBe(3); // BE(30) = 3
  });
  it('après BE Rounds à 0 PB : condition de mort (canal mort-lente — Destin inclus)', () => {
    const c = mk({ wounds: { current: 1, max: 12 } });
    suffocationTick(c); // → 0 PB, Inconscient, compteur 3
    suffocationTick(c); // 2
    suffocationTick(c); // 1
    expect(inDeathCondition(c)).toBe(false);
    suffocationTick(c); // 0 → mort
    expect(inDeathCondition(c)).toBe(true);
  });
  it('Bénédiction de Souffle : « ignore les règles de suffocation » — aucun effet', () => {
    const c = mk();
    c.activeEffects!.push({ label: 'Bénédiction de Souffle', bonus: 0, duration: { scale: 'rounds', left: 6 }, noBreath: true });
    suffocationTick(c);
    expect(c.wounds.current).toBe(2);
  });
  it('la suffocation cesse (effet expiré) : le compte à rebours est annulé', () => {
    const c = mk({ wounds: { current: 1, max: 12 } });
    suffocationTick(c);
    expect(c.suffocationCountdown).toBe(3);
    c.activeEffects = []; // le sort expire — l'air revient
    suffocationTick(c);
    expect(c.suffocationCountdown).toBeUndefined();
    expect(inDeathCondition(c)).toBe(false);
  });
});

describe('Rétention de souffle (LDB 18 l.346) : BE×10 s avant suffocation si préparé', () => {
  it('BE×10 secondes de souffle (BE 3 → 30 s)', () => {
    expect(breathHoldSeconds(mk())).toBe(30);
  });
  it('privé d’air BRUTALEMENT (non préparé) : suffocation immédiate (perte de PB dès le 1ᵉʳ Round)', () => {
    const c = mk(); // pas de prepareBreathHold → suffoque tout de suite
    suffocationTick(c);
    expect(c.wounds.current).toBe(1);
  });
  it('préparé : aucune Blessure perdue tant que le souffle dure (30 s = 3 Rounds de 10 s)', () => {
    const c = mk();
    prepareBreathHold(c); // 30 s
    suffocationTick(c); // 20 s
    suffocationTick(c); // 10 s
    suffocationTick(c); // 0 s
    expect(c.wounds.current).toBe(2); // aucune Blessure perdue pendant l'apnée
    expect(c.breathHoldSeconds).toBe(0);
    suffocationTick(c); // plus d'air → suffocation
    expect(c.wounds.current).toBe(1);
  });
  it('l’air revient avant épuisement du souffle : le crédit d’apnée est purgé', () => {
    const c = mk();
    prepareBreathHold(c);
    suffocationTick(c);
    c.activeEffects = []; // remonte à la surface
    suffocationTick(c);
    expect(c.breathHoldSeconds).toBeUndefined();
  });
  it('règle `combat-round-seconds` surchargée (LDB 13 l.13 — MJ décide) : décompte selon la surcharge', () => {
    setRule('combat-round-seconds', 5);
    const c = mk();
    prepareBreathHold(c); // 30 s
    suffocationTick(c); // 25 s (5 s/Round au lieu de 10)
    expect(c.breathHoldSeconds).toBe(25);
    resetRule('combat-round-seconds');
  });
});

describe('Créature marine hors de l’eau — pont offTerrain→suffocation (MDG 16 l.19, #477)', () => {
  const marine = (over: Partial<Combatant> = {}): Combatant => mk({
    kind: 'enemy',
    traits: [{ id: 'creature-marine' }],
    activeEffects: [],
    offTerrain: true,
    wounds: { current: 2, max: 12 },
    ...over,
  } as unknown as Partial<Combatant>);

  it('hors de l’eau, sans contre-mesure : entre dans le cycle de suffocation (−1 PB)', () => {
    const c = marine();
    suffocationTick(c);
    expect(c.wounds.current).toBe(1);
  });

  it('replacée dans l’eau (offTerrain retombe) : aucune suffocation', () => {
    const c = marine({ offTerrain: false });
    suffocationTick(c);
    expect(c.wounds.current).toBe(2);
  });

  it('contre-mesure « aspergée d’eau » active (wateredThisRound) : le Round est immunisé puis se consomme', () => {
    const c = marine({ wateredThisRound: true } as unknown as Partial<Combatant>);
    suffocationTick(c);
    expect(c.wounds.current).toBe(2); // aspergée ce Round : pas de suffocation
    expect(c.wateredThisRound).toBeUndefined(); // consommée — « régulièrement » = à reposer
    suffocationTick(c); // pas reposée au Round suivant → suffoque
    expect(c.wounds.current).toBe(1);
  });

  it('créature NON marine hors de l’eau (`c.offTerrain`) : aucune suffocation', () => {
    const c = marine({ traits: [{ id: 'coriace' }] } as unknown as Partial<Combatant>);
    suffocationTick(c);
    expect(c.wounds.current).toBe(2);
  });

  describe('« Asperger d’eau » (#497) — hasWaterContainer / isWaterSprayTarget / waterSprayCandidates', () => {
    it('hasWaterContainer : vrai avec une Outre à eau/un Seau dans le sac, faux sans', () => {
      const item = (trappingId: string): ItemInstance => objetDeTest({ uid: 'i1', trappingId });
      expect(hasWaterContainer(mk({ items: [item('outre-a-eau')] }))).toBe(true);
      expect(hasWaterContainer(mk({ items: [] }))).toBe(false);
      expect(hasWaterContainer(mk({ items: [item('seau')] }))).toBe(true);
    });

    it('isWaterSprayTarget : MÊME prédicat que la suffocation (offTerrainSuffocates)', () => {
      expect(isWaterSprayTarget(marine())).toBe(true);
      expect(isWaterSprayTarget(marine({ offTerrain: false }))).toBe(false);
      expect(isWaterSprayTarget(marine({ traits: [{ id: 'coriace' }] } as unknown as Partial<Combatant>))).toBe(false);
    });

    it('waterSprayCandidates : cible adjacente marine hors de l’eau, jamais soi-même ni hors de portée', () => {
      const aspergeur = mk({ id: 'a', pos: { x: 5, y: 5 } } as unknown as Partial<Combatant>);
      const adjacente = marine({ id: 'm1', pos: { x: 6, y: 5 } } as unknown as Partial<Combatant>);
      const loin = marine({ id: 'm2', pos: { x: 9, y: 9 } } as unknown as Partial<Combatant>);
      const dansLeau = marine({ id: 'm3', pos: { x: 5, y: 6 }, offTerrain: false } as unknown as Partial<Combatant>);
      const candidats = waterSprayCandidates(aspergeur, [aspergeur, adjacente, loin, dansLeau]);
      expect(candidats.map((c) => c.id)).toEqual(['m1']);
    });
  });
});

describe('Effets curés — suffocation (lus de SpellData.effects)', () => {
  it('Bénédiction de Souffle porte l’op noBreath', () => {
    expect(opsOf('Bénédiction de Souffle').some((o) => o.op === 'noBreath')).toBe(true);
  });
  it('Ombres étrangleuses : Exténué + suffocation + incantation coupée (« ne peuvent pas parler »)', () => {
    const ops = opsOf('Ombres étrangleuses');
    expect(ops.some((o) => o.op === 'suffocate')).toBe(true);
    expect(ops.some((o) => o.op === 'condition' && o.id === 'extenue')).toBe(true);
    expect(ops.some((o) => o.op === 'castPenalty' && o.blocked)).toBe(true);
  });
  it('Transmutation de Chamon : États persistants + 1 PA + suffocation', () => {
    const ops = opsOf('Transmutation de Chamon');
    expect(ops.some((o) => o.op === 'suffocate')).toBe(true);
    expect(ops.some((o) => o.op === 'ap')).toBe(true);
    for (const name of ['aveugle', 'assourdi', 'sonne']) {
      expect(ops.some((o) => o.op === 'condition' && o.id === name)).toBe(true);
    }
  });
  it('op suffocate : pose l’effet porteur à la durée du sort', () => {
    const c = mk({ activeEffects: [] });
    applyOps(c, [{ op: 'suffocate' }], { label: 'Ombres étrangleuses', defaultDurationRounds: 4 });
    expect(c.activeEffects?.find((e) => e.suffocates)?.duration).toEqual({ scale: "rounds", left: 4 });
  });
});

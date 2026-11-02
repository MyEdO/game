import { describe, it, expect, afterEach } from 'vitest';
import { isOutOfAction, usesSuddenDeath, applyZeroWounds, tickDeath, hasCondition, inDeathCondition } from './conditions';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    name: 'C',
    kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 }, // BE=3
    wounds: blessuresDeBase(12, 10),
    conditions: [],
    skills: [],
    ...over,
  })) as unknown as Combatant;

describe('Modèle de mort (LDB 18-Traumatisme)', () => {
  it("héros à 0 PB n'est PAS hors de combat (À Terre, agit encore)", () => {
    expect(isOutOfAction(mk({ wounds: blessuresDeBase(12, 0) }))).toBe(false);
  });
  describe('figurant à 0 PB exact : la Mort Subite suit le déclencheur du mode', () => {
    afterEach(() => resetRule('combat-aa-blessures'));
    const e = () => mk({ kind: 'enemy', wounds: blessuresDeBase(12, 0) });
    it("'ldb' : à 0 exact, ni dépassement ni sortie (LDB 18 l.46) — À Terre, horloge de LDB 18 l.15", () => {
      const f = e();
      expect(usesSuddenDeath(f)).toBe(true);
      expect(isOutOfAction(f)).toBe(false);
      applyZeroWounds(f);
      expect(hasCondition(f, 'a-terre')).toBe(true);
      tickDeath(f);
      expect(f.roundsAtZero).toBe(1);
    });
    it("'aa' : atteindre 0 Blessure met hors de combat (AA 07 l.65)", () => {
      setRule('combat-aa-blessures', 'aa');
      expect(isOutOfAction(e())).toBe(true);
    });
    it("'aa' : un PNJ à Talent Chanceux n'est pas un figurant (AA 07 l.67)", () => {
      setRule('combat-aa-blessures', 'aa');
      const chanceux = mk({ kind: 'enemy', important: false, talents: [{ talentId: 'chanceux', times: 1 }], wounds: { current: 0, max: 12 } } as Partial<Combatant>);
      expect(usesSuddenDeath(chanceux)).toBe(false);
      expect(isOutOfAction(chanceux)).toBe(false);
      const important = mk({ kind: 'enemy', important: true, wounds: { current: 0, max: 12 } } as Partial<Combatant>);
      expect(usesSuddenDeath(important)).toBe(true);
    });
  });
  describe('Mort Subite — portée réglable (LDB 18 l.42) ; jamais les PJ', () => {
    afterEach(() => resetRule('combat-sudden-death'));
    const fig = mk({ kind: 'enemy' });
    const vip = mk({ kind: 'enemy', important: true } as Partial<Combatant>);
    const hero = mk({ kind: 'hero' });
    it("'figurants' (défaut) : figurants oui, PNJ important non, PJ non", () => {
      expect(usesSuddenDeath(fig)).toBe(true);
      expect(usesSuddenDeath(vip)).toBe(false);
      expect(usesSuddenDeath(hero)).toBe(false);
    });
    it("'tous' : tous les non-héros (PNJ important inclus), PJ jamais", () => {
      setRule('combat-sudden-death', 'tous');
      expect(usesSuddenDeath(vip)).toBe(true);
      expect(usesSuddenDeath(hero)).toBe(false);
    });
    it("'off' : personne, même les figurants", () => {
      setRule('combat-sudden-death', 'off');
      expect(usesSuddenDeath(fig)).toBe(false);
    });
  });
  it('Inconscient ou mort = hors de combat', () => {
    expect(isOutOfAction(mk({ conditions: [{ id: 'inconscient', value: 1 }] }))).toBe(true);
    expect(isOutOfAction(mk({ dead: true }))).toBe(true);
  });
  it('applyZeroWounds : à 0 PB → À Terre', () => {
    const h = mk({ wounds: blessuresDeBase(12, 0) });
    applyZeroWounds(h);
    expect(hasCondition(h, 'a-terre')).toBe(true);
  });
  it('tickDeath : à 0 PB, Inconscient après BE rounds', () => {
    const h = mk({ wounds: blessuresDeBase(12, 0), roundsAtZero: 3 }); // BE=3 ; 3→4 > 3
    tickDeath(h);
    expect(hasCondition(h, 'inconscient')).toBe(true);
  });
  it('tickDeath : mode AA, à 0 PB, Inconscient après BE Rounds (LDB 18 l.15 ; #1595 c.6219559935)', () => {
    setRule('combat-aa-blessures', 'aa');
    try {
      const h = mk({ wounds: blessuresDeBase(12, 0), roundsAtZero: 3 }); // BE=3 ; 3→4 > 3
      tickDeath(h);
      expect(hasCondition(h, 'inconscient')).toBe(true);
    } finally { resetRule('combat-aa-blessures'); }
  });
  it('tickDeath : mode AA, contrôle sous le seuil — à 0 PB depuis BE Rounds, encore conscient', () => {
    setRule('combat-aa-blessures', 'aa');
    try {
      const h = mk({ wounds: blessuresDeBase(12, 0), roundsAtZero: 2 }); // BE=3 ; 2→3, pas > 3
      tickDeath(h);
      expect(hasCondition(h, 'inconscient')).toBe(false);
      expect(h.roundsAtZero).toBe(3);
    } finally { resetRule('combat-aa-blessures'); }
  });
  it('tickDeath : à 0 PB Inconscient + critiques > BE → condition de mort remplie (finalisée par le store)', () => {
    const h = mk({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], criticalWounds: 4 }); // BE=3
    tickDeath(h);
    expect(h.dead ?? false).toBe(false); // tickDeath ne tue plus
    expect(inDeathCondition(h)).toBe(true); // mais la condition est remplie
  });
  it('tickDeath : un combattant guéri (PB>0) remet roundsAtZero à 0', () => {
    const h = mk({ wounds: blessuresDeBase(12, 5), roundsAtZero: 2 });
    tickDeath(h);
    expect(h.roundsAtZero).toBe(0);
  });
});

describe("OBJET INERTE (affût d'artillerie) — immune à la cascade de Blessures (0 PB permanent)", () => {
  const engin = (over: Partial<Combatant> = {}): Combatant =>
    mk(blessuresSurLeProfil({ inert: true, bodyShape: 'engin', wounds: blessuresDeBase(0),
      characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 }, ...over }) as unknown as Partial<Combatant>);
  it("inert allié (kind:'hero') à 0 PB : applyZeroWounds ne pose PAS À Terre", () => {
    const e = engin({ kind: 'hero' });
    applyZeroWounds(e);
    expect(hasCondition(e, 'a-terre')).toBe(false);
  });
  it("inert allié : tickDeath ne pose PAS Inconscient même après plusieurs rounds (BE=0)", () => {
    const e = engin({ kind: 'hero', roundsAtZero: 5 } as Partial<Combatant>);
    tickDeath(e);
    expect(hasCondition(e, 'inconscient')).toBe(false);
  });
  it("inert ennemi (kind:'enemy') : ni À Terre ni Inconscient", () => {
    const e = engin({ kind: 'enemy', roundsAtZero: 5 } as Partial<Combatant>);
    applyZeroWounds(e); tickDeath(e);
    expect(hasCondition(e, 'a-terre')).toBe(false);
    expect(hasCondition(e, 'inconscient')).toBe(false);
  });
  it('inert : hors de combat SEULEMENT si détruit/éjecté, jamais par 0 PB', () => {
    expect(isOutOfAction(engin())).toBe(false);
    expect(isOutOfAction(engin({ dead: true }))).toBe(true);
    expect(isOutOfAction(engin({ outOfRencontre: true }))).toBe(true);
  });
});

describe('Destin — états dérivés', () => {
  const dying = (over: Partial<Combatant> = {}): Combatant =>
    mk({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], criticalWounds: 4, ...over }); // BE=3
  it('outOfRencontre = hors de combat (mais pas mort)', () => {
    const h = mk({ outOfRencontre: true });
    expect(isOutOfAction(h)).toBe(true);
    expect(h.dead ?? false).toBe(false);
  });
  it('inDeathCondition : Inconscient + 0 PB + critiques > BE', () => {
    expect(inDeathCondition(dying())).toBe(true);
    expect(inDeathCondition(mk({ wounds: blessuresDeBase(12, 5) }))).toBe(false); // pas à 0
    expect(inDeathCondition(dying({ dead: true }))).toBe(false); // déjà mort
    expect(inDeathCondition(dying({ outOfRencontre: true }))).toBe(false); // déjà éjecté
  });
  it('tickDeath ne finalise plus la mort (seulement 0 PB→Inconscient)', () => {
    const h = mk({ wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }], criticalWounds: 4 });
    tickDeath(h);
    expect(h.dead ?? false).toBe(false); // la finalisation est désormais portée par le store
  });
});

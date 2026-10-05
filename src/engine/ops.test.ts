/**
 * engine/ops — vocabulaire d'effets partagé (sorts / tables de contrecoup /
 * mutations) : formules, applicateur, non-cumul des modificateurs (LDB 16 l.13).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG, type RNG } from './dice';
import { resolveFormula, applyOps, applyActiveEffect, isValidFormula, formulaExpectation, type Formula } from './ops';
import { hasTraitKey } from './traits/dispatch';
import { woundsFromHit } from './combat';
import type { Weapon } from './types';
import { recomputeLoadout, isUnarmed, itemFromTrappingById } from './items';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 45, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 38, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [],
    ...p,
  } as Combatant;
}

describe('resolveFormula', () => {
  it('littéral, (Bonus de X), (X) pleine, dés (RNG seedable)', () => {
    const c = hero(); // FM 38 → BFM 3 ; E 45 → BE 4
    expect(resolveFormula(7, c)).toBe(7);
    expect(resolveFormula({ bonusOf: 'force-mentale' }, c)).toBe(3);
    expect(resolveFormula({ bonusOf: 'endurance' }, c)).toBe(4);
    expect(resolveFormula({ charOf: 'force-mentale' }, c)).toBe(38);
    const rng = makeRNG(42);
    const v = resolveFormula({ dice: { n: 1, sides: 10, plus: 2 } }, c, rng);
    expect(v).toBeGreaterThanOrEqual(3);
    expect(v).toBeLessThanOrEqual(12);
    // Déterminisme au seed
    expect(resolveFormula({ dice: { n: 1, sides: 10, plus: 2 } }, c, makeRNG(42))).toBe(v);
  });

  it('(Bonus de X) se résout contre la caractéristique EFFECTIVE (buffs compris)', () => {
    const c = hero({ activeEffects: [{ label: 'Buff', char: 'force-mentale', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(resolveFormula({ bonusOf: 'force-mentale' }, c)).toBe(4); // 38+10 → 48 → bonus 4
  });
});

describe('`{minimum, of}` — la borne basse est un terme de la formule (AA 07 l.113, LDB 18 l.88)', () => {
  /** « inutilisable pour 1d10 – (Bonus d'Endurance) Rounds (minimum de 1) ». */
  const CHOC_AU_BRAS: Formula = { minimum: 1, of: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] } };
  const de = (v: number): RNG => ({ int: () => v });

  it('BE 10 : la borne mord — 1 Round, jamais 0 ni négatif', () => {
    const c = hero({ characteristics: { ...hero().characteristics, endurance: 100 } }); // BE 10
    expect(resolveFormula(CHOC_AU_BRAS, c, de(1))).toBe(1); // 1 − 10 = −9 → 1
    expect(resolveFormula(CHOC_AU_BRAS, c, de(10))).toBe(1); // 10 − 10 = 0 → 1
  });

  it('BE 4 : la borne ne touche pas une durée déjà au-dessus', () => {
    const c = hero(); // E 45 → BE 4
    expect(resolveFormula(CHOC_AU_BRAS, c, de(10))).toBe(6); // 10 − 4
    expect(resolveFormula(CHOC_AU_BRAS, c, de(5))).toBe(1); // 5 − 4 = 1 : la borne n’ajoute rien
  });

  it('`isValidFormula` accepte la borne, refuse une borne non numérique ou un `of` absent', () => {
    expect(isValidFormula(CHOC_AU_BRAS)).toBe(true);
    expect(isValidFormula({ minimum: 'x', of: 3 })).toBe(false);
    expect(isValidFormula({ minimum: 1 })).toBe(false);
  });

  it('`formulaExpectation` n’est jamais sous la borne', () => {
    const c = hero({ characteristics: { ...hero().characteristics, endurance: 100 } });
    expect(formulaExpectation(CHOC_AU_BRAS, c)).toBe(1); // E[1d10] 5,5 − 10 = −4,5 → 1
    expect(formulaExpectation({ minimum: 1, of: 7 }, c)).toBe(7);
  });
});

describe('AUCUN plancher de durée au moteur — toute échelle rend ce que la formule dit', () => {
  it('horloge d’une op (`durationMinutes`/`durationHours`) : l’échéance est `now`, pas `now + 1`', () => {
    const c = hero();
    applyOps(c, [{ op: 'charMod', char: 'agilite', mod: -10, durationMinutes: 0 }], { label: 'Écorce', now: 100 });
    expect(c.activeEffects![0].duration).toEqual({ scale: 'clock', until: 100 });
  });

  it('État posé par une op `condition` : 0 Round et échéance nue, en Rounds comme à l’horloge', () => {
    const rounds = hero();
    applyOps(rounds, [{ op: 'condition', id: 'sonne', durationRounds: 0 }], { label: 'Sort' });
    expect(rounds.conditions[0]).toMatchObject({ id: 'sonne', roundsLeft: 0 });

    const horloge = hero();
    applyOps(horloge, [{ op: 'condition', id: 'sonne', durationMinutes: 0 }], { label: 'Sort', now: 100 });
    expect(horloge.conditions[0]).toMatchObject({ id: 'sonne', untilTime: 100 });
  });

  it('`castPenalty` : Rounds, minutes, heures et jours rendent la formule nue', () => {
    const c = hero();
    applyOps(c, [{ op: 'castPenalty', mod: -10, rounds: 0 }], { label: 'Contrecoup' });
    expect(c.castPenalties![0].roundsLeft).toBe(0);
    applyOps(c, [{ op: 'castPenalty', mod: -10, minutes: 0 }], { label: 'Contrecoup', now: 100 });
    expect(c.castPenalties![1].untilTime).toBe(100);
    applyOps(c, [{ op: 'castPenalty', mod: -10, hours: 0 }], { label: 'Contrecoup', now: 100 });
    expect(c.castPenalties![2].untilTime).toBe(100);
    applyOps(c, [{ op: 'castPenalty', mod: -10, days: 0 }], { label: 'Contrecoup', now: 100 });
    expect(c.castPenalties![3].untilTime).toBe(100);
  });
});

describe("op:'wounds' mode COUP D'ARME (S1) — délègue à woundsFromHit (qualités/armure/localisation)", () => {
  const sword = (qualities: { id: string; value?: number }[] = []): Weapon =>
    ({ label: 'Épée', type: 'melee', damage: { flat: 4, plusBF: true }, qualities, reach: 'Moyenne' }) as unknown as Weapon;

  it("weaponHit:true + ctx.weapon → Blessures == woundsFromHit (mêmes BE + PA à la localisation)", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    const w = sword();
    const expected = woundsFromHit(w, c, 'corps', 12, 0, 1, undefined); // 12 − BE(4) − PA(3) = 5
    const before = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 12, weaponHit: true }], { weapon: w, location: 'corps' });
    expect(before - c.wounds.current).toBe(expected);
    expect(expected).toBe(5);
  });

  it("respecte la LOCALISATION du contexte (PA d'une autre localisation)", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 5, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } });
    const w = sword();
    const before = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 12, weaponHit: true }], { weapon: w, location: 'tete' }); // 12 − 4 − 5 = 3
    expect(before - c.wounds.current).toBe(woundsFromHit(w, c, 'tete', 12, 0, 1, undefined));
  });

  it("réutilise les QUALITÉS de l'arme (Perforante) via woundsFromHit — équivalence par construction", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } });
    const w = sword([{ id: 'perforante' }]);
    const before = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 12, weaponHit: true }], { weapon: w, location: 'corps' });
    expect(before - c.wounds.current).toBe(woundsFromHit(w, c, 'corps', 12, 0, 1, undefined));
  });

  it("weaponHit SANS ctx.weapon → repli en mode Formula (défaut : ignore BE+PA)", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    const before = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 12, weaponHit: true }], {}); // pas d'arme → Formula : 12 brut
    expect(before - c.wounds.current).toBe(12);
  });

  it("mode Formula INCHANGÉ (sans weaponHit) : ignore BE+PA par défaut, déduit si flags", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    const b1 = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 10 }], {}); // défaut : 10 brut
    expect(b1 - c.wounds.current).toBe(10);
    const b2 = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 10, ignoreTB: false, ignoreAP: false }], {}); // 10 − BE(4) − PA(3) = 3
    expect(b2 - c.wounds.current).toBe(3);
  });
});

describe('applyOps — opérations unitaires', () => {
  it('wounds : perte directe centralisée (Avantage purgé, À Terre à 0 PB)', () => {
    const c = hero({ advantage: 2, wounds: { current: 3, max: 12 } });
    const lines = applyOps(c, [{ op: 'wounds', amount: 5 }]);
    expect(c.wounds.current).toBe(0);
    expect(c.advantage).toBe(0);
    expect(c.conditions.some((x) => x.id === 'a-terre')).toBe(true);
    expect(lines[0]).toMatch(/subit 5 Blessure/);
  });

  it('wounds extraAP : PA situationnels du coup déduits AVEC les PA de Localisation (poupe/Bélier de collision)', () => {
    // E 45 → BE 4 ; armour.corps 0. Sans extraAP : 10 − 4 = 6 PB perdus ; avec extraAP 2 : 10 − 4 − 2 = 4.
    const a = hero({ wounds: { current: 12, max: 12 } });
    applyOps(a, [{ op: 'wounds', amount: 10, ignoreTB: false, ignoreAP: false }]);
    expect(a.wounds.current).toBe(12 - 6);
    const b = hero({ wounds: { current: 12, max: 12 } });
    applyOps(b, [{ op: 'wounds', amount: 10, ignoreTB: false, ignoreAP: false, extraAP: 2 }]);
    expect(b.wounds.current).toBe(12 - 4); // 2 PB de moins perdus — la mitigation reste DANS l'op
  });

  it('heal : plafonné au max de Blessures', () => {
    const c = hero({ wounds: { current: 10, max: 12 } });
    applyOps(c, [{ op: 'heal', amount: 5 }]);
    expect(c.wounds.current).toBe(12);
  });

  it('heal : munition Empaleuse logée bloque le soin (LDB 62 l.250, plafonné SOURCE UNIQUE `applyHealWounds`)', () => {
    const c = hero({ wounds: { current: 8, max: 12 }, conditions: [{ id: 'munition-logee', value: 1 }] });
    const lines = applyOps(c, [{ op: 'heal', amount: 5 }]);
    expect(c.wounds.current).toBe(11); // 12 − 1 munition logée, pas 13→12
    expect(lines.join(' ')).toMatch(/regagne 3 Blessure/); // libellé porte le montant EFFECTIF (post-plafond), pas les 5 demandés
  });

  it('healCaster : munition Empaleuse logée sur le LANCEUR bloque son propre soin', () => {
    const caster = hero({ id: 'c', wounds: { current: 8, max: 12 }, conditions: [{ id: 'munition-logee', value: 1 }] });
    const target = hero({ id: 't', wounds: { current: 10, max: 12 } });
    applyOps(target, [{ op: 'healCaster', amount: 5 }], { caster });
    expect(caster.wounds.current).toBe(11);
    expect(target.wounds.current).toBe(10); // le lanceur est soigné, pas la cible
  });

  it('lifeSteal : munition Empaleuse logée sur le drainEUR bloque le PV rendu par le vol de vie', () => {
    const drainer = hero({ id: 'd', wounds: { current: 8, max: 12 }, conditions: [{ id: 'munition-logee', value: 1 }] });
    const victim = hero({ id: 'v' });
    const lines = applyOps(victim, [{ op: 'lifeSteal', num: 1, den: 1 }], { caster: drainer, woundsDealt: 6 });
    expect(drainer.wounds.current).toBe(11); // 8+6=14 → plafonné à 12−1=11
    expect(lines.join(' ')).toMatch(/draine 3 Blessure/); // 11−8 = 3 réellement rendues, pas les 6 « dealt »
  });

  it('lifeSteal : sans munition logée, le montant rendu reste inchangé (non-régression)', () => {
    const drainer = hero({ id: 'd', wounds: { current: 2, max: 12 } });
    const victim = hero({ id: 'v' });
    applyOps(victim, [{ op: 'lifeSteal', num: 1, den: 2 }], { caster: drainer, woundsDealt: 6 });
    expect(drainer.wounds.current).toBe(5); // floor(6/2)=3 rendus, plafond sans effet
  });

  it('giveTrapping : crée l’objet dans l’inventaire (réel → stats, échelle au DR)', () => {
    const c = hero({ items: [] });
    // Générosité de Manann : 1 Ration + 1 par +2 DR → à DR 4, 1 + floor(4/2) = 3 Rations.
    applyOps(c, [{ op: 'giveTrapping', custom: 'Ration (1 jour)', perSL: { every: 2, amount: 1 } }], { sl: 4 });
    const rations = (c.items ?? []).filter((it) => /^ration/i.test(it.label));
    expect(rations.length).toBe(3);
  });

  it('giveTrapping : nom inconnu → objet CUSTOM (jamais null, comme l’Effet de scène)', () => {
    const c = hero({ items: [] });
    applyOps(c, [{ op: 'giveTrapping', custom: 'Babiole onirique XYZ' }]);
    expect((c.items ?? []).some((it) => it.label === 'Babiole onirique XYZ')).toBe(true);
  });

  it('grantTrait onlyGroups (Bannissement) : Instable n’atteint que Mort-vivant/Démon', () => {
    const undead = hero({ groups: ['Mort-vivant'] });
    const human = hero({ groups: ['Humain'] });
    const op = { op: 'grantTrait' as const, traitId: 'instable', onlyGroups: ['Mort-vivant', 'Démon'] };
    applyOps(undead, [op]);
    applyOps(human, [op]);
    expect(hasTraitKey(undead.traits, 'instable')).toBe(true);
    expect(hasTraitKey(human.traits, 'instable')).toBe(false); // gate de Groupe : non affecté
  });

  it('condition : ajout avec valeur en formule (Bonus de FM du référent caster)', () => {
    const caster = hero({ id: 'c', label: 'Lanceur', characteristics: { ...hero().characteristics, 'force-mentale': 52 } });
    const c = hero();
    applyOps(c, [{ op: 'condition', id: 'hemorragique', value: { bonusOf: 'force-mentale' } }], { caster });
    expect(c.conditions.find((x) => x.id === 'hemorragique')?.value).toBe(5);
  });

  it('removeCondition sans nom : retire le 1er État porté ; sans État → journal explicite', () => {
    const c = hero({ conditions: [{ id: 'extenue', value: 2 }] });
    const lines = applyOps(c, [{ op: 'removeCondition' }]);
    expect(c.conditions.find((x) => x.id === 'extenue')?.value).toBe(1);
    expect(lines[0]).toMatch(/retire 1 État Exténué/);
    const sain = hero();
    expect(applyOps(sain, [{ op: 'removeCondition' }])[0]).toMatch(/aucun État à retirer/);
  });

  it('charMod : durée du contexte (sort), agrégé en UNE ligne de journal', () => {
    const c = hero();
    const lines = applyOps(
      c,
      [
        { op: 'charMod', char: 'agilite', mod: -10 },
        { op: 'charMod', char: 'dexterite', mod: -10 },
      ],
      { label: 'Écorce', defaultDurationRounds: 6 },
    );
    expect(c.activeEffects).toHaveLength(2);
    expect(c.activeEffects![0]).toMatchObject({ label: 'Écorce', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 6 } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Cobaye : Écorce (-10 Agilité, -10 Dextérité, 6 rounds).');
  });

  it('sourceSpell : marque les ActiveEffect POSÉS du sort (NI/identité), pas les pré-existants (Dissipation LDB 46)', () => {
    const c = hero({ activeEffects: [{ label: 'Vieux buff', char: 'force-mentale', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    const spell = { spellId: 'ecorce', ni: 4, casterId: 'mage-1', label: 'Écorce' };
    applyOps(c, [{ op: 'charMod', char: 'agilite', mod: -10 }], { label: 'Écorce', defaultDurationRounds: 6, sourceSpell: spell });
    const old = c.activeEffects!.find((e) => e.label === 'Vieux buff')!;
    const posed = c.activeEffects!.find((e) => e.char === 'agilite')!;
    expect(old.spell).toBeUndefined(); // pré-existant : non marqué
    expect(posed.spell).toEqual(spell); // posé par CE sort : marqué (identité + NI)
  });

  it('charMod : durée permanente par défaut → « durée hors combat » au journal', () => {
    const c = hero();
    const lines = applyOps(c, [{ op: 'charMod', char: 'endurance', mod: 20 }], { label: 'Armure' });
    expect(c.activeEffects![0].duration).toEqual({ scale: "permanent" });
    expect(lines[0]).toMatch(/durée hors combat/);
  });

  // #125 — Aux Armes « main/bras inutilisable Nd10[-BE] Rounds » (l.2557/2562/2588) : effet TEMPORAIRE,
  // durée intrinsèque à l'entrée de Critique (pas du ctx — la résolution AA n'en porte pas).
  it("maxWeaponHands : durationRounds INLINE → ActiveEffect à durée ROUNDS, indépendant du ctx", () => {
    const c = hero();
    const rng = makeRNG(7);
    applyOps(c, [{ op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }], { rng });
    expect(c.activeEffects).toHaveLength(1);
    const eff = c.activeEffects![0];
    expect(eff.passive).toContainEqual(expect.objectContaining({ op: 'maxWeaponHands', hands: 1 }));
    expect(eff.duration.scale).toBe('rounds');
    if (eff.duration.scale === 'rounds') {
      expect(eff.duration.left).toBeGreaterThanOrEqual(1);
      expect(eff.duration.left).toBeLessThanOrEqual(10);
    }
  });

  it('maxWeaponHands : sans durationRounds → comportement INCHANGÉ (durée du ctx, rétro-compatible)', () => {
    const c = hero();
    applyOps(c, [{ op: 'maxWeaponHands', hands: 1 }], { defaultDurationRounds: 3 });
    expect(c.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 3 });
  });

  it('maxWeaponHands : « 1d10 – (Bonus d’Endurance) Rounds (minimum de 1) » — la borne est DANS la formule (AA 07 l.113)', () => {
    const c = hero({ characteristics: { ...hero().characteristics, endurance: 45 } }); // BE 4
    const rng: RNG = { int: () => 1 }; // 1d10 tiré au plus bas (1) − BE 4 → −3, borné à 1 par `{minimum}`
    applyOps(c, [{
      op: 'maxWeaponHands', hands: 1,
      durationRounds: { minimum: 1, of: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] } },
    }], { rng });
    expect(c.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 1 });
  });

  // #193 — Souffle coupé (LDB 18-Traumatisme) : « Mouvement réduit de moitié pendant 1d10 Rounds »,
  // MÊME patron que maxWeaponHands.durationRounds ci-dessus.
  it("moveScale : durationRounds INLINE → ActiveEffect à durée ROUNDS, indépendant du ctx", () => {
    const c = hero();
    const rng = makeRNG(7);
    applyOps(c, [{ op: 'moveScale', num: 1, den: 2, durationRounds: { dice: { n: 1, sides: 10 } } }], { rng });
    expect(c.activeEffects).toHaveLength(1);
    const eff = c.activeEffects![0];
    expect(eff.passive).toContainEqual(expect.objectContaining({ op: 'moveScale', num: 1, den: 2 }));
    expect(eff.duration.scale).toBe('rounds');
    if (eff.duration.scale === 'rounds') {
      expect(eff.duration.left).toBeGreaterThanOrEqual(1);
      expect(eff.duration.left).toBeLessThanOrEqual(10);
    }
  });

  it('moveScale : sans durationRounds → comportement INCHANGÉ (durée du ctx, rétro-compatible)', () => {
    const c = hero();
    applyOps(c, [{ op: 'moveScale', num: 1, den: 2 }], { defaultDurationRounds: 3 });
    expect(c.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 3 });
  });

  // #193 — Épaule luxée/Genou démis (LDB/AA) : `testMod.weaponHand`/`testMod.movementOnly` (portée MEMBRE
  // d'une pénalité de récupération) sont COPIÉS sur l'ActiveEffect (testModHand/testModMovementOnly),
  // lus par combatValue/defenseValue/testValue (cf. weapon-spec.test.ts pour la consommation).
  it("testMod : weaponHand/movementOnly COPIÉS sur l'ActiveEffect (testModHand/testModMovementOnly)", () => {
    const c = hero();
    applyOps(c, [{ op: 'testMod', char: 'capacite-de-combat', amount: -10, weaponHand: 'main' }], { defaultDurationRounds: 9999 });
    applyOps(c, [{ op: 'testMod', char: 'agilite', amount: -10, movementOnly: true }], { defaultDurationRounds: 9999 });
    expect(c.activeEffects).toHaveLength(2);
    expect(c.activeEffects![0]).toMatchObject({ testMod: -10, testModChar: 'capacite-de-combat', testModHand: 'main' });
    expect(c.activeEffects![0].testModMovementOnly).toBeUndefined();
    expect(c.activeEffects![1]).toMatchObject({ testMod: -10, testModChar: 'agilite', testModMovementOnly: true });
    expect(c.activeEffects![1].testModHand).toBeUndefined();
  });

  // (Un Test imbriqué est un nœud Flow `{kind:'test'}` résolu cadence-aware (héros manuel = jet
  //  influençable, ennemi = inline). Sa résolution + branches + gates sont couvertes par
  //  `state/combat/run-combat-flow.test.ts` et `state/combat/venin-test.test.ts`.)

  // #153 — Aux Armes « −10 Agilité pendant 1d10 jours » (corps « Bleus aux côtes ») : durée d'HORLOGE
  // intrinsèque au charMod (même patron que `condition.durationHours`), résolue depuis `ctx.now`.
  describe('charMod : durationHours/durationMinutes (#153)', () => {
    it('durationHours → ActiveEffect à durée CLOCK (until = ctx.now + heures×60), indépendant de defaultDurationRounds', () => {
      const c = hero();
      applyOps(c, [{ op: 'charMod', char: 'agilite', mod: -10, durationHours: 240 }], { now: 1000, defaultDurationRounds: 3 });
      expect(c.activeEffects).toHaveLength(1);
      expect(c.activeEffects![0].duration).toEqual({ scale: 'clock', until: 1000 + 240 * 60 });
    });

    it('durationHours en Formula (1d10 × 24, « 1d10 jours ») résolue au seed', () => {
      const c = hero();
      const rng: RNG = { int: () => 1 }; // 1d10 au plus bas → 1 jour = 24 h = 1440 min
      applyOps(c, [{ op: 'charMod', char: 'agilite', mod: -10, durationHours: { times: { of: { dice: { n: 1, sides: 10 } }, factor: 24 } } }], { now: 0, rng });
      expect(c.activeEffects![0].duration).toEqual({ scale: 'clock', until: 1440 });
    });

    it('sans durationRounds/durationHours → comportement INCHANGÉ (durée du ctx)', () => {
      const c = hero();
      applyOps(c, [{ op: 'charMod', char: 'agilite', mod: -10 }], { defaultDurationRounds: 5 });
      expect(c.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 5 });
    });
  });

  // #153 — Aux Armes « Vous lâchez ce que vous teniez dans cette main » (bras/corps) : op `disarm`.
  describe("op disarm (#153 — « lâche l'objet tenu »)", () => {
    const withWeapon = (): Combatant => {
      const c = hero({ items: [{ uid: 'w1', label: 'Épée', kind: 'melee', equipped: true, qualities: [], enc: 1 } as never] });
      c.loadouts = [{ id: 'l1', main: 'w1' }];
      c.activeLoadoutId = 'l1';
      recomputeLoadout(c);
      return c;
    };

    it("ctx.location='brasD' (convention DROITIER) → lâche l'arme tenue en MAIN (loadout.main vidé)", () => {
      const c = withWeapon();
      const lines = applyOps(c, [{ op: 'disarm' }], { location: 'brasD' });
      expect(c.loadouts![0].main).toBeUndefined();
      expect(lines[0]).toMatch(/Épée/);
    });

    it("ctx.location='brasG' → cible la main SECONDAIRE (off), la MAIN n'est pas touchée", () => {
      const c = withWeapon();
      applyOps(c, [{ op: 'disarm' }], { location: 'brasG' });
      expect(c.loadouts![0].main).toBe('w1'); // rien tenu en `off` → inerte, l'arme MAIN reste
    });

    it('aucun objet tenu dans cette main → inerte, journalisé (ne plante pas)', () => {
      const c = hero();
      const lines = applyOps(c, [{ op: 'disarm' }], { location: 'brasD' });
      expect(lines[0]).toMatch(/ne tenait rien/);
    });

    it("localisation 'corps' (« au hasard l'un de vos deux bras ») → tirage aléatoire via ctx.rng", () => {
      const c = withWeapon();
      const rngMain: RNG = { int: () => 0 }; // pioche 'main'
      applyOps(c, [{ op: 'disarm' }], { location: 'corps', rng: rngMain });
      expect(c.loadouts![0].main).toBeUndefined();
    });

    // #476 — Poing de fer ogre (ADE II 02 l.694-698) : capacité `disarmImmune` (`ItemCapabilities`).
    it("capacité disarmImmune (Poing de fer, ADE II 02 l.694-698) → refuse le désarmement, l'arme reste tenue", () => {
      const c = hero({ items: [{ uid: 'w1', trappingId: 'poing-de-fer', label: 'Poing de fer', kind: 'melee', equipped: true, qualities: [], enc: 2 } as never] });
      c.loadouts = [{ id: 'l1', main: 'w1' }];
      c.activeLoadoutId = 'l1';
      recomputeLoadout(c);
      const lines = applyOps(c, [{ op: 'disarm' }], { location: 'brasD' });
      expect(c.loadouts![0].main).toBe('w1'); // toujours tenu
      expect(lines[0]).toMatch(/impossible de le désarmer/);
    });

    // L'op `disarm` est l'entrée DONNÉE de `items.lacherLArme` : l'arme TENUE se lit dans `c.weapons`.
    it('statbloc (armes sans objet) : l’épée quitte les mains, les Mains nues la remplacent, le journal la nomme', () => {
      const c = hero({ kind: 'enemy', items: [], weapons: [{ uid: 'sb-epee', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as Weapon] });
      const lines = applyOps(c, [{ op: 'disarm' }], { location: 'brasD' });
      expect(c.weapons.map(isUnarmed)).toEqual([true]);
      expect(lines[0]).toMatch(/lâche Épée/);
    });

    it('héros à DEUX sets tenant la même lame : aucun set ne la référence plus, elle reste lâchée après recomputeLoadout', () => {
      const c = hero({ items: [{ ...itemFromTrappingById('arme-simple')!, uid: 'w1', equipped: true }] });
      c.loadouts = [{ id: 'l1', main: 'w1' }, { id: 'l2', main: 'w1' }];
      c.activeLoadoutId = 'l1';
      recomputeLoadout(c);
      applyOps(c, [{ op: 'disarm' }], { location: 'brasD' });
      expect(c.loadouts!.map((lo) => lo.main)).toEqual([undefined, undefined]);
      c.activeLoadoutId = 'l2';
      recomputeLoadout(c);
      expect(c.weapons.some((w) => w.uid === 'w1')).toBe(false);
      expect(c.items!.some((i) => i.uid === 'w1'), 'la lame reste dans l’inventaire').toBe(true);
    });

    it('héros à Crochet seul (arme DÉRIVÉE de l’objet porté) : rien n’est lâché, le Crochet reste en main', () => {
      const c = hero({ items: [{ ...itemFromTrappingById('crochet')!, uid: 'crochet-1', equipped: true }] });
      recomputeLoadout(c);
      expect(c.weapons.some((w) => w.label === 'Crochet')).toBe(true);
      const lines = applyOps(c, [{ op: 'disarm' }], { location: 'brasD' });
      expect(lines.some((l) => /lâche Crochet/.test(l)), lines.join(' | ')).toBe(false);
      recomputeLoadout(c);
      expect(c.weapons.some((w) => w.label === 'Crochet')).toBe(true);
    });

    // `criticals.json` « Vous lâchez immédiatement ce que vous teniez dans la main correspondante ».
    it('arme à DEUX mains (Hallebarde) : un Critique sur brasG la fait lâcher', () => {
      const c = hero({ items: [{ ...itemFromTrappingById('hallebarde')!, uid: 'h1', equipped: true }] });
      c.loadouts = [{ id: 'l1', main: 'h1' }];
      c.activeLoadoutId = 'l1';
      recomputeLoadout(c);
      expect(c.weapons.find((w) => w.uid === 'h1')?.hands).toBe(2);
      const lines = applyOps(c, [{ op: 'disarm' }], { location: 'brasG' });
      expect(lines[0]).toMatch(/lâche Hallebarde/);
      expect(c.weapons.some((w) => w.uid === 'h1')).toBe(false);
    });

    it('une arme ORDINAIRE (sans disarmImmune) reste désarmable normalement', () => {
      const c = withWeapon();
      const lines = applyOps(c, [{ op: 'disarm' }], { location: 'brasD' });
      expect(c.loadouts![0].main).toBeUndefined();
      expect(lines[0]).toMatch(/lâche/);
    });
  });

  it('reduceToZero seul : PB à 0, SANS Inconscient automatique (LDB 40)', () => {
    const c = hero();
    applyOps(c, [{ op: 'reduceToZero' }]);
    expect(c.wounds.current).toBe(0);
    expect(c.conditions.some((x) => x.id === 'inconscient')).toBe(false);
  });

  it('reduceToZero + condition inconscient : Châtiment (LDB 40 l.79)', () => {
    const c = hero();
    applyOps(c, [{ op: 'reduceToZero' }, { op: 'condition', id: 'inconscient' }]);
    expect(c.wounds.current).toBe(0);
    expect(c.conditions.some((x) => x.id === 'inconscient')).toBe(true);
  });

  it('reduceToZero + condition en-flammes : Tonnerre et foudre (LDB 40 l.84)', () => {
    const c = hero();
    applyOps(c, [{ op: 'reduceToZero' }, { op: 'condition', id: 'en-flammes', value: 1 }]);
    expect(c.wounds.current).toBe(0);
    expect(c.conditions.some((x) => x.id === 'en-flammes')).toBe(true);
    expect(c.conditions.some((x) => x.id === 'inconscient')).toBe(false);
  });

  describe('kill — mort directe hors Critique (Toxine, LDB 20 l.215)', () => {
    it('sans Destin : la cible meurt', () => {
      const c = hero({ fate: 0 });
      applyOps(c, [{ op: 'kill' }]);
      expect(c.dead).toBe(true);
    });

    it('avec Destin (LDB 17 l.29-37 : « éviter une mort certaine ») : 1 Point sacrifié, la cible survit', () => {
      const c = hero({ fate: 1, wounds: { current: 0, max: 12 } });
      applyOps(c, [{ op: 'kill' }]);
      expect(c.dead).toBeFalsy();
      expect(c.fate).toBe(0);
      expect(c.wounds.current).toBe(1);
    });
  });
});

describe('applyActiveEffect — non-cumul (LDB 16 l.13)', () => {
  it('meilleur bonus conservé, pire pénalité conservée, bonus+pénalité coexistent', () => {
    const c = hero();
    applyActiveEffect(c, { label: 'A', char: 'force-mentale', bonus: 10, duration: { scale: 'rounds', left: 3 } });
    applyActiveEffect(c, { label: 'B', char: 'force-mentale', bonus: 20, duration: { scale: 'rounds', left: 2 } });
    applyActiveEffect(c, { label: 'C', char: 'force-mentale', bonus: 5, duration: { scale: 'rounds', left: 9 } });
    applyActiveEffect(c, { label: 'D', char: 'force-mentale', bonus: -10, duration: { scale: 'rounds', left: 1 } });
    const fm = c.activeEffects!.filter((e) => e.char === 'force-mentale');
    expect(fm).toHaveLength(2); // un bonus (le meilleur : B +20) + une pénalité (D -10)
    expect(fm.find((e) => e.bonus > 0)).toMatchObject({ label: 'B', bonus: 20 });
    expect(fm.find((e) => e.bonus < 0)).toMatchObject({ label: 'D', bonus: -10 });
  });

  it('buff de F/E/FM recale les Blessures max (LDB 85)', () => {
    const c = hero({ wounds: { current: 10, max: 12, base: 12 } });
    applyActiveEffect(c, { label: 'Vigueur', char: 'endurance', bonus: 10, duration: { scale: 'rounds', left: 6 } });
    expect(c.wounds.max).toBeGreaterThan(12); // E 45→55 : BE 4→5 → +2 PB (2×BE)
  });
});

describe("op:'grantPsychTrait' / op:'removePsychTrait' — Traits psychologiques (c.psychTraits)", () => {
  it("grantPsychTrait pose le Trait dans c.psychTraits (type + cible)", () => {
    const c = hero({ psychTraits: [] });
    applyOps(c, [{ op: 'grantPsychTrait', psychType: 'phobie', cible: 'Araignées' }]);
    expect(c.psychTraits).toEqual([{ type: 'phobie', cible: 'Araignées' }]);
  });
  it("grantPsychTrait sans cible (Frénésie)", () => {
    const c = hero({ psychTraits: [] });
    applyOps(c, [{ op: 'grantPsychTrait', psychType: 'frenesie' }]);
    expect(c.psychTraits).toEqual([{ type: 'frenesie' }]);
  });
  it("grantPsychTrait porte la PROVENANCE de l'effet, comme l'op grantTrait (#1853)", () => {
    const c = hero({ psychTraits: [] });
    applyOps(c, [{ op: 'grantPsychTrait', psychType: 'frenesie' }], { label: 'Colère', source: { kind: 'spell', id: 'colere' } });
    expect(c.psychTraits).toEqual([{ type: 'frenesie', src: { kind: 'spell', id: 'colere' } }]);
  });
  it("removePsychTrait { psychType } retire le Trait correspondant (laisse les autres)", () => {
    const c = hero({ psychTraits: [{ type: 'phobie', cible: 'Araignées' }, { type: 'haine', cible: 'Skavens' }] });
    applyOps(c, [{ op: 'removePsychTrait', psychType: 'phobie' }]);
    expect(c.psychTraits).toEqual([{ type: 'haine', cible: 'Skavens' }]);
  });
  it("removePsychTrait sans type retire UN Trait au choix (le 1er) ; aucun → inerte", () => {
    const c = hero({ psychTraits: [{ type: 'animosite', cible: 'Elfes' }] });
    applyOps(c, [{ op: 'removePsychTrait' }]);
    expect(c.psychTraits).toEqual([]);
    expect(() => applyOps(c, [{ op: 'removePsychTrait' }])).not.toThrow();
    expect(c.psychTraits).toEqual([]);
  });
});

describe("op:'sinMod' — Points de Péché ± (LDB 40 l.36 ; ACE Annexe I « Pénitence »)", () => {
  it('ajoute et retire, plancher 0, delta réel journalisé', () => {
    const c = hero({ sinPoints: 1 });
    applyOps(c, [{ op: 'sinMod', amount: 2 }]);
    expect(c.sinPoints).toBe(3);
    applyOps(c, [{ op: 'sinMod', amount: -1 }]);
    expect(c.sinPoints).toBe(2);
    applyOps(c, [{ op: 'sinMod', amount: -5 }]); // « enlevez … » ne descend jamais sous 0
    expect(c.sinPoints).toBe(0);
    const lines = applyOps(c, [{ op: 'sinMod', amount: -1 }]); // à 0 : inerte (delta 0)
    expect(c.sinPoints).toBe(0);
    expect(lines).toHaveLength(1);
  });
});

describe("op:'corruptionExposure' — Exposition différée (LDB 19 l.23-75)", () => {
  it('avec ctx.onCorruptionExposure : le hook reçoit niveau + compétence (Test par modale côté state)', () => {
    const c = hero();
    const seen: unknown[] = [];
    const lines = applyOps(c, [{ op: 'corruptionExposure', level: 'mineure', skill: { id: 'resistance' } }], {
      onCorruptionExposure: (level, skill) => { seen.push([level, skill]); return ['ouvert']; },
    });
    expect(seen).toEqual([['mineure', { id: 'resistance' }]]);
    expect(lines).toEqual(['ouvert']);
    expect(c.corruption ?? 0).toBe(0); // rien de tiré en silence : le Test vit dans la modale
  });
  it('sans contexte (moteur pur) : journalisée inerte, aucune Corruption ajoutée', () => {
    const c = hero();
    const lines = applyOps(c, [{ op: 'corruptionExposure', level: 'moderee' }]);
    expect(lines).toHaveLength(1);
    expect(c.corruption ?? 0).toBe(0);
  });
});

describe("op:'corruption' amount négatif — Absolution (LDB 19 l.167-182, #97 reliquat 3)", () => {
  it('décrément direct plancher 0, sans passer par ctx.onCorruption (aucun seuil/mutation déclenché)', () => {
    const c = hero({ corruption: 3 });
    let onCorruptionCalls = 0;
    const lines = applyOps(c, [{ op: 'corruption', amount: -2 }], {
      onCorruption: () => { onCorruptionCalls++; return ['ne devrait jamais apparaître']; },
    });
    expect(c.corruption).toBe(1);
    expect(onCorruptionCalls).toBe(0);
    expect(lines).toEqual(['Cobaye : -2 Point(s) de Corruption (total 1).']);
  });

  it('plancher 0 : jamais négatif même si amount dépasse le total courant', () => {
    const c = hero({ corruption: 1 });
    const lines = applyOps(c, [{ op: 'corruption', amount: -5 }]);
    expect(c.corruption).toBe(0);
    expect(lines).toEqual(['Cobaye : -1 Point(s) de Corruption (total 0).']);
  });

  it('amount positif inchangé (non-régression) : passe par ctx.onCorruption quand fourni', () => {
    const c = hero();
    const seen: number[] = [];
    applyOps(c, [{ op: 'corruption', amount: 2 }], {
      onCorruption: (n) => { seen.push(n); return ['gain']; },
    });
    expect(seen).toEqual([2]);
    expect(c.corruption ?? 0).toBe(0); // le hook gère le total lui-même (store) — non simulé ici
  });
});

describe("op:'rollTable' — tirage sur table par fourchette (findTableEntry, source unique)", () => {
  // Table jouet : d10 → ops de la rangée touchée (min/max), avec ops IMBRIQUÉES appliquées au même ctx.
  const table = (extra: Partial<Extract<import('./ops').GameOp, { op: 'rollTable' }>> = {}) => ({
    op: 'rollTable' as const, die: 'd10' as const,
    rows: [
      { min: 1, max: 2, ops: [{ op: 'charDamage' as const, char: 'initiative' as const, amount: { dice: { n: 1, sides: 10 } } }] },
      { min: 3, max: 8, ops: [{ op: 'condition' as const, id: 'sonne' }] },
      { min: 9, max: 9, ops: [{ op: 'grantTrait' as const, traitId: 'nerveux' }] },
      { min: 10, max: 99, ops: [{ op: 'kill' as const }] },
    ],
    ...extra,
  });

  it('rangée bornée : d10=1 → charDamage Initiative (ops imbriquées appliquées, RNG déterministe)', () => {
    const c = hero(); // Initiative 30
    // rng : 1er int = d10 (1 → rangée 1-2), 2e int = dé de charDamage (7).
    const rng: RNG = { int: (() => { const v = [1, 7]; let i = 0; return () => v[i++]; })() };
    applyOps(c, [table()], { rng });
    expect(c.characteristics.initiative).toBe(23); // 30 − 7, perte permanente de la base
  });

  it('addNegativeSL : |DR négatif| ajouté au jet → décale la rangée touchée', () => {
    const c = hero();
    // d10=5, sl=-4 → 5+4=9 → rangée 9 (grantTrait nerveux).
    const rng: RNG = { int: () => 5 };
    applyOps(c, [table({ addNegativeSL: true })], { rng, sl: -4 });
    expect((c.traits ?? []).some((tr) => tr.id === 'nerveux')).toBe(true);
  });

  it('mod : modificateur CONSTANT ajouté au jet (Haute Alchimie « 1d10 + 3 », VDM 03 l.698)', () => {
    const c = hero();
    // d10=5, mod=3 → 5+3=8 → rangée 3-8 (condition sonné), PAS la rangée 9 (nerveux).
    const rng: RNG = { int: () => 5 };
    applyOps(c, [table({ mod: 3 })], { rng });
    expect(c.conditions.find((x) => x.id === 'sonne')?.value).toBe(1);
    expect((c.traits ?? []).some((tr) => tr.id === 'nerveux')).toBe(false);
  });

  it('mod + addNegativeSL : les deux modificateurs se CUMULENT (jamais l\'un ne remplace l\'autre)', () => {
    const c = hero();
    // d10=5, mod=3, sl=-2 → 5+3+2=10 → rangée 10-99 (kill), au-delà de la rangée 9 que mod SEUL atteindrait.
    const rng: RNG = { int: () => 5 };
    applyOps(c, [table({ mod: 3, addNegativeSL: true })], { rng, sl: -2 });
    expect(c.dead).toBe(true);
  });

  it('rangée « Mort » (kill) : au-delà de la table → repli dernière rangée (findTableEntry)', () => {
    const c = hero(); // pas de Destin → mort sèche
    const rng: RNG = { int: () => 10 };
    applyOps(c, [table()], { rng });
    expect(c.dead).toBe(true);
  });

  it('rangée « sonne » (État) : d10=5 → condition Sonné posée', () => {
    const c = hero();
    const rng: RNG = { int: () => 5 };
    applyOps(c, [table()], { rng });
    expect(c.conditions.find((x) => x.id === 'sonne')?.value).toBe(1);
  });
});

describe("op:'charDamage' — perte PERMANENTE de Caractéristique (jamais sous 0)", () => {
  it('décrémente la BASE (pas un effet actif temporisé) et suit les PB max via refreshWounds', () => {
    const c = hero({ characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 45, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 38, sociabilite: 30 } });
    applyOps(c, [{ op: 'charDamage', char: 'sociabilite', amount: 5 }], { rng: makeRNG(1) });
    expect(c.characteristics.sociabilite).toBe(25);
    expect((c.activeEffects ?? []).length).toBe(0); // permanent, pas d'ActiveEffect
  });
  it('plancher 0 : une perte supérieure à la base clampe à 0', () => {
    const c = hero({ characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 45, initiative: 3, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 38, sociabilite: 30 } });
    applyOps(c, [{ op: 'charDamage', char: 'initiative', amount: 10 }], { rng: makeRNG(1) });
    expect(c.characteristics.initiative).toBe(0);
  });
});

describe('op `gainResource` — un `amount` NÉGATIF retire (Dague voleuse de chance, VDM 12 l.833)', () => {
  it('retire 1 Point de Chance', () => {
    const c = hero({ fortune: 2 });
    applyOps(c, [{ op: 'gainResource', resource: 'fortune', amount: -1 }], { rng: makeRNG(1) });
    expect(c.fortune).toBe(1);
  });
  it('le retrait est JOURNALISÉ avec le nombre RETIRÉ (jamais un no-op silencieux)', () => {
    const c = hero({ fortune: 2 });
    const lines = applyOps(c, [{ op: 'gainResource', resource: 'fortune', amount: -1 }], { rng: makeRNG(1) });
    expect(lines.join(' ')).toContain('−1 Point de Chance');
    expect(lines.join(' ')).toContain('(total 1)');
  });
  it('le PLANCHER est celui du compteur, pas de l’argument : 0 − 1 → 0, et RIEN n’est journalisé', () => {
    const c = hero({ fortune: 0 });
    const lines = applyOps(c, [{ op: 'gainResource', resource: 'fortune', amount: -1 }], { rng: makeRNG(1) });
    expect(c.fortune).toBe(0);
    expect(lines).toEqual([]);
  });
  it('Destin suit la même règle', () => {
    const c = hero({ fate: 3 });
    applyOps(c, [{ op: 'gainResource', resource: 'fate', amount: -2 }], { rng: makeRNG(1) });
    expect(c.fate).toBe(1);
  });
  it('un octroi `temporary` NÉGATIF ne pose aucun effet actif à rendre', () => {
    const c = hero({ fortune: 2 });
    applyOps(c, [{ op: 'gainResource', resource: 'fortune', amount: -1, temporary: true }], { rng: makeRNG(1) });
    expect((c.activeEffects ?? []).length).toBe(0);
  });
  it('l’octroi positif est intact', () => {
    const c = hero({ fortune: 1 });
    applyOps(c, [{ op: 'gainResource', resource: 'fortune', amount: 2 }], { rng: makeRNG(1) });
    expect(c.fortune).toBe(3);
  });
});

describe('OpsCtx.surLigne — les lignes d’une application, par rang d’op', () => {
  const cible = (): Combatant => ({ id: 't', label: 'Cible', kind: 'enemy', characteristics: { agilite: 40, endurance: 30 }, wounds: { current: 10, max: 10 }, conditions: [], skills: [], talents: [], traits: [], activeEffects: [], weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);
  const ops = [
    { op: 'wounds', amount: 2, ignoreTB: true, ignoreAP: true },
    { op: 'charMod', char: 'agilite', mod: -10, durationRounds: 3 },
    { op: 'charMod', char: 'endurance', mod: -10, durationRounds: 3 },
    { op: 'condition', id: 'sonne', value: 1 },
  ] as never[];

  it('chaque ligne arrive avec son rang ; la ligne agrégée des charMod va au dernier de la suite', () => {
    const recues: [number | null, string][] = [];
    const lignes = applyOps(cible(), ops, { rng: makeRNG(1), surLigne: (rang, l) => { recues.push([rang, l]); } });
    expect(recues.map(([rang]) => rang)).toEqual([0, 2, 3]);
    expect(recues.map(([, l]) => l)).toEqual(lignes);
    expect(recues[2][1]).toBe('Cible reçoit 1 État Sonné.');
  });

  it('une op IMBRIQUÉE rend ses lignes à l’op qui la porte, une seule fois', () => {
    const recues: [number | null, string][] = [];
    const lignes = applyOps(cible(), [{ op: 'transform', tag: 'forme', ops: [{ op: 'condition', id: 'sonne', value: 1 }] }] as never[], { rng: makeRNG(1), surLigne: (rang, l) => { recues.push([rang, l]); } });
    expect(lignes).toEqual(['Cible reçoit 1 État Sonné.', 'Cible se métamorphose (forme).']);
    expect(recues).toEqual([[0, 'Cible reçoit 1 État Sonné.'], [0, 'Cible se métamorphose (forme).']]);
  });
});

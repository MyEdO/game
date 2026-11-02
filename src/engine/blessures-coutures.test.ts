import { describe, it, expect, afterEach } from 'vitest';
import { applyActiveEffect, applyOps, type OpPassive } from './ops';
import { endOfRound, removeActiveEffects } from './conditions';
import type { ActiveEffect, Combatant } from './types';
import { resetData } from '../data/overrides';
import { blesseDeTest, combattantDeTest, blessuresSurLeProfil } from './combattantDeTest.testkit';
import { PORTEURS } from './porteursDePassifs.testkit';
import { desDuTest } from './dice.testkit';
import { blessuresPosees, blessuresReconciliees } from './characteristics';

/**
 * Le maximum des Blessures suit ses porteurs (LDB 05 l.1001, LDB 48 l.23) aux coutures du moteur : fin
 * d'`applyOps`, `applyActiveEffect`, `removeActiveEffects`, toutes par `blessuresReconciliees` ; les
 * Points perdus demeurent, plancher 0 (LDB 48 l.27).
 */

const PLUS_3: OpPassive[] = [{ op: 'attrMod', attr: 'wounds', mod: 3 }];

/** Profil à 30 partout : B = 3 + 2×3 + 3 = 12 ; blessé de 2. */
const blesse = (): Combatant => blesseDeTest(10, { kind: 'hero' });

const effet = (over: Partial<ActiveEffect>): ActiveEffect => ({ label: 'Effet de test', bonus: 0, duration: { scale: 'permanent' }, ...over });

afterEach(() => resetData());

describe('fin d’`applyOps` : tout porteur écrit avant l’application y est réconcilié', () => {
  it.each(PORTEURS)('%s : posé, +3 au maximum et au courant ; retiré, rendu ; rejoué, rien ne bouge', (_, champ, poser) => {
    const c = blesse();
    const avant = c[champ];
    poser(c, PLUS_3);
    applyOps(c, [], { rng: desDuTest });
    expect(c.wounds).toMatchObject({ max: 15, current: 13 });
    const reconcilie = c.wounds;
    applyOps(c, [], { rng: desDuTest });
    expect(c.wounds).toBe(reconcilie);
    Object.assign(c, { [champ]: avant });
    applyOps(c, [], { rng: desDuTest });
    expect(c.wounds).toMatchObject({ max: 12, current: 10 });
  });

  it('une op exécutée qui pose un porteur (`attrMod` de Blessures) : le maximum suit dans la même application', () => {
    const c = blesse();
    applyOps(c, [{ op: 'attrMod', attr: 'wounds', mod: 3 }], { rng: desDuTest, label: 'Source', defaultDurationRounds: 1 });
    expect(c.wounds).toMatchObject({ max: 15, current: 13 });
  });
});

describe('`applyActiveEffect` et `removeActiveEffects`', () => {
  it.each([
    ['Blessures plates', effet({ attrMods: { wounds: 3 } }), 3],
    ['Endurance +10 (BE 4)', effet({ char: 'endurance', bonus: 10 }), 2],
    ['passif porté', effet({ passive: PLUS_3 }), 3],
  ] as const)('%s : la pose déplace le maximum et le courant, le retrait les rend', (_, e, n) => {
    const c = blesse();
    applyActiveEffect(c, { ...e });
    expect(c.wounds).toMatchObject({ max: 12 + n, current: 10 + n });
    removeActiveEffects(c, () => true);
    expect(c.wounds).toMatchObject({ max: 12, current: 10 });
  });

  it('le courant suit le delta, plancher 0', () => {
    const c = blesse();
    applyActiveEffect(c, effet({ attrMods: { wounds: -3 } }));
    expect(c.wounds).toMatchObject({ max: 9, current: 7 });
    c.wounds = { ...c.wounds, current: 2 };
    removeActiveEffects(c, () => true);
    expect(c.wounds).toMatchObject({ max: 12, current: 5 });
    applyActiveEffect(c, effet({ attrMods: { wounds: -6 } }));
    expect(c.wounds).toMatchObject({ max: 6, current: 0 });
  });

  it('l’expiration d’une durée en Rounds (`endOfRound`) rend le maximum à la frontière de Round', () => {
    const c = blesse();
    applyActiveEffect(c, effet({ attrMods: { wounds: 3 }, duration: { scale: 'rounds', left: 1 } }));
    expect(c.wounds.max).toBe(15);
    endOfRound(c, desDuTest);
    expect(c.wounds).toMatchObject({ max: 12, current: 10 });
  });
});

describe('le maximum suit le profil courant : Talent, Caractéristique, Trait (LDB 05 l.1001, LDB 85)', () => {
  /** E 35 (BE 3) : B = 3 + 2×3 + 3 = 12, à 12/12. */
  const heros = (): Combatant => combattantDeTest({ kind: 'hero', characteristics: { endurance: 35 } });

  it('Talent acquis par une op (`grantTalent` Très résistant, E 35 → 40) : 12 → 14, le courant suit', () => {
    const c = heros();
    applyOps(c, [{ op: 'grantTalent', talent: { id: 'tres-resistant' } }], { rng: desDuTest });
    expect(c.wounds).toMatchObject({ max: 14, current: 14 });
  });

  it('Augmentation d’Endurance écrite au profil : le maximum suit à la couture', () => {
    const c = blesse();
    c.characteristics.endurance = 40;
    applyOps(c, [], { rng: desDuTest });
    expect(c.wounds).toMatchObject({ max: 14, current: 12 });
  });

  it('Dégâts de Caractéristique (`charDamage` E −20, E 35 → 15) : 12 → 8', () => {
    const c = heros();
    applyOps(c, [{ op: 'charDamage', char: 'endurance', amount: 20 }], { rng: desDuTest });
    expect(c.wounds).toMatchObject({ max: 8, current: 8 });
  });

  it('Trait Coriace appliqué (`liveTraits`, +10 E et FM) : 12 → 15', () => {
    const c = heros();
    c.liveTraits = [{ id: 'coriace' }];
    applyOps(c, [], { rng: desDuTest });
    expect(c.wounds).toMatchObject({ max: 15, current: 15 });
  });
});

describe('la part perdue sous 0 s’éteint dès que le courant remonte au-dessus de 0 (LDB 48 l.27)', () => {
  /** 1/12 ; la baisse du maximum le porte à 0 ; soigné à 2 puis frappé à 0 ; la baisse prend fin. */
  const soigneEtFrappe = (c: Combatant) => {
    applyOps(c, [{ op: 'heal', amount: 2 }], { rng: desDuTest });
    expect(c.wounds).toEqual({ current: 2, max: c.wounds.max, ecart: 0 });
    applyOps(c, [{ op: 'wounds', amount: 5 }], { rng: desDuTest });
    expect(c.wounds).toEqual({ current: 0, max: c.wounds.max, ecart: 0 });
  };

  it('transformation −6 : 0/6, soigné à 2, frappé à 0, sa fin rend 6/12 et non 1/12', () => {
    const c = blesseDeTest(1, { kind: 'hero' });
    applyActiveEffect(c, effet({ attrMods: { wounds: -6 } }));
    expect(c.wounds).toEqual({ current: 0, max: 6, ecart: 0, perduesSousZero: 5 });
    soigneEtFrappe(c);
    removeActiveEffects(c, () => true);
    expect(c.wounds).toEqual({ current: 6, max: 12, ecart: 0 });
  });

  it('effet E −20 (BE 1) : 0/8, soigné à 2, frappé à 0, son expiration en fin de Round rend 4/12', () => {
    const c = blesseDeTest(1, { kind: 'hero' });
    applyActiveEffect(c, effet({ char: 'endurance', bonus: -20, duration: { scale: 'rounds', left: 1 } }));
    expect(c.wounds).toEqual({ current: 0, max: 8, ecart: 0, perduesSousZero: 3 });
    soigneEtFrappe(c);
    endOfRound(c, desDuTest);
    expect(c.wounds).toEqual({ current: 4, max: 12, ecart: 0 });
  });
});

describe('`blessuresReconciliees` : rien de neuf quand le maximum calculé est le courant (`Object.is`)', () => {
  it('un maximum NaN (profil incomplet) se rend tel quel, sans être masqué : la réconciliation ne se rejoue pas', () => {
    const c = combattantDeTest({ characteristics: { endurance: Number.NaN } });
    expect(c.wounds.max).toBeNaN();
    expect(blessuresReconciliees(c)).toBe(c.wounds);
  });
});

describe('le maximum ne s’écrit que par ses fabriques (#1463)', () => {
  it('un nombre posé à la main n’est pas un maximum : ni au littéral, ni à l’affectation', () => {
    const c = blesse();
    // @ts-expect-error — un maximum se forge par ses fabriques (`blessuresPosees`, `blessuresReconciliees`)
    const forge: Combatant['wounds'] = { ...c.wounds, max: 99 };
    // @ts-expect-error — `max` est en lecture seule
    c.wounds.max = 99;
    expect([forge.max, c.wounds.max]).toEqual([99, 99]);
  });

  it('`blessuresPosees` pose un B imprimé sur le profil : l’écart est figé, un porteur s’y ajoute à la couture', () => {
    const sansBlessures = combattantDeTest();
    const c = blessuresSurLeProfil({ ...sansBlessures, wounds: blessuresPosees(sansBlessures, 99, 90) });
    expect(c.wounds).toEqual({ current: 90, max: 99, ecart: 87 });
    applyActiveEffect(c, effet({ attrMods: { wounds: 3 } }));
    expect(c.wounds).toEqual({ current: 93, max: 102, ecart: 87 });
  });
});

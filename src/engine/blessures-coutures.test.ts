import { describe, it, expect, afterEach } from 'vitest';
import { applyActiveEffect, applyOps, type OpPassive } from './ops';
import { endOfRound, removeActiveEffects } from './conditions';
import { recalerLaBaseDesBlessures } from './talentEffects';
import type { ActiveEffect, Combatant } from './types';
import { resetData } from '../data/overrides';
import { combattantDeTest } from './combattantDeTest.testkit';
import { PORTEURS_HORS_TALENT } from './porteursDePassifs.testkit';
import { desDuTest } from './dice.testkit';

/**
 * Le maximum des Blessures suit ses porteurs (LDB 05 l.1001, LDB 48 l.23) aux coutures du moteur : fin
 * d'`applyOps`, `applyActiveEffect`, `removeActiveEffects`, toutes par `blessuresReconciliees` ; le
 * courant suit le delta, plancher 0 (LDB 48 l.27).
 */

const PLUS_3: OpPassive[] = [{ op: 'attrMod', attr: 'wounds', mod: 3 }];

/** Profil à 30 partout : B = 3 + 2×3 + 3 = 12 ; blessé de 2. */
const blesse = (): Combatant => combattantDeTest({ kind: 'hero', wounds: { current: 10, max: 12, base: 12 } });

const effet = (over: Partial<ActiveEffect>): ActiveEffect => ({ label: 'Effet de test', bonus: 0, duration: { scale: 'permanent' }, ...over });

afterEach(() => resetData());

describe('fin d’`applyOps` : tout porteur écrit avant l’application y est réconcilié', () => {
  it.each(PORTEURS_HORS_TALENT)('%s : posé, +3 au maximum et au courant ; retiré, rendu ; rejoué, rien ne bouge', (_, champ, poser) => {
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

describe('`recalerLaBaseDesBlessures` (Augmentation, Talent acquis — LDB 05 l.1001)', () => {
  it('la base reprend la formule, les porteurs restent comptés au maximum, le courant suit le gain', () => {
    const c = blesse();
    const [, , poser] = PORTEURS_HORS_TALENT[0];
    poser(c, PLUS_3);
    applyOps(c, [], { rng: desDuTest });
    expect(c.wounds).toMatchObject({ max: 15, current: 13 });
    c.characteristics.endurance = 40;
    recalerLaBaseDesBlessures(c);
    expect(c.wounds).toEqual({ base: 14, max: 17, current: 15 });
  });
});

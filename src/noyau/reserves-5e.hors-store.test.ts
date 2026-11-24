/**
 * Réserves d'un héros 5e : la Résilience se lit sur le Destin, la Détermination sur la Fortune, la perte permanente
 * d'un Point de Résilience retire 1 à la Fortune maximale ; la Fortune revient à son maximum en début de séance.
 * CRB 116 l.36 ; CRB 025 l.15 ; CRB 008 l.71 ; LDB 17 l.7, l.53-81
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { stacks } from '../engine/conditions';
import { restoreFortune } from '../engine/fortune';
import { regainDetermination } from '../engine/session';
import { applyActiveEffect } from '../engine/effetsActifs';
import { fortuneMax, resolveMax, maximaDesReserves, reporterLaHausseDesMaxima, reservesPropres } from '../engine/talentEffects';
import { actorInfluenceView, fermetureDeLaResilience } from './rollFlowFactory';
import type { Combatant, ConditionInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const heros = (): Combatant => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1, talentsRolled: false });

/** Un héros de `createHero` passé au modèle 5e (sans création 5e avant le lot B de #4898) : Destin 5, Fortune de base
 *  3 (CRB 008 l.71), ni Résilience ni Détermination propres. */
function en5e(c: Combatant): Combatant {
  c.progression = '5e';
  c.fate = 5;
  c.fortuneDeBase = 3;
  c.fortune = 3;
  delete c.resilience;
  delete c.resolve;
  return c;
}

function enCombat(pose: (h: Combatant) => void): Combatant {
  banc.setState({ party: [heros()] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const h = banc.getState().battle!.combatants.find((c) => c.kind === 'heros')!;
  pose(h);
  return h;
}

describe('Réserves d\'un héros 5e (CRB 116 l.36)', () => {
  it('une dépense de Détermination (retirer un État) consomme la Fortune', () => {
    const h = enCombat((c) => { en5e(c); c.conditions = [{ id: 'sonne', value: 2 }] as ConditionInstance[]; });
    banc.getState().depenserLaDetermination(h.id, 'retirerUnEtat', 'sonne');
    const lu = banc.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(stacks(lu, 'sonne')).toBe(1);
    expect(lu.fortune).toBe(2);
    expect(lu.resolve).toBeUndefined();
  });

  it('un effet qui lit la Résilience lit le Destin', () => {
    const h = en5e(heros());
    expect(actorInfluenceView(h).resilience).toBe(5);
    expect(fermetureDeLaResilience(actorInfluenceView(h), { rolled: false, failed: false })).toBeNull();
    h.fate = 0;
    expect(fermetureDeLaResilience(actorInfluenceView(h), { rolled: false, failed: false })).toBe('sansResilience');
  });

  it('« Je te renie ! » retire 1 à la Fortune maximale sans toucher au Destin', () => {
    const h = en5e(heros());
    banc.setState({ party: [h], battle: null, pendingRenounce: { heroId: h.id, testRoll: 99, testTarget: 30 } });
    banc.getState().fenetreChoisir('renier', 'renier', true);
    const lu = banc.getState().party.find((c) => c.id === h.id)!;
    expect(banc.getState().pendingRenounce).toBeNull();
    expect(fortuneMax(lu)).toBe(2);
    expect(lu.fate).toBe(5);
  });

  it('le début de séance remet la Fortune à son maximum 5e, pas au Destin', () => {
    const h = en5e(heros());
    h.fortune = 0;
    expect(restoreFortune([h])[0].fortune).toBe(3);
  });

  it('la Détermination regagnée par la Motivation se plafonne à la Fortune maximale', () => {
    const h = en5e(heros());
    h.fortune = 1;
    expect(regainDetermination(h, 1)).toBe(2);
    h.fortune = 3;
    expect(regainDetermination(h, 1)).toBe(3);
    expect(resolveMax(h)).toBe(fortuneMax(h));
  });

  it('un `attrMod{resolve}` gonfle la Fortune, reporté une seule fois', () => {
    const h = en5e(heros());
    const avant = maximaDesReserves(h);
    applyActiveEffect(h, { label: 'Obstiné', bonus: 0, attrMods: { resolve: 1 }, duration: { scale: 'rounds', left: 2 } });
    reporterLaHausseDesMaxima(h, avant);
    expect(fortuneMax(h)).toBe(4);
    expect(h.fortune).toBe(4);
  });

  it('la fiche n\'affiche ni Résilience ni Détermination propres', () => {
    expect(reservesPropres(en5e(heros()))).toEqual({ resilience: null, determination: null });
  });
});

describe('Réserves d\'un héros 4e (LDB 17 l.41, l.53)', () => {
  it('Chance sur le Destin, Détermination sur la Résilience, dépense sur la Détermination', () => {
    const h = enCombat((c) => { c.resolve = 2; c.conditions = [{ id: 'sonne', value: 1 }] as ConditionInstance[]; });
    expect(fortuneMax(h)).toBe(h.fate);
    expect(resolveMax(h)).toBe(h.resilience);
    const chance = h.fortune;
    banc.getState().depenserLaDetermination(h.id, 'retirerUnEtat', 'sonne');
    const lu = banc.getState().battle!.combatants.find((c) => c.id === h.id)!;
    expect(lu.resolve).toBe(1);
    expect(lu.fortune).toBe(chance);
    expect(reservesPropres(lu)).toEqual({ resilience: lu.resilience, determination: 1 });
  });
});

/**
 * Contrat de l'HORLOGE D'IMPACT (#3160) : une attaque sur une cible émet UN `ANIM_IMPACT`, au délai
 * nul, quel que soit le nombre d'hôtes installés ; rien sur soi ; rien une fois libérée.
 */
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { bus, EVT } from '../../noyau/bus';
import { impactClockInstalls, installImpactClock } from './impactClock';

function espionImpact(): { payloads: unknown[]; off: () => void } {
  const payloads: unknown[] = [];
  const off = bus.on(EVT.ANIM_IMPACT, (d) => void payloads.push(d));
  return { payloads, off };
}

const tick = () => new Promise<void>((r) => queueMicrotask(r));

const nettoyage: (() => void)[] = [];
afterEach(() => {
  for (const f of nettoyage.splice(0)) f();
});

/** HYGIÈNE `isolate: false` : l'horloge est un SINGLETON de module. */
afterAll(() => {
  expect(impactClockInstalls()).toBe(0);
});

describe('horloge d’impact', () => {
  it('une attaque sur une cible émet UN impact, avec sa cible et son résultat, après la distribution', async () => {
    nettoyage.push(installImpactClock());
    const spy = espionImpact();
    nettoyage.push(spy.off);
    const result = { hit: true, woundsLost: 3 };
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'melee', result });
    expect(spy.payloads, 'délai nul : jamais pendant la distribution de l’attaque').toEqual([]);
    await tick();
    expect(spy.payloads).toEqual([{ to: 'b', result }]);
  });

  it('un sort sans touche garde son impact (le retour « Incantation ratée » en dépend)', async () => {
    nettoyage.push(installImpactClock());
    const spy = espionImpact();
    nettoyage.push(spy.off);
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'spell', result: { cast: false } });
    await tick();
    expect(spy.payloads).toEqual([{ to: 'b', result: { cast: false } }]);
  });

  it('une attaque SUR SOI (souffle) ou sans cible n’émet rien', async () => {
    nettoyage.push(installImpactClock());
    const spy = espionImpact();
    nettoyage.push(spy.off);
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'a', result: { hit: true } });
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', result: { hit: true } });
    await tick();
    expect(spy.payloads).toEqual([]);
  });

  it('deux hôtes installés : un seul impact ; libérée, l’horloge se tait', async () => {
    const l1 = installImpactClock();
    const l2 = installImpactClock();
    const spy = espionImpact();
    nettoyage.push(spy.off);
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', result: {} });
    await tick();
    expect(spy.payloads).toHaveLength(1);
    l1();
    l1();
    expect(impactClockInstalls(), 'la libération est idempotente').toBe(1);
    l2();
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', result: {} });
    await tick();
    expect(spy.payloads).toHaveLength(1);
  });
});

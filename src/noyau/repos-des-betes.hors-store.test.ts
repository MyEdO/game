/**
 * Le repos atteint les bêtes possédées avec le groupe comme les héros (#4804, arbitrage C2 du 2026-11-24, « Comme un
 * héros »). LDB 18 l.296
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { sleepParty, buildNightCascade } from './restFlow';
import { runCascadeImmediate } from './cascade';
import { createHero } from '../engine/character';
import { projeterLaBete } from './monde/spawn';
import { bonus, effectiveChar } from '../engine/characteristics';
import type { Possession } from '../engine/possession';

const heros = () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
const mule = (ownerId: string, extra: Partial<Possession & { nature: 'bete' }> = {}): Possession & { nature: 'bete' } => ({
  uid: 'pos-mule', nature: 'bete', ownerId, label: 'Marguerite', location: { kind: 'avec-le-groupe' }, items: [], ref: { id: 'mule' }, blessures: 1, ...extra,
});
const profil = (p: Possession & { nature: 'bete' }) => {
  const c = projeterLaBete(p, undefined);
  return { max: c.wounds.max, be: bonus(effectiveChar(c, 'endurance')) };
};
const blessuresDe = (ps: readonly Possession[], max: number) => {
  const p = ps.find((x) => x.uid === 'pos-mule');
  return p?.nature === 'bete' ? (p.blessures ?? max) : -1;
};
const pendingDe = (heroId: string) => ({ places: { auberge: true }, quality: 'normale', days: 1, phase: 'setup', perHero: { [heroId]: { lodging: 'chambre-1', food: 'repas' } } }) as never;

describe('repos des bêtes possédées (#4804, LDB 18 l.296)', () => {
  it('sleepParty : un Test de récupération par jour pour la bête blessée, au bilan, et ses Blessures gardées', () => {
    const h = heros();
    const bete = mule(h.id);
    const { max, be } = profil(bete);
    expect(1 + 2 * be, 'prémisse : deux jours de repos ne la remettent pas au maximum par le seul BE').toBeLessThan(max);
    const banc = ouvrirLeBanc({ etat: { party: [h], possessions: [bete] } });
    const bilan = sleepParty(banc.getState, banc.setState as never, 2, { fedDaily: true });
    expect(bilan.filter((e) => e.actorId === 'pos-mule' && e.reKind === 'recuperation')).toHaveLength(2);
    expect(blessuresDe(banc.getState().possessions, max)).toBeGreaterThanOrEqual(1 + 2 * be);
  });

  it('nuit en cascade : la bête est une rangée de la bande de récupération, et la bande la soigne', () => {
    const h = heros();
    const bete = mule(h.id);
    const { max, be } = profil(bete);
    const banc = ouvrirLeBanc({ etat: { party: [h], possessions: [bete] } });
    const { steps } = buildNightCascade(banc.getState, banc.setState as never, pendingDe(h.id), { fedDaily: true });
    const bande = steps.find((s) => s.kind === 'recuperation');
    expect(bande?.participants?.map((r) => r.id)).toContain('pos-mule');
    expect(blessuresDe(banc.getState().possessions, max), 'aucun soin avant le jet').toBe(1);
    runCascadeImmediate(banc.getState, banc.setState, steps);
    expect(blessuresDe(banc.getState().possessions, max)).toBeGreaterThanOrEqual(Math.min(max, 1 + be));
  });

  it.each([
    ['laissée au lieu', { location: { kind: 'au-lieu', placeId: 'ubersreik' } }],
    ['détruite', { destroyed: true }],
  ] as const)('une bête %s ne se repose pas avec le groupe', (_cas, extra) => {
    const h = heros();
    const banc = ouvrirLeBanc({ etat: { party: [h], possessions: [mule(h.id, extra as Partial<Possession & { nature: 'bete' }>)] } });
    const bilan = sleepParty(banc.getState, banc.setState as never, 2, { fedDaily: true });
    expect(bilan.filter((e) => e.actorId === 'pos-mule')).toEqual([]);
    expect(blessuresDe(banc.getState().possessions, 99)).toBe(1);
  });
});

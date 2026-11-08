/**
 * L'HEURE DU RÉVEIL, sans store (#3059 S7) : `aubeApresNuits` rend l'horloge que le repos (`sleepParty`,
 * `buildNightCascade`) pose — première nuit jusqu'à l'aube suivante, un jour plein si l'on y est, puis un
 * jour par nuit. L'oracle est la boucle du repos d'avant l'extraction, écrite en clair.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { aubeApresNuits, minutesUntilNext, dawnMinute, MINUTES_PER_DAY } from '../engine/clock';
import { sleepParty, buildNightCascade } from './restFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

const premiereNuit = (from: number) => minutesUntilNext(from, dawnMinute()) || MINUTES_PER_DAY;
const reveil = (from: number, nuits: number) => {
  let t = from;
  for (let i = 0; i < nuits; i++) t += i === 0 ? premiereNuit(from) : MINUTES_PER_DAY;
  return t;
};

describe('aubeApresNuits', () => {
  it('rend le réveil de la boucle de repos, minute par minute sur six jours et sur des départs tirés', () => {
    const g = makeRNG(2059);
    const departs = [...Array.from({ length: 6 * MINUTES_PER_DAY + 1 }, (_, i) => i - 2 * MINUTES_PER_DAY), ...Array.from({ length: 2000 }, () => g.int(0, 1e7) / 10), 120.1, 299.9, 300, 1e9 + 0.3];
    const ecarts = departs.flatMap((from) => [1, 2, 7, 14, 21, 28].filter((n) => aubeApresNuits(from, n) !== reveil(from, n)).map((n) => `${from}×${n}`));
    expect(ecarts).toEqual([]);
  });
});

describe('le repos pose l’heure de `aubeApresNuits`', () => {
  const groupe = () => [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 })];
  const DEPARTS = [0, 120, 299, 300, 301, 720, 1439, MINUTES_PER_DAY + 300, 3 * MINUTES_PER_DAY + 1000];
  it.each(DEPARTS.flatMap((from) => [1, 3, 14].map((n) => [from, n])))('sleepParty depuis %d, %d nuit(s)', (from, n) => {
    const banc = ouvrirLeBanc({ etat: { party: groupe(), gameTime: from } });
    sleepParty(banc.getState, banc.setState as never, n, { fedDaily: true });
    expect(banc.getState().gameTime).toBe(reveil(from, n));
  });
  it.each(DEPARTS)('buildNightCascade depuis %d', (from) => {
    const party = groupe();
    const banc = ouvrirLeBanc({ etat: { party, gameTime: from } });
    const pending = { places: { lodging: [], food: [] }, quality: 'normale', days: 1, phase: 'setup', perHero: Object.fromEntries(party.map((h) => [h.id, { lodging: 'auberge', food: 'repas' }])) } as never;
    buildNightCascade(banc.getState, banc.setState as never, pending, { fedDaily: true });
    expect(banc.getState().gameTime).toBe(reveil(from, 1));
  });
});

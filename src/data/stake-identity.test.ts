/** #2968 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVITY_STAKES, COMBAT_STAKES, FLOW_STAKES, NIGHT_STAKES, VOYAGE_STAKES,
  activityStakeRef, combatStakeRef, etats, flowStakeRef, nightStakeRef, resolveStake,
  stateRecoveryStakeRef, symptoms, voyageStakeRef, weatherStakeRef,
  type StakeKey,
} from './index';
import { resetData, setDataset } from './overrides';
import weatherData from './weather.json';

afterEach(() => resetData());

const valuesFor = (text: string): Record<string, string> =>
  Object.fromEntries([...text.matchAll(/\{([^}]+)\}/g)].map((m) => [m[1], '7']));
const rendered = (text: string): string => text.replace(/\{[^}]+\}/g, '7');

describe('identité canonique des enjeux de catalogue', () => {
  it('résout les sept espaces par type et id', () => {
    const night = NIGHT_STAKES[0];
    const voyage = VOYAGE_STAKES[0];
    const flow = FLOW_STAKES[0];
    const combat = COMBAT_STAKES.find((e) => e.template)!;
    const activity = ACTIVITY_STAKES.find((e) => e.stake)!;
    const weather = weatherData.conditions.find((e) => e.resistanceTest?.enjeu)!;
    const etat = etats.find((e) => e.recover)!;
    const cases: { key: StakeKey; text: string }[] = [
      { key: { type: 'night', id: night.id }, text: night.stake },
      { key: { type: 'voyage', id: voyage.id }, text: voyage.template },
      { key: { type: 'flow', id: flow.id }, text: flow.template },
      { key: { type: 'combat', id: combat.id }, text: combat.template! },
      { key: { type: 'activity', id: activity.id }, text: activity.stake! },
      { key: { type: 'weather', id: weather.id }, text: weather.resistanceTest!.enjeu! },
      { key: { type: 'etat', id: etat.id }, text: etat.recover!.enjeu },
    ];
    for (const { key, text } of cases) {
      expect(resolveStake({ key, values: valuesFor(text) }).text, `${key.type}/${key.id}`).toBe(rendered(text));
    }
  });

  it('les sept constructeurs produisent la référence canonique', () => {
    const activity = ACTIVITY_STAKES.find((e) => e.stake)!;
    const weather = weatherData.conditions.find((e) => e.resistanceTest?.enjeu)!;
    const etat = etats.find((e) => e.recover)!;
    const refs = [
      [nightStakeRef(NIGHT_STAKES[0].id), 'night', NIGHT_STAKES[0].id],
      [voyageStakeRef(VOYAGE_STAKES[0].id), 'voyage', VOYAGE_STAKES[0].id],
      [flowStakeRef(FLOW_STAKES[0].id), 'flow', FLOW_STAKES[0].id],
      [combatStakeRef(COMBAT_STAKES[0].id), 'combat', COMBAT_STAKES[0].id],
      [activityStakeRef(activity.id), 'activity', activity.id],
      [weatherStakeRef(weather.id), 'weather', weather.id],
      [stateRecoveryStakeRef(etat.id), 'etat', etat.id],
    ] as const;
    for (const [ref, type, id] of refs) expect(ref.key).toEqual({ type, id });
  });

  it('refuse un id étranger et un id inconnu dans chaque espace', () => {
    const types = ['night', 'voyage', 'flow', 'combat', 'activity', 'weather', 'etat'] as const;
    for (const type of types) {
      for (const id of ['__enjeu-inconnu__', 'resistance']) {
        expect(() => resolveStake({ key: { type, id } })).toThrow(/aucune entrée d'enjeu/);
      }
    }
  });

  it('distingue les textes des deux entrées exposure', () => {
    const night = NIGHT_STAKES.find((e) => e.id === 'exposure')!;
    const voyage = VOYAGE_STAKES.find((e) => e.id === 'exposure')!;
    expect(night.stake).not.toBe(voyage.template);
    expect(resolveStake({ key: { type: 'night', id: 'exposure' } }).text).toBe(night.stake);
    expect(resolveStake({ key: { type: 'voyage', id: 'exposure' }, values: valuesFor(voyage.template) }).text).toBe(rendered(voyage.template));
  });

  it('lit la catégorie des trois étapes de maladie dans la donnée', () => {
    const symptom = symptoms[0];
    for (const id of ['disease-tick', 'disease-gangrene', 'disease-persist'] as const) {
      expect(NIGHT_STAKES.find((e) => e.id === id)?.entryCategory).toBe('symptoms');
      expect(resolveStake(nightStakeRef(id, symptom.id)).rule).toEqual({ category: 'symptoms', id: symptom.id });
    }
  });

  it('isole les catégories par type et id et relit la déclaration éditée', () => {
    const symptom = symptoms[0];
    const key = { type: 'night', id: 'exposure', entryId: symptom.id } as const;
    const before = resolveStake({ key }).rule;
    expect(before).not.toEqual({ category: 'symptoms', id: symptom.id });
    setDataset('nightStakes', NIGHT_STAKES.map((e) => e.id === 'exposure' ? { ...e, entryCategory: 'symptoms' } : e));
    expect(resolveStake({ key }).rule).toEqual({ category: 'symptoms', id: symptom.id });
    const voyage = VOYAGE_STAKES.find((e) => e.id === 'exposure')!;
    expect(resolveStake({ key: { type: 'voyage', id: 'exposure', entryId: symptom.id }, values: valuesFor(voyage.template) }).rule).not.toEqual({ category: 'symptoms', id: symptom.id });
  });
});

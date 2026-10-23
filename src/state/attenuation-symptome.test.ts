/**
 * ATTÉNUATION d'un symptôme — LDB 20 l.159, verbatim : « certaines herbes rares et autres mélanges
 * alchimiques permettent d'atténuer les symptômes pendant une journée, transformant Grave en Modéré
 * et Modéré en convulsions normales. »
 *
 * « pendant une journée » : l'atténuation est une DURÉE, pas une mutation. L'instance de symptôme garde
 * sa sévérité ; un `ActiveEffect` (`attenuatedSymptom`, miroir exact de `suppressedSymptom`) porte
 * l'échelon, et l'échelon REVIENT quand l'effet expire — l'horloge le purge comme toute fenêtre.
 *
 * Le chemin est le VRAI : `applyOps` sur un héros du store, puis `purgeClockEffects` de l'entretien.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { contractDisease, severiteEffective, diseasePassiveOps, attenuationEchelons, symptomOnTick } from '../engine/disease';
import { findSymptomById } from '../data';
import { applyOps } from '../engine/ops';
import { stacks, syncDerivedConditions } from '../engine/conditions';
import { purgeClockEffects } from '../noyau/upkeep';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { desEnSuite } from '../engine/dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

const seq = (values: number[]): RNG => desEnSuite(values);

/** Un fiévreux (Grave) : la Fièvre lui porte l'État Inconscient (LDB 20 l.170). */
const fievreux = (): Combatant => {
  const c = {
    id: 'h', label: 'Fiévreux', kind: 'hero', resolve: 2,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    diseases: [contractDisease('pneumonie', seq([5, 5, 5]), { incubation: 0, duration: 40 })!],
  } as unknown as Combatant;
  const dz = c.diseases![0];
  dz.symptoms = dz.symptoms.map((s) => (s.symptomId === 'fievre' ? { ...s, severity: 'grave' as const } : s));
  syncDerivedConditions(c);
  return c;
};

const fievre = (c: Combatant) => c.diseases![0].symptoms.find((s) => s.symptomId === 'fievre')!;

describe('l’atténuation dure une JOURNÉE, puis l’échelon revient (LDB 20 l.159)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], mode: 'menu', gameTime: 0 } as never);
  });

  it('elle ne MUTE pas l’instance : seule la sévérité EFFECTIVE redescend', () => {
    const h = fievreux();
    expect(severiteEffective(h, 'pneumonie', fievre(h))).toBe('grave');
    applyOps(h, [{ op: 'attenuateSymptom', disease: 'pneumonie', symptomId: 'fievre' }], { idNeuf: idNeufDeBanc, rng: seq([]), defaultUntilTime: MINUTES_PER_DAY, label: 'Mélange alchimique' });
    expect(fievre(h).severity, 'l’instance a été mutée').toBe('grave');
    expect(severiteEffective(h, 'pneumonie', fievre(h))).toBe('moderee');
    expect(stacks(h, 'inconscient'), 'l’Inconscient du palier Grave tient encore').toBe(0);
  });

  it('à l’échéance de la journée, l’échelon Grave est de retour (l’Inconscient aussi)', () => {
    const h = fievreux();
    useGame.setState({ mode: 'exploration', party: [h], gameTime: 0 } as never);
    applyOps(h, [{ op: 'attenuateSymptom', disease: 'pneumonie', symptomId: 'fievre' }], { idNeuf: idNeufDeBanc, rng: seq([]), defaultUntilTime: MINUTES_PER_DAY, label: 'Mélange alchimique' });
    expect(stacks(h, 'inconscient')).toBe(0);

    // Une minute AVANT l'échéance : la journée n'est pas finie, l'atténuation tient.
    useGame.setState({ gameTime: MINUTES_PER_DAY - 1 } as never);
    purgeClockEffects(useGame.getState, useGame.setState);
    expect(stacks(useGame.getState().party[0], 'inconscient')).toBe(0);

    // 30 jours plus tard : plus aucune atténuation, la Fièvre est de nouveau (Grave).
    useGame.setState({ gameTime: 30 * MINUTES_PER_DAY } as never);
    purgeClockEffects(useGame.getState, useGame.setState);
    const c0 = useGame.getState().party[0];
    expect(severiteEffective(c0, 'pneumonie', fievre(c0)), 'l’échelon n’est jamais revenu').toBe('grave');
    expect(stacks(c0, 'inconscient'), 'l’Inconscient du palier Grave n’est pas revenu').toBe(1);
  });

  it('une 2ᵉ dose REMPLACE la première — jamais deux échelons empilés (l.159 ne cadre qu’UNE dose)', () => {
    const h = fievreux();
    const dose = () => applyOps(h, [{ op: 'attenuateSymptom', disease: 'pneumonie', symptomId: 'fievre' }], { idNeuf: idNeufDeBanc, rng: seq([]), defaultUntilTime: MINUTES_PER_DAY, label: 'Mélange alchimique' });
    dose();
    dose();
    expect(attenuationEchelons(h, 'pneumonie', 'fievre'), 'deux doses ont empilé deux échelons').toBe(1);
    expect(severiteEffective(h, 'pneumonie', fievre(h)), 'la 2ᵉ dose a fait sauter un palier de plus').toBe('moderee');
  });

  it('le CYCLE QUOTIDIEN lit la sévérité EFFECTIVE, pas celle que l’instance porte', () => {
    // Toxine (Grave) : cycle Accessible (LDB 20 l.215). Atténuée → le cycle du palier Modéré (Facile).
    const h = fievreux();
    const dz = h.diseases![0];
    dz.symptoms = [...dz.symptoms, { symptomId: 'toxine', severity: 'grave' as const }];
    const toxine = () => dz.symptoms.find((x) => x.symptomId === 'toxine')!;
    const graveDiff = symptomOnTick(toxine(), severiteEffective(h, 'pneumonie', toxine()))!.difficulty;
    applyOps(h, [{ op: 'attenuateSymptom', disease: 'pneumonie', symptomId: 'toxine' }], { idNeuf: idNeufDeBanc, rng: seq([]), defaultUntilTime: MINUTES_PER_DAY, label: 'Mélange alchimique' });
    const attenueDiff = symptomOnTick(toxine(), severiteEffective(h, 'pneumonie', toxine()))!.difficulty;
    const parPalier = findSymptomById('toxine')!.onTick!.difficultyBySeverity!;
    expect(graveDiff, 'le palier Grave n’est pas celui de la donnée').toBe(parPalier.grave);
    expect(attenueDiff, 'le cycle est resté au palier Grave malgré l’atténuation').toBe(parPalier.moderee);
    expect(attenueDiff).not.toBe(graveDiff);
  });

  it('les pénalités de BASE tiennent sous l’atténuation (l.170 : le palier s’AJOUTE, il ne remplace pas)', () => {
    const h = fievreux();
    const base = diseasePassiveOps(h).filter((m) => m.src?.id === 'fievre' && m.op.op === 'testMod').length;
    applyOps(h, [{ op: 'attenuateSymptom', disease: 'pneumonie', symptomId: 'fievre' }], { idNeuf: idNeufDeBanc, rng: seq([]), defaultUntilTime: MINUTES_PER_DAY, label: 'Mélange alchimique' });
    const apres = diseasePassiveOps(h).filter((m) => m.src?.id === 'fievre' && m.op.op === 'testMod').length;
    expect(apres, 'les −10 de la Fièvre ont sauté avec le palier').toBe(base);
    expect(base).toBeGreaterThan(0);
  });
});

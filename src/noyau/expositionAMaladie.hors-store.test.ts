import { expect, it } from 'vitest';
import { avancerLesMaladies, contractDisease, declareDisease } from '../engine/disease';
import { makeRNG } from '../engine/dice';
import { ouvrirLeBanc } from './banc.testkit';
import { calculerLePasDExposition, calculerLesTestsDExposition } from './expositionAMaladie';

const maladieId = 'verole-urticante';
const rng = makeRNG(1);

it.each([
  { debutIncubee: 15, nombre: 1 },
  { debutIncubee: 20, nombre: 1 },
  { debutIncubee: 21, nombre: 2 },
])('unit ou sépare les contacts pour une éclosion à la minute $debutIncubee (LDB 20 l.12-13, l.206)', ({ debutIncubee, nombre }) => {
  const banc = ouvrirLeBanc();
  const declaree = { ...contractDisease(maladieId, rng, { incubation: 0, duration: 1 })!, minutesLeft: 20 };
  const incubee = {
    ...contractDisease(maladieId, rng, { incubation: 1, duration: 1 })!,
    minutesLeft: debutIncubee,
    durationMinutes: 20,
  };
  const source = { id: 'source', porteur: { label: 'Source', diseases: [declaree] } };
  const releve = { id: 'releve', porteur: { label: 'Relève', diseases: [incubee] } };
  const temoin = { id: 'temoin', porteur: { label: 'Témoin' } };
  expect(calculerLesTestsDExposition(banc.getState, banc.setState, 90, [[source, releve, temoin]])).toEqual([
    { porteurId: temoin.id, diseaseName: maladieId, difficulty: 'accessible', nombre },
  ]);
});

it.each([
  { phase: 'active', minutesLeft: 55, segments: [30, 40], attendus: [1, 0] },
  { phase: 'incubation', minutesLeft: 20, segments: [10, 20], attendus: [0, 1] },
])('garde le repère d’une phase $phase inchangée entre deux pas d’horloge', ({ phase, minutesLeft, segments, attendus }) => {
  const banc = ouvrirLeBanc();
  const maladie = {
    ...contractDisease(maladieId, rng, { incubation: phase === 'incubation' ? 1 : 0, duration: 1 })!,
    minutesLeft,
  };
  const source = { id: 'source', porteur: { label: 'Source', diseases: [maladie] } };
  const temoin = { id: 'temoin', porteur: { label: 'Témoin' } };
  const nombres = segments.map((minutes) => {
    const dus = calculerLesTestsDExposition(banc.getState, banc.setState, minutes, [[source, temoin]]);
    banc.getState().avancerLHorloge(minutes);
    return dus[0]?.nombre ?? 0;
  });
  expect(nombres).toEqual(attendus);
});

it('ouvre une nouvelle heure après une séparation réelle malgré une phase inchangée', () => {
  const banc = ouvrirLeBanc();
  const maladie = { ...contractDisease(maladieId, rng, { incubation: 0, duration: 1 })!, minutesLeft: 60 };
  const source = { id: 'source', porteur: { label: 'Source', diseases: [maladie] } };
  const temoin = { id: 'temoin', porteur: { label: 'Témoin' } };
  const parcours = [
    { minutes: 20, groupes: [[source, temoin]] },
    { minutes: 5, groupes: [[source], [temoin]] },
    { minutes: 20, groupes: [[source, temoin]] },
  ];
  const nombres = parcours.map(({ minutes, groupes }) => {
    const dus = calculerLesTestsDExposition(banc.getState, banc.setState, minutes, groupes);
    banc.getState().avancerLHorloge(minutes);
    return dus[0]?.nombre ?? 0;
  });
  expect(nombres).toEqual([1, 0, 1]);
});

it.each([{ segments: [1550] }, { segments: [50, 1500] }, { segments: [50, 20, 1480] }])(
  'conserve les 24 heures contagieuses avec le vrai décompte collectif, découpage $segments (LDB 20 l.12-13, l.206)',
  ({ segments }) => {
    const banc = ouvrirLeBanc();
    const maladie = { ...contractDisease('rhume-commun', rng, { incubation: 1, duration: 1 })!, minutesLeft: 30 };
    const source = { id: 'equipage', porteur: { label: 'Équipage', diseases: [maladie] } };
    const temoin = { id: 'temoin', porteur: { label: 'Témoin' } };
    let nombre = 0;
    for (const minutes of segments) {
      nombre += calculerLesTestsDExposition(banc.getState, banc.setState, minutes, [[source, temoin]])[0]?.nombre ?? 0;
      avancerLesMaladies(source.porteur, minutes, rng);
      banc.getState().avancerLHorloge(minutes);
    }
    expect(nombre).toBe(24);
  },
);

it('démarre la durée à l’arrivée pour une incubation différée (EDOC 09 l.21)', () => {
  const banc = ouvrirLeBanc();
  const maladie = { ...contractDisease('rhume-commun', rng, { incubation: 1, duration: 1 })!, minutesLeft: 30 };
  const source = { id: 'source', porteur: { label: 'Source', diseases: [maladie] } };
  const temoin = { id: 'temoin', porteur: { label: 'Témoin' } };
  const groupe = [[source, temoin]];
  expect(calculerLesTestsDExposition(banc.getState, banc.setState, 100, groupe, () => false)).toEqual([]);
  avancerLesMaladies(source.porteur, 100, rng);
  banc.getState().avancerLHorloge(100);
  const dus = calculerLesTestsDExposition(banc.getState, banc.setState, 1440, groupe);
  expect(dus[0]?.nombre).toBe(24);
});

it('part de la déclaration observée quand la phase bascule sans temps d’infection écoulé', () => {
  const banc = ouvrirLeBanc();
  const maladie = { ...contractDisease('rhume-commun', rng, { incubation: 1, duration: 1 })!, minutesLeft: 30 };
  const source = { id: 'source', porteur: { label: 'Source', diseases: [maladie] } };
  const temoin = { id: 'temoin', porteur: { label: 'Témoin' } };
  const groupe = [[source, temoin]];
  expect(calculerLesTestsDExposition(banc.getState, banc.setState, 10, groupe)).toEqual([]);
  banc.getState().avancerLHorloge(100);
  declareDisease(source.porteur, maladie, rng);
  const dus = calculerLesTestsDExposition(banc.getState, banc.setState, 1440, groupe);
  expect(dus[0]?.nombre).toBe(24);
});

it('attend l’heure d’éclosion malgré la bascule anticipée par l’entretien calendaire (LDB 20 l.12, l.206)', () => {
  const banc = ouvrirLeBanc();
  const maladie = { ...contractDisease(maladieId, rng, { incubation: 1, duration: 8 })!, minutesLeft: 1380 };
  const source = { id: 'source', porteur: { label: 'Source', diseases: [maladie] } };
  const temoin = { id: 'temoin', porteur: { label: 'Témoin' } };
  const groupe = [[source, temoin]];
  const pas = (minutes: number) => calculerLePasDExposition(banc.getState, banc.setState, minutes, groupe);
  expect(pas(960)).toEqual({ minutes: 960, tests: [] });
  banc.getState().avancerLHorloge(960);
  avancerLesMaladies(source.porteur, 1440, rng);
  expect(maladie.phase).toBe('active');

  expect(pas(60)).toEqual({ minutes: 60, tests: [] });
  banc.getState().avancerLHorloge(60);
  expect(pas(480)).toEqual({ minutes: 360, tests: [] });
  banc.getState().avancerLHorloge(360);
  expect(pas(120)).toEqual({
    minutes: 60,
    tests: [{ porteurId: temoin.id, diseaseName: maladieId, difficulty: 'accessible', nombre: 1 }],
  });
});

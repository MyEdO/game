import { afterAll, describe, expect, it } from 'vitest';
import { detenteur } from '../../../src/detenteur.testkit';

let destructionsFabrique = 0;
let constructions = 0;
let destructions = 0;
let premiere: { n: number } | undefined;
let seconde: { n: number } | undefined;
const valeursLiberees: { n: number }[] = [];
let lire: () => { n: number };

const liberer = (valeur: { n: number }) => {
  valeursLiberees.push(valeur);
  destructions++;
  if (destructions === 1) throw new Error('DETENTEUR_AFTERALL_DESTRUCTION_ATTENDUE_2258');
};

afterAll(() => {
  expect(destructionsFabrique).toBe(0);
  expect(constructions).toBe(2);
  expect(destructions).toBe(2);
  expect(valeursLiberees).toEqual([premiere, seconde]);
  expect(valeursLiberees[0]).toBe(premiere);
  expect(valeursLiberees[1]).toBe(seconde);
});

describe('fabrique échouée', () => {
  const echoue = detenteur(() => { throw new Error('fabrique attendue'); }, () => { destructionsFabrique++; });
  it('la fabrique échouée ne produit aucune valeur', () => {
    expect(echoue).toThrow('fabrique attendue');
    expect(destructionsFabrique).toBe(0);
  });
});

describe('après fabrique échouée', () => {
  it('afterAll ne détruit pas la fabrique échouée', () => {
    expect(destructionsFabrique).toBe(0);
  });
});

describe('détenteur construit', () => {
  lire = detenteur(() => ({ n: ++constructions }), liberer);
  it('la valeur construite est partagée avant afterAll', () => {
    premiere = lire();
    expect(lire()).toBe(premiere);
    expect(constructions).toBe(1);
    expect(destructions).toBe(0);
  });
});

describe('après destruction échouée', () => {
  const lireReconstruit = detenteur(() => lire(), liberer);
  it('le même lecteur reconstruit et partage une nouvelle identité', () => {
    seconde = lire();
    expect(seconde).not.toBe(premiere);
    expect(lire()).toBe(seconde);
    expect(lireReconstruit()).toBe(seconde);
    expect(constructions).toBe(2);
    expect(destructions).toBe(1);
    expect(valeursLiberees).toEqual([premiere]);
    expect(valeursLiberees[0]).toBe(premiere);
  });
});

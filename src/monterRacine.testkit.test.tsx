// @vitest-environment jsdom
/** #2325 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { demonterRacines, monterRacine } from './monterRacine.testkit';

const etrangers: HTMLElement[] = [];
const environnementAct = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
let environnementInitial: PropertyDescriptor | undefined;

beforeAll(() => {
  environnementInitial = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  environnementAct.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  if (environnementInitial) {
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', environnementInitial);
  } else {
    delete environnementAct.IS_REACT_ACT_ENVIRONMENT;
  }
});

function prototypeRacine(): Root {
  const sonde = createRoot(document.createElement('div'));
  const prototype = Object.getPrototypeOf(sonde) as Root;
  act(() => { sonde.unmount(); });
  return prototype;
}

function erreurDe(action: () => unknown): unknown {
  try {
    action();
  } catch (erreur) {
    return erreur;
  }
  throw new Error('Une erreur était attendue');
}

afterEach(() => {
  vi.restoreAllMocks();
  try {
    demonterRacines();
  } finally {
    for (const etranger of etrangers.splice(0)) etranger.remove();
  }
});

describe('nettoyage collectif des racines React', () => {
  it('tente les trois racines en ordre inverse et conserve les deux fautes originales', () => {
    const prototype = prototypeRacine();
    const rendre = prototype.render;
    const racines: Root[] = [];
    vi.spyOn(prototype, 'render').mockImplementation(function (this: Root, node) {
      racines.push(this);
      rendre.call(this, node);
    });
    const montages = [monterRacine(<span>Un</span>), monterRacine(<span>Deux</span>), monterRacine(<span>Trois</span>)];
    const etranger = document.createElement('aside');
    document.body.appendChild(etranger);
    etrangers.push(etranger);
    const fauteTrois = Symbol('troisième racine');
    const fauteUn = { racine: 'première' };
    const demonter = prototype.unmount;
    const ordre: Root[] = [];
    const spy = vi.spyOn(prototype, 'unmount').mockImplementation(function (this: Root) {
      ordre.push(this);
      demonter.call(this);
      if (this === racines[2]) throw fauteTrois;
      if (this === racines[0]) throw fauteUn;
    });

    const erreur = erreurDe(demonterRacines);
    expect(erreur).toBeInstanceOf(AggregateError);
    const fautes = (erreur as AggregateError).errors;
    expect(fautes).toHaveLength(2);
    expect(fautes[0]).toBe(fauteTrois);
    expect(fautes[1]).toBe(fauteUn);
    expect(ordre).toEqual([racines[2], racines[1], racines[0]]);
    expect(spy).toHaveBeenCalledTimes(3);
    for (const { container } of montages) {
      expect(container.isConnected).toBe(false);
      expect(container.childNodes).toHaveLength(0);
    }
    expect(etranger.isConnected).toBe(true);
    expect(() => demonterRacines()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('remonte une faute unique par identité après retrait du conteneur', () => {
    const prototype = prototypeRacine();
    const montage = monterRacine(<span>Unique</span>);
    const faute = { nettoyage: 'unique' };
    const demonter = prototype.unmount;
    const spy = vi.spyOn(prototype, 'unmount').mockImplementation(function (this: Root) {
      demonter.call(this);
      throw faute;
    });

    expect(erreurDe(demonterRacines)).toBe(faute);
    expect(montage.container.isConnected).toBe(false);
    expect(montage.container.childNodes).toHaveLength(0);
    expect(() => demonterRacines()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('poursuit les démontages après une faute de retrait', () => {
    const prototype = prototypeRacine();
    const premier = monterRacine(<span>Premier</span>);
    const dernier = monterRacine(<span>Dernier</span>);
    const faute = Symbol('retrait');
    const retirer = dernier.container.remove;
    vi.spyOn(dernier.container, 'remove').mockImplementation(function (this: HTMLDivElement) {
      retirer.call(this);
      throw faute;
    });
    const spy = vi.spyOn(prototype, 'unmount');

    expect(erreurDe(demonterRacines)).toBe(faute);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(premier.container.isConnected).toBe(false);
    expect(dernier.container.isConnected).toBe(false);
    expect(() => demonterRacines()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('annule seulement le montage échoué et conserve sa faute puis celle du nettoyage', () => {
    const prototype = prototypeRacine();
    const existant = monterRacine(<span>Existant</span>);
    const etranger = document.createElement('aside');
    document.body.appendChild(etranger);
    etrangers.push(etranger);
    const hostsAvant = [...document.body.children];
    const fauteMontage = Symbol('montage');
    const fauteNettoyage = { nettoyage: 'rollback' };
    const rendre = prototype.render;
    const demonter = prototype.unmount;
    const renderSpy = vi.spyOn(prototype, 'render').mockImplementation(function (this: Root, node) {
      rendre.call(this, node);
      throw fauteMontage;
    });
    const unmountSpy = vi.spyOn(prototype, 'unmount').mockImplementation(function (this: Root) {
      demonter.call(this);
      throw fauteNettoyage;
    });

    const erreur = erreurDe(() => monterRacine(<span>Échec</span>));
    expect(erreur).toBeInstanceOf(AggregateError);
    const fautes = (erreur as AggregateError).errors;
    expect(fautes).toHaveLength(2);
    expect(fautes[0]).toBe(fauteMontage);
    expect(fautes[1]).toBe(fauteNettoyage);
    expect(unmountSpy).toHaveBeenCalledTimes(1);
    expect(unmountSpy.mock.instances[0]).toBe(renderSpy.mock.instances[0]);
    expect([...document.body.children]).toEqual(hostsAvant);
    expect(existant.container.textContent).toBe('Existant');
    expect(etranger.isConnected).toBe(true);

    renderSpy.mockRestore();
    unmountSpy.mockRestore();
    demonterRacines();
    expect(existant.container.isConnected).toBe(false);
    expect(etranger.isConnected).toBe(true);
    expect(() => demonterRacines()).not.toThrow();
  });

  it('préserve la faute unique de montage après un rollback réussi', () => {
    const prototype = prototypeRacine();
    const hostsAvant = [...document.body.children];
    const faute = { montage: 'unique' };
    const rendre = prototype.render;
    vi.spyOn(prototype, 'render').mockImplementation(function (this: Root, node) {
      rendre.call(this, node);
      throw faute;
    });
    const spy = vi.spyOn(prototype, 'unmount');

    expect(erreurDe(() => monterRacine(<span>Échec</span>))).toBe(faute);
    expect(spy).toHaveBeenCalledTimes(1);
    expect([...document.body.children]).toEqual(hostsAvant);
    expect(() => demonterRacines()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

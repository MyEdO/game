/**
 * La colonne de Disponibilité d'un marchand se dérive du lieu où il se tient (#4277 lot C) : LDB 59 l.25-34 ;
 * MSRC 13 l.44-50.
 */
import { describe, it, expect } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resetSceneRegistry } from './monde/registreDesScenes';
import { emptyScene, type Scene } from './monde/scene';
import type { MapPlace, WorldMap } from './worldMap';
import { validateScene } from './validateScene';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { rollAvailability } from '../engine/disponibilite';
import { makeRNG } from '../engine/dice';
import type { Settlement } from '../data/schemas/grammaire/valeurs';

let banc: Banc;
const g = () => banc.getState();

const scene = (id: string, settlement?: Settlement): Scene => {
  const sc = emptyScene(id, 6, 6);
  sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  sc.entities.push({ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 2, y: 2 }, merchant: { archetype: { id: 'armurier' }, ...(settlement ? { settlement } : {}) } });
  return sc;
};

const carte = (lieu: Partial<MapPlace>): WorldMap => ({
  id: 'carte', label: 'Carte', routes: [],
  places: [{ id: 'bourg', label: 'Bourg', pos: { x: 0, y: 0 }, scene: { id: 'place' }, services: [{ id: 'forgeron', kind: { id: 'forgeron' } }], ...lieu }],
});

function monter(worldMap: WorldMap | undefined, scenes: Scene[] = [scene('place')]): void {
  resetSceneRegistry();
  banc = ouvrirLeBanc();
  g().fixerLeGroupe(tousLesHerosDeScenario(idsDeTest));
  g().chargerLeProjet({ scenes, entryId: scenes[0].id, worldMap, projet: null });
}

/** Le pourcentage du Test de Disponibilité d'un objet Limité chez le marchand ouvert. */
const pctLimitee = () => rollAvailability('limitee', g().merchant!.settlement, makeRNG(1)).test!.target;

describe('la colonne de Disponibilité se dérive de la Taille du lieu', () => {
  it.each([[1, 30], [2, 30], [3, 60], [4, 90]])('Taille %i : un objet Limité se teste à %i %%', (taille, pct) => {
    monter(carte({ taille }));
    g().ouvrirLeMarchand('pnj');
    expect(pctLimitee()).toBe(pct);
  });

  it('le marchand ouvert par le hub et celui posé dans la scène du lieu lisent la même colonne', () => {
    monter(carte({ taille: 4 }));
    g().ouvrirLeMarchand('pnj');
    const enScene = g().merchant!.settlement;
    g().fenetreFermer('marchand');
    g().ouvrirLeLieu();
    g().ouvrirLaBoutique('forgeron');
    expect([enScene, g().merchant!.settlement]).toEqual(['cite', 'cite']);
  });

  it('un marchand d’une scène où mène un point d’intérêt du lieu lit la Taille de ce lieu', () => {
    monter(carte({ taille: 4, poi: [{ id: 'echoppe', label: 'Échoppe', pos: { x: 1, y: 1 }, sceneId: { id: 'echoppe' } }] }), [scene('place'), scene('echoppe')]);
    g().quitterLaScene('echoppe');
    g().ouvrirLeMarchand('pnj');
    expect(pctLimitee()).toBe(90);
  });

  it('la colonne de l’entité l’emporte sur celle du lieu', () => {
    monter(carte({ taille: 4 }), [scene('place', 'village')]);
    g().ouvrirLeMarchand('pnj');
    expect(pctLimitee()).toBe(30);
  });
});

describe('validateScene refuse un marchand hors de tout lieu de Taille connue', () => {
  const fautes = (scenes: Scene[], worldMap?: WorldMap) =>
    validateScene(scenes, worldMap).filter((w) => w.level === 'error' && /Taille/.test(w.message)).map((w) => w.refId);

  it('un marchand de scène sans lieu ni colonne propre', () => {
    expect(fautes([scene('place')])).toEqual(['pnj']);
  });

  it('une échoppe d’un lieu sans Taille', () => {
    expect(fautes([scene('place', 'ville')], carte({}))).toEqual(['bourg']);
  });

  it('un lieu de Taille connue, ou la colonne propre du marchand, lèvent la faute', () => {
    expect([fautes([scene('place')], carte({ taille: 2 })), fautes([scene('place', 'cite')])]).toEqual([[], []]);
  });
});

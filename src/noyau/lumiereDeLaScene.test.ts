import { describe, it, expect } from 'vitest';
import { lumiereDeLaScene } from './lumiereDeLaScene';
import { emptyScene, type Scene } from './monde/scene';
import { MISSING_TONE } from './monde/volume/missing';
import type { Combatant } from '../engine/types';

const MIDI = 12 * 60;
const MINUIT = 0;

function etat(scene: Scene, gameTime: number, lightLevel: number | null = null) {
  return { scene, battle: null, party: [], partyPos: { x: 0, y: 0 }, gameTime, lightLevel, explored: {} };
}

describe('lumiereDeLaScene', () => {
  it('un extérieur à midi : un soleil au-dessus de l’horizon, un ciel, une ambiante de jour', () => {
    const s = emptyScene('scene-test', 4, 4);
    const l = lumiereDeLaScene(etat(s, MIDI), 'tactique');
    expect(l.soleil?.vers.y).toBeGreaterThan(0.5);
    expect(l.soleil!.energie).toBeGreaterThan(0);
    expect(l.ciel).not.toBeNull();
    expect(l.ambiante.energie).toBeGreaterThan(lumiereDeLaScene(etat(s, MINUIT), 'tactique').ambiante.energie);
  });

  it('un extérieur à minuit : aucun soleil, un ciel plus sombre qu’à midi', () => {
    const s = emptyScene('scene-test', 4, 4);
    const nuit = lumiereDeLaScene(etat(s, MINUIT), 'tactique');
    expect(nuit.soleil).toBeNull();
    const clarte = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(clarte(nuit.ciel!.zenith)).toBeLessThan(clarte(lumiereDeLaScene(etat(s, MIDI), 'tactique').ciel!.zenith));
  });

  it('un intérieur : ni soleil ni ciel, la brume d’intérieur', () => {
    const s: Scene = { ...emptyScene('scene-test', 4, 4), ambiance: 'interieur' };
    const l = lumiereDeLaScene(etat(s, MIDI), 'tactique');
    expect(l.soleil).toBeNull();
    expect(l.ciel).toBeNull();
    expect(l.brume.finCases).toBeLessThan(lumiereDeLaScene(etat(emptyScene('scene-test', 4, 4), MIDI), 'tactique').brume.finCases);
  });

  it('la pluie voile le soleil et teinte le ciel', () => {
    const clair = lumiereDeLaScene(etat(emptyScene('scene-test', 4, 4), MIDI), 'tactique');
    const pluie = lumiereDeLaScene(etat({ ...emptyScene('scene-test', 4, 4), weather: 'pluie' }, MIDI), 'tactique');
    expect(pluie.soleil!.energie).toBeLessThan(clair.soleil!.energie);
    expect(pluie.ciel!.zenith).not.toBe(clair.ciel!.zenith);
  });

  it('une mise en scène de ténèbres éteint le soleil et ramène l’ambiante à son plancher', () => {
    const s = emptyScene('scene-test', 4, 4);
    const l = lumiereDeLaScene(etat(s, MIDI, 0), 'tactique');
    expect(l.soleil!.energie).toBe(0);
    expect(l.ambiante.energie).toBeLessThan(lumiereDeLaScene(etat(s, MIDI), 'tactique').ambiante.energie);
  });

  it('en immersion, la brume part de l’œil et la brume de la météo la resserre', () => {
    const clair = emptyScene('scene-test', 4, 4);
    const brouillard: Scene = { ...clair, weather: 'brouillard' };
    const tactique = lumiereDeLaScene(etat(brouillard, MIDI), 'tactique');
    const immersion = lumiereDeLaScene(etat(brouillard, MIDI), 'immersion');
    expect(tactique.brume.depuisLOeil).toBe(false);
    expect(immersion.brume.depuisLOeil).toBe(true);
    expect(immersion.brume.finCases).toBeLessThan(tactique.brume.finCases);
    expect(immersion.brume.debutCases).toBeLessThan(tactique.brume.debutCases);
    expect(lumiereDeLaScene(etat(clair, MIDI), 'immersion').brume.finCases).toBe(lumiereDeLaScene(etat(clair, MIDI), 'tactique').brume.finCases);
  });

  it('en immersion sous un toit, la brume d’intérieur, que la météo ne resserre pas', () => {
    const s: Scene = { ...emptyScene('scene-test', 8, 8), weather: 'brouillard' };
    s.architecture = [{ id: 'maison', label: 'Maison', style: { id: 'maison' }, storeys: [], facades: [], masses: [{ id: 'toit', z: 0, footprint: [{ x: 2, y: 2, w: 3, h: 3 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45, material: { id: 'tuile' } }] }];
    const dessous = lumiereDeLaScene({ ...etat(s, MIDI), partyPos: { x: 3, y: 3 } }, 'immersion');
    const dehors = lumiereDeLaScene({ ...etat(s, MIDI), partyPos: { x: 6, y: 6 } }, 'immersion');
    const salle = lumiereDeLaScene(etat({ ...emptyScene('scene-test', 4, 4), ambiance: 'interieur' }, MIDI), 'immersion');
    expect([dessous.brume.couleur, dessous.brume.finCases]).toEqual([salle.brume.couleur, salle.brume.finCases]);
    expect(dehors.brume.couleur).not.toBe(salle.brume.couleur);
  });

  it('un ton de lumière hors catalogue se voit au ton d’alarme, sans emprunter la flamme', () => {
    const s = emptyScene('scene-test', 4, 4);
    s.entities = [{ id: 'lampe', kind: 'prop', pos: { x: 1, y: 1 }, light: { radiusM: 4, tone: 'forge-de-neant' } }];
    const [source] = lumiereDeLaScene(etat(s, MIDI), 'tactique').sources;
    expect(source.couleur).toBe(MISSING_TONE);
    expect(source.scintillement).toBeNull();
  });

  it('chaque source posée porte la clé de son décor, la même quand le groupe a marché (#3947)', () => {
    const s = emptyScene('scene-test', 6, 4);
    s.entities = [
      { id: 'lampe', kind: 'prop', pos: { x: 1, y: 1 }, light: { radiusM: 4 } },
      { id: 'brasero', kind: 'prop', pos: { x: 4, y: 2 }, light: { radiusM: 4 } },
    ];
    const cles = (partyPos: { x: number; y: number }) => lumiereDeLaScene({ ...etat(s, MIDI), partyPos }, 'tactique').sources.map((source) => source.cle);
    expect(cles({ x: 0, y: 0 })).toEqual(['posee/lampe', 'posee/brasero']);
    expect(cles({ x: 3, y: 3 })).toEqual(['posee/lampe', 'posee/brasero']);
  });

  it('une source portée porte la clé de son porteur, `portee/<id>` (#3811)', () => {
    const porteur = { id: 'mage', kind: 'heros', pos: { x: 1, y: 1 }, wounds: { current: 10, max: 10 }, conditions: [], traits: [], talents: [], activeEffects: [{ light: { radiusM: 6 } }] } as unknown as Combatant;
    const { sources } = lumiereDeLaScene({ ...etat(emptyScene('scene-test', 4, 4), MIDI), party: [porteur] }, 'tactique');
    expect(sources.map((source) => source.cle)).toEqual(['portee/mage']);
  });
});

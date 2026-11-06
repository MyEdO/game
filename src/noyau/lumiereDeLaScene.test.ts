import { describe, it, expect } from 'vitest';
import { lumiereDeLaScene } from './lumiereDeLaScene';
import { emptyScene, type Scene } from './monde/scene';

const MIDI = 12 * 60;
const MINUIT = 0;

function etat(scene: Scene, gameTime: number, lightLevel: number | null = null) {
  return { scene, battle: null, party: [], partyPos: { x: 0, y: 0 }, gameTime, lightLevel };
}

describe('lumiereDeLaScene', () => {
  it('un extérieur à midi : un soleil au-dessus de l’horizon, un ciel, une ambiante de jour', () => {
    const s = emptyScene('scene-test', 4, 4);
    const l = lumiereDeLaScene(etat(s, MIDI));
    expect(l.soleil?.vers.y).toBeGreaterThan(0.5);
    expect(l.soleil!.energie).toBeGreaterThan(0);
    expect(l.ciel).not.toBeNull();
    expect(l.ambiante.energie).toBeGreaterThan(lumiereDeLaScene(etat(s, MINUIT)).ambiante.energie);
  });

  it('un extérieur à minuit : aucun soleil, un ciel plus sombre qu’à midi', () => {
    const s = emptyScene('scene-test', 4, 4);
    const nuit = lumiereDeLaScene(etat(s, MINUIT));
    expect(nuit.soleil).toBeNull();
    const clarte = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(clarte(nuit.ciel!.zenith)).toBeLessThan(clarte(lumiereDeLaScene(etat(s, MIDI)).ciel!.zenith));
  });

  it('un intérieur : ni soleil ni ciel, la brume d’intérieur', () => {
    const s: Scene = { ...emptyScene('scene-test', 4, 4), ambiance: 'interieur' };
    const l = lumiereDeLaScene(etat(s, MIDI));
    expect(l.soleil).toBeNull();
    expect(l.ciel).toBeNull();
    expect(l.brume.finCases).toBeLessThan(lumiereDeLaScene(etat(emptyScene('scene-test', 4, 4), MIDI)).brume.finCases);
  });

  it('la pluie voile le soleil et teinte le ciel', () => {
    const clair = lumiereDeLaScene(etat(emptyScene('scene-test', 4, 4), MIDI));
    const pluie = lumiereDeLaScene(etat({ ...emptyScene('scene-test', 4, 4), weather: 'pluie' }, MIDI));
    expect(pluie.soleil!.energie).toBeLessThan(clair.soleil!.energie);
    expect(pluie.ciel!.zenith).not.toBe(clair.ciel!.zenith);
  });

  it('une mise en scène de ténèbres éteint le soleil et ramène l’ambiante à son plancher', () => {
    const s = emptyScene('scene-test', 4, 4);
    const l = lumiereDeLaScene(etat(s, MIDI, 0));
    expect(l.soleil!.energie).toBe(0);
    expect(l.ambiante.energie).toBeLessThan(lumiereDeLaScene(etat(s, MIDI)).ambiante.energie);
  });
});

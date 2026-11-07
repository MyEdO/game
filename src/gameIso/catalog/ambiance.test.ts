import { describe, it, expect } from 'vitest';
import { lowerFloorDimCss, editorLowerLayerFilterCss } from './ambiance';

describe('voile de couche inférieure — jeu vs éditeur', () => {
  it('le voile ÉDITEUR porte une opacité réelle distincte du voile de JEU (opaque)', () => {
    const gameCss = lowerFloorDimCss();
    const editorCss = editorLowerLayerFilterCss(0.22);
    expect(editorCss).not.toBe(gameCss);
    expect(editorCss).toContain('opacity(0.22)');
    expect(gameCss).not.toMatch(/opacity\(/);
  });

  it("le voile de JEU ne varie JAMAIS avec le réglage de l'éditeur (fonctions indépendantes)", () => {
    const before = lowerFloorDimCss();
    editorLowerLayerFilterCss(0.05);
    editorLowerLayerFilterCss(1);
    expect(lowerFloorDimCss()).toBe(before);
  });

  it('reste basé sur les MÊMES valeurs catalogue (saturate/brightness) que le jeu', () => {
    const gameCss = lowerFloorDimCss();
    const editorCss = editorLowerLayerFilterCss(0.5);
    const [saturateBrightness] = editorCss.split(' opacity(');
    expect(saturateBrightness).toBe(gameCss);
  });
});

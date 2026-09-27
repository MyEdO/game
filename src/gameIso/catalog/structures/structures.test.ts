import { describe, it, expect } from 'vitest';
import { structureAppearance, wallPartColor } from './index';
import { structureAppearances } from '../../../data';
import { MISSING_ID, MISSING_TONE } from '../missing';
import { buildWalls } from '../../builders/walls';
import { wallSvg } from '../../authoring/wallsSvg';
import { emptyScene, type Scene, type WallSeg } from '../../../state/scene';
import type { Dims } from '../../../geometry/iso';

const DIMS: Dims = { w: 6, h: 6 }; // iso (view non défini)

function sceneWith(seg: WallSeg): Scene {
  const s = emptyScene(6, 6);
  s.walls = [seg];
  return s;
}

describe('apparence de structure (JSON partagé iso/POV)', () => {
  it('les 19 apparences sont présentes (#832 : les 17 historiques + la cloison basse ; #1883 : le garde-corps)', () => {
    const ids = structureAppearances.map((s) => s.id).sort();
    expect(ids).toEqual([
      'cloison-basse-a-ossature-en-bois',
      'cloture-en-clayonnage',
      'garde-corps',
      'herse',
      'mantelet-de-bois',
      'mur-a-ossature-en-bois',
      'mur-de-chateau',
      'mur-de-forteresse-naine',
      'mur-de-pierre-aa',
      'mur-en-bois',
      'mur-en-pierre',
      'mur-en-pierres-seches',
      'palissade-de-pieux',
      'plain',
      'porte',
      'porte-blindee',
      'porte-de-ville',
      'solide-porte-en-bois',
      'terrassement',
    ]);
  });

  it('mur-a-ossature-en-bois : réutilise detail.timber (poteaux plus serrés que mur-en-bois)', () => {
    const app = structureAppearance('mur-a-ossature-en-bois');
    expect(app.detail?.timber).toBeDefined();
    expect(app.detail!.timber!.postEveryM).toBeLessThan(structureAppearance('mur-en-bois').detail!.timber!.postEveryM);
    expect(app.face).not.toBe(structureAppearance('mur-en-bois').face);
  });

  it('mur-en-pierre : arase + parapet crénelé ; porte-de-ville : claire-voie de 6 barreaux', () => {
    // L'apparence dit ce qu'elle PEINT : le couronnement d'arase que `wallPartColor` sert aux parties
    // `arase`/`merlon`, et le parapet qui les pose — des COULEURS, seul canal que le rendu consulte.
    expect(structureAppearance('mur-en-pierre').cap).toBeDefined();
    expect(structureAppearance('mur-en-pierre').parapet).toBeDefined();
    expect(structureAppearance('porte-de-ville').claireVoie?.bars).toBe(6);
  });

  it('bois : couleur de base par partie (plus de palette pré-ombrée faceN/faceE)', () => {
    const wood = structureAppearance('mur-en-bois').wood!;
    expect(wood.inset).toMatch(/^#/);
    expect(wood).not.toHaveProperty('faceN');
  });

  it('id ABSENT (façade hors préset) ou PRÉSENT hors catalogue → repli VISIBLE, jamais le mur nu (#877)', () => {
    expect(structureAppearance(undefined).id).toBe(MISSING_ID);
    const missing = structureAppearance('inconnu');
    expect(missing.id).toBe(MISSING_ID);
    expect(missing.face).toBe(MISSING_TONE);
    expect(structureAppearances.map((s) => s.id)).not.toContain(MISSING_ID); // hors catalogue : jamais posable
  });

  it('le pipeline murs (buildWalls + backend affine) consomme la donnée : la face du JSON apparaît dans le SVG', () => {
    const wood = wallSvg(buildWalls(sceneWith({ x: 1, y: 1, side: 'E' }))[0], DIMS); // 'plain' bois
    expect(wood).toContain(structureAppearance('plain').face); // #6e5940 (face E = SIDE_LIT identité)
    const stone = wallSvg(buildWalls(sceneWith({ x: 1, y: 1, side: 'E', structure: 'mur-en-pierre' }))[0], DIMS);
    expect(stone).toContain(structureAppearance('mur-en-pierre').face); // palette pierre UNIFIÉE (hex du JSON)
  });

  it('mur FENÊTRÉ : wallSvg pose la croisée (verre froid le jour) ; NUIT → ambre émissif + class="warm"', () => {
    const el = buildWalls(sceneWith({ x: 1, y: 1, side: 'E', window: true }))[0];
    const day = wallSvg(el, DIMS);
    expect(day).toContain(structureAppearance('plain').window!.glass); // verre froid du JOUR (hex de la def)
    expect(day).not.toContain('class="warm"');
    const night = wallSvg(el, DIMS, { night: true });
    expect(night).toContain('class="warm"'); // vitre allumée
    expect(night).toContain(structureAppearance('plain').window!.lit); // ambre émissif de la def
  });

  it('wallPartColor : couleur de base par PART depuis les champs de la def (source unique des 2 backends)', () => {
    const bois = structureAppearance('plain');
    expect(wallPartColor(bois, 'face')).toBe(bois.face);
    expect(wallPartColor(bois, 'panneau')).toBe(bois.wood!.inset);
    expect(wallPartColor(bois, 'gravats')).toBe(bois.wood!.rubble); // repli bois (pas de rubble pierre)
    const pierre = structureAppearance('mur-en-pierre');
    expect(wallPartColor(pierre, 'bande')).toBe(pierre.band);
    expect(wallPartColor(pierre, 'merlon')).toBe(pierre.cap);
    const porte = structureAppearance('porte-de-ville');
    expect(wallPartColor(porte, 'traverse')).toBe(porte.claireVoie!.traverseColor);
  });
});

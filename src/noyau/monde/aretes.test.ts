import { describe, it, expect } from 'vitest';
import { areteDessinee, aretesDeLaCouche, plateauDeLaScene } from './aretes';
import { emptyScene, setDoorOpen, setDoorRevealed, setStructureDown, type Scene, type WallSeg } from './scene';
import { METRES_PER_LEVEL } from './relief';
import { structureAppearances } from '../../data';

/** Une scène dont `walls` sont les murs, et dont un corps de bâtiment porte une façade d'auberge sur l'arête nord de (1, 1). */
function scene(walls: WallSeg[]): Scene {
  return {
    ...emptyScene('aretes', 4, 4),
    walls,
    architecture: [{ id: 'auberge', storeys: [], masses: [], facades: [{ id: 'devanture', z: 0, edges: [{ x: 1, y: 1, side: 'N' }], appearance: 'auberge-relais-imperiale' }] }],
  };
}

describe('areteDessinee — la pièce', () => {
  const piece = (s: Scene, seg: WallSeg) => areteDessinee(s, seg).piece;
  it('un mur plein, une fenêtre aux volets ouverts ou clos', () => {
    expect(piece(scene([]), { x: 0, y: 0, side: 'N' })).toBe('mur');
    expect(piece(scene([]), { x: 0, y: 0, side: 'N', window: true })).toBe('fenetre');
    expect(piece(scene([]), { x: 0, y: 0, side: 'N', window: true, shuttered: true })).toBe('fenetre-close');
  });
  it('une porte fermée, puis ouverte en jeu', () => {
    const porte: WallSeg = { x: 0, y: 0, side: 'E', door: true, closed: true };
    const s = scene([porte]);
    expect(piece(s, porte)).toBe('porte-fermee');
    expect(piece(setDoorOpen(s, 0, 0, 'E', 0, true), porte)).toBe('porte-ouverte');
  });
  it('une porte secrète est un mur tant qu’elle n’est pas révélée', () => {
    const secrete: WallSeg = { x: 0, y: 0, side: 'E', door: true, closed: true, secret: { difficulty: 'complexe', face: 'les-deux' } };
    const s = scene([secrete]);
    expect(piece(s, secrete)).toBe('mur');
    expect(piece(setDoorRevealed(s, 0, 0, 'E', 0, true), secrete)).toBe('porte-fermee');
  });
  it('une structure abattue est une brèche', () => {
    const mur: WallSeg = { x: 0, y: 0, side: 'N', structure: 'mur-en-pierre' };
    expect(piece(setStructureDown(scene([mur]), 0, 0, 'N', 0, true), mur)).toBe('breche');
  });
});

describe('areteDessinee — la famille du kit et la hauteur', () => {
  const apparence = (id: string) => structureAppearances.find((a) => a.id === id)!;
  it('la famille de l’apparence du segment : la sienne, sinon celle de sa structure, sinon celle du mur nu', () => {
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N', structure: 'mur-en-pierres-seches' }).famille).toBe(apparence('mur-en-pierres-seches').kit);
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N', structure: 'mur-en-pierres-seches', appearance: 'cloture-en-clayonnage' }).famille).toBe(apparence('cloture-en-clayonnage').kit);
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N' }).famille).toBe(apparence('plain').kit);
  });
  it('sur une façade authorée, celle du mur de la façade, tant que le segment ne pose ni structure ni apparence', () => {
    expect(areteDessinee(scene([]), { x: 1, y: 1, side: 'N' }).famille).toBe(apparence('mur-a-ossature-en-bois').kit);
    expect(areteDessinee(scene([]), { x: 1, y: 1, side: 'N', structure: 'mur-en-pierre' }).famille).toBe('pierre');
  });
  it('aucune famille pour une apparence hors du catalogue', () => {
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N', appearance: 'inconnue' }).famille).toBeNull();
  });
  it('la hauteur du mur de l’apparence, sinon un étage', () => {
    const basse = structureAppearances.find((a) => a.wallHeightM !== undefined)!;
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N', appearance: basse.id }).hauteurM).toBe(basse.wallHeightM);
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N' }).hauteurM).toBe(METRES_PER_LEVEL);
  });
});

describe('aretesDeLaCouche', () => {
  it('les arêtes de la couche, chacune posée au milieu de son côté et dans son sens', () => {
    const s = scene([{ x: 1, y: 2, side: 'N' }, { x: 1, y: 2, side: 'E', z: 1 }]);
    expect(aretesDeLaCouche(s, 0).map(({ case: c, milieu, sens }) => ({ c, milieu, sens }))).toEqual([{ c: { x: 1, y: 2 }, milieu: { x: 1, y: 1.5 }, sens: { x: 1, y: 0 } }]);
    expect(aretesDeLaCouche(s, 1).map(({ milieu, sens }) => ({ milieu, sens }))).toEqual([{ milieu: { x: 1.5, y: 2 }, sens: { x: 0, y: 1 } }]);
  });
});

describe('plateauDeLaScene — les arêtes de toutes les couches (#3476)', () => {
  it('le mur de l’étage est au plateau, dressé du plancher de l’étage', () => {
    const s = scene([{ x: 0, y: 0, side: 'N' }, { x: 1, y: 1, side: 'E', z: 1 }]);
    s.layers.push({ z: 1, tiles: new Array(16).fill('plancher'), height: new Array(16).fill(METRES_PER_LEVEL) });
    const aretes = plateauDeLaScene(s, []).aretes;
    expect(aretes.map((a) => [a.case, a.pied])).toEqual([[{ x: 0, y: 0 }, 0], [{ x: 1, y: 1 }, METRES_PER_LEVEL]]);
  });
});

describe('plateauDeLaScene — les couronnes abattues (#3476)', () => {
  const abattues = (s: Scene) => plateauDeLaScene(s, []).couronnesAbattues;
  it('la couronne d’un rempart tombe avec lui', () => {
    const rempart: WallSeg = { x: 0, y: 0, side: 'N', structure: 'mur-en-pierre' };
    expect(abattues(scene([rempart]))).toEqual([]);
    expect(abattues(setStructureDown(scene([rempart]), 0, 0, 'N', 0, true))).toEqual(['0,0,N,0']);
  });
  it('celle d’un rempart de l’étage aussi', () => {
    const rempart: WallSeg = { x: 0, y: 0, side: 'N', z: 1, structure: 'mur-en-pierre' };
    expect(abattues(setStructureDown(scene([rempart]), 0, 0, 'N', 1, true))).toEqual(['0,0,N,1']);
  });
  it('celle d’un corps de garde reste sur le linteau de son passage ; un mur sans couronne n’en perd aucune', () => {
    const portail: WallSeg = { x: 0, y: 0, side: 'N', structure: 'porte-de-ville' };
    const palissade: WallSeg = { x: 1, y: 0, side: 'N', structure: 'solide-porte-en-bois' };
    const s = setStructureDown(setStructureDown(scene([portail, palissade]), 0, 0, 'N', 0, true), 1, 0, 'N', 0, true);
    expect(abattues(s)).toEqual([]);
  });
});


describe('plateauDeLaScene — les arêtes que le groupe dégage (#3476)', () => {
  /** Une salle (1..2, 1..2) close de quatre murs, sur une scène sans façade authorée. */
  const salle = (): Scene => ({
    ...emptyScene('salle', 4, 4),
    walls: [{ x: 1, y: 1, side: 'N' }, { x: 2, y: 3, side: 'N' }, { x: 0, y: 1, side: 'E' }, { x: 2, y: 2, side: 'E' }, { x: 3, y: 3, side: 'E' }],
    effectZones: [{ id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 2, h: 2 } }],
  });
  it('un mur qui borde la pièce du groupe, sous les crans de caméra qui le voient du dehors', () => {
    expect(plateauDeLaScene(salle(), [{ x: 1, y: 1 }]).aretesDegagees).toEqual([
      { cle: '1,1,N,0', abattueSous: [2, 3] },
      { cle: '2,3,N,0', abattueSous: [0, 1] },
      { cle: '0,1,E,0', abattueSous: [1, 2] },
      { cle: '2,2,E,0', abattueSous: [0, 3] },
    ]);
  });
  it('aucune hors de la pièce, ni sans groupe', () => {
    expect(plateauDeLaScene(salle(), [{ x: 3, y: 0 }]).aretesDegagees).toEqual([]);
    expect(plateauDeLaScene(salle(), []).aretesDegagees).toEqual([]);
  });
});

describe('plateauDeLaScene — le couvercle d’une pièce sous un étage (#3476)', () => {
  /** La salle (1..2, 1..2) du rez, sous un étage dont le plancher couvre (1..2, 1..2) et dont un mur borde (2, 1). */
  const salleSousEtage = (): Scene => {
    const s = emptyScene('etage', 4, 4);
    s.layers.push({ z: 1, tiles: s.layers[0].tiles.map(() => 'plancher'), height: s.layers[0].tiles.map(() => 4) });
    return {
      ...s,
      walls: [{ x: 2, y: 1, side: 'E', z: 1 }, { x: 0, y: 0, side: 'N', z: 1 }],
      effectZones: [{ id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 2, h: 2 } }],
    };
  };
  it('l’emprise de la pièce à l’étage est au couvercle, et le mur d’étage qui la borde tombe sous tout regard', () => {
    const plateau = plateauDeLaScene(salleSousEtage(), [{ x: 1, y: 1 }]);
    expect(new Set(plateau.couvercle)).toEqual(new Set(['1,1,1', '2,1,1', '1,2,1', '2,2,1']));
    expect(plateau.aretesDegagees.filter((a) => a.cle.endsWith(',1'))).toEqual([{ cle: '2,1,E,1', abattueSous: [0, 1, 2, 3] }]);
  });
  it('rien au couvercle pour le groupe à l’étage ou dehors', () => {
    expect(plateauDeLaScene(salleSousEtage(), [{ x: 1, y: 1, z: 1 }]).couvercle).toEqual([]);
    expect(plateauDeLaScene(salleSousEtage(), [{ x: 3, y: 3 }]).couvercle).toEqual([]);
  });
});

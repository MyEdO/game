import { describe, it, expect } from 'vitest';
import { areteDessinee, aretesDeLaCouche, aretesDeLaScene, masqueDuRegard, plateauDeLaScene, regardDuJeu, REGARDS, type Regard } from './aretes';
import { EYE_H } from './iso';
import type { Pt } from './path';
import { emptyScene, setDoorOpen, setDoorRevealed, setStructureDown, setTileCollapsed, type Scene, type WallSeg } from './scene';
import { volumeDuMonde } from './volume/volume';
import { casesMontrees } from './volume/volume.testkit';
import { depuisBase64 } from '../../lib/base64';
import { METRES_PER_LEVEL } from './relief';
import { structureAppearances, terrains } from '../../data';
import { datasetArray, setDataset } from '../../data/overrides';
import { garanti } from '../../lib/garanti';
import { terrainAbsent } from './terrain';

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
    expect(aretesDeLaCouche(s, 0).map(({ milieu, sens }) => ({ milieu, sens }))).toEqual([{ milieu: { x: 1, y: 1.5 }, sens: { x: 1, y: 0 } }]);
    expect(aretesDeLaCouche(s, 1).map(({ milieu, sens }) => ({ milieu, sens }))).toEqual([{ milieu: { x: 1.5, y: 2 }, sens: { x: 0, y: 1 } }]);
  });
});

describe('aretesDeLaScene — les arêtes de toutes les couches (#3476)', () => {
  it('le mur de l’étage est au plateau, dressé du plancher de l’étage', () => {
    const s = scene([{ x: 0, y: 0, side: 'N' }, { x: 1, y: 1, side: 'E', z: 1 }]);
    s.layers.push({ z: 1, tiles: new Array(16).fill('plancher'), height: new Array(16).fill(METRES_PER_LEVEL) });
    const aretes = aretesDeLaScene(s);
    expect(aretes.map((a) => [a.cle, a.pied])).toEqual([['0,0,N,0', 0], ['1,1,E,1', METRES_PER_LEVEL]]);
  });
});

describe('areteDessinee — les cases qu’elle sépare (#3950)', () => {
  const cases = (s: Scene, seg: WallSeg) => areteDessinee(s, seg).cases;
  it('la case du segment puis sa voisine à travers son côté, à la couche du segment', () => {
    expect(cases(scene([]), { x: 1, y: 2, side: 'N' })).toEqual([{ x: 1, y: 2, z: 0 }, { x: 1, y: 1, z: 0 }]);
    expect(cases(scene([]), { x: 1, y: 2, side: 'E', z: 1 })).toEqual([{ x: 1, y: 2, z: 1 }, { x: 2, y: 2, z: 1 }]);
  });
  it('au bord de la carte, la seule case dans la carte', () => {
    expect(cases(scene([]), { x: 2, y: 0, side: 'N' })).toEqual([{ x: 2, y: 0, z: 0 }]);
    expect(cases(scene([]), { x: 3, y: 1, side: 'E' })).toEqual([{ x: 3, y: 1, z: 0 }]);
  });
});

describe('areteDessinee — le bloc (#3948)', () => {
  it('le bloc de la case du segment à sa couche, celui du morceau du monde de la même case', () => {
    const s: Scene = { ...emptyScene('blocs', 12, 12), walls: [{ x: 1, y: 2, side: 'N' }, { x: 9, y: 3, side: 'E' }, { x: 2, y: 10, side: 'N', z: 1 }] };
    s.layers.push({ z: 1, tiles: new Array(144).fill('plancher'), height: new Array(144).fill(METRES_PER_LEVEL) });
    const aretes = aretesDeLaScene(s);
    expect(aretes.map((a) => a.bloc)).toEqual(['0/0/0', '0/1/0', '1/0/1']);
    const cles = new Set(volumeDuMonde(s).morceaux.map((m) => m.cle));
    for (const a of aretes) expect(cles, a.cle).toContain(`sol/${a.bloc}`);
  });
});

describe('plateauDeLaScene — les couronnes abattues (#3476)', () => {
  const abattues = (s: Scene) => plateauDeLaScene(s, [], 'tactique').couronnesAbattues;
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
    expect(plateauDeLaScene(salle(), [{ x: 1, y: 1 }], 'tactique').aretesDegagees).toEqual([
      { cle: '1,1,N,0', abattueSous: [2, 3] },
      { cle: '2,3,N,0', abattueSous: [0, 1] },
      { cle: '0,1,E,0', abattueSous: [1, 2] },
      { cle: '2,2,E,0', abattueSous: [0, 3] },
    ]);
  });
  it('aucune hors de la pièce, ni sans groupe', () => {
    expect(plateauDeLaScene(salle(), [{ x: 3, y: 0 }], 'tactique').aretesDegagees).toEqual([]);
    expect(plateauDeLaScene(salle(), [], 'tactique').aretesDegagees).toEqual([]);
  });
  it('sur une même scène, le plateau suit la case du groupe', () => {
    const s = salle();
    const dedans = plateauDeLaScene(s, [{ x: 1, y: 1 }], 'tactique').aretesDegagees;
    expect(dedans).toHaveLength(4);
    expect(plateauDeLaScene(s, [{ x: 3, y: 0 }], 'tactique').aretesDegagees).toEqual([]);
    expect(plateauDeLaScene(s, [{ x: 1, y: 1 }], 'tactique').aretesDegagees).toEqual(dedans);
    expect(plateauDeLaScene(s, [{ x: 3, y: 0 }, { x: 1, y: 1 }], 'tactique').aretesDegagees, 'un second allié dans la pièce').toEqual(dedans);
  });
  it('relu sans que la scène ni les cases du groupe aient changé, le plateau est celui déjà rendu', () => {
    const s = salle();
    expect(plateauDeLaScene(s, [{ x: 1, y: 1 }], 'tactique')).toBe(plateauDeLaScene(s, [{ x: 1, y: 1 }], 'tactique'));
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
  /** Les cases du volume que le masque du regard laisse montrées, `x,y,z`. */
  const cases = (allies: Pt[], regard: Regard) => {
    const s = salleSousEtage();
    return casesMontrees(volumeDuMonde(s), masqueDuRegard(s, allies, regard));
  };
  it('l’emprise de la pièce à l’étage est retirée, et le mur d’étage qui la borde tombe sous tout cran', () => {
    const etage = cases([{ x: 1, y: 1 }], 'tactique');
    expect(['1,1,1', '2,1,1', '1,2,1', '2,2,1'].filter((c) => etage.has(c))).toEqual([]);
    expect(etage.has('0,0,1') && etage.has('1,1,0')).toBe(true);
    const plateau = plateauDeLaScene(salleSousEtage(), [{ x: 1, y: 1 }], 'tactique');
    expect(plateau.aretesDegagees.filter((a) => a.cle.endsWith(',1'))).toEqual([{ cle: '2,1,E,1', abattueSous: [0, 1, 2, 3] }]);
    expect(plateau.cleDuRetrait).not.toBe(plateauDeLaScene(salleSousEtage(), [{ x: 3, y: 3 }], 'tactique').cleDuRetrait);
  });
  it('rien n’est retiré pour le groupe à l’étage ou dehors', () => {
    const entier = cases([], 'immersion');
    expect(cases([{ x: 1, y: 1, z: 1 }], 'tactique')).toEqual(entier);
    expect(cases([{ x: 3, y: 3 }], 'tactique')).toEqual(entier);
  });
});

describe('plateauDeLaScene — ce que chaque regard retire (#3476)', () => {
  /** Une salle au rez, bordée d'un mur, sous un étage dont un mur borde (2, 1). */
  const maison = (): Scene => {
    const s = emptyScene('maison', 4, 4);
    s.layers.push({ z: 1, tiles: s.layers[0].tiles.map(() => 'plancher'), height: s.layers[0].tiles.map(() => 4) });
    return {
      ...s,
      walls: [{ x: 1, y: 1, side: 'N' }, { x: 2, y: 1, side: 'E', z: 1 }],
      effectZones: [{ id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 2, h: 2 } }],
    };
  };
  it('au plateau, rien au-dessus de la couche du groupe : ni case du volume, ni arête, sous tout cran', () => {
    const plateau = plateauDeLaScene(maison(), [{ x: 3, y: 3 }], 'plateau');
    expect(plateau.aretesDegagees).toEqual([{ cle: '2,1,E,1', abattueSous: [0, 1, 2, 3] }]);
    const s = maison();
    expect([...casesMontrees(volumeDuMonde(s), masqueDuRegard(s, [{ x: 3, y: 3 }], 'plateau'))].every((c) => c.endsWith(',0'))).toBe(true);
    expect(plateauDeLaScene(maison(), [{ x: 3, y: 3, z: 1 }], 'plateau').aretesDegagees).toEqual([]);
  });
  it('sur une même scène, le plateau suit la couche du groupe', () => {
    const s = maison();
    expect(plateauDeLaScene(s, [{ x: 3, y: 3 }], 'plateau').aretesDegagees).toEqual([{ cle: '2,1,E,1', abattueSous: [0, 1, 2, 3] }]);
    expect(plateauDeLaScene(s, [{ x: 3, y: 3, z: 1 }], 'plateau').aretesDegagees).toEqual([]);
  });
  it('en immersion, rien ne tombe ni n’est retiré, même sous un étage', () => {
    const plateau = plateauDeLaScene(maison(), [{ x: 1, y: 1 }], 'immersion');
    expect([plateau.aretesDegagees, plateau.toitsLeves]).toEqual([[], []]);
    expect(depuisBase64(masqueDuRegard(maison(), [{ x: 1, y: 1 }], 'immersion').masque).every((o) => o === 0)).toBe(true);
  });
  it('la clé du monde suit les tuiles effondrées, pas la couche du groupe ; la clé du retrait suit la couche du groupe', () => {
    const rez = plateauDeLaScene(maison(), [{ x: 3, y: 3 }], 'plateau');
    const etage = plateauDeLaScene(maison(), [{ x: 3, y: 3, z: 1 }], 'plateau');
    expect(etage.cleDuMonde).toBe(rez.cleDuMonde);
    expect(etage.cleDuRetrait).not.toBe(rez.cleDuRetrait);
    expect(plateauDeLaScene(setTileCollapsed(maison(), 2, 2, 1), [{ x: 3, y: 3 }], 'plateau').cleDuMonde).not.toBe(rez.cleDuMonde);
  });
  it('le regard publié et l’œil à hauteur d’homme', () => {
    const plateaux = REGARDS.map((r) => plateauDeLaScene(maison(), [{ x: 1, y: 1 }], r));
    expect(plateaux.map((p) => p.regard)).toEqual(REGARDS);
    expect(plateaux.map((p) => p.regardSuivant)).toEqual(['plateau', 'immersion', 'tactique']);
    expect(plateaux[0].oeilM).toBe(EYE_H);
  });
  it('la clé du monde suit la météo que le regard montre, et elle seule : ni le regard ni la météo d’un intérieur ne la changent', () => {
    const cle = (s: Scene, r: Regard) => plateauDeLaScene(s, [{ x: 1, y: 1 }], r).cleDuMonde;
    const sec = cle(maison(), 'tactique');
    expect(REGARDS.map((r) => cle(maison(), r)), 'sans météo, le regard ne la change pas').toEqual(REGARDS.map(() => sec));
    for (const weather of ['pluie', 'brouillard'] as const)
      expect(REGARDS.map((r) => cle({ ...maison(), ambiance: 'interieur', weather }, r)), `${weather} en intérieur`).toEqual(REGARDS.map(() => sec));
    const pluie: Scene = { ...maison(), weather: 'pluie' };
    expect(cle(pluie, 'tactique'), 'la pluie montrée').not.toBe(sec);
    expect(cle(pluie, 'plateau'), 'au plateau, la pluie ne tombe pas').not.toBe(cle(pluie, 'tactique'));
    expect(cle(pluie, 'immersion'), 'la même pluie montrée, la même clé').toBe(cle(pluie, 'tactique'));
    expect(cle({ ...maison(), weather: 'brouillard' }, 'tactique'), 'une autre météo montrée').not.toBe(cle(pluie, 'tactique'));
  });
  it('l’immersion cède à la tactique en combat', () => {
    expect(regardDuJeu('immersion', true)).toBe('tactique');
    expect(regardDuJeu('immersion', false)).toBe('immersion');
    expect(regardDuJeu('plateau', true)).toBe('plateau');
  });
});

describe('les arêtes dessinées suivent le catalogue des terrains édité (#4040)', () => {
  it('une case de face devenue absente ne porte plus le pied de l’arête : la clé des arêtes change, puis revient', () => {
    const base = emptyScene('pied', 4, 4);
    const sol = base.layers[0].tiles[0];
    const autre = garanti(terrains.find((t) => t.id !== sol && !t.absence && !t.bordDuMonde), 'terrain', 'autre que la semence').id;
    const bas = 2 * 4 + 1;
    const s: Scene = {
      ...base,
      layers: [{ ...base.layers[0], tiles: base.layers[0].tiles.map((t, i) => (i === bas ? autre : t)), height: base.layers[0].tiles.map((_, i) => (i === bas ? 0 : 2)) }],
      walls: [{ x: 1, y: 2, side: 'N' }],
    };
    const lu = () => plateauDeLaScene(s, [{ x: 3, y: 3, z: 0 }], 'tactique');
    expect(s.layers[0].tiles.filter((t) => t === autre), `seule la case (1, 2) porte « ${autre} »`).toHaveLength(1);
    const avant = lu();
    expect(areteDessinee(s, { x: 1, y: 2, side: 'N' }).pied, `la case (1, 2) de « ${autre} », au sol 0, porte le pied`).toBe(0);
    const catalogue = [...datasetArray('terrains')];
    const vide = terrainAbsent();
    try {
      setDataset('terrains', catalogue.map((t) => (t.id === autre ? { ...t, absence: true } : t.id === vide ? { ...t, absence: undefined } : t)));
      expect(lu().cleDesAretes, `« ${autre} » absent : la clé des arêtes change`).not.toBe(avant.cleDesAretes);
      expect(aretesDeLaScene(s).map((a) => a.pied), `« ${autre} » absent : le pied passe à la case (1, 1), au sol 2`).toEqual([2]);
    } finally {
      setDataset('terrains', catalogue);
    }
    expect(lu().cleDesAretes, 'catalogue restauré : la clé des arêtes d’avant').toBe(avant.cleDesAretes);
  });
});

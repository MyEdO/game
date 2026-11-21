import { describe, expect, it } from 'vitest';
import { cotesDeMarchesDeLaCouche, cotesDeMarchesDeLaScene, type CoteDeMarches } from './cotesDeMarches';
import { plateauDeLaScene } from './aretes';
import { emptyScene, type Scene } from './scene';
import { fillTerrainRect, paintHeight, setEdgeWall } from '../sceneEdit';
import { METRES_PER_LEVEL, STEP_MAX_M } from './relief';

/** Une scène de 6 × 6 cases du terrain `terrain`, une volée de `largeur` cases de large dans les colonnes 2 et
 *  suivantes, montant vers le nord d'un mètre par case de (·,4) au sol à (·,1) à 3 m, le palier (·,0) à 3 m ; avec
 *  `mur`, un mur à l'ouest de la volée, de (2,1) à (2,4). */
function volee(largeur = 1, terrain = 'plancher', mur = true): Scene {
  let s = fillTerrainRect(emptyScene('volee', 6, 6), { x: 0, y: 0, w: 6, h: 6 }, terrain);
  for (let x = 2; x < 2 + largeur; x++)
    for (const [y, h] of [[0, 3], [1, 3], [2, 2], [3, 1]] as const) s = paintHeight(s, { x, y }, h, 1);
  if (mur) for (let y = 1; y <= 4; y++) s = setEdgeWall(s, 1, y, 'E', 0, 'wall');
  return s;
}

const resume = (c: CoteDeMarches) => `${c.case.x},${c.case.y} ${c.cote} ${c.classe} ${c.pieces.join('+')}`;

describe('cotesDeMarchesDeLaScene — les côtés d’une volée (#4471)', () => {
  it('volée droite, un mur à l’ouest, le sol à l’est : rien sous le mur, un limon contre le sol rejoint, limon et rampe au-dessus du sol plus bas d’un pas', () => {
    expect(cotesDeMarchesDeLaScene(volee()).map(resume)).toEqual([
      '2,1 E vide limon+rampe',
      '2,2 E vide limon+rampe',
      '2,3 E vide limon+rampe',
      '2,4 E rejointe limon',
    ]);
  });

  it('un côté sur un sol qu’on rejoint à pied : un limon tant qu’aucun bout du bord ne le surplombe de plus d’un pas, limon et rampe au-delà', () => {
    const parCase = new Map(cotesDeMarchesDeLaScene(volee()).map((c) => [c.case.y, c]));
    expect([parCase.get(4)!.classe, Math.max(parCase.get(4)!.entree, parCase.get(4)!.sortie)]).toEqual(['rejointe', 0.5]);
    expect([parCase.get(3)!.classe, parCase.get(3)!.entree, parCase.get(3)!.sortie]).toEqual(['vide', 0.5, 1.5]);
    expect(parCase.get(3)!.sortie, 'la sortie de (2,3) surplombe le sol à 0 de plus d’un pas').toBeGreaterThan(STEP_MAX_M);
  });

  it('un côté rejoint : sa pose sur le bord est de la case, dehors vers la voisine, famille du kit du terrain', () => {
    const [cote] = cotesDeMarchesDeLaScene(volee(1, 'pierre')).filter((c) => c.case.y === 4);
    expect(cote).toMatchObject({
      cle: 'marches|2,4,0|E', case: { x: 2, y: 4, z: 0 }, classe: 'rejointe', famille: 'pierre',
      cases: [{ x: 2, y: 4, z: 0 }, { x: 3, y: 4, z: 0 }], milieu: { x: 2.5, y: 4 }, sens: { x: 0, y: -1 }, bloc: '0/0/0',
    });
    expect([-cote.sens.y, cote.sens.x], 'le dehors, vers la voisine').toEqual([1, 0]);
    expect([cote.entree, cote.sortie, cote.pied]).toEqual([0, 0.5, 0.25]);
    expect(cotesDeMarchesDeLaScene(volee()).every((c) => c.famille === 'bois')).toBe(true);
  });

  it('volée de deux cases de large : aucun côté entre ses deux files', () => {
    expect(cotesDeMarchesDeLaScene(volee(2)).map(resume)).toEqual([
      '3,1 E vide limon+rampe',
      '3,2 E vide limon+rampe',
      '3,3 E vide limon+rampe',
      '3,4 E rejointe limon',
    ]);
  });

  it('les cotes de deux cases voisines de la volée se rejoignent au coin qu’elles partagent', () => {
    const parCase = new Map(cotesDeMarchesDeLaScene(volee()).map((c) => [c.case.y, c]));
    for (const y of [1, 2, 3]) expect(parCase.get(y + 1)!.sortie, `(2,${y + 1}) puis (2,${y})`).toBe(parCase.get(y)!.entree);
    expect(parCase.get(2)!.entree).toBe(1.5);
  });

  it('une voisine plus haute qu’on rejoint à pied ne reçoit aucun côté : sa contremarche borde la case', () => {
    const haute = paintHeight(volee(), { x: 3, y: 3 }, 2, 1);
    expect(cotesDeMarchesDeLaScene(haute).filter((c) => c.case.y === 3)).toEqual([]);
  });

  it('la place de chaque rampe dans sa suite, rangée dans le sens de ses côtés : gauche au bout -X (son entrée), droite au bout +X, seule sans voisine ou sans rampe', () => {
    const place = (s: Scene) => cotesDeMarchesDeLaScene(s).map((c) => `${c.case.x},${c.case.y} ${c.cote} ${c.position}`);
    expect(place(volee(1, 'plancher', false)), 'à l’est le sens va au nord, à l’ouest au sud').toEqual([
      '2,1 E droite', '2,1 O gauche',
      '2,2 E milieu', '2,2 O milieu',
      '2,3 E gauche', '2,3 O droite',
      '2,4 E seule', '2,4 O seule',
    ]);
    expect(place(paintHeight(volee(1, 'plancher', false), { x: 3, y: 2 }, 2, 1)), 'un limon sans rampe coupe la suite à l’est').toEqual([
      '2,1 E seule', '2,1 O gauche',
      '2,2 E seule', '2,2 O milieu',
      '2,3 E seule', '2,3 O droite',
      '2,4 E seule', '2,4 O seule',
    ]);
  });

  it('les côtés d’une couche, ceux de cette couche seuls', () => {
    expect(cotesDeMarchesDeLaCouche(volee(), 0)).toEqual(cotesDeMarchesDeLaScene(volee()));
    expect(cotesDeMarchesDeLaCouche(volee(), 1)).toEqual([]);
  });
});

describe('plateauDeLaScene — les côtés de marches au plateau (#4471)', () => {
  it('sous le regard du plateau, ceux d’une couche au-dessus du groupe tombent sous tout cran', () => {
    const base = volee();
    const etage: Scene = { ...base, layers: [...base.layers, { z: 1, tiles: base.layers[0].tiles, height: base.layers[0].height!.map((h) => h + METRES_PER_LEVEL) }] };
    const degagees = plateauDeLaScene(etage, [{ x: 0, y: 5, z: 0 }], 'plateau').aretesDegagees;
    expect(degagees.filter((a) => a.cle.startsWith('marches|')).map((a) => [a.cle, a.abattueSous])).toEqual(
      cotesDeMarchesDeLaCouche(etage, 1).map((c) => [c.cle, [0, 1, 2, 3]]),
    );
    expect(cotesDeMarchesDeLaCouche(etage, 1), 'l’étage, sans mur, porte les côtés est et ouest de sa volée').toHaveLength(8);
  });

  it('la clé des arêtes change quand un côté de marches change', () => {
    const cle = (s: Scene) => plateauDeLaScene(s, [], 'immersion').cleDesAretes;
    expect(cle(paintHeight(volee(), { x: 3, y: 2 }, 2, 1))).not.toBe(cle(volee()));
  });
});

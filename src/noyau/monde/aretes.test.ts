import { describe, it, expect } from 'vitest';
import {
  areteDessinee, aretesDeLaCouche, aretesDeLaScene, masqueDuRegard, natureDOuverture, paletteDeLApparence,
  plateauDeLaScene, regardDuJeu, REGARDS, type AreteDessinee, type Regard,
} from './aretes';
import { EYE_H } from './iso';
import type { Pt } from './path';
import { allBuiltinCampaigns, paquetDuJeu } from '../../scenes/campaign';
import { emptyScene, setDoorOpen, setDoorRevealed, setStructureDown, setTileCollapsed, type Scene, type WallSeg } from './scene';
import { edgeKey } from './facades';
import { volumeDuMonde } from './volume/volume';
import { casesMontrees } from './volume/volume.testkit';
import { depuisBase64 } from '../../lib/base64';
import { METRES_PER_LEVEL } from './relief';
import { structureAppearances, terrains } from '../../data';
import { datasetArray, setDataset } from '../../data/overrides';
import { garanti } from '../../lib/garanti';
import { terrainAbsent } from './terrain';
import { paintHeight } from '../sceneEdit';

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
  it('une échelle (LDB 15 l.55), haute du dénivelé des deux cases qu’elle sépare, dressée de la plus basse', () => {
    const echelle: WallSeg = { x: 1, y: 2, side: 'N', climb: { kind: 'ladder' } };
    const s = paintHeight(scene([echelle]), { x: 1, y: 1 }, 3, 1);
    expect(areteDessinee(s, echelle)).toMatchObject({ piece: 'echelle', hauteurM: 3, pied: 0 });
    expect(piece(s, { ...echelle, climb: { kind: 'surface' } }), 'une paroi à escalader reste un mur').toBe('mur');
  });
  it('une échelle qui monte à l’étage, de cases plates au rez, haute de la cote de la case de l’étage où elle mène moins son pied', () => {
    const echelle: WallSeg = { x: 1, y: 2, side: 'N', climb: { kind: 'ladder' } };
    const base = scene([echelle]);
    const etage = 3.5;
    const s: Scene = { ...base, layers: [...base.layers, {
      z: 1, tiles: base.layers[0].tiles.map((t, i) => (i === 4 + 1 ? t : terrainAbsent())), height: base.layers[0].tiles.map(() => etage),
    }] };
    const { sens, ...dessinee } = areteDessinee(s, echelle);
    expect(dessinee).toMatchObject({ piece: 'echelle', pied: 0, hauteurM: etage });
    expect({ x: -sens.y + 0, y: sens.x + 0 }, 'dehors vers le pied, au sud').toEqual({ x: 0, y: 1 });
  });
  it('le dehors d’une échelle, à (-sens.y, sens.x), va vers la plus basse des deux cases, d’où on la monte', () => {
    const echelle: WallSeg = { x: 1, y: 2, side: 'N', climb: { kind: 'ladder' } };
    const dehors = (haussee: Pt) => { const { sens } = areteDessinee(paintHeight(scene([echelle]), haussee, 3, 1), echelle); return { x: -sens.y + 0, y: sens.x + 0 }; };
    expect(dehors({ x: 1, y: 1 }), 'la case du nord haussée : vers le sud').toEqual({ x: 0, y: 1 });
    expect(dehors({ x: 1, y: 2 }), 'la case du sud haussée : vers le nord').toEqual({ x: 0, y: -1 });
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
    expect(areteDessinee(scene([]), { x: 1, y: 1, side: 'N', structure: 'mur-en-pierre' }).famille)
      .toBe(apparence('mur-en-pierre').kit);
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

describe('areteDessinee — la palette de l’apparence (#4471)', () => {
  const apparence = (id: string) => structureAppearances.find((a) => a.id === id)!;
  /** Une apparence qui déclare chaque couleur que lit la palette, toutes distinctes, d'après `porte-de-ville`. */
  const declaree = (base: string, teinte: (rang: number) => string) => {
    const ville = apparence(base);
    return {
      ...ville,
      face: teinte(1), post: teinte(2), band: teinte(3), rubble: teinte(4),
      detail: { ...ville.detail!, courses: { ...ville.detail!.courses!, joint: teinte(5) } },
      door: { ...ville.door!, leaf: teinte(6), plank: teinte(7), handle: teinte(8), herse: { ...ville.door!.herse!, traverseColor: teinte(9) } },
      window: { glass: teinte(10), lit: teinte(11), frame: teinte(12), mullion: teinte(13) },
    };
  };
  it('une apparence qui les déclare sert les onze emplacements, chacun de sa couleur', () => {
    const a = declaree('porte-de-ville', (rang) => `#0000${rang.toString(16).padStart(2, '0')}`);
    expect(paletteDeLApparence(a)).toEqual({
      corps: a.face, bois: a.post, joint: a.detail.courses.joint, gravats: a.rubble,
      accent: a.door.leaf, vet1: a.window.mullion, metal: a.door.handle, planche: a.door.plank,
      vitre: a.window.glass, barreau: a.band, traverse: a.door.herse.traverseColor,
    });
  });
  it('le mur qui porte fournit le corps, le bois, le joint et les gravats ; l’arête, sa menuiserie', () => {
    const arete = declaree('porte-de-ville', (rang) => `#0000${rang.toString(16).padStart(2, '0')}`);
    const porteur = declaree('porte-de-ville', (rang) => `#00ff${rang.toString(16).padStart(2, '0')}`);
    expect(paletteDeLApparence(arete, porteur)).toEqual({
      corps: porteur.face, bois: porteur.post, joint: porteur.detail.courses.joint, gravats: porteur.rubble,
      accent: arete.door.leaf, vet1: arete.window.mullion, metal: arete.door.handle, planche: arete.door.plank,
      vitre: arete.window.glass, barreau: arete.band, traverse: arete.door.herse.traverseColor,
    });
  });
  it('les replis d’une apparence qui ne les déclare pas, le cadre de sa croisée au vantail d’un mur sans bois', () => {
    const porte = apparence('porte');
    const nu = apparence('plain');
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N', appearance: 'porte' }).palette).toEqual({
      corps: porte.face,
      bois: porte.post,
      joint: porte.detail!.courses!.joint,
      gravats: porte.wood!.rubble,
      accent: porte.door!.leaf,
      vet1: porte.wood!.frame,
      metal: porte.door!.handle,
      planche: porte.door!.plank,
      vitre: nu.window!.glass,
      barreau: porte.face,
      traverse: porte.face,
    });
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N' }).palette).toEqual({
      corps: nu.face,
      bois: nu.post,
      joint: nu.detail!.courses!.joint,
      gravats: nu.wood!.rubble,
      accent: nu.wood!.inset,
      vet1: nu.window!.mullion,
      metal: nu.wood!.cap,
      planche: nu.wood!.skirt,
      vitre: nu.window!.glass,
      barreau: nu.face,
      traverse: nu.face,
    });
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N', appearance: 'mur-en-pierre' }).palette.accent)
      .toBe(apparence('mur-en-pierre').window!.frame);
  });
  it('une croisée qui ne déclare que son bois le donne aux vantaux, sa vitre et son meneau pris aux replis', () => {
    const { door: _porte, wood: _bois, ...pierre } = apparence('mur-de-chateau');
    const croisee = { ...pierre, window: { frame: '#000001' } };
    expect(paletteDeLApparence(croisee)).toMatchObject({
      accent: '#000001',
      vitre: apparence('plain').window!.glass,
      vet1: croisee.post,
    });
  });
  it('aucune couleur pour une apparence hors du catalogue', () => {
    expect(areteDessinee(scene([]), { x: 0, y: 0, side: 'N', appearance: 'inconnue' }).palette).toEqual({});
  });
});

describe('areteDessinee — l’ouverture et le mur qui la porte (#4471)', () => {
  const apparence = (id: string) => structureAppearances.find((a) => a.id === id)!;
  const PORTE = 'solide-porte-en-bois';
  const porte = (x: number, y: number): WallSeg => ({ x, y, side: 'N', door: true, closed: true, structure: PORTE });
  /** `n` portes fermées bout à bout sur la ligne nord de la rangée 1, de (1, 1) à (n, 1), entre le mur `avant` en
   *  (0, 1) et le mur `apres` en (n + 1, 1), chacun omis sans apparence ; en terrain ouvert, le dehors au nord. */
  const rangee = (n: number, avant?: string, apres?: string): Scene => ({
    ...emptyScene('ouverture', n + 3, 3),
    walls: [
      ...(avant ? [{ x: 0, y: 1, side: 'N' as const, structure: avant }] : []),
      ...Array.from({ length: n }, (_, i) => porte(i + 1, 1)),
      ...(apres ? [{ x: n + 1, y: 1, side: 'N' as const, structure: apres }] : []),
    ],
  });
  const portes = (s: Scene) => aretesDeLaScene(s).filter((a) => a.piece === 'porte-fermee');
  const tenue = ({ famille, palette }: AreteDessinee) => ({ famille, palette });
  it.each([
    [1, ['seule']],
    [2, ['droite', 'gauche']],
    [3, ['droite', 'milieu', 'gauche']],
    [4, ['droite', 'milieu', 'milieu', 'gauche']],
  ])('une ouverture de %i arêtes : de -X à +X le long de leur sens commun', (n, positions) => {
    const dessinees = portes(rangee(n));
    expect(dessinees.map((a) => a.position)).toEqual(positions);
    for (const a of dessinees) expect(a.sens).toEqual(dessinees[0].sens);
    const bout = (position: string) => dessinees.find((a) => a.position === position || a.position === 'seule')!;
    const [gauche, droite] = [bout('gauche'), bout('droite')];
    const { sens } = gauche;
    expect((droite.milieu.x - gauche.milieu.x) * sens.x + (droite.milieu.y - gauche.milieu.y) * sens.y).toBe(n - 1);
  });
  it('le sens de l’ouverture est celui de sa première arête qui a un dehors', () => {
    const piece: WallSeg[] = [{ x: 1, y: 1, side: 'N' }, { x: 0, y: 1, side: 'E' }, { x: 1, y: 1, side: 'E' }];
    const [dedans, libre] = [porte(1, 2), porte(2, 2)];
    const seule = areteDessinee({ ...emptyScene('ouverture', 4, 4), walls: [...piece, dedans] }, dedans);
    const s: Scene = { ...emptyScene('ouverture', 4, 4), walls: [...piece, dedans, libre] };
    expect(areteDessinee(s, libre).sens).not.toEqual(areteDessinee({ ...s, walls: [libre] }, libre).sens);
    expect([dedans, libre].map((seg) => areteDessinee(s, seg)).map(({ sens, position }) => ({ sens, position })))
      .toEqual([{ sens: seule.sens, position: 'gauche' }, { sens: seule.sens, position: 'droite' }]);
  });
  it('une autre apparence, un mur entre elles ou une autre couche séparent deux ouvertures', () => {
    const s = rangee(2);
    const position = (walls: WallSeg[]) => aretesDeLaScene({ ...s, walls }).map((a) => a.position);
    const [une, deux] = s.walls!;
    expect(position([une, { ...deux, structure: 'porte' }])).toEqual(['seule', 'seule']);
    expect(position([une, { ...deux, x: 3 }, { x: 2, y: 1, side: 'N' }])).toEqual(['seule', 'seule', 'seule']);
    expect(position([une, { ...deux, z: 1 }])).toEqual(['seule', 'seule']);
  });
  it('une porte prend la famille et les teintes de mur du mur qui la porte, au bout -X, sinon +X', () => {
    const [mur, autre] = [apparence('mur-de-pierre-aa'), apparence('mur-a-ossature-en-bois')];
    const deLaPorte = paletteDeLApparence(apparence(PORTE));
    const melee = (de: typeof mur) => {
      const { corps, bois, joint, gravats } = paletteDeLApparence(de);
      const { accent, vet1, metal, planche, vitre, barreau, traverse } = deLaPorte;
      return { corps, bois, joint, gravats, accent, vet1, metal, planche, vitre, barreau, traverse };
    };
    expect(mur.kit).not.toBe(apparence(PORTE).kit);
    for (const s of [rangee(2, undefined, mur.id), rangee(2, autre.id, mur.id)])
      for (const a of portes(s)) expect(tenue(a)).toEqual({ famille: mur.kit, palette: melee(mur) });
    for (const a of portes(rangee(1, autre.id)))
      expect(tenue(a)).toEqual({ famille: autre.kit, palette: melee(autre) });
  });
  it('une porte prend la hauteur du mur qui la porte, la pièce de son kit étant un pan de ce mur', () => {
    const muret = apparence('mur-en-pierres-seches');
    expect(muret.wallHeightM).not.toBe(apparence(PORTE).wallHeightM);
    for (const a of portes(rangee(2, undefined, muret.id))) expect(a.hauteurM).toBe(muret.wallHeightM);
  });
  it('sans mur qui la porte, une porte garde sa famille ; une porte de ville garde la sienne dans son mur', () => {
    const propre = { famille: apparence(PORTE).kit, palette: paletteDeLApparence(apparence(PORTE)) };
    for (const a of portes(rangee(2))) expect(tenue(a)).toEqual(propre);
    const ville: WallSeg[] = [
      { x: 1, y: 1, side: 'N', structure: 'porte-de-ville' }, { x: 2, y: 1, side: 'N', structure: 'porte-de-ville' },
      { x: 3, y: 1, side: 'N', structure: 'mur-de-pierre-aa' },
    ];
    const dessinees = aretesDeLaScene({ ...emptyScene('ouverture', 5, 3), walls: ville }).slice(0, 2);
    const kit = apparence('porte-de-ville').kit;
    expect(dessinees.map(({ position, famille }) => ({ position, famille })))
      .toEqual([{ position: 'droite', famille: kit }, { position: 'gauche', famille: kit }]);
  });
});

describe('areteDessinee — les ouvertures des campagnes livrées (#4471)', () => {
  /** Les ouvertures de `scene` : pour chacune, sa largeur, sa famille et ses positions dans l'ordre de son sens, la
   *  suite d'arêtes d'une nature d'ouverture (`natureDOuverture`) qui part d'une `seule` ou d'une `gauche` et avance
   *  d'un `sens` jusqu'à sa `droite`. */
  const ouvertures = (scene: Scene) => {
    const segs = new Map((scene.walls ?? []).map((seg) => [edgeKey(seg), seg]));
    const aretes = aretesDeLaScene(scene).filter((a) => natureDOuverture(scene, segs.get(a.cle)!));
    const lieu = (a: AreteDessinee, d = 0) =>
      `${a.cases[0].z}|${a.milieu.x + d * a.sens.x},${a.milieu.y + d * a.sens.y}|${a.sens.x},${a.sens.y}`;
    const parLieu = new Map(aretes.map((a) => [lieu(a), a]));
    return aretes.filter((a) => a.position === 'seule' || a.position === 'gauche').map((premiere) => {
      const suite = [premiere];
      let a = premiere;
      while (a.position !== 'seule' && a.position !== 'droite') {
        const suivante = parLieu.get(lieu(a, 1));
        if (!suivante) break;
        suite.push(suivante);
        a = suivante;
      }
      return { largeur: suite.length, famille: premiere.famille, positions: suite.map((a) => a.position), suite };
    });
  };
  const livrees = allBuiltinCampaigns.flatMap((c) => paquetDuJeu(c).scenes.map((scene) => ({ c, scene })));
  const mesurees = livrees.flatMap(({ c, scene }) =>
    ouvertures(scene).map((o) => ({ ...o, ou: `${c.id}/${scene.id}` })));
  it('chaque ouverture va de -X à +X le long de son sens commun', () => {
    for (const { positions, suite, ou } of mesurees) {
      const attendues = positions.length === 1 ? ['seule']
        : ['gauche', ...Array<string>(positions.length - 2).fill('milieu'), 'droite'];
      expect(positions, ou).toEqual(attendues);
      for (const a of suite) expect(a.sens, ou).toEqual(suite[0].sens);
    }
  });
});

describe('areteDessinee — le sens tourné vers le dehors (#4471)', () => {
  it('chaque mur d’une pièce close a son dehors à (-sens.y, sens.x)', () => {
    const murs: WallSeg[] = [
      { x: 1, y: 1, side: 'N' }, { x: 1, y: 1, side: 'E' }, { x: 1, y: 2, side: 'N' }, { x: 0, y: 1, side: 'E' },
    ];
    const s = scene(murs);
    const centre = { x: 1, y: 1 };
    for (const seg of murs) {
      const { milieu, sens } = areteDessinee(s, seg);
      const versLeDehors = (milieu.x - centre.x) * -sens.y + (milieu.y - centre.y) * sens.x;
      expect(versLeDehors, `${seg.x},${seg.y},${seg.side}`).toBeGreaterThan(0);
    }
  });
});

describe('aretesDeLaCouche', () => {
  it('les arêtes de la couche, au milieu de leur côté, dehors au nord ou à l’est quand les deux le sont', () => {
    const s = scene([{ x: 1, y: 2, side: 'N' }, { x: 1, y: 2, side: 'E', z: 1 }]);
    const poses = (z: number) => aretesDeLaCouche(s, z).map(({ milieu, sens }) => ({ milieu, sens }));
    expect(poses(0)).toEqual([{ milieu: { x: 1, y: 1.5 }, sens: { x: -1, y: 0 } }]);
    expect(poses(1)).toEqual([{ milieu: { x: 1.5, y: 2 }, sens: { x: 0, y: -1 } }]);
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

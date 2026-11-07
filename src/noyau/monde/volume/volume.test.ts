import { describe, it, expect } from 'vitest';
import { couronnesDuMonde, toitsDuMonde, toitsLeves, volumeDuMonde, type VolumeDuMonde } from './volume';
import { nappeKey } from './toits';
import { perimeterWallSegs } from '../../sceneEdit.testkit';
import { emptyScene, sceneMetresPerTile, type Scene } from '../scene';
import { edgeKey } from '../facades';
import { METRES_PER_LEVEL } from '../relief';
import { couleurDeMatiere, recetteDeMatiere, tintVarFactor } from './matieres';
import { parseHex } from '../../../lib/couleurHex';

/** Les triangles du volume, sommets, normale et couleur du premier sommet. */
function triangles(v: VolumeDuMonde) {
  return Array.from({ length: v.positions.length / 9 }, (_, t) => ({
    ys: [1, 4, 7].map((k) => v.positions[t * 9 + k]),
    xs: [0, 3, 6].map((k) => v.positions[t * 9 + k]),
    normale: v.normales.slice(t * 9, t * 9 + 3),
    couleur: v.couleurs.slice(t * 12, t * 12 + 4),
    case: v.cases[t],
  }));
}

function marche(): Scene {
  const s = emptyScene('scene-test', 2, 1);
  s.layers[0].tiles = ['plancher', 'plancher'];
  s.layers[0].height = [0, 1.2];
  return s;
}

describe('volumeDuMonde (#3476)', () => {
  it('trois sommets par triangle : trois nombres par position et par normale, quatre par couleur opaque, une case par triangle', () => {
    const v = volumeDuMonde(marche());
    expect(v.positions.length % 9).toBe(0);
    expect(v.normales.length).toBe(v.positions.length);
    expect(v.couleurs.length).toBe((v.positions.length / 3) * 4);
    expect(v.couleurs.every((c) => c >= 0 && c <= 1)).toBe(true);
    expect(v.cases.length).toBe(v.positions.length / 9);
    expect(triangles(v).every((t) => t.couleur[3] === 1)).toBe(true);
  });

  it('la hauteur de chaque case par couche, la marche de 1,2 m en paroi verticale', () => {
    const s = marche();
    const v = volumeDuMonde(s);
    expect(v.metresParCase).toBe(sceneMetresPerTile(s));
    expect(v.hauteurs).toEqual([{ z: 0, rangees: [[0, 1.2]] }]);
    const tris = triangles(v);
    expect(Math.max(...tris.flatMap((t) => t.ys)), 'le dessus de la case haute').toBe(1.2);
    const parois = tris.filter((t) => Math.abs(t.normale[1]) < 1e-3);
    expect(parois.length, 'une paroi entre les deux cases').toBeGreaterThan(0);
    expect(tris.filter((t) => t.ys.every((y) => y === 1.2)).every((t) => t.case[0] === 1), 'le dessus haut, à la case haute').toBe(true);
  });

  it('le dessus d’une case : normale en haut, dans sa case, la couleur de son terrain à sa variance de teinte', () => {
    const s = emptyScene('scene-test', 1, 1);
    s.layers[0].tiles = ['herbe'];
    const v = volumeDuMonde(s);
    const m = { domain: 'terrain' as const, id: 'herbe' };
    const k = tintVarFactor(recetteDeMatiere(m), { x: 0, y: 0, z: 0 }) / 255;
    const attendue = [...parseHex(couleurDeMatiere(m))!.map((c) => Math.round(Math.min(1, c * k) * 1000) / 1000), 1];
    const dessus = triangles(v).filter((t) => t.normale[1] > 0.99);
    expect(dessus.length).toBeGreaterThan(0);
    expect(dessus.every((t) => t.xs.every((x) => Math.abs(x) <= v.metresParCase / 2 + 1e-3))).toBe(true);
    expect(dessus.map((t) => t.couleur)).toContainEqual(attendue);
  });

  it('la couche active borne le volume : un étage au-dessus d’elle n’y est pas, sans elle toutes les couches y sont', () => {
    const s = emptyScene('scene-test', 1, 1);
    s.layers[0].tiles = ['plancher'];
    s.layers.push({ z: 1, tiles: ['plancher'], height: [3] });
    const haut = (v: VolumeDuMonde) => Math.max(...triangles(v).flatMap((t) => t.ys));
    expect(haut(volumeDuMonde(s))).toBe(3);
    expect(haut(volumeDuMonde(s, 0))).toBe(0);
    expect(volumeDuMonde(s, 1)).toEqual(volumeDuMonde(s));
  });

  it('le couvercle retire du volume les cases qu’il nomme, couche comprise : l’étage au-dessus de la tête, pas le rez', () => {
    const s = emptyScene('scene-test', 2, 1);
    s.layers[0].tiles = ['plancher', 'plancher'];
    s.layers.push({ z: 1, tiles: ['plancher', 'plancher'], height: [3, 3] });
    const cases = (v: VolumeDuMonde) => new Set(triangles(v).map((t) => t.case.join(',')));
    expect(cases(volumeDuMonde(s, undefined, new Set(['0,0,1'])))).toEqual(new Set(['0,0,0', '1,0,0', '1,0,1']));
  });

  it('chaque triangle porte la couche de sa case : le plancher de l’étage à z 1, le sol du rez à z 0', () => {
    const s = emptyScene('scene-test', 1, 1);
    s.layers[0].tiles = ['plancher'];
    s.layers.push({ z: 1, tiles: ['plancher'], height: [3] });
    const tris = triangles(volumeDuMonde(s));
    expect(tris.filter((t) => t.ys.every((y) => y === 3)).map((t) => t.case)).toContainEqual([0, 0, 1]);
    expect(tris.filter((t) => t.ys.every((y) => y === 0)).every((t) => t.case[2] === 0)).toBe(true);
  });

  it('une surface par matière, nommée par son domaine et son id, qui se suivent : le terrain du dessus, le relief de la paroi', () => {
    const s = marche();
    s.reliefDefaults = { ...s.reliefDefaults, cliff: 'pierre' };
    s.layers[0].height = [0, 3];
    const v = volumeDuMonde(s);
    expect(v.surfaces.map((m) => m.debut)).toEqual([0, ...v.surfaces.slice(0, -1).map((m) => m.fin)]);
    expect(v.surfaces[v.surfaces.length - 1].fin).toBe(v.positions.length / 3);
    expect(new Set(v.surfaces.map((m) => m.matiere)).size).toBe(v.surfaces.length);
    const tris = triangles(v);
    const matiere = (t: number) => v.surfaces.find((m) => m.debut <= t * 3 && t * 3 < m.fin)!.matiere;
    expect(tris.flatMap((t, i) => (t.ys.every((y) => y === 3) ? [matiere(i)] : []))).toEqual(expect.arrayContaining(['terrain--plancher']));
    expect(tris.flatMap((t, i) => (Math.abs(t.normale[1]) < 1e-3 ? [matiere(i)] : []))).toContain('relief--pierre');
  });

  it('un décor volumique posé sur sa case : ses faces à sa matière de décor, au-dessus du sol, dans sa case ; aucun au-dessus de la couche active', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].tiles = Array(9).fill('plancher');
    s.layers[0].height = [0, 0, 0, 0, 0.5, 0, 0, 0, 0];
    s.entities.push({ id: 'tonneau-1', kind: 'prop', ref: 'tonneau', pos: { x: 1, y: 1 } });
    const v = volumeDuMonde(s);
    const decor = v.surfaces.filter((m) => m.matiere.startsWith('prop--'));
    expect(decor.length).toBeGreaterThan(0);
    const tris = triangles(v).filter((_, t) => decor.some((m) => m.debut <= t * 3 && t * 3 < m.fin));
    expect(tris.every((t) => t.case[0] === 1 && t.case[1] === 1)).toBe(true);
    expect(Math.min(...tris.flatMap((t) => t.ys))).toBeCloseTo(0.5, 2);
    expect(Math.max(...tris.flatMap((t) => t.ys))).toBeGreaterThan(0.5);
    const etage: Scene = { ...s, entities: [{ ...s.entities[0], z: 1 }], layers: [...s.layers, { z: 1, tiles: Array(9).fill('vide'), height: Array(9).fill(3) }] };
    expect(volumeDuMonde(etage, 0).surfaces.some((m) => m.matiere.startsWith('prop--'))).toBe(false);
  });
});

describe('toitsDuMonde, toitsLeves (#3476)', () => {
  const MAISON = { x: 2, y: 2, w: 4, h: 3 };
  const scene = (): Scene => ({
    ...emptyScene('toits', 10, 8),
    walls: perimeterWallSegs([MAISON]),
    architecture: [{ id: 'bourg', storeys: [], facades: [], masses: [{ id: 'maison', z: 0, footprint: [MAISON], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30, material: 'tuile' }] }],
  });

  it('une nappe par masse, ses pans de couverture et ses pignons de la matière du mur qu’ils prolongent', () => {
    const [nappe, ...autres] = toitsDuMonde(scene());
    expect(autres).toEqual([]);
    expect(nappe.cle).toBe(nappeKey('bourg', 'maison'));
    expect(nappe.surfaces.map((s) => s.matiere).sort()).toEqual(['roof--tuile', 'structure--plain']);
    expect(nappe.positions.length % 9).toBe(0);
    expect(nappe.cases).toHaveLength(nappe.positions.length / 9);
    const hauteurs = nappe.positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...hauteurs), 'le faîte au-dessus de l’égout').toBeGreaterThan(Math.min(...hauteurs));
  });

  it('le groupe sous la nappe la lève ; dehors, aucune', () => {
    expect(toitsLeves(scene(), [{ x: 3, y: 3 }])).toEqual([nappeKey('bourg', 'maison')]);
    expect(toitsLeves(scene(), [{ x: 8, y: 7 }])).toEqual([]);
  });

  it('une scène sans masse n’a aucune nappe', () => {
    expect(toitsDuMonde(emptyScene('nue', 4, 4))).toEqual([]);
  });
});

describe('la crénelure du volume (#3476)', () => {
  const hauteurs = (positions: number[]) => positions.filter((_, i) => i % 3 === 1);

  it('une zone crénelée : sa crête ceinture le chemin de ronde, de la matière de son apparence, au-dessus de sa surface', () => {
    const rempart = (crenellated?: (string | null)[]): Scene => {
      const s = emptyScene('chemin-de-ronde', 3, 1);
      s.layers[0] = { ...s.layers[0], tiles: ['plancher', 'plancher', 'plancher'], height: [0, 4, 0], ...(crenellated ? { crenellated } : {}) };
      return s;
    };
    const nu = volumeDuMonde(rempart());
    const v = volumeDuMonde(rempart([null, 'mur-en-pierre', null]));
    expect(nu.surfaces.map((x) => x.matiere)).not.toContain('structure--mur-en-pierre');
    const crete = v.surfaces.find((x) => x.matiere === 'structure--mur-en-pierre')!;
    const ys = hauteurs(v.positions.slice(crete.debut * 3, crete.fin * 3));
    expect(Math.min(...ys), 'assise à la surface').toBeGreaterThanOrEqual(4);
    expect(Math.max(...ys), 'dressée au-dessus').toBeGreaterThan(4);
  });

  it('une couronne par rempart, nommée par son arête, posée au sommet de sa face pleine ; aucune sur un mur sans parapet', () => {
    const rempart = { x: 1, y: 1, side: 'N' as const, structure: 'mur-en-pierre' };
    const s: Scene = { ...emptyScene('rempart', 3, 3), walls: [rempart, { x: 1, y: 1, side: 'E' }] };
    const [couronne, ...autres] = couronnesDuMonde(s);
    expect(autres).toEqual([]);
    expect(couronne.cle).toBe(edgeKey(rempart));
    expect(couronne.surfaces.map((x) => x.matiere)).toEqual(['structure--mur-en-pierre']);
    expect(couronne.cases).toHaveLength(couronne.positions.length / 9);
    expect(Math.min(...hauteurs(couronne.positions))).toBeCloseTo(METRES_PER_LEVEL, 3);
  });

  it('la couronne d’un rempart de l’étage, au sommet du mur dressé du plancher de l’étage', () => {
    const s: Scene = { ...emptyScene('rempart', 3, 3), walls: [{ x: 1, y: 1, side: 'N', z: 1, structure: 'mur-en-pierre' }] };
    s.layers.push({ z: 1, tiles: new Array(9).fill('plancher'), height: new Array(9).fill(METRES_PER_LEVEL) });
    const [couronne] = couronnesDuMonde(s);
    expect(couronne.cle).toBe('1,1,N,1');
    expect(Math.min(...hauteurs(couronne.positions))).toBeCloseTo(2 * METRES_PER_LEVEL, 3);
    expect(couronne.cases.every(([, , z]) => z === 1)).toBe(true);
  });
});


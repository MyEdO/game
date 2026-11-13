import { describe, it, expect } from 'vitest';
import { CASES_PAR_MORCEAU, blocDeLaCase, couronnesDuMonde, retraitDuMonde, toitsDuMonde, toitsLeves, volumeDuMonde, type MorceauDuMonde, type RetraitDuMonde, type VolumeDuMonde } from './volume';
import { clearedSpace, nappeKey, shelterField } from './toits';
import { perimeterWallSegs } from '../../sceneEdit.testkit';
import { emptyScene, parapetTilesAbove, sceneMetresPerTile, setDoorOpen, setStructureDown, setTileCollapsed, type Scene } from '../scene';
import { terrainAbsent } from '../terrain';
import { paintTiles, setEdgeWall } from '../../sceneEdit';
import { bumperDataset } from '../../../data/versionDataset';
import { datasetArray, setDataset, type DatasetKey } from '../../../data/overrides';
import { idsDeTest } from '../../../engine/idsDeTest.testkit';
import { scenario as siegeEnceinte } from '../../../scenes/test-scenarios/siege-enceinte';
import { scenario as scenarioDiligence } from '../../../scenes/test-scenarios/diligence';
import { edgeKey } from '../facades';
import { METRES_PER_LEVEL } from '../relief';
import { couleurDeMatiere, recetteDeMatiere, tintVarFactor } from './matieres';
import { parseHex } from '../../../lib/couleurHex';
import { depuisBase64 } from '../../../lib/base64';
import { triangles, trianglesDuVolume, trianglesMontres } from './volume.testkit';
import { buildScene } from '../../mapSpec';
import { poserLesNavires, provenanceDesNavires } from '../../planDeNavire';
import { buildOpaque } from '../vision';
import { capsSolid } from './floors';
import type { MaterialRef } from '../../../data/materials.types';

function marche(): Scene {
  const s = emptyScene('scene-test', 2, 1);
  s.layers[0].tiles = ['plancher', 'plancher'];
  s.layers[0].height = [0, 1.2];
  return s;
}

/** Deux couches de 16 × 9 cases : un plancher au rez, un étage de planches à 3 m, un tonneau à l'étage. */
function deuxEtages(): Scene {
  const s = emptyScene('scene-test', 16, 9);
  s.layers[0].tiles = Array(16 * 9).fill('plancher');
  s.layers.push({ z: 1, tiles: Array(16 * 9).fill('planches'), height: Array(16 * 9).fill(3) });
  s.entities.push({ id: 'tonneau-1', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 9, y: 2 }, z: 1 });
  return s;
}

/** Un bloc `mur` en (1, 1) au rez, coiffé à l'étage d'un chemin de ronde de pierre crénelé portant un tonneau, et un
 *  tablier de planches en (0, 0) à l'étage. */
function cheminDeRonde(): Scene {
  const s = emptyScene('scene-test', 3, 3);
  s.layers[0].tiles[4] = 'mur';
  s.layers.push({ z: 1, tiles: Array(9).fill('vide'), height: Array(9).fill(0), crenellated: Array(9).fill(null) });
  s.layers[1].tiles[4] = 'pierre';
  s.layers[1].height![4] = 4;
  s.layers[1].crenellated![4] = 'mur-en-pierre';
  s.layers[1].tiles[0] = 'planches';
  s.layers[1].height![0] = 4;
  s.entities.push({ id: 'tonneau-1', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 1, y: 1 }, z: 1 });
  return s;
}

describe('volumeDuMonde (#3476)', () => {
  it('trois sommets par triangle : trois nombres par position et par normale, quatre par couleur opaque, trois nombres de case par triangle', () => {
    for (const m of volumeDuMonde(marche()).morceaux) {
      expect(m.positions.length % 9).toBe(0);
      expect(m.normales.length).toBe(m.positions.length);
      expect(m.couleurs.length).toBe((m.positions.length / 3) * 4);
      expect(m.couleurs.every((c) => c >= 0 && c <= 1)).toBe(true);
      expect(m.cases.length).toBe(m.positions.length / 3);
      expect(triangles(m).every((t) => t.couleur[3] === 1)).toBe(true);
    }
  });

  it('la hauteur de chaque case par couche, la marche de 1,2 m en paroi verticale', () => {
    const s = marche();
    const v = volumeDuMonde(s);
    expect(v.metresParCase).toBe(sceneMetresPerTile(s));
    expect(v.hauteurs).toEqual([{ z: 0, rangees: [[0, 1.2]] }]);
    const tris = trianglesDuVolume(v);
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
    const dessus = trianglesDuVolume(v).filter((t) => t.normale[1] > 0.99);
    expect(dessus.length).toBeGreaterThan(0);
    expect(dessus.every((t) => t.xs.every((x) => Math.abs(x) <= v.metresParCase / 2 + 1e-3))).toBe(true);
    expect(dessus.map((t) => t.couleur)).toContainEqual(attendue);
  });

  it('chaque triangle porte la couche de sa case : le plancher de l’étage à z 1, le sol du rez à z 0', () => {
    const s = emptyScene('scene-test', 1, 1);
    s.layers[0].tiles = ['plancher'];
    s.layers.push({ z: 1, tiles: ['plancher'], height: [3] });
    const tris = trianglesDuVolume(volumeDuMonde(s));
    expect(tris.filter((t) => t.ys.every((y) => y === 3)).map((t) => t.case)).toContainEqual([0, 0, 1]);
    expect(tris.filter((t) => t.ys.every((y) => y === 0)).every((t) => t.case[2] === 0)).toBe(true);
  });

  it('dans un morceau, une surface par matière, nommée par son domaine et son id, qui se suivent : le terrain du dessus, le relief de la paroi', () => {
    const s = marche();
    s.reliefDefaults = { ...s.reliefDefaults, cliff: { id: 'pierre' } };
    s.layers[0].height = [0, 3];
    const [m, ...autres] = volumeDuMonde(s).morceaux;
    expect(autres, 'deux cases d’un bloc, sans décor : un seul morceau').toEqual([]);
    expect(m.surfaces.map((x) => x.debut)).toEqual([0, ...m.surfaces.slice(0, -1).map((x) => x.fin)]);
    expect(m.surfaces[m.surfaces.length - 1].fin).toBe(m.positions.length / 3);
    expect(new Set(m.surfaces.map((x) => x.matiere)).size).toBe(m.surfaces.length);
    const tris = triangles(m);
    expect(tris.filter((t) => t.ys.every((y) => y === 3)).map((t) => t.matiere)).toEqual(expect.arrayContaining(['terrain--plancher']));
    expect(tris.filter((t) => Math.abs(t.normale[1]) < 1e-3).map((t) => t.matiere)).toContain('relief--pierre');
  });

  it('un décor volumique posé sur sa case : ses faces à sa matière de décor, au-dessus du sol, dans sa case', () => {
    const s = emptyScene('scene-test', 3, 3);
    s.layers[0].tiles = Array(9).fill('plancher');
    s.layers[0].height = [0, 0, 0, 0, 0.5, 0, 0, 0, 0];
    s.entities.push({ id: 'tonneau-1', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 1, y: 1 } });
    const tris = trianglesDuVolume(volumeDuMonde(s)).filter((t) => t.matiere.startsWith('prop--'));
    expect(tris.length).toBeGreaterThan(0);
    expect(tris.every((t) => t.case[0] === 1 && t.case[1] === 1)).toBe(true);
    expect(Math.min(...tris.flatMap((t) => t.ys))).toBeCloseTo(0.5, 2);
    expect(Math.max(...tris.flatMap((t) => t.ys))).toBeGreaterThan(0.5);
  });

  it('les faces d’un décor qui éclaire forment des surfaces à part, qui portent `luminaire` ; celles du même décor sans lumière, non', () => {
    const s = emptyScene('scene-test', 3, 1);
    s.layers[0].tiles = Array(3).fill('plancher');
    s.entities.push({ id: 'tonneau-eteint', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 0, y: 0 } });
    s.entities.push({ id: 'tonneau-allume', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 2, y: 0 }, light: { radiusM: 5 } });
    const tris = trianglesDuVolume(volumeDuMonde(s)).filter((t) => t.matiere.startsWith('prop--'));
    const matieresDe = (x: number) => tris.filter((t) => t.case[0] === x).map((t) => t.matiere).sort();
    expect(tris.filter((t) => t.case[0] === 0).map((t) => t.surface.luminaire)).toEqual(tris.filter((t) => t.case[0] === 0).map(() => undefined));
    expect(tris.filter((t) => t.case[0] === 2).map((t) => t.surface.luminaire)).toEqual(tris.filter((t) => t.case[0] === 2).map(() => true));
    expect(matieresDe(2)).toEqual(matieresDe(0));
    expect(matieresDe(2).length).toBeGreaterThan(0);
  });

  it('le décor que son terrain pose (le bois, ses arbres) se dresse sur chacune de ses cases', () => {
    const s = emptyScene('scene-test', 3, 1);
    s.layers[0].tiles = ['herbe', 'bois', 'herbe'];
    const tris = trianglesDuVolume(volumeDuMonde(s)).filter((t) => t.matiere.startsWith('prop--'));
    expect(tris.map((t) => t.matiere)).toContain('prop--feuillage');
    expect(new Set(tris.map((t) => t.case.join(',')))).toEqual(new Set(['1,0,0']));
  });
});

describe('les morceaux du volume (#3948)', () => {
  /** Le genre qu'une matière range : `pose` pour un décor ou une crête, `sol` sinon. */
  const genreDe = (matiere: string): string => (matiere.startsWith('prop--') || matiere.startsWith('structure--') ? 'pose' : 'sol');
  /** Les empreintes du volume, par clé de morceau. */
  const empreintes = (v: VolumeDuMonde) => new Map(v.morceaux.map((m) => [m.cle, m.empreinte]));
  /** Les clés des morceaux dont l'empreinte diffère entre `a` et `b`, ou qui ne sont que dans l'un. */
  const bouges = (a: VolumeDuMonde, b: VolumeDuMonde) => {
    const ea = empreintes(a), eb = empreintes(b);
    return [...new Set([...ea.keys(), ...eb.keys()])].filter((k) => ea.get(k) !== eb.get(k)).sort();
  };

  it('toutes les couches en morceaux : chaque face au morceau de sa case et de son genre, aucun vide, chaque clé une fois', () => {
    const v = volumeDuMonde(deuxEtages());
    expect(new Set(v.morceaux.map((m) => m.cle)).size).toBe(v.morceaux.length);
    expect(v.morceaux.every((m) => m.cases.length > 0)).toBe(true);
    for (const t of trianglesDuVolume(v)) {
      const [x, y, z] = t.case;
      expect(t.morceau.cle).toBe(`${genreDe(t.matiere)}/${z}/${Math.floor(x / CASES_PAR_MORCEAU)}/${Math.floor(y / CASES_PAR_MORCEAU)}`);
    }
    expect(v.morceaux.map((m) => m.cle).sort()).toEqual(['pose/1/1/0', 'sol/0/0/0', 'sol/0/0/1', 'sol/0/1/0', 'sol/0/1/1', 'sol/1/0/0', 'sol/1/0/1', 'sol/1/1/0', 'sol/1/1/1']);
    const cases = new Set(trianglesDuVolume(v).map((t) => t.case.join(',')));
    expect(cases.size, 'chaque case des deux couches').toBe(2 * 16 * 9);
  });

  it('la rangée de chaque morceau : le plan de son genre et de sa couche dans le masque', () => {
    const v = volumeDuMonde(deuxEtages());
    const rangee = (cle: string) => v.morceaux.find((m) => m.cle === cle)!.rangee;
    expect([rangee('sol/0/1/1'), rangee('sol/1/0/0'), rangee('pose/1/1/0')]).toEqual([0, 2 * 9, 3 * 9]);
  });

  it('mémoïsé par scène : la même scène rend le même volume, ses nappes et ses couronnes', () => {
    const s = deuxEtages();
    expect(volumeDuMonde(s)).toBe(volumeDuMonde(s));
    expect(toitsDuMonde(s)).toBe(toitsDuMonde(s));
    expect(couronnesDuMonde(s)).toBe(couronnesDuMonde(s));
  });

  it('deux scènes de même contenu ont les mêmes empreintes', () => {
    expect(volumeDuMonde(deuxEtages())).not.toBe(volumeDuMonde(deuxEtages()));
    expect(empreintes(volumeDuMonde(deuxEtages()))).toEqual(empreintes(volumeDuMonde(deuxEtages())));
  });

  it('à une retouche, bougent les morceaux dont une face change, et eux seuls : la case en bord de bloc touche aussi son voisin', () => {
    const avant = volumeDuMonde(deuxEtages());
    const tuile = deuxEtages();
    tuile.layers[0].tiles[3 * 16 + 7] = 'pave';
    const apres = volumeDuMonde(tuile);
    expect(bouges(avant, apres)).toEqual(['sol/0/0/0', 'sol/0/1/0']);
    const contenu = (m: MorceauDuMonde) => JSON.stringify({ ...m, empreinte: undefined });
    for (const m of apres.morceaux) {
      const avantM = avant.morceaux.find((x) => x.cle === m.cle)!;
      expect(avantM.empreinte === m.empreinte, m.cle).toBe(contenu(avantM) === contenu(m));
    }
    const decor = deuxEtages();
    decor.entities.push({ id: 'tonneau-2', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 2, y: 2 } });
    expect(bouges(avant, volumeDuMonde(decor))).toEqual(['pose/0/0/0']);
  });
});

describe('retraitDuMonde (#3948)', () => {
  const octets = (r: RetraitDuMonde) => [...depuisBase64(r.masque)];

  it('deux plans de h rangées de w octets par couche, rien de retiré sans couche active ni couvercle', () => {
    const s = deuxEtages();
    const r = retraitDuMonde(s);
    expect([r.largeur, r.rangees]).toEqual([16, 2 * 2 * 9]);
    expect(octets(r)).toHaveLength(16 * 2 * 2 * 9);
    expect(octets(r).every((o) => o === 0)).toBe(true);
    expect(trianglesMontres(volumeDuMonde(s), r)).toHaveLength(trianglesDuVolume(volumeDuMonde(s)).length);
  });

  it('sous l’étage, le sol de l’étage et ses décors retirés, le rez montré', () => {
    const s = deuxEtages();
    const vus = trianglesMontres(volumeDuMonde(s), retraitDuMonde(s, 0));
    expect(vus.length).toBeGreaterThan(0);
    expect(vus.every((t) => t.case[2] === 0)).toBe(true);
    expect(new Set(vus.map((t) => t.case.join(','))).size).toBe(16 * 9);
  });

  it('le chemin de ronde sous la couche active : son sol montré, sa crête et son décor retirés, le tablier voisin retiré', () => {
    const s = cheminDeRonde();
    const vus = trianglesMontres(volumeDuMonde(s), retraitDuMonde(s, 0)).filter((t) => t.case[2] === 1);
    expect(vus.length).toBeGreaterThan(0);
    expect(vus.every((t) => t.case[0] === 1 && t.case[1] === 1 && t.matiere === 'terrain--pierre')).toBe(true);
    const tout = trianglesDuVolume(volumeDuMonde(s)).filter((t) => t.case[2] === 1);
    expect(tout.filter((t) => t.case.join(',') === '1,1,1').map((t) => t.matiere), 'la crête et le décor sont au volume').toEqual(expect.arrayContaining(['structure--mur-en-pierre', expect.stringMatching(/^prop--/)]));
    expect(tout.filter((t) => t.case.join(',') === '0,0,1').map((t) => t.matiere), 'le tablier est au volume').toContain('terrain--planches');
  });

  it('le couvercle retire ses cases, couche comprise, sol et décor', () => {
    const s = cheminDeRonde();
    const vus = trianglesMontres(volumeDuMonde(s), retraitDuMonde(s, undefined, new Set(['1,1,1'])));
    expect(vus.some((t) => t.case.join(',') === '1,1,1')).toBe(false);
    expect(vus.some((t) => t.case.join(',') === '0,0,1')).toBe(true);
    expect(vus.some((t) => t.case.join(',') === '1,1,0')).toBe(true);
  });
});

describe('volumeDuMonde, les faces hors de la carte (#3948)', () => {
  /** La caraque posée cap à l'ouest, son ancre en (`x`, 2), dans un bassin de 24 × 24 cases d'eau. */
  const bassin = (x: number): Scene => poserLesNavires(buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', entities: [{ id: 'c1', kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x, y: 2 }, facing: 'O' }] }));
  const surLaCarte = (s: Scene) => ([x, y]: readonly number[]) => x >= 0 && y >= 0 && x < s.dimensions.w && y < s.dimensions.h;
  /** La couleur d'une face de la matière `matiere` (`<domaine>--<id>`) teintée à la case `cell`. */
  const teinte = (matiere: string, cell: { x: number; y: number; z: number }): string => {
    const [domain, id] = matiere.split('--');
    const m = { domain, id } as MaterialRef;
    const k = tintVarFactor(recetteDeMatiere(m), cell) / 255;
    return [...parseHex(couleurDeMatiere(m))!.map((c) => Math.round(Math.min(1, c * k) * 1000) / 1000), 1].join(',');
  };

  it('un décor hors de la carte va à la case de la carte la plus proche, montré à sa couche', () => {
    for (const [pos, attendue, cle] of [[{ x: 17, y: 2 }, '15,2,0', 'pose/0/1/0'], [{ x: 2, y: 10 }, '2,8,0', 'pose/0/0/1']] as const) {
      const s = deuxEtages();
      s.entities.push({ id: 'tonneau-2', kind: 'prop', decor: { id: 'tonneau' }, pos, z: 0 });
      const decor = trianglesDuVolume(volumeDuMonde(s)).filter((t) => t.matiere.startsWith('prop--') && t.case[2] === 0);
      expect(decor.length, `${pos.x},${pos.y}`).toBeGreaterThan(0);
      expect(new Set(decor.map((t) => `${t.morceau.cle} ${t.case.join(',')}`)), `${pos.x},${pos.y}`).toEqual(new Set([`${cle} ${attendue}`]));
      expect(trianglesMontres(volumeDuMonde(s), retraitDuMonde(s, 0)).filter((t) => t.matiere.startsWith('prop--')).length, 'montré sous l’étage').toBe(decor.length);
    }
  });

  /** Deux couches de 6 × 6 cases, le rez à z 0 et l'étage à z 2 (la couche 1 retirée), et un tonneau en (2, 2) à `z`. */
  const coucheRetiree = (z?: number): Scene => {
    const s = emptyScene('scene-test', 6, 6);
    s.layers[0].tiles = Array(36).fill('plancher');
    s.layers.push({ z: 2, tiles: Array(36).fill('planches'), height: Array(36).fill(6) });
    if (z !== undefined) s.entities.push({ id: 'tonneau-1', kind: 'prop', decor: { id: 'tonneau' }, pos: { x: 2, y: 2 }, z });
    return s;
  };

  it('un décor entre deux couches : rangé à la couche du dessus, montré quand la couche active est au-dessus de lui, retiré dessous', () => {
    const s = coucheRetiree(1);
    const v = volumeDuMonde(s);
    const decor = trianglesDuVolume(v).filter((t) => t.matiere.startsWith('prop--'));
    expect(decor.length).toBeGreaterThan(0);
    expect(new Set(decor.map((t) => `${t.morceau.cle} ${t.case.join(',')} ${t.morceau.rangee}`))).toEqual(new Set([`pose/2/0/0 2,2,2 ${3 * 6}`]));
    const montres = (activeZ: number) => trianglesMontres(v, retraitDuMonde(s, activeZ)).filter((t) => t.matiere.startsWith('prop--')).length;
    expect(montres(2), 'la couche active au-dessus du décor').toBe(decor.length);
    expect(montres(0), 'la couche active sous le décor').toBe(0);
  });

  it('un décor au-dessus de la plus haute couche ne va à aucun morceau', () => {
    expect(volumeDuMonde(coucheRetiree(3)).morceaux).toEqual(volumeDuMonde(coucheRetiree()).morceaux);
  });

  it('un navire posé à cheval sur le bord : ses faces aux cases de la carte, sa mer teintée à ses cases', () => {
    for (const x of [0, 22]) {
      const s = bassin(x);
      const { flottaison } = provenanceDesNavires(s);
      const horsCarte = [...flottaison.keys()].filter((k) => !surLaCarte(s)(k.split(',').map(Number)));
      expect(horsCarte.length, `la flottaison sort de la carte en x=${x}`).toBeGreaterThan(0);
      const v = volumeDuMonde(s);
      const blocs = Math.ceil(s.dimensions.w / CASES_PAR_MORCEAU);
      expect(v.morceaux.map((m) => m.cle).filter((cle) => cle.split('/').slice(2).map(Number).some((b) => b < 0 || b >= blocs)), `x=${x}`).toEqual([]);
      expect(trianglesDuVolume(v).map((t) => t.case).filter((c) => !surLaCarte(s)(c)), `x=${x}`).toEqual([]);
      const mer = trianglesDuVolume(v).filter((t) => t.surface.flottaison);
      const parCase = mer.length / flottaison.size;
      expect(Number.isInteger(parCase), 'autant de triangles de mer par case').toBe(true);
      const compte = (couleurs: string[]) => couleurs.reduce<Record<string, number>>((n, c) => ({ ...n, [c]: (n[c] ?? 0) + 1 }), {});
      const attendues = [...flottaison.keys()].flatMap((k) => { const [cx, cy, cz] = k.split(',').map(Number); return Array<string>(parCase).fill(teinte(mer[0].matiere, { x: cx, y: cy, z: cz })); });
      expect(compte(mer.map((t) => t.couleur.join(','))), `x=${x}, chaque case de mer à sa teinte`).toEqual(compte(attendues));
    }
  });

  it('la mer d’un navire au-dessus de la couche active est retirée, bloc plein dessous ou non', () => {
    const s0 = buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'mur', entities: [{ id: 'c1', kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x: 10, y: 8 }, facing: 'O', z: 1 }] });
    s0.layers[0].height = Array(24 * 24).fill(0);
    s0.layers.push({ z: 1, tiles: Array(24 * 24).fill('pierre'), height: Array(24 * 24).fill(0) });
    const s = poserLesNavires(s0);
    const { flottaison, cases } = provenanceDesNavires(s);
    expect([...flottaison.keys()].some((k) => { const [x, y, z] = k.split(',').map(Number); return !cases.has(k) && capsSolid(s, x, y, z); }), 'une mer hors des ponts sur un bloc plein').toBe(true);
    const v = volumeDuMonde(s);
    expect(trianglesDuVolume(v).filter((t) => t.surface.flottaison).length, 'la mer au volume').toBeGreaterThan(0);
    expect(trianglesMontres(v, retraitDuMonde(s, 0)).filter((t) => t.surface.flottaison)).toEqual([]);
  });
});

describe('toitsDuMonde, toitsLeves (#3476)', () => {
  const MAISON = { x: 2, y: 2, w: 4, h: 3 };
  const scene = (): Scene => ({
    ...emptyScene('toits', 10, 8),
    walls: perimeterWallSegs([MAISON]),
    architecture: [{ id: 'bourg', storeys: [], facades: [], masses: [{ id: 'maison', z: 0, footprint: [MAISON], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30, material: { id: 'tuile' } }] }],
  });

  it('une nappe par masse, ses pans de couverture et ses pignons de la matière du mur qu’ils prolongent, son empreinte', () => {
    const [nappe, ...autres] = toitsDuMonde(scene());
    expect(nappe.empreinte).toBe(toitsDuMonde(scene())[0].empreinte);
    expect(autres).toEqual([]);
    expect(nappe.cle).toBe(nappeKey('bourg', 'maison'));
    expect(nappe.surfaces.map((s) => s.matiere).sort()).toEqual(['roof--tuile', 'structure--plain']);
    expect(nappe.positions.length % 9).toBe(0);
    expect(nappe.cases).toHaveLength(nappe.positions.length / 3);
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
    expect(trianglesDuVolume(nu).map((t) => t.matiere)).not.toContain('structure--mur-en-pierre');
    const ys = trianglesDuVolume(v).filter((t) => t.matiere === 'structure--mur-en-pierre').flatMap((t) => t.ys);
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
    expect(couronne.cases).toHaveLength(couronne.positions.length / 3);
    expect(Math.min(...hauteurs(couronne.positions))).toBeCloseTo(METRES_PER_LEVEL, 3);
  });

  it('la couronne d’un rempart de l’étage, au sommet du mur dressé du plancher de l’étage', () => {
    const s: Scene = { ...emptyScene('rempart', 3, 3), walls: [{ x: 1, y: 1, side: 'N', z: 1, structure: 'mur-en-pierre' }] };
    s.layers.push({ z: 1, tiles: new Array(9).fill('plancher'), height: new Array(9).fill(METRES_PER_LEVEL) });
    const [couronne] = couronnesDuMonde(s);
    expect(couronne.cle).toBe('1,1,N,1');
    expect(Math.min(...hauteurs(couronne.positions))).toBeCloseTo(2 * METRES_PER_LEVEL, 3);
    expect(triangles(couronne).every((t) => t.case[2] === 1)).toBe(true);
  });
});


describe('la tuile effondrée, absente du volume (#4044)', () => {
  const siege = poserLesNavires(siegeEnceinte.construire(idsDeTest).scene);
  const porteDeVille = siege.walls!.find((w) => w.x === 14 && w.y === 37 && w.side === 'N' && (w.z ?? 0) === 0)!;
  const abattu = () => parapetTilesAbove(siege, porteDeVille).reduce((s, c) => setTileCollapsed(s, c.x, c.y, c.z), setStructureDown(siege, 14, 37, 'N', 0, true));
  const empreintes = (v: VolumeDuMonde) => new Map(v.morceaux.map((m) => [m.cle, m.empreinte]));
  const surLaCase = (v: VolumeDuMonde) => trianglesDuVolume(v).filter((t) => t.case.join(',') === '14,37,1');

  it('siege-enceinte, la porte de ville (14, 37, N) abattue : aucun triangle à la case effondrée (14, 37, 1), son morceau change d’empreinte, les autres gardent la leur', () => {
    expect(porteDeVille.structure).toBe('porte-de-ville');
    expect(parapetTilesAbove(siege, porteDeVille)).toEqual([{ x: 14, y: 37, z: 1 }]);
    const [avant, apres] = [volumeDuMonde(siege), volumeDuMonde(abattu())];
    expect(surLaCase(avant).length, 'le chemin de ronde intact').toBeGreaterThan(0);
    expect(surLaCase(apres)).toEqual([]);
    const [ea, eb] = [empreintes(avant), empreintes(apres)];
    expect([...eb.keys()].sort()).toEqual([...ea.keys()].sort());
    const bloc = blocDeLaCase({ x: 14, y: 37, z: 1 });
    expect(eb.get(`sol/${bloc}`)).not.toBe(ea.get(`sol/${bloc}`));
    for (const [cle, empreinte] of eb) if (!cle.endsWith(`/${bloc}`)) expect(empreinte, cle).toBe(ea.get(cle));
  });

  it('la tuile effondrée est une case où rien n’est bâti : même volume que la case absente de sa couche, sans crénelure', () => {
    const absente = setStructureDown(siege, 14, 37, 'N', 0, true);
    const k = 37 * siege.dimensions.w + 14;
    const etage = absente.layers.find((l) => l.z === 1)!;
    const couche = { ...etage, tiles: etage.tiles.map((t, i) => (i === k ? terrainAbsent() : t)), crenellated: etage.crenellated!.map((c, i) => (i === k ? null : c)) };
    expect(etage.crenellated![k], 'la case effondrée était crénelée').not.toBeNull();
    expect(empreintes(volumeDuMonde(abattu()))).toEqual(empreintes(volumeDuMonde({ ...absente, layers: absente.layers.map((l) => (l.z === 1 ? couche : l)) })));
  });
});

describe('toits et couronnes retenus sur ce qu’ils lisent (#4044)', () => {
  const diligence = poserLesNavires(scenarioDiligence.construire(idsDeTest).scene);
  const porte = diligence.walls!.find((w) => w.door)!;
  const retenus = (s: Scene) => [toitsDuMonde(s), couronnesDuMonde(s)];

  it('la diligence a des nappes et des couronnes', () => {
    const [toits, couronnes] = retenus(diligence);
    expect(toits.length).toBeGreaterThan(0);
    expect(couronnes.length).toBeGreaterThan(0);
  });

  it('un mur abattu, sa passerelle effondrée, une porte ouverte : les mêmes tableaux', () => {
    const avant = retenus(diligence);
    const mur = parapetTilesAbove(diligence, { x: 14, y: 6, side: 'E', z: 0 }).reduce((s, c) => setTileCollapsed(s, c.x, c.y, c.z), setStructureDown(diligence, 14, 6, 'E', 0, true));
    expect(mur.flags).not.toBe(diligence.flags);
    retenus(mur).forEach((t, i) => expect(t).toBe(avant[i]));
    retenus(setDoorOpen(diligence, porte.x, porte.y, porte.side, porte.z ?? 0, true)).forEach((t, i) => expect(t).toBe(avant[i]));
  });

  it('une tuile peinte, un mur posé : des tableaux neufs, ceux de la scène clonée', () => {
    for (const [quoi, retouche] of [
      ['tuile', paintTiles(diligence, { x: 3, y: 3 }, 'dalle', 1, 0)],
      ['mur', setEdgeWall(diligence, 2, 2, 'N', 0, 'wall')],
    ] as const) {
      const avant = retenus(diligence);
      const apres = retenus(retouche);
      apres.forEach((t, i) => expect(t, quoi).not.toBe(avant[i]));
      expect(apres, quoi).toEqual(retenus(structuredClone(retouche)));
    }
  });

  it('une écriture d’un catalogue lu : des tableaux neufs, au même contenu', () => {
    const avant = retenus(diligence);
    bumperDataset('materials');
    const apres = retenus({ ...diligence });
    apres.forEach((t, i) => expect(t).not.toBe(avant[i]));
    expect(apres).toEqual(avant);
  });
});

describe('une écriture au catalogue, sur la même scène : volume, nappes, couronnes, couvert, dégagement, navires et opacité datés (#4044)', () => {
  type Entree<K extends DatasetKey> = ReturnType<typeof datasetArray<K>>[number];
  /** Joue `f` entre l'écriture d'un dataset et sa restauration (`setDataset`, l'écrivain réel). */
  const entre = <T,>(ecrire: () => void, restaurer: () => void, f: () => T): T => {
    try {
      ecrire();
      return f();
    } finally {
      restaurer();
    }
  };
  const sousLesTerrains = <T,>(reecrire: (t: Entree<'terrains'>) => Entree<'terrains'>, f: () => T): T => {
    const avant = [...datasetArray('terrains')];
    return entre(() => setDataset('terrains', avant.map(reecrire)), () => setDataset('terrains', avant), f);
  };
  const sousLesMatieres = <T,>(reecrire: (m: Entree<'materials'>) => Entree<'materials'>, f: () => T): T => {
    const avant = [...datasetArray('materials')];
    return entre(() => setDataset('materials', avant.map(reecrire)), () => setDataset('materials', avant), f);
  };
  const sousLesVehicules = <T,>(reecrire: (v: Entree<'vehicles'>) => Entree<'vehicles'>, f: () => T): T => {
    const avant = [...datasetArray('vehicles')];
    return entre(() => setDataset('vehicles', avant.map(reecrire)), () => setDataset('vehicles', avant), f);
  };
  const absent = (id: string) => (t: Entree<'terrains'>): Entree<'terrains'> => ({ ...t, absence: t.id === id ? true : t.absence });
  const MAISON = { x: 2, y: 2, w: 4, h: 3 };
  /** La maison `MAISON` murée, d'un corps sans masse authorée, à l'étage de planches : sa masse se dérive
   *  (`deriveArchitectureMasses`), sur deux niveaux tant que les planches sont un plancher. */
  const maisonAEtage = (): Scene => {
    const s: Scene = {
      ...emptyScene('abri', 10, 8),
      walls: perimeterWallSegs([MAISON]),
      architecture: [{ id: 'bourg', storeys: [], facades: [], masses: [] }],
    };
    const tiles = s.layers[0].tiles.map((_, i) => {
      const [x, y] = [i % 10, Math.floor(i / 10)];
      return x >= MAISON.x && x < MAISON.x + MAISON.w && y >= MAISON.y && y < MAISON.y + MAISON.h ? 'planches' : terrainAbsent();
    });
    return { ...s, layers: [...s.layers, { z: 1, tiles, height: tiles.map(() => METRES_PER_LEVEL) }] };
  };
  const empreintesDe = (l: { cle: string; empreinte: string }[]) => new Map(l.map((m) => [m.cle, m.empreinte]));

  it('le volume : le terrain des planches de l’étage devenu l’absence retire leur sol ; restauré, les empreintes du départ', () => {
    const s = deuxEtages();
    const depart = empreintesDe(volumeDuMonde(s).morceaux);
    const cle = `sol/${blocDeLaCase({ x: 3, y: 3, z: 1 })}`;
    const sous = sousLesTerrains(absent('planches'), () => empreintesDe(volumeDuMonde(s).morceaux));
    expect(sous.get(cle)).not.toBe(depart.get(cle));
    expect(empreintesDe(volumeDuMonde(s).morceaux)).toEqual(depart);
  });

  it('les nappes : la couleur de la tuile (`materials`) ; restaurée, les empreintes du départ', () => {
    const s: Scene = {
      ...emptyScene('toits', 10, 8),
      walls: perimeterWallSegs([MAISON]),
      architecture: [{ id: 'bourg', storeys: [], facades: [], masses: [{ id: 'maison', z: 0, footprint: [MAISON], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30, material: { id: 'tuile' } }] }],
    };
    const depart = empreintesDe(toitsDuMonde(s));
    const sous = sousLesMatieres((m) => (m.id === 'tuile' && m.domain === 'roof' ? { ...m, N: '#000000' } : m), () => empreintesDe(toitsDuMonde(s)));
    expect(sous.get(nappeKey('bourg', 'maison'))).not.toBe(depart.get(nappeKey('bourg', 'maison')));
    expect(empreintesDe(toitsDuMonde(s))).toEqual(depart);
  });

  it('les couronnes : le sol au pied du rempart devenu l’absence le hausse ; restauré, les empreintes du départ', () => {
    const rempart = { x: 1, y: 1, side: 'N' as const, structure: 'mur-en-pierre' };
    const s: Scene = { ...emptyScene('rempart', 3, 3), walls: [rempart] };
    s.layers[0] = { ...s.layers[0], tiles: s.layers[0].tiles.map((t, i) => (i === 1 ? 'dalle' : t)), height: [0, 1, 0, 0, 2, 0, 0, 0, 0] };
    const depart = empreintesDe(couronnesDuMonde(s));
    const sous = sousLesTerrains(absent('dalle'), () => empreintesDe(couronnesDuMonde(s)));
    expect(sous.get(edgeKey(rempart))).not.toBe(depart.get(edgeKey(rempart)));
    expect(empreintesDe(couronnesDuMonde(s))).toEqual(depart);
  });

  it('le couvert (`shelterField`) : les planches de l’étage devenues l’absence abaissent la nappe dérivée ; restauré, le couvert du départ', () => {
    const s = maisonAEtage();
    const niveau = () => shelterField(s).get('3,3')?.topZ;
    expect(niveau()).toBe(1);
    expect(sousLesTerrains(absent('planches'), niveau)).toBe(0);
    expect(niveau()).toBe(1);
  });

  it('le dégagement (`clearedSpace`) : les planches de l’étage devenues l’absence retirent l’étage de l’espace de l’allié ; restauré, celui du départ', () => {
    const s = maisonAEtage();
    const allies = [{ x: 3, y: 3, z: 0 }];
    const espace = () => [...clearedSpace(s, allies).roomlessCells].sort();
    const depart = espace();
    expect(depart).toContain('3,3,1');
    expect(sousLesTerrains(absent('planches'), espace)).not.toContain('3,3,1');
    expect(espace()).toEqual(depart);
  });

  it('les navires posés (`poserLesNavires`) : l’empreinte de la caraque (`vehicles`) élargie déplace ses ponts ; restaurée, ceux du départ', () => {
    const s = buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', entities: [{ id: 'c1', kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x: 10, y: 6 }, facing: 'O' }] });
    const ponts = () => JSON.stringify(poserLesNavires(s).entities.filter((e) => e.id.startsWith('c1-')).map((e) => e.pos));
    const depart = ponts();
    const elargie = sousLesVehicules((v) => (v.id === 'caraque' && v.ship && v.ship.footprint !== undefined ? { ...v, ship: { ...v.ship, footprint: v.ship.footprint + 2 } } : v), ponts);
    expect(elargie).not.toBe(depart);
    expect(ponts()).toBe(depart);
  });

  it('l’opacité (`buildOpaque`) : la dalle (`terrains`) rendue opaque bloque la vue ; restaurée, l’opacité du départ', () => {
    const s = paintTiles(emptyScene('opacite', 4, 4), { x: 1, y: 1 }, 'dalle', 1, 0);
    const bloque = () => buildOpaque(s).g[1 * 4 + 1];
    expect(bloque()).toBe(0);
    expect(sousLesTerrains((t) => (t.id === 'dalle' ? { ...t, opaque: true } : t), bloque)).toBe(1);
    expect(bloque()).toBe(0);
  });
});

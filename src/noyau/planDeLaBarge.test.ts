import { describe, it, expect } from 'vitest';
import { garanti } from '../lib/garanti';
import { buildScene } from './mapSpec';
import { PLAN_DE_LA_BARGE } from './planDeLaBarge';
import { poserLesNavires } from './planDeNavire';
import { heightAt, isWalkable, porteAuteur, sceneMetresPerTile, tileAt, type SceneEntity } from './monde/scene';
import { estAbsent } from './monde/terrain';
import { ancreDuDecor, propFootTiles } from './monde/footprint';
import { piedDuDecor } from './monde/poseDuDecor';
import { emprisePlanTournee } from '../data/props.types';
import { findPropById, findVehicleById } from '../data';
import { grilleDesPonts } from '../data/schemas/grammaire/carte-ascii';

const scene = buildScene(PLAN_DE_LA_BARGE);
const [cartes, hauteurs] = garanti(garanti(findVehicleById('barge-fluviale'), 'barge-fluviale', 'véhicule').ponts, 'barge-fluviale', 'ponts');
const { cases } = grilleDesPonts(cartes);
const k = (c: { x: number; y: number; z?: number }) => `${c.x},${c.y},${c.z ?? 0}`;
const decors = scene.entities.filter((e) => e.kind === 'prop');
/** Les cases qu'un décor couvre, sur son pont. */
const casesDu = (e: SceneEntity) => propFootTiles(e.ref, e.pos, e.facing, sceneMetresPerTile(scene)).map((t) => ({ ...t, z: e.z ?? 0 }));

describe('ponts de la barge fluviale, compilés par buildScene (#3772)', () => {
  it('un étage par pont, chaque case de la source à la hauteur de son glyphe, et aucune autre', () => {
    expect(scene.layers.map((l) => l.z)).toEqual([0, 1, 2]);
    for (const c of cases) expect(heightAt(scene, c.x, c.y, c.z), k(c)).toBe(hauteurs[c.glyphe]);
    const presentes = scene.layers.flatMap(({ z }) => Array.from({ length: scene.dimensions.w * scene.dimensions.h }, (_, i) =>
      ({ x: i % scene.dimensions.w, y: Math.floor(i / scene.dimensions.w), z }))).filter((c) => !estAbsent(tileAt(scene, c.x, c.y, c.z)));
    expect(presentes.map(k).sort()).toEqual(cases.map(k).sort());
  });
});

describe('le décor de la barge, sorti de son modèle 3D (#3790)', () => {
  const sources = new Set(cases.map(k));
  /** Les sols hors des cases : la hauteur du plan sans terrain. */
  const sols = new Set(scene.layers.flatMap(({ z }) => Array.from({ length: scene.dimensions.w * scene.dimensions.h }, (_, i) =>
    ({ x: i % scene.dimensions.w, y: Math.floor(i / scene.dimensions.w), z }))).filter((c) =>
    estAbsent(tileAt(scene, c.x, c.y, c.z)) && heightAt(scene, c.x, c.y, c.z) !== 0).map(k));

  it('fanaux, pile de tonneaux et cargaison bâchée des deux bords, chacun un décor du catalogue', () => {
    expect(decors.map((e) => e.ref).sort()).toEqual([...Array(7).fill('fanal'), 'cargaison-bachee', 'cargaison-bachee', 'tonneaux-pile'].sort());
    for (const e of decors) expect(findPropById(e.ref), e.id).toBeDefined();
  });

  it('chaque décor couvre des cases de la source ou le sol du pont sous la cargaison, qui reste hors des cases', () => {
    expect(decors.flatMap((e) => casesDu(e).filter((c) => !sources.has(k(c)) && !sols.has(k(c))).map((c) => `${e.id} ${k(c)}`))).toEqual([]);
    expect([...sols].sort()).toEqual(['1,0,1', '1,2,1', '2,0,1', '2,2,1']);
    for (const s of sols) {
      const [x, y, z] = s.split(',').map(Number);
      expect(isWalkable(scene, x, y, z), s).toBe(false);
    }
  });

  it('un décor solide ne bouche ni porte ni échelle', () => {
    const libres = new Set((scene.walls ?? []).filter((w) => porteAuteur(w) || w.climb).flatMap((w) => {
      const z = w.z ?? 0;
      return [{ x: w.x, y: w.y, z }, w.side === 'N' ? { x: w.x, y: w.y - 1, z } : { x: w.x + 1, y: w.y, z }].map(k);
    }));
    expect(decors.filter((e) => findPropById(e.ref)?.solid).flatMap((e) => casesDu(e).filter((c) => libres.has(k(c))).map((c) => `${e.id} ${k(c)}`))).toEqual([]);
  });

  it('deux décors ne s’interpénètrent pas', () => {
    const mpt = sceneMetresPerTile(scene);
    const corps = (e: SceneEntity) => {
      const a = ancreDuDecor(e, mpt);
      const c = garanti(emprisePlanTournee(garanti(findPropById(e.ref), e.id, 'décor'), e.facing ?? 'S', () => true), e.id, 'corps');
      return { x0: a.x + c.x0 / mpt, x1: a.x + c.x1 / mpt, y0: a.y + c.y0 / mpt, y1: a.y + c.y1 / mpt };
    };
    const heurts = decors.flatMap((a, i) => decors.slice(i + 1).filter((b) => {
      if ((a.z ?? 0) !== (b.z ?? 0)) return false;
      const [p, q] = [corps(a), corps(b)];
      return Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0) > 1e-6 && Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0) > 1e-6;
    }).map((b) => `${a.id} × ${b.id}`));
    expect(heurts).toEqual([]);
  });

  it('posée dans une scène, à tout cap, chaque décor se tient sur le plancher que le plan lui donne, la cargaison sur le pont', () => {
    for (const cap of ['N', 'E', 'S', 'O'] as const) {
      const bassin = poserLesNavires(buildScene({
        id: 'bassin', label: 'Bassin', size: [20, 20], terrain: 'eau',
        entities: [{ id: 'b1', kind: 'personnage', ref: 'barge-fluviale', pos: { x: 9, y: 9 }, facing: cap }],
      }));
      for (const e of decors) {
        const pose = garanti(bassin.entities.find((p) => p.id === `b1-${e.id}`), e.id, 'décor posé');
        expect(piedDuDecor(bassin, pose), `${e.id} au cap ${cap}`).toBe(piedDuDecor(scene, e));
      }
      expect(decors.filter((e) => e.ref === 'cargaison-bachee').map((e) => piedDuDecor(bassin, garanti(bassin.entities.find((p) => p.id === `b1-${e.id}`), e.id, 'cargaison'))))
        .toEqual([hauteurs.p, hauteurs.p]);
    }
  });
});

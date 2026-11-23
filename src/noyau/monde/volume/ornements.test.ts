/**
 * LES ORNEMENTS DU BÂTI POSÉS PAR LE VOLUME (#4471) : les décors de façade (`FacadeSection.features`, vignette
 * `facadeFeatureViz`), les souches des foyers à conduit (`PropData.conduit`) et les décors d'identité de bâtiment
 * (`buildingFeatures`) sortent du volume du monde (`posesDesDecors`)
 * avec leur décor, leur ancre, leur cap, leur pied et la nappe de toit qui les porte (`ornementsDuBati`) ; un décor
 * porté par une nappe a ses faces dans cette nappe (`toitsDuMonde`), qui se lève avec lui (`toitsLeves`,
 * `toutesLesNappes`). Fixture : la rue du test (`laRue`).
 */
import { describe, expect, it } from 'vitest';
import { heightAt, wallEnds, type FacadeFeature, type Scene } from '../scene';
import { posesDesDecors, toitsDuMonde, toitsLeves, toutesLesNappes, volumeDuMonde, type PoseDeDecor } from './volume';
import { fieldHeightAt, formeDeLaNappe, gableEnds, resolveNappes } from './toits';
import { facadeFeatureViz } from '../facades';
import { buildingFeatures } from '../buildings';
import { WALL_H_M } from '../iso';
import { capDuFaite, SOUCHE } from './ornements';
import { edgeKey } from '../facades';
import {
  EPI, FACADE, FEATURES, FOYER_DE_LA_CHAPELLE, FOYER_DEHORS, laRue, NAPPE_DE_LA_CHAPELLE,
} from './ornements.testkit';

const poseDe = (scene: Scene, cle: string): PoseDeDecor => {
  const pose = posesDesDecors(scene).find((p) => p.cle === cle);
  expect(pose, cle).toBeDefined();
  return pose!;
};

/** Le point de l'arête `edge` à `offset` de sa longueur. */
const surLArete = (edge: FacadeFeature['edge'], offset: number) => {
  const [a, b] = wallEnds(edge);
  return { x: a.x + (b.x - a.x) * offset, y: a.y + (b.y - a.y) * offset };
};

/** Les décors dont la géométrie `g` porte des surfaces. */
const decorsDe = (g: { surfaces: readonly { decor?: string }[] }): string[] =>
  g.surfaces.flatMap((s) => (s.decor ? [s.decor] : []));

describe('les ornements de façade', () => {
  const scene = laRue();
  const [enseigne] = FEATURES;

  it('chacun sort du volume au décor de sa vignette, ancré à l’offset de son arête, tourné vers la rue', () => {
    for (const f of FEATURES) {
      const pose = poseDe(scene, `architecture/chapelle:rue:${f.id}`);
      expect(pose.prop, f.id).toBe(facadeFeatureViz(FACADE, f.kind)!.prop);
      expect(pose.ancre, f.id).toEqual(surLArete(f.edge, f.offset!));
      expect(pose.case, f.id).toEqual({ x: f.edge.x, y: f.edge.y, z: 0 });
      expect(pose.cap, f.id).toBe('S');
    }
  });

  it('posé au sol, il se hausse de la surélévation de sa vignette, sans nappe', () => {
    const viz = facadeFeatureViz(FACADE, enseigne.kind)!;
    expect(viz.base).not.toBe('toit');
    const pose = poseDe(scene, `architecture/chapelle:rue:${enseigne.id}`);
    expect(pose.piedM).toBeCloseTo(heightAt(scene, enseigne.edge.x, enseigne.edge.y, 0) + (viz.liftM ?? 0), 9);
    expect(pose.nappe).toBeUndefined();
  });

  it('l’ornement de faîte se pose au sommet du pignon que son arête borde, sur sa nappe', () => {
    const viz = facadeFeatureViz(FACADE, EPI.kind)!;
    expect(viz.base).toBe('toit');
    const pose = poseDe(scene, `architecture/chapelle:pignon-ouest:${EPI.id}`);
    const { cells, field } = resolveNappes(scene).get(NAPPE_DE_LA_CHAPELLE)!;
    const pignon = gableEnds(cells, formeDeLaNappe(field), undefined, field)
      .find((g) => g.edges.some((e) => edgeKey(e) === edgeKey(EPI.edge)))!;
    const sommet = pignon.poly.reduce((haut, p) => (p.h > haut.h ? p : haut));
    expect(pose.prop).toBe(viz.prop);
    expect(pose.ancre).toEqual({ x: sommet.x, y: sommet.y });
    expect(pose.nappe).toBe(NAPPE_DE_LA_CHAPELLE);
    expect(pose.piedM).toBeCloseTo(sommet.h + (viz.liftM ?? 0), 9);
  });
});

describe('les souches des foyers', () => {
  const scene = laRue();

  it('un foyer sous une nappe monte sa souche à l’aplomb du mur auquel il s’adosse, assise sur la couverture', () => {
    const { field } = resolveNappes(scene).get(NAPPE_DE_LA_CHAPELLE)!;
    const pose = poseDe(scene, `souche/${FOYER_DE_LA_CHAPELLE.id}`);
    const { x, y } = FOYER_DE_LA_CHAPELLE.pos;
    expect(pose.prop).toBe(SOUCHE.prop);
    expect(pose.ancre, 'au milieu de l’arête nord de sa case, dos au cap S').toEqual({ x, y: y - 0.5 });
    expect(pose.cap).toBe('N');
    expect(pose.nappe).toBe(NAPPE_DE_LA_CHAPELLE);
    expect(pose.piedM).toBeCloseTo(fieldHeightAt(field, { x: x + 0.5, y }) + SOUCHE.liftM, 9);
  });

  it('un foyer qu’aucune nappe ne couvre ne pose pas de souche', () => {
    const cles = posesDesDecors(scene).map((p) => p.cle);
    expect(cles, 'le foyer lui-même est posé').toContain(`entite/${FOYER_DEHORS.id}`);
    expect(cles).not.toContain(`souche/${FOYER_DEHORS.id}`);
  });
});

describe('les ornements d’identité', () => {
  const scene = laRue();

  it('l’ornement de faîte s’ancre au milieu de l’empreinte, sur sa nappe, au cap du faîtage', () => {
    const { field } = resolveNappes(scene).get(NAPPE_DE_LA_CHAPELLE)!;
    const pose = poseDe(scene, 'ornement/chapelle:corps:0');
    expect(pose.prop).toBe(buildingFeatures({ id: 'chapelle' })[0].id);
    expect(pose.ancre).toEqual({ x: 2 + 3 / 2, y: 1 + 3 / 2 });
    expect(pose.cap).toBe(capDuFaite(field.shape));
    expect(pose.piedM).toBeGreaterThan(field.shape.eaveHeightM);
    expect(pose.nappe).toBe(NAPPE_DE_LA_CHAPELLE);
  });

  it('l’ornement de façade pend haut devant la porte, une demi-case au large, vers le dehors, sans nappe', () => {
    const pose = poseDe(scene, 'ornement/taverne:corps:0');
    expect(pose.prop).toBe(buildingFeatures({ id: 'taverne' })[0].id);
    expect(pose.case).toEqual({ x: 9, y: 4, z: 0 });
    expect(pose.ancre).toEqual({ x: 9, y: 4.5 });
    expect(pose.cap).toBe('S');
    expect(pose.piedM).toBeCloseTo(heightAt(scene, 9, 4, 0) + WALL_H_M * 0.55, 9);
    expect(pose.nappe).toBeUndefined();
  });
});

describe('un décor porté par un toit part avec sa nappe', () => {
  const scene = laRue();
  const portes = posesDesDecors(scene).filter((p) => p.nappe);

  it('l’épi, le clocheton et la souche de la chapelle sont portés par sa nappe', () => {
    expect(portes.map((p) => p.cle).sort()).toEqual([
      `architecture/chapelle:pignon-ouest:${EPI.id}`, 'ornement/chapelle:corps:0', `souche/${FOYER_DE_LA_CHAPELLE.id}`,
    ]);
  });

  it('les faces d’un décor porté sont dans sa nappe, aucune dans un morceau ; les autres, au volume', () => {
    const nappes = new Map(toitsDuMonde(scene).map((n) => [n.cle, decorsDe(n)]));
    const auVolume = new Set(volumeDuMonde(scene).morceaux.flatMap(decorsDe));
    for (const p of portes) {
      expect(nappes.get(p.nappe!), p.cle).toContain(p.prop);
      expect(auVolume.has(p.prop), p.cle).toBe(false);
    }
    for (const p of posesDesDecors(scene).filter((q) => !q.nappe)) expect(auVolume.has(p.prop), p.cle).toBe(true);
  });

  it('la nappe porteuse se lève au plateau et sous le groupe qu’elle couvre', () => {
    expect(toutesLesNappes(scene)).toContain(NAPPE_DE_LA_CHAPELLE);
    expect(toitsLeves(scene, [{ x: 3, y: 2, z: 0 }])).toEqual([NAPPE_DE_LA_CHAPELLE]);
  });
});

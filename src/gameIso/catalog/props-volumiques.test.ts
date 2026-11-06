import { describe, expect, it } from 'vitest';
import { missingPropSvg, propSvg } from './decor';
import { findPropById } from '../../data';
import { CAP_IDENTITE_PROP, empreinteDeriveeDuProp, placesLocalesDuProp, rotatePropLocal } from '../../data/props.types';
import { decorFootGeometry } from '../../noyau/monde/footprint';
import { buildProps } from '../builders/props';
import { estPropVolumique } from '../builders/types';
import { type Face } from '../../noyau/monde/volume/types';
import { bakeWorldGeometry, collectBillboards, wholeSceneBillboardEls } from '../backends/webgl/sceneMeshes';
import { facePoly, fanTriangles, polyNormal, type Vec3 } from '../../noyau/monde/volume/worldTris';
import { sceneMetresPerTile, type SceneEntity } from '../../noyau/monde/scene';
import { validateScene } from '../../noyau/validateScene';
import { DIR4_ORDER } from '../../geometry/dir8';
import { IDS, METRES_PAR_CASE, centroide, corpsEtSieges, propEntity, propsAvecPlaces, sceneWith } from '../../noyau/monde/volume/decorVolumique.testkit';

/**
 * LE DÉCOR VOLUMIQUE CHEZ L'HÔTE WEB — la vignette de palette, l'EXCLUSIVITÉ de la voie monde (une ref volumique n'a
 * aucun sujet de billboard), l'émetteur `buildProps` et la cuisson. Le contrat de la donnée (recette, places,
 * empreinte, population, coquille) : `src/noyau/monde/volume/props-volumiques.test.ts`.
 */

/** Distance HORIZONTALE d'un point à un segment, en cases — le bord d'une face, pas ses seuls sommets. */
function distanceAuSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe('décor volumique — sa vignette et son corps monde, émis et cuits', () => {
  it.each(IDS)('%s possède vignette et volume monde, jamais billboard monde', (id) => {
    expect(propSvg(id).length).toBeGreaterThan(120);
    const prop = findPropById(id)!;
    expect(prop.volume!.primitives.length).toBeGreaterThan(0);
    const scene = sceneWith(propEntity({ id: `e-${id}`, ref: id, pos: { x: 2, y: 2 }, facing: 'S' }));
    expect(buildProps(scene)[0]).toMatchObject({ entId: `e-${id}`, faces: expect.any(Array) });
    const els = wholeSceneBillboardEls(scene);
    expect(collectBillboards(scene, sceneMetresPerTile(scene), els).some((b) => b.identity.includes(`e-${id}`))).toBe(false);
  });

  it.each(propsAvecPlaces.map((p) => p.id))('%s : chaque ancre est à portée du plan de travail', (id) => {
    // Au CAP D'IDENTITÉ, et à lui seul, l'ancre AUTHORÉE d'une place et la géométrie monde sont dans
    // le même repère : c'est ce qui rend la comparaison ci-dessous licite sans re-tourner l'ancre.
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: CAP_IDENTITE_PROP }));
    const el = buildProps(scene)[0] as { faces: { poly: { x: number; y: number; h: number }[] }[] };
    // L'ancre MONDE d'une place vient de la règle UNIQUE (`placesLocalesDuProp`), jamais d'un
    // `pos + anchor/mpt` recalculé ici : la géométrie est posée sur le CENTRE de l'empreinte
    // (`decorAncre`), et une empreinte de plus d'une case décale ce centre d'une demi-case — la place
    // se mesurait alors contre un plan de travail qui n'est pas là où le monde le cuit.
    const placesMonde = new Map(placesLocalesDuProp(findPropById(id), CAP_IDENTITE_PROP, METRES_PAR_CASE)
      .map((p) => [p.slot.id, { x: 3 + p.ancre.x, y: 4 + p.ancre.y }]));
    for (const slot of findPropById(id)!.seatSlots!) {
      const ancre = placesMonde.get(slot.id)!;
      let ecart = Number.POSITIVE_INFINITY;
      for (const face of el.faces)
        for (let i = 0; i < face.poly.length; i++) {
          const a = face.poly[i], b = face.poly[(i + 1) % face.poly.length];
          if (a.h <= slot.anchor.hM || b.h <= slot.anchor.hM) continue; // sous l'assise : ce n'est pas le plan de travail
          ecart = Math.min(ecart, distanceAuSegment(ancre, a, b) * METRES_PAR_CASE);
        }
      expect(ecart, `${id}/${slot.id} : écart ancre → bord du plan (m)`).toBeLessThanOrEqual(0.3);
    }
  });

  /**
   * CAPS MESURÉS : les QUATRE cardinaux, pour TOUTE recette. Les diagonales n'ont pas à être mesurées —
   * elles sont refusées À LA DONNÉE par le schéma de scène (`src/data/schemas/defs-scenes/scene.ts`,
   * `superRefine` de `sceneEntitySchema`, marqueur `volume` de `defs/props.ts`), et le chargement d'un projet en
   * meurt (`parseProject`).
   *
   * Ce que cette mesure suit, c'est la POSE dans le monde : le corps cuit part de l'ANCRE de
   * l'empreinte DÉRIVÉE au cap (`decorAncre`), pas du coin NO ni d'une empreinte figée. Un builder qui
   * calerait la recette sur un autre point la décalerait de la demi-case d'un 2×1 tourné.
   */
  it.each(IDS)('%s, cuit à chacun de ses caps, part de l’ancre de son empreinte dérivée et ne descend jamais sous le sol', (id) => {
    for (const facing of DIR4_ORDER) {
      const { offX, offY } = decorFootGeometry(empreinteDeriveeDuProp(findPropById(id)!, facing, METRES_PAR_CASE));
      // La borne, sans constante magique : l'emprise du corps ENTIER (sièges compris) tourné au cap.
      const parts = [...corpsEtSieges(id).corps, ...corpsEtSieges(id).sieges];
      let borneX = 0, borneY = 0;
      for (const { e } of parts)
        for (const [lx, ly] of [[e.x0, e.y0], [e.x1, e.y0], [e.x0, e.y1], [e.x1, e.y1]]) {
          const [rx, ry] = rotatePropLocal(lx, ly, facing);
          borneX = Math.max(borneX, Math.abs(rx));
          borneY = Math.max(borneY, Math.abs(ry));
        }
      const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing }));
      const el = buildProps(scene)[0] as { faces: { poly: { x: number; y: number; h: number }[] }[] };
      for (const face of el.faces)
        for (const p of face.poly) {
          expect(Math.abs(p.x - (3 + offX)), `${id} cap ${facing} x`).toBeLessThanOrEqual(borneX + 1e-9);
          expect(Math.abs(p.y - (4 + offY)), `${id} cap ${facing} y`).toBeLessThanOrEqual(borneY + 1e-9);
          expect(p.h, `${id} cap ${facing} h`).toBeGreaterThanOrEqual(0);
        }
    }
  });

  it('4. ÉMETTEUR : `buildProps` ne lève pas, le volumique en diagonale sort en billboard d’ERREUR, un billboard au même cap garde son art', () => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: 'table-ronde-4-tabourets', pos: { x: 2, y: 2 }, facing: 'N' }));
    const diagonale = { ...scene, entities: [{ ...scene.entities[0], facing: 'NE' as const }] };
    const [fautif] = buildProps(diagonale).filter((el) => el.entId === 'e-1');
    expect(estPropVolumique(fautif), 'un corps tourné de 45° ne se cuit pas').toBe(false);
    expect(fautif.ref, 'le type n’est pas dessiné : l’art billboard d’un volumique ferait passer la faute pour une pose').toBeUndefined();
    expect(propSvg(fautif.ref)).toBe(missingPropSvg(undefined));
    expect(validateScene([diagonale]).map((w) => w.message)).toContain(
      "entité « e-1 » › orientation : décor volumique « table-ronde-4-tabourets » au cap NE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
    );
    const billboard = sceneWith({ ...propEntity({ id: 'e-2', ref: 'brasero', pos: { x: 2, y: 2 }, facing: 'N' }), facing: 'NE' } as SceneEntity);
    const [braise] = buildProps(billboard).filter((el) => el.entId === 'e-2');
    expect(braise.ref).toBe('brasero');
  });

  it.each(IDS)('%s : la cuisson du monde ne RETOURNE aucune de ses faces', (id) => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: 'N' }));
    const el = buildProps(scene).find((e) => e.kind === 'prop' && estPropVolumique(e)) as { faces: Face[] } | undefined;
    expect(el, `${id} : aucun décor volumique cuit dans la scène`).toBeDefined();
    // Les triangles se comparent par AMAS de position, formés sur la géométrie du pivot, et ce qui est
    // mesuré est le MULTI-ENSEMBLE des normales de chaque amas. Deux faces peuvent coïncider (le dessous
    // d'un couvercle sur le dessus du coffre qui le porte) : seul le multi-ensemble distingue alors un
    // retournement. Le biais coplanaire déplace un triangle cuit de 1,5 mm — il rejoint donc toujours
    // l'amas dont il vient.
    const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const dir = (n: Vec3) => [n.x, n.y, n.z].map((v) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3)).join(',');
    const amas: { g: Vec3; attendu: string[]; cuit: string[] }[] = [];
    for (const face of el!.faces)
      for (const tri of fanTriangles(facePoly(face, METRES_PAR_CASE)) as [Vec3, Vec3, Vec3][]) {
        const g = centroide(tri);
        const a = amas.find((c) => dist(c.g, g) < 0.01) ?? (amas.push({ g, attendu: [], cuit: [] }), amas[amas.length - 1]);
        a.attendu.push(dir(polyNormal(tri)!));
      }
    const { geometry } = bakeWorldGeometry(scene, METRES_PAR_CASE, 'jeu');
    const pos = geometry.getAttribute('position');
    const sommet = (i: number) => ({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) });
    let cuits = 0;
    for (const plage of geometry.userData.propVertexRanges.filter((p) => p.entId === 'e-1'))
      for (let i = plage.vertexStart; i + 2 < plage.vertexStart + plage.vertexCount; i += 3) {
        cuits++;
        const tri: [Vec3, Vec3, Vec3] = [sommet(i), sommet(i + 1), sommet(i + 2)];
        const g = centroide(tri);
        amas.reduce((meilleur, c) => (dist(c.g, g) < dist(meilleur.g, g) ? c : meilleur)).cuit.push(dir(polyNormal(tri)!));
      }
    expect(cuits, `${id} : triangles cuits`).toBe(amas.reduce((s, c) => s + c.attendu.length, 0));
    const écarts = amas
      .filter((c) => [...c.cuit].sort().join(' ') !== [...c.attendu].sort().join(' '))
      .map((c) => `amas (${c.g.x.toFixed(2)}, ${c.g.y.toFixed(2)}, ${c.g.z.toFixed(2)}) : attendu [${[...c.attendu].sort().join(' | ')}], cuit [${[...c.cuit].sort().join(' | ')}]`);
    expect(écarts, `${id} : normales retournées à la cuisson`).toEqual([]);
  });
});

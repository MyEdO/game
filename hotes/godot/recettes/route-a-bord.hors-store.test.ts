/**
 * LA ROUTE À BORD (#3772) : chaque case marchable d'un navire posé est atteignable depuis le départ, de pont en pont par
 * ses échelles. La route qui en sort (chaque case, puis le pied de chaque échelle et son geste) est celle que le parcours
 * `bord` de `hotes/godot/recette.mjs` rejoue au clic dans l'export Web : `ROUTE=<dossier>` l'écrit en `<scénario>.json`.
 * Au regard `plateau`, où ce parcours joue, chaque case de la route est la plus haute que le monde montre à la verticale
 * du point où l'hôte la publie (`Monde.lieu` : la station d'une case que le modèle du navire rogne, `stationsDuNavire`,
 * son centre sinon), depuis la case d'avant (#4040).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scenario as barge } from '../../../src/scenes/test-scenarios/a-bord-de-la-barge';
import { scenario as caraque } from '../../../src/scenes/test-scenarios/a-bord-de-la-caraque';
import { walkReachableFrom } from '../../../src/noyau/monde/path';
import { heightAt, isWalkable, startOf } from '../../../src/noyau/monde/scene';
import type { Scene } from '../../../src/noyau/monde/scene';
import { naviresDeLaScene, poserLesNavires, stationsDuNavire, type EmprisesDesCases } from '../../../src/noyau/planDeNavire';
import { DOSSIER_DES_MODELES, manifestesDesModeles } from '../asset/release';
import { masqueDuRegard } from '../../../src/noyau/monde/aretes';
import { volumeDuMonde } from '../../../src/noyau/monde/volume/volume';
import { trianglesMontres } from '../../../src/noyau/monde/volume/volume.testkit';

type Case = { x: number; y: number; z: number };
type Etape = { aller: Case } | { escalade: 'monter' | 'descendre'; vers: Case };

const cle = (p: { x: number; y: number; z?: number }) => `${p.x},${p.y},${p.z ?? 0}`;
const PAS = { N: [0, -1], S: [0, 1], E: [1, 0], O: [-1, 0], W: [-1, 0] } as const;

/** Les composantes marchables de la scène, reliées par ses échelles, parcourues depuis le départ. */
function routeABord(scene: Scene) {
  const composante = new Map<string, number>();
  const cases: Case[][] = [];
  for (const l of scene.layers) for (let y = 0; y < scene.dimensions.h; y++) for (let x = 0; x < scene.dimensions.w; x++) {
    if (!isWalkable(scene, x, y, l.z) || composante.has(cle({ x, y, z: l.z }))) continue;
    const id = cases.length;
    cases.push([]);
    for (const p of walkReachableFrom(scene, { x, y, z: l.z })) { composante.set(cle(p), id); cases[id].push({ x: p.x, y: p.y, z: p.z ?? 0 }); }
  }
  const echelles: { de: number; vers: number; a: Case; b: Case; sens: 'monter' | 'descendre' }[] = [];
  const orphelines: string[] = [];
  for (const w of (scene.walls ?? []).filter((m) => m.climb)) {
    const z = w.z ?? 0;
    const [dx, dy] = PAS[w.side as keyof typeof PAS];
    const a = { x: w.x, y: w.y, z };
    const b = { x: w.x + dx, y: w.y + dy, z };
    const ca = composante.get(cle(a));
    const cb = composante.get(cle(b));
    if (ca === undefined || cb === undefined) { orphelines.push(cle(a) + w.side); continue; }
    const sens = (p: Case, q: Case) => (heightAt(scene, q.x, q.y, z) > heightAt(scene, p.x, p.y, z) ? 'monter' : 'descendre');
    echelles.push({ de: ca, vers: cb, a, b, sens: sens(a, b) }, { de: cb, vers: ca, a: b, b: a, sens: sens(b, a) });
  }
  const depart = startOf(scene)!;
  const etapes: Etape[] = [];
  const vues = new Set<number>();
  const visiter = (c: number) => {
    vues.add(c);
    for (const p of [...cases[c]].sort((p, q) => p.z - q.z || p.y - q.y || (p.y % 2 ? q.x - p.x : p.x - q.x))) etapes.push({ aller: p });
    for (const e of echelles.filter((m) => m.de === c)) {
      if (vues.has(e.vers)) continue;
      etapes.push({ aller: e.a }, { escalade: e.sens, vers: e.b });
      visiter(e.vers);
      const retour = echelles.find((r) => r.de === e.vers && r.vers === c && cle(r.a) === cle(e.b))!;
      etapes.push({ aller: retour.a }, { escalade: retour.sens, vers: retour.b });
    }
  };
  visiter(composante.get(cle(depart))!);
  const isolees = cases.flatMap((c, i) => (vues.has(i) ? [] : [cle(c[0])]));
  return { depart, etapes, orphelines, isolees };
}

/** Les manifestes commités des éléments `vehicule` du projet Godot, par la définition de leur véhicule (`cle`). */
const MANIFESTES_DE_VEHICULE = new Map(manifestesDesModeles(DOSSIER_DES_MODELES).entrees
  .map(({ brut }) => brut as { categorie?: string; cle?: { definition?: string }; cases?: EmprisesDesCases })
  .filter((m) => m.categorie === 'vehicule' && m.cle?.definition).map((m) => [m.cle!.definition!, m]));

/** Le point (en cases, la case centrée sur l'entier) où l'hôte publie chaque case de `scene` : la station de chaque case
 *  que le modèle de son navire rogne (`stationsDuNavire`), par sa clé `x,y,z`. */
const stationsDe = (scene: Scene): Map<string, { x: number; y: number }> => new Map(naviresDeLaScene(scene).flatMap(({ id, vehicule }) =>
  stationsDuNavire(scene, id, MANIFESTES_DE_VEHICULE.get(vehicule.definition)?.cases ?? {}).map((s) => [cle(s), s.point] as const)));

/** La case du triangle le plus haut des triangles `tris` à la verticale du point (`x`, `z`) du monde (m), et sa hauteur. */
function plusHautA(tris: ReturnType<typeof trianglesMontres>, x: number, z: number): { case: string; y: number } | undefined {
  let haut: { case: string; y: number } | undefined;
  for (const t of tris) {
    const [[x0, x1, x2], [z0, z1, z2]] = [t.xs, t.zs];
    const aire = (x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0);
    if (Math.abs(aire) < 1e-9) continue;
    const b1 = ((x - x0) * (z2 - z0) - (x2 - x0) * (z - z0)) / aire;
    const b2 = ((x1 - x0) * (z - z0) - (x - x0) * (z1 - z0)) / aire;
    if (b1 < -1e-6 || b2 < -1e-6 || b1 + b2 > 1 + 1e-6) continue;
    const y = t.ys[0] + b1 * (t.ys[1] - t.ys[0]) + b2 * (t.ys[2] - t.ys[0]);
    if (!haut || y > haut.y) haut = { case: t.case.join(','), y };
  }
  return haut;
}

describe('la route à bord', () => {
  for (const [nom, s] of [['a-bord-de-la-caraque', caraque], ['a-bord-de-la-barge', barge]] as const) {
    it(`${nom} : chaque case marchable atteinte depuis le départ, aucune échelle orpheline`, () => {
      const route = routeABord(poserLesNavires(s.construire!((p: string) => p).scene));
      expect({ orphelines: route.orphelines, isolees: route.isolees }).toEqual({ orphelines: [], isolees: [] });
      if (process.env.ROUTE) writeFileSync(join(process.env.ROUTE, `${nom}.json`), JSON.stringify({ depart: route.depart, etapes: route.etapes }, null, 1));
    });

    it(`${nom} : au plateau, depuis la case d'avant, chaque case de la route est la plus haute montrée à la verticale de son point (#4040)`, () => {
      const scene = poserLesNavires(s.construire!((p: string) => p).scene);
      const { depart, etapes } = routeABord(scene);
      const volume = volumeDuMonde(scene);
      const stations = stationsDe(scene);
      const montres = new Map<string, ReturnType<typeof trianglesMontres>>();
      const couvertes: string[] = [];
      let g: Case = { x: depart.x, y: depart.y, z: depart.z ?? 0 };
      for (const e of etapes) {
        if ('escalade' in e) { g = e.vers; continue; }
        const c = e.aller;
        const tris = montres.get(cle(g)) ?? montres.set(cle(g), trianglesMontres(volume, masqueDuRegard(scene, [g], 'plateau'))).get(cle(g))!;
        const point = stations.get(cle(c)) ?? c;
        const touche = plusHautA(tris, point.x * volume.metresParCase, point.y * volume.metresParCase);
        if (touche?.case !== cle(c)) couvertes.push(`${cle(c)} depuis ${cle(g)} : ${touche ? `${touche.case} à ${touche.y.toFixed(2)} m` : 'rien'}`);
        g = c;
      }
      expect(couvertes).toEqual([]);
    });
  }
});

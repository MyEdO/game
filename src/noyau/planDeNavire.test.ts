import { describe, it, expect } from 'vitest';
import { buildScene } from './mapSpec';
import { naviresDeLaScene, poserLesNavires, provenanceDesNavires } from './planDeNavire';
import { PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';
import { bassinDeLaCaraque } from './planDeNavire.testkit';
import { heightAt, tileAt, wallBetween, type Scene } from './monde/scene';
import { estAbsent } from './monde/terrain';
import { edgeKey } from './monde/facades';
import { aretesDeLaCouche, plateauDeLaScene, volumeDuRegard } from './monde/aretes';
import { parseSceneDeProjet } from './worldMap';
import { volumeDuMonde } from './monde/volume/volume';
import { ficheDEntite } from './monde/sceneNpc';
import { placeCombatant } from './monde/spawn';
import { casesTenues, combatantAtTile } from './monde/combatGeometry';
import { footprintN } from './monde/footprint';
import { registerScene, resetSceneRegistry } from './monde/registreDesScenes';
import { garanti } from '../lib/garanti';

const plan = buildScene(PLAN_DE_LA_CARAQUE);

/** Un bassin sans ses ponts : la caraque `c1` depuis (10, 2), au cap `facing`, à l'échelle `metresPerTile`. */
const authored = (facing: 'N' | 'NE' | 'E' | 'O', metresPerTile?: number) => buildScene({
  id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', ...(metresPerTile ? { metresPerTile } : {}),
  entities: [{ id: 'c1', kind: 'personnage', ref: 'caraque', pos: { x: 10, y: 2 }, facing }],
});

describe('les ponts se dérivent de l’entité du navire (#3686)', () => {
  it('à l’échelle de son plan, la caraque garde son entité et ses ponts s’en dérivent ; les dériver de nouveau rend la même scène', () => {
    const s = poserLesNavires(authored('O'));
    expect(s.entities.filter((e) => e.kind === 'personnage')).toEqual(authored('O').entities.filter((e) => e.kind === 'personnage'));
    expect(provenanceDesNavires(s).cases.size).toBeGreaterThan(0);
    expect(poserLesNavires(s)).toEqual(s);
  });

  it('à une autre échelle, celle de la mer, aucun pont ne se pose', () => {
    const enMer = authored('O', 10);
    expect(poserLesNavires(enMer)).toEqual(enMer);
    expect(naviresDeLaScene(enMer)).toEqual([]);
  });

  it('ses ponts ne se posent qu’à un cap cardinal', () => {
    expect(() => poserLesNavires(authored('NE'))).toThrow(/c1.*cardinal.*NE/);
  });

  it('ses ponts se centrent sur son empreinte de combattant, au plus près d’une demi-case en travers', () => {
    // empreinte 4 × 4 depuis (10, 2) : centre (11.5, 3.5) ; ponts 18 × 5 au cap O : coin (3, 2), centre (11.5, 4)
    expect(footprintN(ficheDEntite(authored('O').entities[0], () => undefined))).toBe(4);
    const { cases } = provenanceDesNavires(poserLesNavires(authored('O')));
    const xs = [...cases.keys()].map((k) => Number(k.split(',')[0]));
    const ys = [...cases.keys()].map((k) => Number(k.split(',')[1]));
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([3, 20, 2, 6]);
  });

  it('chaque case de sol et chaque arête des ponts porte son navire ; l’eau du bassin, non', () => {
    const { cases, aretes } = provenanceDesNavires(bassinDeLaCaraque('O'));
    const solsDuPlan = plan.layers.flatMap(({ z }) => Array.from({ length: 18 * 5 }, (_, i) => ({ x: i % 18, y: Math.floor(i / 18), z })))
      .filter((c) => !estAbsent(tileAt(plan, c.x, c.y, c.z)));
    expect(cases.size).toBe(solsDuPlan.length);
    for (const c of solsDuPlan) expect(cases.get(`${3 + c.x},${2 + c.y},${c.z}`), `${c.x},${c.y},${c.z}`).toBe('c1');
    expect(cases.has('0,0,0')).toBe(false);
    expect(aretes.size).toBe((plan.walls ?? []).length);
    expect([...aretes.values()].every((id) => id === 'c1')).toBe(true);
  });

  it('le document de la scène garde le navire seul : sa porte n’en dérive aucun pont, que l’éditeur ne dessine ni la forme dépôt n’écrit', () => {
    const lue = parseSceneDeProjet(JSON.parse(JSON.stringify(authored('O'))));
    expect(lue.entities.map((e) => e.id)).toEqual(['c1']);
    expect(lue.walls ?? []).toEqual([]);
    expect([0, 1, 2, 3].flatMap((z) => aretesDeLaCouche(lue, z))).toEqual([]);
  });

  it('une scène entre en jeu ses ponts posés (`registerScene`)', () => {
    resetSceneRegistry();
    expect(registerScene(authored('O'))).toEqual(poserLesNavires(authored('O')));
  });
});

describe('ce qu’un hôte dessine d’une scène qui porte un navire', () => {
  const s = bassinDeLaCaraque('O', ['embarcation-de-bord']);
  const { cases, aretes, flottaison } = provenanceDesNavires(s);

  it('le volume garde le sol des ponts sous le navire, pour le pointage ; les décors restent peints', () => {
    const volume = volumeDuMonde(s);
    const triangles = volume.surfaces.flatMap((surface) =>
      Array.from({ length: (surface.fin - surface.debut) / 3 }, (_, i) => ({ surface, cell: volume.cases[surface.debut / 3 + i] })));
    const duNavire = triangles.filter((t) => t.surface.navire !== undefined);
    expect(duNavire.length).toBeGreaterThan(0);
    for (const { surface, cell } of duNavire) {
      expect(surface.navire).toBe('c1');
      expect(cases.has(cell.join(',')), cell.join(',')).toBe(true);
      expect(surface.matiere.startsWith('prop--'), surface.matiere).toBe(false);
    }
    const sols = triangles.filter((t) => t.surface.navire === undefined && t.surface.flottaison === undefined && !t.surface.matiere.startsWith('prop--'));
    for (const { cell } of sols) expect(cases.has(cell.join(',')) || flottaison.has(cell.join(',')), cell.join(',')).toBe(false);
    expect(triangles.some((t) => t.surface.navire === undefined && t.surface.matiere.startsWith('prop--'))).toBe(true);
  });

  it('la mer borde le navire sur l’emprise de ses ponts, à la hauteur 0, à la place du sol de la scène', () => {
    const volume = volumeDuMonde(s);
    expect(flottaison.size).toBe(PLAN_DE_LA_CARAQUE.size[0] * PLAN_DE_LA_CARAQUE.size[1]);
    expect(new Set(flottaison.values())).toEqual(new Set(['c1']));
    const mer = volume.surfaces.filter((surface) => surface.flottaison !== undefined);
    expect(mer.map(({ matiere, flottaison: navire }) => ({ matiere, navire }))).toEqual([{ matiere: 'terrain--eau', navire: 'c1' }]);
    const [{ debut, fin }] = mer;
    expect((fin - debut) / 3).toBe(2 * flottaison.size);
    for (let i = debut; i < fin; i++) expect(volume.positions[3 * i + 1]).toBeCloseTo(0, 2);
    expect(new Set(volume.cases.slice(debut / 3, fin / 3).map((c) => c.join(',')))).toEqual(new Set(flottaison.keys()));
  });

  it('le plateau coupe le modèle du navire sous le pont du groupe, et retire du volume les ponts au-dessus de la coupe', () => {
    const coupes = (z: number, regard: 'tactique' | 'plateau' | 'immersion', x = 11) => plateauDeLaScene(s, [{ x, y: 4, z }], regard).coupesDesNavires;
    expect([coupes(0, 'tactique'), coupes(0, 'plateau'), coupes(0, 'immersion')]).toEqual([{ c1: 0 }, { c1: 0 }, {}]);
    expect([coupes(1, 'tactique'), coupes(1, 'plateau'), coupes(1, 'immersion')]).toEqual([{ c1: heightAt(s, 11, 4, 2) }, { c1: heightAt(s, 11, 4, 2) }, {}]);
    expect(coupes(2, 'tactique', 18)).toEqual({ c1: heightAt(s, 18, 4, 3) });
    expect(coupes(3, 'plateau')).toEqual({});
    const volume = volumeDuRegard(s, [{ x: 11, y: 4, z: 1 }], 'tactique');
    const couches = new Set(volume.cases.filter((c) => cases.has(c.join(','))).map((c) => c[2]));
    expect(couches).toEqual(new Set([0, 1]));
  });

  it('le plateau ne dessine aucune arête des ponts, que la marche garde', () => {
    const plateau = plateauDeLaScene(s, [{ x: 12, y: 4, z: 2 }], 'tactique');
    expect(plateau.aretes.filter((a) => aretes.has(a.cle))).toEqual([]);
    expect((s.walls ?? []).filter((w) => aretes.has(edgeKey(w)))).toHaveLength(aretes.size);
    expect(wallBetween(s, 9, 2, 9, 1, 2)).toBe(true);
  });

  it('le navire se montre par son modèle : le véhicule de sa fiche à sa taille réelle, au centre de ses ponts', () => {
    expect(naviresDeLaScene(s)).toEqual([{ id: 'c1', vehicule: expect.objectContaining({ definition: 'caraque', taille: 'reelle', cap: 'O', ameliorations: expect.arrayContaining(['embarcation-de-bord']) }), centre: { x: 11.5, y: 4 } }]);
    expect(naviresDeLaScene(bassinDeLaCaraque('N'))).toMatchObject([{ centre: { x: 5, y: 10.5 }, vehicule: { cap: 'N' } }]);
  });
});

describe('le navire combattant ne tient pas ses propres ponts', () => {
  /** La caraque `c1` de `scene` en combattant, placée à sa case. */
  const combattant = (scene: Scene) => {
    const ent = garanti(scene.entities.find((e) => e.id === 'c1'), 'c1', 'caraque');
    const c = ficheDEntite(ent, () => undefined);
    placeCombatant(c, scene, ent.pos);
    return c;
  };

  it('sur ses ponts, son empreinte ne tient aucune case et aucune n’est sous lui : on y marche', () => {
    const c = combattant(bassinDeLaCaraque('O'));
    expect(c.surSesPonts).toBe(true);
    expect(casesTenues([c], () => true).size).toBe(0);
    expect(combatantAtTile([c], 11, 3, 0)).toBeUndefined();
  });

  it('en mer, il tient les 4 × 4 cases de son empreinte', () => {
    const c = combattant(authored('O', 10));
    expect(c.surSesPonts).toBeUndefined();
    expect(casesTenues([c], () => true).size).toBe(16);
    expect(combatantAtTile([c], 11, 3, 0)?.id).toBe('c1');
  });
});

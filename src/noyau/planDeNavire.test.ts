import { describe, it, expect } from 'vitest';
import { buildScene } from './mapSpec';
import { PLANS_DE_NAVIRE, naviresDeLaScene, poserLesNavires, provenanceDesNavires } from './planDeNavire';
import { PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';
import { bassinDeLaCaraque } from './planDeNavire.testkit';
import { heightAt, isWalkable, sceneMetresPerTile, tileAt, wallBetween, type Scene } from './monde/scene';
import { ancreDuDecor, propFootTiles } from './monde/footprint';
import { piedDuDecor } from './monde/poseDuDecor';
import { facesDuDecor } from './monde/volume/propVolumes';
import { walkReachableFrom } from './monde/path';
import { VEHICLES_LIST } from '../engine/travel';
import { estAbsent, terrainAbsent } from './monde/terrain';
import { edgeKey } from './monde/facades';
import { aretesDeLaCouche, aretesDeLaScene, masqueDuRegard, plateauDeLaScene } from './monde/aretes';
import { parseSceneDeProjet } from './worldMap';
import { empreinteDesDecors, volumeDepuis, volumeDuMonde } from './monde/volume/volume';
import { removeEntities } from './combatPlacement';
import { casesMontrees, trianglesDuVolume } from './monde/volume/volume.testkit';
import { ficheDEntite } from './monde/sceneNpc';
import { placeCombatant } from './monde/spawn';
import { casesTenues, combatantAtTile } from './monde/combatGeometry';
import { footprintN } from './monde/footprint';
import { registerScene, resetSceneRegistry } from './monde/registreDesScenes';
import { walkNeighbors } from './monde/path';
import { garanti } from '../lib/garanti';
import { datasetArray, setDataset } from '../data/overrides';
import { validateScene } from './validateScene';
import { capsOfferts } from './sceneEditLecture';

const plan = buildScene(PLAN_DE_LA_CARAQUE);

/** Un bassin sans ses ponts : la caraque `c1` depuis (10, 2), au cap `facing`, à l'échelle `metresPerTile`. */
const authored = (facing: 'N' | 'NE' | 'E' | 'O', metresPerTile?: number) => buildScene({
  id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', ...(metresPerTile ? { metresPerTile } : {}),
  entities: [{ id: 'c1', kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x: 10, y: 2 }, facing }],
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

  /** `scene` dont la caraque `c1` est au cap `NE`, comme un JSON écrit hors de l'éditeur la porterait. */
  const deBiais = (scene: Scene): Scene => ({ ...scene, entities: scene.entities.map((e) => (e.id === 'c1' ? { ...e, facing: 'NE' as const } : e)) });

  it('à un cap non cardinal, le schéma refuse le navire, la validation nomme la faute et ses ponts ne se posent pas (#3772)', () => {
    expect(() => authored('NE')).toThrow(/c1.*navire « caraque » au cap NE — un navire à ponts ne prend qu'un cap cardinal/);
    const scene = deBiais(authored('O'));
    expect(validateScene([scene]).filter((w) => w.refId === 'c1').map((w) => [w.level, w.message])).toEqual([
      ['error', expect.stringContaining("navire « caraque » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)")],
    ]);
    expect(poserLesNavires(scene)).toEqual(scene);
  });

  it('un navire à ponts n’est offert qu’aux caps cardinaux, à toute échelle : changer d’échelle ne fait pas un navire de biais', () => {
    expect(capsOfferts(authored('O').entities[0])).toEqual(['N', 'E', 'S', 'O']);
    expect(capsOfferts(authored('O', 10).entities[0])).toEqual(['N', 'E', 'S', 'O']);
    expect(() => authored('NE', 10)).toThrow(/navire « caraque » au cap NE/);
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
    const triangles = trianglesDuVolume(volumeDuMonde(s)).map(({ surface, case: cell }) => ({ surface, cell }));
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
    expect(flottaison.size).toBe(PLAN_DE_LA_CARAQUE.size[0] * PLAN_DE_LA_CARAQUE.size[1]);
    expect(new Set(flottaison.values())).toEqual(new Set(['c1']));
    const mer = trianglesDuVolume(volumeDuMonde(s)).filter((t) => t.surface.flottaison !== undefined);
    expect(new Set(mer.map(({ surface }) => `${surface.matiere} ${surface.flottaison}`))).toEqual(new Set(['terrain--eau c1']));
    expect(mer.length).toBe(2 * flottaison.size);
    for (const t of mer) for (const y of t.ys) expect(y).toBeCloseTo(0, 2);
    expect(new Set(mer.map((t) => t.case.join(',')))).toEqual(new Set(flottaison.keys()));
  });

  it('le plateau coupe le modèle du navire sous le pont du groupe, et retire du volume les ponts au-dessus de la coupe', () => {
    const coupes = (z: number, regard: 'tactique' | 'plateau' | 'immersion', x = 11) => plateauDeLaScene(s, [{ x, y: 4, z }], regard).coupesDesNavires;
    expect([coupes(0, 'tactique'), coupes(0, 'plateau'), coupes(0, 'immersion')]).toEqual([{ c1: heightAt(s, 11, 4, 1) }, { c1: heightAt(s, 11, 4, 1) }, {}]);
    expect([coupes(1, 'tactique'), coupes(1, 'plateau'), coupes(1, 'immersion')]).toEqual([{ c1: heightAt(s, 11, 4, 2) }, { c1: heightAt(s, 11, 4, 2) }, {}]);
    expect(coupes(2, 'tactique', 18)).toEqual({ c1: heightAt(s, 18, 4, 3) });
    expect(coupes(3, 'plateau')).toEqual({});
    const montrees = casesMontrees(volumeDuMonde(s), masqueDuRegard(s, [{ x: 11, y: 4, z: 1 }], 'tactique'));
    const couches = new Set([...montrees].filter((c) => cases.has(c)).map((c) => Number(c.split(',')[2])));
    expect(couches).toEqual(new Set([0, 1]));
  });

  it('au plateau, la hune du Nid-de-pie, d’une couche plus basse, ne couvre pas la passerelle sous elle : retirée, le navire coupé à son plancher (#4040)', () => {
    // la caraque du scénario `a-bord-de-la-caraque`, en (9, 2) au cap E : ici en (10, 2), la passerelle sous la hune en (11, 4, 3)
    const n = bassinDeLaCaraque('E', ['nid-de-pie']);
    const [hune, passerelle, embelle] = [{ x: 11, y: 4, z: 2 }, { x: 11, y: 4, z: 3 }, { x: 12, y: 4, z: 2 }];
    expect(heightAt(n, hune.x, hune.y, hune.z)).toBeGreaterThan(heightAt(n, passerelle.x, passerelle.y, passerelle.z));
    const montree = (depuis: typeof hune, regard: 'plateau' | 'tactique') => casesMontrees(volumeDuMonde(n), masqueDuRegard(n, [depuis], regard)).has('11,4,2');
    expect(montree(passerelle, 'plateau')).toBe(false);
    expect(plateauDeLaScene(n, [passerelle], 'plateau').coupesDesNavires).toEqual({ c1: heightAt(n, hune.x, hune.y, hune.z) });
    expect(montree(embelle, 'plateau')).toBe(true);
    expect(montree(passerelle, 'tactique')).toBe(true);
    expect(plateauDeLaScene(n, [passerelle], 'tactique').coupesDesNavires).toEqual({});
  });

  it('au plateau, un allié debout dans la hune y reste montré quand un autre se tient sur la passerelle, le navire non coupé (#4040)', () => {
    const n = bassinDeLaCaraque('E', ['nid-de-pie']);
    const allies = [{ x: 11, y: 4, z: 2 }, { x: 7, y: 2, z: 3 }];
    expect(heightAt(n, 7, 2, 3)).toBeLessThan(heightAt(n, 11, 4, 2));
    expect(casesMontrees(volumeDuMonde(n), masqueDuRegard(n, allies, 'plateau')).has('11,4,2')).toBe(true);
    expect(plateauDeLaScene(n, allies, 'plateau').coupesDesNavires).toEqual({});
  });

  it('au plateau, le groupe seul dans la hune la voit, voit sous ses pieds la passerelle et les gaillards, le navire non coupé (#4040)', () => {
    const n = bassinDeLaCaraque('E', ['nid-de-pie']);
    const hune = { x: 11, y: 4, z: 2 };
    const marchables3 = [...provenanceDesNavires(n).cases.keys()].map((cle) => cle.split(',').map(Number))
      .filter(([x, y, z]) => z === 3 && isWalkable(n, x, y, z)).map((c) => c.join(','));
    expect(marchables3.every((cle) => { const [x, y, z] = cle.split(',').map(Number); return heightAt(n, x, y, z) < heightAt(n, hune.x, hune.y, hune.z); })).toBe(true);
    const montrees = casesMontrees(volumeDuMonde(n), masqueDuRegard(n, [hune], 'plateau'));
    expect(montrees.has('11,4,2'), 'la hune où se tient le groupe').toBe(true);
    expect(marchables3.filter((cle) => !montrees.has(cle)), 'les cases marchables de la couche 3, sous le pied du groupe').toEqual([]);
    expect(plateauDeLaScene(n, [hune], 'plateau').coupesDesNavires, 'aucune coupe sous le plancher de la hune').toEqual({});
  });

  it('le plateau et son masque suivent le catalogue des terrains édité, sur la même scène et les mêmes alliés, et reviennent à sa restauration (#4040)', () => {
    const base = bassinDeLaCaraque('E', ['nid-de-pie']);
    const { w } = base.dimensions;
    const catalogue = [...datasetArray('terrains')];
    const vide = terrainAbsent();
    const poses = new Set(base.layers.flatMap((l) => l.tiles));
    const avecSol = (sol: string): Scene => ({ ...base, layers: base.layers.map((l) => (l.z === 3 ? { ...l, tiles: l.tiles.map((t, i) => (i === 4 * w + 11 ? sol : t)) } : l)) });
    const sol = garanti(catalogue.map((t) => t.id).find((id) => !poses.has(id) && !estAbsent(id) && isWalkable(avecSol(id), 11, 4, 3)), 'terrains', 'un terrain marchable que la scène ne porte pas');
    const n = avecSol(sol);
    expect(n.layers.flatMap((l) => l.tiles).filter((t) => t === sol), `seule la case (11, 4, 3) porte « ${sol} »`).toHaveLength(1);
    const passerelle = [{ x: 11, y: 4, z: 3 }];
    const lu = () => {
      const plateau = plateauDeLaScene(n, passerelle, 'plateau');
      const masque = masqueDuRegard(n, passerelle, 'plateau');
      return { plateau, masque, hune: casesMontrees(volumeDepuis(n, null).volume, masque).has('11,4,2') };
    };
    const avant = lu();
    expect(avant.hune, 'la hune, couvrant la passerelle où se tient le groupe, retirée').toBe(false);
    expect(avant.plateau.coupesDesNavires, 'le navire coupé au plancher de la hune').toEqual({ c1: heightAt(n, 11, 4, 2) });
    expect(lu().plateau, 'sans écriture au catalogue, le plateau relu est le même objet').toBe(avant.plateau);
    try {
      setDataset('terrains', catalogue.map((t) => (t.id === sol ? { ...t, absence: true } : t.id === vide ? { ...t, absence: undefined } : t)));
      const edite = lu();
      expect(edite.hune, `« ${sol} » absent : la case (11, 4, 3) n'est plus couverte par la hune, montrée`).toBe(true);
      expect(edite.plateau.coupesDesNavires.c1, `« ${sol} » absent : le navire n’est plus coupé au plancher de la hune`).not.toBe(heightAt(n, 11, 4, 2));
      expect(edite.masque, `« ${sol} » absent : le masque change`).not.toEqual(avant.masque);
      expect(edite.plateau.cleDuRetrait, `« ${sol} » absent : la clé du retrait change`).not.toBe(avant.plateau.cleDuRetrait);
      expect(edite.plateau.oeilsSousPlafond, `« ${sol} » absent : la case (11, 4, 3) ne plafonne plus l’œil`).not.toEqual(avant.plateau.oeilsSousPlafond);
      expect(edite.plateau.cleDuMonde, 'catalogue édité : la clé du monde change').not.toBe(avant.plateau.cleDuMonde);
    } finally {
      setDataset('terrains', catalogue);
    }
    const restaure = lu();
    expect([restaure.plateau.coupesDesNavires, restaure.masque, restaure.plateau.oeilsSousPlafond], 'catalogue restauré : coupes, masque et œils d’avant')
      .toEqual([avant.plateau.coupesDesNavires, avant.masque, avant.plateau.oeilsSousPlafond]);
  });

  it('du haut d’une échelle de trappe, au niveau du pont du dessus, ce pont reste montré à ce niveau et coupé au-dessus de lui', () => {
    const hauts = [...cases.keys()].map((cle) => cle.split(',').map(Number)).map(([x, y, z]) => ({ x, y, z }))
      .filter((p) => walkNeighbors(s, p).some((n) => (n.z ?? 0) > p.z && heightAt(s, n.x, n.y, n.z ?? 0) <= heightAt(s, p.x, p.y, p.z)));
    expect(hauts.length).toBeGreaterThan(0);
    for (const haut of hauts) {
      const dessus = Math.max(...walkNeighbors(s, haut).map((n) => n.z ?? 0));
      const pont = [...cases.keys()].map((cle) => cle.split(',').map(Number))
        .filter(([x, y, z]) => z === dessus && heightAt(s, x, y, z) <= heightAt(s, haut.x, haut.y, haut.z)).map((c) => c.join(','));
      expect(pont.length).toBeGreaterThan(0);
      for (const regard of ['tactique', 'plateau'] as const) {
        const montrees = casesMontrees(volumeDuMonde(s), masqueDuRegard(s, [haut], regard));
        expect(pont.filter((cle) => !montrees.has(cle)), `${regard} depuis ${JSON.stringify(haut)}`).toEqual([]);
        const coupe = plateauDeLaScene(s, [haut], regard).coupesDesNavires.c1;
        expect(coupe === undefined || coupe > heightAt(s, haut.x, haut.y, haut.z), `${regard} depuis ${JSON.stringify(haut)} : coupe ${coupe}`).toBe(true);
      }
    }
  });

  it('la clé du monde change quand le navire bouge', () => {
    const deplace = (x: number) => poserLesNavires({ ...authored('O'), entities: authored('O').entities.map((e) => (e.id === 'c1' ? { ...e, pos: { x, y: 2 } } : e)) });
    expect(plateauDeLaScene(deplace(11), [], 'immersion').cleDuMonde).not.toBe(plateauDeLaScene(deplace(10), [], 'immersion').cleDuMonde);
  });

  it('la clé du monde change quand le navire vaincu quitte la scène, ses décors restés sur ses ponts', () => {
    let scene: Scene = s;
    const get = (() => ({ scene, party: [], objetsAuSol: {} })) as never;
    const set = ((patch: { scene: Scene }) => { scene = patch.scene; }) as never;
    removeEntities(get, set, ['c1']);
    expect(provenanceDesNavires(scene).cases.size).toBe(0);
    expect(empreinteDesDecors(scene)).toBe(empreinteDesDecors(s));
    expect(plateauDeLaScene(scene, [], 'immersion').cleDuMonde).not.toBe(plateauDeLaScene(s, [], 'immersion').cleDuMonde);
  });

  it('le plateau ne dessine aucune arête des ponts, que la marche garde', () => {
    expect(aretesDeLaScene(s).filter((a) => aretes.has(a.cle))).toEqual([]);
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

describe('chaque navire à ponts se parcourt d’un bout à l’autre (#3772)', () => {
  const navires = VEHICLES_LIST.filter((v) => v.ponts).map((v) => v.id);
  /** Le navire `ref` posé au cap `cap` dans un bassin de 30 × 30 cases. */
  const bassin = (ref: string, cap: 'N' | 'E' | 'S' | 'O') => poserLesNavires(buildScene({
    id: 'bassin', label: 'Bassin', size: [30, 30], terrain: 'eau',
    entities: [{ id: 'n1', kind: 'personnage', vehicule: { id: ref }, pos: { x: 13, y: 13 }, facing: cap }],
  }));
  const k = (p: { x: number; y: number; z?: number }) => `${p.x},${p.y},${p.z ?? 0}`;
  /** Les cases que joignent, de proche en proche depuis `depart`, la marche (`walkReachableFrom`) et les arêtes
   *  escaladables (`climb`) des échelles. */
  const reseau = (scene: Scene, depart: { x: number; y: number; z: number }) => {
    const vus = new Set<string>();
    const file = [depart];
    while (file.length) {
      const c = garanti(file.pop(), 'file', 'case');
      if (vus.has(k(c))) continue;
      for (const p of walkReachableFrom(scene, c)) vus.add(k(p));
      for (const w of scene.walls ?? []) {
        if (!w.climb || (w.side !== 'N' && w.side !== 'E')) continue;
        const z = w.z ?? 0;
        const [a, b] = [{ x: w.x, y: w.y, z }, w.side === 'N' ? { x: w.x, y: w.y - 1, z } : { x: w.x + 1, y: w.y, z }];
        if (vus.has(k(a)) && !vus.has(k(b))) file.push(b);
        if (vus.has(k(b)) && !vus.has(k(a))) file.push(a);
      }
    }
    return vus;
  };

  it('chaque véhicule dont la fiche porte des ponts a son plan', () => {
    expect(navires.length).toBeGreaterThan(1);
    expect(navires.filter((id) => !PLANS_DE_NAVIRE.some((p) => p.ponts.id === id))).toEqual([]);
  });

  it.each(PLANS_DE_NAVIRE.map((p) => p.ponts))('$id : aucun décor ne monte au-dessus du sol du pont qui le couvre (#4040)', (ponts) => {
    const scene = buildScene(ponts);
    const mpt = sceneMetresPerTile(scene);
    const fautifs = scene.entities.flatMap((e) => {
      if (e.kind !== 'prop') return [];
      const z = e.z ?? 0;
      const plafonds = propFootTiles(e.decor?.id, e.pos, e.facing, mpt).flatMap(({ x, y }) => {
        const dessus = scene.layers.map((l) => l.z).filter((lz) => lz > z && !estAbsent(tileAt(scene, x, y, lz)));
        return dessus.length ? [heightAt(scene, x, y, Math.min(...dessus))] : [];
      });
      if (!plafonds.length) return [];
      const faces = facesDuDecor(e.decor?.id, { ancre: ancreDuDecor(e, mpt), ...(e.facing ? { facing: e.facing } : {}), baseHeightM: piedDuDecor(scene, e) }, mpt) ?? [];
      const haut = Math.max(...faces.flatMap((f) => f.poly.map((p) => p.h)));
      const plafond = Math.min(...plafonds);
      return haut > plafond ? [`${e.id} (${e.decor?.id}) : haut ${haut.toFixed(3)} m, sol du pont du dessus ${plafond} m`] : [];
    });
    expect(fautifs).toEqual([]);
  });

  it.each(navires)('%s : posé à chaque cap, ses cases marchables forment un seul réseau, par la marche et ses échelles', (ref) => {
    for (const cap of ['N', 'E', 'S', 'O'] as const) {
      const scene = bassin(ref, cap);
      const marchables = [...provenanceDesNavires(scene).cases.keys()].map((cle) => cle.split(',').map(Number))
        .filter(([x, y, z]) => isWalkable(scene, x, y, z)).map(([x, y, z]) => ({ x, y, z }));
      expect(marchables.length, `${ref} au cap ${cap}`).toBeGreaterThan(0);
      const atteint = reseau(scene, marchables[0]);
      expect(marchables.filter((c) => !atteint.has(k(c))).map(k), `${ref} au cap ${cap}`).toEqual([]);
    }
  });
});

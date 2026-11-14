/**
 * LE NAVIRE D'UNE SCÈNE (#3686 ; `CONTRAT.md`, sections « Monde », « Vue » et « Corps d'un combattant ») : la scène
 * entre en jeu les ponts de son navire posés ; la vue le sert par le corps de son véhicule, au centre de ses ponts ; le
 * monde garde le sol de ses ponts pour le pointage sans le peindre et peint la mer sur sa flottaison, le plateau ne dessine
 * aucune de leurs arêtes et coupe son modèle sous les ponts qu'il retire, et l'exploration ne le pose à aucune case.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { modelesCommites, mondeDe, morceauxDe, servirLesModeles, suiteDe, table, vueDe } from './pont.testkit';
import { findVehicleById } from '../../../src/data';
import { garanti } from '../../../src/lib/garanti';
import { casesDeLAreteDePont, grilleDesPonts, MOTS_DES_PONTS } from '../../../src/data/schemas/grammaire/carte-ascii';
import { EYE_H, MARGE_SOUS_PLAFOND_M } from '../../../src/noyau/monde/iso';

const COMMITES = await modelesCommites();
const { appel } = table();

describe('la caraque posée dans la scène À bord de la caraque', () => {
  beforeAll(() => {
    suiteDe(appel('demarrer', { scenario: 'a-bord-de-la-caraque', graine: 7 }));
  });

  it('sans élément de son type servi, aucun navire ; servi, son corps au centre de ses ponts, à sa taille réelle', () => {
    expect(vueDe(appel('vue')).corps.navires).toEqual({});
    servirLesModeles(appel, COMMITES);
    const { navires } = vueDe(appel('vue')).corps;
    expect(Object.keys(navires)).toEqual(['caraque']);
    expect(navires.caraque).toMatchObject({ centre: { x: 10.5, y: 4 }, corps: { element: 'vehicule--caraque', taille: 'reelle', cap: 'E' } });
    expect(navires.caraque.corps.ameliorations.map((a) => a.element)).toEqual(expect.arrayContaining(['amelioration--embarcation-de-bord', 'amelioration--nid-de-pie']));
  });

  it('le monde garde le sol des ponts pour le pointage, sans le peindre ; le plateau ne dessine aucune de leurs arêtes', () => {
    const monde = mondeDe(appel).monde!;
    expect(monde.hauteurs.map((h) => h.z)).toEqual([0, 1, 2, 3]);
    const surfaces = morceauxDe(appel, 'partie', monde).flatMap((m) => m.surfaces);
    expect(surfaces.filter((s) => s.navire === 'caraque').length).toBeGreaterThan(0);
    expect(surfaces.filter((s) => s.navire === undefined).map((s) => s.matiere)).not.toContain('relief--pilier');
    expect((appel('aretes') as unknown as { aretes: unknown[] }).aretes).toEqual([]);
  });

  it('le monde peint la mer sur la flottaison du navire ; le navire posé par ses ponts ne tient aucune case', () => {
    const surfaces = morceauxDe(appel, 'partie', mondeDe(appel).monde!).flatMap((m) => m.surfaces);
    expect(new Set(surfaces.filter((s) => s.flottaison !== undefined).map(({ matiere, flottaison }) => `${matiere} ${flottaison}`))).toEqual(new Set(['terrain--eau caraque']));
    const { projection, corps } = vueDe(appel('vue'));
    expect(Object.keys(corps.navires)).toEqual(['caraque']);
    expect(projection.exploration!.entites.liste.map((e) => e.id)).not.toContain('caraque');
  });

  it('l’occupant d’une case que le modèle rogne se tient au centre de son emprise libre, dans sa case (#3767)', () => {
    const { stations } = vueDe(appel('vue')).corps.navires.caraque;
    expect(stations).toHaveLength(Object.keys((COMMITES.manifestes['vehicule--caraque'] as { cases: object }).cases).length);
    expect(stations.filter(({ x, y, point }) => Math.abs(point.x - x) > 0.5 || Math.abs(point.y - y) > 0.5)).toEqual([]);
    // la case du grand mât, (9, 2) du pont supérieur, libre devant le mât sur [9 ; 9,375] × [2 ; 3] : au cap E, la case
    // (10, 4) de la scène, son occupant à l'est de son centre, vers la proue
    expect(stations).toContainEqual({ x: 10, y: 4, z: 2, point: { x: 10.3125, y: 4 } });
  });

  it('l’œil se pose dans la batterie sous le pont principal, de la marge, et debout sur le pont principal (#3808)', () => {
    const [, hauteurs] = garanti(findVehicleById('caraque')?.ponts, 'caraque', 'ponts');
    const { oeilM, oeilsSousPlafond } = vueDe(appel('regarder', { regard: 'immersion' })).plateau!;
    expect(oeilM).toBe(EYE_H);
    // (11, 3) de la scène, dans la batterie (pont `e`, l'étage 1) à côté du cabestan, sous le pont principal (`p`, l'étage 2)
    expect(oeilsSousPlafond['11,3,1']).toBeCloseTo(hauteurs.p - MARGE_SOUS_PLAFOND_M - hauteurs.e, 6);
    expect(oeilsSousPlafond['11,3,2']).toBeUndefined();
    appel('regarder', { regard: 'tactique' });
  });

  it('le plateau coupe le navire sous le pont le plus bas que le regard retire au-dessus du groupe', () => {
    const coupe = (regard: string) => vueDe(appel('regarder', { regard })).plateau!.coupesDesNavires;
    expect([coupe('tactique'), coupe('plateau'), coupe('immersion')]).toEqual([{}, { caraque: 5.6 }, {}]);
    coupe('tactique');
  });

  it('le plan d’une couche dit ses ponts, le groupe et l’œil, chacun à sa case, sans changer la partie ; une couche absente se refuse', () => {
    const avant = vueDe(appel('vue'));
    const planDe = (entree?: unknown) => (appel('plan', entree) as unknown as { plan: string }).plan;
    const rang = (plan: string, y: number) => [...plan.split('\n')[2 * y + 1]];
    const plan = planDe({ oeil: { case: [6, 4, 2], lacet: 60 } });
    expect([rang(plan, 4)[4], rang(plan, 4)[13], rang(plan, 4)[29]]).toEqual(['|', '↗', '@']);
    expect(plan).toContain('↗ l’œil, regard au NE');
    expect(rang(planDe(), 4)[29]).toBe('@');
    for (const entree of [{ z: 9 }, { oeil: { case: [6, 4], lacet: 60 } }]) expect(appel('plan', entree)).toMatchObject({ ok: false, erreur: { categorie: 'validation' } });
    expect(vueDe(appel('vue'))).toEqual(avant);
  });
});

describe('le modèle commité de la caraque, sur ses ponts (#3686)', () => {
  const [cartes, hauteurs] = garanti(findVehicleById('caraque')?.ponts, 'caraque', 'ponts');
  const { w, h, cases, aretes } = grilleDesPonts(cartes);
  const manifeste = COMMITES.manifestes['vehicule--caraque'] as {
    postes: Record<string, number[][]>; selon: { sabord: { postes: Record<string, number[][]> } }; ancrages: Record<string, number[][]>;
  };
  /** Le point du plan, en cases continues (une case de 2 m de l'entier à l'entier suivant), sous la position glTF `p` du
   *  modèle, dont l'origine est le centre du plan. */
  const auPlan = ([x, , z]: number[]) => ({ x: w / 2 - z / 2, y: h / 2 + x / 2 });
  /** L'écart, en cases, entre le point du plan sous `p` et la case `c` ; `Infinity` hors de sa hauteur. */
  const ecart = (p: number[], c: { x: number; y: number; glyphe: string }) => {
    const { x, y } = auPlan(p);
    return Math.abs(hauteurs[c.glyphe] - p[1]) > 0.1 ? Infinity : Math.max(0, c.x - x, x - c.x - 1, c.y - y, y - c.y - 1);
  };
  /** Une épaisseur de cloison (0,1 m), en cases. */
  const TOLERANCE = 0.05;

  it('chaque sabord du modèle ouvre, dans l’ordre de son bord, la case d’une arête sabord des ponts, à sa hauteur', () => {
    const bords: Record<string, typeof cases> = {};
    for (const e of aretes.filter((a) => a.glyphe === MOTS_DES_PONTS.sabord)) {
      const [avant, apres] = casesDeLAreteDePont(e);
      const dedans = cases.find((c) => c.z === e.z && c.x === apres.x && c.y === apres.y);
      const bord = e.sens === 't' ? (dedans ? 'proue' : 'poupe') : (dedans ? 'tribord' : 'babord');
      (bords[bord] ??= []).push(dedans ?? garanti(cases.find((c) => c.z === e.z && c.x === avant.x && c.y === avant.y), 'sabord', 'case'));
    }
    const ordre = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.z - b.z || a.x - b.x || a.y - b.y;
    expect(Object.keys(manifeste.selon.sabord.postes).sort()).toEqual(Object.keys(bords).sort());
    for (const [bord, postes] of Object.entries(manifeste.selon.sabord.postes)) {
      const attendues = bords[bord].sort(ordre);
      expect(postes.length, bord).toBe(attendues.length);
      postes.forEach((p, i) => expect(ecart(p, attendues[i]), `${bord} ${i}`).toBeLessThanOrEqual(TOLERANCE));
    }
  });

  it('chaque pièce montée sur un pont découvert pose son affût sur une case du plan, à sa hauteur', () => {
    for (const p of Object.values(manifeste.postes).flat()) expect(Math.min(...cases.map((c) => ecart(p, c))), JSON.stringify(p)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('le nid-de-pie coiffe le grand mât, au milieu de sa case', () => {
    const mat = cases.find((c) => c.glyphe === 'm');
    const { x, y } = auPlan(manifeste.ancrages['nid-de-pie'][0]);
    expect([Math.abs(x - ((mat?.x ?? 0) + 0.5)) <= TOLERANCE, Math.abs(y - ((mat?.y ?? 0) + 0.5)) <= TOLERANCE]).toEqual([true, true]);
  });
});

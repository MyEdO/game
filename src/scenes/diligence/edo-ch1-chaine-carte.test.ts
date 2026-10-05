/**
 * Chapitre 1 de jeu (EDO 01-03) sur le paquet RÉEL : gating de la carte (anti-spoiler), sens unique de
 * la chaîne (anti-backtracking), et producteurs des drapeaux que la carte et la clôture lisent.
 * Aucune donnée de fixture — la campagne committée est le sujet.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { routesEtat, routesFrom, visiblePlaces } from '../../state/worldMap';
import { reachableCells, startOf } from '../../state/mapQC';
import type { ConditionCtx } from '../../engine/flowCore';
import { diligenceCampaign, paquetDuJeu } from '../campaign';

const paquet = paquetDuJeu(diligenceCampaign);
const map = paquet.worldMap!;
const DEPART = 'edo-ch1-depart';
const CORPS = 'edo-ch1-corps-kastor-fouille';
const CLOS = 'edo-ch1-clos';
/** Ordre AVAL de la chaîne : `EDO 01 l.340`, `EDO 02 l.13`, `EDO 02 l.168`, `EDO 03 l.1-6`. */
const AVAL = ['la-diligence', 'route-principale', 'auberge-des-sept-rayons', 'altdorf'];
const T1 = 'route-la-diligence-route-principale';
const T2 = 'route-route-principale-sept-rayons';
const T3 = 'route-sept-rayons-altdorf';

const ctx = (...flags: string[]): ConditionCtx => ({ flags: Object.fromEntries(flags.map((f) => [f, true])), gameTime: 0 });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const etat = (placeId: string, c?: ConditionCtx) => routesEtat(map, placeId, c).map((e) => [e.route.id, e.ouverte]);
const refus = (placeId: string, c: ConditionCtx) => routesEtat(map, placeId, c).map((e) => e.route.refus);

describe('carte du ch.1 — anti-spoiler, état de drapeaux par état de drapeaux', () => {
  it('aucun drapeau : seul le relais existe, et le seul trajet est OFFERT fermé, avec sa raison', () => {
    expect(ids(visiblePlaces(map, ctx()))).toEqual(['la-diligence']);
    expect(ids(routesFrom(map, 'la-diligence', ctx()))).toEqual([]);
    expect(etat('la-diligence', ctx())).toEqual([[T1, false]]);
    expect(refus('la-diligence', ctx())).toEqual(['Aucun trajet ne part encore de ce relais.']);
  });

  it(`\`${DEPART}\` : les trois lieux paraissent, seul le premier tronçon s'ouvre`, () => {
    const c = ctx(DEPART);
    expect(ids(visiblePlaces(map, c))).toEqual(AVAL);
    expect(ids(routesFrom(map, 'la-diligence', c))).toEqual([T1]);
    expect(ids(routesFrom(map, 'route-principale', c))).toEqual([]);
    expect(ids(routesFrom(map, 'auberge-des-sept-rayons', c))).toEqual([T3]);
    expect(ids(routesFrom(map, 'altdorf', c))).toEqual([]);
  });

  it(`\`${DEPART}\` sans \`${CORPS}\` : le tronçon 2 est OFFERT fermé avec sa raison, pas caché en silence`, () => {
    const c = ctx(DEPART);
    expect(etat('route-principale', c)).toEqual([[T2, false]]);
    expect(refus('route-principale', c)).toEqual(["Vous n'avez pas fini d'examiner les lieux de l'embuscade."]);
  });

  it(`\`${DEPART}\` + \`${CORPS}\` : le tronçon 2 s'ouvre`, () => {
    const c = ctx(DEPART, CORPS);
    expect(ids(visiblePlaces(map, c))).toEqual(AVAL);
    expect(ids(routesFrom(map, 'la-diligence', c))).toEqual([T1]);
    expect(ids(routesFrom(map, 'route-principale', c))).toEqual([T2]);
    expect(ids(routesFrom(map, 'auberge-des-sept-rayons', c))).toEqual([T3]);
    expect(ids(routesFrom(map, 'altdorf', c))).toEqual([]);
  });
});

describe('carte du ch.1 — sens unique : aucune route ne remonte vers l’amont', () => {
  it('chaque route part de son amont (`from`) vers le lieu SUIVANT de la chaîne', () => {
    expect(map.routes.map((r) => [r.id, r.from, AVAL.indexOf(r.b) - AVAL.indexOf(r.a)]))
      .toEqual([[T1, 'la-diligence', 1], [T2, 'route-principale', 1], [T3, 'auberge-des-sept-rayons', 1]]);
  });

  it('depuis chaque lieu aval, la vue n’offre (même fermée) que la route vers l’aval', () => {
    // `ctx` absent : AUCUN gating, toutes les routes reliées et initiables sont rendues — seul le sens filtre.
    expect(etat('route-principale')).toEqual([[T2, true]]);
    expect(etat('auberge-des-sept-rayons')).toEqual([[T3, true]]);
    expect(etat('altdorf')).toEqual([]);
  });
});

describe('ch.1 — chaque drapeau lu par la carte ou la clôture a son producteur dans le paquet', () => {
  /** Noms de drapeaux LUS par une Condition (`kind:'flag'`, `expr` « a,!b »), à toute profondeur. */
  function lus(cond: unknown, out = new Set<string>()): Set<string> {
    if (Array.isArray(cond)) cond.forEach((c) => lus(c, out));
    else if (cond && typeof cond === 'object') {
      const o = cond as Record<string, unknown>;
      if (o.kind === 'flag' && typeof o.expr === 'string')
        for (const c of o.expr.split(',').map((s) => s.trim()).filter(Boolean)) out.add(c.replace(/^!/, ''));
      Object.values(o).forEach((v) => lus(v, out));
    }
    return out;
  }
  /** Drapeaux POSÉS par un Effet `setFlag`, n'importe où dans le paquet. */
  function poses(x: unknown, out = new Set<string>()): Set<string> {
    if (Array.isArray(x)) x.forEach((v) => poses(v, out));
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (o.type === 'setFlag' && typeof o.flag === 'string') out.add(o.flag);
      Object.values(o).forEach((v) => poses(v, out));
    }
    return out;
  }

  it('lecteurs : lieux, routes, ouverture et clôture', () => {
    const lecteurs = [
      ...map.places.map((p) => p.when),
      ...map.routes.map((r) => r.when),
      paquet.narratif?.ouverture,
      paquet.narratif?.cloture?.when,
    ];
    const lu = [...lus(lecteurs)].sort();
    expect(lu).toEqual([CLOS, CORPS, DEPART].sort());
    const pose = poses(paquet);
    expect(lu.filter((f) => !pose.has(f)), 'drapeau(x) lu(s) sans aucun `setFlag` dans le paquet').toEqual([]);
  });

  it(`la clôture du chapitre se lit sur \`${CLOS}\``, () => {
    expect(paquet.narratif?.cloture?.when).toEqual({ kind: 'flag', expr: CLOS });
  });
});

/**
 * Producteurs JOUÉS au store : le rect de chaque déclencheur est fait de cases ATTEIGNABLES à pied depuis
 * l'arrivée du groupe (`reachableCells`, hors des murs), et un pas dedans pose le drapeau.
 */
describe('ch.1 — chaque producteur se déclenche au pas du groupe, sur des cases atteignables', () => {
  const get = () => useGame.getState();
  beforeEach(() => {
    useGame.getState().loadProject(paquet.scenes, paquet.scenes[0].id, paquet.worldMap, paquet.narratif);
    useGame.getState().acquitterOuverture();
  });

  const PRODUCTEURS = [
    { scene: 'la-diligence', trigger: 'edo-ch1-depart-cour', flag: DEPART, arriveeDedans: false },
    { scene: 'route-principale-virage', trigger: 'edo-ch1-corps-kastor', flag: CORPS, arriveeDedans: false },
    { scene: 'altdorf-porte-sud', trigger: 'edo-ch1-entree-altdorf', flag: CLOS, arriveeDedans: true },
  ];

  for (const p of PRODUCTEURS)
    it(`${p.scene} › ${p.trigger} pose \`${p.flag}\``, () => {
      if (get().scene?.id !== p.scene) useGame.getState().transitionTo(p.scene);
      const scene = get().scene!;
      expect(scene.id).toBe(p.scene);
      const trig = scene.triggers.find((t) => t.id === p.trigger);
      expect(trig, `déclencheur « ${p.trigger} » absent de ${p.scene}`).toBeTruthy();
      expect(trig!.once).toBe(true);

      const depart = startOf(scene)!;
      const atteint = reachableCells(scene, depart);
      const cases: string[] = [];
      for (let y = trig!.rect.y; y < trig!.rect.y + trig!.rect.h; y++)
        for (let x = trig!.rect.x; x < trig!.rect.x + trig!.rect.w; x++) cases.push(`${x},${y},0`);
      expect(cases.filter((k) => !atteint.has(k)), `case(s) du rect ${JSON.stringify(trig!.rect)} inatteignable(s)`).toEqual([]);
      const dedans = cases.includes(`${depart.x},${depart.y},0`);
      expect(dedans, `l'arrivée (${depart.x},${depart.y}) ${p.arriveeDedans ? 'doit' : 'ne doit pas'} être dans le rect`)
        .toBe(p.arriveeDedans);

      expect(get().flags[p.flag]).toBeFalsy();
      const [x, y] = cases[0].split(',').map(Number);
      useGame.getState().moveParty({ x, y });
      expect(get().flags[p.flag]).toBe(true);
    });
});

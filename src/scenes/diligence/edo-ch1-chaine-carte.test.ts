/**
 * Chapitre 1 de jeu (EDO 01-03) sur le paquet RÉEL : gating de la carte (anti-spoiler), sens unique de
 * la chaîne (anti-backtracking), et producteurs des drapeaux que la carte et la clôture lisent.
 * Aucune donnée de fixture — la campagne committée est le sujet.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { routesEtat, routesFrom, visiblePlaces } from '../../state/worldMap';
import { reachableCells, startOf } from '../../state/mapQC';
import { propFootTiles } from '../../state/footprint';
import { sceneMetresPerTile } from '../../state/scene';
import type { ConditionCtx } from '../../engine/flowCore';
import { tableTotale } from '../../lib/tableTotale';
import { diligenceCampaign, paquetDuJeu } from '../campaign';

const paquet = paquetDuJeu(diligenceCampaign);
const map = paquet.worldMap!;
const DEPART = 'edo-ch1-depart';
const CORPS = 'edo-ch1-corps-kastor-fouille';
const CLOS = 'edo-ch1-clos';
/** Ordre AVAL de la chaîne : `EDO 01 l.340`, `EDO 02 l.13`, `EDO 02 l.168`. */
const AVAL = ['la-diligence', 'route-principale', 'auberge-des-sept-rayons', 'altdorf'];
const T1 = 'route-la-diligence-route-principale';
const T2 = 'route-route-principale-sept-rayons';
const T3 = 'route-sept-rayons-altdorf';

const ctx = (...flags: string[]): ConditionCtx => ({ flags: tableTotale(flags, () => true), gameTime: 0 });
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

describe(`ch.1 — la clôture se lit sur \`${CLOS}\`, posé à l'entrée d'Altdorf`, () => {
  const get = () => useGame.getState();

  it('le `when` de la clôture est le drapeau du producteur', () => {
    expect(paquet.narratif?.cloture?.when).toEqual({ kind: 'flag', expr: CLOS });
  });

  it('arrivé à la porte sud, un pas dans la ville pose le drapeau et arme le récapitulatif du chapitre', () => {
    useGame.getState().loadProject(paquet.scenes, paquet.scenes[0].id, paquet.worldMap, paquet.narratif);
    useGame.getState().acquitterOuverture();
    useGame.getState().transitionTo('altdorf-porte-sud');
    expect(get().flags[CLOS]).toBeFalsy();
    expect(get().pendingChapterRecap).toBeNull();

    useGame.getState().moveParty({ x: 8, y: 10 });
    expect(get().flags[CLOS]).toBe(true);
    expect(get().pendingChapterRecap?.titre).toBe(paquet.narratif!.cloture!.titre);
  });
});

/**
 * Producteurs JOUÉS au store : le rect de chaque déclencheur est fait de cases ATTEIGNABLES à pied depuis
 * l'arrivée du groupe (`reachableCells`, hors des murs), hormis les cases du décor qu'il ENTOURE, et un pas
 * dedans pose le drapeau.
 */
describe('ch.1 — chaque producteur se déclenche au pas du groupe, sur des cases atteignables', () => {
  const get = () => useGame.getState();
  beforeEach(() => {
    useGame.getState().loadProject(paquet.scenes, paquet.scenes[0].id, paquet.worldMap, paquet.narratif);
    useGame.getState().acquitterOuverture();
  });

  const PRODUCTEURS = [
    { scene: 'la-diligence', trigger: 'edo-ch1-depart-remise', flag: DEPART, arriveeDedans: false, entoure: 'charrette' },
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
      const decor = p.entoure ? scene.entities.find((e) => e.kind === 'prop' && e.ref === p.entoure && cases.includes(`${e.pos.x},${e.pos.y},0`)) : undefined;
      if (p.entoure) expect(decor, `aucun décor « ${p.entoure} » dans le rect ${JSON.stringify(trig!.rect)}`).toBeTruthy();
      const sousDecor = new Set(decor ? propFootTiles(decor.ref, decor.pos, decor.facing, sceneMetresPerTile(scene)).map((t) => `${t.x},${t.y},0`) : []);
      if (decor) expect([...sousDecor].filter((k) => !cases.includes(k)), `le décor « ${p.entoure} » déborde du rect`).toEqual([]);
      const marchables = cases.filter((k) => !sousDecor.has(k));
      expect(marchables.filter((k) => !atteint.has(k)), `case(s) du rect ${JSON.stringify(trig!.rect)} inatteignable(s)`).toEqual([]);
      const dedans = cases.includes(`${depart.x},${depart.y},0`);
      expect(dedans, `l'arrivée (${depart.x},${depart.y}) ${p.arriveeDedans ? 'doit' : 'ne doit pas'} être dans le rect`)
        .toBe(p.arriveeDedans);

      expect(get().flags[p.flag]).toBeFalsy();
      const [x, y] = marchables[0].split(',').map(Number);
      useGame.getState().moveParty({ x, y });
      expect(get().flags[p.flag]).toBe(true);
    });
});

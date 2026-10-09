/**
 * Chapitre 1 de jeu (EDO 01-03) sur le paquet RÉEL : gating de la carte (anti-spoiler), sens unique de
 * la chaîne (anti-backtracking), et producteurs des drapeaux que la carte et la clôture lisent.
 * Aucune donnée de fixture — la campagne committée est le sujet.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { routesEtat, routesFrom, visiblePlaces } from '../../state/worldMap';
import { reachableCells } from '../../state/mapQC';
import { aPorteeDe } from '../../state/exploreNav';
import { startOf } from '../../state/scene';
import type { ConditionCtx } from '../../engine/flowCore';
import { tableTotale } from '../../lib/tableTotale';
import { diligenceCampaign, paquetDuJeu } from '../campaign';

const paquet = paquetDuJeu(diligenceCampaign);
const map = paquet.worldMap!;
const DEPART = 'edo-ch1-depart';
const CORPS = 'edo-ch1-corps-kastor-fouille';
const CLOS = 'edo-ch1-clos';
/** Ordre AVAL de la chaîne : `EDO 01 l.340`, `EDO 02 l.13`, `EDO 02 l.180`. */
const AVAL = ['la-diligence', 'route-principale', 'auberge-des-sept-rayons', 'altdorf'];
const T1 = 'route-la-diligence-route-principale';
const T2 = 'route-route-principale-sept-rayons';
const T3 = 'route-sept-rayons-altdorf';

const ctx = (...flags: string[]): ConditionCtx => ({ flags: tableTotale(flags, () => true), gameTime: 0 });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const etat = (placeId: string, c?: ConditionCtx) => routesEtat(map, placeId, c).map((e) => [e.route.id, e.ouverte]);
const refus = (placeId: string, c: ConditionCtx) => routesEtat(map, placeId, c).map((e) => e.route.refus?.texte);
const REFUS_T1 = 'La diligence attend dans la remise : montez à bord pour prendre la route.';
const REFUS_T2 = 'Un corps gît encore sous un buisson, à l’écart de la diligence renversée : examinez-le avant de reprendre la route.';

describe('carte du ch.1 — anti-spoiler, état de drapeaux par état de drapeaux', () => {
  // EDO 01 l.13
  it('aucun drapeau : le relais et la route principale existent, le tronçon 1 est OFFERT fermé, avec sa raison', () => {
    expect(ids(visiblePlaces(map, ctx()))).toEqual(['la-diligence', 'route-principale']);
    expect(ids(routesFrom(map, 'la-diligence', ctx()))).toEqual([]);
    expect(etat('la-diligence', ctx())).toEqual([[T1, false]]);
    expect(refus('la-diligence', ctx())).toEqual([REFUS_T1]);
  });

  it(`\`${DEPART}\` : les lieux aval paraissent, seul le premier tronçon s'ouvre`, () => {
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
    expect(refus('route-principale', c)).toEqual([REFUS_T2]);
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

  it('du relais à la porte sud, les gestes du groupe posent les drapeaux et la clôture solde les deux objectifs', () => {
    const objectifs = () => get().objectives.map((o) => o.id);
    useGame.getState().loadProject(paquet.scenes, paquet.scenes[0].id, paquet.worldMap, paquet.narratif);
    useGame.getState().acquitterOuverture();
    expect(get().scene?.id).toBe('la-diligence');

    useGame.getState().moveParty({ x: 17, y: 3 });
    expect(objectifs()).toEqual(['edo-ch1-place-a-bord']);

    useGame.getState().moveParty({ x: 13, y: 31 });
    expect(get().flags[DEPART], 'marcher près de la diligence ne fait pas monter à bord').toBeFalsy();

    useGame.getState().jouerAction('diligence-remise-charrette', 'monter-a-bord');
    expect(get().flags[DEPART]).toBe(true);
    expect(get().worldMapOpen).toBe(true);
    expect(objectifs()).toEqual(['edo-ch1-route']);

    const drapeauxAvantVirage = { ...get().flags };
    useGame.getState().transitionTo('route-principale-virage');
    useGame.getState().moveParty({ x: 36, y: 3 });
    expect(objectifs()).toEqual(['edo-ch1-route', 'edo-ch1-embuscade']);
    expect(get().flags, 'l’arrivée au virage ne pose que sa marque `once`')
      .toEqual({ ...drapeauxAvantVirage, '__trigger_edo-ch1-arrivee-virage': true });
    useGame.getState().jouerAction('cadavre-kastor-lieberung', 'fouiller');
    expect(get().flags[CORPS]).toBe(true);
    expect(objectifs()).toEqual(['edo-ch1-route']);

    useGame.getState().transitionTo('altdorf-porte-sud');
    expect(get().flags[CLOS]).toBeFalsy();
    expect(get().pendingChapterRecap).toBeNull();

    useGame.getState().moveParty({ x: 7, y: 9 });
    expect(get().flags[CLOS]).toBe(true);
    expect(get().pendingChapterRecap?.titre).toBe(paquet.narratif!.cloture!.titre);
    expect(get().pendingChapterRecap?.chronique.map((c) => c.text))
      .toEqual(['Trouver une place à bord d’une diligence pour Altdorf.', 'Examiner les lieux de l’embuscade.', 'Se rendre à Altdorf.']);
  });
});

/**
 * Producteurs JOUÉS au store, chacun sur des cases ATTEIGNABLES à pied depuis l'arrivée du groupe
 * (`reachableCells`, hors des murs) : le GESTE authoré d'un décor se joue depuis l'un de ses abords
 * (`aPorteeDe`, la portée de `jouerAction`), le rect d'un déclencheur se franchit d'un pas.
 */
describe('ch.1 — chaque producteur se joue au geste ou au pas du groupe, sur des cases atteignables', () => {
  const get = () => useGame.getState();
  beforeEach(() => {
    useGame.getState().loadProject(paquet.scenes, paquet.scenes[0].id, paquet.worldMap, paquet.narratif);
    useGame.getState().acquitterOuverture();
  });
  const entrer = (id: string) => {
    if (get().scene?.id !== id) useGame.getState().transitionTo(id);
    const scene = get().scene!;
    expect(scene.id).toBe(id);
    return scene;
  };

  const GESTES = [
    { scene: 'la-diligence', entite: 'diligence-remise-charrette', action: 'monter-a-bord', flag: DEPART },
    { scene: 'route-principale-virage', entite: 'cadavre-kastor-lieberung', action: 'fouiller', flag: CORPS },
  ];

  for (const p of GESTES)
    it(`${p.scene} › ${p.entite} › ${p.action} pose \`${p.flag}\``, () => {
      const scene = entrer(p.scene);
      const ent = scene.entities.find((e) => e.id === p.entite);
      expect(ent, `décor « ${p.entite} » absent de ${p.scene}`).toBeTruthy();
      expect(ent!.usable?.actions?.map((a) => a.id), `« ${p.entite} » ne porte pas le geste « ${p.action} »`).toContain(p.action);

      const depart = startOf(scene)!;
      expect(aPorteeDe(depart, ent!), `l'arrivée (${depart.x},${depart.y}) ne doit pas être à portée de « ${p.entite} »`).toBe(false);
      const atteint = reachableCells(scene, depart);
      const abords = [...atteint].map((k) => k.split(',').map(Number)).filter(([x, y, z]) => aPorteeDe({ x, y, z }, ent!));
      expect(abords.length, `aucun abord de « ${p.entite} » atteignable depuis l'arrivée`).toBeGreaterThan(0);

      expect(get().flags[p.flag]).toBeFalsy();
      useGame.getState().jouerAction(p.entite, p.action);
      expect(get().flags[p.flag], 'le geste joué hors de portée ne pose rien').toBeFalsy();
      const [x, y] = abords[0];
      useGame.getState().moveParty({ x, y });
      expect(get().flags[p.flag], 'le pas seul ne pose rien').toBeFalsy();
      useGame.getState().jouerAction(p.entite, p.action);
      expect(get().flags[p.flag]).toBe(true);
    });

  const PAS = [{ scene: 'altdorf-porte-sud', trigger: 'edo-ch1-entree-altdorf', flag: CLOS, arriveeDedans: true }];

  for (const p of PAS)
    it(`${p.scene} › ${p.trigger} pose \`${p.flag}\``, () => {
      const scene = entrer(p.scene);
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

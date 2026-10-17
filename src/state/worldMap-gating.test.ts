/**
 * Gating narratif de la carte du monde (#684 L1) — DEUX axes jamais fusionnés : le NŒUD existe-t-il
 * (`MapPlace.when`, anti-spoiler) et l'ARÊTE est-elle praticable (`MapRoute.when`, anti-backtracking,
 * le lieu déjà visité restant VISIBLE). Lecture PURE : `visiblePlaces` / `routesFrom` évaluent le
 * `ConditionCtx` fabriqué par l'appelant ; sans `ctx`, la carte est intégralement ouverte.
 */
import { describe, it, expect } from 'vitest';
import { parseProject, routesFrom, routesEtat, visiblePlaces, type WorldMap } from './worldMap';
import { emptyNarratif } from './campaignNarratif';
import { emptyScene } from './scene';
import type { ConditionCtx } from '../engine/flowCore';
import areneProjet from '../scenes/arene/arene-projet.json';
import loupEtSaumureProjet from '../scenes/loup-et-saumure/loup-et-saumure-projet.json';

const ctx = (flags: Record<string, boolean> = {}): ConditionCtx => ({ flags, gameTime: 0 });

function carteDe(nom: string, doc: unknown): WorldMap {
  const map = parseProject(doc).worldMap;
  if (!map) throw new Error(`${nom} : paquet sans worldMap — la mesure perd son sujet.`);
  return map;
}

/** Cartes réelles SANS gating : elles mesurent la non-régression (même offre avec et sans ctx). */
const cartesNonGatees: [string, WorldMap][] = [
  ['arene-projet.json', carteDe('arene-projet.json', areneProjet)],
  ['loup-et-saumure-projet.json', carteDe('loup-et-saumure-projet.json', loupEtSaumureProjet)],
];

/** Carte-FIXTURE portant les DEUX axes sur le MÊME flag : le cap donné au quai révèle l'îlot ET ouvre
 *  la traversée. C'est la forme qu'une campagne à chapitres pose — construite ici (#1709), jamais
 *  empruntée à un paquet livré : ajouter un lieu à une campagne ne doit rougir aucun test. */
const CAP_SEL = 'cap-donne';
const carteBarge: WorldMap = {
  id: 'fixture-barge',
  label: 'Fixture — le cap donné au quai',
  places: [
    { id: 'quai', label: 'Le Quai', pos: { x: 10, y: 10 }, scene: 's-quai' },
    { id: 'ilot', label: 'L’Îlot', pos: { x: 40, y: 20 }, scene: 's-ilot', when: { kind: 'flag', expr: CAP_SEL } },
  ],
  routes: [{
    id: 'route-quai-ilot',
    a: 'quai',
    b: 'ilot',
    km: 30,
    modes: ['mer'],
    when: { kind: 'flag', expr: CAP_SEL },
    refus: { texte: 'Aucun cap n’est donné : la barge ne sait pas encore où porter le sel.' },
  }],
};

describe('cartes RÉELLES sans `when` — l’offre est identique avec et sans ctx', () => {
  it.each(cartesNonGatees)('%s : lieux et routes inchangés', (_nom, map) => {
    expect(map.places.length).toBeGreaterThan(0);
    expect(map.routes.length).toBeGreaterThan(0);
    expect(map.places.some((p) => p.when)).toBe(false);
    expect(map.routes.some((r) => r.when)).toBe(false);

    expect(visiblePlaces(map, ctx())).toEqual(map.places);
    expect(visiblePlaces(map)).toEqual(map.places);
    for (const p of map.places) {
      expect(routesFrom(map, p.id, ctx())).toEqual(routesFrom(map, p.id));
    }
    // La somme des offres par lieu couvre bien toutes les routes (la mesure porte sur du réel).
    const vues = new Set(map.places.flatMap((p) => routesFrom(map, p.id, ctx()).map((r) => r.id)));
    expect(vues.size).toBe(map.routes.length);
  });
});

describe('les DEUX axes sur un MÊME flag — le cap donné au quai révèle l’îlot ET sa traversée', () => {
  it('sans le cap : un seul lieu offert, aucune route ; avec : les deux lieux et la traversée', () => {
    expect(visiblePlaces(carteBarge, ctx()).map((p) => p.id)).toEqual(['quai']);
    expect(routesFrom(carteBarge, 'quai', ctx())).toEqual([]);

    const cap = ctx({ [CAP_SEL]: true });
    expect(visiblePlaces(carteBarge, cap).map((p) => p.id)).toEqual(['quai', 'ilot']);
    expect(routesFrom(carteBarge, 'quai', cap).map((r) => r.id)).toEqual(['route-quai-ilot']);
  });

  it('la traversée fermée reste CONSULTABLE, avec sa raison joueur (`routesEtat` + `refus`)', () => {
    const etat = routesEtat(carteBarge, 'quai', ctx());
    expect(etat.map((e) => [e.route.id, e.ouverte])).toEqual([['route-quai-ilot', false]]);
    expect(etat[0].route.refus).toBeTruthy();
  });
});

const carteGatee: WorldMap = {
  id: 'ch1',
  label: 'Chapitre 1',
  places: [
    { id: 'auberge', label: 'La Diligence', pos: { x: 10, y: 30 }, scene: 's-auberge' },
    { id: 'altdorf', label: 'Altdorf', pos: { x: 60, y: 30 }, scene: 's-altdorf' },
    {
      id: 'bogenhafen',
      label: 'Bögenhafen',
      pos: { x: 20, y: 70 },
      scene: 's-bogenhafen',
      when: { kind: 'flag', expr: 'edo-ch1-bogenhafen-revelee' },
    },
  ],
  routes: [
    { id: 'auberge-altdorf', a: 'auberge', b: 'altdorf', km: 100, modes: ['pied'] },
    {
      id: 'altdorf-auberge-retour',
      a: 'altdorf',
      b: 'auberge',
      from: 'altdorf',
      km: 100,
      modes: ['pied'],
      when: { kind: 'not', of: { kind: 'flag', expr: 'edo-ch1-clos' } },
      refus: { texte: 'La route du relais est derrière vous.' },
    },
  ],
};

describe('axe NŒUD — `MapPlace.when` retire le lieu tant que le récit ne l’a pas révélé', () => {
  it('flag absent → Bögenhafen n’existe pas ; flag posé → elle apparaît', () => {
    expect(visiblePlaces(carteGatee, ctx()).map((p) => p.id)).toEqual(['auberge', 'altdorf']);
    expect(visiblePlaces(carteGatee, ctx({ 'edo-ch1-bogenhafen-revelee': true })).map((p) => p.id)).toEqual([
      'auberge',
      'altdorf',
      'bogenhafen',
    ]);
  });

  it('sans ctx → carte intégralement ouverte (contrat de non-régression)', () => {
    expect(visiblePlaces(carteGatee)).toEqual(carteGatee.places);
    expect(routesFrom(carteGatee, 'altdorf').map((r) => r.id)).toEqual([
      'auberge-altdorf',
      'altdorf-auberge-retour',
    ]);
  });
});

describe('axe ARÊTE — `MapRoute.when` ferme le trajet SANS effacer le lieu', () => {
  it('chapitre clos → la route de retour disparaît, l’auberge reste visible', () => {
    const clos = ctx({ 'edo-ch1-clos': true });
    expect(routesFrom(carteGatee, 'altdorf', clos).map((r) => r.id)).toEqual(['auberge-altdorf']);
    expect(visiblePlaces(carteGatee, clos).map((p) => p.id)).toContain('auberge');
  });

  it('chapitre ouvert → la route de retour est offerte depuis Altdorf seulement (`from` conservé)', () => {
    const ouvert = ctx();
    expect(routesFrom(carteGatee, 'altdorf', ouvert).map((r) => r.id)).toEqual([
      'auberge-altdorf',
      'altdorf-auberge-retour',
    ]);
    expect(routesFrom(carteGatee, 'auberge', ouvert).map((r) => r.id)).toEqual(['auberge-altdorf']);
  });

  it('les deux axes sont indépendants : un lieu masqué ne ferme pas les routes de ses voisins', () => {
    const c = ctx();
    expect(visiblePlaces(carteGatee, c).map((p) => p.id)).not.toContain('bogenhafen');
    expect(routesFrom(carteGatee, 'auberge', c).map((r) => r.id)).toEqual(['auberge-altdorf']);
  });
});

describe('`routesEtat` — lecteur de la VUE : TOUTES les routes du lieu, chacune avec son verdict (#684 L2)', () => {
  it('chapitre clos → la route de retour est RENDUE, marquée fermée (elle disparaît de `routesFrom`)', () => {
    const clos = ctx({ 'edo-ch1-clos': true });
    expect(routesEtat(carteGatee, 'altdorf', clos).map((e) => [e.route.id, e.ouverte])).toEqual([
      ['auberge-altdorf', true],
      ['altdorf-auberge-retour', false],
    ]);
    // Le VOYAGE ne propose que l'ouverte : les deux lecteurs ne disent pas la même chose.
    expect(routesFrom(carteGatee, 'altdorf', clos).map((r) => r.id)).toEqual(['auberge-altdorf']);
  });

  it('chapitre ouvert → mêmes routes que `routesFrom`, toutes ouvertes', () => {
    const ouvert = ctx();
    expect(routesEtat(carteGatee, 'altdorf', ouvert).map((e) => e.route.id)).toEqual(
      routesFrom(carteGatee, 'altdorf', ouvert).map((r) => r.id),
    );
    expect(routesEtat(carteGatee, 'altdorf', ouvert).every((e) => e.ouverte)).toBe(true);
  });

  it('mêmes prédicats a/b/from que `routesFrom` : la jumelle `from` reste hors du sens inverse', () => {
    const clos = ctx({ 'edo-ch1-clos': true });
    expect(routesEtat(carteGatee, 'auberge', clos).map((e) => e.route.id)).toEqual(['auberge-altdorf']);
  });

  it('sans ctx → tout est ouvert, et l’offre est celle de `routesFrom` (non-régression)', () => {
    expect(routesEtat(carteGatee, 'altdorf').map((e) => [e.route.id, e.ouverte])).toEqual([
      ['auberge-altdorf', true],
      ['altdorf-auberge-retour', true],
    ]);
  });

  it('cartes RÉELLES sans `when` : `routesEtat` rend exactement l’offre de `routesFrom`', () => {
    for (const [, map] of cartesNonGatees) {
      for (const p of map.places) {
        expect(routesEtat(map, p.id, ctx()).map((e) => e.route)).toEqual(routesFrom(map, p.id, ctx()));
        expect(routesEtat(map, p.id, ctx()).every((e) => e.ouverte)).toBe(true);
      }
    }
  });
});

describe('AUTHORING verrouillé par CONSTRUCTION — le schéma refuse la carte qui mentirait au joueur', () => {
  const projet = (map: unknown) => ({
    type: 'projet',
    id: 'fixture-gating',
    label: 'Fixture de gating',
    versionContenu: 1,
    maison: 'fixture de test',
    scenes: [{ ...emptyScene(3, 3), id: 's-auberge', label: 's-auberge' }],
    worldMap: map,
    narratif: emptyNarratif(),
  }) as unknown;

  it('`when` posé sans `refus` : REFUSÉ — un trajet fermable doit dire au joueur POURQUOI', () => {
    const muette = {
      ...carteGatee,
      routes: carteGatee.routes.map((r) => {
        if (r.id !== 'altdorf-auberge-retour') return r;
        const { refus: _sans, ...reste } = r;
        return reste;
      }),
    };
    expect(() => parseProject(projet(muette))).toThrow(/refus/);
    // La MÊME carte, `refus` en place, passe : c'est bien l'invariant qui mord, pas la forme.
    expect(() => parseProject(projet(carteGatee))).not.toThrow();
  });

  it('`when` dont le kind n’est pas évaluable au contexte de la carte : REFUSÉ (il serait FAUX en silence)', () => {
    const horsPortee = {
      ...carteGatee,
      places: carteGatee.places.map((p) =>
        p.id === 'bogenhafen'
          ? { ...p, when: { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 } }
          : p,
      ),
    };
    expect(() => parseProject(projet(horsPortee as WorldMap))).toThrow(/compare/);
  });

  it('kind hors portée IMBRIQUÉ sous `all`/`not` : refusé aussi (la récursion ne l’oublie pas)', () => {
    const imbrique = {
      ...carteGatee,
      routes: carteGatee.routes.map((r) =>
        r.id === 'altdorf-auberge-retour'
          ? { ...r, when: { kind: 'all', of: [{ kind: 'flag', expr: 'a' }, { kind: 'not', of: { kind: 'foeInLoS' } }] } }
          : r,
      ),
    };
    expect(() => parseProject(projet(imbrique as WorldMap))).toThrow(/foeInLoS/);
  });

  it('l’algèbre ÉVALUABLE passe entière, imbrication comprise (drapeaux, horloge, groupe, bourse)', () => {
    const riche = {
      ...carteGatee,
      places: carteGatee.places.map((p) =>
        p.id === 'bogenhafen'
          ? {
            ...p,
            when: {
              kind: 'all',
              of: [
                { kind: 'flag', expr: 'edo-ch1-bogenhafen-revelee' },
                { kind: 'not', of: { kind: 'money', atLeast: { gold: 1 } } },
                { kind: 'any', of: [{ kind: 'partyDead', who: 'any' }, { kind: 'skill', id: 'charme' }] },
              ],
            },
          }
          : p,
      ),
    };
    expect(() => parseProject(projet(riche as WorldMap))).not.toThrow();
  });
});

describe('`refus` — raison JOUEUR transportée jusqu’au consommateur (rendue par `GatedAction`)', () => {
  it('survit au parse du paquet et est portée par la route offerte', () => {
    const doc = {
      type: 'projet',
      id: 'fixture-gating',
      label: 'Fixture de gating',
      versionContenu: 1,
      maison: 'fixture de test',
      scenes: [{ ...emptyScene(3, 3), id: 's-auberge', label: 's-auberge' }],
      worldMap: carteGatee,
      narratif: emptyNarratif(),
    };
    const map = parseProject(doc as unknown).worldMap!;
    const route = routesFrom(map, 'altdorf', ctx()).find((r) => r.id === 'altdorf-auberge-retour')!;
    expect(route.refus?.texte).toBe('La route du relais est derrière vous.');
    expect(route.when).toEqual({ kind: 'not', of: { kind: 'flag', expr: 'edo-ch1-clos' } });
    expect(map.places.find((p) => p.id === 'bogenhafen')!.when).toEqual({
      kind: 'flag',
      expr: 'edo-ch1-bogenhafen-revelee',
    });
  });
});

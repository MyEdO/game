/**
 * parseProject — validation de FORME du document de projet (`{ type: 'projet', id, label, versionContenu,
 * scenes, worldMap?, narratif }`). Garde-fou robustesse : un document corrompu ou d'un autre format doit
 * LEVER proprement (capté en amont : l'éditeur affiche son refus, pas un crash), jamais être parsé en
 * silence ni migré (#2404).
 */
import { describe, it, expect } from 'vitest';
import { parseProject, declutterPositions, resolvePortRef, portVersDepot, placeServices, type RenderPoint, type MapPlace } from './worldMap';
import { lieuxServices, navalPorts } from '../data';
import { validateScene } from './validateScene';
import { emptyScene, type Scene } from './scene';
import { emptyNarratif } from './campaignNarratif';

const scene = (id: string): Scene => ({ ...emptyScene(3, 3), id, label: id });

/** Un document de projet au format courant, ses scènes et ses champs en plus fournis par le cas. */
const projet = (scenes: unknown[], plus: Record<string, unknown> = {}) => ({
  type: 'projet', id: 'projet-de-test', label: 'Projet de test', versionContenu: 1, maison: 'fixture de test',
  narratif: emptyNarratif(), scenes, ...plus,
});
const wm = { id: 'm', label: 'Carte', places: [], routes: [] };

describe('parseProject — validation du format projet', () => {
  it('document valide → scènes restituées', () => {
    expect(parseProject(projet([scene('s1'), scene('s2')])).scenes.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('worldMap optionnel : présent → restitué ; absent → undefined', () => {
    expect(parseProject(projet([scene('s1')], { worldMap: wm })).worldMap).toEqual(wm);
    expect(parseProject(projet([scene('s1')])).worldMap).toBeUndefined();
  });

  it('un numéro de forme `schema` (autre format) → refus EXPLICITE, nommé à la racine', () => {
    expect(() => parseProject(projet([scene('s1')], { schema: 18 })))
      .toThrow(/^Projet d’un autre format, ou mal formé — JSON invalide contre son schéma :\n {2}- \(racine\): Clé non reconnue : "schema"/);
  });

  it('scenes manquant ou non-tableau → lève', () => {
    const { scenes: _sans, ...sansScenes } = projet([]);
    expect(() => parseProject(sansScenes)).toThrow(/Projet d’un autre format, ou mal formé/);
    expect(() => parseProject(projet([], { scenes: 'nope' }))).toThrow(/Projet d’un autre format, ou mal formé/);
  });

  it('formats ANTÉRIEURS (tableau de scènes nu, scène unique, null) → lèvent', () => {
    expect(() => parseProject([scene('s1')])).toThrow(/Projet d’un autre format, ou mal formé/); // ancien : tableau nu
    expect(() => parseProject(scene('s1'))).toThrow(/Projet d’un autre format, ou mal formé/); // ancien : scène unique
    expect(() => parseProject(null)).toThrow(/Projet d’un autre format, ou mal formé/);
  });

  it('scène SANS ses collections optionnelles → normalisée, ne crashe pas validateScene', () => {
    // Reproduit le crash « Ouvrir → L'Embuscade » (TypeError sur s.encounters.map, validateScene.ts:59) :
    // une scène qui n'écrit pas `encounters`/`dialogues`/… les reçoit de `normalizeScene`.
    const { layers: _l, entities: _e, dialogues: _d, triggers: _t, encounters: _n, flags: _f, ...nue } = scene('nue');
    const { scenes } = parseProject(projet([nue]));
    expect(scenes[0].encounters).toEqual([]);
    expect(scenes[0].dialogues).toEqual([]);
    expect(scenes[0].triggers).toEqual([]);
    expect(scenes[0].entities).toEqual([]);
    expect(scenes[0].flags).toEqual({});
    expect(scenes[0].layers.length).toBeGreaterThan(0);
    expect(() => validateScene(scenes)).not.toThrow();
  });

  it('MapPlace.port (Index des ports, MDG 15) survit au round-trip via parseProject', () => {
    // Un Lieu-port complet : taille/richesse/production/surplus/demande/cosmopolite/lighthouse — édité
    // par la section « Port » de WorldMapEditor, préservé tel quel par le round-trip du projet.
    const port = {
      taille: 4, richesse: 5, production: ['commerce', 'produits-de-luxe'],
      surplus: { 'produits-de-luxe': 1 }, demande: { cereales: 2 }, cosmopolite: true, lighthouse: true,
    };
    const mapWithPort = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Marienburg', pos: { x: 50, y: 50 }, scene: 's1', port }], routes: [] };
    const doc = projet([scene('s1')], { worldMap: mapWithPort as never });
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    expect(round.worldMap!.places[0].port).toEqual(port);
  });

  it('#217 : MapPlace.port.ref seul → résolu aux valeurs du catalogue naval-ports.json au chargement', () => {
    const mapWithRef = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Salzenmund', pos: { x: 50, y: 50 }, scene: 's1', port: { ref: 'salzenmund' } }], routes: [] };
    const doc = projet([scene('s1')], { worldMap: mapWithRef as never });
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    const port = round.worldMap!.places[0].port!;
    expect(port.taille).toBe(4);
    expect(port.richesse).toBe(4);
    expect(port.ref).toBe('salzenmund');
  });

  it('#217 : MapPlace.port.ref + surcharge locale → la surcharge gagne sur le catalogue', () => {
    const mapWithOverride = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Salzenmund', pos: { x: 50, y: 50 }, scene: 's1', port: { ref: 'salzenmund', taille: 1 } }], routes: [] };
    const doc = projet([scene('s1')], { worldMap: mapWithOverride as never });
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    const port = round.worldMap!.places[0].port!;
    expect(port.taille).toBe(1); // surcharge locale
    expect(port.richesse).toBe(4); // hérité du catalogue
  });

  it('#217 : MapPlace.port SANS ref → comportement inchangé (aucune résolution)', () => {
    const port = { taille: 2, richesse: 2, production: ['sel'] };
    const mapNoRef = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Port maison', pos: { x: 50, y: 50 }, scene: 's1', port }], routes: [] };
    const doc = projet([scene('s1')], { worldMap: mapNoRef as never });
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    expect(round.worldMap!.places[0].port).toEqual(port);
  });

  it('#217 : MapPlace.port.ref inconnue → erreur EXPLICITE (fail-fast, jamais un port silencieusement vide)', () => {
    const mapBadRef = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Nulle-part', pos: { x: 50, y: 50 }, scene: 's1', port: { ref: 'port-qui-n-existe-pas' } }], routes: [] };
    const doc = projet([scene('s1')], { worldMap: mapBadRef as never });
    expect(() => parseProject(JSON.parse(JSON.stringify(doc)))).toThrow(/worldMap › places « l1 » › port\.ref: « port-qui-n-existe-pas » est absent du catalogue des ports \(naval-ports\.json\)/);
  });

  it('resolvePortRef : sans ref, retourne le port TEL QUEL (même référence)', () => {
    const port = { taille: 3, richesse: 3, production: [] };
    expect(resolvePortRef(port)).toBe(port);
  });

  it('#217 : resolvePortRef({ ref, lighthouse }) SPARSE (picker) — le catalogue l\'emporte, lighthouse local préservé', () => {
    // Verrou anti-régression : DEFAULT_PORT (taille:2, richesse:2) ne doit JAMAIS écraser le catalogue.
    const resolved = resolvePortRef({ ref: 'salzenmund', lighthouse: true });
    expect(resolved!.taille).toBe(4); // Salzenmund, MDG 15 l.452 — pas le défaut d'auteur (2)
    expect(resolved!.richesse).toBe(4);
    expect(resolved!.lighthouse).toBe(true);
  });

  it('WorldMap.background (vraie carte de fond) survit au round-trip via parseProject', () => {
    // Édité par la section « Carte » de WorldMapEditor : image de fond (URL / data URI) préservée telle
    // quelle. Sa présence désactive le déchevauchement (les lieux restent à leurs pos EXACTES).
    const bg = 'data:image/svg+xml;utf8,%3Csvg%2F%3E';
    const mapWithBg = { id: 'm', label: 'Reikland', background: bg, places: [{ id: 'l1', label: 'Altdorf', pos: { x: 60, y: 30 }, scene: 's1' }], routes: [] };
    const doc = projet([scene('s1')], { worldMap: mapWithBg as never });
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    expect(round.worldMap!.background).toBe(bg);
  });
});

/**
 * declutterPositions — écartement déterministe des médaillons trop proches (RENDU seulement).
 * Rend lisibles les grandes cartes où les lieux se chevauchent au centre (ex. le Reik) sans jamais
 * toucher la donnée `pos` d'authoring.
 */
describe('portVersDepot — forme canonique : une surcharge égale au catalogue disparaît (#680)', () => {
  it('chaque port du catalogue : résolu puis rendu au dépôt, il redevient `{ ref }`, et se re-résout à l’identique', () => {
    expect(navalPorts.length, 'catalogue vide — rien ne serait mesuré').toBeGreaterThan(0);
    for (const { id } of navalPorts) {
      const resolu = resolvePortRef({ ref: id });
      expect(portVersDepot(resolu), id).toEqual({ ref: id });
      expect(resolvePortRef(portVersDepot(resolu)), id).toEqual(resolu);
      expect(portVersDepot(resolvePortRef({ ref: id, lighthouse: true })), `${id} + phare`).toEqual({ ref: id, lighthouse: true });
    }
  });

  it('une SURCHARGE qui diffère du catalogue survit ; celle qui l’égale disparaît', () => {
    const [{ id }] = navalPorts;
    const def = resolvePortRef({ ref: id })!;
    const autreTaille = def.taille === 1 ? 2 : 1;
    const surcharge = { ref: id, taille: autreTaille, production: [...def.production, 'commerce-local'] };
    expect(portVersDepot(resolvePortRef(surcharge))).toEqual(surcharge);
    expect(portVersDepot(resolvePortRef({ ref: id, richesse: def.richesse }))).toEqual({ ref: id });
  });

  it('sans ref, le port est rendu TEL QUEL (même référence) ; ref inconnue → la même erreur que resolvePortRef', () => {
    const port: MapPlace['port'] = { taille: 2, richesse: 2, production: [] };
    expect(portVersDepot(port)).toBe(port);
    expect(() => portVersDepot({ ref: 'port-fantome', taille: 1, richesse: 1, production: [] })).toThrow(/réf de port inconnue "port-fantome"/);
  });
});

describe('declutterPositions — anti-chevauchement pur & déterministe', () => {
  const minPairDist = (m: Map<string, { x: number; y: number }>) => {
    const arr = [...m.values()];
    let min = Infinity;
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++)
        min = Math.min(min, Math.hypot(arr[j].x - arr[i].x, arr[j].y - arr[i].y));
    return min;
  };

  it('des lieux superposés/trop proches → après la passe, toutes les paires sont ≥ minDist', () => {
    // 6 lieux empilés quasi au même point (le cas « le Reik » : 27+ médaillons au centre).
    const pts: RenderPoint[] = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, x: 50 + i * 0.01, y: 32 }));
    const out = declutterPositions(pts, 6, 200);
    // Tolérance numérique : la relaxation converge vers minDist par le dessous à ε près.
    expect(minPairDist(out)).toBeGreaterThanOrEqual(6 - 1e-3);
  });

  it('deux points EXACTEMENT confondus sont séparés (angle dérivé des id, pas de RNG)', () => {
    const pts: RenderPoint[] = [{ id: 'a', x: 50, y: 32 }, { id: 'b', x: 50, y: 32 }];
    const out = declutterPositions(pts, 8, 100);
    expect(minPairDist(out)).toBeGreaterThanOrEqual(8 - 1e-3);
  });

  it('déterministe : même entrée → même sortie (aucun Math.random)', () => {
    const mk = (): RenderPoint[] => [
      { id: 'a', x: 50, y: 32 }, { id: 'b', x: 50.2, y: 32.1 },
      { id: 'c', x: 49.8, y: 31.9 }, { id: 'd', x: 50, y: 32 },
    ];
    const a = declutterPositions(mk(), 7, 120);
    const b = declutterPositions(mk(), 7, 120);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it('les positions restent DANS le cadre 0..100 × 0..64', () => {
    // Amas collé au coin : le bornage doit empêcher toute fuite hors cadre.
    const pts: RenderPoint[] = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, x: 0.1, y: 0.1 + i * 0.01 }));
    const out = declutterPositions(pts, 10, 200);
    for (const { x, y } of out.values()) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(64);
    }
  });

  it('n\'AMÉLIORE jamais au pire : des lieux déjà espacés ne sont pas rapprochés', () => {
    const pts: RenderPoint[] = [
      { id: 'a', x: 10, y: 10 }, { id: 'b', x: 90, y: 10 }, { id: 'c', x: 50, y: 55 },
    ];
    const before = minPairDist(new Map(pts.map((p) => [p.id, { x: p.x, y: p.y }])));
    const out = declutterPositions(pts, 6, 60);
    // Déjà au-dessus du seuil → convergence immédiate, positions inchangées.
    expect(minPairDist(out)).toBeGreaterThanOrEqual(before - 1e-9);
    expect(out.get('a')).toEqual({ x: 10, y: 10 });
  });

  it('ne mute pas le tableau d\'entrée', () => {
    const pts: RenderPoint[] = [{ id: 'a', x: 50, y: 32 }, { id: 'b', x: 50.1, y: 32 }];
    declutterPositions(pts, 8, 50);
    expect(pts).toEqual([{ id: 'a', x: 50, y: 32 }, { id: 'b', x: 50.1, y: 32 }]);
  });
});

/**
 * placeServices — API UNIQUE des services d'un lieu (#343). Compose port + marché + services de
 * catalogue + auberge (propre OU dérivée de la scène) en une liste, sans dupliquer la vérité (port/
 * marché/offre de repos sont RÉFÉRENCÉS, jamais recopiés).
 */
describe('placeServices — vocabulaire unique des services de lieu (#343)', () => {
  const place = (patch: Partial<MapPlace>): MapPlace =>
    ({ id: 'l1', label: 'Lieu', pos: { x: 0, y: 0 }, scene: 's1', ...patch });

  it('lieu COMPLET (port + marché + auberge propre) → 3 services, payloads RÉFÉRENCÉS (pas copiés)', () => {
    const port = { taille: 4, richesse: 5, production: ['commerce'] };
    const market = { taille: 3, richesse: 4, produits: ['vin'] };
    const rest = { auberge: true, camp: true };
    const p = place({ port, market, services: [{ kind: 'auberge', rest }] });
    const svc = placeServices(p);
    expect(svc.map((s) => s.category)).toEqual(['port', 'marche', 'auberge']);
    expect(svc[0].port).toBe(p.port); // référence, pas une copie
    expect(svc[1].market).toBe(p.market);
    expect(svc[2].rest).toBe(rest);
    expect(svc[2].label).toBe('Auberge'); // libellé du catalogue lieux-services.json
    expect(svc[0].icon).toBe('travel/anchor'); // icône LUE au catalogue, pas codée en dur
    expect(svc[1].icon).toBe('merchant/cart');
  });

  it('toute entrée du catalogue lieux-services.json porte une icône (source unique des icônes de service)', () => {
    for (const def of lieuxServices) expect(def.icon, def.id).toBeTruthy();
  });

  it('services de catalogue (temple/forgeron) → catégorie « autre », libellé/icône du catalogue', () => {
    const svc = placeServices(place({ services: [{ kind: 'temple' }, { kind: 'forgeron' }] }));
    expect(svc.map((s) => s.id)).toEqual(['temple', 'forgeron']);
    expect(svc.every((s) => s.category === 'autre')).toBe(true);
    expect(svc[0].label).toBe('Temple');
    expect(svc[0].icon).toBe('faith/church');
  });

  it('hameau NU (aucun service, aucune scène offrant l\'auberge) → liste VIDE', () => {
    expect(placeServices(place({}))).toEqual([]);
  });

  it('auberge DÉRIVÉE de l\'offre de repos de la scène si non déclarée en service propre', () => {
    const scene = { id: 's1', rest: { auberge: true, camp: true } } as Scene;
    const svc = placeServices(place({}), scene);
    expect(svc.map((s) => s.category)).toEqual(['auberge']);
    expect(svc[0].rest).toEqual({ auberge: true, maison: undefined, camp: true });
  });

  it('l\'auberge PROPRE au lieu l\'emporte : pas de doublon avec l\'offre de la scène', () => {
    const scene = { id: 's1', rest: { auberge: true } } as Scene;
    const own = { auberge: true, maison: true };
    const svc = placeServices(place({ services: [{ kind: 'auberge', rest: own }] }), scene);
    expect(svc.filter((s) => s.category === 'auberge')).toHaveLength(1);
    expect(svc[0].rest).toBe(own);
  });

  it('offre d\'auberge via une restZone de la scène (pas seulement scene.rest)', () => {
    const scene = { id: 's1', restZones: [{ rect: { x: 0, y: 0, w: 1, h: 1 }, places: { auberge: true } }] } as Scene;
    const svc = placeServices(place({}), scene);
    expect(svc.map((s) => s.category)).toEqual(['auberge']);
  });
});

/**
 * La PORTE de schéma du seam (#1466 T3-a) : `parseProject` fait traverser un document par
 * `projetSchema` (`validateDocument`), seul contrôle de forme (#2404). Le refus de
 * `encounters[].enemies` est le DURCISSEMENT acté par la purge `f20f16e65` (2026-06-13) : ce champ
 * n'est plus produit par l'app.
 */
describe('parseProject — porte de schéma', () => {
  it('`encounters[].enemies` (forme ANTÉRIEURE) est refusé PAR SON NOM, jamais absorbé en silence', () => {
    const doc = projet([{ ...scene('s1'), encounters: [{ id: 'e1', enemies: [{ ref: 'gobelin', count: 2 }] }] }]);
    expect(() => parseProject(doc)).toThrow(/scenes « s1 » › encounters « e1 »: Clé non reconnue : "enemies"/);
  });
});

/**
 * parseProject — validation de FORME du document de projet (courant : `{ type: 'projet', schema: 8,
 * Garde-fou robustesse : un document corrompu / d'un autre schéma doit LEVER proprement (capté en
 * amont : l'éditeur affiche « JSON invalide », pas un crash), jamais être parsé en silence.
 */
import { describe, it, expect } from 'vitest';
import { parseProject, declutterPositions, resolvePortRef, placeServices, CURRENT_PROJECT_SCHEMA, type RenderPoint, type MapPlace } from './worldMap';
import { lieuxServices } from '../data';
import { validateScene } from './validateScene';
import type { Scene } from './scene';

const scene = (id: string) => ({ id, label: id, dimensions: { w: 3, h: 3 } } as unknown as Scene);

/** L'identité d'un document ANTÉRIEUR vivait dans la poche `meta`, aplatie par `PROJECT_MIGRATIONS[4]`.
 *  Elle est REQUISE depuis #1552 (l'enveloppe l'exige) et la migration n'en INVENTE pas : un document
 *  d'un schéma antérieur la porte, ou il se fait refuser à la porte. Chaque fixture ci-dessous la porte
 *  donc, et c'est la chaîne 2→7 ENTIÈRE qui est mesurée à chaque cas. */
const metaAnterieure = { id: 'projet-de-test', label: 'Projet de test', version: 1 };
const wm = { id: 'm', label: 'Carte', places: [], routes: [] };

describe('parseProject — validation du format projet v2', () => {
  it('document valide { schema: 2, scenes } → scènes restituées', () => {
    const doc = { schema: 2, meta: metaAnterieure, scenes: [scene('s1'), scene('s2')] };
    expect(parseProject(doc).scenes.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('worldMap optionnel : présent → restitué ; absent → undefined', () => {
    expect(parseProject({ schema: 2, meta: metaAnterieure, scenes: [scene('s1')], worldMap: wm }).worldMap).toEqual(wm);
    expect(parseProject({ schema: 2, meta: metaAnterieure, scenes: [scene('s1')] }).worldMap).toBeUndefined();
  });

  it('schéma 1 (aucune migration 1→2 définie) → refus EXPLICITE, pas un throw sec muet', () => {
    expect(() => parseProject({ schema: 1, scenes: [scene('s1')] }))
      .toThrow(/Projet invalide : version non supportée \(schema=1\)/);
  });

  it('schéma futur inconnu (99) → refus EXPLICITE (on ne devine pas une structure future)', () => {
    expect(() => parseProject({ schema: 99, scenes: [scene('s1')] }))
      .toThrow(/Projet invalide : version future \(schema=99\)/);
  });

  it('schéma absent → lève', () => {
    expect(() => parseProject({ scenes: [scene('s1')] })).toThrow(/Projet invalide/);
  });

  it('scenes manquant ou non-tableau → lève', () => {
    expect(() => parseProject({ schema: 2 })).toThrow(/Projet invalide/);
    expect(() => parseProject({ schema: 2, meta: metaAnterieure, scenes: 'nope' })).toThrow(/Projet invalide/);
  });

  it('formats ANTÉRIEURS (tableau de scènes nu, scène unique, null) → lèvent', () => {
    expect(() => parseProject([scene('s1')])).toThrow(/Projet invalide/); // ancien : tableau nu
    expect(() => parseProject(scene('s1'))).toThrow(/Projet invalide/); // ancien : scène unique
    expect(() => parseProject(null)).toThrow(/Projet invalide/);
  });

  it('scène ANCIENNE (schema 2 mais sans les collections requises du Scene actuel) → normalisée, ne crashe pas validateScene', () => {
    // Reproduit le crash « Ouvrir → L'Embuscade » (TypeError sur s.encounters.map, validateScene.ts:59) :
    // un projet localStorage sauvegardé avant que `Scene` ne gagne `encounters`/`dialogues`/… ne les porte pas.
    const old = { id: 'old', label: 'Vieille scène', dimensions: { w: 3, h: 3 } } as Scene; // aucune collection
    const { scenes } = parseProject({ schema: 2, meta: metaAnterieure, scenes: [old] });
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
    const doc = { schema: 2, meta: metaAnterieure, scenes: [scene('s1')], worldMap: mapWithPort as never };
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    expect(round.worldMap!.places[0].port).toEqual(port);
  });

  it('#217 : MapPlace.port.ref seul → résolu aux valeurs du catalogue naval-ports.json au chargement', () => {
    const mapWithRef = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Salzenmund', pos: { x: 50, y: 50 }, scene: 's1', port: { ref: 'salzenmund' } }], routes: [] };
    const doc = { schema: 2, meta: metaAnterieure, scenes: [scene('s1')], worldMap: mapWithRef as never };
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    const port = round.worldMap!.places[0].port!;
    expect(port.taille).toBe(4);
    expect(port.richesse).toBe(4);
    expect(port.ref).toBe('salzenmund');
  });

  it('#217 : MapPlace.port.ref + surcharge locale → la surcharge gagne sur le catalogue', () => {
    const mapWithOverride = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Salzenmund', pos: { x: 50, y: 50 }, scene: 's1', port: { ref: 'salzenmund', taille: 1 } }], routes: [] };
    const doc = { schema: 2, meta: metaAnterieure, scenes: [scene('s1')], worldMap: mapWithOverride as never };
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    const port = round.worldMap!.places[0].port!;
    expect(port.taille).toBe(1); // surcharge locale
    expect(port.richesse).toBe(4); // hérité du catalogue
  });

  it('#217 : MapPlace.port SANS ref → comportement inchangé (aucune résolution)', () => {
    const port = { taille: 2, richesse: 2, production: ['sel'] };
    const mapNoRef = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Port maison', pos: { x: 50, y: 50 }, scene: 's1', port }], routes: [] };
    const doc = { schema: 2, meta: metaAnterieure, scenes: [scene('s1')], worldMap: mapNoRef as never };
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    expect(round.worldMap!.places[0].port).toEqual(port);
  });

  it('#217 : MapPlace.port.ref inconnue → erreur EXPLICITE (fail-fast, jamais un port silencieusement vide)', () => {
    const mapBadRef = { id: 'm', label: 'Côte', places: [{ id: 'l1', label: 'Nulle-part', pos: { x: 50, y: 50 }, scene: 's1', port: { ref: 'port-qui-n-existe-pas' } }], routes: [] };
    const doc = { schema: 2, meta: metaAnterieure, scenes: [scene('s1')], worldMap: mapBadRef as never };
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
    const doc = { schema: 2, meta: metaAnterieure, scenes: [scene('s1')], worldMap: mapWithBg as never };
    const round = parseProject(JSON.parse(JSON.stringify(doc)));
    expect(round.worldMap!.background).toBe(bg);
  });
});

/**
 * declutterPositions — écartement déterministe des médaillons trop proches (RENDU seulement).
 * Rend lisibles les grandes cartes où les lieux se chevauchent au centre (ex. le Reik) sans jamais
 * toucher la donnée `pos` d'authoring.
 */
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
 * `migrateDoc` PUIS par `projetSchema` (`validateDocument`). Les contrats ci-dessous sont ceux que
 * le schéma nu (`defs-scenes/projet-schema.test.ts`) ne peut pas tenir — ils portent sur le
 * CHEMINEMENT : ce qui est migré avant d'être jugé, ce qui est retiré avant d'être jugé, et la
 * forme des refus. Le refus de `encounters[].enemies` est le DURCISSEMENT acté par la purge
 * `f20f16e65` (2026-06-13) : ce champ n'est plus produit par l'app.
 */
describe('parseProject — porte de schéma', () => {
  const narratifVide = { affaires: [], indices: [], presetsPnj: [], objets: [] };

  it('un document schema 2 (localStorage d\'avant #765) est MIGRÉ puis accepté par la porte', () => {
    const res = parseProject({ schema: 2, meta: metaAnterieure, scenes: [scene('s1')] });
    expect(res.scenes.map((s) => s.id)).toEqual(['s1']);
    expect(res.narratif).toEqual(narratifVide);
  });

  it('la clé de travail `version` de `migrateDoc` est RETIRÉE avant la porte (schéma STRICT)', () => {
    const res = parseProject({ schema: 3, version: 3, meta: metaAnterieure, scenes: [scene('s1')], narratif: narratifVide });
    expect(res.scenes.map((s) => s.id)).toEqual(['s1']);
  });

  it('un schema FUTUR est refusé AVANT la porte, avec un message actionnable', () => {
    // Le futur se DÉRIVE du courant : un littéral se périme en silence au prochain bump (il l'a fait
    // au passage à 5, où « le futur » était devenu le présent et ne mesurait plus rien).
    const futur = CURRENT_PROJECT_SCHEMA + 1;
    expect(() => parseProject({ schema: futur, scenes: [scene('s1')], narratif: narratifVide }))
      .toThrow(new RegExp(`Projet invalide : version future \\(schema=${futur}\\)`));
  });

  it('`encounters[].enemies` (forme ANTÉRIEURE) est refusé PAR SON NOM, jamais absorbé en silence', () => {
    const doc = { schema: 2, meta: metaAnterieure, scenes: [{ ...scene('s1'), encounters: [{ id: 'e1', enemies: [{ ref: 'gobelin', count: 2 }] }] }] };
    expect(() => parseProject(doc)).toThrow(/scenes « s1 » › encounters « e1 »: Clé non reconnue : "enemies"/);
  });
});

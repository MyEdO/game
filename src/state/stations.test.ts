import { describe, it, expect } from 'vitest';
import { postesToStations, battleScenesToStations } from './stations';
import { posteAnchor, applyShipPostes } from './shipPostes';
import { battleSceneById } from './massBattleFlow';
import { itemFromTrappingById, itemLabel } from '../engine/items';
import type { Combatant, ShipPoste, ShipDeck } from '../engine/types';
import type { Scene } from './scene';
import type { FireArc } from './fireArc';

/**
 * INDEX de Stations (postes d'artillerie) + résolveur d'ancre spatiale — PURS, sans store.
 * Coque = un Combattant portant `postes` (emplacement de siège au sol ou navire) ; une Station par poste.
 */

const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mkCrew = (id: string): Combatant =>
  ({ id, name: id, kind: 'npc', characteristics: CHARS, conditions: [], skills: [], talents: [], weapons: [],
    wounds: { current: 12, max: 12 } }) as unknown as Combatant;

const mkPoste = (engineId: string, crewIds: string[], side?: FireArc): ShipPoste =>
  ({ item: itemFromTrappingById(engineId)!, crewIds, ...(side ? { side } : {}) });

const mkHull = (id: string, kind: Combatant['kind'], postes: ShipPoste[], pos = { x: 5, y: 7 }, footprint?: number): Combatant =>
  ({ id, name: id, kind, pos, conditions: [], skills: [], talents: [], weapons: [], postes,
    ...(footprint ? { footprint } : {}), wounds: { current: 0, max: 0 } }) as unknown as Combatant;

describe('postesToStations — une Station par poste, ids/assignedIds/side/ref', () => {
  it('coque à 2 postes → 2 Stations avec id `poste:<hull>:<uid>` et le bon détail', () => {
    const p1 = mkPoste('baliste', ['gunner', 's1'], 'tribord');
    const p2 = mkPoste('pierrier', ['g2'], 'babord');
    const hull = mkHull('emplacement', 'enemy', [p1, p2]);
    const stations = postesToStations([hull, mkCrew('gunner'), mkCrew('s1'), mkCrew('g2')]);

    expect(stations).toHaveLength(2);
    const s1 = stations[0], s2 = stations[1];
    expect(s1.id).toBe(`poste:emplacement:${p1.item.uid}`);
    expect(s2.id).toBe(`poste:emplacement:${p2.item.uid}`);
    expect(s1.assignedIds).toEqual(['gunner', 's1']);
    expect(s1.side).toBe('tribord');
    expect(s2.side).toBe('babord');
    expect(s1.ref).toEqual({ kind: 'poste', hullId: 'emplacement', posteUid: p1.item.uid });
    expect(s1.label).toBe(itemLabel(p1.item));
    expect(s1.icon).toBe('action/serve-engine');
    expect(s1.kind).toBe('poste');
  });

  it('faction dérivée du kind de la coque : hero→ally, enemy→enemy, npc→neutral', () => {
    const mk = (kind: Combatant['kind']) => postesToStations([mkHull('h', kind, [mkPoste('baliste', ['c'])])])[0];
    expect(mk('hero').faction).toBe('ally');
    expect(mk('enemy').faction).toBe('enemy');
    expect(mk('npc').faction).toBe('neutral');
  });

  it('un Combattant SANS postes ne produit aucune Station', () => {
    expect(postesToStations([mkCrew('lone')])).toHaveLength(0);
  });

  it('`manned` true quand le chef sert le poste, false quand l’équipage est vide', () => {
    const poste = mkPoste('baliste', ['gunner', 's1']);
    const hull = mkHull('emplacement', 'enemy', [poste]);
    const gunner = mkCrew('gunner');
    const all = [hull, gunner, mkCrew('s1')];
    applyShipPostes(all); // pose mannedPoste sur le chef (crewIds[0])
    expect(postesToStations(all)[0].manned).toBe(true);

    const empty = mkHull('emp2', 'enemy', [mkPoste('baliste', [])]);
    expect(postesToStations([empty])[0].manned).toBe(false);
  });

  it('ancre par défaut = pos de la coque ; l’injecteur `anchorOf` (posteAnchor) fait foi', () => {
    const poste = mkPoste('baliste', ['g'], 'tribord');
    const hull = mkHull('h', 'enemy', [poste], { x: 3, y: 4 });
    expect(postesToStations([hull])[0].pos).toMatchObject({ x: 3, y: 4 }); // défaut = hull.pos

    poste.anchor = { x: 20, y: 21 }; // ancre authorée → posteAnchor la retourne
    const st = postesToStations([hull], (h, p) => posteAnchor(h, p, { heading: 'N' }))[0];
    expect(st.pos).toEqual({ x: 20, y: 21 });
  });

  it('poste dont l’ancre résout undefined → ignoré', () => {
    const hull = mkHull('h', 'enemy', [mkPoste('baliste', ['g'])], undefined as never);
    delete (hull as { pos?: unknown }).pos; // coque sans position
    expect(postesToStations([hull], (h, p) => posteAnchor(h, p))).toHaveLength(0);
  });
});

describe('battleScenesToStations — Scènes de la situation → Stations spatiales (S2)', () => {
  const sceneWith = (stations: { sceneId: string; pos: { x: number; y: number } }[]): Scene =>
    ({ dimensions: { w: 22, h: 16 }, stations } as unknown as Scene);

  it('une Station par Scène connue, id/label/ref/kind depuis le catalogue + ancre authorée', () => {
    const scene = sceneWith([{ sceneId: 'charge', pos: { x: 13, y: 6 } }]);
    const st = battleScenesToStations(['charge'], {}, scene);
    expect(st).toHaveLength(1);
    expect(st[0].id).toBe('battleScene:charge');
    expect(st[0].kind).toBe('battleScene');
    expect(st[0].label).toBe(battleSceneById('charge')!.label);
    expect(st[0].ref).toEqual({ kind: 'battleScene', sceneId: 'charge' });
    expect(st[0].pos).toEqual({ x: 13, y: 6 }); // ancre authorée
    expect(st[0].assignedIds).toEqual([]);
    expect(st[0].manned).toBe(false);
  });

  it('faction : threat → enemy, sinon neutral', () => {
    const scene = sceneWith([{ sceneId: 'intrus', pos: { x: 6, y: 8 } }, { sceneId: 'motivation', pos: { x: 4, y: 12 } }]);
    const st = battleScenesToStations(['intrus', 'motivation'], {}, scene);
    expect(st.find((s) => s.ref.kind === 'battleScene' && s.ref.sceneId === 'intrus')!.faction).toBe('enemy');
    expect(st.find((s) => s.ref.kind === 'battleScene' && s.ref.sceneId === 'motivation')!.faction).toBe('neutral');
  });

  it('affectation MULTI-PJ → assignedIds (liste ordonnée) + manned', () => {
    const scene = sceneWith([{ sceneId: 'motivation', pos: { x: 4, y: 12 } }]);
    const st = battleScenesToStations(['motivation'], { motivation: ['hero-2', 'hero-3'] }, scene);
    expect(st[0].assignedIds).toEqual(['hero-2', 'hero-3']);
    expect(st[0].manned).toBe(true);
  });

  it('Scène inconnue du catalogue → ignorée', () => {
    const scene = sceneWith([]);
    expect(battleScenesToStations(['pas-une-scene'], {}, scene)).toHaveLength(0);
  });

  it('sans ancre authorée → repli déterministe borné dans les dimensions de la scène', () => {
    const scene = sceneWith([]); // aucune ancre
    const st = battleScenesToStations(['charge'], {}, scene);
    expect(st).toHaveLength(1);
    expect(st[0].pos.x).toBeGreaterThanOrEqual(0);
    expect(st[0].pos.x).toBeLessThan(22);
    expect(st[0].pos.y).toBeGreaterThanOrEqual(0);
    expect(st[0].pos.y).toBeLessThan(16);
  });

  it('scène null → repli déterministe (démo `__wfrp.massBattle()` sans carte)', () => {
    const st = battleScenesToStations(['charge', 'motivation'], {}, null);
    expect(st).toHaveLength(2);
    expect(Number.isFinite(st[0].pos.x)).toBe(true);
  });
});

describe('posteAnchor — ordre de résolution', () => {
  const hull = (pos: { x: number; y: number; z?: number } | undefined, footprint?: number): Combatant =>
    ({ id: 'h', name: 'h', kind: 'enemy', pos, ...(footprint ? { footprint } : {}) }) as unknown as Combatant;

  it('`poste.anchor` authoré fait foi (par-dessus deck-slot / empreinte)', () => {
    const poste: ShipPoste = { item: itemFromTrappingById('baliste')!, side: 'tribord', anchor: { x: 9, y: 9, z: 1 } };
    const deck: ShipDeck = { ascii: [], postes: [{ pos: { x: 1, y: 1 }, side: 'tribord' }] };
    expect(posteAnchor(hull({ x: 5, y: 5 }, 3), poste, { heading: 'N', deck })).toEqual({ x: 9, y: 9, z: 1 });
  });

  it('deck-slot du même bord utilisé HORS échelle mer seulement', () => {
    const poste: ShipPoste = { item: itemFromTrappingById('baliste')!, side: 'tribord' };
    const deck: ShipDeck = { ascii: [], postes: [{ pos: { x: 2, y: 3 }, side: 'tribord' }, { pos: { x: 8, y: 3 }, side: 'babord' }] };
    // hors mer : le slot du bord tribord fait foi
    expect(posteAnchor(hull({ x: 5, y: 5 }), poste, { deck })).toEqual({ x: 2, y: 3 });
    // échelle mer : coords de pont invalides → repli sur la coque
    expect(posteAnchor(hull({ x: 5, y: 5 }), poste, { deck, sea: true })).toMatchObject({ x: 5, y: 5 });
  });

  it('empreinte>1 + arc + cap → décalage HORS-CENTRE, deux bords donnent deux cases distinctes', () => {
    const item = itemFromTrappingById('baliste')!;
    const tribord: ShipPoste = { item, side: 'tribord' };
    const babord: ShipPoste = { item, side: 'babord' };
    const h = hull({ x: 10, y: 10 }, 3); // step = floor(3/2) = 1
    const at = posteAnchor(h, tribord, { heading: 'N' })!; // tribord d’un cap N = Est → +x
    const ab = posteAnchor(h, babord, { heading: 'N' })!; // babord d’un cap N = Ouest → −x
    expect(at).toMatchObject({ x: 11, y: 10 });
    expect(ab).toMatchObject({ x: 9, y: 10 });
    expect(at.x).not.toBe(ab.x); // deux bords → deux cases
  });

  it('sans empreinte/side/cap → pos de coque telle quelle ; sans pos → undefined', () => {
    const poste: ShipPoste = { item: itemFromTrappingById('baliste')! };
    expect(posteAnchor(hull({ x: 4, y: 6 }), poste)).toMatchObject({ x: 4, y: 6 });
    expect(posteAnchor(hull(undefined), poste)).toBeUndefined();
  });
});

/**
 * ZONE JOUABLE (#4392, lot 2) : la grille est le monde bâti et rendu, la zone jouable (`Scene.zoneJouable`) le monde où
 * l'on joue. Une règle de jeu se borne à `rectJouable`/`isWalkable`, le rendu et l'auteur lisent `solPraticable`.
 */
import { describe, expect, it } from 'vitest';
import { dansLaZoneJouable, emptyScene, isWalkable, rectJouable, solPraticable, type Scene, type SceneEntity } from './monde/scene';
import { pathTo, reachable } from './monde/path';
import { isOverhang } from './monde/volume/floors';
import { translaterFormation } from './monde/shipPostes';
import { combatantsWithinRadius, formationDeCombat } from './monde/combatGeometry';
import { spawnFacing } from './monde/exploreNav';
import { addEnemyMember, addStation, borneALaCarte, editEntry, moveSel, pasteEntity, patchStation, placeEntity, placeEntry } from './sceneEdit';
import { validateScene } from './validateScene';
import { avertissementsDeLaSession, editer, ouvrirLEdition } from './edition/session';
import { emptyNarratif } from './monde/campaignNarratif';
import { actionNeuve, aUnRoleEnJeu } from './monde/usable';
import { unreachableDescriptiveZones } from './mapQC';
import { scatter } from '../engine/scatter';
import { makeRNG } from '../engine/dice';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

/** Grille 12×8 d'herbe (`emptyScene`), zone jouable des colonnes 2 à 7 et des lignes 1 à 5. */
const ZONE = { x: 2, y: 1, w: 6, h: 5 };
const dehors = (over: Partial<Scene> = {}): Scene => ({ ...emptyScene('zone', 12, 8), zoneJouable: ZONE, ...over });
const NU = { blocked: new Set<string>() };

describe('zone jouable — les deux prédicats', () => {
  it('sans zone, le rectangle jouable est la grille et la marche est celle du sol', () => {
    const s = emptyScene('grille', 12, 8);
    expect(rectJouable(s)).toEqual({ x: 0, y: 0, w: 12, h: 8 });
    expect(isWalkable(s, 0, 0)).toBe(true);
  });

  it('hors zone, le sol reste praticable (rendu, auteur) mais la case ne se joue pas', () => {
    const s = dehors();
    expect(solPraticable(s, 0, 0)).toBe(true);
    expect(isWalkable(s, 0, 0)).toBe(false);
    expect(isWalkable(s, ZONE.x, ZONE.y)).toBe(true);
    expect(isWalkable(s, ZONE.x + ZONE.w, ZONE.y)).toBe(false);
  });

  it('la nage aussi s’arrête au bord de la zone', () => {
    const s = dehors();
    s.layers = [{ z: 0, tiles: s.layers[0].tiles.map((t, i) => (i % 12 === 1 || i % 12 === 2 ? 'eau' : t)) }];
    const nage = new Set(['eau']);
    expect(isWalkable(s, 2, 2, 0, nage)).toBe(true);
    expect(solPraticable(s, 1, 2, 0, nage)).toBe(true);
    expect(isWalkable(s, 1, 2, 0, nage)).toBe(false);
  });

  it('le chemin ne sort pas de la zone, même pour qui nage', () => {
    const s = dehors();
    const portee = reachable(s, { x: 2, y: 2 }, 6, { ...NU, swim: new Set(['eau']) });
    expect([...portee.keys()].every((k) => { const [x, y] = k.split(',').map(Number); return dansLaZoneJouable(s, x, y); })).toBe(true);
    expect(pathTo(s, { x: 2, y: 2 }, { x: 0, y: 2 }, NU)).toBeNull();
  });

  it('un surplomb se bâtit encore hors zone : le sol du dessous y est praticable', () => {
    const s = dehors();
    s.layers = [s.layers[0], { z: 1, tiles: [...s.layers[0].tiles] }];
    expect(isOverhang(s, 0, 0, 1)).toBe(true);
  });
});

describe('zone jouable — navires et formation', () => {
  const coque = combattantDeTest({ id: 'coque', kind: 'pnj', pos: { x: 6, y: 3 }, conditions: [], weapons: [] });
  const matelot = combattantDeTest({ id: 'm1', kind: 'pnj', pos: { x: 5, y: 3 }, conditions: [], weapons: [] });

  it('une formation rigide qui sortirait de la zone est refusée entière, sans rien déplacer', () => {
    const c = { ...coque, pos: { ...coque.pos! } }, m = { ...matelot, pos: { ...matelot.pos! } };
    expect(translaterFormation([c, m], dehors(), c, ['m1'], { x: 2, y: 0 })).toBeNull();
    expect(c.pos).toEqual({ x: 6, y: 3 });
    expect(translaterFormation([c, m], dehors(), c, ['m1'], { x: 1, y: 0 })?.map((d) => d.mobile.pos)).toEqual([{ x: 7, y: 3 }, { x: 6, y: 3 }]);
  });

  it('la colonne du groupe au bord de la zone se pose dans la zone, et son repli aussi', () => {
    const s = dehors();
    const poses = formationDeCombat(s, { x: ZONE.x, y: ZONE.y + ZONE.h - 2 }, 4);
    expect(poses).toHaveLength(4);
    expect(poses.every((p) => dansLaZoneJouable(s, p.x, p.y))).toBe(true);
    const toutPris = new Set(Array.from({ length: ZONE.w * ZONE.h }, (_, i) => `${ZONE.x + (i % ZONE.w)},${ZONE.y + Math.floor(i / ZONE.w)}`));
    const repli = formationDeCombat(s, { x: ZONE.x, y: ZONE.y + ZONE.h - 1 }, 2, toutPris);
    expect(repli, 'aucune case valable : la colonne, bornée à la zone').toEqual([{ x: 2, y: 5 }, { x: 2, y: 5 }]);
  });

  it('le repli d’un groupe au-delà du bord est et au-dessus du bord nord se borne aux deux côtés de chaque axe', () => {
    const s = dehors();
    const toutPris = new Set(Array.from({ length: 12 * 8 }, (_, i) => `${i % 12},${Math.floor(i / 12)}`));
    expect(formationDeCombat(s, { x: 11, y: 0 }, 2, toutPris)).toEqual([{ x: 7, y: 1 }, { x: 7, y: 1 }]);
  });

  it('le meneur qui entre en scène regarde le centre de la zone, pas celui de la grille', () => {
    const s = { ...emptyScene('col', 21, 20), zoneJouable: { x: 14, y: 15, w: 5, h: 5 } };
    expect(spawnFacing({ x: 10, y: 19 }, { x: 0, y: 0, ...s.dimensions })).toBe('N');
    expect(spawnFacing({ x: 10, y: 19 }, rectJouable(s))).toBe('E');
  });

  it('une dispersion peut retomber hors zone, où elle ne touche personne', () => {
    const s = dehors();
    const tireur = combattantDeTest({ id: 't', kind: 'heros', pos: { x: 2, y: 3 } });
    const cible = combattantDeTest({ id: 'c', kind: 'ennemi', pos: { x: 3, y: 3 } });
    const arrivees = Array.from({ length: 200 }, (_, i) => scatter(tireur.pos!, { x: 0, y: 3 }, makeRNG(i), 2, s.dimensions));
    const dehorsZone = arrivees.find((p) => !dansLaZoneJouable(s, p.x, p.y));
    expect(dehorsZone).toBeDefined();
    expect(isWalkable(s, dehorsZone!.x, dehorsZone!.y)).toBe(false);
    expect(combatantsWithinRadius(dehorsZone!, 0, [tireur, cible])).toEqual([]);
  });
});

describe('zone jouable — pose de l’auteur et validation', () => {
  const decor: SceneEntity = { id: 'arbre', kind: 'prop', pos: { x: 3, y: 3 }, decor: { id: 'arbre' } } as SceneEntity;
  const bavard: SceneEntity = { id: 'pnj', kind: 'personnage', pos: { x: 3, y: 3 }, dialogueId: { id: 'd' } } as SceneEntity;

  it('le rôle d’une entité se lit à ses champs : dialogue, marchand, usage, rencontre, départ du groupe', () => {
    const s = dehors();
    expect(aUnRoleEnJeu(s, decor)).toBe(false);
    expect(aUnRoleEnJeu(s, bavard)).toBe(true);
    expect(aUnRoleEnJeu(s, { ...decor, usable: { actions: [] } }), 'un usage sans action n’offre rien').toBe(false);
    expect(aUnRoleEnJeu(s, { ...decor, usable: { actions: [actionNeuve([])] } })).toBe(true);
    expect(aUnRoleEnJeu(s, { ...decor, merchant: {} } as SceneEntity)).toBe(true);
    expect(aUnRoleEnJeu(s, { ...decor, kind: 'heroStart' })).toBe(true);
    expect(aUnRoleEnJeu(dehors({ encounters: [{ id: 'r', members: [{ entityId: 'arbre' }] }] as Scene['encounters'] }), decor)).toBe(true);
  });

  it('un décor se pose dehors, une entité à rôle et un point d’entrée se bornent à la zone', () => {
    const s = { ...dehors(), entities: [decor, bavard] };
    expect(borneALaCarte(s, { x: 0, y: 7 }, false)).toEqual({ x: 0, y: 7 });
    expect(borneALaCarte(s, { x: 0, y: 7 }, true)).toEqual({ x: 2, y: 5 });
    expect(moveSel(s, { type: 'entity', id: 'arbre' }, { x: 11, y: 0 }).entities.find((e) => e.id === 'arbre')!.pos).toEqual({ x: 11, y: 0 });
    expect(moveSel(s, { type: 'entity', id: 'pnj' }, { x: 11, y: 0 }).entities.find((e) => e.id === 'pnj')!.pos).toEqual({ x: 7, y: 1 });
    const collee = pasteEntity(s, bavard, { x: 0, y: 0 });
    expect(collee.scene.entities.find((e) => e.id === collee.id)!.pos).toEqual({ x: 2, y: 1 });
    const entree = placeEntry(s, { x: 11, y: 7 });
    expect(entree.scene.entryPoints![entree.id]).toEqual({ x: 7, y: 5 });
    expect(editEntry(entree.scene, entree.id, { x: 0 }).entryPoints![entree.id]).toEqual({ x: 2, y: 5 });
  });

  it('la validation refuse une entité à rôle, un point d’entrée et une ancre de bataille hors zone, pas un décor', () => {
    const s = dehors({
      entities: [{ ...decor, pos: { x: 0, y: 0 } }, { ...bavard, pos: { x: 0, y: 0 } }],
      dialogues: [{ id: 'd', nodes: [{ id: 'n', text: 'x', choices: [] }], start: 'n' }] as unknown as Scene['dialogues'],
      entryPoints: { dedans: { x: 3, y: 3 }, quai: { x: 11, y: 7 } },
      stations: [{ sceneId: 'ailleurs', pos: { x: 0, y: 7 } }],
    });
    const zone = validateScene([s]).filter((w) => w.message.includes('zone jouable'));
    expect(zone.map((w) => [w.level, w.scope, w.refId])).toEqual([
      ['error', 'entity', 'pnj'], ['error', 'scene', 'quai'], ['error', 'scene', 'ailleurs'],
    ]);
  });

  it('l’empreinte d’une entité à rôle qui déborde de la zone se signale, ses cases dehors nommées', () => {
    const ogre = { id: 'ogre', kind: 'personnage', pos: { x: 7, y: 5 }, creature: { id: 'ogre' } } as SceneEntity;
    const s = dehors({ entities: [ogre], encounters: [{ id: 'r', members: [{ entityId: 'ogre' }] }] as Scene['encounters'] });
    const zone = validateScene([s]).filter((w) => w.refId === 'ogre' && w.message.includes('zone jouable'));
    expect(zone.map((w) => [w.level, w.message.match(/\(\d+,\d+\)/g)])).toEqual([['error', ['(8,5)', '(7,6)', '(8,6)']]]);
  });

  it('le départ des héros, un membre de rencontre posé à l’outil et une ancre de bataille se bornent à la zone', () => {
    const s = dehors();
    const depart = placeEntity(s, { mode: 'entite', kind: 'heroStart' }, { x: 11, y: 7 });
    expect(depart.scene.entities.find((e) => e.id === depart.id)!.pos).toEqual({ x: 7, y: 5 });
    const membre = addEnemyMember(s, '', 'ogre', { x: 0, y: 0 });
    expect(membre.scene.entities.find((e) => e.id === membre.entityId)!.pos).toEqual({ x: 2, y: 1 });
    const ancree = addStation(s, 'ailleurs');
    expect(ancree.stations![0].pos).toEqual({ x: 2, y: 1 });
    expect(patchStation(ancree, 0, { pos: { x: 11, y: 0 } }).stations![0].pos).toEqual({ x: 7, y: 1 });
  });

  it('l’avertissement d’un point d’entrée ou d’une ancre hors zone mène l’auteur au fautif', () => {
    const s = dehors({ entryPoints: { quai: { x: 11, y: 7 } }, stations: [{ sceneId: 'ailleurs', pos: { x: 0, y: 7 } }] });
    const ouverte = editer(ouvrirLEdition({ scenes: [s], narratif: emptyNarratif() } as unknown as Parameters<typeof ouvrirLEdition>[0], false), { geste: 'outil', outil: { mode: 'zone', zone: 'room' } });
    const ws = avertissementsDeLaSession(ouverte);
    const aller = (fautif: string) => editer(ouverte, { geste: 'avertissement', rang: ws.findIndex((w) => w.message.includes(fautif) && w.message.includes('zone jouable')) });
    expect([aller('quai').sel, aller('quai').outil]).toEqual([{ type: 'entry', id: 'quai' }, { mode: 'selection' }]);
    expect([aller('ailleurs').sel, aller('ailleurs').outil]).toEqual([null, { mode: 'selection' }]);
  });

  it('un départ du groupe hors zone ne porte qu’un défaut : hors de la zone jouable', () => {
    const s = dehors({ entities: [{ id: 'depart', kind: 'heroStart', pos: { x: 0, y: 0 } } as SceneEntity] });
    expect(validateScene([s]).filter((w) => w.refId === 'depart').map((w) => w.level)).toEqual(['error']);
  });

  it('une pièce nommée entièrement hors zone n’est pas « inatteignable » ; à cheval sur la zone, si', () => {
    const piece = (id: string, x: number) => ({ id, label: id, presentation: 'interior' as const, area: { kind: 'rect' as const, x, y: 5, w: 2, h: 2 } });
    const s = dehors({ effectZones: [piece('dehors', 9), piece('cheval', 6)] });
    s.layers = [{ z: 0, tiles: s.layers[0].tiles.map((t, i) => (Math.floor(i / 12) === 5 && (i % 12 === 6 || i % 12 === 7) ? 'mur' : t)) }];
    expect(unreachableDescriptiveZones(s, { x: 3, y: 3 }).map((z) => z.id)).toEqual(['cheval']);
  });

  it('le schéma refuse une zone jouable qui sort de la grille', () => {
    const fautes = validateScene([dehors({ zoneJouable: { x: 8, y: 0, w: 6, h: 2 } })]).filter((w) => w.message.includes('sort de la grille'));
    expect(fautes).toHaveLength(1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import {
  doorAt, doorKey, emptyScene, porteAuteur, porteEnJeu, porteMasquee, porteNonSecrete, porteRevelee, secretAuteur, secretKey,
  setDoorOpen, setDoorRevealed, wallBetween, wallIsOpen, type Scene, type WallSeg,
} from './scene';
import { wallSegSchema } from '../data/schemas/defs-scenes/scene';
import { setDoorSchema } from '../data/schemas/defs-scenes/effets';
import { roomPortals } from './roomPortals';
import { buildScene } from './mapSpec';
import { useGame } from './store';
import { applyEffects } from './combatEffects';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Effect } from './scene';

/**
 * PORTE SECRÈTE — `EDO 08 l.404` (« Cette porte ne peut être découverte qu'après la réussite d'un Test
 * de Perception Complexe (-10) »), `LDB 09 l.399`. Tant qu'elle n'est pas révélée, l'arête n'est PAS
 * une porte pour le jeu (`porteEnJeu`) : elle bloque comme un mur, ne s'offre pas, ne s'enrôle pas.
 */
const SECRET = { difficulty: 'complexe', face: 'les-deux' } as const;
const SECRETE: WallSeg = { x: 1, y: 1, side: 'E', door: true, closed: true, secret: SECRET };

/** Deux pièces (1,1) | (2,1), séparées par l'arête E de (1,1). */
function deuxPieces(seg: WallSeg): Scene {
  const s = emptyScene(5, 4);
  s.effectZones = [
    { id: 'a', label: 'A', presentation: 'interior', area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 } },
    { id: 'b', label: 'B', presentation: 'interior', area: { kind: 'rect', x: 2, y: 1, w: 1, h: 1 } },
  ];
  s.walls = [seg];
  return s;
}
const revelee = (s: Scene) => setDoorRevealed(s, 1, 1, 'E', 0, true);

describe('porte secrète — schéma (refus au parse)', () => {
  it('`secret` exige `door` ET `closed` ; `shuttered` exige `window`', () => {
    expect(wallSegSchema.safeParse(SECRETE).success).toBe(true);
    const msg = (v: unknown) => (wallSegSchema.safeParse(v).error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`);
    expect(msg({ x: 0, y: 0, side: 'N', closed: true, secret: SECRET })).toEqual(['secret: porte secrète (`secret`) sans `door: true` — seule une porte peut être secrète']);
    expect(msg({ x: 0, y: 0, side: 'N', door: true, secret: SECRET })).toEqual(['secret: porte secrète (`secret`) sans `closed: true` — une porte secrète est fermée au départ']);
    expect(msg({ x: 0, y: 0, side: 'N', shuttered: true })).toEqual(['shuttered: volets clos (`shuttered`) sans `window: true` — seule une croisée a des volets']);
    expect(wallSegSchema.safeParse({ x: 0, y: 0, side: 'N', window: true, shuttered: true }).success).toBe(true);
    expect(msg({ x: 0, y: 0, side: 'N', door: true, window: true })).toEqual(['window: fenêtre (`window`) sur une porte (`door: true`) — une arête est porte OU croisée']);
  });

  it('`secret` exige sa difficulté (LDB 12 l.137) et sa face découvrable (EDO 07 l.263)', () => {
    const chemins = (v: unknown) => (wallSegSchema.safeParse(v).error?.issues ?? []).map((i) => i.path.join('.'));
    expect(chemins({ ...SECRETE, secret: { face: 'porteuse' } })).toEqual(['secret.difficulty']);
    expect(chemins({ ...SECRETE, secret: { difficulty: 'complexe' } })).toEqual(['secret.face']);
    for (const face of ['porteuse', 'voisine', 'les-deux'] as const) expect(chemins({ ...SECRETE, secret: { difficulty: 'complexe', face } })).toEqual([]);
  });

  it('cloison oblique : `door`, `secret`, `crossable`, `allege`, `climb`, `structure` refusés au parse ; `window` admis', () => {
    const chemins = (v: unknown) => (wallSegSchema.safeParse(v).error?.issues ?? []).map((i) => i.path.join('.'));
    expect(chemins({ x: 1, y: 1, side: '/', door: true, closed: true, secret: SECRET })).toEqual(['door', 'secret']);
    expect(chemins({ x: 1, y: 1, side: '/', window: true, crossable: true, allege: 1 })).toEqual(['crossable', 'allege']);
    expect(chemins({ x: 1, y: 1, side: '/', climb: { kind: 'ladder' } })).toEqual(['climb']);
    expect(chemins({ x: 1, y: 1, side: '/', structure: 'porte-de-ville' })).toEqual(['structure']);
    expect(chemins({ x: 1, y: 1, side: '/', window: true, shuttered: true })).toEqual([]);
    expect(wallSegSchema.safeParse({ x: 1, y: 1, side: '/', door: true, closed: true, secret: SECRET }).error?.issues.map((i) => i.message))
      .toContain('cloison oblique (`/`) avec `secret` — une arête oblique est purement visuelle, déplacement, vision et grimpe restent cardinaux');
  });

  it('`setDoor` : au moins l’un de `open` ou `revealed`', () => {
    expect(setDoorSchema.safeParse({ type: 'setDoor', x: 0, y: 0, side: 'N' }).success).toBe(false);
    expect(setDoorSchema.safeParse({ type: 'setDoor', x: 0, y: 0, side: 'N', revealed: true }).success).toBe(true);
    expect(setDoorSchema.safeParse({ type: 'setDoor', x: 0, y: 0, side: 'N', open: false }).success).toBe(true);
  });

  it('MapSpec : `secret` compile en porte FERMÉE (round-trip de difficulté et face) ; le refus vient du SCHÉMA', () => {
    const s = buildScene({ id: 't', label: 't', size: [3, 3], walls: [{ x: 1, y: 1, side: 'E', door: true, secret: { difficulty: 'difficile', face: 'voisine' } }] });
    expect(s.walls).toEqual([{ x: 1, y: 1, side: 'E', door: true, closed: true, secret: { difficulty: 'difficile', face: 'voisine' } }]);
    expect(() => buildScene({ id: 't', label: 't', size: [3, 3], walls: [{ x: 1, y: 1, side: 'E', secret: SECRET }] }))
      .toThrow('buildScene: WallSpec (1,1,E) — porte secrète (`secret`) sans `door: true` — seule une porte peut être secrète');
    expect(() => buildScene({ id: 't', label: 't', size: [3, 3], walls: [{ x: 1, y: 1, side: 'E', door: true, window: true }] }))
      .toThrow('fenêtre (`window`) sur une porte (`door: true`)');
  });
});

describe('porte secrète — lectures AUTEUR (document, sans état runtime)', () => {
  it('`porteAuteur` lit `door` ; `secretAuteur` rend la définition authorée', () => {
    expect(porteAuteur(SECRETE)).toBe(true);
    expect(porteAuteur({ x: 0, y: 0, side: 'N' })).toBe(false);
    expect(secretAuteur(SECRETE)).toEqual(SECRET);
    expect(secretAuteur({ x: 0, y: 0, side: 'N', door: true })).toBeUndefined();
  });
});

describe('porte secrète — prédicats runtime', () => {
  it('masquée : ni porte en jeu, ni `doorAt`, l’arête barre le passage ; porte AUTHORÉE quand même', () => {
    const s = deuxPieces(SECRETE);
    expect(porteMasquee(s, SECRETE)).toBe(true);
    expect(porteEnJeu(s, SECRETE)).toBe(false);
    expect(doorAt(s, 1, 1, 'E')).toBeUndefined();
    expect(wallBetween(s, 1, 1, 2, 1)).toBe(true);
    expect(porteNonSecrete(SECRETE)).toBe(false);
  });

  it('un flag d’ouverture posé sur une secrète MASQUÉE ne l’ouvre pas', () => {
    const s = { ...deuxPieces(SECRETE), flags: { [doorKey(1, 1, 'E', 0)]: true } } as Scene;
    expect(wallIsOpen(s, SECRETE)).toBe(false);
    expect(setDoorOpen(deuxPieces(SECRETE), 1, 1, 'E', 0, true).flags).toEqual(deuxPieces(SECRETE).flags);
  });

  it('révélée : porte en jeu, fermée, puis ouvrable', () => {
    const s = revelee(deuxPieces(SECRETE));
    expect(s.flags?.[secretKey(1, 1, 'E', 0)]).toBe(true);
    expect(porteRevelee(s, SECRETE)).toBe(true);
    expect(porteEnJeu(s, SECRETE)).toBe(true);
    expect(doorAt(s, 1, 1, 'E')).toEqual(SECRETE);
    expect(wallIsOpen(s, SECRETE)).toBe(false);
    const ouverte = setDoorOpen(s, 1, 1, 'E', 0, true);
    expect(wallIsOpen(ouverte, SECRETE)).toBe(true);
    expect(wallBetween(ouverte, 1, 1, 2, 1)).toBe(false);
  });

  it('`setDoorRevealed` est un no-op (même référence) sur une arête sans `secret`', () => {
    const s = deuxPieces({ x: 1, y: 1, side: 'E', door: true, closed: true });
    expect(setDoorRevealed(s, 1, 1, 'E', 0, true)).toBe(s);
  });

  it('`roomPortals` : aucun accès par une secrète masquée ; `door-closed` une fois révélée', () => {
    const kinds = (s: Scene) => roomPortals(s).filter((p) => !p.exterior).map((p) => p.kind);
    expect(kinds(deuxPieces(SECRETE))).toEqual([]);
    expect(kinds(revelee(deuxPieces(SECRETE)))).toEqual(['door-closed', 'door-closed']);
  });
});

describe('porte secrète — effet `setDoor { revealed }`', () => {
  it('révèle, puis applique `open` s’il est posé', () => {
    useGame.setState({ scene: deuxPieces(SECRETE) });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setDoor', x: 1, y: 1, side: 'E', revealed: true, open: true }] as Effect[]);
    const s = useGame.getState().scene!;
    expect(porteEnJeu(s, SECRETE)).toBe(true);
    expect(wallIsOpen(s, SECRETE)).toBe(true);
  });

  it('`open` seul sur une secrète masquée ne fait rien', () => {
    const avant = deuxPieces(SECRETE);
    useGame.setState({ scene: avant });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setDoor', x: 1, y: 1, side: 'E', open: true }] as Effect[]);
    expect(useGame.getState().scene).toBe(avant);
  });
});

describe('porte secrète — enrôlement de sa Structure au combat (AA 10 l.94-102)', () => {
  /** Lance un combat sur la fixture munie d'une porte secrète portant une Structure. */
  function structuresEnrolees(reveler: boolean): number {
    const s = structuredClone(testScene());
    s.walls = [{ x: 2, y: 2, side: 'E', door: true, closed: true, secret: SECRET, structure: 'solide-porte-en-bois' }];
    useGame.getState().seedRng(1);
    useGame.setState({ party: [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 })] });
    useGame.getState().startScene(reveler ? setDoorRevealed(s, 2, 2, 'E', 0, true) : s);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    return useGame.getState().battle!.combatants.filter((c) => c.bodyShape === 'structure').length;
  }

  it('masquée : pas de Combattant-structure ; révélée : enrôlée', () => {
    expect(structuresEnrolees(false)).toBe(0);
    expect(structuresEnrolees(true)).toBe(1);
  });
});

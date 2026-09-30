import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene, type Scene, type Terrain, type WallSeg } from './scene';
import { wallSegSchema } from '../data/schemas/defs-scenes/scene';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { placeCombatant } from './spawn';
import { testScene } from '../scenes/test-fixture';
import { avanceEtapeCascade } from './cascadeTestKit';
import { planFranchissement, defautDeSuspension, phaseDeChute } from './fallMove';
import { scenePlanDefects } from './planDefects';
import { buildScene } from './mapSpec';
import { patchWall } from './sceneEdit';
import { setRule, resetRule } from '../engine/policy';

/**
 * Se SUSPENDRE d'abord à la croisée (EDO 01 l.231) : `WallSeg.suspendu` = hauteur de chute de qui se
 * suspend, offerte par `planFranchissement` seulement sous la hauteur réelle ; axe HAUTEUR de chaque
 * rangée (`suspendre`), indépendant du Test (LDB 15 l.82) ; coûts en combat : l'allège de la croisée
 * (maison `fenetre-hauteur-allege`) et la hauteur descendue en se suspendant (maison `fenetre-suspension`, LDB 15 l.55,
 * LDB 15 l.57).
 */

const g = () => useGame.getState();
const chambre = { x: 1, y: 1, z: 1 };
const rue = { x: 2, y: 1 };

/** 4×3 : la chambre (1,1) à la couche 1 (4 m), murée sur trois côtés ; croisée E de (1,1) couche 1 sur
 *  la rue (2,1) au rez, franchissable, `suspendu` posé si fourni. */
function etage(suspendu?: number, murs: WallSeg[] = []): Scene {
  const s = emptyScene(4, 3);
  const tiles = new Array(12).fill('vide') as Terrain[];
  tiles[1 * 4 + 1] = s.layers[0].tiles[0];
  const height = new Array(12).fill(0) as number[];
  height[1 * 4 + 1] = 4;
  s.layers.push({ z: 1, tiles, height });
  s.walls = [
    { x: 1, y: 1, side: 'E', z: 1, window: true, crossable: true, ...(suspendu !== undefined ? { suspendu } : {}) },
    { x: 0, y: 1, side: 'E', z: 1 }, { x: 1, y: 1, side: 'N', z: 1 }, { x: 1, y: 2, side: 'N', z: 1 },
    ...murs,
  ];
  return s;
}

/** 4×3 de plain-pied : croisée franchissable E de (1,1) sur (2,1). */
function plainPied(suspendu: number): Scene {
  const s = emptyScene(4, 3);
  s.walls = [{ x: 1, y: 1, side: 'E', window: true, crossable: true, suspendu }];
  return s;
}

/** DRAINE la séquence et rend chaque 1d10 de chute joué à la porte : tombant → mètres. */
function drainerChutes(): Map<string | undefined, unknown> {
  const vues = new Map<string | undefined, unknown>();
  for (let i = 0; i < 50 && g().pendingCascade; i++) {
    const p = g().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur?.kind === 'chuteDe') vues.set(cur.actorId, cur.meta?.chuteMetres);
    avanceEtapeCascade(g);
  }
  return vues;
}

/** Ce que le joueur lit : le journal hors combat, la bannière de refus en combat (`refuserGeste`). */
const journalise = (): string => {
  const s = g() as unknown as { journal?: unknown[]; refus?: { texte: string } | null };
  return JSON.stringify(s.journal ?? []) + (s.refus?.texte ?? '');
};

describe('donnée : `WallSeg.suspendu`, sœur plate de `crossable`', () => {
  it('refusée au parse sans `crossable`, admise avec', () => {
    const r = wallSegSchema.safeParse({ x: 1, y: 1, side: 'E', window: true, suspendu: 2 });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['suspendu', 'hauteur de suspension (`suspendu`) sans `crossable: true` — on ne se suspend qu’à une croisée franchissable'],
    ]);
    expect(wallSegSchema.safeParse({ x: 1, y: 1, side: 'E', window: true, crossable: true, suspendu: 2 }).success).toBe(true);
  });

  it('muette sur une cloison oblique', () => {
    const r = wallSegSchema.safeParse({ x: 1, y: 1, side: '/', window: true, crossable: true, suspendu: 2 });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join('.'))).toContain('suspendu');
  });

  it('MapSpec → Scene : la hauteur voyage ; sans `crossable`, `buildScene` refuse', () => {
    const s = buildScene({ id: 't', label: 't', size: [3, 3], walls: [{ x: 1, y: 1, side: 'E', window: true, crossable: true, suspendu: 2 }] });
    expect(s.walls?.find((w) => w.x === 1 && w.y === 1 && w.side === 'E')).toMatchObject({ window: true, crossable: true, suspendu: 2 });
    expect(() => buildScene({ id: 't', label: 't', size: [3, 3], walls: [{ x: 1, y: 1, side: 'E', window: true, suspendu: 2 }] }))
      .toThrow('hauteur de suspension (`suspendu`) sans `crossable: true`');
  });

  it('`normWall` : décocher « Franchissable » purge la hauteur de suspension', () => {
    const apres = patchWall(plainPied(1), 1, 1, 'E', 0, { crossable: undefined });
    expect(apres.walls).toEqual([{ x: 1, y: 1, side: 'E', window: true }]);
  });
});

describe('planificateur : la suspension n’est offerte que sous la hauteur réelle', () => {
  it('croisée d’étage (4 m), suspendu 2 → offerte, saut PAR une croisée', () => {
    expect(planFranchissement(etage(2), chambre, rue)).toEqual({ kind: 'fall', metres: 4, to: { x: 2, y: 1, z: 0 }, suspendu: 2, croisee: true });
    expect(defautDeSuspension(etage(2), chambre, rue)).toBeUndefined();
  });

  it('NEUTRALISATION : suspendu ≥ hauteur réelle → aucun axe hauteur, défaut d’auteur `trop-haute`', () => {
    expect(planFranchissement(etage(4), chambre, rue)).toEqual({ kind: 'fall', metres: 4, to: { x: 2, y: 1, z: 0 }, croisee: true });
    expect(defautDeSuspension(etage(4), chambre, rue)).toBe('trop-haute');
  });

  it('croisée de plain-pied portant `suspendu` → on l’enjambe, défaut `plain-pied`', () => {
    expect(planFranchissement(plainPied(1), { x: 1, y: 1 }, rue)).toEqual({ kind: 'enjamber', to: { x: 2, y: 1, z: 0 } });
    expect(defautDeSuspension(plainPied(1), { x: 1, y: 1 }, rue)).toBe('plain-pied');
  });

  it('segments divergents sur le pas → aucun choix implicite : rien d’offert, défaut `divergente`', () => {
    const sc = etage(2, [{ x: 1, y: 1, side: 'E', z: 1, window: true, crossable: true, suspendu: 3 }]);
    expect(planFranchissement(sc, chambre, rue)).toEqual({ kind: 'fall', metres: 4, to: { x: 2, y: 1, z: 0 }, croisee: true });
    expect(defautDeSuspension(sc, chambre, rue)).toBe('divergente');
  });

  it('`planDefects` : la hauteur jamais offerte remonte à l’auteur, à l’arête ; la hauteur valable, non', () => {
    const fautifs = scenePlanDefects(etage(4)).filter((d) => d.family === 'suspension-hors-saut');
    expect(fautifs.map((d) => d.at)).toEqual([{ kind: 'edge', x: 1, y: 1, side: 'E', z: 1 }]);
    expect(fautifs[0].message).toContain('pas inférieure à la hauteur réelle');
    expect(scenePlanDefects(plainPied(1)).filter((d) => d.family === 'suspension-hors-saut').map((d) => d.message))
      .toEqual([expect.stringContaining('de plain-pied')]);
    expect(scenePlanDefects(etage(2)).filter((d) => d.family === 'suspension-hors-saut')).toEqual([]);
  });
});

describe('exploration : chaque tombant déclare SA hauteur', () => {
  let A = '';
  let B = '';
  beforeEach(() => {
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    A = a.id;
    B = b.id;
    useGame.setState({ battle: null, party: [a, b], mode: 'exploration', partyPos: chambre, scene: etage(2), pendingFall: null, pendingCascade: null, flags: {} });
  });

  it('l’étape offre l’axe : `suspendu` porté, chaque rangée non déclarée sur ses DEUX axes', () => {
    g().fallAcross(chambre, rue);
    const p = g().pendingFall!;
    expect(p).toMatchObject({ metres: 4, suspendu: 2, croisee: true });
    expect(p.participants.map((x) => [x.attempt, x.suspendre])).toEqual([[null, null], [null, null]]);
    expect(phaseDeChute(p)).toBe('choice');
  });

  it('axe hauteur manquant alors qu’il est offert → refus NOMMÉ, rangée non déclarée', () => {
    g().fallAcross(chambre, rue);
    g().fallChoose(A, false);
    expect(g().pendingFall!.participants.find((x) => x.id === A)!.attempt).toBeNull();
    expect(journalise()).toMatch(/se suspendre ou non se déclare avec le saut/);
  });

  it('A se suspend (chute de 2 m), B saute de toute la hauteur (4 m)', () => {
    g().fallAcross(chambre, rue);
    g().fallChoose(A, false, true);
    g().fallChoose(B, false, false);
    expect(g().pendingFall).toBeNull();
    expect(g().partyPos).toEqual({ x: 2, y: 1, z: 0 });
    const chutes = drainerChutes();
    expect(chutes.get(A), 'A s’est suspendu').toBe(2);
    expect(chutes.get(B), 'B a sauté').toBe(4);
  });

  it('se suspendre PUIS tenter : le Test réduit la hauteur de suspension (LDB 15 l.82)', () => {
    g().fallAcross(chambre, rue);
    g().fallChoose(A, true, true);
    g().fallChoose(B, false, false);
    expect(phaseDeChute(g().pendingFall!)).toBe('roll');
    g().fallRoll(A);
    const r = g().pendingFall!.participants.find((x) => x.id === A)!.result!;
    expect(r.effectiveMetres).toBe(Math.max(0, 2 - Math.max(0, r.dr)));
  });
});

describe('combat : l’allège et la hauteur descendue en se suspendant se paient en Mouvement', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('fenetre-suspension'); });

  function setup(movementUsed = 0) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    g().startScene(testScene());
    g().startCombat('enc-mutants');
    g().confirmRoundStart();
    vi.clearAllTimers();
    const sc = etage(2);
    const b = g().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, chambre);
    useGame.setState({ scene: sc, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H };
  }

  it('saut par une croisée, sans suspension : le pas + l’allège (1 m à ½ vitesse, 2 m/case → 1)', () => {
    const { H } = setup();
    g().fallAcross(chambre, rue);
    g().fallChoose(H.id, false, false);
    const b = g().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.movementUsed).toBe(2);
  });

  it('en se suspendant (`descente-facile`) : + la hauteur descendue (4 − 2 = 2 m à ½ vitesse → 2 cases)', () => {
    const { H } = setup();
    g().fallAcross(chambre, rue);
    g().fallChoose(H.id, false, true);
    expect(g().battle!.movementUsed).toBe(4);
    expect(g().battle!.acted).toBe(false);
  });

  it('Mouvement restant qui ne couvre pas la suspension → refus NOMMÉ à la déclaration, rien ne bouge', () => {
    const { H } = setup(1); // Marche 4 − 1 = 3 < 4
    g().fallAcross(chambre, rue);
    g().fallChoose(H.id, false, true);
    expect(g().pendingFall!.participants[0].attempt).toBeNull();
    expect(g().battle!.movementUsed).toBe(1);
    expect(journalise()).toMatch(/plus assez de Mouvement pour se suspendre avant de sauter \(4 cases\)/);
  });

  it('Mouvement restant qui ne couvre pas l’allège → refus NOMMÉ au geste, aucune modale', () => {
    setup(3); // Marche 4 − 3 = 1 < 2
    g().fallAcross(chambre, rue);
    expect(g().pendingFall).toBeNull();
    expect(journalise()).toMatch(/plus assez de Mouvement pour sauter par la fenêtre \(2 cases\)/);
  });

  it('mode `libre` : la suspension ne coûte rien de plus que le pas et l’allège', () => {
    setRule('fenetre-suspension', 'libre');
    const { H } = setup();
    g().fallAcross(chambre, rue);
    g().fallChoose(H.id, false, true);
    expect(g().battle!.movementUsed).toBe(2);
  });
});

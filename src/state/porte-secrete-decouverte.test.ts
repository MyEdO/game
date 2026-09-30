import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { porteEnJeu, porteMasquee, porteTentee, setDoorRevealed, setDoorTentee, type Scene, type WallSeg } from './scene';
import { buildScene, type WallSpec } from './mapSpec';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { evalCondition } from '../engine/flowCore';
import { resetRule, setRule } from '../engine/policy';
import { placeCombatant } from './spawn';
import { testScene } from '../scenes/test-fixture';
import { setDoorSchema } from '../data/schemas/defs-scenes/effets';
import { idDeTriggerDePorte, triggersDePortesSecretes } from './decouvertePorteSecrete';
import { t } from '../i18n';

/**
 * DÉCOUVRIR une porte secrète à l'APPROCHE (#700) — `EDO 08 l.402`, `EDO 07 l.263`, `LDB 09 l.399`,
 * `LDB 12 l.189` : zone de la face découvrable, en vue du groupe, une tentative par porte, hors combat.
 */

/** 10×5 de plain-pied, cloison E de x=5 ; porte secrète E de (5,2), découvrable côté porteur (ouest). */
const PLAN = [
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
].join('\n');
const PORTE = { x: 5, y: 2, side: 'E', door: true, secret: { difficulty: 'complexe', face: 'porteuse' } } as const;

function plan(opts: { id?: string; face?: 'porteuse' | 'voisine' | 'les-deux'; lateral?: boolean } = {}): Scene {
  const cloison: WallSpec[] = [0, 1, 3, 4].map((y) => ({ x: 5, y, side: 'E' }));
  // Mur LATÉRAL : arête N de (2..5,1) — coupe la vue de la rangée y=0 vers la porte.
  const lateral: WallSpec[] = opts.lateral ? [2, 3, 4, 5].map((x) => ({ x, y: 1, side: 'N' })) : [];
  return buildScene({
    id: opts.id ?? 'cave', label: 'Cave', size: [10, 5], terrain: 'pierre', ambiance: 'interieur', levels: { z0: PLAN },
    walls: [...cloison, ...lateral, { ...PORTE, secret: { ...PORTE.secret, face: opts.face ?? 'porteuse' } }],
  });
}

const seg = (): WallSeg => useGame.getState().scene!.walls!.find((w) => w.x === 5 && w.y === 2)!;
/** Deux héros formés en Perception (le Soutien l'exige, `LDB 12 l.195`) ; `aveugles` : ni lumière portée
 *  ni Vision nocturne (le noir de la scène est alors total pour eux). */
const heros = (aveugles = false) => ['A', 'B'].map((label, i) => {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: i + 1 });
  return {
    ...h,
    skills: [...h.skills.filter((s) => s.id !== 'perception'), { id: 'perception', characteristic: 'initiative' as const, advances: 5 }],
    ...(aveugles ? { items: [], weapons: [], activeEffects: [], talents: h.talents.filter((t) => t.talentId !== 'vision-nocturne') } : {}),
  };
});

/** Exploration sur `scene`, groupe en `pos`, lumière pleine (ou noire, sans lumière portée). */
function explorer(scene: Scene, pos: { x: number; y: number }, lightLevel = 1) {
  useGame.setState({ party: heros(lightLevel === 0) });
  useGame.getState().startScene(scene);
  useGame.setState({ partyPos: pos, lightLevel });
}
const marcher = (x: number, y: number) => useGame.getState().moveParty({ x, y });

describe('porte secrète — découverte à l’approche', () => {
  afterEach(() => resetRule('porte-secrete-rayon-m'));

  it('entrer dans la zone de la face → Test de Perception à la difficulté de la porte, Soutien, marque posée AVANT le dé', () => {
    explorer(plan(), { x: 2, y: 2 });
    marcher(3, 2); // hors zone (2 cases à 2 m : x 4..5)
    expect(useGame.getState().pendingTest).toBeNull();
    marcher(4, 2);
    const pt = useGame.getState().pendingTest!;
    expect(pt.skillId).toBe('perception');
    expect(pt.difficulty).toBe('complexe');
    expect(pt.label).toBe(t('eff.porteSecreteTest'));
    expect(pt.support?.bonus).toBeGreaterThan(0); // LDB 12 l.189
    expect(pt.roll).toBeNull();
    expect(useGame.getState().pendingCascade!.participants[0].stake?.key).toEqual({ dataset: 'flow', kind: 'perception-detect' });
    expect(porteTentee(useGame.getState().scene!, seg())).toBe(true);
  });

  it('réussite → porte révélée (`porteEnJeu`) et ligne de journal neutre', () => {
    explorer(plan(), { x: 3, y: 2 });
    marcher(4, 2);
    expect(useGame.getState().pendingTest?.skillId).toBe('perception');
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 1, success: true, sl: 3 } });
    useGame.getState().resolveTest();
    expect(porteEnJeu(useGame.getState().scene!, seg())).toBe(true);
    expect(useGame.getState().journal).toContain(t('eff.porteSecreteTrouvee'));
  });

  it('échec → porte masquée ; ressortir et revenir ne relance rien (une tentative par porte)', () => {
    explorer(plan(), { x: 3, y: 2 });
    marcher(4, 2);
    expect(useGame.getState().pendingTest?.skillId).toBe('perception');
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 99, success: false, sl: -3 } });
    useGame.getState().resolveTest();
    expect(porteMasquee(useGame.getState().scene!, seg())).toBe(true);
    expect(useGame.getState().pendingTest).toBeNull();
    marcher(3, 2);
    marcher(4, 2);
    expect(useGame.getState().pendingTest).toBeNull();
  });

  it('face opposée → rien ; la même approche lance le Test quand la face est `voisine`', () => {
    explorer(plan({ face: 'porteuse' }), { x: 8, y: 2 });
    marcher(7, 2);
    marcher(6, 2);
    expect(useGame.getState().pendingTest).toBeNull();
    expect(porteTentee(useGame.getState().scene!, seg())).toBe(false);
    explorer(plan({ face: 'voisine' }), { x: 8, y: 2 });
    marcher(7, 2);
    marcher(6, 2);
    expect(useGame.getState().pendingTest?.skillId).toBe('perception');
  });

  it('zone hors vue : le noir, ou un mur latéral → rien ; la même case vue lance le Test', () => {
    explorer(plan(), { x: 3, y: 2 }, 0);
    marcher(4, 2);
    expect(useGame.getState().pendingTest).toBeNull();
    expect(porteTentee(useGame.getState().scene!, seg())).toBe(false);

    setRule('porte-secrete-rayon-m', 8); // 4 cases : x 2..5
    explorer(plan({ lateral: true }), { x: 1, y: 0 });
    marcher(2, 0);
    expect(useGame.getState().pendingTest).toBeNull();
    explorer(plan(), { x: 1, y: 0 });
    marcher(2, 0);
    expect(useGame.getState().pendingTest?.skillId).toBe('perception');
  });

  it('entrée de scène DANS la zone, sans premier pas → pas de Test', () => {
    const s = plan();
    s.entities.push({ id: 'depart', kind: 'heroStart', pos: { x: 4, y: 2 } } as Scene['entities'][number]);
    useGame.setState({ party: heros() });
    useGame.getState().startScene(s);
    useGame.setState({ lightLevel: 1 });
    expect(useGame.getState().partyPos).toMatchObject({ x: 4, y: 2 });
    expect(useGame.getState().pendingTest).toBeNull();
    expect(porteTentee(useGame.getState().scene!, seg())).toBe(false);
  });
});

describe('porte secrète — combat : aucune découverte', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('un pas de combat dans la zone ne lance rien', () => {
    useGame.setState({ party: [heros()[0]] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const sc = plan();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, { x: 3, y: 2 });
    useGame.setState({
      scene: sc, lightLevel: 1,
      battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null },
    });
    useGame.getState().battleClickTile({ x: 4, y: 2 }, { confirm: true });
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 4, y: 2 });
    expect(useGame.getState().pendingTest).toBeNull();
    expect(porteTentee(useGame.getState().scene!, seg())).toBe(false);
  });
});

describe('porte secrète — Triggers dérivés (pur)', () => {
  const tout = () => new Set(Array.from({ length: 50 }, (_, i) => `${i % 10},${Math.floor(i / 10)},0`));

  it('un Trigger par porte à découvrir, zone = face découvrable à ≤ 2 cases, étage de l’arête', () => {
    expect(triggersDePortesSecretes(plan(), tout).map((x) => x.rect)).toEqual([{ x: 4, y: 1, w: 2, h: 3, z: 0 }]);
    expect(triggersDePortesSecretes(plan({ face: 'voisine' }), tout).map((x) => x.rect)).toEqual([{ x: 6, y: 1, w: 2, h: 3, z: 0 }]);
    expect(triggersDePortesSecretes(plan({ face: 'les-deux' }), tout).map((x) => x.rect)).toEqual([{ x: 4, y: 1, w: 4, h: 3, z: 0 }]);
  });

  it('porte révélée ou tentée → plus de Trigger dérivé', () => {
    expect(triggersDePortesSecretes(setDoorRevealed(plan(), 5, 2, 'E', 0, true), tout)).toEqual([]);
    expect(triggersDePortesSecretes(setDoorTentee(plan(), 5, 2, 'E', 0, true), tout)).toEqual([]);
  });

  it('id stable SANS virgule pour une `scene.id` arbitraire ; sa garde de drapeau se lit en UN terme', () => {
    const id = idDeTriggerDePorte({ id: 'cave, nord !x' }, { x: 5, y: 2, side: 'E' });
    expect(id).not.toContain(',');
    expect(id).toBe(idDeTriggerDePorte({ id: 'cave, nord !x' }, { x: 5, y: 2, side: 'E' }));
    expect(evalCondition({ kind: 'flag', expr: `!__trigger_${id}` }, { flags: {} } as never)).toBe(true);
    expect(evalCondition({ kind: 'flag', expr: `!__trigger_${id}` }, { flags: { [`__trigger_${id}`]: true } } as never)).toBe(false);
    expect(triggersDePortesSecretes(plan({ id: 'cave, nord' }), tout)[0].id).toBe(idDeTriggerDePorte({ id: 'cave, nord' }, { x: 5, y: 2, side: 'E' }));
  });

  it('`setDoor` : `attempted` seul est un Effet valide ; aucun champ → refusé', () => {
    expect(setDoorSchema.safeParse({ type: 'setDoor', x: 0, y: 0, side: 'N', attempted: true }).success).toBe(true);
    expect(setDoorSchema.safeParse({ type: 'setDoor', x: 0, y: 0, side: 'N' }).success).toBe(false);
  });
});

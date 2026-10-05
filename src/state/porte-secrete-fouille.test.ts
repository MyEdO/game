import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { porteEnJeu, porteMasquee, porteTentee, type Scene, type WallSeg } from './scene';
import { buildScene, type WallSpec } from './mapSpec';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { rule, setRule, resetRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import { t } from '../i18n';

/**
 * FOUILLER LA PIÈCE (#700) — second déclencheur de la découverte d'une porte secrète : `EDO 08 l.402`,
 * `LDB 12 l.189`, `LDB 12 l.200` ; une tentative par porte, quel que soit le déclencheur, hors combat.
 */

/** 10×5 de plain-pied ; pièce intérieure `cave` = colonnes 0..5 ; cloison E de x=5.
 *   A = porte E de (5,2), face porteuse (dans la pièce), Complexe
 *   B = porte E de (5,0), face porteuse (dans la pièce), Difficile
 *   C = porte E de (5,4), face VOISINE (6,4 : hors de la pièce), Facile */
const PLAN = [
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
].join('\n');
type Porte = WallSpec & { secret: { difficulty: string; face: 'porteuse' | 'voisine' | 'les-deux' } };
const A: Porte = { x: 5, y: 2, side: 'E', door: true, secret: { difficulty: 'complexe', face: 'porteuse' } };
const B: Porte = { x: 5, y: 0, side: 'E', door: true, secret: { difficulty: 'difficile', face: 'porteuse' } };
const C: Porte = { x: 5, y: 4, side: 'E', door: true, secret: { difficulty: 'facile', face: 'voisine' } };

function plan(portes: Porte[]): Scene {
  const pleines: WallSpec[] = [0, 1, 2, 3, 4].filter((y) => !portes.some((p) => p.y === y)).map((y) => ({ x: 5, y, side: 'E' }));
  const s = buildScene({
    id: 'cave', label: 'Cave', size: [10, 5], terrain: 'pierre', ambiance: 'interieur', levels: { z0: PLAN },
    walls: [...pleines, ...portes] as WallSpec[],
  });
  s.effectZones = [{ id: 'cave', label: 'Cave', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 6, h: 5 }, z: 0 }];
  return s;
}

const seg = (p: Porte): WallSeg => useGame.getState().scene!.walls!.find((w) => w.x === p.x && w.y === p.y && w.side === p.side)!;
/** Deux héros formés en Perception (le Soutien l'exige, `LDB 12 l.195`). */
const heros = () => ['A', 'B'].map((label, i) => {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: i + 1 });
  return { ...h, skills: [...h.skills.filter((s) => s.id !== 'perception'), { id: 'perception', characteristic: 'initiative' as const, advances: 5 }] };
});

function explorer(scene: Scene, pos: { x: number; y: number }) {
  useGame.setState({ party: heros() });
  useGame.getState().startScene(scene);
  useGame.setState({ partyPos: pos, lightLevel: 1, dialogue: null });
}
const fouiller = () => useGame.getState().fouillerLaPiece();
/** Durée de la fouille : la maison `fouille-piece-minutes` (LDB 12 l.200). */
const DUREE = rule('fouille-piece-minutes') as number;
const resoudre = (success: boolean) => {
  useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: success ? 1 : 99, success, sl: success ? 3 : -3 } });
  useGame.getState().resolveTest();
};

describe('Fouiller la pièce — le second déclencheur de la découverte', () => {
  it('une porte à découvrir → Test de Perception à SA difficulté, Soutien ; réussite → porte en jeu', () => {
    explorer(plan([A]), { x: 1, y: 2 });
    fouiller();
    const pt = useGame.getState().pendingTest!;
    expect(pt.skillId).toBe('perception');
    expect(pt.difficulty).toBe('complexe');
    expect(pt.label).toBe(t('eff.porteSecreteTest'));
    expect(pt.support?.bonus).toBeGreaterThan(0); // LDB 12 l.189
    expect(porteTentee(useGame.getState().scene!, seg(A))).toBe(true);
    resoudre(true);
    expect(porteEnJeu(useGame.getState().scene!, seg(A))).toBe(true);
    expect(useGame.getState().journal).toContain(t('eff.porteSecreteTrouvee'));
  });

  it('échec → re-Fouiller ne relance rien, et l’horloge avance quand même', () => {
    explorer(plan([A]), { x: 1, y: 2 });
    fouiller();
    resoudre(false);
    expect(porteMasquee(useGame.getState().scene!, seg(A))).toBe(true);
    const avant = useGame.getState().gameTime;
    fouiller();
    expect(useGame.getState().pendingTest).toBeNull();
    expect(useGame.getState().gameTime).toBe(avant + DUREE);
    expect(useGame.getState().journal.slice(-1)[0]).toBe(t('fouille.journal'));
  });

  it('deux portes → deux Tests en séquence, chacun sa difficulté ; l’horloge avance UNE fois', () => {
    explorer(plan([A, B]), { x: 1, y: 2 });
    const avant = useGame.getState().gameTime;
    fouiller();
    expect(useGame.getState().gameTime).toBe(avant + DUREE);
    const difficultes = [useGame.getState().pendingTest!.difficulty];
    resoudre(false);
    difficultes.push(useGame.getState().pendingTest!.difficulty);
    resoudre(false);
    expect(difficultes.sort()).toEqual(['complexe', 'difficile']);
    expect(useGame.getState().pendingTest).toBeNull();
    expect(useGame.getState().gameTime).toBe(avant + DUREE);
  });

  it('porte déjà tentée à l’approche → Fouiller ne la reprend pas', () => {
    explorer(plan([A]), { x: 3, y: 2 });
    useGame.getState().moveParty({ x: 4, y: 2 }); // zone d'approche de A
    expect(useGame.getState().pendingTest?.difficulty).toBe('complexe');
    resoudre(false);
    fouiller();
    expect(useGame.getState().pendingTest).toBeNull();
  });

  it('face découvrable hors de la pièce → aucun Test ; même ligne de journal, même temps', () => {
    explorer(plan([C]), { x: 1, y: 2 });
    const avant = useGame.getState().gameTime;
    fouiller();
    expect(useGame.getState().pendingTest).toBeNull();
    expect(porteTentee(useGame.getState().scene!, seg(C))).toBe(false);
    expect(useGame.getState().journal.slice(-1)[0]).toBe(t('fouille.journal'));
    expect(useGame.getState().gameTime).toBe(avant + DUREE);
  });

  it('la fouille avance l’horloge de la durée maison ; un réglage modifié change le coût', () => {
    explorer(plan([C]), { x: 1, y: 2 });
    expect(DUREE).toBe(10);
    const avant = useGame.getState().gameTime;
    fouiller();
    expect(useGame.getState().gameTime).toBe(avant + 10);
    try {
      setRule('fouille-piece-minutes', 45);
      fouiller();
      expect(useGame.getState().gameTime).toBe(avant + 10 + 45);
    } finally {
      resetRule('fouille-piece-minutes');
    }
  });

  it('hors de toute pièce → refus nommé, ni Test ni temps', () => {
    explorer(plan([A]), { x: 8, y: 2 });
    const avant = useGame.getState().gameTime;
    fouiller();
    expect(useGame.getState().pendingTest).toBeNull();
    expect(useGame.getState().journal.slice(-1)[0]).toBe(t('fouille.refus.horsPiece'));
    expect(useGame.getState().gameTime).toBe(avant);
  });

  it('en dialogue → refus nommé', () => {
    explorer(plan([A]), { x: 1, y: 2 });
    useGame.setState({ dialogue: { entityId: 'x', nodeId: 'n' } as never });
    fouiller();
    expect(useGame.getState().pendingTest).toBeNull();
    expect(useGame.getState().journal.slice(-1)[0]).toBe(t('geste.refus.dialogue'));
  });
});

describe('Fouiller la pièce — combat : refus nommé', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('en combat, le geste est refusé À L’ÉCRAN et ne lance rien', () => {
    useGame.setState({ party: [heros()[0]] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
    useGame.setState({ scene: plan([A]), partyPos: { x: 1, y: 2 }, refus: null });
    fouiller();
    expect(useGame.getState().refus?.texte).toBe(t('fouille.refus.horsExploration'));
    expect(useGame.getState().pendingTest).toBeNull();
    expect(porteTentee(useGame.getState().scene!, seg(A))).toBe(false);
  });
});

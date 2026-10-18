/**
 * Les SPÉCIAUX d'un jeu de taverne au FLUX (NADJ 16 l.82) : figés à l'ouverture par siège, ils règlent
 * la Difficulté des Tests du SEUL joueur qui a le Talent — jamais celle de son vis-à-vis.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { datasetArray, setDataset } from '../data/overrides';
import { DIFFICULTY_LABELS, type Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';
import type { TavernPayload } from './tavernFlow';

const get = useGame.getState.bind(useGame);

/** Un pré-tiré, avec ou sans Tireur d'élite. */
function heros(rang: number, tireur: boolean): Combatant {
  const h = makePregens()[rang] as Combatant;
  const autres = (h.talents ?? []).filter((t) => t.talentId !== 'tireur-d-elite');
  return { ...h, talents: tireur ? [...autres, { talentId: 'tireur-d-elite', times: 1 }] : autres };
}

const courant = (): CascadeStep | undefined => {
  const pc = get().pendingCascade;
  return pc?.participants[pc.cursor];
};

/** Tranche le choix de ligne visée ouvert, et le commit. */
function vise(cle: string): void {
  const cur = courant();
  expect(cur?.kind, 'la ligne visée est à choisir').toBe('tavern-throw-aim');
  get().cascadeChoose(cur!.id, cle);
  get().cascadeNext();
}

/** Le lancer ouvert. */
function lancer(): CascadeStep {
  const band = get().pendingCascade!.participants.find((s) => s.kind === 'tavern-throw');
  expect(band, 'un lancer est ouvert').toBeDefined();
  return band!;
}

/** Pose un lancer raté sur le lancer ouvert, puis le commit. */
function rate(): void {
  const pc = get().pendingCascade!;
  const idx = pc.participants.findIndex((s) => s.kind === 'tavern-throw');
  const band = pc.participants[idx];
  const row = band.participants![0];
  const participants = [...pc.participants];
  participants[idx] = { ...band, participants: [{ ...row, result: { roll: 99, target: row.target!, sl: -5, success: false } }] };
  useGame.setState({ pendingCascade: { ...pc, participants, cursor: idx } });
  get().cascadeNext();
}

/** Le libellé de l'option « Cornes » (rang 2) du choix de ligne ouvert. */
const optionCornes = (): string | undefined => courant()?.options?.find((o) => o.key === '2')?.label;

beforeEach(() => {
  seedBattleRng(5);
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null, pendingCascade: null, sequence: null });
});
afterEach(() => {
  useGame.setState({ sequence: null, pendingCascade: null, tavernGames: null });
});

describe('L’Arène — Tireur d’élite, « un cran plus facile » (NADJ 16 l.82)', () => {
  it('les Cornes passent à Facile pour le tireur, et restent Accessibles pour son vis-à-vis', () => {
    const a = heros(0, true);
    const b = heros(1, false);
    useGame.setState({ party: [a, b] });
    get().playTavernGame({ gameId: 'arene', challengerId: a.id, opponent: { kind: 'hero', id: b.id } });
    expect((get().sequence!.payload as TavernPayload).specials, 'figés à l’ouverture, au seul siège qui a le Talent')
      .toEqual({ [a.id]: [expect.objectContaining({ effet: 'cran', hasTalent: 'tireur-d-elite', steps: 1 })] });

    expect(optionCornes(), 'le choix le DIT').toContain(DIFFICULTY_LABELS.facile);
    vise('2');
    expect(lancer().participants![0].difficulty).toBe('facile');
    rate();
    for (let i = 1; i < 5; i++) { vise('0'); rate(); }

    expect(courant()?.actorId, 'le passage du vis-à-vis').toBe(b.id);
    expect(optionCornes()).toContain(DIFFICULTY_LABELS.accessible);
    vise('2');
    expect(lancer().participants![0].difficulty).toBe('accessible');
  });
});

describe('Manche opposée contre la salle — la Difficulté du challenger ne s’impose pas à l’habitué', () => {
  const avant = datasetArray('tavernGames').slice();
  afterEach(() => setDataset('tavernGames', avant));

  it('un Spécial posé aux Dominos (Codex) : le tireur joue Facile, l’habitué reste Accessible', () => {
    setDataset('tavernGames', avant.map((g) => (g.id === 'dominos'
      ? { ...g, specials: [{ effet: 'cran' as const, hasTalent: 'tireur-d-elite', steps: 1, source: { book: 'nuits-agitees-et-dures-journees', page: 94 } }] }
      : g)));
    const a = heros(0, true);
    useGame.setState({ party: [a] });
    get().playTavernGame({ gameId: 'dominos', challengerId: a.id, opponent: { kind: 'profil', id: 'humain' } });
    const etape = get().pendingCascade!.participants[0];
    expect(etape.difficulty, 'le challenger, un cran plus facile').toBe('facile');
    const aT = etape.meta!.opposed!.aT!;
    expect(aT.target - aT.base!, 'l’habitué : Accessible (+20), sans le Talent').toBe(20);
    expect(etape.meta!.opposed!.difficulty).toBe('accessible');
  });
});

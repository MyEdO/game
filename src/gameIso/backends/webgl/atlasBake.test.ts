/**
 * Contrat de la FILE CADENCÉE (#1176) : rien de synchrone, un plancher de service et un budget de
 * temps par tranche, priorité respectée — et relevable tant que la tâche attend —, jet synchrone d'une
 * tâche rendu en rejet.
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  bakeQueueLength,
  bakeSliceCount,
  BUDGET_TRANCHE_MS_DEFAUT,
  FRAMES_PAR_TRANCHE,
  PRIORITE_RECHAUFFAGE,
  PRIORITE_VUE_COURANTE,
  queueBakeTask,
  resetBakeQueue,
  setBudgetTrancheMs,
  type BakePriority,
} from './atlasBake';

afterEach(() => {
  setBudgetTrancheMs(BUDGET_TRANCHE_MS_DEFAUT);
  resetBakeQueue();
  vi.useRealTimers();
});

/** HYGIÈNE `isolate: false` : la file est un SINGLETON de module. Une tâche laissée en file par un test
 *  s'exécuterait au milieu du fichier de suite suivant (et sur ses faux timers). */
afterAll(() => {
  expect(bakeQueueLength()).toBe(0);
});

describe('file cadencée', () => {
  it('cadence : rien de synchrone, et au plus FRAMES_PAR_TRANCHE tâches par tranche sous budget nul', async () => {
    setBudgetTrancheMs(0);
    const servies: number[] = [];
    const tranches0 = bakeSliceCount();
    const p = Promise.all([0, 1, 2].map((k) => queueBakeTask(PRIORITE_RECHAUFFAGE, async () => { servies.push(k); })));
    expect(servies.length).toBe(0); // aucune tâche hors file
    await p;
    const tranches = bakeSliceCount() - tranches0;
    expect(servies).toEqual([0, 1, 2]);
    expect(servies.length).toBeLessThanOrEqual(tranches * FRAMES_PAR_TRANCHE);
  });

  it('BUDGET DE TRANCHE : des tâches BRÈVES se servent à plusieurs par tranche', async () => {
    const N = 8;
    const brèves = (): Promise<number[]> =>
      Promise.all(Array.from({ length: N }, () => queueBakeTask(PRIORITE_RECHAUFFAGE, async () => 1)));

    const t0 = bakeSliceCount();
    await brèves();
    const avecBudget = bakeSliceCount() - t0;
    expect(avecBudget, `${avecBudget} tranches pour ${N} tâches brèves : la file est en famine`).toBeLessThan(N);

    // …et la cadence STRICTE reste disponible (budget nul) : c'est l'instrument des bancs d'ORDRE.
    setBudgetTrancheMs(0);
    const t1 = bakeSliceCount();
    await brèves();
    expect(bakeSliceCount() - t1, 'budget nul : la tranche doit servir exactement `FRAMES_PAR_TRANCHE`')
      .toBeGreaterThanOrEqual(N / FRAMES_PAR_TRANCHE);
  });

  it('priorité : la vue courante passe devant le réchauffage déjà en file', async () => {
    vi.useFakeTimers();
    // CADENCE STRICTE : ce banc lit la file COUP PAR COUP — une tranche, une tâche.
    setBudgetTrancheMs(0);
    const servies: string[] = [];
    const tâche = (nom: string) => async () => { servies.push(nom); };
    const tard = queueBakeTask(PRIORITE_RECHAUFFAGE, tâche('tard'));
    const urgent = queueBakeTask(PRIORITE_VUE_COURANTE, tâche('urgent'));
    await vi.advanceTimersToNextTimerAsync();
    expect(servies).toEqual(['urgent']);
    await vi.advanceTimersToNextTimerAsync();
    expect(servies).toEqual(['urgent', 'tard']);
    await Promise.all([tard, urgent]);
  });

  it('priorité MUTABLE : une tâche en attente dont l’appelant relève la poignée REMONTE', async () => {
    vi.useFakeTimers();
    setBudgetTrancheMs(0);
    const servies: string[] = [];
    const poignée: BakePriority = { value: PRIORITE_RECHAUFFAGE };
    const a = queueBakeTask(PRIORITE_RECHAUFFAGE, async () => { servies.push('A'); });
    const b = queueBakeTask(poignée, async () => { servies.push('B'); });
    poignée.value = PRIORITE_VUE_COURANTE;
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();
    expect(servies).toEqual(['B', 'A']);
    await Promise.all([a, b]);
  });

  it('un JET synchrone de la tâche rejette sa promesse, sans s’échapper de la tranche', async () => {
    const p = queueBakeTask(PRIORITE_RECHAUFFAGE, () => { throw new Error('couture indisponible'); });
    await expect(p).rejects.toThrow('couture indisponible');
    await expect(queueBakeTask(PRIORITE_RECHAUFFAGE, async () => 'suivante')).resolves.toBe('suivante');
  });
});

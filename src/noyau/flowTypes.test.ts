import { describe, expect, it } from 'vitest';
import type { Jeu } from './etat';
import type { Get, PatchDeFlux, Set } from './flowTypes';

describe('Set des flux : journal hors du patch (#319, #2724)', () => {
  it('refuse journal, la recopie de l’état et un Partial<Jeu> brut', () => {
    const recus: unknown[] = [];
    const set: Set = (partial) => { recus.push(partial); };
    const brut: Partial<Jeu> = {};
    const patch: PatchDeFlux = { party: [] };

    // @ts-expect-error journal ne s'écrit pas par le patch d'un flux
    set({ journal: [] });
    // @ts-expect-error recopier l'état emporte journal
    set((s) => ({ ...s }));
    // @ts-expect-error Partial<Jeu> laisse journal ouvert
    set(brut);
    set(patch);

    expect(recus).toHaveLength(4);
  });
});

describe('Get et Set des flux : le noyau ne touche aucun champ ni aucune action d’adaptateur (#2817 D5)', () => {
  it('refuse la lecture, l’appel et l’écriture, littérale ou non, d’un membre d’interface', () => {
    const etat = { party: [] } as unknown as Jeu;
    const get: Get = () => etat;
    const recus: unknown[] = [];
    const set: Set = (partial) => { recus.push(partial); };

    // @ts-expect-error lecture d'un champ d'interface
    void get().zoom;
    // @ts-expect-error appel d'une action d'adaptateur
    void get().setScreen;
    // @ts-expect-error écriture littérale d'un champ d'interface
    set({ sheetId: null });
    // @ts-expect-error écriture par updater, mêlée à un champ de jeu
    set((s) => ({ camPan: { x: 0, y: 0 }, party: s.party }));
    const melange = { zoom: 2, party: [] as Jeu['party'] };
    // @ts-expect-error écriture par un patch non littéral, mêlée à un champ de jeu
    set(melange);
    set((s) => ({ party: s.party }));

    expect(recus).toHaveLength(4);
  });
});

/**
 * Échelle de durée `{scale:'adventure'}` (LDB 23 l.209/218/234 : « pour votre prochaine aventure ») —
 * posée à l'interlude, purgée à l'OUVERTURE de l'interlude SUIVANT (`purgeAdventureEffects`, seul
 * appelant `startInterlude`). Preuve via l'op `statusMod` (Réputation, LDB 23 l.228-234), composé par
 * `heroStatus`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { heroStatus } from './interludeFlow';
import { applyOps } from '../engine/ops';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { fromBrass } from '../engine/money';
import { creditBourse } from './bourseFlow';

describe('statusMod (LDB 23 l.228-234) — Standing temporaire « pour la prochaine aventure »', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    useGame.setState({ party: [a], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
    creditBourse(useGame.getState, useGame.setState, useGame.getState().party[0].id, fromBrass(1000));
  });

  it('0 excédent : sans capacité, Standing = base de Carrière (aucun effet actif)', () => {
    const h = useGame.getState().party[0];
    const base = heroStatus(h).standing;
    expect((h.activeEffects ?? []).some((e) => e.statusMod != null)).toBe(false);
    expect(heroStatus(h).standing).toBe(base);
  });

  it('cas nominal : +1 Standing (succès) se compose IMMÉDIATEMENT dans heroStatus', () => {
    const h = useGame.getState().party[0];
    const base = heroStatus(h).standing;
    applyOps(h, [{ op: 'statusMod', amount: 1 }], { label: 'Réputation' });
    expect(heroStatus(h).standing).toBe(base + 1);
  });

  it('Échec Stupéfiant : −1 Standing, jamais sous 1 (plancher Bronze 1)', () => {
    const h = useGame.getState().party[0];
    applyOps(h, [{ op: 'statusMod', amount: -99 }], { label: 'Basse flatterie' });
    expect(heroStatus(h).standing).toBe(1);
  });

  it("expiration adventure : purgé à l'OUVERTURE de l'interlude suivant (`startInterlude`), pas avant", () => {
    const h = useGame.getState().party[0];
    const base = heroStatus(h).standing;
    applyOps(h, [{ op: 'statusMod', amount: 2 }], { label: 'Réputation' });
    expect(heroStatus(useGame.getState().party[0]).standing).toBe(base + 2); // toujours actif CETTE aventure
    useGame.getState().startInterlude(1); // ouvre l'interlude → aventure précédente CLOSE → purge
    draineCascade(useGame.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    expect(heroStatus(useGame.getState().party[0]).standing).toBe(base);
    expect((useGame.getState().party[0].activeEffects ?? []).some((e) => e.statusMod != null)).toBe(false);
  });
});

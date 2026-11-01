/**
 * Échelle de durée `{scale:'adventure'}` (LDB 23 l.209/218/234 : « pour votre prochaine aventure ») —
 * posée à l'interlude, purgée à l'OUVERTURE de l'interlude SUIVANT (`purgeAdventureEffects`, seul
 * appelant `startInterlude`). Preuve via l'op `statusMod` (Réputation, LDB 23 l.228-234), composé par
 * `actorStatus`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { actorStatus } from '../engine/social';
import { applyOps } from '../engine/ops';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { fromBrass } from '../engine/money';
import { creditBourse } from './bourseFlow';
import { desDuTest } from '../engine/dice.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('statusMod (LDB 23 l.228-234) — Standing temporaire « pour la prochaine aventure »', () => {
  beforeEach(() => {
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [a], battle: null, interlude: null, bank: [], pendingOrders: [], journal: [] });
    banc.getState().startScene(testScene());
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, fromBrass(1000));
  });

  it('0 excédent : sans capacité, Standing = base de Carrière (aucun effet actif)', () => {
    const h = banc.getState().party[0];
    const base = actorStatus(h).standing;
    expect((h.activeEffects ?? []).some((e) => e.statusMod != null)).toBe(false);
    expect(actorStatus(h).standing).toBe(base);
  });

  it('cas nominal : +1 Standing (succès) se compose IMMÉDIATEMENT dans actorStatus', () => {
    const h = banc.getState().party[0];
    const base = actorStatus(h).standing;
    applyOps(h, [{ op: 'statusMod', amount: 1 }], { rng: desDuTest, label: 'Réputation' });
    expect(actorStatus(h).standing).toBe(base + 1);
  });

  it('Échec Stupéfiant : −1 Standing ; à 0, l’Échelon baisse et le Standing remonte à 5 (LDB 08 l.101)', () => {
    const h = banc.getState().party[0];
    expect(actorStatus(h), 'témoin : Soldat, Argent 1').toEqual({ tier: 'argent', standing: 1 });
    applyOps(h, [{ op: 'statusMod', amount: -1 }], { rng: desDuTest, label: 'Basse flatterie' });
    expect(actorStatus(h)).toEqual({ tier: 'bronze', standing: 5 });
  });

  it("expiration adventure : purgé à l'OUVERTURE de l'interlude suivant (`startInterlude`), pas avant", () => {
    const h = banc.getState().party[0];
    const base = actorStatus(h).standing;
    applyOps(h, [{ op: 'statusMod', amount: 2 }], { rng: desDuTest, label: 'Réputation' });
    expect(actorStatus(banc.getState().party[0]).standing).toBe(base + 2); // toujours actif CETTE aventure
    banc.getState().startInterlude(1); // ouvre l'interlude → aventure précédente CLOSE → purge
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    expect(actorStatus(banc.getState().party[0]).standing).toBe(base);
    expect((banc.getState().party[0].activeEffects ?? []).some((e) => e.statusMod != null)).toBe(false);
  });
});

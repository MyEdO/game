import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { herosDeScenario, groupeDeScenario } from '../scenes/test-scenarios/_heros';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Incantation HORS COMBAT (couture D, LDB 21/Magie) — RÉUTILISE le flux d'incantation existant
 * (pas de duplication) : `pendingCast` + jetLancer('incantation')/…/jetValider('incantation') + applyCast, rendus optionnels au
 * combat (acteurs résolus dans `battle?.combatants ?? party` ; sortie vers `journal` hors combat).
 * Les Projectiles magiques (offensifs) restent réservés au combat.
 */

function casterParty() {
  const [priest, ally] = groupeDeScenario(idsDeTest, 'pretre', 'soldat');
  // Garantit que le Prêtre peut tenter la Prière (Compétence avancée ≥ 1 avance, LDB 09).
  const priere = priest.skills.find((s) => s.id === 'priere');
  if (priere) priere.advances = Math.max(priere.advances, 5);
  else priest.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 });
  return { priest, ally, party: [priest, ally] as Combatant[] };
}

/** Force la réussite de l'incantation en attente (neutralise le d100 — usage légitime : Résilience). */
function forceCast(casterId: string) {
  const h = banc.getState().party.find((c) => c.id === casterId)!;
  if (!banc.getState().pendingCast!.result!.cast) {
    h.resilience = (h.resilience ?? 0) + 1;
    banc.getState().jetForcerLaReussite('incantation');
  }
}

describe('Incantation hors combat (couture D)', () => {
  beforeEach(() => {
    banc.getState().ensemencerLeTirage(7);
  });

  it('Prêtre lance « Bénédiction de Guérison » sur un allié blessé hors combat → +1 PB, journalisé, sans combat', () => {
    const { priest, ally, party } = casterParty();
    ally.wounds.current = ally.wounds.max - 3;
    banc.setState({ party });

    banc.getState().incanterLeSort(priest.id, 'benediction-de-guerison', ally.id);
    const pc = banc.getState().pendingCast;
    expect(pc).toBeTruthy();
    expect(pc!.missile).toBe(false);
    expect(pc!.casterId).toBe(priest.id);
    expect(pc!.targetId).toBe(ally.id);

    banc.getState().jetLancer('incantation');
    forceCast(priest.id);
    const before = banc.getState().party.find((h) => h.id === ally.id)!.wounds.current;
    banc.getState().jetValider('incantation');

    const after = banc.getState().party.find((h) => h.id === ally.id)!.wounds.current;
    expect(after).toBe(before + 1); // +1 PB (effet modélisé : parseHeal)
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().battle).toBeNull(); // resté hors combat
    expect(banc.getState().journal.some((l) => /Bénédiction de Guérison|Blessure/.test(l))).toBe(true);
  });

  it('un Projectile magique (« Fléchette ») est refusé hors combat (offensif → combat-only)', () => {
    const wiz = herosDeScenario(idsDeTest, 'sorcier');
    banc.setState({ party: [wiz] });
    banc.getState().incanterLeSort(wiz.id, 'flechette', wiz.id);
    expect(banc.getState().pendingCast).toBeNull(); // aucune modale ouverte
  });

  it('incanterLeSort est un no-op EN combat (l\'incantation passe par l\'action de combat)', () => {
    const { priest, party } = casterParty();
    banc.setState({ party, battle: { combatants: [], over: false, log: [], round: 1, turn: 0, order: [], acted: false } } as never);
    banc.getState().incanterLeSort(priest.id, 'benediction-de-guerison', priest.id);
    expect(banc.getState().pendingCast).toBeNull();
  });

  it('Focalisation hors combat (sort d\'Arcane) : focaliserLeSort ouvre la modale ; jetValider@focalisation accumule caster.focus, journalisé, sans combat', () => {
    const wiz = herosDeScenario(idsDeTest, 'sorcier');
    wiz.spells = ['arme-aethyrique', ...(wiz.spells ?? [])];
    const foc = wiz.skills.find((s) => s.id === 'focalisation');
    if (foc) foc.advances = Math.max(foc.advances, 5);
    else wiz.skills.push({ id: 'focalisation', characteristic: 'force-mentale', advances: 5 });
    banc.setState({ party: [wiz], battle: null, pendingFocus: null });
    banc.getState().ensemencerLeTirage(3);

    banc.getState().focaliserLeSort(wiz.id, 'arme-aethyrique');
    const pf = banc.getState().pendingFocus;
    expect(pf).toBeTruthy();
    expect(pf!.casterId).toBe(wiz.id);

    banc.getState().jetLancer('focalisation');
    expect(banc.getState().pendingFocus!.result).toBeTruthy();
    banc.getState().jetValider('focalisation');

    const after = banc.getState().party.find((h) => h.id === wiz.id)!;
    expect(after.focus?.spell).toBe('arme-aethyrique'); // accumulation enregistrée sur le héros (id stable)
    expect(banc.getState().pendingFocus).toBeNull();
    expect(banc.getState().battle).toBeNull();
    expect(banc.getState().journal.some((l) => /Focalis/i.test(l))).toBe(true);
  });
});

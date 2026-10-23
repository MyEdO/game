import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pregen, pregenParty, PREGEN } from '../data/pregens';
import type { Combatant } from '../engine/types';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * Incantation HORS COMBAT (couture D, LDB 21/Magie) — RÉUTILISE le flux d'incantation existant
 * (pas de duplication) : `pendingCast` + castRoll/…/castConfirm + applyCast, rendus optionnels au
 * combat (acteurs résolus dans `battle?.combatants ?? party` ; sortie vers `journal` hors combat).
 * Les Projectiles magiques (offensifs) restent réservés au combat.
 */

function casterParty() {
  const [priest, ally] = pregenParty(idNeufDeBanc, PREGEN.pretre, PREGEN.soldat);
  // Garantit que le Prêtre peut tenter la Prière (Compétence avancée ≥ 1 avance, LDB 09).
  const priere = priest.skills.find((s) => s.id === 'priere');
  if (priere) priere.advances = Math.max(priere.advances, 5);
  else priest.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 });
  return { priest, ally, party: [priest, ally] as Combatant[] };
}

/** Force la réussite de l'incantation en attente (neutralise le d100 — usage légitime : Résilience). */
function forceCast(casterId: string) {
  const h = useGame.getState().party.find((c) => c.id === casterId)!;
  if (!useGame.getState().pendingCast!.result!.cast) {
    h.resilience = (h.resilience ?? 0) + 1;
    useGame.getState().castForceSuccess();
  }
}

describe('Incantation hors combat (couture D)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingCast: null, party: [] });
    useGame.getState().seedRng(7);
  });

  it('Prêtre lance « Bénédiction de Guérison » sur un allié blessé hors combat → +1 PB, journalisé, sans combat', () => {
    const { priest, ally, party } = casterParty();
    ally.wounds.current = ally.wounds.max - 3;
    useGame.setState({ party });

    useGame.getState().oocCastSpell(priest.id, 'benediction-de-guerison', ally.id);
    const pc = useGame.getState().pendingCast;
    expect(pc).toBeTruthy();
    expect(pc!.missile).toBe(false);
    expect(pc!.casterId).toBe(priest.id);
    expect(pc!.targetId).toBe(ally.id);

    useGame.getState().castRoll();
    forceCast(priest.id);
    const before = useGame.getState().party.find((h) => h.id === ally.id)!.wounds.current;
    useGame.getState().castConfirm();

    const after = useGame.getState().party.find((h) => h.id === ally.id)!.wounds.current;
    expect(after).toBe(before + 1); // +1 PB (effet modélisé : parseHeal)
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().battle).toBeNull(); // resté hors combat
    expect(useGame.getState().journal.some((l) => /Bénédiction de Guérison|Blessure/.test(l))).toBe(true);
  });

  it('un Projectile magique (« Fléchette ») est refusé hors combat (offensif → combat-only)', () => {
    const wiz = pregen(idNeufDeBanc, PREGEN.sorcier);
    useGame.setState({ party: [wiz] });
    useGame.getState().oocCastSpell(wiz.id, 'flechette', wiz.id);
    expect(useGame.getState().pendingCast).toBeNull(); // aucune modale ouverte
  });

  it('oocCastSpell est un no-op EN combat (l\'incantation passe par l\'action de combat)', () => {
    const { priest, party } = casterParty();
    useGame.setState({ party, battle: { combatants: [], over: false, log: [], round: 1, turn: 0, order: [], acted: false } } as never);
    useGame.getState().oocCastSpell(priest.id, 'benediction-de-guerison', priest.id);
    expect(useGame.getState().pendingCast).toBeNull();
  });

  it('Focalisation hors combat (sort d\'Arcane) : oocFocusSpell ouvre la modale ; focusConfirm accumule caster.focus, journalisé, sans combat', () => {
    const wiz = pregen(idNeufDeBanc, PREGEN.sorcier);
    wiz.spells = ['arme-aethyrique', ...(wiz.spells ?? [])];
    const foc = wiz.skills.find((s) => s.id === 'focalisation');
    if (foc) foc.advances = Math.max(foc.advances, 5);
    else wiz.skills.push({ id: 'focalisation', characteristic: 'force-mentale', advances: 5 });
    useGame.setState({ party: [wiz], battle: null, pendingFocus: null });
    useGame.getState().seedRng(3);

    useGame.getState().oocFocusSpell(wiz.id, 'arme-aethyrique');
    const pf = useGame.getState().pendingFocus;
    expect(pf).toBeTruthy();
    expect(pf!.casterId).toBe(wiz.id);

    useGame.getState().focusRoll();
    expect(useGame.getState().pendingFocus!.result).toBeTruthy();
    useGame.getState().focusConfirm();

    const after = useGame.getState().party.find((h) => h.id === wiz.id)!;
    expect(after.focus?.spell).toBe('arme-aethyrique'); // accumulation enregistrée sur le héros (id stable)
    expect(useGame.getState().pendingFocus).toBeNull();
    expect(useGame.getState().battle).toBeNull();
    expect(useGame.getState().journal.some((l) => /Focalis/i.test(l))).toBe(true);
  });
});

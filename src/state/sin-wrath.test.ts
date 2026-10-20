/**
 * Points de Péché & Colère des dieux — câblage store (LDB 40 l.44-56) :
 *  - dé des unités d'un Test de Prière ≤ Péchés → Colère MÊME sur Test réussi (l.45) ;
 *  - +10 au jet de Colère par Péché (l.53) ;
 *  - après un jet de Colère : Péché −1, min 0 (l.53) ;
 *  - Effet d'éditeur `giveSin` (sanction d'auteur, 1-3 — l.36).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import { avanceEtapeCascade, draineEtLit } from './cascade.testkit';
import { pregenParty, PREGEN } from '../data/pregens';
import type { Combatant } from '../engine/types';
import type { CastResult } from '../engine/magic';

function priestParty(sin: number) {
  const [priest, ally] = pregenParty(PREGEN.pretre, PREGEN.soldat);
  const priere = priest.skills.find((s) => s.id === 'priere');
  if (priere) priere.advances = Math.max(priere.advances, 5);
  else priest.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 });
  priest.sinPoints = sin;
  return { priest, ally, party: [priest, ally] as Combatant[] };
}

/** Pose un pendingCast au résultat FIGÉ (jet contrôlé) puis « Appliquer ». */
function confirmPrayerWithRoll(casterId: string, targetId: string, roll: number, ok = true) {
  const result: CastResult = {
    cast: ok, roll, target: 60, sl: ok ? 1 : -1, isCritical: false, isFumble: false,
    log: ok ? 'Prière exaucée.' : 'Prière échouée.',
  };
  useGame.setState({
    pendingCast: { casterId, targetId, spellId: 'benediction-de-guerison', missile: false, focused: false, result },
  });
  useGame.getState().castConfirm();
}

describe('Péché et Colère Divine (LDB 40)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingCast: null, pendingCascade: null, party: [], journal: [] });
    useGame.getState().seedRng(11);
  });

  it('unités ≤ Péchés sur Prière RÉUSSIE → l\'effet s\'applique ET la Colère frappe, Péché −1', () => {
    const { priest, ally, party } = priestParty(3);
    ally.wounds.current = ally.wounds.max - 3;
    useGame.setState({ party });
    const before = ally.wounds.current;
    confirmPrayerWithRoll(priest.id, ally.id, 42); // unités 2 ≤ 3 Péchés
    // Le dé de la Colère est une ÉTAPE : elle se joue, et ce qu'elle rend au joueur vit sur elle
    // (révélation) autant que dans le journal.
    const rendu = draineEtLit(useGame.getState).join('\n');
    const after = useGame.getState().party.find((h) => h.id === ally.id)!;
    expect(after.wounds.current).toBe(before + 1); // la Bénédiction se manifeste quand même
    expect(rendu).toMatch(/Colère des dieux/);
    expect(rendu).toMatch(/Péché expié/);
    expect(useGame.getState().party.find((h) => h.id === priest.id)!.sinPoints).toBe(2);
  });

  it('unités > Péchés → aucune Colère, Péchés intacts', () => {
    const { priest, ally, party } = priestParty(3);
    useGame.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 45); // unités 5 > 3
    expect(useGame.getState().journal.join('\n')).not.toMatch(/Colère des dieux/);
    expect(useGame.getState().party.find((h) => h.id === priest.id)!.sinPoints).toBe(3);
  });

  it('à 0 Péché, un jet en -0 ne déclenche rien', () => {
    const { priest, ally, party } = priestParty(0);
    useGame.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 30); // unités 0, 0 Péché
    expect(useGame.getState().journal.join('\n')).not.toMatch(/Colère des dieux/);
  });

  it('Maladresse de Prière : UNE seule Colère (pas de double déclenchement unités+Maladresse), Péché −1', () => {
    const { priest, ally, party } = priestParty(2);
    useGame.setState({ party });
    const result: CastResult = { cast: false, roll: 22, target: 20, sl: -1, isCritical: false, isFumble: true, log: 'Maladresse !' };
    useGame.setState({
      pendingCast: { casterId: priest.id, targetId: ally.id, spellId: 'benediction-de-guerison', missile: false, focused: false, result },
    });
    useGame.getState().castConfirm();
    const journal = draineEtLit(useGame.getState).join('\n');
    expect(journal.match(/Colère des dieux \(/g)?.length).toBe(1); // un seul JET de table
    expect(useGame.getState().party.find((h) => h.id === priest.id)!.sinPoints).toBe(1);
  });

  it('le jet de Colère est décalé de +10 par Péché (l.53) — observable via le dé de l\'étape', () => {
    const { priest, ally, party } = priestParty(5);
    useGame.setState({ party });
    confirmPrayerWithRoll(priest.id, ally.id, 41); // unités 1 ≤ 5
    // Le dé de la Colère tombe au rang de SON étape ; la révélation (charge riche `reveal`) suit dans
    // la MÊME séquence — on joue jusqu'à elle.
    for (let i = 0; i < 6 && !useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'miscast'); i++) {
      avanceEtapeCascade(useGame.getState);
    }
    const step = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'miscast');
    expect(step?.reveal?.kind).toBe('miscast');
    // d100 ∈ [1;100] + 5×10 → le jet effectif est forcément > 50.
    expect(step!.reveal!.dice).toBeGreaterThan(50);
  });

  it('Effet d\'éditeur giveSin : cible le héros désigné, sinon le premier sachant Prier', () => {
    const { priest, ally } = priestParty(0);
    useGame.setState({ party: [ally, priest].map((h) => ({ ...h })) as Combatant[] }); // l'allié d'abord
    applyEffects(useGame.getState, useGame.setState, [{ type: 'giveSin', amount: 2 }]);
    expect(useGame.getState().party.find((h) => h.id === priest.id)!.sinPoints).toBe(2); // pas l'allié
    applyEffects(useGame.getState, useGame.setState, [{ type: 'giveSin', amount: 1, heroId: ally.id }]);
    expect(useGame.getState().party.find((h) => h.id === ally.id)!.sinPoints).toBe(1);
  });
});

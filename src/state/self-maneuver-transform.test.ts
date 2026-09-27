/**
 * Activation JOUEUR d'une capacité SUR SOI (targeting:'self') — Métamorphose de l'Enfant d'Ulric
 * (Middenheim p.116) : la hotbar propose la manœuvre APPLICABLE (prendre/reprendre la forme) ; l'action
 * `battleSelfManeuver` résout la transformation sur le porteur, applique le delta RAW + Traits + apparence,
 * consomme l'Action du tour ET la prochaine (loseTurn) = prix de DEUX actions, et se toggle proprement.
 * (L'IA sait spawn un Enfant d'Ulric hybride prêt ; s'auto-transformer côté IA reste à câbler — cf. note.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { selfManeuversOf, selfManeuverApplicable } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { effectiveChar } from '../engine/characteristics';
import { liveMorphRef } from '../engine/polymorph';
import { hasTraitKey } from '../engine/traits/dispatch';

const applicableIds = (c: Parameters<typeof selfManeuversOf>[0]) =>
  selfManeuversOf(c).filter((m) => selfManeuverApplicable(c, m)).map((m) => m.id);

describe('battleSelfManeuver — Métamorphose (activation joueur)', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.traits = [{ id: 'metamorphose' }]; // Enfant d'Ulric (lycanthrope jouable)
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H };
  }
  const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

  it('la hotbar ne propose que la manœuvre APPLICABLE selon la forme', () => {
    const { H } = setup();
    expect(applicableIds(H)).toEqual(['forme-hybride-ulric']); // hors de la forme → prendre l'hybride
  });

  it('transforme : delta RAW appliqué, Traits + apparence, Action + prochaine consommées (2 actions)', () => {
    const { H } = setup();
    const cc0 = effectiveChar(H, 'capacite-de-combat'), dex0 = effectiveChar(H, 'dexterite'), soc0 = effectiveChar(H, 'sociabilite');
    useGame.getState().battleSelfManeuver('forme-hybride-ulric');
    const h = live(H.id);
    expect(effectiveChar(h, 'capacite-de-combat')).toBe(cc0 + 10); // delta du tableau (Middenheim p.116)
    expect(effectiveChar(h, 'dexterite')).toBe(dex0 - 10);
    expect(effectiveChar(h, 'sociabilite')).toBe(soc0 - 20);
    expect(hasTraitKey(h.traits, 'peur')).toBe(true);
    expect(liveMorphRef(h)).toBe('enfant-d-ulric'); // apparence hybride
    expect(useGame.getState().battle!.acted).toBe(true); // Action de CE tour consommée
    expect(h.loseNextAction).toBe(true); // 2ᵉ action (prochain tour) — prix de deux actions
    expect(applicableIds(h)).toEqual(['forme-humaine-ulric']); // désormais seul le retour est proposé
  });

  it('toggle : reprendre la forme humaine restaure le profil de base', () => {
    const { H } = setup();
    const cc0 = effectiveChar(H, 'capacite-de-combat'), dex0 = effectiveChar(H, 'dexterite');
    useGame.getState().battleSelfManeuver('forme-hybride-ulric');
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false } }); // tour suivant
    useGame.getState().battleSelfManeuver('forme-humaine-ulric');
    const h = live(H.id);
    expect(effectiveChar(h, 'capacite-de-combat')).toBe(cc0);
    expect(effectiveChar(h, 'dexterite')).toBe(dex0);
    expect(hasTraitKey(h.traits, 'peur')).toBe(false);
    expect(liveMorphRef(h)).toBeUndefined();
    expect(applicableIds(h)).toEqual(['forme-hybride-ulric']); // de retour hors de la forme
  });

  it('une manœuvre non applicable est refusée (garde d’état de forme)', () => {
    const { H } = setup();
    const cc0 = effectiveChar(H, 'capacite-de-combat');
    useGame.getState().battleSelfManeuver('forme-humaine-ulric'); // pas transformé → no-op
    expect(effectiveChar(live(H.id), 'capacite-de-combat')).toBe(cc0);
    expect(useGame.getState().battle!.acted).toBe(false); // aucune Action gaspillée
  });

  it('orientation : une transformation (cible = SOI) laisse le cap intact', () => {
    const { H } = setup();
    useGame.setState({ facing: { [H.id]: 'NO' } });
    useGame.getState().battleSelfManeuver('forme-hybride-ulric');
    expect(useGame.getState().facing[H.id]).toBe('NO');
  });
});

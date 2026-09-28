/**
 * RUNNER DE CONSOMMABLE (#50) — le Flow d'un objet consommé s'exécute cadence-aware sur son BUVEUR :
 *  - hors combat, un nœud `test` ouvre la modale de Test RESTREINTE AU BUVEUR (pas le meilleur du
 *    groupe) ; branche + continuation reprises par `resolveTest` avec la DURÉE bakée sur les feuilles ;
 *  - les ops `delayed` sont PROGRAMMÉES (file `scheduledEffects`) et tirées au franchissement d'horloge ;
 *  - les effets durables expirent à l'échéance (`purgeClockEffects`), États d'horloge compris.
 * Sur la DONNÉE RÉELLE (belladone / mystracine / bonnet-de-fou — LDB 71/72).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { seedBattleRng } from './battleRng';
import { hasCondition } from '../engine/conditions';
import { cascadeAppliers } from './cascade';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

function hero(name: string, over: Partial<Combatant> = {}): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: name, seed: 1 });
  return { ...h, id: name, ...over } as Combatant;
}

function giveItem(h: Combatant, trappingId: string, uid: string): void {
  const it = itemFromTrappingById(trappingId)!;
  it.uid = uid;
  h.items = [...(h.items ?? []), it];
}

beforeEach(() => {
  seedBattleRng(42);
  useGame.setState({
    battle: null, scene: null, mode: 'exploration', flags: {}, journal: [],
    pendingTest: null, pendingCascade: null, scheduledEffects: [], gameTime: 8 * 60, lastUpkeepDay: 0,
  });
});

describe('belladone (LDB 72 l.18) — Test au boire RESTREINT au buveur, sommeil différé, État d’horloge', () => {
  it('bout en bout : modale du BUVEUR → échec → sommeil programmé à +150 min → Inconscient 1d10+4 h → dissipé', () => {
    // h1 a une meilleure Résistance que h2 — le Test doit pourtant viser h2 (c'est LUI qui boit).
    const h1 = hero('h1', { characteristics: { ...hero('x').characteristics, endurance: 60 } });
    const h2 = hero('h2');
    giveItem(h2, 'belladone', 'bel1');
    useGame.setState({ party: [h1, h2] });

    useGame.getState().usePartyItem('h2', 'bel1');
    const pt = useGame.getState().pendingTest!;
    expect(pt).toBeTruthy();
    expect(pt.actorId).toBe('h2'); // restreint au buveur (pas partyBest)
    expect(pt.candidates).toBeUndefined(); // pas de sélecteur : personne d'autre ne peut boire à sa place
    expect(useGame.getState().party.find((c) => c.id === 'h2')!.items!.some((i) => i.uid === 'bel1')).toBe(false); // consommé

    // Échec forcé → la branche `fail` programme le sommeil « au bout de 2-3 heures » (150 min).
    useGame.setState({ pendingTest: { ...pt, roll: 99, success: false, sl: -2 } });
    useGame.getState().resolveTest();
    const sched = useGame.getState().scheduledEffects;
    expect(sched).toHaveLength(1);
    expect(sched[0].executeAt).toBe(8 * 60 + 150);

    // Franchissement de l'échéance → Inconscient (durée d'horloge 1d10+4 h → untilTime posé).
    useGame.getState().advanceTime(150);
    const sleeper = useGame.getState().party.find((c) => c.id === 'h2')!;
    expect(hasCondition(sleeper, 'inconscient')).toBe(true);
    const cond = sleeper.conditions.find((x) => x.id === 'inconscient')!;
    const start = 8 * 60 + 150;
    expect(cond.untilTime).toBeGreaterThanOrEqual(start + 5 * 60);
    expect(cond.untilTime).toBeLessThanOrEqual(start + 14 * 60);

    // Après l'échéance : l'État se dissipe (purgeClockEffects).
    useGame.getState().advanceTime(14 * 60 + 1);
    expect(hasCondition(useGame.getState().party.find((c) => c.id === 'h2')!, 'inconscient')).toBe(false);
  });

  it('réussite du Test : aucun sommeil programmé', () => {
    const h2 = hero('h2');
    giveItem(h2, 'belladone', 'bel1');
    useGame.setState({ party: [h2] });
    useGame.getState().usePartyItem('h2', 'bel1');
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 1, success: true, sl: 3 } });
    useGame.getState().resolveTest();
    expect(useGame.getState().scheduledEffects).toHaveLength(0);
  });
});

describe('mystracine (LDB 71 l.33) — durée « 1d10 × 10 minutes » bakée, purge à l’échéance', () => {
  it('pose les testMod char-qualifiés à durée d’horloge, dissipés après 100 min max', () => {
    const h = hero('h1');
    giveItem(h, 'mystracine', 'mys1');
    useGame.setState({ party: [h] });
    useGame.getState().usePartyItem('h1', 'mys1');
    const p = useGame.getState().party.find((c) => c.id === 'h1')!;
    const fx = (p.activeEffects ?? []).filter((e) => e.testModChar);
    expect(fx).toHaveLength(5); // +10 E/FM, −10 Ag/I/Int (LDB 71 l.33)
    for (const e of fx) {
      expect(e.label).toBe('Mystracine');
      expect(e.duration.scale).toBe('clock');
    }
    useGame.getState().advanceTime(101); // 1d10×10 ≤ 100 min
    expect((useGame.getState().party.find((c) => c.id === 'h1')!.activeEffects ?? []).filter((e) => e.testModChar)).toHaveLength(0);
  });
});

describe('bonnet-de-fou (LDB 71 l.20) — +4 Blessures (attrMod exécutable) + perte 1d10 PB à la dissipation', () => {
  it('applique +10 F, +4 Blessures, Frénésie ; programme la perte 1d10 PB à l’échéance de la durée', () => {
    const h = hero('h1');
    giveItem(h, 'bonnet-de-fou', 'bf1');
    useGame.setState({ party: [h] });
    const maxBefore = h.wounds.max;
    useGame.getState().usePartyItem('h1', 'bf1');
    const p = useGame.getState().party.find((c) => c.id === 'h1')!;
    // « +4 Blessures » (attrMod exécuté) — le +10 F du même flow peut AUSSI monter le max via le BF
    // (Blessures dynamiques, LDB 85) : on isole la part attrMod, puis on borne le total.
    expect((p.activeEffects ?? []).find((e) => e.attrMods?.wounds)?.attrMods?.wounds).toBe(4);
    expect(p.wounds.max).toBeGreaterThanOrEqual(maxBefore + 4);
    expect(p.wounds.max).toBeLessThanOrEqual(maxBefore + 5); // +4 plats, +1 possible de BF (F +10)
    expect((p.activeEffects ?? []).some((e) => e.grantedTalent?.talentId === 'frenesie')).toBe(true);
    // « Quand l'effet se dissipe, l'utilisateur perd 1d10 Points de Blessure » : programmé À l'échéance
    // de la durée (2d10 min) — même minute que l'expiration des effets.
    const sched = useGame.getState().scheduledEffects;
    expect(sched).toHaveLength(1);
    const until = (p.activeEffects ?? []).find((e) => e.attrMods?.wounds)!.duration;
    expect(until.scale).toBe('clock');
    expect(sched[0].executeAt).toBe((until as { scale: 'clock'; until: number }).until);
    // Le Test de Résistance (non-peau-verte) est ouvert sur le buveur.
    expect(useGame.getState().pendingTest?.actorId).toBe('h1');

    // Échec → Infection mineure contractée.
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 99, success: false, sl: -1 } });
    useGame.getState().resolveTest();
    expect((useGame.getState().party.find((c) => c.id === 'h1')!.diseases ?? []).some((d) => d.id === 'infection-mineure')).toBe(true);

    // Dissipation (≤ 20 min) : la perte 1d10 PB tire d'abord (file), puis les effets sont purgés
    // (max revient à sa valeur, les PB courants suivent le delta) → il manque 1 à 10 PB au total.
    useGame.getState().advanceTime(21); // 2d10 ≤ 20 min
    const after = useGame.getState().party.find((c) => c.id === 'h1')!;
    expect(after.wounds.max).toBe(maxBefore);
    expect(after.wounds.current).toBeGreaterThanOrEqual(maxBefore - 10);
    expect(after.wounds.current).toBeLessThanOrEqual(maxBefore - 1);
  });
});

describe('racine-de-mandragore (LDB 71 l.35) — gate d’action par Round (actGate)', () => {
  function battleWith(h: Combatant): BattleState {
    return {
      combatants: [h], order: [h.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
  }

  it('applier actGate : échec du Test → étape de CHOIX ; « garder le Mouvement » consomme l’Action de la battle', () => {
    const h = hero('h1');
    h.activeEffects = [{ label: 'Racine de mandragore', bonus: 0, duration: { scale: 'clock', until: 99999 }, actGate: { char: 'force-mentale' } }];
    useGame.setState({ party: [h], battle: battleWith(h), mode: 'battle' });
    const get = useGame.getState;
    const set = useGame.setState;

    // Échec du Test → l'applier insère l'étape de choix Action/Mouvement.
    const out = cascadeAppliers['actGate'].apply(get, set, { id: 's1', kind: 'actGate', actorId: 'h1', result: { roll: 99, target: 30, sl: -6, success: false } } as never, h, { steps: [], index: 0 });
    expect(out?.insert?.[0]?.kind).toBe('actGateChoice');
    expect(out?.insert?.[0]?.options?.map((o: { key: string }) => o.key)).toEqual(['action', 'move']);

    // Choix « garder le Mouvement » → l'Action du tour est consommée sur la battle COURANTE.
    cascadeAppliers['actGateChoice'].apply(get, set, { ...out!.insert![0], chosen: 'move' } as never, h, { steps: [], index: 0 });
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('applier actGate : réussite → rien à restreindre', () => {
    const h = hero('h1');
    useGame.setState({ party: [h], battle: battleWith(h), mode: 'battle' });
    const out = cascadeAppliers['actGate'].apply(useGame.getState, useGame.setState, { id: 's1', kind: 'actGate', actorId: 'h1', result: { roll: 2, target: 30, sl: 2, success: true } } as never, h, { steps: [], index: 0 });
    expect(out?.insert).toBeUndefined();
    expect(useGame.getState().battle!.acted).toBe(false);
  });
});

/**
 * RUNNER DE CONSOMMABLE (#50) — le Flow d'un objet consommé s'exécute cadence-aware sur son BUVEUR :
 *  - hors combat, un nœud `test` ouvre la modale de Test RESTREINTE AU BUVEUR (pas le meilleur du
 *    groupe) ; branche + continuation reprises par `jetValider('test')` avec la DURÉE bakée sur les feuilles ;
 *  - les ops `delayed` sont PROGRAMMÉES (file `scheduledEffects`) et tirées au franchissement d'horloge ;
 *  - les effets durables expirent à l'échéance (`purgeClockEffects`), États d'horloge compris.
 * Sur la DONNÉE RÉELLE (belladone / mystracine / bonnet-de-fou — LDB 71/72).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { seedBattleRng } from './battleRng';
import { hasCondition } from '../engine/conditions';
import { applierDe } from './cascade';
import type { Combatant } from '../engine/types';
import type { BattleState } from './etat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function hero(name: string, over: Partial<Combatant> = {}): Combatant {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: name, seed: 1 });
  return { ...h, id: name, ...over } as Combatant;
}

function giveItem(h: Combatant, trappingId: string, uid: string): void {
  const it = itemFromTrappingById(trappingId, idsDeTest)!;
  it.uid = uid;
  h.items = [...(h.items ?? []), it];
}

beforeEach(() => {
  seedBattleRng(42);
  banc.setState({ gameTime: 8 * 60, lastUpkeepDay: 0 });
});

describe('belladone (LDB 72 l.18) — Test au boire RESTREINT au buveur, sommeil différé, État d’horloge', () => {
  it('bout en bout : modale du BUVEUR → échec → sommeil programmé à +150 min → Inconscient 1d10+4 h → dissipé', () => {
    // h1 a une meilleure Résistance que h2 — le Test doit pourtant viser h2 (c'est LUI qui boit).
    const h1 = hero('h1', { characteristics: { ...hero('x').characteristics, endurance: 60 } });
    const h2 = hero('h2');
    giveItem(h2, 'belladone', 'bel1');
    banc.setState({ party: [h1, h2] });

    banc.getState().utiliserLObjet('bel1');
    const pt = banc.getState().pendingTest!;
    expect(pt).toBeTruthy();
    expect(pt.actorId).toBe('h2'); // restreint au buveur (pas partyBest)
    expect(pt.candidates).toBeUndefined(); // pas de sélecteur : personne d'autre ne peut boire à sa place
    expect(banc.getState().party.find((c) => c.id === 'h2')!.items!.some((i) => i.uid === 'bel1')).toBe(false); // consommé

    // Échec forcé → la branche `fail` programme le sommeil « au bout de 2-3 heures » (150 min).
    banc.setState({ pendingTest: { ...pt, roll: 99, success: false, sl: -2 } });
    banc.getState().jetValider('test');
    const sched = banc.getState().scheduledEffects;
    expect(sched).toHaveLength(1);
    expect(sched[0].executeAt).toBe(8 * 60 + 150);

    // Franchissement de l'échéance → Inconscient (durée d'horloge 1d10+4 h → untilTime posé).
    banc.getState().avancerLeTemps(150);
    const sleeper = banc.getState().party.find((c) => c.id === 'h2')!;
    expect(hasCondition(sleeper, 'inconscient')).toBe(true);
    const cond = sleeper.conditions.find((x) => x.id === 'inconscient')!;
    const start = 8 * 60 + 150;
    expect(cond.untilTime).toBeGreaterThanOrEqual(start + 5 * 60);
    expect(cond.untilTime).toBeLessThanOrEqual(start + 14 * 60);

    // Après l'échéance : l'État se dissipe (purgeClockEffects).
    banc.getState().avancerLeTemps(14 * 60 + 1);
    expect(hasCondition(banc.getState().party.find((c) => c.id === 'h2')!, 'inconscient')).toBe(false);
  });

  it('réussite du Test : aucun sommeil programmé', () => {
    const h2 = hero('h2');
    giveItem(h2, 'belladone', 'bel1');
    banc.setState({ party: [h2] });
    banc.getState().utiliserLObjet('bel1');
    banc.setState({ pendingTest: { ...banc.getState().pendingTest!, roll: 1, success: true, sl: 3 } });
    banc.getState().jetValider('test');
    expect(banc.getState().scheduledEffects).toHaveLength(0);
  });
});

describe('mystracine (LDB 71 l.33) — durée « 1d10 × 10 minutes » bakée, purge à l’échéance', () => {
  it('pose les testMod char-qualifiés à durée d’horloge, dissipés après 100 min max', () => {
    const h = hero('h1');
    giveItem(h, 'mystracine', 'mys1');
    banc.setState({ party: [h] });
    banc.getState().utiliserLObjet('mys1');
    const p = banc.getState().party.find((c) => c.id === 'h1')!;
    const fx = (p.activeEffects ?? []).filter((e) => e.testModChar);
    expect(fx).toHaveLength(5); // +10 E/FM, −10 Ag/I/Int (LDB 71 l.33)
    for (const e of fx) {
      expect(e.label).toBe('Mystracine');
      expect(e.duration.scale).toBe('clock');
    }
    banc.getState().avancerLeTemps(101); // 1d10×10 ≤ 100 min
    expect((banc.getState().party.find((c) => c.id === 'h1')!.activeEffects ?? []).filter((e) => e.testModChar)).toHaveLength(0);
  });
});

describe('bonnet-de-fou (LDB 71 l.20) — +4 Blessures (attrMod exécutable) + perte 1d10 PB à la dissipation', () => {
  it('applique +10 F, +4 Blessures, Frénésie ; programme la perte 1d10 PB à l’échéance de la durée', () => {
    const h = hero('h1');
    giveItem(h, 'bonnet-de-fou', 'bf1');
    banc.setState({ party: [h] });
    const maxBefore = h.wounds.max;
    banc.getState().utiliserLObjet('bf1');
    const p = banc.getState().party.find((c) => c.id === 'h1')!;
    // « +4 Blessures » au total, Force +10 comprise (#3060).
    expect((p.activeEffects ?? []).find((e) => e.attrMods?.wounds)?.attrMods?.wounds).toBe(4);
    expect(p.wounds.max).toBe(maxBefore + 4);
    expect((p.activeEffects ?? []).some((e) => e.grantedTalent?.talentId === 'frenesie')).toBe(true);
    // « Quand l'effet se dissipe, l'utilisateur perd 1d10 Points de Blessure » : programmé À l'échéance
    // de la durée (2d10 min) — même minute que l'expiration des effets.
    const sched = banc.getState().scheduledEffects;
    expect(sched).toHaveLength(1);
    const until = (p.activeEffects ?? []).find((e) => e.attrMods?.wounds)!.duration;
    expect(until.scale).toBe('clock');
    expect(sched[0].executeAt).toBe((until as { scale: 'clock'; until: number }).until);
    // Le Test de Résistance (non-peau-verte) est ouvert sur le buveur.
    expect(banc.getState().pendingTest?.actorId).toBe('h1');

    // Échec → Infection mineure contractée.
    banc.setState({ pendingTest: { ...banc.getState().pendingTest!, roll: 99, success: false, sl: -1 } });
    banc.getState().jetValider('test');
    expect((banc.getState().party.find((c) => c.id === 'h1')!.diseases ?? []).some((d) => d.id === 'infection-mineure')).toBe(true);

    // Dissipation (≤ 20 min) : la perte 1d10 PB tire d'abord (file), puis les effets sont purgés
    // (max revient à sa valeur, les PB courants suivent le delta) → il manque 1 à 10 PB au total.
    banc.getState().avancerLeTemps(21); // 2d10 ≤ 20 min
    const after = banc.getState().party.find((c) => c.id === 'h1')!;
    expect(after.wounds.max).toBe(maxBefore);
    expect(after.wounds.current).toBeGreaterThanOrEqual(maxBefore - 10);
    expect(after.wounds.current).toBeLessThanOrEqual(maxBefore - 1);
  });
});

describe('racine-de-mandragore (LDB 71 l.35) — gate d’action par Round (testDAgir)', () => {
  function battleWith(h: Combatant): BattleState {
    return {
      combatants: [h], order: [h.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
  }

  it('applier testDAgir : échec du Test → étape de CHOIX ; « garder le Mouvement » consomme l’Action de la battle', () => {
    const h = hero('h1');
    h.activeEffects = [{ label: 'Racine de mandragore', bonus: 0, duration: { scale: 'clock', until: 99999 }, testDAgir: { characteristic: 'force-mentale' } }];
    banc.setState({ party: [h], battle: battleWith(h), mode: 'battle' });
    const get = banc.getState;
    const set = banc.setState;

    // Échec du Test → l'applier insère l'étape de choix Action/Mouvement.
    const out = applierDe('testDAgir')!(get, set, { id: 's1', kind: 'testDAgir', actorId: 'h1', result: { roll: 99, target: 30, sl: -6, success: false } } as never, h, { steps: [], index: 0 });
    expect(out?.insert?.[0]?.kind).toBe('choixDAgir');
    expect(out?.insert?.[0]?.options?.map((o: { key: string }) => o.key)).toEqual(['action', 'mouvement']);

    // Choix « garder le Mouvement » → l'Action du tour est consommée sur la battle COURANTE.
    applierDe('choixDAgir')!(get, set, { ...out!.insert![0], chosen: 'mouvement' } as never, h, { steps: [], index: 0 });
    expect(banc.getState().battle!.acted).toBe(true);
  });

  it('applier testDAgir : réussite → rien à restreindre', () => {
    const h = hero('h1');
    banc.setState({ party: [h], battle: battleWith(h), mode: 'battle' });
    const out = applierDe('testDAgir')!(banc.getState, banc.setState, { id: 's1', kind: 'testDAgir', actorId: 'h1', result: { roll: 2, target: 30, sl: 2, success: true } } as never, h, { steps: [], index: 0 });
    expect(out?.insert).toBeUndefined();
    expect(banc.getState().battle!.acted).toBe(false);
  });
});

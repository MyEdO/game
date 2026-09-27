/**
 * Taillade (XA), AA 08 l.87 : « Si vous infligez une Blessure Critique avec cette arme, la cible subit
 * un État Hémorragique en plus de tous les autres effets du Coup Critique. Vous pouvez dépenser X
 * Avantages pour que votre opposant subisse 1 État Hémorragique supplémentaire. » — X = l'Indice
 * imprimé à la colonne Atouts (l.136 « Cimeterre … Taillade (1A) », l.304 « Pertuisane/Fauchard …
 * Taillade (2A) »), porté par la donnée (`trappings.json` → `{id:'taillade', value}`).
 *
 * Chaîne mesurée ICI, de bout en bout : catalogue → `weaponFromItem` → `effectSourcesOf` (branche
 * QUALITÉ, `withArg` substitue `$indice`) → `emitCombatEvent('onCrit')` (le MÊME appel que
 * `combatFlow` fait sur un Critique) → `resolveFlowChoice` → étape de cascade `triggeredChoice` →
 * `cascadeChoose` → dépense d'Avantage + 2ᵉ État.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { emitCombatEvent } from './combatEvents';
import { createHero } from '../engine/character';
import { battleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { itemFromTrappingById, weaponFromItem } from '../engine/items';
import type { Combatant, Weapon } from '../engine/types';
import { applyAttackResult } from './combatFlow';
import type { AttackResult } from '../engine/combat';
import { avanceEtapeCascade } from './cascadeTestKit';

/** L'arme du catalogue, telle que le combat la porte (Atouts résolus depuis `trappings.json`). */
function armeDuCatalogue(id: string): Weapon {
  return weaponFromItem(itemFromTrappingById(id)!);
}

/** Nombre d'États Hémorragique portés (l'op `condition` empile la valeur du même État). */
function hemorragies(c: Combatant | undefined): number {
  return c?.conditions?.find((x) => x.id === 'hemorragique')?.value ?? 0;
}

/** Le Critique, tel que `combatFlow` l'émet (`combatFlow.ts:2422`) — porteur, victime, arme. */
function porterUnCritique(attaquant: Combatant, victime: Combatant, weapon: Weapon): void {
  const get = useGame.getState, set = useGame.setState;
  emitCombatEvent('onCrit', {
    get, set, battle: get().battle!, self: attaquant, sink: () => {},
    triggerCtx: { victim: victime, weapon, location: 'corps', woundsDealt: 3, attackType: weapon.type, rng: battleRng() },
  });
}

/** Une touche NON critique, au même point de dispatch. */
function porterUneTouche(attaquant: Combatant, victime: Combatant, weapon: Weapon): void {
  const get = useGame.getState, set = useGame.setState;
  emitCombatEvent('onHit', {
    get, set, battle: get().battle!, self: attaquant, sink: () => {},
    triggerCtx: { victim: victime, weapon, location: 'corps', woundsDealt: 3, attackType: weapon.type, rng: battleRng() },
  });
}

describe('Taillade (XA) — l’Indice de l’arme est le COÛT en Avantages du 2ᵉ Hémorragique (AA 08 l.87)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null, pendingCascade: null });
    useGame.getState().seedRng(7); // `battleRng` est ensemencé à l'horloge à l'import (`state/battleRng.ts`)
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 };
    return { H, E };
  }

  const cible = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id);
  function repondre(key: string) {
    const pc = useGame.getState().pendingCascade!;
    const cur = pc.participants[pc.cursor];
    useGame.getState().cascadeChoose(cur.id, key);
    useGame.getState().cascadeNext();
  }

  it('cimeterre (1A) : Hémorragique automatique + OFFRE de dépenser 1 Avantage, libellée « (1 Av) »', () => {
    const { H, E } = setup();
    H.advantage = 2;
    porterUnCritique(H, E, armeDuCatalogue('cimeterre'));

    expect(hemorragies(cible(E.id)), 'l’État automatique du Critique manque').toBe(1);
    const pc = useGame.getState().pendingCascade!;
    const etape = pc.participants[pc.cursor];
    expect(etape.kind).toBe('triggeredChoice');
    expect(etape.actorId, 'le DÉCIDEUR est le porteur de l’arme, pas la victime').toBe(H.id);
    expect(etape.options?.map((o) => o.label)).toEqual(['Ouvrir la plaie (1 Av)', 'Renoncer']);
  });

  it('cimeterre (1A), OUI : −1 Avantage et un 2ᵉ État Hémorragique', () => {
    const { H, E } = setup();
    H.advantage = 2;
    porterUnCritique(H, E, armeDuCatalogue('cimeterre'));
    repondre('yes');

    expect(hemorragies(cible(E.id))).toBe(2);
    expect(cible(H.id)!.advantage).toBe(1);
  });

  it('cimeterre (1A), NON : l’Avantage reste, l’État automatique seul', () => {
    const { H, E } = setup();
    H.advantage = 2;
    porterUnCritique(H, E, armeDuCatalogue('cimeterre'));
    repondre('no');

    expect(hemorragies(cible(E.id))).toBe(1);
    expect(cible(H.id)!.advantage).toBe(2);
  });

  it('pertuisane/fauchard (2A) : le coût suit l’Indice — « (2 Av) » et −2 Avantages', () => {
    const { H, E } = setup();
    H.advantage = 3;
    porterUnCritique(H, E, armeDuCatalogue('pertuisane-fauchard'));

    const pc = useGame.getState().pendingCascade!;
    expect(pc.participants[pc.cursor].options?.[0].label).toBe('Ouvrir la plaie (2 Av)');
    repondre('yes');
    expect(hemorragies(cible(E.id))).toBe(2);
    expect(cible(H.id)!.advantage).toBe(1);
  });

  it('Avantages INSUFFISANTS : l’option est refusée AVEC sa raison, et rien n’est dépensé', () => {
    const { H, E } = setup();
    H.advantage = 0;
    porterUnCritique(H, E, armeDuCatalogue('cimeterre'));

    const pc = useGame.getState().pendingCascade!;
    const oui = pc.participants[pc.cursor].options!.find((o) => o.key === 'yes')!;
    expect(oui.refus, 'le refus ne porte AUCUNE cause (elle s’affiche au survol/focus/tap, jamais inline)')
      .toBe('Avantages insuffisants : 1 requis, 0 disponible(s).');
    repondre('yes');
    expect(hemorragies(cible(E.id)), 'le 2ᵉ État a été posé sans Avantage payé').toBe(1);
    expect(cible(H.id)!.advantage).toBe(0);
  });

  it('un coup NON critique avec une arme de Taillade n’offre RIEN (le RAW gate sur la Blessure Critique)', () => {
    const { H, E } = setup();
    H.advantage = 2;
    porterUneTouche(H, E, armeDuCatalogue('cimeterre'));

    expect(hemorragies(cible(E.id))).toBe(0);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('ENNEMI (cadence auto) : il dépense inline s’il peut — 2 Hémorragiques ; sans Avantage, un seul', () => {
    const { H, E } = setup();
    E.advantage = 2;
    porterUnCritique(E, H, armeDuCatalogue('cimeterre'));
    expect(hemorragies(cible(H.id))).toBe(2);
    expect(cible(E.id)!.advantage).toBe(1);
    expect(useGame.getState().pendingCascade, 'l’IA a ouvert une modale au lieu de trancher inline').toBeNull();

    const { H: H2, E: E2 } = setup();
    E2.advantage = 0;
    porterUnCritique(E2, H2, armeDuCatalogue('cimeterre'));
    expect(hemorragies(cible(H2.id))).toBe(1);
  });

  it('Indice ABSENT (`{id:"taillade"}` sans value) : AUCUNE offre — jamais un 2ᵉ État gratuit', () => {
    const { H, E } = setup();
    H.advantage = 5;
    const sansIndice: Weapon = { ...armeDuCatalogue('cimeterre'), qualities: [{ id: 'taillade' }] };
    porterUnCritique(H, E, sansIndice);

    expect(hemorragies(cible(E.id)), 'l’État automatique du Critique manque').toBe(1);
    expect(useGame.getState().pendingCascade, 'un choix au coût resté TEMPLATE a été offert').toBeNull();
    expect(cible(H.id)!.advantage).toBe(5);
  });

  /** Coup CRITIQUE gagné au Test opposé, tel qu'`applyAttackResult` le reçoit du flux d'attaque. */
  const coupCritique = (): AttackResult => ({
    hit: true, attackerRoll: 44, netSL: 4, location: 'corps', critLocation: 'corps',
    damage: 6, woundsLost: 2, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'touche',
  });

  /** Draine la cascade du coup jusqu'à l'étape de CHOIX de Taillade et la rend telle qu'elle s'offre. */
  function offreDeTaillade() {
    for (let i = 0; i < 20 && useGame.getState().pendingCascade; i++) {
      const pc = useGame.getState().pendingCascade!;
      const cur = pc.participants[pc.cursor];
      if (cur?.kind === 'triggeredChoice') return cur;
      avanceEtapeCascade(useGame.getState);
    }
    return undefined;
  }

  it('Avantage 0 + Critique au cimeterre : le coup crédite 1 Avantage, l’offre est PAYABLE, oui → Avantage 0, 2 Hémorragiques', () => {
    const { H, E } = setup();
    H.advantage = 0;
    applyAttackResult(useGame.getState, useGame.setState, H, E, armeDuCatalogue('cimeterre'), coupCritique());
    const etape = offreDeTaillade()!;
    // Les Hémorragiques DÉJÀ posés par la Blessure critique (table LDB 18) + l'État automatique de
    // Taillade : le 2ᵉ État acheté se mesure en DELTA de ce socle, jamais en absolu.
    const hemoAvant = hemorragies(cible(E.id));
    // LDB 13 l.123 (étape 1) : « Si vous remportez le Test, vous touchez votre adversaire et gagnez +1
    // Avantage. » — les effets du Critique (l.177) viennent après. L'offre voit donc l'Avantage crédité.
    expect(cible(H.id)!.advantage, 'l’Avantage du coup porté n’est pas crédité quand l’offre s’ouvre').toBe(1);
    expect(etape.options?.find((o) => o.key === 'yes')?.refus,
      'l’écran refuse ce que le store accepterait (abordabilité mesurée avant le crédit)').toBeUndefined();
    repondre('yes');
    expect(hemorragies(cible(E.id)) - hemoAvant, 'le 2ᵉ État Hémorragique manque').toBe(1);
    expect(cible(H.id)!.advantage).toBe(0);
  });

  it('Avantage 0 + Critique à la pertuisane (2A) : le coup n’en crédite qu’1 — refus « 2 requis, 1 disponible(s) »', () => {
    const { H, E } = setup();
    H.advantage = 0;
    applyAttackResult(useGame.getState, useGame.setState, H, E, armeDuCatalogue('pertuisane-fauchard'), coupCritique());
    const etape = offreDeTaillade()!;
    const hemoAvant = hemorragies(cible(E.id));
    expect(cible(H.id)!.advantage).toBe(1);
    expect(etape.options?.find((o) => o.key === 'yes')?.refus)
      .toBe('Avantages insuffisants : 2 requis, 1 disponible(s).');
    repondre('yes');
    expect(hemorragies(cible(E.id)) - hemoAvant, 'le 2ᵉ État a été posé sans Avantage payé').toBe(0);
    expect(cible(H.id)!.advantage).toBe(1);
  });
});

/**
 * Déstabilisante (AA 08 l.83) — coût LITTÉRAL de 2 Avantages sur le même nœud `choice` générique :
 * le passage de Taillade au template `$indice` ne doit rien changer au porteur à coût fixe.
 */
describe('Déstabilisante — le choix à coût LITTÉRAL reste offert et libellé « (2 Av) »', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null, pendingCascade: null });
    useGame.getState().seedRng(7);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('une touche avec un fléau d’armes ouvre le choix « Renverser (2 Av) »', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.advantage = 3;
    const arme = weaponFromItem(itemFromTrappingById('serpe-de-guerre')!); // Défensive, Taille, Déstabilisante
    emitCombatEvent('onHit', {
      get: useGame.getState, set: useGame.setState, battle: useGame.getState().battle!, self: H, sink: () => {},
      triggerCtx: { victim: E, weapon: arme, location: 'corps', woundsDealt: 3, attackType: arme.type, rng: battleRng() },
    });
    const pc = useGame.getState().pendingCascade!;
    expect(pc.participants[pc.cursor].kind).toBe('triggeredChoice');
    expect(pc.participants[pc.cursor].options?.[0].label).toBe('Renverser (2 Av)');
  });
});

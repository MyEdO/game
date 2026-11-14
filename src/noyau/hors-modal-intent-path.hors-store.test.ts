/**
 * #1016 — chemin COMPLET du geste d'un invité pendant une fenêtre HORS registre de modales
 * (`modalArbiter.HORS_MODAL`) : allowlist (`GUEST_INTENTS`) → possession (`intentAllowedFor`) →
 * action jouée AU NOM du siège (`withActingSeat`) → EFFET dans l'état.
 *
 * Défaut mesuré : ces fenêtres (balayage, 2ᵉ frappe, pilonnage indirect) n'ont pas d'entrée
 * `MODAL_DEFS`, donc leurs gestes retombaient sur `modalOwnerOf`, qui ne consulte QUE `MODAL_DEFS`.
 * Sous un `destin` (1ʳᵉ entrée du registre, priorité maximale) le repli désignait la VICTIME :
 * l'attaquant qui balaie était REFUSÉ à l'intent, et le clic de la victime — accepté — mourait dans
 * la garde `controlsCombatant` du clic du combattant (`combatSlice.cliquerLeCombattant`). Résultat mesuré :
 * PERSONNE ne poursuivait le balayage.
 *
 * Le geste RÉEL voyage par `cliquerLaCase`, sur un combattant ou une case libre (dispatchés par
 * `currentTargetingMode`) — `frapperEnBalayage`/`frapperDeLaSecondeArme` sont la machinerie que `targetingModes` appelle
 * (`MachinerieDuNoyau`, #3370), hors allowlist. Le clic et ce refus sont éprouvés ici.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { initialFields } from './stateFields';
import { intentAllowedFor } from './netOwnership';
import { seatOwns } from './sieges';
import { modalOwnerOf } from './modalArbiter';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon, Main } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';

const NET0 = initialNet();
const CHARS = { 'capacite-de-combat': 55, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
const W = (uid: string, hand: Main): Weapon =>
  ({ uid, name: hand === 'main' ? 'Épée' : 'Dague', label: hand === 'main' ? 'Épée' : 'Dague', type: 'melee',
     damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand, hands: 1 } as unknown as Weapon);

const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...CHARS }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [W('m', 'main'), W('o', 'secondaire')], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18),
     resolve: 2, fortune: 2, armour: ARM(), movement: 4 }) as unknown as Combatant);

/** Arène coop : `h2` (siège 1) au contact de `e1`/`e2` et ACTIF ; `h3` (siège 2) est la VICTIME dont
 *  le `destin` s'ouvre par-dessus. `turn: -1` = pause de début de Round (combatFlow:5959) : aucun
 *  combattant actif — l'état RÉEL pendant `pendingRoundStart`. */
function setup(net: Record<string, unknown> = {}, turn = 0) {
  seedBattleRng(7);
  const h2 = mk('h2', 'heros', { x: 0, y: 0 });
  const h3 = mk('h3', 'heros', { x: 5, y: 5 });
  const e1 = mk('e1', 'ennemi', { x: 1, y: 0 });
  const e2 = mk('e2', 'ennemi', { x: 0, y: 1 });
  const battle: BattleState = {
    combatants: [h2, e1, e2, h3], order: ['h2', 'e1', 'e2', 'h3'], baseOrder: ['h2', 'e1', 'e2', 'h3'],
    turn, round: 2, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    ...initialFields(), battle, mode: 'battle', scene: testScene(), party: [h2, h3],
    net: { ...NET0, mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { h2: 1, h3: 2 },
           slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité A', 2: 'Invité B' }, ...net },
  });
  return { h2, h3, e1, e2 };
}

/** L'intention d'un siège, appliquée chez l'hôte par la fonction du noyau qu'appelle le salon (`hote/coop/salon.ts`). */
const applyIntent = (seat: number, action: string, args: unknown[] = []) => appliquerLIntentionDUnSiege(banc.getState, seat, action, args);

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('#1016 — CLIC de carte : le ciblage détenu par une fenêtre hors-modale appartient à son porteur', () => {
  it('précondition : le repli `modalOwnerOf` désigne bien la VICTIME du fateSave (pas l’attaquant)', () => {
    setup();
    banc.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 }, pendingFateSave: { heroId: 'h3', source: 'slow' } });
    expect(modalOwnerOf(banc.getState())).toBe('h3');
  });

  it('balayage sous fateSave : l’ATTAQUANT clique et enchaîne ; la victime et l’hôte sont refusés', () => {
    setup();
    banc.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 }, pendingFateSave: { heroId: 'h3', source: 'slow' } });
    expect(applyIntent(2, 'cliquerLaCase', [{ x: 0, y: 1 }, 'e2']), 'la victime pilotait le balayage d’autrui').toBe('refusee');
    expect(applyIntent(0, 'cliquerLaCase', [{ x: 0, y: 1 }, 'e2']), 'l’hôte n’est pas le porteur du balayage').toBe('refusee');
    expect(banc.getState().pendingAttack).toBeNull();
    expect(applyIntent(1, 'cliquerLaCase', [{ x: 0, y: 1 }, 'e2'])).toBe('appliquee');
    const pa = banc.getState().pendingAttack;
    expect(pa?.attackerId, 'l’attaquant était REFUSÉ : personne ne poursuivait le balayage').toBe('h2');
    expect(pa?.targetId).toBe('e2');
    expect(pa?.cleave).toBe(true);
  });

  it('témoin SANS fateSave : le clic de l’attaquant passait déjà (le repli tombait juste)', () => {
    setup();
    banc.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 } });
    expect(applyIntent(1, 'cliquerLaCase', [{ x: 0, y: 1 }, 'e2'])).toBe('appliquee');
    expect(banc.getState().pendingAttack?.cleave).toBe(true);
  });

  it('2ᵉ frappe sous fateSave : le clic appartient à l’attaquant, jamais à la victime', () => {
    setup();
    banc.setState({ pendingDualStrike: { attackerId: 'h2', offWeaponUid: 'o', jet: 43 }, pendingFateSave: { heroId: 'h3', source: 'slow' } });
    expect(applyIntent(2, 'cliquerLaCase', [{ x: 0, y: 1 }, 'e2'])).toBe('refusee');
    expect(banc.getState().pendingAttack).toBeNull();
    expect(applyIntent(1, 'cliquerLaCase', [{ x: 0, y: 1 }, 'e2'])).toBe('appliquee');
    const pa = banc.getState().pendingAttack;
    expect(pa?.dualSecond).toBe(true);
    expect(pa?.weaponUid).toBe('o');
  });

  it('pilonnage indirect (`pendingSiegeAim`) : le clic-CASE appartient à l’ARTILLEUR (AA 10)', () => {
    setup();
    banc.setState({ pendingSiegeAim: { gunnerId: 'h2', weaponUid: 'm', radius: 1, rangeTiles: null }, pendingFateSave: { heroId: 'h3', source: 'slow' } });
    expect(applyIntent(2, 'cliquerLaCase', [{ x: 3, y: 3 }])).toBe('refusee');
    expect(banc.getState().pendingSiegeAim, 'la victime posait le point d’impact de l’artilleur').not.toBeNull();
    expect(applyIntent(1, 'cliquerLaCase', [{ x: 3, y: 3 }])).toBe('appliquee');
    expect(banc.getState().pendingSiegeAim, 'l’artilleur pose son impact (le placeur se referme)').toBeNull();
  });

  it('AUCUN ciblage détenu : le clic universel garde ses règles (repli sur le combattant ACTIF)', () => {
    setup(); // tour de `h2` (siège 1), aucune fenêtre hors-modale ouverte
    expect(intentAllowedFor(banc.getState(), 1, 'cliquerLaCase', [{ x: 0, y: 1 }, 'e2'])).toBe(true);
    expect(intentAllowedFor(banc.getState(), 2, 'cliquerLaCase', [{ x: 0, y: 1 }, 'e2'])).toBe(false);
    expect(intentAllowedFor(banc.getState(), 0, 'cliquerLaCase', [{ x: 3, y: 3 }])).toBe(false);
  });

  it('NON-RÉGRESSION SOLO : hors coop, le joueur clique et enchaîne son balayage comme avant', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    banc.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 } });
    cliquerSurLeCombattant(banc.getState, 'e2');
    expect(banc.getState().pendingAttack?.cleave).toBe(true);
  });
});

/**
 * DIFFÉRENTIELLE — hors détenteur, le clic OBÉIT AU REPLI UNIVERSEL (`modalOwnerOf`, sinon le
 * propriétaire du combattant ACTIF — netOwnership.ts, fin d'`intentAllowedFor`), qui reste la règle de
 * tous les gestes non routés. Ce repli est RECALCULÉ ici et confronté au verdict réel sur les DEUX
 * clics, état par état : une route trop large (ex. « tout clic pendant un `pendingCleave` », même
 * frappe ouverte) déplacerait un verdict et se verrait ici.
 */
describe('#1016 — hors détenteur, la route ne déplace AUCUN verdict (différentielle)', () => {
  /** Le repli universel recalculé : owner de modale, sinon propriétaire du combattant actif. */
  const repli = (seat: number): boolean => {
    const s = banc.getState();
    const owner = modalOwnerOf(s);
    if (owner === '*') return true;
    if (owner !== null) return seatOwns(s, seat, owner);
    return seatOwns(s, seat, s.battle ? s.battle.order[s.battle.turn] : undefined);
  };
  const trio = (action: string, args: unknown[]) => {
    const s = banc.getState();
    return [0, 1, 2].map((seat) => intentAllowedFor(s, seat, action, args));
  };

  const ETATS: { nom: string; etat: Record<string, unknown> }[] = [
    { nom: 'tour normal, aucune fenêtre', etat: {} },
    { nom: 'fateSave d’un AUTRE héros (aucun ciblage détenu)', etat: { pendingFateSave: { heroId: 'h3', source: 'slow' } } },
    { nom: 'balayage dont la frappe est OUVERTE (pendingAttack)', etat: { pendingCleave: { attackerId: 'h2', hitIds: [], count: 0 }, pendingAttack: { attackerId: 'h2', targetId: 'e1', location: null, result: null } } },
    { nom: 'Surincantation « +Cible » (fenêtre de MODALE)', etat: { pendingCast: { casterId: 'h2', spellId: 's', pickingTargets: true } } },
    { nom: 'pose de zone d’un SORT (placing, sans centre)', etat: { pendingCast: { casterId: 'h2', spellId: 's', zone: { placing: true, radius: 1 } } } },
    { nom: 'modale prioritaire « Renoncer » sur tour normal', etat: { pendingRenounce: { heroId: 'h3' } } },
  ];

  for (const e of ETATS) {
    it(`${e.nom} : les deux clics rendent le verdict du repli universel`, () => {
      setup();
      banc.setState(e.etat as never);
      const attendu = [0, 1, 2].map(repli);
      expect(trio('cliquerLaCase', [{ x: 0, y: 1 }, 'e2']), 'clic-token dévié hors détenteur').toEqual(attendu);
      expect(trio('cliquerLaCase', [{ x: 3, y: 3 }]), 'clic-case dévié hors détenteur').toEqual(attendu);
    });
  }
});

describe('#1016 — gestes TERMINAUX de ces mêmes fenêtres (barre d’action / défense en profondeur)', () => {
  it('la sortie du balayage (bouton « Terminer » de la barre) : seul l’attaquant clôt le balayage', () => {
    setup();
    banc.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 }, pendingFateSave: { heroId: 'h3', source: 'slow' } });
    expect(applyIntent(2, 'fenetreFermer', ['frappeMortelle'])).toBe('refusee');
    expect(banc.getState().pendingCleave).not.toBeNull();
    expect(applyIntent(1, 'fenetreFermer', ['frappeMortelle'])).toBe('appliquee');
    expect(banc.getState().pendingCleave).toBeNull();
  });

  it('la sortie de la 2ᵉ frappe (bouton « Renoncer ») : seul l’attaquant renonce à sa 2ᵉ frappe', () => {
    setup();
    banc.setState({ pendingDualStrike: { attackerId: 'h2', offWeaponUid: 'o', jet: 43 }, pendingFateSave: { heroId: 'h3', source: 'slow' } });
    expect(applyIntent(2, 'fenetreFermer', ['secondeFrappe'])).toBe('refusee');
    expect(banc.getState().pendingDualStrike).not.toBeNull();
    expect(applyIntent(1, 'fenetreFermer', ['secondeFrappe'])).toBe('appliquee');
    expect(banc.getState().pendingDualStrike).toBeNull();
  });

  it('frapperEnBalayage/frapperDeLaSecondeArme sont la machinerie du clic (#3370) : hors allowlist, même pour le porteur', () => {
    setup();
    banc.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 }, pendingFateSave: { heroId: 'h3', source: 'slow' } });
    expect(applyIntent(1, 'frapperEnBalayage', ['e2'])).toBe('hors-allowlist');
    expect(applyIntent(1, 'frapperDeLaSecondeArme', ['e2'])).toBe('hors-allowlist');
    expect(banc.getState().pendingAttack).toBeFalsy();
  });

  it('fenêtre FERMÉE : le geste terminal est inerte, aucun siège ne le prend', () => {
    setup();
    for (const seat of [0, 1, 2]) expect(applyIntent(seat, 'fenetreFermer', ['frappeMortelle'])).toBe('refusee');
  });

  it('NON-RÉGRESSION SOLO : « Terminer »/« Renoncer » marchent hors coop', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    banc.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 } });
    banc.getState().fenetreFermer('frappeMortelle');
    expect(banc.getState().pendingCleave).toBeNull();
    banc.setState({ pendingDualStrike: { attackerId: 'h2', offWeaponUid: 'o', jet: 43 } });
    banc.getState().fenetreFermer('secondeFrappe');
    expect(banc.getState().pendingDualStrike).toBeNull();
  });
});

describe('#1016 — pause de début de Round (`turn: -1`) : la FENÊTRE est à tous, ses GESTES ne le sont pas', () => {
  it('roundStart.promouvoir : le siège du héros promu agit (LDB 17 l.25) ; un autre siège est refusé', () => {
    setup({}, -1);
    banc.setState({ pendingRoundStart: { round: 2 } });
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, order: ['e1', 'h2', 'e2', 'h3'] } });
    expect(applyIntent(2, 'fenetreChoisir', ['debutDuRound', 'promouvoir', 'h2'])).toBe('refusee');
    expect(banc.getState().battle!.order[0], 'un autre siège dépensait la Chance de h2').toBe('e1');
    expect(applyIntent(1, 'fenetreChoisir', ['debutDuRound', 'promouvoir', 'h2']), 'sans route, AUCUN siège invité ne promeut (pas de combattant actif)').toBe('appliquee');
    expect(banc.getState().battle!.order[0]).toBe('h2');
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h2')!.fortune).toBe(1);
  });

  it('la validation de la pause est à TOUS les sièges : chacun marque le sien, le dernier siège requis lance le Round', () => {
    setup({}, -1);
    banc.setState({ pendingRoundStart: { round: 2 } });
    for (const seat of [0, 1, 2]) expect(intentAllowedFor(banc.getState(), seat, 'fenetreValider', ['debutDuRound'])).toBe(true);
    expect(applyIntent(1, 'fenetreValider', ['debutDuRound'])).toBe('appliquee');
    expect(applyIntent(0, 'fenetreValider', ['debutDuRound'])).toBe('appliquee');
    expect(banc.getState().pendingRoundStart?.readyBySeat, 'un siège lançait le Round pour les autres').toEqual({ 0: true, 1: true });
    expect(applyIntent(2, 'fenetreValider', ['debutDuRound'])).toBe('appliquee');
    expect(banc.getState().pendingRoundStart, 'quorum atteint : le Round se lance').toBeNull();
  });
});

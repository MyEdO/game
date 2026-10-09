/**
 * #1016 — chemin COMPLET du geste d'un invité pendant une fenêtre HORS registre de modales
 * (`modalArbiter.HORS_MODAL`) : allowlist (`GUEST_INTENTS`) → possession (`intentAllowedFor`) →
 * action jouée AU NOM du siège (`withActingSeat`) → EFFET dans l'état.
 *
 * Défaut mesuré : ces fenêtres (balayage, 2ᵉ frappe, pilonnage indirect) n'ont pas d'entrée
 * `MODAL_DEFS`, donc leurs gestes retombaient sur `modalOwnerOf`, qui ne consulte QUE `MODAL_DEFS`.
 * Sous un `fateSave` (1ʳᵉ entrée du registre, priorité maximale) le repli désignait la VICTIME :
 * l'attaquant qui balaie était REFUSÉ à l'intent, et le clic de la victime — accepté — mourait dans
 * la garde `controlsCombatant` de `battleClickEntity` (combatSlice.ts:1013). Résultat mesuré :
 * PERSONNE ne poursuivait le balayage.
 *
 * Le geste RÉEL voyage par `battleClickEntity`/`battleClickTile` (dispatchés par
 * `currentTargetingMode`) — `cleaveAttack`/`dualStrikeAttack` ne sont appelés qu'EN INTERNE par
 * `targetingModes`. Les deux surfaces sont éprouvées ici, et la table `EMISSION` (plus bas) empêche
 * qu'une route porte de nouveau sur un verbe que personne n'émet.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { useGame, type BattleState } from './store';
import { initialFields } from './stateFields';
import { intentAllowedFor, withActingSeat, seatOwns, ROUTES } from './netOwnership';
import { jetOwnedIntents, participantOwnedIntents } from './flowVerbs';
import { modalOwnerOf, HORS_MODAL, horsModalOwnedIntents } from './modalArbiter';
import { GUEST_INTENTS } from '../net/intents';
import { ACTIONS } from '../data/index';
import { KEYBINDINGS } from './keybindings';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

const NET0 = useGame.getState().net;
const CHARS = { 'capacite-de-combat': 55, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
const W = (uid: string, hand: 'main' | 'off'): Weapon =>
  ({ uid, name: hand === 'main' ? 'Épée' : 'Dague', label: hand === 'main' ? 'Épée' : 'Dague', type: 'melee',
     damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand, hands: 1 } as unknown as Weapon);

const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...CHARS }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [W('m', 'main'), W('o', 'off')], advantage: 0, size: 'moyenne', pos, wounds: { base: 18, max: 18, current: 18 },
     resolve: 2, fortune: 2, armour: ARM(), movement: 4 } as unknown as Combatant);

/** Arène coop : `h2` (siège 1) au contact de `e1`/`e2` et ACTIF ; `h3` (siège 2) est la VICTIME dont
 *  le `fateSave` s'ouvre par-dessus. `turn: -1` = pause de début de Round (combatFlow:5959) : aucun
 *  combattant actif — l'état RÉEL pendant `pendingRoundStart`. */
function setup(net: Record<string, unknown> = {}, turn = 0) {
  seedBattleRng(7);
  const h2 = mk('h2', 'hero', { x: 0, y: 0 });
  const h3 = mk('h3', 'hero', { x: 5, y: 5 });
  const e1 = mk('e1', 'enemy', { x: 1, y: 0 });
  const e2 = mk('e2', 'enemy', { x: 0, y: 1 });
  const battle: BattleState = {
    combatants: [h2, e1, e2, h3], order: ['h2', 'e1', 'e2', 'h3'], baseOrder: ['h2', 'e1', 'e2', 'h3'],
    turn, round: 2, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    ...initialFields(), battle, mode: 'battle', scene: testScene(), party: [h2, h3],
    net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { h2: 1, h3: 2 },
           slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité A', 2: 'Invité B' }, ...net },
  });
  return { h2, h3, e1, e2 };
}

/** REJOUE `netFlow.applyIntent` (allowlist côté transport + possession + appel AU NOM du siège). */
function applyIntent(seat: number, action: string, args: unknown[] = []): 'hors-allowlist' | 'refusé' | 'appliqué' {
  if (!GUEST_INTENTS.has(action)) return 'hors-allowlist';
  if (!intentAllowedFor(useGame.getState(), seat, action, args)) return 'refusé';
  const fn = (useGame.getState() as unknown as Record<string, unknown>)[action];
  if (typeof fn === 'function') withActingSeat(seat, () => (fn as (...a: unknown[]) => void)(...args));
  return 'appliqué';
}

const reset = () => useGame.setState({ ...initialFields(), battle: null, net: NET0, party: [] });

describe('#1016 — CLIC de carte : le ciblage détenu par une fenêtre hors-modale appartient à son porteur', () => {
  beforeEach(reset);

  it('précondition : le repli `modalOwnerOf` désigne bien la VICTIME du fateSave (pas l’attaquant)', () => {
    setup();
    useGame.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 }, pendingFateSave: { heroId: 'h3', source: 'hit' } });
    expect(modalOwnerOf(useGame.getState())).toBe('h3');
  });

  it('balayage sous fateSave : l’ATTAQUANT clique et enchaîne ; la victime et l’hôte sont refusés', () => {
    setup();
    useGame.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 }, pendingFateSave: { heroId: 'h3', source: 'hit' } });
    expect(applyIntent(2, 'battleClickEntity', ['e2']), 'la victime pilotait le balayage d’autrui').toBe('refusé');
    expect(applyIntent(0, 'battleClickEntity', ['e2']), 'l’hôte n’est pas le porteur du balayage').toBe('refusé');
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(applyIntent(1, 'battleClickEntity', ['e2'])).toBe('appliqué');
    const pa = useGame.getState().pendingAttack;
    expect(pa?.attackerId, 'l’attaquant était REFUSÉ : personne ne poursuivait le balayage').toBe('h2');
    expect(pa?.targetId).toBe('e2');
    expect(pa?.cleave).toBe(true);
  });

  it('témoin SANS fateSave : le clic de l’attaquant passait déjà (le repli tombait juste)', () => {
    setup();
    useGame.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 } });
    expect(applyIntent(1, 'battleClickEntity', ['e2'])).toBe('appliqué');
    expect(useGame.getState().pendingAttack?.cleave).toBe(true);
  });

  it('2ᵉ frappe sous fateSave : le clic appartient à l’attaquant, jamais à la victime', () => {
    setup();
    useGame.setState({ pendingDualStrike: { attackerId: 'h2', offWeaponUid: 'o', mainRoll: 34 }, pendingFateSave: { heroId: 'h3', source: 'hit' } });
    expect(applyIntent(2, 'battleClickEntity', ['e2'])).toBe('refusé');
    expect(useGame.getState().pendingAttack).toBeNull();
    expect(applyIntent(1, 'battleClickEntity', ['e2'])).toBe('appliqué');
    const pa = useGame.getState().pendingAttack;
    expect(pa?.dualSecond).toBe(true);
    expect(pa?.weaponUid).toBe('o');
  });

  it('pilonnage indirect (`pendingSiegeAim`) : le clic-CASE appartient à l’ARTILLEUR (AA 10)', () => {
    setup();
    useGame.setState({ pendingSiegeAim: { gunnerId: 'h2', weaponUid: 'm', radius: 1, rangeTiles: null }, pendingFateSave: { heroId: 'h3', source: 'hit' } });
    expect(applyIntent(2, 'battleClickTile', [{ x: 3, y: 3 }])).toBe('refusé');
    expect(useGame.getState().pendingSiegeAim, 'la victime posait le point d’impact de l’artilleur').not.toBeNull();
    expect(applyIntent(1, 'battleClickTile', [{ x: 3, y: 3 }])).toBe('appliqué');
    expect(useGame.getState().pendingSiegeAim, 'l’artilleur pose son impact (le placeur se referme)').toBeNull();
  });

  it('AUCUN ciblage détenu : le clic universel garde ses règles (repli sur le combattant ACTIF)', () => {
    setup(); // tour de `h2` (siège 1), aucune fenêtre hors-modale ouverte
    expect(intentAllowedFor(useGame.getState(), 1, 'battleClickEntity', ['e2'])).toBe(true);
    expect(intentAllowedFor(useGame.getState(), 2, 'battleClickEntity', ['e2'])).toBe(false);
    expect(intentAllowedFor(useGame.getState(), 0, 'battleClickTile', [{ x: 3, y: 3 }])).toBe(false);
  });

  it('NON-RÉGRESSION SOLO : hors coop, le joueur clique et enchaîne son balayage comme avant', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    useGame.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 } });
    useGame.getState().battleClickEntity('e2');
    expect(useGame.getState().pendingAttack?.cleave).toBe(true);
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
  beforeEach(reset);

  /** Le repli universel recalculé : owner de modale, sinon propriétaire du combattant actif. */
  const repli = (seat: number): boolean => {
    const s = useGame.getState();
    const owner = modalOwnerOf(s);
    if (owner === '*') return true;
    if (owner !== null) return seatOwns(s, seat, owner);
    return seatOwns(s, seat, s.battle ? s.battle.order[s.battle.turn] : undefined);
  };
  const trio = (action: string, args: unknown[]) => {
    const s = useGame.getState();
    return [0, 1, 2].map((seat) => intentAllowedFor(s, seat, action, args));
  };

  const ETATS: { nom: string; etat: Record<string, unknown> }[] = [
    { nom: 'tour normal, aucune fenêtre', etat: {} },
    { nom: 'fateSave d’un AUTRE héros (aucun ciblage détenu)', etat: { pendingFateSave: { heroId: 'h3', source: 'hit' } } },
    { nom: 'balayage dont la frappe est OUVERTE (pendingAttack)', etat: { pendingCleave: { attackerId: 'h2', hitIds: [], count: 0 }, pendingAttack: { attackerId: 'h2', targetId: 'e1', location: null, result: null } } },
    { nom: 'Surincantation « +Cible » (fenêtre de MODALE)', etat: { pendingCast: { casterId: 'h2', spellId: 's', pickingTargets: true } } },
    { nom: 'pose de zone d’un SORT (placing, sans centre)', etat: { pendingCast: { casterId: 'h2', spellId: 's', zone: { placing: true, radius: 1 } } } },
    { nom: 'modale prioritaire « Renoncer » sur tour normal', etat: { pendingRenounce: { heroId: 'h3' } } },
  ];

  for (const e of ETATS) {
    it(`${e.nom} : les deux clics rendent le verdict du repli universel`, () => {
      setup();
      useGame.setState(e.etat as never);
      const attendu = [0, 1, 2].map(repli);
      expect(trio('battleClickEntity', ['e2']), 'clic-token dévié hors détenteur').toEqual(attendu);
      expect(trio('battleClickTile', [{ x: 3, y: 3 }]), 'clic-case dévié hors détenteur').toEqual(attendu);
    });
  }
});

describe('#1016 — gestes TERMINAUX de ces mêmes fenêtres (barre d’action / défense en profondeur)', () => {
  beforeEach(reset);

  it('cleaveEnd (bouton « Terminer » de la barre) : seul l’attaquant clôt le balayage', () => {
    setup();
    useGame.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 }, pendingFateSave: { heroId: 'h3', source: 'hit' } });
    expect(applyIntent(2, 'cleaveEnd', [])).toBe('refusé');
    expect(useGame.getState().pendingCleave).not.toBeNull();
    expect(applyIntent(1, 'cleaveEnd', [])).toBe('appliqué');
    expect(useGame.getState().pendingCleave).toBeNull();
  });

  it('dualStrikeSkip (bouton « Renoncer ») : seul l’attaquant renonce à sa 2ᵉ frappe', () => {
    setup();
    useGame.setState({ pendingDualStrike: { attackerId: 'h2', offWeaponUid: 'o', mainRoll: 34 }, pendingFateSave: { heroId: 'h3', source: 'hit' } });
    expect(applyIntent(2, 'dualStrikeSkip', [])).toBe('refusé');
    expect(useGame.getState().pendingDualStrike).not.toBeNull();
    expect(applyIntent(1, 'dualStrikeSkip', [])).toBe('appliqué');
    expect(useGame.getState().pendingDualStrike).toBeNull();
  });

  it('cleaveAttack/dualStrikeAttack (aucun émetteur d’UI) sont routés QUAND MÊME sur le porteur', () => {
    setup();
    useGame.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 }, pendingFateSave: { heroId: 'h3', source: 'hit' } });
    expect(applyIntent(2, 'cleaveAttack', ['e2'])).toBe('refusé');
    expect(applyIntent(1, 'cleaveAttack', ['e2'])).toBe('appliqué');
    expect(useGame.getState().pendingAttack?.cleave).toBe(true);
  });

  it('fenêtre FERMÉE : le geste terminal est inerte, aucun siège ne le prend', () => {
    setup();
    for (const seat of [0, 1, 2]) expect(applyIntent(seat, 'cleaveEnd', [])).toBe('refusé');
  });

  it('NON-RÉGRESSION SOLO : « Terminer »/« Renoncer » marchent hors coop', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    useGame.setState({ pendingCleave: { attackerId: 'h2', hitIds: ['e1'], count: 0 } });
    useGame.getState().cleaveEnd();
    expect(useGame.getState().pendingCleave).toBeNull();
    useGame.setState({ pendingDualStrike: { attackerId: 'h2', offWeaponUid: 'o', mainRoll: 34 } });
    useGame.getState().dualStrikeSkip();
    expect(useGame.getState().pendingDualStrike).toBeNull();
  });
});

describe('#1016 — pause de début de Round (`turn: -1`) : la FENÊTRE est à tous, ses GESTES ne le sont pas', () => {
  beforeEach(reset);

  it('roundStartPromote : le siège du héros promu agit (LDB 17 l.25) ; un autre siège est refusé', () => {
    setup({}, -1);
    useGame.setState({ pendingRoundStart: { round: 2 } });
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, order: ['e1', 'h2', 'e2', 'h3'] } });
    expect(applyIntent(2, 'roundStartPromote', ['h2'])).toBe('refusé');
    expect(useGame.getState().battle!.order[0], 'un autre siège dépensait la Chance de h2').toBe('e1');
    expect(applyIntent(1, 'roundStartPromote', ['h2']), 'sans route, AUCUN siège invité ne promeut (pas de combattant actif)').toBe('appliqué');
    expect(useGame.getState().battle!.order[0]).toBe('h2');
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'h2')!.fortune).toBe(1);
  });

  it('confirmRoundStart : lancé par l’HÔTE (unanimité du ready-check), refusé aux invités', () => {
    setup({}, -1);
    useGame.setState({ pendingRoundStart: { round: 2 } });
    expect(applyIntent(1, 'confirmRoundStart', [])).toBe('refusé');
    expect(applyIntent(2, 'confirmRoundStart', [])).toBe('refusé');
    expect(useGame.getState().pendingRoundStart, 'un invité lançait le Round pour les autres').not.toBeNull();
    expect(applyIntent(0, 'confirmRoundStart', [])).toBe('appliqué');
    expect(useGame.getState().pendingRoundStart).toBeNull();
  });

  it('roundStartReady reste ouvert à TOUS les sièges (c’est LA voie de l’invité)', () => {
    setup({}, -1);
    useGame.setState({ pendingRoundStart: { round: 2 } });
    for (const seat of [0, 1, 2]) expect(intentAllowedFor(useGame.getState(), seat, 'roundStartReady', [seat])).toBe(true);
  });
});

/**
 * ÉMISSION — une route ne protège que ce que quelqu'un ÉMET. Le défaut d'origine était exactement
 * là : `cleaveAttack` routé alors qu'AUCUN site d'écran ne le demande (le clic voyage par
 * `battleClickEntity`). Chaque intent routé par #1016 déclare donc son émetteur, et le scan
 * CONFRONTE la déclaration aux sources d'écran.
 * UN GESTE PEUT ÊTRE ÉMIS PAR TROIS CHEMINS, et le scan les connaît tous les trois :
 *   1. TEXTUEL — le nom du verbe apparaît dans une source d'écran (`src/ui`/`src/gameIso`) ;
 *   2. RELAI DU REGISTRE — une entrée d'`actions.json` déclare `run: <verbe>` ET porte une surface
 *      vivante (case de console, bandeau d'interlude, touche du registre) : l'écran l'émet par
 *      `runAction(<id>)`, sans jamais nommer le verbe ;
 *   3. REGISTRE CLAVIER — `keybindings.ts` appelle le verbe directement (une touche EST une surface,
 *      même définition que la garde d'atteignabilité des actions).
 * DEUX LIMITES DÉCLARÉES : (a) le scan reste TEXTUEL — il prouve l'existence d'un site d'émission,
 * JAMAIS son atteignabilité à l'écran (bouton affiché, affordance ouverte), qui se juge en recette
 * navigateur ; (b) la liste confrontée à cette table est DÉRIVÉE de `netOwnership.ROUTES` (#1051) —
 * toute route nominative doit donc déclarer son émetteur, sauf celles que `Route.horsAllowlist`
 * marque inatteignables par le réseau.
 */
const EMISSION: Record<string, { parUI: true } | { interne: string; dans: string } | { sansSurface: string }> = {
  battleClickEntity: { parUI: true },
  battleClickTile: { parUI: true },
  cleaveEnd: { parUI: true },
  dualStrikeSkip: { parUI: true },
  roundStartPromote: { parUI: true },
  // Pause de Round : le bandeau de la console et la touche passent tous deux par l'entrée
  // `round-start` du registre (#1411 P2-A) — c'est SON dispatcher qui arbitre solo (ouvrir) et coop
  // (marquer le siège prêt). Aucun écran ne nomme plus ces deux verbes : la porte est unique.
  confirmRoundStart: { interne: 'actionRegistry.ACTION_RUN.roundStart — porte unique du geste « commencer » (solo)', dans: 'src/state/actionRegistry.ts' },
  roundStartReady: { interne: 'actionRegistry.ACTION_RUN.roundStart — porte unique du geste « prêt » (coop)', dans: 'src/state/actionRegistry.ts' },
  victoryReady: { parUI: true },
  // Demande de pause au prochain Round : l'interrupteur du pied de FRISE (`raise-hand`, relais du
  // registre). Les deux sens passent par le même dispatcher, d'où le retrait `interne`.
  raiseHand: { parUI: true },
  lowerHand: { interne: 'actionRegistry.ACTION_RUN.raiseHand — le retrait est le `toggleOff` de la même entrée', dans: 'src/state/actionRegistry.ts' },
  assignVictoryGear: { parUI: true },
  // Carnet d'enquête (#670) : l'épingle et la nouveauté vue, émises par `CarnetScreen`.
  toggleCluePin: { parUI: true },
  markCluesSeen: { parUI: true },
  partyAddHero: { parUI: true },
  partyRemoveHero: { parUI: true },
  partyReplaceHero: { parUI: true },
  interludeActivity: { parUI: true },
  interludeCraftStart: { parUI: true },
  interludeOrder: { parUI: true },
  interludeBank: { parUI: true },
  interludeWithdraw: { parUI: true },
  // Barre de console : écrite par l'effet post-rendu de `CombatConsole` au premier affichage.
  materialiserBarre: { parUI: true },
  // Tir rapide (#1050) : le badge de la frise ARME la visée ; le tir lui-même part du clic-token.
  armPreempt: { parUI: true },
  cascadeResist: { parUI: true },
  // PHASE 1 du Contre-sort (#1042/#1059) : le choix de déclaration vit SUR la rangée, dans la modale
  // d'incantation ; « tout déclarer » est un verbe NULLAIRE du drive d'auto-cadence (aucun bouton).
  counterspellDeclare: { parUI: true },
  // Déclaration d'une rangée de chute volontaire (#700) : option de la rangée dans `FallModal`.
  fallChoose: { parUI: true },
  // « Laisser passer » : action de la barre de la modale d'incantation — routée depuis #1042 pour
  // porter la frontière de phase (elle tombait sur le repli universel avant).
  counterspellCancel: { parUI: true },
  counterspellDeclareAll: { interne: 'combatAuto.STEP_WINDOW_AUTO — drive de la fenêtre réactive', dans: 'src/state/combatAuto.ts' },
  preemptRangedShot: { interne: 'combatSlice.battleClickEntity — le clic voyage par battleClickEntity (visée armée)', dans: 'src/state/combatSlice.ts' },
  // Verbes NULLAIRES du drive d'auto-cadence (#1030) : aucun bouton, le pilote local les enchaîne.
  counterspellRollAll: { interne: 'combatAuto.STEP_WINDOW_AUTO — drive de la fenêtre réactive', dans: 'src/state/combatAuto.ts' },
  oppositionRollAll: { interne: 'combatAuto.STEP_WINDOW_AUTO — drive de la fenêtre réactive', dans: 'src/state/combatAuto.ts' },
  cleaveAttack: { interne: 'targetingModes.CLEAVE_MODE.commitCombatant — le clic voyage par battleClickEntity', dans: 'src/state/targetingModes.ts' },
  dualStrikeAttack: { interne: 'targetingModes.DUAL_MODE.commitCombatant — le clic voyage par battleClickEntity', dans: 'src/state/targetingModes.ts' },
};

/** Sources d'ÉCRAN (hors fichiers de test) : `src/ui` + `src/gameIso`. */
const ecranSources = (): string[] => readCorpus(['src/ui', 'src/gameIso']).map(({ text }) => text);

/** Surfaces VIVANTES d'une entrée du registre : une case de console (site d'appel `cellFor('<id>')`
 *  ou `data-action="<id>"`), le bandeau d'interlude que la console rend depuis le registre, ou une
 *  touche du registre clavier. Même définition que la garde `action-atteignabilite`. */
function actionsAvecSurface(): Set<string> {
  const src = readFileSync(join(process.cwd(), 'src', 'ui', 'CombatConsole.tsx'), 'utf8');
  const frise = readFileSync(join(process.cwd(), 'src', 'ui', 'InitiativeStrip.tsx'), 'utf8');
  const cles = [
    ...[...src.matchAll(/cellFor\(\s*'([^']+)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/runAction\(\s*'([^']+)'/g)].map((m) => m[1]),
    ...[...frise.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]),
    ...KEYBINDINGS.map((b) => b.id),
  ];
  if (/currentInterludeAction/.test(src)) for (const a of ACTIONS) if (a.surface === 'interlude') cles.push(a.id);
  const vivantes = new Set(cles);
  return new Set(ACTIONS.filter((a) => [a.id, ...(a.keys ?? [])].some((k) => vivantes.has(k))).map((a) => a.id));
}

/** Verbes que le REGISTRE relaie pour l'écran : `run` d'une action qui porte une surface vivante. */
function verbesRelayesParLeRegistre(): Set<string> {
  const avecSurface = actionsAvecSurface();
  return new Set(ACTIONS.filter((a) => a.run && avecSurface.has(a.id)).map((a) => a.run!));
}

describe('#1016 — toute route porte sur un geste RÉELLEMENT émis (ou déclare son site interne)', () => {
  const emis = (name: string, sources: string[]) => sources.some((src) => src.includes(name));
  const CLAVIER_SRC = readFileSync(join(process.cwd(), 'src', 'state', 'keybindings.ts'), 'utf8');
  /** Les trois chemins d'émission (voir l'en-tête d'`EMISSION`). */
  const emisParUneSurface = (n: string, sources: string[], relais: Set<string>) =>
    emis(n, sources) || relais.has(n) || CLAVIER_SRC.includes(n);

  it('précondition : le scan voit bien des sources d’écran, un relais de registre et un registre clavier', () => {
    expect(ecranSources().length).toBeGreaterThan(50);
    expect(verbesRelayesParLeRegistre().size).toBeGreaterThan(10);
    expect(KEYBINDINGS.length).toBeGreaterThan(10);
  });

  it('les intents déclarés `parUI` ONT un site d’émission (écran, relais du registre ou touche)', () => {
    const sources = ecranSources();
    const relais = verbesRelayesParLeRegistre();
    const muets = Object.entries(EMISSION)
      .filter(([, e]) => 'parUI' in e).map(([n]) => n)
      .filter((n) => !emisParUneSurface(n, sources, relais));
    expect(muets, 'route déclarée « émise par l’UI » sans aucun site — la route est MORTE').toEqual([]);
  });

  it('les intents déclarés `sansSurface` n’en ont VRAIMENT aucune, et portent leur destination', () => {
    const sources = ecranSources();
    const relais = verbesRelayesParLeRegistre();
    const decl = Object.entries(EMISSION).filter(([, e]) => 'sansSurface' in e) as [string, { sansSurface: string }][];
    const perimees = decl.map(([n]) => n).filter((n) => emisParUneSurface(n, sources, relais));
    expect(perimees, 'déclaré sans surface alors qu’un émetteur existe — le reclasser `parUI`').toEqual([]);
    const muettes = decl.filter(([, e]) => e.sansSurface.trim().length < 15).map(([n]) => n);
    expect(muettes, 'entrée `sansSurface` sans adresse de destination').toEqual([]);
  });

  it('les intents déclarés `interne` n’ont AUCUN site d’écran, et le site nommé existe', () => {
    const sources = ecranSources();
    const internes = Object.entries(EMISSION).filter(([, e]) => 'interne' in e) as [string, { interne: string; dans: string }][];
    expect(internes.map(([n]) => n), 'précondition : au moins une route de défense en profondeur').not.toEqual([]);
    const menteuses = internes.map(([n]) => n).filter((n) => emis(n, sources));
    expect(menteuses, 'déclaré interne mais émis par un écran — le reclasser `parUI`').toEqual([]);
    // Le fichier NOMMÉ par la déclaration doit contenir l'appel : un site interne inventé se voit ici.
    const absents = internes.filter(([n, e]) => !readFileSync(join(process.cwd(), ...e.dans.split('/')), 'utf8').includes(n)).map(([n]) => n);
    expect(absents, 'site interne nommé mais introuvable dans le fichier déclaré').toEqual([]);
  });

  it('toute route NOMINATIVE de `ROUTES` figure dans EMISSION (aucune route sans verdict d’émission)', () => {
    const derivees = new Set([...Object.keys(jetOwnedIntents()), ...participantOwnedIntents()]);
    const routes = [...ROUTES.keys()].filter((a) => !derivees.has(a));
    expect(routes.length, 'précondition : la table expose bien ses routes nominatives').toBeGreaterThan(10);
    const sansVerdict = routes.filter((n) => !(n in EMISSION) && !ROUTES.get(n)!.horsAllowlist);
    expect(sansVerdict, 'route sans entrée EMISSION — déclarer qui l’émet').toEqual([]);
  });
});

describe('#1016 — la route est DÉRIVÉE du registre HORS_MODAL (aucune table parallèle)', () => {
  it('chaque intent déclaré par `HORS_MODAL.intents` existe dans le store ET est exposé à l’invité', () => {
    const store = useGame.getState() as unknown as Record<string, unknown>;
    const routes = horsModalOwnedIntents();
    expect(Object.keys(routes), 'précondition : le registre route bien des intents').not.toEqual([]);
    for (const [action, def] of Object.entries(routes)) {
      expect(typeof store[action], `${action} : route sur une action inexistante`).toBe('function');
      expect(GUEST_INTENTS.has(action), `${action} : routé mais jamais atteignable par un invité`).toBe(true);
      expect(HORS_MODAL.some((d) => d.key === def.key), `${action} : owner hors registre`).toBe(true);
    }
  });

  it('les 4 gestes terminaux du ticket sont routés par leur pending (pas par la modale active)', () => {
    expect(Object.keys(horsModalOwnedIntents()).sort())
      .toEqual(['cleaveAttack', 'cleaveEnd', 'dualStrikeAttack', 'dualStrikeSkip']);
  });
});

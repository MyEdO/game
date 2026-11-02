/**
 * #1017 — le chemin COMPLET d'un intent invité, joué chez l'HÔTE : allowlist (`GUEST_INTENTS`) →
 * possession (`intentAllowedFor`) → appel de l'action → EFFET (le pending est posé).
 *
 * Défaut mesuré avant le socle du siège AGISSANT (recette coop, scénario « Battement ») : l'invité
 * clique, l'hôte ACCEPTE l'intent… et rien ne se passe, sans journal ni erreur. La cause n'était pas
 * la route de possession (elle rendait `true`) mais la garde INTERNE de l'action : `battleBattement`
 * (comme les ~30 autres gestes de tour de `combatSlice`) exige `controlsCombatant`, bâti sur
 * `ownsLocal` — donc sur `net.mySeat`, qui vaut l'HÔTE pendant qu'il applique l'intent d'un AUTRE
 * siège. L'action refusait le geste d'un invité sur son PROPRE héros.
 *
 * Ce test exerce la chaîne de `appliquerLIntentionDUnSiege` (celle que `netFlow` appelle), sur DEUX
 * ouvreurs : `battleBattement` (exposé par #1017) et `battleDisengage` (exposé bien AVANT — il
 * souffrait du même mal, ce qui prouve que la CLASSE est fermée, pas un cas).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import type { BattleState } from '../noyau/etat';
import { appliquerLIntentionDUnSiege } from '../noyau/intentionsDeSiege';
import { seedBattleRng } from '../noyau/battleRng';
import { testScene } from '../scenes/test-fixture';
import { initialNet } from '../noyau/etat';
import { makePregens } from '../data/pregens';
import type { Combatant, Weapon } from '../engine/types';
import { createHero } from '../engine/character';
import { draineCascade } from '../noyau/cascade.testkit';
import { modalOwnerOf } from '../noyau/modalArbiter';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const NET0 = useGame.getState().net;
const chars = { 'capacite-de-combat': 55, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, talents: { talentId: string }[] = []): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents,
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18), resolve: 2, fortune: 2,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** Arène coop : `h2` (héros du siège 1, Battement en poche) engagé avec `e1`, et c'est SON tour. */
function setup(net: Record<string, unknown> = {}) {
  seedBattleRng(7);
  const hero = mk('h2', 'hero', { x: 0, y: 0 }, [{ talentId: 'battement' }]);
  const enemy = mk('e1', 'enemy', { x: 1, y: 0 });
  (hero as unknown as { engagedWith: string[] }).engagedWith = ['e1'];
  (enemy as unknown as { engagedWith: string[] }).engagedWith = ['h2'];
  const battle: BattleState = {
    combatants: [hero, enemy], order: ['h2', 'e1'], baseOrder: ['h2', 'e1'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [hero],
    pendingBattement: null, pendingDisengage: null, pendingCascade: null, pendingAttack: null,
    net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { h2: 1 }, slots: [1, 0, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' }, ...net },
  });
  return { hero, enemy };
}

/** L'intention d'un siège, appliquée chez l'hôte par la fonction du noyau qu'appelle `netFlow`. */
const applyIntent = (seat: number, action: string, args: unknown[] = []) => appliquerLIntentionDUnSiege(useGame.getState, seat, action, args);

describe('#1017 — chemin intent invité : l’action AGIT, pas seulement l’allowlist', () => {
  beforeEach(() => { useGame.setState({ net: NET0, battle: null, pendingBattement: null, pendingDisengage: null, pendingRoundStart: null, pendingVictory: null, pendingRest: null }); });

  it('battleBattement (ouvreur exposé par #1017) : le siège du héros OUVRE réellement le jet', () => {
    setup();
    expect(applyIntent(1, 'battleBattement', [])).toBe('appliquee');
    const pb = useGame.getState().pendingBattement;
    expect(pb, 'le pending est POSÉ (avant le socle : null, en silence)').toBeTruthy();
    expect(pb!.attackerId).toBe('h2');
    expect(pb!.foeId).toBe('e1');
  });

  it('battleDisengage (intent HISTORIQUE) : la classe entière est fermée, pas le seul Battement', () => {
    setup();
    expect(applyIntent(1, 'battleDisengage', [])).toBe('appliquee');
    expect(useGame.getState().pendingDisengage, 'le Désengagement s’ouvre aussi pour l’invité').toBeTruthy();
  });

  it('siège NON possesseur : l’intent est REFUSÉ en amont, et rien ne bouge', () => {
    setup();
    expect(applyIntent(2, 'battleBattement', [])).toBe('refusee');
    expect(useGame.getState().pendingBattement).toBeNull();
  });

  it('le contexte ne DÉBORDE pas : hors application d’intent, l’hôte ne joue pas le héros d’un invité', () => {
    setup();
    useGame.getState().battleBattement(); // appel DIRECT (clic de l'hôte sur son propre écran)
    expect(useGame.getState().pendingBattement, 'l’hôte n’ouvre pas le jet d’un héros distant').toBeNull();
    // …et le contexte est bien retombé après l'intent précédent (aucune fuite entre gestes).
    expect(applyIntent(1, 'battleBattement', [])).toBe('appliquee');
    expect(useGame.getState().pendingBattement).toBeTruthy();
    useGame.setState({ pendingBattement: null });
    useGame.getState().battleBattement();
    expect(useGame.getState().pendingBattement, 'après le finally, l’hôte est redevenu l’hôte').toBeNull();
  });

  it('NON-RÉGRESSION SOLO : sans coop, le joueur ouvre son Battement comme avant', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    useGame.getState().battleBattement();
    expect(useGame.getState().pendingBattement).toBeTruthy();
  });
});

describe('appliquerLIntentionDUnSiege — allowlist, possession, siège du transport', () => {
  beforeEach(() => { useGame.setState({ net: NET0, battle: null, pendingBattement: null, journal: [], party: [] }); });

  it('hors allowlist : ignorée en silence, sans effet ni ligne de journal', () => {
    setup();
    useGame.setState({ journal: [] });
    expect(applyIntent(1, 'setGmSeat', [1])).toBe('hors-allowlist');
    expect(useGame.getState().net.gmSeat, 'l’action hors liste a atteint le store de l’hôte').toBeUndefined();
    expect(useGame.getState().journal).toEqual([]);
  });

  it('hors possession : le refus va au journal, en libellé joueur', () => {
    setup();
    useGame.setState({ journal: [] });
    expect(applyIntent(2, 'battleBattement', [])).toBe('refusee');
    expect(useGame.getState().journal).toEqual(['Action refusée : elle ne revient pas au joueur qui l’a demandée.']);
  });

  const pregen = (id: string): Combatant => ({ ...JSON.parse(JSON.stringify(makePregens()[0])), id, label: id });
  const hoteEtUnInvite = () => useGame.setState({
    party: [], journal: [], net: { ...initialNet(), mode: 'host', seatNames: { 0: 'Hôte', 1: 'Invité' }, slots: [1, 0, 0, 0] },
  });

  it('composition : `partyAddHero` prend le siège du transport, jamais celui des args', () => {
    hoteEtUnInvite();
    expect(applyIntent(1, 'partyAddHero', [pregen('g1'), undefined, 0])).toBe('appliquee');
    expect(useGame.getState().net.ownership.g1, 'l’invité a posé son héros au siège qu’il a choisi').toBe(1);
  });

  it('composition : `partyReplaceHero` aussi', () => {
    hoteEtUnInvite();
    expect(applyIntent(1, 'partyAddHero', [pregen('g1')])).toBe('appliquee');
    expect(applyIntent(1, 'partyReplaceHero', ['g1', pregen('g2'), 0])).toBe('appliquee');
    expect(useGame.getState().net.ownership.g2, 'l’invité a posé son héros au siège qu’il a choisi').toBe(1);
  });

  it.each([
    ['roundStartReady', 'pendingRoundStart', { round: 2 }],
    ['victoryReady', 'pendingVictory', { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [], defeated: [] }],
    ['restReady', 'pendingRest', { phase: 'setup', perHero: {}, readyBySeat: {} }],
  ] as const)('marquage : `%s` émis par le siège 1 ne marque que le siège 1, quels que soient ses args (#2439)', (verbe, cle, pending) => {
    setup();
    useGame.setState({ [cle]: pending } as never);
    expect(applyIntent(1, verbe, [0])).toBe('appliquee');
    expect((useGame.getState()[cle] as { readyBySeat?: Record<number, boolean> } | null)?.readyBySeat, `${verbe} a marqué un autre siège que l’émetteur`).toEqual({ 1: true });
  });
});

/**
 * #2903 — « Annuler » un jet, demandé par un siège : le PORTEUR du jet le referme, un autre siège ne
 * le referme pas. Contrat de possession de la clôture d'un flux de jet (`FLOW_VERBS`), joué par
 * `appliquerLIntentionDUnSiege` comme `netFlow` le joue chez l'hôte.
 */
describe('#2903 — Annuler un jet par intention : seul le siège du porteur referme', () => {
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Interlude coop : le héros du siège 1 ouvre son Activité « Revenus » par SA propre intention. */
  function activiteOuverte() {
    vi.useFakeTimers();
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    useGame.setState({ net: NET0, party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, pendingCascade: null, journal: [] });
    useGame.getState().startScene(testScene());
    vi.clearAllTimers();
    useGame.getState().seedRng(13);
    useGame.getState().startInterlude(3);
    draineCascade(useGame.getState);
    const itl = useGame.getState().interlude!;
    itl.perHero[h.id] = { ...itl.perHero[h.id], fx: undefined, left: 2 };
    useGame.setState({
      interlude: { ...itl },
      net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { [h.id]: 1 }, slots: [1, 0, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } },
    });
    expect(applyIntent(1, 'interludeActivity', [h.id, 'revenus'])).toBe('appliquee');
    expect(useGame.getState().pendingActivity?.heroId).toBe(h.id);
    return h;
  }

  it('Activité : un siège tiers est refusé et le jet reste ouvert ; le siège du héros le referme', () => {
    const h = activiteOuverte();
    expect(applyIntent(2, 'activityCancel')).toBe('refusee');
    expect(useGame.getState().pendingActivity?.heroId, 'le jet d’autrui reste ouvert').toBe(h.id);
    expect(applyIntent(1, 'activityCancel')).toBe('appliquee');
    expect(useGame.getState().pendingActivity).toBeNull();
  });

  it('Désengagement : un siège tiers est refusé ; le siège du héros renonce et la cascade-hôte se ferme', () => {
    setup();
    expect(applyIntent(1, 'battleDisengage', [])).toBe('appliquee');
    expect(useGame.getState().pendingCascade, 'l’étape hôte est ouverte').toBeTruthy();
    expect(applyIntent(2, 'disengageCancel')).toBe('refusee');
    expect(useGame.getState().pendingDisengage, 'le choix d’autrui reste ouvert').toBeTruthy();
    expect(applyIntent(1, 'disengageCancel')).toBe('appliquee');
    expect(useGame.getState().pendingDisengage).toBeNull();
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  /** Le Désengagement ENGAGÉ (LDB 15 l.49 : l'Esquive est l'Action ; l.63 : la Fuite donne aussitôt
   *  +1 Avantage) : le siège du héros demande à renoncer, l'action le REFUSE et le dit, rien ne bouge. */
  it.each([
    ['esquive', 'disengageRoll'],
    ['fuir', 'disengageFlee'],
  ] as const)('Désengagement en phase %s : renoncer est refusé, visiblement, et ne change rien', (phase, geste) => {
    const { enemy } = setup();
    expect(applyIntent(1, 'battleDisengage', [])).toBe('appliquee');
    expect(applyIntent(1, geste, [])).toBe('appliquee');
    const avant = useGame.getState();
    expect(avant.pendingDisengage?.phase).toBe(phase);
    const avantageDuFoe = avant.battle!.combatants.find((c) => c.id === enemy.id)!.advantage;
    expect(applyIntent(1, 'disengageCancel')).toBe('appliquee');
    const apres = useGame.getState();
    expect(apres.pendingDisengage, 'le Désengagement engagé reste ouvert').toBe(avant.pendingDisengage);
    expect(apres.pendingCascade, 'sa cascade-hôte aussi').toBe(avant.pendingCascade);
    expect(apres.battle!.combatants.find((c) => c.id === enemy.id)!.advantage).toBe(avantageDuFoe);
    expect(apres.refus?.texte).toBe('Renoncement refusé : h2 a déjà engagé son Désengagement, il se joue jusqu’au bout.');
  });

  it('Désengagement en phase fuir, fenêtre PARTAGÉE (`groupOwner`) : un siège tiers est refusé par la possession', () => {
    setup();
    expect(applyIntent(1, 'battleDisengage', [])).toBe('appliquee');
    expect(applyIntent(1, 'disengageFlee', [])).toBe('appliquee');
    const c = useGame.getState().pendingCascade!;
    useGame.setState({ pendingCascade: { ...c, participants: c.participants.map((p, i) => (i === c.cursor ? { ...p, groupOwner: true } : p)) } });
    expect(modalOwnerOf(useGame.getState()), 'la fenêtre est à tous').toBe('*');
    const avant = useGame.getState();
    expect(applyIntent(2, 'disengageCancel')).toBe('refusee');
    expect(useGame.getState().pendingDisengage).toBe(avant.pendingDisengage);
    expect(useGame.getState().pendingCascade).toBe(avant.pendingCascade);
  });
});

/**
 * #1017 — le chemin COMPLET d'un intent invité, joué chez l'HÔTE : allowlist (`GUEST_INTENTS`) →
 * possession (`intentAllowedFor`) → appel de l'action → EFFET (le pending est posé).
 *
 * La garde INTERNE de l'action lit le siège AGISSANT : `faireUnBattement` (comme les ~30 autres gestes de
 * tour de `combatSlice`) exige `controlsCombatant`, bâti sur `ownsLocal`, qui juge le siège qui DÉCIDE
 * (`decidingSeat`) — le siège de l'intent pendant son application, jamais le seul `net.mySeat` de l'HÔTE.
 * L'intent acceptée d'un invité sur son PROPRE héros agit : le pending est posé.
 *
 * Ce test exerce la chaîne de `appliquerLIntentionDUnSiege` (celle que l'hôte passe à `heberger`, `hote/coop/salon.ts`), sur DEUX
 * verbes ouvreurs de la barre : `faireUnBattement` (offre `battement`, exposé par #1017) et `rompreLEngagement` (offre
 * `disengage`, d'une autre famille — la même garde les sert, ce qui prouve que la CLASSE est fermée, pas un cas).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { initialNet } from './etat';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import type { Combatant, Weapon } from '../engine/types';
import { createHero } from '../engine/character';
import { draineCascade } from './cascade.testkit';
import { modalOwnerOf } from './modalArbiter';
import { FLOW_VERBS, NOM_DU_VERBE_DE_JET, estVerbeDeFenetre, type RollVerb } from './flowVerbs';
import { testDeRegle } from '../engine/reglesChiffrees';
import { intentAllowedFor } from './netOwnership';
import { refusDAjoutAuGroupe } from './partyFlow';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { engage } from './creation/engagement.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const NET0 = initialNet();
const chars = { 'capacite-de-combat': 55, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, talents: { talentId: string }[] = []): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents,
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18), resolve: 2, fortune: 2,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** Arène coop : `h2` (héros du siège 1, Battement en poche) engagé avec `e1`, et c'est SON tour. */
function setup(net: Record<string, unknown> = {}) {
  seedBattleRng(7);
  const hero = mk('h2', 'heros', { x: 0, y: 0 }, [{ talentId: 'battement' }]);
  const enemy = mk('e1', 'ennemi', { x: 1, y: 0 });
  (hero as unknown as { engagedWith: string[] }).engagedWith = ['e1'];
  (enemy as unknown as { engagedWith: string[] }).engagedWith = ['h2'];
  const battle: BattleState = {
    combatants: [hero, enemy], order: ['h2', 'e1'], baseOrder: ['h2', 'e1'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    battle, mode: 'battle', screen: 'campaign', scene: testScene(), party: [hero],
    pendingBattement: null, pendingDisengage: null, pendingCascade: null, pendingAttack: null,
    net: { ...NET0, mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { h2: 1 }, slots: [1, 0, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' }, ...net },
  });
  return { hero, enemy };
}

/** L'intention d'un siège, appliquée chez l'hôte par la fonction du noyau qu'appelle le salon (`hote/coop/salon.ts`). */
const applyIntent = (seat: number, action: string, args: unknown[] = []) => appliquerLIntentionDUnSiege(banc.getState, seat, action, args);

describe('#1017 — chemin intent invité : l’action AGIT, pas seulement l’allowlist', () => {
  it('`battement` (ouvreur exposé par #1017) : le siège du héros OUVRE réellement le jet', () => {
    setup();
    expect(applyIntent(1, 'faireUnBattement', [])).toBe('appliquee');
    const pb = banc.getState().pendingBattement;
    expect(pb, 'le pending est POSÉ (avant le socle : null, en silence)').toBeTruthy();
    expect(pb!.attackerId).toBe('h2');
    expect(pb!.foeId).toBe('e1');
  });

  it('`disengage` (intent HISTORIQUE) : la classe entière est fermée, pas le seul Battement', () => {
    setup();
    expect(applyIntent(1, 'rompreLEngagement', [])).toBe('appliquee');
    expect(banc.getState().pendingDisengage, 'le Désengagement s’ouvre aussi pour l’invité').toBeTruthy();
  });

  it('siège NON possesseur : l’intent est REFUSÉ en amont, et rien ne bouge', () => {
    setup();
    expect(applyIntent(2, 'faireUnBattement', [])).toBe('refusee');
    expect(banc.getState().pendingBattement).toBeNull();
  });

  it('le contexte ne DÉBORDE pas : hors application d’intent, l’hôte ne joue pas le héros d’un invité', () => {
    setup();
    banc.getState().faireUnBattement(); // appel DIRECT (clic de l'hôte sur son propre écran)
    expect(banc.getState().pendingBattement, 'l’hôte n’ouvre pas le jet d’un héros distant').toBeNull();
    // …et le contexte est bien retombé après l'intent précédent (aucune fuite entre gestes).
    expect(applyIntent(1, 'faireUnBattement', [])).toBe('appliquee');
    expect(banc.getState().pendingBattement).toBeTruthy();
    banc.setState({ pendingBattement: null });
    banc.getState().faireUnBattement();
    expect(banc.getState().pendingBattement, 'après le finally, l’hôte est redevenu l’hôte').toBeNull();
  });

  it('NON-RÉGRESSION SOLO : sans coop, le joueur ouvre son Battement comme avant', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    banc.getState().faireUnBattement();
    expect(banc.getState().pendingBattement).toBeTruthy();
  });
});

describe('appliquerLIntentionDUnSiege — allowlist, possession, siège du transport', () => {
  it('hors allowlist : ignorée en silence, sans effet ni ligne de journal', () => {
    setup();
    banc.setState({ journal: [] });
    expect(applyIntent(1, 'affecterLeSiegeMJ', [1])).toBe('hors-allowlist');
    expect(banc.getState().net.gmSeat, 'l’action hors liste a atteint le store de l’hôte').toBeUndefined();
    expect(banc.getState().journal).toEqual([]);
  });

  it('hors possession : le refus va au journal, en libellé joueur', () => {
    setup();
    banc.setState({ journal: [] });
    expect(applyIntent(2, 'faireUnBattement', [])).toBe('refusee');
    expect(banc.getState().journal).toEqual(['Action refusée : elle ne revient pas au joueur qui l’a demandée.']);
  });

  const pregen = (id: string): Combatant => ({ ...JSON.parse(JSON.stringify(tousLesHerosDeScenario(idsDeTest)[0])), id, label: id });
  const hoteEtUnInvite = () => banc.setState({
    party: [], journal: [], net: { ...initialNet(), mode: 'hote', seatNames: { 0: 'Hôte', 1: 'Invité' }, slots: [1, 0, 0, 0] },
  });

  it('composition : `recruterLeHeros` prend le siège du transport, jamais celui des args', () => {
    hoteEtUnInvite();
    expect(applyIntent(1, 'recruterLeHeros', [engage('g1'), 0])).toBe('appliquee');
    expect(banc.getState().net.ownership.g1, 'l’invité a posé son héros au siège qu’il a choisi').toBe(1);
  });

  it('composition : l’intent d’un invité au groupe plein est refusé par le geste, et le verdict de SON siège le dit', () => {
    const quatre = ['h1', 'h2', 'h3', 'h4'].map(pregen);
    banc.setState({
      party: quatre, journal: [],
      net: { ...initialNet(), mode: 'hote', seatNames: { 0: 'Hôte', 1: 'Invité' }, slots: [0, 0, 0, 1], ownership: { h1: 0, h2: 0, h3: 0, h4: 0 } },
    });
    expect(applyIntent(1, 'recruterLeHeros', [engage('g1')])).toBe('appliquee');
    expect(banc.getState().party.map((h) => h.id)).toEqual(['h1', 'h2', 'h3', 'h4']);
    expect(refusDAjoutAuGroupe(banc.getState(), undefined, 1)).toBe('Le groupe est complet (4 héros).');
  });

  it('composition : l’intent d’un invité au quota épuisé atteint le geste, qui le refuse ; le verdict de SON siège le dit', () => {
    hoteEtUnInvite();
    expect(applyIntent(1, 'recruterLeHeros', [engage('g1')])).toBe('appliquee');
    expect(applyIntent(1, 'recruterLeHeros', [engage('g2')])).toBe('appliquee');
    expect(banc.getState().party.map((h) => h.id)).toEqual(['g1']);
    expect(refusDAjoutAuGroupe(banc.getState(), undefined, 1)).toBe('Tous vos emplacements du groupe sont remplis.');
  });

  it('composition : `remplacerLeHeros` aussi', () => {
    hoteEtUnInvite();
    expect(applyIntent(1, 'recruterLeHeros', [engage('g1')])).toBe('appliquee');
    expect(applyIntent(1, 'remplacerLeHeros', ['g1', engage('g2'), 0])).toBe('appliquee');
    expect(banc.getState().net.ownership.g2, 'l’invité a posé son héros au siège qu’il a choisi').toBe(1);
  });

  it.each([
    ['fenetreValider', 'debutDuRound', 'pendingRoundStart', { round: 2 }],
    ['fenetreFermer', 'victoire', 'pendingVictory', { xp: 0, gold: { gold: 0, silver: 0, brass: 0 }, gear: [], defeated: [] }],
    ['fenetreValider', 'repos', 'pendingRest', { phase: 'setup', perHero: {}, days: 1, readyBySeat: {} }],
  ] as const)('marquage : `%s(%s)` émis par le siège 1 ne marque que le siège 1, quels que soient ses args (#2439)', (verbe, fenetre, cle, pending) => {
    setup();
    banc.setState({ [cle]: pending } as never);
    expect(applyIntent(1, verbe, [fenetre, 0])).toBe('appliquee');
    expect((banc.getState()[cle] as { readyBySeat?: Record<number, boolean> } | null)?.readyBySeat, `${verbe}(${fenetre}) a marqué un autre siège que l’émetteur`).toEqual({ 1: true });
  });
});

/**
 * #2903 — « Annuler » un jet, demandé par un siège : le PORTEUR du jet le referme, un autre siège ne
 * le referme pas. Contrat de possession de la clôture d'un flux de jet (`FLOW_VERBS`), joué par
 * `appliquerLIntentionDUnSiege` comme le salon le joue chez l'hôte.
 */
describe('#2903 — Annuler un jet par intention : seul le siège du porteur referme', () => {
  /** Interlude coop : le héros du siège 1 ouvre son Activité « Revenus » par SA propre intention. */
  function activiteOuverte() {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ net: NET0, party: [h], battle: null, interlude: null, bank: [], pendingOrders: [], pendingActivity: null, pendingCascade: null, journal: [] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().ensemencerLeTirage(13);
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState);
    const itl = banc.getState().interlude!;
    itl.perHero[h.id] = { ...itl.perHero[h.id], fx: undefined, left: 2 };
    banc.setState({
      interlude: { ...itl },
      net: { ...NET0, mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { [h.id]: 1 }, slots: [1, 0, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } },
    });
    expect(applyIntent(1, 'fenetreChoisir', ['interlude', 'activite', 'revenus', h.id])).toBe('appliquee');
    expect(applyIntent(1, 'fenetreChoisir', ['interlude', 'pratiquer', true, h.id])).toBe('appliquee');
    expect(banc.getState().pendingActivity?.heroId).toBe(h.id);
    return h;
  }

  it('Activité : un siège tiers est refusé et le jet reste ouvert ; le siège du héros le referme', () => {
    const h = activiteOuverte();
    expect(applyIntent(2, 'jetAnnuler', ['activite'])).toBe('refusee');
    expect(banc.getState().pendingActivity?.heroId, 'le jet d’autrui reste ouvert').toBe(h.id);
    expect(applyIntent(1, 'jetAnnuler', ['activite'])).toBe('appliquee');
    expect(banc.getState().pendingActivity).toBeNull();
  });

  it('Désengagement : un siège tiers est refusé ; le siège du héros renonce et la cascade-hôte se ferme', () => {
    setup();
    expect(applyIntent(1, 'rompreLEngagement', [])).toBe('appliquee');
    expect(banc.getState().pendingCascade, 'l’étape hôte est ouverte').toBeTruthy();
    expect(applyIntent(2, 'jetAnnuler', ['desengagement'])).toBe('refusee');
    expect(banc.getState().pendingDisengage, 'le choix d’autrui reste ouvert').toBeTruthy();
    expect(applyIntent(1, 'jetAnnuler', ['desengagement'])).toBe('appliquee');
    expect(banc.getState().pendingDisengage).toBeNull();
    expect(banc.getState().pendingCascade).toBeNull();
  });

  /** Le Désengagement ENGAGÉ (LDB 15 l.49 : l'Esquive est l'Action ; l.63 : la Fuite donne aussitôt
   *  +1 Avantage) : le siège du héros demande à renoncer, l'action le REFUSE et le dit, rien ne bouge. */
  it.each([
    ['esquive', 'jetLancer', ['desengagement']],
    ['fuir', 'jetRegler', ['desengagement', 'fuir', true]],
  ] as const)('Désengagement en phase %s : renoncer est refusé, visiblement, et ne change rien', (phase, geste, args) => {
    const { enemy } = setup();
    expect(applyIntent(1, 'rompreLEngagement', [])).toBe('appliquee');
    expect(applyIntent(1, geste, [...args])).toBe('appliquee');
    const avant = banc.getState();
    expect(avant.pendingDisengage?.phase).toBe(phase);
    const avantageDuFoe = avant.battle!.combatants.find((c) => c.id === enemy.id)!.advantage;
    expect(applyIntent(1, 'jetAnnuler', ['desengagement'])).toBe('appliquee');
    const apres = banc.getState();
    expect(apres.pendingDisengage, 'le Désengagement engagé reste ouvert').toBe(avant.pendingDisengage);
    expect(apres.pendingCascade, 'sa cascade-hôte aussi').toBe(avant.pendingCascade);
    expect(apres.battle!.combatants.find((c) => c.id === enemy.id)!.advantage).toBe(avantageDuFoe);
    expect(apres.refus?.texte).toBe('Renoncement refusé : h2 a déjà engagé son action, elle se joue jusqu’au bout.');
  });

  it('Désengagement en phase fuir, fenêtre PARTAGÉE (`groupOwner`) : un siège tiers est refusé par la possession', () => {
    setup();
    expect(applyIntent(1, 'rompreLEngagement', [])).toBe('appliquee');
    expect(applyIntent(1, 'jetRegler', ['desengagement', 'fuir', true])).toBe('appliquee');
    const c = banc.getState().pendingCascade!;
    banc.setState({ pendingCascade: { ...c, participants: c.participants.map((p, i) => (i === c.cursor ? { ...p, groupOwner: true } : p)) } });
    expect(modalOwnerOf(banc.getState()), 'la fenêtre est à tous').toBe('*');
    const avant = banc.getState();
    expect(applyIntent(2, 'jetAnnuler', ['desengagement'])).toBe('refusee');
    expect(banc.getState().pendingDisengage).toBe(avant.pendingDisengage);
    expect(banc.getState().pendingCascade).toBe(avant.pendingCascade);
  });
});

/**
 * #2961, #3311 — les annulations et jets d'un flux MONO sont les verbes de jet `jetAnnuler(flux)`/`jetLancer(flux)` : leur
 * possession suit le PORTEUR du jet (`jetOwner`), joué par `appliquerLIntentionDUnSiege`.
 */
describe('#2961 — annulations et jets d’un flux mono : la possession suit le porteur du jet', () => {
  const ANNULATIONS_NUES = ['battement', 'distraire', 'manoeuvre', 'course', 'chansonDeMarin', 'approche', 'protection', 'rechargement', 'mainEnsanglantee', 'recuperation', 'focalisation', 'dissipation', 'frenesie', 'marchandage', 'evaluation'].map((f) => `jetAnnuler@${f}`);
  const AUTRES = ['jetAnnuler@auContact', 'jetAnnuler@empoignade', 'jetAnnuler@incantation', 'jetAnnuler@soins', 'jetAnnuler@chirurgie', 'jetLancer@attaque', 'jetLancer@incantation', 'jetLancer@desengagement', 'jetLancer@auContact', 'jetLancer@empoignade'];
  /** Le verbe, le flux et le porteur du geste `verbe@flux`. */
  const geste = (cle: string) => {
    const [verbe, flux] = cle.split('@') as [string, keyof typeof FLOW_VERBS];
    const w = FLOW_VERBS[flux];
    if (w.kind !== 'mono') throw new Error(`${flux} : flux à plusieurs jets`);
    return { verbe, args: [flux], route: w.jetOwner };
  };

  it.each([...ANNULATIONS_NUES, ...AUTRES])('%s : routé par le porteur, un siège tiers est refusé, celui du porteur passe', (cle) => {
    setup();
    const { verbe, args, route } = geste(cle);
    const pending = { [route.field]: 'h2' };
    banc.setState({ [route.pending]: pending } as never);
    expect(applyIntent(2, verbe, args)).toBe('refusee');
    expect((banc.getState() as unknown as Record<string, unknown>)[route.pending]).toBe(pending);
    expect(intentAllowedFor(banc.getState(), 1, verbe, args)).toBe(true);
  });

  it.each(ANNULATIONS_NUES)('%s : le siège du porteur referme son jet', (cle) => {
    setup();
    const { verbe, args, route } = geste(cle);
    banc.setState({ [route.pending]: { [route.field]: 'h2' } } as never);
    expect(applyIntent(1, verbe, args)).toBe('appliquee');
    expect((banc.getState() as unknown as Record<string, unknown>)[route.pending]).toBeNull();
  });
});

/**
 * #3311 — HARNAIS À DEUX SIÈGES de chaque verbe de jet `jet<Verbe>(flux, …)` : sur un flux à un jet (le Test du héros
 * de l'invité) et sur un flux à plusieurs jets (la chute de groupe, une rangée par tombant), le siège qui possède le
 * porteur, ou la rangée, joue le geste chez l'hôte ; un autre siège se le voit refuser, et rien ne bouge.
 */
describe('#3311 — chaque verbe de jet, joué par un siège, suit la possession de son flux', () => {
  /** Les arguments du verbe de jet `v` sur `flux`, la rangée `pid` posée sur un flux multi (`VerbesDeJet`). */
  const args = (flux: string, v: RollVerb, pid?: string): unknown[] => [flux, ...(v === 'imposerLeResultat' ? [42] : []), ...(pid ? [pid] : [])];

  it.each(FLOW_VERBS.test.verbs.map((v) => [NOM_DU_VERBE_DE_JET[v], v] as const))('Test (mono) : %s — le siège du testeur joue, un tiers est refusé', (_nom, v) => {
    setup();
    const pendingTest = { actorId: 'h2', actorName: 'h2', label: 'Escalade', skillValue: 40, difficulty: 'intermediaire', requireSL: 0, target: 40, roll: null, success: false, sl: 0, cancellable: true };
    banc.setState({ pendingTest } as never);
    expect(applyIntent(2, NOM_DU_VERBE_DE_JET[v], args('test', v))).toBe('refusee');
    expect(banc.getState().pendingTest).toBe(pendingTest);
    expect(applyIntent(1, NOM_DU_VERBE_DE_JET[v], args('test', v))).toBe('appliquee');
  });

  it.each(FLOW_VERBS.chute.verbs.filter((v) => !estVerbeDeFenetre(v)).map((v) => [NOM_DU_VERBE_DE_JET[v], v] as const))('chute (multi) : %s — le siège du tombant joue SA rangée, l’hôte est refusé', (_nom, v) => {
    setup();
    const hote = mk('h1', 'heros', { x: 0, y: 1 });
    const pendingFall = { test: testDeRegle('chute', 'tenter'), to: { x: 0, y: 1 }, metres: 4, initiateurId: 'h1', participants: [
      { id: 'h1', interactive: true, attempt: true, result: null },
      { id: 'h2', interactive: true, attempt: true, result: null },
    ] };
    banc.setState({ party: [...banc.getState().party, hote], pendingFall } as never);
    expect(applyIntent(0, NOM_DU_VERBE_DE_JET[v], args('chute', v, 'h2'))).toBe('refusee');
    expect(banc.getState().pendingFall).toBe(pendingFall);
    expect(applyIntent(1, NOM_DU_VERBE_DE_JET[v], args('chute', v, 'h2'))).toBe('appliquee');
  });
});

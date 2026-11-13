/**
 * #1050 — chemin COMPLET des gestes remis en surface : allowlist (`GUEST_INTENTS`) → possession
 * (`intentAllowedFor`) → action jouée AU NOM du siège (`withActingSeat`) → EFFET dans l'état. Le
 * défaut gardé n'est PAS un refus : hors allowlist, `transmettreLesIntentions` n'enrobe pas l'action, l'invité la
 * joue sur SON état local, et le snapshot suivant de l'hôte l'efface — sans message ni journal.
 *
 * Quatre familles, une par cause :
 *  - opposition de cible (`jetResister('opposition')`/`jetValider('opposition')`) : la cible d'un Sort opposé pouvait
 *    jeter mais pas appliquer ;
 *  - hotbar (`armerLAttaque`, offre `attaque`) : rendue dès `controlsCombatant`, clic invité = no-op silencieux ;
 *  - Tir rapide (`debutDuRound.viser`/`declencherLeTirPreventif`, Talent « Tir rapide ») : pendant la pause de début
 *    de Round il n'y a AUCUN combattant actif, donc le repli universel rendait l'hôte ;
 *  - Résistance (Menace) d'une étape de cascade (`jetResister('cascade')`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { initialFields } from './stateFields';
import { intentAllowedFor, seatInfluences } from './netOwnership';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { seedBattleRng } from './battleRng';
import { bonus } from '../engine/characteristics';
import type { Combatant, Weapon } from '../engine/types';
import { cascadeDeTest } from './cascade.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { cleDeFixture } from './noyau.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const NET0 = initialNet();
const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 55, force: 35, endurance: 43, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 };
const ARM = () => ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
const BOW = (uid: string): Weapon =>
  ({ uid, name: 'Arc', label: 'Arc', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 30, qualities: [] } as unknown as Weapon);

const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...CHARS }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [BOW(`w-${id}`)], loaded: true, advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(14),
     resolve: 2, fortune: 2, resilience: 1, armour: ARM(), movement: 4, ...over }) as unknown as Combatant);

/** Scène plate 10×8 (sol) : Ligne de Vue dégagée pour le Tir rapide. */
const SCENE = () =>
  ({ ambiance: 'exterieur', weather: 'clair', dimensions: { w: 10, h: 8 }, layers: [{ z: 0, tiles: Array(80).fill('sol') }], entities: [] }) as never;

/**
 * Arène coop : `h2` (siège 1) est le TIREUR / la cible du Sort ; `h3` (siège 2) est un tiers ; `e1` est
 * l'ennemi (aucun siège MJ : le camp ennemi est à l'IA). `turn = -1` = pause de début de Round.
 */
function setup(net: Record<string, unknown> = {}, turn = 0) {
  seedBattleRng(7);
  const h2 = mk('h2', 'heros', { x: 0, y: 0 }, { talents: [{ talentId: 'tir-rapide', times: 1 }, { talentId: 'resistance', spec: 'magie', times: 1 }] as never });
  const h3 = mk('h3', 'heros', { x: 0, y: 4 });
  const e1 = mk('e1', 'ennemi', { x: 3, y: 0 });
  const battle: BattleState = {
    combatants: [h2, h3, e1], order: ['h2', 'h3', 'e1'], baseOrder: ['h2', 'h3', 'e1'],
    turn, round: 2, action: null, selectedSpellId: null, selectedAttack: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    ...initialFields(), battle, mode: 'battle', screen: 'campaign', scene: SCENE(), party: [h2, h3], gameTime: 0,
    net: { ...NET0, mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { h2: 1, h3: 2 },
           slots: [1, 2, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité A', 2: 'Invité B' }, ...net },
  });
  return { h2, h3, e1 };
}

/** L'intention d'un siège, appliquée chez l'hôte par la fonction du noyau qu'appelle le salon (`hote/coop/salon.ts`). */
const applyIntent = (seat: number, action: string, args: unknown[] = []) => appliquerLIntentionDUnSiege(banc.getState, seat, action, args);

/** Sort ENNEMI opposé, figé, dont `h2` (siège 1) est la cible : la fenêtre d'incantation est PARTAGÉE
 *  (étape `groupOwner` → owner de modale '*'), la rangée d'opposition appartient à `h2`. */
function ouvreOpposition() {
  banc.setState({
    pendingCascade: cascadeDeTest([{ id: 's0', kind: cleDeFixture('castJet'), jet: 'incantation', groupOwner: true }]),
    pendingCast: {
      casterId: 'e1', targetId: 'h2', spellId: 'fauche-demon', missile: false, focused: false,
      result: { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'x' },
    } as never,
    pendingCastOpposition: { participants: [{ id: 'h2', interactive: true, result: null }], test: { characteristic: 'force-mentale' }, menace: 'magie' } as never,
  });
}

describe('#1050 — opposition de cible : la cible invitée RÉSISTE et APPLIQUE (Sort ennemi)', () => {
  it('jetResister@opposition : seul le siège de la CIBLE l’obtient, et son auto-succès est écrit', () => {
    setup();
    ouvreOpposition();
    expect(applyIntent(2, 'jetResister', ['opposition', 'h2']), 'un tiers brûlait le Talent de la cible').toBe('refusee');
    expect(applyIntent(0, 'jetResister', ['opposition', 'h2']), 'l’hôte n’est pas le porteur de la rangée').toBe('refusee');
    expect(banc.getState().pendingCastOpposition!.participants[0].result).toBeNull();
    expect(applyIntent(1, 'jetResister', ['opposition', 'h2'])).toBe('appliquee');
    const part = banc.getState().pendingCastOpposition!.participants[0];
    expect(part.result!.resisted, 'la cible résiste (LDB : le Test réussit d’office)').toBe(true);
    expect(part.result!.oppose.sl, 'DR imposé = Bonus d’Endurance').toBe(bonus(43));
  });

  it('jetValider@opposition : la cible invitée APPLIQUE — la fenêtre d’opposition se referme', () => {
    setup();
    ouvreOpposition();
    expect(applyIntent(1, 'jetResister', ['opposition', 'h2'])).toBe('appliquee');
    expect(applyIntent(1, 'jetValider', ['opposition']), 'la cible pouvait jeter mais pas appliquer').toBe('appliquee');
    expect(banc.getState().pendingCastOpposition, 'l’opposition reste ouverte : le Sort ne se résout jamais').toBeNull();
  });

  it('« Appliquer » d’une fenêtre PARTAGÉE reste une décision de GROUPE (mesure de la route écartée)', () => {
    setup();
    ouvreOpposition();
    const s = banc.getState();
    // Router `jetValider('opposition')` sur le LANCEUR (patron mono `jetOwner`) rendrait le Sort inapplicable :
    // le lanceur est un ENNEMI et aucun siège ne porte le rôle MJ → personne ne peut le clore.
    for (const seat of [0, 1, 2]) expect(seatInfluences(s, seat, 'e1'), `siège ${seat} sur le lanceur ennemi`).toBe(false);
    // La règle retenue (repli sur le owner de la fenêtre, '*') laisse la fenêtre applicable par ses
    // participants — l'agrégation elle-même REFUSE tant qu'une rangée interactive n'a pas jeté.
    for (const seat of [0, 1, 2]) expect(intentAllowedFor(s, seat, 'jetValider', ['opposition']), `siège ${seat}`).toBe(true);
    applyIntent(0, 'jetValider', ['opposition']);
    expect(banc.getState().pendingCastOpposition, 'agrégation d’une rangée DUE : refusée par l’action').not.toBeNull();
  });

  it('NON-RÉGRESSION SOLO : hors coop, la cible résiste et applique comme avant', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    ouvreOpposition();
    banc.getState().jetResister('opposition', 'h2');
    banc.getState().jetValider('opposition');
    expect(banc.getState().pendingCastOpposition).toBeNull();
  });

  /**
   * « Tout lancer » (`jetLancer('opposition')` sans rangée, #3327) roule les seules rangées que le siège ÉMETTEUR influence :
   * l'hôte exécute au nom de ce siège (`influencesLocally`), un siège sans rangée due ne lance rien.
   */
  it('« Tout lancer » : le siège émetteur roule SA rangée, jamais celle d’un autre siège', () => {
    setup();
    ouvreOpposition();
    const pco = banc.getState().pendingCastOpposition!;
    banc.setState({ pendingCastOpposition: { ...pco, participants: [
      { id: 'h2', interactive: true, result: null }, { id: 'h3', interactive: true, result: null },
    ] } as never });
    expect(applyIntent(3, 'jetLancer', ['opposition'])).toBe('appliquee');
    expect(banc.getState().pendingCastOpposition!.participants.every((p) => p.result === null), 'un siège sans rangée due lançait celle d’autrui').toBe(true);
    expect(applyIntent(1, 'jetLancer', ['opposition'])).toBe('appliquee');
    const parts = banc.getState().pendingCastOpposition!.participants;
    expect(parts.find((p) => p.id === 'h2')!.result, 'la rangée du siège émetteur').not.toBeNull();
    expect(parts.find((p) => p.id === 'h3')!.result, 'l’hôte roulait la rangée d’un AUTRE siège').toBeNull();
  });
});

describe('#1050 — hotbar : le geste de l’invité sur SON héros actif atteint l’hôte', () => {
  it('l’offre `attaque` : le siège du combattant ACTIF arme son attaque ; un tiers est refusé', () => {
    setup(); // tour de `h2` (siège 1)
    expect(applyIntent(2, 'armerLAttaque', ['arme']), 'un tiers pilotait le tour d’autrui').toBe('refusee');
    expect(applyIntent(0, 'armerLAttaque', ['arme']), 'l’hôte ne possède pas le combattant actif').toBe('refusee');
    expect(banc.getState().battle!.selectedAttack).toBeNull();
    expect(applyIntent(1, 'armerLAttaque', ['arme'])).toBe('appliquee');
    expect(banc.getState().battle!.selectedAttack, 'le geste s’exécutait chez l’invité puis mourait au snapshot').toBe('arme');
  });

  it('NON-RÉGRESSION SOLO : le joueur arme son attaque hors coop', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    banc.getState().armerLAttaque('arme');
    expect(banc.getState().battle!.selectedAttack).toBe('arme');
  });
});

describe('#1050 — Tir rapide (Talent) : l’invité arme sa visée et tire pendant la pause de Round', () => {
  const pause = () => {
    setup({}, -1);
    banc.setState({ pendingRoundStart: { round: 2 } as never });
  };

  it('roundStart.viser : le siège du TIREUR arme ; l’hôte (que le repli désignait) est refusé', () => {
    pause();
    expect(applyIntent(2, 'fenetreChoisir', ['debutDuRound', 'viser', 'h2']), 'un tiers armait la visée d’autrui').toBe('refusee');
    expect(applyIntent(0, 'fenetreChoisir', ['debutDuRound', 'viser', 'h2']), 'sans route, le repli rendait l’hôte (aucun actif en pause)').toBe('refusee');
    expect(banc.getState().preemptAiming).toBeNull();
    expect(applyIntent(1, 'fenetreChoisir', ['debutDuRound', 'viser', 'h2'])).toBe('appliquee');
    expect(banc.getState().preemptAiming).toBe('h2');
  });

  it('clic-token sous visée armée : le tir d’interruption s’ouvre pour le TIREUR, pas pour un tiers', () => {
    pause();
    expect(applyIntent(1, 'fenetreChoisir', ['debutDuRound', 'viser', 'h2'])).toBe('appliquee');
    expect(applyIntent(2, 'cliquerLaCase', [{ x: 3, y: 0 }, 'e1']), 'un tiers déclenchait le Tir rapide d’autrui').toBe('refusee');
    expect(banc.getState().pendingAttack).toBeNull();
    expect(applyIntent(1, 'cliquerLaCase', [{ x: 3, y: 0 }, 'e1'])).toBe('appliquee');
    const pa = banc.getState().pendingAttack;
    expect(pa?.attackerId).toBe('h2');
    expect(pa?.targetId).toBe('e1');
    expect(pa?.interrupt, 'le tir hors de l’ordre d’Initiative').toBe(true);
  });

  it('declencherLeTirPreventif est la machinerie du clic (#3370) : hors allowlist, même pour le tireur', () => {
    pause();
    for (const seat of [0, 1, 2]) expect(applyIntent(seat, 'declencherLeTirPreventif', ['h2', 'e1']), `siège ${seat}`).toBe('hors-allowlist');
    expect(banc.getState().pendingAttack).toBeNull();
  });

  it('hors pause de Round, le geste n’appartient à personne (la fenêtre n’existe pas)', () => {
    setup(); // aucun `pendingRoundStart`
    for (const seat of [0, 1, 2]) expect(applyIntent(seat, 'fenetreChoisir', ['debutDuRound', 'viser', 'h2']), `siège ${seat}`).toBe('refusee');
  });

  it('NON-RÉGRESSION SOLO : le joueur arme et tire son Tir rapide hors coop', () => {
    setup({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] }, -1);
    banc.setState({ pendingRoundStart: { round: 2 } as never });
    banc.getState().fenetreChoisir('debutDuRound', 'viser', 'h2');
    expect(banc.getState().preemptAiming).toBe('h2');
    cliquerSurLeCombattant(banc.getState, 'e1');
    expect(banc.getState().pendingAttack?.interrupt).toBe(true);
  });
});

describe('#1050 — Résistance (Menace) d’une étape de cascade : routée sur l’acteur de l’étape', () => {
  /** Étape de GROUPE (`groupOwner` → owner de modale '*') portant l'acteur `h2` et un tag `menace`. */
  const cascadeMenace = () => {
    setup();
    banc.setState({
      pendingCascade: cascadeDeTest([
        { id: 'st0', kind: 'maladieDeFinDeCombat', actorId: 'h2', groupOwner: true, menace: 'magie', label: fixtureText('Menace'), target: 40, rollLabel: 'Résistance' },
      ]),
    });
  };

  it('jetResister@cascade : le siège de l’acteur de l’étape agit ; la fenêtre partagée n’ouvre PAS le geste à tous', () => {
    cascadeMenace();
    expect(applyIntent(2, 'jetResister', ['cascade', 'st0']), 'étape partagée : un tiers brûlait la Résistance d’autrui').toBe('refusee');
    expect(applyIntent(0, 'jetResister', ['cascade', 'st0'])).toBe('refusee');
    expect(banc.getState().pendingCascade!.participants[0].result).toBeUndefined();
    expect(applyIntent(1, 'jetResister', ['cascade', 'st0'])).toBe('appliquee');
    const step = banc.getState().pendingCascade!.participants[0];
    expect(step.result!.success).toBe(true);
    expect(step.result!.sl, 'DR imposé = Bonus d’Endurance').toBe(bonus(43));
  });

  it('étape INCONNUE (fermée) : personne ne joue le verbe', () => {
    cascadeMenace();
    for (const seat of [0, 1, 2]) expect(applyIntent(seat, 'jetResister', ['cascade', 'inexistante']), `siège ${seat}`).toBe('refusee');
  });
});

describe('#3327 — Maladresse et dé d’étape : leurs verbes de jet se jouent au siège de la fenêtre de l’étape', () => {
  it('jetLancer@maladresse sans rangée puis jetValider@maladresse : la Maladresse d’un ennemi se tire et s’applique au siège de sa fenêtre, jamais chez un invité', () => {
    const { e1 } = setup();
    banc.setState({ pendingCascade: cascadeDeTest([{ id: 'f0', kind: 'testDeclenche', actorId: 'e1', jet: 'maladresse', maladresse: { weapon: e1.weapons[0], result: null } }]) });
    expect(applyIntent(1, 'jetLancer', ['maladresse']), 'un invité tirait la Maladresse de l’ennemi').toBe('refusee');
    expect(banc.getState().pendingCascade!.participants[0].maladresse!.result).toBeNull();
    expect(applyIntent(0, 'jetLancer', ['maladresse'])).toBe('appliquee');
    expect(banc.getState().pendingCascade!.participants[0].maladresse!.result, 'la rangée d’une étape sans acteur propre se lance sans possession de siège').toBeTruthy();
    expect(applyIntent(1, 'jetValider', ['maladresse'])).toBe('refusee');
    expect(applyIntent(0, 'jetValider', ['maladresse'])).toBe('appliquee');
    expect(banc.getState().pendingCascade, 'la Maladresse appliquée clôt l’étape').toBeNull();
    expect(banc.getState().battle!.log.map((e) => e.text).join(' | '), 'les Oups ! tirés sont écrits au journal de combat').toMatch(/^e1 — Maladresse/);
  });

  it('jetLancer@cascadeTirage et jetImposerLeResultat@cascadeTirage : le dé de l’étape d’un héros se joue à SON siège', () => {
    setup();
    banc.setState({ pendingCascade: cascadeDeTest([{ id: 'd0', kind: 'testDeclenche', actorId: 'h2', de: { spec: { n: 1, sides: 10 } } }]) });
    expect(applyIntent(2, 'jetLancer', ['cascadeTirage', 'd0']), 'un tiers tirait le dé du héros d’autrui').toBe('refusee');
    expect(applyIntent(0, 'jetImposerLeResultat', ['cascadeTirage', 3, 'd0'])).toBe('refusee');
    expect(banc.getState().pendingCascade!.participants[0].de!.result).toBeUndefined();
    expect(applyIntent(1, 'jetLancer', ['cascadeTirage', 'd0'])).toBe('appliquee');
    expect(banc.getState().pendingCascade!.participants[0].de!.result).toBeTruthy();
  });
});

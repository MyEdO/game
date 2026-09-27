import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { counterspellJoinable, counterspellSoutenu, counterspellSoutienFor, counterspellDeclarePhase, autoDeclareWitnessRows } from './combatFlow';
import { intentAllowedFor } from './netOwnership';
import { seedBattleRng } from './battleRng';
import { castingValue } from '../engine/magic';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { CounterParticipant } from './pendings';
import type { GameState } from './store';

/**
 * #1042 / #1059 — Contre-sort : PHASE DE DÉCLARATION puis Test SOUTENU des dissipateurs du même Domaine.
 * RAW : `LDB 46 l.162` (« Plusieurs lanceurs de Sorts tentant de dissiper le même Sort effectuent leur
 * lancer séparément. S'ils incantent en utilisant le même Domaine, ils peuvent décider d'effectuer un
 * Test Soutenu à la place. » — § Dissiper des Sorts permanents, TRANSPOSÉ à la fenêtre réactive :
 * transposition maison, tag au site canonique `counterspellConfirm`) ; `LDB 12 l.189` (un seul jet, le
 * plus fort lance, +10 par soutien), `l.195` (≥1 Augmentation), `l.198` (plafond = Bonus de Carac).
 * Contrats couverts ici (réfs nues) : phase 1 verrouille les jets, `pass` ne consomme rien, N solos
 * déclarés jettent tous, composition figée après la phase, mix libre, drive de cadence — #1042, #1059.
 */

const NET0 = { mode: 'local' as const, mySeat: 0, gmSeat: undefined, ownership: {} };

/** Trois héros lanceurs (deux du Domaine du Feu, un de la Mort) face à une ennemie qui incante. */
function setup() {
  const mk = (label: string, seed: number, advances: number, domain: string) => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label, careerTalent: { id: 'magie-mineure' }, rng: makeRNG(seed) });
    h.spells = ['flechette'];
    h.characteristics.intelligence = 40;
    h.characteristics['force-mentale'] = 60;
    h.advantage = 0;
    h.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances }];
    h.talents = [{ talentId: 'magie-des-arcanes', spec: domain, times: 1 }];
    return h;
  };
  useGame.setState({ party: [mk('W1', 707, 20, 'feu'), mk('W2', 101, 10, 'feu'), mk('W3', 55, 15, 'mort')] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const heroes = b.combatants.filter((c) => c.kind === 'hero');
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies[0];
  E.characteristics.intelligence = 48;
  E.characteristics['force-mentale'] = 53;
  E.advantage = 0;
  E.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
  E.talents = [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }];
  E.spells = ['carreau'];
  heroes.forEach((h, i) => { h.pos = { x: 10, y: 10 + i }; h.dispelledThisRound = undefined; });
  E.pos = { x: 12, y: 10 };
  useGame.setState({
    battle: { ...b }, pendingCast: null, pendingCounterspell: null, pendingCascade: null,
    net: { ...useGame.getState().net, ...NET0 } as GameState['net'],
  });
  return { heroes: heroes as Combatant[], E };
}

/** Incantation FIGÉE de `caster` (DR 3, réussie) : seule la Dissipation reste à jouer. */
function freezeCast(caster: Combatant, target: Combatant) {
  useGame.setState({
    pendingCast: {
      casterId: caster.id, targetId: target.id, spellId: 'carreau', missile: true, focused: false,
      counterspellRouted: true, // le MOMENT du Contre-sort est consommé : la fenêtre ci-dessous EST la sienne
      result: { cast: true, roll: 30, target: 60, sl: 3, isCritical: false, isFumble: false, log: 'Sort lancé' },
    },
  } as unknown as Partial<GameState>);
}

/** Fenêtre de Contre-sort POSÉE sur `ids` (rangées interactives, vierges de déclaration ET de jet). */
function openWindow(ids: string[]) {
  useGame.setState({
    pendingCounterspell: { participants: ids.map((id) => ({ id, interactive: true, result: null })) },
  } as unknown as Partial<GameState>);
}

/** Piètre dissipateur : son Contre-sort échoue (un succès fermerait la lice, LDB 46 l.156). */
function affaiblir(id: string) {
  const c = useGame.getState().battle!.combatants.find((x) => x.id === id)!;
  c.characteristics.intelligence = 10;
  c.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 1 }];
}

const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
const row = (id: string) => useGame.getState().pendingCounterspell!.participants.find((p) => p.id === id)!;
const declare = (id: string, choice: 'solo' | 'soutenu' | 'pass') => useGame.getState().counterspellDeclare(id, choice);

describe('#1042/#1059 — Contre-sort : phase de déclaration puis Test Soutenu (LDB 46 l.162 / LDB 12 l.189)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCounterspell: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); useGame.setState({ net: { ...useGame.getState().net, ...NET0 } as GameState['net'] }); });

  it('PHASE 1 — tant qu’une rangée n’a pas déclaré, AUCUN jet ne part (ni au clic, ni au drive)', () => {
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id]);
    expect(counterspellDeclarePhase(useGame.getState().pendingCounterspell)).toBe(true);
    declare(h1.id, 'solo');
    useGame.getState().counterspellRoll(h1.id);
    expect(row(h1.id).result, 'le jet attend que TOUTE la fenêtre ait déclaré').toBeNull();
    expect(live(h1.id).dispelledThisRound, 'le verrou ne brûle rien').toBeFalsy();
    useGame.getState().counterspellRollAll();
    expect(useGame.getState().pendingCounterspell!.participants.every((p) => !p.result), 'le drive ne force pas la phase').toBe(true);
    declare(h2.id, 'pass'); // dernière déclaration → phase 2
    expect(counterspellDeclarePhase(useGame.getState().pendingCounterspell)).toBe(false);
    useGame.getState().counterspellRoll(h1.id);
    expect(row(h1.id).result, 'phase 2 : le déclaré solo lance').toBeTruthy();
  });

  it('PASSER ne consomme PAS la Dissipation du Round (passer n’est pas tenter)', () => {
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id]);
    declare(h1.id, 'solo');
    declare(h2.id, 'pass');
    expect(live(h2.id).dispelledThisRound).toBeFalsy();
    useGame.getState().counterspellRoll(h2.id); // une rangée qui passe ne lance jamais
    expect(row(h2.id).result).toBeNull();
    useGame.getState().counterspellRoll(h1.id);
    expect(live(h1.id).dispelledThisRound, 'le lanceur, lui, consomme son essai').toBe(true);
    expect(live(h2.id).dispelledThisRound, 'celui qui passe garde le sien').toBeFalsy();
  });

  it('N SOLOS — deux rangées déclarées SOLO jettent toutes les deux, dans n’importe quel ordre', () => {
    const { heroes, E } = setup();
    const [h1, h2, h3] = heroes;
    freezeCast(E, h1);
    affaiblir(h3.id);
    openWindow([h1.id, h2.id, h3.id]);
    declare(h3.id, 'solo');
    declare(h1.id, 'solo');
    declare(h2.id, 'pass');
    seedBattleRng(11);
    useGame.getState().counterspellRoll(h3.id);
    expect(row(h3.id).result!.dispelled, 'préparation : son Contre-sort échoue').toBe(false);
    useGame.getState().counterspellRoll(h1.id);
    expect(row(h1.id).result, 'un échec ne ferme pas la lice aux autres DÉCLARÉS').toBeTruthy();
    expect(useGame.getState().pendingCounterspell!.participants.filter((p) => p.result).length).toBe(2);
    for (const h of [h1, h3]) expect(live(h.id).dispelledThisRound, `${h.label} a tenté`).toBe(true);
    expect(live(h2.id).dispelledThisRound, 'le passant reste intact').toBeFalsy();
  });

  it('COMPOSITION FIGÉE — après la dernière déclaration, plus de ralliement ni de retrait', () => {
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id]);
    declare(h1.id, 'solo');
    declare(h2.id, 'pass');
    declare(h2.id, 'solo'); // ralliement APRÈS la clôture de la phase
    expect(row(h2.id).declared, 'la composition ne bouge plus').toBe('pass');
    declare(h1.id, 'pass'); // retrait APRÈS la clôture
    expect(row(h1.id).declared).toBe('solo');
  });

  it('ÉLIGIBILITÉ — même Domaine : l’union est offerte ; Domaines différents ou HOSTILES entre eux : non', () => {
    const { heroes, E } = setup();
    const [h1, h2, h3] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id]);
    let s = useGame.getState();
    expect(counterspellJoinable(s, s.pendingCounterspell, h1.id)).toBe(true);
    expect(counterspellJoinable(s, s.pendingCounterspell, h2.id)).toBe(true);
    // Domaines différents (Feu vs Mort) : aucune union possible.
    openWindow([h1.id, h3.id]);
    s = useGame.getState();
    expect(counterspellJoinable(s, s.pendingCounterspell, h1.id)).toBe(false);
    expect(counterspellJoinable(s, s.pendingCounterspell, h3.id)).toBe(false);
    // Même Domaine « feu » mais camps opposés : on n'unit pas sa voix à celle d'un adversaire.
    openWindow([h1.id, E.id]);
    s = useGame.getState();
    expect(counterspellJoinable(s, s.pendingCounterspell, h1.id)).toBe(false);
    expect(counterspellJoinable(s, s.pendingCounterspell, E.id)).toBe(false);
    // Et la garde du GESTE suit le prédicat : « s'unir » est refusé sans partenaire.
    declare(h1.id, 'soutenu');
    expect(row(h1.id).declared).toBeUndefined();
  });

  it('UN SEUL JET — le MENEUR dérivé lance à sa valeur + 10 par soutien ; le soutien ne roule pas', () => {
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id]);
    declare(h1.id, 'soutenu');
    declare(h2.id, 'soutenu');
    const s = useGame.getState();
    const grp = counterspellSoutenu(s, s.pendingCounterspell)!;
    expect(grp.leader.id, 'la plus forte valeur de Langue (Magick) mène').toBe(h1.id);
    expect(grp.bonus, '+10 par soutien éligible').toBe(10);
    expect(counterspellSoutienFor(s, s.pendingCounterspell, h2.id), 'le Soutien ne s’ajoute qu’au meneur').toBe(0);
    const attendu = castingValue(live(h1.id), 'langue', 'magick') + 10;
    useGame.getState().counterspellRoll(h1.id);
    expect(row(h1.id).result!.counter.target, 'la cible du jet PORTE le Soutien').toBe(attendu);
    expect(row(h2.id).result, 'le groupe n’a qu’un jet (LDB 12 l.189)').toBeNull();
    useGame.getState().counterspellRoll(h2.id);
    expect(row(h2.id).result, 'un soutien ne peut pas lancer le sien en plus').toBeNull();
  });

  it('PORTE UNIQUE — « Laisser passer » est refusé en phase 1 (effet ET route), et le tout-pass ferme par « Appliquer »', () => {
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id]);
    // (1) EFFET : en phase 1, un siège ne referme pas la fenêtre des autres — décliner s'y dit `pass`.
    useGame.getState().counterspellCancel();
    expect(useGame.getState().pendingCounterspell, 'la fenêtre reste ouverte').toBeTruthy();
    // (2) ROUTE : la MÊME frontière côté réseau (l'intent n'atteint jamais l'effet).
    const s = useGame.getState();
    expect(intentAllowedFor(s, 0, 'counterspellCancel'), 'aucun siège ne ferme pendant la phase').toBe(false);
    // (3) TOUT-PASS : la dernière déclaration ferme la fenêtre par le résolveur canonique, sans jet.
    declare(h1.id, 'pass');
    declare(h2.id, 'pass');
    expect(useGame.getState().pendingCounterspell, 'fenêtre close d’office : plus personne ne lance').toBeNull();
    for (const h of [h1, h2]) expect(live(h.id).dispelledThisRound, 'passer ne coûte rien').toBeFalsy();
    expect(useGame.getState().battle!.log.some((e) => e.text.includes('Contre-sort de')),
      'aucun Contre-sort chanté : la fenêtre ne portait aucun repli IA').toBe(false);
  });

  it('SOUTIEN sur TOUS les chemins de dé du meneur — dé FIXÉ et Résilience gardent le +10 dans la cible', () => {
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id]);
    declare(h1.id, 'soutenu');
    declare(h2.id, 'soutenu');
    const attendu = castingValue(live(h1.id), 'langue', 'magick') + 10;
    // (1) RÉSILIENCE PRÉ-JET (LDB 17 l.68) : le résolveur forcé lit la valeur SOUTENUE, pas la valeur nue.
    live(h1.id).resilience = 1;
    useGame.getState().counterspellForceSuccess(h1.id);
    expect(row(h1.id).result!.counter.target, 'la Résilience du meneur porte le Soutien').toBe(attendu);
    // (2) DÉ FIXÉ posé ensuite : la cible reste celle du jet SOUTENU (aucun recalcul nu en chemin).
    useGame.getState().counterspellSetForcedRoll(h1.id, 7);
    expect(row(h1.id).result!.counter.roll, 'le dé saisi est bien appliqué').toBe(7);
    expect(row(h1.id).result!.counter.target, 'le dé fixé du meneur garde le Soutien').toBe(attendu);
  });

  it('PLAFOND (l.198) — le Soutien ne dépasse pas le Bonus de Caractéristique du meneur', () => {
    const { heroes, E } = setup();
    const [h1, h2, h3] = heroes;
    h3.talents = [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }]; // 3 unis du même Domaine
    live(h1.id).characteristics.intelligence = 12; // BInt 1 → un seul soutien compterait pour lui
    freezeCast(E, h1);
    openWindow([h1.id, h2.id, h3.id]);
    for (const h of [h1, h2, h3]) declare(h.id, 'soutenu');
    const s = useGame.getState();
    const grp = counterspellSoutenu(s, s.pendingCounterspell)!;
    expect(grp.leader.id, 'la valeur abaissée fait passer le meneur au suivant').toBe(h3.id);
    expect(grp.bonus, 'deux soutiens, plafond BInt du meneur').toBe(20);
  });

  it('CONSOMMATION (A4) — meneur ET soutiens brûlent leur Dissipation à l’ENGAGE, jamais à la déclaration', () => {
    const { heroes, E } = setup();
    const [h1, h2, h3] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id, h3.id]);
    declare(h1.id, 'soutenu');
    declare(h2.id, 'soutenu');
    expect(live(h1.id).dispelledThisRound, 'déclarer n’est pas chanter').toBeFalsy();
    expect(live(h2.id).dispelledThisRound).toBeFalsy();
    declare(h3.id, 'pass');
    useGame.getState().counterspellRoll(h1.id);
    expect(live(h1.id).dispelledThisRound, 'le meneur a tenté').toBe(true);
    expect(live(h2.id).dispelledThisRound, 's’unir EST tenter').toBe(true);
    expect(live(h3.id).dispelledThisRound, 'passer ne coûte rien').toBeFalsy();
  });

  it('MIX LIBRE (A1) — deux unis + un séparé dans la MÊME fenêtre', () => {
    const { heroes, E } = setup();
    const [h1, h2, h3] = heroes;
    freezeCast(E, h1);
    affaiblir(h3.id);
    openWindow([h1.id, h2.id, h3.id]);
    declare(h1.id, 'soutenu');
    declare(h2.id, 'soutenu');
    declare(h3.id, 'solo');
    seedBattleRng(11);
    useGame.getState().counterspellRoll(h3.id);
    expect(row(h3.id).result!.dispelled, 'préparation : le séparé échoue').toBe(false);
    useGame.getState().counterspellRoll(h1.id);
    expect(row(h1.id).result, 'le groupe chante aussi').toBeTruthy();
    expect(row(h2.id).result, 'le soutien n’a pas de jet propre').toBeNull();
    // Deux participants ROULÉS entrent dans l'agrégation (le groupe compte pour un).
    expect(useGame.getState().pendingCounterspell!.participants.filter((p) => p.result).length).toBe(2);
  });

  it('TÉMOINS — les rangées non surfacées déclarent d’office à l’ouverture (la fenêtre ne les attend pas)', () => {
    const { heroes, E } = setup();
    const parts: CounterParticipant[] = [
      { id: heroes[0].id, interactive: true, result: null },
      { id: E.id, interactive: false, result: null },
      { id: heroes[1].id, interactive: false, result: null },
    ];
    const out = autoDeclareWitnessRows(parts, [live(heroes[0].id), live(E.id), live(heroes[1].id)]);
    expect(out[0].declared, 'la rangée surfacée déclare depuis son siège').toBeUndefined();
    const witnesses = out.slice(1);
    expect(witnesses.every((p) => !!p.declared), 'les témoins sont déclarés').toBe(true);
    expect(witnesses.filter((p) => p.declared === 'solo').length, 'le meilleur contre-lanceur témoin contrerait, les autres passent').toBe(1);
  });

  it('CADENCE — le drive DÉCLARE d’abord les rangées de ce siège, puis les fait toutes chanter', () => {
    const { heroes, E } = setup();
    const [h1, h2, h3] = heroes;
    freezeCast(E, h1);
    for (const h of heroes) affaiblir(h.id); // chants ratés : la lice reste ouverte du premier au dernier
    openWindow([h1.id, h2.id, h3.id]);
    seedBattleRng(11);
    useGame.getState().counterspellRollAll();
    expect(useGame.getState().pendingCounterspell!.participants.every((p) => !p.result), 'phase 1 : rien ne part').toBe(true);
    useGame.getState().counterspellDeclareAll();
    expect(useGame.getState().pendingCounterspell!.participants.every((p) => p.declared === 'solo')).toBe(true);
    useGame.getState().counterspellRollAll();
    expect(useGame.getState().pendingCounterspell!.participants.filter((p) => p.result).length,
      'phase 2 : chaque rangée du siège chante').toBe(3);
  });

  it('COOP — déclarer est un geste de RANGÉE : son possesseur agit, les autres sont refusés', () => {
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    freezeCast(E, h1);
    openWindow([h1.id, h2.id]);
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { [h1.id]: 1, [h2.id]: 2 }, slots: [0, 1, 2, 0] } as GameState['net'] });
    const s = useGame.getState();
    expect(intentAllowedFor(s, 1, 'counterspellDeclare', [h1.id]), 'le siège qui possède la rangée').toBe(true);
    expect(intentAllowedFor(s, 2, 'counterspellDeclare', [h1.id]), 'un autre siège ne déclare pas à sa place').toBe(false);
    expect(intentAllowedFor(s, 0, 'counterspellDeclare', [h1.id]), 'l’hôte non plus').toBe(false);
    expect(intentAllowedFor(s, 1, 'counterspellDeclareAll'), '« tout déclarer » : qui tient une rangée vierge').toBe(true);
    // Et le geste a un EFFET chez son possesseur (chemin réel, pas seulement l'autorisation).
    useGame.setState({ net: { ...useGame.getState().net, mySeat: 1 } as GameState['net'] });
    declare(h1.id, 'solo');
    expect(row(h1.id).declared, 'le possesseur déclare sa rangée').toBe('solo');
    declare(h2.id, 'pass');
    expect(row(h2.id).declared, 'la rangée d’un autre siège reste inerte ici').toBeUndefined();
    // SOLO : un seul siège, il tient tout.
    useGame.setState({ net: { ...useGame.getState().net, ...NET0 } as GameState['net'] });
    declare(h2.id, 'pass');
    expect(row(h2.id).declared, 'en solo le joueur déclare toutes ses rangées').toBe('pass');
  });
});

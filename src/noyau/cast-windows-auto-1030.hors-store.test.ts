import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import { castSpell, openCastCascade } from './combatFlow';
import { tickCombatAuto } from './combatAuto';
import { seedBattleRng } from './battleRng';
import { setCadence } from '../engine/cadence';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { reluDans } from './combatDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #1030 — la cadence AUTO résout les FENÊTRES RÉACTIVES de l'étape `jet:'incantation'` (Contre-sort #1028,
 * opposition de cible #949) comme elle résout les jets de la cascade. Sans politique, le drive de
 * l'étape (`jetLancer('incantation')`/`jetValider('incantation')`) ne pouvait traverser ni l'une ni l'autre — `jetValider('incantation')`
 * s'abstient sous Contre-sort, `jetValider('opposition')` refuse d'agréger tant qu'une rangée interactive
 * n'a pas jeté — et la chaîne attendait sous Auto-combat + siège MJ un clic qui ne vient jamais.
 * Ici : chaque fenêtre se résout SANS clic, l'issue reste celle des agrégations canoniques, et la
 * cadence MANUELLE ne bouge pas.
 */
const NET0 = { mode: 'local' as const, mySeat: 0, gmSeat: undefined, ownership: {} };

/** Sorcier + `n` ennemis (`magick` = contre-lanceurs), siège MJ posé, aucune incantation en cours. */
function setup(spells: string[], n = 1, magick = true) {
  const hero = createHero({ idNeuf: idsDeTest,
    speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W',
    careerTalent: { id: 'magie-mineure' }, seed: 707,
  });
  hero.spells = spells;
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
  enemies.slice(n).forEach((e) => (e.dead = true));
  const cibles = enemies.slice(0, n);
  cibles.forEach((E, i) => {
    E.characteristics.intelligence = 48; E.characteristics['force-mentale'] = 53;
    if (magick) { E.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }]; E.spells = ['carreau']; }
    E.pos = { x: 12 + i, y: 10 };
    E.dispelledThisRound = undefined;
  });
  H.pos = { x: 10, y: 10 };
  H.wounds = blessuresDeBase(99, 99, H);
  banc.setState({
    battle: { ...b }, pendingCounterspell: null, pendingCastOpposition: null, pendingCast: null, pendingCascade: null,
    net: { ...banc.getState().net, ...NET0, gmSeat: 0 } as Jeu['net'],
  });
  return { H: reluDans(banc.getState, H), cibles: cibles.map((c) => reluDans(banc.getState, c)) };
}

describe('#1030 — Contre-sort : politique d’auto-résolution de la cadence AUTO', () => {
  /** Ouvre la fenêtre : le héros incante sur le 1ᵉʳ ennemi, dont la rangée est tenue par le siège MJ. */
  function openWindow(H: Combatant, target: Combatant) {
    castSpell(banc.getState, banc.setState, H, target, 'flechette');
    banc.getState().jetLancer('incantation');
    return banc.getState().pendingCounterspell;
  }

  it('a — Auto-combat + siège MJ : la fenêtre surfacée se résout SANS clic, la chaîne va au bout', () => {
    banc.getState().ensemencerLeTirage(3);
    setCadence('auto');
    const { H, cibles } = setup(['flechette']);
    seedBattleRng(11);
    const pcs = openWindow(H, cibles[0]);
    expect(pcs?.participants[0].interactive, 'rangée du MJ : la fenêtre attend un jet').toBe(true);
    expect(pcs?.participants[0].result).toBeNull();

    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);

    const s = banc.getState();
    expect(s.pendingCounterspell, 'la fenêtre s’est résolue seule (sonde P4 INVERSÉE)').toBeNull();
    expect(s.pendingCast, 'l’incantation est appliquée, plus rien à cliquer').toBeNull();
    expect(s.pendingCascade, 'la situation d’incantation est refermée').toBeNull();
    expect(cibles[0].dispelledThisRound, 'le contre-lanceur a bien CHANTÉ (essai consommé, LDB 46 l.156)').toBe(true);
  });

  it('b — cadence MANUELLE : la fenêtre attend le MJ (inchangé)', () => {
    banc.getState().ensemencerLeTirage(3);
    const { H, cibles } = setup(['flechette']); // cadence manuelle (défaut)
    seedBattleRng(11);
    expect(openWindow(H, cibles[0])).toBeTruthy();

    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);

    const s = banc.getState();
    expect(s.pendingCounterspell, 'personne n’a chanté à la place du MJ').toBeTruthy();
    expect(s.pendingCounterspell!.participants[0].result).toBeNull();
    expect(s.pendingCast, 'l’incantation reste figée sous la fenêtre').toBeTruthy();
  });

  it('c — le drive ne re-tire plus à vide : plus aucun beat en vol une fois la chaîne close', () => {
    banc.getState().ensemencerLeTirage(3);
    setCadence('auto');
    const { H, cibles } = setup(['flechette']);
    seedBattleRng(11);
    openWindow(H, cibles[0]);
    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);
    expect(banc.enAttente(), 'la boucle de drive s’est ARRÊTÉE (elle re-tirait à vide sans fin)').toBe(0);
  });

  it('d — l’issue auto est celle de l’agrégation #1040 (tous chantent, un succès dissipe / meilleur DR)', () => {
    banc.getState().ensemencerLeTirage(3);
    // (1) référence MANUELLE : les deux rangées chantent, `jetValider('contreSort')` agrège.
    const manual = setup(['flechette'], 2);
    seedBattleRng(23);
    const pcsM = openWindow(manual.H, manual.cibles[0])!;
    expect(pcsM.participants).toHaveLength(2);
    // PHASE 1 (#1042/#1059) : la composition se déclare avant les dés — le drive auto pose le même
    // geste sans rangée (`jetRegler('contreSort', 'declaration', 'solo')`), la référence manuelle le pose à la main.
    for (const p of pcsM.participants) banc.getState().jetRegler('contreSort', 'declaration', 'solo', p.id);
    for (const p of pcsM.participants) banc.getState().jetLancer('contreSort', p.id);
    banc.getState().jetValider('contreSort');
    const ref = banc.getState().pendingCast!.result;
    const refChanted = manual.cibles.map((c) => !!c.dispelledThisRound);
    expect(refChanted.some(Boolean), 'référence non vide : au moins une rangée a chanté').toBe(true);
    expect(ref!.log, 'la référence porte bien une issue de Contre-sort').toContain('Contre-sort');

    // (2) MÊME jet, résolu par la CADENCE AUTO : même issue déposée dans `pendingCast`.
    banc.getState().ensemencerLeTirage(3);
    setCadence('auto');
    const auto = setup(['flechette'], 2);
    seedBattleRng(23);
    expect(openWindow(auto.H, auto.cibles[0])!.participants).toHaveLength(2);
    tickCombatAuto(banc.getState, banc.setState);
    // On lit l'issue dès la fermeture de la fenêtre, AVANT que la chaîne n'applique et ne ferme `pendingCast`.
    banc.jusquA((s) => s.pendingCounterspell === null);
    expect(banc.getState().pendingCounterspell).toBeNull();
    expect(banc.getState().pendingCast!.result).toEqual(ref);
    expect(auto.cibles.map((c) => !!c.dispelledThisRound), 'tous les surfacés ont tenté').toEqual(refChanted);
  });

  /** POSSESSION (#1005) — l'étape `cast` partagée a l'owner `'*'` : TOUS les sièges la voient et la
   *  pilotent. Le drive doit donc se juger RANGÉE PAR RANGÉE, sinon un siège en Auto-combat referme
   *  « Appliquer » sur la fenêtre d'un autre et FORFAIT son jet (sonde P-F du juge de #1030). */
  it('e — la fenêtre dont une rangée DUE appartient à un AUTRE siège n’est pas drivée : elle ATTEND (jet jamais forfait)', () => {
    banc.getState().ensemencerLeTirage(3);
    setCadence('auto');
    const { H, cibles } = setup(['flechette']);
    seedBattleRng(11);
    // Auto-combat au siège 0 ; la rangée ENNEMIE est tenue par le MJ, siège 1.
    banc.setState({ net: { ...banc.getState().net, mode: 'hote', mySeat: 0, gmSeat: 1, ownership: {} } as Jeu['net'] });
    const pcs = openWindow(H, cibles[0]);
    expect(pcs!.participants[0].interactive, 'la rangée du MJ est bien DUE').toBe(true);

    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);

    const s = banc.getState();
    expect(s.pendingCounterspell, 'la fenêtre du MJ est INTACTE (elle attend son siège)').toBeTruthy();
    expect(s.pendingCounterspell!.participants[0].result, 'personne n’a jeté à sa place').toBeNull();
    expect(cibles[0].dispelledThisRound, 'sa Dissipation n’est pas FORFAITE').toBeFalsy();
    expect(s.pendingCast, 'le Sort ne s’applique pas par-dessus').toBeTruthy();
    expect(banc.enAttente(), 'aucun POLL : le pilote ne planifie rien tant que la fenêtre n’est pas à lui').toBe(0);
  });

  it('f — deux sièges dans la MÊME fenêtre : rien n’est jeté tant qu’une rangée d’un autre siège est due', () => {
    banc.getState().ensemencerLeTirage(3);
    setCadence('auto');
    const { H, cibles } = setup(['flechette']);
    seedBattleRng(11);
    // Sort ENNEMI (IA, aucun siège MJ) : les DEUX contre-lanceurs sont des héros — l'un au siège 0
    // (local), l'autre au siège 1. Un contre-lanceur doit être HOSTILE au lanceur (`counterspellCandidates`).
    const b = banc.getState().battle!;
    const h2 = { ...b.combatants.find((c) => c.kind === 'heros')!, id: 'h2', label: 'W2', pos: { x: 10, y: 11 }, dispelledThisRound: undefined } as Combatant;
    banc.setState({
      battle: { ...b, combatants: [...b.combatants, h2], order: [...b.order, h2.id] },
      net: { ...banc.getState().net, mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { h2: 1 }, slots: [0, 1, 0, 0] } as Jeu['net'],
    });
    castSpell(banc.getState, banc.setState, cibles[0], H, 'carreau'); // lanceur IA : jet figé + aiguillage
    const pcs = banc.getState().pendingCounterspell!;
    expect(pcs.participants.map((p) => p.id), 'les deux contre-lanceurs sont en lice').toEqual(expect.arrayContaining([H.id, 'h2']));
    expect(pcs.participants.every((p) => p.interactive), 'deux rangées DUES').toBe(true);

    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);

    const apres = banc.getState().pendingCounterspell;
    expect(apres, 'la fenêtre attend la rangée du siège 1').toBeTruthy();
    // Identité de la fenêtre : si le drive l'avait résolue, la chaîne aurait rendu la main à l'IA, qui
    // en rouvrirait une AUTRE (sans le contre-lanceur ayant déjà usé sa tentative) — un simple
    // « une fenêtre existe » serait donc vert à tort.
    expect(apres!.participants.map((p) => p.id), 'c’est la MÊME fenêtre, entière').toEqual(expect.arrayContaining([H.id, 'h2']));
    expect(apres!.participants.every((p) => !p.result), 'aucune rangée jetée…').toBe(true);
    expect(H.dispelledThisRound, '…y compris celle du siège LOCAL : « Appliquer » agrégerait la fenêtre entière, donc on ne jette rien').toBeFalsy();
    expect(banc.enAttente(), 'aucun poll en vol').toBe(0);
  });
});

/**
 * MÊME CLASSE, MÊME PATRON — l'opposition de cible (`SpellSpec.opposed`) s'ouvre DANS la même étape
 * `cast`, APRÈS le Contre-sort (`resolveCastChain` : la Dissipation d'abord, `jetValider('incantation')` s'abstient
 * sous fenêtre ouverte) — POUR UNE MÊME INCANTATION, les deux ne sont jamais dues ensemble. Son
 * blocage était PIRE qu'une attente —
 * `jetValider('opposition')` refusant d'agréger, le drive repassait par `jetValider('incantation')`, qui RÉOUVRAIT la
 * fenêtre (`openCastOppositionStep`) et jetait les jets déjà faits.
 */
describe('#1030 — opposition de cible : même politique d’auto-résolution', () => {
  /** Incantation OPPOSÉE figée DANS sa cascade — mêmes coutures que `cast-opposition.hors-store.test.ts` (jet
   *  contrôlé posé sur `pendingCast`, situation hébergée par `openCastCascade`) : le drive d'auto-cadence
   *  y trouve l'étape `jet:'incantation'` réelle. Aucun contre-lanceur en lice (cible sans Langue (Magick)). */
  function frozenOpposedCast(H: Combatant, target: Combatant) {
    banc.setState({
      pendingCounterspell: null, pendingCastOpposition: null,
      pendingCast: {
        casterId: H.id, targetId: target.id, spellId: 'parole-de-tzeentch', missile: false, focused: false,
        counterspellRouted: true, // le moment de la Dissipation est passé (aucun candidat)
        result: { cast: true, roll: 30, target: 70, sl: 4, isCritical: false, isFumble: false, log: 'x' },
      },
    } as unknown as Partial<Jeu>);
    openCastCascade(banc.getState, banc.setState, H);
    expect(banc.getState().pendingCascade?.participants[0].jet).toBe('incantation');
  }
  /** Dernier `opposedOutcome` posé par `jetValider('opposition')` (le Sort s'applique dans la foulée). */
  function captureOutcome() {
    let last: unknown = null;
    const stop = banc.subscribe((s) => { if (s.pendingCast?.opposedOutcome) last = s.pendingCast.opposedOutcome; });
    return { read: () => last, stop };
  }

  it('a — Auto-combat + siège MJ : la fenêtre d’opposition se résout SANS clic, la chaîne va au bout', () => {
    banc.getState().ensemencerLeTirage(11);
    setCadence('auto');
    const { H, cibles } = setup(['parole-de-tzeentch'], 1, false);
    seedBattleRng(11);
    frozenOpposedCast(H, cibles[0]);
    // TÉMOIN : la fenêtre passe VRAIMENT par l'opposition (sinon un « rien ne s'ouvre » serait vert).
    const vu = { ouverte: false, jetee: false };
    const stop = banc.subscribe((s) => {
      if (!s.pendingCastOpposition) return;
      vu.ouverte = true;
      if (s.pendingCastOpposition.participants.some((p) => p.result)) vu.jetee = true;
    });

    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);
    stop();

    expect(vu.ouverte, 'la chaîne a bien OUVERT la fenêtre d’opposition').toBe(true);
    expect(vu.jetee, 'sa rangée surfacée a été JETÉE par le drive, pas contournée').toBe(true);
    const s = banc.getState();
    expect(s.pendingCastOpposition, 'la fenêtre d’opposition s’est résolue seule').toBeNull();
    expect(s.pendingCast, 'le Sort est appliqué, plus rien à cliquer').toBeNull();
    expect(s.pendingCascade, 'la situation d’incantation est refermée').toBeNull();
  });

  it('b — cadence MANUELLE : la rangée surfacée attend son joueur (inchangé)', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, cibles } = setup(['parole-de-tzeentch'], 1, false); // cadence manuelle (défaut)
    seedBattleRng(11);
    frozenOpposedCast(H, cibles[0]);
    banc.getState().jetValider('incantation'); // le lanceur applique : l'opposition s'ouvre
    const part = banc.getState().pendingCastOpposition!.participants[0];
    expect(part.interactive, 'cible ENNEMIE sous siège MJ : rangée jouée').toBe(true);
    expect(part.result).toBeNull();

    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);

    const s = banc.getState();
    expect(s.pendingCastOpposition, 'personne n’a opposé à la place du MJ').toBeTruthy();
    expect(s.pendingCastOpposition!.participants[0].result).toBeNull();
    expect(s.pendingCast, 'le Sort ne s’applique pas sans son Test opposé').toBeTruthy();
  });

  it('c — le drive ne re-tire plus à vide : plus aucun beat en vol une fois la chaîne close', () => {
    banc.getState().ensemencerLeTirage(11);
    setCadence('auto');
    const { H, cibles } = setup(['parole-de-tzeentch'], 1, false);
    seedBattleRng(11);
    frozenOpposedCast(H, cibles[0]);
    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);
    expect(banc.enAttente(), 'la boucle de drive s’est ARRÊTÉE (elle réouvrait la fenêtre sans fin)').toBe(0);
  });

  it('d — l’issue auto est celle de l’agrégation d’`jetValider(\'opposition\')` (référence manuelle, même dé)', () => {
    // (1) référence MANUELLE : la rangée du MJ oppose son Test, « Appliquer » agrège.
    banc.getState().ensemencerLeTirage(11);
    const manual = setup(['parole-de-tzeentch'], 1, false);
    seedBattleRng(23);
    frozenOpposedCast(manual.H, manual.cibles[0]);
    banc.getState().jetValider('incantation');
    const capM = captureOutcome();
    banc.getState().jetLancer('opposition', manual.cibles[0].id);
    const rowRef = banc.getState().pendingCastOpposition!.participants[0].result;
    banc.getState().jetValider('opposition');
    capM.stop();
    const ref = capM.read();
    expect(rowRef, 'référence non vide : la rangée a bien opposé').toBeTruthy();
    expect(ref, 'l’agrégation a bien déposé son `opposedOutcome`').toBeTruthy();

    // (2) MÊME dé, résolu par la CADENCE AUTO.
    banc.getState().ensemencerLeTirage(11);
    setCadence('auto');
    const auto = setup(['parole-de-tzeentch'], 1, false);
    seedBattleRng(23);
    frozenOpposedCast(auto.H, auto.cibles[0]);
    const capA = captureOutcome();
    tickCombatAuto(banc.getState, banc.setState);
    banc.avancer(5000);
    capA.stop();
    expect(capA.read()).toEqual(ref);
  });

  /** PORTÉE DU SLOT — la fenêtre d'opposition ne survit pas à l'incantation qu'elle oppose : elle est
   *  purgée à l'ouverture d'un combat, comme `pendingCast`/`pendingCounterspell` (`stateFields`).
   *  Contrôle de causalité du juge de #1030 (P-B2) : une fenêtre ORPHELINE d'un combat précédent
   *  bloquait, via la garde d'idempotence, l'application d'une incantation NON opposée du suivant. */
  it('e — une fenêtre d’opposition ne SURVIT PAS à son combat (aucun orphelin ne bloque le combat suivant)', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, cibles } = setup(['parole-de-tzeentch', 'flechette'], 1, false);
    seedBattleRng(11);
    frozenOpposedCast(H, cibles[0]);
    banc.getState().jetValider('incantation');
    expect(banc.getState().pendingCastOpposition, 'une fenêtre d’opposition est ouverte').toBeTruthy();

    banc.getState().lancerLeCombat('enc-mutants'); // combat SUIVANT
    expect(banc.getState().pendingCastOpposition, 'le slot est PURGÉ avec l’incantation qu’il opposait').toBeNull();

    // …et une incantation NON opposée du nouveau combat s'applique normalement.
    const b = banc.getState().battle!;
    const H2 = b.combatants.find((c) => c.kind === 'heros')!;
    const E2 = b.combatants.find((c) => c.kind === 'ennemi')!;
    banc.setState({
      pendingCast: {
        casterId: H2.id, targetId: E2.id, spellId: 'flechette', missile: true, focused: false, counterspellRouted: true,
        result: { cast: true, roll: 30, target: 70, sl: 4, isCritical: false, isFumble: false, log: 'x' },
      },
    } as unknown as Partial<Jeu>);
    banc.getState().jetValider('incantation');
    expect(banc.getState().pendingCast, 'le Sort s’applique — plus rien ne le bloque').toBeNull();
  });
});

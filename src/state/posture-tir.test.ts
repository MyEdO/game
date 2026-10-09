import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { findActionById } from '../data/index';
import { actionGate, runAction } from './actionRegistry';
import { openAttackCascade, previewAttack, STANCE_BLOCK } from './combatFlow';
import type { Combatant } from '../engine/types';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * POSTURE DE TIR PRÉ-ARMÉE (spec HUD combat §1a G5) — l'entrée `posture-tir` du registre cesse d'être
 * une dette : la case pose le choix HORS de la fenêtre de jet (`battle.stances`), la construction du
 * `PendingAttack` le consomme, et le −10 « Tirer pendant un Round où vous utilisez aussi votre
 * Mouvement » (`LDB 14 l.70`, fiche `regles/tir-en-mouvement`) tombe pour de vrai — mesuré sur la
 * production (`previewAttack`), jamais sur une valeur recopiée.
 */
describe('G5 — posture de tir pré-armée (`battle.stances`)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

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
    H.weapons = [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never;
    H.pos = { x: 6, y: 10 };
    E.pos = { x: 12, y: 10 }; // hors de portée de contact → l'arme à distance est celle qui parle
    useGame.setState({ battle: { ...useGame.getState().battle!, turn: b.order.indexOf(H.id), acted: false, movementUsed: 0, movedPreAction: false } });
    return { H, E };
  }

  const armer = () => runAction('posture-tir', useGame.getState);
  const posturee = (id: string) => !!useGame.getState().battle!.stances?.[id]?.heldGround;

  it('l’entrée du registre est VIVANTE : dispatcher + champ de posture, aucune dette déclarée', () => {
    const def = findActionById('posture-tir')!;
    expect(def.blocked, 'la posture ne se déclare plus bloquée').toBeUndefined();
    expect(def.run).toBe('battleToggleStance');
    expect(def.stance).toBe('heldGround');
  });

  it('la case ARME et DÉSARME la posture du combattant actif (bascule)', () => {
    const { H } = setup();
    expect(posturee(H.id)).toBe(false);
    armer();
    expect(posturee(H.id), 'un clic arme la posture').toBe(true);
    armer();
    expect(posturee(H.id), 're-clic : la posture se désarme').toBe(false);
  });

  it('le gate PORTE SA RAISON : sans arme à distance, et une fois le Mouvement entamé', () => {
    const { H } = setup();
    const ctx = () => ({ gameTime: 0, active: useGame.getState().battle!.combatants.find((c) => c.id === H.id)!, battle: useGame.getState().battle! });
    expect(actionGate('posture-tir', ctx()).ok, 'arc en main, Mouvement intact → offerte').toBe(true);

    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 1 } });
    const bouge = actionGate('posture-tir', ctx());
    expect(bouge.ok).toBe(false);
    expect(bouge.reason).toBe('Mouvement déjà entamé ce tour');
    armer();
    expect(posturee(H.id), 'le store refuse ce que le gate refuse').toBe(false);

    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 0 } });
    (useGame.getState().battle!.combatants.find((c) => c.id === H.id) as Combatant).weapons = [];
    const nu = actionGate('posture-tir', ctx());
    expect(nu.ok).toBe(false);
    expect(nu.reason).toBe('aucune arme à distance');
  });

  it('EFFET MÉCANIQUE : la posture armée passe dans le `PendingAttack` et efface le −10 (LDB 14 l.70)', () => {
    const { H, E } = setup();
    const attaquant = () => useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    const cible = () => useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    const pa = () => ({ attackerId: H.id, targetId: E.id, location: null, result: null });

    openAttackCascade(useGame.getState, useGame.setState, pa(), 'Tir', 'action/shoot');
    const mobile = useGame.getState().pendingAttack!;
    expect(mobile.heldGround, 'sans posture armée, rien n’est pré-rempli').toBeUndefined();
    const vMobile = previewAttack(useGame.getState, attaquant(), cible(), undefined, { heldGround: mobile.heldGround });

    useGame.setState({ pendingAttack: null });
    armer();
    openAttackCascade(useGame.getState, useGame.setState, pa(), 'Tir', 'action/shoot');
    const immobile = useGame.getState().pendingAttack!;
    expect(immobile.heldGround, 'la posture pré-armée arrive dans la fenêtre de jet').toBe(true);
    const vImmobile = previewAttack(useGame.getState, attaquant(), cible(), undefined, { heldGround: immobile.heldGround });

    // Le chiffre est celui de la PRODUCTION : l'écart mesuré est le cran « Complexe (-10) » du tir mobile.
    expect(vImmobile.target - vMobile.target).toBe(10);
    const ligne = (p: typeof vMobile) => [...p.mods, ...(p.difficultyParts ?? [])].find((m) => m.label === 'Tir en bougeant');
    expect(ligne(vMobile)?.value).toBe(-10);
    expect(ligne(vImmobile), 'posture armée : plus aucune ligne « Tir en bougeant »').toBeUndefined();
  });

  it('une posture PÉRIMÉE (Mouvement entamé depuis) ne se recopie pas dans le jet', () => {
    const { H, E } = setup();
    armer();
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 1 } });
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: H.id, targetId: E.id, location: null, result: null }, 'Tir', 'action/shoot');
    expect(useGame.getState().pendingAttack!.heldGround).toBeUndefined();
  });

  it('la posture ne SURVIT pas au Tour : le changement de Tour vide `stances`', () => {
    const { H } = setup();
    armer();
    expect(posturee(H.id)).toBe(true);
    useGame.getState().battleEndTurn();
    expect(useGame.getState().battle!.stances?.[H.id]?.heldGround).toBeFalsy();
  });

  it('MÊLÉE : une attaque au contact ne porte JAMAIS une posture de tir', () => {
    const { H, E } = setup();
    armer();
    runAction('posture-tas', useGame.getState); // l'autre posture aussi, si le contexte l'offre
    const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, uid: 'ep', qualities: [] } as never;
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    h.weapons = [...h.weapons, epee];
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    e.pos = { x: 7, y: 10 }; // au contact : c'est l'épée qui parle
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: H.id, targetId: E.id, location: null, result: null, weaponUid: 'ep' }, 'Attaque', 'action/attack');
    const pa = useGame.getState().pendingAttack!;
    expect(pa.heldGround, 'un pending de mêlée ne porte pas `heldGround`').toBeUndefined();
    expect(pa.intoCrowd, 'un pending de mêlée ne porte pas `intoCrowd`').toBeUndefined();
  });
});

/**
 * MATRICE kind × ARMABLE × GAIN (sonde du juge adversarial promue en contrat). `attackEnv` ne donne le
 * choix qu'au HÉROS (`combatFlow.ts`, « l'IA/ennemi (pas d'option) ») : un tireur piloté ne gagne RIEN
 * à la posture, il ne doit donc ni pouvoir l'armer ni en payer le Mouvement.
 */
describe('G5 — postures et KIND du tireur (parité stricte avec `attackEnv`)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 3 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    const arc = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] } as never;
    H.weapons = [arc];
    E.weapons = [arc];
    H.pos = { x: 6, y: 10 };
    E.pos = { x: 12, y: 10 };
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false, movementUsed: 0, movedPreAction: false } });
    return { H, E };
  }

  it('ARMABLE : oui pour le héros, non pour le tireur piloté (et la raison le dit)', () => {
    const { H, E } = setup();
    const b = () => useGame.getState().battle!;
    const par = (id: string) => b().combatants.find((c) => c.id === id)!;
    expect(STANCE_BLOCK.heldGround(b(), par(H.id)), 'héros : armable').toBeNull();
    expect(STANCE_BLOCK.heldGround(b(), par(E.id))).toBe('seul un héros décide de tenir sa position');
    expect(STANCE_BLOCK.intoCrowd(b(), par(E.id))).toBe('seul un héros renonce à choisir sa cible');
  });

  it('GAIN : le tireur piloté ne brûle PAS son Mouvement, même `heldGround` posé sur le pending', () => {
    const { H, E } = setup();
    useGame.setState({
      battle: { ...useGame.getState().battle!, turn: useGame.getState().battle!.order.indexOf(E.id), acted: false, movementUsed: 0 },
      pendingAttack: {
        attackerId: E.id, targetId: H.id, location: null, heldGround: true,
        result: { hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '' },
      },
    });
    useGame.getState().attackConfirm();
    expect(useGame.getState().battle!.movementUsed, 'aucun gain de posture → aucun Mouvement dépensé').toBe(0);
  });
});

/**
 * « TIRER DANS LE TAS » — `LDB 14 l.106` (bonus +20/+40/+60, succès appliqué au hasard) et `LDB 14
 * l.116` (verbatim : « Si vous n'avez cure de savoir sur qui vous tirez, vous gagnez un bonus allant
 * de +20 à +60 ») : c'est un CHOIX, donc une posture de console au patron de `posture-tir`.
 */
describe('G5 — posture « Dans le tas » (`intoCrowd`)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** `serre` : deux badauds AU CONTACT de la cible → groupe de 3 avec elle (seuil `crowdMod`). */
  function setup(serre: boolean) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 5 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    const E = foes[0];
    H.weapons = [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never;
    H.pos = { x: 6, y: 10 };
    E.pos = { x: 12, y: 10 };
    // Les AUTRES adversaires : collés à la cible (groupe serré) ou dispersés au loin.
    foes.slice(1).forEach((f, i) => { f.pos = serre ? { x: 12 + (i % 2), y: 11 } : { x: 20 + i, y: 2 }; });
    useGame.setState({ battle: { ...useGame.getState().battle!, turn: b.order.indexOf(H.id), acted: false, movementUsed: 0 } });
    return { H, E, foes };
  }

  it('gate : offerte face à un GROUPE serré, refusée (avec sa raison) sans groupe', () => {
    const nu = setup(false);
    const ctx = (id: string) => ({ gameTime: 0, active: useGame.getState().battle!.combatants.find((c) => c.id === id)!, battle: useGame.getState().battle! });
    const refus = actionGate('posture-tas', ctx(nu.H.id));
    expect(refus.ok).toBe(false);
    expect(refus.reason).toBe('aucun groupe serré en vue');

    const tas = setup(true);
    expect(actionGate('posture-tas', ctx(tas.H.id)).ok, 'un groupe de 3 au contact ouvre la posture').toBe(true);
  });

  it('EFFET MÉCANIQUE : armée, elle passe dans le pending et ajoute le bonus de groupe (LDB 14 l.106)', () => {
    const { H, E, foes } = setup(true);
    const attaquant = () => useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    const cible = () => useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(foes.length, 'la rencontre doit fournir de quoi faire un groupe').toBeGreaterThanOrEqual(3);

    runAction('posture-tas', useGame.getState);
    expect(useGame.getState().battle!.stances?.[H.id]?.intoCrowd).toBe(true);
    openAttackCascade(useGame.getState, useGame.setState, { attackerId: H.id, targetId: E.id, location: null, result: null }, 'Tir', 'action/shoot');
    const pa = useGame.getState().pendingAttack!;
    expect(pa.intoCrowd, 'la posture pré-armée arrive dans la fenêtre de jet').toBe(true);

    const vise = previewAttack(useGame.getState, attaquant(), cible(), undefined, {});
    const tas = previewAttack(useGame.getState, attaquant(), cible(), undefined, { intoCrowd: pa.intoCrowd });
    expect(tas.target - vise.target).toBe(20); // groupe de 3 à 6 → Accessible (+20)
    const ligne = [...tas.mods, ...(tas.difficultyParts ?? [])].find((m) => m.label.startsWith('Tirer dans le tas'));
    expect(ligne?.value).toBe(20);
  });

  /**
   * DÉPENSE PAR POSTURE. Le tir immobile a un PRIX (le Mouvement du Tour, `LDB 14 l.70`) : le tir le
   * consomme. « Dans le tas » n'en a aucun (`LDB 14 l.106` : un modificateur de Test, rien à dépenser)
   * — elle tient jusqu'au changement de Tour, qui vide `stances`. Une purge en bloc les confondait.
   */
  it('un tir IMMOBILE ne désarme que SA posture : « Dans le tas » survit au coup', () => {
    const { H, E } = setup(true);
    runAction('posture-tir', useGame.getState);
    runAction('posture-tas', useGame.getState);
    const armees = () => useGame.getState().battle!.stances?.[H.id] ?? {};
    expect(armees().heldGround, 'tir immobile armé').toBe(true);
    expect(armees().intoCrowd, '« Dans le tas » armée').toBe(true);

    openAttackCascade(useGame.getState, useGame.setState, { attackerId: H.id, targetId: E.id, location: null, result: null }, 'Tir', 'action/shoot');
    const pa = useGame.getState().pendingAttack!;
    expect(pa.heldGround, 'le coup part immobile').toBe(true);
    useGame.setState({
      pendingAttack: { ...pa, result: { hit: true, attackerRoll: 30, netSL: 1, location: 'corps', damage: 3, woundsLost: 3, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '' } } as never,
    });
    useGame.getState().attackConfirm();

    expect(useGame.getState().battle!.movementUsed, 'le tir immobile a bien payé son Mouvement').toBeGreaterThan(0);
    expect(armees().heldGround, 'la posture DÉPENSÉE tombe').toBeFalsy();
    expect(armees().intoCrowd, 'la posture SANS PRIX reste armée').toBe(true);
    useGame.getState().battleEndTurn();
    expect(useGame.getState().battle!.stances?.[H.id]?.intoCrowd, 'et le Tour, lui, la vide').toBeFalsy();
  });

  it('la posture se refuse hors contexte : sans groupe, le store ne l’arme pas', () => {
    const { H } = setup(false);
    runAction('posture-tas', useGame.getState);
    expect(useGame.getState().battle!.stances?.[H.id]?.intoCrowd).toBeFalsy();
  });
});

/**
 * GARDE STRUCTURELLE (grief « prédicat unique ») : le prédicat des postures vit à UN seul endroit.
 * Aucune surface ne peut re-dériver « Mouvement intact » à la main — c'est cette divergence qui avait
 * fait mentir la fenêtre de jet sur le kind du tireur ET sur l'arme employée.
 */
describe('G5 — le prédicat de posture n’est recodé nulle part', () => {
  it('aucune surface ne re-dérive le Mouvement de la posture (`STANCE_BLOCK` seul)', () => {
    const lire = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
    // Périmètre = les SURFACES de la posture (fenêtre de jet, console, registre) : c'est là qu'un
    // second prédicat naît. `combatSlice` porte le même motif pour l'économie du Mouvement elle-même
    // (Maladresse, annulation de segment), qui n'a rien d'une posture.
    for (const rel of ['../ui/jetProps/useAttackJetProps.tsx', '../ui/CombatConsole.tsx', './actionRegistry.ts']) {
      expect(lire(rel), `${rel} recode le prédicat de posture`).not.toMatch(/movementUsed\s*===\s*0/);
    }
    // … et le prédicat, lui, l'exprime bien (une garde qui ne mesure rien serait verte pour rien).
    expect(lire('./combatFlow.ts')).toMatch(/battle\.movementUsed > 0/);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castSpell } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';

/**
 * Contre-sort à plusieurs CANDIDATS (Dissipation, LDB 46 l.156) — flux MULTI : le Sort ENNEMI est
 * figé dans `pendingCast`, chaque contre-lanceur éligible a SA rangée
 * (`pendingCounterspell.participants`) avec son propre cycle d'influence. PLUSIEURS peuvent tenter
 * contre la MÊME incantation (`VDM 02 l.184`, `LDB 46 l.162` ; #1040, cf. `counterspellConfirm`,
 * src/state/combatSlice.ts) : chacun
 * consomme SON essai du Round (l.156, par personnage), un succès quelconque dissipe, et l'échec
 * collectif laisse le Sort se résoudre au MEILLEUR DR opposé.
 */
describe('Contre-sort à plusieurs candidats — N tenteurs (flux multi)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCounterspell: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: name, careerTalent: { id: 'magie-mineure' }, rng: makeRNG(seed) });
      h.spells = ['flechette'];
      h.resilience = 1; // pour les tests de Résilience
      return h;
    };
    const w1 = mk('W1', 707), w2 = mk('W2', 101);
    useGame.setState({ party: [w1, w2] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(2).forEach((e) => (e.dead = true));
    const [E, E2] = enemies;
    for (const e of [E, E2]) {
      if (!e) continue;
      e.characteristics.intelligence = 48; e.characteristics['force-mentale'] = 53;
      e.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
      e.spells = ['carreau'];
    }
    heroes.forEach((h, i) => { h.pos = { x: 10, y: 10 + i }; h.wounds = { ...h.wounds, max: 99, current: 99 }; });
    E.pos = { x: 12, y: 10 }; // ≤ FM mètres de chaque héros
    if (E2) E2.pos = { x: 12, y: 11 };
    useGame.setState({ battle: { ...b } });
    return { heroes: heroes as Combatant[], E, E2 };
  }

  /** Ouvre l'incantation ENNEMIE figée (= ce que fait le pré-roll de `castSpell` pour un lanceur IA). */
  function enemyCast(E: Combatant, target: Combatant) {
    castSpell(useGame.getState, useGame.setState, E, target, 'carreau');
    useGame.getState().castRoll();
  }
  /** Incantation FIGÉE, jet POSÉ : l'agrégation se mesure sur `pendingCast.result` sans aléa. */
  function freezeCast(caster: Combatant, target: Combatant, sl: number) {
    useGame.setState({
      pendingCounterspell: null,
      pendingCast: {
        casterId: caster.id, targetId: target.id, spellId: 'carreau', missile: true, focused: false,
        result: { cast: true, roll: 30, target: 60, sl, isCritical: false, isFumble: false, log: 'Sort lancé' },
      },
    } as unknown as Partial<GameState>);
  }
  function openCounter(ids: string[]) {
    useGame.setState({ pendingCounterspell: { participants: ids.map((id) => ({ id, interactive: true, result: null })) } });
  }
  /** Rangée au résultat POSÉ (aucun aléa : le sujet est l'agrégation). */
  const row = (id: string, dispelled: boolean, counterSL: number, casterNetSL: number, log: string) => ({
    id, interactive: true,
    result: { dispelled, counter: { roll: 5, target: 40, sl: counterSL, success: dispelled, isDouble: false }, casterNetSL, log },
  });
  const cur = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

  it('DÉCLARATION : le déclaré SOLO chante et consomme SON essai, celui qui PASSE garde le sien', () => {
    useGame.getState().seedRng(9);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    openCounter([h1.id, h2.id]);
    useGame.getState().counterspellDeclare(h1.id, 'solo');
    useGame.getState().counterspellDeclare(h2.id, 'pass');
    useGame.getState().counterspellRoll(h1.id);
    useGame.getState().counterspellRoll(h2.id); // une rangée qui passe ne lance jamais
    const parts = useGame.getState().pendingCounterspell!.participants;
    expect(parts.find((p) => p.id === h1.id)!.result, 'le chanteur a son jet').toBeTruthy();
    expect(parts.find((p) => p.id === h2.id)!.result, 'passer, c’est ne pas tenter').toBeNull();
    expect(cur(h1.id).dispelledThisRound, 'le chanteur consomme SON essai du Round').toBe(true);
    expect(cur(h2.id).dispelledThisRound, 'passer ne brûle rien').toBeFalsy();
    useGame.getState().counterspellConfirm();
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull();
  });

  it('UN SUCCÈS QUELCONQUE dissipe : la rangée gagnante l’emporte même si une autre a raté', () => {
    // Lanceur SURFACÉ (héros) : sa modale tient encore l'incantation après la fenêtre — l'issue
    // agrégée y reste LISIBLE (un lanceur IA verrait sa situation se refermer à l'application).
    const { heroes, E, E2 } = setup();
    const [h1] = heroes;
    freezeCast(h1, E, 5);
    useGame.setState({ pendingCounterspell: { participants: [
      row(E.id, false, -3, 8, 'RATÉ'),
      row(E2.id, true, 4, 1, 'DISSIPÉ'),
    ] } } as unknown as Partial<GameState>);
    useGame.getState().counterspellConfirm();
    const res = useGame.getState().pendingCast!.result!;
    expect(res.dispelled, 'un succès quelconque dissipe (l.156 : « Sur un succès, vous dissipez le Sort »)').toBe(true);
    expect(res.cast).toBe(false);
    expect(res.log).toContain('DISSIPÉ');
  });

  it('ÉCHEC COLLECTIF : le Sort se résout au MEILLEUR DR opposé, pas au premier venu', () => {
    const { heroes, E, E2 } = setup();
    const [h1] = heroes;
    freezeCast(h1, E, 5);
    useGame.setState({ pendingCounterspell: { participants: [
      row(E.id, false, -3, 8, 'FAIBLE'), // premier à avoir chanté, mais le plus mauvais DR
      row(E2.id, false, 1, 4, 'MEILLEUR'),
    ] } } as unknown as Partial<GameState>);
    useGame.getState().counterspellConfirm();
    const res = useGame.getState().pendingCast!.result!;
    expect(res.dispelled).toBeFalsy();
    expect(res.log, 'le DR retenu est le plus haut des Contre-sorts ratés').toContain('MEILLEUR');
    expect(res.log).not.toContain('FAIBLE');
    expect(res.sl, 'DR net du lanceur = incantation − meilleur DR opposé').toBe(4);
  });

  it('Résilience d’une rangée NON DÉCLARÉE, après l’échec d’un autre : REFUSÉE, et le Point reste en poche', () => {
    useGame.getState().seedRng(5);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    // Premier chant RATÉ (rangée posée : le sujet est le geste du second, pas l'aléa du premier). Le
    // second n'a rien déclaré : la phase de déclaration verrouille TOUS les chemins de dé (#1042/#1059),
    // Résilience comprise — et un geste refusé ne dépense rien.
    useGame.setState({ pendingCounterspell: { participants: [
      row(h1.id, false, -3, 8, 'RATÉ'),
      { id: h2.id, interactive: true, result: null },
    ] } } as unknown as Partial<GameState>);
    useGame.getState().counterspellForceSuccess(h2.id); // « Je ne faillirai pas ! » du SECOND
    const parts = useGame.getState().pendingCounterspell!.participants;
    expect(parts.find((p) => p.id === h2.id)!.result, 'aucun jet pour une rangée non déclarée').toBeNull();
    expect(cur(h2.id).resilience, 'le Point n’est PAS dépensé sur un geste refusé').toBe(1);
    expect(cur(h2.id).dispelledThisRound, 'son essai du Round reste INTACT').toBeFalsy();
    useGame.getState().counterspellConfirm();
    expect(useGame.getState().pendingCast).toBeNull();
  });

  it('une rangée qui a DISSIPÉ ferme la lice : le suivant est refusé SANS brûler son essai du Round', () => {
    useGame.getState().seedRng(7);
    const { heroes, E, E2 } = setup();
    const [h1] = heroes;
    freezeCast(h1, E, 5); // lanceur héros : l'incantation reste lisible
    useGame.setState({ pendingCounterspell: { participants: [
      row(E.id, true, 4, 1, 'DISSIPÉ'),
      { id: E2.id, interactive: true, result: null },
    ] } } as unknown as Partial<GameState>);
    useGame.getState().counterspellRoll(E2.id); // plus rien à dissiper (LDB 46 l.156)
    const parts = useGame.getState().pendingCounterspell!.participants;
    expect(parts.find((p) => p.id === E2.id)!.result, 'aucun jet sur un Sort déjà dissipé').toBeNull();
    expect(cur(E2.id).dispelledThisRound, 'sa tentative du Round reste INTACTE').toBeFalsy();
    // Le dé fixé et la Résilience passent par la MÊME couture : mêmes refus, même absence de dépense.
    useGame.getState().counterspellForceSuccess(E2.id);
    expect(useGame.getState().pendingCounterspell!.participants.find((p) => p.id === E2.id)!.result).toBeNull();
    expect(cur(E2.id).dispelledThisRound).toBeFalsy();
  });

  it('fenêtre DÉCLARÉE mais VIERGE : « Appliquer » et « Laisser passer » rendent la MÊME issue (repli IA unique)', () => {
    /** Fenêtre à un surfacé qui a déclaré sans chanter + un contre-lanceur IA témoin, jet du lanceur figé. */
    const openVierge = () => {
      useGame.getState().seedRng(5);
      const { heroes, E } = setup();
      freezeCast(heroes[0], E, 3);
      useGame.setState({ pendingCounterspell: { participants: [
        { id: heroes[1].id, interactive: true, declared: 'solo', result: null },
        { id: E.id, interactive: false, declared: 'solo', result: null },
      ] } } as unknown as Partial<GameState>);
      return E;
    };
    const E1 = openVierge();
    useGame.getState().counterspellCancel();
    const parLaisser = { log: useGame.getState().pendingCast!.result!.log, essai: !!cur(E1.id).dispelledThisRound };
    const E2b = openVierge();
    useGame.getState().counterspellConfirm();
    const parAppliquer = { log: useGame.getState().pendingCast!.result!.log, essai: !!cur(E2b.id).dispelledThisRound };
    expect(parLaisser.log, 'l’IA chante dans les deux cas').toContain('Contre-sort de');
    expect(parAppliquer, 'deux boutons, même état → même issue').toEqual(parLaisser);
  });

  it('« Laisser passer » après déclaration (aucun Contre-sort chanté) → le Sort se résout tel quel', () => {
    useGame.getState().seedRng(3);
    const { heroes, E } = setup();
    const [h1] = heroes;
    enemyCast(E, h1);
    const castLog = useGame.getState().pendingCast!.result!.log;
    openCounter([h1.id]);
    // PHASE 1 (#1042/#1059) : la porte de sortie s'ouvre une fois la composition arrêtée — ici le seul
    // candidat déclare qu'il contrera, puis renonce sans jeter.
    useGame.getState().counterspellDeclare(h1.id, 'solo');
    useGame.getState().counterspellCancel(); // personne ne contre
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull();
    expect(castLog).not.toContain('Contre-sort'); // le jet ennemi n'a pas été opposé
  });
});

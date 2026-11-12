import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import { castSpell } from './combatFlow';
import { fermeturesDuFlux } from './verbesOuverts';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Contre-sort à plusieurs CANDIDATS (Dissipation, LDB 46 l.156) — flux MULTI : le Sort ENNEMI est
 * figé dans `pendingCast`, chaque contre-lanceur éligible a SA rangée
 * (`pendingCounterspell.participants`) avec son propre cycle d'influence. PLUSIEURS peuvent tenter
 * contre la MÊME incantation (`VDM 02 l.184`, `LDB 46 l.162` ; #1040, cf. `jetValider('contreSort')`,
 * src/noyau/combatSlice.ts) : chacun
 * consomme SON essai du Round (l.156, par personnage), un succès quelconque dissipe, et l'échec
 * collectif laisse le Sort se résoudre au MEILLEUR DR opposé.
 */
describe('Contre-sort à plusieurs candidats — N tenteurs (flux multi)', () => {
  function setup() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: name, careerTalent: { id: 'magie-mineure' }, seed });
      h.spells = ['flechette'];
      h.resilience = 1; // pour les tests de Résilience
      return h;
    };
    const w1 = mk('W1', 707), w2 = mk('W2', 101);
    banc.setState({ party: [w1, w2] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'heros');
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(2).forEach((e) => (e.dead = true));
    const [E, E2] = enemies;
    for (const e of [E, E2]) {
      if (!e) continue;
      e.characteristics.intelligence = 48; e.characteristics['force-mentale'] = 53;
      e.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
      e.spells = ['carreau'];
    }
    heroes.forEach((h, i) => { h.pos = { x: 10, y: 10 + i }; h.wounds = blessuresDeBase(99, 99, h); });
    E.pos = { x: 12, y: 10 }; // ≤ FM mètres de chaque héros
    if (E2) E2.pos = { x: 12, y: 11 };
    banc.setState({ battle: { ...b } });
    return { heroes: heroes as Combatant[], E, E2 };
  }

  /** Ouvre l'incantation ENNEMIE figée (= ce que fait le pré-roll de `castSpell` pour un lanceur IA). */
  function enemyCast(E: Combatant, target: Combatant) {
    castSpell(banc.getState, banc.setState, E, target, 'carreau');
    banc.getState().jetLancer('incantation');
  }
  /** Incantation FIGÉE, jet POSÉ : l'agrégation se mesure sur `pendingCast.result` sans aléa. */
  function freezeCast(caster: Combatant, target: Combatant, sl: number) {
    banc.setState({
      pendingCounterspell: null,
      pendingCast: {
        casterId: caster.id, targetId: target.id, spellId: 'carreau', missile: true, focused: false,
        result: { cast: true, roll: 30, target: 60, sl, isCritical: false, isFumble: false, log: 'Sort lancé' },
      },
    } as unknown as Partial<Jeu>);
  }
  function openCounter(ids: string[]) {
    banc.setState({ pendingCounterspell: { participants: ids.map((id) => ({ id, interactive: true, result: null })) } });
  }
  /** Rangée au résultat POSÉ (aucun aléa : le sujet est l'agrégation). */
  const row = (id: string, dispelled: boolean, counterSL: number, casterNetSL: number, log: string) => ({
    id, interactive: true, declared: 'solo' as const,
    result: { dispelled, counter: { roll: 5, target: 40, sl: counterSL, success: dispelled, isDouble: false }, casterNetSL, log },
  });
  const cur = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;

  it('DÉCLARATION : le déclaré SOLO chante et consomme SON essai, celui qui PASSE garde le sien', () => {
    banc.getState().ensemencerLeTirage(9);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    openCounter([h1.id, h2.id]);
    banc.getState().jetRegler('contreSort', 'declaration', 'solo', h1.id);
    banc.getState().jetRegler('contreSort', 'declaration', 'passer', h2.id);
    banc.getState().jetLancer('contreSort', h1.id);
    banc.getState().jetLancer('contreSort', h2.id); // une rangée qui passe ne lance jamais
    const parts = banc.getState().pendingCounterspell!.participants;
    expect(parts.find((p) => p.id === h1.id)!.result, 'le chanteur a son jet').toBeTruthy();
    expect(parts.find((p) => p.id === h2.id)!.result, 'passer, c’est ne pas tenter').toBeNull();
    expect(cur(h1.id).dispelledThisRound, 'le chanteur consomme SON essai du Round').toBe(true);
    expect(cur(h2.id).dispelledThisRound, 'passer ne brûle rien').toBeFalsy();
    banc.getState().jetValider('contreSort');
    expect(banc.getState().pendingCounterspell).toBeNull();
    expect(banc.getState().pendingCast).toBeNull();
  });

  it('UN SUCCÈS QUELCONQUE dissipe : la rangée gagnante l’emporte même si une autre a raté', () => {
    // Lanceur SURFACÉ (héros) : sa modale tient encore l'incantation après la fenêtre — l'issue
    // agrégée y reste LISIBLE (un lanceur IA verrait sa situation se refermer à l'application).
    const { heroes, E, E2 } = setup();
    const [h1] = heroes;
    freezeCast(h1, E, 5);
    banc.setState({ pendingCounterspell: { participants: [
      row(E.id, false, -3, 8, 'RATÉ'),
      row(E2.id, true, 4, 1, 'DISSIPÉ'),
    ] } } as unknown as Partial<Jeu>);
    banc.getState().jetValider('contreSort');
    const res = banc.getState().pendingCast!.result!;
    expect(res.dispelled, 'un succès quelconque dissipe (l.156 : « Sur un succès, vous dissipez le Sort »)').toBe(true);
    expect(res.cast).toBe(false);
    expect(res.log).toContain('DISSIPÉ');
  });

  it('ÉCHEC COLLECTIF : le Sort se résout au MEILLEUR DR opposé, pas au premier venu', () => {
    const { heroes, E, E2 } = setup();
    const [h1] = heroes;
    freezeCast(h1, E, 5);
    banc.setState({ pendingCounterspell: { participants: [
      row(E.id, false, -3, 8, 'FAIBLE'), // premier à avoir chanté, mais le plus mauvais DR
      row(E2.id, false, 1, 4, 'MEILLEUR'),
    ] } } as unknown as Partial<Jeu>);
    banc.getState().jetValider('contreSort');
    const res = banc.getState().pendingCast!.result!;
    expect(res.dispelled).toBeFalsy();
    expect(res.log, 'le DR retenu est le plus haut des Contre-sorts ratés').toContain('MEILLEUR');
    expect(res.log).not.toContain('FAIBLE');
    expect(res.sl, 'DR net du lanceur = incantation − meilleur DR opposé').toBe(4);
  });

  it('Résilience d’une rangée NON DÉCLARÉE, après l’échec d’un autre : REFUSÉE, et le Point reste en poche', () => {
    banc.getState().ensemencerLeTirage(5);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    // Premier chant RATÉ (rangée posée : le sujet est le geste du second, pas l'aléa du premier). Le
    // second n'a rien déclaré : la phase de déclaration verrouille TOUS les chemins de dé (#1042/#1059),
    // Résilience comprise — et un geste refusé ne dépense rien.
    banc.setState({ pendingCounterspell: { participants: [
      row(h1.id, false, -3, 8, 'RATÉ'),
      { id: h2.id, interactive: true, result: null },
    ] } } as unknown as Partial<Jeu>);
    banc.getState().jetForcerLaReussite('contreSort', h2.id); // « Je ne faillirai pas ! » du SECOND
    const parts = banc.getState().pendingCounterspell!.participants;
    expect(parts.find((p) => p.id === h2.id)!.result, 'aucun jet pour une rangée non déclarée').toBeNull();
    expect(cur(h2.id).resilience, 'le Point n’est PAS dépensé sur un geste refusé').toBe(1);
    expect(cur(h2.id).dispelledThisRound, 'son essai du Round reste INTACT').toBeFalsy();
    expect(fermeturesDuFlux(banc.getState(), 'contreSort').valider, 'la fenêtre attend sa déclaration (LDB 46 l.156)').toBe('declarationsDues');
  });

  it('une rangée qui a DISSIPÉ ferme la lice : le suivant est refusé SANS brûler son essai du Round', () => {
    banc.getState().ensemencerLeTirage(7);
    const { heroes, E, E2 } = setup();
    const [h1] = heroes;
    freezeCast(h1, E, 5); // lanceur héros : l'incantation reste lisible
    banc.setState({ pendingCounterspell: { participants: [
      row(E.id, true, 4, 1, 'DISSIPÉ'),
      { id: E2.id, interactive: true, result: null },
    ] } } as unknown as Partial<Jeu>);
    banc.getState().jetLancer('contreSort', E2.id); // plus rien à dissiper (LDB 46 l.156)
    const parts = banc.getState().pendingCounterspell!.participants;
    expect(parts.find((p) => p.id === E2.id)!.result, 'aucun jet sur un Sort déjà dissipé').toBeNull();
    expect(cur(E2.id).dispelledThisRound, 'sa tentative du Round reste INTACTE').toBeFalsy();
    // Le dé fixé et la Résilience passent par la MÊME couture : mêmes refus, même absence de dépense.
    banc.getState().jetForcerLaReussite('contreSort', E2.id);
    expect(banc.getState().pendingCounterspell!.participants.find((p) => p.id === E2.id)!.result).toBeNull();
    expect(cur(E2.id).dispelledThisRound).toBeFalsy();
  });

  it('fenêtre DÉCLARÉE sans jet dû : « Appliquer » et « Laisser passer » rendent la MÊME issue (repli IA unique)', () => {
    /** Fenêtre à un surfacé qui passe + un contre-lanceur IA témoin, jet du lanceur figé. */
    const openVierge = () => {
      banc.getState().ensemencerLeTirage(5);
      const { heroes, E } = setup();
      freezeCast(heroes[0], E, 3);
      banc.setState({ pendingCounterspell: { participants: [
        { id: heroes[1].id, interactive: true, declared: 'passer', result: null },
        { id: E.id, interactive: false, declared: 'solo', result: null },
      ] } } as unknown as Partial<Jeu>);
      return E;
    };
    const E1 = openVierge();
    banc.getState().jetAnnuler('contreSort');
    const parLaisser = { log: banc.getState().pendingCast!.result!.log, essai: !!cur(E1.id).dispelledThisRound };
    const E2b = openVierge();
    banc.getState().jetValider('contreSort');
    const parAppliquer = { log: banc.getState().pendingCast!.result!.log, essai: !!cur(E2b.id).dispelledThisRound };
    expect(parLaisser.log, 'l’IA chante dans les deux cas').toContain('Contre-sort de');
    expect(parAppliquer, 'deux boutons, même état → même issue').toEqual(parLaisser);
  });

  it('« Laisser passer » après déclaration (aucun Contre-sort chanté) → le Sort se résout tel quel', () => {
    banc.getState().ensemencerLeTirage(3);
    const { heroes, E } = setup();
    const [h1] = heroes;
    enemyCast(E, h1);
    const castLog = banc.getState().pendingCast!.result!.log;
    openCounter([h1.id]);
    // PHASE 1 (#1042/#1059) : la porte de sortie s'ouvre une fois la composition arrêtée — ici le seul
    // candidat déclare qu'il contrera, puis renonce sans jeter.
    banc.getState().jetRegler('contreSort', 'declaration', 'solo', h1.id);
    banc.getState().jetAnnuler('contreSort'); // personne ne contre
    expect(banc.getState().pendingCounterspell).toBeNull();
    expect(banc.getState().pendingCast).toBeNull();
    expect(castLog).not.toContain('Contre-sort'); // le jet ennemi n'a pas été opposé
  });
});

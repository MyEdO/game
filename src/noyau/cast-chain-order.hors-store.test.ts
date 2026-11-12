import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { resolveCastChain } from './combatFlow';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * ORDRE de la chaîne d'incantation (`resolveCastChain`, src/noyau/combatFlow.ts) : Contre-sort, puis
 * Test opposé de la cible, puis application. LDB 46 l.156 : « Sur un succès, vous dissipez le Sort ;
 * sur un échec, le Sort utilise le DR du Test opposé pour déterminer si l'incantation a réussi
 * normalement. » — le Contre-sort décide donc si l'incantation aboutit, et se règle AVANT toute
 * opposition de cible et avant l'application.
 */
describe('Chaîne d’incantation — le Contre-sort se règle avant l’opposition de cible', () => {
  /** Sorcier + une cible Démoniaque vivante (gate `onlyGroups` de Fauche-démon, Sort `opposed`). */
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest,
      speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W',
      careerTalent: { id: 'magie-mineure' }, seed: 707,
    });
    hero.spells = ['fauche-demon'];
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    E.groups = ['demon'];
    E.characteristics['force-mentale'] = 20;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 };
    banc.setState({ battle: { ...b } });
    return { H, E };
  }

  /** Incantation RÉUSSIE figée d'un Sort `opposed`, prête à confirmer. */
  function frozenCast(H: Combatant, E: Combatant) {
    banc.setState({
      pendingCast: {
        casterId: H.id, targetId: E.id, spellId: 'fauche-demon', missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'x' },
      },
    });
  }

  it('Contre-sort OUVERT + opposition due → la chaîne n’ouvre PAS l’opposition et n’applique RIEN', () => {
    const { H, E } = setup();
    frozenCast(H, E);
    banc.setState({ pendingCounterspell: { participants: [{ id: E.id, interactive: true, result: null }] } }); // contre-lanceur ADVERSE (le lanceur ne se contre pas lui-même : `counterspellCandidates` l'exclut)
    resolveCastChain(banc.getState, banc.setState);
    expect(banc.getState().pendingCounterspell, 'le Contre-sort reste ouvert : c’est lui qui se règle d’abord').toBeTruthy();
    expect(banc.getState().pendingCastOpposition, 'l’opposition de cible ne s’ouvre pas avant le Contre-sort').toBeNull();
    expect(banc.getState().pendingCast, 'l’incantation reste figée (rien n’est appliqué)').toBeTruthy();
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dead ?? false).toBe(false);
  });

  it('Contre-sort RÉGLÉ (aucun) + opposition due → la chaîne ouvre l’opposition, sans appliquer', () => {
    const { H, E } = setup();
    frozenCast(H, E);
    resolveCastChain(banc.getState, banc.setState);
    expect(banc.getState().pendingCastOpposition, 'plus de Contre-sort en attente → l’étape suivante s’ouvre').toBeTruthy();
    expect(banc.getState().pendingCast).toBeTruthy();
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dead ?? false).toBe(false);
  });

  it('Contre-sort réglé + opposition résolue → la chaîne APPLIQUE (Fauche-démon annihile)', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, E } = setup();
    frozenCast(H, E);
    const pc = banc.getState().pendingCast!;
    banc.setState({ pendingCast: { ...pc, opposedOutcome: { [E.id]: { resisted: false, margin: 6 } } } });
    resolveCastChain(banc.getState, banc.setState);
    expect(banc.getState().pendingCastOpposition).toBeNull();
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dead).toBe(true);
  });

  it('CHAÎNE COMPLÈTE par les vraies coutures : « Laisser passer » → « Appliquer » → opposition → confirm → annihilation', () => {
    banc.getState().ensemencerLeTirage(11);
    const { H, E } = setup();
    frozenCast(H, E);
    // Fenêtre de Contre-sort telle que `routeCounterspell` la pose après le jet figé (ici, un
    // contre-lanceur adverse possédé par un siège).
    banc.setState({ pendingCounterspell: { participants: [{ id: E.id, interactive: true, declared: 'solo', result: null }] } });
    banc.getState().jetAnnuler('contreSort'); // aucun Contre-sort retenu → la fenêtre se ferme
    expect(banc.getState().pendingCounterspell).toBeNull();
    // Le LANCEUR est surfacé (héros manuel) : sa modale d'incantation tient encore ses choix — la
    // chaîne ne repart pas toute seule (#1028, `resumeAfterCounterspell`), c'est « Appliquer » qui la relance.
    expect(banc.getState().pendingCastOpposition, 'la chaîne n’avance pas dans le dos du lanceur').toBeNull();
    banc.getState().jetValider('incantation');
    expect(banc.getState().pendingCastOpposition, 'l’opposition de cible s’ouvre une fois le Contre-sort réglé').toBeTruthy();
    expect(banc.getState().pendingCast, 'rien n’est appliqué tant que l’opposition est due').toBeTruthy();
    const part = banc.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.interactive).toBe(false); // cible IA = rangée témoin, jet roulé à l'ouverture
    expect(part.result!.resisted).toBe(false); // FM 20 vs incantation à +6 DR
    banc.getState().jetValider('opposition');
    expect(banc.getState().pendingCastOpposition).toBeNull();
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dead).toBe(true);
  });

  it('ZdE non posée : `resolveCastChain` et `jetValider(\'incantation\')` laissent le MÊME état (la pose passe avant l’opposition)', () => {
    /** Pose une ZdE NON posée sur l'incantation figée (center null = pose encore due). */
    const zdeNonPosee = () => {
      const pc = banc.getState().pendingCast!;
      banc.setState({ pendingCast: { ...pc, zone: { center: null, radius: 2, placing: false } } });
    };
    /** Ce que l'appelant observe : opposition ouverte ? zone passée en pose ? */
    const etat = () => ({
      opposition: !!banc.getState().pendingCastOpposition,
      placing: banc.getState().pendingCast?.zone?.placing ?? null,
    });

    const parLaChaine = (() => {
      const { H, E } = setup();
      frozenCast(H, E);
      zdeNonPosee();
      resolveCastChain(banc.getState, banc.setState);
      return etat();
    })();
    const parCastConfirm = (() => {
      const { H, E } = setup();
      frozenCast(H, E);
      zdeNonPosee();
      banc.getState().jetValider('incantation');
      return etat();
    })();

    expect(parLaChaine).toEqual(parCastConfirm);
    expect(parLaChaine.opposition, 'une ZdE non posée n’ouvre pas l’opposition : sa pose passe d’abord').toBe(false);
    expect(parLaChaine.placing, 'la confirmation EST le passage en pose').toBe(true);
  });
});

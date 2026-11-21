import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, afterEach } from 'vitest';
import { ouvrirLeBanc } from '../banc.testkit';
import { scenario } from '../../scenes/test-scenarios/45-breche-au-canon';
import { lancementDuScenario } from '../../scenes/test-scenarios/_shared';
import { findSiegeEngineById, qualityInstance } from '../../data';
import { crewedTeamIndice } from '../../engine/qualities/dispatch';
import { idsDuJeu, resetRule } from '../../engine/policy';
import { servingCrewPresent } from '../monde/shipPostes';
import { areteDessinee } from '../monde/aretes';
import { creerPartie, etatInitialDuJeu, activeCombatant, type Jeton, type Partie, type ResultatDeLAppel } from '../index';
import type { WallSeg } from '../monde/scene';

afterEach(() => { for (const id of idsDuJeu(scenario.rules ?? {})) resetRule(id); });
const scenarioConstruit = scenario.construire(idsDeTest);

/** Graine de la démonstration : la porte y passe en brèche au Round 1 (mesure des graines 2 à 13 au rendu de #4187). */
const GRAINE = 2;
const ROUNDS_MAX = 3;

/** Effectif d'Équipe de la pièce `trappingId` (Qualité `arme-d-equipe`, AA 10 l.236-241). */
const equipeDe = (trappingId: string): number =>
  crewedTeamIndice({ qualities: findSiegeEngineById(trappingId)!.qualities.map(qualityInstance) });

const herse = (walls: readonly WallSeg[] | undefined): WallSeg[] => (walls ?? []).filter((w) => w.structure === 'porte-de-ville');

/**
 * La partie du scénario à la graine `graine`, groupe PASSIF (chaque héros finit son tour sans agir), jouée par le flux
 * du jeu (`creerPartie`, lancement du scénario, jetons repris dans l'ordre), jusqu'à `fini` ou la fin du combat.
 */
function jouerPassif(graine: number, fini: (p: Partie) => boolean): Partie {
  const partie = creerPartie(etatInitialDuJeu(), { graine, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} });
  const file: Jeton[] = [];
  const suivre = (r: ResultatDeLAppel): void => { for (const e of r.evenements) if (e.type === 'programme') file.push(e.jeton); };
  suivre(partie.lancer(lancementDuScenario(scenario, partie.etat().forgerUnId)));
  for (let pas = 0; pas < 2000; pas++) {
    const s = partie.etat();
    if (!s.battle || s.battle.over || fini(partie)) return partie;
    if (file.length) suivre(partie.reprendre(file.shift()!));
    else if (s.pendingRoundStart) suivre(partie.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] }));
    else if (activeCombatant(s.battle)?.kind === 'heros' && !activeCombatant(s.battle)?.aiControlled) suivre(partie.envoyer({ type: 'terminerLeTour', args: [] }));
    else throw new Error(`partie bloquée au Round ${s.battle.round} : tour de ${activeCombatant(s.battle)?.id}`);
  }
  throw new Error('plafond de gestes atteint');
}

describe('Brèche au canon (breche-au-canon)', () => {
  it('UNE seule arête de porte, à la bouche N de la case `D`', () => {
    const portes = herse(scenarioConstruit.scene.walls);
    expect(portes.map((w) => [w.x, w.y, w.side])).toEqual([[7, 9, 'N']]);
  });

  it('ÉQUIPES COMPLÈTES : chaque pièce a l’effectif de sa Qualité, tous servants qualifiés (AA 10 l.230, AA 10 l.236-241)', () => {
    const affuts = scenarioConstruit.scene.entities.filter((e) => e.postes?.length);
    expect(affuts.length).toBeGreaterThan(0);
    const banc = ouvrirLeBanc();
    banc.setState({ party: scenario.construire(idsDeTest).party });
    banc.getState().lancerLaScene(scenarioConstruit.scene);
    banc.getState().lancerLeCombat(scenario.autoCombat!);
    const b = banc.getState().battle!;
    for (const affut of affuts) {
      const poste = affut.postes![0];
      const requis = equipeDe(poste.engin.id);
      expect(poste.crewIds?.length, `${affut.id} : équipe déclarée`).toBe(requis);
      const chef = b.combatants.find((c) => c.id === poste.crewIds![0])!;
      expect(chef.mannedPoste?.item.trappingId, `${chef.id} sert la pièce`).toBe(poste.engin.id);
      expect(servingCrewPresent(chef, b.combatants), `${affut.id} : servants qualifiés présents`).toBe(requis);
    }
  });

  it('BRÈCHE : la batterie menée par l’IA abat la porte en 3 Rounds au plus, groupe passif (#4187)', () => {
    const enBreche = (p: Partie) => herse(p.etat().scene?.walls).some((w) => areteDessinee(p.etat().scene!, w).piece === 'breche');
    const partie = jouerPassif(GRAINE, (p) => enBreche(p) || (p.etat().battle?.round ?? 0) > ROUNDS_MAX);
    try {
      const round = partie.etat().battle?.round;
      expect(enBreche(partie), `porte debout au Round ${round}`).toBe(true);
      expect(round).toBeLessThanOrEqual(ROUNDS_MAX);
    } finally {
      partie.fermer();
    }
  });
});

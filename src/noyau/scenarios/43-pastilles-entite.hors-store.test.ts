import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { scenario } from '../../scenes/test-scenarios/43-pastilles-entite';
import { offresDeLActif, offresParPorteur, type Offre } from '../actionRegistry';
import { activeCombatant } from '../combatFlow';
import type { Jeu } from '../etat';
import { chebyshev } from '../../engine/grid';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const scenarioConstruit = scenario.construire(idsDeTest);

/**
 * PASTILLES D'ENTITÉ — le scénario COUVRE-T-IL vraiment les gestes qu'il annonce ? (#1411 P2-C, R3)
 *
 * Aucun scénario ne combinait jusqu'ici un combat, un décor à ramasser à ≥ 2 objets et une pièce
 * servie : la recette navigateur des pastilles n'avait donc pas de banc. Cette sonde mesure le banc
 * lui-même, sur l'état RÉEL que produit le scénario (`lancerLaScene` + `lancerLeCombat`) : les trois
 * familles d'entités offrent bien leurs gestes à l'actif, à une case, sans un pas de déplacement.
 */
function ouvrir() {
  banc.setState({ party: scenario.construire(idsDeTest).party });
  banc.getState().lancerLaScene(scenarioConstruit.scene);
  banc.getState().lancerLeCombat('enc-pastilles');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  // L'ordre du Round est tiré à l'Initiative : on se place au TOUR DU SOLDAT, celui que le joueur
  // exerce en recette (même patron que `42-belier-porte.hors-store.test`, dont la poussée exige l'actif chef).
  const b = banc.getState().battle!;
  const soldat = b.combatants.find((c) => c.kind === 'heros' && !!c.mannedPoste)!;
  banc.setState({ battle: { ...b, turn: b.order.indexOf(soldat.id), acted: false, action: null, movementUsed: 0 } });
  return banc.getState();
}

/** L'ACTION d'une offre du registre. */
const actionDe = (o: Offre) => o.actionId;

/** Les PASTILLES D'ENTITÉ de l'instant : les offres de l'actif à la surface du champ, par entité qui les porte. */
const entityGestes = (st: Jeu) => {
  const battle = st.battle!;
  return offresParPorteur(offresDeLActif({ scene: st.scene, active: activeCombatant(battle)!, battle, netMode: st.net.mode, gameTime: st.gameTime, state: st }), 'pastille-entite');
};

describe('Scénario « Pastilles d’entité » — le banc de recette de la zone 4', () => {

  it('le Soldat ACTIF est chef du bélier, et les trois porteurs sont à UNE case (aucun pas requis)', () => {
    const st = ouvrir();
    const b = st.battle!;
    const soldat = b.combatants.find((c) => c.kind === 'heros')!;
    expect(soldat.mannedPoste, 'le Soldat sert le bélier (chef de pièce)').toBeTruthy();
    expect(b.order, 'et il entre bien dans l’ordre du Round').toContain(soldat.id);
    const cheval = b.combatants.find((c) => c.mountable)!;
    const coffre = st.scene!.entities.find((e) => e.id === 'coffre-de-cour')!;
    expect(chebyshev(soldat.pos!, cheval.pos!), 'monture adjacente').toBeLessThanOrEqual(1);
    expect(chebyshev(soldat.pos!, coffre.pos), 'coffre adjacent').toBeLessThanOrEqual(1);
  });

  it('les gestes ANNONCÉS par le scénario sont ceux que le registre offre RÉELLEMENT sur ce banc', () => {
    const st = ouvrir();
    const offres = entityGestes(st);
    const parAction = new Map(offres.flatMap((p) => p.offres.map((o) => [actionDe(o), p.porteurId] as const)));
    // Monter (la monture), Ramasser (le coffre), Pousser (l'engin servi) — chacun porté par SON entité.
    expect([...parAction.keys()].sort(), 'les gestes du banc').toEqual(['mise-en-selle', 'poussee', 'ramassage']);
    const cheval = st.battle!.combatants.find((c) => c.mountable)!;
    expect(parAction.get('mise-en-selle'), 'Monter naît de la MONTURE').toBe(cheval.id);
    expect(parAction.get('ramassage'), 'Ramasser naît du COFFRE').toBe('coffre-de-cour');
    const engin = st.battle!.combatants.find((c) => c.postes?.length)!;
    expect(parAction.get('poussee'), 'Pousser naît de la PIÈCE servie').toBe(engin.id);
    // Le scénario DIT ce qu'il couvre : ses gestes sont nommés dans sa fiche (catalogue `docs/test-scenarios.md`).
    for (const id of parAction.keys()) expect(scenario.tests, `le scénario nomme ${id}`).toContain(id);
  });

  it('le COFFRE offre DEUX candidats sur la même entité — c’est le cas du panneau-paramètre borné', () => {
    const st = ouvrir();
    const coffre = entityGestes(st).find((p) => p.porteurId === 'coffre-de-cour')!;
    expect(coffre.offres.length, 'deux objets à ramasser, donc deux candidats').toBe(2);
    expect(new Set(coffre.offres.map((o) => o.candidat)).size, 'et ils se distinguent par leur nom').toBe(2);
  });

  it('« Pousser » est OFFERT (Équipe complète) — et son coût est dit sur la pastille', () => {
    const st = ouvrir();
    const pousser = entityGestes(st).flatMap((p) => p.offres).find((o) => actionDe(o) === 'poussee')!;
    expect(pousser.gate.ok, 'l’Équipe de 6 est au complet : le geste est ouvert').toBe(true);
    expect(pousser.cost, 'la poussée prend le Mouvement').toBeTruthy();
  });
});

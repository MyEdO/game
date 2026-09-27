import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from './43-pastilles-entite';
import { entityGestes } from '../../state/registreOffres';
import type { OffreRendue } from '../../state/offreRendue';
import { chebyshev } from '../../engine/grid';
const scenarioConstruit = scenario.construire();

/**
 * PASTILLES D'ENTITÉ — le scénario COUVRE-T-IL vraiment les gestes qu'il annonce ? (#1411 P2-C, R3)
 *
 * Aucun scénario ne combinait jusqu'ici un combat, un décor à ramasser à ≥ 2 objets et une pièce
 * servie : la recette navigateur des pastilles n'avait donc pas de banc. Cette sonde mesure le banc
 * lui-même, sur l'état RÉEL que produit le scénario (`startScene` + `startCombat`) : les trois
 * familles d'entités offrent bien leurs gestes à l'actif, à une case, sans un pas de déplacement.
 */
function ouvrir() {
  useGame.setState({ party: scenario.construire().party });
  useGame.getState().startScene(scenarioConstruit.scene);
  useGame.getState().startCombat('enc-pastilles');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  // L'ordre du Round est tiré à l'Initiative : on se place au TOUR DU SOLDAT, celui que le joueur
  // exerce en recette (même patron que `42-belier-porte.test`, dont la poussée exige l'actif chef).
  const b = useGame.getState().battle!;
  const soldat = b.combatants.find((c) => c.kind === 'hero' && !!c.mannedPoste)!;
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(soldat.id), acted: false, action: null, movementUsed: 0 } });
  return useGame.getState();
}

/** L'ACTION d'une offre rendue : la clé stable d'une pastille est `action|arguments du candidat`
 *  (`rendreOffre`) — deux candidats d'un même coffre y diffèrent par leur queue. */
const actionDe = (o: OffreRendue) => o.id.split('|')[0];

describe('Scénario « Pastilles d’entité » — le banc de recette de la zone 4', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('le Soldat ACTIF est chef du bélier, et les trois porteurs sont à UNE case (aucun pas requis)', () => {
    const st = ouvrir();
    const b = st.battle!;
    const soldat = b.combatants.find((c) => c.kind === 'hero')!;
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
    expect([...parAction.keys()].sort(), 'les gestes du banc').toEqual(['mount', 'pickup', 'push-engine']);
    const cheval = st.battle!.combatants.find((c) => c.mountable)!;
    expect(parAction.get('mount'), 'Monter naît de la MONTURE').toBe(cheval.id);
    expect(parAction.get('pickup'), 'Ramasser naît du COFFRE').toBe('coffre-de-cour');
    const engin = st.battle!.combatants.find((c) => c.postes?.length)!;
    expect(parAction.get('push-engine'), 'Pousser naît de la PIÈCE servie').toBe(engin.id);
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
    const pousser = entityGestes(st).flatMap((p) => p.offres).find((o) => actionDe(o) === 'push-engine')!;
    expect(pousser.gate.ok, 'l’Équipe de 6 est au complet : le geste est ouvert').toBe(true);
    expect(pousser.cost, 'la poussée prend le Mouvement').toBeTruthy();
  });
});

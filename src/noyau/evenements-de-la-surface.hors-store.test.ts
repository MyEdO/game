/**
 * LES ÉVÉNEMENTS DU NOYAU LUS PAR LA SEULE SURFACE (#4830) : un hôte anime un coup par `ChargeDAttaque`, lit l'issue d'un
 * Test de scène et sa Compétence par `TestResolu`, et la Compétence d'un Test d'incantation dans sa ligne de jet
 * (`JetEnVue`), le sort en contexte. L'hôte n'importe que `./index`.
 */
import { describe, it, expect } from 'vitest';
import {
  creerPartie, etatInitialDuJeu, jetsEnVue, type ChargeDAttaque, type EntreesDeLaPartie, type Evenement, type ResultatDeLAppel, type TestResolu,
} from './index';
import { auContact, heroDuDuel } from './combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import { herosDeScenario, tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { emptyScene } from './monde/scene';
import { EMPTY_FLOW } from '../engine/flowCore';

const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

/** Les Tests de scène qu'un appel a résolus. */
const testsResolus = (r: ResultatDeLAppel): TestResolu[] =>
  r.evenements.flatMap((e: Evenement) => (e.type === 'emis' && e.evt === 'test_resolved' ? [e.payload] : []));

describe('événements du noyau — lus par la seule surface', () => {
  it('un Test de Calme de scène : son issue et sa Compétence', () => {
    const scene = { ...emptyScene('epreuve', 4, 4), id: 'epreuve' };
    scene.entities.push({
      id: 'autel', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Autel',
      usable: { actions: [{ id: 'contempler', label: 'Contempler', flow: { kind: 'test', test: { skill: { id: 'calme' }, difficulty: 'intermediaire' }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW } }] },
    } as never);
    const heros = tousLesHerosDeScenario(idsDeTest).slice(0, 1).map((h) => ({ ...h, pos: { x: 0, y: 0 } }));
    const partie = creerPartie({ ...etatInitialDuJeu(), party: heros, scene }, ENTREES);
    try {
      partie.envoyer({ type: 'jouerAction', args: ['autel', 'contempler'] });
      partie.envoyer({ type: 'jetLancer', args: ['test'] });
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['test', 12] });
      const resolus = testsResolus(partie.envoyer({ type: 'jetValider', args: ['test'] }));
      expect(resolus).toEqual([expect.objectContaining({ actorId: heros[0].id, roll: 12, reference: { genre: 'competence', id: 'calme' } })]);
      expect(JSON.parse(JSON.stringify(resolus)), 'le Test résolu traverse le JSON sans perte').toStrictEqual(resolus);
    } finally {
      partie.fermer();
    }
  });

  it('un Test d’incantation : sa ligne nomme Langue (Magick), le sort en contexte', () => {
    const sorcier = { ...herosDeScenario(idsDeTest, 'sorcier'), pos: { x: 1, y: 1 } };
    const scene = { ...emptyScene('cabinet', 4, 4), id: 'cabinet' };
    const partie = creerPartie({ ...etatInitialDuJeu(), party: [sorcier], scene }, ENTREES);
    try {
      partie.envoyer({ type: 'incanterLeSort', args: [sorcier.id, 'arme-aethyrique', sorcier.id] });
      partie.envoyer({ type: 'jetLancer', args: ['incantation'] });
      const [jet] = jetsEnVue(partie.etat());
      expect(jet.flux).toBe('incantation');
      expect(jet.lignes[0]).toMatchObject({
        qui: sorcier.id, etat: 'revele', reference: { genre: 'competence', id: 'langue', spec: 'magick' }, sort: { genre: 'sort', id: 'arme-aethyrique' },
      });
    } finally {
      partie.fermer();
    }
  });

  it('une attaque au corps à corps : le coup s’anime par sa charge', () => {
    const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
    ouverture.lancer({ party: [heroDuDuel()], scene: testScene(), projet: null, combatDirect: 'enc-mutants' });
    ouverture.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
    const garde = ouverture.etat();
    ouverture.fermer();
    const { H, E, patch } = auContact(garde);
    const partie = creerPartie({ ...garde, ...patch }, ENTREES);
    try {
      partie.envoyer({ type: 'cliquerLaCase', args: [{ ...E.pos! }, E.id, { confirm: true }] });
      partie.envoyer({ type: 'jetLancer', args: ['attaque'] });
      partie.envoyer({ type: 'jetImposerLeResultat', args: ['attaque', 11] });
      const appel = partie.envoyer({ type: 'jetValider', args: ['attaque'] });
      const coups = appel.evenements.flatMap((e): ChargeDAttaque[] => (e.type === 'emis' && e.evt === 'anim_attack' ? [e.payload] : []));
      expect(coups).toMatchObject([{ kind: 'melee', from: H.id, to: E.id }]);
    } finally {
      partie.fermer();
    }
  });
});

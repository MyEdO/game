/**
 * Le CARNET D'INDICES dans le noyau (#670, #2415) : `revealClue`/`discreditClue` par `applyEffects`, survie à la
 * transition de scène, remise à zéro en nouvelle partie, nouveauté vue par siège, et la save du noyau. Le départ en
 * intention chez l'invité : `src/hote/coop/salon.hors-store.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { estNouveauPour } from './clues';
import { affichés, narratif, hero, fixtureScene } from './clues.fixture';
import { applyEffects } from '../combatEffects';
import { withActingSeat } from '../netOwnership';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { t } from '../../i18n';
import { chargerSurLeBanc, sansLaCleDeJeu, sauverLeBanc } from '../persistance/save.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('clues — câblage noyau (#670)', () => {
  it('applyEffects « revealClue » pose state.clues et journalise une ligne', () => {
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-a')], entryId: 'scene-a', narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    expect(banc.getState().clues['ind-lettre'].stadeCourant).toBe('s1');
    expect(banc.getState().journal.some((l) => l.includes('nouvel indice au carnet'))).toBe(true);
  });

  it('applyEffects « discreditClue » passe l’indice réfuté et journalise', () => {
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-b')], entryId: 'scene-b', narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'discreditClue', indiceId: 'ind-lettre' }]);
    expect(banc.getState().clues['ind-lettre'].statut).toBe('réfuté');
    expect(banc.getState().journal.some((l) => l.includes('fausse piste écartée'))).toBe(true);
  });

  it('state.clues SURVIT à une transition de scène (campagne-scopé, pas de reset scène)', () => {
    banc.setState({ party: [hero()] });
    const sceneA = fixtureScene('scene-a2');
    const sceneB = fixtureScene('scene-b2');
    banc.getState().chargerLeProjet({ scenes: [sceneA, sceneB], entryId: 'scene-a2', narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    expect(banc.getState().clues['ind-lettre']).toBeDefined();
    banc.getState().quitterLaScene('scene-b2');
    expect(banc.getState().scene?.id).toBe('scene-b2');
    expect(banc.getState().clues['ind-lettre'].stadeCourant).toBe('s1'); // assertion POSITIVE, survit
  });

  it('nouvelle partie (lancerLaScene) REMET le carnet à vide', () => {
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-c')], entryId: 'scene-c', narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    expect(Object.keys(banc.getState().clues)).toHaveLength(1);
    banc.getState().lancerLaScene(fixtureScene('scene-d'));
    expect(banc.getState().clues).toEqual({});
  });

  it('`marquerLesIndices` marque le siège LOCAL hors intent (#2415)', () => {
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-n')], entryId: 'scene-n', narratif: narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    expect(estNouveauPour(banc.getState().clues['ind-lettre'], 0)).toBe(true);
    banc.getState().marquerLesIndices(affichés(banc.getState().clues, ['ind-lettre']));
    expect(banc.getState().clues['ind-lettre'].vuParSiège).toEqual({ 0: true });
  });

  it('`marquerLesIndices` appliqué AU NOM du siège 1 ne marque que lui : le siège 0 voit encore la nouveauté (#2415)', () => {
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-p')], entryId: 'scene-p', narratif: narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    withActingSeat(1, () => banc.getState().marquerLesIndices(affichés(banc.getState().clues, ['ind-lettre'])));
    const c = banc.getState().clues['ind-lettre'];
    expect(c.vuParSiège).toEqual({ 1: true });
    expect(estNouveauPour(c, 0), 'le marquage d’un invité a levé la nouveauté de l’hôte').toBe(true);
  });

  it('COURSE : l’intent du siège 1 arrive APRÈS que l’hôte a avancé l’indice — s2 reste nouveau pour lui (#2415)', () => {
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-q')], entryId: 'scene-q', narratif: narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    const affiché = affichés(banc.getState().clues, ['ind-lettre']); // le Carnet du siège 1 affiche s1 et émet son intent
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre', stade: 's2' }]);
    withActingSeat(1, () => banc.getState().marquerLesIndices(affiché));
    const c = banc.getState().clues['ind-lettre'];
    expect(c.stadeCourant).toBe('s2');
    expect(estNouveauPour(c, 1), 's2 est marqué vu pour un siège qui n’a affiché que s1').toBe(true);
  });

  it('epinglerLIndice épingle/désépingle par l’action du noyau', () => {
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-e')], entryId: 'scene-e', narratif, projet: null });
    applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    banc.getState().epinglerLIndice('ind-lettre');
    expect(banc.getState().clues['ind-lettre'].épinglé).toBe(true);
    banc.getState().epinglerLIndice('ind-mono');
    expect(banc.getState().clues['ind-mono']).toBeUndefined();
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('carnet.refus.indiceInconnu', { id: 'ind-mono' }));
  });

  describe('save/load RÉEL (chargerLaSave, #670)', () => {
    it('un indice révélé+épinglé et un autre réfuté survivent à une vraie sauvegarde → chargement', () => {
      banc.setState({ party: [hero()] });
      banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-f')], entryId: 'scene-f', narratif, projet: null });
      applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
      banc.getState().epinglerLIndice('ind-lettre');
      applyEffects(banc.getState, banc.setState, [{ type: 'discreditClue', indiceId: 'ind-mono' }]);
      const before = banc.getState().clues;
      expect(before['ind-lettre'].épinglé).toBe(true);
      expect(before['ind-mono'].statut).toBe('réfuté');
      const texte = sauverLeBanc(banc);
      banc.setState({ clues: {} }); // « nouvelle partie » — état écrasé avant le chargement
      expect(banc.getState().clues).toEqual({});
      chargerSurLeBanc(banc, texte);
      expect(banc.getState().clues).toEqual(before);
    });

    it('tolérance PAR CONSTRUCTION : clé « clues » absente du snapshot → valeur initiale ({}) au chargement', () => {
      banc.setState({ party: [hero()] });
      banc.getState().chargerLeProjet({ scenes: [fixtureScene('scene-g')], entryId: 'scene-g', narratif, projet: null });
      applyEffects(banc.getState, banc.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
      // La save est écrite à la version COURANTE, clé `clues` RETIRÉE : c'est le filet n°1 de la
      // politique de version (champ manquant → `initialFields`), pas une save d'une autre version.
      chargerSurLeBanc(banc, sansLaCleDeJeu(sauverLeBanc(banc), 'clues'));
      expect(banc.getState().clues).toEqual({});
    });
  });
});

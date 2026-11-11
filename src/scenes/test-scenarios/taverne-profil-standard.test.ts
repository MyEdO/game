import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { scenario } from './taverne-profil-standard';
import { findSpeciesById } from '../../data';
import { findTavernGameById } from '../../engine/tavernGame';
import { sceneNpc } from '../../noyau/monde/sceneNpc';
import { tavernGameValue, tavernNpcOffers } from '../../noyau/tavernFlow';
import { validateScene } from '../../noyau/validateScene';
import { presetDuNarratif } from '../../noyau/monde/resolveursDuNarratif';
const scenarioConstruit = scenario.construire(idsDeTest);
/** Aucun narratif chargé : aucun preset ne se résout. */
const presetPnjById = presetDuNarratif(null);

const PNJ = 'habitue-bras-de-fer';
const ent = scenarioConstruit.scene.entities.find((e) => e.id === PNJ)!;

describe('scénario « Taverne — un PNJ à profil standard » (#1882)', () => {
  it('le PNJ NOMME le profil standard de son espèce (LDB 77 l.7)', () => {
    const espece = findSpeciesById(ent.appearance?.species);
    expect(espece?.profilStandard?.id).toBeDefined();
    expect(ent.creature?.id).toBe(espece!.profilStandard!.id);
  });

  it('il PROPOSE une partie : la table le liste sous son nom', () => {
    expect(tavernNpcOffers(scenarioConstruit.scene, presetPnjById)).toEqual([{ id: PNJ, label: ent.label, gameId: ent.tavernGame!.id }]);
  });

  it('il joue SA fiche : le bras de fer se joue à la Force du profil standard Humain, F 30 (LDB 77 l.13)', () => {
    const jeu = findTavernGameById(ent.tavernGame!.id)!;
    expect(jeu.characteristic).toBe('force');
    expect(ent.creature?.id).toBe('humain');
    expect(tavernGameValue(sceneNpc(scenarioConstruit.scene, PNJ, presetPnjById)!, jeu)).toBe(30);
  });

  it('la scène passe la porte de validation sans erreur', () => {
    expect(validateScene([scenarioConstruit.scene]).filter((w) => w.level === 'error')).toEqual([]);
  });

  it('la règle optionnelle des jeux de taverne est pré-activée', () => {
    expect(scenario.rules).toMatchObject({ 'jeux-de-taverne': true });
  });
});

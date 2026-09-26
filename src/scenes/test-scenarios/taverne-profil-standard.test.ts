import { describe, it, expect } from 'vitest';
import { scenario } from './taverne-profil-standard';
import { findSpeciesById } from '../../data';
import { findTavernGameById } from '../../engine/tavernGame';
import { sceneNpc } from '../../state/sceneNpc';
import { tavernGameValue, tavernNpcOffers } from '../../state/tavernFlow';
import { validateScene } from '../../state/validateScene';

const PNJ = 'habitue-bras-de-fer';
const ent = scenario.scene.entities.find((e) => e.id === PNJ)!;

describe('scénario « Taverne — un PNJ à profil standard » (#1882)', () => {
  it('le PNJ NOMME le profil standard de son espèce (LDB 77 l.7)', () => {
    const espece = findSpeciesById(ent.appearance?.species);
    expect(espece?.profilStandard?.id).toBeDefined();
    expect(ent.ref).toBe(espece!.profilStandard!.id);
  });

  it('il PROPOSE une partie : la table le liste sous son nom', () => {
    expect(tavernNpcOffers(scenario.scene)).toEqual([{ id: PNJ, label: ent.label, gameId: ent.tavernGame!.gameId }]);
  });

  it('il joue SA fiche : le bras de fer se joue à la Force du profil standard Humain, F 30 (LDB 77 l.13)', () => {
    const jeu = findTavernGameById(ent.tavernGame!.gameId)!;
    expect(jeu.characteristic).toBe('force');
    expect(ent.ref).toBe('humain');
    expect(tavernGameValue(sceneNpc(scenario.scene, PNJ)!, jeu)).toBe(30);
  });

  it('la scène passe la porte de validation sans erreur', () => {
    expect(validateScene([scenario.scene]).filter((w) => w.level === 'error')).toEqual([]);
  });

  it('la règle optionnelle des jeux de taverne est pré-activée', () => {
    expect(scenario.rules).toMatchObject({ 'tavern-games': true });
  });
});

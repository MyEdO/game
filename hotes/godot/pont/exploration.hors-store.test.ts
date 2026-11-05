/**
 * L'EXPLORATION PAR LE PONT (#3328) : « La porte close » jouée comme Godot la joue. L'entrée de la scène poursuivie par
 * son geste en focus, le groupe projeté à sa case, les gestes d'exploration en boutons qui portent leur suite de verbes, le clic d'une case qui fait marcher
 * le groupe, la porte dessinée sur le plateau, fermée puis ouverte.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table } from './pont.testkit';
import { CLICS_DE_L_EXPLORATION, type AreteDuPlateau } from '../../../src/noyau/index';
import type { Bouton } from '../../../src/hote/elements';

const { appel } = table();

describe('l’exploration par le pont', () => {
  it('le groupe à sa case, la porte ouverte par son bouton, le réduit gagné par un clic', () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'porte-close', graine: 7 }));
    expect(suite.vue.projection.fenetre?.etape?.genre, 'l’entrée de la scène tient la main').toBe('sceneEntry');
    expect(suite.vue.champ, 'une fenêtre tient la main : le champ ne se clique pas').toBeNull();
    expect(suite.vue.zones['exploration.gestes'], 'ni les gestes d’exploration').toEqual([]);
    while (suite.vue.projection.fenetre) {
      const continuer = suite.vue.zones['fenetre.gestes'].find((g) => g.type === 'bouton' && g.focus);
      expect(continuer, 'la fenêtre se poursuit par son geste en focus').toBeDefined();
      ({ suite } = drainer(appel, appel('jouer', (continuer as Bouton).jeu)));
    }
    const exploration = suite.vue.projection.exploration!;
    expect(exploration, 'hors combat, la vue est celle de l’exploration').not.toBeNull();
    expect(suite.vue.champ, 'rien ne tient la main : un clic de case fait marcher le groupe').toEqual(CLICS_DE_L_EXPLORATION);
    expect(exploration.heros.map((h) => h.pos), 'chaque héros se tient à la case du groupe').toEqual(exploration.heros.map(() => exploration.groupe));
    expect(Object.keys(suite.vue.equipements).sort(), 'chaque héros a de quoi se dessiner').toEqual(exploration.heros.map((h) => h.id).sort());

    const boutons = suite.vue.zones['exploration.gestes'];
    expect(boutons.map((b) => b.libelle), 'chaque geste d’exploration est un bouton qui le nomme').toEqual(exploration.gestes.liste.map((g) => g.libelle));
    const porte = boutons.find((b) => 'suite' in b.jeu && b.jeu.suite.some((a) => a.type === 'actionnerLaPorte'));
    expect(porte, 'la porte fermée s’ouvre par un bouton').toBeDefined();
    const porteDuPlateau = (aretes: AreteDuPlateau[]) => aretes.find((a) => a.porte);
    expect(porteDuPlateau(suite.vue.plateau!.aretes), 'le plateau dessine la porte, fermée, entre ses deux murs')
      .toEqual({ x: 2, y: 1, side: 'E', porte: true, ouverte: false });
    expect(suite.vue.plateau!.aretes.filter((a) => !a.porte).map((a) => [a.y, a.ouverte]), 'les murs pleins').toEqual([[0, false], [2, false]]);
    ({ suite } = drainer(appel, appel('jouer', porte!.jeu)));
    expect(porteDuPlateau(suite.vue.plateau!.aretes)?.ouverte, 'la porte ouverte, le plateau la dessine ouverte').toBe(true);

    const reduit = { x: 4, y: 1 };
    ({ suite } = drainer(appel, appel('jouer', { type: CLICS_DE_L_EXPLORATION.case, args: [reduit] })));
    expect(suite.vue.projection.exploration!.groupe, 'la porte ouverte, le clic d’une case du réduit y mène le groupe').toEqual([reduit.x, reduit.y]);
  });
});

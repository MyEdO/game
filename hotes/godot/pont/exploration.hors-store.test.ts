/**
 * L'EXPLORATION PAR LE PONT (#3328) : « La porte close » jouée comme Godot la joue. L'entrée de la scène poursuivie par
 * son geste en focus, le groupe projeté à sa case, les gestes d'exploration en boutons qui portent leur suite de verbes, le clic d'une case qui fait marcher
 * le groupe et rend le chemin de son meneur (#3822), la porte dessinée sur le plateau, fermée puis ouverte, servie par `aretes` quand leur
 * empreinte change (`plateau.cleDesAretes`, #3947), le volume du monde de la scène (`monde`).
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, enFocus, vueDe } from './pont.testkit';
import { CLIC_DU_CHAMP, type AreteDessinee, type VolumeDuMonde } from '../../../src/noyau/index';
import type { Bouton } from '../../../src/hote/elements';

const { appel } = table();

describe('l’exploration par le pont', () => {
  it('le groupe à sa case, la porte ouverte par son bouton, le réduit gagné par un clic', () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'porte-close', graine: 7 }));
    expect(suite.vue.projection.fenetre?.etape?.genre, 'l’entrée de la scène tient la main').toBe('entreeEnScene');
    expect(suite.vue.zones['fenetre.corps'].map((e) => e.id), 'elle dit le message d’entrée de la scène').toEqual(['revelation/0']);
    expect(suite.vue.champ, 'une fenêtre tient la main : le champ ne se clique pas').toBeNull();
    expect(suite.vue.zones['exploration.gestes'], 'ni les gestes d’exploration').toEqual([]);
    while (suite.vue.projection.fenetre) {
      const continuer = enFocus(suite.vue);
      expect(continuer, 'la fenêtre se poursuit par son geste en focus').toBeDefined();
      ({ suite } = drainer(appel, appel('jouer', (continuer as Bouton).jeu)));
    }
    const exploration = suite.vue.projection.exploration!;
    expect(exploration, 'hors combat, la vue est celle de l’exploration').not.toBeNull();
    expect(suite.vue.champ, 'rien ne tient la main : un clic de case fait marcher le groupe').toBe(CLIC_DU_CHAMP);
    expect(exploration.heros.map((h) => h.pos), 'chaque héros se tient à la case du groupe').toEqual(exploration.heros.map(() => [...exploration.groupe, exploration.etage ?? 0]));
    expect(Object.keys(suite.vue.corps.combattants).sort(), 'chaque héros a son corps dans la vue').toEqual(exploration.heros.map((h) => h.id).sort());

    const plateau = suite.vue.plateau!;
    const { monde } = appel('monde') as unknown as { monde: VolumeDuMonde };
    expect(monde.metresParCase, 'le monde à l’échelle du plateau').toBe(plateau.metresParCase);
    expect(monde.positions.length, 'le sol de la scène, en triangles').toBeGreaterThanOrEqual(plateau.w * plateau.h * 2 * 9);
    expect(monde.cases.length, 'la case de chaque triangle').toBe(monde.positions.length / 9);
    expect(monde.hauteurs.map((c) => c.rangees.flat().length), 'la hauteur de chaque case de chaque couche').toEqual(monde.hauteurs.map(() => plateau.w * plateau.h));

    const boutons = suite.vue.zones['exploration.gestes'];
    expect(boutons.map((b) => b.libelle), 'chaque geste d’exploration est un bouton qui le nomme').toEqual(exploration.gestes.liste.map((g) => g.libelle));
    const porte = boutons.find((b) => 'suite' in b.jeu && b.jeu.suite.some((a) => a.type === 'actionnerLaPorte'));
    expect(porte, 'la porte fermée s’ouvre par un bouton').toBeDefined();
    const aretes = () => (appel('aretes') as unknown as { aretes: AreteDessinee[] }).aretes;
    const auMilieu = (servies: AreteDessinee[]) => servies.find((a) => a.milieu.x === 2.5 && a.milieu.y === 1);
    const fermees = aretes();
    expect(auMilieu(fermees), 'le plateau dessine la porte, fermée, sur l’arête est de (2, 1)')
      .toEqual({ cle: '2,1,E,0', case: { x: 2, y: 1 }, milieu: { x: 2.5, y: 1 }, sens: { x: 0, y: 1 }, pied: 0, piece: 'porte-fermee', famille: 'colombage', hauteurM: 4 });
    expect(fermees.filter((a) => a !== auMilieu(fermees)).map((a) => [a.milieu, a.piece]), 'ses deux murs pleins').toEqual([[{ x: 2.5, y: 0 }, 'mur'], [{ x: 2.5, y: 2 }, 'mur']]);
    const empreinte = suite.vue.plateau!.cleDesAretes;
    expect(vueDe(appel('vue')).plateau!.cleDesAretes, 'rien n’a changé : la même empreinte, le jeu ne rappelle pas `aretes`').toBe(empreinte);
    ({ suite } = drainer(appel, appel('jouer', porte!.jeu)));
    expect(suite.vue.plateau!.cleDesAretes, 'la porte ouverte : l’empreinte change, le jeu rappelle `aretes`').not.toBe(empreinte);
    expect(auMilieu(aretes())?.piece, 'la porte ouverte, le plateau la dessine ouverte').toBe('porte-ouverte');

    const reduit = { x: 4, y: 0 };
    const meneur = suite.vue.projection.exploration!.heros[0].id;
    const clic = drainer(appel, appel('jouer', { type: CLIC_DU_CHAMP, args: [reduit] }));
    expect(clic.suite.vue.projection.exploration!.groupe, 'la porte ouverte, le clic d’une case du réduit y mène le groupe').toEqual([reduit.x, reduit.y]);
    expect(clic.effets.find((e) => e.quoi === 'deplacement'), 'le meneur, le seul héros dessiné, parcourt le chemin par la porte, chaque pas à sa longueur (#3822)').toEqual({
      quoi: 'deplacement', qui: meneur,
      cases: [{ x: 1, y: 1, z: 0, metres: 0 }, { x: 2, y: 1, z: 0, metres: 2 }, { x: 3, y: 1, z: 0, metres: 2 }, { x: 4, y: 0, z: 0, metres: 2 * Math.SQRT2 }],
    });
  });
});

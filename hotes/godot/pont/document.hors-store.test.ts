/**
 * LE DOCUMENT PAR LE PONT (#3328) : « Documents de L'Ennemi dans l'Ombre » joué comme Godot le joue. Le groupe mené
 * à la liasse, sa conversation ouverte, un document lu : la fenêtre porte son titre et son texte, puis « Refermer »
 * rend la conversation à la liasse.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, enFocus } from './pont.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton } from '../../../src/hote/elements';

const { appel } = table();

describe('le document par le pont', () => {
  it('lire un document de la liasse, puis le refermer', () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'documents-edo', graine: 7 }));
    while (suite.vue.projection.fenetre) ({ suite } = drainer(appel, appel('jouer', enFocus(suite.vue)!.jeu)));
    ({ suite } = drainer(appel, appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 2, y: 2 }] })));
    const parcourir = suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Liasse de documents : Parcourir la liasse');
    expect(parcourir, 'à portée, la liasse s’offre').toBeDefined();
    ({ suite } = drainer(appel, appel('jouer', parcourir!.jeu)));
    const reponse = (debut: string) => suite.vue.zones['dialogue.reponses'].find((b) => b.libelle.startsWith(debut))!;
    ({ suite } = drainer(appel, appel('jouer', reponse('Chapitre 1').jeu)));
    ({ suite } = drainer(appel, appel('jouer', reponse('Lire').jeu)));

    const z = suite.vue.zones;
    expect(z['fenetre.titre'].map((l) => l.texte), 'la fenêtre porte le titre du document').toEqual(['On recherche ! Aventuriers courageux !']);
    expect(z['fenetre.corps'].map((l) => l.id), 'son corps est le texte du document').toEqual(['lecture']);
    expect(z['fenetre.corps'][0]).toMatchObject({ texte: expect.stringContaining('souhaite s\'attacher les services d\'un groupe d\'aventuriers chevronnés') });
    expect(z['dialogue.reponses'], 'sous le document, la conversation ne se dessine pas').toEqual([]);

    const refermer = z['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.libelle === 'Refermer');
    expect(refermer, 'le document se referme').toBeDefined();
    ({ suite } = drainer(appel, appel('jouer', refermer!.jeu)));
    expect(suite.vue.zones['fenetre.corps'], 'le document refermé ne se dessine plus').toEqual([]);
    expect(suite.vue.zones['dialogue.replique'].map((l) => l.texte), 'la conversation revient à la liasse').toEqual(['La liasse est rangée par chapitre.']);
  });
});

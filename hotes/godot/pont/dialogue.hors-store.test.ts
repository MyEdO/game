/**
 * LA CONVERSATION PAR LE PONT (#3328) : « Dialogue multi-interlocuteurs » joué comme Godot le joue. Le groupe mené à
 * côté de Gustav par un clic de case, l'offre « Parler » de Gustav en geste d'exploration, la conversation dessinée en
 * zones (son interlocuteur, sa réplique, chaque réponse en bouton qui la choisit), l'interlocuteur qui change de nœud
 * en nœud, puis la dernière réponse qui la clôt et rend les gestes d'exploration.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, enFocus } from './pont.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';

const { appel } = table();

describe('la conversation par le pont', () => {
  it('parler à Gustav, répondre de nœud en nœud, la conversation close', () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'dialogue-multi', graine: 7 }));
    while (suite.vue.projection.fenetre) ({ suite } = drainer(appel, appel('jouer', enFocus(suite.vue)!.jeu)));
    expect(suite.vue.zones['exploration.gestes'].map((b) => b.libelle), 'Gustav hors de portée : rien à lui dire').not.toContain('Gustav : Parler');
    ({ suite } = drainer(appel, appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 5, y: 4 }] })));
    const parler = suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Gustav : Parler');
    expect(parler, 'à portée, l’offre de Gustav est un geste d’exploration').toBeDefined();
    expect(suite.vue.zones['dialogue.reponses'], 'aucune conversation avant de parler').toEqual([]);

    ({ suite } = drainer(appel, appel('jouer', parler!.jeu)));
    const orateurs: string[] = [];
    for (let pas = 0; suite.vue.zones['dialogue.reponses'].length; pas++) {
      expect(pas, 'la conversation se clôt').toBeLessThan(10);
      const z = suite.vue.zones;
      orateurs.push(z['dialogue.orateur'][0]?.texte);
      expect(z['dialogue.replique'][0]?.texte, 'chaque nœud dit sa réplique').toBeTruthy();
      expect(z['exploration.gestes'], 'pendant la conversation, aucun geste d’exploration').toEqual([]);
      const reponse = z['dialogue.reponses'].find((b) => !b.refus)!;
      ({ suite } = drainer(appel, appel('jouer', reponse.jeu)));
    }
    expect(orateurs, 'l’interlocuteur suit le nœud').toEqual(['Gustav', 'Isolde', 'Phillipe', 'Gustav']);
    expect([suite.vue.zones['dialogue.orateur'], suite.vue.zones['dialogue.replique']], 'la conversation close ne se dessine plus').toEqual([[], []]);
    expect(suite.vue.zones['exploration.gestes'].map((b) => b.libelle), 'les gestes d’exploration reviennent').toContain('Gustav : Parler');
  });
});

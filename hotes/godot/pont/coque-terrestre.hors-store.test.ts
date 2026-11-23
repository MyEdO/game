/**
 * UNE COQUE TERRESTRE PAR LE PONT (#4471 ; `CONTRAT.md`, section « Corps d'un combattant », `coques`) : la diligence du
 * scénario `coque-terrestre`, que la scène porte, se sert parmi les coques posées au monde, au centre de son empreinte,
 * sans stations ni flottaison, en exploration comme au combat, jamais parmi les véhicules des combattants ; l'exploration
 * ne la nomme pas.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { drainer, enFocus, modelesCommites, servirLesModeles, table, vueDe } from './pont.testkit';
import type { Suite } from './pont';
import type { Bouton } from '../../../src/hote/elements';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';

const COMMITES = await modelesCommites();

describe('une coque terrestre se montre par le monde (#4471)', () => {
  const partie = table();
  const jouer = (jeu: unknown) => drainer(partie.appel, partie.appel('jouer', jeu as never)).suite;
  let suite: Suite;
  beforeAll(() => {
    suite = drainer(partie.appel, partie.appel('demarrer', { scenario: 'coque-terrestre', graine: 7 })).suite;
    servirLesModeles(partie.appel, COMMITES);
  });

  it('en exploration, la diligence est une coque servie au centre de son empreinte, sans ponts, que l’exploration ne nomme pas', () => {
    while (suite.vue.projection.fenetre) suite = jouer((enFocus(suite.vue) as Bouton).jeu);
    const { corps, projection } = vueDe(partie.appel('vue'));
    expect(corps.coques.diligence).toEqual({ centre: { x: 6.5, y: 3.5 }, corps: expect.objectContaining({ element: 'vehicule--diligence', empreinte: 2, taille: 'reelle', cap: 'E' }) });
    expect(projection.exploration!.entites.liste.map((e) => e.id)).not.toContain('diligence');
  });

  it('au combat, elle reste servie par le monde, hors des véhicules des combattants', () => {
    suite = jouer({ type: CLIC_DU_CHAMP, args: [{ x: 3, y: 4 }] });
    const { corps, projection } = vueDe(partie.appel('vue'));
    expect(projection.combat!.voisins.liste.map((c) => c.id)).toContain('diligence');
    expect([Object.keys(corps.coques), Object.keys(corps.vehicules)]).toEqual([['diligence'], []]);
  });
});

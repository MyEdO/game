/**
 * L'INCANTATION PAR LE PONT (#3328) : « Magie en combat » joué comme Godot le joue. Le groupe franchit la ligne
 * d'engagement, la Haute Sorcière choisit son sort dans la liste de ses sorts (une offre par candidat), puis sa cible
 * au clic : la fenêtre d'incantation s'ouvre sur ce sort.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, type Reponse } from './pont.testkit';
import { CLICS_DE_L_EXPLORATION, CLICS_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton, Choix } from '../../../src/hote/elements';
import type { Suite } from './pont';

const { appel } = table();

/** Joue le geste que l'Entrée jouerait, ou la première valeur ouverte d'un choix de la fenêtre, tant qu'une fenêtre tient
 *  la main. */
function viderLesFenetres(suite: Suite): Suite {
  for (let pas = 0; suite.vue.projection.fenetre; pas++) {
    expect(pas, 'les fenêtres se vident').toBeLessThan(20);
    const g = suite.vue.zones['fenetre.gestes'];
    const b = g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.flatMap((x) => (x.type === 'choix' ? x.valeurs : [])).find((v) => !v.refus)!;
    ({ suite } = drainer(appel, appel('jouer', b.jeu)));
  }
  return suite;
}

const jouer = (r: Reponse): Suite => drainer(appel, r).suite;

describe('l’incantation par le pont', () => {
  it('choisir son sort parmi les siens, puis sa cible : la fenêtre d’incantation s’ouvre sur ce sort', () => {
    viderLesFenetres(jouer(appel('demarrer', { scenario: 'magie', graine: 7 })));
    let suite = viderLesFenetres(jouer(appel('jouer', { type: CLICS_DE_L_EXPLORATION.case, args: [{ x: 16, y: 11 }] })));
    expect(suite.vue.zones['combat.actif'][0]).toMatchObject({ nom: 'Aelindra, Haute Sorcière' });

    const offres = suite.vue.zones['combat.offres'];
    const sorts = offres.find((c): c is Choix => c.id === 'offre/cast-spell')!;
    expect(sorts, 'les sorts de l’actif sont un choix à eux').toMatchObject({ type: 'liste', libelle: 'Lancer ce sort' });
    expect(offres.find((c) => c.id === 'economie/action')!.valeurs.map((b) => b.id), 'l’offre par candidat quitte la rangée de sa part').not.toContain('cast-spell');
    const flechette = sorts.valeurs.find((b) => b.libelle === 'Fléchette')!;
    expect(flechette.jeu, 'chaque sort joue l’offre sur son contexte').toEqual({ offre: 'cast-spell', ctx: { spellId: 'flechette' } });
    const focaliser = offres.find((c): c is Choix => c.id === 'offre/focus-spell')!;
    expect(focaliser.valeurs.find((b) => b.libelle === 'Fléchette')?.refus, 'un sort qui ne se focalise pas est refusé avec sa raison').toBe('ce Sort ne se focalise pas');

    suite = jouer(appel('jouer', flechette.jeu));
    const armes = suite.vue.zones['combat.offres'].find((c) => c.id === 'offre/cast-spell')!.valeurs.filter((b) => b.presse).map((b) => b.libelle);
    expect(armes, 'le sort choisi est pressé, seul').toEqual(['Fléchette']);
    const [cible] = suite.vue.projection.combat!.cibles.liste;
    suite = jouer(appel('jouer', { type: CLICS_DU_CHAMP.combattant, args: [cible] }));
    expect(suite.vue.zones['fenetre.titre'].map((l) => l.texte), 'la fenêtre d’incantation s’ouvre').toEqual(['Incantation']);
    const corps = () => Object.fromEntries(suite.vue.zones['fenetre.corps'].map((e) => [e.id, e]));
    expect(corps().sort, 'le sort et sa cible').toMatchObject({ texte: 'Fléchette sur Loup' });
    expect(corps().jet, 'la ligne du lanceur, son NI au libellé, à jeter').toMatchObject({ qui: 'Aelindra, Haute Sorcière', libelle: 'Incantation / NI 0', resultat: null });
    expect(suite.vue.zones['fenetre.reglages'], 'avant le jet, aucun pas de Surincantation').toEqual([]);

    suite = jouer(appel('jouer', suite.vue.zones['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.focus)!.jeu));
    expect(corps().jet, 'le jet tombe').toMatchObject({ resultat: '15', verdict: 'réussite' });
    expect(corps().surincantation, 'le DR ouvre la Surincantation').toMatchObject({ valeur: '1 pas sur 1' });
    const reglages = suite.vue.zones['fenetre.reglages'];
    expect(reglages.map((r) => r.libelle), 'chaque axe que le sort ouvre est un choix de pas ; les cibles supplémentaires se désignent sur la carte').toEqual(['Surincantation : Portée', 'Surincantation : Cibles']);
    const portee = reglages[0] as Choix;
    expect(portee.valeurs.map((b) => [b.libelle, b.presse]), 'de 0 au budget, l’alloué pressé').toEqual([['0', true], ['1', false]]);

    suite = jouer(appel('jouer', portee.valeurs[1].jeu));
    expect(corps().surincantation, 'le pas alloué entame le budget').toMatchObject({ valeur: '0 pas sur 1' });
    expect((suite.vue.zones['fenetre.reglages'][1] as Choix).valeurs[1].refus, 'un pas de plus sur un autre axe est refusé avec sa raison').toBeTruthy();
    expect(corps().issue, 'l’issue du jet').toMatchObject({ type: 'ligne' });
    const appliquer = suite.vue.zones['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.focus)!;
    expect(appliquer.libelle, 'l’Entrée applique l’incantation').toBe('Appliquer');
    suite = jouer(appel('jouer', appliquer.jeu));
    expect(suite.vue.zones['fenetre.titre'].map((l) => l.texte), 'appliquée, la fenêtre d’incantation se referme').not.toContain('Incantation');
  });
});

/**
 * L'INCANTATION PAR LE PONT (#3328) : « Magie en combat » joué comme Godot le joue. Le groupe franchit la ligne
 * d'engagement, la Haute Sorcière choisit son sort dans la liste de ses sorts (une offre par candidat), puis sa cible
 * au clic : la fenêtre d'incantation s'ouvre sur ce sort.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { corpsDe, drainer, table, type Reponse, enFocus, gestesDessines } from './pont.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton, Choix } from '../../../src/hote/elements';
import { clicDuCombattant, type Pont, type Suite } from './pont';

/** Joue le geste que l'Entrée jouerait, ou la première valeur ouverte d'un choix de la fenêtre, tant qu'une fenêtre tient
 *  la main. */
function viderLesFenetres(appel: ReturnType<typeof table>['appel'], suite: Suite): Suite {
  for (let pas = 0; suite.vue.projection.fenetre; pas++) {
    expect(pas, 'les fenêtres se vident').toBeLessThan(20);
    const g = gestesDessines(suite.vue);
    const b = g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.flatMap((x) => (x.type === 'choix' ? x.valeurs : [])).find((v) => !v.refus)!;
    ({ suite } = drainer(appel, appel('jouer', b.jeu)));
  }
  return suite;
}

let ouvert: Pont | null = null;
afterEach(() => {
  ouvert?.appeler('quitter');
  ouvert = null;
});

function ouvrirLeCombatDeMagie() {
  const { appel, pont } = table();
  ouvert = pont;
  const jouer = (r: Reponse): Suite => drainer(appel, r).suite;
  viderLesFenetres(appel, jouer(appel('demarrer', { scenario: 'magie', graine: 7 })));
  const suite = viderLesFenetres(appel, jouer(appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 16, y: 11 }] })));
  return { appel, jouer, suite };
}

describe('l’incantation par le pont', () => {
  it('choisir son sort parmi les siens, puis sa cible : la fenêtre d’incantation s’ouvre sur ce sort', () => {
    const { appel, jouer, suite: ouverture } = ouvrirLeCombatDeMagie();
    let suite = ouverture;
    expect(suite.vue.zones['combat.actif'][0]).toMatchObject({ nom: 'Aelindra, Haute Sorcière' });

    const offres = suite.vue.zones['combat.offres'];
    const sorts = offres.find((c): c is Choix => c.id === 'offre/incantation')!;
    expect(sorts, 'les sorts de l’actif sont un choix à eux, aucun armé').toMatchObject({ type: 'liste', libelle: 'Sort', ton: 'neutre' });
    expect(offres.filter((c) => c.id.startsWith('economie/')).map((c) => [c.id, c.icone]), 'chaque part montrée en pastille porte le dessin de sa part').toEqual([
      ['economie/action', undefined], ['economie/mouvement', 'ressource/mouvement'], ['economie/gratuit', 'action/ramasser'], ['economie/aucun', undefined],
    ]);
    expect(offres.find((c) => c.id === 'economie/action')!.valeurs.map((b) => b.id), 'l’offre par candidat quitte la rangée de sa part').not.toContain('incantation');
    const flechette = sorts.valeurs.find((b) => b.libelle === 'Fléchette')!;
    expect(flechette.jeu, 'chaque sort joue le verbe de son offre, l’actif pour lanceur').toEqual({ type: 'incanterLeSort', args: [suite.vue.projection.combat!.actif!.id, 'flechette'] });
    const focaliser = offres.find((c): c is Choix => c.id === 'offre/focalisation')!;
    expect(focaliser.valeurs.map((b) => b.libelle), 'la liste de Focaliser montre les sorts qui se focalisent').toContain('Arme aethyrique');
    expect(focaliser.valeurs.map((b) => b.libelle), 'un sort qui ne se focalise pas quitte la liste').not.toContain('Fléchette');
    expect(focaliser.valeurs.filter((b) => b.refus !== null), 'aucune valeur refusée dans une liste ouverte').toEqual([]);

    suite = jouer(appel('jouer', flechette.jeu));
    const armes = suite.vue.zones['combat.offres'].find((c) => c.id === 'offre/incantation')!.valeurs.filter((b) => b.presse).map((b) => b.libelle);
    expect(armes, 'le sort choisi est pressé, seul').toEqual(['Fléchette']);
    expect(suite.vue.zones['combat.offres'].find((c) => c.id === 'offre/incantation')!.ton, 'la pastille dont un candidat est armé le dit par son ton').toBe('alerte');
    const [cible] = suite.vue.projection.combat!.cibles.liste;
    suite = jouer(appel('jouer', clicDuCombattant(suite.vue, cible)!));
    expect(suite.vue.zones['fenetre.titre'].map((l) => l.texte), 'la fenêtre d’incantation s’ouvre').toEqual(['Incantation']);
    expect(suite.vue.zones['combat.actif'], 'la fenêtre de jet prend la place du meuble de l’actif, qui n’est plus servi').toEqual([]);
    const corps = () => Object.fromEntries(suite.vue.zones['fenetre.corps'].map((e) => [e.id, e]));
    expect(corps().sort, 'le sort et sa cible').toMatchObject({ texte: 'Fléchette sur Loup' });
    expect(corps().ni, 'le centre montre le NI avant le jet, y compris 0').toMatchObject({ type: 'ligne', texte: 'Sort · Niveau d’incantation 0' });
    expect(corps().jet, 'la Compétence du lanceur, à jeter').toMatchObject({ qui: 'Aelindra, Haute Sorcière', libelle: 'Langue (Magick)', resultat: null });
    expect(suite.vue.zones['fenetre.reglages'], 'avant le jet, aucun pas de Surincantation').toEqual([]);

    suite = jouer(appel('jouer', enFocus(suite.vue)!.jeu));
    expect(corps().jet, 'le jet tombe').toMatchObject({ resultat: '15', verdict: 'réussite' });
    expect(corps().ni).toMatchObject({ texte: 'Sort · Niveau d’incantation 0' });
    expect(corps().surincantation, 'le DR ouvre la Surincantation').toMatchObject({ valeur: '1 pas sur 1' });
    const reglages = suite.vue.zones['fenetre.reglages'];
    expect(reglages.map((r) => r.libelle), 'chaque axe que le sort ouvre est un choix de pas ; les cibles supplémentaires se désignent sur la carte').toEqual(['Surincantation : Portée', 'Surincantation : Cibles']);
    const portee = reglages[0] as Choix;
    expect(portee.valeurs.map((b) => [b.libelle, b.presse]), 'de 0 au budget, l’alloué pressé').toEqual([['0', true], ['1', false]]);

    suite = jouer(appel('jouer', portee.valeurs[1].jeu));
    expect(corps().surincantation, 'le pas alloué entame le budget').toMatchObject({ valeur: '0 pas sur 1' });
    expect((suite.vue.zones['fenetre.reglages'][1] as Choix).valeurs[1].refus, 'un pas de plus sur un autre axe est refusé avec sa raison').toBeTruthy();
    expect(corps().issue, 'l’issue du jet').toMatchObject({ type: 'ligne' });
    const appliquer = enFocus(suite.vue)!;
    expect(appliquer.libelle, 'l’Entrée applique l’incantation').toBe('Appliquer');
    const applique = drainer(appel, appel('jouer', appliquer.jeu));
    suite = applique.suite;
    expect(suite.vue.zones['fenetre.titre'].map((l) => l.texte), 'appliquée, la fenêtre d’incantation se referme').not.toContain('Incantation');
    expect(applique.effets.find((e) => e.quoi === 'coup'), 'la Fléchette rend son trait magique, de la sorcière à sa cible (#3771)').toMatchObject({ vers: cible, depart: { visuel: 'canalisation' }, trajet: { projectile: 'trait-magique' } });
  });

  it('une Zone d’Effet centrée sur le lanceur montre le sort, sa cible et son NI', () => {
    const { appel, jouer, suite: ouverture } = ouvrirLeCombatDeMagie();
    const sorts = ouverture.vue.zones['combat.offres'].find((c): c is Choix => c.id === 'offre/incantation')!;
    const sang = sorts.valeurs.find((b) => b.libelle === 'Sang de la Terre')!;
    const { vue } = jouer(appel('jouer', sang.jeu));

    expect(corpsDe(vue, 'sort')).toMatchObject({ texte: 'Sang de la Terre sur soi-même' });
    expect(corpsDe(vue, 'zone')).toMatchObject({ libelle: 'Zone', valeur: '3 × 3 cases' });
    expect(corpsDe(vue, 'ni')).toMatchObject({ type: 'ligne', texte: 'Sort · Niveau d’incantation 6' });
  });
});

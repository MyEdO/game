/**
 * JOUER UNE CAMPAGNE PAR LE PONT (#3009) : une partie ouverte au groupe (`ouvrir`), son groupe composé par les boutons
 * des zones `groupe.pretires` et `groupe.heros`, une campagne du jeu lancée par le bouton de `groupe.campagnes`
 * (`lancer`), la partie quittée (`quitter`), puis une autre ouverte sous le même pont.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { drainer, erreurDe, suiteDe, table } from './pont.testkit';
import { t } from '../../../src/i18n';
import { etatInitialDuJeu, pretiresOfferts } from '../../../src/noyau/index';
import { allBuiltinCampaigns } from '../../../src/scenes/campaign';
import type { Bouton, Element, Entite, Jet } from '../../../src/hote/elements';
import type { Pont, VueDuPont } from './pont';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

/** Le bouton d'id `prefixe/…` de l'entité `id` de `entites`. */
function bouton(entites: Entite[], id: string, prefixe: string): Bouton {
  const b = entites.find((e) => e.id === id)?.elements.find((e): e is Bouton => e.type === 'bouton' && e.id.startsWith(`${prefixe}/`));
  if (!b) throw new Error(`aucun bouton ${prefixe} sur ${id} (${entites.map((e) => e.id).join(', ')})`);
  return b;
}
const recruter = (vue: VueDuPont, pretire: string): Bouton => bouton(vue.zones['groupe.pretires'], `pretire/${pretire}`, 'recruter');
const lancer = (vue: VueDuPont, campagne: string): Bouton => bouton(vue.zones['groupe.campagnes'], `campagne/${campagne}`, 'lancer');

describe('jouer une campagne par le pont', () => {
  it('une partie ouverte au groupe offre chaque pré-tiré et chaque campagne du jeu, le lancement refusé groupe vide', () => {
    const { pont, appel } = table();
    ouvert = pont;
    const s = suiteDe(appel('ouvrir', { graine: 7 }));
    expect(s.vue.projection.exploration, 'aucune scène avant le lancement').toBeNull();
    expect(s.vue.plateau).toBeNull();
    expect(s.vue.zones['groupe.heros']).toEqual([]);
    expect(s.vue.zones['groupe.pretires'].map((e) => e.id), 'chaque pré-tiré de la donnée').toEqual(pretiresOfferts(etatInitialDuJeu()).map((p) => `pretire/${p.id}`));
    expect(s.vue.zones['groupe.pretires'].every((e) => e.elements.some((x) => x.type === 'bouton' && x.refus === null)), 'chacun se recrute').toBe(true);
    expect(s.vue.zones['groupe.campagnes'].map((e) => e.id), 'chaque campagne du jeu').toEqual(allBuiltinCampaigns.map((c) => `campagne/${c.id}`));
    expect(lancer(s.vue, 'la-diligence').refus, 'le noyau dit le refus').toBe(t('party.action.start.empty'));
    expect(erreurDe(appel('lancer', lancer(s.vue, 'la-diligence').jeu))).toEqual({ categorie: 'regle', message: `lancer : ${t('party.action.start.empty')}` });
    expect(erreurDe(appel('lancer', { lancer: 'inconnue' })).categorie).toBe('validation');
    expect(erreurDe(appel('ouvrir', {})).message, 'une partie à la fois').toMatch(/quitter d’abord/);
    expect(erreurDe(appel('demarrer', { scenario: 'dome' })).message).toMatch(/quitter d’abord/);
  });

  it('le groupe se compose aux boutons des zones : recruter, le doublon refusé, renvoyer', () => {
    const { pont, appel } = table();
    ouvert = pont;
    let s = suiteDe(appel('ouvrir', { graine: 7 }));
    s = suiteDe(appel('jouer', recruter(s.vue, 'harbull-piedvelu').jeu));
    s = suiteDe(appel('jouer', recruter(s.vue, 'werner-murrmann').jeu));
    expect(s.vue.zones['groupe.heros'].map((e) => e.id)).toEqual(['heros/pretire-harbull-piedvelu', 'heros/pretire-werner-murrmann']);
    const doublon = recruter(s.vue, 'harbull-piedvelu');
    expect(doublon.refus, 'le héros déjà au groupe ne se recrute plus').toBe(t('pf.partyDuplicate', { name: s.vue.zones['groupe.heros'][0].nom }));
    const refuse = suiteDe(appel('jouer', doublon.jeu));
    expect(refuse.journal.map((l) => (l.de === 'journal' ? l.texte : null)), 'hors combat, le noyau dit son refus au journal').toEqual([doublon.refus]);
    expect(refuse.vue.zones['groupe.heros']).toEqual(s.vue.zones['groupe.heros']);
    expect(lancer(s.vue, 'arene').refus).toBeNull();
    const renvoyer = bouton(s.vue.zones['groupe.heros'], 'heros/pretire-harbull-piedvelu', 'renvoyer');
    expect(renvoyer.refus).toBeNull();
    s = suiteDe(appel('jouer', renvoyer.jeu));
    expect(s.vue.zones['groupe.heros'].map((e) => e.id)).toEqual(['heros/pretire-werner-murrmann']);
    expect(recruter(s.vue, 'harbull-piedvelu').refus, 'renvoyé, il se recrute de nouveau').toBeNull();
  });

  it('la campagne lancée entre en scène avec le groupe composé, ses zones de composition vidées', () => {
    const { pont, appel } = table();
    ouvert = pont;
    let s = suiteDe(appel('ouvrir', { graine: 7 }));
    s = suiteDe(appel('jouer', recruter(s.vue, 'harbull-piedvelu').jeu));
    s = suiteDe(appel('jouer', recruter(s.vue, 'werner-murrmann').jeu));
    const groupe = s.vue.zones['groupe.heros'].map((e) => ({ id: e.id, nom: e.nom, bourse: e.elements.find((x) => x.id === 'bourse') }));
    s = drainer(appel, appel('lancer', lancer(s.vue, 'la-diligence').jeu)).suite;
    expect(s.vue.projection.fenetre?.cle, 'la campagne s’ouvre sur sa fenêtre d’ouverture').toBe('ouverture');
    expect(s.vue.plateau, 'la scène d’entrée est posée').not.toBeNull();
    expect(appel('monde'), 'son monde se sert').toMatchObject({ ok: true, monde: expect.anything() });
    expect(s.vue.zones['groupe.heros'].map((e) => ({ id: e.id, nom: e.nom, bourse: e.elements.find((x) => x.id === 'bourse') })), 'le groupe composé, sa bourse intacte').toEqual(groupe);
    expect(s.vue.zones['groupe.heros'].flatMap((e) => e.elements).some((x) => x.id.startsWith('renvoyer/')), 'plus de renvoi en cours de partie').toBe(false);
    expect(s.vue.zones['groupe.pretires']).toEqual([]);
    expect(s.vue.zones['groupe.campagnes']).toEqual([]);
    expect(s.vue.zones['partie.gestes'].map((b) => b.jeu), 'la partie se sauvegarde, se règle, se joue en ligne et se quitte à tout moment').toEqual([{ sauvegardes: true }, { reglages: true }, { salon: true }, { quitter: true }]);
    expect(erreurDe(appel('lancer', { lancer: 'arene' })).message, 'une partie en cours ne se relance pas').toMatch(/déjà en cours/);
  });

  it('la partie quittée, une autre s’ouvre sous le même pont, ses jetons numérotés à la suite', { timeout: 120_000 }, () => {
    const { pont, appel } = table();
    ouvert = pont;
    expect(erreurDe(appel('quitter')).categorie, 'rien à quitter').toBe('validation');
    /** Les jetons de la première suite du dôme qui en programme, laissés en attente : le round ouvert, puis les tours
     *  des héros finis. */
    const jetonsDuDome = (): number[] => {
      drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
      drainer(appel, appel('jouer', { type: 'fenetreValider', args: ['debutDuRound'] }));
      let fin = appel('jouer', { type: 'terminerLeTour', args: [] });
      for (let tours = 0; !suiteDe(fin).programmes.length && tours < 8; tours++) fin = appel('jouer', { type: 'terminerLeTour', args: [] });
      return suiteDe(fin).programmes.map((j) => j.id);
    };
    const premiers = jetonsDuDome();
    expect(premiers.length, 'une fin de tour programme la suite du round').toBeGreaterThan(0);
    const suivant = Math.max(...premiers) + 1;
    expect(appel('quitter')).toEqual({ ok: true });
    expect(erreurDe(appel('vue')).message).toBe('aucune partie : demarrer ou ouvrir d’abord');
    expect(jetonsDuDome(), 'la même partie rejouée, ses jetons numérotés après ceux de la partie quittée').toEqual(premiers.map((id) => id + suivant));
    expect(erreurDe(appel('reprendre', { jeton: premiers[0] })), 'un jeton de la partie quittée ne se reprend pas').toEqual({ categorie: 'validation', message: `jeton inconnu : ${premiers[0]}` });
    appel('quitter');
    suiteDe(appel('jouer', recruter(suiteDe(appel('ouvrir', { graine: 7 })).vue, 'wanda-weltschmertz').jeu));
    expect(drainer(appel, appel('lancer', { lancer: 'arene' })).suite.vue.plateau, 'l’Arène lancée après un scénario quitté').not.toBeNull();
  });

  it('sans graine, les dés d’une partie viennent de l’entropie de l’hôte', () => {
    /** Le d100 de la race du premier héros créé dans une partie ouverte par `entree`. */
    const d100 = (entree: { graine?: number }): string => {
      const { pont, appel } = table();
      ouvert = pont;
      const geste = (zone: Element[], id: string): unknown => zone.find((e): e is Bouton => e.type === 'bouton' && e.id === id)!.jeu;
      let s = suiteDe(appel('ouvrir', entree));
      s = suiteDe(appel('creation', geste(s.vue.zones['groupe.gestes'], 'creation')));
      s = suiteDe(appel('creation', geste(s.vue.zones['creation.corps'], 'tirage')));
      appel('quitter');
      return s.vue.zones['creation.corps'].find((e): e is Jet => e.type === 'jet' && e.id === 'tirage')!.resultat!;
    };
    const parGraine = [1, 2, 3, 7, 0x8000].map((graine) => d100({ graine }));
    expect(new Set(parGraine).size, 'le d100 suit la graine').toBeGreaterThan(1);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(d100({}), 'la graine tirée de l’entropie : 0x8000').toBe(parGraine[4]);
    vi.spyOn(Math, 'random').mockReturnValue(7 / 0x10000);
    expect(d100({}), 'une autre entropie, une autre graine').toBe(parGraine[3]);
  });
});

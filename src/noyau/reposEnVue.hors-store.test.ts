/**
 * LE REPOS EN VUE, sans store (#3328) : `reposEnVue` dit la nuit à régler, chaque dormeur et ce que le lieu lui offre en
 * couchage et en pitance, chacun écrit en choix de la fenêtre (`fenetreChoisir('repos', …)`), ce qui l'attend cette nuit, et la note que les
 * bourses paient ; le verbe refuse en le disant ce que le lieu n'offre pas. LDB 66
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { reposEnVue } from './reposEnVue';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { isRation } from '../engine/provisions';
import { fixtureText } from '../i18n/fixtureText';
import { t } from '../i18n';

/** Un banc dont le groupe, deux héros sans ration et une bourse de 2 pistoles, s'arrête à l'auberge du relais. */
function relais() {
  const a = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Anna', seed: 11 }), { gold: 0, silver: 2, brass: 0 }, idsDeTest);
  const b = createHero({ idNeuf: idsDeTest, speciesId: 'nains', careerId: 'artisan', label: 'Borin', seed: 12 });
  for (const h of [a, b]) h.items = (h.items ?? []).filter((i) => !isRation(i));
  const banc = ouvrirLeBanc({ graine: 7, etat: { party: [a, b] } });
  banc.getState().offrirLeRepos({ lieu: fixtureText('Le relais'), places: { auberge: true } });
  const vue = () => reposEnVue(banc.getState())!;
  const dernier = () => banc.getState().journal.slice(-1)[0];
  return { banc, a, b, vue, dernier };
}

describe('le repos en vue', () => {
  it('la nuit, chaque dormeur et ce que le lieu lui offre, la note que les bourses paient', () => {
    const { a, vue } = relais();
    const r = vue();
    expect(r.nuit, 'la nuit et son lieu').toBe('Nuit à l’auberge — Le relais');
    const anna = r.dormeurs.find((d) => d.id === a.id)!;
    expect(anna.couchage.valeurs.map((v) => [v.libelle, v.choisie]), 'les couchages du relais, le premier pris').toEqual([['Privée', true], ['Commune', false], ['Dehors', false]]);
    expect(anna.pitance.valeurs.map((v) => v.libelle), 'sans ration, le repas ou rien').toEqual(['Repas', 'Rien']);
    expect(anna.couchage.valeurs[2].geste, 'le couchage, en verbe du noyau').toEqual({ verbe: 'fenetreChoisir', args: ['repos', 'couchage', 'dehors', a.id] });
    expect(r.note, 'une chambre pour deux et deux repas, plus que la bourse').toMatchObject({ couverte: false });
  });

  it('le dormeur règle sa nuit : la note suit, le ventre vide se dit ; ce que le lieu n’offre pas est refusé, dit', () => {
    const { banc, a, b, vue, dernier } = relais();
    for (const h of [a, b]) banc.actions.fenetreChoisir('repos', 'couchage', 'dehors', h.id);
    banc.actions.fenetreChoisir('repos', 'pitance', 'rien', a.id);
    const anna = vue().dormeurs.find((d) => d.id === a.id)!;
    expect(anna.couchage.valeurs.find((v) => v.choisie)?.libelle, 'dehors').toBe('Dehors');
    expect(anna.alertes, 'le ventre vide').toContain('Ventre vide');
    expect(vue().note, 'un repas seul, que la bourse couvre').toMatchObject({ couverte: true });

    banc.actions.fenetreChoisir('repos', 'couchage', 'bord', a.id);
    expect(dernier(), 'le hamac n’est pas offert au relais').toBe(t('choix.refus.valeur'));
    banc.actions.fenetreChoisir('repos', 'pitance', 'ration', a.id);
    expect(dernier(), 'sans ration, pas de ration').toBe(t('choix.refus.valeur'));
    expect(vue().dormeurs.find((d) => d.id === a.id)!.couchage.valeurs.find((v) => v.choisie)?.libelle, 'rien ne change').toBe('Dehors');
  });
});

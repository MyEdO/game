/**
 * LE ROSTER PAR LE PONT (#3009) : les héros du roster de l'hôte montrés tant que le groupe se compose (`groupe.roster`),
 * recrutés au groupe ou retirés du roster par la méthode `roster`, ce que leur chargement retire dit en `groupe.avis`,
 * et le héros du roster que le noyau persiste en partie mis à jour dans le stockage.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { erreurDe, suiteDe, table } from './pont.testkit';
import { t } from '../../../src/i18n';
import { rosterDeTest } from '../../../src/engine/idsDeTest.testkit';
import { brouillonComplet } from '../../../src/noyau/creation/engagement.testkit';
import { engagement, type RosterEntry } from '../../../src/noyau/index';
import { ajouterAuRoster, chargerLeRoster } from '../../../src/hote/roster';
import type { Bouton, Entite, Ligne } from '../../../src/hote/elements';
import type { Pont, Suite } from './pont';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });

/** Une table dont le stockage porte au roster un héros par nom de `noms`, chacun sous un id de sa session. */
function tableAuRoster(...noms: string[]) {
  const ouverte = table();
  ouvert = ouverte.pont;
  const entrees = noms.map((nom): RosterEntry => engagement(brouillonComplet(nom), rosterDeTest(nom)));
  for (const e of entrees) ajouterAuRoster(ouverte.stockage, e);
  return { ...ouverte, entrees };
}
const carte = (s: Suite, id: string): Entite => s.vue.zones['groupe.roster'].find((e) => e.id === `roster/${id}`)!;
const boutonDe = (s: Suite, id: string, geste: 'recruter' | 'retirer'): Bouton => carte(s, id).elements.find((x): x is Bouton => x.type === 'bouton' && x.id === `${geste}/${id}`)!;
const groupe = (s: Suite): string[] => s.vue.zones['groupe.heros'].map((e) => e.id);

describe('le roster par le pont', () => {
  it('chaque héros du roster se montre au groupe à composer, avec ce qui le recrute et ce qui le retire', () => {
    const { appel, entrees } = tableAuRoster('Alda', 'Bruno');
    const s = suiteDe(appel('ouvrir', { graine: 7 }));
    expect(s.vue.zones['groupe.roster'].map((e) => [e.id, e.nom])).toEqual(entrees.map((e) => [`roster/${e.hero.id}`, e.hero.label]));
    expect((carte(s, entrees[0].hero.id).elements[0] as Ligne).texte, 'son espèce et sa carrière').toMatch(new RegExp(`.+${t('ecran.separateur')}.+`));
    expect(carte(s, entrees[0].hero.id).elements.filter((x): x is Bouton => x.type === 'bouton').map((b) => [b.libelle, b.jeu, b.refus])).toEqual([
      [t('ecran.groupe.recruter'), { roster: { recruter: entrees[0].hero.id } }, null],
      [t('picker.hero.delete'), { roster: { retirer: entrees[0].hero.id } }, null],
    ]);
    expect(s.vue.zones['groupe.avis']).toEqual([]);
  });

  it('recruté, le héros rejoint le groupe sous l’id que le roster garde, avec sa Richesse, et ne se recrute plus', () => {
    const { appel, entrees, stockage } = tableAuRoster('Alda', 'Bruno');
    const [alda, bruno] = entrees.map((e) => e.hero.id);
    const s = suiteDe(appel('ouvrir', { graine: 7 }));
    const recrute = suiteDe(appel('roster', boutonDe(s, alda, 'recruter').jeu));
    expect(groupe(recrute)).toEqual([`heros/${alda}`]);
    expect(recrute.vue.projection.pas, 'le recrutement est un geste de la partie').toBe(s.vue.projection.pas + 1);
    expect(recrute.zones['journal.lignes'].some((l) => l.texte.includes('Alda')), 'sa bourse de départ au journal').toBe(true);
    expect(boutonDe(recrute, alda, 'recruter').refus, 'déjà au groupe').toBe(t('pf.partyDuplicate', { name: 'Alda' }));
    expect(erreurDe(appel('roster', { roster: { recruter: alda } })), 'le bouton refusé se refuse en règle').toEqual({ categorie: 'regle', message: `roster : ${t('pf.partyDuplicate', { name: 'Alda' })}` });
    expect(boutonDe(recrute, bruno, 'recruter').refus).toBeNull();
    expect(chargerLeRoster(stockage).map((e) => e.hero.id), 'le roster garde ses deux héros').toEqual([alda, bruno]);
  });

  it('retiré, le héros quitte le roster et son stockage, la partie intacte', () => {
    const { appel, entrees, stockage } = tableAuRoster('Alda', 'Bruno');
    const [alda, bruno] = entrees.map((e) => e.hero.id);
    const s = suiteDe(appel('ouvrir', { graine: 7 }));
    const retire = suiteDe(appel('roster', boutonDe(s, alda, 'retirer').jeu));
    expect(retire.vue.zones['groupe.roster'].map((e) => e.id)).toEqual([`roster/${bruno}`]);
    expect([retire.vue.projection.pas, retire.programmes, retire.journal], 'aucun geste de la partie').toEqual([s.vue.projection.pas, [], []]);
    expect(chargerLeRoster(stockage).map((e) => e.hero.id)).toEqual([bruno]);
    expect(erreurDe(appel('roster', { roster: { retirer: alda } })).categorie, 'un geste que l’écran n’offre plus').toBe('validation');
    expect(erreurDe(appel('roster', { roster: { oublier: bruno } })).categorie, 'ni un geste inconnu').toBe('validation');
  });

  it('un roster d’un autre format est retiré, et dit tant que le groupe de cette partie se compose', () => {
    const { appel, stockage } = tableAuRoster();
    stockage.setItem('wfrp4.roster', '{"version":"ancienne","heros":[]}');
    const s = suiteDe(appel('ouvrir', { graine: 7 }));
    expect(s.vue.zones['groupe.avis'].map((l) => [l.texte, l.ton])).toEqual([[t('picker.roster.retire'), 'alerte']]);
    expect(stockage.getItem('wfrp4.roster'), 'retiré du stockage').toBeNull();
    const pretire = s.vue.zones['groupe.pretires'][0].elements.find((x): x is Bouton => x.type === 'bouton')!;
    expect(suiteDe(appel('jouer', pretire.jeu)).vue.zones['groupe.avis'].map((l) => l.texte), 'un geste plus tard, il se dit encore').toEqual([t('picker.roster.retire')]);
    appel('quitter');
    expect(suiteDe(appel('ouvrir', { graine: 7 })).vue.zones['groupe.avis'], 'la partie suivante ne le redit pas').toEqual([]);
  });

  it('la partie lancée ne montre plus le roster, et y met à jour le héros que le noyau persiste', () => {
    const { appel, entrees, stockage } = tableAuRoster('Alda');
    const alda = entrees[0].hero.id;
    const s = suiteDe(appel('ouvrir', { graine: 7 }));
    appel('roster', boutonDe(s, alda, 'recruter').jeu);
    const lancee = suiteDe(appel('lancer', { lancer: 'la-diligence' }));
    expect([lancee.vue.zones['groupe.roster'], lancee.vue.zones['groupe.avis']]).toEqual([[], []]);
    suiteDe(appel('jouer', { type: 'ecrireLHistorique', args: [alda, { motivation: 'Foi' }] }));
    expect(chargerLeRoster(stockage).map((e) => [e.hero.id, e.hero.motivation, e.draft.motivation])).toEqual([[alda, 'Foi', 'Foi']]);
  });
});

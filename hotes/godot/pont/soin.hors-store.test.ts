/**
 * LE SOIN PAR LE PONT (#3328) : « Magie en combat » joué comme Godot le joue. Le groupe franchit la ligne d'engagement,
 * les tours passent jusqu'au Tueur, qui soigne : son offre, puis son patient au clic. La fenêtre du soin nomme le patient
 * et règle l'acte et le Test en choix nommés (`fenetreDuSoin`), chaque option fermée avec sa raison.
 */
import { describe, it, expect } from 'vitest';
import { drainer, gestesDessines, table, type Reponse, enFocus } from './pont.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton, Choix } from '../../../src/hote/elements';
import { clicDuCombattant, type Suite } from './pont';

const { appel } = table();

/** Joue le geste que l'Entrée jouerait, ou la première valeur ouverte d'un choix de la fenêtre, tant qu'une fenêtre tient
 *  la main, réglages compris (le choix d'une étape de cascade). */
function viderLesFenetres(suite: Suite): Suite {
  for (let pas = 0; suite.vue.projection.fenetre; pas++) {
    expect(pas, 'les fenêtres se vident').toBeLessThan(20);
    const g = gestesDessines(suite.vue);
    const b = g.find((x): x is Bouton => x.type === 'bouton' && x.focus) ?? g.flatMap((x) => (x.type === 'choix' ? x.valeurs : [])).find((v) => !v.refus)!;
    ({ suite } = drainer(appel, appel('jouer', b.jeu)));
  }
  return suite;
}

const jouer = (r: Reponse): Suite => viderLesFenetres(drainer(appel, r).suite);
const offre = (suite: Suite, id: string): Bouton => suite.vue.zones['combat.offres'].flatMap((c) => c.valeurs).find((b) => b.id === id)!;

describe('le soin par le pont', () => {
  it('soigner un allié : le patient, l’acte et le Test en choix, chacun fermé avec sa raison', () => {
    jouer(appel('demarrer', { scenario: 'magie', graine: 7 }));
    let suite = jouer(appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 16, y: 11 }] }));
    for (let tours = 0; suite.vue.zones['combat.actif'][0]?.nom !== 'Tueur'; tours++) {
      expect(tours, 'Le Tueur prend la main').toBeLessThan(5);
      suite = jouer(appel('jouer', offre(suite, 'fin-de-tour').jeu));
      if (suite.vue.projection.combat!.finDeTourArmee) suite = jouer(appel('jouer', offre(suite, 'fin-de-tour').jeu));
    }
    expect(offre(suite, 'soins'), 'Le Tueur soigne').toMatchObject({ libelle: 'Soigner', refus: null });

    ({ suite } = drainer(appel, appel('jouer', offre(suite, 'soins').jeu)));
    const [patient] = suite.vue.projection.combat!.cibles.liste;
    ({ suite } = drainer(appel, appel('jouer', clicDuCombattant(suite.vue, patient)!)));
    const corps = () => Object.fromEntries(suite.vue.zones['fenetre.corps'].map((e) => [e.id, e]));
    expect(corps().soin, 'le patient ; le soigneur tient la fenêtre et jette').toMatchObject({ texte: 'Patient : Aelindra, Haute Sorcière' });

    const reglages = () => Object.fromEntries(suite.vue.zones['fenetre.reglages'].map((r) => [r.libelle, r as Choix]));
    const acte = reglages().Soin;
    expect(acte.valeurs.filter((b) => b.presse).map((b) => b.libelle), 'l’acte déclaré est pressé').toEqual(['Soigner les Blessures']);
    expect(acte.valeurs.find((b) => b.libelle === 'Arrêter l’Hémorragie')!.refus, 'un acte sans objet est fermé avec sa raison').toBe('Aucune Hémorragie');
    expect(acte.valeurs.find((b) => b.libelle === 'Opérer')!.refus, 'un acte d’infirmerie est fermé en combat').toBeTruthy();
    expect(reglages().Test.valeurs.map((b) => [b.libelle, b.presse, b.refus]), 'le Test, Guérison déclarée').toEqual([
      ['Guérison', true, null], ['Dextérité', false, 'La Dextérité n’arrête que l’Hémorragie'],
    ]);

    ({ suite } = drainer(appel, appel('jouer', enFocus(suite.vue)!.jeu)));
    expect(corps()['jets/0/0'], 'le jet de Guérison tombe').toMatchObject({ qui: 'Tueur', libelle: 'Guérison' });
    expect((corps()['jets/0/0'] as { resultat: string | null }).resultat, 'son dé').not.toBeNull();
    expect(Object.values(reglages()).flatMap((c) => c.valeurs).every((b) => b.presse || b.refus), 'le jet tombé, l’acte et le Test ne se règlent plus').toBe(true);
  });
});

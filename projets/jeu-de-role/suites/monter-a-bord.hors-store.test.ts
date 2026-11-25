/**
 * « MONTER À BORD » PAR LE PONT DANS LA DILIGENCE (#4576, #4471) : l'action authorée sur la diligence posée
 * (`diligence-cour-diligence`, une coque terrestre que l'exploration ne nomme pas) s'offre au groupe à sa portée parmi
 * les boutons de `exploration.gestes`, et s'y joue jusqu'au départ (`edo-ch1-depart`). Le contrat du pont sur une coque
 * fabriquée : `hotes/godot/pont/monter-a-bord.hors-store.test.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { drainer, enFocus, suiteDe, table } from '../../../hotes/godot/pont/pont.testkit';
import type { Bouton } from '../../../src/hote/elements';
import type { Pont, VueDuPont } from '../../../hotes/godot/pont/pont';
import { stockageEnMemoire } from '../../../src/lib/stockage.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import { contenu } from '../contenu';

let ouvert: Pont | null = null;
afterEach(() => { ouvert?.appeler('quitter'); ouvert = null; });
const MONTER = { type: 'jouerAction', args: ['diligence-cour-diligence', 'monter-a-bord'] };
const offreDeMonter = (vue: VueDuPont): Bouton | undefined =>
  vue.zones['exploration.gestes'].find((b) => JSON.stringify(b.jeu) === JSON.stringify({ suite: [MONTER] }));

describe('« Monter à bord » s’offre et se joue par le pont dans La Diligence (#4576)', () => {
  it('le groupe à portée de la diligence voit le bouton, le presse, et part (`edo-ch1-depart`)', () => {
    const stockage = stockageEnMemoire();
    const { pont, appel } = table(stockage, null, contenu);
    ouvert = pont;
    let s = suiteDe(appel('ouvrir', { graine: 7 }));
    const recruter = s.vue.zones['groupe.pretires'][0].elements.find((x): x is Bouton => x.type === 'bouton')!;
    appel('jouer', recruter.jeu);
    s = drainer(appel, appel('lancer', { lancer: 'la-diligence' })).suite;
    while (s.vue.projection.fenetre) s = drainer(appel, appel('jouer', (enFocus(s.vue) as Bouton).jeu)).suite;
    expect(s.vue.projection.scene?.id).toBe('la-diligence');
    expect(offreDeMonter(s.vue), 'hors de portée, rien à offrir').toBeUndefined();

    s = drainer(appel, appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 24, y: 28 }] })).suite;
    expect(s.vue.projection.exploration!.groupe).toEqual([24, 28]);
    const offre = offreDeMonter(s.vue);
    expect(offre, s.vue.zones['exploration.gestes'].map((b) => b.libelle).join(' | ')).toBeDefined();
    expect(offre!.refus).toBeNull();

    drainer(appel, appel('jouer', offre!.jeu));
    expect(appel('sauvegarder', { sauvegarder: 1 }).ok).toBe(true);
    expect([...stockage.contenu.values()].some((v) => v.includes('"edo-ch1-depart":true')), 'la sauvegarde porte le flag du départ').toBe(true);
  });
});

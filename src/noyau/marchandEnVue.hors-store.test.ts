/** `marchandEnVue` (#3534, #4574) : l'échoppe en données. LDB 68 */
import { describe, expect, it } from 'vitest';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { customTrapping, itemFromTrappingById } from '../engine/items';
import { armurierDuRelais } from './marchand.testkit';
import { marchandEnVue } from './marchandEnVue';

/** L'armurier `artisan` d'un relais, trois dagues en stock, ouvert par le héros `h` (bourse : 960 sous de cuivre),
 *  qui porte une dague et un bibelot hors catalogue (`customTrapping`). */
function echoppe() {
  const dague = itemFromTrappingById('dague', idsDeTest)!;
  const bibelot = customTrapping('Bibelot', idsDeTest);
  const { get, ouvrir } = armurierDuRelais(combattantDeTest({ id: 'h', label: 'H', kind: 'heros', items: [dague, bibelot] }));
  ouvrir();
  return { get, dague, bibelot };
}

describe('l’échoppe en vue, en données (#4574)', () => {
  it('le marchand par son id, la bourse, le prix, l’unitaire, le sous-total et les totaux en Money ; l’objet d’une possession par son id, `null` hors catalogue', () => {
    const { get, dague, bibelot } = echoppe();
    get().fenetreChoisir('marchand', 'ajouterAuPanier', 'dague');
    get().fenetreChoisir('marchand', 'ajouterAuPanier', 'dague');
    get().fenetreChoisir('marchand', 'ajouterALaVente', dague.uid);
    const m = marchandEnVue(get())!;
    const bourse = get().party[0].items!.find((it) => it.trappingId === 'bourse')!;
    const seize = { gold: 0, silver: 16, brass: 0 };
    expect(m.marchand).toBe('artisan');
    expect(m.bourse).toEqual({ gold: 4, silver: 0, brass: 0 });
    expect(m.etal.flatMap((f) => f.articles.map((a) => [a.id, a.prix]))).toEqual([['dague', seize]]);
    expect(m.panier.lignes.map(({ oter: _, ...l }) => l)).toEqual([{ id: 'dague', nom: 'Dague', qty: 2, unitaire: seize, sousTotal: { gold: 1, silver: 12, brass: 0 } }]);
    expect(m.panier.total).toEqual({ gold: 1, silver: 12, brass: 0 });
    expect(m.vente.heros.flatMap((h) => h.possessions.map(({ basculer: _, ...p }) => p))).toEqual([
      { uid: dague.uid, objet: 'dague', nom: 'Dague', gain: { gold: 0, silver: 4, brass: 0 }, refus: null, auLot: true },
      { uid: bibelot.uid, objet: null, nom: 'Bibelot', gain: { gold: 0, silver: 0, brass: 0 }, refus: null, auLot: false },
      { uid: bourse.uid, objet: 'bourse', nom: 'Bourse', gain: { gold: 0, silver: 0, brass: 1 }, refus: null, auLot: false },
    ]);
    expect(m.vente.total).toEqual({ gold: 0, silver: 4, brass: 0 });
  });
});

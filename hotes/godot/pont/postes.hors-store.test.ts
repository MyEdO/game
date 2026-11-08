/**
 * LES PIÈCES MONTÉES AUX POSTES D'UN NAVIRE (#2987 ; `CONTRAT.md`, section « Corps d'un combattant ») : la vue donne à un
 * véhicule servi chaque pièce de ses postes à un bord dont un élément est servi, à la position suivante de ce bord que son
 * manifeste offre (`postesMontes`), à la palette du véhicule où celle de sa teinte colore.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { vehiculeDeTest } from '../asset/modeles.testkit.ts';
import { modelesCommites, servirLesModeles, suiteDe, table, vueDe } from './pont.testkit';
import { ameliorationsMontees, emblemeMonte, postesMontes } from './atelier';
import { paletteDesCouleurs } from './composition';
import { findCouleurById, findTeinteById } from '../../../src/noyau/index';
import { couleursSchema } from '../../../src/data/schemas/grammaire/valeurs';

const COMMITES = modelesCommites();

const { appel } = table();
const servir = (manifestes: Record<string, unknown>) => servirLesModeles(appel, COMMITES, manifestes);

describe('la palette d’une pièce montée (`postesMontes`)', () => {
  const MANIFESTE = { postes: { tribord: [[-3, 1.9, 4]], proue: [[1.2, 5.6, 13]] } };
  const SERVIS = { 'canon-moyen': 'canon-moyen' };
  it('celle du véhicule, où la palette de la teinte de la pièce colore', () => {
    const navire = paletteDesCouleurs(couleursSchema.parse({ bois: { id: 'peau-brune' }, metal: { id: 'peau-pale' } }));
    expect(navire).toEqual({ bois: findCouleurById('peau-brune')!.color, metal: findCouleurById('peau-pale')!.color });
    const montes = postesMontes(MANIFESTE, [{ definition: 'canon-moyen', bord: 'tribord', teinte: 'aethyrique' }, { definition: 'canon-moyen', bord: 'proue' }], SERVIS, navire);
    expect(montes.map((m) => m.palette)).toEqual([{ ...navire, ...findTeinteById('aethyrique')!.palette }, navire]);
  });
});

/** Le manifeste de la pièce de l'Amélioration `amelioration`, montée selon `montage`. */
const ameliorationDeTest = (amelioration: string, montage: 'ancrages' | 'postes') => ({ ...vehiculeDeTest(), categorie: 'amelioration', cle: { amelioration }, montage });

describe('les pièces d’Amélioration d’un véhicule (`ameliorationsMontees`)', () => {
  const MANIFESTE = { postes: { tribord: [[-3, 1.9, 4], [-3, 1.9, 2]], proue: [[1.2, 5.6, 13]] }, ancrages: { ancre: [[-2, 3, 14], [2, 3, 14]] } };
  const MANIFESTES = { sabord: ameliorationDeTest('sabord', 'postes'), ancre: ameliorationDeTest('ancre', 'ancrages') };
  const PIECES = { sabord: 'sabord', ancre: 'ancre', 'canon-moyen': 'canon-moyen' };
  const montes = postesMontes(MANIFESTE, [{ definition: 'canon-moyen', bord: 'tribord' }], PIECES, {});
  it('montée aux postes, à chaque poste offert, ouverte devant une pièce montée, fermée sinon', () => {
    expect(ameliorationsMontees(MANIFESTE, ['sabord'], montes, PIECES, MANIFESTES)).toEqual([
      { element: 'sabord', position: MANIFESTE.postes.tribord[0], poste: { bord: 'tribord', montre: 'ouvert', cache: 'ferme' } },
      { element: 'sabord', position: MANIFESTE.postes.tribord[1], poste: { bord: 'tribord', montre: 'ferme', cache: 'ouvert' } },
      { element: 'sabord', position: MANIFESTE.postes.proue[0], poste: { bord: 'proue', montre: 'ferme', cache: 'ouvert' } },
    ]);
  });
  it('montée aux ancrages, à chacun des ancrages de son Amélioration', () => {
    expect(ameliorationsMontees(MANIFESTE, ['ancre'], montes, PIECES, MANIFESTES)).toEqual(MANIFESTE.ancrages.ancre.map((position) => ({ element: 'ancre', position })));
  });
  it('une Amélioration sans pièce servie ne monte rien', () => {
    expect(ameliorationsMontees(MANIFESTE, ['figure-de-proue', 'lissage'], montes, PIECES, MANIFESTES)).toEqual([]);
  });
});

describe('l’emblème d’un véhicule (`emblemeMonte`)', () => {
  const VOILEE = { ...vehiculeDeTest(), surfaces: [{ nom: 'toile', palette: 'vet1', blason: true }, { nom: 'metal', palette: 'metal' }] };
  const embleme = { id: 'taureau-rouge' };
  it('posé sur un élément qui porte une surface `blason` (ses voiles, son pavillon)', () => expect(emblemeMonte(embleme, VOILEE)).toEqual({ embleme }));
  it('aucun sur un élément sans surface `blason`, sans élément ou sans emblème', () => {
    expect([emblemeMonte(embleme, vehiculeDeTest()), emblemeMonte(embleme, undefined), emblemeMonte(undefined, VOILEE)]).toEqual([{}, {}, {}]);
  });
});

describe('les pièces montées aux postes d’un navire', () => {
  const NAVIRE = 'loup-imperial';
  const TRIBORD = [[-3, 1.9, 4], [-3, 1.9, 2]] as const;
  const PROUE = [[1.2, 5.6, 13]] as const;
  let id: string;
  beforeAll(() => {
    const { vue } = suiteDe(appel('demarrer', { scenario: 'duel-naval', graine: 7 }));
    const grimm = vue.projection.combat!.voisins.liste.find((c) => c.vehicule?.definition === NAVIRE)!;
    id = grimm.id;
    expect(grimm.vehicule).toEqual({ definition: NAVIRE, empreinte: 4, taille: 'empreinte', cap: 'E', postes: [{ definition: 'canon-moyen', bord: 'tribord' }, { definition: 'canon-moyen', bord: 'babord' }, { definition: 'canon-moyen', bord: 'proue' }], ameliorations: ['belier'] });
  });

  it('chaque pièce dont un élément est servi se monte à la position suivante de son bord, si son navire l’offre', () => {
    servir({ ...COMMITES.manifestes, [NAVIRE]: { ...vehiculeDeTest(NAVIRE), postes: { tribord: TRIBORD, proue: PROUE } }, 'canon-moyen': vehiculeDeTest('canon-moyen') });
    expect(vueDe(appel('vue')).corps.vehicules[id]).toEqual({
      element: NAVIRE, empreinte: 4, taille: 'empreinte', cap: 'E', palette: {},
      postes: [{ element: 'canon-moyen', bord: 'tribord', position: TRIBORD[0], palette: {} }, { element: 'canon-moyen', bord: 'proue', position: PROUE[0], palette: {} }],
      ameliorations: [],
    });
  });

  it('la pièce servie d’une Amélioration de sa coque se monte à chacun de ses ancrages', () => {
    const BELIER = [[0, 0.5, 14]] as const;
    servir({ ...COMMITES.manifestes, [NAVIRE]: { ...vehiculeDeTest(NAVIRE), ancrages: { belier: BELIER } }, 'belier': ameliorationDeTest('belier', 'ancrages') });
    expect(vueDe(appel('vue')).corps.vehicules[id].ameliorations).toEqual([{ element: 'belier', position: BELIER[0] }]);
  });

  it('sans élément de sa fiche servi, aucune pièce ne se monte', () => {
    servir({ ...COMMITES.manifestes, [NAVIRE]: { ...vehiculeDeTest(NAVIRE), postes: { tribord: TRIBORD, proue: PROUE } } });
    expect(vueDe(appel('vue')).corps.vehicules[id].postes).toEqual([]);
  });
});

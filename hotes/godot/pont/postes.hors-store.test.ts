/**
 * LES PIÈCES MONTÉES AUX POSTES D'UN NAVIRE (#2987 ; `CONTRAT.md`, section « Corps d'un combattant ») : la vue donne à un
 * véhicule servi chaque pièce de ses postes à un bord dont un élément est servi, à la position suivante de ce bord que son
 * manifeste offre (`postesMontes`), à la palette du véhicule où celle de sa teinte colore ; les postes qu'une Amélioration
 * montée offre remplacent ceux des bords qu'elle nomme (`postesEnVigueur`, MDG 12 l.362) ; les nœuds qu'elle change se cachent
 * selon qu'elle est montée (`noeudsCaches`).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { vehiculeDeTest } from '../asset/modeles.testkit.ts';
import { modelesCommites, servirLesModeles, suiteDe, table, vueDe } from './pont.testkit';
import { ameliorationsMontees, emblemeMonte, noeudsCaches, postesEnVigueur, postesMontes } from './atelier';
import { paletteDesCouleurs } from './composition';
import { findCouleurById, findTeinteById } from '../../../src/noyau/index';
import { couleursSchema } from '../../../src/data/schemas/grammaire/valeurs';

const COMMITES = await modelesCommites();

const { appel } = table();
const servir = (manifestes: Record<string, unknown>) => servirLesModeles(appel, COMMITES, manifestes);

describe('la palette d’une pièce montée (`postesMontes`)', () => {
  const MANIFESTE = { postes: { tribord: [[-3, 1.9, 4]], proue: [[1.2, 5.6, 13]] } };
  const SERVIS = { 'canon-moyen': 'canon-moyen' };
  it('celle du véhicule, où la palette de la teinte de la pièce colore', () => {
    const navire = paletteDesCouleurs(couleursSchema.parse({ bois: { id: 'peau-brune' }, metal: { id: 'peau-pale' } }));
    expect(navire).toEqual({ bois: findCouleurById('peau-brune')!.color, metal: findCouleurById('peau-pale')!.color });
    const montes = postesMontes(MANIFESTE, [], [{ definition: 'canon-moyen', bord: 'tribord', teinte: 'aethyrique' }, { definition: 'canon-moyen', bord: 'proue' }], SERVIS, navire);
    expect(montes.map((m) => m.palette)).toEqual([{ ...navire, ...findTeinteById('aethyrique')!.palette }, navire]);
  });
});

/** Le manifeste de la pièce de l'Amélioration `amelioration`, montée selon `montage`. */
const ameliorationDeTest = (amelioration: string, montage: 'ancrages' | 'postes') => ({ ...vehiculeDeTest(), categorie: 'amelioration', cle: { amelioration }, montage });

describe('les postes en vigueur d’un véhicule (`postesEnVigueur`)', () => {
  const PONT = { tribord: [[-3, 1.9, 4]], babord: [[3, 1.9, 4]], proue: [[1.2, 5.6, 13]] };
  const SABORDS = { tribord: [[-4, 0.3, 4], [-4, 0.3, 2]], babord: [[4, 0.3, 4], [4, 0.3, 2]] };
  const MANIFESTE = { postes: PONT, selon: { sabord: { postes: SABORDS } } };
  it('sans l’Amélioration, ceux du manifeste : on tire du pont', () => expect(postesEnVigueur(MANIFESTE, [])).toEqual(PONT));
  it('avec elle, chaque bord qu’elle nomme prend ses postes, les autres gardent les leurs', () => {
    expect(postesEnVigueur(MANIFESTE, ['sabord'])).toEqual({ ...SABORDS, proue: PONT.proue });
  });
  it('une pièce de poste suit les postes en vigueur', () => {
    const pieces = [{ definition: 'canon-moyen', bord: 'tribord' as const }, { definition: 'canon-moyen', bord: 'tribord' as const }];
    expect(postesMontes(MANIFESTE, ['sabord'], pieces, { 'canon-moyen': 'canon-moyen' }, {}).map((m) => m.position)).toEqual(SABORDS.tribord);
    expect(postesMontes(MANIFESTE, [], pieces, { 'canon-moyen': 'canon-moyen' }, {}).map((m) => m.position)).toEqual(PONT.tribord);
  });
});

describe('les pièces d’Amélioration d’un véhicule (`ameliorationsMontees`)', () => {
  const SABORDS = { tribord: [[-4, 0.3, 4], [-4, 0.3, 2]], proue: [[1.2, 4, 13]] };
  const MANIFESTE = { postes: { tribord: [[-3, 1.9, 4]] }, selon: { sabord: { postes: SABORDS } }, ancrages: { ancre: [[-2, 3, 14], [2, 3, 14]] } };
  const MANIFESTES = { sabord: ameliorationDeTest('sabord', 'postes'), ancre: ameliorationDeTest('ancre', 'ancrages') };
  const PIECES = { sabord: 'sabord', ancre: 'ancre', 'canon-moyen': 'canon-moyen' };
  const montes = postesMontes(MANIFESTE, ['sabord'], [{ definition: 'canon-moyen', bord: 'tribord' }], PIECES, {});
  it('montée aux postes, à chaque poste que son Amélioration offre, ouverte devant une pièce montée, fermée sinon', () => {
    expect(ameliorationsMontees(MANIFESTE, ['sabord'], montes, PIECES, MANIFESTES)).toEqual([
      { element: 'sabord', position: SABORDS.tribord[0], poste: { bord: 'tribord', montre: 'ouvert', cache: 'ferme' } },
      { element: 'sabord', position: SABORDS.tribord[1], poste: { bord: 'tribord', montre: 'ferme', cache: 'ouvert' } },
      { element: 'sabord', position: SABORDS.proue[0], poste: { bord: 'proue', montre: 'ferme', cache: 'ouvert' } },
    ]);
  });
  it('montée aux ancrages, à chacun des ancrages de son Amélioration', () => {
    expect(ameliorationsMontees(MANIFESTE, ['ancre'], montes, PIECES, MANIFESTES)).toEqual(MANIFESTE.ancrages.ancre.map((position) => ({ element: 'ancre', position })));
  });
  it('une Amélioration sans pièce servie ne monte rien', () => {
    expect(ameliorationsMontees(MANIFESTE, ['figure-de-proue', 'lissage'], montes, PIECES, MANIFESTES)).toEqual([]);
  });
});

describe('les nœuds cachés d’un véhicule (`noeudsCaches`)', () => {
  const MANIFESTE = { selon: { sabord: {} } };
  const MANIFESTES = { 'blindage-fer': { ...ameliorationDeTest('blindage-fer', 'ancrages'), selon: { sabord: {}, belier: {} } } };
  const BLINDAGE = [{ element: 'blindage-fer', position: [0, 0, 0] as const }];
  it('pour chaque Amélioration que nomme le `selon` du véhicule ou d’une pièce montée : `sans-` montée, `avec-` sinon', () => {
    expect(noeudsCaches(MANIFESTE, ['sabord', 'blindage-fer'], BLINDAGE, MANIFESTES)).toEqual(['sans-sabord', 'avec-belier']);
    expect(noeudsCaches(MANIFESTE, ['blindage-fer', 'belier'], BLINDAGE, MANIFESTES)).toEqual(['avec-sabord', 'sans-belier']);
  });
  it('sans `selon`, aucun', () => expect(noeudsCaches({}, ['sabord'], [], {})).toEqual([]));
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
    servir({ [NAVIRE]: { ...vehiculeDeTest(NAVIRE), postes: { tribord: TRIBORD, proue: PROUE } }, 'canon-moyen': vehiculeDeTest('canon-moyen') });
    expect(vueDe(appel('vue')).corps.vehicules[id]).toEqual({
      element: NAVIRE, empreinte: 4, taille: 'empreinte', cap: 'E', palette: {},
      postes: [{ element: 'canon-moyen', bord: 'tribord', position: TRIBORD[0], palette: {} }, { element: 'canon-moyen', bord: 'proue', position: PROUE[0], palette: {} }],
      ameliorations: [], caches: [], clips: {},
    });
  });

  it('la pièce servie d’une Amélioration de sa coque se monte à chacun de ses ancrages', () => {
    const BELIER = [[0, 0.5, 14]] as const;
    servir({ [NAVIRE]: { ...vehiculeDeTest(NAVIRE), ancrages: { belier: BELIER } }, 'belier': ameliorationDeTest('belier', 'ancrages') });
    expect(vueDe(appel('vue')).corps.vehicules[id].ameliorations).toEqual([{ element: 'belier', position: BELIER[0] }]);
  });

  it('sans élément de sa fiche servi, aucune pièce ne se monte', () => {
    servir({ [NAVIRE]: { ...vehiculeDeTest(NAVIRE), postes: { tribord: TRIBORD, proue: PROUE } } });
    expect(vueDe(appel('vue')).corps.vehicules[id].postes).toEqual([]);
  });
});

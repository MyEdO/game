import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { parserSousCatalogue } from './references';
import { catalogueDeTest, type LivreDeTest } from './catalogueDeTest.testkit';
import {
  idDe,
  idsDe,
  recordDIds,
  ref,
  refs,
  refMorte,
  refMorteLocale,
  refusDeLEntree,
  reperesDuParse,
  sousLeLecteur,
  type PorteeLocale,
} from '../grammaire/ref';
import { listeCle, ouvrirPortees } from '../grammaire/collection-cle';
import { CIBLE_D_APPARTENANCE } from '../grammaire/sousListes';
import { schema as schemaDesGroupes } from '../defs/groups';
import { schema as schemaDesNiveaux } from '../defs/careerLevels';
import { licencesDeGuildeSchema } from '../defs/merchants';
import { idDeFixture } from '../../idDeFixture.testkit';
import { catalogueAvec } from '../../catalogueAvec.testkit';
import { catalogueDuProcessus } from '../../catalogueDuProcessus';

const LIVRE = idDeFixture('book', 'livre-de-test');
const GROUPE = 'groupe-du-livre-de-test';
const GROUPE_RELATIF = 'groupe-relatif-du-livre-de-test';
const ARME = 'arme-du-livre-de-test';
const INVENTAIRE = 'inventaire-du-livre-de-test';
const ID_MORT = 'id-mort-du-livre-de-test';

const GROUPES: LivreDeTest['groups.json'] = [
  { id: GROUPE, type: 'groups', label: 'Groupe du livre de test' },
  { id: GROUPE_RELATIF, type: 'groups', label: 'Groupe relatif du livre de test', relatif: 'engagesAvecPorteur' },
];

const GROUPES_D_ARMES: LivreDeTest['weaponGroups.json'] = [
  { id: ARME, type: 'weaponGroups', label: 'Arme du livre de test', kind: 'weapon', combat: 'melee', maniement: 'hampe', rendu: { id: idDeFixture('rendu', 'arme-blanche') }, source: { book: LIVRE, page: 1 } },
  { id: INVENTAIRE, type: 'weaponGroups', label: 'Inventaire du livre de test', kind: 'inventory', source: { book: LIVRE, page: 1 } },
];

const CAT = catalogueDeTest({ 'groups.json': GROUPES, 'weaponGroups.json': GROUPES_D_ARMES });

/** Les fautes d'un parse refusé, en `{ path, message }`. */
function fautes(r: z.ZodSafeParseResult<unknown>) {
  expect(r.success).toBe(false);
  return r.error!.issues.map(({ path, message }) => ({ path, message }));
}

describe('parserSousCatalogue — le parse, chaque id jugé contre le catalogue passé', () => {
  it('accepte une référence vivante du catalogue, absente de l’index des ids', () => {
    const r = parserSousCatalogue(ref('groupe'), { id: GROUPE }, CAT);
    expect(r).toEqual({ success: true, data: { id: GROUPE } });
  });

  it('refuse un id mort, à son path, avec le message de sa feuille', () => {
    expect(fautes(parserSousCatalogue(z.strictObject({ cible: ref('groupe') }), { cible: { id: ID_MORT } }, CAT))).toEqual([
      { path: ['cible', 'id'], message: refMorte('groupe', ID_MORT) },
    ]);
  });

  it('refuse une clé de record morte, au path de la clé', () => {
    expect(fautes(parserSousCatalogue(recordDIds('groupe', z.number()), { [GROUPE]: 1, [ID_MORT]: 2 }, CAT))).toEqual([
      { path: [ID_MORT], message: refMorte('groupe', ID_MORT) },
    ]);
  });

  it('refuse un id hors de sa sous-liste MARQUÉE', () => {
    expect(fautes(parserSousCatalogue(refs('groupe', { sousListe: CIBLE_D_APPARTENANCE }), [GROUPE, GROUPE_RELATIF], CAT))).toEqual([
      { path: [1], message: refusDeLEntree('groupe', CIBLE_D_APPARTENANCE, GROUPES[1]) },
    ]);
  });

  it('refuse un id hors de sa sous-liste DISCRIMINÉE', () => {
    expect(parserSousCatalogue(idDe('weaponGroup', 'weapon'), ARME, CAT).success).toBe(true);
    expect(fautes(parserSousCatalogue(idDe('weaponGroup', 'weapon'), INVENTAIRE, CAT))).toEqual([
      { path: [], message: refusDeLEntree('weaponGroup', 'weapon', { id: INVENTAIRE }) },
    ]);
  });

  it('un VOCABULAIRE du moteur se lit au code, et refuse un id inconnu', () => {
    expect(parserSousCatalogue(idDe('son'), 'arc', catalogueDeTest({})).success).toBe(true);
    expect(fautes(parserSousCatalogue(idDe('son'), ID_MORT, catalogueDeTest({})))).toEqual([{ path: [], message: refMorte('son', ID_MORT) }]);
  });

  it('UNION : la branche qui vaut sous le catalogue est celle que le parse choisit', () => {
    const union = z.union([z.strictObject({ x: idDe('groupe') }), z.strictObject({ x: idDe('weaponGroup') })]);
    expect(parserSousCatalogue(union, { x: GROUPE }, CAT)).toEqual({ success: true, data: { x: GROUPE } });
    expect(parserSousCatalogue(union, { x: ARME }, CAT)).toEqual({ success: true, data: { x: ARME } });
    expect(parserSousCatalogue(union, { x: ID_MORT }, CAT).success).toBe(false);
  });

  it('le lecteur est BORNÉ à l’appel : le parse ordinaire juge encore à l’index, après un parse, une imbrication et une levée', () => {
    const feuille = idDe('groupe');
    expect(parserSousCatalogue(feuille, GROUPE, CAT).success).toBe(true);
    expect(feuille.safeParse(GROUPE).success).toBe(false);
    const vide = catalogueDeTest({ 'groups.json': [] });
    expect(sousLeLecteur(() => new Set([GROUPE]), () => [parserSousCatalogue(feuille, GROUPE, vide).success, feuille.safeParse(GROUPE).success])).toEqual([false, true]);
    const indexe = [...idsDe('groupe')][0];
    expect(() => sousLeLecteur(() => new Set(), () => { throw new Error('levée du livre de test'); })).toThrow('levée du livre de test');
    expect(feuille.safeParse(indexe).success, 'l’id de l’index est admis après la levée').toBe(true);
  });

  it('une faute de FORME reste refusée, à son path', () => {
    expect(fautes(parserSousCatalogue(ref('groupe'), { id: 3 }, CAT)).map((f) => f.path)).toEqual([['id']]);
  });

  it('une entrée et une seconde qui la référence, créées sur une bibliothèque candidate, sont acceptées sans `npm run gen`', () => {
    const candidate: LivreDeTest['groups.json'] = [...GROUPES, { id: 'groupe-composite-du-livre-de-test', type: 'groups', label: 'Composite', inclut: [idDeFixture('groupe', GROUPE)] }];
    expect(schemaDesGroupes.safeParse(candidate).success, 'l’index des ids généré ne connaît pas l’entrée neuve').toBe(false);
    expect(parserSousCatalogue(schemaDesGroupes, candidate, catalogueDeTest({ 'groups.json': candidate })).success).toBe(true);
  });
});

const CARRIERE = 'carriere-du-livre-de-test';
const OBJET = 'objet-du-livre-de-test';
/** Les éléments d'une portée locale du livre de test. */
const ELEMENTS: PorteeLocale = { collection: 'elements', catalogue: 'éléments du livre de test' };

describe('parserSousCatalogue — les lectures d’ids des defs et les décisions de portée suivent le catalogue passé', () => {
  it('`lire.catalogue(…).ids()` d’un def voit une carrière présente SEULEMENT au catalogue', () => {
    const cat = catalogueAvec({ 'careers.json': [{ ...catalogueDuProcessus()['careers.json'][0], id: CARRIERE }] });
    const fautesDeLaCarriere = (r: z.ZodSafeParseResult<unknown>) => (r.success ? [] : r.error.issues.filter((i) => i.message.includes(`« ${CARRIERE} »`)));
    expect(fautesDeLaCarriere(parserSousCatalogue(schemaDesNiveaux, [], cat))).toHaveLength(1);
    expect(fautesDeLaCarriere(schemaDesNiveaux.safeParse([])), 'hors fenêtre, l’index ignore la carrière').toEqual([]);
  });

  it('`lire.catalogue(…).ids()` d’un marchand voit un objet présent SEULEMENT au catalogue', () => {
    const cat = catalogueAvec({ 'trappings.json': [{ ...catalogueDuProcessus()['trappings.json'][0], id: OBJET }] });
    expect(fautes(parserSousCatalogue(licencesDeGuildeSchema, [{ id: OBJET }], cat))).toEqual([
      { path: [0, 'id'], message: `« ${OBJET} » ne désigne pas une licence de Guilde identifiée.` },
    ]);
  });

  it('hors fenêtre, `idsDe` lit l’index ; sous un lecteur, le lecteur', () => {
    expect(idsDe('groupe').has(GROUPE)).toBe(false);
    expect(sousLeLecteur(() => new Set([GROUPE]), () => [...idsDe('groupe')])).toEqual([GROUPE]);
  });

  it('une feuille à `{ portee }` JUGE un id absent de l’index, présent au catalogue : il n’est pas pris pour local', () => {
    const feuille = idDe('groupe', CIBLE_D_APPARTENANCE, { portee: ELEMENTS });
    expect(fautes(parserSousCatalogue(feuille, GROUPE_RELATIF, CAT))).toEqual([{ path: [], message: refusDeLEntree('groupe', CIBLE_D_APPARTENANCE, GROUPES[1]) }]);
  });

  it('l’ouvreur d’une portée laisse au catalogue un id absent de l’index, présent au catalogue', () => {
    const element = z.strictObject({ id: z.string() });
    const ouvert = ouvrirPortees(z.strictObject({ elements: listeCle(element, 'id'), cible: idDe('groupe', undefined, { portee: ELEMENTS }) }), [ELEMENTS]);
    expect(parserSousCatalogue(ouvert, { elements: [], cible: GROUPE }, CAT).success).toBe(true);
    expect(fautes(parserSousCatalogue(ouvert, { elements: [], cible: ID_MORT }, CAT))).toEqual([{ path: ['cible'], message: refMorteLocale(ELEMENTS, ID_MORT) }]);
  });

  it('`recordDIds(…, { portee })` pose le repère d’une clé absente de l’index, présente au lecteur', () => {
    const record = recordDIds('groupe', z.number(), undefined, { portee: ELEMENTS });
    expect(sousLeLecteur(() => new Set([GROUPE]), () => reperesDuParse(record, { [GROUPE]: 1 }))).toEqual([{ path: [GROUPE], type: 'groupe', parCle: true }]);
  });
});

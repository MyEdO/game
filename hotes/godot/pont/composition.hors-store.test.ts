/**
 * LA COMPOSITION D'UN PERSONNAGE SUR UNE BASE (#3086, D2 ; `CONTRAT.md`, section « Composition d'un personnage ») : le
 * Soldat de `catalogues` sur une base sans élément est tout entier manquant, chaque chose nommée par sa clé et par ce qui
 * l'apporte ; un plastron skinné et un accessoire de la base le montent sous la clé de leur ligne au panneau ; le sexe pose `feminin`, un gabarit non neutre change l'échelle de la racine, ses pieds sont ceux des appuis ;
 * le pont sert `composer` après `modeles`, `catalogues` et ses axes, et `presetDeComposition`, l'enveloppe du preset nommé
 * reprise, et refuse en `validation` une composition absente ou fautive, au chemin de la faute, et un preset inconnu.
 */
import { describe, expect, it } from 'vitest';
import { baseDeTest, elementSchema3, glbDElement } from '../asset/modeles.testkit.ts';
import { empreinte } from '../asset/empreinte.ts';
import { cataloguesDeComposition, lireComposition } from '../../../src/noyau/index';
import { tableTotale } from '../../../src/lib/tableTotale';
import presets from '../../../src/data/presets-de-personnage.json';
import { modelesDeLAtelier } from './atelier';
import { composerSurLaBase } from './composition';
import { creerPont } from './pont';

const humanoide = { ...baseDeTest('humanoide'), emplacements: { epaule_d: { os: 'root', position: [0, 0, 0], rotation: [0, 0, 0] } }, appuis: { ...baseDeTest('humanoide').appuis, pieds: ['root'], vitessesAuSol: { Walk_Loop: 1.25 } } };
const plastron = {
  schema: 3, base: 'humanoide', categorie: 'armure', cle: { piece: 'plastron' }, liaison: { mode: 'squelette' }, couche: 'armure', couvre: ['torse'],
  surfaces: [{ nom: 'acier', palette: 'metal' }], glb: empreinte(glbDElement('root', ['acier'])),
};
const broche = { ...elementSchema3('humanoide'), categorie: 'accessoire', cle: { piece: 'baudrier' }, liaison: { mode: 'surface' }, couvre: [] };
const soldat = cataloguesDeComposition().presets.find((p) => p.id === 'soldat')!.composition;

/** `brut` sur la première base de `manifestes`, lu par la seule porte d'une composition (`lireComposition`), comme `composer`. */
const composer = (manifestes: Record<string, unknown>, brut: unknown) => {
  const lu = lireComposition(brut);
  if (!lu.ok) throw new Error(JSON.stringify(lu.fautes));
  const modeles = modelesDeLAtelier(manifestes, tableTotale(Object.keys(manifestes), (id) => (id === 'humanoide' ? [] : ['root'])));
  expect(modeles.refus).toEqual([]);
  return composerSurLaBase(modeles.bases[0], manifestes, lu.composition);
};

describe('composerSurLaBase', () => {
  it('le Soldat sur une base sans élément : tout est manquant, la tenue, ses pièces, les objets par leur ensemble ou leur apparence', () => {
    const { montes, manquants, rapport } = composer({ humanoide }, soldat);
    const tenue = { type: 'tenue', id: 'uniforme-de-soldat' };
    expect(manquants.map(({ ligne, champ, id, par }) => ({ ligne, champ, id, par: par && { type: par.type, id: par.id } }))).toEqual([
      { ligne: 'ligne/tete', champ: 'tete', id: 'humain', par: undefined },
      ...['chemise', 'pourpoint', 'haut-de-chausses', 'bas', 'bottes', 'gants'].map((id) => ({ ligne: `ligne/piece/${id}`, champ: 'piece', id, par: tenue })),
      { ligne: 'ligne/emplacement/genou_g', champ: 'piece', id: 'ruban', par: undefined },
      { ligne: 'ligne/emplacement/poitrine', champ: 'piece', id: 'insigne', par: undefined },
      { ligne: 'ligne/emplacement/epaule_d', champ: 'piece', id: 'baudrier', par: undefined },
      { ligne: 'ligne/emplacement/cimier', champ: 'piece', id: 'plumet', par: undefined },
      { ligne: 'main', champ: 'apparence', id: 'hallebarde', par: { type: 'trapping', id: 'hallebarde' } },
      { ligne: 'ligne/piece/casque', champ: 'piece', id: 'casque', par: { type: 'trapping', id: 'heaume' } },
      { ligne: 'ligne/piece/plastron', champ: 'piece', id: 'plastron', par: { type: 'trapping', id: 'plastron' } },
    ]);
    expect(manquants.every((m) => m.label.length > 0 && (m.par === undefined || m.par.label.length > 0))).toBe(true);
    expect(manquants.find((m) => m.id === 'chemise')?.par?.label).toBe('Uniforme de soldat');
    expect(montes).toEqual(manquants.map(({ ligne }) => ({ ligne, element: null })));
    expect(rapport).toEqual([]);
  });

  it('une pièce et un accessoire de la base montent sous la clé de leur ligne au panneau, et sortent des manquants', () => {
    const { montes, manquants } = composer({ humanoide, plastron, broche }, soldat);
    expect(montes).toContainEqual({ ligne: 'ligne/piece/plastron', element: 'plastron' });
    expect(montes).toContainEqual({ ligne: 'ligne/emplacement/epaule_d', element: 'broche' });
    expect(manquants.map((m) => m.id)).not.toContain('plastron');
    expect(manquants.map((m) => m.id)).not.toContain('baudrier');
  });

  it('le sexe pose `feminin`, `build` absent vaut le corps neutre, un gabarit non neutre change l’échelle de la racine, les pieds sont ceux des appuis', () => {
    const neutre = composer({ humanoide }, soldat);
    expect(neutre.morphes).toEqual({ carrure_moins: 0, carrure_plus: 0, feminin: 1, corpulence: 0 });
    expect(composer({ humanoide }, { ...soldat, sex: 'M' }).morphes.feminin).toBe(0);
    expect(neutre.gabarit.racine).toEqual({ os: 'root', echelle: 1 });
    expect(neutre.gabarit.pieds).toEqual(humanoide.appuis.pieds);
    expect(composer({ humanoide }, { ...soldat, gabarit: { id: 'brute' } }).gabarit.racine.echelle).toBe(1.35);
  });

  it('un objet porté sans ensemble ni rangement va au rapport, sans point', () => {
    const { rapport, manquants } = composer({ humanoide }, { ...soldat, objets: ['plastron', 'cape'] });
    expect(rapport).toEqual(['objet « cape » : ni prise, ni ensemble, ni rangement']);
    expect(manquants.map((m) => m.par?.id)).not.toContain('cape');
  });
});

describe('le pont : composer, catalogues, presetDeComposition', () => {
  const pont = creerPont();
  const appeler = (methode: string, entree?: unknown) => JSON.parse(pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree)));

  it('composer se refuse avant modeles, puis compose sur une base servie', () => {
    expect(appeler('composer', { base: 'humanoide', composition: soldat }).erreur.message).toMatch(/modeles d’abord/);
    appeler('modeles', { manifestes: { humanoide }, osDesRigides: { humanoide: [] } });
    expect(appeler('composer', { base: 'autre', composition: soldat }).erreur.categorie).toBe('validation');
    expect(Object.keys(appeler('composer', { base: 'humanoide', composition: soldat })).sort()).toEqual(['gabarit', 'manquants', 'montes', 'morphes', 'ok', 'rapport']);
  });

  it('catalogues publie chaque champ en `{ id, label }` et ses axes, et presetDeComposition le Soldat sous son preset', () => {
    const catalogues = appeler('catalogues');
    expect(catalogues.presets.map(({ id, label }: { id: string; label: string }) => ({ id, label }))).toEqual([{ id: 'soldat', label: 'Soldat' }]);
    expect(catalogues.prises.map((c: { id: string }) => c.id)).toEqual(['main', 'off']);
    expect(catalogues.axes).toEqual(cataloguesDeComposition().axes);
    const { entree, verdict } = appeler('presetDeComposition', { composition: soldat, preset: 'soldat' });
    expect(verdict).toEqual([]);
    expect(JSON.parse(entree)).toEqual(presets.find((p) => p.id === 'soldat'));
    const sansPreset = appeler('presetDeComposition', { composition: soldat });
    expect(JSON.parse(sansPreset.entree)).toEqual({ type: 'presets-de-personnage', ...soldat });
    expect(sansPreset.verdict.map((f: { chemin: unknown[] }) => f.chemin)).toEqual([['id'], ['label'], ['source']]);
    expect(appeler('presetDeComposition', { composition: soldat, preset: 'inconnu' }).erreur).toEqual({
      categorie: 'validation',
      message: 'presetDeComposition : preset, l’id d’un preset de catalogues (soldat)',
    });
  });

  it('une composition absente ou fautive est refusée en validation, au chemin de la faute', () => {
    const deuxMains = { ...soldat, prises: { main: { id: 'hallebarde' }, off: { id: 'hallebarde' } } };
    expect(appeler('presetDeComposition', {}).erreur).toEqual({ categorie: 'validation', message: expect.stringContaining('presetDeComposition : composition, (racine) : ') });
    expect(appeler('presetDeComposition', { composition: deuxMains }).erreur).toEqual({
      categorie: 'validation',
      message: 'presetDeComposition : composition, prises.off : « hallebarde » est porté deux fois : déjà par la prise main.',
    });
    expect(appeler('composer', { base: 'humanoide', composition: { ...soldat, build: 2 } }).erreur).toEqual({ categorie: 'validation', message: expect.stringMatching(/^composer : composition, build : /) });
    expect(appeler('composer', { base: 'humanoide' }).erreur).toEqual({ categorie: 'validation', message: expect.stringContaining('composer : composition, (racine) : ') });
  });
});

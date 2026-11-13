/**
 * LA COMPOSITION D'UN PERSONNAGE SUR UNE BASE (#3086, D2 ; `CONTRAT.md`, section « Composition d'un personnage ») : le
 * Soldat de `catalogues` sur une base sans élément est tout entier manquant, chaque chose nommée par sa clé et par ce qui
 * l'apporte ; un plastron skinné et un accessoire de la base le montent sous la clé de leur ligne au panneau ; une
 * apparence variante monte son élément, à défaut celui de sa racine ; un élément monté prend la palette de la teinte de sa chose ; le sexe pose `feminin` et choisit le matériau `parSexe` de chaque surface de la base, un gabarit non neutre change l'échelle de la racine, ses pieds sont ceux des appuis ;
 * le pont sert `composer` après `modeles`, `catalogues` et ses axes, et `presetDeComposition`, l'enveloppe du preset nommé
 * reprise, et refuse en `validation` une composition absente ou fautive, au chemin de la faute, et un preset inconnu.
 */
import { describe, expect, it } from 'vitest';
import { baseDeTest, elementSchema3, glbDElement } from '../asset/modeles.testkit.ts';
import { empreinte } from '../asset/empreinte.ts';
import { cataloguesDeComposition, findCouleurById, findTeinteById, lireComposition, porteeDeComposition, SLOTS } from '../../../src/noyau/index';
import { tableTotale } from '../../../src/lib/tableTotale';
import presets from '../../../src/data/presets-de-personnage.json';
import { modelesDeLAtelier } from './atelier';
import { composerSurLaBase } from './composition';
import { creerPont } from './pont';

const humanoide = { ...baseDeTest('humanoide'), emplacements: { epaule_d: { os: 'root', position: [0, 0, 0], rotation: [0, 0, 0] } } };
const plastron = {
  schema: 3, base: 'humanoide', categorie: 'armure', cle: { piece: 'plastron' }, liaison: { mode: 'squelette' }, couche: 'armure', couvre: ['torse'],
  surfaces: [{ nom: 'acier', palette: 'metal' }], glb: empreinte(glbDElement('root', ['acier'])),
};
const broche = { ...elementSchema3('humanoide'), categorie: 'accessoire', cle: { piece: 'baudrier-sur-armure' }, liaison: { mode: 'surface' }, couvre: [] };
const soldat = cataloguesDeComposition().presets.find((p) => p.id === 'soldat')!.composition;

/** `brut` sur la première base de `manifestes`, lu par la seule porte d'une composition (`lireComposition`), comme `composer`. */
const composer = (manifestes: Record<string, unknown>, brut: unknown) => {
  const lu = lireComposition(brut);
  if (!lu.ok) throw new Error(JSON.stringify(lu.fautes));
  const modeles = modelesDeLAtelier(manifestes, tableTotale(Object.keys(manifestes), (id) => (id === 'humanoide' ? [] : ['root'])));
  expect(modeles.refus).toEqual([]);
  return composerSurLaBase(modeles.bases[0], manifestes, porteeDeComposition(lu.valeur));
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
      { ligne: 'ligne/emplacement/epaule_d', champ: 'piece', id: 'baudrier-sur-armure', par: undefined },
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
    expect(manquants.map((m) => m.id)).not.toContain('baudrier-sur-armure');
  });

  it('une variante monte à la ligne de sa pièce (#3446) : l’atelier l’y sert, liste avec la pièce, et la composition l’y choisit', () => {
    const chausses = { ...plastron, categorie: 'vetement', cle: { piece: 'haut-de-chausses' }, couche: 'tenue' };
    const ample = { ...chausses, cle: { piece: 'haut-de-chausses-ample' } };
    const manifestes = { humanoide, chausses, ample };
    const modeles = modelesDeLAtelier(manifestes, tableTotale(Object.keys(manifestes), (id) => (id === 'humanoide' ? [] : ['root'])));
    expect(modeles.bases[0].lignes).toContainEqual(expect.objectContaining({ sorte: 'piece', variantes: true, id: 'haut-de-chausses', elements: ['chausses', 'ample'] }));
    expect(modeles.libelles.ample).toBe('Haut-de-chausses ample');
    expect(composer(manifestes, soldat).montes).toContainEqual({ ligne: 'ligne/piece/haut-de-chausses', element: 'chausses' });
    const varie = composer(manifestes, { ...soldat, variantesPieces: { 'haut-de-chausses': { id: 'haut-de-chausses-ample' } } });
    expect(varie.montes).toContainEqual({ ligne: 'ligne/piece/haut-de-chausses', element: 'ample' });
  });

  it('le sexe pose `feminin`, `build` absent vaut le corps neutre, un gabarit non neutre change l’échelle de la racine, les pieds sont ceux des appuis', () => {
    const neutre = composer({ humanoide }, soldat);
    expect(neutre.morphes).toEqual({ carrure_moins: 0, carrure_plus: 0, feminin: 1, corpulence: 0 });
    expect(composer({ humanoide }, { ...soldat, sex: 'M' }).morphes.feminin).toBe(0);
    expect(neutre.gabarit?.racine).toEqual({ os: 'root', echelle: 1 });
    expect(neutre.gabarit?.pieds).toEqual(humanoide.appuis.pieds);
    expect(composer({ humanoide }, { ...soldat, gabarit: { id: 'brute' } }).gabarit?.racine.echelle).toBe(1.35);
  });

  it('le sexe choisit, par surface de la base, le matériau que nomme son `parSexe` (#3188) ; sans entrée pour ce sexe, aucun', () => {
    const peau = { nom: 'Peau_M', palette: 'peau', parSexe: { F: 'Peau_F' } };
    const parSexe = { ...humanoide, surfaces: [peau, { nom: 'Yeux', palette: 'yeux' }] };
    expect(composer({ humanoide: parSexe }, soldat).materiaux).toEqual({ Peau_M: 'Peau_F' });
    expect(composer({ humanoide: parSexe }, { ...soldat, sex: 'M' }).materiaux).toEqual({});
    expect(composer({ humanoide }, soldat).materiaux).toEqual({});
  });

  it('une apparence variante monte l’élément qui la désigne, à défaut celui de sa racine ; sans l’un ni l’autre, le manquant garde son id', () => {
    const epee = { ...elementSchema3('humanoide'), cle: { apparence: 'epee' } };
    const epeeDeSoldat = { ...elementSchema3('humanoide'), cle: { apparence: 'epee_soldat' } };
    const tenue = { ...soldat, prises: { main: { id: 'arme-simple' } }, apparencesObjets: { 'arme-simple': { id: 'epee_soldat' } } };
    expect(composer({ humanoide, epee }, tenue).montes).toContainEqual({ ligne: 'main', element: 'epee' });
    expect(composer({ humanoide, epee, epeeDeSoldat }, tenue).montes).toContainEqual({ ligne: 'main', element: 'epeeDeSoldat' });
    expect(composer({ humanoide }, tenue).manquants).toContainEqual(expect.objectContaining({ ligne: 'main', champ: 'apparence', id: 'epee_soldat' }));
  });

  it('le deuxième objet rangé au même point se monte sur la ligne `<point>#2`, le premier sur le point', () => {
    const besace = { ...elementSchema3('humanoide'), cle: { apparence: 'besace' } };
    const epee = { ...elementSchema3('humanoide'), cle: { apparence: 'epee' } };
    const tenue = { ...soldat, prises: {}, objets: ['arme-simple', 'besace'], rangementsObjets: { 'arme-simple': { id: 'epaule_d' }, besace: { id: 'epaule_d' } } };
    const { montes, manquants } = composer({ humanoide, besace, epee }, tenue);
    expect(montes.filter((m) => m.ligne.startsWith('epaule_d'))).toEqual([{ ligne: 'epaule_d', element: 'epee' }, { ligne: 'epaule_d#2', element: 'besace' }]);
    expect(manquants.filter((m) => m.ligne.startsWith('epaule_d'))).toEqual([]);
  });

  it('un objet porté sans ensemble ni rangement va au rapport, sans point', () => {
    const { rapport, manquants } = composer({ humanoide }, { ...soldat, objets: ['plastron', 'rocher'] });
    expect(rapport).toEqual(['objet « rocher » : ni prise, ni ensemble, ni rangement']);
    expect(manquants.map((m) => m.par?.id)).not.toContain('rocher');
  });
});

describe('le pont : composer, catalogues, presetDeComposition', () => {
  const pont = creerPont(null, null);
  const appeler = (methode: string, entree?: unknown) => JSON.parse(pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree)));

  it('composer se refuse avant modeles, puis compose sur une base servie', () => {
    expect(appeler('composer', { base: 'humanoide', composition: soldat }).erreur.message).toMatch(/modeles d’abord/);
    appeler('modeles', { manifestes: { humanoide }, osDesRigides: { humanoide: [] } });
    expect(appeler('composer', { base: 'autre', composition: soldat }).erreur.categorie).toBe('validation');
    expect(Object.keys(appeler('composer', { base: 'humanoide', composition: soldat })).sort()).toEqual(['gabarit', 'manquants', 'materiaux', 'montes', 'morphes', 'ok', 'palette', 'rapport']);
  });

  it('un élément monté prend la palette de la teinte de sa chose portée (#3456) ; une chose sans élément, aucune', () => {
    const portee = porteeDeComposition(soldat);
    const teintee = { ...portee, portees: portee.portees.map((p) => (p.cle.id === 'plastron' ? { ...p, teinte: 'aethyrique' } : p)) };
    const modeles = modelesDeLAtelier({ humanoide, plastron }, { humanoide: [], plastron: ['root'] });
    const { montes } = composerSurLaBase(modeles.bases[0], { humanoide, plastron }, teintee);
    expect(montes).toContainEqual({ ligne: 'ligne/piece/plastron', element: 'plastron', palette: findTeinteById('aethyrique')!.palette });
    const sansElement = composerSurLaBase(modeles.bases[0], { humanoide, plastron }, { ...teintee, portees: teintee.portees.map((p) => (p.cle.id === 'casque' ? { ...p, teinte: 'aethyrique' } : p)) });
    expect(sansElement.montes).toContainEqual({ ligne: 'ligne/piece/casque', element: null });
  });

  it('composer publie la palette de la composition, chaque couleur du nuancier résolue en `#rrggbb` ; sans `couleurs`, aucune', () => {
    appeler('modeles', { manifestes: { humanoide }, osDesRigides: { humanoide: [] } });
    const { couleurs: _, ...sansCouleurs } = soldat;
    expect(appeler('composer', { base: 'humanoide', composition: sansCouleurs }).palette).toEqual({});
    const couleurs = { peau: { id: 'peau-halee' }, plume: { id: 'plume-rousse' } };
    expect(appeler('composer', { base: 'humanoide', composition: { ...soldat, couleurs } }).palette).toEqual({ peau: findCouleurById('peau-halee')!.color, plume: findCouleurById('plume-rousse')!.color });
    expect(appeler('composer', { base: 'humanoide', composition: { ...soldat, couleurs: { peau: { id: 'acier-bleu' } } } }).erreur.categorie).toBe('validation');
    expect(appeler('composer', { base: 'humanoide', composition: { ...soldat, couleurs: { or: { id: 'acier' } } } }).erreur.categorie).toBe('validation');
  });

  it('catalogues publie chaque champ en `{ id, label }` et ses axes, et presetDeComposition le Soldat sous son preset', () => {
    const catalogues = appeler('catalogues');
    expect(catalogues.presets.map(({ id, label }: { id: string; label: string }) => ({ id, label }))).toEqual(presets.map(({ id, label }) => ({ id, label })));
    expect(catalogues.prises.map((c: { id: string }) => c.id)).toEqual(['main', 'secondaire']);
    expect(catalogues.couleurs.map((c: { id: string }) => c.id)).toEqual([...SLOTS]);
    expect(catalogues.nuancier).toEqual(cataloguesDeComposition().nuancier);
    expect(catalogues.axes).toEqual(cataloguesDeComposition().axes);
    const { entree, verdict } = appeler('presetDeComposition', { composition: soldat, preset: 'soldat' });
    expect(verdict).toEqual([]);
    expect(JSON.parse(entree)).toEqual(presets.find((p) => p.id === 'soldat'));
    const sansPreset = appeler('presetDeComposition', { composition: soldat });
    expect(JSON.parse(sansPreset.entree)).toEqual({ type: 'presets-de-personnage', ...soldat });
    expect(sansPreset.verdict.map((f: { chemin: unknown[] }) => f.chemin)).toEqual([['id'], ['label'], ['source']]);
    expect(appeler('presetDeComposition', { composition: soldat, preset: 'inconnu' }).erreur).toEqual({
      categorie: 'validation',
      message: `presetDeComposition : preset, l’id d’un preset de catalogues (${presets.map((p) => p.id).join(', ')})`,
    });
  });

  it('publie le défaut d’emblème et donne priorité aux choix manuels, y compris au vide explicite', () => {
    const blasonne = { ...plastron, surfaces: [{ nom: 'acier', palette: 'metal', blason: true }] };
    appeler('modeles', { manifestes: { humanoide, blasonne }, osDesRigides: { humanoide: [], blasonne: [] } });
    const composition = { race: { id: 'humain' }, sex: 'M', tete: { id: 'humain' }, objets: ['plastron'], embleme: { id: 'taureau-rouge' } };
    const entree = { base: 'humanoide', composition };
    const monte = (r: ReturnType<typeof appeler>) => r.montes.find((m: { ligne: string }) => m.ligne === 'ligne/piece/plastron');
    expect(monte(appeler('composer', entree))).toEqual({ ligne: 'ligne/piece/plastron', element: 'blasonne', embleme: { id: 'taureau-rouge' } });
    expect(appeler('composer', { ...entree, emblemes: null }).erreur.categorie).toBe('validation');
    const surcharge = { 'ligne/piece/plastron': { id: 'tete-de-mort-rouge' } };
    expect(monte(appeler('composer', { ...entree, emblemes: surcharge })).embleme).toEqual({ id: 'tete-de-mort-rouge' });
    expect(monte(appeler('composer', { ...entree, emblemes: { 'ligne/piece/plastron': null } }))).toEqual({ ligne: 'ligne/piece/plastron', element: 'blasonne' });
    expect(monte(appeler('composer', { ...entree, composition: { ...composition, embleme: { id: 'tete-de-mort-rouge' } } })).embleme).toEqual({ id: 'tete-de-mort-rouge' });
    expect(appeler('composer', { ...entree, emblemes: { 'ligne/piece/plastron': { id: 'embleme-inconnu' } } }).erreur.categorie).toBe('validation');
    expect(appeler('composer', { ...entree, emblemes: { 'ligne/piece/plastron': { id: 'plastron' } } }).erreur.categorie).toBe('validation');
    expect(appeler('composer', { ...entree, composition: { ...composition, embleme: { id: 'embleme-inconnu' } } }).erreur.categorie).toBe('validation');
  });

  it('une composition absente ou fautive est refusée en validation, au chemin de la faute', () => {
    const deuxMains = { ...soldat, prises: { main: { id: 'hallebarde' }, secondaire: { id: 'hallebarde' } } };
    expect(appeler('presetDeComposition', {}).erreur).toEqual({ categorie: 'validation', message: expect.stringContaining('presetDeComposition : composition, (racine) : ') });
    expect(appeler('presetDeComposition', { composition: deuxMains }).erreur).toEqual({
      categorie: 'validation',
      message: 'presetDeComposition : composition, prises.secondaire : « hallebarde » est porté deux fois : déjà par la prise main.',
    });
    expect(appeler('composer', { base: 'humanoide', composition: { ...soldat, build: 2 } }).erreur).toEqual({ categorie: 'validation', message: expect.stringMatching(/^composer : composition, build : /) });
    expect(appeler('composer', { base: 'humanoide' }).erreur).toEqual({ categorie: 'validation', message: expect.stringContaining('composer : composition, (racine) : ') });
  });
});

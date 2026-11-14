// Le manifeste d'un élément, schéma 3 (#2972) : un manifeste valide par catégorie, un refus nommé par code.
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  baseDeTest,
  elementSchema3,
  GLB_AU_POSTE,
  GLB_DE_BASE,
  GLB_D_ELEMENT,
  GLB_SANS_BASE,
  glbANoeuds,
  glbDElement,
  vehiculeDeTest,
} from './modeles.testkit.ts';
import { empreinte } from './empreinte.ts';
import {
  CATEGORIES_D_ELEMENT,
  emplacementsNonOfferts,
  estSansBase,
  REGLES_DES_CATEGORIES,
  validerElement,
  type BaseDUnElement,
  type CategorieDElement,
  type CodeDEcartDElement,
} from './element.ts';
import { ecrireGlb, lireGlb } from './glb.ts';

const BASE: BaseDUnElement = {
  base: 'humanoide',
  os: ['root', 'pelvis', 'spine_01', 'hand_r', 'jupe_avant_01'],
  chaines: { jupe: ['jupe_avant_01'] },
  zones: ['torse', 'bras_haut', 'hanches', 'cuisses', 'tete'],
  silhouettes: ['feminin', 'corpulence', 'carrure_moins', 'carrure_plus'],
  prises: { main: { os: 'hand_r', position: [0, 0.09, 0], rotation: [0, 0, 0] }, secondaire: { os: 'hand_l', position: [0, 0.09, 0], rotation: [0, 0, 0] } },
};

/** Les matériaux du GLB de test, un par surface que nomment les manifestes de ce fichier. */
const MATERIAUX = ['tissu', 'cuir', 'plaque', 'poil', 'peau'];
const glbAvec = (os: string | null, sansUv: readonly string[] = []) => glbDElement(os, MATERIAUX, sansUv);
const OCTETS = glbAvec('hand_r');
/** Le GLB dont le mesh reste à la racine de la scène, celui d'un élément sans base. */
const A_LA_RACINE = glbAvec(null);
const GLB = empreinte(OCTETS);
const PALETTE = [{ nom: 'tissu', palette: 'vet1' }];
const METAL = [{ nom: 'plaque', palette: 'metal' }];
/** La prise de la main libre d'une arme à deux mains, 40 cm sous la première le long du manche. */
const SECONDE_PRISE = { position: [0, -0.4, 0], rotation: [0, Math.PI, 0] };

/** Un manifeste valide par catégorie. */
const VALIDES: Record<CategorieDElement, Record<string, unknown>> = {
  corps: { categorie: 'corps', cle: { partie: 'jambes', forme: 'chevre' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['cuisses'], surfaces: PALETTE },
  tete: { categorie: 'tete', cle: { tete: 'humain' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['tete'], silhouettes: ['feminin'], surfaces: PALETTE },
  pilosite: { categorie: 'pilosite', cle: { coiffure: 'crane-rase' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: [], surfaces: [{ nom: 'poil', palette: 'cheveux' }] },
  vetement: {
    categorie: 'vetement', cle: { piece: 'pourpoint' }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: ['torse', 'bras_haut', 'hanches', 'cuisses'], chaines: ['jupe'],
    emplacements: { ceinture_avant: { os: 'spine_01', position: [0, 0.04, 0.13], rotation: [0, 0, 0] } }, silhouettes: ['feminin', 'corpulence'],
    surfaces: [{ nom: 'tissu', palette: 'vet1' }, { nom: 'cuir', palette: 'cuir' }],
  },
  armure: {
    categorie: 'armure', cle: { piece: 'plastron' }, liaison: { mode: 'squelette' }, couche: 'armure', couvre: ['torse'],
    emplacements: { poitrine: { os: 'spine_01', position: [0, 0.12, 0.14], rotation: [0, 0, 0] } }, silhouettes: ['feminin'], surfaces: METAL,
  },
  accessoire: {
    categorie: 'accessoire', cle: { piece: 'baudrier' }, liaison: { mode: 'surface' }, couche: 'tenue', surfaces: METAL,
    emplacements: { bandouliere: { os: 'spine_01', position: [0, 0.1, 0.12], rotation: [0, 0, 0] }, 'bandouliere#2': { os: 'spine_01', position: [0, 0.05, 0.12], rotation: [0, 0, 0], poids: { spine_01: 0.7, pelvis: 0.3 } } },
  },
  rigide: { categorie: 'rigide', cle: { apparence: 'epee' }, liaison: { mode: 'rigide' }, surfaces: METAL },
  trait: { categorie: 'trait', cle: { trait: 'verrues' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['torse'], surfaces: [{ nom: 'peau', palette: 'peau' }] },
  decor: { categorie: 'decor', cle: { prop: 'tonneau' }, liaison: { mode: 'rigide' }, surfaces: METAL },
  vehicule: {
    categorie: 'vehicule', cle: { definition: 'caraque' }, liaison: { mode: 'rigide' }, postes: { tribord: [[-3, 1.95, 4], [-3, 1.95, 2]], proue: [[1.2, 5.6, 13.3]] },
    ancrages: { 'figure-de-proue': [[0, 4, 17]], ancre: [[-2, 3, 14], [2, 3, 14]] }, surfaces: METAL,
  },
  amelioration: { categorie: 'amelioration', cle: { amelioration: 'figure-de-proue' }, liaison: { mode: 'rigide' }, montage: 'ancrages', surfaces: METAL },
};

const aUneBase = (categorie: CategorieDElement) => REGLES_DES_CATEGORIES[categorie].base;
const manifeste = (categorie: CategorieDElement, surcharge: Record<string, unknown> = {}, octets = aUneBase(categorie) ? OCTETS : A_LA_RACINE) =>
  ({ schema: 3, ...(aUneBase(categorie) ? { base: 'humanoide' } : {}), ...VALIDES[categorie], glb: empreinte(octets), ...surcharge });
/** Le verdict de `brut` contre `BASE`, ou seul s'il est sans base, comme `validerModele`. */
const verdict = (brut: unknown, octets = estSansBase(brut) ? A_LA_RACINE : OCTETS) => validerElement(brut, estSansBase(brut) ? null : BASE, octets, lireGlb(octets));
/** Le manifeste de `categorie` pour le GLB `octets`, suivi de ces octets. */
const surGlb = (categorie: CategorieDElement, surcharge: Record<string, unknown>, octets: Uint8Array) => [manifeste(categorie, surcharge, octets), octets] as const;
const codes = (brut: unknown, octets = estSansBase(brut) ? A_LA_RACINE : OCTETS) => {
  const v = verdict(brut, octets);
  return v.ok ? [] : v.ecarts.map((e) => e.code);
};

describe('validerElement : un manifeste valide par catégorie', () => {
  it('la table couvre toutes les catégories', () => expect(Object.keys(VALIDES).sort()).toEqual([...CATEGORIES_D_ELEMENT].sort()));
  it.each(CATEGORIES_D_ELEMENT)('%s', (categorie) => {
    expect(verdict(manifeste(categorie))).toEqual({ ok: true, manifeste: manifeste(categorie) });
  });
  it.each([['armure', 'plaque', 'metal'], ['vetement', 'tissu', 'vet1']] as const)('une surface d’un élément `%s` déclare `blason: true` en option', (categorie, nom, palette) => {
    const blason = manifeste(categorie, { surfaces: [{ nom, palette, blason: true }] });
    expect(verdict(blason)).toEqual({ ok: true, manifeste: blason });
  });
  it('un véhicule dit en option l’emprise libre des cases de ses ponts que son modèle rogne', () => {
    const rogne = manifeste('vehicule', { cases: { '4,1,0': [4.075, 1.45, 5, 2], '9,2,2': [9, 2, 9.375, 3] } });
    expect(verdict(rogne)).toEqual({ ok: true, manifeste: rogne });
  });
  it('un rigide tenu déclare en option la prise de sa main libre', () => {
    const deuxMains = manifeste('rigide', { liaison: { mode: 'rigide', secondePrise: SECONDE_PRISE } });
    expect(verdict(deuxMains)).toEqual({ ok: true, manifeste: deuxMains });
  });
  it('une surface d’élément déclare en option la matière de décor du monde dont elle s’habille', () => {
    const matiere = manifeste('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', matiere: 'prop--fer-noirci' }] });
    expect(verdict(matiere)).toEqual({ ok: true, manifeste: matiere });
  });
});

describe('validerElement : les surfaces se lisent sur tout nœud à mesh, pas seulement le mesh pendu', () => {
  const plaque = glbDElement('hand_r', ['tissu'], [], { garde: [{ materiau: 'plaque', uv: true }] });
  it('un matériau porté par un second nœud à mesh est une surface du GLB', () => {
    const blason = manifeste('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', blason: true }] }, plaque);
    expect(verdict(blason, plaque)).toEqual({ ok: true, manifeste: blason });
  });
  it('une primitive sans `TEXCOORD_0` sous un second nœud à mesh refuse l’emblème', () => {
    const octets = glbDElement('hand_r', MATERIAUX, [], { garde: [{ materiau: 'plaque', uv: false }] });
    expect(codes(...surGlb('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', blason: true }] }, octets))).toEqual(['uv-absente']);
  });
});

/** Un refus par code : le manifeste fautif, ses octets s'ils diffèrent d'`OCTETS`, et le seul code attendu. */
const REFUS: [CodeDEcartDElement, string, unknown, Uint8Array?][] = [
  ['forme', 'le manifeste n’est pas un objet', []],
  ['forme', '`couvre` requis manquant', manifeste('vetement', { couvre: undefined })],
  ['forme', 'liaison sans `mode`', manifeste('rigide', { liaison: 'rigide' })],
  ['forme', 'seconde prise sans triplet', manifeste('rigide', { liaison: { mode: 'rigide', secondePrise: { position: [0, -0.4], rotation: [0, 0, 0] } } })],
  ['forme', 'seconde prise à champ en trop', manifeste('rigide', { liaison: { mode: 'rigide', secondePrise: { ...SECONDE_PRISE, os: 'hand_l' } } })],
  ['forme', 'seconde prise d’un décor', manifeste('decor', { liaison: { mode: 'rigide', secondePrise: SECONDE_PRISE } })],
  ['forme', 'emplacement sans triplet', manifeste('vetement', { emplacements: { dos: { os: 'spine_01', position: [0, 0], rotation: [0, 0, 0] } } })],
  ['forme', 'surface nommée deux fois', manifeste('rigide', { surfaces: [...METAL, ...METAL] })],
  ['forme', 'empreinte du GLB mal formée', manifeste('rigide', { glb: { sha256: 'xyz', octets: 1 } })],
  ['glb-different', 'empreinte différente des octets livrés', manifeste('rigide', { glb: { ...GLB, sha256: 'a'.repeat(64) } })],
  ['glb-different', 'taille différente des octets livrés', manifeste('rigide', { glb: { ...GLB, octets: GLB.octets + 1 } })],
  ['version-inconnue', 'schéma 2', manifeste('rigide', { schema: 2 })],
  ['categorie-inconnue', 'catégorie `arme`', manifeste('rigide', { categorie: 'arme' })],
  ['champ-hors-categorie', 'un id choisi', manifeste('rigide', { id: 'epee-01' })],
  ['champ-hors-categorie', '`couvre` sur un rigide', manifeste('rigide', { couvre: ['torse'] })],
  ['champ-hors-categorie', '`emplacements` sur un rigide', manifeste('rigide', { emplacements: {} })],
  ['cle-mal-formee', 'clé d’une autre catégorie', manifeste('rigide', { cle: { piece: 'epee' } })],
  ['cle-mal-formee', 'clé de corps sans `forme`', manifeste('corps', { cle: { partie: 'jambes' } })],
  ['cle-mal-formee', 'clé à champ en trop', manifeste('rigide', { cle: { apparence: 'epee', piece: 'epee' } })],
  ['cle-mal-formee', 'id vide', manifeste('tete', { cle: { tete: '' } })],
  ['cle-inconnue', 'pièce absente de la garde-robe', manifeste('vetement', { cle: { piece: 'robe-de-bure' } })],
  ['cle-inconnue', 'tête absente de la garde-robe', manifeste('tete', { cle: { tete: 'humain-m-1' } })],
  ['cle-inconnue', 'coiffure absente de la garde-robe', manifeste('pilosite', { cle: { coiffure: 'tonsure' } })],
  ['cle-inconnue', 'apparence absente du jeu', manifeste('rigide', { cle: { apparence: 'epee-de-verre' } })],
  ['piece-hors-categorie', 'armure qui vise un vêtement', manifeste('armure', { cle: { piece: 'pourpoint' } })],
  ['piece-hors-categorie', 'vêtement qui vise la variante d’une armure', manifeste('vetement', { cle: { piece: 'casque-a-cornes' } })],
  ['base-differente', 'élément construit pour une autre base', manifeste('rigide', { base: 'quadrupede' })],
  ['liaison-hors-categorie', 'vêtement en surface', manifeste('vetement', { liaison: { mode: 'surface' } })],
  ['liaison-hors-categorie', 'mode inconnu', manifeste('accessoire', { liaison: { mode: 'colle' } })],
  ['couche-hors-categorie', 'couche inconnue', manifeste('vetement', { couche: 'cuirasse' })],
  ['couche-hors-categorie', 'armure hors de la couche `armure`', manifeste('armure', { couche: 'tenue' })],
  ['zone-inconnue', '`couvre` hors des zones de la base', manifeste('vetement', { couvre: ['torse', 'queue'] })],
  ['chaine-absente', 'chaîne que la base ne porte pas', manifeste('vetement', { chaines: ['cape'] })],
  ['emplacement-sur-os-absent', 'emplacement sur un os inconnu', manifeste('vetement', { emplacements: { cimier: { os: 'chapeau', position: [0, 0, 0], rotation: [0, 0, 0] } } })],
  ['emplacement-inconnu', 'emplacement absent de la garde-robe', manifeste('armure', { emplacements: { nombril: { os: 'spine_01', position: [0, 0, 0], rotation: [0, 0, 0] } } })],
  ['emplacement-inconnu', 'case d’un emplacement absent de la garde-robe', manifeste('accessoire', { emplacements: { 'nombril#2': { os: 'spine_01', position: [0, 0, 0], rotation: [0, 0, 0] } } })],
  ['emplacement-sur-os-absent', 'emplacement qui suit un os inconnu', manifeste('accessoire', { emplacements: { dos: { os: 'spine_01', position: [0, 0, 0], rotation: [0, 0, 0], poids: { spine_01: 0.5, chapeau: 0.5 } } } })],
  ['forme', 'poids de somme autre que 1', manifeste('accessoire', { emplacements: { dos: { os: 'spine_01', position: [0, 0, 0], rotation: [0, 0, 0], poids: { spine_01: 0.5, pelvis: 0.3 } } } })],
  ['forme', 'poids sans l’os de l’emplacement', manifeste('accessoire', { emplacements: { dos: { os: 'spine_01', position: [0, 0, 0], rotation: [0, 0, 0], poids: { pelvis: 1 } } } })],
  ['forme', 'case de rang 1, que l’emplacement nomme seul', manifeste('accessoire', { emplacements: { 'dos#1': { os: 'spine_01', position: [0, 0, 0], rotation: [0, 0, 0] } } })],
  ['silhouette-absente', 'shape key que la base ne porte pas', manifeste('tete', { silhouettes: ['visage_inverse'] })],
  ['champ-hors-categorie', '`postes` sur un décor', manifeste('decor', { postes: {} })],
  ['forme', 'poste sans triplet', manifeste('vehicule', { postes: { babord: [[3, 1.95]] } })],
  ['bord-inconnu', 'poste à un bord qui n’en est pas un', manifeste('vehicule', { postes: { flanc: [[3, 1.95, 0]] } })],
  ['champ-hors-categorie', '`ancrages` sur un décor', manifeste('decor', { ancrages: {} })],
  ['champ-hors-categorie', '`montage` sur un véhicule', manifeste('vehicule', { montage: 'ancrages' })],
  ['forme', 'ancrage sans triplet', manifeste('vehicule', { ancrages: { ancre: [[3, 1.95]] } })],
  ['cle-inconnue', 'ancrage d’un Trait naval, qui n’est pas une Amélioration', manifeste('vehicule', { ancrages: { robuste: [[0, 0, 0]] } })],
  ['cle-inconnue', 'pièce d’un Trait naval, qui n’est pas une Amélioration', manifeste('amelioration', { cle: { amelioration: 'robuste' } })],
  ['forme', 'pièce d’Amélioration sans `montage`', manifeste('amelioration', { montage: undefined })],
  ['forme', 'montage inconnu', manifeste('amelioration', { montage: 'coque' })],
  ['etat-absent', 'pièce montée aux postes sans ses nœuds `ouvert` et `ferme`', manifeste('amelioration', { cle: { amelioration: 'sabord' }, montage: 'postes' })],
  ['champ-hors-categorie', '`selon` sur un décor', manifeste('decor', { selon: {} })],
  ['cle-inconnue', '`selon` d’un Trait naval, qui n’est pas une Amélioration', manifeste('vehicule', { selon: { robuste: {} } })],
  ['forme', '`postes` au `selon` d’une pièce d’Amélioration, qui n’offre pas de postes', manifeste('amelioration', { selon: { sabord: { postes: {} } } })],
  ['bord-inconnu', 'poste d’une Amélioration à un bord qui n’en est pas un', manifeste('vehicule', { selon: { sabord: { postes: { flanc: [[3, 0.3, 0]] } } } })],
  ['champ-hors-categorie', '`clips` sur un décor', manifeste('decor', { clips: { repos: 'repos' } })],
  ['forme', 'clip qui n’est pas un nom', manifeste('vehicule', { clips: { tir: 3 } })],
  ['champ-hors-categorie', '`cases` sur un décor', manifeste('decor', { cases: {} })],
  ['forme', 'emprise de case hors de sa case', manifeste('vehicule', { cases: { '4,1,0': [4.5, 1.5, 5.25, 2] } })],
  ['forme', 'emprise de case retournée', manifeste('vehicule', { cases: { '4,1,0': [4.6, 1.5, 4.4, 2] } })],
  ['forme', 'emprise sous une clé qui n’est pas une case', manifeste('vehicule', { cases: { '4,1': [4.5, 1.5, 5, 2] } })],
  ['selon-absent', 'nœud `sans-sabord` sans `selon.sabord`', ...surGlb('vehicule', { surfaces: [{ nom: 'metal', palette: 'metal' }] }, glbANoeuds(['coque', 'sans-sabord']))],
  ['forme', 'surface sans emplacement de palette', manifeste('rigide', { surfaces: [{ nom: 'plaque', teinte: true }] })],
  ['palette-inconnue', 'clé de palette inconnue', manifeste('trait', { surfaces: [{ nom: 'peau', palette: 'or' }] })],
  ['forme', 'blason autre que `true`', manifeste('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', blason: false }] })],
  ['forme', 'matériau par sexe sur un élément', manifeste('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', parSexe: { F: 'plaque' } }] })],
  ['forme', 'matière qui n’est pas un nom', manifeste('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', matiere: 3 }] })],
  ['matiere-inconnue', 'matière hors des matières de décor du monde', manifeste('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', matiere: 'terrain--planches' }] })],
  ['forme', 'blason sans emplacement de palette', manifeste('armure', { surfaces: [{ nom: 'plaque', blason: true }] })],
  ['surface-absente', 'surface qu’aucun matériau du GLB ne nomme', manifeste('rigide', { surfaces: [{ nom: 'bois', palette: 'bois' }] })],
  ['uv-absente', 'blason sur une surface sans `TEXCOORD_0`', ...surGlb('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', blason: true }] }, glbAvec('hand_r', ['plaque']))],
  ['uv-absente', 'blason sur une surface dont une primitive sur deux a `TEXCOORD_0`', ...surGlb('armure', { surfaces: [{ nom: 'plaque', palette: 'metal', blason: true }] }, glbDElement('hand_r', MATERIAUX, [], { mixtes: ['plaque'] }))],
  ['rigide-sans-mesh', 'rigide sans mesh', ...surGlb('rigide', { surfaces: [] }, GLB_DE_BASE)],
  ['rigide-sur-os-absent', 'rigide pendu à un os inconnu de la base', ...surGlb('rigide', {}, glbAvec('main_gauche'))],
  ['rigide-a-la-racine', 'rigide à la racine', ...surGlb('rigide', {}, glbAvec(null))],
  ['rigide-a-la-racine', 'accessoire rigide à la racine', ...surGlb('accessoire', { liaison: { mode: 'rigide' } }, glbAvec(null))],
  ['rigide-a-la-racine', 'second mesh à la racine d’un rigide', ...surGlb('rigide', {}, glbDElement('hand_r', MATERIAUX, [], { garde: [{ materiau: 'plaque', uv: true }] }))],
  ['seconde-prise-sans-prise', 'seconde prise d’un rigide qui ne pend à l’os d’aucune prise', ...surGlb('rigide', { liaison: { mode: 'rigide', secondePrise: SECONDE_PRISE } }, glbAvec('pelvis'))],
  ['rigide-skinne', 'mesh skinné dans un rigide', ...surGlb('rigide', {}, glbDElement('hand_r', MATERIAUX, [], { garde: [{ materiau: 'plaque', uv: true }], skinne: true }))],
];

describe('validerElement : chaque refus nommé', () => {
  it('chaque code a son cas', () => {
    const attendus: Record<CodeDEcartDElement, true> = {
      forme: true, 'version-inconnue': true, 'categorie-inconnue': true, 'champ-hors-categorie': true, 'cle-mal-formee': true, 'cle-inconnue': true, 'piece-hors-categorie': true, 'base-differente': true,
      'liaison-hors-categorie': true, 'couche-hors-categorie': true, 'zone-inconnue': true, 'chaine-absente': true, 'emplacement-sur-os-absent': true, 'emplacement-inconnu': true,
      'silhouette-absente': true, 'bord-inconnu': true, 'etat-absent': true, 'selon-absent': true, 'matiere-inconnue': true, 'palette-inconnue': true, 'surface-absente': true, 'uv-absente': true, 'glb-different': true,
      'rigide-sans-mesh': true, 'rigide-sur-os-absent': true, 'rigide-a-la-racine': true, 'rigide-skinne': true,
      'seconde-prise-sans-prise': true,
    };
    expect(new Set(REFUS.map(([code]) => code))).toEqual(new Set(Object.keys(attendus)));
  });
  it.each(REFUS)('%s : %s', (code, _cas, brut, octets) => expect(codes(brut, octets)).toEqual([code]));
});

describe('emplacementsNonOfferts : un accessoire se pose sur un emplacement de sa base ou d’une pièce de cette base', () => {
  const REPERE = { os: 'spine_01', position: [0, 0, 0], rotation: [0, 0, 0] };
  const bases = new Map([['humanoide', { emplacements: { epaule_d: REPERE } }]]);
  const plumet = { id: 'plumet', brut: manifeste('accessoire', { cle: { piece: 'plumet' } }) };
  const casque = (emplacements: Record<string, unknown>) => ({ id: 'casque', brut: manifeste('armure', { cle: { piece: 'casque' }, emplacements }) });
  it('l’emplacement offert par la base suffit', () => expect(emplacementsNonOfferts(bases, [{ id: 'baudrier', brut: manifeste('accessoire') }])).toEqual([]));
  it('l’emplacement offert par une armure de la même base suffit', () => expect(emplacementsNonOfferts(bases, [casque({ cimier: REPERE }), plumet])).toEqual([]));
  it('un emplacement que ni la base ni aucune pièce n’offre sort au rapport', () => {
    expect(emplacementsNonOfferts(bases, [casque({}), plumet])).toEqual([{ id: 'plumet', ligne: '[emplacement-non-offert] plumet : plumet se pose sur cimier, que ni la base `humanoide` ni aucune de ses pièces n’offre' }]);
  });
  it('une pièce d’une autre base n’offre rien', () => {
    expect(emplacementsNonOfferts(bases, [{ id: 'casque', brut: { ...casque({ cimier: REPERE }).brut, base: 'quadrupede' } }, plumet])).toHaveLength(1);
  });
});

describe('validerElement : un mesh rigide se monte sous un os de la base', () => {
  it('un rigide pendu à un os inconnu de la base est refusé, le mesh et l’os nommés', () => {
    expect(verdict(...surGlb('rigide', {}, glbAvec('main_gauche')))).toEqual({
      ok: false, ecarts: [{ code: 'rigide-sur-os-absent', ou: 'liaison.mode', detail: 'lame pend à main_gauche, qui n’est pas un os de la base `humanoide`' }],
    });
  });
  it('un rigide à la racine est refusé, le mesh nommé', () => {
    expect(verdict(...surGlb('rigide', {}, glbAvec(null)))).toEqual({
      ok: false, ecarts: [{ code: 'rigide-a-la-racine', ou: 'liaison.mode', detail: 'lame ne pend directement à aucune articulation d’un skin : un élément `rigide` ne reste pas à la racine de la scène' }],
    });
  });
  it('un mesh skinné est refusé sous son nom', () => {
    expect(verdict(...surGlb('rigide', {}, glbDElement('hand_r', MATERIAUX, [], { garde: [{ materiau: 'plaque', uv: true }], skinne: true })))).toEqual({
      ok: false, ecarts: [{ code: 'rigide-skinne', ou: 'liaison.mode', detail: 'garde porte un skin : un élément en liaison `rigide` ne monte que des meshes sans skin' }],
    });
  });
  /** Le GLB dont le mesh `lame` pend à l'articulation sans nom du nœud 0. */
  const SOUS_ARTICULATION_SANS_NOM = ecrireGlb({
    asset: { version: '2.0' }, nodes: [{ children: [1] }, { name: 'lame', mesh: 0 }], skins: [{ joints: [0] }],
    meshes: [{ primitives: [{ material: 0, attributes: { TEXCOORD_0: 0 } }] }], materials: [{ name: 'plaque' }],
  }, null);
  it('un rigide pendu à une articulation sans nom est refusé, même quand la base a un os au libellé de ce nœud', () => {
    const octets = SOUS_ARTICULATION_SANS_NOM;
    expect(validerElement(manifeste('rigide', {}, octets), { ...BASE, os: [...BASE.os, 'noeud 0'] }, octets, lireGlb(octets))).toEqual({
      ok: false, ecarts: [{ code: 'rigide-sur-os-absent', ou: 'liaison.mode', detail: 'lame pend à l’articulation sans nom noeud 0, qui n’est pas un os de la base `humanoide`' }],
    });
  });
});

describe('validerElement : un décor ou un véhicule n’a pas de base (#2987)', () => {
  it.each(['decor', 'vehicule'] as const)('un `%s` garde son mesh à la racine', (categorie) => {
    expect(verdict(manifeste(categorie)).ok).toBe(true);
  });
  it.each(['decor', 'vehicule'] as const)('un `%s` qui nomme une base est refusé', (categorie) => {
    expect(codes(manifeste(categorie, { base: 'humanoide' }))).toEqual(['champ-hors-categorie']);
  });
  it.each(['decor', 'vehicule'] as const)('un `%s` dont un mesh pend à une articulation est refusé, faute de base', (categorie) => {
    expect(verdict(...surGlb(categorie, {}, glbAvec('hand_r')))).toEqual({
      ok: false, ecarts: [{ code: 'rigide-sur-os-absent', ou: 'liaison.mode', detail: `lame pend à hand_r, mais un élément \`${categorie}\` n’a pas de base dont il serait un os` }],
    });
  });
  it.each(['caraque', 'barge', 'canon-petit', 'trebuchet-ade2'])('la `definition` %s, coque ou engin de siège, se résout', (definition) => {
    expect(verdict(manifeste('vehicule', { cle: { definition } })).ok).toBe(true);
  });
  it.each(['carrosse', 'cheval-de-monte'])('la `definition` %s, qui n’est ni coque ni engin de siège, est refusée', (definition) => {
    expect(verdict(manifeste('vehicule', { cle: { definition } }))).toEqual({
      ok: false, ecarts: [{ code: 'cle-inconnue', ou: 'cle.definition', detail: `${definition} n’est aucune coque de \`vehicles.json\` ni engin \`armes-de-siege\` de \`trappings.json\`` }],
    });
  });
});

describe('validerElement : une pièce d’Amélioration navale (#2987)', () => {
  it('montée aux postes, elle porte un nœud à mesh par état', () => {
    const sabord = manifeste('amelioration', { cle: { amelioration: 'sabord' }, montage: 'postes', surfaces: [{ nom: 'metal', palette: 'metal' }] }, GLB_AU_POSTE);
    expect(verdict(sabord, GLB_AU_POSTE)).toEqual({ ok: true, manifeste: sabord });
  });
  it('sans ses états, les absents sont nommés', () => {
    expect(verdict(manifeste('amelioration', { cle: { amelioration: 'sabord' }, montage: 'postes' }))).toEqual({
      ok: false, ecarts: [{ code: 'etat-absent', ou: 'montage', detail: 'une pièce montée aux postes porte un nœud à mesh par état, `ouvert`, `ferme` : `ouvert`, `ferme` absent du GLB' }],
    });
  });
});

describe('validerElement : ce qui change selon une Amélioration (#2987)', () => {
  const GLB = glbANoeuds(['coque', 'avec-sabord', 'sans-sabord']);
  const SURFACES = [{ nom: 'metal', palette: 'metal' }];
  it('un véhicule nomme à son `selon` l’Amélioration de ses nœuds `avec-` et `sans-`, et les postes qu’elle offre', () => {
    const caraque = manifeste('vehicule', { surfaces: SURFACES, selon: { sabord: { postes: { babord: [[4, 0.3, 4]] } } } }, GLB);
    expect(verdict(caraque, GLB)).toEqual({ ok: true, manifeste: caraque });
  });
  it('une pièce d’Amélioration, ses seuls nœuds', () => {
    const blindage = manifeste('amelioration', { cle: { amelioration: 'blindage-fer' }, surfaces: SURFACES, selon: { sabord: {} } }, GLB);
    expect(verdict(blindage, GLB)).toEqual({ ok: true, manifeste: blindage });
  });
  it('chaque nœud dont le `selon` ne nomme pas l’Amélioration est nommé', () => {
    expect(verdict(manifeste('vehicule', { surfaces: SURFACES }, GLB), GLB)).toEqual({
      ok: false, ecarts: ['avec-sabord', 'sans-sabord'].map((nom) => ({ code: 'selon-absent', ou: 'selon', detail: `${nom} change selon \`sabord\`, que \`selon\` ne nomme pas` })),
    });
  });
});

describe('CLI godot:valider : base validée avant l’élément', () => {
  const dossiers: string[] = [];
  afterEach(() => dossiers.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })));
  const vetement = (piece: string) => ({
    ...elementSchema3(), categorie: 'vetement', cle: { piece }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: [], surfaces: [{ nom: 'metal', palette: 'vet1' }],
  });
  const tete = (id: string) => ({
    ...elementSchema3(), categorie: 'tete', cle: { tete: id }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: [], surfaces: [{ nom: 'metal', palette: 'peau' }],
  });
  const pilosite = (coiffure: string) => ({
    ...elementSchema3(), categorie: 'pilosite', cle: { coiffure }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: [], surfaces: [{ nom: 'metal', palette: 'cheveux' }],
  });
  it.each(['valide', 'vetement', 'tete', 'tete-monstrueuse', 'pilosite', 'os-inconnu', 'glb-different', 'base-absente', 'forme', 'chemin-absolu', 'cle-inconnue', 'cle-inconnue-tete', 'cle-inconnue-tete-monstrueuse'] as const)('%s', cas => {
    const d = mkdtempSync(join(tmpdir(), 'element-cli-'));
    dossiers.push(d);
    const base = baseDeTest();
    if (cas === 'os-inconnu') base.os = ['absent'];
    if (cas === 'glb-different') base.glb.sha256 = 'a'.repeat(64);
    writeFileSync(join(d, 'base.manifeste.json'), JSON.stringify(base));
    if (cas !== 'base-absente') writeFileSync(join(d, 'base.glb'), GLB_DE_BASE);
    const element = cas === 'forme' ? { ...elementSchema3(), surfaces: undefined }
      : cas === 'chemin-absolu' ? { ...elementSchema3(), surfaces: [{ nom: 'C:\\Users\\x\\metal.png', palette: 'metal' }] }
      : cas === 'vetement' ? vetement('pourpoint') : cas === 'cle-inconnue' ? vetement('robe-de-bure')
      : cas === 'tete' ? tete('humain') : cas === 'cle-inconnue-tete' ? tete('humain-m-1')
      : cas === 'tete-monstrueuse' ? tete('skaven') : cas === 'cle-inconnue-tete-monstrueuse' ? tete('rat')
      : cas === 'pilosite' ? pilosite('crane-rase') : elementSchema3();
    writeFileSync(join(d, 'element.json'), JSON.stringify(element));
    writeFileSync(join(d, 'element.glb'), GLB_D_ELEMENT);
    const r = spawnSync(process.execPath, ['hotes/godot/asset/valider.mjs', join(d, 'element.json'), join(d, 'base.manifeste.json'), join(d, 'element.glb')], { encoding: 'utf8', timeout: 60000 });
    expect(r.error).toBeUndefined();
    const accepte = cas === 'valide' || cas === 'vetement' || cas === 'tete' || cas === 'tete-monstrueuse' || cas === 'pilosite';
    expect(r.status, r.stderr + r.stdout).toBe(accepte ? 0 : 1);
    if (cas === 'cle-inconnue') expect(r.stdout + r.stderr).toContain('[cle-inconnue] cle.piece : robe-de-bure');
    else if (cas === 'cle-inconnue-tete') expect(r.stdout + r.stderr).toContain('[cle-inconnue] cle.tete : humain-m-1');
    else if (cas === 'cle-inconnue-tete-monstrueuse') expect(r.stdout + r.stderr).toContain('[cle-inconnue] cle.tete : rat');
    else if (!accepte) expect(r.stdout + r.stderr).toContain(cas === 'base-absente' ? 'glb-de-base-absent' : cas);
  }, 65000);
  it.each([['vehicule', 0], ['vehicule-avec-base', 1]] as const)('%s : un élément sans base se valide sans manifeste de base', (cas, statut) => {
    const d = mkdtempSync(join(tmpdir(), 'element-cli-'));
    dossiers.push(d);
    writeFileSync(join(d, 'element.json'), JSON.stringify(cas === 'vehicule' ? vehiculeDeTest() : { ...vehiculeDeTest(), base: 'humanoide' }));
    writeFileSync(join(d, 'element.glb'), GLB_SANS_BASE);
    const r = spawnSync(process.execPath, ['hotes/godot/asset/valider.mjs', join(d, 'element.json'), join(d, 'element.glb')], { encoding: 'utf8', timeout: 60000 });
    expect(r.status, r.stderr + r.stdout).toBe(statut);
    if (statut) expect(r.stdout).toContain('[champ-hors-categorie] base');
  }, 65000);
});

// Le manifeste d'un élément, schéma 3 (#2972) : un manifeste valide par catégorie, un refus nommé par code.
import { describe, expect, it } from 'vitest';
import { CATEGORIES_D_ELEMENT, validerElement, type BaseDUnElement, type CategorieDElement, type CodeDEcartDElement } from './element.ts';

const BASE: BaseDUnElement = {
  base: 'humanoide',
  os: ['root', 'pelvis', 'spine_01', 'hand_r', 'jupe_avant_01'],
  chaines: { jupe: ['jupe_avant_01'] },
  zones: ['torse', 'bras_haut', 'hanches', 'cuisses', 'tete'],
  silhouettes: ['feminin', 'corpulence', 'carrure_moins', 'carrure_plus'],
};

const GLB = { sha256: 'a'.repeat(64), octets: 1024 };
const PALETTE = [{ nom: 'tissu', palette: 'vet1' }];
const TEINTE = [{ nom: 'plaque', teinte: true }];

/** Un manifeste valide par catégorie. */
const VALIDES: Record<CategorieDElement, Record<string, unknown>> = {
  corps: { categorie: 'corps', cle: { partie: 'jambes', forme: 'chevre' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['cuisses'], surfaces: PALETTE },
  tete: { categorie: 'tete', cle: { tete: 'humain-m-1' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['tete'], silhouettes: ['feminin'], surfaces: PALETTE },
  pilosite: { categorie: 'pilosite', cle: { coiffure: 'tonsure' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: [], surfaces: [{ nom: 'poil', palette: 'cheveux' }] },
  vetement: {
    categorie: 'vetement', cle: { piece: 'robe-de-bure' }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: ['torse', 'bras_haut', 'hanches', 'cuisses'], chaines: ['jupe'],
    emplacements: { ceinture_avant: { os: 'spine_01', position: [0, 0.04, 0.13], rotation: [0, 0, 0] } }, silhouettes: ['feminin', 'corpulence'],
    surfaces: [{ nom: 'tissu', palette: 'vet1' }, { nom: 'cuir', palette: 'cuir' }],
  },
  armure: { categorie: 'armure', cle: { piece: 'plastron-de-plates' }, liaison: { mode: 'squelette' }, couche: 'armure', couvre: ['torse'], silhouettes: ['feminin'], surfaces: TEINTE },
  accessoire: { categorie: 'accessoire', cle: { piece: 'bandouliere' }, liaison: { mode: 'surface' }, couche: 'tenue', surfaces: TEINTE },
  rigide: { categorie: 'rigide', cle: { apparence: 'epee' }, liaison: { mode: 'rigide' }, surfaces: TEINTE },
  trait: { categorie: 'trait', cle: { trait: 'verrues' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['torse'], surfaces: [{ nom: 'peau', palette: 'peau' }] },
  decor: { categorie: 'decor', cle: { prop: 'tonneau' }, liaison: { mode: 'rigide' }, surfaces: TEINTE },
  vehicule: { categorie: 'vehicule', cle: { definition: 'carrosse' }, liaison: { mode: 'rigide' }, surfaces: TEINTE },
};

const manifeste = (categorie: CategorieDElement, surcharge: Record<string, unknown> = {}) => ({ schema: 3, base: 'humanoide', ...VALIDES[categorie], glb: GLB, ...surcharge });
const codes = (brut: unknown) => {
  const v = validerElement(brut, BASE);
  return v.ok ? [] : v.ecarts.map((e) => e.code);
};

describe('validerElement : un manifeste valide par catégorie', () => {
  it('la table couvre toutes les catégories', () => expect(Object.keys(VALIDES).sort()).toEqual([...CATEGORIES_D_ELEMENT].sort()));
  it.each(CATEGORIES_D_ELEMENT)('%s', (categorie) => {
    expect(validerElement(manifeste(categorie), BASE)).toEqual({ ok: true, manifeste: manifeste(categorie) });
  });
});

/** Un refus par code : le manifeste fautif et le seul code attendu. */
const REFUS: [CodeDEcartDElement, string, unknown][] = [
  ['forme', 'le manifeste n’est pas un objet', []],
  ['forme', '`couvre` requis manquant', manifeste('vetement', { couvre: undefined })],
  ['forme', 'liaison sans `mode`', manifeste('rigide', { liaison: 'rigide' })],
  ['forme', 'emplacement sans triplet', manifeste('vetement', { emplacements: { dos: { os: 'spine_01', position: [0, 0], rotation: [0, 0, 0] } } })],
  ['forme', 'surface nommée deux fois', manifeste('rigide', { surfaces: [...TEINTE, ...TEINTE] })],
  ['forme', 'empreinte du GLB mal formée', manifeste('rigide', { glb: { sha256: 'xyz', octets: 1 } })],
  ['version-inconnue', 'schéma 2', manifeste('rigide', { schema: 2 })],
  ['categorie-inconnue', 'catégorie `arme`', manifeste('rigide', { categorie: 'arme' })],
  ['champ-hors-categorie', 'un id choisi', manifeste('rigide', { id: 'epee-01' })],
  ['champ-hors-categorie', '`couvre` sur un rigide', manifeste('rigide', { couvre: ['torse'] })],
  ['champ-hors-categorie', '`emplacements` sur une armure', manifeste('armure', { emplacements: {} })],
  ['cle-mal-formee', 'clé d’une autre catégorie', manifeste('rigide', { cle: { piece: 'epee' } })],
  ['cle-mal-formee', 'clé de corps sans `forme`', manifeste('corps', { cle: { partie: 'jambes' } })],
  ['cle-mal-formee', 'clé à champ en trop', manifeste('rigide', { cle: { apparence: 'epee', piece: 'epee' } })],
  ['cle-mal-formee', 'id vide',manifeste('tete', { cle: { tete: '' } })],
  ['base-differente', 'élément construit pour une autre base', manifeste('rigide', { base: 'quadrupede' })],
  ['liaison-hors-categorie', 'vêtement en surface', manifeste('vetement', { liaison: { mode: 'surface' } })],
  ['liaison-hors-categorie', 'mode inconnu', manifeste('accessoire', { liaison: { mode: 'colle' } })],
  ['couche-hors-categorie', 'couche inconnue', manifeste('vetement', { couche: 'cuirasse' })],
  ['couche-hors-categorie', 'armure hors de la couche `armure`', manifeste('armure', { couche: 'tenue' })],
  ['zone-inconnue', '`couvre` hors des zones de la base', manifeste('vetement', { couvre: ['torse', 'queue'] })],
  ['chaine-absente', 'chaîne que la base ne porte pas', manifeste('vetement', { chaines: ['cape'] })],
  ['emplacement-sur-os-absent', 'emplacement sur un os inconnu', manifeste('vetement', { emplacements: { plumet: { os: 'chapeau', position: [0, 0, 0], rotation: [0, 0, 0] } } })],
  ['silhouette-absente', 'shape key que la base ne porte pas', manifeste('tete', { silhouettes: ['visage_inverse'] })],
  ['surface-hors-categorie', 'teinte sur un vêtement', manifeste('vetement', { surfaces: TEINTE })],
  ['surface-hors-categorie', 'palette sur un rigide', manifeste('rigide', { surfaces: PALETTE })],
  ['palette-inconnue', 'clé de palette inconnue', manifeste('trait', { surfaces: [{ nom: 'peau', palette: 'or' }] })],
];

describe('validerElement : chaque refus nommé', () => {
  it('chaque code a son cas', () => {
    const attendus: Record<CodeDEcartDElement, true> = {
      forme: true, 'version-inconnue': true, 'categorie-inconnue': true, 'champ-hors-categorie': true, 'cle-mal-formee': true, 'base-differente': true,
      'liaison-hors-categorie': true, 'couche-hors-categorie': true, 'zone-inconnue': true, 'chaine-absente': true, 'emplacement-sur-os-absent': true,
      'silhouette-absente': true, 'surface-hors-categorie': true, 'palette-inconnue': true,
    };
    expect(new Set(REFUS.map(([code]) => code))).toEqual(new Set(Object.keys(attendus)));
  });
  it.each(REFUS)('%s : %s', (code, _cas, brut) => expect(codes(brut)).toEqual([code]));
});

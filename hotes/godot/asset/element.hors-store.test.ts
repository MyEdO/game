// Le manifeste d'un élément, schéma 3 (#2972) : un manifeste valide par catégorie, un refus nommé par code.
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseDeTest, elementSchema3, GLB_DE_BASE, GLB_D_ELEMENT, glbDElement } from './modeles.testkit.ts';
import { empreinte } from './empreinte.ts';
import { CATEGORIES_D_ELEMENT, emplacementsNonOfferts, validerElement, type BaseDUnElement, type CategorieDElement, type CodeDEcartDElement } from './element.ts';
import { ecrireGlb, lireGlb } from './glb.ts';

const BASE: BaseDUnElement = {
  base: 'humanoide',
  os: ['root', 'pelvis', 'spine_01', 'hand_r', 'jupe_avant_01'],
  chaines: { jupe: ['jupe_avant_01'] },
  zones: ['torse', 'bras_haut', 'hanches', 'cuisses', 'tete'],
  silhouettes: ['feminin', 'corpulence', 'carrure_moins', 'carrure_plus'],
};

/** Les matériaux du GLB de test, un par surface que nomment les manifestes de ce fichier. */
const MATERIAUX = ['tissu', 'cuir', 'plaque', 'poil', 'peau'];
const glbAvec = (os: string | null, sansUv: readonly string[] = []) => glbDElement(os, MATERIAUX, sansUv);
const OCTETS = glbAvec('hand_r');
const GLB = empreinte(OCTETS);
const PALETTE = [{ nom: 'tissu', palette: 'vet1' }];
const TEINTE = [{ nom: 'plaque', teinte: true }];

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
    emplacements: { poitrine: { os: 'spine_01', position: [0, 0.12, 0.14], rotation: [0, 0, 0] } }, silhouettes: ['feminin'], surfaces: TEINTE,
  },
  accessoire: { categorie: 'accessoire', cle: { piece: 'baudrier' }, liaison: { mode: 'surface' }, couche: 'tenue', surfaces: TEINTE },
  rigide: { categorie: 'rigide', cle: { apparence: 'epee' }, liaison: { mode: 'rigide' }, surfaces: TEINTE },
  trait: { categorie: 'trait', cle: { trait: 'verrues' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['torse'], surfaces: [{ nom: 'peau', palette: 'peau' }] },
  decor: { categorie: 'decor', cle: { prop: 'tonneau' }, liaison: { mode: 'rigide' }, surfaces: TEINTE },
  vehicule: { categorie: 'vehicule', cle: { definition: 'carrosse' }, liaison: { mode: 'rigide' }, surfaces: TEINTE },
};

const manifeste = (categorie: CategorieDElement, surcharge: Record<string, unknown> = {}, octets = OCTETS) => ({ schema: 3, base: 'humanoide', ...VALIDES[categorie], glb: empreinte(octets), ...surcharge });
const verdict = (brut: unknown, octets = OCTETS) => validerElement(brut, BASE, octets, lireGlb(octets));
/** Le manifeste de `categorie` pour le GLB `octets`, suivi de ces octets. */
const surGlb = (categorie: CategorieDElement, surcharge: Record<string, unknown>, octets: Uint8Array) => [manifeste(categorie, surcharge, octets), octets] as const;
/** Le GLB dont le nœud 1 pend à l'articulation `hand_r` (nœud 0) et le nœud 2 reste à la racine, chacun à mesh `plaque`. */
const glbADeuxMeshes = (pendu: Record<string, unknown>, racine: Record<string, unknown>) => ecrireGlb({
  asset: { version: '2.0' }, nodes: [{ name: 'hand_r', children: [1] }, { ...pendu, mesh: 0 }, { ...racine, mesh: 1 }], skins: [{ joints: [0] }],
  meshes: [0, 1].map(() => ({ primitives: [{ material: 0, attributes: { TEXCOORD_0: 0 } }] })), materials: [{ name: 'plaque' }],
}, null);
/** Deux nœuds nommés `lame`, le second à la racine. */
const LAME_EN_DOUBLE = glbADeuxMeshes({ name: 'lame' }, { name: 'lame' });
/** Un nœud nommé `noeud 2` pendu, le nœud 2 sans nom à la racine. */
const NOM_DU_LIBELLE = glbADeuxMeshes({ name: 'noeud 2' }, {});
const codes = (brut: unknown, octets = OCTETS) => {
  const v = verdict(brut, octets);
  return v.ok ? [] : v.ecarts.map((e) => e.code);
};

describe('validerElement : un manifeste valide par catégorie', () => {
  it('la table couvre toutes les catégories', () => expect(Object.keys(VALIDES).sort()).toEqual([...CATEGORIES_D_ELEMENT].sort()));
  it.each(CATEGORIES_D_ELEMENT)('%s', (categorie) => {
    expect(verdict(manifeste(categorie))).toEqual({ ok: true, manifeste: manifeste(categorie) });
  });
  it('une surface déclare `blason: true` en option', () => {
    const blason = manifeste('armure', { surfaces: [{ nom: 'plaque', teinte: true, blason: true }] });
    expect(verdict(blason)).toEqual({ ok: true, manifeste: blason });
  });
  it('une surface à palette déclare `blason: true` en option', () => {
    const blason = manifeste('vetement', { surfaces: [{ nom: 'tissu', palette: 'vet1', blason: true }] });
    expect(verdict(blason)).toEqual({ ok: true, manifeste: blason });
  });
});

describe('validerElement : les surfaces se lisent sur tout nœud à mesh, nommé ou non', () => {
  const plaque = glbDElement('hand_r', ['tissu'], [], { anonyme: [{ materiau: 'plaque', uv: true }] });
  it('un matériau porté par un nœud sans nom est une surface du GLB', () => {
    const blason = manifeste('armure', { surfaces: [{ nom: 'plaque', teinte: true, blason: true }] }, plaque);
    expect(verdict(blason, plaque)).toEqual({ ok: true, manifeste: blason });
  });
  it('une primitive sans `TEXCOORD_0` sous un nœud sans nom refuse l’emblème', () => {
    const octets = glbDElement('hand_r', MATERIAUX, [], { anonyme: [{ materiau: 'plaque', uv: false }] });
    expect(codes(...surGlb('armure', { surfaces: [{ nom: 'plaque', teinte: true, blason: true }] }, octets))).toEqual(['uv-absente']);
  });
});

/** Un refus par code : le manifeste fautif, ses octets s'ils diffèrent d'`OCTETS`, et le seul code attendu. */
const REFUS: [CodeDEcartDElement, string, unknown, Uint8Array?][] = [
  ['forme', 'le manifeste n’est pas un objet', []],
  ['forme', '`couvre` requis manquant', manifeste('vetement', { couvre: undefined })],
  ['forme', 'liaison sans `mode`', manifeste('rigide', { liaison: 'rigide' })],
  ['forme', 'emplacement sans triplet', manifeste('vetement', { emplacements: { dos: { os: 'spine_01', position: [0, 0], rotation: [0, 0, 0] } } })],
  ['forme', 'surface nommée deux fois', manifeste('rigide', { surfaces: [...TEINTE, ...TEINTE] })],
  ['forme', 'empreinte du GLB mal formée', manifeste('rigide', { glb: { sha256: 'xyz', octets: 1 } })],
  ['glb-different', 'empreinte différente des octets livrés', manifeste('rigide', { glb: { ...GLB, sha256: 'a'.repeat(64) } })],
  ['glb-different', 'taille différente des octets livrés', manifeste('rigide', { glb: { ...GLB, octets: GLB.octets + 1 } })],
  ['version-inconnue', 'schéma 2', manifeste('rigide', { schema: 2 })],
  ['categorie-inconnue', 'catégorie `arme`', manifeste('rigide', { categorie: 'arme' })],
  ['champ-hors-categorie', 'un id choisi', manifeste('rigide', { id: 'epee-01' })],
  ['champ-hors-categorie', '`couvre` sur un rigide', manifeste('rigide', { couvre: ['torse'] })],
  ['champ-hors-categorie', '`emplacements` sur un accessoire', manifeste('accessoire', { emplacements: {} })],
  ['cle-mal-formee', 'clé d’une autre catégorie', manifeste('rigide', { cle: { piece: 'epee' } })],
  ['cle-mal-formee', 'clé de corps sans `forme`', manifeste('corps', { cle: { partie: 'jambes' } })],
  ['cle-mal-formee', 'clé à champ en trop', manifeste('rigide', { cle: { apparence: 'epee', piece: 'epee' } })],
  ['cle-mal-formee', 'id vide', manifeste('tete', { cle: { tete: '' } })],
  ['cle-inconnue', 'pièce absente de la garde-robe', manifeste('vetement', { cle: { piece: 'robe-de-bure' } })],
  ['cle-inconnue', 'tête absente de la garde-robe', manifeste('tete', { cle: { tete: 'humain-m-1' } })],
  ['cle-inconnue', 'coiffure absente de la garde-robe', manifeste('pilosite', { cle: { coiffure: 'tonsure' } })],
  ['cle-inconnue', 'apparence absente du jeu', manifeste('rigide', { cle: { apparence: 'epee-de-verre' } })],
  ['piece-hors-categorie', 'armure qui vise un vêtement', manifeste('armure', { cle: { piece: 'pourpoint' } })],
  ['base-differente', 'élément construit pour une autre base', manifeste('rigide', { base: 'quadrupede' })],
  ['liaison-hors-categorie', 'vêtement en surface', manifeste('vetement', { liaison: { mode: 'surface' } })],
  ['liaison-hors-categorie', 'mode inconnu', manifeste('accessoire', { liaison: { mode: 'colle' } })],
  ['couche-hors-categorie', 'couche inconnue', manifeste('vetement', { couche: 'cuirasse' })],
  ['couche-hors-categorie', 'armure hors de la couche `armure`', manifeste('armure', { couche: 'tenue' })],
  ['zone-inconnue', '`couvre` hors des zones de la base', manifeste('vetement', { couvre: ['torse', 'queue'] })],
  ['chaine-absente', 'chaîne que la base ne porte pas', manifeste('vetement', { chaines: ['cape'] })],
  ['emplacement-sur-os-absent', 'emplacement sur un os inconnu', manifeste('vetement', { emplacements: { cimier: { os: 'chapeau', position: [0, 0, 0], rotation: [0, 0, 0] } } })],
  ['emplacement-inconnu', 'emplacement absent de la garde-robe', manifeste('armure', { emplacements: { nombril: { os: 'spine_01', position: [0, 0, 0], rotation: [0, 0, 0] } } })],
  ['silhouette-absente', 'shape key que la base ne porte pas', manifeste('tete', { silhouettes: ['visage_inverse'] })],
  ['surface-hors-categorie', 'teinte sur un vêtement', manifeste('vetement', { surfaces: TEINTE })],
  ['surface-hors-categorie', 'palette sur un rigide', manifeste('rigide', { surfaces: PALETTE })],
  ['palette-inconnue', 'clé de palette inconnue', manifeste('trait', { surfaces: [{ nom: 'peau', palette: 'or' }] })],
  ['forme', 'blason autre que `true`', manifeste('armure', { surfaces: [{ nom: 'plaque', teinte: true, blason: false }] })],
  ['forme', 'blason sans couleur', manifeste('armure', { surfaces: [{ nom: 'plaque', blason: true }] })],
  ['surface-absente', 'surface qu’aucun matériau du GLB ne nomme', manifeste('rigide', { surfaces: [{ nom: 'bois', teinte: true }] })],
  ['uv-absente', 'blason sur une surface sans `TEXCOORD_0`', ...surGlb('armure', { surfaces: [{ nom: 'plaque', teinte: true, blason: true }] }, glbAvec('hand_r', ['plaque']))],
  ['uv-absente', 'blason sur une surface dont une primitive sur deux a `TEXCOORD_0`', ...surGlb('armure', { surfaces: [{ nom: 'plaque', teinte: true, blason: true }] }, glbDElement('hand_r', MATERIAUX, [], { mixtes: ['plaque'] }))],
  ['rigide-sans-mesh', 'rigide sans mesh', ...surGlb('rigide', { surfaces: [] }, GLB_DE_BASE)],
  ['rigide-sur-os-absent', 'rigide pendu à un os inconnu de la base', ...surGlb('rigide', {}, glbAvec('main_gauche'))],
  ['rigide-a-la-racine', 'rigide à la racine', ...surGlb('rigide', {}, glbAvec(null))],
  ['rigide-a-la-racine', 'accessoire rigide à la racine', ...surGlb('accessoire', { liaison: { mode: 'rigide' } }, glbAvec(null))],
  ['rigide-a-la-racine', 'mesh sans nom à la racine d’un rigide', ...surGlb('rigide', {}, glbDElement('hand_r', MATERIAUX, [], { anonyme: [{ materiau: 'plaque', uv: true }] }))],
  ['rigide-a-la-racine', 'mesh à la racine au nom d’un mesh pendu', ...surGlb('rigide', {}, LAME_EN_DOUBLE)],
  ['rigide-a-la-racine', 'mesh sans nom à la racine dont le libellé nomme un mesh pendu', ...surGlb('rigide', {}, NOM_DU_LIBELLE)],
  ['rigide-skinne', 'mesh skinné dans un rigide', ...surGlb('rigide', {}, glbDElement('hand_r', MATERIAUX, [], { anonyme: [{ materiau: 'plaque', uv: true }], skinne: true }))],
];

describe('validerElement : chaque refus nommé', () => {
  it('chaque code a son cas', () => {
    const attendus: Record<CodeDEcartDElement, true> = {
      forme: true, 'version-inconnue': true, 'categorie-inconnue': true, 'champ-hors-categorie': true, 'cle-mal-formee': true, 'cle-inconnue': true, 'piece-hors-categorie': true, 'base-differente': true,
      'liaison-hors-categorie': true, 'couche-hors-categorie': true, 'zone-inconnue': true, 'chaine-absente': true, 'emplacement-sur-os-absent': true, 'emplacement-inconnu': true,
      'silhouette-absente': true, 'surface-hors-categorie': true, 'palette-inconnue': true, 'surface-absente': true, 'uv-absente': true, 'glb-different': true,
      'rigide-sans-mesh': true, 'rigide-sur-os-absent': true, 'rigide-a-la-racine': true, 'rigide-skinne': true,
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
  it('un mesh sans nom se nomme par son index', () => {
    expect(verdict(...surGlb('rigide', {}, glbDElement('hand_r', MATERIAUX, [], { anonyme: [{ materiau: 'plaque', uv: true }], skinne: true })))).toEqual({
      ok: false, ecarts: [{ code: 'rigide-skinne', ou: 'liaison.mode', detail: 'noeud 2 porte un skin : un élément en liaison `rigide` ne monte que des meshes sans skin' }],
    });
  });
  it.each(['decor', 'vehicule'] as const)('un `%s` garde son mesh à la racine', (categorie) => {
    expect(verdict(...surGlb(categorie, {}, glbAvec(null))).ok).toBe(true);
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
  it.each(['valide', 'vetement', 'tete', 'pilosite', 'os-inconnu', 'glb-different', 'base-absente', 'forme', 'chemin-absolu', 'cle-inconnue', 'cle-inconnue-tete'] as const)('%s', cas => {
    const d = mkdtempSync(join(tmpdir(), 'element-cli-'));
    dossiers.push(d);
    const base = baseDeTest();
    if (cas === 'os-inconnu') base.os = ['absent'];
    if (cas === 'glb-different') base.glb.sha256 = 'a'.repeat(64);
    writeFileSync(join(d, 'base.manifeste.json'), JSON.stringify(base));
    if (cas !== 'base-absente') writeFileSync(join(d, 'base.glb'), GLB_DE_BASE);
    const element = cas === 'forme' ? { ...elementSchema3(), surfaces: undefined }
      : cas === 'chemin-absolu' ? { ...elementSchema3(), surfaces: [{ nom: 'C:\\Users\\x\\metal.png', teinte: true }] }
      : cas === 'vetement' ? vetement('pourpoint') : cas === 'cle-inconnue' ? vetement('robe-de-bure')
      : cas === 'tete' ? tete('humain') : cas === 'cle-inconnue-tete' ? tete('humain-m-1')
      : cas === 'pilosite' ? pilosite('crane-rase') : elementSchema3();
    writeFileSync(join(d, 'element.json'), JSON.stringify(element));
    writeFileSync(join(d, 'element.glb'), GLB_D_ELEMENT);
    const r = spawnSync(process.execPath, ['hotes/godot/asset/valider.mjs', join(d, 'element.json'), join(d, 'base.manifeste.json'), join(d, 'element.glb')], { encoding: 'utf8', timeout: 60000 });
    expect(r.error).toBeUndefined();
    const accepte = cas === 'valide' || cas === 'vetement' || cas === 'tete' || cas === 'pilosite';
    expect(r.status, r.stderr + r.stdout).toBe(accepte ? 0 : 1);
    if (cas === 'cle-inconnue') expect(r.stdout + r.stderr).toContain('[cle-inconnue] cle.piece : robe-de-bure');
    else if (cas === 'cle-inconnue-tete') expect(r.stdout + r.stderr).toContain('[cle-inconnue] cle.tete : humain-m-1');
    else if (!accepte) expect(r.stdout + r.stderr).toContain(cas === 'base-absente' ? 'glb-de-base-absent' : cas);
  }, 65000);
});

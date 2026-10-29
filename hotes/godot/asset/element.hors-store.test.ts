// Le manifeste d'un élément, schéma 3 (#2972) : un manifeste valide par catégorie, un refus nommé par code.
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { baseSchema3, elementSchema3, GLB_DE_BASE, GLB_D_ELEMENT, glbDElement } from './schema3.testkit.ts';
import { CATEGORIES_D_ELEMENT, validerElement, type BaseDUnElement, type CategorieDElement, type CodeDEcartDElement } from './element.ts';
import { sha256 } from './empreinte.ts';
import { lireGlb } from './glb.ts';

const BASE: BaseDUnElement = {
  base: 'humanoide',
  os: ['root', 'pelvis', 'spine_01', 'hand_r', 'jupe_avant_01'],
  chaines: { jupe: ['jupe_avant_01'] },
  zones: ['torse', 'bras_haut', 'hanches', 'cuisses', 'tete'],
  silhouettes: ['feminin', 'corpulence', 'carrure_moins', 'carrure_plus'],
};

const OCTETS = glbDElement('hand_r');
const empreinte = (octets: Uint8Array) => ({ sha256: sha256(octets), octets: octets.byteLength });
const GLB = empreinte(OCTETS);
const PALETTE = [{ nom: 'tissu', palette: 'vet1' }];
const TEINTE = [{ nom: 'plaque', teinte: true }];

/** Un manifeste valide par catégorie. */
const VALIDES: Record<CategorieDElement, Record<string, unknown>> = {
  corps: { categorie: 'corps', cle: { partie: 'jambes', forme: 'chevre' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['cuisses'], surfaces: PALETTE },
  tete: { categorie: 'tete', cle: { tete: 'humain-m-1' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: ['tete'], silhouettes: ['feminin'], surfaces: PALETTE },
  pilosite: { categorie: 'pilosite', cle: { coiffure: 'tonsure' }, liaison: { mode: 'squelette' }, couche: 'peau', couvre: [], surfaces: [{ nom: 'poil', palette: 'cheveux' }] },
  vetement: {
    categorie: 'vetement', cle: { piece: 'pourpoint' }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: ['torse', 'bras_haut', 'hanches', 'cuisses'], chaines: ['jupe'],
    emplacements: { ceinture_avant: { os: 'spine_01', position: [0, 0.04, 0.13], rotation: [0, 0, 0] } }, silhouettes: ['feminin', 'corpulence'],
    surfaces: [{ nom: 'tissu', palette: 'vet1' }, { nom: 'cuir', palette: 'cuir' }],
  },
  armure: { categorie: 'armure', cle: { piece: 'plastron' }, liaison: { mode: 'squelette' }, couche: 'armure', couvre: ['torse'], silhouettes: ['feminin'], surfaces: TEINTE },
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
const codes = (brut: unknown, octets = OCTETS) => {
  const v = verdict(brut, octets);
  return v.ok ? [] : v.ecarts.map((e) => e.code);
};

describe('validerElement : un manifeste valide par catégorie', () => {
  it('la table couvre toutes les catégories', () => expect(Object.keys(VALIDES).sort()).toEqual([...CATEGORIES_D_ELEMENT].sort()));
  it.each(CATEGORIES_D_ELEMENT)('%s', (categorie) => {
    expect(verdict(manifeste(categorie))).toEqual({ ok: true, manifeste: manifeste(categorie) });
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
  ['champ-hors-categorie', '`emplacements` sur une armure', manifeste('armure', { emplacements: {} })],
  ['cle-mal-formee', 'clé d’une autre catégorie', manifeste('rigide', { cle: { piece: 'epee' } })],
  ['cle-mal-formee', 'clé de corps sans `forme`', manifeste('corps', { cle: { partie: 'jambes' } })],
  ['cle-mal-formee', 'clé à champ en trop', manifeste('rigide', { cle: { apparence: 'epee', piece: 'epee' } })],
  ['cle-mal-formee', 'id vide', manifeste('tete', { cle: { tete: '' } })],
  ['cle-inconnue', 'pièce absente de la garde-robe', manifeste('vetement', { cle: { piece: 'robe-de-bure' } })],
  ['cle-inconnue', 'apparence absente du jeu', manifeste('rigide', { cle: { apparence: 'epee-de-verre' } })],
  ['piece-hors-categorie', 'armure qui vise un vêtement', manifeste('armure', { cle: { piece: 'pourpoint' } })],
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
  ['rigide-sans-mesh', 'rigide sans mesh', ...surGlb('rigide', {}, GLB_DE_BASE)],
  ['rigide-sur-os-absent', 'rigide pendu à un os inconnu de la base', ...surGlb('rigide', {}, glbDElement('main_gauche'))],
  ['rigide-a-la-racine', 'rigide à la racine', ...surGlb('rigide', {}, glbDElement(null))],
  ['rigide-a-la-racine', 'accessoire rigide à la racine', ...surGlb('accessoire', { liaison: { mode: 'rigide' } }, glbDElement(null))],
];

describe('validerElement : chaque refus nommé', () => {
  it('chaque code a son cas', () => {
    const attendus: Record<CodeDEcartDElement, true> = {
      forme: true, 'version-inconnue': true, 'categorie-inconnue': true, 'champ-hors-categorie': true, 'cle-mal-formee': true, 'cle-inconnue': true, 'piece-hors-categorie': true, 'base-differente': true,
      'liaison-hors-categorie': true, 'couche-hors-categorie': true, 'zone-inconnue': true, 'chaine-absente': true, 'emplacement-sur-os-absent': true,
      'silhouette-absente': true, 'surface-hors-categorie': true, 'palette-inconnue': true, 'glb-different': true,
      'rigide-sans-mesh': true, 'rigide-sur-os-absent': true, 'rigide-a-la-racine': true,
    };
    expect(new Set(REFUS.map(([code]) => code))).toEqual(new Set(Object.keys(attendus)));
  });
  it.each(REFUS)('%s : %s', (code, _cas, brut, octets) => expect(codes(brut, octets)).toEqual([code]));
});

describe('validerElement : un mesh rigide se monte sous un os de la base', () => {
  it('un rigide pendu à un os inconnu de la base est refusé, le mesh et l’os nommés', () => {
    expect(verdict(...surGlb('rigide', {}, glbDElement('main_gauche')))).toEqual({
      ok: false, ecarts: [{ code: 'rigide-sur-os-absent', ou: 'liaison.mode', detail: 'lame pend à main_gauche, qui n’est pas un os de la base `humanoide`' }],
    });
  });
  it('un rigide à la racine est refusé, le mesh nommé', () => {
    expect(verdict(...surGlb('rigide', {}, glbDElement(null)))).toEqual({
      ok: false, ecarts: [{ code: 'rigide-a-la-racine', ou: 'liaison.mode', detail: 'lame ne pend directement à aucune articulation d’un skin : un élément `rigide` ne reste pas à la racine de la scène' }],
    });
  });
  it.each(['decor', 'vehicule'] as const)('un `%s` garde son mesh à la racine', (categorie) => {
    expect(verdict(...surGlb(categorie, {}, glbDElement(null))).ok).toBe(true);
  });
});

describe('CLI godot:valider : base validée avant l’élément', () => {
  const dossiers: string[] = [];
  afterEach(() => dossiers.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })));
  const vetement = (piece: string) => ({
    ...elementSchema3(), categorie: 'vetement', cle: { piece }, liaison: { mode: 'squelette' }, couche: 'tenue', couvre: [], surfaces: [{ nom: 'metal', palette: 'vet1' }],
  });
  it.each(['valide', 'vetement', 'os-inconnu', 'glb-different', 'base-absente', 'forme', 'chemin-absolu', 'cle-inconnue'] as const)('%s', cas => {
    const d = mkdtempSync(join(tmpdir(), 'element-cli-'));
    dossiers.push(d);
    const base = baseSchema3();
    if (cas === 'os-inconnu') base.os = ['absent'];
    if (cas === 'glb-different') base.glb.sha256 = 'a'.repeat(64);
    writeFileSync(join(d, 'base.manifeste.json'), JSON.stringify(base));
    if (cas !== 'base-absente') writeFileSync(join(d, 'base.glb'), GLB_DE_BASE);
    const element = cas === 'forme' ? { ...elementSchema3(), surfaces: undefined }
      : cas === 'chemin-absolu' ? { ...elementSchema3(), surfaces: [{ nom: 'C:\\Users\\x\\metal.png', teinte: true }] }
      : cas === 'vetement' ? vetement('pourpoint') : cas === 'cle-inconnue' ? vetement('robe-de-bure') : elementSchema3();
    writeFileSync(join(d, 'element.json'), JSON.stringify(element));
    writeFileSync(join(d, 'element.glb'), GLB_D_ELEMENT);
    const r = spawnSync(process.execPath, ['hotes/godot/asset/valider.mjs', join(d, 'element.json'), join(d, 'base.manifeste.json'), join(d, 'element.glb')], { encoding: 'utf8', timeout: 60000 });
    expect(r.error).toBeUndefined();
    const accepte = cas === 'valide' || cas === 'vetement';
    expect(r.status, r.stderr + r.stdout).toBe(accepte ? 0 : 1);
    if (cas === 'cle-inconnue') expect(r.stdout + r.stderr).toContain('[cle-inconnue] cle.piece : robe-de-bure');
    else if (!accepte) expect(r.stdout + r.stderr).toContain(cas === 'base-absente' ? 'glb-de-base-absent' : cas);
  }, 65000);
});

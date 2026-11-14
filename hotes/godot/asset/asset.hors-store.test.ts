// Le contrat d'asset d'un modèle 3D modulaire (#2948) : lecture du GLB, chemins absolus, import, Release.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { empreinte, sha256 } from './empreinte.ts';
import { ecrireGlb, GlbIllisible, lireGlb } from './glb.ts';
import { chargerLicences, MANIFESTE_DE_PRODUCTION, TableDesLicencesInvalide } from './dossierDeProduction.ts';
import { importerPersonnage as importerDuDepot } from './importer.ts';
import { ecrireProduction, ProductionRefusee, type SourcesDeBase } from '../../../scripts/personnage-3d/base/production.ts';
import { cheminsAbsolus } from './manifeste.ts';
import { tableTotale } from '../../../src/lib/tableTotale';
import { depotDe, INDEX, listerImage } from '../../../scripts/guards/lib/gitPorte.mjs';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import {
  baseDeTest,
  elementSchema3,
  GLB_DE_BASE,
  GLB_D_ELEMENT,
  GLB_SANS_BASE,
  glbANoeuds,
  LICENCE_DE_PRODUCTION,
  productionDeTest,
  deposerModeleDeTest,
  TEXTE_DE_LICENCE_DE_PRODUCTION,
  vehiculeDeTest,
} from './modeles.testkit.ts';
import {
  DOSSIER_DES_MODELES, modelesAPublier, modelesEpingles, AssetIntrouvable, nomDAsset, publierAssets, recupererModeles, ReleaseInjoignable,
  suivisHorsRelease, TAG, urlDAsset, DEPOT, URL_API_DE_LA_RELEASE, type AssetAPublier, type Gh,
} from './release.ts';
import { fichiersDuModele, validerModele } from './modeles';
import { epinglesAPublier, recupererEpingles } from './epingles.ts';

/** Les constructions d'essai des éléments sur base qu'importent ces tests : un `modele.py` par clé (`constructionManquante`,
 *  `importer.ts`). */
const CONSTRUCTIONS = (() => {
  const dossier = mkdtempSync(join(tmpdir(), 'constructions-'));
  for (const id of ['rigide--epee', 'accessoire--plumet', 'accessoire--baudrier', 'armure--baudrier']) {
    mkdirSync(join(dossier, 'humanoide', id), { recursive: true });
    writeFileSync(join(dossier, 'humanoide', id, 'modele.py'), '');
  }
  return dossier;
})();
const importerPersonnage: typeof importerDuDepot = (a) => importerDuDepot({ constructions: CONSTRUCTIONS, ...a });

/** Un GLB minimal : en-tête glTF 2 et chunk JSON portant `nodes` et `animations`. */
function glb(noeuds: readonly string[], animations: readonly string[], options: { skinned?: readonly string[]; joints?: readonly string[] } = {}): Uint8Array {
  return ecrireGlb({ asset: { version: '2.0' }, nodes: noeuds.map((name, mesh) => ({ name, mesh, ...(mesh === 0 ? { children: noeuds.map((_, i) => i).slice(1) } : {}), ...(options.skinned?.includes(name) ? { skin: 0 } : {}) })), meshes: noeuds.map(() => ({ primitives: [{ material: 0 }] })), materials: [{ name: 'texture_de_lame' }], skins: [{ joints: (options.joints ?? noeuds).map(n => noeuds.indexOf(n)) }], animations: animations.map((name) => ({ name })) }, null);
}

const GLB = glb(['corps', 'tete_a', 'casque', 'bouclier', 'epee'], ['Idle', 'Death_A']);

/** L'empreinte du pack source que `production()` déclare. */
const EMPREINTE_DE_PACK = sha256(Buffer.from('UAL1_Standard.glb'));

/** L'empreinte du GLB de la base de test (`GLB_DE_BASE`). */
const EMPREINTE = sha256(GLB_DE_BASE);

/** Le `manifest.json` d'une production de base valide contre `GLB_DE_BASE` : un composant licencié et un pack source au
 *  chemin absolu, que la provenance réduit. */
const production = () => ({
  model: 'base.glb',
  model_sha256: EMPREINTE,
  manifeste: baseDeTest(),
  components: {
    corps: { asset: { file: 'C:\\Users\\x\\corps.mhclo', license_basis: 'explicit asset header', explicit_header: ['# author A', '# license CC0'], packs: [{ pack: 'p', announced_license: 'CC0 (official asset-pack page)' }] } },
  },
  packs_sources: { ual1: { path: '/home/x/anims/UAL1_Standard.glb', sha256: EMPREINTE_DE_PACK, licence: LICENCE_DE_PRODUCTION } },
});
/** Le nom de dépôt d'un texte de licence CC0 de contenu `texte` (`nomDeLicence`, `importer.ts`). */
const nomCC0 = (texte: string) => `LICENSE-CC0-1.0-${sha256(Buffer.from(texte)).slice(0, 16)}.txt`;

describe('lireGlb', () => {
  it('rend les animations, les os, les meshes et leurs matériaux du chunk JSON', () => {
    const c = lireGlb(GLB);
    expect([...c.animations]).toEqual(['Idle', 'Death_A']);
    expect([...c.os]).toEqual(['corps', 'tete_a', 'casque', 'bouclier', 'epee']);
    expect(c.meshes.map((m) => [m.nom, m.os])).toEqual([['corps', null], ['tete_a', 'corps'], ['casque', 'corps'], ['bouclier', 'corps'], ['epee', 'corps']]);
    expect([...c.materiaux]).toEqual(['texture_de_lame']);
  });
  it('refuse un conteneur qui n’est pas un glTF binaire 2', () => {
    const faux = GLB.slice();
    faux[0] = 0;
    expect(() => lireGlb(faux)).toThrow(GlbIllisible);
    const v1 = GLB.slice();
    new DataView(v1.buffer).setUint32(4, 1, true);
    expect(() => lireGlb(v1)).toThrow(/version 1/);
    expect(() => lireGlb(GLB.subarray(0, 30))).toThrow(/longueur déclarée/);
    expect(() => lireGlb(new Uint8Array(4))).toThrow(/en-tête incomplet/);
  });
  /** Un GLB de nœuds `nodes` et d'un mesh à une primitive au matériau 0. */
  const arbre = (nodes: readonly unknown[], extra: Record<string, unknown> = {}) =>
    ecrireGlb({ asset: { version: '2.0' }, nodes, meshes: [{ primitives: [{ material: 0 }] }], materials: [{ name: 'm' }], ...extra }, null);
  it.each<[string, Uint8Array, string]>([
    ['deux nœuds à mesh du même nom', glb(['corps', 'corps'], []), 'nœuds 0 et 1 nommés corps'],
    ['deux articulations du même nom, un rigide pendu à la seconde', arbre([{ name: 'root' }, { name: 'root', children: [2] }, { name: 'lame', mesh: 0 }], { skins: [{ joints: [0] }, { joints: [1] }] }), 'nœuds 0 et 1 nommés root'],
    ['un nœud à deux parents', arbre([{ name: 'a', children: [2] }, { name: 'b', children: [2] }, { name: 'c' }]), 'nœud 2 enfant des nœuds 0 et 1'],
    ['un enfant listé deux fois par le même parent', arbre([{ name: 'a', children: [1, 1] }, { name: 'b' }]), 'nœud 1 listé deux fois parmi les enfants du nœud 0'],
    ['une parenté en cycle', arbre([{ name: 'a', children: [1] }, { name: 'b', children: [0], mesh: 0 }]), 'la chaîne des parents du nœud 0 boucle'],
    ['une parenté en cycle sous une racine saine', arbre([{ name: 'r' }, { name: 'a', children: [2] }, { name: 'b', children: [1], mesh: 0 }]), 'la chaîne des parents du nœud 1 boucle'],
    ['un nœud enfant de lui-même', arbre([{ name: 'a', children: [0], mesh: 0 }]), 'la chaîne des parents du nœud 0 boucle'],
    ['une racine de scène qui a un parent', arbre([{ name: 'r', children: [1] }, { name: 'e', mesh: 0 }], { scenes: [{ nodes: [0, 1] }], scene: 0 }), 'racine 1 de la scène 0 enfant du nœud 0'],
    ['une racine de scène hors des nœuds', arbre([{ name: 'r' }], { scenes: [{ nodes: [4] }] }), 'scène 0 : racine 4 hors des 1 nœuds'],
    ['un enfant hors des nœuds', arbre([{ name: 'a', children: [9], mesh: 0 }]), 'nœud 0 : enfant 9 hors des 1 nœuds'],
    ['un mesh hors des meshes', arbre([{ name: 'a', mesh: 3 }]), 'nœud 0 : mesh 3 hors des 1 meshes'],
    ['un skin hors des skins', arbre([{ name: 'a', mesh: 0, skin: 0 }]), 'nœud 0 : skin 0 hors des 0 skins'],
    ['une articulation hors des nœuds', arbre([{ name: 'a' }], { skins: [{ joints: [2] }] }), 'skin 0 : articulation 2 hors des 1 nœuds'],
    ['un matériau hors des matériaux', arbre([{ name: 'a', mesh: 0 }], { materials: [] }), 'mesh 0, primitive 0 : matériau 0 hors des 0 matériaux'],
    ['un nœud à mesh sans nom, porteur de zone et d’un second jeu d’influences', arbre([{ mesh: 0, extras: { zone: 'torse' } }], { meshes: [{ primitives: [{ material: 0, attributes: { JOINTS_1: 0, WEIGHTS_1: 0 } }] }] }), 'nœud 0 à mesh sans nom'],
    ['un enfant qui n’est pas un indice', arbre([{ name: 'a', children: ['1'] }, { name: 'b' }]), 'nœud 0 : enfant "1" hors des 2 nœuds'],
    ['un mesh sans primitives', arbre([{ name: 'a' }], { meshes: [{}] }), 'mesh 0 : primitives : tableau attendu'],
    ['un skin sans articulations', arbre([{ name: 'a' }], { skins: [{}] }), 'skin 0 : joints : tableau attendu'],
    ['des enfants hors d’un tableau', arbre([{ name: 'a', children: 1 }]), 'nœud 0 : children : tableau attendu'],
    ['des racines de scène hors d’un tableau', arbre([{ name: 'a' }], { scenes: [{ nodes: 0 }] }), 'scène 0 : nodes : tableau attendu'],
    ['des nœuds hors d’un tableau', ecrireGlb({ asset: { version: '2.0' }, nodes: {} }, null), 'nodes : tableau attendu'],
    ['un nœud qui n’est pas un objet', arbre([null]), 'nœud 0 : objet attendu'],
    ['un nœud à mesh au nom vide', arbre([{ name: '', mesh: 0 }]), 'nœud 0 à mesh sans nom'],
    ['la scène par défaut hors des scènes', arbre([{ name: 'r' }], { scenes: [{ nodes: [0] }], scene: 4 }), 'scène par défaut 4 hors des 1 scènes'],
  ])('refuse %s, le défaut dit', (_, octets, raison) => {
    expect(() => lireGlb(octets)).toThrow(new GlbIllisible(raison));
  });
  it('lit une articulation au nom vide comme une articulation sans nom', () => {
    expect(lireGlb(arbre([{ name: '', children: [1] }, { name: 'lame', mesh: 0 }], { skins: [{ joints: [0] }] })).meshes).toEqual([{ nom: 'lame', skinne: false, articulation: 0, os: null }]);
  });
  it('lit un matériau au nom qui n’est pas une chaîne comme un matériau sans nom', () => {
    expect([...lireGlb(arbre([{ name: 'a', mesh: 0 }], { materials: [{ name: 42 }] })).materiaux]).toEqual(['']);
  });
  it.each<[string, (vue: DataView) => void, RegExp]>([
    ['un premier chunk autre que JSON', (vue) => vue.setUint32(16, 0x004e4942, true), /premier chunk autre que JSON/],
    ['un chunk JSON plus long que le fichier', (vue) => vue.setUint32(12, GLB.byteLength, true), /chunk JSON tronqué/],
    ['un chunk JSON qui ne se parse pas', (vue) => vue.setUint8(20, 0x7d), /chunk JSON invalide/],
  ])('refuse %s', (_, muter, motif) => {
    const faux = GLB.slice();
    muter(new DataView(faux.buffer));
    expect(() => lireGlb(faux)).toThrow(motif);
  });
});

describe('cheminsAbsolus', () => {
  it.each(['C:\\Users\\x', 'D:/donnees', '\\\\serveur\\partage', '/home/x', '/tmp', 'voir /home/x/y', '~/x'])('reconnaît « %s »', (s) => {
    expect(cheminsAbsolus(s)).toHaveLength(1);
  });
  it.each(['Épée / bouclier', 'Épée /bouclier', 'cuir/mailles', 'clothes/a/b.mhclo', 'http://www.makehuman.org/doc/node/x.html', '1/2'])('laisse « %s »', (s) => {
    expect(cheminsAbsolus(s)).toEqual([]);
  });
  it('lit les clés comme les valeurs', () => {
    expect(cheminsAbsolus({ a: { '/home/x': 1 } })).toEqual([{ code: 'chemin-absolu', ou: 'a./home/x', detail: '/home/x' }]);
  });
});

const dossiers: string[] = [];
const temporaire = () => {
  const d = mkdtempSync(join(tmpdir(), 'asset-2948-'));
  dossiers.push(d);
  return d;
};
afterEach(() => dossiers.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Chaque fichier du dossier `d` et ses octets. */
const photo = (d: string) => listerDossier(d).map((f) => [f, readFileSync(join(d, f)).toString('base64')]);

describe('import et chargement des modèles modulaires', () => {
  const importer = (destination: string, manifeste: unknown, octets = GLB_D_ELEMENT, id = 'element', publier: ((assets: readonly AssetAPublier[]) => readonly string[]) | null = null) =>
    importerPersonnage({ dossier: productionDeTest(temporaire(), manifeste, octets), id, destination, date: '2026-10-28', publier });
  const avecBase = () => {
    const dossier = temporaire();
    deposerModeleDeTest(dossier, 'corps-reference', baseDeTest(), GLB_DE_BASE);
    return dossier;
  };
  it('publie l’élément avec le GLB de sa base importée sans publier, sous leurs empreintes', () => {
    const destination = temporaire();
    expect(importer(destination, baseDeTest(), GLB_DE_BASE, 'corps-reference').ok).toBe(true);
    const verses: AssetAPublier[] = [];
    const r = importer(destination, elementSchema3(), GLB_D_ELEMENT, 'epee', assets => { verses.push(...assets); return assets.map(a => a.nom); });
    expect(r.ok).toBe(true);
    expect(verses.map(a => [a.nom, sha256(readFileSync(a.chemin))])).toEqual([
      [nomDAsset(sha256(GLB_D_ELEMENT), 'glb'), sha256(GLB_D_ELEMENT)],
      [nomDAsset(sha256(GLB_DE_BASE), 'glb'), sha256(GLB_DE_BASE)],
    ]);
    expect(JSON.parse(readFileSync(join(destination, 'epee.manifeste.json'), 'utf8'))).toEqual(elementSchema3());
  });
  it.each([false, true])('refuse une base épinglée hors Release à la lecture, publication %s', publier => {
    const destination = temporaire();
    expect(importer(destination, baseDeTest(), GLB_DE_BASE, 'humanoide').ok).toBe(true);
    const chemin = join(destination, 'humanoide.provenance.json');
    writeFileSync(chemin, JSON.stringify({ ...JSON.parse(readFileSync(chemin, 'utf8')), hors_release: 'base d’essai sur le poste' }));
    const avant = photo(destination);
    const verses: AssetAPublier[] = [];
    const r = importer(destination, elementSchema3(), GLB_D_ELEMENT, 'epee', publier ? assets => { verses.push(...assets); return assets.map(a => a.nom); } : null);
    expect(r).toEqual({ ok: false, refus: ['[base-hors-release] humanoide : une base ne peut pas être hors Release'] });
    expect(verses).toEqual([]);
    expect(photo(destination)).toEqual(avant);
  });
  it('un import réussi rend le rapport de l’index, sans blocage : un accessoire dont aucune pièce de la base n’offre l’emplacement', () => {
    const destination = temporaire();
    expect(importer(destination, baseDeTest(), GLB_DE_BASE, 'corps-reference')).toMatchObject({ ok: true, rapport: [] });
    const plumet = { ...elementSchema3(), categorie: 'accessoire', cle: { piece: 'plumet' }, couche: 'tenue' };
    expect(importer(destination, plumet, GLB_D_ELEMENT, 'plumet')).toMatchObject({
      ok: true, rapport: ['[emplacement-non-offert] plumet : plumet se pose sur cimier, que ni la base `humanoide` ni aucune de ses pièces n’offre'],
    });
  });
  it.each([
    ['base-absente', () => temporaire(), () => elementSchema3()],
    ['forme', avecBase, () => ({ ...elementSchema3(), surfaces: undefined })],
    ['glb-different', avecBase, () => ({ ...elementSchema3(), glb: { sha256: 'a'.repeat(64), octets: GLB_D_ELEMENT.byteLength } })],
    ['cle-en-doublon', () => { const d = avecBase(); deposerModeleDeTest(d, 'autre', elementSchema3(), GLB_D_ELEMENT); return d; }, () => elementSchema3()],
    ['base-en-doublon', avecBase, () => baseDeTest()],
    ['categorie-inconnue', avecBase, () => { const { categorie: _c, cle: _k, ...incomplet } = elementSchema3(); return incomplet; }],
    ['os-inconnu', () => { const d = avecBase(); writeFileSync(join(d, 'corps-reference.manifeste.json'), JSON.stringify({ ...baseDeTest(), os: ['absent'] })); return d; }, () => elementSchema3()],
    ['glb-de-base-absent', () => { const d = avecBase(); rmSync(join(d, 'corps-reference.glb')); return d; }, () => elementSchema3()],
    ['provenance-de-base-differente', () => { const d = avecBase(); writeFileSync(join(d, 'corps-reference.provenance.json'), JSON.stringify({ model: 'corps-reference.glb', model_sha256: 'a'.repeat(64) })); return d; }, () => elementSchema3()],
  ] as const)('refuse %s avant publication et sans écriture', (code, destinationDe, manifesteDe) => {
    const destination = destinationDe();
    const avant = listerDossier(destination).map(f => [f, readFileSync(join(destination, f)).toString('base64')]);
    const verses: AssetAPublier[] = [];
    const m = manifesteDe();
    const r = importer(destination, m, 'categorie' in m ? GLB_D_ELEMENT : GLB_DE_BASE, 'nouveau', assets => { verses.push(...assets); return []; });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus.join('\n')).toContain(`[${code}]`);
    expect(verses).toEqual([]);
    expect(listerDossier(destination).map(f => [f, readFileSync(join(destination, f)).toString('base64')])).toEqual(avant);
  });
  it('refuse un élément sur base sans construction dans le dépôt, sauf hors Release, sans rien écrire', () => {
    const destination = temporaire();
    expect(importerDuDepot({ dossier: productionDeTest(temporaire(), baseDeTest(), GLB_DE_BASE), id: 'humanoide', destination, date: '2026-11-08', publier: null }).ok).toBe(true);
    const vides = mkdtempSync(join(tmpdir(), 'constructions-'));
    const production = productionDeTest(temporaire(), elementSchema3(), GLB_D_ELEMENT);
    const avant = listerDossier(destination);
    expect(importerDuDepot({ dossier: production, id: 'epee', destination, date: '2026-11-08', publier: null, constructions: vides })).toEqual({
      ok: false, refus: [`[construction-absente] epee : ${join(vides, 'humanoide', 'rigide--epee', 'modele.py')}, la construction de l’élément dans le dépôt attendue`],
    });
    expect(listerDossier(destination)).toEqual(avant);
    const chemin = join(production, MANIFESTE_DE_PRODUCTION);
    writeFileSync(chemin, JSON.stringify({ ...JSON.parse(readFileSync(chemin, 'utf8')), hors_release: 'essai sur le poste' }));
    expect(importerDuDepot({ dossier: production, id: 'epee', destination, date: '2026-11-08', publier: null, constructions: vides }).ok).toBe(true);
  });
  it('seule la déclaration propre de l’élément le tient hors Release, sa base reste publiée', async () => {
    const destination = temporaire();
    const base = productionDeTest(temporaire(), baseDeTest(), GLB_DE_BASE);
    const verses: AssetAPublier[] = [];
    expect(importerPersonnage({ dossier: base, id: 'humanoide', destination, date: '2026-10-29', publier: a => { verses.push(...a); return a.map(x => x.nom); } }).ok).toBe(true);
    expect(verses.map(a => a.nom)).toEqual([nomDAsset(sha256(GLB_DE_BASE), 'glb')]);
    const production = productionDeTest(temporaire(), elementSchema3(), GLB_D_ELEMENT);
    const chemin = join(production, MANIFESTE_DE_PRODUCTION);
    writeFileSync(chemin, JSON.stringify({ ...JSON.parse(readFileSync(chemin, 'utf8')), hors_release: 'essai sur le poste' }));
    const avant = listerDossier(destination);
    const importerEssai = (publier: ((assets: readonly AssetAPublier[]) => readonly string[]) | null) => importerPersonnage({ dossier: production, id: 'epee', destination, date: '2026-10-31', publier });
    expect(importerEssai(a => { verses.push(...a); return []; }))
      .toEqual({ ok: false, refus: ['[hors-release] essai sur le poste : import sans publication seulement (--sans-publier)'] });
    expect([verses.length, listerDossier(destination)]).toEqual([1, avant]);
    expect(importerEssai(null).ok).toBe(true);
    expect(JSON.parse(readFileSync(join(destination, fichiersDuModele('epee').provenance), 'utf8')).hors_release).toBe('essai sur le poste');
    const suivis = ['epee.manifeste.json', 'epee.provenance.json', 'humanoide.manifeste.json'];
    expect(suivisHorsRelease(modelesEpingles(destination).modeles, suivis)).toEqual(['epee.manifeste.json', 'epee.provenance.json']);
    rmSync(join(destination, 'epee.glb'));
    await expect(recupererModeles({ dossier: destination, cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet })).rejects.toThrow('[hors-release] epee.glb');
  });
  it('refuse un second import du même couple même sous le même id', () => {
    const d = avecBase();
    expect(importer(d, elementSchema3()).ok).toBe(true);
    const r = importer(d, elementSchema3());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus.join('\n')).toContain('[cle-en-doublon]');
  });
  it('la catégorie ne distingue pas deux éléments de même clé de pièce', () => {
    const d = temporaire();
    deposerModeleDeTest(d, 'corps-reference', { ...baseDeTest(), emplacements: { epaule_d: { os: 'root', position: [0, 0, 0], rotation: [0, 0, 0] } } }, GLB_DE_BASE);
    const piece = { ...elementSchema3(), categorie: 'accessoire', cle: { piece: 'baudrier' }, couche: 'tenue' };
    expect(importer(d, piece).ok).toBe(true);
    const r = importer(d, { ...piece, categorie: 'armure', liaison: { mode: 'squelette' }, couche: 'armure', couvre: [] }, GLB_D_ELEMENT, 'armure');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus.join('\n')).toContain('[cle-en-doublon]');
  });
  it('un accessoire dont aucune pièce de la base n’offre l’emplacement s’importe, et ne bloque ni l’import suivant ni la Release', () => {
    const d = avecBase();
    const plumet = { ...elementSchema3(), categorie: 'accessoire', cle: { piece: 'plumet' }, couche: 'tenue' };
    expect(importer(d, plumet, GLB_D_ELEMENT, 'plumet').ok).toBe(true);
    expect(importer(d, elementSchema3(), GLB_D_ELEMENT, 'epee').ok).toBe(true);
    expect(modelesEpingles(d).erreurs).toEqual([]);
  });
  it('une base au repos dans le même dossier ne rend pas son GLB requis pour un élément d’une autre base', () => {
    const d = avecBase();
    deposerModeleDeTest(d, 'autre-base', baseDeTest('autre'), GLB_DE_BASE);
    rmSync(join(d, 'autre-base.glb'));
    expect(importer(d, elementSchema3()).ok).toBe(true);
  });
  it('charge une base et son élément, même quand la base suit l’élément dans le dossier', async () => {
    const d = temporaire();
    deposerModeleDeTest(d, 'z-base', baseDeTest(), GLB_DE_BASE);
    deposerModeleDeTest(d, 'a-element', elementSchema3(), GLB_D_ELEMENT);
    const r = await recupererModeles({ dossier: d, cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet });
    expect(r.map(m => m.id).sort()).toEqual(['a-element', 'z-base']);
  });
  it('un véhicule, élément sans base, s’importe et se charge sans aucune base (#2987)', async () => {
    const d = temporaire();
    expect(importer(d, vehiculeDeTest(), GLB_SANS_BASE, 'caraque')).toMatchObject({ ok: true, rapport: [] });
    const r = importer(d, vehiculeDeTest(), GLB_SANS_BASE, 'caraque-bis');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus.join('\n')).toContain('[cle-en-doublon]');
    expect((await recupererModeles({ dossier: d, cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet })).map(m => m.id)).toEqual(['caraque']);
  });
  it.each(['cle-en-doublon', 'base-en-doublon', 'base-absente', 'forme', 'os-inconnu'] as const)('refuse %s au chargement', async code => {
    const d = temporaire();
    if (code !== 'base-absente') deposerModeleDeTest(d, 'base', code === 'os-inconnu' ? { ...baseDeTest(), os: ['absent'] } : baseDeTest(), GLB_DE_BASE);
    deposerModeleDeTest(d, 'a', code === 'forme' ? { ...elementSchema3(), surfaces: undefined } : elementSchema3(), GLB_D_ELEMENT);
    if (code === 'cle-en-doublon') deposerModeleDeTest(d, 'b', elementSchema3(), GLB_D_ELEMENT);
    if (code === 'base-en-doublon') deposerModeleDeTest(d, 'b', baseDeTest(), GLB_DE_BASE);
    await expect(recupererModeles({ dossier: d, cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet })).rejects.toThrow(`[${code}]`);
  });

  /** Une base réexportée : le GLB `octets`, et son manifeste, celui de `baseDeTest(nom)` aux os de `os` renommés `root`. */
  const reexport = (os = 'root', nom = 'humanoide') => {
    const octets = ecrireGlb({ asset: { version: '2.0', generator: 'réexport' }, nodes: [{ name: os }], skins: [{ joints: [0] }], animations: [{ name: 'walk' }] }, null);
    const manifeste = { ...JSON.parse(JSON.stringify(baseDeTest(nom)).split('"root"').join(JSON.stringify(os))), glb: empreinte(octets) };
    return { octets, dossier: productionDeTest(temporaire(), manifeste, octets) };
  };
  /** Une destination où la base `humanoide` est importée, puis l'élément `epee` qui la référence. */
  const baseEtElement = () => {
    const destination = temporaire();
    expect([importer(destination, baseDeTest(), GLB_DE_BASE, 'humanoide').ok, importer(destination, elementSchema3(), GLB_D_ELEMENT, 'epee').ok]).toEqual([true, true]);
    return destination;
  };
  const reimporter = (dossier: string, destination: string, remplacer?: boolean) =>
    importerPersonnage({ dossier, id: 'humanoide', destination, date: '2026-10-29', publier: null, remplacer });

  it('remplace par --remplacer une base qui a un élément : l’élément reste, la provenance de base est la neuve ; sans, [id-deja-present]', async () => {
    const destination = baseEtElement();
    const { octets, dossier } = reexport();
    const epee = photo(destination).filter(([f]) => f.startsWith('epee.'));
    const sans = reimporter(dossier, destination);
    expect(sans.ok ? sans : sans.refus).toContain('[id-deja-present] humanoide : --remplacer remplace le modèle importé');
    const r = reimporter(dossier, destination, true);
    expect(r.ok ? [r.provenance.model_sha256, r.retires] : r.refus).toEqual([sha256(octets), []]);
    expect(JSON.parse(readFileSync(join(destination, 'humanoide.provenance.json'), 'utf8')).model_sha256).toBe(sha256(octets));
    expect(photo(destination).filter(([f]) => f.startsWith('epee.'))).toEqual(epee);
    const charges = await recupererModeles({ dossier: destination, cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet });
    expect(charges.map((m) => [m.id, m.empreinte])).toEqual([['epee', sha256(GLB_D_ELEMENT)], ['humanoide', sha256(octets)]]);
  });
  it.each([
    ['dont l’os que l’élément porte disparaît', () => reexport('hanche'), /^\[remplacement-casse\] epee : \[/],
    ['qui change le nom de la base', () => reexport('root', 'autre'), /^\[base-absente\] epee : humanoide$/],
    ['qui passe hors Release sous un élément publié', () => {
      const r = reexport();
      const chemin = join(r.dossier, MANIFESTE_DE_PRODUCTION);
      writeFileSync(chemin, JSON.stringify({ ...JSON.parse(readFileSync(chemin, 'utf8')), hors_release: 'essai sur le poste' }));
      return r;
    }, /^\[base-hors-release\] manifest.json : une base ne peut pas être hors Release$/],
  ])('refuse en bloc, destination inchangée à l’octet, une base réexportée %s', (_, nouvelle, motif) => {
    const destination = baseEtElement();
    const avant = photo(destination);
    const r = reimporter(nouvelle().dossier, destination, true);
    expect(r.ok ? r : r.refus.join('\n')).toMatch(motif);
    expect(photo(destination)).toEqual(avant);
  });
  it('retire au remplacement le texte de licence que la provenance remplacée était seule à nommer', () => {
    const destination = temporaire();
    expect(importer(destination, baseDeTest(), GLB_DE_BASE, 'humanoide').ok).toBe(true);
    const { dossier } = reexport();
    const texte = 'Pack réexporté\nLicense: CC0\n';
    writeFileSync(join(dossier, LICENCE_DE_PRODUCTION), texte);
    const r = reimporter(dossier, destination, true);
    expect(r.ok ? r.retires : r.refus).toEqual([join(destination, nomCC0(TEXTE_DE_LICENCE_DE_PRODUCTION))]);
    expect(listerDossier(destination).filter((f) => f.startsWith('LICENSE'))).toEqual([nomCC0(texte)]);
  });
  it.each<[string, (m: Record<string, unknown>) => void, string]>([
    ['à la forme d’avant #3118, animation_sources sans packs_sources', (m) => {
      m.animation_sources = { ual1: { path: 'UAL1_Standard.glb', sha256: EMPREINTE_DE_PACK } };
      delete m.packs_sources;
    }, '[packs-sources-absents] manifest.json : packs_sources, au moins un pack attendu pour une base'],
    ['dont un pack n’a pas d’empreinte', (m) => { m.packs_sources = { corps: { path: 'corps.gltf', licence: LICENCE_DE_PRODUCTION } }; }, '[pack-source-mal-forme] corps : sha256 « undefined » n\'est pas un SHA-256'],
    ['dont l’empreinte d’un pack n’est pas un SHA-256', (m) => { m.packs_sources = { corps: { path: 'corps.gltf', sha256: 'abc', licence: LICENCE_DE_PRODUCTION } }; }, '[pack-source-mal-forme] corps : sha256 « abc » n\'est pas un SHA-256'],
    ['dont un pack ne nomme aucun texte de licence', (m) => { m.packs_sources = { corps: { path: 'corps.gltf', sha256: EMPREINTE_DE_PACK } }; }, '[pack-source-mal-forme] corps : licence, nom d\'un texte LICENSE*.txt du dossier attendu'],
    ['dont un pack n’est pas un objet', (m) => { m.packs_sources = { corps: 'x' }; }, '[pack-source-mal-forme] corps : objet attendu'],
    ['dont un pack n’a pas de path', (m) => { m.packs_sources = { corps: { sha256: EMPREINTE_DE_PACK, licence: LICENCE_DE_PRODUCTION } }; }, '[pack-source-mal-forme] corps : path, chaîne attendue'],
    ['dont packs_sources n’est pas un objet', (m) => { m.packs_sources = []; }, '[pack-source-mal-forme] packs_sources : objet attendu'],
  ])('refuse une base %s', (_, muter, refus) => {
    const dossier = productionDeTest(temporaire(), baseDeTest(), GLB_DE_BASE);
    const manifest = JSON.parse(readFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), 'utf8'));
    muter(manifest);
    writeFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), JSON.stringify(manifest));
    const destination = join(temporaire(), 'modeles');
    expect(importerPersonnage({ dossier, id: 'humanoide', destination, date: '2026-10-29', publier: null })).toEqual({ ok: false, refus: [refus] });
    expect(existsSync(destination)).toBe(false);
  });
});

describe('la table rôle → clip d’une base (#3253)', () => {
  it('accepte chaque rôle du vocabulaire dont le clip est au GLB', () => {
    expect(validerModele({ ...baseDeTest(), clips: { marche: 'walk', repos: 'walk' } }, GLB_DE_BASE)).toMatchObject({ ok: true, manifeste: { clips: { marche: 'walk', repos: 'walk' } } });
  });
  it.each([
    ['un rôle hors du vocabulaire', { marche: 'walk', danse: 'walk' }, '[role-inconnu] clips.danse : danse'],
    ['un clip absent du GLB', { marche: 'walk', repos: 'Idle_Loop' }, '[clip-absent] clips.repos : Idle_Loop'],
  ])('refuse %s, en le nommant', (_, clips, refus) => {
    expect(validerModele({ ...baseDeTest(), clips }, GLB_DE_BASE)).toEqual({ ok: false, refus: [refus] });
  });
  it('accepte une table des rôles tenus à deux mains par maniement, et juge chacune comme `clips` (#3319)', () => {
    expect(validerModele({ ...baseDeTest(), clipsDeuxMains: { hampe: { repos: 'walk' } } }, GLB_DE_BASE)).toMatchObject({ ok: true, manifeste: { clipsDeuxMains: { hampe: { repos: 'walk' } } } });
    expect(validerModele({ ...baseDeTest(), clipsDeuxMains: { lourde2m: { danse: 'walk' }, hampe: { repos: 'Repos_Hampe' } } }, GLB_DE_BASE))
      .toEqual({ ok: false, refus: ['[role-inconnu] clipsDeuxMains.lourde2m.danse : danse', '[clip-absent] clipsDeuxMains.hampe.repos : Repos_Hampe'] });
  });
  it('refuse une table de rôles tenus à deux mains sous un maniement inconnu, en le nommant', () => {
    expect(validerModele({ ...baseDeTest(), clipsDeuxMains: { valse: { repos: 'walk' } } }, GLB_DE_BASE))
      .toEqual({ ok: false, refus: ['[maniement-inconnu] clipsDeuxMains.valse : valse'] });
  });
  it('accepte les prises occupées par clip, et refuse un clip absent du GLB, une prise inconnue ou une liste vide (#3806)', () => {
    expect(validerModele({ ...baseDeTest(), prisesOccupees: { walk: ['secondaire', 'main'] } }, GLB_DE_BASE)).toMatchObject({ ok: true, manifeste: { prisesOccupees: { walk: ['secondaire', 'main'] } } });
    expect(validerModele({ ...baseDeTest(), prisesOccupees: { Coffre: ['secondaire'] } }, GLB_DE_BASE)).toEqual({ ok: false, refus: ['[clip-absent] prisesOccupees.Coffre : Coffre'] });
    for (const occupees of [['pied'], [], ['secondaire', 'secondaire']]) {
      expect(validerModele({ ...baseDeTest(), prisesOccupees: { walk: occupees } }, GLB_DE_BASE)).toMatchObject({ ok: false, refus: [expect.stringMatching(/^\[forme\] prisesOccupees\.walk : /)] });
    }
    const { prises: _, ...sansPrises } = baseDeTest();
    expect(validerModele({ ...sansPrises, prisesOccupees: { walk: ['secondaire'] } }, GLB_DE_BASE)).toMatchObject({ ok: false, refus: [expect.stringMatching(/^\[forme\] prisesOccupees : /)] });
  });
  it('refuse l’élément d’une base dont la table est refusée', () => {
    const base = { brut: { ...baseDeTest(), clips: { marche: 'Walk_Loop' } }, octets: GLB_DE_BASE };
    expect(validerModele(elementSchema3(), GLB_D_ELEMENT, new Map([['humanoide', base]]))).toEqual({ ok: false, refus: ['[clip-absent] base clips.marche : Walk_Loop'] });
  });
});

describe('la table rôle → clip d’un véhicule (#2987)', () => {
  const GLB = glbANoeuds(['affut'], ['marche', 'tir']);
  const vehicule = (clips: Record<string, string>) => ({ ...vehiculeDeTest('canon-moyen'), clips, glb: empreinte(GLB) });
  it('accepte chaque rôle du vocabulaire dont le clip est au GLB', () => {
    expect(validerModele(vehicule({ marche: 'marche', tir: 'tir' }), GLB)).toMatchObject({ ok: true, manifeste: { clips: { marche: 'marche', tir: 'tir' } } });
  });
  it.each([
    ['un rôle hors du vocabulaire', { marche: 'marche', salve: 'tir' }, '[role-inconnu] clips.salve : salve'],
    ['un clip absent du GLB', { marche: 'marche', repos: 'repos' }, '[clip-absent] clips.repos : repos'],
  ])('refuse %s, en le nommant', (_, clips, refus) => {
    expect(validerModele(vehicule(clips), GLB)).toEqual({ ok: false, refus: [refus] });
  });
});

describe('les modules que node charge sans Vite', () => {
  it('résolvent chacun leurs imports : manifeste.mjs rend son usage', () => {
    const r = spawnSync(process.execPath, ['scripts/personnage-3d/base/manifeste.mjs'], { encoding: 'utf8' });
    expect([r.status, `${r.stdout}${r.stderr}`.split('\n')[0]]).toEqual([2, expect.stringMatching(/^usage : node scripts\/personnage-3d\/base\/manifeste\.mjs /)]);
  });
});

describe('importerPersonnage', () => {
  /** Une publication qui consigne ce qu'on lui verse. */
  const publication = () => {
    const verses: AssetAPublier[][] = [];
    return { verses, publier: (assets: readonly AssetAPublier[]) => { verses.push([...assets]); return assets.map((a) => a.nom); } };
  };

  const dossierDeProduction = (muter: (m: ReturnType<typeof production>) => void = () => {}, declaree?: string) => {
    const d = temporaire();
    const m = { ...production(), model_sha256: declaree ?? EMPREINTE };
    muter(m);
    writeFileSync(join(d, m.model), GLB_DE_BASE);
    writeFileSync(join(d, LICENCE_DE_PRODUCTION), TEXTE_DE_LICENCE_DE_PRODUCTION);
    writeFileSync(join(d, MANIFESTE_DE_PRODUCTION), JSON.stringify(m));
    return d;
  };

  it('publie le GLB sous son empreinte, puis dépose le GLB, le manifeste validé et la provenance sans chemin', () => {
    const destination = temporaire();
    const dossier = dossierDeProduction();
    const { verses, publier } = publication();
    const r = importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-23', publier });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f = fichiersDuModele('Essai');
    expect(verses).toEqual([[{ chemin: join(dossier, 'base.glb'), nom: `${EMPREINTE}.glb` }]]);
    expect(r.publies).toEqual([`${EMPREINTE}.glb`]);
    expect(readFileSync(join(destination, f.glb))).toEqual(Buffer.from(GLB_DE_BASE));
    expect(JSON.parse(readFileSync(join(destination, f.manifeste), 'utf8'))).toEqual(baseDeTest());
    expect(r.provenance).toEqual({
      model: 'Essai.glb',
      model_sha256: EMPREINTE,
      importe_le: '2026-10-23',
      licences: { corps: { base: 'explicit asset header', en_tete: ['CC0'], annoncees: ['CC0 (official asset-pack page)'] } },
      licences_de_pack: [{ fichier: nomCC0(TEXTE_DE_LICENCE_DE_PRODUCTION), licence: 'CC0' }],
      packs_sources: [{ pack: 'ual1', fichier: 'UAL1_Standard.glb', sha256: EMPREINTE_DE_PACK, licence: nomCC0(TEXTE_DE_LICENCE_DE_PRODUCTION) }],
    });
  });

  it('publie la source .blend sous son empreinte et dépose les licences de pack', () => {
    const destination = temporaire();
    const dossier = dossierDeProduction();
    const blend = Buffer.from('BLENDER-source');
    writeFileSync(join(dossier, 'source.blend'), blend);
    const texte = 'Pack\n\tLicense: (Creative Commons Zero, CC0)\n';
    writeFileSync(join(dossier, 'LICENSE-Pack.txt'), texte);
    const { verses, publier } = publication();
    const r = importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-23', publier });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const empreinteBlend = sha256(blend);
    expect(verses[0]?.map((a) => a.nom)).toEqual([`${EMPREINTE}.glb`, `${empreinteBlend}.blend`]);
    expect(r.provenance.source_sha256).toBe(empreinteBlend);
    expect(r.provenance.licences_de_pack).toEqual([{ fichier: nomCC0(texte), licence: '(Creative Commons Zero, CC0)' }]);
    expect(readFileSync(join(destination, nomCC0(texte)), 'utf8')).toBe(texte);
  });

  it.each([
    ['trousers, boots_viking', 'CC0', 'CC0 (official asset-pack page)'],
    ['boots_leather, helmet_chaos', 'CC-0', 'CC0 (official asset-pack page)'],
    ['Universal Animation Library', 'CC0', 'CC0 1.0 Universal (CC0 1.0)'],
  ])('accepte la licence de %s : l’en-tête « %s » et le pack « %s » sont CC0-1.0', (_, enTete, annonce) => {
    const dossier = dossierDeProduction((m) => {
      m.components.corps.asset.explicit_header = [`# license ${enTete}`];
      m.components.corps.asset.packs = [{ pack: 'p', announced_license: annonce }];
    });
    const r = importerPersonnage({ dossier, id: 'Essai', destination: temporaire(), date: '2026-10-23', publier: null });
    expect(r.ok ? [] : r.refus).toEqual([]);
  });

  it('ne publie rien sans publication (--sans-publier)', () => {
    const r = importerPersonnage({ dossier: dossierDeProduction(), id: 'Essai', destination: temporaire(), date: '2026-10-23', publier: null });
    expect(r.ok && r.publies).toEqual([]);
  });

  it.each<[string, () => string, RegExp | string]>([
    ['un manifeste d’un autre GLB', () => dossierDeProduction(() => {}, '0'.repeat(64)), /^empreinte SHA-256 du GLB [0-9a-f]{64}, manifest\.json déclare 0{64}$/],
    ['un GLB illisible', () => {
      const illisible = Buffer.from('pas un glb');
      const d = dossierDeProduction(() => {}, sha256(illisible));
      writeFileSync(join(d, 'base.glb'), illisible);
      return d;
    }, /^\[glb-illisible\] GLB illisible : 10 octets, en-tête incomplet$/],
    ['un manifeste sans empreinte', () => dossierDeProduction((m) => { delete (m as { model_sha256?: string }).model_sha256; }), /, manifest\.json déclare undefined$/],
    ['un chemin absolu laissé', () => dossierDeProduction((m) => { m.manifeste = { ...m.manifeste, porteur: { ...m.manifeste.porteur, espece: '/home/x/humain' } }; }), /^\[chemin-absolu\] manifeste\.porteur\.espece : \/home\/x\/humain$/],
    ['un manifest.json sans manifeste', () => dossierDeProduction((m) => { delete (m as { manifeste?: unknown }).manifeste; }), /^\[manifeste-absent\] manifest\.json : manifeste, le manifeste d’une base ou d’un élément attendu$/],
    ['une licence d’en-tête que le pack n’annonce pas', () => dossierDeProduction((m) => {
      m.components.corps.asset.explicit_header = ['# license AGPL3'];
      m.components.corps.asset.packs = [{ pack: 'p', announced_license: 'CC0 (official asset-pack page)' }];
    }), /^licence du composant corps : l'en-tête déclare « AGPL-3\.0-only », le pack annonce « CC0-1\.0 »$/],
    ['une licence de composant hors de la table', () => dossierDeProduction((m) => {
      m.components.corps.asset.explicit_header = ['# license AGPL3 (see also http://www.makehuman.org/doc/node/external_tools_license.html)'];
    }), /^\[licence-inconnue\] licence du composant corps : « AGPL3 \(see also http:\/\/www\.makehuman\.org\/doc\/node\/external_tools_license\.html\) »$/],
    ['une licence de pack hors de la table', () => {
      const d = dossierDeProduction();
      writeFileSync(join(d, 'LICENSE-Pack.txt'), 'Pack\nLicense: MIT\n');
      return d;
    }, /^\[licence-inconnue\] LICENSE-Pack\.txt : « MIT »$/],
    ['une base dont le texte de licence du pack manque', () => {
      const d = productionDeTest(temporaire(), baseDeTest(), GLB_DE_BASE);
      rmSync(join(d, LICENCE_DE_PRODUCTION));
      return d;
    }, /^\[licence-de-pack-absente\] corps : LICENSE-Pack\.txt$/],
    ['un manifeste absent', () => {
      const d = dossierDeProduction();
      rmSync(join(d, MANIFESTE_DE_PRODUCTION));
      return d;
    }, /^fichier de production absent : manifest\.json$/],
    ...([
      ['un GLB que le manifeste nomme, absent du dossier', 'character.glb'],
      ['un model qui sort du dossier', '../animated.glb'],
      ['un model « .. »', '..'],
      ['un model « . »', '.'],
      ['un model qui nomme un sous-dossier', 'sous'],
    ] as const).map(([cas, model]): [string, () => string, string] => [cas, () => {
      const d = dossierDeProduction();
      mkdirSync(join(d, 'sous'));
      writeFileSync(join(d, MANIFESTE_DE_PRODUCTION), JSON.stringify({ ...production(), model, model_sha256: EMPREINTE }));
      return d;
    }, `${MANIFESTE_DE_PRODUCTION} : model « ${model} », fichier du dossier de production attendu`]),
    ['deux sources .blend', () => {
      const d = dossierDeProduction();
      writeFileSync(join(d, 'a.blend'), 'a');
      writeFileSync(join(d, 'b.blend'), 'b');
      return d;
    }, /plusieurs sources \.blend/],
    ['une licence de pack ni à ligne License: ni à titre connu', () => {
      const d = dossierDeProduction();
      writeFileSync(join(d, 'LICENSE-Pack.txt'), '# Pack sans licence déclarée\n\nTexte.\n');
      return d;
    }, /^\[licence-inconnue\] LICENSE-Pack\.txt : « Pack sans licence déclarée »$/],
    ['une licence de pack vide', () => {
      const d = dossierDeProduction();
      writeFileSync(join(d, 'LICENSE-Pack.txt'), '\n  \n');
      return d;
    }, /^LICENSE-Pack\.txt : texte vide, ni ligne « License: » ni titre$/],
  ])('refuse %s sans rien publier ni écrire', (_, dossier, motif) => {
    const destination = join(temporaire(), 'modeles');
    const { verses, publier } = publication();
    const r = importerPersonnage({ dossier: dossier(), id: 'Essai', destination, date: '2026-10-23', publier });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refus.join('\n')).toMatch(motif);
    expect(verses).toEqual([]);
    expect(existsSync(destination)).toBe(false);
  });

  it('dépose deux textes distincts d’une même licence, de deux packs homonymes, sous deux noms', () => {
    const destination = temporaire();
    const textes = ['Pack A\nLicense: CC0\n', 'Pack B\nLicense: (Creative Commons Zero, CC0)\n'];
    for (const [i, texte] of textes.entries()) {
      const dossier = dossierDeProduction((m) => { m.manifeste = baseDeTest(`base${i}`); });
      writeFileSync(join(dossier, 'LICENSE.txt'), texte);
      expect(importerPersonnage({ dossier, id: `Essai${i}`, destination, date: '2026-10-23', publier: null }).ok).toBe(true);
    }
    expect(textes.map((t) => readFileSync(join(destination, nomCC0(t)), 'utf8'))).toEqual(textes);
  });

  it('redépose sous le même nom le même texte de licence', () => {
    const destination = temporaire();
    const texte = 'Pack\nLicense: CC0\n';
    for (const id of ['Essai', 'Autre']) {
      const dossier = dossierDeProduction((m) => { m.manifeste = baseDeTest(id); });
      writeFileSync(join(dossier, 'LICENSE-Pack.txt'), texte);
      const r = importerPersonnage({ dossier, id, destination, date: '2026-10-23', publier: null });
      expect(r.ok && r.provenance.licences_de_pack).toEqual([{ fichier: nomCC0(texte), licence: 'CC0' }]);
    }
  });

  it('dépose une seule fois deux textes identiques de deux packs', () => {
    const destination = temporaire();
    const dossier = dossierDeProduction();
    const texte = 'Pack\nLicense: CC0\n';
    for (const nom of ['LICENSE-UAL1.txt', 'LICENSE-UAL2.txt']) writeFileSync(join(dossier, nom), texte);
    const r = importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-29', publier: null });
    expect(r.ok && [r.provenance.licences_de_pack, r.ecrits.filter((e) => e.endsWith(nomCC0(texte)))]).toEqual([[{ fichier: nomCC0(texte), licence: 'CC0' }], [join(destination, nomCC0(texte))]]);
  });

  it('refuse un élément sans composant licencié ni texte de licence, sans rien écrire', () => {
    const destination = temporaire();
    deposerModeleDeTest(destination, 'humanoide', baseDeTest(), GLB_DE_BASE);
    const dossier = productionDeTest(temporaire(), elementSchema3(), GLB_D_ELEMENT);
    rmSync(join(dossier, LICENCE_DE_PRODUCTION));
    const avant = photo(destination);
    const r = importerPersonnage({ dossier, id: 'epee', destination, date: '2026-10-29', publier: null });
    expect(r.ok ? r : r.refus.join('\n')).toMatch(/^\[licence-absente\] /);
    expect(photo(destination)).toEqual(avant);
  });

  it('n’écrit rien quand la publication lève', () => {
    const destination = join(temporaire(), 'modeles');
    const publier = () => { throw new Error('gh release upload : code 1'); };
    expect(() => importerPersonnage({ dossier: dossierDeProduction(), id: 'Essai', destination, date: '2026-10-23', publier })).toThrow(/code 1/);
    expect(existsSync(destination)).toBe(false);
  });
});

/** Un dossier de modèles : le manifeste de la base de test et la provenance `provenance`, sous l'id `Essai`, sans GLB. */
function dossierDeModeles(provenance: Record<string, unknown> = { model: 'Essai.glb', model_sha256: EMPREINTE }) {
  const d = temporaire();
  writeFileSync(join(d, 'Essai.manifeste.json'), JSON.stringify(baseDeTest()));
  writeFileSync(join(d, 'Essai.provenance.json'), JSON.stringify(provenance));
  return d;
}

/** Un téléchargement qui sert `fichiers` par URL, 404 ailleurs, et consigne les URL demandées. */
const serveur = (fichiers: Record<string, Uint8Array>) => {
  const demandes: string[] = [];
  const telecharger = async (url: string) => {
    demandes.push(url);
    const octets = fichiers[url];
    return { ok: !!octets, status: octets ? 200 : 404, arrayBuffer: async () => (octets ?? new Uint8Array()).slice().buffer };
  };
  return { demandes, telecharger };
};

const muet = () => {};

describe('chargerLicences', () => {
  it('associe chaque texte de la table à un identifiant de forme SPDX', () => {
    const horsForme = [...chargerLicences()].filter(([, spdx]) => !/^[A-Za-z0-9.+-]+$/.test(spdx));
    expect(horsForme).toEqual([]);
  });

  it('connaît chaque alias CC0 de la Figurine', () => {
    const table = chargerLicences();
    expect(['CC0', 'CC-0', 'CC0 (official asset-pack page)'].map((t) => table.get(t))).toEqual(['CC0-1.0', 'CC0-1.0', 'CC0-1.0']);
  });

  it.each([
    ['un tableau', '["CC0"]', /un objet attendu$/],
    ['un identifiant non textuel', '{ "CC0": "CC0-1.0", "MIT": 1 }', /identifiant non textuel pour « MIT »$/],
    ['un JSON illisible', '{ "CC0": ', /JSON/],
  ])('refuse une table qui porte %s, en nommant le fichier', (_, contenu, raison) => {
    const chemin = join(temporaire(), 'licences.json');
    writeFileSync(chemin, contenu);
    expect(() => chargerLicences(chemin)).toThrow(TableDesLicencesInvalide);
    expect(() => chargerLicences(chemin)).toThrow(`(${chemin})`);
    expect(() => chargerLicences(chemin)).toThrow(raison);
  });
});

describe('modelesEpingles', () => {
  it('épingle chaque modèle par sa provenance', () => {
    expect(modelesEpingles(dossierDeModeles())).toEqual({ modeles: [{ id: 'Essai', model: 'Essai.glb', empreinte: EMPREINTE, licences: [] }], erreurs: [] });
  });
  it('lit les textes de licence et la raison hors Release de la provenance', () => {
    const d = dossierDeModeles({ model: 'Essai.glb', model_sha256: EMPREINTE, licences_de_pack: [{ fichier: 'LICENSE-CC0-1.0-a.txt', licence: 'CC0' }], hors_release: 'essai' });
    expect(modelesEpingles(d).modeles).toEqual([{ id: 'Essai', model: 'Essai.glb', empreinte: EMPREINTE, licences: ['LICENSE-CC0-1.0-a.txt'], hors_release: 'essai' }]);
  });
  it.each<[string, (d: string) => void, RegExp]>([
    ['un manifeste sans provenance', (d) => rmSync(join(d, 'Essai.provenance.json')), /provenance Essai\.provenance\.json absente/],
    ['une provenance sans manifeste', (d) => rmSync(join(d, 'Essai.manifeste.json')), /manifeste Essai\.manifeste\.json absent/],
    ['une empreinte qui n’est pas un SHA-256', (d) => writeFileSync(join(d, 'Essai.provenance.json'), JSON.stringify({ model: 'Essai.glb', model_sha256: 'abc' })), /n'est pas un SHA-256/],
    ['une provenance illisible', (d) => writeFileSync(join(d, 'Essai.provenance.json'), '{'), /Essai\.provenance\.json : JSON illisible/],
    ['un model qui n’est pas <id>.glb', (d) => writeFileSync(join(d, 'Essai.provenance.json'), JSON.stringify({ model: 'Autre.glb', model_sha256: EMPREINTE })), /Essai\.glb attendu/],
  ])('refuse %s', (_, muter, motif) => {
    const d = dossierDeModeles();
    muter(d);
    expect(modelesEpingles(d).erreurs.join('\n')).toMatch(motif);
  });
});

describe('modelesAPublier', () => {
  it('rend le GLB de chaque modèle épinglé sous le nom de son empreinte', () => {
    const d = dossierDeModeles();
    expect(modelesAPublier(d)).toEqual([{ chemin: join(d, 'Essai.glb'), nom: `${EMPREINTE}.glb` }]);
  });
  it('laisse un modèle tenu hors Release', () => {
    expect(modelesAPublier(dossierDeModeles({ model: 'Essai.glb', model_sha256: EMPREINTE, hors_release: 'essai' }))).toEqual([]);
  });
  it('lève sur des modèles mal épinglés', () => {
    const d = dossierDeModeles();
    rmSync(join(d, 'Essai.provenance.json'));
    expect(() => modelesAPublier(d)).toThrow(/modèles mal épinglés :\n {2}.*provenance Essai\.provenance\.json absente/);
  });
});

describe('recupererEpingles', () => {
  const COULEUR = new Uint8Array(Buffer.from('couleur de l’herbe'));
  const KIT = new Uint8Array(Buffer.from('le kit des arêtes'));
  const urlDe = (octets: Uint8Array, extension: 'jpg' | 'glb') => urlDAsset(nomDAsset(sha256(octets), extension));
  /** Un dossier épinglé dont la provenance porte `provenance`. */
  const dossierEpingle = (provenance: unknown) => {
    const d = temporaire();
    writeFileSync(join(d, 'provenance.json'), JSON.stringify(provenance));
    return d;
  };
  /** Le dossier des textures, qui épingle l'herbe, et celui du kit. */
  const dossiers = () => [
    dossierEpingle({ 'terrain--herbe.jpg': { sha256: sha256(COULEUR), licence: 'CC0-1.0' } }),
    dossierEpingle({ 'kit.glb': { sha256: sha256(KIT), licence: 'CC0-1.0' } }),
  ];
  const release = () => serveur({ [urlDe(COULEUR, 'jpg')]: COULEUR, [urlDe(KIT, 'glb')]: KIT });
  it('tire de la Release chaque fichier absent de chaque dossier, le dépose sous son nom ; le cache sert l’appel suivant', async () => {
    const [textures, kit] = dossiers();
    const cache = temporaire();
    const { demandes, telecharger } = release();
    await recupererEpingles({ dossiers: [textures, kit], cache, telecharger, journal: muet });
    expect(readFileSync(join(textures, 'terrain--herbe.jpg'))).toEqual(Buffer.from(COULEUR));
    expect(readFileSync(join(kit, 'kit.glb'))).toEqual(Buffer.from(KIT));
    rmSync(join(kit, 'kit.glb'));
    await recupererEpingles({ dossiers: [textures, kit], cache, telecharger, journal: muet });
    expect(demandes).toEqual([urlDe(COULEUR, 'jpg'), urlDe(KIT, 'glb')]);
  });
  it('garde hors ligne un fichier du projet à la somme épinglée', async () => {
    const [textures] = dossiers();
    writeFileSync(join(textures, 'terrain--herbe.jpg'), COULEUR);
    const { demandes, telecharger } = serveur({});
    await recupererEpingles({ dossiers: [textures], cache: temporaire(), telecharger, journal: muet });
    expect(demandes).toEqual([]);
  });
  it('remplace un fichier périmé du projet, et lève sur un fichier absent de la Release', async () => {
    const [textures, kit] = dossiers();
    writeFileSync(join(textures, 'terrain--herbe.jpg'), 'ancienne herbe');
    await recupererEpingles({ dossiers: [textures], cache: temporaire(), telecharger: release().telecharger, journal: muet });
    expect(readFileSync(join(textures, 'terrain--herbe.jpg'))).toEqual(Buffer.from(COULEUR));
    await expect(recupererEpingles({ dossiers: [kit], cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet })).rejects.toThrow(AssetIntrouvable);
  });
  it.each<[string, unknown, string]>([
    ['un fichier sans SHA-256', { 'kit.glb': { licence: 'CC0-1.0' } }, 'kit.glb.sha256 « undefined » n\'est pas un SHA-256'],
    ['une extension que la Release ne porte pas', { 'kit.png': { sha256: sha256(KIT) } }, 'kit.png n\'a pas une extension de la Release'],
  ])('refuse %s', (_, provenance, motif) => {
    expect(() => epinglesAPublier([dossierEpingle(provenance)])).toThrow(motif);
  });
  it('nomme chaque fichier à verser par son empreinte', () => {
    const [textures, kit] = dossiers();
    expect(epinglesAPublier([textures, kit])).toEqual([
      { chemin: join(textures, 'terrain--herbe.jpg'), nom: nomDAsset(sha256(COULEUR), 'jpg') },
      { chemin: join(kit, 'kit.glb'), nom: nomDAsset(sha256(KIT), 'glb') },
    ]);
  });
});

describe('recupererModeles', () => {
  const url = urlDAsset(nomDAsset(EMPREINTE, 'glb'));
  it('tire de la Release le GLB_DE_BASE absent du cache, le vérifie et le dépose ; le cache sert l’appel suivant', async () => {
    const dossier = dossierDeModeles();
    const cache = temporaire();
    const { demandes, telecharger } = serveur({ [url]: GLB_DE_BASE });
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(readFileSync(join(dossier, 'Essai.glb'))).toEqual(Buffer.from(GLB_DE_BASE));
    rmSync(join(dossier, 'Essai.glb'));
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(demandes).toEqual([url]);
    expect(existsSync(join(dossier, 'Essai.glb'))).toBe(true);
  });
  it('refuse au chargement Release un os absent du GLB_DE_BASE', async () => {
    const dossier = dossierDeModeles();
    writeFileSync(join(dossier, 'Essai.manifeste.json'), JSON.stringify({ ...baseDeTest(), os: ['os-absent'] }));
    await expect(recupererModeles({ dossier, cache: temporaire(), telecharger: serveur({ [url]: GLB_DE_BASE }).telecharger, journal: muet })).rejects.toThrow(/\[os-inconnu\]/);
  });
  it('ne réclame jamais à la Release un modèle hors Release : le GLB_DE_BASE du poste sert, son absence lève', async () => {
    const dossier = dossierDeModeles({ model: 'Essai.glb', model_sha256: EMPREINTE, hors_release: 'essai sur le poste' });
    const { demandes, telecharger } = serveur({ [url]: GLB_DE_BASE });
    await expect(recupererModeles({ dossier, cache: temporaire(), telecharger, journal: muet })).rejects.toThrow(`[hors-release] Essai.glb (${EMPREINTE}) : essai sur le poste`);
    writeFileSync(join(dossier, 'Essai.glb'), GLB_DE_BASE);
    await recupererModeles({ dossier, cache: temporaire(), telecharger, journal: muet });
    expect(demandes).toEqual([]);
  });
  it('lève AssetIntrouvable quand la Release répond 404 sur l’empreinte', async () => {
    await expect(recupererModeles({ dossier: dossierDeModeles(), cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet })).rejects.toThrow(AssetIntrouvable);
  });
  const sansCorps = async () => new ArrayBuffer(0);
  it.each<[string, Parameters<typeof recupererModeles>[0]['telecharger']]>([
    ['hors ligne', async () => { throw new TypeError('fetch failed'); }],
    ['sur un HTTP 503', async () => ({ ok: false, status: 503, arrayBuffer: sansCorps })],
    ['sur un HTTP 403', async () => ({ ok: false, status: 403, arrayBuffer: sansCorps })],
    ['sur un corps coupé après un 200', async () => ({ ok: true, status: 200, arrayBuffer: async () => { throw new TypeError('terminated'); } })],
  ])('lève ReleaseInjoignable %s, le cache vide', async (_, telecharger) => {
    await expect(recupererModeles({ dossier: dossierDeModeles(), cache: temporaire(), telecharger, journal: muet })).rejects.toThrow(ReleaseInjoignable);
  });
  /** Une Release dont le lien direct répond `statut`, et dont l'API liste `listes` (nom → octets) ; consigne chaque
   *  demande avec son en-tête `accept`. */
  const releaseEnPanne = (statut: number, listes: Record<string, Uint8Array>) => {
    const demandes: string[] = [];
    const telecharger = async (url: string, init?: { readonly headers: Readonly<Record<string, string>> }) => {
      demandes.push(`${url} ${init?.headers.accept ?? '-'}`);
      const api = `https://api.github.com/repos/${DEPOT}/releases/assets/`;
      const octets = url === URL_API_DE_LA_RELEASE
        ? new TextEncoder().encode(JSON.stringify({ assets: Object.keys(listes).map((name, i) => ({ name, url: `${api}${i}` })) }))
        : url.startsWith(api) ? Object.values(listes)[Number(url.slice(api.length))] : undefined;
      return { ok: !!octets, status: octets ? 200 : statut, arrayBuffer: async () => (octets ?? new Uint8Array()).slice().buffer };
    };
    return { demandes, telecharger };
  };
  it('se replie sur le point d’API quand le lien direct répond 504 (#3680)', async () => {
    const dossier = dossierDeModeles();
    const { demandes, telecharger } = releaseEnPanne(504, { [nomDAsset(EMPREINTE, 'glb')]: GLB_DE_BASE });
    await recupererModeles({ dossier, cache: temporaire(), telecharger, journal: muet });
    expect(readFileSync(join(dossier, 'Essai.glb'))).toEqual(Buffer.from(GLB_DE_BASE));
    expect(demandes).toEqual([`${urlDAsset(nomDAsset(EMPREINTE, 'glb'))} -`, `${URL_API_DE_LA_RELEASE} application/vnd.github+json`,
      `https://api.github.com/repos/${DEPOT}/releases/assets/0 application/octet-stream`]);
  });
  it('lève AssetIntrouvable quand le repli ne trouve pas le fichier dans la liste de la Release', async () => {
    await expect(recupererModeles({ dossier: dossierDeModeles(), cache: temporaire(), telecharger: releaseEnPanne(504, {}).telecharger, journal: muet })).rejects.toThrow(AssetIntrouvable);
  });
  it('accepte hors ligne le GLB_DE_BASE du projet à la somme épinglée et en amorce le cache', async () => {
    const dossier = dossierDeModeles();
    const cache = temporaire();
    writeFileSync(join(dossier, 'Essai.glb'), GLB_DE_BASE);
    const { demandes, telecharger } = serveur({});
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(demandes).toEqual([]);
    expect(readFileSync(join(cache, nomDAsset(EMPREINTE, 'glb')))).toEqual(Buffer.from(GLB_DE_BASE));
  });
  it('tire de nouveau un fichier corrompu du cache', async () => {
    const dossier = dossierDeModeles();
    const cache = temporaire();
    writeFileSync(join(cache, nomDAsset(EMPREINTE, 'glb')), 'corrompu');
    const { demandes, telecharger } = serveur({ [url]: GLB_DE_BASE });
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(demandes).toEqual([url]);
    expect(readFileSync(join(cache, nomDAsset(EMPREINTE, 'glb')))).toEqual(Buffer.from(GLB_DE_BASE));
  });
  it('remplace le GLB_DE_BASE périmé du projet par celui du cache', async () => {
    const dossier = dossierDeModeles();
    const cache = temporaire();
    writeFileSync(join(cache, nomDAsset(EMPREINTE, 'glb')), GLB_DE_BASE);
    writeFileSync(join(dossier, 'Essai.glb'), glb(['corps'], []));
    const { demandes, telecharger } = serveur({});
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(demandes).toEqual([]);
    expect(readFileSync(join(dossier, 'Essai.glb'))).toEqual(Buffer.from(GLB_DE_BASE));
  });
  it('lève quand le fichier reçu n’a pas la somme épinglée', async () => {
    const autre = glb(['corps'], []);
    const telecharger = serveur({ [url]: autre }).telecharger;
    await expect(recupererModeles({ dossier: dossierDeModeles(), cache: temporaire(), telecharger, journal: muet })).rejects.toThrow(`Essai.glb : SHA-256 ${sha256(autre)}, ${EMPREINTE} attendue`);
  });
  it('lève quand le manifeste ne se valide pas contre le GLB_DE_BASE tiré', async () => {
    const dossier = dossierDeModeles();
    const manifeste = JSON.parse(readFileSync(join(dossier, 'Essai.manifeste.json'), 'utf8'));
    manifeste.clips.marche = 'Walking_A';
    writeFileSync(join(dossier, 'Essai.manifeste.json'), JSON.stringify(manifeste));
    await expect(recupererModeles({ dossier, cache: temporaire(), telecharger: serveur({ [url]: GLB_DE_BASE }).telecharger, journal: muet })).rejects.toThrow(/clip-absent/);
  });
});

describe('publierAssets', () => {
  /** Un `gh` simulé : la vue de la Release rend les noms `vue`, ou l'échec `vue` ; `create` et `upload` rendent
   *  `reponses` (succès par défaut) ; toute autre commande lève. Il consigne ses appels. */
  const ghSimule = (vue: string[] | { status: number; stderr: string }, reponses: Partial<Record<'create' | 'upload', ReturnType<Gh>>> = {}) => {
    const appels: string[][] = [];
    const ok = { status: 0, stdout: '', stderr: '' };
    const gh: Gh = (args) => {
      appels.push([...args]);
      const sous = args[1];
      if (sous === 'view') return Array.isArray(vue) ? { ...ok, stdout: JSON.stringify({ assets: vue.map((name) => ({ name })) }) } : { stdout: '', ...vue };
      if (sous === 'create' || sous === 'upload') return reponses[sous] ?? ok;
      throw new Error(`gh ${args.join(' ')} : commande inattendue`);
    };
    return { appels, gh };
  };
  const absente = { status: 1, stderr: 'release not found' };
  const asset = () => {
    const d = temporaire();
    writeFileSync(join(d, 'animated.glb'), GLB_DE_BASE);
    return { chemin: join(d, 'animated.glb'), nom: `${EMPREINTE}.glb` };
  };
  it('crée la Release absente, puis y verse le fichier sous son nom d’asset', () => {
    const { appels, gh } = ghSimule(absente);
    expect(publierAssets([asset()], gh)).toEqual([`${EMPREINTE}.glb`]);
    expect(appels.map((a) => a.slice(0, 3))).toEqual([['release', 'view', TAG], ['release', 'create', TAG], ['release', 'upload', TAG]]);
    expect(appels[2]?.[appels[2].length - 1]?.endsWith(`${EMPREINTE}.glb`)).toBe(true);
  });
  it('verse une fois un fichier que plusieurs modèles partagent', () => {
    const { appels, gh } = ghSimule([]);
    expect(publierAssets([asset(), asset()], gh)).toEqual([`${EMPREINTE}.glb`]);
    expect(appels.filter((a) => a[1] === 'upload').map((a) => a.filter((x) => x.endsWith('.glb')))).toEqual([[expect.stringMatching(new RegExp(`${EMPREINTE}\\.glb$`))]]);
  });
  it('ne reverse pas un fichier que la Release porte déjà', () => {
    const { appels, gh } = ghSimule([`${EMPREINTE}.glb`]);
    expect(publierAssets([asset()], gh)).toEqual([]);
    expect(appels).toHaveLength(1);
  });
  it('lève, avec la sortie de gh, quand la vue échoue autrement que par une Release absente', () => {
    const { appels, gh } = ghSimule({ status: 4, stderr: 'HTTP 401: Bad credentials' });
    expect(() => publierAssets([asset()], gh)).toThrow(`gh release view ${TAG} : code 4\nHTTP 401: Bad credentials`);
    expect(appels).toHaveLength(1);
  });
  it('lève sans rien verser sur un fichier dont l’empreinte n’est pas celle de son nom', () => {
    const { appels, gh } = ghSimule([]);
    const faux = `${'0'.repeat(64)}.glb`;
    expect(() => publierAssets([{ ...asset(), nom: faux }], gh)).toThrow(`empreinte ${EMPREINTE}, ${faux} attendu`);
    expect(appels).toHaveLength(1);
  });
  it('lève, avec la sortie de gh, quand le versement échoue', () => {
    const { gh } = ghSimule([], { upload: { status: 1, stdout: '', stderr: 'HTTP 422: asset exists' } });
    expect(() => publierAssets([asset()], gh)).toThrow(/^gh release upload modeles-3d .* : code 1\nHTTP 422: asset exists$/s);
  });
});

describe('les modèles commités', () => {
  // Le cache des modèles de la machine (`CACHE_DES_MODELES`, restauré par la CI avant cette suite) : un cache neuf
  // tirerait de la Release les GLB épinglés, ~45 Mo, à chaque passage. Le délai couvre ce tirage quand l'empreinte
  // épinglée change et que le cache ne l'a pas encore.
  it('valident chacun leur manifeste contre le GLB épinglé', async () => {
    const modeles = await recupererModeles({ dossier: DOSSIER_DES_MODELES, journal: muet });
    expect(modeles.length).toBeGreaterThan(0);
  }, 180_000);
  it('sont épinglés chacun par sa provenance', () => {
    const { modeles, erreurs } = modelesEpingles(DOSSIER_DES_MODELES);
    expect(erreurs).toEqual([]);
    expect(modeles.length).toBeGreaterThan(0);
  });
  it('ne suivent aucun fichier hors Release', () => {
    const suivis = listerImage(depotDe(DOSSIER_DES_MODELES), INDEX, '.');
    expect(suivisHorsRelease(modelesEpingles(DOSSIER_DES_MODELES).modeles, suivis)).toEqual([]);
  });
  it('gardent chaque texte de licence à l’octet de l’empreinte que son nom porte (.gitattributes)', () => {
    const licences = listerImage(depotDe(DOSSIER_DES_MODELES), INDEX, '.').filter((f) => /^LICENSE-.*\.txt$/.test(f));
    expect(licences.length).toBeGreaterThan(0);
    const divergentes = licences.filter((f) => !f.endsWith(`-${sha256(readFileSync(join(DOSSIER_DES_MODELES, f))).slice(0, 16)}.txt`));
    expect(divergentes).toEqual([]);
  });
});

describe('suivisHorsRelease', () => {
  const publie = { id: 'humanoide', model: 'humanoide.glb', empreinte: EMPREINTE, licences: ['LICENSE-CC0-1.0-commune.txt'] };
  const local = { id: 'epee-essai', model: 'epee-essai.glb', empreinte: EMPREINTE, licences: ['LICENSE-CC0-1.0-commune.txt', 'LICENSE-CC0-1.0-essai.txt'], hors_release: 'essai sur le poste' };
  it('rend les fichiers suivis d’un modèle hors Release et les licences qu’aucun modèle publié ne nomme', () => {
    const suivis = ['humanoide.glb.import', 'humanoide.manifeste.json', 'humanoide.provenance.json', 'LICENSE-CC0-1.0-commune.txt', 'LICENSE-CC0-1.0-essai.txt', 'epee-essai.glb.import', 'epee-essai.manifeste.json', 'epee-essai.provenance.json', 'epee-essai_bis.manifeste.json'];
    expect(suivisHorsRelease([publie, local], suivis)).toEqual(['LICENSE-CC0-1.0-essai.txt', 'epee-essai.glb.import', 'epee-essai.manifeste.json', 'epee-essai.provenance.json']);
  });
  it('laisse les fichiers des seuls modèles publiés', () => {
    expect(suivisHorsRelease([publie, local], ['humanoide.manifeste.json', 'humanoide.provenance.json', 'LICENSE-CC0-1.0-commune.txt'])).toEqual([]);
  });
});

describe('dossier de production d’une base (#3106)', () => {
  /** Le texte de licence des packs Quaternius UAL1, UAL2 et UBC, à l'octet près (CRLF, espace final). */
  const LICENCE_QUATERNIUS = '-----------------------------\r\nLicense:\r\nCC0 1.0 Universal (CC0 1.0) \r\nPublic Domain Dedication\r\n';
  /** Un texte de licence du pack de corps, distinct de `LICENCE_QUATERNIUS` : chaque pack se relie à SON dépôt. */
  const LICENCE_DU_CORPS = 'Ultimate Base Characters\r\nLicense:\r\nCC0 1.0 Universal (CC0 1.0) \r\n';
  /** Le texte de licence des données MPFB : sans ligne `License:`, sa licence est son titre (LICENSE.ASSETS.md de
   *  makehumancommunity/mpfb2, début). */
  const LICENCE_MPFB = '# Creative Commons CC0 1.0 Universal\n\nCREATIVE COMMONS CORPORATION IS NOT A LAW FIRM AND DOES NOT PROVIDE LEGAL SERVICES.\n';
  const PACKS = ['ual1', 'ual2', 'corps', 'corps-feminin', 'mpfb'] as const;
  /** Un pack : son texte de licence `licence`, de contenu `texte`, à la racine, le fichier source `fichier` deux dossiers plus bas. */
  const pack = (fichier: string, licence = 'License.txt', texte = LICENCE_QUATERNIUS) => {
    const racine = temporaire();
    writeFileSync(join(racine, licence), texte);
    mkdirSync(join(racine, 'Godot', 'sous'), { recursive: true });
    writeFileSync(join(racine, 'Godot', 'sous', fichier), `octets de ${fichier}`);
    return { source: join(racine, 'Godot', 'sous', fichier), licence: join(racine, licence) };
  };
  /** Les fichiers du dossier `data` du pack MPFB, par chemin relatif POSIX : `version.txt`, à la racine, se lit avant
   *  les sous-dossiers mais se trie après eux. */
  const DONNEES_MPFB = { '3dobjs/base.obj': 'octets de base.obj', 'targets/macrodetails/universal.target.gz': 'octets de la cible', 'version.txt': 'octets de version' };
  /** Le pack MPFB : son texte de licence à la racine, sa source le dossier `mpfb/data` qui porte `DONNEES_MPFB`. */
  const packDeDonnees = () => {
    const racine = temporaire();
    writeFileSync(join(racine, 'LICENSE.ASSETS.md'), LICENCE_MPFB);
    for (const [fichier, octets] of Object.entries(DONNEES_MPFB)) {
      mkdirSync(join(racine, 'mpfb', 'data', fichier, '..'), { recursive: true });
      writeFileSync(join(racine, 'mpfb', 'data', fichier), octets);
    }
    return { source: join(racine, 'mpfb', 'data'), licence: join(racine, 'LICENSE.ASSETS.md') };
  };
  /** L'empreinte d'un dossier qui porte `DONNEES_MPFB` : celle de la liste triée « chemin relatif POSIX, SHA-256 ». */
  const EMPREINTE_MPFB = sha256(Buffer.from(Object.entries(DONNEES_MPFB).map(([f, o]) => `${f} ${sha256(Buffer.from(o))}\n`).sort().join('')));
  /** Les sources d'une base et le texte de licence nommé pour chacune, le pack de `remplace` substitué. */
  const packs = (remplace: Partial<Record<(typeof PACKS)[number], ReturnType<typeof pack>>> = {}): { sources: SourcesDeBase; licences: SourcesDeBase } => {
    const p = { ual1: pack('UAL1_Standard.glb'), ual2: pack('UAL2_Standard.glb'), corps: pack('Superhero_Male_FullBody.gltf', 'License_Standard.txt', LICENCE_DU_CORPS),
      'corps-feminin': pack('Superhero_Female_FullBody.gltf', 'License_Standard.txt', LICENCE_DU_CORPS), mpfb: packDeDonnees(), ...remplace };
    return { sources: tableTotale(PACKS, (s) => p[s].source), licences: tableTotale(PACKS, (s) => p[s].licence) };
  };
  /** Le GLB de base exporté dans un dossier de sortie neuf, puis son dossier de production écrit. */
  const construite = (p = packs()): string => {
    const glb = join(temporaire(), 'humanoide.glb');
    writeFileSync(glb, GLB_DE_BASE);
    ecrireProduction({ glb, manifeste: baseDeTest(), ...p });
    return glb;
  };

  it('s’importe avec publication sans geste à la main, licences des packs copiées à l’octet', () => {
    const p = packs();
    const { sources } = p;
    const glb = construite(p);
    const dossier = join(glb, '..');
    ecrireProduction({ glb, manifeste: baseDeTest(), ...p });
    const manifest = JSON.parse(readFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), 'utf8'));
    expect(PACKS.map((s) => readFileSync(join(dossier, `LICENSE-${s}.txt`), 'utf8'))).toEqual([LICENCE_QUATERNIUS, LICENCE_QUATERNIUS, LICENCE_DU_CORPS, LICENCE_DU_CORPS, LICENCE_MPFB]);
    const destination = temporaire();
    const verses: AssetAPublier[] = [];
    const r = importerPersonnage({ dossier, id: 'humanoide', destination, date: '2026-10-29', publier: a => { verses.push(...a); return a.map(x => x.nom); } });
    expect(r.ok ? r.publies : r.refus).toEqual([nomDAsset(sha256(GLB_DE_BASE), 'glb')]);
    expect(verses).toEqual([{ chemin: glb, nom: nomDAsset(sha256(GLB_DE_BASE), 'glb') }]);
    expect(manifest).toEqual({
      model: 'humanoide.glb', model_sha256: sha256(GLB_DE_BASE), manifeste: baseDeTest(),
      packs_sources: tableTotale(PACKS, (s) => ({ path: sources[s], sha256: s === 'mpfb' ? EMPREINTE_MPFB : sha256(readFileSync(sources[s])), licence: `LICENSE-${s}.txt` })),
    });
    expect(r.ok ? r.provenance.licences_de_pack.map((l) => l.fichier).sort() : r.refus)
      .toEqual([nomCC0(LICENCE_QUATERNIUS), nomCC0(LICENCE_DU_CORPS), nomCC0(LICENCE_MPFB)].sort());
    expect(r.ok ? r.provenance.packs_sources : r.refus).toEqual([
      { pack: 'ual1', fichier: 'UAL1_Standard.glb', sha256: sha256(readFileSync(sources.ual1)), licence: nomCC0(LICENCE_QUATERNIUS) },
      { pack: 'ual2', fichier: 'UAL2_Standard.glb', sha256: sha256(readFileSync(sources.ual2)), licence: nomCC0(LICENCE_QUATERNIUS) },
      { pack: 'corps', fichier: 'Superhero_Male_FullBody.gltf', sha256: sha256(readFileSync(sources.corps)), licence: nomCC0(LICENCE_DU_CORPS) },
      { pack: 'corps-feminin', fichier: 'Superhero_Female_FullBody.gltf', sha256: sha256(readFileSync(sources['corps-feminin'])), licence: nomCC0(LICENCE_DU_CORPS) },
      { pack: 'mpfb', fichier: 'data', sha256: EMPREINTE_MPFB, licence: nomCC0(LICENCE_MPFB) },
    ]);
    expect(JSON.parse(readFileSync(join(destination, 'humanoide.manifeste.json'), 'utf8'))).toEqual(baseDeTest());
  });

  it.each<[string, (m: Record<string, unknown>) => void, string]>([
    ['se déclare hors Release', (m) => { m.hors_release = 'essai sur le poste'; }, '[base-hors-release] manifest.json : une base ne peut pas être hors Release'],
    ['porte une raison hors Release vide', (m) => { m.hors_release = ' '; }, '[base-hors-release] manifest.json : une base ne peut pas être hors Release'],
    ['porte un marqueur hors Release nul', (m) => { m.hors_release = null; }, '[base-hors-release] manifest.json : une base ne peut pas être hors Release'],
    ['nomme pour un pack un texte de licence absent du dossier', (m) => { (m.packs_sources as Record<string, Record<string, unknown>>).corps.licence = 'LICENSE-ubc.txt'; }, '[licence-de-pack-absente] corps : LICENSE-ubc.txt'],
  ])('refuse avec et sans publication une production qui %s, sans rien publier ni écrire', (_, muter, refus) => {
    const dossier = join(construite(), '..');
    const manifest = JSON.parse(readFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), 'utf8'));
    muter(manifest);
    writeFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), JSON.stringify(manifest));
    for (const publication of [true, false]) {
      const destination = join(temporaire(), 'modeles');
      const verses: AssetAPublier[] = [];
      const r = importerPersonnage({ dossier, id: 'humanoide', destination, date: '2026-10-29', publier: publication ? (a) => { verses.push(...a); return []; } : null });
      expect(r).toEqual({ ok: false, refus: [refus] });
      expect([verses, existsSync(destination)]).toEqual([[], false]);
    }
  });

  /** Une sortie neuve hors dépôt dont le dossier porte déjà le fichier `etranger`. */
  const sortieAvec = (etranger: string): string => {
    const dossier = temporaire();
    writeFileSync(join(dossier, etranger), 'reste');
    return join(dossier, 'humanoide.glb');
  };
  const sortie = () => join(temporaire(), 'humanoide.glb');
  it.each<[string, () => Promise<{ glb: string; sources: SourcesDeBase; licences: SourcesDeBase }>, RegExp]>([
    ['une sortie qui n’est pas un .glb', async () => ({ glb: join(temporaire(), 'humanoide.gltf'), ...packs() }), /^\[sortie\] .*humanoide\.gltf : un \.glb attendu$/],
    ['une sortie dans l’arbre du dépôt', async () => ({ glb: join(process.cwd(), 'production-3106-sonde', 'humanoide.glb'), ...packs() }), /^\[sortie-dans-le-depot\] /],
    ['une sortie dans l’arbre du dépôt par une jonction', async () => {
      const lien = join(temporaire(), 'lien');
      symlinkSync(process.cwd(), lien, 'junction');
      return { glb: join(lien, 'production-3106-sonde', 'humanoide.glb'), ...packs() };
    }, /^\[sortie-dans-le-depot\] /],
    ['une sortie qui porte un texte de licence périmé', async () => ({ glb: sortieAvec('LICENSE-x.txt'), ...packs() }), /^\[sortie-etrangere\] .* : LICENSE-x\.txt ; /],
    ['une sortie qui porte une source .blend', async () => ({ glb: sortieAvec('humanoide.blend'), ...packs() }), /^\[sortie-etrangere\] .* : humanoide\.blend ; /],
    ['une source absente', async () => ({ glb: sortie(), ...packs({ corps: { ...pack('Superhero_Male_FullBody.gltf', 'License_Standard.txt'), source: join(temporaire(), 'Superhero_Male_FullBody.gltf') } }) }), /^\[source-absente\] --corps .*Superhero_Male_FullBody\.gltf : fichier attendu$/],
    ['une source de pack-fichier donnée en dossier', async () => {
      const ual1 = pack('UAL1_Standard.glb');
      return { glb: sortie(), ...packs({ ual1: { ...ual1, source: join(ual1.source, '..') } }) };
    }, /^\[source-absente\] --ual1 .*sous : fichier attendu$/],
    ['une source --mpfb donnée en fichier', async () => ({ glb: sortie(), ...packs({ mpfb: pack('base.obj') }) }), /^\[source-absente\] --mpfb .*base\.obj : dossier non vide attendu$/],
    ['une source --mpfb vide', async () => {
      const mpfb = packDeDonnees();
      const vide = join(mpfb.source, '..', 'vide');
      mkdirSync(join(vide, 'sous'), { recursive: true });
      return { glb: sortie(), ...packs({ mpfb: { ...mpfb, source: vide } }) };
    }, /^\[source-absente\] --mpfb .*vide : dossier non vide attendu$/],
    ['un texte de licence absent', async () => ({ glb: sortie(), ...packs({ ual2: { ...pack('UAL2_Standard.glb'), licence: join(temporaire(), 'License.txt') } }) }), /^\[licence-absente\] .*License\.txt : texte de licence introuvable$/],
    ['un texte de licence hors des dossiers ancêtres de sa source', async () => ({ glb: sortie(), ...packs({ ual1: { ...pack('UAL1_Standard.glb'), licence: pack('Autre.glb').licence } }) }), /^\[licence-hors-des-ancetres\].*License\.txt : hors des dossiers ancêtres de .*UAL1_Standard\.glb$/],
    ['une construction --mpfb sans texte de licence nommé', async () => {
      const { sources, licences: { mpfb: _, ...licences } } = packs();
      return { glb: sortie(), sources, licences: licences as SourcesDeBase };
    }, /^\[licence-non-nommee\] --licence-mpfb$/],
    ['un texte de licence vide', async () => ({ glb: sortie(), ...packs({ corps: pack('Superhero_Male_FullBody.gltf', 'License_Standard.txt', '\r\n \r\n') }) }), /^\[licence-sans-ligne\] .*License_Standard\.txt : texte vide, ni ligne « License: » ni titre$/],
    ['un texte de licence ni à ligne License: ni à titre connu', async () => ({ glb: sortie(), ...packs({ corps: pack('Superhero_Male_FullBody.gltf', 'License_Standard.txt', 'Public Domain Dedication\r\n') }) }), /^\[licence-inconnue\] .*License_Standard\.txt : « Public Domain Dedication » absente de la table des licences$/],
    ['un texte de licence hors de la table des licences', async () => ({ glb: sortie(), ...packs({ ual2: pack('UAL2_Standard.glb', 'License.txt', 'License: MIT\n') }) }), /^\[licence-inconnue\] .*License\.txt : « MIT » absente de la table des licences$/],
  ])('refuse %s sans rien écrire', async (_, cas, motif) => {
    const { glb, ...p } = await cas();
    const avant = existsSync(join(glb, '..')) ? listerDossier(join(glb, '..')) : null;
    expect(() => ecrireProduction({ glb, manifeste: baseDeTest(), ...p })).toThrow(ProductionRefusee);
    expect(() => ecrireProduction({ glb, manifeste: baseDeTest(), ...p })).toThrow(motif);
    expect(existsSync(join(glb, '..')) ? listerDossier(join(glb, '..')) : null).toEqual(avant);
  });
});

// Le contrat d'asset d'un personnage 3D modulaire (#2948) : lecture du GLB, validation du manifeste, import, Release.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { empreinte, sha256 } from './empreinte.ts';
import { ecrireGlb, GlbIllisible, lireGlb } from './glb.ts';
import { chargerLicences, MANIFESTE_DE_PRODUCTION, TableDesLicencesInvalide } from './dossierDeProduction.ts';
import { importerPersonnage } from './importer.ts';
import { ecrireProduction, ProductionRefusee, type SourcesDeBase } from '../../../scripts/personnage-3d/base/production.ts';
import { cheminsAbsolus, validerManifeste, type CodeDErreur } from './manifeste.ts';
import { ATTACHES } from './montage';
import { tableTotale } from '../../../src/lib/tableTotale';
import { depotDe, INDEX, listerImage } from '../../../scripts/guards/lib/gitPorte.mjs';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import { baseSchema3, elementSchema3, GLB_DE_BASE, GLB_D_ELEMENT, LICENCE_DE_PRODUCTION, productionSchema3, deposerSchema3, TEXTE_DE_LICENCE_DE_PRODUCTION } from './schema3.testkit.ts';
import {
  DOSSIER_DES_MODELES, modelesEpingles, ModeleIntrouvable, nomDAsset, publierAssets, recupererModeles, ReleaseInjoignable,
  suivisHorsRelease, TAG, urlDAsset, type AssetAPublier, type Gh,
} from './release.ts';
import { fichiersDuModele } from './modeles';

/** Un GLB minimal : en-tête glTF 2 et chunk JSON portant `nodes` et `animations`. */
function glb(noeuds: readonly string[], animations: readonly string[], options: { skinned?: readonly string[]; joints?: readonly string[] } = {}): Uint8Array {
  return ecrireGlb({ asset: { version: '2.0' }, nodes: noeuds.map((name, mesh) => ({ name, mesh, ...(mesh === 0 ? { children: noeuds.map((_, i) => i).slice(1) } : {}), ...(options.skinned?.includes(name) ? { skin: 0 } : {}) })), meshes: noeuds.map(() => ({ primitives: [{ material: 0 }] })), materials: [{ name: 'texture_de_lame' }], skins: [{ joints: (options.joints ?? noeuds).map(n => noeuds.indexOf(n)) }], animations: animations.map((name) => ({ name })) }, null);
}

const GLB = glb(['corps', 'tete_a', 'casque', 'bouclier', 'epee'], ['Idle', 'Death_A']);

/** L'empreinte du pack source que `production()` déclare. */
const EMPREINTE_DE_PACK = sha256(Buffer.from('UAL1_Standard.glb'));

/** Un manifeste de production valide contre `GLB`, avec des clés que la réduction écarte. */
const production = () => ({
  schema_version: 2,
  rig: 'codex_rig',
  montage: {
    attaches: tableTotale(ATTACHES, () => ({ os: 'corps', position: [0, 0, 0], rotation: [0, 0, 0] })),
    composants: { epee: { prise: 'main', rangement: 'ceinture', matieres: [{ cle: 'metal', piece: 'epee', surface: 0 }] }, bouclier: { prise: 'off', rangement: 'dos', matieres: [{ cle: 'accent', piece: 'bouclier', surface: 0 }] } },
  },
  model: 'animated.glb',
  default_head: 'tete_a',
  head_options: [{ id: 'tete_a', label_fr: 'Visage' }],
  pieces: {
    corps: { node: 'corps', mesh: 'corps', component: 'corps', headVariant: null, hiddenBy: [], label_fr: 'Corps' },
    tete_a: { node: 'tete_a', component: 'tete_a', headVariant: 'tete_a', hiddenBy: ['casque'] },
    casque: { node: 'casque', component: 'casque', headVariant: null, hiddenBy: [] },
    bouclier: { node: 'bouclier', component: 'bouclier', headVariant: null, hiddenBy: [] },
    epee: { node: 'epee', component: 'epee', headVariant: null, hiddenBy: [] },
  },
  components: {
    corps: { label_fr: 'Corps', apparence: null, asset: { file: 'C:\\Users\\x\\corps.mhclo', license_basis: 'explicit asset header', explicit_header: ['# author A', '# license CC0'], packs: [{ pack: 'p', announced_license: 'CC0 (official asset-pack page)' }] } },
    casque: { label_fr: 'Casque', apparence: 'heaume', occupations: ['head_cover'] },
    bouclier: { label_fr: 'Bouclier', apparence: 'rond' },
    epee: { label_fr: 'Épée', apparence: 'epee' },
  },
  incompatibilities: [['casque', 'bouclier']],
  defaults: ['corps', 'casque'],
  presets: { garde: { label_fr: 'Garde', components: ['corps', 'bouclier'] } },
  clips: { idle: 'Idle', death: 'Death_A' },
  packs_sources: { ual1: { path: '/home/x/anims/UAL1_Standard.glb', sha256: EMPREINTE_DE_PACK, licence: LICENCE_DE_PRODUCTION } },
});
/** Le nom de dépôt d'un texte de licence CC0 de contenu `texte` (`nomDeLicence`, `importer.ts`). */
const nomCC0 = (texte: string) => `LICENSE-CC0-1.0-${sha256(Buffer.from(texte)).slice(0, 16)}.txt`;

/** `production()` sans tête interchangeable : aucune `head_options`, aucune pièce de tête. */
const sansTete = () => {
  const m: Omit<ReturnType<typeof production>, 'default_head'> & { default_head: string | null } = production();
  m.default_head = null;
  m.head_options = [];
  delete (m.pieces as Partial<typeof m.pieces>).tete_a;
  return m;
};

const codes = (brut: unknown, contenu = lireGlb(GLB)): CodeDErreur[] => {
  const v = validerManifeste(brut, contenu);
  return v.ok ? [] : v.erreurs.map((e) => e.code);
};

describe('lireGlb', () => {
  it('rend les noms de nœuds et d’animations du chunk JSON', () => {
    const c = lireGlb(GLB);
    expect([...c.noeuds]).toEqual(['corps', 'tete_a', 'casque', 'bouclier', 'epee']);
    expect([...c.animations]).toEqual(['Idle', 'Death_A']);
    expect(c.materiauxParPiece.get('epee')).toEqual(['texture_de_lame']);
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

describe('validerManifeste', () => {
  it('réduit le manifeste de production aux clés du schéma', () => {
    const v = validerManifeste(production(), lireGlb(GLB));
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(Object.keys(v.manifeste)).toEqual(['schema_version', 'model', 'default_head', 'head_options', 'pieces', 'components', 'incompatibilities', 'defaults', 'presets', 'clips', 'montage']);
    expect(v.manifeste.pieces.corps).toEqual({ node: 'corps', component: 'corps', headVariant: null, hiddenBy: [] });
    expect(v.manifeste.components.corps).toEqual({ label_fr: 'Corps', apparence: null });
    expect(v.manifeste.presets.garde).toEqual({ components: ['corps', 'bouclier'] });
  });

  it.each<[string, (m: ReturnType<typeof production>) => void, CodeDErreur]>([
    ['un composant hors des composants et des têtes', (m) => { m.pieces.corps.component = 'cape'; }, 'composant-inconnu'],
    ['une variante de tête inconnue', (m) => { m.pieces.tete_a.headVariant = 'tete_z'; }, 'variante-inconnue'],
    ['un hiddenBy hors des composants', (m) => { m.pieces.tete_a.hiddenBy = ['capuche']; }, 'masque-inconnu'],
    ['une incompatibilité hors des composants', (m) => { m.incompatibilities.push(['casque', 'capuche']); }, 'incompatibilite-inconnue'],
    ['un défaut hors des composants', (m) => { m.defaults.push('capuche'); }, 'defaut-inconnu'],
    ['un préréglage hors des composants', (m) => { m.presets.garde.components.push('capuche'); }, 'preset-inconnu'],
    ['une tête par défaut inconnue', (m) => { m.default_head = 'tete_z'; }, 'tete-inconnue'],
    ['un nœud absent du GLB', (m) => { m.pieces.casque.node = 'Casque_Absent'; }, 'noeud-absent'],
    ['un clip absent du GLB', (m) => { (m.clips as Record<string, string>).walk = 'Walking_A'; }, 'clip-absent'],
    ['un rôle d’animation inconnu', (m) => { (m.clips as Record<string, string>).danse = 'Idle'; }, 'role-inconnu'],
    ['une version de schéma inconnue', (m) => { m.schema_version = 3; }, 'version-inconnue'],
    ['le schéma V1', (m) => { m.schema_version = 1; }, 'version-inconnue'],
    ['une apparence inconnue', (m) => { m.components.epee.apparence = 'apparence-inconnue'; }, 'apparence-inconnue'],
    ['un libellé au lieu d’un id', (m) => { m.components.epee.apparence = 'Épée'; }, 'apparence-inconnue'],
    ['une apparence omise', (m) => { delete (m.components.corps as { apparence?: unknown }).apparence; }, 'forme'],
    ['une apparence de forme fausse', (m) => { (m.components.epee as { apparence: unknown }).apparence = 42; }, 'forme'],
    ['un chemin absolu Windows laissé', (m) => { m.components.casque.label_fr = 'C:\\Users\\x\\casque'; }, 'chemin-absolu'],
    ['un chemin absolu POSIX laissé', (m) => { m.components.casque.label_fr = 'voir /home/x/casque'; }, 'chemin-absolu'],
    ['une forme fausse', (m) => { (m as { pieces: unknown }).pieces = []; }, 'forme'],
  ])('refuse %s', (_, muter, code) => {
    const m = production();
    muter(m);
    expect(codes(m)).toContain(code);
  });

  it.each(['epee', 'epee_ebrechee'])('conserve l’id de catalogue %s, racine ou variante', (apparence) => {
    const m = production();
    m.components.epee.apparence = apparence;
    const v = validerManifeste(m, lireGlb(GLB));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.manifeste.components.epee.apparence).toBe(apparence);
  });

  it('accepte une variante de tête comme composant de pièce', () => {
    expect(codes(production())).toEqual([]);
  });

  it('accepte un personnage sans tête : default_head null, head_options vide', () => {
    const v = validerManifeste(sansTete(), lireGlb(GLB));
    expect(v.ok && v.manifeste.default_head).toBeNull();
  });

  it.each<[string, (m: ReturnType<typeof sansTete>) => void, CodeDErreur]>([
    ['une tête par défaut null malgré des têtes déclarées', (m) => { m.head_options = [{ id: 'tete_a', label_fr: 'Visage' }]; }, 'tete-inconnue'],
    ['une tête par défaut sans aucune tête déclarée', (m) => { m.default_head = 'tete_a'; }, 'tete-inconnue'],
    ['une tête par défaut ni chaîne ni null', (m) => { (m as { default_head: unknown }).default_head = 1; }, 'forme'],
  ])('refuse %s', (_, muter, code) => {
    const m = sansTete();
    muter(m);
    expect(codes(m)).toEqual([code]);
  });
});

describe('montage validé contre le GLB (#2948 L3-b)', () => {
  it('conserve les attaches et les portages déclarés', () => {
    const m = production();
    const v = validerManifeste(m, lireGlb(GLB));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.manifeste.montage).toEqual(m.montage);
  });

  it.each([
    ['une surface absente du GLB', { cle: 'metal', piece: 'epee', surface: 1 }, 'matiere-absente'],
    ['une pièce hors du composant', { cle: 'metal', piece: 'bouclier', surface: 0 }, 'matiere-absente'],
    ['une clé hors du vocabulaire des palettes', { cle: 'inconnue', piece: 'epee', surface: 0 }, 'forme'],
    ['un indice négatif', { cle: 'metal', piece: 'epee', surface: -1 }, 'forme'],
    ['un indice fractionnaire', { cle: 'metal', piece: 'epee', surface: 0.5 }, 'forme'],
  ] as const)('refuse %s', (_, liaison, code) => {
    const m = production();
    m.montage.composants.epee.matieres = [liaison];
    expect(codes(m)).toContain(code);
  });

  it('refuse deux clés qui teintent la même surface', () => {
    const m = production();
    m.montage.composants.epee.matieres.push({ cle: 'cuir', piece: 'epee', surface: 0 });
    expect(codes(m)).toContain('matiere-ambigue');
  });

  it('exige les emplacements de matière pour chaque composant montable', () => {
    const m = production();
    delete (m.montage.composants.epee as { matieres?: unknown }).matieres;
    expect(codes(m)).toContain('forme');
  });

  it('refuse un nœud existant qui n’est pas un os du skin', () => {
    const contenu = lireGlb(glb(['corps', 'tete_a', 'casque', 'bouclier', 'epee'], ['Idle', 'Death_A'], { joints: ['tete_a'] }));
    expect(contenu.noeuds.has('corps')).toBe(true);
    expect(codes(production(), contenu)).toContain('os-absent');
  });

  it('refuse une pièce donneuse skinnée', () => {
    const contenu = lireGlb(glb(['corps', 'tete_a', 'casque', 'bouclier', 'epee'], ['Idle', 'Death_A'], { skinned: ['epee'] }));
    expect(codes(production(), contenu)).toContain('piece-non-rigide');
  });

  it('refuse une prise dont l’os n’est pas le parent de la pièce rigide', () => {
    const m = production();
    m.montage.attaches.main.os = 'tete_a';
    expect(codes(m)).toContain('attache-incompatible');
  });

  it('exige la déclaration de montage', () => {
    const m = production();
    delete (m as { montage?: unknown }).montage;
    expect(codes(m)).toContain('forme');
  });

  it.each(ATTACHES)('exige l’attache %s', nom => {
    const m = production();
    delete (m.montage.attaches as Partial<typeof m.montage.attaches>)[nom];
    expect(codes(m)).toContain('forme');
  });

  it('refuse une position non finie', () => {
    const m = production();
    m.montage.attaches.main.position = [NaN, 0, 0];
    expect(codes(m)).toContain('forme');
  });

  it('refuse un composant de portage inconnu', () => {
    const m = production();
    (m.montage.composants as Record<string, unknown>).fantome = { prise: 'main', rangement: 'dos', matieres: [{ cle: 'metal', piece: 'epee', surface: 0 }] };
    expect(codes(m)).toContain('composant-inconnu');
  });

  it('refuse un corps déclaré comme objet montable', () => {
    const m = production();
    (m.montage.composants as Record<string, unknown>).corps = { prise: 'main', rangement: 'dos', matieres: [{ cle: 'metal', piece: 'corps', surface: 0 }] };
    expect(codes(m)).toContain('composant-inconnu');
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

const EMPREINTE = sha256(GLB);

/** Chaque fichier du dossier `d` et ses octets. */
const photo = (d: string) => listerDossier(d).map((f) => [f, readFileSync(join(d, f)).toString('base64')]);

describe('import et chargement au schéma 3', () => {
  const importer = (destination: string, manifeste: unknown, octets = GLB_D_ELEMENT, id = 'element', publier: ((assets: readonly AssetAPublier[]) => readonly string[]) | null = null) =>
    importerPersonnage({ dossier: productionSchema3(temporaire(), manifeste, octets), id, destination, date: '2026-10-28', publier });
  const avecBase = () => {
    const dossier = temporaire();
    deposerSchema3(dossier, 'corps-reference', baseSchema3(), GLB_DE_BASE);
    return dossier;
  };
  it('publie l’élément avec le GLB de sa base importée sans publier, sous leurs empreintes', () => {
    const destination = temporaire();
    expect(importer(destination, baseSchema3(), GLB_DE_BASE, 'corps-reference').ok).toBe(true);
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
    expect(importer(destination, baseSchema3(), GLB_DE_BASE, 'humanoide').ok).toBe(true);
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
    expect(importer(destination, baseSchema3(), GLB_DE_BASE, 'corps-reference')).toMatchObject({ ok: true, rapport: [] });
    const plumet = { ...elementSchema3(), categorie: 'accessoire', cle: { piece: 'plumet' }, couche: 'tenue' };
    expect(importer(destination, plumet, GLB_D_ELEMENT, 'plumet')).toMatchObject({
      ok: true, rapport: ['[emplacement-non-offert] plumet : plumet se pose sur cimier, que ni la base `humanoide` ni aucune de ses pièces n’offre'],
    });
  });
  it.each([
    ['base-absente', () => temporaire(), () => elementSchema3()],
    ['forme', avecBase, () => ({ ...elementSchema3(), surfaces: undefined })],
    ['glb-different', avecBase, () => ({ ...elementSchema3(), glb: { sha256: 'a'.repeat(64), octets: GLB_D_ELEMENT.byteLength } })],
    ['cle-en-doublon', () => { const d = avecBase(); deposerSchema3(d, 'autre', elementSchema3(), GLB_D_ELEMENT); return d; }, () => elementSchema3()],
    ['base-en-doublon', avecBase, () => baseSchema3()],
    ['categorie-inconnue', avecBase, () => { const { categorie: _c, cle: _k, ...incomplet } = elementSchema3(); return incomplet; }],
    ['os-inconnu', () => { const d = avecBase(); writeFileSync(join(d, 'corps-reference.manifeste.json'), JSON.stringify({ ...baseSchema3(), os: ['absent'] })); return d; }, () => elementSchema3()],
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
  it('seule la déclaration propre de l’élément le tient hors Release, sa base reste publiée', async () => {
    const destination = temporaire();
    const base = productionSchema3(temporaire(), baseSchema3(), GLB_DE_BASE);
    const verses: AssetAPublier[] = [];
    expect(importerPersonnage({ dossier: base, id: 'humanoide', destination, date: '2026-10-29', publier: a => { verses.push(...a); return a.map(x => x.nom); } }).ok).toBe(true);
    expect(verses.map(a => a.nom)).toEqual([nomDAsset(sha256(GLB_DE_BASE), 'glb')]);
    const production = productionSchema3(temporaire(), elementSchema3(), GLB_D_ELEMENT);
    const chemin = join(production, MANIFESTE_DE_PRODUCTION);
    writeFileSync(chemin, JSON.stringify({ ...JSON.parse(readFileSync(chemin, 'utf8')), hors_release: 'essai sur le poste' }));
    const avant = listerDossier(destination);
    const importerEssai = (publier: ((assets: readonly AssetAPublier[]) => readonly string[]) | null) => importerPersonnage({ dossier: production, id: 'epee', destination, date: '2026-10-31', publier });
    expect(importerEssai(a => { verses.push(...a); return []; }))
      .toEqual({ ok: false, refus: ['[hors-release] essai sur le poste : import sans publication seulement (--sans-publier)'] });
    expect([verses.length, listerDossier(destination)]).toEqual([1, avant]);
    const r = importerEssai(null);
    expect(r.ok && r.provenance.hors_release).toBe('essai sur le poste');
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
    deposerSchema3(d, 'corps-reference', { ...baseSchema3(), emplacements: { epaule_d: { os: 'root', position: [0, 0, 0], rotation: [0, 0, 0] } } }, GLB_DE_BASE);
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
    deposerSchema3(d, 'autre-base', baseSchema3('autre'), GLB_DE_BASE);
    rmSync(join(d, 'autre-base.glb'));
    expect(importer(d, elementSchema3()).ok).toBe(true);
  });
  it('charge ensemble schémas 2 et 3, même quand la base suit l’élément dans le dossier', async () => {
    const d = dossierDeModeles();
    writeFileSync(join(d, 'Essai.glb'), GLB);
    deposerSchema3(d, 'z-base', baseSchema3(), GLB_DE_BASE);
    deposerSchema3(d, 'a-element', elementSchema3(), GLB_D_ELEMENT);
    const r = await recupererModeles({ dossier: d, cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet });
    expect(r.map(m => m.id).sort()).toEqual(['Essai', 'a-element', 'z-base']);
  });
  it.each(['cle-en-doublon', 'base-en-doublon', 'base-absente', 'forme', 'os-inconnu'] as const)('refuse %s au chargement', async code => {
    const d = temporaire();
    if (code !== 'base-absente') deposerSchema3(d, 'base', code === 'os-inconnu' ? { ...baseSchema3(), os: ['absent'] } : baseSchema3(), GLB_DE_BASE);
    deposerSchema3(d, 'a', code === 'forme' ? { ...elementSchema3(), surfaces: undefined } : elementSchema3(), GLB_D_ELEMENT);
    if (code === 'cle-en-doublon') deposerSchema3(d, 'b', elementSchema3(), GLB_D_ELEMENT);
    if (code === 'base-en-doublon') deposerSchema3(d, 'b', baseSchema3(), GLB_DE_BASE);
    await expect(recupererModeles({ dossier: d, cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet })).rejects.toThrow(`[${code}]`);
  });

  /** Une base réexportée : le GLB `octets`, et son manifeste, celui de `baseSchema3(nom)` aux os de `os` renommés `root`. */
  const reexport = (os = 'root', nom = 'humanoide') => {
    const octets = ecrireGlb({ asset: { version: '2.0', generator: 'réexport' }, nodes: [{ name: os }], skins: [{ joints: [0] }], animations: [{ name: 'walk' }] }, null);
    const manifeste = { ...JSON.parse(JSON.stringify(baseSchema3(nom)).split('"root"').join(JSON.stringify(os))), glb: empreinte(octets) };
    return { octets, dossier: productionSchema3(temporaire(), manifeste, octets) };
  };
  /** Une destination où la base `humanoide` est importée, puis l'élément `epee` qui la référence. */
  const baseEtElement = () => {
    const destination = temporaire();
    expect([importer(destination, baseSchema3(), GLB_DE_BASE, 'humanoide').ok, importer(destination, elementSchema3(), GLB_D_ELEMENT, 'epee').ok]).toEqual([true, true]);
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
    expect(importer(destination, baseSchema3(), GLB_DE_BASE, 'humanoide').ok).toBe(true);
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
    const dossier = productionSchema3(temporaire(), baseSchema3(), GLB_DE_BASE);
    const manifest = JSON.parse(readFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), 'utf8'));
    muter(manifest);
    writeFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), JSON.stringify(manifest));
    const destination = join(temporaire(), 'modeles');
    expect(importerPersonnage({ dossier, id: 'humanoide', destination, date: '2026-10-29', publier: null })).toEqual({ ok: false, refus: [refus] });
    expect(existsSync(destination)).toBe(false);
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
    writeFileSync(join(d, m.model), GLB);
    writeFileSync(join(d, LICENCE_DE_PRODUCTION), TEXTE_DE_LICENCE_DE_PRODUCTION);
    writeFileSync(join(d, MANIFESTE_DE_PRODUCTION), JSON.stringify(m));
    return d;
  };

  it('publie le GLB sous son empreinte, puis dépose le manifeste réduit et la provenance sans chemin', () => {
    const destination = temporaire();
    const dossier = dossierDeProduction();
    const { verses, publier } = publication();
    const r = importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-23', publier });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const f = fichiersDuModele('Essai');
    expect(verses).toEqual([[{ chemin: join(dossier, 'animated.glb'), nom: `${EMPREINTE}.glb` }]]);
    expect(r.publies).toEqual([`${EMPREINTE}.glb`]);
    expect([f.glb, f.manifeste, f.provenance].map((n) => existsSync(join(destination, n)))).toEqual([false, true, true]);
    expect(JSON.parse(readFileSync(join(destination, f.manifeste), 'utf8')).model).toBe('Essai.glb');
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

  it('importe un personnage sans tête', () => {
    expect(importerPersonnage({ dossier: dossierDeProduction((m) => Object.assign(m, sansTete())), id: 'Essai', destination: temporaire(), date: '2026-10-23', publier: null }).ok).toBe(true);
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

  it('refuse une apparence inconnue à l’import sans écrire de manifeste', () => {
    const dossier = dossierDeProduction((m) => { m.components.epee.apparence = 'apparence-inconnue'; });
    const destination = temporaire();
    const r = importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-24', publier: null });
    expect(r).toEqual({ ok: false, refus: ['[apparence-inconnue] components.epee.apparence : apparence-inconnue'] });
    const f = fichiersDuModele('Essai');
    expect([f.manifeste, f.provenance].map((nom) => existsSync(join(destination, nom)))).toEqual([false, false]);
  });

  it('refuse --remplacer sur une production schéma 2, sans rien écrire', () => {
    const destination = join(temporaire(), 'modeles');
    const r = importerPersonnage({ dossier: dossierDeProduction(), id: 'Essai', destination, date: '2026-10-29', publier: null, remplacer: true });
    expect(r).toEqual({ ok: false, refus: ['[remplacer-hors-schema-3] Essai : --remplacer ne remplace qu\'un modèle schéma 3'] });
    expect(existsSync(destination)).toBe(false);
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
      writeFileSync(join(d, 'animated.glb'), illisible);
      return d;
    }, /^\[glb-illisible\] GLB illisible : 10 octets, en-tête incomplet$/],
    ['un manifeste sans empreinte', () => dossierDeProduction((m) => { delete (m as { model_sha256?: string }).model_sha256; }), /, manifest\.json déclare undefined$/],
    ['un chemin absolu laissé', () => dossierDeProduction((m) => { m.components.bouclier.label_fr = '/home/x/bouclier'; }), /chemin-absolu/],
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
    ['une production sans composant licencié, ni pack source, ni texte de licence', () => {
      const d = dossierDeProduction((m) => {
        delete (m.components.corps as { asset?: unknown }).asset;
        delete (m as { packs_sources?: unknown }).packs_sources;
      });
      rmSync(join(d, LICENCE_DE_PRODUCTION));
      return d;
    }, /^\[licence-absente\] /],
    ['une base schéma 3 dont le texte de licence du pack manque', () => {
      const d = productionSchema3(temporaire(), baseSchema3(), GLB_DE_BASE);
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
      const dossier = dossierDeProduction();
      writeFileSync(join(dossier, 'LICENSE.txt'), texte);
      expect(importerPersonnage({ dossier, id: `Essai${i}`, destination, date: '2026-10-23', publier: null }).ok).toBe(true);
    }
    expect(textes.map((t) => readFileSync(join(destination, nomCC0(t)), 'utf8'))).toEqual(textes);
  });

  it('redépose sous le même nom le même texte de licence', () => {
    const destination = temporaire();
    const texte = 'Pack\nLicense: CC0\n';
    for (const id of ['Essai', 'Autre']) {
      const dossier = dossierDeProduction();
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

  it('reporte dans la provenance déposée la raison d’une production hors Release', () => {
    const destination = temporaire();
    const dossier = dossierDeProduction((m) => Object.assign(m, { hors_release: 'essai sur le poste' }));
    const r = importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-29', publier: null });
    expect(r.ok && JSON.parse(readFileSync(join(destination, fichiersDuModele('Essai').provenance), 'utf8')).hors_release).toBe('essai sur le poste');
  });

  it('n’écrit rien quand la publication lève', () => {
    const destination = join(temporaire(), 'modeles');
    const publier = () => { throw new Error('gh release upload : code 1'); };
    expect(() => importerPersonnage({ dossier: dossierDeProduction(), id: 'Essai', destination, date: '2026-10-23', publier })).toThrow(/code 1/);
    expect(existsSync(destination)).toBe(false);
  });
});

/** Un dossier de modèles : le manifeste réduit de `production()` et la provenance `provenance`, sous l'id `Essai`. */
function dossierDeModeles(provenance: Record<string, unknown> = { model: 'Essai.glb', model_sha256: EMPREINTE }) {
  const d = temporaire();
  const v = validerManifeste({ ...production(), model: 'Essai.glb' }, lireGlb(GLB));
  if (!v.ok) throw new Error('fixture invalide');
  writeFileSync(join(d, 'Essai.manifeste.json'), JSON.stringify(v.manifeste));
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

describe('recupererModeles', () => {
  const url = urlDAsset(nomDAsset(EMPREINTE, 'glb'));
  it('tire de la Release le GLB absent du cache, le vérifie et le dépose ; le cache sert l’appel suivant', async () => {
    const dossier = dossierDeModeles();
    const cache = temporaire();
    const { demandes, telecharger } = serveur({ [url]: GLB });
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(readFileSync(join(dossier, 'Essai.glb'))).toEqual(Buffer.from(GLB));
    rmSync(join(dossier, 'Essai.glb'));
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(demandes).toEqual([url]);
    expect(existsSync(join(dossier, 'Essai.glb'))).toBe(true);
  });
  it('refuse au chargement Release une attache absente du GLB', async () => {
    const dossier = dossierDeModeles();
    const chemin = join(dossier, 'Essai.manifeste.json');
    const m = JSON.parse(readFileSync(chemin, 'utf8'));
    m.montage.attaches.main.os = 'os-absent';
    writeFileSync(chemin, JSON.stringify(m));
    await expect(recupererModeles({ dossier, cache: temporaire(), telecharger: serveur({ [url]: GLB }).telecharger, journal: muet })).rejects.toThrow(/\[os-absent\]/);
  });
  it('ne réclame jamais à la Release un modèle hors Release : le GLB du poste sert, son absence lève', async () => {
    const dossier = dossierDeModeles({ model: 'Essai.glb', model_sha256: EMPREINTE, hors_release: 'essai sur le poste' });
    const { demandes, telecharger } = serveur({ [url]: GLB });
    await expect(recupererModeles({ dossier, cache: temporaire(), telecharger, journal: muet })).rejects.toThrow(`[hors-release] Essai.glb (${EMPREINTE}) : essai sur le poste`);
    writeFileSync(join(dossier, 'Essai.glb'), GLB);
    await recupererModeles({ dossier, cache: temporaire(), telecharger, journal: muet });
    expect(demandes).toEqual([]);
  });
  it('lève ModeleIntrouvable quand la Release répond 404 sur l’empreinte', async () => {
    await expect(recupererModeles({ dossier: dossierDeModeles(), cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet })).rejects.toThrow(ModeleIntrouvable);
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
  it('accepte hors ligne le GLB du projet à la somme épinglée et en amorce le cache', async () => {
    const dossier = dossierDeModeles();
    const cache = temporaire();
    writeFileSync(join(dossier, 'Essai.glb'), GLB);
    const { demandes, telecharger } = serveur({});
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(demandes).toEqual([]);
    expect(readFileSync(join(cache, nomDAsset(EMPREINTE, 'glb')))).toEqual(Buffer.from(GLB));
  });
  it('tire de nouveau un fichier corrompu du cache', async () => {
    const dossier = dossierDeModeles();
    const cache = temporaire();
    writeFileSync(join(cache, nomDAsset(EMPREINTE, 'glb')), 'corrompu');
    const { demandes, telecharger } = serveur({ [url]: GLB });
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(demandes).toEqual([url]);
    expect(readFileSync(join(cache, nomDAsset(EMPREINTE, 'glb')))).toEqual(Buffer.from(GLB));
  });
  it('remplace le GLB périmé du projet par celui du cache', async () => {
    const dossier = dossierDeModeles();
    const cache = temporaire();
    writeFileSync(join(cache, nomDAsset(EMPREINTE, 'glb')), GLB);
    writeFileSync(join(dossier, 'Essai.glb'), glb(['corps'], []));
    const { demandes, telecharger } = serveur({});
    await recupererModeles({ dossier, cache, telecharger, journal: muet });
    expect(demandes).toEqual([]);
    expect(readFileSync(join(dossier, 'Essai.glb'))).toEqual(Buffer.from(GLB));
  });
  it('lève quand le fichier reçu n’a pas la somme épinglée', async () => {
    const autre = glb(['corps'], []);
    const telecharger = serveur({ [url]: autre }).telecharger;
    await expect(recupererModeles({ dossier: dossierDeModeles(), cache: temporaire(), telecharger, journal: muet })).rejects.toThrow(`Essai.glb : SHA-256 ${sha256(autre)}, ${EMPREINTE} attendue`);
  });
  it('lève quand le manifeste ne se valide pas contre le GLB tiré', async () => {
    const dossier = dossierDeModeles();
    const manifeste = JSON.parse(readFileSync(join(dossier, 'Essai.manifeste.json'), 'utf8'));
    manifeste.clips.walk = 'Walking_A';
    writeFileSync(join(dossier, 'Essai.manifeste.json'), JSON.stringify(manifeste));
    await expect(recupererModeles({ dossier, cache: temporaire(), telecharger: serveur({ [url]: GLB }).telecharger, journal: muet })).rejects.toThrow(/clip-absent/);
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
    writeFileSync(join(d, 'animated.glb'), GLB);
    return { chemin: join(d, 'animated.glb'), nom: `${EMPREINTE}.glb` };
  };
  it('crée la Release absente, puis y verse le fichier sous son nom d’asset', () => {
    const { appels, gh } = ghSimule(absente);
    expect(publierAssets([asset()], gh)).toEqual([`${EMPREINTE}.glb`]);
    expect(appels.map((a) => a.slice(0, 3))).toEqual([['release', 'view', TAG], ['release', 'create', TAG], ['release', 'upload', TAG]]);
    expect(appels[2]?.[appels[2].length - 1]?.endsWith(`${EMPREINTE}.glb`)).toBe(true);
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
  it('lève, avec la sortie de gh, quand le versement échoue', () => {
    const { gh } = ghSimule([], { upload: { status: 1, stdout: '', stderr: 'HTTP 422: asset exists' } });
    expect(() => publierAssets([asset()], gh)).toThrow(/^gh release upload modeles-3d .* : code 1\nHTTP 422: asset exists$/s);
  });
});

describe('les modèles commités', () => {
  it('valident chacun leur manifeste contre le GLB épinglé', async () => {
    const modeles = await recupererModeles({ dossier: DOSSIER_DES_MODELES, cache: temporaire(), journal: muet });
    expect(modeles.length).toBeGreaterThan(0);
  });
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
  const publie = { id: 'Knight', model: 'Knight.glb', empreinte: EMPREINTE, licences: ['LICENSE-CC0-1.0-commune.txt'] };
  const local = { id: 'epee-essai', model: 'epee-essai.glb', empreinte: EMPREINTE, licences: ['LICENSE-CC0-1.0-commune.txt', 'LICENSE-CC0-1.0-essai.txt'], hors_release: 'essai sur le poste' };
  it('rend les fichiers suivis d’un modèle hors Release et les licences qu’aucun modèle publié ne nomme', () => {
    const suivis = ['Knight.glb.import', 'Knight.manifeste.json', 'Knight.provenance.json', 'LICENSE-CC0-1.0-commune.txt', 'LICENSE-CC0-1.0-essai.txt', 'epee-essai.glb.import', 'epee-essai.manifeste.json', 'epee-essai.provenance.json', 'epee-essai_bis.manifeste.json'];
    expect(suivisHorsRelease([publie, local], suivis)).toEqual(['LICENSE-CC0-1.0-essai.txt', 'epee-essai.glb.import', 'epee-essai.manifeste.json', 'epee-essai.provenance.json']);
  });
  it('laisse les fichiers des seuls modèles publiés', () => {
    expect(suivisHorsRelease([publie, local], ['Knight.manifeste.json', 'Knight.provenance.json', 'LICENSE-CC0-1.0-commune.txt'])).toEqual([]);
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
    ecrireProduction({ glb, manifeste: baseSchema3(), ...p });
    return glb;
  };

  it('s’importe avec publication sans geste à la main, licences des packs copiées à l’octet', () => {
    const p = packs();
    const { sources } = p;
    const glb = construite(p);
    const dossier = join(glb, '..');
    ecrireProduction({ glb, manifeste: baseSchema3(), ...p });
    const manifest = JSON.parse(readFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), 'utf8'));
    expect(PACKS.map((s) => readFileSync(join(dossier, `LICENSE-${s}.txt`), 'utf8'))).toEqual([LICENCE_QUATERNIUS, LICENCE_QUATERNIUS, LICENCE_DU_CORPS, LICENCE_DU_CORPS, LICENCE_MPFB]);
    const destination = temporaire();
    const verses: AssetAPublier[] = [];
    const r = importerPersonnage({ dossier, id: 'humanoide', destination, date: '2026-10-29', publier: a => { verses.push(...a); return a.map(x => x.nom); } });
    expect(r.ok ? r.publies : r.refus).toEqual([nomDAsset(sha256(GLB_DE_BASE), 'glb')]);
    expect(verses).toEqual([{ chemin: glb, nom: nomDAsset(sha256(GLB_DE_BASE), 'glb') }]);
    expect(manifest).toEqual({
      model: 'humanoide.glb', model_sha256: sha256(GLB_DE_BASE), manifeste: baseSchema3(),
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
    expect(JSON.parse(readFileSync(join(destination, 'humanoide.manifeste.json'), 'utf8'))).toEqual(baseSchema3());
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
    expect(() => ecrireProduction({ glb, manifeste: baseSchema3(), ...p })).toThrow(ProductionRefusee);
    expect(() => ecrireProduction({ glb, manifeste: baseSchema3(), ...p })).toThrow(motif);
    expect(existsSync(join(glb, '..')) ? listerDossier(join(glb, '..')) : null).toEqual(avant);
  });
});

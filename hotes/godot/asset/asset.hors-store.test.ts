// Le contrat d'asset d'un personnage 3D modulaire (#2948) : lecture du GLB, validation du manifeste, import, Release.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from './empreinte.ts';
import { ecrireGlb, GlbIllisible, lireGlb } from './glb.ts';
import { chargerLicences, MANIFESTE_DE_PRODUCTION, TableDesLicencesInvalide } from './dossierDeProduction.ts';
import { importerPersonnage } from './importer.ts';
import { ecrireProduction, HORS_RELEASE_DE_BASE, ProductionRefusee, type SourcesDeBase } from '../../../scripts/personnage-3d/base/production.ts';
import { cheminsAbsolus, validerManifeste, type CodeDErreur } from './manifeste.ts';
import { ATTACHES } from './montage';
import { tableTotale } from '../../../src/lib/tableTotale';
import { depotDe, INDEX, listerImage } from '../../../scripts/guards/lib/gitPorte.mjs';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import { baseSchema3, elementSchema3, GLB_DE_BASE, GLB_D_ELEMENT, LICENCE_DE_PRODUCTION, productionSchema3, deposerSchema3 } from './schema3.testkit.ts';
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
  animation_sources: { 1: { path: '/home/x/anims/UAL1_Standard.glb', sha256: 'abc', bones: 65 } },
});

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

describe('import et chargement au schéma 3', () => {
  const importer = (destination: string, manifeste: unknown, octets = GLB_D_ELEMENT, id = 'element', publier: ((assets: readonly AssetAPublier[]) => readonly string[]) | null = null) =>
    importerPersonnage({ dossier: productionSchema3(temporaire(), manifeste, octets), id, destination, date: '2026-10-28', publier });
  const avecBase = () => {
    const dossier = temporaire();
    deposerSchema3(dossier, 'corps-reference', baseSchema3(), GLB_DE_BASE);
    return dossier;
  };
  it('importe la base puis son élément, sans ajouter les métadonnées de production au manifeste', () => {
    const destination = temporaire();
    expect(importer(destination, baseSchema3(), GLB_DE_BASE, 'corps-reference').ok).toBe(true);
    const verses: string[] = [];
    const r = importer(destination, elementSchema3(), GLB_D_ELEMENT, 'epee', assets => { verses.push(...assets.map(a => a.nom)); return verses; });
    expect(r.ok).toBe(true);
    expect(verses).toEqual([nomDAsset(sha256(GLB_D_ELEMENT), 'glb')]);
    expect(JSON.parse(readFileSync(join(destination, 'epee.manifeste.json'), 'utf8'))).toEqual(elementSchema3());
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
  it('un élément dont la base déposée est hors Release en hérite : publication refusée, provenance marquée, fichiers non suivis, GLB du poste exigé', async () => {
    const destination = temporaire();
    const base = productionSchema3(temporaire(), baseSchema3(), GLB_DE_BASE);
    const manifest = JSON.parse(readFileSync(join(base, MANIFESTE_DE_PRODUCTION), 'utf8'));
    writeFileSync(join(base, MANIFESTE_DE_PRODUCTION), JSON.stringify({ ...manifest, hors_release: 'essai sur le poste' }));
    expect(importerPersonnage({ dossier: base, id: 'humanoide', destination, date: '2026-10-29', publier: null }).ok).toBe(true);
    const avant = listerDossier(destination);
    const verses: AssetAPublier[] = [];
    expect(importer(destination, elementSchema3(), GLB_D_ELEMENT, 'epee', (a) => { verses.push(...a); return []; }))
      .toEqual({ ok: false, refus: ['[hors-release] base humanoide : essai sur le poste : import sans publication seulement (--sans-publier)'] });
    expect([verses, listerDossier(destination)]).toEqual([[], avant]);
    const r = importer(destination, elementSchema3(), GLB_D_ELEMENT, 'epee');
    expect(r.ok && r.provenance.hors_release).toBe('base humanoide : essai sur le poste');
    const suivis = ['epee.manifeste.json', 'epee.provenance.json', 'humanoide.manifeste.json'];
    expect(suivisHorsRelease(modelesEpingles(destination).modeles, suivis)).toEqual(suivis);
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
    const d = avecBase();
    const piece = { ...elementSchema3(), categorie: 'accessoire', cle: { piece: 'baudrier' }, couche: 'tenue' };
    expect(importer(d, piece).ok).toBe(true);
    const r = importer(d, { ...piece, categorie: 'armure', liaison: { mode: 'squelette' }, couche: 'armure', couvre: [] }, GLB_D_ELEMENT, 'armure');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refus.join('\n')).toContain('[cle-en-doublon]');
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
});

describe('importerPersonnage', () => {
  /** Une publication qui consigne ce qu'on lui verse. */
  const publication = () => {
    const verses: AssetAPublier[][] = [];
    return { verses, publier: (assets: readonly AssetAPublier[]) => { verses.push([...assets]); return assets.map((a) => a.nom); } };
  };

  const dossierDeProduction = (muter: (m: ReturnType<typeof production>) => void = () => {}, empreinte?: string) => {
    const d = temporaire();
    const m = { ...production(), model_sha256: empreinte ?? EMPREINTE };
    muter(m);
    writeFileSync(join(d, m.model), GLB);
    writeFileSync(join(d, MANIFESTE_DE_PRODUCTION), JSON.stringify(m));
    return d;
  };

  /** Le nom sous lequel se dépose le texte de licence CC0 `texte`. */
  const nomCC0 = (texte: string) => `LICENSE-CC0-1.0-${sha256(Buffer.from(texte)).slice(0, 16)}.txt`;

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
      licences_de_pack: [],
      animation_sources: [{ fichier: 'UAL1_Standard.glb', sha256: 'abc' }],
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

  it('ne publie rien sans publication (--sans-publier)', () => {
    const r = importerPersonnage({ dossier: dossierDeProduction(), id: 'Essai', destination: temporaire(), date: '2026-10-23', publier: null });
    expect(r.ok && r.publies).toEqual([]);
  });

  it.each<[string, () => string, RegExp | string]>([
    ['un manifeste d’un autre GLB', () => dossierDeProduction(() => {}, '0'.repeat(64)), /^empreinte SHA-256 du GLB [0-9a-f]{64}, manifest\.json déclare 0{64}$/],
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
    ['une production sans composant licencié ni texte de licence', () => dossierDeProduction((m) => {
      delete (m.components.corps as { asset?: unknown }).asset;
    }), /^\[licence-absente\] /],
    ['une production schéma 3 sans composant licencié ni texte de licence', () => {
      const d = productionSchema3(temporaire(), baseSchema3(), GLB_DE_BASE);
      rmSync(join(d, LICENCE_DE_PRODUCTION));
      return d;
    }, /^\[licence-absente\] /],
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
    ['une licence de pack sans ligne License:', () => {
      const d = dossierDeProduction();
      writeFileSync(join(d, 'LICENSE-Pack.txt'), 'Pack sans licence déclarée');
      return d;
    }, /aucune ligne « License: »/],
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
});

describe('suivisHorsRelease', () => {
  const publie = { id: 'Knight', model: 'Knight.glb', empreinte: EMPREINTE, licences: ['LICENSE-CC0-1.0-commune.txt'] };
  const local = { id: 'humanoide', model: 'humanoide.glb', empreinte: EMPREINTE, licences: ['LICENSE-CC0-1.0-commune.txt', 'LICENSE-CC0-1.0-ual.txt'], hors_release: 'essai sur le poste' };
  it('rend les fichiers suivis d’un modèle hors Release et les licences qu’aucun modèle publié ne nomme', () => {
    const suivis = ['Knight.glb.import', 'Knight.manifeste.json', 'Knight.provenance.json', 'LICENSE-CC0-1.0-commune.txt', 'LICENSE-CC0-1.0-ual.txt', 'humanoide.glb.import', 'humanoide.manifeste.json', 'humanoide.provenance.json', 'humanoide_bis.manifeste.json'];
    expect(suivisHorsRelease([publie, local], suivis)).toEqual(['LICENSE-CC0-1.0-ual.txt', 'humanoide.glb.import', 'humanoide.manifeste.json', 'humanoide.provenance.json']);
  });
  it('laisse les fichiers des seuls modèles publiés', () => {
    expect(suivisHorsRelease([publie, local], ['Knight.manifeste.json', 'Knight.provenance.json', 'LICENSE-CC0-1.0-commune.txt'])).toEqual([]);
  });
});

describe('dossier de production d’une base (#3106)', () => {
  /** Le texte de licence des packs Quaternius UAL1, UAL2 et UBC, à l'octet près (CRLF, espace final). */
  const LICENCE_QUATERNIUS = '-----------------------------\r\nLicense:\r\nCC0 1.0 Universal (CC0 1.0) \r\nPublic Domain Dedication\r\n';
  const PACKS = ['ual1', 'ual2', 'corps'] as const;
  /** Un pack : son texte de licence `licence`, de contenu `texte`, à la racine, le fichier source `fichier` deux dossiers plus bas. */
  const pack = (fichier: string, licence = 'License.txt', texte = LICENCE_QUATERNIUS) => {
    const racine = temporaire();
    writeFileSync(join(racine, licence), texte);
    mkdirSync(join(racine, 'Godot', 'sous'), { recursive: true });
    writeFileSync(join(racine, 'Godot', 'sous', fichier), `octets de ${fichier}`);
    return { source: join(racine, 'Godot', 'sous', fichier), licence: join(racine, licence) };
  };
  /** Les sources d'une base et le texte de licence nommé pour chacune, le pack de `remplace` substitué. */
  const packs = (remplace: Partial<Record<(typeof PACKS)[number], ReturnType<typeof pack>>> = {}): { sources: SourcesDeBase; licences: SourcesDeBase } => {
    const p = { ual1: pack('UAL1_Standard.glb'), ual2: pack('UAL2_Standard.glb'), corps: pack('Superhero_Male_FullBody.gltf', 'License_Standard.txt'), ...remplace };
    return { sources: tableTotale(PACKS, (s) => p[s].source), licences: tableTotale(PACKS, (s) => p[s].licence) };
  };
  /** Le GLB de base exporté dans un dossier de sortie neuf, puis son dossier de production écrit. */
  const construite = (p = packs()): string => {
    const glb = join(temporaire(), 'humanoide.glb');
    writeFileSync(glb, GLB_DE_BASE);
    ecrireProduction({ glb, manifeste: baseSchema3(), ...p });
    return glb;
  };

  it('s’importe sans geste à la main, sans publication, licences des packs copiées à l’octet', () => {
    const p = packs();
    const { sources } = p;
    const glb = construite(p);
    const dossier = join(glb, '..');
    ecrireProduction({ glb, manifeste: baseSchema3(), ...p });
    const manifest = JSON.parse(readFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), 'utf8'));
    expect(manifest).toEqual({
      model: 'humanoide.glb', model_sha256: sha256(GLB_DE_BASE), manifeste: baseSchema3(),
      animation_sources: {
        ual1: { path: sources.ual1, sha256: sha256(readFileSync(sources.ual1)) },
        ual2: { path: sources.ual2, sha256: sha256(readFileSync(sources.ual2)) },
      },
      hors_release: HORS_RELEASE_DE_BASE,
    });
    for (const s of ['ual1', 'ual2', 'corps'] as const) expect(readFileSync(join(dossier, `LICENSE-${s}.txt`), 'utf8')).toBe(LICENCE_QUATERNIUS);
    const destination = temporaire();
    const r = importerPersonnage({ dossier, id: 'humanoide', destination, date: '2026-10-29', publier: null });
    expect(r.ok ? [r.provenance.licences_de_pack.map((l) => l.licence), r.provenance.hors_release] : r.refus).toEqual([['CC0 1.0 Universal (CC0 1.0)'], HORS_RELEASE_DE_BASE]);
    expect(JSON.parse(readFileSync(join(destination, 'humanoide.manifeste.json'), 'utf8'))).toEqual(baseSchema3());
  });

  it.each<[string, (m: Record<string, unknown>) => void, string]>([
    ['se déclare hors Release', () => {}, `[hors-release] ${HORS_RELEASE_DE_BASE} : import sans publication seulement (--sans-publier)`],
    ['porte une raison hors Release vide', (m) => { m.hors_release = ' '; }, '[hors-release] manifest.json : hors_release, raison non vide attendue'],
  ])('refuse à la publication une production qui %s, sans rien publier ni écrire', (_, muter, refus) => {
    const dossier = join(construite(), '..');
    const manifest = JSON.parse(readFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), 'utf8'));
    muter(manifest);
    writeFileSync(join(dossier, MANIFESTE_DE_PRODUCTION), JSON.stringify(manifest));
    const destination = join(temporaire(), 'modeles');
    const verses: AssetAPublier[] = [];
    const r = importerPersonnage({ dossier, id: 'humanoide', destination, date: '2026-10-29', publier: (a) => { verses.push(...a); return []; } });
    expect(r).toEqual({ ok: false, refus: [refus] });
    expect([verses, existsSync(destination)]).toEqual([[], false]);
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
    ['une source absente', async () => ({ glb: sortie(), ...packs({ corps: { ...pack('Superhero_Male_FullBody.gltf', 'License_Standard.txt'), source: join(temporaire(), 'Superhero_Male_FullBody.gltf') } }) }), /^\[source-absente\] --corps .*Superhero_Male_FullBody\.gltf$/],
    ['un texte de licence absent', async () => ({ glb: sortie(), ...packs({ ual2: { ...pack('UAL2_Standard.glb'), licence: join(temporaire(), 'License.txt') } }) }), /^\[licence-absente\] .*License\.txt : texte de licence introuvable$/],
    ['un texte de licence hors des dossiers ancêtres de sa source', async () => ({ glb: sortie(), ...packs({ ual1: { ...pack('UAL1_Standard.glb'), licence: pack('Autre.glb').licence } }) }), /^\[licence-hors-des-ancetres\].*License\.txt : hors des dossiers ancêtres de .*UAL1_Standard\.glb$/],
    ['un texte de licence sans ligne License:', async () => ({ glb: sortie(), ...packs({ corps: pack('Superhero_Male_FullBody.gltf', 'License_Standard.txt', 'Public Domain Dedication\r\n') }) }), /^\[licence-sans-ligne\] .*License_Standard\.txt : aucune ligne « License: »$/],
    ['un texte de licence hors de la table des licences', async () => ({ glb: sortie(), ...packs({ ual2: pack('UAL2_Standard.glb', 'License.txt', 'License: MIT\n') }) }), /^\[licence-inconnue\] .*License\.txt : « MIT » absente de la table des licences$/],
  ])('refuse %s sans rien écrire', async (_, cas, motif) => {
    const { glb, ...p } = await cas();
    const avant = existsSync(join(glb, '..')) ? listerDossier(join(glb, '..')) : null;
    expect(() => ecrireProduction({ glb, manifeste: baseSchema3(), ...p })).toThrow(ProductionRefusee);
    expect(() => ecrireProduction({ glb, manifeste: baseSchema3(), ...p })).toThrow(motif);
    expect(existsSync(join(glb, '..')) ? listerDossier(join(glb, '..')) : null).toEqual(avant);
  });
});

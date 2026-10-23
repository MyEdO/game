// Le contrat d'asset d'un personnage 3D modulaire (#2948) : lecture du GLB, validation du manifeste, import, Release.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GlbIllisible, lireGlb } from './glb.ts';
import { FICHIERS_DE_PRODUCTION, importerPersonnage } from './importer.ts';
import { cheminsAbsolus, validerManifeste, type CodeDErreur } from './manifeste.ts';
import {
  DOSSIER_DES_MODELES, fichiersDuModele, modelesEpingles, ModeleIntrouvable, nomDAsset, publierAssets, recupererModeles, ReleaseInjoignable,
  sha256, TAG, urlDAsset, type AssetAPublier, type Gh,
} from './release.ts';

/** Un GLB minimal : en-tête glTF 2 et chunk JSON portant `nodes` et `animations`. */
function glb(noeuds: readonly string[], animations: readonly string[]): Uint8Array {
  const texte = JSON.stringify({ asset: { version: '2.0' }, nodes: noeuds.map((name) => ({ name })), animations: animations.map((name) => ({ name })) });
  const brut = new TextEncoder().encode(texte);
  const longueur = Math.ceil(brut.byteLength / 4) * 4;
  const octets = new Uint8Array(20 + longueur).fill(0x20);
  const vue = new DataView(octets.buffer);
  vue.setUint32(0, 0x46546c67, true);
  vue.setUint32(4, 2, true);
  vue.setUint32(8, octets.byteLength, true);
  vue.setUint32(12, longueur, true);
  vue.setUint32(16, 0x4e4f534a, true);
  octets.set(brut, 20);
  return octets;
}

const GLB = glb(['corps', 'tete_a', 'casque', 'bouclier'], ['Idle', 'Death_A']);

/** Un manifeste de production valide contre `GLB`, avec des clés que la réduction écarte. */
const production = () => ({
  schema_version: 1,
  rig: 'codex_rig',
  model: 'animated.glb',
  default_head: 'tete_a',
  head_options: [{ id: 'tete_a', label_fr: 'Visage' }],
  pieces: {
    corps: { node: 'corps', mesh: 'corps', component: 'corps', headVariant: null, hiddenBy: [], label_fr: 'Corps' },
    tete_a: { node: 'tete_a', component: 'tete_a', headVariant: 'tete_a', hiddenBy: ['casque'] },
    casque: { node: 'casque', component: 'casque', headVariant: null, hiddenBy: [] },
    bouclier: { node: 'bouclier', component: 'bouclier', headVariant: null, hiddenBy: [] },
  },
  components: {
    corps: { label_fr: 'Corps', asset: { file: 'C:\\Users\\x\\corps.mhclo', license_basis: 'explicit asset header', explicit_header: ['# author A', '# license CC0'], packs: [{ pack: 'p', announced_license: 'CC0' }] } },
    casque: { label_fr: 'Casque', occupations: ['head_cover'] },
    bouclier: { label_fr: 'Bouclier' },
  },
  incompatibilities: [['casque', 'bouclier']],
  defaults: ['corps', 'casque'],
  presets: { garde: { label_fr: 'Garde', components: ['corps', 'bouclier'] } },
  clips: { idle: 'Idle', death: 'Death_A' },
  animation_sources: { 1: { path: '/home/x/anims/UAL1_Standard.glb', sha256: 'abc', bones: 65 } },
});

const codes = (brut: unknown, contenu = lireGlb(GLB)): CodeDErreur[] => {
  const v = validerManifeste(brut, contenu);
  return v.ok ? [] : v.erreurs.map((e) => e.code);
};

describe('lireGlb', () => {
  it('rend les noms de nœuds et d’animations du chunk JSON', () => {
    const c = lireGlb(GLB);
    expect([...c.noeuds]).toEqual(['corps', 'tete_a', 'casque', 'bouclier']);
    expect([...c.animations]).toEqual(['Idle', 'Death_A']);
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
    expect(Object.keys(v.manifeste)).toEqual(['schema_version', 'model', 'default_head', 'head_options', 'pieces', 'components', 'incompatibilities', 'defaults', 'presets', 'clips']);
    expect(v.manifeste.pieces.corps).toEqual({ node: 'corps', component: 'corps', headVariant: null, hiddenBy: [] });
    expect(v.manifeste.components.corps).toEqual({ label_fr: 'Corps' });
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
    ['une version de schéma inconnue', (m) => { m.schema_version = 2; }, 'version-inconnue'],
    ['un chemin absolu Windows laissé', (m) => { m.components.casque.label_fr = 'C:\\Users\\x\\casque'; }, 'chemin-absolu'],
    ['un chemin absolu POSIX laissé', (m) => { m.components.casque.label_fr = 'voir /home/x/casque'; }, 'chemin-absolu'],
    ['une forme fausse', (m) => { (m as { pieces: unknown }).pieces = []; }, 'forme'],
  ])('refuse %s', (_, muter, code) => {
    const m = production();
    muter(m);
    expect(codes(m)).toContain(code);
  });

  it('accepte une variante de tête comme composant de pièce', () => {
    expect(codes(production())).toEqual([]);
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
    writeFileSync(join(d, FICHIERS_DE_PRODUCTION.glb), GLB);
    writeFileSync(join(d, FICHIERS_DE_PRODUCTION.manifeste), JSON.stringify(m));
    writeFileSync(join(d, FICHIERS_DE_PRODUCTION.rapport), JSON.stringify({ model_sha256: empreinte ?? EMPREINTE, donor: 'C:\\Users\\x\\donor.blend' }));
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
    expect(verses).toEqual([[{ chemin: join(dossier, FICHIERS_DE_PRODUCTION.glb), nom: `${EMPREINTE}.glb` }]]);
    expect(r.publies).toEqual([`${EMPREINTE}.glb`]);
    expect([f.glb, f.manifeste, f.provenance].map((n) => existsSync(join(destination, n)))).toEqual([false, true, true]);
    expect(JSON.parse(readFileSync(join(destination, f.manifeste), 'utf8')).model).toBe('Essai.glb');
    expect(r.provenance).toEqual({
      model: 'Essai.glb',
      model_sha256: EMPREINTE,
      importe_le: '2026-10-23',
      licences: { corps: { base: 'explicit asset header', en_tete: ['CC0'], annoncees: ['CC0'] } },
      licences_de_pack: [],
      animation_sources: [{ fichier: 'UAL1_Standard.glb', sha256: 'abc' }],
    });
  });

  it('publie la source .blend sous son empreinte et dépose les licences de pack', () => {
    const destination = temporaire();
    const dossier = dossierDeProduction();
    const blend = Buffer.from('BLENDER-source');
    writeFileSync(join(dossier, 'source.blend'), blend);
    writeFileSync(join(dossier, 'LICENSE-Pack.txt'), 'Pack\n\tLicense: (Creative Commons Zero, CC0)\n');
    const { verses, publier } = publication();
    const r = importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-23', publier });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const empreinteBlend = sha256(blend);
    expect(verses[0]?.map((a) => a.nom)).toEqual([`${EMPREINTE}.glb`, `${empreinteBlend}.blend`]);
    expect(r.provenance.source_sha256).toBe(empreinteBlend);
    expect(r.provenance.licences_de_pack).toEqual([{ fichier: 'LICENSE-Pack.txt', licence: '(Creative Commons Zero, CC0)' }]);
    expect(readFileSync(join(destination, 'LICENSE-Pack.txt'), 'utf8')).toContain('License:');
  });

  it('ne publie rien sans publication (--sans-publier)', () => {
    const r = importerPersonnage({ dossier: dossierDeProduction(), id: 'Essai', destination: temporaire(), date: '2026-10-23', publier: null });
    expect(r.ok && r.publies).toEqual([]);
  });

  it.each<[string, () => string, RegExp]>([
    ['une empreinte fausse', () => dossierDeProduction(() => {}, '0'.repeat(64)), /empreinte SHA-256/],
    ['un chemin absolu laissé', () => dossierDeProduction((m) => { m.components.bouclier.label_fr = '/home/x/bouclier'; }), /chemin-absolu/],
    ['un manifeste d’un autre GLB, le rapport juste', () => {
      const d = dossierDeProduction();
      const chemin = join(d, FICHIERS_DE_PRODUCTION.manifeste);
      writeFileSync(chemin, JSON.stringify({ ...JSON.parse(readFileSync(chemin, 'utf8')), model_sha256: '0'.repeat(64) }));
      return d;
    }, /^empreinte SHA-256 du GLB [0-9a-f]{64}, le manifeste déclare 0{64}$/],
    ['une licence d’en-tête que le pack n’annonce pas', () => dossierDeProduction((m) => {
      m.components.corps.asset.explicit_header = ['# license AGPL3'];
      m.components.corps.asset.packs = [{ pack: 'p', announced_license: 'CC0' }];
    }), /licence du composant corps : l'en-tête déclare « AGPL3 », le pack annonce « CC0 »/],
    ['un rapport d’un autre GLB', () => {
      const d = dossierDeProduction();
      writeFileSync(join(d, FICHIERS_DE_PRODUCTION.rapport), JSON.stringify({ model_sha256: '1'.repeat(64) }));
      return d;
    }, /rapport déclare/],
    ['un fichier de production absent', () => {
      const d = dossierDeProduction();
      rmSync(join(d, FICHIERS_DE_PRODUCTION.rapport));
      return d;
    }, /absent : report\.json/],
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

  it('refuse une licence de pack homonyme d’un autre texte déjà déposé, sans rien publier ni écrire', () => {
    const destination = temporaire();
    writeFileSync(join(destination, 'LICENSE-Pack.txt'), 'Autre pack\nLicense: CC-BY 4.0\n');
    const dossier = dossierDeProduction();
    writeFileSync(join(dossier, 'LICENSE-Pack.txt'), 'Pack\nLicense: CC0\n');
    const { verses, publier } = publication();
    const r = importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-23', publier });
    expect(r.ok ? [] : r.refus).toEqual([`LICENSE-Pack.txt : un autre texte porte déjà ce nom dans ${destination}`]);
    expect(verses).toEqual([]);
    expect(readFileSync(join(destination, 'LICENSE-Pack.txt'), 'utf8')).toContain('CC-BY 4.0');
    expect(existsSync(join(destination, fichiersDuModele('Essai').provenance))).toBe(false);
  });

  it('accepte une licence de pack homonyme du même texte', () => {
    const destination = temporaire();
    writeFileSync(join(destination, 'LICENSE-Pack.txt'), 'Pack\nLicense: CC0\n');
    const dossier = dossierDeProduction();
    writeFileSync(join(dossier, 'LICENSE-Pack.txt'), 'Pack\nLicense: CC0\n');
    expect(importerPersonnage({ dossier, id: 'Essai', destination, date: '2026-10-23', publier: null }).ok).toBe(true);
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

describe('modelesEpingles', () => {
  it('épingle chaque modèle par sa provenance', () => {
    expect(modelesEpingles(dossierDeModeles())).toEqual({ modeles: [{ id: 'Essai', model: 'Essai.glb', empreinte: EMPREINTE }], erreurs: [] });
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
  it('lève ModeleIntrouvable quand la Release répond 404 sur l’empreinte', async () => {
    await expect(recupererModeles({ dossier: dossierDeModeles(), cache: temporaire(), telecharger: serveur({}).telecharger, journal: muet })).rejects.toThrow(ModeleIntrouvable);
  });
  const sansCorps = async () => new ArrayBuffer(0);
  it.each<[string, Parameters<typeof recupererModeles>[0]['telecharger']]>([
    ['hors ligne', async () => { throw new TypeError('fetch failed'); }],
    ['sur un HTTP 503', async () => ({ ok: false, status: 503, arrayBuffer: sansCorps })],
    ['sur un HTTP 403', async () => ({ ok: false, status: 403, arrayBuffer: sansCorps })],
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
    writeFileSync(join(d, FICHIERS_DE_PRODUCTION.glb), GLB);
    return { chemin: join(d, FICHIERS_DE_PRODUCTION.glb), nom: `${EMPREINTE}.glb` };
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

// La garde hors ligne : chaque modèle commité a sa provenance, à empreinte SHA-256. Que la Release porte cette empreinte,
// et que le manifeste se valide contre le GLB tiré, se prouve en ligne : `recupererModeles`, joué par
// `npm run godot:sonde` (`construire.mjs`) avant d'ouvrir Godot.
describe('les modèles commités', () => {
  it('sont épinglés chacun par sa provenance', () => {
    const { modeles, erreurs } = modelesEpingles(DOSSIER_DES_MODELES);
    expect(erreurs).toEqual([]);
    expect(modeles.length).toBeGreaterThan(0);
  });
});

/**
 * LA LECTURE D'UN GLB (#2948, #2972) : le conteneur glTF binaire (en-tête `glTF`, version 2, premier chunk `JSON`, chunk
 * `BIN` facultatif), dont le contrat d'asset lit les nœuds, animations, os et pièces rigides, et l'évaluateur les images,
 * les influences de skinning, les zones et les shape keys. Seule lecture et seule écriture du GLB du dépôt, partagées par
 * le validateur du manifeste (`manifeste.ts`), l'import (`importer.ts`) et l'évaluateur (`evaluateur/`).
 */

/** Ce que le contrat d'asset lit d'un GLB. */
export interface ContenuGlb {
  readonly noeuds: ReadonlySet<string>;
  readonly animations: ReadonlySet<string>;
  readonly os: ReadonlySet<string>;
  /** Les nœuds à mesh, nommés ou non, un par nœud dans l'ordre des nœuds. */
  readonly meshes: readonly MeshDuGlb[];
  readonly materiauxParPiece: ReadonlyMap<string, readonly (string | null)[]>;
  /** Les noms des matériaux des primitives de tout nœud à mesh, nommé ou non. */
  readonly materiaux: ReadonlySet<string>;
  /** Les noms des matériaux dont une primitive, sous tout nœud à mesh, n'a pas d'attribut `TEXCOORD_0`. */
  readonly materiauxSansUv: ReadonlySet<string>;
  /** Le nombre d'images que le GLB embarque. */
  readonly images: number;
  /** Par nœud à mesh, les attributs d'influence au-delà du premier jeu (`JOINTS_1`, `WEIGHTS_1`…). */
  readonly influencesEtendues: ReadonlyMap<string, readonly string[]>;
  /** Par zone (`extras.zone` d'un nœud à mesh), les nœuds qui la portent. */
  readonly zones: ReadonlyMap<string, readonly string[]>;
  /** Les noms de shape keys des meshes (`extras.targetNames`). */
  readonly formes: ReadonlySet<string>;
}

/** Un nœud à mesh du GLB. */
export interface MeshDuGlb {
  /** Son nom, `null` s'il n'en porte pas. */
  readonly nom: string | null;
  /** Son nom, ou `noeud <i>` s'il n'en porte pas : pour les messages seulement. */
  readonly libelle: string;
  readonly skinne: boolean;
  /** Le libellé de l'articulation d'un skin à laquelle il pend directement, `null` s'il ne pend à aucune. */
  readonly os: string | null;
}

/** Un conteneur qui n'est pas un glTF binaire 2 lisible. */
export class GlbIllisible extends Error {
  constructor(raison: string) {
    super(`GLB illisible : ${raison}`);
    this.name = 'GlbIllisible';
  }
}

const MAGIE = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const EN_TETE = 12;
const EN_TETE_DE_CHUNK = 8;

/** Le document glTF du chunk JSON, tel qu'écrit. */
export type DocumentGltf = Record<string, unknown>;

interface JsonGltf {
  nodes?: { name?: unknown; mesh?: number; skin?: number; children?: number[]; extras?: { zone?: unknown } }[];
  meshes?: { primitives: { material?: number; attributes?: Record<string, number> }[]; extras?: { targetNames?: unknown } }[];
  materials?: { name?: string }[];
  skins?: { joints: number[] }[];
  animations?: { name?: unknown }[];
  images?: unknown[];
}

/** Le chunk JSON parsé et le chunk BIN du GLB `octets`. */
export function lireConteneur(octets: Uint8Array): { readonly json: DocumentGltf; readonly bin: Uint8Array | null } {
  if (octets.byteLength < EN_TETE + EN_TETE_DE_CHUNK) throw new GlbIllisible(`${octets.byteLength} octets, en-tête incomplet`);
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
  if (vue.getUint32(0, true) !== MAGIE) throw new GlbIllisible('signature glTF absente');
  const version = vue.getUint32(4, true);
  if (version !== 2) throw new GlbIllisible(`version ${version}, 2 attendue`);
  if (vue.getUint32(8, true) !== octets.byteLength) throw new GlbIllisible('longueur déclarée différente de la taille du fichier');
  const longueur = vue.getUint32(EN_TETE, true);
  if (vue.getUint32(EN_TETE + 4, true) !== CHUNK_JSON) throw new GlbIllisible('premier chunk autre que JSON');
  const debut = EN_TETE + EN_TETE_DE_CHUNK;
  if (debut + longueur > octets.byteLength) throw new GlbIllisible('chunk JSON tronqué');
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(octets.subarray(debut, debut + longueur)));
  } catch (e) {
    throw new GlbIllisible(`chunk JSON invalide (${(e as Error).message})`);
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new GlbIllisible('chunk JSON autre qu’un objet');
  const suite = debut + longueur;
  if (suite + EN_TETE_DE_CHUNK > octets.byteLength || vue.getUint32(suite + 4, true) !== CHUNK_BIN) return { json: json as DocumentGltf, bin: null };
  const longueurBin = vue.getUint32(suite, true);
  if (suite + EN_TETE_DE_CHUNK + longueurBin > octets.byteLength) throw new GlbIllisible('chunk BIN tronqué');
  return { json: json as DocumentGltf, bin: octets.subarray(suite + EN_TETE_DE_CHUNK, suite + EN_TETE_DE_CHUNK + longueurBin) };
}

const aligne = (n: number): number => Math.ceil(n / 4) * 4;

/** Le GLB qui porte le document `json` et le chunk BIN `bin`, chaque chunk complété à 4 octets (JSON par des espaces). */
export function ecrireGlb(json: DocumentGltf, bin: Uint8Array | null): Uint8Array {
  const texte = new TextEncoder().encode(JSON.stringify(json));
  const longueurJson = aligne(texte.byteLength);
  const longueurBin = bin ? aligne(bin.byteLength) : 0;
  const total = EN_TETE + EN_TETE_DE_CHUNK + longueurJson + (bin ? EN_TETE_DE_CHUNK + longueurBin : 0);
  const octets = new Uint8Array(total);
  const vue = new DataView(octets.buffer);
  vue.setUint32(0, MAGIE, true);
  vue.setUint32(4, 2, true);
  vue.setUint32(8, total, true);
  vue.setUint32(EN_TETE, longueurJson, true);
  vue.setUint32(EN_TETE + 4, CHUNK_JSON, true);
  octets.fill(0x20, EN_TETE + EN_TETE_DE_CHUNK, EN_TETE + EN_TETE_DE_CHUNK + longueurJson);
  octets.set(texte, EN_TETE + EN_TETE_DE_CHUNK);
  if (bin) {
    const suite = EN_TETE + EN_TETE_DE_CHUNK + longueurJson;
    vue.setUint32(suite, longueurBin, true);
    vue.setUint32(suite + 4, CHUNK_BIN, true);
    octets.set(bin, suite + EN_TETE_DE_CHUNK);
  }
  return octets;
}

const nomsDe = (liste: { name?: unknown }[] | undefined): ReadonlySet<string> =>
  new Set((liste ?? []).map((e) => e.name).filter((n): n is string => typeof n === 'string'));

/** Le nom du nœud `i`, ou `noeud <i>` s’il n’en porte pas. */
const libelleDuNoeud = (n: { name?: unknown } | undefined, i: number): string => (typeof n?.name === 'string' ? n.name : `noeud ${i}`);

const JEU_D_INFLUENCE = /^(?:JOINTS|WEIGHTS)_(\d+)$/;

/** Ce que le contrat d'asset et l'évaluateur lisent du GLB `octets`. */
export function lireGlb(octets: Uint8Array): ContenuGlb {
  const json = lireConteneur(octets).json as JsonGltf;
  const noeuds = json.nodes ?? [];
  const articulations = new Set((json.skins ?? []).flatMap(s => s.joints));
  const parents = new Map(noeuds.flatMap((n, i) => (n.children ?? []).map(enfant => [enfant, i] as const)));
  const meshes: MeshDuGlb[] = [];
  const materiauxParPiece = new Map<string, readonly (string | null)[]>();
  const materiaux = new Set<string>();
  const materiauxSansUv = new Set<string>();
  const influencesEtendues = new Map<string, readonly string[]>();
  const zones = new Map<string, string[]>();
  noeuds.forEach((n, i) => {
    const parent = parents.get(i);
    const primitives = n.mesh === undefined ? [] : json.meshes?.[n.mesh]?.primitives ?? [];
    const materiauxDuNoeud = primitives.map(p => p.material === undefined || !json.materials?.[p.material] ? null : json.materials[p.material].name ?? '');
    primitives.forEach((p, j) => {
      const nom = materiauxDuNoeud[j];
      if (nom === null) return;
      materiaux.add(nom);
      if (p.attributes?.TEXCOORD_0 === undefined) materiauxSansUv.add(nom);
    });
    if (n.mesh !== undefined && typeof n.name === 'string') {
      materiauxParPiece.set(n.name, materiauxDuNoeud);
      const etendus = [...new Set(primitives.flatMap(p => Object.keys(p.attributes ?? {}).filter(a => Number(JEU_D_INFLUENCE.exec(a)?.[1] ?? 0) > 0)))];
      if (etendus.length) influencesEtendues.set(n.name, etendus);
      if (typeof n.extras?.zone === 'string') zones.set(n.extras.zone, [...(zones.get(n.extras.zone) ?? []), n.name]);
    }
    if (n.mesh === undefined) return;
    meshes.push({
      nom: typeof n.name === 'string' ? n.name : null, libelle: libelleDuNoeud(n, i), skinne: n.skin !== undefined,
      os: parent !== undefined && articulations.has(parent) ? libelleDuNoeud(noeuds[parent], parent) : null,
    });
  });
  const formes = new Set((json.meshes ?? []).flatMap(m => (Array.isArray(m.extras?.targetNames) ? m.extras.targetNames : []).filter((t): t is string => typeof t === 'string')));
  return {
    meshes, materiauxParPiece, materiaux, materiauxSansUv, influencesEtendues, zones, formes,
    images: json.images?.length ?? 0,
    noeuds: nomsDe(noeuds), animations: nomsDe(json.animations),
    os: nomsDe((json.skins ?? []).flatMap(s => s.joints.map(i => noeuds[i]).filter(n => n !== undefined))),
  };
}

/**
 * LA LECTURE D'UN GLB (#2948, #2972) : le conteneur glTF binaire (en-tête `glTF`, version 2, premier chunk `JSON`, chunk
 * `BIN` facultatif), dont le contrat d'asset lit les animations, les os, les meshes et leurs matériaux, et l'évaluateur les images,
 * les influences de skinning, les zones et les shape keys. Seule lecture et seule écriture du GLB du dépôt, partagées par
 * les validateurs des manifestes (`manifesteDeBase.ts`, `element.ts`, `modeles.ts`), l'import (`importer.ts`) et
 * l'évaluateur (`evaluateur/`).
 */

/** Ce que le contrat d'asset lit d'un GLB. */
export interface ContenuGlb {
  readonly animations: ReadonlySet<string>;
  readonly os: ReadonlySet<string>;
  /** Les nœuds à mesh, un par nœud dans l'ordre des nœuds. */
  readonly meshes: readonly MeshDuGlb[];
  /** Les noms des matériaux des primitives de tout nœud à mesh. */
  readonly materiaux: ReadonlySet<string>;
  /** Les noms des matériaux dont une primitive, sous tout nœud à mesh, n'a pas d'attribut `TEXCOORD_0`. */
  readonly materiauxSansUv: ReadonlySet<string>;
  /** Le nombre d'images que le GLB embarque. */
  readonly images: number;
  /** Par zone (`extras.zone` d'un nœud à mesh), les noms des nœuds qui la portent. */
  readonly zones: ReadonlyMap<string, readonly string[]>;
  /** Les noms de shape keys des meshes (`extras.targetNames`). */
  readonly formes: ReadonlySet<string>;
}

/** Un nœud à mesh du GLB. */
export interface MeshDuGlb {
  /** Son nom, unique dans le GLB. */
  readonly nom: string;
  readonly skinne: boolean;
  /** L'indice du nœud de l'articulation d'un skin à laquelle il pend directement, `null` s'il ne pend à aucune. */
  readonly articulation: number | null;
  /** Le nom de cette articulation, `null` sans articulation ou sans nom. */
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
  scenes?: { nodes?: number[] }[];
  scene?: number;
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

const nomsDe = (liste: readonly { name?: unknown }[]): ReadonlySet<string> =>
  new Set(liste.map((e) => e.name).filter((n): n is string => typeof n === 'string'));

/** Le nom de `n`, `null` absent ou vide : three.js (`GLTFLoader`, `nodeDef.name ?`) et Godot (`_assign_node_names`) tiennent un nom vide pour une absence de nom. */
const nomDe = (n: { name?: unknown } | undefined): string | null => (typeof n?.name === 'string' && n.name !== '' ? n.name : null);

const dans = (v: unknown, longueur: number): boolean => Number.isInteger(v) && (v as number) >= 0 && (v as number) < longueur;

/** Le tableau `v` du champ `quoi`, `[]` quand il est absent et facultatif. */
const tableau = (v: unknown, quoi: string, requis = false): readonly unknown[] => {
  if (v === undefined && !requis) return [];
  if (!Array.isArray(v)) throw new GlbIllisible(`${quoi} : tableau attendu`);
  return v;
};

/** Le tableau `v` du champ `quoi`, chaque entrée (`entree <i>`) un objet. */
const objets = (v: unknown, quoi: string, entree: string, requis = false): readonly Record<string, unknown>[] =>
  tableau(v, quoi, requis).map((e, i) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) throw new GlbIllisible(`${entree} ${i} : objet attendu`);
    return e as Record<string, unknown>;
  });

/** Le parent de chaque nœud de `json`, refusé : un tableau ou un objet mal formé, un indice hors de sa liste, un nœud à
 *  mesh sans nom, deux nœuds du même nom (three.js renomme l'un, `createUniqueName`), un nœud à plusieurs parents, une
 *  parenté qui boucle, une racine de scène qui a un parent (glTF 2.0, « Nodes and Hierarchy » et schémas des
 *  propriétés ; #3152). */
function arborescence(json: JsonGltf): ReadonlyMap<number, number> {
  const noeuds = objets(json.nodes, 'nodes', 'nœud');
  const meshes = objets(json.meshes, 'meshes', 'mesh');
  const materiaux = objets(json.materials, 'materials', 'matériau');
  const skins = objets(json.skins, 'skins', 'skin');
  objets(json.animations, 'animations', 'animation');
  tableau(json.images, 'images');
  const hors = (quoi: string, v: unknown, liste: string, longueur: number) => {
    if (!dans(v, longueur)) throw new GlbIllisible(`${quoi} ${JSON.stringify(v)} hors des ${longueur} ${liste}`);
  };
  meshes.forEach((m, k) => objets(m.primitives, `mesh ${k} : primitives`, `mesh ${k}, primitive`, true).forEach((p, j) => {
    if (p.material !== undefined) hors(`mesh ${k}, primitive ${j} : matériau`, p.material, 'matériaux', materiaux.length);
  }));
  skins.forEach((s, k) => tableau(s.joints, `skin ${k} : joints`, true).forEach(j => hors(`skin ${k} : articulation`, j, 'nœuds', noeuds.length)));
  const noms = new Map<string, number>();
  const parents = new Map<number, number>();
  noeuds.forEach((n, i) => {
    if (n.mesh !== undefined) {
      hors(`nœud ${i} : mesh`, n.mesh, 'meshes', meshes.length);
      if (nomDe(n) === null) throw new GlbIllisible(`nœud ${i} à mesh sans nom`);
    }
    const nom = nomDe(n);
    if (nom !== null) {
      if (noms.has(nom)) throw new GlbIllisible(`nœuds ${noms.get(nom)} et ${i} nommés ${nom}`);
      noms.set(nom, i);
    }
    if (n.skin !== undefined) hors(`nœud ${i} : skin`, n.skin, 'skins', skins.length);
    for (const enfant of tableau(n.children, `nœud ${i} : children`)) {
      hors(`nœud ${i} : enfant`, enfant, 'nœuds', noeuds.length);
      const parent = parents.get(enfant as number);
      if (parent === i) throw new GlbIllisible(`nœud ${enfant} listé deux fois parmi les enfants du nœud ${i}`);
      if (parent !== undefined) throw new GlbIllisible(`nœud ${enfant} enfant des nœuds ${parent} et ${i}`);
      parents.set(enfant as number, i);
    }
  });
  const versUneRacine = new Set<number>();
  noeuds.forEach((_, i) => {
    const chaine = new Set<number>();
    for (let k: number | undefined = i; k !== undefined && !versUneRacine.has(k); k = parents.get(k)) {
      if (chaine.has(k)) throw new GlbIllisible(`la chaîne des parents du nœud ${i} boucle`);
      chaine.add(k);
    }
    chaine.forEach((k) => versUneRacine.add(k));
  });
  const scenes = objets(json.scenes, 'scenes', 'scène');
  if (json.scene !== undefined) hors('scène par défaut', json.scene, 'scènes', scenes.length);
  scenes.forEach((s, k) => tableau(s.nodes, `scène ${k} : nodes`).forEach(r => {
    hors(`scène ${k} : racine`, r, 'nœuds', noeuds.length);
    if (parents.has(r as number)) throw new GlbIllisible(`racine ${r} de la scène ${k} enfant du nœud ${parents.get(r as number)}`);
  }));
  return parents;
}

/** Ce que le contrat d'asset et l'évaluateur lisent du GLB `octets`, dont la forme est refusée hors du glTF
 *  (`arborescence`). */
export function lireGlb(octets: Uint8Array): ContenuGlb {
  const json = lireConteneur(octets).json as JsonGltf;
  const parents = arborescence(json);
  const noeuds = json.nodes ?? [];
  const articulations = new Set((json.skins ?? []).flatMap(s => s.joints));
  const meshes: MeshDuGlb[] = [];
  const materiaux = new Set<string>();
  const materiauxSansUv = new Set<string>();
  const zones = new Map<string, string[]>();
  noeuds.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const nom = nomDe(n) as string;
    const primitives = (json.meshes ?? [])[n.mesh].primitives;
    for (const p of primitives) {
      if (p.material === undefined) continue;
      const materiau = nomDe((json.materials ?? [])[p.material]) ?? '';
      materiaux.add(materiau);
      if (p.attributes?.TEXCOORD_0 === undefined) materiauxSansUv.add(materiau);
    }
    if (typeof n.extras?.zone === 'string') zones.set(n.extras.zone, [...(zones.get(n.extras.zone) ?? []), nom]);
    const parent = parents.get(i);
    const articulation = parent !== undefined && articulations.has(parent) ? parent : null;
    meshes.push({ nom, skinne: n.skin !== undefined, articulation, os: articulation === null ? null : nomDe(noeuds[articulation]) });
  });
  const formes = new Set((json.meshes ?? []).flatMap(m => (Array.isArray(m.extras?.targetNames) ? m.extras.targetNames : []).filter((t): t is string => typeof t === 'string')));
  return {
    meshes, materiaux, materiauxSansUv, zones, formes,
    images: json.images?.length ?? 0,
    animations: nomsDe(json.animations ?? []),
    os: nomsDe((json.skins ?? []).flatMap(s => s.joints.map(i => noeuds[i]))),
  };
}

/**
 * LA LECTURE D'UN GLB (#2948) : le conteneur glTF binaire (en-tête `glTF`, version 2, premier chunk `JSON`), dont le
 * contrat d'asset lit les nœuds, animations, os et pièces rigides. Seule lecture du GLB du dépôt, partagée par le
 * validateur du manifeste (`manifeste.ts`) et l'import (`importer.ts`).
 */

/** Ce que le contrat d'asset lit d'un GLB. */
export interface ContenuGlb {
  readonly noeuds: ReadonlySet<string>;
  readonly animations: ReadonlySet<string>;
  readonly os: ReadonlySet<string>;
  readonly rigides: ReadonlySet<string>;
  readonly parentDesRigides: ReadonlyMap<string, string>;
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
const EN_TETE = 12;
const EN_TETE_DE_CHUNK = 8;

interface JsonGltf {
  nodes?: { name?: unknown; mesh?: number; skin?: number; children?: number[] }[];
  skins?: { joints: number[] }[];
  animations?: { name?: unknown }[];
}

const nomsDe = (liste: { name?: unknown }[] | undefined): ReadonlySet<string> =>
  new Set((liste ?? []).map((e) => e.name).filter((n): n is string => typeof n === 'string'));

/** Les noms de nœuds et d'animations du GLB `octets`. */
export function lireGlb(octets: Uint8Array): ContenuGlb {
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
  let json: JsonGltf;
  try {
    json = JSON.parse(new TextDecoder().decode(octets.subarray(debut, debut + longueur))) as JsonGltf;
  } catch (e) {
    throw new GlbIllisible(`chunk JSON invalide (${(e as Error).message})`);
  }
  const noeuds = json.nodes ?? [];
  const articulations = new Set((json.skins ?? []).flatMap(s => s.joints));
  const parents = new Map(noeuds.flatMap((n, i) => (n.children ?? []).map(enfant => [enfant, i] as const)));
  const parentDesRigides = new Map<string, string>();
  noeuds.forEach((n, i) => {
    const parent = parents.get(i);
    const nomParent = parent === undefined ? undefined : noeuds[parent]?.name;
    if (n.mesh !== undefined && n.skin === undefined && typeof n.name === 'string' && parent !== undefined && articulations.has(parent) && typeof nomParent === 'string') parentDesRigides.set(n.name, nomParent);
  });
  return {
    parentDesRigides,
    noeuds: nomsDe(noeuds), animations: nomsDe(json.animations),
    os: nomsDe((json.skins ?? []).flatMap(s => s.joints.map(i => noeuds[i]).filter(n => n !== undefined))),
    rigides: nomsDe(noeuds.filter(n => n.mesh !== undefined && n.skin === undefined)),
  };
}

/**
 * KIT DE TEST du PARTAGE par identité (#2097) : ce qu'une racine de l'état atteint, les objets des
 * SOURCES de donnée (catalogue `src/data`, scènes, narratif de campagne), et le verdict de la garde
 * de résultat posée après chaque test par `src/test-setup.ts`.
 */
import * as donnees from '../data';
import { versionDesDatasets } from '../data/versionDataset';
import { estUneDonneeGelee } from '../lib/gelerProfond';

/** Chaque objet littéral ou tableau atteignable depuis `racine`, avec son premier chemin de propriétés. */
export function atteignables(racine: unknown, chemin: string, vus = new Map<object, string>()): Map<object, string> {
  const pile: [unknown, string][] = [[racine, chemin]];
  while (pile.length) {
    const [o, p] = pile.pop()!;
    if (o === null || typeof o !== 'object' || vus.has(o)) continue;
    const proto = Object.getPrototypeOf(o);
    if (!Array.isArray(o) && proto !== Object.prototype && proto !== null) continue;
    vus.set(o, p);
    for (const [k, v] of Object.entries(o)) pile.push([v, `${p}.${k}`]);
  }
  return vus;
}

/** Chaque module JSON de `src/data` et de `src/scenes`, y compris ce que l'index ne réexporte pas. */
const MODULES_JSON: readonly unknown[] = Object.values({
  ...import.meta.glob('/src/data/**/*.json', { eager: true, import: 'default' }),
  ...import.meta.glob('/src/scenes/**/*.json', { eager: true, import: 'default' }),
});

let objetsDesJson: Map<object, string> | undefined;
let catalogue: { version: number; objets: Set<object> } | undefined;

/** Les objets atteignables depuis les modules JSON et les exports de `src/data`, ceux-ci relus à chaque écriture au seam. */
export function objetsDuCatalogue(): Set<object> {
  const version = versionDesDatasets();
  if (catalogue?.version !== version) {
    objetsDesJson ??= atteignables(MODULES_JSON, 'json');
    catalogue = { version, objets: new Set(atteignables(Object.values(donnees), 'données', new Map(objetsDesJson)).keys()) };
  }
  return catalogue.objets;
}

/** Les chemins de `racine` qui atteignent un objet du catalogue par identité. */
export function cheminsVersLeCatalogue(racine: unknown, chemin: string): string[] {
  const cat = objetsDuCatalogue();
  return [...atteignables(racine, chemin)].filter(([o]) => cat.has(o)).map(([, p]) => p);
}

/**
 * Clés de l'état qui ne sont PAS des racines de l'état mutable mais des SOURCES de donnée, chacune
 * avec sa raison. Toute autre clé est une racine : une clé neuve est couverte d'office.
 */
export const RACINES_EXCLUES: Readonly<Record<string, string>> = {
  scene: 'document de la scène courante',
  campaignNarratif: 'narratif de la campagne chargée',
  campaignDoc: 'paquet de la campagne chargée (scènes, carte, narratif)',
  worldMap: 'carte du monde du projet, lue et jamais écrite en jeu (le même objet que `campaignDoc.worldMap`)',
};

const objetsDUneSource = new WeakMap<object, Set<object>>();

/** Les objets d'une source de donnée immuable par contrat (scène, narratif), mémorisés par identité. */
function objetsDe(source: object): Set<object> {
  let objets = objetsDUneSource.get(source);
  if (!objets) objetsDUneSource.set(source, (objets = new Set(atteignables(source, 'source').keys())));
  return objets;
}

/**
 * Les chemins de l'état mutable qui atteignent une DONNÉE : un objet gelé comme donnée
 * (`estUneDonneeGelee`), un objet du catalogue, ou un objet d'une source — les clés `RACINES_EXCLUES`
 * de `etat`, et `autresSources` (scènes du registre). Les racines sont les autres clés de `etat`. Une
 * constante gelée à sa définition (`EMPTY_FLOW`) est immuable : la partager n'est pas une faute. Seul
 * le premier objet partagé d'une branche est nommé, pas ce qu'il contient.
 */
export function partagesDeLEtat(etat: object, autresSources: readonly unknown[] = []): string[] {
  const vus = new Map<object, string>();
  const cles: Readonly<Record<string, unknown>> = { ...etat };
  for (const [cle, valeur] of Object.entries(cles)) {
    if (cle in RACINES_EXCLUES) continue;
    atteignables(valeur, cle, vus);
  }
  if (!vus.size) return [];
  const cat = objetsDuCatalogue();
  const sources = [...Object.keys(RACINES_EXCLUES).map((cle) => cles[cle]), ...autresSources];
  const ensembles = sources.filter((s): s is object => s !== null && typeof s === 'object').map(objetsDe);
  const fautes = new Map<string, string>();
  for (const [o, chemin] of vus) {
    if (Object.isFrozen(o) && !estUneDonneeGelee(o)) continue;
    const ou = estUneDonneeGelee(o) ? 'gelé' : cat.has(o) ? 'catalogue' : ensembles.some((e) => e.has(o)) ? 'scène ou narratif' : null;
    if (ou) fautes.set(chemin, ou);
  }
  return [...fautes]
    .filter(([chemin]) => !fautes.has(chemin.slice(0, chemin.lastIndexOf('.'))))
    .map(([chemin, ou]) => `${chemin} → ${ou}`);
}

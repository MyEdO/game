/**
 * LE FICHIER FAUTIF d'un def, pour TOUT registre généré — la résolution `def → chemin de son fichier`
 * dont dépend chaque stock nominatif portant sur de l'art (`{ fichier, ref, occurrence }`).
 *
 * Un def ne porte pas son chemin : seul l'index GÉNÉRÉ par `scripts/gen-registry.mjs` connaît le
 * couple (objet, fichier), et il le dit deux fois — un `import { <binding> as eN } from './defs/<Nom>'`
 * par def, puis le tableau `export const <ARRAY>: <Type>[] = [e0, e1, …]` dans CET ordre. La
 * résolution est donc la MÊME pour les quatre registres d'art (tenues, armures, parts monstrueuses,
 * éléments d'apparence) : ce qui change d'un registre à l'autre tient dans une DESCRIPTION (le
 * binding, le nom du tableau, son type, le chemin de l'index), jamais dans du code.
 *
 * Résolution par IDENTITÉ D'OBJET, jamais par un chemin deviné depuis un id : un `fichier` deviné
 * ferait entrer au stock des entrées qui nomment le mauvais def, et un stock qui nomme le mauvais
 * fichier est pire qu'un compte — il envoie l'artiste ouvrir un fichier sain.
 *
 * Un index dont les alias et le tableau divergent ARRÊTE la mesure (`throw`) : mieux vaut pas de
 * mesure qu'une mesure qui accuse au hasard.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TENUE_DEFS } from '../../../src/gameIso/rig/parts/tenues/_registry.generated';
import { ARMOUR_DEFS } from '../../../src/gameIso/rig/parts/armour/_registry.generated';
import { MONSTER_PARTS } from '../../../src/gameIso/rig/parts/monster/_registry.generated';
import { ELEMENT_DEFS } from '../../../src/gameIso/rig/parts/elements/_registry.generated';
import { CREATURES } from '../../../src/gameIso/rig/creatures/_registry.generated';
import type { TenueDef } from '../../../src/gameIso/rig/parts/tenues/types';
import type { ArmourDef } from '../../../src/gameIso/rig/parts/armour/types';
import type { MonsterPartDef } from '../../../src/gameIso/rig/parts/monster/types';
import type { AppearanceElement } from '../../../src/gameIso/rig/parts/elements/types';
import type { CreatureDef } from '../../../src/gameIso/rig/creatures/types';

/** Description d'un registre généré : ce que `scripts/gen-registry.mjs` a écrit de lui. */
export interface RegistreDeDefs<D> {
  /** Nom exporté par chaque module de def (`exportName` de `REGISTRIES`) : `tenue`, `armour`, `part`, `element`. */
  binding: string;
  /** Nom du tableau exporté par l'index (`arrayName`). */
  arrayName: string;
  /** Type déclaré du tableau (`type`) — il ouvre la ligne à reconnaître. */
  type: string;
  /** Chemin de l'index généré, depuis la racine du dépôt. */
  index: string;
  /** Le tableau lui-même, importé : c'est LUI que la résolution indexe, par identité. */
  entrees: readonly D[];
}

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const nomDe = (def: unknown): string => {
  const d = def as { label?: string; key?: string; id?: string };
  return d?.label ?? d?.key ?? d?.id ?? JSON.stringify(def)?.slice(0, 80) ?? '?';
};

function carteDeFichiers<D>(registre: RegistreDeDefs<D>): Map<D, string> {
  const { index, binding, arrayName, type, entrees } = registre;
  const src = readFileSync(resolve(RACINE, index), 'utf8');
  const dossier = index.slice(0, index.lastIndexOf('/'));
  const parAlias = new Map<string, string>();
  const importe = new RegExp(`import \\{ ${binding} as (\\w+) \\} from '([^']+)'`, 'g');
  for (const [, alias, rel] of src.matchAll(importe)) {
    parAlias.set(alias, `${dossier}/${rel.replace(/^\.\//, '')}.ts`);
  }
  const tableau = new RegExp(`export const ${arrayName}: ${type}\\[\\] = \\[([^\\]]*)\\]`).exec(src);
  if (!tableau) throw new Error(`${index} : tableau ${arrayName} introuvable — la mesure ne sait plus quel fichier porte quel def`);
  const ordre = tableau[1].split(',').map((a) => a.trim()).filter(Boolean);
  if (ordre.length !== entrees.length) {
    throw new Error(`${index} : ${ordre.length} entrée(s) au tableau pour ${entrees.length} def(s) importé(s) — index désaccordé`);
  }
  return new Map(ordre.map((alias, i) => {
    const fichier = parAlias.get(alias);
    if (!fichier) throw new Error(`${index} : l'alias ${alias} du tableau n'a pas d'import — index désaccordé`);
    return [entrees[i], fichier] as const;
  }));
}

/** Une carte par registre, construite à la première demande : la LECTURE du disque se mémoïse, pas
 *  l'écart (cf. l'interdit de mémoïsation de `stock.mjs`). La clé est le registre lui-même. */
const cartes = new WeakMap<object, Map<unknown, string>>();

/** Le fichier de def d'un élément du registre, par identité d'objet. */
export function fichierDeDef<D extends object>(registre: RegistreDeDefs<D>, def: D): string {
  let carte = cartes.get(registre) as Map<D, string> | undefined;
  if (!carte) {
    carte = carteDeFichiers(registre);
    cartes.set(registre, carte as Map<unknown, string>);
  }
  const fichier = carte.get(def);
  if (!fichier) throw new Error(`« ${nomDe(def)} » hors de l'index ${registre.index} — son fichier de def est introuvable`);
  return fichier;
}

/* --- Les CINQ registres d'art, en DONNÉES : chaque ligne recopie ce que `REGISTRIES`
 * (`scripts/gen-registry.mjs:33`) déclare du registre. Un registre de PLUS s'ajoute ici, en une
 * description ; aucune fonction ne s'écrit pour lui — `REGISTRE_CREATURES` en est la preuve, posée
 * par le volet C8 sans une ligne de code neuve. --- */

export const REGISTRE_TENUES: RegistreDeDefs<TenueDef> = {
  binding: 'tenue',
  arrayName: 'TENUE_DEFS',
  type: 'TenueDef',
  index: 'src/gameIso/rig/parts/tenues/_registry.generated.ts',
  entrees: TENUE_DEFS,
};

export const REGISTRE_ARMURES: RegistreDeDefs<ArmourDef> = {
  binding: 'armour',
  arrayName: 'ARMOUR_DEFS',
  type: 'ArmourDef',
  index: 'src/gameIso/rig/parts/armour/_registry.generated.ts',
  entrees: ARMOUR_DEFS,
};

export const REGISTRE_PARTS_MONSTRUEUSES: RegistreDeDefs<MonsterPartDef> = {
  binding: 'part',
  arrayName: 'MONSTER_PARTS',
  type: 'MonsterPartDef',
  index: 'src/gameIso/rig/parts/monster/_registry.generated.ts',
  entrees: MONSTER_PARTS,
};

export const REGISTRE_ELEMENTS: RegistreDeDefs<AppearanceElement> = {
  binding: 'element',
  arrayName: 'ELEMENT_DEFS',
  type: 'AppearanceElement',
  index: 'src/gameIso/rig/parts/elements/_registry.generated.ts',
  entrees: ELEMENT_DEFS,
};

export const REGISTRE_CREATURES: RegistreDeDefs<CreatureDef> = {
  binding: 'creature',
  arrayName: 'CREATURES',
  type: 'CreatureDef',
  index: 'src/gameIso/rig/creatures/_registry.generated.ts',
  entrees: CREATURES,
};

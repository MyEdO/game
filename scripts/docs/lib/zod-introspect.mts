// INTROSPECTION du côté DÉCLARÉ : les schémas zod des registres des DEUX racines
// (`_registry.generated.ts` + `_registry-scenes.generated.ts`, réunis par `defsDeDocument`).
// Consommée par `scripts/docs/build-structures.mts` pour la colonne « déclaré » et le volet
// « forme DÉCLARÉE jamais observée ».
//
// La forme d'un nœud se lit par `defDe`, ses enfants par `enfantsDe` (`src/data/schemas/grammaire/descente.ts`).
import type { SchemaDef } from '../../../src/data/schemas/types';
import { defDe, descendre, enfantsDe } from '../../../src/data/schemas/grammaire/descente';
import { valeursDe } from '../../../src/data/schemas/grammaire/meta';
import { parUnitesDeCode } from '../../guards/lib/lister.mjs';

/**
 * Les enfants d'un nœud, triés par RÔLE selon le SEGMENT de path qu'`enfantsDe`
 * (`grammaire/descente.ts`) leur donne. Aucun champ de `_zod.def` n'est lu à la main ici : une
 * enveloppe que la descente apprendrait à traverser profite à TOUS les relevés de ce module.
 */
function descente(noeud: unknown) {
  const enfants = enfantsDe(noeud);
  return {
    cles: enfants.filter((e) => e.cle !== undefined),
    element: enfants.find((e) => e.segment === '[]')?.noeud,
    valeur: enfants.find((e) => e.segment === '{}')?.noeud,
    branches: enfants.filter((e) => e.segment.startsWith('|')).map((e) => e.noeud),
    tuple: enfants.filter((e) => /^\[\d/.test(e.segment)).map((e) => e.noeud),
    /** Enveloppes dans l'ordre de déclaration : `[innerType]`, `[in, out]`, `[cible du lazy]`. */
    enveloppes: enfants.filter((e) => e.segment === '').map((e) => e.noeud),
  };
}

/**
 * Coupe des relevés PAR VALEUR (`classeZod`, `clesDeclarees`, `litteraux`) : un nœud déjà présent sur
 * le chemin du relevé est un CYCLE (`z.lazy` récursif, dont l'instance est stable :
 * `grammaire/descente.ts`). Identité sur le CHEMIN, jamais par appel : un nœud partagé par deux clés se
 * relit sous chacune. Ces relevés traversent `array`, `union`, `record`, les enveloppes, `lazy` et
 * `pipe` sans passer par un `object`, qui arrête `classeZod` : un schéma récursif par ces seuls nœuds
 * (`z.lazy(() => z.array(s))`) ne terminerait pas sans cette coupe.
 */
type Chemin = ReadonlySet<unknown>;
const RACINE: Chemin = new Set();
const suivant = (chemin: Chemin, noeud: unknown): Chemin => new Set(chemin).add(noeud);

/** Ce qu'un relevé écrit à la place d'un nœud déjà sur son chemin. */
const MARQUE_CYCLE = '(cycle)';

/** Nom de CLASSE de type d'un nœud zod. */
function classeZod(s: unknown, chemin: Chemin = RACINE): string {
  if (!s || typeof s !== 'object') return `inconnu(${typeof s})`;
  const def = defDe(s);
  if (!def) return 'sans-def';
  if (chemin.has(s)) return `${def.type}${MARQUE_CYCLE}`;
  const c = suivant(chemin, s);
  const d = descente(s);
  switch (def.type) {
    case 'literal':
      return `literal ${JSON.stringify(def.values)}`;
    case 'enum':
      // Un enum NOMMÉ (`enumNomme`, `grammaire/valeurs.ts`) porte le libellé FR de chacune de ses
      // options SUR SON NŒUD (#1694) : le relevé le dit, c'est ce qui distingue un vocabulaire dont
      // l'atelier sait écrire les valeurs à l'écran d'un vocabulaire encore muet.
      return `enum${valeursDe(s) ? ' nommé' : ''}(${Object.values(def.entries ?? {}).length})`;
    case 'array':
      return `array<${classeZod(d.element, c)}>`;
    case 'object':
      return 'object';
    case 'tuple':
      return `tuple(${d.tuple.length})`;
    case 'union':
      return `union<${d.branches.map((o) => classeZod(o, c)).join('|')}>`;
    case 'optional':
    case 'nullable':
    case 'default':
    case 'catch':
      return `${def.type}<${classeZod(d.enveloppes[0], c)}>`;
    case 'lazy':
      // Un `lazy` dont le getter LÈVE ne rend AUCUN enfant (`enfantsDe` absorbe) : la cible est dite
      // inatteignable plutôt que muette — elle se verrait dans le doc.
      return d.enveloppes.length ? `lazy<${classeZod(d.enveloppes[0], c)}>` : 'lazy(inatteignable)';
    case 'pipe':
      return `pipe<${classeZod(d.enveloppes[0], c)}=>${classeZod(d.enveloppes[1], c)}>`;
    default:
      return def.type;
  }
}

/** Clés DÉCLARÉES d'un nœud d'entrée (objet, union de branches, record, lazy). */
function clesDeclarees(s: unknown, chemin: Chemin = RACINE): { cles: Record<string, string>; note: string } {
  const def = defDe(s);
  if (!def) return { cles: {}, note: 'sans-def' };
  if (chemin.has(s)) return { cles: {}, note: MARQUE_CYCLE };
  const c = suivant(chemin, s);
  const d = descente(s);
  if (def.type === 'object') {
    const cles: Record<string, string> = {};
    for (const e of d.cles) cles[e.cle!] = classeZod(e.noeud);
    return { cles, note: '' };
  }
  if (def.type === 'union') {
    const cles: Record<string, string> = {};
    // La note d'une branche REMONTE : sans ça un cycle (`MARQUE_CYCLE`) sous une union disparaîtrait
    // avec les clés de sa branche.
    const notes: string[] = [];
    d.branches.forEach((opt, i) => {
      const sub = clesDeclarees(opt, c);
      for (const [k, v] of Object.entries(sub.cles)) cles[k] = (cles[k] ? `${cles[k]} | ` : '') + `b${i}:${v}`;
      if (sub.note) notes.push(`b${i}:${sub.note}`);
    });
    return { cles, note: [`union(${d.branches.length} branches)`, ...notes].join(' ') };
  }
  if (def.type === 'record') {
    const sub = clesDeclarees(d.valeur, c);
    return { cles: sub.cles, note: `record ${sub.note}`.trim() };
  }
  if (def.type === 'lazy') {
    if (!d.enveloppes.length) return { cles: {}, note: 'lazy inatteignable' };
    return clesDeclarees(d.enveloppes[0], c);
  }
  if (def.type === 'pipe') {
    // SCEAU de `document()` (#1467 L1b) : l'entrée d'un def adopté est un `pipe` dont la SORTIE est un
    // `transform` sans clés. Les clés se lisent sur le nœud PORTEUR — le même critère STRUCTUREL que
    // `introspecterDefs` applique au record enveloppé : le premier des deux bouts qui a des clés.
    // Sans cette descente, tout def adopté rendait ZÉRO clé déclarée, et la comparaison
    // « déclaré × observé » se taisait au lieu de mordre.
    const porteur = d.enveloppes.find((n) => descente(n).cles.length > 0);
    if (porteur) return clesDeclarees(porteur, c);
    return { cles: {}, note: 'pipe sans nœud à clés' };
  }
  return { cles: {}, note: `non-objet(${def.type})` };
}

export type DefIntrospectee = {
  file: string;
  racine: string;
  famille: string;
  note: string;
  cles: Record<string, string>;
};

/** Introspection des defs du registre : racine déclarée + clés déclarées d'une entrée. */
export function introspecterDefs(defs: readonly SchemaDef[]): DefIntrospectee[] {
  return defs
    .map(({ file, schema }) => {
      const def = defDe(schema);
      const d = def ? descente(schema) : undefined;
      let entree: unknown = schema;
      let famille = `autre(${def?.type})`;
      if (def?.type === 'array') {
        entree = d!.element;
        famille = 'liste';
      } else if (def?.type === 'object') {
        famille = 'config (objet unique)';
      } else if (def?.type === 'record') {
        entree = d!.valeur;
        famille = 'record';
      } else if (def?.type === 'union') {
        famille = 'union à la racine';
      } else if (def?.type === 'pipe') {
        // L'entrée du doc reste le PIPE lui-même : `clesDeclarees` y applique le critère STRUCTUREL
        // ci-dessous (le bout qui porte des clés), pas le rôle in/out.
        entree = schema;
        famille = 'pipe à la racine';
        // RECORD ENVELOPPÉ (#1467 L1b V-FLIP-RECORD) : la fabrique `document()` SCELLE le document par
        // un `pipe`, mais la CHARGE d'un record reste sa carte clé→valeur sous `entries`. Le critère
        // est STRUCTUREL (la sortie porte un `entries` de type `record`), jamais la déclaration : les
        // entrées du document sont les VALEURS de cette carte, comme pour un record nu.
        // La SORTIE d'un sceau est un `transform` (elle ne porte aucune clé) : la forme du document
        // se lit sur l'ENTRÉE du pipe, seul nœud à clés.
        const porteur = d!.enveloppes.find((n) => descente(n).cles.length);
        const carte = porteur ? descente(porteur).cles.find((e) => e.cle === 'entries')?.noeud : undefined;
        if (defDe(carte)?.type === 'record') {
          famille = 'record';
          entree = descente(carte).valeur;
        }
      } else if (def?.type === 'tuple') {
        famille = 'tuple';
      }
      const { cles, note } = clesDeclarees(entree);
      const racine = classeZod(schema);
      return { file, racine, famille, note, cles };
    })
    .sort((a, b) => parUnitesDeCode(a.file, b.file));
}

/**
 * LITTÉRAUX D'ENUM déclarés par un schéma, clé par clé, à TOUTE profondeur de son arbre : une clé
 * dont la valeur est l'un de ces littéraux est un DISCRIMINANT (`kind`, `type`, `class`, `op`…),
 * jamais une référence à une entité — même quand la chaîne collisionne avec l'id d'un document.
 * SOURCE consultable, citée verbatim — #1463, commentaire « ## Arbitrages de design L0 (2026-08-23,
 * orchestrateur — suite à la contre-passe du commit 3a6017ebb) », point 3 : « une clé dont la valeur
 * est un littéral d'enum zod (`kind/type/class/op`) n'ouvre jamais une référence ».
 */
export function choixDeclares(defs: readonly SchemaDef[]): Map<string, Map<string, Set<string>>> {
  const out = new Map<string, Map<string, Set<string>>>();
  for (const { file, schema } of defs) {
    const parCle = new Map<string, Set<string>>();
    /** Littéraux de chaîne portés par le nœud (littéral, enum, ou union/enveloppe qui en contient). */
    const litteraux = (n: unknown, chemin: Chemin = RACINE): string[] => {
      const def = defDe(n);
      if (!def || chemin.has(n)) return [];
      const c = suivant(chemin, n);
      const d = descente(n);
      switch (def.type) {
        case 'literal':
          return (Array.isArray(def.values) ? def.values : []).filter((v): v is string => typeof v === 'string');
        case 'enum':
          return Object.values(def.entries ?? {}).filter((v): v is string => typeof v === 'string');
        case 'union':
          return d.branches.flatMap((o) => litteraux(o, c));
        case 'array':
          return litteraux(d.element, c);
        case 'optional':
        case 'nullable':
        case 'default':
        case 'catch':
        case 'lazy':
          return litteraux(d.enveloppes[0], c);
        case 'pipe':
          // `[in, out]` : les littéraux se lisent sur la SORTIE.
          return litteraux(d.enveloppes[d.enveloppes.length - 1], c);
        default:
          return [];
      }
    };
    descendre([schema], ({ noeud }) => {
      for (const { cle: k, noeud: v } of enfantsDe(noeud)) {
        if (k === undefined) continue;
        for (const lit of litteraux(v)) {
          if (!parCle.has(k)) parCle.set(k, new Set());
          parCle.get(k)!.add(lit);
        }
      }
    });
    out.set(file, parCle);
  }
  return out;
}

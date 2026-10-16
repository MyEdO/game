import { ast, analyserCorpus, declarationQuiPorte } from '../scripts/guards/lib/dialecte.mjs';
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * GARDE — aucune NOUVELLE déclaration de champ `name` dans src/** (doctrine utilisateur 2026-07-19,
 * verbatim) : « .name doit être juste interdit, indépendamment de l'utilisation de label pour autre
 * chose que de l'affichage et authoring » — « J'aime pas avoir label ou name pour désigner le nom
 * d'un objet. Choisi l'un ou l'autre, mais un seul vocabulaire. » Les porteurs
 * Combatant/Weapon/ItemInstance/ConditionInstance/Disease/GameOp sont DÉJÀ migrés (name→label|id) ; ce
 * garde verrouille l'ACQUIS : aucune NOUVELLE déclaration hors ALLOWLIST.
 *
 * MÉCANIQUE — parseur AST réel (`typescript`, déjà une dépendance), pas un suivi de pile fait main :
 * Un champ `name` compte SEULEMENT si :
 *   - `ts.PropertySignatureDeclaration` (membre d'`interface`/`TypeLiteral`, où qu'il apparaisse — membre direct,
 *     type de retour, annotation de variable, type de propriété imbriqué) ;
 *   - `ts.PropertyDeclaration` d'une `class` ;
 *   - `ts.PropertyAssignment` d'un `ObjectLiteralExpression` dont la valeur est un appel `z.*` (schéma
 *     zod, ex. `name: z.string()`) OU qui est un membre direct de l'argument de `z.object(`/
 *     `z.strictObject(`.
 * EXCLUS PAR CONSTRUCTION (l'AST les distingue nativement, aucune heuristique fragile) :
 *   - `ts.Parameter` — un paramètre nommé `name` d'une signature de fonction/fonction-type
 *     (`(name: string) => T`) n'est jamais un champ ;
 *   - un `PropertyAssignment` `name` d'un littéral d'appel/i18n ordinaire (`{ name: x.label }`,
 *     `t('k', { name })`) — sa valeur n'est pas un appel `z.*`, il n'ouvre donc aucun cadre TYPE.
 * L'AST ignore nativement JSX/génériques imbriqués (contrairement à un suivi de pile fait main) : plus
 * aucun angle mort de ce type — `src/ui/gallery/registry.tsx` (3 sites, dont l'interface locale
 * `GallerySpecimen` que l'ancienne version à pile ratait) est désormais couvert.
 */

/** La valeur d'un `PropertyAssignment` désigne-t-elle un appel de schéma zod (`z.string()`,
 *  `z.string().optional()`, `z.object({...})`…) — en remontant la chaîne d'appels/accès jusqu'à
 *  l'identifiant racine `z` ? */
function zodRoot(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return node.text === 'z';
  if (ts.isPropertyAccessExpression(node)) return zodRoot(node.expression);
  if (ts.isCallExpression(node)) return zodRoot(node.expression);
  return false;
}

/** `call` est-il exactement `z.object(...)`/`z.strictObject(...)` ? */
function isZodObjectCall(call: ts.Node): boolean {
  if (!ts.isCallExpression(call)) return false;
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  const method = call.expression.name.text;
  if (method !== 'object' && method !== 'strictObject') return false;
  return zodRoot(call.expression.expression);
}

/** Lignes portant une déclaration de champ `name`/`name?` — `PropertySignature`/`PropertyDeclaration`
 *  toujours, `PropertyAssignment` seulement dans un schéma zod (jamais un littéral d'appel/i18n). */
function nameFieldLines(path: string, raw: string, sourceFile = ast({ rel: path, text: raw })!): number[] {
  const found: number[] = [];
  const lineOf = (node: ts.Node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  function isNameId(name: ts.PropertyName | undefined): name is ts.Identifier {
    return !!name && ts.isIdentifier(name) && name.text === 'name';
  }

  function visit(node: ts.Node) {
    if (ts.isPropertySignatureDeclaration(node) && isNameId(node.name)) {
      found.push(lineOf(node));
    } else if (ts.isPropertyDeclaration(node) && isNameId(node.name)) {
      found.push(lineOf(node));
    } else if (ts.isPropertyAssignment(node) && isNameId(node.name)) {
      let isZodField = zodRoot(node.initializer);
      if (!isZodField) {
        const objLit = node.parent;
        if (ts.isObjectLiteralExpression(objLit) && objLit.parent) {
          isZodField = isZodObjectCall(objLit.parent);
        }
      }
      if (isZodField) found.push(lineOf(node));
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return found;
}

let sitesMemo: string[] | undefined;
function nameFieldSites(): string[] {
  return (sitesMemo ??= scanNameFieldSites());
}

/** Un site = `fichier#déclaration` de premier niveau qui le porte (`declarationQuiPorte`, #2200). */
function scanNameFieldSites(): string[] {
  const out: string[] = [];
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(readCorpus(['src']))) {
    for (const line of nameFieldLines(rel, text, sourceFile!)) out.push(`${rel}#${declarationQuiPorte(sourceFile!, line)}`);
  }
  return out;
}

/** Une clé désigne UN site : portée par plusieurs sites, elle n'en exempte aucun. */
const porteurs = (sites: string[], cle: string) => sites.filter((at) => at === cle).length;

/**
 * Deux porteurs SEULS exemptés — jamais un porteur de donnée, toujours une STRUCTURE DE PARSING :
 *  - `StatEntry.name` (`src/engine/statEntry.ts`) : sortie du parseur de ligne de statbloc, jamais
 *    persistée, jamais affichée telle quelle (le champ existant AVANT toute doctrine id/label).
 *  - `splitLabel` (même fichier) : SOURCE UNIQUE du split nom↔spécialisation, son retour `{ name,
 *    spec? }` est un couple de parsing interne, pas une identité d'objet.
 */
const ALLOWLIST: string[] = [
  'src/engine/statEntry.ts#StatEntry', // sortie de PARSEUR runtime, jamais persistée
  'src/engine/statEntry.ts#splitLabel', // couple de parsing { name, spec? }, jamais un porteur
];

describe('garde-fou champ `name` (doctrine 2026-07-19)', () => {
  it('cas planté : un membre `name: string;` dans une interface est DÉTECTÉ (preuve TDD)', () => {
    const src = `
interface Foo {
  id: string;
  name: string;
}
`;
    expect(nameFieldLines('x.ts', src)).toEqual([4]);
  });

  it('cas planté : `name?: string` (optionnel), `z.object({ name: z.string() })` et une annotation de '
    + 'type inline `(opts: { name: string }) => void` sont DÉTECTÉS (preuve TDD)', () => {
    expect(nameFieldLines('x.ts', 'interface X { name?: string; }')).toEqual([1]);
    expect(nameFieldLines('x.ts', "const S = z.object({ id: z.string(), name: z.string() });")).toEqual([1]);
    expect(nameFieldLines('x.ts', 'function f(opts: { name: string }): void {}')).toEqual([1]);
  });

  it('faux positif écarté : une clé de littéral `{ name: x.label }` (paramètre i18n/appel, PAS un '
    + 'schéma zod) n\'est JAMAIS détectée (preuve TDD — distingue déclaration de type et littéral)', () => {
    expect(nameFieldLines('x.ts', "t('op.wounds', { name: x.label, n });")).toEqual([]);
    expect(nameFieldLines('x.ts', 'const row = { id: "a", name: entry.name };')).toEqual([]);
    expect(nameFieldLines('x.ts', "giveTrapping(char, { name: 'Corde' });")).toEqual([]);
  });

  it('faux positif écarté : un paramètre `name` d\'une fonction-type membre d\'une interface n\'est '
    + 'PAS un champ (preuve TDD — `netHostStart: (name: string) => Promise<boolean>`, `ts.Parameter` '
    + 'exclu par construction)', () => {
    expect(nameFieldLines('x.ts', 'interface X { netHostStart: (name: string) => Promise<boolean>; }')).toEqual([]);
  });

  it('un champ `name` niché derrière du JSX/générique imbriqué est DÉTECTÉ (preuve TDD — l\'AST ne '
    + 'perd JAMAIS le fil, contrairement à un suivi de pile fait main sur `.tsx` : cas réel '
    + '`src/ui/gallery/registry.tsx`, une interface locale APRÈS un composant JSX générique)', () => {
    const tsx = `
import type { ReactNode } from 'react';
function Demo<T extends { id: string }>({ items, render }: { items: T[]; render: (x: T) => ReactNode }) {
  return <div className="stack">{items.map((it) => <span key={it.id}>{render(it)}</span>)}</div>;
}
function Inner() {
  interface Row { id: string; name: string; }
  const rows: Row[] = [{ id: 'r1', name: 'Exemple' }];
  return <Demo items={rows} render={(r) => <>{r.name}</>} />;
}
`;
    expect(nameFieldLines('x.tsx', tsx)).toEqual([7]);
  });

  it('aucune NOUVELLE déclaration de champ `name` hors ALLOWLIST (CLAUDE.md, doctrine '
    + '2026-07-19 — un porteur nouveau utilise `label`/`id`, jamais `name`)', () => {
    const sites = nameFieldSites();
    const nouveaux = sites.filter((at) => !(ALLOWLIST.includes(at) && porteurs(sites, at) === 1));
    expect(
      nouveaux,
      `Nouvelle(s) déclaration(s) de champ \`name\` — renommer en \`label\` (affichage) ou \`id\` '
        + '(logique), jamais \`name\` :\n${nouveaux.join('\n')}`,
    ).toEqual([]);
  });

  /** Le cliquet rend une LISTE VIDE quand tout va bien — et aussi quand le scan ne voit RIEN : un
   *  corpus vide le laisserait vert. Le peuplement est donc asserté par l'ALLOWLIST elle-même, qui
   *  doit être VUE site par site : c'est à la fois la preuve que le corpus est là et le contrôle de
   *  péremption qui manquait à ces exemptions. */
  it('PEUPLEMENT : chaque clé de l\'ALLOWLIST désigne EXACTEMENT un site vu par le scan (sinon exemption périmée ou ambiguë)', () => {
    const vus = nameFieldSites();
    expect(vus.length, 'corpus vide : le cliquet serait vert sans rien scanner').toBeGreaterThan(0);
    expect(ALLOWLIST.filter((at) => at.endsWith('#')), 'clé sans DÉCLARATION nommée : elle vaudrait clé de fichier').toEqual([]);
    const ambigues = ALLOWLIST.filter((at) => porteurs(vus, at) > 1);
    expect(ambigues, `ces déclarations portent PLUSIEURS champs \`name\` : la clé n'exempte plus aucun site :\n${ambigues.join('\n')}`).toEqual([]);
    const absents = ALLOWLIST.filter((at) => porteurs(vus, at) === 0);
    expect(
      absents,
      'ces déclarations exemptées ne portent plus de champ `name` : ôter d’ALLOWLIST'
        + ` — ou le scan a cessé de voir le corpus :\n${absents.join('\n')}`,
    ).toEqual([]);
  });
});

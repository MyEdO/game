/**
 * VERROU D'UNION d'`Effect` (#1466 L1a T3bis-a) — jumeau de `condition-discriminants.test.ts`.
 *
 * POURQUOI ce test existe : `effectSchema` est OBLIGÉ de s'annoter `z.ZodType<Effect>` (le `z.lazy`
 * de la récursion mutuelle avec `sceneFlowSchema` empêche l'inférence), et cette annotation est
 * SATISFAITE par une SOUS-union — un schéma qui n'énumère que 55 des 58 variantes reste vert au
 * typecheck ET au test d'infer, tout en REFUSANT au runtime les 3 variantes manquantes. Un effet
 * ajouté à `effets.ts` et à l'union manuscrite, mais oublié dans la liste d'options, ne casse RIEN
 * — jusqu'à ce qu'un document authoré le pose.
 *
 * Le contrat tenu ici est une ÉGALITÉ D'ENSEMBLE, mesurée des DEUX côtés du pont :
 * — côté TYPE : les membres de l'union manuscrite `Effect` (`src/state/scene.ts`), lus à l'AST —
 *   composition mince de `z.infer<typeof xSchema>` + 3 corps manuscrits (`DelayedEffect`,
 *   `PetitePriere`, `EffectOp`). Le discriminant d'un membre `z.infer` est relu à l'AST du schéma
 *   NOMMÉ (`effets.ts`), celui d'un corps manuscrit à l'AST de sa déclaration — jamais une liste
 *   recopiée, qui mourrait au premier ajout ;
 * — côté SCHÉMA : les discriminants réels des options d'`effectSchema`, par INTROSPECTION zod (le
 *   `z.lazy` est déroulé — la seule façon de voir ce que la porte accepte VRAIMENT).
 * Manquants et en-trop sont NOMMÉS dans les deux sens.
 *
 * ANGLES MORTS MESURÉS (2026-09-02) :
 * — le côté TYPE ne sait lire un membre `z.infer<typeof xSchema>` que si `xSchema` est déclaré dans
 *   l'un des `MODULES_DE_SCHEMAS` (`effets.ts` et la grammaire `grammaire/mecanique.ts`, qui porte
 *   les nœuds partagés par les deux instances du Flow — `extendedTestSchema`, #1657). Un schéma
 *   d'effet vivant déclaré hors de cette liste sort `<symbole introuvable…>` et fait rougir le
 *   verrou : c'est une contrainte de CROISSANCE (un module de schémas d'effet s'ajoute ICI), pas une
 *   vérification. Une COLLISION de nom entre deux modules est refusée nommément ;
 * — `lit ??=` retient le PREMIER `z.literal(…)` porté par une clé `type` rencontré dans le schéma, y
 *   compris IMBRIQUÉ (un `type: z.literal(…)` d'un sous-objet du schéma serait pris pour le
 *   discriminant de l'effet). Aucun schéma des `MODULES_DE_SCHEMAS` n'est dans ce cas : les `type:
 *   z.literal(…)` y sont tous à la RACINE de leur `export const`, zéro imbriqué (mesuré à l'AST
 *   2026-09-02 — 56 dans `effets.ts`, 2 dans `mecanique.ts`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { effectSchema } from './effets';
import { defDe, enfantsDe, ouverts } from '../grammaire/descente';

const SCENE = fileURLToPath(new URL('../../../state/scene.ts', import.meta.url));
const EFFETS = fileURLToPath(new URL('./effets.ts', import.meta.url));
const MECANIQUE = fileURLToPath(new URL('../grammaire/mecanique.ts', import.meta.url));
/** Modules où vit un schéma composé par un membre `z.infer<…>` de l'union `Effect`. */
const MODULES_DE_SCHEMAS = [EFFETS, MECANIQUE];

type Module = { nom: string; texte: string };
const contenusDesModules = (): Module[] => MODULES_DE_SCHEMAS.map((nom) => ({ nom, texte: readFileSync(nom, 'utf8') }));
const FLOW_CORE = fileURLToPath(new URL('../../../engine/flowCore.ts', import.meta.url));

const source = (f: string): ts.SourceFile => ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.ESNext, true);

/** Texte d'un littéral de chaîne d'un nœud de TYPE (`type: 'ops'`), `null` sinon. */
const litDeType = (t: ts.TypeNode | undefined): string | null =>
  t && ts.isLiteralTypeNode(t) && ts.isStringLiteralLike(t.literal) ? t.literal.text : null;

/** Discriminant `type` porté par un corps de type manuscrit (littéral, ou intersection qui en
 *  contient un — `DelayedEffect` = `{ type: 'delayedEffect'; … } & ScheduleSpec`). */
function typeDuCorps(n: ts.TypeNode | ts.InterfaceDeclaration): string | null {
  const membres: ts.NodeArray<ts.TypeElement> | ts.TypeElement[] = ts.isInterfaceDeclaration(n)
    ? n.members
    : ts.isTypeLiteralNode(n)
      ? n.members
      : [];
  for (const m of membres) if (ts.isPropertySignature(m) && m.name.getText() === 'type') return litDeType(m.type);
  if (!ts.isInterfaceDeclaration(n) && ts.isIntersectionTypeNode(n))
    for (const t of n.types) {
      const trouve = typeDuCorps(t);
      if (trouve) return trouve;
    }
  return null;
}

/** Discriminants des corps MANUSCRITS (`type: 'x'`) déclarés dans un fichier, par nom de type. */
function corpsManuscrits(f: string): Map<string, string | null> {
  const out = new Map<string, string | null>();
  source(f).forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n)) out.set(n.name.text, typeDuCorps(n.type));
    else if (ts.isInterfaceDeclaration(n)) out.set(n.name.text, typeDuCorps(n));
  });
  return out;
}

/** Discriminants des SCHÉMAS d'effet, lus à l'AST des modules donnés : `export const xSchema =
 *  z.strictObject({ type: z.literal('x'), … })`. Un nom porté par DEUX modules LÈVE, toujours : deux
 *  `xSchema` homonymes rendraient un discriminant au hasard de l'ordre de lecture, et l'union `Effect`
 *  n'a qu'un `typeof xSchema` par nom — la collision est la faute, pas son issue.
 *  @param modules le contenu des modules à lire, `{ nom, texte }` — injectable pour la preuve de câblage. */
function litterauxDesSchemas(modules: readonly Module[] = contenusDesModules()): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const { nom: fichier, texte } of modules) ts.createSourceFile(fichier, texte, ts.ScriptTarget.ESNext, true).forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return;
    for (const d of n.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      let lit: string | null = null;
      const chercher = (x: ts.Node): void => {
        if (
          ts.isPropertyAssignment(x) &&
          x.name.getText() === 'type' &&
          ts.isCallExpression(x.initializer) &&
          ts.isPropertyAccessExpression(x.initializer.expression) &&
          x.initializer.expression.name.text === 'literal' &&
          ts.isStringLiteralLike(x.initializer.arguments[0])
        ) {
          lit ??= (x.initializer.arguments[0] as ts.StringLiteral).text;
          return;
        }
        ts.forEachChild(x, chercher);
      };
      chercher(d.initializer);
      if (out.has(d.name.text))
        throw new Error(`\`${d.name.text}\` est déclaré par DEUX modules de schémas (${fichier}) : un nom, un module.`);
      out.set(d.name.text, lit);
    }
  });
  return out;
}

/** Les `type` de l'union manuscrite `Effect`, lus à l'AST. Un membre non résolu sort sous une clé
 *  `<…>` PARLANTE : il ferait rougir l'égalité au lieu de disparaître en silence. */
function typesDuType(texteScene?: string): string[] {
  const schemas = litterauxDesSchemas();
  const manuscrits = new Map([...corpsManuscrits(SCENE), ...corpsManuscrits(FLOW_CORE)]);
  const sf = texteScene ? ts.createSourceFile(SCENE, texteScene, ts.ScriptTarget.ESNext, true) : source(SCENE);
  const types: string[] = [];
  sf.forEachChild((n) => {
    if (!ts.isTypeAliasDeclaration(n) || n.name.text !== 'Effect') return;
    const membres = ts.isUnionTypeNode(n.type) ? n.type.types : [n.type];
    for (const m of membres) {
      if (!ts.isTypeReferenceNode(m)) {
        types.push(`<non-référence: ${m.getText().slice(0, 40)}>`);
        continue;
      }
      // `z.infer<typeof xSchema>` — le membre COMPOSE un schéma nommé de `effets.ts`.
      const arg = m.typeArguments?.[0];
      if (arg && ts.isTypeQueryNode(arg) && ts.isIdentifier(arg.exprName)) {
        const nom = arg.exprName.text;
        // DEUX causes distinctes, deux libellés : le schéma n'existe dans aucun module de
        // `MODULES_DE_SCHEMAS`, ou il y existe mais ne porte aucun `type: z.literal(…)`. Les
        // confondre enverrait chercher un discriminant manquant là où c'est le SYMBOLE qui manque.
        if (!schemas.has(nom)) {
          types.push(`<symbole introuvable dans les modules de schémas: ${nom}>`);
          continue;
        }
        types.push(schemas.get(nom) ?? `<schéma sans littéral \`type\`: ${nom}>`);
        continue;
      }
      const nom = m.typeName.getText();
      types.push(manuscrits.get(nom) ?? `<corps manuscrit introuvable: ${nom}>`);
    }
  });
  return types;
}

/** Les discriminants des options d'`effectSchema` — le `z.lazy` est déroulé pour atteindre la
 *  `discriminatedUnion` réellement servie à la porte. */
function typesDuSchema(): string[] {
  const union = ouverts([effectSchema]).find((n) => defDe(n)?.type === 'union');
  return enfantsDe(union)
    .filter((e) => e.segment.startsWith('|'))
    .map(({ noeud }) => [...(defDe(enfantsDe(noeud).find((e) => e.cle === 'type')?.noeud)?.values as Iterable<string>)][0]);
}

describe('`effectSchema` — verrou d\'union : les discriminants du SCHÉMA == ceux du TYPE', () => {
  const typesType = typesDuType();
  const typesSchema = typesDuSchema();
  const duType = new Set(typesType);
  const duSchema = new Set(typesSchema);

  it('les deux extractions VOIENT leur union (une lecture muette rendrait l\'égalité vacueuse)', () => {
    expect(typesType.length).toBeGreaterThan(50);
    expect(typesSchema.length).toBeGreaterThan(50);
    expect(
      typesType.filter((k) => k.startsWith('<')),
      `Membre(s) d'\`Effect\` dont le discriminant n'a pas été résolu :\n${typesType.filter((k) => k.startsWith('<')).join('\n')}`,
    ).toEqual([]);
    expect(typesSchema.length, 'discriminant DUPLIQUÉ dans les options du schéma.').toBe(duSchema.size);
    expect(typesType.length, 'membre DUPLIQUÉ dans l\'union manuscrite `Effect`.').toBe(duType.size);
  });

  it('AUCUNE variante du type ne MANQUE au schéma — la porte refuserait un effet que le moteur exécute', () => {
    const manquants = [...duType].filter((k) => !duSchema.has(k));
    expect(manquants, `Variante(s) d'\`Effect\` absente(s) des options d'\`effectSchema\` (refusées au runtime) :\n${manquants.join('\n')}`).toEqual([]);
  });

  it('AUCUNE variante EN TROP au schéma — la porte accepterait un effet que le moteur ne sait pas exécuter', () => {
    const enTrop = [...duSchema].filter((k) => !duType.has(k));
    expect(enTrop, `Option(s) d'\`effectSchema\` sans membre correspondant dans \`Effect\` :\n${enTrop.join('\n')}`).toEqual([]);
  });

  it('deux modules qui déclarent le MÊME `xSchema` lèvent NOMMÉMENT (preuve de câblage de la garde de collision)', () => {
    const homonyme = "export const revealClueSchema = z.strictObject({ type: z.literal('revealClue'), indiceId: z.string() });";
    // Le jouet REJOUE la lecture réelle : le vrai `effets.ts` PLUS un module qui redéclare l'un de ses
    // symboles. Sans la garde, la seconde lecture écraserait la première en silence.
    const jouet = [
      { nom: EFFETS, texte: readFileSync(EFFETS, 'utf8') },
      { nom: 'src/data/schemas/grammaire/jouet.ts', texte: ["import { z } from 'zod';", homonyme, ''].join('\n') },
    ];
    expect(() => litterauxDesSchemas(jouet)).toThrowError(/revealClueSchema.*DEUX modules de schémas/s);
    expect(() => litterauxDesSchemas(), 'les modules RÉELS ne doivent porter aucun homonyme.').not.toThrow();
  });

  it('un membre dont le SCHÉMA n’est plus résolu sort NOMMÉ, jamais en silence (preuve de câblage)', () => {
    const brut = readFileSync(SCENE, 'utf8');
    // La sonde vise un membre de l'UNION `Effect` : `state/scene.ts` compose aussi les FORMES de la
    // scène en `z.infer` (`defs-scenes/scene.ts`), qui ne sont pas des effets et que ce verrou ne
    // mesure pas. Le premier `z.infer` du fichier n'est donc pas forcément un membre d'`Effect`.
    const bloc = /export type Effect =[\s\S]*?;\n/.exec(brut);
    expect(bloc, 'union `Effect` introuvable dans `state/scene.ts` : la sonde ne mesure plus rien.').not.toBeNull();
    const premier = /z\.infer<typeof (\w+)>/.exec(bloc![0]);
    expect(premier, 'aucun membre `z.infer<typeof …>` dans `Effect` : la sonde ne mesure plus rien.').not.toBeNull();

    const nom = premier![1];
    const mute = brut.replace(`z.infer<typeof ${nom}>`, `z.infer<typeof ${nom}Ailleurs>`);
    expect(mute, 'la mutation n’a rien changé — la sonde serait vacueuse.').not.toBe(brut);

    // Un symbole de schéma qui disparaît ne doit PAS s'évaporer de l'union (le verrou deviendrait
    // vert en mesurant une union amputée) : il sort sous sa clé `<…>` et fait rougir l'égalité.
    expect(typesDuType(mute).filter((k) => k.startsWith('<'))).toEqual([
      `<symbole introuvable dans les modules de schémas: ${nom}Ailleurs>`,
    ]);
  });
});

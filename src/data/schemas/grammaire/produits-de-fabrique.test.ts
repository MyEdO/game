/**
 * GARDE — tout nœud objet construit par une fonction de la grammaire est un PRODUIT DE FABRIQUE marqué
 * (#3012). Une CONSTRUCTION (`z.object|strictObject|looseObject`, ou dérivation `.extend`, `.partial`…)
 * écrite dans une fonction de `grammaire/` (hors corps d'un `z.lazy`, qui n'est pas une fabrique) est
 * le PREMIER argument d'un `marquerProduit`, à travers les décorateurs de `meta.ts` et les clones à
 * enfants identiques ; ou bien une dérivation la consomme ; ou bien elle est l'argument d'une
 * fabrique DÉRIVANTE, qui marque ce qu'elle dérive de ce paramètre. Lecture : la porte `produits.ts`.
 */
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { ast } from '../../../../scripts/guards/lib/dialecte.mjs';
import { readCorpus } from '../../../../scripts/guards/lib/sourceCorpus.mjs';
import { z } from 'zod';
import { classeDeProduit, empreinteDeNoeud } from './produits';
import { ref, refOuSpec, refTypee, pick } from './ref';
import { descRefSchemaDe, parSaison, profilChiffreSchema, formulaSchema, variantOf } from './valeurs';
import { mecaniqueDe, noeudTest } from './mecanique';
import { proseAdressable, proseNommee } from './prose';
import { descendre } from './descente';
import { nommerChamps, nommerNoeud } from './meta';
import { document, type Exposition } from './document';

const LITTERAUX_D_OBJET = new Set(['object', 'strictObject', 'looseObject']);
const DERIVATIONS = new Set(['extend', 'safeExtend', 'partial', 'required', 'pick', 'omit', 'merge', 'catchall', 'strict', 'strip', 'loose', 'passthrough']);
/** Méthodes qui rendent un clone aux MÊMES enfants (`produitDe` le reconnaît). */
const CLONES = new Set(['superRefine', 'refine', 'check', 'meta', 'describe', 'brand']);
const DECORATEURS = new Set(['nommerChamps', 'nommerNoeud']);

const estFonction = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isMethodDeclaration(n);

const estThunkDeLazy = (n: ts.Node): boolean =>
  ts.isCallExpression(n.parent) && ts.isPropertyAccessExpression(n.parent.expression) && n.parent.expression.name.text === 'lazy';

const appele = (n: ts.CallExpression): string | undefined => (ts.isIdentifier(n.expression) ? n.expression.text : undefined);
const methode = (n: ts.CallExpression): string | undefined => (ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : undefined);

const estEnveloppeDeType = (n: ts.Node): n is ts.ParenthesizedExpression | ts.AsExpression | ts.SatisfiesExpression | ts.NonNullExpression =>
  ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n);

const estConstruction = (n: ts.Node): n is ts.CallExpression => {
  if (!ts.isCallExpression(n)) return false;
  const m = methode(n);
  return m !== undefined && (LITTERAUX_D_OBJET.has(m) || DERIVATIONS.has(m));
};

/** L'identifiant au fond du premier argument d'un marquage, à travers décorateurs, clones et dérivations. */
function racineMarquee(n: ts.Expression): string | undefined {
  if (estEnveloppeDeType(n)) return racineMarquee(n.expression);
  if (ts.isIdentifier(n)) return n.text;
  if (!ts.isCallExpression(n)) return undefined;
  const nom = appele(n);
  if (nom && DECORATEURS.has(nom) && n.arguments[0]) return racineMarquee(n.arguments[0]);
  const m = methode(n);
  if (m && (CLONES.has(m) || DERIVATIONS.has(m)) && ts.isPropertyAccessExpression(n.expression)) return racineMarquee(n.expression.expression);
  return undefined;
}

/** Les fabriques DÉRIVANTES du corpus : nom → rangs des paramètres dont elles marquent une dérivation. */
function derivantes(sources: readonly { rel: string; text: string }[]): Map<string, Set<number>> {
  const table = new Map<string, Set<number>>();
  for (const { rel, text } of sources) {
    const sf = ast({ rel, text });
    if (!sf) throw new Error(`${rel} : analyse impossible`);
    const visite = (n: ts.Node): void => {
      const nom = ts.isFunctionDeclaration(n) ? n.name?.text : ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) ? n.name.text : undefined;
      const fonction = ts.isFunctionDeclaration(n) ? n : ts.isVariableDeclaration(n) ? (n.initializer as ts.FunctionLikeDeclaration | undefined) : undefined;
      if (nom && fonction) {
        const parametres = fonction.parameters.map((p) => (ts.isIdentifier(p.name) ? p.name.text : undefined));
        const cherche = (m: ts.Node): void => {
          if (ts.isCallExpression(m) && appele(m) === 'marquerProduit' && m.arguments[0] && !ts.isIdentifier(m.arguments[0])) {
            const rang = parametres.indexOf(racineMarquee(m.arguments[0]));
            if (rang >= 0) table.set(nom, (table.get(nom) ?? new Set()).add(rang));
          }
          m.forEachChild(cherche);
        };
        fonction.body?.forEachChild(cherche);
      }
      n.forEachChild(visite);
    };
    visite(sf);
  }
  return table;
}

/** La construction est-elle marquée, consommée par une dérivation, ou confiée à une fabrique dérivante ? */
function estCouverte(construction: ts.Node, fabriquesDerivantes: ReadonlyMap<string, ReadonlySet<number>>): boolean {
  let n = construction;
  for (;;) {
    const p = n.parent;
    if (estEnveloppeDeType(p) && p.expression === n) { n = p; continue; }
    if (ts.isPropertyAccessExpression(p) && p.expression === n && ts.isCallExpression(p.parent) && p.parent.expression === p) {
      if (DERIVATIONS.has(p.name.text)) return true;
      if (!CLONES.has(p.name.text)) return false;
      n = p.parent;
      continue;
    }
    if (!ts.isCallExpression(p)) return false;
    const rang = p.arguments.indexOf(n as ts.Expression);
    const nom = appele(p);
    if (rang < 0 || !nom) return false;
    if (rang === 0 && nom === 'marquerProduit') return true;
    if (fabriquesDerivantes.get(nom)?.has(rang)) return true;
    if (rang !== 0 || !DECORATEURS.has(nom)) return false;
    n = p;
  }
}

/** Les constructions d'une fonction de fabrique qu'aucun marquage ne couvre. */
function constructionsNonMarquees(rel: string, texte: string, fabriquesDerivantes: ReadonlyMap<string, ReadonlySet<number>>): string[] {
  const sf = ast({ rel, text: texte });
  if (!sf) throw new Error(`${rel} : analyse impossible`);
  const fautes: string[] = [];
  const visite = (n: ts.Node, dansUneFabrique: boolean): void => {
    const fabrique = dansUneFabrique || (estFonction(n) && !estThunkDeLazy(n));
    if (fabrique && estConstruction(n) && !estCouverte(n, fabriquesDerivantes)) fautes.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
    n.forEachChild((c) => { visite(c, fabrique); });
  };
  visite(sf, false);
  return fautes;
}

describe('GARDE — un objet construit par une fonction de la grammaire est un produit marqué', () => {
  const grammaire = () => readCorpus(['src/data/schemas/grammaire'], { exts: ['.ts'] }).filter((s) => !s.rel.endsWith('.test.ts'));

  it('les fabriques dérivantes de la grammaire sont reconnues ; aucune construction d’objet de fabrique hors d’un marquage', () => {
    const sources = grammaire();
    const fabriquesDerivantes = derivantes(sources);
    expect(Object.fromEntries([...fabriquesDerivantes].map(([nom, rangs]) => [nom, [...rangs]]))).toEqual({ proseNommee: [0], proseAdressable: [0], variantOf: [0] });
    expect(sources.flatMap((s) => constructionsNonMarquees(s.rel, s.text, fabriquesDerivantes)), 'faire du nœud construit le premier argument de `marquerProduit(noeud, fabrique, rôle, extra)` (`interne/produits.ts`)').toEqual([]);
  });

  it('la garde mord : oubli, branche d’union, marque d’un emboîtant, littéral en extra, dérivation, enveloppe ; pas un export ni un clone', () => {
    const texte = [
      'export const exporte = z.lazy(() => z.strictObject({ a: z.number() }));',
      'export function fabrique() { return z.strictObject({ b: z.number() }); }',
      'export function marquee() { return marquerProduit(nommerChamps(z.strictObject({ c: z.number() }), {}).superRefine(() => {}), "f", "r"); }',
      'export function avecLazy() { return z.lazy(() => z.union([z.object({ d: z.number() })])); }',
      'export function union() { return marquerProduit(z.union([z.strictObject({ e: z.number() })]), "f", "r"); }',
      'export function emboite() { return marquerProduit(z.strictObject({ f: z.strictObject({ g: z.number() }) }), "f", "r"); }',
      'export function enExtra() { return marquerProduit(z.strictObject({ h: z.number() }), "f", "r", { i: z.strictObject({}) }); }',
      'export function derive(s) { return s.partial(); }',
      'export function enveloppe() { return marquerProduit(z.strictObject({ j: z.number() }).optional(), "f", "r"); }',
      'export function derivante(s) { return marquerProduit(s.extend({ k: z.number() }), "f", "r"); }',
      'export function appelante() { return derivante(nommerChamps(z.strictObject({ l: z.number() }), {})); }',
      'export function consommee() { return marquerProduit(z.strictObject({ m: z.number() }).extend({ n: z.number() }), "f", "r"); }',
    ].join('\n');
    const table = derivantes([{ rel: 'fixture.ts', text: texte }]);
    expect([...table.keys()]).toEqual(['derivante']);
    expect(constructionsNonMarquees('fixture.ts', texte, table)).toEqual(['fixture.ts:2', 'fixture.ts:4', 'fixture.ts:5', 'fixture.ts:6', 'fixture.ts:7', 'fixture.ts:8', 'fixture.ts:9']);
  });
});

describe('lecture — `classeDeProduit` nomme la fabrique, le rôle et les clés apportées par l’appelant', () => {
  const famille = mecaniqueDe({});
  const EXPOSITION: Exposition = { codex: { keys: ['talents'] }, edit: { dataset: 'talents.json' } };
  /** Les produits que rencontre la descente de `noeud`, sans descendre sous un produit. */
  const lus = (noeud: unknown): string[] => {
    const vus: string[] = [];
    descendre([noeud], ({ noeud: n }) => {
      const p = classeDeProduit(n);
      if (!p) return;
      vus.push(`${p.fabrique} ${p.role} ${JSON.stringify(p.clesDExtra)}`);
      return 'elaguer';
    });
    return [...new Set(vus)];
  };
  const lu = (noeud: unknown): string | undefined => lus(noeud)[0];
  const entree = nommerChamps(z.strictObject({ a: z.number().optional(), b: z.array(z.string()) }), { a: { label: 'a' }, b: { label: 'b' } });
  const fiche = document('talent', 'entite', { max: z.number() }, { max: { label: 'Maximum' } }, EXPOSITION);
  const palette = document('palette-jouet', 'record', {}, {}, EXPOSITION, { valeurRecord: z.string() });

  it('une instance par fabrique, l’extra en empreinte profonde, la clé interne de `refTypee` absente', () => {
    expect({
      ref: lu(ref('skill', { difficulty: nommerNoeud(z.number().optional(), { nom: 'difficulté' }) })),
      refTypee: lu(refTypee(z.enum(['skill']))),
      refOuSpec: lu(refOuSpec('skill')),
      pick: lu(pick('skill')),
      descRef: lu(descRefSchemaDe()),
      parSaison: lu(parSaison(z.number())),
      profil: lu(profilChiffreSchema(z.number())),
      formule: lu(formulaSchema),
      test: lu(noeudTest(famille.flow)),
      gameOp: lu(famille.gameOp),
      payload: lu(famille.opDefs.charMod),
      payloadAReserve: lu(mecaniqueDe({ 'charMod.min': 'admis' }).opDefs.charMod),
      triggeredEffect: lu(famille.triggeredEffect),
      proseNommee: lu(proseNommee(entree, 'narratif.documents[].prose')),
      proseAdressable: lu(proseAdressable(entree, { type: 'criticals', exigeProse: false })),
      variantOf: lu(variantOf(entree, ['a'])),
      entree: lu(fiche.entree),
      entreePartielle: lu(fiche.entreePartielle),
      record: lu(palette.schema),
    }).toEqual({
      ref: 'objetDeRef ref {"difficulty":"optional<:number>"}',
      refTypee: 'objetDeRef refTypee {}',
      refOuSpec: 'noeudASpecialisation specSeule {}',
      pick: 'pick of {}',
      descRef: 'descRefSchemaDe descRef {}',
      parSaison: 'parSaison saisons {}',
      profil: 'profilChiffreSchema profil {}',
      formule: 'optionsDeFormule charOf {}',
      test: 'noeudTest test {}',
      gameOp: 'construire gameOp {}',
      payload: 'payloadsDe charMod {}',
      payloadAReserve: 'payloadsDe charMod {"min":"optional<:number>"}',
      triggeredEffect: 'construire triggeredEffect {}',
      proseNommee: 'proseNommee narratif.documents[].prose {"a":"optional<:number>","b":"array<[]:string>"}',
      proseAdressable: 'proseAdressable criticals {"a":"optional<:number>","b":"array<[]:string>"}',
      variantOf: 'variantOf variante {"a":"optional<:number>"}',
      entree: 'document entree {"max":"number"}',
      entreePartielle: 'document entreePartielle {"max":"number"}',
      record: 'document corps.record {}',
    });
  });

  it('la branche `choice` du flux est le produit de `proseNommee`', () => {
    expect(lus(famille.flow)).toEqual([
      'construire flow.seq {}',
      'construire flow.do {}',
      'construire flow.if {}',
      'noeudTest test {}',
      'proseNommee flow.choice.prompt {"advantageCost":"optional<:union<|0:number,|1:literal[\\"$indice\\"]>>","icon":"optional<:string>","kind":"literal[\\"choice\\"]","no":"optional<:lazy>","yes":"lazy"}',
    ]);
  });

  it('l’empreinte d’un nœud lit un produit par sa classe, sans descendre dans ses enfants', () => {
    expect(empreinteDeNoeud(z.strictObject({ r: ref('skill') }))).toBe('object<r:produit(objetDeRef:ref),.*:never>');
  });

  it('l’empreinte distingue ce que le type de surface confond', () => {
    const extra = (v: z.ZodType) => classeDeProduit(ref('skill', { v: nommerNoeud(v, { nom: 'v' }) }))?.clesDExtra.v;
    expect(extra(z.number().optional())).not.toBe(extra(z.string().optional()));
    expect(extra(z.array(z.number()))).not.toBe(extra(z.array(z.string())));
    expect(extra(z.enum(['a']))).not.toBe(extra(z.enum(['b'])));
  });

  it('marquer ou lire un produit ne résout aucun `z.lazy`', () => {
    let resolu = false;
    const differe = z.lazy(() => { resolu = true; return z.number(); });
    const r = ref('skill', { v: nommerNoeud(differe, { nom: 'v' }) });
    expect([classeDeProduit(r)?.clesDExtra.v, classeDeProduit(differe), resolu]).toEqual(['lazy', undefined, false]);
  });

  it('un clone à enfants identiques est le même produit ; une extension est une autre forme', () => {
    const r = ref('skill');
    const objet = (n: unknown) => n as z.ZodObject;
    expect(classeDeProduit(objet(r).superRefine(() => {}))).toEqual(classeDeProduit(r));
    expect(classeDeProduit(objet(r).extend({ x: z.number() }))).toBeUndefined();
  });
});

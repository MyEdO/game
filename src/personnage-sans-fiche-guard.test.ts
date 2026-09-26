import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { typeNonNomme } from './data/schemas/defs-scenes/scene';
import { CURRENT_PROJECT_SCHEMA } from './state/worldMap';

/**
 * PERSONNAGE SANS FICHE DANS UNE FIXTURE (#1882) — un test qui pose un `kind:'personnage'` sans porteur
 * de fiche fabrique une scène que le schéma refuse (`PORTEURS_DU_TYPE`) : il prouve un comportement sur
 * une donnée qui ne peut plus exister.
 */
const GARDE = {
  question:
    'Quelle fixture de test pose un personnage de scène qui ne NOMME aucune fiche ? Réponse attendue : ' +
    'aucune, hors les tests dont il est le SUJET et les documents d’un format antérieur.',
  primitive:
    'Parcours AST (`typescript`) des suites de `src/**` (`readCorpus`, `estSuiteVitest`) : tout littéral ' +
    'objet `kind: \'personnage\'` + `pos` est jugé par `typeNonNomme` (`defs-scenes/scene.ts`), la source ' +
    'unique du schéma et de `validateScene` — aucune liste de porteurs recopiée ici.',
  perimetre:
    'Les suites Vitest de `src/**`. Exemptés par FORME : une entité au chemin `scenes[].entities[]` d’un ' +
    'document au `schema` littéral antérieur à `CURRENT_PROJECT_SCHEMA` (entrée de migration). Exemptés au SITE : ' +
    '`SANS_FICHE_PROUVES`, chacun dans le `it` dont il est le sujet.',
  angleMort: [
    'Un littéral à ÉTALEMENT (`{ ...over, kind, pos }`) est indécidable sans le vérificateur de types : ' +
      'il n’est pas jugé — la fabrique qui le porte doit le typer elle-même.',
    'Une entité construite hors littéral (`Object.assign`, champ affecté après coup, JSON lu d’un fichier) ' +
      'n’est pas vue.',
    'Un littéral sans `pos` n’est pas reconnu comme entité de scène.',
    'Un `kind` non littéral (variable, expression) ou en raccourci (`{ kind }`) n’est pas reconnu.',
    'Un porteur écrit `void 0` ou `x ?? undefined` compte comme PRÉSENT : seul l’identifiant `undefined` ' +
      '(enrobé ou non : `as`, parenthèses, `satisfies`) est lu comme absent.',
  ],
  ticket: '#1882',
} as const;

/** Les tests dont le personnage sans fiche est le SUJET (refus, transition jugée, migration à la
 *  lecture) — le littéral fautif est ce qu'ils prouvent. */
const SANS_FICHE_PROUVES: readonly { fichier: string; it: string }[] = [
  { fichier: 'src/state/validateScene-contenu.test.ts', it: 'un PERSONNAGE sans fiche est une erreur nommée ; chaque porteur SEUL (réf, statbloc, preset) la lève (#1882)' },
  { fichier: 'src/state/spawn-fallback.test.ts', it: 'une entité sans porteur qui franchit la porte est un BOGUE, dit par `FicheAbsente` en nommant l’entité' },
  { fichier: 'src/state/projet-migration-12-vers-13.test.ts', it: 'au SCHÉMA : chaque porteur SEUL suffit, l’absence de tous est l’issue nommée au chemin `ref`' },
  { fichier: 'src/state/projet-migration-12-vers-13.test.ts', it: 'au SCHÉMA : une réf VIDE est une absence, une réf MORTE est refusée en la nommant (#1882)' },
  { fichier: 'src/state/projet-migration-12-vers-13.test.ts', it: 'au SCHÉMA : la famille est CELLE du spawn — un équipement sans affut, un véhicule sans coque sont refusés au PARSE (#1882)' },
  { fichier: 'src/state/sceneEdit.test.ts', it: 'un patch sans rapport sur une entité DÉJÀ sans type passe ; `validateScene` la nomme' },
  { fichier: 'src/state/editorAutosave.test.ts', it: 'un autosave au format 12 est restauré TYPÉ par la migration, et un patch de cap passe' },
];

type Site = { rel: string; ligne: number; it?: string; faute: string };

const sansEnrobage = (n: ts.Expression): ts.Expression => {
  let e = n;
  while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
};

const texteLitteral = (n: ts.Expression): string | undefined => {
  const e = sansEnrobage(n);
  return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : undefined;
};

const champs = (o: ts.ObjectLiteralExpression): Map<string, ts.Expression | undefined> => {
  const m = new Map<string, ts.Expression | undefined>();
  for (const p of o.properties) {
    if (!p.name || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) continue;
    m.set(p.name.text, ts.isPropertyAssignment(p) ? p.initializer : undefined);
  }
  return m;
};

/** Remonte d'un élément de tableau littéral à l'objet qui porte ce tableau sous la clé `cle`. */
function porteurDuTableau(element: ts.Node, cle: string): ts.ObjectLiteralExpression | undefined {
  const tableau = element.parent;
  if (!tableau || !ts.isArrayLiteralExpression(tableau)) return undefined;
  const prop = tableau.parent;
  if (!prop || !ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name) || prop.name.text !== cle) return undefined;
  return ts.isObjectLiteralExpression(prop.parent) ? prop.parent : undefined;
}

/** L'entité est-elle au chemin `scenes[].entities[]` d'un document au format ANTÉRIEUR
 *  (`schema: <n>`, n < courant) ? */
function dansUnFormatAnterieur(node: ts.Node): boolean {
  const scene = porteurDuTableau(node, 'entities');
  const doc = scene && porteurDuTableau(scene, 'scenes');
  const schema = doc && champs(doc).get('schema');
  const e = schema && sansEnrobage(schema);
  return !!e && ts.isNumericLiteral(e) && Number(e.text) < CURRENT_PROJECT_SCHEMA;
}

/** Titre du `it(...)`/`test(...)` qui contient le nœud. */
function itEnglobant(node: ts.Node): string | undefined {
  for (let p = node.parent; p; p = p.parent) {
    if (!ts.isCallExpression(p) || !ts.isIdentifier(p.expression)) continue;
    if (p.expression.text !== 'it' && p.expression.text !== 'test') continue;
    const titre = p.arguments[0];
    return titre ? texteLitteral(titre) : undefined;
  }
  return undefined;
}

export function personnagesSansFiche(rel: string, raw: string): Site[] {
  const sf = ts.createSourceFile(rel, raw, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Site[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node) && !node.properties.some(ts.isSpreadAssignment)) {
      const c = champs(node);
      const kind = c.get('kind');
      if (kind && texteLitteral(kind) === 'personnage' && c.has('pos') && !dansUnFormatAnterieur(node)) {
        const porte = (cle: string) => {
          const v = c.get(cle);
          const e = v && sansEnrobage(v);
          return c.has(cle) && !(e && ts.isIdentifier(e) && e.text === 'undefined') ? true : undefined;
        };
        const id = c.get('id');
        const faute = typeNonNomme({
          id: (id && texteLitteral(id)) ?? '?',
          kind: 'personnage',
          ref: porte('ref'),
          statblock: porte('statblock'),
          presetId: porte('presetId'),
        });
        if (faute) out.push({ rel, ligne: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, it: itEnglobant(node), faute });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const estSujetProuve = (s: Site) => SANS_FICHE_PROUVES.some((r) => r.fichier === s.rel && r.it === s.it);

let memo: Site[] | undefined;
const sitesDuCorpus = (): Site[] =>
  (memo ??= readCorpus(['src'], { tests: true })
    .filter((f) => estSuiteVitest(f.rel))
    .flatMap(({ rel, text }) => personnagesSansFiche(rel, text)));

describe('personnage-sans-fiche-guard : aucune fixture ne pose un personnage sans fiche (#1882)', () => {
  it('en-tête structuré', () => {
    expect(GARDE.ticket).toBe('#1882');
    expect(GARDE.angleMort.length).toBeGreaterThan(0);
  });

  it('le détecteur MORD : un personnage sans porteur est dit en NOMMANT l’entité', () => {
    const src = "const s = { entities: [{ id: 'badaud', kind: 'personnage', pos: { x: 0, y: 0 }, label: 'Badaud' }] };";
    expect(personnagesSansFiche('x.test.ts', src).map((s) => s.faute)).toEqual([typeNonNomme({ id: 'badaud', kind: 'personnage' })]);
    expect(personnagesSansFiche('x.test.ts', "const e = { id: 'b', kind: 'personnage' as const, pos: P, ref: undefined };")).toHaveLength(1);
    expect(personnagesSansFiche('x.test.ts', "const e = { id: 'b', kind: 'personnage', pos: P, ref: (undefined as any) };")).toHaveLength(1);
  });

  it.each([
    ["{ id: 'a', kind: 'personnage', pos: P, ref: 'humain' }", 'réf.'],
    ["{ id: 'a', kind: 'personnage', pos: P, statblock: SB }", 'statbloc'],
    ["{ id: 'a', kind: 'personnage', pos: P, presetId: 'baron' }", 'preset'],
    ["{ id: 'a', kind: 'prop', pos: P, ref: 'tonneau' }", 'autre kind'],
    ["{ schema: 12, scenes: [{ entities: [{ id: 'a', kind: 'personnage', pos: P }] }] }", 'document au format antérieur'],
  ])('le détecteur laisse passer %s (%s)', (litteral) => {
    expect(personnagesSansFiche('x.test.ts', `const v = ${litteral};`)).toEqual([]);
  });

  it('l’exemption se borne au chemin `scenes[].entities[]` du document antérieur', () => {
    const horsChemin = "const v = { schema: 12, fixtures: [{ id: 'a', kind: 'personnage', pos: P }] };";
    expect(personnagesSansFiche('x.test.ts', horsChemin)).toHaveLength(1);
  });

  it('un document au format COURANT n’est pas exempté', () => {
    const src = `const v = { schema: ${CURRENT_PROJECT_SCHEMA}, scenes: [{ entities: [{ id: 'a', kind: 'personnage', pos: P }] }] };`;
    expect(personnagesSansFiche('x.test.ts', src)).toHaveLength(1);
  });

  it('aucune fixture de test ne pose un personnage sans fiche', () => {
    const fautes = sitesDuCorpus().filter((s) => !estSujetProuve(s)).map((s) => `${s.rel}:${s.ligne} ${s.faute}`);
    expect(fautes, 'typer la fixture par la fiche que le test suppose (`ref`, `statblock` ou `presetId`)').toEqual([]);
  });

  it('PEUPLEMENT : chaque sujet prouvé est VU par le scan (sinon exemption périmée)', () => {
    const vus = sitesDuCorpus();
    expect(SANS_FICHE_PROUVES.filter((r) => !vus.some((s) => s.rel === r.fichier && s.it === r.it))).toEqual([]);
  });
});

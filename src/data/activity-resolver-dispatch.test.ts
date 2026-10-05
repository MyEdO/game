import { ast, analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
/**
 * GARDE « un résolveur d'Activité a un CONSOMMATEUR » (#1318 V6) — pendant de l'union fermée
 * `ActivityResolver` : fermer le vocabulaire ne sert à rien si un membre n'est lu par personne. Un
 * résolveur sans consommateur est un NO-OP SILENCIEUX : la donnée le porte, l'auteur croit déclencher
 * une logique, et rien ne se produit.
 *
 * MESURE : occurrences du LITTÉRAL de chaîne (nœuds `StringLiteral` de l'AST — jamais un commentaire
 * ni de la prose) dans les sources de `src/`, hors fichiers de DÉFINITION du vocabulaire
 * (`engine/activities.ts`, `data/schemas/defs/activities.ts`) et hors tests.
 *
 * ANGLE DÉCLARÉ : la mesure ne relie pas le littéral à son TYPE — un homonyme d'un autre vocabulaire
 * (`bank.kind === 'mecenat'`) compte comme consommation. La garde est donc un DÉTECTEUR DE PLANCHER :
 * elle ne peut pas manquer un vrai zéro, elle peut être trop indulgente. C'est le sens utile ici.
 */
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { ACTIVITY_RESOLVERS, RESOLVER_OWNER, type ActivityResolver } from '../engine/activities';

/** Fichiers qui DÉFINISSENT le vocabulaire (l'y citer n'est pas le consommer). */
const DEFINITION_FILES = new Set([
  'src/engine/activities.ts',
  'src/data/schemas/defs/activities.ts',
]);

/** Mot HORS vocabulaire, forgé au runtime pour les fixtures de MORSURE — jamais un membre réel, dont
 *  le zéro consommateur serait un vrai défaut. */
const MOT_FORGE = 'resolveurQuiNExistePas' as ActivityResolver;

/** Littéraux de chaîne d'un source (nœuds AST — ni commentaires, ni prose de gabarit). */
export function stringLiteralsOf(relPath: string, contenu: string, sf = ast({ rel: relPath, text: contenu })!): Set<string> {
  const found = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) found.add(n.text);
    n.forEachChild(visit);
  };
  sf.forEachChild(visit);
  return found;
}

/** Consommateurs (chemins relatifs) de chaque résolveur, hors définitions et hors tests. */
export function consumersByResolver(
  files: { rel: string; contenu: string }[],
  resolvers: readonly ActivityResolver[],
): Map<ActivityResolver, string[]> {
  const out = new Map<ActivityResolver, string[]>(resolvers.map((r) => [r, []]));
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(files.filter((f) => !DEFINITION_FILES.has(f.rel)).map(({ rel, contenu }) => ({ rel, text: contenu })))) {
    const lits = stringLiteralsOf(rel, text, sourceFile!);
    for (const r of resolvers) if (lits.has(r)) out.get(r)!.push(rel);
  }
  return out;
}

let consumersMemo: Map<ActivityResolver, string[]> | undefined;
function consommateursReels(): Map<ActivityResolver, string[]> {
  return (consumersMemo ??= consumersByResolver(
    readCorpus(['src']).map(({ rel, text }) => ({ rel, contenu: text })),
    ACTIVITY_RESOLVERS,
  ));
}

describe('garde — un résolveur d’Activité a un CONSOMMATEUR (#1318 V6)', () => {
  it('chaque membre d’ACTIVITY_RESOLVERS est lu par au moins un consommateur de production — SANS exception', { timeout: 60_000 }, () => {
    const consumers = consommateursReels();
    expect(consumers.size, 'le balayage n’a pas couvert tout le vocabulaire').toBe(ACTIVITY_RESOLVERS.length);
    const mesure = ACTIVITY_RESOLVERS.map((r) => `${r} (famille ${RESOLVER_OWNER[r]}) : ${(consumers.get(r) ?? []).length}`);
    const orphelins = ACTIVITY_RESOLVERS
      .filter((r) => (consumers.get(r) ?? []).length === 0)
      .map((r) => `${r} (famille ${RESOLVER_OWNER[r]})`);
    expect(
      orphelins,
      'Résolveur(s) SANS consommateur — un membre du vocabulaire que personne ne lit est un no-op\n' +
        'silencieux : écrire sa branche chez son propriétaire, ou le retirer de l’enum ET de la donnée.\n' +
        'Consommateurs mesurés :\n' + mesure.join('\n'),
    ).toEqual([]);
  });

  it('MORSURE : le détecteur voit un résolveur absent, et ne s’émeut pas d’un présent (fixture)', () => {
    const fixture = [
      { rel: 'src/state/fauxFlow.ts', contenu: "export const f = (d: Def) => d.resolver === 'forage' ? 1 : 0;" },
      { rel: 'src/engine/activities.ts', contenu: `export const X = ['forage', '${MOT_FORGE}'];` }, // définition : ignorée
    ];
    const consumers = consumersByResolver(fixture, ['forage', MOT_FORGE]);
    expect(consumers.get('forage')).toEqual(['src/state/fauxFlow.ts']);
    expect(consumers.get(MOT_FORGE)).toEqual([]);
  });

  it('MORSURE : un littéral de COMMENTAIRE ne compte pas comme consommation', () => {
    const fixture = [{ rel: 'src/state/fauxFlow.ts', contenu: `// mentionne '${MOT_FORGE}' en prose\nexport const f = 1;` }];
    expect(consumersByResolver(fixture, [MOT_FORGE]).get(MOT_FORGE)).toEqual([]);
  });
});

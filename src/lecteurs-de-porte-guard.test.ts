import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listProdFiles, scanFieldReads } from '../scripts/guards/lib/fieldConsumers.mjs';
import { ast, typescript } from '../scripts/guards/lib/dialecte.mjs';
import { detenteur } from './detenteur.testkit';

/**
 * LECTEURS DE PORTE (#700) — une porte SECRÈTE non révélée n'est pas une porte pour le JEU : le seul
 * prédicat runtime de « porte » est `porteEnJeu` (`src/state/scene.ts`), la lecture AUTEUR passe par
 * `porteAuteur` / `secretAuteur`. Le champ se lit au VÉRIFICATEUR DE TYPES (`scanFieldReads`,
 * `scripts/guards/lib/fieldConsumers.mjs`) : identité par SYMBOLE de `WallSeg.door` / `WallSeg.secret`,
 * aucun nom de receveur ni de fichier n'entre dans un crédit.
 */
const GARDE = {
  question:
    'Quel site de `src/` lit `WallSeg.door` ou `WallSeg.secret` hors du corps d’un prédicat de ' +
    '`state/scene.ts` ? Un lecteur qui relit `seg.door` rend jouable une porte secrète masquée.',
  primitive: '`scanFieldReads` (`scripts/guards/lib/fieldConsumers.mjs`), Program du dépôt tenu par `detenteur`.',
  perimetre: '`src/` de production (`listProdFiles`, tests exclus)',
  exemption:
    'Au SITE, par FORME : (1) le corps d’un prédicat de `src/state/scene.ts` à UN paramètre (lecture ' +
    'statique du segment, sans état runtime) que `src/state/porte-secrete.test.ts` importe, donc éprouve ; ' +
    '(2) la déclaration qui DÉCLARE le champ (`wallSegSchema.superRefine`, `auDeclarant`). Aucune table ' +
    'de fichiers ni de receveurs.',
  angleMort: [
    'Condition (1) de `fieldConsumers.mjs` : un paramètre annoté d’un littéral de même forme que `WallSeg` ne crédite rien.',
    'Une clé calculée (`seg[k]`) et un spread (`{ ...seg }`) ne lisent aucun champ nommé.',
    'Une ÉCRITURE `seg.door = …` est un accès de propriété et compte comme lecture : l’authoring écrit par littéral.',
  ],
  ticket: '#700',
} as const;

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SCENE = 'src/state/scene.ts';
const TEST_DES_PREDICATS = 'src/state/porte-secrete.test.ts';

/** Arbre syntaxique d'un fichier du dépôt (`ast`, dialecte TS). */
function arbre(rel: string): import('typescript').SourceFile {
  const sf = ast({ rel, text: readFileSync(join(ROOT, rel), 'utf8') });
  if (!sf) throw new Error(`${rel} : dialecte non TS`);
  return sf;
}

/** Noms importés de `./scene` par le test des prédicats : les prédicats ÉPROUVÉS. */
function predicatsEprouves(): Set<string> {
  const ts = typescript();
  const sf = arbre(TEST_DES_PREDICATS);
  const noms = new Set<string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || st.moduleSpecifier.text !== './scene') continue;
    const liens = st.importClause?.namedBindings;
    if (!liens || !ts.isNamedImports(liens)) continue;
    for (const el of liens.elements) if (!el.isTypeOnly) noms.add((el.propertyName ?? el.name).text);
  }
  return noms;
}

/** Fonctions de `state/scene.ts` à UN seul paramètre : lectures STATIQUES du segment. */
function lecturesStatiques(): Set<string> {
  const ts = typescript();
  const sf = arbre(SCENE);
  return new Set(
    sf.statements
      .filter((st): st is import('typescript').FunctionDeclaration => ts.isFunctionDeclaration(st) && !!st.name && st.parameters.length === 1)
      .map((st) => st.name!.text),
  );
}

/** Lectures de `WallSeg.door` / `WallSeg.secret` sur `src/` : Program du dépôt (~1,3 Go), payé une fois. */
const lectures = detenteur(() =>
  scanFieldReads({ type: 'WallSeg', home: SCENE }, ['door', 'secret'], listProdFiles(join(ROOT, 'src')), ROOT),
);

describe('lecteurs-de-porte-guard', () => {
  it(`${GARDE.perimetre} — aucune lecture de \`WallSeg.door\`/\`secret\` hors des prédicats statiques éprouvés de \`${SCENE}\``, () => {
    const eprouves = predicatsEprouves();
    const statiques = lecturesStatiques();
    const fautes = lectures()
      .filter((l) => !l.auDeclarant && !(l.file === SCENE && eprouves.has(l.symbole) && statiques.has(l.symbole)))
      .map((l) => `${l.file}:${l.line} (${l.symbole}) lit \`WallSeg.${l.field}\` — passe par \`porteEnJeu\` (jeu) ou \`porteAuteur\`/\`secretAuteur\` (document), ${SCENE}`);
    expect(fautes).toEqual([]);
  }, 150_000);

  it('contrat positif : les lecteurs admis sont les deux prédicats auteur et la validation du schéma', () => {
    const admis = lectures().filter((l) => l.file === SCENE || l.auDeclarant).map((l) => `${l.file} @${l.symbole}.${l.field}`);
    expect([...new Set(admis)].sort()).toEqual([
      'src/data/schemas/defs-scenes/scene.ts @wallSegSchema.door',
      'src/data/schemas/defs-scenes/scene.ts @wallSegSchema.secret',
      'src/state/scene.ts @porteAuteur.door',
      'src/state/scene.ts @secretAuteur.secret',
    ]);
    for (const p of ['porteAuteur', 'secretAuteur']) {
      expect(predicatsEprouves().has(p), `${p} non éprouvé par ${TEST_DES_PREDICATS}`).toBe(true);
      expect(lecturesStatiques().has(p), `${p} n’est plus une lecture statique`).toBe(true);
    }
  }, 150_000);
});

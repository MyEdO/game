/**
 * FORME UNIQUE du dé dans la donnée AUTHORÉE (#1463, vague `de`).
 *
 * Le mode de panne fermé ici est la 4ᵉ CLÉ posée sur un descripteur de dé : `miscast.json` a écrit
 * quatre ans durant `{n, sides, sinPlus:true}` — un dé porteur d'un drapeau que seul
 * `engine/miscast.ts` savait lire, invisible au `DiceSpec` du moteur (`src/engine/dice.ts`) comme à
 * `rollDice`/`formatDice`. Un dé authoré n'a que les clés de `diceSpecSchema` (`{n, sides, fois?, plus?}`,
 * toutes lues par `rollDice`/`formatDice`/`parseDice`) ; ce que le RAW ajoute au dé hors de ces clés
 * (« 1d10 + (Points de Péché) », LDB 40 l.58/62/65/68/73/75) est un TERME DE FORMULE
 * (`{sum:[{dice}, {sinPoints:true}]}`), jamais une clé de plus sur le dé.
 *
 * La sonde marche la DONNÉE des 2 racines authorées (`src/data`, `src/scenes`), jamais le code.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { EXPRESSION_DE_DE, diceSpecSchema } from './schemas/grammaire/valeurs';

const ROOT = process.cwd();
const RACINES = ['src/data', 'src/scenes'];
/** Les seules clés d'un `DiceSpec` (`src/engine/dice.ts`), lues à son schéma. */
const CANON = Object.keys(diceSpecSchema.shape);

function fichiers(): { chemin: string; doc: unknown }[] {
  return RACINES.flatMap((r) =>
    listerArbre(join(ROOT, r), { filtre: (rel) => rel.endsWith('.json') }).map((rel) => ({
      chemin: `${r}/${rel}`,
      doc: JSON.parse(readFileSync(join(ROOT, r, rel), 'utf8')),
    })),
  );
}

/** Marche TOUT nœud objet d'un document, en donnant à `visiter` ses clés. */
function marcherObjets(noeud: unknown, visiter: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(noeud)) { for (const e of noeud) marcherObjets(e, visiter); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  visiter(noeud as Record<string, unknown>);
  for (const v of Object.values(noeud)) marcherObjets(v, visiter);
}

const FICHIERS = fichiers();

describe('dé — forme UNIQUE dans la donnée authorée (#1463)', () => {
  it('un descripteur de dé n’a JAMAIS d’autre clé que `n`/`sides`/`plus`', () => {
    const signatures: Record<string, number> = {};
    const offenders: string[] = [];
    for (const { chemin, doc } of FICHIERS) marcherObjets(doc, (o) => {
      const cles = Object.keys(o);
      if (!cles.includes('n') || !cles.includes('sides')) return;
      const sig = [...cles].sort().join(',');
      signatures[sig] = (signatures[sig] ?? 0) + 1;
      if (cles.some((k) => !CANON.includes(k))) offenders.push(`${chemin} {${sig}}`);
    });

    expect(offenders, 'dé(s) portant une clé HORS `DiceSpec` — ce que le RAW ajoute au dé est un terme de formule').toEqual([]);

    // Les SIGNATURES écrites sont les trois formes du `DiceSpec`, et rien d'autre. Aucun compte n'est
    // figé ici : un dé authoré de plus est une donnée neuve, pas une régression — le cardinal, lui,
    // est asserté par la migration (`scripts/migrations/2026-09-01-1463-de-sin-points.mjs`).
    expect(Object.keys(signatures).sort(), 'signatures de dé observées').toEqual(['fois,n,plus,sides', 'n,plus,sides', 'n,sides']);
    expect(
      Object.values(signatures).reduce((a, b) => a + b, 0),
      'le corpus de dés a FONDU sous la mesure de référence (134) : la sonde ne mesure plus ce qu’elle croit.',
    ).toBeGreaterThanOrEqual(134);
  });

  // Le dé EN CHAÎNE (« 2d10 », « 20+1d10 », « +2d10 ») est une seconde grammaire de dé, invisible à
  // `rollDice`/`formatDice` et au volet ci-dessus (qui exige `n` ET `sides`) : une valeur tirée est un
  // `Tirage` (`tirageSchema`), un modificateur signé un `EffetSigne` (`effetSigneSchema`). Seule la clé
  // `die` d'une table — le dé de son tirage, concept propre — garde sa chaîne. #1652
  it('aucune valeur ne porte un dé en CHAÎNE hors la clé `die`', () => {
    const porteurs: string[] = [];
    for (const { chemin, doc } of FICHIERS) marcherObjets(doc, (o) => {
      for (const [k, v] of Object.entries(o)) if (k !== 'die' && typeof v === 'string' && EXPRESSION_DE_DE.test(v)) porteurs.push(`${chemin} ${k}: "${v}"`);
    });

    expect(porteurs, 'dé(s) en CHAÎNE — un tirage s’écrit `{ dice: { n, sides, plus? } }`').toEqual([]);
  });

  // `{ count, faces }` est une troisième grammaire de dé, invisible au volet `n`/`sides` : le dé d'une
  // table tirée est sa chaîne `die`, lue par `deDeLaTableTiree` (`src/engine/tables.ts`). #3961
  it('aucun nœud ne porte un dé `{ count, faces }`', () => {
    const porteurs: string[] = [];
    for (const { chemin, doc } of FICHIERS) marcherObjets(doc, (o) => {
      if ('count' in o && 'faces' in o) porteurs.push(`${chemin} ${JSON.stringify(o)}`);
    });

    expect(porteurs, 'dé(s) `{ count, faces }` — le dé d’une table tirée s’écrit `die: "2d10"`').toEqual([]);
  });
});

/**
 * FORME UNIQUE de la monnaie dans la donnée AUTHORÉE (#1463, vague `monnaie`).
 *
 * Le mode de panne fermé ici est la RÉAPPARITION SILENCIEUSE d'une 2ᵉ graphie : la bourse a vécu
 * quatre ans en `{gold, silver, bronze}` côté catalogues et en `{gold, silver, brass}` côté moteur
 * (`Money`, `src/engine/money.ts:10`), sans qu'aucun test ne voie les deux à la fois — chaque côté
 * était vert sur SA graphie, et `priceToMoney` traduisait au milieu.
 *
 * Les deux sondes marchent la DONNÉE des 2 racines authorées du commun (`src/data`, `src/scenes`), jamais le
 * code : ce qu'elles mesurent est la forme réellement écrite par les auteurs.
 *  A. le concept `monnaie` ne s'écrit qu'en dénominations de `Money` — `{gold?, silver?, brass?}` —
 *     et TOUJOURS dans un objet qui ne porte QU'ELLES : une action nomme sa charge (`giveMoney.montant`,
 *     `giveXp.amount`, `givePossession.ref`), elle ne l'étale pas parmi ses propres clés.
 *  B. les noms RÉSERVÉS `price`/`cost` : recensement par CLASSE réelle et par SIGNATURE d'objet —
 *     un nom de concept est réservé à son type (#1463 S2). `cost` est SOLDÉ (L-monnaie-4) : il porte seulement une classe. `price` en porte trois de plus que la monnaie — `null` et `'ND'` sont
 *     la colonne Prix telle que le livre l'imprime, `number` est le facteur de qualité du vin (`land-cargo.json`, `qualiteDuVin`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { CLASSES_DE_PRICE, SIGNATURES_DE_PRICE, coutsHorsMonnaie, hors, recenserMonnaie } from './monnaieFormeUnique.testkit';

const ROOT = process.cwd();
const RACINES = ['src/data', 'src/scenes'];

function documents(): unknown[] {
  return RACINES.flatMap((r) =>
    listerArbre(join(ROOT, r), { filtre: (rel) => rel.endsWith('.json') }).map((rel) =>
      JSON.parse(readFileSync(join(ROOT, r, rel), 'utf8')),
    ),
  );
}

const RECENSEMENT = recenserMonnaie(documents());

describe('monnaie — forme UNIQUE dans la donnée authorée (#1463)', () => {
  it('A. une dénomination ne s’écrit qu’en `{gold?, silver?, brass?}` — jamais `bronze`, jamais étalée sur un objet-action', () => {
    const { bronze, montants, etales } = RECENSEMENT;
    // La graphie historique a DISPARU de la donnée : la 3ᵉ dénomination est `brass`, comme au moteur.
    expect(bronze, 'clé `bronze` en donnée — la 3ᵉ dénomination de `Money` est `brass`').toBe(0);

    // Un MONTANT est un objet dont les clés sont des dénominations et rien d'autre : la sonde en voit.
    expect(montants, 'montants en donnée').toBeGreaterThan(0);

    // AUCUN objet-ACTION n'étale de dénomination parmi ses propres clés : toute charge porte un NOM
    // (`giveMoney.montant`, `giveXp.amount`, `givePossession.ref`), et l'enveloppe se mesure ci-dessus
    // comme un montant à part entière.
    expect(etales, 'objets-action qui étalent une monnaie à plat').toEqual({});
  });

  it('B. les noms réservés `price` et `cost` : recensement par CLASSE réelle et par signature d’objet', () => {
    const { classes, signatures } = RECENSEMENT;
    // La classe `number` de `price` est le barème qui USURPE le nom (solde L-monnaie-4).
    expect(hors(classes.price, CLASSES_DE_PRICE), 'classes de `price`').toEqual([]);
    expect(hors(signatures.price, SIGNATURES_DE_PRICE), 'signatures d’objet sous `price`').toEqual([]);
    expect(signatures.price['brass,gold,silver'], 'colonne Prix chiffrée').toBeGreaterThan(0);

    // `cost` est RENDU à son type (L-monnaie-4) : il nomme seulement de la monnaie. L'économie du
    // Tour dit `coutAction`, le barème d'installation navale `installation`, les paliers de prothèse
    // `px`, les deux coûts d'Avantage du Flow `coutEnAvantage` / `avantageOuMouvement`, la réaction de
    // défense `avantage`. Le contenu du commun n'en porte aucun : son témoin positif vit au projet qui en écrit.
    expect(hors(classes.cost, ['object']), 'classes de `cost`').toEqual([]);
    expect(coutsHorsMonnaie(signatures.cost), 'signatures d’objet sous `cost`').toEqual([]);
  });
});

/**
 * FORME UNIQUE de la monnaie dans la donnée AUTHORÉE (#1463, vague `monnaie`).
 *
 * Le mode de panne fermé ici est la RÉAPPARITION SILENCIEUSE d'une 2ᵉ graphie : la bourse a vécu
 * quatre ans en `{gold, silver, bronze}` côté catalogues et en `{gold, silver, brass}` côté moteur
 * (`Money`, `src/engine/money.ts:10`), sans qu'aucun test ne voie les deux à la fois — chaque côté
 * était vert sur SA graphie, et `priceToMoney` traduisait au milieu.
 *
 * Les deux sondes marchent la DONNÉE des 2 racines authorées (`src/data`, `src/scenes`), jamais le
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
import { estObjet } from '../lib/objet.mjs';

const ROOT = process.cwd();
const RACINES = ['src/data', 'src/scenes'];
/** Les 3 dénominations de `Money` + la graphie HISTORIQUE `bronze`, que la sonde A doit voir à ZÉRO. */
const DENOMINATIONS = ['gold', 'silver', 'brass', 'bronze'];

function documents(): unknown[] {
  return RACINES.flatMap((r) =>
    listerArbre(join(ROOT, r), { filtre: (rel) => rel.endsWith('.json') }).map((rel) =>
      JSON.parse(readFileSync(join(ROOT, r, rel), 'utf8')),
    ),
  );
}

type Compte = Record<string, number>;
const inc = (c: Compte, k: string) => { c[k] = (c[k] ?? 0) + 1; };

/** Marche TOUT nœud objet des documents, en donnant à `visiter` ses clés. */
function marcherObjets(noeud: unknown, visiter: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(noeud)) { for (const e of noeud) marcherObjets(e, visiter); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  visiter(noeud as Record<string, unknown>);
  for (const v of Object.values(noeud)) marcherObjets(v, visiter);
}

const DOCS = documents();

describe('monnaie — forme UNIQUE dans la donnée authorée (#1463)', () => {
  it('A. une dénomination ne s’écrit qu’en `{gold?, silver?, brass?}` — jamais `bronze`, jamais étalée sur un objet-action', () => {
    let montants = 0;
    const etales: Compte = {};
    let bronze = 0;
    for (const doc of DOCS) marcherObjets(doc, (o) => {
      const cles = Object.keys(o);
      const den = cles.filter((k) => DENOMINATIONS.includes(k)).sort();
      if (den.length === 0) return;
      if (cles.includes('bronze')) bronze++;
      const autres = cles.filter((k) => !DENOMINATIONS.includes(k)).sort();
      if (autres.length === 0) montants++;
      else inc(etales, String(o.type ?? o.op ?? '(objet sans type)'));
    });

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
    const classe = (v: unknown) =>
      v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : v === 'ND' ? "'ND'" : typeof v;
    const classes: Record<'price' | 'cost', Compte> = { price: {}, cost: {} };
    const signatures: Record<'price' | 'cost', Compte> = { price: {}, cost: {} };
    for (const doc of DOCS) marcherObjets(doc, (o) => {
      for (const nom of ['price', 'cost'] as const) {
        if (!Object.prototype.hasOwnProperty.call(o, nom)) continue;
        const v = o[nom];
        inc(classes[nom], classe(v));
        if (estObjet(v)) inc(signatures[nom], Object.keys(v).sort().join(','));
      }
    });

    // `price` = la colonne Prix TELLE QUE LE LIVRE L'IMPRIME (`money.ts:36-39`) : un montant, la
    // marque « ND », ou rien. La classe `number` est le barème qui USURPE le nom (solde L-monnaie-4).
    const hors = (c: Compte, permises: string[]) => Object.keys(c).filter((k) => !permises.includes(k));
    expect(hors(classes.price, ['object', 'null', "'ND'", 'number']), 'classes de `price`').toEqual([]);
    expect(hors(signatures.price, [
      'brass,gold,silver', // la colonne Prix chiffrée
      'automne,ete,hiver,printemps', // barème SAISONNIER d'une cargaison
      'dice', // prix TIRÉ
    ]), 'signatures d’objet sous `price`').toEqual([]);
    expect(signatures.price['brass,gold,silver'], 'colonne Prix chiffrée').toBeGreaterThan(0);

    // `cost` est RENDU à son type (L-monnaie-4) : il nomme seulement de la monnaie. L'économie du
    // Tour dit `coutAction`, le barème d'installation navale `installation`, les paliers de prothèse
    // `px`, les deux coûts d'Avantage du Flow `coutEnAvantage` / `avantageOuMouvement`, la réaction de
    // défense `avantage`. UNE seule classe subsiste, et chaque objet est un montant.
    expect(hors(classes.cost, ['object']), 'classes de `cost`').toEqual([]);
    expect(Object.keys(signatures.cost).filter((sig) => sig.split(',').some((k) => !['gold', 'silver', 'brass'].includes(k))), 'signatures d’objet sous `cost`').toEqual([]);
    expect(classes.cost.object, 'tarifs d’arène').toBeGreaterThan(0);
  });
});

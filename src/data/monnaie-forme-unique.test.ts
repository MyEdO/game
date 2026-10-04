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
 *     la colonne Prix telle que le livre l'imprime, `number` est le barème de qualité du vin (`land-cargo.json › wineQuality`).
 *     Le contrat porte sur l'ENSEMBLE des classes et signatures admises ; leurs comptes vivent avec le
 *     corpus et s'impriment en diagnostic, sauf le barème `number`, au compte fixé par sa table.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';

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
    const montants: Compte = {};
    const etales: Compte = {};
    let bronze = 0;
    for (const doc of DOCS) marcherObjets(doc, (o) => {
      const cles = Object.keys(o);
      const den = cles.filter((k) => DENOMINATIONS.includes(k)).sort();
      if (den.length === 0) return;
      if (cles.includes('bronze')) bronze++;
      const autres = cles.filter((k) => !DENOMINATIONS.includes(k)).sort();
      if (autres.length === 0) inc(montants, den.join(','));
      else inc(etales, String(o.type ?? o.op ?? '(objet sans type)'));
    });

    // La graphie historique a DISPARU de la donnée : la 3ᵉ dénomination est `brass`, comme au moteur.
    expect(bronze, 'clé `bronze` en donnée — la 3ᵉ dénomination de `Money` est `brass`').toBe(0);

    // Recensement des MONTANTS (un objet dont les clés sont des dénominations et rien d'autre) :
    // les catalogues chiffrent les 3, un coût authoré n'écrit que ce qu'il coûte.
    expect(Object.keys(montants).sort(), `signatures de montant (observé : ${JSON.stringify(montants)})`).toEqual([
      'brass,gold,silver', // colonnes Prix (trappings, vehicles, creatures, machines de guerre) + solde d'équipage
      'gold', // mise minimale du Mécénat, coût de choix d'arène, `giveMoney.montant`
      'silver', // coûts de choix d'arène, `giveMoney.montant`
      'gold,silver', // `giveMoney.montant` à deux dénominations
      // (#1612, 2026-09-06) : `money.montant` de l'op de bourse PERSONNELLE — gains de Mendier
      // (`activities.json`, la `Formula` du gain et le sou glané sans DR) et amende des gardes
      // (`tables.json`). MÊME geste que L-monnaie-3 sur `giveMoney` : l'op cesse d'ÉTALER `brass`
      // parmi ses clés et porte sa charge sous `montant` (`OP_DEFS.money`, grammaire/mecanique.ts). La
      // valeur y est une `Formula`, pas un nombre — la sonde recense la SIGNATURE, pas le type.
      'brass',
    ].sort());

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
        if (v && typeof v === 'object' && !Array.isArray(v)) inc(signatures[nom], Object.keys(v).sort().join(','));
      }
    });

    // `price` = la colonne Prix TELLE QUE LE LIVRE L'IMPRIME (`money.ts:36-39`) : un montant, la
    // marque « ND », ou rien. La classe `number` est le barème qui USURPE le nom (solde L-monnaie-4).
    expect(Object.keys(classes.price).sort(), `classes de \`price\` (observé : ${JSON.stringify(classes.price)})`)
      .toEqual(['null', 'number', 'object', "'ND'"].sort());
    // `land-cargo.json › wineQuality` : MSRC 13 l.97-104.
    expect(classes.price.number, 'barème `number` sous `price`').toBe(6);
    expect(Object.keys(signatures.price).sort(), `signatures d’objet sous \`price\` (observé : ${JSON.stringify(signatures.price)})`)
      .toEqual([
        'brass,gold,silver', // la colonne Prix chiffrée
        'automne,ete,hiver,printemps', // barème SAISONNIER d'une cargaison
        'dice', // prix TIRÉ
      ].sort());

    // `cost` est RENDU à son type (L-monnaie-4) : il nomme seulement de la monnaie. L'économie du
    // Tour dit `coutAction`, le barème d'installation navale `installation`, les paliers de prothèse
    // `px`, les deux coûts d'Avantage du Flow `advantageCost` / `advantageOrMovement`, la réaction de
    // défense `avantage`. UNE seule classe subsiste, et chaque objet est un montant.
    expect(Object.keys(classes.cost), `classes de \`cost\` (observé : ${JSON.stringify(classes.cost)})`).toEqual(['object']);
    expect(Object.keys(signatures.cost).sort(), `signatures d’objet sous \`cost\` (observé : ${JSON.stringify(signatures.cost)})`)
      .toEqual(['gold', 'silver']); // les tarifs d'arène — la seule population qui garde le nom
  });
});

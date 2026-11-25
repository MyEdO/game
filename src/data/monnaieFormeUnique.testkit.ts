/** Recensement de la monnaie dans des documents authorés (#1463) : la sonde du commun et celle de chaque projet. */
import { estObjet } from '../lib/objet.mjs';

type Compte = Record<string, number>;
const inc = (c: Compte, k: string) => { c[k] = (c[k] ?? 0) + 1; };

/** Les 3 dénominations de `Money` + la graphie HISTORIQUE `bronze`, que la sonde doit voir à ZÉRO. */
const DENOMINATIONS = ['gold', 'silver', 'brass', 'bronze'];

/** `price` = la colonne Prix TELLE QUE LE LIVRE L'IMPRIME (`money.ts:36-39`) : un montant, la marque « ND », ou rien. */
export const CLASSES_DE_PRICE = ['object', 'null', "'ND'", 'number'];
export const SIGNATURES_DE_PRICE = [
  'brass,gold,silver', // la colonne Prix chiffrée
  'automne,ete,hiver,printemps', // barème SAISONNIER d'une cargaison
  'dice', // prix TIRÉ
];

/** Marche TOUT nœud objet des documents, en donnant à `visiter` ses clés. */
function marcherObjets(noeud: unknown, visiter: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(noeud)) { for (const e of noeud) marcherObjets(e, visiter); return; }
  if (noeud == null || typeof noeud !== 'object') return;
  visiter(noeud as Record<string, unknown>);
  for (const v of Object.values(noeud)) marcherObjets(v, visiter);
}

const classe = (v: unknown) =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : v === 'ND' ? "'ND'" : typeof v;

export const hors = (c: Compte, permises: string[]) => Object.keys(c).filter((k) => !permises.includes(k));

/** Signatures d'objet sous `cost` qui nomment autre chose qu'une dénomination de `Money`. */
export const coutsHorsMonnaie = (signatures: Compte) =>
  Object.keys(signatures).filter((sig) => sig.split(',').some((k) => !['gold', 'silver', 'brass'].includes(k)));

export function recenserMonnaie(docs: readonly unknown[]) {
  let montants = 0;
  let bronze = 0;
  const etales: Compte = {};
  const classes: Record<'price' | 'cost', Compte> = { price: {}, cost: {} };
  const signatures: Record<'price' | 'cost', Compte> = { price: {}, cost: {} };
  for (const doc of docs) marcherObjets(doc, (o) => {
    const cles = Object.keys(o);
    const den = cles.filter((k) => DENOMINATIONS.includes(k));
    if (den.length > 0) {
      if (cles.includes('bronze')) bronze++;
      if (cles.every((k) => DENOMINATIONS.includes(k))) montants++;
      else inc(etales, String(o.type ?? o.op ?? '(objet sans type)'));
    }
    for (const nom of ['price', 'cost'] as const) {
      if (!Object.prototype.hasOwnProperty.call(o, nom)) continue;
      const v = o[nom];
      inc(classes[nom], classe(v));
      if (estObjet(v)) inc(signatures[nom], Object.keys(v).sort().join(','));
    }
  });
  return { montants, bronze, etales, classes, signatures };
}

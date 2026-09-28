/**
 * Disponibilité RAW (pur, seedé). LDB 59 « Faire son marché » l.13-34 (p.290-291). Les tables numériques (% de
 * Disponibilité, RATIOS DE TROC) vivent en donnée éditable `src/data/disponibilite.json` (#366).
 *  - Test de Disponibilité (réussite si d100 ≤ %) : Commune = toujours ; Limitée/Rare = table ;
 *    Exotique = jamais (sauf curaté/commande).
 *  - Quantité de base si en stock : Village 1 / Ville 1d10 / Cité illimité ; ×2 Commune, ÷2 Rare (ceil).
 */
import { d100, d10, type RNG } from './dice';
import { AVAILABILITIES, type Availability, type TestedAvailability } from './types';
import { disponibilite as dispoJson } from '../data/index';
import { memoParVersion } from '../data/versionDataset';
import { rule } from './policy';
import { t } from '../i18n';

export type Settlement = 'village' | 'ville' | 'cite';
export interface CatalogItem { id: string; label: string; availability: Availability | null; }
export interface StockLine { id: string; label: string; qty: number; test?: { roll: number; target: number } }

/** % de Disponibilité (réussite si d100 ≤ %). Donnée : `src/data/disponibilite.json` (LDB 59 l.25-30). */
export const dispoPct = memoParVersion('disponibilite', () => Object.fromEntries(
  dispoJson.dispoPct.map((e) => [e.availability, e.pct]),
) as Record<TestedAvailability, Record<Settlement, number>>);

/** Quantité en Cité (LDB 59 l.34) — non chiffrée par le RAW : règle éditable `market-cite-stock`. */
function citeQty(): number {
  const v = rule('market-cite-stock');
  return typeof v === 'number' ? v : 99;
}

/** Quantité de base par agglo si en stock (Village 1 / Ville 1d10 / Cité illimité). */
function baseQty(settlement: Settlement, rng: RNG): number {
  if (settlement === 'village') return 1;
  if (settlement === 'ville') return d10(rng);
  return citeQty();
}
/** Modulation par classe : ×2 Commune, ÷2 Rare (arrondi sup.), Limitée = base. Une absence de
 *  Disponibilité (objet HORS COMMERCE forcé en stock par `curated`) ne module rien : aucune classe, donc
 *  aucun facteur — jamais un repli sur Commune, qui inventerait le ×2 le plus favorable. */
function classQty(av: Availability | null, base: number): number {
  if (av === 'Commune') return base * 2;
  if (av === 'Rare') return Math.ceil(base / 2);
  return base;
}

/** LDB 59 l.15 : « Toutes les Possessions possèdent une Disponibilité : Commune, Limitée, Rare ou
 *  Exotique. » L'ensemble est FERMÉ : une ligne qui ne porte AUCUNE de ces quatre classes n'est pas une
 *  Possession mal classée — c'est un objet HORS du commerce ordinaire. Deux formes de non-classe, celles
 *  que le livre imprime : la marque `'ND'` (LDB 62 l.31 Arme improvisée, LDB 68 l.11 Licence de Guilde —
 *  sigle jamais développé dans le corpus FR, arbitrage MAISON [entériné 2026-08-03] sur le
 *  COMPORTEMENT seul, règle 7) et
 *  l'absence de valeur (tiret LDB 62 l.28 Mains nues ; entrée hors table d'équipement). Prédicat UNIQUE
 *  des quatre chemins de commerce (achat, vente, troc, fabrication) : aucun ne se replie sur une classe
 *  inventée. */
export function isTradable(av: unknown): av is Availability {
  return typeof av === 'string' && (AVAILABILITIES as readonly string[]).includes(av);
}

/** Raison AFFICHABLE d'un refus de commerce — le refus porte sa cause, jamais un silence. */
export function outOfTradeReason(label: string): string {
  return t('trade.outOfTrade', { label });
}

export function rollAvailability(av: Availability, settlement: Settlement, rng: RNG, pctBonus = 0): { inStock: boolean; qty: number; test?: { roll: number; target: number } } {
  if (av === 'Commune') return { inStock: true, qty: classQty('Commune', baseQty(settlement, rng)) };
  if (av === 'Exotique') return { inStock: false, qty: 0 };
  // « Les pourcentages de Disponibilité peuvent être augmentés de +10 % ou +20 % » (LDB 59 l.50) —
  // recherche active (personnage assidu / Carrière cohérente / journée entière + Ragot).
  const target = Math.min(99, dispoPct()[av][settlement] + Math.max(0, pctBonus));
  const roll = d100(rng);
  if (roll > target) return { inStock: false, qty: 0, test: { roll, target } };
  return { inStock: true, qty: Math.max(1, classQty(av, baseQty(settlement, rng))), test: { roll, target } };
}

// ── Recherche active de Disponibilité (LDB 59 l.50) ─────────────────────────────────────────────
/**
 * Bonus de % à un Test de Disponibilité (LDB 59 l.50) : « Les pourcentages de Disponibilité peuvent
 * être augmentés de +10 % ou +20 % si un Personnage est particulièrement assidu, appartient à une
 * Carrière cohérente telle que Marchand ou Receleur, ou passe une journée entière à effectuer des
 * achats et des Tests de Ragot. » Chaque circonstance vaut +10 ; le RAW plafonne l'exemple à +20.
 */
export function availabilitySearchBonus(opts: { diligent?: boolean; coherentCareer?: boolean; gossipDay?: boolean }): number {
  const n = (opts.diligent ? 1 : 0) + (opts.coherentCareer ? 1 : 0) + (opts.gossipDay ? 1 : 0);
  return Math.min(2, n) * 10; // « +10 % ou +20 % » (l.50)
}

// ── Vente : Disponibilité d'un ACHETEUR & Baisse des prix (LDB 59 l.52-62) ───────────────────────
/**
 * « Baisse des prix » (LDB 59 l.60) : « Chaque fois que vous divisez l'argent que vous êtes disposé à
 * accepter par deux, la Disponibilité d'un acheteur augmente d'un cran. » `halvings` = nombre de fois
 * où le vendeur divise son prix par deux → la Disponibilité de l'acheteur monte d'autant de crans
 * (Exotique → Rare → Limitée → Commune). Exemple canon (l.62) : Exotique + 2 baisses = Limitée.
 */
export function availabilityAfterHalvings(av: Availability, halvings: number): Availability {
  const i = AVAILABILITIES.indexOf(av);
  if (i < 0) return av;
  return AVAILABILITIES[Math.max(0, i - Math.max(0, Math.floor(halvings)))];
}

/** Prix effectif d'un acheteur après `halvings` divisions de moitié (LDB 59 l.60) : base ÷ 2^halvings. */
export function priceAfterHalvings(baseBrass: number, halvings: number): number {
  return Math.max(0, Math.floor(baseBrass / 2 ** Math.max(0, Math.floor(halvings))));
}

// ── Troc (LDB 59 l.64-76) ───────────────────────────────────────────────────────────────────────
/** RATIOS DE TROC (LDB 59 l.68-76) : `[objets échangés : objets acquis]` selon les deux Disponibilités.
 *  Lecture : donné (ligne) vs acquis (colonne). Ex. Commune → Exotique = 8 : 1 (il faut 8 unités de
 *  l'objet commun pour 1 unité de l'objet exotique). Donnée : `src/data/disponibilite.json`. */
export const barterRatios = memoParVersion('disponibilite', () => Object.fromEntries(
  dispoJson.barterRatios.map((row) => [
    row.give,
    Object.fromEntries(Object.entries(row.ratios).map(([get, r]) => [get, [r.give, r.get]])),
  ]),
) as Record<Availability, Record<Availability, [number, number]>>);

/** Ratio de Troc (LDB 59 l.66-76) : combien d'unités de l'objet DONNÉ contre combien d'unités de
 *  l'objet ACQUIS, d'après leurs Disponibilités. `{ give, get }` = les deux membres du ratio. */
export function barterRatio(give: Availability, get: Availability): { give: number; get: number } {
  const [g, a] = barterRatios()[give][get];
  return { give: g, get: a };
}

/** Stock SANS Test de Disponibilité (règle optionnelle « système d'achat/vente simplifié », LDB 59 l.15) :
 *  tout article disponible (Exotique exclu, HORS COMMERCE exclu — `isTradable`) à sa quantité de classe,
 *  PLUS les articles `curated` — garantis en stock, Disponibilité ignorée (même contrat que `rollStock`,
 *  cf. `MerchantArchetype.curated` : un marchand PEUT tenir nommément un objet hors commerce).
 *  Le rng ne sert qu'à la quantité de base (Ville 1d10). */
export function fullStock(catalog: CatalogItem[], settlement: Settlement, rng: RNG, curated: string[] = []): StockLine[] {
  const out: StockLine[] = [];
  for (const it of catalog) {
    const av = it.availability;
    if (curated.includes(it.id)) {
      out.push({ id: it.id, label: it.label, qty: Math.max(1, classQty(av, baseQty(settlement, rng))) });
      continue;
    }
    if (!isTradable(av) || av === 'Exotique') continue;
    out.push({ id: it.id, label: it.label, qty: Math.max(1, classQty(av, baseQty(settlement, rng))) });
  }
  return out;
}

/** Instantané de stock : pour chaque article du catalogue, Test de Disponibilité (sauf Commune/curaté).
 *  Exotique exclu sauf curaté ; un objet HORS COMMERCE (sans Disponibilité, `isTradable`) n'a pas de
 *  Test à passer — il n'entre en stock que nommément `curated`. Déterministe pour un seed donné. */
export function rollStock(catalog: CatalogItem[], settlement: Settlement, rng: RNG, curated: string[] = [], pctBonus = 0): StockLine[] {
  const out: StockLine[] = [];
  for (const it of catalog) {
    const av = it.availability;
    if (curated.includes(it.id)) {
      out.push({ id: it.id, label: it.label, qty: Math.max(1, classQty(av, baseQty(settlement, rng))) });
      continue;
    }
    if (!isTradable(av)) continue;
    const r = rollAvailability(av, settlement, rng, pctBonus); // recherche active (+10/+20 %, LDB 59 l.50)
    if (r.inStock) out.push({ id: it.id, label: it.label, qty: r.qty, test: r.test });
  }
  return out;
}

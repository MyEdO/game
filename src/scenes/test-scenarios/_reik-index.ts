import type { LandMarketProfile } from '../../engine/landCargo';
import type { IdsParEspace } from '../../data/schemas/_ids.generated';

/**
 * INDEX GÉOGRAPHIQUE DE LA GRANDE PRINCIPAUTÉ DU REIKLAND (2512 CI) — transcription VERBATIM du Compagnon
 * de « Mort sur le Reik » ch.11 « Règles du commerce », l.183-270 (les trois sous-index : Reikland
 * l.185-246, Freistadt de Bögenhafen l.251-258, Freistadt d'Auerswald l.262-270). Aucun indice inventé :
 * Taille / Richesse (colonne « R ») / Produits sont recopiés tels quels ; les colonnes Dirigeant et
 * Garnison/Milice ne sont pas portées (hors périmètre du commerce).
 *
 * Échelle de Taille (l.44-50, l.274) : 1 Hameau · 2 Village · 3 Ville · 4 Grande ville.
 * Échelle de Richesse « R » (l.52-60) : Misérable = « - » (absent) · Pauvre 1 · Moyen 2 · Animé 3 ·
 * Prospère 4 · Florissant 5. NB — la colonne R est utilisée DIRECTEMENT comme indice de Mise à prix
 * (l.150-156 : 1→50 % · 2→−20 % · 3→base · 4→+5 % · 5→+10 %) — l'exemple canon le confirme (Kemperbad
 * R 4 → Mise à prix +5 %, l.172-174). `landCargo.sellOfferPct` lit `richesse` de la même façon.
 *
 * `commerceRichesse` (inversion du d100 de quantité, l.40-42) est laissé NON défini partout : la règle
 * ne s'applique qu'aux Lieux « tirant leur Richesse du Commerce », et l'exemple canon montre Grünburg
 * (pourtant « Commerce » en Produits) NE PAS inverser (l.166-168) → indice ambigu, on n'invente pas.
 * `wineBonusEchelons` n'est posé que là où le livre le CITE explicitement (Kemperbad, +2 échelons, l.95).
 */

/** Colonne « Produits » du livre → id de cargaison, l'espace `land-cargo.json#cargoes` de
 *  `IdsParEspace`. `commerce`/`subsistance` sont des MARQUEURS (pas des biens) portés tels quels ;
 *  « Briques » relève des Produits de luxe (l.117). */
export type Produit = IdsParEspace['land-cargo.json#cargoes'];

/** Une ligne de l'Index géographique (verbatim). `r` = colonne Richesse (`null` = Misérable « - »). */
export interface ReikEntry {
  id: string;
  label: string;
  /** Plage d100 de l'Index (colonne de sélection aléatoire). */
  d100: string;
  /** Indice de Taille (1-4). */
  taille: number;
  /** Indice de Richesse « R » (1-5), ou `null` pour Misérable « - ». */
  r: number | null;
  /** Colonne Produits (ids de cargaison + marqueurs commerce/subsistance). `[]` = colonne « - ». */
  produits: Produit[];
  /** Population (colonne Pop). */
  pop: number;
  /** Le Lieu a un Bac (mention « Bac » en Commentaires) — repère fluvial. */
  bac?: boolean;
  /** Régions à vin/eau-de-vie supérieurs : +N échelons de qualité (l.95, cité pour Kemperbad). */
  wineBonus?: number;
  /** Note du livre (colonne Commentaires) — informatif. */
  note?: string;
}

// ── Index de la Grande Principauté du Reikland (l.185-246) ────────────────────────────────────────────
export const REIK_INDEX: ReikEntry[] = [
  { id: 'altdorf', label: 'Altdorf', d100: '01-08', taille: 4, r: 5, produits: ['commerce'], pop: 1000000, bac: true, note: 'Capitale impériale, Grande Cathédrale de Sigmar, Gouvernement' },
  { id: 'autler', label: 'Autler', d100: '09', taille: 2, r: 2, produits: ['bois', 'vivres'], pop: 124, bac: true },
  { id: 'blutroch', label: 'Blutroch', d100: '10', taille: 2, r: null, produits: [], pop: 0, note: 'Décimé par la Vérole rouge en 2511' },
  { id: 'braunwurt', label: 'Braunwurt', d100: '11', taille: 1, r: 1, produits: ['produits-de-luxe'], pop: 75, note: 'Produits de luxe (Textiles)' },
  { id: 'bundesmarkt', label: 'Bundesmarkt', d100: '12', taille: 2, r: 1, produits: ['vivres'], pop: 105 },
  { id: 'dorchen', label: 'Dorchen', d100: '13', taille: 2, r: 2, produits: ['vivres'], pop: 105 },
  { id: 'frederheim', label: 'Frederheim', d100: '14', taille: 2, r: 1, produits: ['vivres', 'laine'], pop: 116, note: 'À proximité du Grand Hospice de Shallya' },
  { id: 'furtild', label: 'Furtild', d100: '15', taille: 1, r: 1, produits: ['subsistance'], pop: 90 },
  { id: 'geldrecht', label: 'Geldrecht', d100: '16', taille: 1, r: 1, produits: ['bois', 'vivres'], pop: 56, bac: true, note: 'Bac sur le Reik' },
  { id: 'gluckshalt', label: 'Gluckshalt', d100: '17', taille: 1, r: 2, produits: ['vivres'], pop: 87 },
  { id: 'grossbad', label: 'Grossbad', d100: '18', taille: 1, r: 2, produits: ['vivres'], pop: 83 },
  { id: 'hartsklein', label: 'Hartsklein', d100: '19', taille: 1, r: 1, produits: ['produits-de-luxe'], pop: 78, note: 'Produits de luxe (Poterie)' },
  { id: 'heiligen', label: 'Heiligen', d100: '20', taille: 1, r: 2, produits: ['vivres'], pop: 70 },
  { id: 'hochloff', label: 'Hochloff', d100: '21', taille: 1, r: 2, produits: ['vivres'], pop: 98 },
  { id: 'kaldach', label: 'Kaldach', d100: '22', taille: 1, r: 1, produits: ['subsistance'], pop: 63, bac: true },
  { id: 'rechtlich', label: 'Rechtlich', d100: '23', taille: 1, r: 1, produits: ['subsistance'], pop: 51 },
  { id: 'rottefach', label: 'Rottefach', d100: '24', taille: 2, r: 2, produits: ['vivres', 'vin'], pop: 105, bac: true },
  { id: 'schlafebild', label: 'Schlafebild', d100: '25', taille: 1, r: 1, produits: ['vivres', 'vin'], pop: 46 },
  { id: 'teufelfeuer', label: 'Teufelfeuer', d100: '26', taille: 1, r: 1, produits: ['subsistance'], pop: 55, note: 'Réduit en cendres jadis par le répurgateur Fabergus Heinzdork' },
  { id: 'walfen', label: 'Walfen', d100: '27', taille: 2, r: 2, produits: ['produits-de-luxe', 'vivres'], pop: 181, bac: true, note: 'Briques, Vivres' },
  { id: 'chateau-reikguard', label: 'Château Reikguard', d100: '28-29', taille: 3, r: 4, produits: [], pop: 300, note: 'Siège du Grand Prince, forteresse, Gouvernement' },
  { id: 'dunkelburg', label: 'Dunkelburg', d100: '30-34', taille: 3, r: 2, produits: ['vivres', 'laine'], pop: 8900 },
  { id: 'barfsheim', label: 'Barfsheim', d100: '35', taille: 1, r: 1, produits: ['subsistance'], pop: 77, bac: true },
  { id: 'gemusenbad', label: 'Gemusenbad', d100: '36', taille: 1, r: 1, produits: ['subsistance'], pop: 56, bac: true },
  { id: 'harke', label: 'Harke', d100: '37', taille: 1, r: 1, produits: ['subsistance'], pop: 37, bac: true },
  { id: 'ruhfurt', label: 'Ruhfurt', d100: '38', taille: 1, r: 2, produits: ['vivres'], pop: 90 },
  { id: 'schattental', label: 'Schattental', d100: '39', taille: 1, r: 2, produits: ['vivres'], pop: 86 },
  { id: 'steindorf', label: 'Steindorf', d100: '40', taille: 1, r: 1, produits: ['subsistance'], pop: 70, bac: true },
  { id: 'diesdorf', label: 'Diesdorf', d100: '41', taille: 2, r: 2, produits: ['vivres'], pop: 210 },
  { id: 'eilhart', label: 'Eilhart', d100: '42-45', taille: 3, r: 3, produits: ['vivres', 'vin'], pop: 3200 },
  { id: 'grunburg', label: 'Grünburg', d100: '46-49', taille: 3, r: 2, produits: ['commerce'], pop: 2900, bac: true, note: 'Bac, Construction de bateaux' },
  { id: 'aussen', label: 'Aussen', d100: '50', taille: 1, r: 1, produits: ['subsistance'], pop: 95, bac: true },
  { id: 'hornlach', label: 'Hornlach', d100: '51', taille: 2, r: 2, produits: ['bois', 'vivres'], pop: 120, bac: true },
  { id: 'kleindorf', label: 'Kleindorf', d100: '52', taille: 1, r: 1, produits: ['vivres'], pop: 40, bac: true },
  { id: 'silberwurt', label: 'Silberwurt', d100: '53', taille: 2, r: 2, produits: ['vivres', 'laine'], pop: 110 },
  { id: 'worlitz', label: 'Wörlitz', d100: '54', taille: 2, r: 2, produits: ['vivres'], pop: 105 },
  { id: 'kemperbad', label: 'Kemperbad', d100: '55-58', taille: 3, r: 4, produits: ['armement', 'commerce', 'metal', 'vin'], pop: 9600, bac: true, wineBonus: 2, note: 'La meilleure eau-de-vie de l’Empire de cette région, statut Freistadt' },
  { id: 'berghof', label: 'Berghof', d100: '59', taille: 1, r: 2, produits: ['vivres'], pop: 85 },
  { id: 'brandenburg', label: 'Brandenburg', d100: '60', taille: 1, r: 3, produits: ['vin', 'vivres'], pop: 95, bac: true, note: '« Echte Brandenburger », eau-de-vie préférée de l’Empereur' },
  { id: 'jungbach', label: 'Jungbach', d100: '61', taille: 2, r: 3, produits: ['vin'], pop: 105, bac: true },
  { id: 'ostwald', label: 'Ostwald', d100: '62', taille: 1, r: 3, produits: ['vin'], pop: 88 },
  { id: 'stockhausen', label: 'Stockhausen', d100: '63', taille: 2, r: 3, produits: ['vin', 'laine'], pop: 117 },
  { id: 'merretheim', label: 'Merretheim', d100: '64', taille: 1, r: 1, produits: ['subsistance'], pop: 67 },
  { id: 'misthausen', label: 'Misthausen', d100: '65', taille: 1, r: 1, produits: ['subsistance'], pop: 43, bac: true },
  { id: 'naffdorf', label: 'Naffdorf', d100: '66', taille: 1, r: 1, produits: ['subsistance'], pop: 75, bac: true },
  { id: 'pfeiffer', label: 'Pfeiffer', d100: '67', taille: 1, r: 1, produits: ['subsistance'], pop: 60 },
  { id: 'ubersreik', label: 'Ubersreik', d100: '68-74', taille: 3, r: 4, produits: ['armement', 'commerce', 'metal'], pop: 7500, bac: true, note: 'Bac, Travail des métaux' },
  { id: 'buchedorf', label: 'Buchedorf', d100: '75', taille: 2, r: 2, produits: ['vivres', 'laine'], pop: 158, bac: true },
  { id: 'flussberg', label: 'Flussberg', d100: '76', taille: 1, r: 2, produits: ['vivres'], pop: 95, bac: true },
  { id: 'geissbach', label: 'Geissbach', d100: '77', taille: 1, r: 2, produits: ['vivres'], pop: 66 },
  { id: 'halheim', label: 'Halheim', d100: '78', taille: 1, r: 1, produits: ['subsistance'], pop: 49 },
  { id: 'hugeldal', label: 'Hugeldal', d100: '79', taille: 2, r: 3, produits: ['metal'], pop: 316 },
  { id: 'messingen', label: 'Messingen', d100: '80', taille: 2, r: 3, produits: ['vivres', 'armement', 'metal'], pop: 111, note: 'Proche de la mine de Hugeldal' },
  { id: 'wurfel', label: 'Wurfel', d100: '81', taille: 1, r: 2, produits: ['vivres'], pop: 75 },
  { id: 'weissbruck', label: 'Weissbruck', d100: '82', taille: 2, r: 2, produits: ['commerce', 'produits-de-luxe'], pop: 359, bac: true, note: 'Bac, maison éclusière sur le canal d’Altdorf' },
  { id: 'wittgendorf', label: 'Wittgendorf', d100: '83', taille: 2, r: 1, produits: ['subsistance'], pop: 150 },
  // ── Freistadt de Bögenhafen (l.251-258) ──
  { id: 'bogenhafen', label: 'Bögenhafen', d100: '84-86', taille: 3, r: 3, produits: ['commerce', 'vin', 'bois'], pop: 10500, note: 'Centre du marché local' },
  { id: 'ardlich', label: 'Ardlich', d100: '87', taille: 2, r: 2, produits: ['vivres', 'laine'], pop: 155 },
  { id: 'finsterbad', label: 'Finsterbad', d100: '88', taille: 2, r: 3, produits: ['vivres', 'vin', 'laine'], pop: 140, bac: true },
  { id: 'grubevon', label: 'Grubevon', d100: '89', taille: 1, r: 2, produits: ['vivres'], pop: 90 },
  { id: 'herzhald', label: 'Herzhald', d100: '90', taille: 2, r: 2, produits: ['bois'], pop: 140 },
  { id: 'chateau-grauenburg', label: 'Château Grauenburg', d100: '91', taille: 2, r: 4, produits: [], pop: 350, note: 'Siège des terres des von Saponatheim, forteresse, Gouvernement' },
  // ── Freistadt d'Auerswald (l.262-270) ──
  { id: 'auerswald', label: 'Auerswald', d100: '92-94', taille: 3, r: 3, produits: ['commerce', 'metal'], pop: 5000, bac: true },
  { id: 'dresschler', label: 'Dresschler', d100: '95', taille: 1, r: 2, produits: ['vivres', 'laine'], pop: 76, bac: true },
  { id: 'gladisch', label: 'Gladisch', d100: '96', taille: 1, r: 1, produits: ['laine'], pop: 50, bac: true },
  { id: 'hahnbrandt', label: 'Hahnbrandt', d100: '97', taille: 2, r: 3, produits: ['armement', 'metal'], pop: 250 },
  { id: 'koch', label: 'Koch', d100: '98', taille: 2, r: 2, produits: ['armement', 'vivres', 'metal'], pop: 115, note: 'Près de la mine de Hahnbrandt dans les Hägercrybs' },
  { id: 'sprinthof', label: 'Sprinthof', d100: '99', taille: 1, r: 2, produits: ['vivres', 'produits-de-luxe'], pop: 87, note: 'Relais, meilleur fromage fumé du Reikland' },
  { id: 'steche', label: 'Steche', d100: '00', taille: 1, r: 2, produits: ['vivres', 'laine'], pop: 75, bac: true },
];

/** Le Lieu a-t-il une cargaison à échanger (colonne Produits autre que « Subsistance » / « - », l.24) et
 *  une Richesse chiffrée ? Sinon il n'a pas de marché (rien à acheter ni à mettre à prix). */
export function hasTradeGoods(e: ReikEntry): boolean {
  return e.r != null && e.produits.some((p) => p !== 'subsistance');
}

/** Profil de marché (`LandMarketProfile`) d'une entrée de l'Index — Taille + Richesse + Produits verbatim. */
export function reikMarket(e: ReikEntry): LandMarketProfile {
  return {
    taille: e.taille,
    richesse: e.r!,
    produits: e.produits,
    ...(e.wineBonus ? { wineBonusEchelons: e.wineBonus } : {}),
  };
}

import { describe, it, expect } from 'vitest';
import trappings from './trappings.json';
import { validateDataset } from './schemas/validate';
import { AVAILABILITIES, REACH_LABELS, REACH_VARIABLE } from '../engine/types';
import { priceToMoney, toBrass } from '../engine/money';

/**
 * Garde-fou de DONNÉE — verrouille l'invariant « Allonge ⊥ Portée » (LDB 62) et empêche le retour du
 * « type menteur » `reach: string|null` (qui contenait jadis des NOMBRES, puis des formules de Portée).
 *   - `reach` = Allonge de MÊLÉE (string « Moyenne »/« Longue »…) / null — JAMAIS un nombre, JAMAIS une
 *     formule de Portée « BFx3 ». (Les munitions gardent EN PLUS un modificateur relatif à l'arme —
 *     « Moitié de l'arme »/« +50 »… — axe distinct, hors `range` propre.)
 *   - `range` = SPEC de Portée de tir : `number` (mètres fixes) OU `{bf}` (arme de jet : BF×bf m).
 *     UNIQUEMENT sur les armes à distance.
 */
const rows = trappings as { id: string; categorie: string; subType?: string; reach?: unknown; range?: unknown; ammoRangeMod?: unknown; enc?: unknown; availability?: unknown; price: { gold: number; silver: number; brass: number } | 'ND' | null }[];

const ALLONGE = new Set(['Personnelle', 'Très courte', 'Courte', 'Moyenne', 'Longue', 'Très longue', 'Considérable', 'Variable']);
const isNumericLike = (v: unknown): boolean =>
  typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && /^\d+(\.\d+)?$/.test(v.trim()));
const isThrownFormula = (v: unknown): boolean => typeof v === 'string' && /^BF(x\d+)?$/.test(v.trim());
const isBfSpec = (v: unknown): v is { bf: number } => typeof v === 'object' && v != null && typeof (v as { bf?: unknown }).bf === 'number';
const isAmmoMod = (v: unknown): boolean => typeof v === 'object' && v != null &&
  ((typeof (v as { mult?: unknown }).mult === 'number') !== (typeof (v as { add?: unknown }).add === 'number'));

describe('trappings — invariant Allonge (reach) ⊥ Portée (range)', () => {
  it('AUCUN `reach` numérique ni formule de Portée « BFxN » (type menteur éliminé)', () => {
    expect(rows.filter((t) => isNumericLike(t.reach)).map((t) => t.id)).toEqual([]);
    expect(rows.filter((t) => isThrownFormula(t.reach)).map((t) => t.id)).toEqual([]);
  });

  it('`reach` est toujours string|null (jamais un nombre)', () => {
    expect(rows.filter((t) => t.reach != null && typeof t.reach !== 'string').map((t) => t.id)).toEqual([]);
  });

  it('`range` = number (mètres fixes) OU {bf} (jet), porté UNIQUEMENT par une arme à distance', () => {
    const withRange = rows.filter((t) => t.range != null);
    expect(withRange.length).toBeGreaterThan(0);
    expect(withRange.every((t) => typeof t.range === 'number' || isBfSpec(t.range))).toBe(true);
    expect(withRange.filter((t) => t.categorie !== 'ranged').map((t) => t.id)).toEqual([]);
  });

  it('toute arme de JET (`range:{bf}`) a un bf > 0 et un `reach` nul', () => {
    const thrown = rows.filter((t) => isBfSpec(t.range));
    expect(thrown.length).toBeGreaterThanOrEqual(9); // javelot, couteau-de-lancer, bolas, lasso, bombe…
    expect(thrown.every((t) => (t.range as { bf: number }).bf > 0 && t.reach == null)).toBe(true);
  });

  it('une arme de mêlée n\'a pas de Portée', () => {
    expect(rows.filter((t) => t.categorie === 'melee' && t.range != null).map((t) => t.id)).toEqual([]);
  });

  it('échantillon : Arc (50 m), Javelot (BF×3, reach nul), Hallebarde (Allonge « Longue », pas de Portée)', () => {
    const arc = rows.find((t) => t.id === 'arc')!;
    expect(arc.reach).toBeNull();
    expect(arc.range).toBe(50);
    const jav = rows.find((t) => t.id === 'javelot')!;
    expect(jav.reach).toBeNull();
    expect(jav.range).toEqual({ bf: 3 });
    const hall = rows.find((t) => t.id === 'hallebarde')!;
    expect(hall.reach).toBe('Longue');
    expect(hall.range ?? null).toBeNull();
  });

  it('`reach` = Allonge PURE : uniquement un libellé whitelisté, ou null (aucun modificateur de munition)', () => {
    const bad = rows.filter((t) => t.reach != null && !(typeof t.reach === 'string' && ALLONGE.has(t.reach)));
    expect(bad.map((t) => `${t.id}=${JSON.stringify(t.reach)}`)).toEqual([]);
  });

  it('modificateur de munition = `ammoRangeMod` STRUCTURÉ ({mult}|{add}), avec `reach:null`', () => {
    const withMod = rows.filter((t) => t.ammoRangeMod != null);
    expect(withMod.length).toBeGreaterThanOrEqual(12); // Moitié/Quart/+50/-10/+10…
    expect(withMod.every((t) => isAmmoMod(t.ammoRangeMod) && t.reach == null)).toBe(true);
    // échantillon : mitraille = ¼ ; baton-pointu = ½ ; flèche elfique = +50 m.
    expect(rows.find((t) => t.id === 'mitraille-et-poudre')!.ammoRangeMod).toEqual({ mult: 0.25 });
    expect(rows.find((t) => t.id === 'baton-pointu')!.ammoRangeMod).toEqual({ mult: 0.5 });
    expect(rows.find((t) => t.id === 'fleche-elfique')!.ammoRangeMod).toEqual({ add: 50 });
  });
});

describe('trappings — `enc` typé HONNÊTEMENT (number ou cas spéciaux non-encombrants)', () => {
  // La donnée porte des STRINGS non chiffrées sur des objets non-encombrants : « ND » (ateliers),
  // « Variable » (arme improvisée). Le type les déclare ; le calcul d'Encombrement les traite comme 0.
  const ENC_STRINGS = new Set(['ND', 'Variable']);
  it('`enc` est un nombre, null, ou une string autorisée (« ND »/« Variable ») — jamais une autre string', () => {
    const bad = rows.filter((t) => t.enc != null && typeof t.enc !== 'number' && !(typeof t.enc === 'string' && ENC_STRINGS.has(t.enc)));
    expect(bad.map((t) => `${t.id}=${JSON.stringify(t.enc)}`)).toEqual([]);
  });
});

describe('trappings — vocabulaire d’Allonge FERMÉ au CHARGEMENT (fail-fast)', () => {
  // Gabarit = une entrée RÉELLE du catalogue (la Hallebarde) : seule l'Allonge varie.
  const entry = (reach: unknown) => [{ ...rows.find((t) => t.id === 'hallebarde')!, reach }];
  it('un libellé de l’axe (LDB 62 l.158-164) ou « Variable » (l.31) passe', () => {
    for (const r of [...Object.values(REACH_LABELS), REACH_VARIABLE, null]) {
      expect(validateDataset('trappings.json', entry(r))).toBeNull();
    }
  });
  it('une Allonge HORS axe est REFUSÉE au chargement (elle ne se normalise pas en silence)', () => {
    const err = validateDataset('trappings.json', entry('Gigantesque'));
    expect(err).not.toBeNull();
    expect(err).toContain('élément « hallebarde » › Allonge');
  });
});

/**
 * Garde-fou de DONNÉE — la Disponibilité se dit COMME LE LIVRE L'IMPRIME. LDB 59 l.15 : « Toutes les
 * Possessions possèdent une Disponibilité : Commune, Limitée, Rare ou Exotique. » Deux formes hors des
 * quatre classes, mesurées sur tout le corpus FR (`\bND\b` : 4 occurrences, toutes en cellule, aucune
 * légende) : la marque `'ND'` (LDB 62 l.31 « Arme improvisée | ND | Variable | ND », LDB 68 l.11
 * « Licence de Guilde | ND | 0 | ND ») et l'absence de valeur `null` (tiret de LDB 62 l.28 « Mains nues
 * | ND | 0 | – », ou entrée hors table d'équipement). Les deux se comportent pareil au commerce
 * (`isTradable`), mais ne se confondent pas en donnée.
 */
describe('trappings — Disponibilité : les 4 classes, la marque « ND », ou rien', () => {
  const CLASSES = new Set<string>(AVAILABILITIES);

  it('aucune entrée ne porte une valeur hors du vocabulaire (4 classes + « ND » + null)', () => {
    const bad = rows.filter((t) => t.availability !== null && t.availability !== 'ND' && !CLASSES.has(t.availability as string));
    expect(bad.map((t) => `${t.id}=${JSON.stringify(t.availability)}`)).toEqual([]);
  });

  it('le schéma ACCEPTE « ND » et `null`, REFUSE toute autre marque (vocabulaire fermé, fail-fast)', () => {
    const gabarit = (availability: unknown) => [{ ...rows.find((t) => t.id === 'hallebarde')!, availability }];
    expect(validateDataset('trappings.json', gabarit(null))).toBeNull();
    expect(validateDataset('trappings.json', gabarit('Rare'))).toBeNull();
    expect(validateDataset('trappings.json', gabarit('ND'))).toBeNull();
    const err = validateDataset('trappings.json', gabarit('Introuvable'));
    expect(err).not.toBeNull();
    expect(err).toContain('élément « hallebarde » › Disponibilité');
  });

  it('les 2 lignes « ND » du livre portent la marque, et elles seules (LDB 62 l.31, LDB 68 l.11)', () => {
    expect(rows.filter((t) => t.availability === 'ND').map((t) => t.id).sort()).toEqual(
      ['arme-improvisee', 'licence-de-guilde'],
    );
  });

  it('les objets sans valeur imprimée gardent leur absence — aucune classe ne leur est inventée', () => {
    expect(rows.filter((t) => t.availability === null).map((t) => t.id).sort()).toEqual(
      [
        // Tiret en colonne Disponibilité (LDB 62 l.28) : le livre n'imprime AUCUNE valeur.
        'mains-nues',
        // Hors table d'équipement : malepierre (LDB 44 l.113-119, ch.46 l.164-173 — le livre ne lui
        // donne ni prix ni Disponibilité nulle part), sel sacré (MDG 10 l.112-122, prose seule),
        // carte marine (MDG 15 l.290 — produite par une Activité, sa valeur est PAR INSTANCE).
        'malepierre-brute', 'malepierre-raffinee', 'sel-sacre', 'carte-marine',
        // Artefacts magiques (VDM 12) : le chapitre ne tabule ni Prix ni Disponibilité pour eux — ni
        // pour les potions (il chiffre le COÛT DES INGRÉDIENTS d'une cuvée, pas un prix de vente), ni
        // pour les grimoires nommés, les pierres de pouvoir et les objets maudits. Seules les robes de
        // sorcier (VDM 12 folio 151) ont une ligne Coût/Enc/Disponibilité, et la portent.
        'baton-enchante', 'parchemin-de-sort',
        'l-ami-debauche', 'concentre-de-pouvoir', 'lotion-capillaire', 'musc-de-sanglier', 'nectar-de-beaute',
        'nectar-de-veracite', 'nectar-de-vitalite', 'panacea-universalis', 'potion-d-invisibilite',
        'potion-de-divination', 'potion-de-focalisation', 'potion-de-puissance', 'potion-de-vol',
        'tonifiant-de-lucidite',
        'les-ecrits-de-sedelmann', 'les-livres-de-wa', 'les-livres-caches-de-chamon', 'le-tome-de-pouvoir-de-krampi',
        'saphir-veritable', 'mortegemme', 'ambrespectre', 'luminante', 'rubis-igne', 'pierre-d-or',
        'cristal-de-brume', 'vitaellum',
        'arc-d-empathie-sanglante', 'bottes-du-remords-soudain', 'cotte-de-mailles-de-bravoure-usurpee',
        'dague-voleuse-de-chance', 'dechireur-de-sociabilite', 'epee-de-retenue',
        'fibule-d-attraction-non-souhaitee', 'fleau-d-attention-non-sollicitee', 'hache-de-fureur-incessante',
        'pistolet-de-solitude-involontaire', 'poings-d-ignominie',
        // Anneau d'Opsianon (EDO 11 l.247-263) : objet d'intrigue décrit en prose, hors de toute table
        // d'équipement — l'Appendice ne lui imprime ni Prix ni Disponibilité.
        'anneau-d-opsianon',
      ].sort(),
    );
  });
});

/**
 * Garde-fou de DONNÉE — le PRIX se dit COMME LE LIVRE L'IMPRIME, au MÊME titre que la Disponibilité
 * et que l'Enc (qui porte déjà « ND »/« Variable »). Trois lignes du corpus FR impriment la marque en
 * colonne Prix/Coût — LDB 62 l.20 en-tête « Arme | Prix | Enc | Disponibilité » :
 *   LDB 62 l.28 « | Mains nues | ND | 0 | – | Personnelle | +BF +0 | Inoffensive |»
 *   LDB 62 l.31 « | Arme improvisée | ND | Variable | ND | Variable | +BF +1 | Inoffensive |»
 *   LDB 68 l.11 (en-tête l.7 « Objet | Coût | Enc | Disponibilité ») « | Licence de Guilde | ND | 0 | ND |»
 * `null` dit autre chose : le livre n'imprime AUCUNE valeur (prose sans table, hors table
 * d'équipement). Les deux valent zéro sou au calcul, mais ne se confondent pas en donnée.
 */
describe('trappings — Prix : un montant, la marque « ND », ou rien', () => {
  it('les 3 lignes « ND » en colonne Prix portent la marque, et elles seules', () => {
    expect(rows.filter((t) => t.price === 'ND').map((t) => t.id).sort()).toEqual(
      ['arme-improvisee', 'licence-de-guilde', 'mains-nues'],
    );
  });

  it('le schéma ACCEPTE « ND », un montant et `null`, REFUSE toute autre marque (fail-fast)', () => {
    const gabarit = (price: unknown) => [{ ...rows.find((t) => t.id === 'hallebarde')!, price }];
    expect(validateDataset('trappings.json', gabarit(null))).toBeNull();
    expect(validateDataset('trappings.json', gabarit({ gold: 2, silver: 0, brass: 0 }))).toBeNull();
    expect(validateDataset('trappings.json', gabarit('ND'))).toBeNull();
    const err = validateDataset('trappings.json', gabarit('Variable'));
    expect(err).not.toBeNull();
    expect(err).toContain('élément « hallebarde » › Prix');
  });

  it('la marque ne se dégrade pas en gratuité : zéro sou au calcul, mais RENDUE telle quelle', () => {
    const mains = rows.find((t) => t.id === 'mains-nues')!;
    expect(toBrass(priceToMoney(mains.price))).toBe(0);
    expect(priceToMoney(mains.price)).toEqual(priceToMoney(null)); // même comportement monétaire que l'absence
    expect(mains.price).not.toBeNull(); // …et pourtant une donnée distincte de l'absence
  });

  it('un prix ABSENT du livre reste absent — jamais un `{0,0,0}` qui dirait « gratuit »', () => {
    // Prose sans table (MDG 10 l.112-122 sel sacré, MDG 15 l.290 carte marine) : rien à imprimer.
    for (const id of ['sel-sacre', 'carte-marine']) expect(rows.find((t) => t.id === id)!.price).toBeNull();
  });
});

/**
 * Garde-fou de DONNÉE — l'Encombrement d'une entrée hors table. LDB 61 l.5 : « tous les objets sont
 * indiqués comme pesant un certain nombre de Points d'Encombrement (parfois abrégé en « Enc »), en
 * général entre 0-3, où 0 indique un objet insignifiant facilement transportable ». Le livre ne pose
 * aucune valeur par défaut pour ce qu'il ne tabule pas : `enc: 0` y AFFIRMERAIT « insignifiant ».
 * Les deux entrées MDG issues de prose seule portent donc `null` (traité comme 0 au calcul,
 * `itemFromTrappingById` — le comportement ne change pas, l'affirmation disparaît).
 */
describe('trappings — Enc : aucune valeur inventée pour une entrée hors table', () => {
  it('sel sacré et carte marine n’ont pas d’Enc imprimé (MDG 10 l.112-122, MDG 15 l.290)', () => {
    for (const id of ['sel-sacre', 'carte-marine']) expect(rows.find((t) => t.id === id)!.enc).toBeNull();
  });

  it('les lignes de TABLE gardent leur Enc imprimé (LDB 62 l.28, LDB 68 l.11)', () => {
    expect(rows.find((t) => t.id === 'mains-nues')!.enc).toBe(0);
    expect(rows.find((t) => t.id === 'licence-de-guilde')!.enc).toBe(0);
    expect(rows.find((t) => t.id === 'atelier')!.enc).toBe('ND'); // LDB 69 l.9 « | Atelier | 80CO | ND | Exotique |»
  });
});

/**
 * `Arme improvisée` (LDB 62 l.31) EST une ligne du livre — « ND | Variable | ND | Variable | +BF +1 |
 * Inoffensive » — donc une entrée de catalogue qui porte ses informations. Son PROFIL de combat est LU
 * dans cette entrée par `improvisedProfile` (`engine/weaponDamage.ts`), qui l'applique à l'arme portée :
 * la donnée décide, le code dérive. Les marques « Variable » (Enc, Allonge) n'appartiennent qu'à elle.
 */
describe('trappings — l’Arme improvisée est une entrée, et la seule « Variable »', () => {
  it('l’entrée existe et porte la ligne du livre', () => {
    const t = rows.find((x) => x.id === 'arme-improvisee');
    expect(t).toBeDefined();
    expect({ enc: t!.enc, reach: t!.reach, availability: t!.availability }).toEqual({
      enc: 'Variable', reach: REACH_VARIABLE, availability: 'ND',
    });
  });

  it('elle est la SEULE entrée à porter « Variable » en Enc ou en Allonge', () => {
    expect(rows.filter((t) => t.enc === 'Variable' || t.reach === REACH_VARIABLE).map((t) => t.id).sort()).toEqual(['arme-improvisee']);
  });
});

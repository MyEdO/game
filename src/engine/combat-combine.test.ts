import { describe, it, expect, afterEach } from 'vitest';
import { attackModifiers, combineMods, defenseModifiers, rangeBandModifier, rangeBandName, weaponReachPenalty } from './combat';
import { setRule, resetRule } from './policy';
import type { Combatant, ModLine, Weapon } from './types';

describe('combineMods — Combiner les Difficultés (LDB 14 l.91-96)', () => {
  it('plafonne la somme des malus à -30', () => {
    expect(combineMods([{ label: 'a', value: -20, famille: 'circonstance' }, { label: 'b', value: -20, famille: 'circonstance' }])).toBe(-30);
  });
  it('plafonne la somme des bonus à +60', () => {
    expect(combineMods([{ label: 'a', value: 40, famille: 'circonstance' }, { label: 'b', value: 40, famille: 'circonstance' }])).toBe(60);
  });
  it('mélange bonus + malus se somme (plafonds séparés)', () => {
    expect(combineMods([{ label: 'a', value: 40, famille: 'circonstance' }, { label: 'b', value: -20, famille: 'circonstance' }])).toBe(20);
  });
  it('un modificateur du JETEUR (Avantage) est hors plafond — seules les circonstances se combinent', () => {
    // Avantage +70 (`famille: 'jet'`, hors table l.48) + deux circonstances −20 plafonnées à −30 → +40.
    expect(
      combineMods([
        { label: 'Avantage', value: 70, famille: 'jet' },
        { label: 'x', value: -20, famille: 'circonstance' },
        { label: 'y', value: -20, famille: 'circonstance' },
      ]),
    ).toBe(40);
  });
  it('les ÉTATS du jeteur s’accumulent SANS plafond (LDB 16 l.11 : « 3 États Exténué […] −30 à tous vos Tests »)', () => {
    // 4 pions Exténué = −40 sec : plafonner ici rendrait la règle d'accumulation muette au 4ᵉ pion.
    const extenue = (n: number) => Array.from({ length: n }, () => ({ label: 'Exténué', value: -10, famille: 'jet' as const }));
    expect(combineMods(extenue(3))).toBe(-30);
    expect(combineMods(extenue(4))).toBe(-40);
  });
  it('un ÉTAT n’est JAMAIS absorbé par des circonstances saturées (le delta vaut exactement l’État)', () => {
    // Brouillard −20 + Localisation visée −20 : la combinaison des CIRCONSTANCES sature à −30 (l.95).
    const circ = [{ label: 'Brouillard', value: -20, famille: 'circonstance' as const }, { label: 'Localisation visée', value: -20, famille: 'circonstance' as const }];
    const empoisonne = { label: 'Empoisonné', value: -10, famille: 'jet' as const };
    expect(combineMods(circ)).toBe(-30);
    expect(combineMods([...circ, empoisonne])).toBe(-40); // −30 (circonstances saturées) + −10 (l'État, sec)
    expect(combineMods([...circ, empoisonne]) - combineMods(circ)).toBe(empoisonne.value);
  });
  it('liste vide → 0', () => {
    expect(combineMods([])).toBe(0);
  });
  it('BONUS : l’Avantage s’ajoute PAR-DESSUS la circonstance déjà au maximum (+40 + +60 = +100)', () => {
    // « Tirer dans une foule (13+ cibles) » EST le barreau +60 de la table (l.52) : la combinaison des
    // circonstances y est saturée, l'Avantage du jeteur s'ajoute quand même — il n'est pas une entrée.
    expect(combineMods([
      { label: 'Avantage', value: 40, famille: 'jet' },
      { label: 'Tirer dans le tas (13+)', value: 60, famille: 'circonstance' },
    ])).toBe(100);
  });
  /** Les DEUX exemples chiffrés du livre (l.95 et l.96), rejoués nommément : ils ne portent que des
   *  entrées de la table, donc le lot ne les déplace pas d'un point. */
  it('exemple RAW l.95 — brouillard + Localisation visée : « le Test devient simplement Très Difficile (-30) »', () => {
    expect(combineMods([
      { label: 'Brouillard', value: -20, famille: 'circonstance' },
      { label: 'Localisation visée', value: -20, famille: 'circonstance' },
    ])).toBe(-30);
  });
  it('exemple RAW l.96 — neige −30 + cible À Terre +20 : « le Test sera Difficile (-10) »', () => {
    expect(combineMods([
      { label: 'Neige épaisse', value: -30, famille: 'circonstance' },
      { label: 'À Terre', value: 20, famille: 'circonstance' },
    ])).toBe(-10);
  });
});

/**
 * SÉPARABILITÉ DES FAMILLES — la propriété STRUCTURELLE que `combineMods` doit tenir, balayée sur
 * des dizaines de milliers de tirages plutôt que sur des cas choisis. Deux invariants :
 *
 *  1. `combineMods(toutes) === combineMods(circonstances) + Σ(lignes jet)` — le plafond ne mord que
 *     d'un côté de la frontière (`LDB 14 l.48/95`), donc rien de ce qu'il coupe aux circonstances ne
 *     peut être remboursé aux modificateurs du jeteur, ni l'inverse ;
 *  2. un écrêtage NON NUL implique au moins une circonstance — sans quoi la ligne montée nommerait
 *     un « plafond Difficultés » qu'aucune entrée de la table ne justifie.
 *
 * C'est cette propriété qui rend la 4ᵉ condition de dérivation du palier (`separable`,
 * `state/rollSeam.ts`) inutile : elle est vraie par construction. Sans ce test, un futur changement
 * de `combineMods` la rendrait re-nécessaire EN SILENCE, et le palier annoncerait une Difficulté que
 * la table ne dit pas. La garde de non-vacuité exige que le plafond MORDE sur >30 % des tirages.
 */
describe('combineMods — séparabilité des familles (balayage aléatoire déterministe)', () => {
  const CRANS = [-40, -30, -20, -10, 0, 10, 20, 40, 60];
  /** PRNG déterministe (xorshift32) : rejouable à l'identique, aucun dé réel. */
  const prng = (seed: number) => () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };

  it('le plafond ne franchit JAMAIS la frontière des familles, et n’existe pas sans circonstance', () => {
    const rnd = prng(0x1153);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
    let cas = 0;
    let mordu = 0;
    const echecs: string[] = [];

    for (let i = 0; i < 12000; i++) {
      const mods: ModLine[] = Array.from({ length: 2 + Math.floor(rnd() * 5) }, (_, k) => ({
        label: `m${k}`, value: pick(CRANS), famille: pick(['circonstance', 'jet'] as const),
      }));
      cas++;
      const circ = mods.filter((m) => m.famille === 'circonstance');
      const chips = mods.filter((m) => m.famille === 'jet');
      const combine = combineMods(mods);
      const attendu = combineMods(circ) + chips.reduce((s, m) => s + m.value, 0);
      const brut = mods.reduce((s, m) => s + m.value, 0);
      const ecretage = combine - brut;
      if (ecretage !== 0) mordu++;
      if (combine !== attendu) echecs.push(`SÉPARABILITÉ ${JSON.stringify(mods)} → ${combine} ≠ ${attendu}`);
      if (ecretage !== 0 && circ.length === 0) echecs.push(`ÉCRÊTAGE SANS CIRCONSTANCE ${JSON.stringify(mods)} → ${ecretage}`);
    }

    expect(cas).toBe(12000);
    expect(mordu / cas, 'le balayage doit faire MORDRE le plafond — sinon il ne juge que des cas inertes').toBeGreaterThan(0.3);
    expect(echecs.slice(0, 10)).toEqual([]);
  });
});

describe('combineMods — plafonds de Difficulté réglables (LDB 14 l.95, règle optionnelle)', () => {
  afterEach(() => { resetRule('combat-diff-cap-bonus'); resetRule('combat-diff-cap-malus'); });
  it('combat-diff-cap-bonus → 20 : la somme des bonus plafonne à +20 (défaut +60)', () => {
    expect(combineMods([{ label: 'a', value: 40, famille: 'circonstance' }, { label: 'b', value: 40, famille: 'circonstance' }])).toBe(60);
    setRule('combat-diff-cap-bonus', 20);
    expect(combineMods([{ label: 'a', value: 40, famille: 'circonstance' }, { label: 'b', value: 40, famille: 'circonstance' }])).toBe(20);
  });
  it('combat-diff-cap-malus → 10 : la somme des malus plafonne à −10 (défaut −30)', () => {
    expect(combineMods([{ label: 'a', value: -20, famille: 'circonstance' }, { label: 'b', value: -20, famille: 'circonstance' }])).toBe(-30);
    setRule('combat-diff-cap-malus', 10);
    expect(combineMods([{ label: 'a', value: -20, famille: 'circonstance' }, { label: 'b', value: -20, famille: 'circonstance' }])).toBe(-10);
  });
});

describe("weaponReachPenalty — Longueur d'arme (LDB 62 l.172, règle optionnelle)", () => {
  afterEach(() => resetRule('combat-weapon-reach'));
  const w = (reach: string | null) => ({ type: 'melee', reach }) as unknown as Weapon;
  it('off (défaut) : aucun malus de longueur', () => {
    expect(weaponReachPenalty(w('Très courte'), w('Longue'))).toBe(0);
  });
  it('on : arme adverse PLUS LONGUE → −10 pour la toucher', () => {
    setRule('combat-weapon-reach', true);
    expect(weaponReachPenalty(w('Très courte'), w('Longue'))).toBe(-10);
  });
  it('on : mon arme plus longue ou égale → pas de malus ; adversaire mains nues → pas de malus', () => {
    setRule('combat-weapon-reach', true);
    expect(weaponReachPenalty(w('Longue'), w('Très courte'))).toBe(0);
    expect(weaponReachPenalty(w('Moyenne'), w('Moyenne'))).toBe(0);
    expect(weaponReachPenalty(w('Moyenne'), undefined)).toBe(0);
  });
  // LDB 62 l.172 compare deux LONGUEURS ; l.31 donne « Variable » à l'Arme improvisée, et l.156-164
  // n'échelonnent que les sept Allonges. Une longueur non ordonnable n'affirme donc rien.
  it('on : Allonge « Variable » (LDB 62 l.31) — aucune comparaison, dans les DEUX sens', () => {
    setRule('combat-weapon-reach', true);
    expect(weaponReachPenalty(w('Très courte'), w('Variable'))).toBe(0);
    expect(weaponReachPenalty(w('Variable'), w('Longue'))).toBe(0);
  });
  it('on : Allonge absente d’une arme de mêlée → aucune comparaison', () => {
    setRule('combat-weapon-reach', true);
    expect(weaponReachPenalty(w('Très courte'), w(null))).toBe(0);
    expect(weaponReachPenalty(w(null), w('Longue'))).toBe(0);
  });
});

describe('rangeBandModifier / rangeBandName — table de portée unique (identité du refactor)', () => {
  const R = 10; // Portée 10 m ; échelle 1 case = 2 m
  it('modificateurs aux 5 bandes + hors de portée', () => {
    expect(rangeBandModifier(0, R)).toBe(40); // bout portant (m=0 ≤ 1)
    expect(rangeBandModifier(2, R)).toBe(20); // courte (m=4 ≤ 5)
    expect(rangeBandModifier(5, R)).toBe(0); // moyenne (m=10 ≤ 10)
    expect(rangeBandModifier(8, R)).toBe(-10); // longue (m=16 ≤ 20)
    expect(rangeBandModifier(14, R)).toBe(-30); // extrême (m=28 ≤ 30)
    expect(rangeBandModifier(16, R)).toBeNull(); // m=32 > 30
  });
  it('noms de bande alignés sur les mêmes seuils', () => {
    expect(rangeBandName(0, R)).toBe('Bout portant');
    expect(rangeBandName(2, R)).toBe('Courte portée');
    expect(rangeBandName(5, R)).toBe('Moyenne');
    expect(rangeBandName(8, R)).toBe('Longue');
    expect(rangeBandName(14, R)).toBe('Extrême');
    expect(rangeBandName(16, R)).toBeNull();
  });
});

describe('defenseModifiers — Avantage hors plafond, circonstances plafonnées (B1, parité avec l’attaque)', () => {
  it('l’Avantage de la DÉFENSE est `famille: \'jet\'` → +80 NON plafonné à +60', () => {
    const d = { advantage: 8, conditions: [], weapons: [], defensiveStance: false } as unknown as Combatant;
    const mods = defenseModifiers(d, 'esquive');
    expect(mods.find((m) => m.label === 'Avantage')).toMatchObject({ value: 80, famille: 'jet' });
    expect(combineMods(mods)).toBe(80);
  });

  it('la CIRCONSTANCE se plafonne (LDB 14 l.95), les modificateurs du jeteur s’ajoutent à côté', () => {
    // Esquive en neige (−30, entrée de table l.82) + 2 pions Aveuglé (−20, État → jet) + Maniement de
    // deux armes (−10, Talent → jet) + Avantage +30 (jet). La combinaison ne borne QUE la neige :
    // −30 (circonstances) + (30 − 20 − 10) = −30.
    const d = { advantage: 3, conditions: [{ id: 'aveugle', value: 2 }], weapons: [], defensiveStance: false, dualStrikeDefensePenalty: -10 } as unknown as Combatant;
    const mods = defenseModifiers(d, 'esquive', [{ label: 'Neige épaisse', value: -30, famille: 'circonstance' }]);
    expect(mods.filter((m) => m.value < 0).map((m) => `${m.label} ${m.value} ${m.famille}`))
      .toEqual(['Aveuglé -20 jet', 'Neige épaisse -30 circonstance', 'Maniement deux armes -10 jet']);
    expect(combineMods(mods)).toBe(-30);
  });
});

/**
 * PARTITION CIBLE/JETEUR (#1218) — Parasité (trait de la CIBLE) et l'Allonge de SON arme pèsent sur
 * la cible : `famille: 'circonstance'`, donc plafonnées avec les autres circonstances (`LDB 14
 * l.48`, `l.96`). La divergence n'est visible qu'en combat SATURÉ : sous −30 de circonstances, les
 * deux −10 classés `jet` s'ajoutaient hors plafond (−50) ; classés `circonstance`, le plafond les
 * absorbe (−30).
 */
describe('attackModifiers — Parasité et Allonge pèsent sur la CIBLE (#1218)', () => {
  afterEach(() => resetRule('combat-weapon-reach'));

  const fighter = (over: Record<string, unknown>): Combatant => ({
    id: 'x', label: 'X', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, intelligence: 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  } as unknown as Combatant);
  const melee = (reach: string): Weapon => ({ label: 'Arme', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], reach } as unknown as Weapon);

  it('sous une circonstance SATURÉE, les deux −10 sont absorbés par le plafond (−30, pas −50)', () => {
    setRule('combat-weapon-reach', true);
    const arme = melee('Très courte');
    const attaquant = fighter({ id: 'a', weapons: [arme] });
    const cible = fighter({ id: 't', traits: [{ id: 'parasite' }], weapons: [melee('Longue')] });
    // Neige épaisse −30 (`LDB 14 l.82`) : les circonstances sont DÉJÀ au plafond avant les deux −10.
    const env: ModLine[] = [{ label: 'Neige épaisse', value: -30, famille: 'circonstance' }];
    const mods = attackModifiers(attaquant, cible, arme, { kind: 'melee', env });

    expect(mods.filter((m) => m.value < 0).map((m) => `${m.label} ${m.value} ${m.famille}`))
      .toEqual(['Parasité -10 circonstance', "Allonge de l'adversaire -10 circonstance", 'Neige épaisse -30 circonstance']);
    expect(mods.reduce((s, m) => s + m.value, 0), 'somme BRUTE inchangée').toBe(-50);
    expect(combineMods(mods), 'le plafond de combinaison les absorbe').toBe(-30);
  });

  /** BORD EXACT de la bascule — le plafond mord dès que l'environnement atteint −20 (et non −30) :
   *  la grille balaie la saturation croissante et donne, pour chaque palier, le combiné mesuré en
   *  `circonstance` et ce qu'il valait en `jet` (somme brute, hors plafond). */
  it.each([
    { env: 0, circonstance: -20, jet: -20 },
    { env: -10, circonstance: -30, jet: -30 },
    { env: -20, circonstance: -30, jet: -40 }, // 1ᵉʳ palier où le classement DÉPLACE un chiffre (+10)
    { env: -30, circonstance: -30, jet: -50 },
  ])('saturation env=$env → combiné $circonstance (en famille jet : $jet)', ({ env, circonstance, jet }) => {
    setRule('combat-weapon-reach', true);
    const arme = melee('Très courte');
    const attaquant = fighter({ id: 'a', weapons: [arme] });
    const cible = fighter({ id: 't', traits: [{ id: 'parasite' }], weapons: [melee('Longue')] });
    const envLines: ModLine[] = env ? [{ label: 'Terrain difficile', value: env, famille: 'circonstance' }] : [];
    const mods = attackModifiers(attaquant, cible, arme, { kind: 'melee', env: envLines });
    expect(mods.reduce((s, m) => s + m.value, 0), 'somme BRUTE = ce que valait la famille `jet`').toBe(jet);
    expect(combineMods(mods)).toBe(circonstance);
  });
});

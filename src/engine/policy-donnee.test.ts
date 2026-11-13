import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OPTIONAL_RULES, rule, ruleDef, resetRule, type OptionalRule } from './policy';
import { books } from '../data';

/**
 * Le registre des RÈGLES OPTIONNELLES est une DONNÉE (V9 #1318) : `src/engine/policy.ts` n'en garde
 * que le LECTEUR. Quatre volets :
 *  (a) PARITÉ — `OPTIONAL_RULES` EST le contenu de `src/data/reglesOptionnelles.json`, lu du disque
 *      ici : réinscrire le catalogue en dur dans le TS (ou l'y diverger d'une entrée) fait rouge ;
 *  (b) LECTURE — `rule(id)` rend le `default` de la donnée pour chacune des entrées (chaîne
 *      donnée → moteur), et `ruleDef(id)` retrouve l'entrée ;
 *  (c) CITATION — chaque entrée porte un `ref` dont l'abréviation est un `abbr` RÉEL de
 *      `books.json`, et aucune `ref` ne porte de justification en prose (celle d'une valeur maison
 *      va dans `maison`). Ce volet DOUBLE le cliquet décroissant de folios manquants
 *      (`BASELINES['reglesOptionnelles.json']`, `src/data/citation-coverage-guard.test.ts`) : tant
 *      que le folio imprimé n'est pas relevé, la citation ne peut ni disparaître en silence, ni
 *      nommer un livre inexistant, ni se diluer en commentaire ;
 *  (d) FORME — un `mode` propose ses valeurs et son défaut en fait partie ; un `param` borne son
 *      défaut (min ≤ défaut ≤ max) : le panneau in-game auto-rend un contrôle par `kind`, une entrée
 *      mal formée y produirait un contrôle sans valeur sélectionnable.
 */
const FILE = fileURLToPath(new URL('../data/reglesOptionnelles.json', import.meta.url));
const DISK = JSON.parse(readFileSync(FILE, 'utf8')) as OptionalRule[];

/** Abréviations de livre (`books.json`), les plus longues d'abord — « ADE II » avant « ADE I ». */
const ABBRS = books.map((b) => b.abbr).sort((a, b) => b.length - a.length);
const citesABook = (ref: string): boolean => ABBRS.some((a) => ref.startsWith(`${a} `));

describe('registre des règles optionnelles — LU de src/data/reglesOptionnelles.json (#1318 V9)', () => {
  it('PARITÉ : OPTIONAL_RULES est exactement le catalogue du fichier de donnée', () => {
    expect(OPTIONAL_RULES).toEqual(DISK);
    expect(OPTIONAL_RULES.length).toBe(DISK.length);
  });

  it('chaque entrée a un id non vide et unique (clé de surcharge, de persistance et de variants[].when.rule)', () => {
    const ids = OPTIONAL_RULES.map((r) => r.id);
    expect(ids.filter((id) => !id || !id.trim())).toEqual([]);
    expect([...new Set(ids)].length).toBe(ids.length);
  });

  it('LECTURE : sans surcharge, `rule(id)` rend le `default` de la donnée pour chaque entrée', () => {
    for (const r of OPTIONAL_RULES) resetRule(r.id);
    const divergentes = OPTIONAL_RULES.filter((r) => rule(r.id) !== r.default).map((r) => r.id);
    expect(divergentes).toEqual([]);
    expect(OPTIONAL_RULES.filter((r) => ruleDef(r.id) === undefined).map((r) => r.id)).toEqual([]);
  });

  it('CITATION : le `ref` de chaque entrée nomme un livre RÉEL de books.json', () => {
    const orphelines = OPTIONAL_RULES.filter((r) => !citesABook(r.ref)).map((r) => `${r.id} → « ${r.ref} »`);
    expect(
      orphelines,
      `Règle(s) dont le \`ref\` ne commence par aucun \`abbr\` de books.json :\n${orphelines.join('\n')}`,
    ).toEqual([]);
  });

  it('MORSURE — un `ref` vers un livre inventé, ou vide, ne cite rien', () => {
    expect(citesABook('LIVRE-INVENTÉ 12 l.46')).toBe(false);
    expect(citesABook('')).toBe(false);
    expect(citesABook(OPTIONAL_RULES[0].ref)).toBe(true);
  });

  it('CITATION : aucune `ref` ne porte de justification en prose — elle vit dans `maison`', () => {
    // Une `ref` qui explique (« — silence, valeur maison », « (non chiffré) ») dilue la citation et
    // duplique `maison` : la référence est une RÉFÉRENCE. Motif étroit : tiret cadratin, parenthèse,
    // ou le mot « maison » — ce qui a été mesuré dans le stock migré (24 entrées, soldées).
    const bavardes = OPTIONAL_RULES.filter((r) => /—|\(|maison/i.test(r.ref)).map((r) => `${r.id} → « ${r.ref} »`);
    expect(bavardes, `\`ref\` porteuse de prose — déplacer la justification dans \`maison\` :\n${bavardes.join('\n')}`).toEqual([]);
  });

  it('CITATION : toute valeur MAISON porte sa justification (`maison` non vide)', () => {
    // Le pendant du volet ci-dessus : en sortant la prose des `ref`, rien ne doit se perdre.
    const nues = OPTIONAL_RULES.filter((r) => r.maison != null && !r.maison.trim()).map((r) => r.id);
    expect(nues, '`maison` vide — une justification maison se dit, ou le champ disparaît').toEqual([]);
    expect(OPTIONAL_RULES.filter((r) => r.maison).length).toBeGreaterThanOrEqual(26);
  });

  it('FORME : le défaut d’un `mode` est l’une de ses `options`', () => {
    const modes = OPTIONAL_RULES.filter((r): r is Extract<OptionalRule, { kind: 'mode' }> => r.kind === 'mode');
    expect(modes.length).toBeGreaterThan(0);
    const fautives = modes.filter((r) => !r.options.includes(String(r.default))).map((r) => r.id);
    expect(fautives, 'mode(s) dont le `default` n’est pas une option').toEqual([]);
  });

  it('FORME : un `param` borne son défaut (min ≤ défaut ≤ max), un `flag` vaut un booléen', () => {
    const params = OPTIONAL_RULES.filter((r): r is Extract<OptionalRule, { kind: 'param' }> => r.kind === 'param');
    expect(params.length).toBeGreaterThan(0);
    const horsBornes = params.filter((r) => typeof r.default !== 'number' || r.default < r.min || r.default > r.max).map((r) => r.id);
    expect(horsBornes, 'param(s) dont le défaut sort de [min, max]').toEqual([]);
    expect(OPTIONAL_RULES.filter((r) => r.kind === 'flag' && typeof r.default !== 'boolean').map((r) => r.id)).toEqual([]);
  });
});

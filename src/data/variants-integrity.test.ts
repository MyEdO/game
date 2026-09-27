/**
 * Garde des VARIANTES réglées (#563, #564) : `when.rule` DOIT être un id de `OPTIONAL_RULES`
 * (gate fantôme sinon), et la règle stricte 5 (verbatim + folio) s'applique PAR VARIANTE comme pour
 * l'ancre (`citedEntriesOf` de `folioIntegrity.mjs` la découvre sans extension : une variante est
 * structurellement `{desc, source}` comme une entrée).
 *
 * `talents.json` et `spells.json` portent des variantes en donnée — la garde EXHAUSTIVE ci-dessous
 * DÉRIVE la liste autorisée des defs (`RESOLVED_BY_FILE`) et couvre ces fichiers réels ; les morsures
 * de la règle 5 restent des fixtures SYNTHÉTIQUES (patron partagé
 * avec `secondary-ref-integrity.test.ts`). Troisième garde (#564) : deux variantes d'une MÊME entrée ne
 * doivent jamais pouvoir être actives ensemble — `activeVariant` prend la première, silencieusement.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { fileURLToPath } from 'node:url';
import { OPTIONAL_RULES } from '../engine/policy';
import { unknownVariantRules, variantRulesOf } from '../../scripts/guards/lib/variantRule.mjs';
import { citedEntriesOf, auditFolio } from '../../scripts/guards/lib/folioIntegrity.mjs';
import * as talentsDef from './schemas/defs/talents';
import * as traitsDef from './schemas/defs/traits';
import * as spellsDef from './schemas/defs/spells';
import { characteristics, skills, traits } from './index';
import { echapperRegex } from '../lib/regex';

const DIR = fileURLToPath(new URL('.', import.meta.url));
/** Les datasets `.json` de `src/data`, en ordre total — UN listage pour tous les sites qui le lisent. */
const DATASETS = listerDossier(DIR).filter((f) => f.endsWith('.json'));
const KNOWN_RULE_IDS = new Set(OPTIONAL_RULES.map((r) => r.id));
/** Clés du schéma d'ENTRÉE de chaque dataset à variantes — lues du def, jamais recopiées. Un def
 *  ADOPTÉ par `document()` rend un nœud SCELLÉ, sans `.element.shape` : il publie ses clés relevées
 *  AVANT le sceau (`DocumentHandle.cles`, réexportées `cles`). Les defs à variantes sont adoptés :
 *  aucun ne se lit au nœud zod. */
const SHAPE_BY_FILE = new Map<string, string[]>([
  [talentsDef.file, [...talentsDef.cles]],
  [traitsDef.file, [...traitsDef.cles]],
  [spellsDef.file, [...spellsDef.cles]],
]);

/** id de la Caractéristique nommée par une ligne « Maxi : Bonus d'Agilité » — DÉRIVÉ de
 *  `characteristics.json` (le label est de l'affichage ; la logique compare des ids). */
const CHAR_ID_BY_LABEL = new Map(characteristics.map((c) => [c.label.toLocaleLowerCase('fr'), c.id]));
function bonusCharId(printed: string): string | undefined {
  const m = /^Bonus (?:d'|de )(.+)$/i.exec(printed.trim());
  return m ? CHAR_ID_BY_LABEL.get(m[1].trim().toLocaleLowerCase('fr')) : undefined;
}

describe('variantRulesOf — walk de `variants[].when.rule`', () => {
  it('collecte chaque variante avec la clé de son porteur', () => {
    const data = [{ id: 'exemple', variants: [{ when: { rule: 'combat-aa-avantage-groupe' } }] }];
    expect(variantRulesOf(data)).toEqual([{ key: 'exemple.variants[0]', rule: 'combat-aa-avantage-groupe' }]);
  });
});

describe('garde-fou « when.rule ∈ OPTIONAL_RULES » (#564)', () => {
  it('0 variante réelle sur src/data/*.json ne référence un id de règle inconnu', () => {
    const violations = unknownVariantRules(DIR, KNOWN_RULE_IDS);
    expect(violations).toEqual([]);
  });

  it('MORSURE — `when.rule` fantôme (`regle-inventee`) → rouge', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'regle-inventee' } }] }];
    const violations = variantRulesOf(data).filter((e) => !KNOWN_RULE_IDS.has(e.rule));
    expect(violations).toEqual([{ key: 'fixture.variants[0]', rule: 'regle-inventee' }]);
  });

  it('un id RÉEL du registre passe (vert)', () => {
    const known = OPTIONAL_RULES[0].id;
    const data = [{ id: 'fixture', variants: [{ when: { rule: known } }] }];
    expect(variantRulesOf(data).filter((e) => !KNOWN_RULE_IDS.has(e.rule))).toEqual([]);
  });

  it('EXHAUSTIF : seuls les datasets à liste blanche déclarée référencent `variants` en donnée (contrôle croisé texte brut)', () => {
    // La liste autorisée est DÉRIVÉE des defs (`RESOLVED_BY_FILE`), jamais une liste de fichiers à la main.
    const offenders = DATASETS.filter((f) => !RESOLVED_BY_FILE.has(f) && readFileSync(join(DIR, f), 'utf8').includes('"variants"'));
    expect(offenders).toEqual([]);
  });
});

// ── FK d'une règle optionnelle portée par une ENTRÉE : `gatedByRule` (#1318) ────────────────
/**
 * MÊME gate fantôme que `variants[].when.rule`, par une autre porte : un nœud de donnée peut subordonner
 * à une règle optionnelle sa DISPONIBILITÉ (`SpeciesData.gatedByRule`, lu par `speciesAllowed`) ou son
 * COMPORTEMENT (`SkillData.altChar.gatedByRule`, lu par `altCharKey`) — le walk est GÉNÉRIQUE, à toute
 * profondeur et quel que soit le porteur.
 * `rule(id)` d'un id INCONNU rend `false` (`engine/policy.ts`) — une coquille rendrait l'entrée
 * définitivement invisible, sans la moindre erreur. La FK se valide donc ici, sur la donnée réelle.
 */
const GATE_FIELD = 'gatedByRule';

/** Chaque nœud portant `gatedByRule`, à toute profondeur — même walk générique que `variantConflicts`. */
function gateRuleRefs(node: unknown, path = ''): { key: string; rule: string }[] {
  const out: { key: string; rule: string }[] = [];
  if (Array.isArray(node)) {
    node.forEach((v, i) => out.push(...gateRuleRefs(v, `${path}[${i}]`)));
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const rec = node as Record<string, unknown>;
  const key = typeof rec.id === 'string' ? rec.id : path;
  if (typeof rec[GATE_FIELD] === 'string') out.push({ key, rule: rec[GATE_FIELD] as string });
  for (const [k, v] of Object.entries(rec)) if (k !== GATE_FIELD) out.push(...gateRuleRefs(v, path ? `${path}.${k}` : k));
  return out;
}

describe('garde-fou « gatedByRule ∈ OPTIONAL_RULES » (#1318)', () => {
  const filesWithGate = () =>
    DATASETS.filter((f) => readFileSync(join(DIR, f), 'utf8').includes(`"${GATE_FIELD}"`));

  it('0 entrée réelle de src/data/*.json ne subordonne sa disponibilité à un id de règle inconnu', () => {
    const offenders = filesWithGate().flatMap((f) =>
      gateRuleRefs(JSON.parse(readFileSync(join(DIR, f), 'utf8')))
        .filter((e) => !KNOWN_RULE_IDS.has(e.rule))
        .map((e) => ({ file: f, ...e })),
    );
    expect(offenders).toEqual([]);
  });

  it('le champ est bien PORTÉ par la donnée réelle (sinon la garde ci-dessus est vide et verte pour rien)', () => {
    const refs = filesWithGate().flatMap((f) => gateRuleRefs(JSON.parse(readFileSync(join(DIR, f), 'utf8'))));
    expect(refs.length).toBeGreaterThan(0);
  });

  it('MORSURE — `gatedByRule` fantôme (`regle-inventee`) → rouge', () => {
    const data = [{ id: 'fixture', gatedByRule: 'regle-inventee' }];
    expect(gateRuleRefs(data).filter((e) => !KNOWN_RULE_IDS.has(e.rule))).toEqual([
      { key: 'fixture', rule: 'regle-inventee' },
    ]);
  });

  it('un id RÉEL du registre passe (vert)', () => {
    const data = [{ id: 'fixture', gatedByRule: OPTIONAL_RULES[0].id }];
    expect(gateRuleRefs(data).filter((e) => !KNOWN_RULE_IDS.has(e.rule))).toEqual([]);
  });
});

describe('règle 5 PAR VARIANTE — `variants[i].desc` verbatim dans `variants[i].source` (#563)', () => {
  // Fixture RÉELLE (ZI, folio 23) — même patron que `secondary-ref-integrity.test.ts` : preuve de
  // câblage contre le vrai corpus, pas un livre inventé. Cf. `citedEntriesOf` (`folioIntegrity.mjs`) :
  // une variante est structurellement `{desc, source}` sur le même nœud qu'une entrée, découverte à
  // toute profondeur SANS extension de `citedEntriesOf`.
  const VERBATIM =
    "cette créature peut se déplacer en creusant un tunnel dans la terre ou la pierre à une vitesse inimaginable.";

  it('desc de variante VERBATIM + folio juste → folio-ok (aucune extension du walk nécessaire)', () => {
    const data = {
      id: 'porteur',
      variants: [{ when: { rule: 'test-auto-bands' }, desc: VERBATIM, source: { book: 'zoo-imperial', page: 23 } }],
    };
    const entries = citedEntriesOf(data);
    // `citedEntriesOf` (`folioIntegrity.mjs`) chemine par PATH JSON, pas par id du porteur remonté :
    // même clé que pour les entrées anonymes réelles du dépôt (JSDoc de `citedEntriesOf`) — la clé
    // porteur (`porteur.variants[0]`) est celle de `variantRulesOf` (`variantRule.mjs`), un vocabulaire
    // DIFFÉRENT (garde `when.rule` de #564, pas la règle 5).
    expect(entries).toEqual([{ id: 'variants[0]', book: 'zoo-imperial', page: 23, desc: VERBATIM }]);
    expect(auditFolio(entries[0]).verdict).toBe('folio-ok');
  });

  it('MORSURE — desc de variante ALTÉRÉE d\'un mot → folio-ment (rouge)', () => {
    const altered = VERBATIM.replace('creusant', 'VOLANT');
    const entry = { id: 'variants[0]', book: 'zoo-imperial', page: 23, desc: altered };
    expect(auditFolio(entry).verdict).toBe('desc-introuvable');
  });

  it('MORSURE — desc de variante juste mais folio menteur → folio-ment (rouge)', () => {
    const entry = { id: 'variants[0]', book: 'zoo-imperial', page: 1, desc: VERBATIM };
    expect(auditFolio(entry).verdict).toBe('folio-ment');
  });
});

// ── Conflit de variantes : deux gardes simultanément vraies sur la MÊME entrée (#564) ─────────────
type When = { rule: string; equals?: unknown };

/** Deux gardes peuvent-elles être vraies EN MÊME TEMPS ? Une garde contraint UNE règle à UNE valeur
 *  (`equals`, défaut `true`) : deux gardes ne s'excluent QUE si elles contraignent la même règle à des
 *  valeurs différentes. Tout le reste est simultanément satisfiable — donc un conflit. */
function coActivable(a: When, b: When): boolean {
  return a.rule !== b.rule || (a.equals ?? true) === (b.equals ?? true);
}

/** Entrées portant DEUX variantes co-activables, par chemin JSON — `activeVariant` ne peut pas les
 *  départager (premier match). Walk générique, à toute profondeur, comme `citedEntriesOf`. */
function variantConflicts(node: unknown, path = ''): { key: string; rules: string[] }[] {
  const out: { key: string; rules: string[] }[] = [];
  if (Array.isArray(node)) {
    node.forEach((v, i) => out.push(...variantConflicts(v, `${path}[${i}]`)));
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const rec = node as Record<string, unknown>;
  const key = typeof rec.id === 'string' ? rec.id : path;
  const variants = rec.variants;
  if (Array.isArray(variants)) {
    const whens = variants.map((v) => (v as { when?: When }).when).filter((w): w is When => !!w);
    for (let i = 0; i < whens.length; i++)
      for (let j = i + 1; j < whens.length; j++)
        if (coActivable(whens[i], whens[j])) out.push({ key, rules: [whens[i].rule, whens[j].rule] });
  }
  for (const [k, v] of Object.entries(rec)) if (k !== 'variants') out.push(...variantConflicts(v, path ? `${path}.${k}` : k));
  return out;
}

describe('garde-fou « deux variantes jamais actives ensemble » (#564)', () => {
  it('0 entrée réelle de src/data/*.json ne porte deux variantes co-activables', () => {
    const offenders = DATASETS.flatMap((f) =>
      variantConflicts(JSON.parse(readFileSync(join(DIR, f), 'utf8'))).map((c) => ({ file: f, ...c })),
    );
    expect(offenders).toEqual([]);
  });

  it('MORSURE — deux variantes sur des règles DIFFÉRENTES (toutes deux activables) → rouge', () => {
    const data = [{
      id: 'fixture',
      variants: [
        { when: { rule: 'combat-aa-avantage-groupe' } },
        { when: { rule: 'autre-regle-optionnelle' } },
      ],
    }];
    expect(variantConflicts(data)).toEqual([{ key: 'fixture', rules: ['combat-aa-avantage-groupe', 'autre-regle-optionnelle'] }]);
  });

  it('MORSURE — deux variantes sur la MÊME règle à la MÊME valeur → rouge (la seconde est morte)', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'r', equals: true } }, { when: { rule: 'r' } }] }];
    expect(variantConflicts(data)).toHaveLength(1);
  });

  it('deux variantes de la MÊME règle à des valeurs EXCLUSIVES passent (vert)', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'r', equals: 'a' } }, { when: { rule: 'r', equals: 'b' } }] }];
    expect(variantConflicts(data)).toEqual([]);
  });
});

// ── Couverture du « Maxi » republié par Aux Armes, Annexe III (#564) ──────────────────────────────
const AA_ANNEXE_III = fileURLToPath(
  new URL('../../Source/WH - V4 - Aux Armes/13 - ANNEXE III NOUVEAUX TALENTS ET TALENTS MIS A JOUR.md', import.meta.url),
);

/** `label → ligne « Maxi » imprimée` de l'Annexe III, LUE dans le Source (jamais une liste recopiée). */
function maxiLinesOfAnnexeIII(): Map<string, string> {
  const out = new Map<string, string>();
  const lines = readFileSync(AA_ANNEXE_III, 'utf8').split(/\r?\n/);
  let current: string | null = null;
  for (const line of lines) {
    const head = /^#{3,4} \*\*(.+?)\*\*\s*$/.exec(line);
    if (head) { current = head[1].toLocaleLowerCase('fr'); continue; } // le label est de l'AFFICHAGE : la casse ne porte rien
    const maxi = /^\*\*Maxi :\*\*\s*(.+?)\s*$/.exec(line);
    if (maxi && current) { out.set(current, maxi[1]); current = null; }
  }
  return out;
}

describe('couverture du « Maxi » d’Aux Armes Annexe III (#564) — la forme imprimée est PORTÉE en donnée', () => {
  const maxi = maxiLinesOfAnnexeIII();
  const carriers = (JSON.parse(readFileSync(join(DIR, 'talents.json'), 'utf8')) as {
    id: string; label: string; max?: unknown; variants?: { when: { rule: string }; max?: unknown; source?: { book: string } }[];
  }[]).filter((t) => t.variants?.some((v) => v.source?.book === 'aux-armes'));

  it('l’Annexe III est lisible et chaque porteur de variante AA y a son entrée', () => {
    expect(carriers.length).toBeGreaterThan(0);
    expect(carriers.filter((t) => !maxi.has(t.label.toLocaleLowerCase('fr'))).map((t) => t.label)).toEqual([]);
  });

  for (const t of carriers) {
    it(`${t.id} — « Maxi : ${maxi.get(t.label.toLocaleLowerCase('fr'))} » (AA) est la forme EFFECTIVE sous la règle`, () => {
      const printed = maxi.get(t.label.toLocaleLowerCase('fr'))!;
      const v = t.variants!.find((x) => x.source?.book === 'aux-armes')!;
      const effective = 'max' in v ? v.max : t.max;
      if (/^\d+$/.test(printed)) expect(effective).toBe(Number(printed));
      else {
        const charId = bonusCharId(printed);
        expect(charId, `« ${printed} » ne nomme aucune Caractéristique de characteristics.json`).toBeTruthy();
        expect(effective).toEqual({ bonusOf: charId }); // la CARACTÉRISTIQUE imprimée, pas « un bonusOf quelconque »
      }
    });
  }
});

// ── Champs republiables : la liste blanche de chaque dataset = ses champs RÉSOLUS (#564) ─────
/** Datasets autorisant des variantes, avec les champs que leur résolution APPLIQUE (`effectiveEntry`).
 *  Un dataset absent d'ici n'admet aucune variante (son schéma ne porte pas le champ `variants`). */
const RESOLVED_BY_FILE = new Map<string, readonly string[]>([
  [talentsDef.file, talentsDef.VARIANT_RESOLVED_FIELDS],
  [traitsDef.file, traitsDef.VARIANT_RESOLVED_FIELDS],
  [spellsDef.file, spellsDef.VARIANT_RESOLVED_FIELDS],
]);

/** Chaque nœud `variants[]` rencontré à toute profondeur, avec les champs qu'il DÉCLARE (hors `when`). */
function variantFieldsOf(node: unknown, path = ''): { key: string; fields: string[] }[] {
  const out: { key: string; fields: string[] }[] = [];
  if (Array.isArray(node)) {
    node.forEach((v, i) => out.push(...variantFieldsOf(v, `${path}[${i}]`)));
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const rec = node as Record<string, unknown>;
  const key = typeof rec.id === 'string' ? rec.id : path;
  if (Array.isArray(rec.variants)) {
    rec.variants.forEach((v, i) => {
      if (!v || typeof v !== 'object') return;
      out.push({ key: `${key}.variants[${i}]`, fields: Object.keys(v as object).filter((k) => k !== 'when') });
    });
  }
  for (const [k, v] of Object.entries(rec)) if (k !== 'variants') out.push(...variantFieldsOf(v, path ? `${path}.${k}` : k));
  return out;
}

/** Champs déclarés hors de la liste blanche du dataset — un champ admis mais lu BRUT par le moteur
 *  ferait afficher la variante au Codex pendant que le moteur applique la base. */
function unresolvedVariantFields(node: unknown, resolved: readonly string[] | undefined) {
  return variantFieldsOf(node)
    .map((v) => ({ key: v.key, extra: v.fields.filter((f) => !(resolved ?? []).includes(f)) }))
    .filter((v) => v.extra.length > 0);
}

describe('garde-fou « une variante ne déclare QUE des champs résolus » (#564)', () => {
  it('0 variante réelle de src/data/*.json ne déclare un champ hors de la liste résolue de son dataset', () => {
    const offenders = DATASETS.flatMap((f) =>
      unresolvedVariantFields(JSON.parse(readFileSync(join(DIR, f), 'utf8')), RESOLVED_BY_FILE.get(f)).map((v) => ({ file: f, ...v })),
    );
    expect(offenders).toEqual([]);
  });

  it('MORSURE — une variante déclarant `passive` (lu BRUT par talentEffects.ts) → rouge', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'combat-aa-avantage-groupe' }, desc: 'x', passive: [] }] }];
    expect(unresolvedVariantFields(data, talentsDef.VARIANT_RESOLVED_FIELDS)).toEqual([
      { key: 'fixture.variants[0]', extra: ['passive'] },
    ]);
  });

  it('MORSURE — un dataset SANS liste blanche (aucune résolution) rejette toute variante peuplée', () => {
    const data = [{ id: 'fixture', variants: [{ when: { rule: 'combat-aa-avantage-groupe' }, desc: 'x' }] }];
    expect(unresolvedVariantFields(data, RESOLVED_BY_FILE.get('domains.json'))).toEqual([
      { key: 'fixture.variants[0]', extra: ['desc'] },
    ]);
  });

  it('MORSURE — le SCHÉMA lui-même refuse le champ non résolu (zod, avant même la garde)', () => {
    const entry = JSON.parse(readFileSync(join(DIR, 'talents.json'), 'utf8'))
      .find((t: { id: string }) => t.id === 'fuite');
    expect(talentsDef.schema.safeParse([entry]).success).toBe(true);
    const poisoned = { ...entry, variants: [{ ...entry.variants[0], passive: [{ op: 'heal' }] }] };
    expect(talentsDef.schema.safeParse([poisoned]).success).toBe(false);
  });

  it('chaque champ résolu déclaré est bien un champ du schéma d’ENTRÉE de son dataset (aucune clé fantôme)', () => {
    for (const [file, fields] of RESOLVED_BY_FILE) {
      const shape = SHAPE_BY_FILE.get(file)!;
      expect(fields.filter((f) => !shape.includes(f)), file).toEqual([]);
    }
  });
});

// ── Une desc republiée sans ses ops (#880) ────────────────────────────────────────────────────────
/**
 * Une variante qui republie `desc` sans republier `effects` fait afficher la règle du livre variant
 * pendant que le moteur applique celle de l'ancre. Le point délicat est de séparer une DIVERGENCE de
 * règle d'une simple reformulation ; le critère retenu est étroit et assumé :
 *
 *  1. on extrait de chaque `desc` ses JETONS MÉCANIQUES — Compétences, Caractéristiques (nues ou en
 *     « Bonus de … »), Traits (labels lus dans `src/data`, jamais une liste à la main), modificateurs
 *     chiffrés entre parenthèses, et la mention des DR ;
 *  2. on prend la DIFFÉRENCE SYMÉTRIQUE des jetons de l'ancre et de la variante ;
 *  3. la variante est en faute si un jeton de cette différence appartient à une FAMILLE que les
 *     `effects` de l'ancre nomment déjà — ces ops parlent alors d'une règle que la desc effective ne
 *     dit plus.
 *
 * ANGLE MORT DÉCLARÉ : une divergence sans jeton mécanique (une condition de lancement en prose, un
 * moment de Round, un ajout de règle dont l'ancre ne parle pas du tout) reste invisible. Une garde
 * étroite et honnête sur sa portée vaut mieux qu'une large qui bruite.
 */
const MECHANICAL_FLOW_FIELD = 'effects';
/** Abréviations de bonus employées par la prose des ops, ramenées à la forme imprimée des descs. */
const BONUS_ABBR: [RegExp, string][] = [
  [/\bBFM\b/g, 'Bonus de Force Mentale'],
  [/\bBSoc\b/g, 'Bonus de Sociabilité'],
  [/\bBAg\b/g, "Bonus d'Agilité"],
  [/\bBE\b/g, "Bonus d'Endurance"],
  [/\bBI\b/g, "Bonus d'Initiative"],
  [/\bBF\b/g, 'Bonus de Force'],
];
const CHAR_LABELS = characteristics.map((c) => c.label);
const SKILL_LABELS = skills.map((s) => s.label);
const TRAIT_LABELS = traits.map((t) => t.label);

/** Jetons mécaniques d'un texte de règle, préfixés de leur FAMILLE (`competence:`/`carac:`/…). */
function mechanicalTokens(raw: string): Set<string> {
  const text = BONUS_ABBR.reduce((s, [re, to]) => s.replace(re, to), raw).replace(/−/g, '-');
  const out = new Set<string>();
  for (const l of CHAR_LABELS) {
    if (new RegExp(`Bonus (?:de |d')${echapperRegex(l)}`, 'i').test(text)) out.add(`bonus:${l}`);
    else if (new RegExp(`\\b${echapperRegex(l)}\\b`, 'i').test(text)) out.add(`carac:${l}`);
  }
  for (const l of SKILL_LABELS) if (new RegExp(`\\b${echapperRegex(l)}\\b`).test(text)) out.add(`competence:${l}`);
  for (const l of TRAIT_LABELS) if (new RegExp(`\\b${echapperRegex(l)}\\b`).test(text)) out.add(`trait:${l}`);
  for (const m of text.matchAll(/\(([+-]\s?\d+)\)/g)) out.add(`mod:${m[1].replace(/\s/g, '')}`);
  if (/\bDR\b/.test(text)) out.add('dr');
  return out;
}

/** Prose portée par un Flow d'ops, concaténée (les `narrative` et tout autre champ textuel). */
function proseOf(node: unknown): string {
  let out = '';
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== 'object') return;
    for (const v of Object.values(n as Record<string, unknown>)) {
      if (typeof v === 'string') out += ` ${v}`;
      else walk(v);
    }
  };
  walk(node);
  return out;
}

/** Entrées dont une variante republie `desc` en laissant des `effects` périmés (cf. critère ci-dessus). */
function staleFlowVariants(data: unknown): { id: string; tokens: string[] }[] {
  const out: { id: string; tokens: string[] }[] = [];
  for (const entry of (Array.isArray(data) ? data : []) as Record<string, unknown>[]) {
    const anchorDesc = entry.desc;
    const anchorFlow = entry[MECHANICAL_FLOW_FIELD];
    if (typeof anchorDesc !== 'string' || !anchorFlow || !Array.isArray(entry.variants)) continue;
    const families = new Set([...mechanicalTokens(proseOf(anchorFlow))].map((t) => t.split(':')[0]));
    for (const v of entry.variants as Record<string, unknown>[]) {
      if (typeof v.desc !== 'string' || MECHANICAL_FLOW_FIELD in v) continue;
      const anchor = mechanicalTokens(anchorDesc);
      const variant = mechanicalTokens(v.desc);
      const drift = [...new Set([...anchor, ...variant])].filter((t) => anchor.has(t) !== variant.has(t));
      const stale = drift.filter((t) => families.has(t.split(':')[0])).sort();
      if (stale.length) out.push({ id: String(entry.id), tokens: stale });
    }
  }
  return out;
}

/** Datasets dont la liste blanche admet le Flow mécanique — DÉRIVÉ des defs, jamais une liste. */
const FLOW_FILES = [...RESOLVED_BY_FILE].filter(([, f]) => f.includes(MECHANICAL_FLOW_FIELD)).map(([file]) => file);

/** Stock nominatif DÉCROISSANT de #880 : divergences par OMISSION que le critère voit.
 *  La liste ne remonte JAMAIS — une entrée soldée la fait rougir. */
const A_TRAITER_880 = [
  { id: 'bouclier-ceruleen', tokens: ["bonus:Endurance"] },
  { id: 'l-egide-d-aqshy', tokens: ['trait:Souffle'] },
  { id: 'metal-changeant', tokens: ['competence:Art'] },
  { id: 'destrier-d-ombre', tokens: ['trait:Nerveux'] },
];

describe('garde-fou « une desc republiée n’abandonne pas ses ops » (#880)', () => {
  it('les datasets à Flow mécanique sont ceux que les defs déclarent (aucune liste de fichiers à la main)', () => {
    expect(FLOW_FILES).toEqual([spellsDef.file]);
  });

  it('aucune variante réelle hors du reste-à-traiter #880 ne laisse ses `effects` périmés', () => {
    const offenders = FLOW_FILES.flatMap((f) => staleFlowVariants(JSON.parse(readFileSync(join(DIR, f), 'utf8'))));
    expect(offenders).toEqual(A_TRAITER_880);
  });

  it('MORSURE — la desc variante change la Compétence testée, les ops gardent l’ancienne → rouge', () => {
    const data = [{
      id: 'fixture',
      desc: 'La cible doit réussir un Test de Perception Complexe.',
      effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'narrative', text: 'Test de Perception' }] } },
      variants: [{ when: { rule: 'magic-vdm-incantation' }, desc: "La cible doit réussir un Test d'Intuition Complexe." }],
    }];
    expect(staleFlowVariants(data)).toEqual([{ id: 'fixture', tokens: ['competence:Intuition', 'competence:Perception'] }]);
  });

  it('la MÊME variante qui republie ses `effects` passe (vert) — c’est la sortie de faute', () => {
    const data = [{
      id: 'fixture',
      desc: 'La cible doit réussir un Test de Perception Complexe.',
      effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'narrative', text: 'Test de Perception' }] } },
      variants: [{
        when: { rule: 'magic-vdm-incantation' },
        desc: "La cible doit réussir un Test d'Intuition Complexe.",
        effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'narrative', text: "Test d'Intuition" }] } },
      }],
    }];
    expect(staleFlowVariants(data)).toEqual([]);
  });

  it('une reformulation SANS delta de jeton mécanique passe (vert) — la garde ne bruite pas', () => {
    const data = [{
      id: 'fixture',
      desc: 'La cible doit réussir un Test de Perception Complexe.',
      effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'narrative', text: 'Test de Perception' }] } },
      variants: [{ when: { rule: 'magic-vdm-incantation' }, desc: 'Un Test de Perception Complexe est exigé de la cible.' }],
    }];
    expect(staleFlowVariants(data)).toEqual([]);
  });
});

/**
 * CLIQUET des Records de libellés de VALEURS (#1694) — banc SŒUR de `valeurs-de-champ.test.ts`.
 *
 * QUESTION : quel littéral d'objet du dépôt REDÉCLARE, hors de la grammaire, le nom FR des options
 * d'un vocabulaire d'enum déjà porté par le registre — c'est-à-dire une SECONDE vérité à côté du
 * libellé qui vit sur le NŒUD (`enumNomme`, `grammaire/valeurs.ts`) ?
 *
 * DÉTECTEUR STRUCTUREL (jamais un grep de nom `_LABEL`), DEUX FORMES du même faux : (a) le Record —
 * un littéral d'objet dont le JEU DE CLÉS est inclus dans les options d'un des vocabulaires atteints
 * par `DEFS_DE_DOCUMENT` (≥ 2 clés, couverture ≥ 60 % du vocabulaire) et dont les VALEURS sont du
 * texte FR ; (b) la TABLE `[{ id: '…', label: '…' }, …]` déclarée au niveau module, où l'`id` tient
 * la clé et le `label` la valeur — mêmes deux règles, mêmes seuils. La forme (b) exige que CHAQUE
 * objet de la table porte les deux champs en chaîne littérale, ce qui laisse dehors les rangées
 * d'action poussées une à une (`state/combatManeuvers.ts`, `out.push({ id, label, icon, … })`).
 * La table de libellés passée à `enumNomme` est le FOYER : elle est écartée par construction (littéral argument,
 * ou constante nommée passée à `enumNomme` dans le même fichier), pas par une liste de fichiers.
 *
 * Deux RÈGLES, jamais une liste d'exceptions. (1) « VALEUR = texte FR » : aucune valeur ne doit
 * ressembler à un identifiant (point/slash/underscore, camelCase, PascalCase composé, kebab minuscule,
 * sigle d'une lettre) et au moins une doit porter une marque de texte FR (espace, accent, apostrophe,
 * mot capitalisé). Le « mot capitalisé » ne tient AUCUNE ligne du stock vivant : mesuré en neutralisant
 * `MOT_CAPITALISE`, les 8 lignes du STOCK restent VUES (aucune ne dépend de lui). Ce qu'il tient est la
 * COUVERTURE, et cela se mesure aux contrôles positifs : sans lui, les trois fixtures dont les libellés
 * sont des mots capitalisés NUS (sans accent, sans espace, sans apostrophe — `{ physique: 'Physique',
 * mentale: 'Mentale' }`, sa forme TABLE, et `g.ts:SEG`) cessent d'être vues ; un Record de cette forme
 * échapperait au détecteur. (2) « table de SEGMENTS DE CLÉ » : un
 * Record dont TOUTES les lectures `NOM[…]` sont des interpolations d'un gabarit qui ne fabrique QUE
 * des caractères d'identifiant ne porte pas des libellés mais des morceaux de clé — c'est ce qui
 * écarte `shipCritical.ts:SHIP_CRIT_CODEX_SEGMENT`, dont les valeurs sont concaténées en catégorie
 * Codex (`shipCritical.ts:53`), jamais affichées.
 * La règle (1) écarte aussi les tables clé→clé mesurées au design
 * (`MANEUVER_ICON`, `SHIP_LOC_KEY`, `SPEC_SOURCE_KEY`, `ALLURE_KEY`, `CRIT_TABLE_IDS`,
 * `OLD_CHARKEY_TO_NEW`, `RESOLVER_OWNER`, `STAGE_OUTCOME_AGG`, `HEADING_TO_DIR8`, `opposite`,
 * `HARVEST_SIZE_BY_CATEGORY`, `CATEGORY_BY_SOURCE_KIND`).
 *
 * COUVERTURE DU DÉTECTEUR (dite, pas devinée) : littéraux à valeurs de chaîne écrits en clair dans
 * `src/ui`, `src/engine`, `src/state`, `src/data` (hors tests). Un Record bâti par calcul, ou dont
 * toutes les valeurs sont des mots FR minuscules sans accent, lui échappe.
 *
 * CE QUE CETTE GARDE NE VOIT PAS, mesuré : la même seconde vérité écrite en JSX plutôt qu'en littéral
 * d'objet — des `<option value="vue">Vue</option>` énumérés à la main (cas vivant :
 * `src/ui/editor/GameOpEditor.tsx:860-863`, vocabulaire `senseSchema`). Le détecteur ne lit que des
 * paires `clé : 'texte'` ; aucune balise n'entre dans `RX_LITTERAL` ni dans `RX_TABLE`.
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../../../scripts/guards/lib/sourceCorpus.mjs';
import { DEFS_DE_DOCUMENT } from '../validate';
import { descendre } from './descente';

/** Les vocabulaires (jeux d'options) d'enum atteints par le registre (`descendre`). */
function vocabulairesDuRegistre(): Set<string>[] {
  const vus: Set<string>[] = [];
  descendre(
    DEFS_DE_DOCUMENT.map((d) => d.schema),
    ({ def }) => {
      if (def.type !== 'enum') return;
      vus.push(new Set(Object.values(def.entries as Record<string, string>)));
      return 'elaguer';
    },
  );
  return vus;
}

const CLE_TECHNIQUE = /^[a-z][\w$]*[A-Z]|^[A-ZÀ-Ý][a-zà-ÿ]*[A-Z]|[._/]|^[a-z0-9]+(-[a-z0-9]+)+$/;
const MOT_CAPITALISE = /^[A-ZÀ-Ý][a-zà-ÿ]+(-[A-ZÀ-Ý]?[a-zà-ÿ]+)*$/;
/** Un identifiant : jamais d'espace, et une forme de clé (point, slash, casse composée, kebab, sigle). */
const estIdentifiant = (v: string): boolean => !/\s/.test(v) && (v.length < 2 || CLE_TECHNIQUE.test(v));
/** Une marque de texte FR : espace, accent, apostrophe, ou mot capitalisé. */
const marqueFR = (v: string): boolean =>
  /\s/.test(v) || /[À-ÿ]/.test(v) || /['’]/.test(v) || MOT_CAPITALISE.test(v);

/** Les gabarits d'un fichier qui ne FABRIQUENT qu'un identifiant : hors interpolations, ils ne portent
 *  que des caractères de clé (aucun espace, aucune ponctuation) — ce qui s'y colle est un morceau de
 *  clé, jamais une phrase montrée au joueur. */
function gabaritsIdentifiants(source: string): string[] {
  return [...source.matchAll(/`(?:[^`\\]|\\.)*`/g)]
    .map((m) => m[0])
    .filter((g) => g.slice(1, -1).split(/\$\{[^{}]*\}/).every((part) => /^[A-Za-z0-9_$]*$/.test(part)));
}

/** Un Record de SEGMENTS DE CLÉ : il est lu, et toutes ses lectures `NOM[…]` collent leur valeur dans
 *  un gabarit-identifiant. Critère STRUCTUREL — ni nom, ni fichier, ni liste d'exceptions. */
function estTableDeSegments(nom: string, source: string): boolean {
  const rx = new RegExp(`\\b${nom}\\[`, 'g');
  const total = (source.match(rx) ?? []).length;
  if (total === 0) return false;
  const dansGabarits = gabaritsIdentifiants(source).reduce((n, g) => n + (g.match(rx) ?? []).length, 0);
  return dansGabarits === total;
}

const RX_LITTERAL =
  /\{\s*((?:(?:'[^']+'|"[^"]+"|[A-Za-z_$][\w$]*)\s*:\s*(?:'[^']*'|"[^"]*"|`[^`]*`)\s*,?\s*){2,})\}/g;
const RX_PAIRE =
  /(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g;

/** L'autre FORME du même faux : la TABLE `[{ id: '…', label: '…' }, …]` déclarée au niveau module —
 *  la clé du vocabulaire y est l'`id`, le libellé le `label`. Mêmes deux règles, mêmes seuils. */
const RX_TABLE =
  /(?:^|\n)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=\n]*=\s*\[\s*((?:\{[^{}]*\}\s*,?\s*)+)\]/g;
const RX_OBJET = /\{[^{}]*\}/g;

/** Les couples (id, label) d'une table — `undefined` dès qu'un objet de la table n'a pas les DEUX en
 *  chaîne littérale (ce n'est alors pas une table de libellés d'options). */
function couplesIdLabel(corps: string): { ids: string[]; labels: string[] } | undefined {
  const ids: string[] = [];
  const labels: string[] = [];
  for (const objet of corps.match(RX_OBJET) ?? []) {
    const paires = [...objet.matchAll(RX_PAIRE)];
    const par = new Map(paires.map((x) => [x[1] ?? x[2] ?? x[3], x[4] ?? x[5] ?? x[6]] as const));
    const id = par.get('id');
    const label = par.get('label');
    if (id === undefined || label === undefined) return undefined;
    ids.push(id);
    labels.push(label);
  }
  return ids.length ? { ids, labels } : undefined;
}

/** Un Record écrit EN ARGUMENT de `enumNomme` est posé AU NŒUD — c'est la forme canonique, jamais une
 *  dette : premier argument (les libellés de valeurs) comme second (les HINTS mécaniques,
 *  `grammaire/valeurs.ts`). Reconnue à la FORME de l'appel — le texte qui précède le littéral est
 *  l'ouverture de `enumNomme(`, éventuellement suivie d'un premier argument COMPLET et de sa virgule.
 *  Un Record déclaré HORS de l'appel reste vu : seul le nom du 1er argument est blanchi ailleurs. */
function argumentDEnumNomme(avant: string): boolean {
  const i = avant.lastIndexOf('enumNomme(');
  return i >= 0 && /^enumNomme\(\s*(?:(?:\{(?:[^{}]|\{[^{}]*\})*\}|[A-Za-z_$][\w$]*)\s*,\s*)?$/.test(avant.slice(i));
}

export type Fichier = { readonly chemin: string; readonly source: string };

/** Le détecteur, appliqué à des SOURCES données — donc jouable sur une COPIE (contrôle positif). */
export function recordsDeLibelles(fichiers: readonly Fichier[], vocabulaires: readonly Set<string>[]): string[] {
  const trouvailles: string[] = [];
  const couvert = (cles: readonly string[]): boolean =>
    vocabulaires.some((set) => set.size >= 2 && cles.every((k) => set.has(k)) && cles.length / set.size >= 0.6);
  for (const { chemin, source } of fichiers) {
    let t: RegExpExecArray | null;
    RX_TABLE.lastIndex = 0;
    while ((t = RX_TABLE.exec(source))) {
      const nom = t[1];
      const couples = couplesIdLabel(t[2]);
      if (!couples || couples.ids.length < 2) continue;
      if (couples.labels.some(estIdentifiant) || !couples.labels.some(marqueFR)) continue;
      if (estTableDeSegments(nom, source)) continue;
      if (!couvert(couples.ids)) continue;
      trouvailles.push(`${chemin}:${nom}`);
    }
    let m: RegExpExecArray | null;
    RX_LITTERAL.lastIndex = 0;
    while ((m = RX_LITTERAL.exec(source))) {
      const paires = [...m[1].matchAll(RX_PAIRE)];
      const cles = paires.map((x) => x[1] ?? x[2] ?? x[3]);
      const valeurs = paires.map((x) => x[4] ?? x[5] ?? x[6]);
      if (cles.length < 2) continue;
      if (valeurs.some(estIdentifiant) || !valeurs.some(marqueFR)) continue;
      const avant = source.slice(0, m.index);
      if (argumentDEnumNomme(avant)) continue;
      const nom = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^=]*=\s*$/.exec(avant)?.[1];
      if (nom && new RegExp('enumNomme[(]\\s*' + nom + '[^A-Za-z0-9_$]').test(source)) continue;
      if (nom && estTableDeSegments(nom, source)) continue;
      if (!couvert(cles)) continue;
      trouvailles.push(`${chemin}:${nom ?? `ligne ${avant.split('\n').length}`}`);
    }
  }
  return trouvailles.sort();
}

const sourcesDuDepot = (): Fichier[] =>
  readCorpus(['src/ui', 'src/engine', 'src/state', 'src/data']).map(({ rel, text }) => ({ chemin: rel, source: text }));

/**
 * STOCK NOMINATIF GELÉ, par `fichier:symbole` — les Records de libellés de valeurs qui vivaient déjà
 * hors de la grammaire quand le cliquet est né. Aucune DETTE NEUVE n'y entre : nommer un vocabulaire
 * par `enumNomme` retire sa ligne d'ici ; les lignes restantes portent leur raison au ticket #1714. La TABLE `[{id,label}]`
 * `combat.ts:RANGE_BANDS` est entrée le jour où le détecteur a couvert la forme (b) — elle préexistait
 * au cliquet, la COUVERTURE a grandi, pas la dette.
 */
const STOCK: readonly string[] = [
  'src/engine/combat.ts:RANGE_BANDS',
  'src/engine/size.ts:SIZE_LABEL',
  'src/ui/CarrierInventory.tsx:LOC_SHORT',
  'src/ui/EquipmentPanel.tsx:ZONE_OF_LOC',
  'src/ui/compendium/humanize.ts:FIELD',
  'src/ui/compendium/humanize.ts:REL_PLAYER',
  'src/ui/compendium/humanize.ts:negTable',
  'src/ui/compendium/humanize.ts:table',
].sort();

describe('cliquet — un libellé de valeur vit sur le NŒUD, jamais dans un Record', () => {
  const vocabulaires = vocabulairesDuRegistre();
  const fichiers = sourcesDuDepot();
  const detectes = recordsDeLibelles(fichiers, vocabulaires);

  it('le détecteur voit les vocabulaires du registre et les sources des quatre racines', () => {
    expect(vocabulaires.length).toBeGreaterThan(100);
    expect(fichiers.length).toBeGreaterThan(300);
  });

  it('aucun Record de libellés de valeurs hors du stock gelé', () => {
    const hors = detectes.filter((r) => !STOCK.includes(r));
    expect(hors, `Record de libellés NEUF : le libellé se pose au def par enumNomme (grammaire/valeurs.ts)`).toEqual(
      [],
    );
  });

  it('le stock ne grandit pas — il DÉCROÎT (une ligne éteinte se retire d’ici)', () => {
    expect(new Set(STOCK).size).toBe(STOCK.length);
    expect(detectes.length).toBeLessThanOrEqual(STOCK.length);
    const eteints = STOCK.filter((r) => !detectes.includes(r));
    expect(eteints, 'ces lignes du stock n’existent plus : les retirer du STOCK').toEqual([]);
  });

  it('contrôle positif : un Record injecté dans une COPIE de source est VU', () => {
    const copie: Fichier[] = [
      {
        chemin: 'src/ui/CopieDeControle.tsx',
        source: "const KIND_INJECTE = { physique: 'Physique', mentale: 'Mentale' };\n",
      },
    ];
    expect(recordsDeLibelles(copie, vocabulaires)).toEqual(['src/ui/CopieDeControle.tsx:KIND_INJECTE']);
  });

  it('contrôle positif : la FORME TABLE `[{id,label}]` injectée dans une COPIE est VUE', () => {
    const copie: Fichier[] = [
      {
        chemin: 'src/ui/CopieDeControle.tsx',
        source:
          "const NATURE_TABLE: { id: 'physique' | 'mentale'; label: string }[] = [\n" +
          "  { id: 'physique', label: 'Physique' }, { id: 'mentale', label: 'Mentale' },\n];\n",
      },
    ];
    expect(recordsDeLibelles(copie, vocabulaires)).toEqual(['src/ui/CopieDeControle.tsx:NATURE_TABLE']);
  });

  it('une rangée d’action poussée une à une n’est pas une table de libellés', () => {
    const copie: Fichier[] = [
      {
        chemin: 'src/state/CopieDeControle.ts',
        source:
          "out.push({ id: 'physique', label: 'Physique', icon: 'a/b' });\n" +
          "out.push({ id: 'mentale', label: 'Mentale', icon: 'a/c' });\n",
      },
    ];
    expect(recordsDeLibelles(copie, vocabulaires)).toEqual([]);
  });

  it('la règle « valeur = texte FR » écarte les tables clé→clé, sans liste d’exceptions', () => {
    const copies: Fichier[] = [
      { chemin: 'a.ts', source: "const K = { physique: 'mut.physique', mentale: 'mut.mentale' };\n" },
      { chemin: 'b.ts', source: "const K = { physique: 'physiqueKind', mentale: 'mentaleKind' };\n" },
      { chemin: 'c.ts', source: "const K = { physique: 'icone/physique', mentale: 'icone/mentale' };\n" },
    ];
    expect(recordsDeLibelles(copies, vocabulaires)).toEqual([]);
  });

  it('la règle « segments de clé » écarte un Record concaténé en identifiant, et elle seule', () => {
    const colle: Fichier[] = [{
      chemin: 'f.ts',
      source: "const SEG = { physique: 'Physique', mentale: 'Mentale' };\nconst cat = (k) => `mutations${SEG[k]}`;\n",
    }];
    expect(recordsDeLibelles(colle, vocabulaires)).toEqual([]);
    const affiche: Fichier[] = [{
      chemin: 'g.ts',
      source: "const SEG = { physique: 'Physique', mentale: 'Mentale' };\nconst txt = (k) => `Nature : ${SEG[k]}`;\n",
    }];
    expect(recordsDeLibelles(affiche, vocabulaires)).toEqual(['g.ts:SEG']);
  });

  it('la table passée à enumNomme est le FOYER, jamais un Record du stock', () => {
    const foyer: Fichier[] = [
      {
        chemin: 'd.ts',
        source: "const LIBELLES = { physique: 'Physique', mentale: 'Mentale' };\nconst s = enumNomme(LIBELLES);\n",
      },
      { chemin: 'e.ts', source: "const s = enumNomme({ physique: 'Physique', mentale: 'Mentale' });\n" },
    ];
    expect(recordsDeLibelles(foyer, vocabulaires)).toEqual([]);
  });

  it('le SECOND argument de enumNomme (les hints) est posé au nœud, mais le même Record hors appel est VU', () => {
    const hints = "{ physique: 'Le corps encaisse', mentale: 'L’esprit encaisse' }";
    const libelles = "{ physique: 'Physique', mentale: 'Mentale' }";
    const auNoeud: Fichier[] = [
      { chemin: 'h.ts', source: `const s = enumNomme(\n  ${libelles},\n  ${hints},\n);\n` },
      { chemin: 'i.ts', source: `const LIBELLES = ${libelles};\nconst s = enumNomme(LIBELLES, ${hints});\n` },
    ];
    expect(recordsDeLibelles(auNoeud, vocabulaires)).toEqual([]);
    const horsAppel: Fichier[] = [
      { chemin: 'j.ts', source: `const HINTS = ${hints};\nconst s = enumNomme(${libelles});\n` },
    ];
    expect(recordsDeLibelles(horsAppel, vocabulaires)).toEqual(['j.ts:HINTS']);
  });
});

/**
 * GARDE — toute référence Codex écrite EN LITTÉRAL dans l'UI pointe une fiche qui EXISTE.
 *
 * ANGLE MORT COMBLÉ (mesuré 2026-08-17) : `src/engine/rule-refs.test.ts` ne parcourt que le registre
 * `RULE_REF` (et les deux producteurs dynamiques énumérés). Les refs écrites à la main au site
 * d'affichage — `rule: { category: 'regles', id: 'mouvement' }` d'une case de console,
 * `<CodexRef category="regles" id="calme-d-approche">` d'une barre d'action — n'étaient couvertes par
 * AUCUNE garde : une ref MORTE (`regles/mouvement`, avant la création de la fiche) a survécu en
 * silence dans `CombatConsole.tsx`, popover muet à l'écran, suite verte.
 *
 * MÉCANIQUE : parseur AST réel (`typescript`), jamais un grep — les littéraux multi-lignes et les
 * attributs JSX répartis sur plusieurs lignes échappent à la forme textuelle. Deux formes, une seule
 * loi (couple `category` + `id` tous DEUX littéraux de chaîne) :
 *   - littéral d'objet : `{ category: 'x', id: 'y' }` — quel que soit le champ porteur (`rule`,
 *     `kref`, `src`, `stakeRule`, ou aucun) ;
 *   - élément JSX : `<CodexRef category="x" id="y" …>`.
 * Chaque couple est résolu par la couture RÉELLE d'affichage — `codexLookupById`, la porte du Codex
 * (`CodexRef` l'appelle pour peupler son popover). Introuvable = ROUGE, avec `fichier:ligne` et le
 * couple fautif.
 *
 * ANGLE MORT DÉCLARÉ (et ASSERTÉ plus bas, jamais implicite) : un scan STATIQUE ne voit que les
 * littéraux. Une ref dont l'`id` est calculé (`id={spell.id}`, `` id: `regle-${k}` ``, variable) ou
 * dont la catégorie l'est (`category={RULE_REF.chance.category}`) est HORS PÉRIMÈTRE : elle relève
 * des gardes de domaine (`rule-refs.test.ts` pour `RULE_REF`, les gardes de catalogue pour les ids de
 * donnée). Ces sites sont COMPTÉS ici, jamais résolus — leur nombre est publié par le test de
 * couverture pour qu'on sache ce que cette garde ne dit pas.
 *
 * ZÉRO EXEMPTION, par construction : il n'y a pas de liste d'exceptions dans ce fichier. Un littéral
 * qui ne résout pas se CORRIGE (fiche manquante, catégorie mal orthographiée, id renommé) — un
 * popover muet à l'écran n'est jamais une exception légitime.
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { codexLookupById } from './compendium/registry';
import { ACTIONS } from '../data/index';

export interface CodexRefLiteral {
  line: number;
  category: string;
  id: string;
  /** `objet` = littéral `{ category, id }` · `jsx` = attributs d'un élément (`<CodexRef …>`). */
  forme: 'objet' | 'jsx';
  /** Texte source du site, pour l'adresse du rouge. */
  detail: string;
}

/**
 * Le vocabulaire d'une ref Codex écrite en littéral — l'identité (`category`/`id`), son affichage
 * (`label`, `instance` = la spécialisation d'une entrée générique) et les clés de la rangée `CodexRow`
 * de forme `{ t: 'ref', … }` (`t`/`show`/`badge`, `src/ui/compendium/registry.ts:119`). Un littéral qui
 * porte une clé HORS de ce jeu est d'une autre ESPÈCE : son `category` ne désigne pas une catégorie de
 * catalogue (service de ville, famille d'icône…). C'est la discrimination par la FORME — jamais une
 * exemption de fichier. Sonde ci-dessous : le jeu est PORTEUR (l'élargir ferait entrer des étrangers,
 * le rétrécir ferait fuir des refs réelles).
 */
const CODEX_REF_KEYS = new Set(['category', 'id', 'label', 'instance', 't', 'show', 'badge']);

/** Le texte d'une expression LITTÉRALE de chaîne — `null` si elle est calculée (variable, gabarit à
 *  substitution, appel) : c'est ce qui trace la frontière du scan statique. */
function texteLitteral(e: ts.Expression | undefined): string | null {
  if (!e) return null;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  return null;
}

/** L'initialiseur d'un attribut JSX en tant que chaîne littérale : `x="y"` comme `x={'y'}`. */
function attrLitteral(a: ts.JsxAttribute): string | null {
  const init = a.initializer;
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) return texteLitteral(init.expression);
  return null;
}

/**
 * Les couples `category`+`id` d'un fichier. `statiques` = les deux membres littéraux (résolubles) ;
 * `dynamiques` = la catégorie est littérale mais l'id est calculé, ou l'inverse — l'angle mort du
 * scan, compté pour être DIT.
 */
export function codexRefLiterals(file: string, src: string): { statiques: CodexRefLiteral[]; dynamiques: number } {
  const sf = ts.createSourceFile(
    file, src, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const statiques: CodexRefLiteral[] = [];
  let dynamiques = 0;
  const ligne = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const detail = (n: ts.Node) => n.getText(sf).replace(/\s+/g, ' ').slice(0, 120);

  const compter = (n: ts.Node, forme: CodexRefLiteral['forme'], cat: string | null, id: string | null, presents: boolean) => {
    if (!presents) return;
    if (cat !== null && id !== null) statiques.push({ line: ligne(n), category: cat, id, forme, detail: detail(n) });
    else dynamiques++;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const names = node.properties.map((p) => (p.name && ts.isIdentifier(p.name) ? p.name.text : null));
      const prop = (k: string) => node.properties.find((_, i) => names[i] === k);
      const c = prop('category');
      const i = prop('id');
      const lire = (p: ts.ObjectLiteralElementLike | undefined) =>
        p && ts.isPropertyAssignment(p) ? texteLitteral(p.initializer) : null;
      // FORME, jamais fichier : toutes les clés appartiennent au vocabulaire d'une ref Codex. Un
      // littéral qui porte une clé ÉTRANGÈRE est d'une autre espèce — `ResolvedPlaceService`
      // (`{ id, category: 'auberge', icon, rest }`) a un `category` de service, pas de catalogue.
      const formeRef = node.properties.every((p, k) => ts.isSpreadAssignment(p) || (!!names[k] && CODEX_REF_KEYS.has(names[k]!)));
      compter(node, 'objet', lire(c), lire(i), formeRef && !!c && !!i);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attr = (k: string) => node.attributes.properties.find(
        (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === k,
      );
      const c = attr('category');
      const i = attr('id');
      compter(node, 'jsx', c ? attrLitteral(c) : null, i ? attrLitteral(i) : null, !!c && !!i);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { statiques, dynamiques };
}

interface Site extends CodexRefLiteral { rel: string }

/** Les sources d'UI (`src/ui/**` hors tests : `.tsx` ET `.ts` — une ref littérale vit aussi bien dans
 *  un projecteur `compendium/opRows.ts` que dans un composant), rendues par la primitive de marche
 *  `readCorpus`. */
function corpus(): { sites: Site[]; dynamiques: number } {
  const sites: Site[] = [];
  let dynamiques = 0;
  for (const { rel, text } of readCorpus(['src/ui'])) {
    const r = codexRefLiterals(rel, text);
    for (const s of r.statiques) sites.push({ rel, ...s });
    dynamiques += r.dynamiques;
  }
  return { sites, dynamiques };
}

describe('refs Codex écrites EN LITTÉRAL dans l’UI — chacune pointe une fiche RÉELLE', () => {
  it('MORSURE : le littéral d’objet est lu sur la STRUCTURE (champ porteur quelconque, multi-lignes)', () => {
    const src = "const c = { key: 'k', rule: {\n  category: 'regles',\n  id: 'mouvement',\n} };";
    expect(codexRefLiterals('x.ts', src).statiques).toEqual([
      { line: 1, category: 'regles', id: 'mouvement', forme: 'objet', detail: "{ category: 'regles', id: 'mouvement', }" },
    ]);
  });

  it('MORSURE : l’attribut JSX littéral (`<CodexRef category="…" id="…">`), guillemets ou accolades', () => {
    const guillemets = codexRefLiterals('x.tsx', '<CodexRef category="regles" id="calme-d-approche" label="X" />').statiques;
    expect(guillemets.map((s) => `${s.category}/${s.id}`)).toEqual(['regles/calme-d-approche']);
    const accolades = codexRefLiterals('x.tsx', "<CodexRef category={'skills'} id={'guerison'}>i</CodexRef>").statiques;
    expect(accolades.map((s) => `${s.category}/${s.id}`)).toEqual(['skills/guerison']);
  });

  it('ANGLE MORT ASSERTÉ : un id (ou une catégorie) CALCULÉ n’est PAS résolu — il est COMPTÉ, pas jugé', () => {
    // Écrit noir sur blanc pour qu'aucune relecture ne prenne ce scan pour une couverture totale.
    const cas = [
      '<CodexRef category="spells" id={spell.id} label={l} />',
      '<CodexRef category={RULE_REF.chance.category} id={RULE_REF.chance.id} label="Chance" />',
      "const r = { category: 'regles', id: cle };",
      'const r = { category: cat, id: `regle-${k}` };',
    ];
    for (const src of cas) {
      const r = codexRefLiterals('x.tsx', src);
      expect(r.statiques, `un id/catégorie calculé a été pris pour un littéral : ${src}`).toEqual([]);
      expect(r.dynamiques, `site dynamique non compté : ${src}`).toBe(1);
    }
  });

  it('HORS FORME : un objet qui ne porte pas LES DEUX champs n’est pas une ref (aucun faux positif)', () => {
    expect(codexRefLiterals('x.ts', "const a = { id: 'force', label: 'Force' };").statiques).toEqual([]);
    expect(codexRefLiterals('x.ts', "const a = { category: 'regles', label: 'X' };").statiques).toEqual([]);
    expect(codexRefLiterals('x.tsx', '<div id="hud" className="x" />').statiques).toEqual([]);
  });

  it('HORS ESPÈCE : un `category` qui n’est pas celui d’un catalogue (clé étrangère au littéral)', () => {
    // Cas RÉEL rencontré à la pose de cette garde : `CityHubScreen.tsx` monte un service de ville
    // `{ id: 'repos', category: 'auberge', icon, rest }` — un `category` de SERVICE. Discriminé par la
    // FORME (clés `icon`/`rest` étrangères au vocabulaire d'une ref), jamais par une exemption.
    const service = "const s = { id: 'repos', category: 'auberge', label: 'Repos', icon: 'nav/rest', rest: r };";
    expect(codexRefLiterals('x.tsx', service).statiques).toEqual([]);
    // …et la même paire, SEULE ou avec les seules clés d'affichage, reste une ref.
    expect(codexRefLiterals('x.ts', "const s = { id: 'repos', category: 'auberge', label: 'Repos' };").statiques)
      .toHaveLength(1);
  });

  it('SONDE : le jeu de clés est PORTEUR — la rangée `{ t: "ref", … }` du Codex reste MESURÉE', () => {
    // Rétrécir `CODEX_REF_KEYS` ferait fuir tout un pan du stock en laissant la garde VERTE. Les deux
    // formes réelles du dépôt sont plantées ici : la rangée de projection (`compendium/opRows.ts`) et
    // le fait à clé référencée (`kref`, dont le littéral INTERNE est la ref).
    const row = "const r = { t: 'ref', category: 'characteristics', id: 'mouvement', label: 'Mouvement', show: 'M', badge: '+1' };";
    expect(codexRefLiterals('x.ts', row).statiques.map((s) => `${s.category}/${s.id}`)).toEqual(['characteristics/mouvement']);
    const fait = "const f = { label: 'B', value: v, kref: { category: 'characteristics', id: 'blessure', label: 'Blessure' } };";
    expect(codexRefLiterals('x.ts', fait).statiques.map((s) => `${s.category}/${s.id}`)).toEqual(['characteristics/blessure']);
  });

  it('CÂBLAGE : le scan de CORPUS mesure réellement des sites, dans plusieurs fichiers et deux formes', () => {
    // Contre-preuve : un scan cassé (mauvais répertoire, extension oubliée, parseur muet) rendrait la
    // garde VIDE et VERTE — c'est exactement ce qui a laissé passer `regles/mouvement`.
    const { sites, dynamiques } = corpus();
    expect(sites.length, 'aucun site mesuré : le scan ou le périmètre a lâché').toBeGreaterThan(20);
    // ANCRE de câblage, MESURÉE et non nominative : le scan voit PLUSIEURS fichiers, et l'un d'eux
    // porte un STOCK. La console, elle, porte seulement une ref statique (`trappings/mains-nues`) :
    // ses foyers de règle vivent dans `src/data/actions.json`, gardés par le test suivant.
    const parFichier = new Map<string, number>();
    for (const s of sites) parFichier.set(s.rel, (parFichier.get(s.rel) ?? 0) + 1);
    expect(parFichier.size, 'le scan ne voit plus qu’une poignée de fichiers').toBeGreaterThanOrEqual(5);
    expect(Math.max(...parFichier.values()), 'aucun fichier ne porte plus de STOCK de refs littérales').toBeGreaterThanOrEqual(5);
    expect(sites.some((s) => s.rel === 'src/ui/CombatConsole.tsx'), 'la console est retombée hors scan').toBe(true);
    expect(sites.some((s) => s.forme === 'jsx'), 'aucun site JSX mesuré : la forme `<CodexRef …>` est retombée hors scan').toBe(true);
    expect(sites.some((s) => s.rel.endsWith('.ts')), 'aucun site `.ts` mesuré : le périmètre est retombé aux seuls composants').toBe(true);
    // L'ANGLE MORT, chiffré : le corpus porte bien plus de refs à identité CALCULÉE que de littéraux.
    // Ce que cette garde couvre est une PART, dite ici en toutes lettres — jamais une garantie globale.
    expect(dynamiques, 'plus aucune ref dynamique vue : le compteur d’angle mort a lâché').toBeGreaterThan(50);
  });

  it('REGISTRE DES ACTIONS : chaque `rule`/`ruleCategory` d’`actions.json` résout au Codex', () => {
    // Les foyers de règle des cases de console sont passés du COMPOSANT à la DONNÉE : sans cette
    // sonde, une ref morte y serait invisible (le popover muet à l'écran, la garde verte).
    const portees = ACTIONS.filter((a) => a.rule && a.ruleCategory);
    expect(portees.length, 'aucune action ne porte de foyer de règle : la sonde ne mesurerait rien').toBeGreaterThan(20);
    const mortes = portees
      .filter((a) => !codexLookupById(a.ruleCategory!, a.rule!))
      .map((a) => `${a.id} → ${a.ruleCategory}/${a.rule}`);
    expect(mortes, `Réf Codex MORTE au registre des actions :\n  ${mortes.join('\n  ')}`).toEqual([]);
  });

  it('chaque ref littérale de `src/ui/**` résout au Codex, par id STABLE', () => {
    const { sites } = corpus();
    const mortes = sites
      .filter((s) => !codexLookupById(s.category, s.id))
      .map((s) => `${s.rel}:${s.line} → ${s.category}/${s.id}   ${s.detail}`)
      .sort();
    expect(
      mortes,
      'Réf Codex MORTE écrite en littéral : le popover est muet à l’écran. Corriger la ref (catégorie/id ' +
        'réels du catalogue) ou créer la fiche — jamais exempter :\n' + mortes.join('\n'),
    ).toEqual([]);
  });

  it('CONTRE-PREUVE sur le MÊME résolveur : une ref forgée introuvable est bien vue comme morte', () => {
    // Le vert ci-dessus ne prouve rien si `codexLookupById` répondait « trouvé » à tout.
    expect(codexLookupById('regles', 'mouvement-sonde')).toBeUndefined();
    expect(codexLookupById('categorie-inexistante', 'mouvement')).toBeUndefined();
    expect(codexLookupById('regles', 'mouvement'), 'la fiche réelle ne résout plus : le résolveur ou la donnée a bougé').toBeTruthy();
  });
});

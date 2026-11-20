import { ast, analyserCorpus } from '../../../scripts/guards/lib/dialecte.mjs';
/**
 * GARDE — les références Codex littérales des projecteurs du noyau pointent une fiche existante.
 * Le parseur AST lit les objets qui portent `category` et `id`, y compris sur plusieurs lignes.
 * Chaque couple littéral est résolu par `codexLookupById`. Une identité calculée est comptée
 * séparément et relève des gardes de domaine et de catalogue.
 */
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { dossierDe } from '../../../scripts/guards/lib/couches.mjs';
import { codexLookupById } from './registry';
import { ACTIONS, ACTIVITIES, STAKES, cibleCodex, crewTestTypes } from '../../data/index';
import type { FoyerDeRegle } from '../../data/schemas/grammaire/valeurs';

interface CodexRefLiteral {
  line: number;
  category: string;
  id: string;
  /** Texte source du site, pour l'adresse du rouge. */
  detail: string;
}

/**
 * Le vocabulaire d'une ref Codex écrite en littéral — l'identité (`category`/`id`), son affichage
 * (`label`, `instance` = la spécialisation d'une entrée générique) et les clés de la rangée `CodexRow`
 * de forme `{ t: 'ref', … }` (`t`/`show`/`badge`, `src/noyau/codex/registry.ts:157`). Un littéral qui
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

/**
 * Les couples `category`+`id` d'un fichier. `statiques` = les deux membres littéraux (résolubles) ;
 * `dynamiques` = la catégorie est littérale mais l'id est calculé, ou l'inverse — l'angle mort du
 * scan, compté pour être DIT.
 */
function codexRefLiterals(file: string, src: string, sf = ast({ rel: file, text: src })!): { statiques: CodexRefLiteral[]; dynamiques: number } {
  const statiques: CodexRefLiteral[] = [];
  let dynamiques = 0;
  const ligne = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const detail = (n: ts.Node) => n.getText(sf).replace(/\s+/g, ' ').slice(0, 120);

  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const names = node.properties.map((p) => ('name' in p && p.name && ts.isIdentifier(p.name) ? p.name.text : null));
      const prop = (k: string) => node.properties.find((_, i) => names[i] === k);
      const c = prop('category');
      const i = prop('id');
      const lire = (p: ts.ObjectLiteralElementLike | undefined) =>
        p && ts.isPropertyAssignment(p) ? texteLitteral(p.initializer) : null;
      // FORME, jamais fichier : toutes les clés appartiennent au vocabulaire d'une ref Codex. Un
      // littéral qui porte une clé ÉTRANGÈRE est d'une autre espèce — `ResolvedPlaceService`
      // (`{ id, category: 'auberge', icon, rest }`) a un `category` de service, pas de catalogue.
      const formeRef = node.properties.every((p, k) => ts.isSpreadAssignment(p) || (!!names[k] && CODEX_REF_KEYS.has(names[k]!)));
      if (formeRef && c && i) {
        const category = lire(c);
        const id = lire(i);
        if (category !== null && id !== null) statiques.push({ line: ligne(node), category, id, detail: detail(node) });
        else dynamiques++;
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return { statiques, dynamiques };
}

interface Site extends CodexRefLiteral { rel: string }

/** Sources des projecteurs du Codex via la marche de corpus partagée. */
const PORTEE = [`${dossierDe('noyau')}/codex`];
function corpus(): { sites: Site[]; dynamiques: number } {
  const sites: Site[] = [];
  let dynamiques = 0;
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(readCorpus(PORTEE))) {
    const r = codexRefLiterals(rel, text, sourceFile!);
    for (const s of r.statiques) sites.push({ rel, ...s });
    dynamiques += r.dynamiques;
  }
  return { sites, dynamiques };
}

describe('refs Codex écrites EN LITTÉRAL — chacune pointe une fiche RÉELLE', () => {
  it('MORSURE : le littéral d’objet est lu sur la STRUCTURE (champ porteur quelconque, multi-lignes)', () => {
    const src = "const c = { key: 'k', rule: {\n  category: 'regles',\n  id: 'mouvement',\n} };";
    expect(codexRefLiterals('x.ts', src).statiques).toEqual([
      { line: 1, category: 'regles', id: 'mouvement', detail: "{ category: 'regles', id: 'mouvement', }" },
    ]);
  });

  it('ANGLE MORT ASSERTÉ : un id (ou une catégorie) CALCULÉ n’est PAS résolu — il est COMPTÉ, pas jugé', () => {
    // Écrit noir sur blanc pour qu'aucune relecture ne prenne ce scan pour une couverture totale.
    const cas = [
      "const r = { category: 'regles', id: cle };",
      'const r = { category: cat, id: `regle-${k}` };',
    ];
    for (const src of cas) {
      const r = codexRefLiterals('x.ts', src);
      expect(r.statiques, `un id/catégorie calculé a été pris pour un littéral : ${src}`).toEqual([]);
      expect(r.dynamiques, `site dynamique non compté : ${src}`).toBe(1);
    }
  });

  it('HORS FORME : un objet qui ne porte pas LES DEUX champs n’est pas une ref (aucun faux positif)', () => {
    expect(codexRefLiterals('x.ts', "const a = { id: 'force', label: 'Force' };").statiques).toEqual([]);
    expect(codexRefLiterals('x.ts', "const a = { category: 'regles', label: 'X' };").statiques).toEqual([]);
  });

  it('HORS ESPÈCE : un `category` qui n’est pas celui d’un catalogue (clé étrangère au littéral)', () => {
    // Les clés `icon` et `rest` distinguent une catégorie de service d’une ref du Codex.
    const service = "const s = { id: 'repos', category: 'auberge', label: 'Repos', icon: 'navigation/repos', rest: r };";
    expect(codexRefLiterals('x.ts', service).statiques).toEqual([]);
    // …et la même paire, SEULE ou avec les seules clés d'affichage, reste une ref.
    expect(codexRefLiterals('x.ts', "const s = { id: 'repos', category: 'auberge', label: 'Repos' };").statiques)
      .toHaveLength(1);
  });

  it('SONDE : le jeu de clés est PORTEUR — la rangée `{ t: "ref", … }` du Codex reste MESURÉE', () => {
    // Rétrécir `CODEX_REF_KEYS` ferait fuir tout un pan du stock en laissant la garde VERTE. Les deux
    // formes réelles du dépôt sont plantées ici : la rangée de projection (`noyau/codex/opRows.ts`) et
    // le fait à clé référencée (`kref`, dont le littéral INTERNE est la ref).
    const row = "const r = { t: 'ref', category: 'characteristics', id: 'mouvement', label: 'Mouvement', show: 'M', badge: '+1' };";
    expect(codexRefLiterals('x.ts', row).statiques.map((s) => `${s.category}/${s.id}`)).toEqual(['characteristics/mouvement']);
    const fait = "const f = { label: 'B', value: v, kref: { category: 'characteristics', id: 'blessure', label: 'Blessure' } };";
    expect(codexRefLiterals('x.ts', fait).statiques.map((s) => `${s.category}/${s.id}`)).toEqual(['characteristics/blessure']);
  });

  it('CÂBLAGE : le scan de CORPUS mesure réellement des sites, dans plusieurs fichiers du noyau', () => {
    // Contre-preuve : un scan cassé (mauvais répertoire, extension oubliée, parseur muet) rendrait la
    // garde VIDE et VERTE — c'est exactement ce qui a laissé passer `regles/mouvement`.
    const { sites, dynamiques } = corpus();
    const parProjecteur = new Map<string, number>();
    for (const s of sites) parProjecteur.set(s.rel, (parProjecteur.get(s.rel) ?? 0) + 1);
    expect(parProjecteur.get(`${PORTEE[0]}/opRows.ts`)).toBeGreaterThanOrEqual(3);
    expect(parProjecteur.get(`${PORTEE[0]}/registry.ts`)).toBeGreaterThanOrEqual(3);
    expect(dynamiques, 'plus aucune ref dynamique vue : le compteur d’angle mort a lâché').toBeGreaterThan(50);
  });

  it('FOYERS DE RÈGLE de la donnée : chaque `rule` de ses porteurs résout au Codex', () => {
    // Les foyers de règle (cases de console, enjeux de jet, Activités, Tests d'équipage) vivent dans
    // la DONNÉE : le parse juge l'id dans l'espace de son type, cette sonde juge la FICHE que le ⓘ
    // ouvre (`cibleCodex` → `codexLookupById`) — le popover muet à l'écran, la garde verte, sinon.
    const porteurs: Record<string, readonly { id: string; rule?: FoyerDeRegle }[]> = {
      'actions.json': ACTIONS, 'activities.json': ACTIVITIES, 'crew-test-types.json': crewTestTypes,
      'stakes.json': STAKES,
    };
    const portees = Object.entries(porteurs).flatMap(([f, l]) => l.flatMap((e) => (e.rule ? [{ f, id: e.id, cible: cibleCodex(e.rule) }] : [])));
    for (const [f, l] of Object.entries(porteurs)) expect(l.some((e) => e.rule), `${f} ne porte plus aucun foyer : la sonde ne le mesure plus`).toBe(true);
    const mortes = portees
      .filter((p) => !codexLookupById(p.cible.category, p.cible.id))
      .map((p) => `${p.f} « ${p.id} » → ${p.cible.category}/${p.cible.id}`);
    expect(mortes, `Foyer de règle MORT au Codex :\n  ${mortes.join('\n  ')}`).toEqual([]);
  });

  it('FICHE EN LECTURE : chaque porteur de foyer exposé au Codex montre sa section « Règle » vers la fiche du foyer', () => {
    const exposes: Record<string, readonly { id: string; rule?: FoyerDeRegle }[]> = {
      activities: ACTIVITIES, crewTestTypes, stakes: STAKES,
    };
    const ecarts = Object.entries(exposes).flatMap(([categorie, l]) => l.flatMap((e) => {
      if (!e.rule) return [];
      const cible = cibleCodex(e.rule);
      const rangees = codexLookupById(categorie, e.id)?.sections?.find((s) => s.title === 'Règle')?.rows ?? [];
      return rangees.some((r) => r.t === 'ref' && r.category === cible.category && r.id === cible.id)
        ? [] : [`${categorie} « ${e.id} » → ${cible.category}/${cible.id}`];
    }));
    expect(ecarts, `Foyer absent de la fiche en lecture :\n  ${ecarts.join('\n  ')}`).toEqual([]);
  });

  it('chaque ref littérale du corpus résout au Codex, par id STABLE', () => {
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

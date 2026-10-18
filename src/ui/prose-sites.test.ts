import { analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
/**
 * GARDE D'INVENTAIRE des sites de PROSE (#1392 Lot E, design v8 §1) — verrou par construction du
 * périmètre du liage : on ne peut pas rendre du markdown quelque part sans que ce site figure, avec
 * son origine et son porteur, dans `SITES_PROSE` (`src/ui/liage.ts`).
 *
 * Marche AST (`typescript`, précédent `src/ui/codex-inline-refs-guard.test.ts`) en deux temps :
 *
 * 1. POINT FIXE des composants PORTEURS de prose, depuis `Prose{md}`. Un composant devient porteur
 *    quand il transmet une de ses props à la prop de markdown d'un porteur connu — et seulement s'il
 *    est lui-même monté comme BALISE JSX quelque part (un helper local à paramètre,
 *    `renderServiceDetail`, n'est pas un composant : ses appels ne sont pas des sites).
 * 2. SITES TERMINAUX : tout élément JSX d'un porteur dont la prop de markdown n'est PAS la simple
 *    transmission d'une prop du composant courant (identifiant NU). Accès de membre (`item.desc`),
 *    appel (`coreDesc('revenus')`), ternaire, littéral : TERMINAL. Tout appel de `mdToText` (racine
 *    TEXTE, hors de `<Prose>`) est un site terminal.
 *
 * PROSE DE PAQUET (#686) : un site déclaré `paquet` passe la prop `paquet` (`mdToText(nommer(…))` pour la
 * racine texte), et lui seul — c'est l'ORIGINE déclarée du texte qui décide, jamais sa place dans l'arbre.
 * Un site de PROJET (#2206) passe `porteur` ET `paquet` : la prose y est liée à son champ ET nommée.
 *
 * ANGLE MORT DIT (et refusé, jamais hérité) : la garde suit des PROPS, elle ne résout pas les
 * VALEURS. Elle sait qu'un site passe `porteur`, pas que ce porteur nomme le bon champ — c'est la
 * garde §1c (`compendium/liens-du-catalogue.test.tsx`) et la relecture qui jugent le contenu. En
 * revanche elle REFUSE les formes qu'elle ne saurait pas suivre : `React.createElement(Prose, …)` et
 * tout spread de props portant la prop de markdown.
 */
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { SITES_PROSE } from './liage';
import { CHAMPS_PROSE_DE_SCENE } from '../data/schemas/grammaire/champs-prose-de-scene';
import { detenteur } from '../detenteur.testkit';

/** Prop de markdown de la racine du point fixe : tout part de `<Prose md>`. */
const RACINE_PORTEUSE = { balise: 'Prose', prop: 'md' };

interface CompEnglobant {
  nom: string | null;
  props: Set<string>;
}

/** Composant/fonction nommé(e) englobant un nœud, avec ses props DÉSTRUCTURÉES. */
function englobant(node: ts.Node): CompEnglobant | null {
  let n: ts.Node | undefined = node.parent;
  while (n) {
    if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      let nom: string | null = null;
      if (ts.isFunctionDeclaration(n)) nom = n.name?.text ?? null;
      else if (n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) nom = n.parent.name.text;
      const props = new Set<string>();
      const p0 = n.parameters[0];
      if (p0 && ts.isObjectBindingPattern(p0.name)) {
        for (const el of p0.name.elements) if (el.name && ts.isIdentifier(el.name)) props.add(el.name.text);
      }
      return { nom, props };
    }
    n = n.parent;
  }
  return null;
}

function elementsJsx(sf: ts.SourceFile): (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] {
  const out: (ts.JsxOpeningElement | ts.JsxSelfClosingElement)[] = [];
  const v = (n: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) out.push(n);
    n.forEachChild(v);
  };
  v(sf);
  return out;
}

const nomDeBalise = (e: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string => e.tagName.getText();
const attribut = (e: ts.JsxOpeningElement | ts.JsxSelfClosingElement, nom: string): ts.JsxAttribute | undefined =>
  e.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === nom);
const spreads = (e: ts.JsxOpeningElement | ts.JsxSelfClosingElement): ts.JsxSpreadAttribute[] =>
  e.attributes.properties.filter((p): p is ts.JsxSpreadAttribute => ts.isJsxSpreadAttribute(p));

/** Le fichier + son AST, une fois. Corpus PARTAGÉ (`readCorpus`, primitive des gardes qui balaient
 *  `src/**`) : les `*.test.*` et les `*.d.ts` en sont exclus PAR LA LIB — les `<Prose>` d'un test
 *  sont des fixtures, pas des sites de l'application. C'est la seule exclusion, et elle est dite. */
const SOURCES = detenteur(() =>
  [...analyserCorpus(readCorpus(['src']))].map(({ fichier, sourceFile }) => ({
    fichier: fichier.rel,
    sf: sourceFile!,
  })),
);

/** Toutes les balises JSX montées quelque part — un identifiant qui n'y figure pas n'est PAS un composant. */
const BALISES_MONTEES = detenteur(() =>
  new Set<string>(SOURCES().flatMap(({ sf }) => elementsJsx(sf).map(nomDeBalise))),
);

/** Point fixe : `balise → props de markdown`. */
function porteursDeProse(): Map<string, Set<string>> {
  const porteurs = new Map<string, Set<string>>([[RACINE_PORTEUSE.balise, new Set([RACINE_PORTEUSE.prop])]]);
  let change = true;
  let tours = 0;
  while (change && tours < 10) {
    change = false;
    tours++;
    for (const { sf } of SOURCES()) {
      for (const e of elementsJsx(sf)) {
        const props = porteurs.get(nomDeBalise(e));
        if (!props) continue;
        for (const mdp of [...props]) {
          const a = attribut(e, mdp);
          if (!a?.initializer || !ts.isJsxExpression(a.initializer)) continue;
          const ex = a.initializer.expression;
          if (!ex || !ts.isIdentifier(ex)) continue;
          const comp = englobant(e);
          // Transmission = identifiant NU d'une prop du composant courant, et ce composant doit être
          // monté comme balise quelque part (sinon c'est un helper, pas un porteur).
          if (!comp?.nom || !comp.props.has(ex.text) || !BALISES_MONTEES().has(comp.nom)) continue;
          const vues = porteurs.get(comp.nom) ?? new Set<string>();
          if (!vues.has(ex.text)) {
            vues.add(ex.text);
            porteurs.set(comp.nom, vues);
            change = true;
          }
        }
      }
    }
  }
  return porteurs;
}

interface SiteMesure {
  cle: string;
  porteurPasse: boolean;
  /** `<Prose paquet>`, ou `mdToText(nommer(…))`. */
  paquetPasse: boolean;
}

/** Racine TEXTE du périmètre : `mdToText` rend le markdown en texte brut, hors de `<Prose>`. */
const RACINE_TEXTE = 'mdToText';
/** Ce qu'un site `mdToText` appelle pour nommer une prose de paquet (`src/state/identites.ts`). */
const NOMMEUR = 'nommer';

function mesure(): { sites: SiteMesure[]; anomalies: string[] } {
  const porteurs = porteursDeProse();
  const sites: SiteMesure[] = [];
  const anomalies: string[] = [];
  for (const { fichier, sf } of SOURCES()) {
    const rangs = new Map<string, number>();
    const ligne = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
    // `React.createElement(Prose, …)` — forme que la garde ne saurait pas suivre : refusée.
    const vCreate = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && /createElement$/.test(n.expression.getText())) {
        const cible = n.arguments[0]?.getText();
        if (cible && porteurs.has(cible)) anomalies.push(`${fichier}:${ligne(n)} createElement(${cible}) — un porteur de prose se monte en JSX, jamais par appel`);
      }
      n.forEachChild(vCreate);
    };
    vCreate(sf);
    const vTexte = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === RACINE_TEXTE) {
        const base = `${fichier}#${RACINE_TEXTE}`;
        const rang = (rangs.get(base) ?? 0) + 1;
        rangs.set(base, rang);
        const arg = n.arguments[0];
        const paquetPasse = !!arg && ts.isCallExpression(arg) && ts.isIdentifier(arg.expression) && arg.expression.text === NOMMEUR;
        sites.push({ cle: `${base}#${rang}`, porteurPasse: false, paquetPasse });
      }
      n.forEachChild(vTexte);
    };
    vTexte(sf);
    for (const e of elementsJsx(sf)) {
      const balise = nomDeBalise(e);
      const props = porteurs.get(balise);
      if (!props) continue;
      if (spreads(e).length) {
        anomalies.push(`${fichier}:${ligne(e)} <${balise} {...}> — un spread peut porter la prop de markdown : la garde ne peut pas le suivre`);
      }
      for (const mdp of [...props].sort()) {
        const a = attribut(e, mdp);
        if (!a) continue;
        const ini = a.initializer;
        const ex = ini && ts.isJsxExpression(ini) ? ini.expression : undefined;
        const comp = englobant(e);
        const transmis = !!ex && ts.isIdentifier(ex) && !!comp?.nom && !!comp.props.has(ex.text) && BALISES_MONTEES().has(comp.nom);
        if (transmis) continue; // site NON terminal : c'est le porteur intermédiaire, pas un site
        const base = `${fichier}#${balise}.${mdp}`;
        const rang = (rangs.get(base) ?? 0) + 1;
        rangs.set(base, rang);
        const p = attribut(e, 'porteur');
        if (p && p.initializer && ts.isStringLiteral(p.initializer)) {
          anomalies.push(`${fichier}:${ligne(e)} porteur="…" — un porteur est un objet { type, id, chemin }, pas une chaîne`);
        }
        sites.push({ cle: `${base}#${rang}`, porteurPasse: !!p, paquetPasse: !!attribut(e, 'paquet') });
      }
    }
  }
  return { sites, anomalies };
}

describe('périmètre du liage — les sites de prose sont une liste FERMÉE (#1392 §1b)', () => {
  const { sites, anomalies } = mesure();

  it('aucune forme que la garde ne saurait pas suivre (createElement, spread, porteur en chaîne)', () => {
    expect(anomalies).toEqual([]);
  });

  it('le point fixe part bien de `Prose{md}` et trouve les porteurs intermédiaires', () => {
    const porteurs = porteursDeProse();
    expect(porteurs.get('Prose')).toContain('md');
    // Les gabarits qui REÇOIVENT une prose et la transmettent (sinon le point fixe est cassé).
    for (const balise of ['ActivityPane', 'DetailFrame', 'LoreText']) {
      expect([...porteurs.keys()], `porteur intermédiaire manquant : ${balise}`).toContain(balise);
    }
  });

  it('ensemble mesuré === `SITES_PROSE`, dans les DEUX sens', () => {
    const mesures = new Set(sites.map((s) => s.cle));
    const declares = new Set(SITES_PROSE.map((s) => s.cle));
    const nonDeclares = [...mesures].filter((c) => !declares.has(c)).sort();
    const disparus = [...declares].filter((c) => !mesures.has(c)).sort();
    expect({ nonDeclares, disparus }).toEqual({ nonDeclares: [], disparus: [] });
  });

  it('la prop `porteur` est passée EXACTEMENT là où la liste en déclare un', () => {
    const declare = new Map(SITES_PROSE.map((s) => [s.cle, !!s.porteur]));
    const ecarts = sites
      .filter((s) => declare.get(s.cle) !== s.porteurPasse)
      .map((s) => `${s.cle} : porteur ${s.porteurPasse ? 'PASSÉ' : 'absent'} au code, ${declare.get(s.cle) ? 'déclaré' : 'non déclaré'} dans SITES_PROSE`);
    expect(ecarts).toEqual([]);
  });

  it('la prose de PAQUET suit les identités EXACTEMENT là où la liste la déclare (`paquet`, ou `nommer` sous `mdToText`)', () => {
    const declare = new Map(SITES_PROSE.map((s) => [s.cle, !!s.paquet?.length]));
    const ecarts = sites
      .filter((s) => declare.get(s.cle) !== s.paquetPasse)
      .map((s) => `${s.cle} : paquet ${s.paquetPasse ? 'PASSÉ' : 'absent'} au code, ${declare.get(s.cle) ? 'déclaré' : 'non déclaré'} dans SITES_PROSE`);
    expect(ecarts).toEqual([]);
  });

  it('TOUT site hors catalogue DÉCLARE les proses de paquet qu’il rend (`paquet`, liste vide comprise) : aucun silence', () => {
    const muets = SITES_PROSE.filter((s) => !s.porteur && !Array.isArray(s.paquet)).map((s) => s.cle);
    expect(muets).toEqual([]);
  });

  it('un site porteur rend une prose de paquet SSI il la porte au PROJET (`porteur` = `projet.<chemin nommé>`, `paquet` = [chemin])', () => {
    const nommees = new Set<string>(CHAMPS_PROSE_DE_SCENE);
    const cheminDeProjet = (porteur: string): string | undefined => {
      const chemin = porteur.startsWith('projet.') ? porteur.slice('projet.'.length) : undefined;
      return chemin !== undefined && nommees.has(chemin) ? chemin : undefined;
    };
    const fautifs = SITES_PROSE
      .filter((s) => s.porteur !== undefined)
      .filter((s) => {
        const chemin = cheminDeProjet(s.porteur!);
        return chemin === undefined ? 'paquet' in s : s.paquet?.length !== 1 || s.paquet[0] !== chemin;
      })
      .map((s) => s.cle);
    expect(fautifs).toEqual([]);
  });

  it('chaque prose de paquet (`PROSES_NOMMEES`) est rendue au joueur par au moins un site qui la nomme', () => {
    const rendues = new Set(SITES_PROSE.flatMap((s) => s.paquet ?? []));
    expect(CHAMPS_PROSE_DE_SCENE.filter((c) => !rendues.has(c))).toEqual([]);
  });

  it('une origine SANS porteur ne se déclare jamais porteuse (Y / R / UI)', () => {
    const fautifs = SITES_PROSE.filter((s) => s.origine !== 'S' && s.porteur).map((s) => s.cle);
    expect(fautifs).toEqual([]);
  });

  it('tout site S SANS porteur porte sa RAISON (un reste se nomme, il ne se tait pas)', () => {
    const muets = SITES_PROSE.filter((s) => s.origine === 'S' && !s.porteur && !s.note).map((s) => s.cle);
    expect(muets).toEqual([]);
  });
});

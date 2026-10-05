/**
 * LES KEYFRAMES DU STAGE SONT BRANCHÉES — `gameIso/anim.css` porte les animations que les surcouches
 * du monde RÉCLAMENT par leur `className` : projectiles et halos de FX (`.proj`), fourmis du gabarit
 * de zone d'effet (`.zde-ants`), pastilles d'état des jetons (`.token-endmark`/`.es-*`), faune et
 * ambiance (`.fly`, `.sway`, `.smoke`, `.glow`, `.breathe`, `.warm`). Une feuille de style
 * n'entre dans le bundle que si un module l'IMPORTE : personne ne l'important, toutes ces classes
 * restent des noms morts, sans une seule erreur — les projectiles cessent de voler en silence.
 *
 * Ce que ce banc tient : (1) le BRANCHEMENT — `anim.css` est importée par l'HÔTE du monde
 * (`stage/MondeDeCampagne`), qui vit tant que l'écran de campagne vit, et par lui SEUL : une surcouche
 * se démonte au changement de regard, et une feuille globale a UN propriétaire ; (2) chaque classe de
 * MISE EN PAGE du plateau a SA feuille (table `MISES_EN_PAGE` : `.iso-stage` → `stage/iso-stage.css`,
 * `.pastille-entite` → `stage/pastille-entite.css`, `.plaque-nom` → `stage/plaque-nom.css`) : la
 * feuille porte la règle, et tout module de `src/` qui rend un élément de cette classe l'importe. Une
 * mise en page tient ainsi par son RENDEUR, jamais par l'hôte qui le monte.
 *
 * PÉRIMÈTRE ET ANGLE MORT, énoncés. Le scan est TEXTUEL et STATIQUE : il lit les sources, jamais un
 * DOM. jsdom n'exécute NI les keyframes NI la cascade CSS — aucun test de rendu ne pourrait dire ici
 * qu'une animation « tourne ». Une règle d'animation supprimée d'`anim.css` alors que son nom survit
 * dans un composant est HORS DE PORTÉE : la feuille est la seule liste de ses classes, et un scan
 * textuel n'a aucune autre source contre laquelle la confronter. Une classe est RÉCLAMÉE par une
 * valeur `className`/`class`, par `classList.add(…)` ou par `setAttribute('class', …)` ; une classe
 * construite dynamiquement (`\u0060es-${kind}\u0060`) n'est vue que par sa RACINE, et toute autre
 * écriture (`classList.toggle`, concaténation hors littéral, nom tiré d'une variable) échappe au scan.
 */
import { describe, expect, it, vi } from 'vitest';
import { API } from 'typescript/unstable/sync';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { arcsDe, sourceALExecution } from '../../../scripts/guards/lib/importGraph.mjs';
import { analyserCorpus } from '../../../scripts/guards/lib/dialecte.mjs';

const GAMEISO = fileURLToPath(new URL('../', import.meta.url)); // …/stage/ → …/gameIso/
const SOUS_GAMEISO = 'src/gameIso/';
/** L'HÔTE du monde : il ne se démonte qu'avec l'écran de campagne. */
const HOTE = join(GAMEISO, 'stage/MondeDeCampagne.tsx');
const RACINE = fileURLToPath(new URL('../../../', import.meta.url)); // …/src/gameIso/stage/ → dépôt

/** Classe de MISE EN PAGE → la feuille qui la porte, et les rendeurs que le scan DOIT voir (prémisse). */
const MISES_EN_PAGE: readonly { classe: string; feuille: string; rendeurs: readonly string[] }[] = [
  { classe: 'iso-stage', feuille: 'src/gameIso/stage/iso-stage.css', rendeurs: ['src/gameIso/stage/GameStage3D.tsx', 'src/gameIso/SurcoucheIso.tsx'] },
  { classe: 'pastille-entite', feuille: 'src/gameIso/stage/pastille-entite.css', rendeurs: ['src/gameIso/stage/PastilleEntite.tsx'] },
  { classe: 'plaque-nom', feuille: 'src/gameIso/stage/plaque-nom.css', rendeurs: ['src/gameIso/stage/PlaquesDeNom.tsx'] },
];

function importeursDeFeuille(fichiers: readonly { fichier: string; src: string }[], feuille: string, existe?: (abs: string) => boolean): string[] {
  const cible = resolve(feuille).replace(/\\/g, '/');
  const cle = (fichier: string) => resolve(fichier).replace(/\\/g, '/');
  const uniques = new Map<string, { rel: string; text: string }>();
  for (const { fichier, src } of fichiers) {
    const text = sourceALExecution(fichier, src);
    const precedente = uniques.get(cle(fichier));
    if (precedente && precedente.text !== text) throw new Error(`importeursDeFeuille : textes différents pour le même chemin : ${fichier}`);
    uniques.set(cle(fichier), precedente ?? { rel: fichier, text });
  }
  const importeurs = new Set<string>();
  for (const { fichier, sourceFile, diagnostics } of analyserCorpus(uniques.values())) {
    if (arcsDe(fichier.rel, sourceFile!, { existe, diagnostics }).some((arc) => arc.nature === 'statique' && arc.cible === cible)) {
      importeurs.add(cle(fichier.rel));
    }
  }
  return fichiers.filter(({ fichier }) => importeurs.has(cle(fichier))).map(({ fichier }) => fichier);
}

export function importeFeuille(fichier: string, src: string, feuille: string, existe?: (abs: string) => boolean): boolean {
  return importeursDeFeuille([{ fichier, src }], feuille, existe).length > 0;
}

/** Les sources de `gameIso/`, hors tests — chemin DEPUIS `gameIso/`, la forme que porte le rapport. */
function sources(): { chemin: string; code: string }[] {
  return readCorpus([SOUS_GAMEISO]).map(({ rel, text }) => ({
    chemin: rel.slice(SOUS_GAMEISO.length),
    code: text,
  }));
}

/** Les classes du CSS qu'un source RÉCLAME — dans un `className`/`class` littéral ou un template. */
export function classesReclamees(src: string, connues: readonly string[]): string[] {
  const out = new Set<string>();
  for (const c of connues) {
    // La classe est réclamée si son nom apparaît dans une valeur de classe : littéral (`"proj"`,
    // `'fly crow'`) ou template (`` `es-${k}` ``). On exige une frontière de mot pour ne pas
    // confondre `.fly` avec `.flyover`.
    const valeur = `(?:["'\`{][^"'\`]*)?\\b${c}\\b`;
    const rx = new RegExp(
      `class(?:Name)?\\s*=\\s*${valeur}|classList\\.add\\([^)]*?["'\`]${c}["'\`]|setAttribute\\(\\s*["']class["']\\s*,\\s*${valeur}`,
    );
    if (rx.test(src)) out.add(c);
  }
  return [...out];
}

describe('keyframes du stage — la feuille est BRANCHÉE, et sur l’hôte du monde', () => {
  it('`anim.css` est importée par l’hôte du monde (jamais par une surcouche, qui se démonte)', () => {
    const hote = readFileSync(HOTE, 'utf8');
    expect(
      importeFeuille(HOTE, hote, join(GAMEISO, 'anim.css')),
      '`stage/MondeDeCampagne` n’importe plus `gameIso/anim.css` : toutes les animations du stage sont mortes',
    ).toBe(true);
  });

  it('AUCUN autre module ne l’importe : une feuille globale a UN propriétaire', () => {
    const importeurs = importeursDeFeuille(sources().map(({ chemin, code }) => ({ fichier: join(GAMEISO, chemin), src: code })), join(GAMEISO, 'anim.css'))
      .map((fichier) => fichier.slice(GAMEISO.length).replace(/\\/g, '/'));
    expect(importeurs, `deux propriétaires pour une même feuille :\n${importeurs.join('\n')}`)
      .toEqual(['stage/MondeDeCampagne.tsx']);
  });

  it.each(MISES_EN_PAGE)('mise en page $classe : sa feuille porte la règle, tout module de `src/` qui la rend l’importe', ({ classe, feuille, rendeurs: attendus }) => {
    const nomFeuille = feuille.slice(feuille.lastIndexOf('/') + 1);
    expect(
      new RegExp(`^\\.${classe}\\s*\\{`, 'm').test(readFileSync(join(RACINE, feuille), 'utf8')),
      `\`${feuille}\` ne porte plus la règle \`.${classe}\``,
    ).toBe(true);
    const rendeurs = readCorpus(['src/']).filter(({ text }) => classesReclamees(text, [classe]).length > 0);
    // PRÉMISSE — le scan MORD : les rendeurs connus rendent bien la classe.
    expect(rendeurs.map(({ rel }) => rel), `aucun rendeur de \`.${classe}\` : le scan ne voit rien`)
      .toEqual(expect.arrayContaining([...attendus]));
    const importeurs = new Set(importeursDeFeuille(rendeurs.map(({ rel, text }) => ({ fichier: join(RACINE, rel), src: text })), join(RACINE, feuille)));
    const sansFeuille = rendeurs.filter(({ rel }) => !importeurs.has(join(RACINE, rel))).map(({ rel }) => rel);
    expect(sansFeuille, `rendent \`.${classe}\` sans importer \`${nomFeuille}\` :\n${sansFeuille.join('\n')}`).toEqual([]);
  });

  it('un batch ouvre un seul snapshot, libère sa session et conserve ordre et occurrences des importeurs', () => {
    const snapshots = vi.spyOn(API.prototype, 'updateSnapshot');
    const fermetures = vi.spyOn(API.prototype, 'close');
    try {
      const premier = join(GAMEISO, 'stage/FixtureA.tsx');
      const second = join(GAMEISO, 'stage/FixtureB.tsx');
      const neutre = join(GAMEISO, 'stage/FixtureC.tsx');
      expect(importeursDeFeuille([
        { fichier: second, src: "import '../anim.css';" },
        { fichier: premier, src: "import '../anim.css';" },
        { fichier: neutre, src: "import './autre/anim.css';" },
        { fichier: second, src: "import '../anim.css';" },
      ], join(GAMEISO, 'anim.css'), () => true)).toEqual([second, premier, second]);
      expect(snapshots).toHaveBeenCalledTimes(1);
      expect(fermetures).toHaveBeenCalledTimes(1);
    } finally {
      snapshots.mockRestore();
      fermetures.mockRestore();
    }
  });

  it('un diagnostic syntaxique refuse le batch et libère la session native', () => {
    const fermetures = vi.spyOn(API.prototype, 'close');
    try {
      expect(() => importeursDeFeuille([
        { fichier: HOTE, src: "import '../anim.css';" },
        { fichier: join(GAMEISO, 'stage/FixtureInvalide.jsx'), src: "import '../anim.css'; const x = ;" },
      ], join(GAMEISO, 'anim.css'), () => true)).toThrow();
      expect(fermetures).toHaveBeenCalledTimes(1);
    } finally { fermetures.mockRestore(); }
  });

  it('fail-closed : le scanner voit une déclaration et une réclamation SYNTHÉTIQUES', () => {
    expect(classesReclamees('<g className="proj tourne" />', ['tourne'])).toEqual(['tourne']);
    expect(classesReclamees('<g className={`es-${k}`} />', ['es-mort'])).toEqual([]);
    expect(classesReclamees('<g className="tournevis" />', ['tourne'])).toEqual([]);
    const importe = (source: string) => importeFeuille(HOTE, source, join(GAMEISO, 'anim.css'), () => true);
    expect(importe("import '../anim.css';")).toBe(true);
    expect(importe("// import '../anim.css';")).toBe(false);
    expect(importe("/* * import '../anim.css'; */")).toBe(false);
    expect(importe("import type { A } from '../anim.css';")).toBe(false);
    expect(importe("const x = import('../anim.css');")).toBe(false);
    expect(importe("import './autre/anim.css';")).toBe(false);
    expect(classesReclamees('<svg className="iso-stage" />', ['iso-stage'])).toEqual(['iso-stage']);
    expect(classesReclamees("el.classList.add('muet', 'plaque-nom');", ['plaque-nom'])).toEqual(['plaque-nom']);
    expect(classesReclamees("el.setAttribute('class', 'plaque-nom halo-champ');", ['plaque-nom'])).toEqual(['plaque-nom']);
    expect(classesReclamees("el.setAttribute('data-x', 'plaque-nom');", ['plaque-nom'])).toEqual([]);
    expect(classesReclamees("el.classList.add('plaque-nommee');", ['plaque-nom'])).toEqual([]);
  });
});

import { ast, analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
/**
 * GARDE — aucune information de la CONSOLE ne vit dans un `title` (infobulle native).
 *
 * Grief mesuré par le juge vision (lot munitions, puis 2026-08-17 sur la console) : « la raison n'est
 * qu'en title ». Une infobulle native est invisible au tactile, invisible au clavier, absente de l'arbre
 * d'accessibilité en tant que contenu, illisible sur une capture — et elle a servi de dépotoir à de la
 * PROSE DE RÈGLE composée à la main, ce que les règles 5 & 6 du CLAUDE.md interdisent.
 *
 * Les TROIS véhicules autorisés, tous déjà canoniques dans le dépôt :
 *   - le texte à l'ÉCRAN (libellé d'alvéole, mot d'état de charge, note du coin) ;
 *   - le NOM ACCESSIBLE (`aria-label`) et la RAISON liée (`aria-describedby` → nœud visible), idiome de
 *     la primitive `GatedAction` (« un `title` seul reste invisible à l'arbre a11y ») ;
 *   - le popover `CodexRef` (mode `wrap`) qui rend le VERBATIM de la donnée et ouvre sa fiche.
 *
 * FORME de la garde : structurelle (parseur TypeScript, jamais un grep de texte) — on cherche l'ATTRIBUT
 * JSX `title` dans les fichiers de console possédés par le chantier. Toute exemption est NOMINATIVE et
 * porte le nœud visible qui rend la même information ; la liste est VIDE, et elle doit le rester.
 *
 * ANGLE MORT DÉCLARÉ : la garde ne juge que les fichiers listés ici, et que le JSX écrit dans ces
 * fichiers. Un `title` posé PAR une primitive composée (`PortraitTile` en rend un en propre) lui échappe —
 * c'est le périmètre de la primitive, pas celui de la console.
 */
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Fichiers gardés. La console du chantier HUD (spec §1c), plus la chaîne d'ASSIGNATION (roster par
 *  poste, 2026-09-04) : `PostesRoster` et sa case `AssignRow` composent des portraits et une
 *  affordance d'ajout dont le nom DOIT vivre dans l'arbre d'accessibilité. `ShipSheet` entre avec
 *  eux : il compose la même chaîne. Le nom d'une personne voyage par la prop `nom` de `CharFrame`,
 *  que `PortraitTile` pose en `aria-label` (angle mort déclaré ci-dessus : le `title` d'une
 *  PRIMITIVE reste son affaire). */
const CONSOLE_FILES = ['CombatConsole.tsx', 'PostesRoster.tsx', 'AssignRow.tsx', 'PortraitPicker.tsx', 'ShipSheet.tsx'];

/** Sites TOLÉRÉS : `fichier:ligne` → nœud visible qui porte DÉJÀ la même information. VIDE = la loi est
 *  tenue partout. N'ajouter une entrée qu'avec le nœud visible nommé, et la faire DÉCROÎTRE. */
const EXEMPTIONS: Record<string, string> = {};

const UI = join(process.cwd(), 'src', 'ui');

/** Attributs JSX `title` d'un fichier, en `ligne` — parseur réel : un `title:` de propriété d'objet ou
 *  une chaîne contenant « title » n'en est pas un, et un attribut réparti sur plusieurs lignes l'est. */
export function titleAttributes(src: string, file: string, sf = ast({ rel: file, text: src })!): { site: string; texte: string }[] {
  const out: { site: string; texte: string }[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isJsxAttribute(n) && ts.isIdentifier(n.name) && n.name.text === 'title') {
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      out.push({ site: `${file}:${line}`, texte: n.getText(sf).replace(/\s+/g, ' ').slice(0, 120) });
    }
    n.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/** Propriétés `title:` des littéraux de CASE : une case NOMME son geste et POINTE sa règle (champ
 *  `rule`), elle ne la raconte pas — un `title:` de littéral finit en attribut `title` au rendu. */
export function titleProperties(src: string, file: string, sf = ast({ rel: file, text: src })!): string[] {
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'title') {
      out.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
    }
    n.forEachChild(walk);
  };
  walk(sf);
  return out;
}

describe('console de combat & chaîne d’assignation — aucune information en `title` seul', () => {
  it('aucun attribut JSX `title` dans les fichiers gardés, hors exemption nominative', () => {
    const trouves: string[] = [];
    for (const { fichier: { rel: f, text }, sourceFile } of analyserCorpus(CONSOLE_FILES.map((rel) => ({ rel, text: readFileSync(join(UI, rel), 'utf8') })))) {
      for (const { site, texte } of titleAttributes(text, f, sourceFile!)) {
        if (!(site in EXEMPTIONS)) trouves.push(`${site} ${texte}`);
      }
    }
    expect(
      trouves,
      'Infobulle native dans la console : rendre l’information VISIBLE, la nommer en `aria-label`/`aria-describedby`, ou la confier au popover `CodexRef` (verbatim de la donnée).',
    ).toEqual([]);
  });

  it('aucune propriété `title` de littéral (une CASE nomme et pointe sa règle, elle ne la raconte pas)', () => {
    const trouves: string[] = [];
    for (const { fichier: { rel: f, text }, sourceFile } of analyserCorpus(CONSOLE_FILES.map((rel) => ({ rel, text: readFileSync(join(UI, rel), 'utf8') })))) trouves.push(...titleProperties(text, f, sourceFile!));
    expect(trouves, 'Un `title:` de littéral finit dans un attribut `title` : passer par `rule` (foyer Codex) ou `gate` (raison visible).').toEqual([]);
  });

  it('les exemptions déclarées sont RÉELLES (aucune entrée périmée) et la liste reste vide', () => {
    const sites = new Set([...analyserCorpus(CONSOLE_FILES.map((rel) => ({ rel, text: readFileSync(join(UI, rel), 'utf8') })))].flatMap(({ fichier: { rel: f, text }, sourceFile }) => titleAttributes(text, f, sourceFile!).map((t) => t.site)));
    for (const site of Object.keys(EXEMPTIONS)) {
      expect(sites.has(site), `exemption PÉRIMÉE : ${site} n’a plus de \`title\` — retirer la ligne`).toBe(true);
    }
    expect(Object.keys(EXEMPTIONS).length, 'le stock d’exemptions doit rester à zéro').toBe(0);
  });
});

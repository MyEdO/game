import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { emptyScene, type Scene, type SceneEntity } from '../../state/scene';
import { validateScene } from '../../state/validateScene';
import { siegeEmplacementEntity } from '../../state/siegeEmplacement';
import { changePropRef, deleteSel, moveSel, eraseAt, placeEntity } from './editorState';
import {
  editEntity,
  editEntityCombat,
  moveEntityTo,
  removeEntity,
  seatOccupant,
  setPosteCrew,
  setPosteSide,
  setPosteEngine,
} from '../../state/sceneEdit';

/**
 * INVARIANT DE SOCLE #2 — UN SEUL SEAM D'ASSISE.
 *
 * CE QUE CETTE GARDE MESURE, exactement, sur l'ARBRE SYNTAXIQUE (`typescript`, jamais une regex) :
 *
 *  1. `src/ui/**` (`.ts` + `.tsx`, tests exclus) : ZÉRO propriété `entities` posée dans un littéral
 *     d'objet, QUELLE QUE SOIT sa valeur. L'interface ne fabrique jamais la liste d'entités — même
 *     un ajout passe par une primitive d'état (`addEntity`). Une règle sans exception ne s'évade
 *     pas : la forme de l'écriture (variable intermédiaire, destructuration, clé entre guillemets,
 *     `splice` sur une copie, absence de `;`) ne change rien au FAIT qu'une propriété `entities`
 *     est posée.
 *  2. `src/state/sceneEdit.ts` : toute fonction EXPORTÉE (déclaration ou const fléchée) qui pose
 *     `entities` dans un littéral — ou qui appelle une écriture mécanique — traverse
 *     `normaliseAssises`, directement ou par fermeture d'appels ; sauf les écritures mécaniques
 *     elles-mêmes, nommées au cliquet `HORS_SEAM`.
 *  3. ORACLE COMPORTEMENTAL : chaque geste d'édition d'entité, appliqué à une scène HOSTILE, rend
 *     un document que `validateScene` accepte. L'oracle est le VALIDATEUR, pas une reformulation.
 *
 * ANGLE MORT RÉSIDUEL, mesuré et assumé : l'analyse est SYNTAXIQUE et intra-module. Elle ne voit
 * pas une liste d'entités posée SANS littéral d'objet (`scene.entities = liste`, écriture par
 * index, `structuredClone` retouché), ni une clé calculée qui n'est pas une chaîne littérale, ni
 * une primitive de `sceneEdit.ts` atteinte par un alias importé sous un autre nom : la fermeture
 * d'appels ne suit que les identifiants appelés PAR NOM dans le module analysé. Le filet de
 * dernier ressort de ces formes est le troisième test — un document invalide y échoue, quelle que
 * soit la route par laquelle il a été fabriqué.
 */
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SCENE_EDIT = 'src/state/sceneEdit.ts';
const CLE = 'entities';
const SEAM = 'normaliseAssises';

/** Écritures MÉCANIQUES : le seam les COMPOSE, elles ne peuvent pas le composer. */
const MECANIQUES = ['patchEntity', 'patchEntityCombat'];

const parse = (code: string, nom: string): ts.SourceFile =>
  ts.createSourceFile(nom, code, ts.ScriptTarget.Latest, true, /\.tsx$/.test(nom) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

function visiter(node: ts.Node, f: (n: ts.Node) => void): void {
  f(node);
  node.forEachChild((enfant) => visiter(enfant, f));
}

/** Nom de propriété RÉELLEMENT posé — identifiant, chaîne entre guillemets, ou clé calculée dont
 *  l'expression est une chaîne littérale. Rien d'autre ne nomme une propriété à coup sûr. */
function nomDeProp(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
  return null;
}

/** Les propriétés `entities` posées dans un littéral d'objet SOUS ce nœud, avec leur aperçu. Les
 *  commentaires et les chaînes n'en sont pas : l'AST ne les confond avec rien. Un `...spread` n'en
 *  est pas non plus — il recopie une scène, il ne fabrique pas la liste. */
function proprietesEntites(racine: ts.Node, sf: ts.SourceFile): string[] {
  const out: string[] = [];
  visiter(racine, (n) => {
    if (!ts.isObjectLiteralExpression(n)) return;
    for (const p of n.properties) {
      const cle = ts.isShorthandPropertyAssignment(p) ? p.name.text : p.name ? nomDeProp(p.name) : null;
      if (cle !== CLE) continue;
      out.push(`entities → ${p.getText(sf).replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  });
  return out;
}

/** Les identifiants APPELÉS sous ce nœud (fermeture d'appels par nom). */
function appelsDe(racine: ts.Node): Set<string> {
  const out = new Set<string>();
  visiter(racine, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) out.add(n.expression.text);
  });
  return out;
}

interface Fonction { node: ts.Node; exportee: boolean }

/** Les fonctions de PREMIER NIVEAU d'un module — déclarations ET const fléchées, exportées ou non
 *  (les non exportées portent la fermeture d'appels : une primitive publique peut passer par elles
 *  pour atteindre le seam). */
function fonctionsDuModule(rel: string): { sf: ts.SourceFile; fns: Map<string, Fonction> } {
  const sf = parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'), rel);
  const fns = new Map<string, Fonction>();
  const exporte = (n: ts.Node): boolean =>
    ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) fns.set(st.name.text, { node: st, exportee: exporte(st) });
    else if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.initializer) fns.set(d.name.text, { node: d, exportee: exporte(st) });
  }
  return { sf, fns };
}

/** Écrit-elle une entité ? Elle pose `entities` dans un littéral, OU elle appelle une écriture
 *  mécanique — une seule définition, partagée par les deux balayages. */
function ecritUneEntite(fn: Fonction, sf: ts.SourceFile): string[] {
  const appels = appelsDe(fn.node);
  return [...proprietesEntites(fn.node, sf), ...MECANIQUES.filter((m) => appels.has(m)).map((m) => `${m}()`)];
}

/** Traverse-t-elle le seam ? Directement, ou par une fonction du module qui le fait. */
function traverseLeSeam(fns: Map<string, Fonction>, nom: string, vus = new Set<string>()): boolean {
  if (vus.has(nom)) return false;
  vus.add(nom);
  const fn = fns.get(nom);
  if (!fn) return false;
  const appels = appelsDe(fn.node);
  if (appels.has(SEAM)) return true;
  for (const autre of appels) if (fns.has(autre) && traverseLeSeam(fns, autre, vus)) return true;
  return false;
}

/**
 * CLIQUET NOMMÉ — les écrivains d'entité qui NE traversent PAS le seam. Chacun porte sa raison ; la
 * liste ne peut que décroître, et un écrivain nouveau y échoue tant qu'il n'est pas classé.
 */
const HORS_SEAM: Record<string, string> = {
  patchEntity: 'écriture mécanique — le seam la compose (editEntity), elle ne peut pas le composer',
  patchEntityCombat: 'écriture mécanique — le seam la compose (editEntityCombat)',
};

describe('INVARIANT #2 — un seul seam d’assise pour toute mutation d’entité', () => {
  it('toute primitive exportée de `sceneEdit` qui écrit une entité traverse `normaliseAssises`', () => {
    const { sf, fns } = fonctionsDuModule(SCENE_EDIT);
    const manquantes: string[] = [];
    for (const [nom, fn] of fns) {
      if (!fn.exportee || HORS_SEAM[nom] || !ecritUneEntite(fn, sf).length) continue;
      if (!traverseLeSeam(fns, nom)) manquantes.push(`${SCENE_EDIT} :: ${nom}`);
    }
    expect(manquantes, `écrivain(s) d’entité hors seam :\n${manquantes.join('\n')}`).toEqual([]);
  });

  it('le balayage n’est PAS vacant — il voit les écrivains réels du module', () => {
    const { sf, fns } = fonctionsDuModule(SCENE_EDIT);
    const vus = [...fns].filter(([, fn]) => ecritUneEntite(fn, sf).length).map(([nom]) => nom);
    for (const attendu of ['patchEntity', 'patchEntityCombat', 'addEntity', 'editEntity', 'editEntityCombat', 'moveEntityTo', 'removeEntity'])
      expect(vus, `${attendu} devrait être vu comme écrivain d’entité`).toContain(attendu);
  });

  it('le cliquet ne porte aucune entrée PÉRIMÉE (primitive disparue ou rentrée dans le rang)', () => {
    const { sf, fns } = fonctionsDuModule(SCENE_EDIT);
    for (const nom of Object.keys(HORS_SEAM)) {
      const fn = fns.get(nom);
      expect(fn, `${nom} n’existe plus — retire-le de HORS_SEAM`).toBeDefined();
      expect(ecritUneEntite(fn!, sf).length, `${nom} n’écrit plus d’entité — retire-le de HORS_SEAM`).toBeGreaterThan(0);
    }
  });

  it('aucun fichier de `src/ui/**` ne pose la propriété `entities` dans un littéral', () => {
    // L'interface APPELLE les primitives d'état, elle ne fabrique jamais la liste d'entités —
    // `onChange` de composant compris. AUCUNE exemption : l'ajout depuis la palette (`placeEntity`)
    // passe lui aussi par `addEntity`. Le balayage couvre `.ts` ET `.tsx` — un module utilitaire de
    // `src/ui/**` n'est pas moins une porte qu'un composant.
    const fautifs: string[] = [];
    for (const { rel, text } of readCorpus(['src/ui'])) {
      const sf = parse(text, rel);
      for (const motif of proprietesEntites(sf, sf)) fautifs.push(`${rel} :: ${motif}`);
    }
    expect(fautifs, `écriture d’entité en direct depuis l’interface :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('l’analyseur voit les ONZE formes mesurées du défaut, et laisse passer ce qui ne pose rien', () => {
    // H1..H5 : formes qui ont PASSÉ une version antérieure de cette garde (analyseur de FORME).
    // E1..E6 : évasions mesurées CONTRE cette version-là (sonde `probe-garde.mjs`, round 3).
    const ATTRAPE: readonly (readonly [string, string])[] = [
      ['H1 retrait déguisé en ajout', 'const vire = (s, id) => ({ ...s, entities: [...s.entities.filter((e) => e.id !== id)] });'],
      ['H2 chaînage multi-ligne', 'const t = (scene) => ({ ...scene, entities: scene.entities\n  .map((e) => ({ ...e })) });'],
      ['H3 verbe slice/sort', 'const tri = (s) => ({ ...s, entities: s.entities.slice().sort((a, b) => a.id < b.id ? -1 : 1) });'],
      ['H4 map en UNE ligne', 'setScene({ ...s, entities: s.entities.map((e) => e) });'],
      ['H5 via une VARIABLE', 'const suivantes = scene.entities.map((e) => e);\nsetScene({ ...s, entities: suivantes });'],
      ['E1 renommage en deux temps', 'let liste = scene.entities;\nliste = liste.filter((e) => e.id !== id);\nsetScene({ ...s, entities: liste });'],
      ['E2 destructuration', 'const { entities } = scene;\nsetScene({ ...s, entities: entities.filter((e) => e.id !== id) });'],
      ['E3 spread d’une variable', 'const restants = scene.entities.filter((e) => e.id !== id);\nsetScene({ ...s, entities: [...restants] });'],
      ['E4 clé entre guillemets', "setScene({ ...s, 'entities': s.entities.filter((e) => e.id !== id) });"],
      ['E5 copie + splice', 'const cp = [...scene.entities];\ncp.splice(i, 1);\nsetScene({ ...s, entities: cp });'],
      ['E6 valeur sans ponctuation finale', 'f({ ...s, entities: s.entities.filter(g) })'],
    ];
    const analyse = (code: string) => {
      const sf = parse(code, 'sonde.tsx');
      return proprietesEntites(sf, sf);
    };
    for (const [nom, code] of ATTRAPE) expect(analyse(code).length, nom).toBeGreaterThan(0);
    // La forme ABRÉGÉE pose la propriété tout autant ; une clé CALCULÉE non littérale est hors de
    // portée d'une analyse syntaxique, et c'est l'angle mort déclaré en tête.
    expect(analyse('const entities = f();\nsetScene({ ...s, entities });').length, 'abrégé').toBeGreaterThan(0);
    expect(analyse('setScene({ ...s, ["enti" + "ties"]: liste });').length, 'clé calculée — angle mort déclaré').toBe(0);

    // NEG — ce qui ne POSE aucune propriété : lire pour afficher, citer en commentaire, citer dans
    // une chaîne, recevoir en paramètre. L'ajout pur (`entities: [...scene.entities, ent]`) n'est
    // PLUS un témoin vert : depuis ce round, l'interface ne fabrique pas la liste, même pour ajouter.
    expect(analyse('const pnjs = scene.entities.filter((e) => e.kind === 1);'), 'NEG-A lecture').toEqual([]);
    expect(analyse('// jamais entities: scene.entities.map((e) => e) ici'), 'NEG-C commentaire').toEqual([]);
    expect(analyse('const aide = "entities: s.entities.map(e => e)";'), 'NEG-D chaîne').toEqual([]);
    expect(analyse('function f({ entities }) { return entities.length; }'), 'NEG-E paramètre destructuré').toEqual([]);
  });

  /**
   * ORACLE COMPORTEMENTAL — chaque primitive d'édition d'entité, appliquée à une scène HOSTILE
   * (meuble attablé + recoin cerné de murs), rend un document que `validateScene` accepte.
   */
  describe('aucune primitive ne rend un document que `validateScene` refuse', () => {
    /** L'entité d'un emplacement de siège, ou un ÉCHEC NOMMÉ : `siegeEmplacementEntity` rend `null`
     *  quand l'engin n'a pas d'art d'affût (`siegeRig`), et une fixture muette sur ce `null` mourrait
     *  plus loin, sur une propriété absente, sans dire ce qui manque. */
    function affutDeFixture(id: string, trappingId: string, pos: { x: number; y: number }): SceneEntity {
      const ent = siegeEmplacementEntity(id, trappingId, pos);
      if (!ent) throw new Error(`fixture : « ${trappingId} » n’est pas un engin posable (pas d’art d’affût au catalogue) — la scène hostile ne peut pas porter d’affût.`);
      return ent;
    }

    /** Table ronde attablée en (2,2) ; colonne x≥6 murée, avec un recoin d'UNE case en (7,7). */
    function hostile(): Scene {
      const s = emptyScene(10, 10);
      const tiles: string[] = new Array(100).fill('plancher');
      for (let y = 0; y < 10; y++) for (let x = 6; x < 10; x++) tiles[y * 10 + x] = 'mur';
      tiles[7 * 10 + 7] = 'plancher';
      s.layers = [{ z: 0, tiles: tiles as Scene['layers'][number]['tiles'] }];
      s.entities = [
        { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'table-ronde-4-tabourets', facing: 'N' },
        { id: 'pnj-1', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 1 } },
        // L'affût sort du BUILDER de production (`siegeEmplacementEntity`), jamais d'un littéral :
        // une fixture qui invente sa forme n'atteste rien de ce que l'éditeur pose. Le builder rend
        // `null` si l'engin n'a pas d'art d'affût — la fixture le DIT, au lieu de mourir plus loin.
        affutDeFixture('affut-1', 'canon-petit', { x: 4, y: 4 }),
      ];
      s.seatAssignments = { 'table-1': { 'place-1': { kind: 'entity', entityId: 'pnj-1' } } };
      return s;
    }
    const HORS_PARTIE = 0; // l'éditeur n'a pas de groupe : les emplacements ne tiennent personne
    const erreurs = (s: Scene) => validateScene([s]).filter((w) => w.level === 'error').map((w) => w.message);

    const GESTES: Record<string, (s: Scene) => Scene> = {
      'moveSel — pousse le MEUBLE dans le recoin cerné': (s) => moveSel(s, { type: 'entity', id: 'table-1' }, { x: 7, y: 7 }),
      'moveSel — arrache le CORPS de son abord': (s) => moveSel(s, { type: 'entity', id: 'pnj-1' }, { x: 5, y: 9 }),
      'moveEntityTo — pousse le MEUBLE dans le recoin cerné': (s) => moveEntityTo(s, 'table-1', { x: 7, y: 7 }),
      'deleteSel — retire le meuble': (s) => deleteSel(s, { type: 'entity', id: 'table-1' }),
      'deleteSel — retire le corps': (s) => deleteSel(s, { type: 'entity', id: 'pnj-1' }),
      'removeEntity — retire le meuble': (s) => removeEntity(s, 'table-1'),
      'eraseAt — gomme le meuble': (s) => eraseAt(s, { x: 2, y: 2 }),
      'placeEntity — pose un décor neuf sur l’abord de la place': (s) => placeEntity(s, { mode: 'entity', kind: 'prop', ref: 'tonneau' }, { x: 2, y: 1 }).scene,
      'changePropRef — le nouveau type n’offre plus de place': (s) => changePropRef(s, 'table-1', 'tonneau'),
      // Cap CARDINAL : le seul qu'un décor VOLUMIQUE accepte (#1680 ligne 3). Le cas diagonal est
      // sous contrat juste après cette table — il n'a rien à faire ici, où la règle est « 0 erreur ».
      'editEntity — TOURNE le meuble': (s) => editEntity(s, 'table-1', { facing: 'E' }),
      'editEntity — MONTE le meuble d’un étage': (s) => editEntity(s, 'table-1', { z: 1 }),
      'editEntity — renomme le corps': (s) => editEntity(s, 'pnj-1', { label: 'Aubergiste' }),
      'editEntityCombat — cache le corps jusqu’au combat': (s) => editEntityCombat(s, 'pnj-1', { hiddenUntilCombat: true }),
      'setPosteCrew — arme l’affût': (s) => setPosteCrew(s, 'affut-1', ['pnj-1']),
      'setPosteSide — pose l’arc de tir': (s) => setPosteSide(s, 'affut-1', 'babord'),
      'setPosteEngine — change l’engin': (s) => setPosteEngine(s, 'affut-1', 'canon-petit'),
      'seatOccupant — rassoit le corps': (s) => seatOccupant(s, 'table-1', 'place-2', { kind: 'entity', entityId: 'pnj-1' }, HORS_PARTIE).scene,
    };

    // Sans cela, un « 0 erreur » ne prouverait rien : la scène de départ doit déjà être valide.
    it('la scène hostile de départ est un document VALIDE', () => {
      expect(erreurs(hostile())).toEqual([]);
    });

    for (const [nom, geste] of Object.entries(GESTES)) {
      it(nom, () => {
        expect(erreurs(geste(hostile()))).toEqual([]);
      });
    }

    /**
     * CAP D'UN DÉCOR VOLUMIQUE (#1680 ligne 3) — les deux versants du contrat neuf, sur le MÊME geste.
     * `editEntity` est une porte de PATCH générique : elle n'a pas de canal de refus et ne juge pas le
     * contenu. Ce qui refuse la diagonale, c'est (1) le SCHÉMA de scène au chargement
     * (`schemas/defs-scenes/scene.ts`, `superRefine` sur les ids de props à recette) et (2) l'ÉDITEUR,
     * dont le sélecteur d'orientation n'offre que les quatre cardinaux sur un ref volumique
     * (`Inspector.tsx`) ; `validateScene` le NOMME, et `buildPropVolumes` le refuse au type. Ce test
     * tient la chaîne : cardinal = document propre, diagonal = erreur nommée, jamais un silence.
     */
    it('editEntity — cap CARDINAL : document propre ; cap DIAGONAL : erreur NOMMÉE (le seam ne le tait pas)', () => {
      expect(erreurs(editEntity(hostile(), 'table-1', { facing: 'E' }))).toEqual([]);
      expect(erreurs(editEntity(hostile(), 'table-1', { facing: 'SE' }))).toEqual([
        "table-1 : décor volumique « table-ronde-4-tabourets » au cap SE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
      ]);
      // Un BILLBOARD au même cap reste licite : la règle est celle du catalogue, pas du `kind`.
      const avecBillboard = hostile();
      avecBillboard.entities = [...avecBillboard.entities, { id: 'brasero-1', kind: 'prop', pos: { x: 5, y: 5 }, ref: 'brasero' }];
      expect(erreurs(editEntity(avecBillboard, 'brasero-1', { facing: 'SE' }))).toEqual([]);
    });
  });
});

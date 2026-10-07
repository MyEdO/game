import { API, SymbolFlags } from 'typescript/unstable/sync';
import { ast } from '../../../scripts/guards/lib/dialecte.mjs';
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as ts from 'typescript/unstable/ast';
import {
  auditSceneFieldEditability,
  orphanFields,
  sceneScope,
  programmeDuPerimetre,
} from '../../../scripts/guards/lib/sceneFieldEditability.mjs';
import { repoProgram, virtualProgram, VIRTUAL_ROOT } from '../../../scripts/guards/lib/tsProgram.mjs';
import { detenteur } from '../../detenteur.testkit';

/**
 * GARDE #841 — « toute donnée de la scène s'édite au clic, sans dépendre d'une IA » (directive
 * utilisateur du 2026-07-26, verbatim : « Assure toi toujours qu'on doit pouvoir éditer toutes les
 * données de la scene, on ne doit pas dépendre d'une IA »).
 *
 * Le défaut que cette garde ferme n'est pas une liste de 22 champs — c'est la CLASSE : un champ peut
 * naître au modèle, être lu par le moteur, et n'avoir pour seul écrivain le compilateur d'authoring
 * (`mapSpec.ts`) ou un script. Rien ne casse ; l'auteur découvre le trou en cherchant le contrôle qui
 * n'existe pas.
 *
 * Deux propriétés font que cette garde MESURE quelque chose, et elles sont éprouvées ici :
 *  - le périmètre se DÉRIVE du type `Scene` par le TypeChecker (types imbriqués, unions, littéraux
 *    anonymes, `Record<K,V>` compris) — aucune liste de types tenue à la main ;
 *  - le crédit d'écriture est RATTACHÉ AU TYPE porteur : un `{ once: … }` de symptôme de maladie ou
 *    un `{ flags }` passé en lecture à un contexte d'évaluation ne crédite aucun champ de `Scene`.
 *
 * ANGLE MORT DÉCLARÉ — les répliques virtuelles (`forme({ … })`) éprouvent le NOMMAGE du porteur
 * anonyme, l'inclusion par IDENTITÉ et la coupe aux nœuds-frontière, pas la POSITION réelle du
 * symbole rendu par `z.infer` (`zod/v4/core/util.d.cts`) : ce chemin-là n'est couvert que par la
 * mesure sur le programme RÉEL (cliquet de compte + la mesure du SEAM, qui bâtit le programme du
 * DOCUMENT avec un module modifié EN MÉMOIRE).
 */
const ROOT = path.resolve(__dirname, '..', '..', '..');

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

/**
 * CLIQUET DÉCROISSANT — les champs du document de scène qu'AUCUN contrôle d'interface n'écrit
 * aujourd'hui. La liste NOMME chaque trou (jamais une exemption par forme de fichier, de type ou de
 * nom) et l'assertion est une ÉGALITÉ : un trou nouveau échoue, un trou comblé échoue aussi tant que
 * la ligne n'est pas retirée. Elle ne peut donc que décroître.
 */
const TROUS_CONNUS: string[] = [];

describe('#841 — chaque champ du document de scène a un chemin d’écriture ATTEIGNABLE PAR L’AUTEUR', () => {
  it('une session possédée conserve l’erreur d’analyse et celle de fermeture', () => {
    const root = fs.mkdtempSync(path.join(tmpdir(), 'ts7-scene-fermeture-'));
    fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}');
    const fermeture = new Error('fermeture cache');
    const cache = vi.spyOn(API.prototype, 'clearSourceFileCache').mockImplementation(() => { throw fermeture; });
    const close = vi.spyOn(API.prototype, 'close');
    try {
      let erreur: unknown;
      try { auditSceneFieldEditability(root); } catch (e) { erreur = e; }
      expect(erreur).toBeInstanceOf(Error);
      if (!(erreur instanceof Error)) throw erreur;
      expect(erreur.name).toBe('AggregateError');
      const erreurs = Reflect.get(erreur, 'errors');
      expect(erreurs).toHaveLength(2);
      expect(erreurs[0].message).toBe('src/state/scene.ts absent du programme');
      expect(erreurs[1]).toBe(fermeture);
      expect(Reflect.get(erreur, 'cause')).toBe(erreurs[0]);
      expect(close).toHaveBeenCalledTimes(1);
    } finally { cache.mockRestore(); close.mockRestore(); fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('une session empruntée reste ouverte après une erreur d’analyse', () => {
    const session = virtualProgram({});
    const close = vi.spyOn(API.prototype, 'close');
    try {
      expect(() => auditSceneFieldEditability(VIRTUAL_ROOT, session)).toThrow('src/state/scene.ts absent du programme');
      expect(close).not.toHaveBeenCalled();
    } finally { close.mockRestore(); session.dispose(); }
  });
  // scripts/guards/lib/tsProgram.mjs ; src/analyse-retention-guard.test.ts
  const perimetre = detenteur(() => programmeDuPerimetre(ROOT), (session) => session.dispose());

  it('aucun champ n’est joignable seulement par le pipeline d’authoring, hors cliquet nommé', { timeout: 240_000 }, () => {
    const orphelins = orphanFields(auditSceneFieldEditability(ROOT, perimetre()));
    // Rendu en TEXTE : l'échec doit NOMMER les champs et leur `fichier:ligne`, pas afficher « …(9) ».
    const detail = orphelins
      .map((r) => `${r.id} (${r.at}) — écrivains : ${r.pipeline.join(', ') || 'AUCUN'}`)
      .join('\n');
    expect(ids(orphelins).sort(), detail).toEqual([...TROUS_CONNUS].sort());
  });

  it('crédite une écriture qui traverse `Array.map` — sonde réelle : `SceneEffectZone.tiles` ← `mapSpec.ts`', { timeout: 120_000 }, () => {
    // Un littéral rendu par un callback de `map` perd sa freshness : `getContextualType` ne le
    // rattache à rien, et `tsc` lui-même ne signale pas la suppression du champ écrit. Un champ
    // vivant y était donc rapporté « écrivains : AUCUN » — un faux négatif qui invite à supprimer du
    // code vivant. `src/state/mapSpec.ts:902` (`const namedZones: SceneEffectZone[] = […].map(…)`)
    // est la sonde : l'annotation de la collection porte le type, la garde doit la lire.
    const rows = auditSceneFieldEditability(ROOT, perimetre());
    const zone = (field: string) => rows.find((r) => r.id === `SceneEffectZone.${field}`);
    for (const field of ['tiles', 'area', 'id', 'label', 'z']) {
      expect(zone(field)?.pipeline, `SceneEffectZone.${field} sans écrivain de pipeline`).toContain(
        'src/state/mapSpec.ts'
      );
    }
    // Le littéral IMBRIQUÉ dans ce même retour de callback est crédité aussi — mais seulement sur le
    // membre d'union réellement écrit (`kind: 'rect'`), jamais sur `disc`.
    expect(zone('area.w')?.pipeline).toContain('src/state/mapSpec.ts');
    expect(zone('area.radius')?.pipeline).not.toContain('src/state/mapSpec.ts');
  });

  it('NON VACANTE (c) : à travers `Array.map`, seule l’annotation de la COLLECTION crédite — pas un homonyme', () => {
    const program = virtualProgram({
      'src/state/scene.ts': `export interface SceneEffectZone { id: string; tiles: number[] }
export interface Scene { id: string; effectZones: SceneEffectZone[]; layers: SceneEffectZone[] }\n`,
      // (a) annotation de collection, (b) type de retour annoté, (c) `push` dans un tableau annoté,
      // (d) `map` imbriqué — les quatre formes réelles du dépôt.
      'src/ui/Zonage.ts': `import type { Scene, SceneEffectZone } from '../state/scene';
declare const blocs: { key: string; cells: number[]; sous: { key: string; cells: number[] }[] }[];
declare function setScene(s: Scene): void;

export const zoner = (s: Scene): Scene => {
  const zones: SceneEffectZone[] = blocs.map((b) => ({ id: b.key, tiles: b.cells }));
  setScene({ ...s, effectZones: zones });
  return s;
};

function calques(): SceneEffectZone[][] {
  return blocs.map((b) => b.sous.map((c) => ({ id: c.key, tiles: c.cells })));
}

export const empiler = (s: Scene): Scene => {
  const layers: SceneEffectZone[] = [];
  for (const groupe of calques()) layers.push(...groupe);
  layers.push({ id: 'socle', tiles: [] });
  return { ...s, layers, id: s.id };
};\n`,
      // Même forme de littéral, même dossier, même `Array.map` — mais l'annotation désigne un type
      // ÉTRANGER qui partage `id` et `tiles`. Aucun crédit ne doit lui être attribué.
      'src/ui/Calque.ts': `interface RegionDeCalque { id: string; tiles: number[] }
declare const blocs: { key: string; cells: number[] }[];
declare function tracer(regions: RegionDeCalque[]): void;
export const tracerCalque = () => {
  const regions: RegionDeCalque[] = blocs.map((b) => ({ id: b.key, tiles: b.cells }));
  tracer(regions);
};\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(ids(orphanFields(rows))).toEqual([]);
      for (const id of ['SceneEffectZone.id', 'SceneEffectZone.tiles']) {
        expect(rows.find((r) => r.id === id)?.authors, id).toEqual(['src/ui/Zonage.ts']);
      }

    } finally { program.dispose(); }
  });

  it('le périmètre se dérive du type `Scene` — types imbriqués, unions et littéraux anonymes compris', () => {
    const scope = sceneScope(perimetre(), ROOT);
    const all = new Set(ids(scope));
    // Champs qu'un scanner limité aux interfaces atteignables « à la main » manque : ils vivent dans
    // des types que seule la traversée du type `Scene` ramène.
    for (const id of [
      'Scene.dimensions.w', // littéral anonyme d'une propriété
      'Scene.entryPoints.x', // valeur d'un Record<K,V>
      'Dialogue.nodes',
      'DialogueNode.choices',
      // Feuille PARTAGÉE d'un AUTRE module (`grammaire/valeurs.ts`, `moneyPartialSchema`) que le document
      // COMPOSE : elle n'entre que par l'inclusion par IDENTITÉ — une frontière posée sur le MODULE
      // perdait les 3 champs de coût d'un choix de dialogue (239 → 236, cf. le test d'identité).
      'MoneyPartial.gold',
      // `Rect` est déclaré DANS le document (`defs-scenes/scene.ts:24`) : il ne doit rien à l'inclusion
      // par identité — `Trigger.rect.*` → `Rect.*` relève du NOMMAGE du porteur rendu par `z.infer`.
      'Rect.z',
      'EncounterDef.victoryCondition',
      'EncounterMember.ridesEntityId',
      'WallClimb.requiresGrimpeur',
      'FacadeFeature.edge',
      'RoofDefaults.pitchDeg',
      'SceneEffectZone.area.radius', // membre `disc` de l'union ZoneArea
      'EncounterDef.victoryCondition.belowPercent', // membre de l'union VictoryCondition
      'ArchitectureEdgeRef.side', // type RÉUTILISÉ par `victoryCondition.edge` — cf. cliquet ci-dessous
      'ArchitectureEdgeRef.z',
    ]) {
      expect(all, `${id} hors du périmètre dérivé`).toContain(id);
    }
    // CLIQUET DE COMPTE — le mode de panne à fermer est l'EFFONDREMENT SILENCIEUX du périmètre :
    // 243 champs → 102 sans un seul rouge (mesure #1466 T3-b q24, la frontière par TYPE lâchant sur
    // tout corps passé en `z.infer`). Aucune refonte de frontière ne ferme ce mode seule.
    // 239 = mesure du 2026-08-25 (243 de l'étalon, moins les 4 `victoryCondition.edge.*` remappés sur
    // `ArchitectureEdgeRef.*` par la réutilisation du type — la liste positive ci-dessus les couvre).
    expect(scope.length, 'périmètre effondré').toBeGreaterThanOrEqual(239);
  });

  it('le périmètre inclut par IDENTITÉ — une feuille d’un AUTRE module composée par le document y entre, un nœud-frontière n’y entre pas', () => {
    // Réplique STRUCTURELLE du seam réel (`sceneSchema` compose `moneyPartialSchema`, feuille de
    // `grammaire/valeurs.ts`, et `conditionSchema`, vocabulaire partagé de `grammaire/`) : le schéma
    // composant vit dans un AUTRE module. La marche part de `sceneSchema` et suit les IDENTITÉS ;
    // elle s'arrête au nœud-frontière.
    const program = virtualProgram({
      'src/data/schemas/grammaire/mecanique.ts': `declare function forme<T>(shape: T): { readonly sortie: T };
export const conditionSchema = forme({ flag: '' });\n`,
      'src/data/schemas/defs-scenes/communs.ts': `declare function forme<T>(shape: T): { readonly sortie: T };
export const moneySchema = forme({ gold: 0 });\n`,
      'src/data/schemas/defs-scenes/scene.ts': `import { moneySchema } from './communs';
import { conditionSchema } from '../grammaire/mecanique';
declare function forme<T>(shape: T): { readonly sortie: T };
export const sceneSchema = forme({ id: '', cost: moneySchema.sortie, when: conditionSchema.sortie });\n`,
      'src/state/scene.ts': `import type { sceneSchema } from '../data/schemas/defs-scenes/scene';
export type Scene = (typeof sceneSchema)['sortie'];\n`,
    });
    try {
      const all = ids(sceneScope(program, VIRTUAL_ROOT));
      expect(all, 'les champs déclarés par le shape du document').toEqual(
        expect.arrayContaining(['Scene.id', 'Scene.cost', 'Scene.when'])
      );
      expect(all, 'la feuille d’un AUTRE module, composée par le document, entre par IDENTITÉ').toContain(
        'Money.gold'
      );
      expect(all, 'le nœud-frontière reste du vocabulaire partagé').not.toContain('Condition.flag');

    } finally { program.dispose(); }
  });

  it('la frontière porte sur la DÉCLARATION DE PROPRIÉTÉ — un corps inféré d’un schéma est dans le périmètre et se NOMME de son schéma, le vocabulaire partagé n’y est pas', () => {
    // Reproduit STRUCTURELLEMENT ce que `z.infer` fait au TypeChecker : le type porteur est anonyme
    // (son symbole ne vient pas du module du document), mais chaque propriété est déclarée par le
    // `PropertyAssignment` du shape. Le porteur se nomme du `export const xSchema` englobant.
    const program = virtualProgram({
      'src/engine/vocabulaire.ts': `export interface Vocabulaire { mot: string }\n`,
      'src/state/scene.ts': `import type { Vocabulaire } from '../engine/vocabulaire';
declare function forme<T>(shape: T): { readonly sortie: T };
export const murSchema = forme({
  x: 0,
});
export interface Scene { id: string; walls: (typeof murSchema)['sortie'][]; voc: Vocabulaire }\n`,
    });
    try {
      const all = ids(sceneScope(program, VIRTUAL_ROOT));
      expect(all, 'le corps inféré du schéma est dans le périmètre et porte le nom du schéma').toContain(
        'Mur.x'
      );
      expect(all, 'le vocabulaire partagé reste hors périmètre').not.toContain('Vocabulaire.mot');

    } finally { program.dispose(); }
  });

  it('l’inclusion par IDENTITÉ est LOAD-BEARING sur le programme RÉEL — la frontière par MODULE perd des champs NOMMÉS', () => {
    // Rabattre `declaredInScene` sur les deux FICHIERS du document fait 239 → 236 (mutation mesurée).
    // Les 3 champs perdus sont nommés ici : ce sont les seuls du périmètre déclarés hors du document.
    const DOC = ['src/state/scene.ts', 'src/data/schemas/defs-scenes/scene.ts'];
    const fichier = (r: { decl: ts.Declaration }) =>
      path.relative(ROOT, r.decl.getSourceFile().fileName).split(path.sep).join('/');
    const scope: { id: string; decl: ts.Declaration }[] = sceneScope(perimetre(), ROOT);
    const horsDocument = scope.filter((r) => !DOC.includes(fichier(r)));
    expect(
      horsDocument.map((r) => `${r.id} @ ${fichier(r)}`).sort(),
      'ce que la frontière par MODULE perdrait'
    ).toEqual([
      'MoneyPartial.brass @ src/data/schemas/grammaire/valeurs.ts',
      'MoneyPartial.gold @ src/data/schemas/grammaire/valeurs.ts',
      'MoneyPartial.silver @ src/data/schemas/grammaire/valeurs.ts',
    ]);
    // Contre-témoin : `Rect` ne doit RIEN à l'inclusion par identité — il est déclaré DANS le document,
    // son renommage `Trigger.rect.*` → `Rect.*` vient du NOMMAGE du porteur rendu par `z.infer`.
    expect(fichier(scope.find((r) => r.id === 'Rect.z')!)).toBe('src/data/schemas/defs-scenes/scene.ts');
  });

  /**
   * RECENSEMENT des types exportés par `state/scene.ts`, confronté à ce que `docs/architecture.md`
   * AFFIRME. Le mode de panne fermé ici est celui qu'a trouvé l'audit de fermeture L1a (#1466) : le doc
   * a continué d'annoncer « les 32 autres types restent MANUSCRITS » après la bascule de 22 d'entre eux
   * en `z.infer` (ba123074e) — une référence vivante qui ment, qu'aucun rouge ne signalait. Le doc est
   * donc LU, ses trois affirmations (total, `z.infer`, liste NOMINATIVE des manuscrits) sont comparées à
   * la mesure AST : un type qui bascule sans que le doc suive est rouge, et l'inverse aussi.
   */
  const censusScene = () => {
    const sf = ast({ rel: 'scene.ts', text: fs.readFileSync(path.resolve(ROOT, 'src/state/scene.ts'), 'utf8') })!;
    const exporte = (st: ts.Statement) =>
      ('modifierFlags' in st) && typeof st.modifierFlags === 'number' && !!(st.modifierFlags & ts.ModifierFlags.Export);
    const estInfer = (t: ts.TypeNode) =>
      ts.isTypeReferenceNode(t) && t.typeName.getText(sf) === 'z.infer';
    const out = { infer: [] as string[], compose: [] as string[], manuscrits: [] as string[], reexports: [] as string[] };
    for (const st of sf.statements) {
      if (ts.isTypeAliasDeclaration(st) && exporte(st)) {
        const nom = st.name.text;
        if (estInfer(st.type)) out.infer.push(nom);
        else if (ts.isUnionTypeNode(st.type) && st.type.types.some(estInfer)) out.compose.push(nom);
        else out.manuscrits.push(nom);
      } else if (ts.isInterfaceDeclaration(st) && exporte(st)) out.manuscrits.push(st.name.text);
      else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause))
        for (const e of st.exportClause.elements) out.reexports.push(e.name.text);
    }
    return out;
  };

  it('`docs/architecture.md` DIT la vérité sur les types de `state/scene.ts` (total, `z.infer`, manuscrits NOMMÉS)', () => {
    const doc = fs.readFileSync(path.resolve(ROOT, 'docs/architecture.md'), 'utf8');
    const bloc = /\n {2}scene\.ts {2}([\s\S]*?)\n {2}worldMap\.ts/.exec(doc)?.[1];
    expect(bloc, 'bloc `scene.ts` introuvable dans docs/architecture.md').toBeTruthy();
    const plat = bloc!.replace(/\s+/g, ' ');
    const nombre = (re: RegExp, quoi: string) => {
      const m = re.exec(plat);
      expect(m, `le doc n’affirme plus ${quoi}`).toBeTruthy();
      return Number(m![1]);
    };
    const c = censusScene();
    const total = c.infer.length + c.compose.length + c.manuscrits.length + c.reexports.length;
    expect(nombre(/(\d+) types exportés/, 'un total de types'), 'total annoncé ≠ mesure AST').toBe(total);
    expect(nombre(/dont (\d+) `z\.infer`/, 'un compte de `z.infer`'), '`z.infer` annoncés ≠ mesure AST').toBe(c.infer.length);
    expect(nombre(/Restent (\d+) MANUSCRITS/, 'un compte de manuscrits'), 'manuscrits annoncés ≠ mesure AST').toBe(
      c.manuscrits.length
    );
    // La liste NOMINATIVE : les noms de type backtiqués de la phrase des manuscrits (les autres
    // backticks de la phrase — `z.lazy` — ne commencent pas par une majuscule).
    const phrase = /Restent \d+ MANUSCRITS : (.*?)\. Comptes/.exec(plat)?.[1] ?? '';
    const nommes = [...phrase.matchAll(/`([A-Z][A-Za-z]*)`/g)].map((m) => m[1]);
    expect(nommes.sort(), 'le doc doit NOMMER exactement les manuscrits mesurés').toEqual([...c.manuscrits].sort());
  });

  it('le SEAM manuscrit/schéma ne diverge QU’EN optionalité, sur les 6 champs que la note de `scene.ts` nomme', () => {
    const SCENE = 'src/state/scene.ts';
    const brut = fs.readFileSync(path.resolve(ROOT, SCENE), 'utf8');
    const program = programAvec({
      [SCENE]:
        `${brut}\nexport type __SondeManuscrit = Scene;\n` +
        `export type __SondeSchema = import('zod').z.infer<typeof import('../data/schemas/defs-scenes/scene').sceneSchema>;\n`,
    });
    try {
      const checker = program.checker;
      const sf = program.program.getSourceFileNames().map((file) => program.program.getSourceFile(file)!)
        .find((s) => path.resolve(s.fileName) === path.resolve(ROOT, SCENE))!;
      const exportes = checker.getExportsOfModule(checker.getSymbolAtLocation(sf)!);
      const optionalite = (nom: string) => {
        const sym = exportes.find((s) => s.name === nom);
        expect(sym, `alias ${nom} absent du programme`).toBeTruthy();
        const type = checker.getDeclaredTypeOfSymbol(sym!);
        return new Map(
          checker.getPropertiesOfType(type).map((p) => [p.name, !!(p.flags & SymbolFlags.Optional)])
        );
      };
      const manuscrit = optionalite('__SondeManuscrit');
      const schema = optionalite('__SondeSchema');
      expect(manuscrit.size, 'les deux faces portent les mêmes champs').toBe(schema.size);
      const divergents = [...manuscrit.keys()].filter((k) => manuscrit.get(k) !== schema.get(k));
      expect(divergents.sort(), 'la divergence du seam est CLOSE et nommée').toEqual([
        'dialogues',
        'encounters',
        'entities',
        'flags',
        'layers',
        'triggers',
      ]);
      for (const k of divergents) {
        expect(manuscrit.get(k), `${k} REQUIS côté manuscrit (après normalizeScene)`).toBe(false);
        expect(schema.get(k), `${k} OPTIONNEL côté schéma (document avant normalisation)`).toBe(true);
      }

    } finally { program.dispose(); }
  });

  // Le programme du DOCUMENT — ses deux fichiers en racines, la fermeture d'imports étant tirée par
  // TypeScript —, un module servi MODIFIÉ EN MÉMOIRE : aucune écriture disque, et la mesure porte sur
  // les vraies déclarations, pas sur une réplique.
  const DOCUMENT = ['src/state/scene.ts', 'src/data/schemas/defs-scenes/scene.ts'];
  const programAvec = (patch: Record<string, string>) =>
    repoProgram(ROOT, (fileNames) => fileNames.filter((f) => DOCUMENT.includes(path.relative(ROOT, f).split(path.sep).join('/'))), patch);

  it('NON VACANTE (a) : un champ frais, écrit par personne, est rapporté orphelin', () => {
    const program = virtualProgram({
      'src/state/scene.ts': `export interface Scene {
  id: string;
  champFraisSansControle?: string;
}\n`,
      'src/ui/Editeur.ts': `import type { Scene } from '../state/scene';
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(ids(rows).sort()).toEqual(['Scene.champFraisSansControle', 'Scene.id']);
      expect(ids(orphanFields(rows))).toEqual(['Scene.champFraisSansControle']);

    } finally { program.dispose(); }
  });

  it('NON VACANTE (b) : un champ dont le seul « écrivain » est un HOMONYME d’un autre type reste orphelin', () => {
    const program = virtualProgram({
      'src/state/scene.ts': `export interface Scene {
  id: string;
  flags: Record<string, boolean>;
}\n`,
      // Deux littéraux de forme IDENTIQUE, dans le même dossier d'éditeur : seul celui dont le type
      // porteur est `Scene` écrit la scène. L'autre remplit le contexte d'évaluation d'un `when`.
      'src/ui/Editeur.ts': `import type { Scene } from '../state/scene';
interface ContexteDeCondition { flags: Record<string, boolean>; gameTime: number }
declare function evalCondition(ctx: ContexteDeCondition): boolean;

export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });
export const visible = (flags: Record<string, boolean>, gameTime: number) =>
  evalCondition({ flags, gameTime });\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(ids(orphanFields(rows))).toEqual(['Scene.flags']);
      // …et le témoin positif du même fichier : `id` est bien crédité, la garde n'est pas aveugle.
      expect(rows.find((r) => r.id === 'Scene.id')?.authors).toEqual(['src/ui/Editeur.ts']);

    } finally { program.dispose(); }
  });

  it('le crédit suit les MAPPINGS du chemin d’édition réel (`Partial<T>`, patch passé en argument)', () => {
    const program = virtualProgram({
      'src/state/scene.ts': `export interface WallSeg { x: number; window?: boolean }
export interface Scene { walls: WallSeg[] }\n`,
      'src/ui/Inspecteur.ts': `import type { Scene, WallSeg } from '../state/scene';
declare function patchWall(s: Scene, i: number, patch: Partial<WallSeg>): Scene;
declare function setScene(s: Scene): void;
export const cocherFenetre = (s: Scene, i: number, v: boolean) => setScene(patchWall(s, i, { window: v }));
export const poserMur = (s: Scene, x: number): Scene => ({ ...s, walls: [...s.walls, { x }] });\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(ids(orphanFields(rows))).toEqual([]);

    } finally { program.dispose(); }
  });

  // Reconstitution du défaut RÉEL de `Scene.flags` : `sceneEdit.ts` n'est pas une interface. Une
  // primitive qui y vit peut être complète, testée et ré-exportée par l'éditeur sans qu'aucun
  // composant ne l'appelle — le travail s'arrête à la porte de l'interface, et seul un APPELANT
  // distingue ce cas d'un vrai chemin d'édition.
  const PONT = {
    'src/state/scene.ts': `export interface Scene { id: string; flags: Record<string, boolean>; notes: string }\n`,
    'src/state/sceneEdit.ts': `import type { Scene } from './scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: { ...s.flags, ...patch } };
}
export function setNotes(s: Scene, v: string): Scene {
  return { ...s, notes: v };
}\n`,
    'src/ui/editor/editorState.ts': `export { setSceneFlags, setNotes } from '../../state/sceneEdit';\n`,
  };

  it('NON VACANTE (d) : une primitive hors interface RÉ-EXPORTÉE mais jamais APPELÉE ne crédite rien', () => {
    const program = virtualProgram({
      ...PONT,
      // L'inspecteur appelle `setNotes` et n'appelle jamais `setSceneFlags` — exactement l'état du
      // dépôt au 2026-07-26. Le ré-export n'est PAS un appelant.
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../state/scene';
import { setNotes } from './editorState';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(ids(orphanFields(rows))).toEqual(['Scene.flags']);
      // Témoins positifs : la primitive APPELÉE crédite, et l'écriture directe de l'interface aussi.
      expect(rows.find((r) => r.id === 'Scene.notes')?.authors).toEqual(['src/state/sceneEdit.ts']);
      expect(rows.find((r) => r.id === 'Scene.id')?.authors).toEqual(['src/ui/editor/Inspecteur.ts']);

    } finally { program.dispose(); }
  });

  it('NON VACANTE (e) : un HOMONYME appelé depuis l’interface ne réveille pas la primitive muette', () => {
    const program = virtualProgram({
      ...PONT,
      // Même NOM, autre module (hors chemin de l'auteur) : la fermeture d'appels résout un SYMBOLE,
      // pas un nom — l'appel ci-dessous ne rend pas `sceneEdit.setSceneFlags` atteignable.
      'src/state/runtimeFlags.ts': `import type { Scene } from './scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: patch };
}\n`,
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../state/scene';
import { setNotes } from './editorState';
import { setSceneFlags } from '../../state/runtimeFlags';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const basculer = (s: Scene, k: string) => setScene(setSceneFlags(s, { [k]: true }));
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    try {
      expect(ids(orphanFields(auditSceneFieldEditability(VIRTUAL_ROOT, program)))).toEqual(['Scene.flags']);

    } finally { program.dispose(); }
  });

  it('un APPELANT d’interface, même indirect via une autre primitive appelée, crédite', () => {
    const program = virtualProgram({
      ...PONT,
      // Chaîne `Inspecteur → setNotes → setSceneFlags` : l'atteignabilité est TRANSITIVE.
      'src/state/sceneEdit.ts': `import type { Scene } from './scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: { ...s.flags, ...patch } };
}
export function setNotes(s: Scene, v: string): Scene {
  return setSceneFlags({ ...s, notes: v }, { touche: true });
}\n`,
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../state/scene';
import { setNotes } from './editorState';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    try {
      expect(ids(orphanFields(auditSceneFieldEditability(VIRTUAL_ROOT, program)))).toEqual([]);

    } finally { program.dispose(); }
  });
});

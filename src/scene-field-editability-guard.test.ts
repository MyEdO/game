import { API, SymbolFlags, TypeFlags, type Type, type TypeReference } from 'typescript/unstable/sync';
import { ast } from '../scripts/guards/lib/dialecte.mjs';
import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import * as ts from 'typescript/unstable/ast';
import {
  ALLER_RETOUR,
  auditSceneFieldEditability,
  documentDeclarations,
  orphanFields,
  sceneScope,
  programmeDuPerimetre,
} from '../scripts/guards/lib/sceneFieldEditability.mjs';
import { repoProgram, virtualProgram, VIRTUAL_ROOT } from '../scripts/guards/lib/tsProgram.mjs';
import { detenteur } from './lib/detenteur.testkit';
import { ecrituresDesPorteursSeuls, ecrituresJouees } from './ecrituresJouees.testkit';

/**
 * GARDE #841 — « toute donnée de la scène s'édite au clic, sans dépendre d'une IA » (directive
 * utilisateur du 2026-07-26, verbatim : « Assure toi toujours qu'on doit pouvoir éditer toutes les
 * données de la scene, on ne doit pas dépendre d'une IA »). Tout champ de Scene a un chemin d'écriture
 * d'auteur : l'interface web (`src/ui/**`) ou l'éditeur Godot (méthode `editer` du pont, #3508 décision 8).
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
 * anonyme, l'inclusion par IDENTITÉ et la descente des fabriques, pas la POSITION réelle du
 * symbole rendu par `z.infer` (`zod/v4/core/util.d.cts`) : ce chemin-là n'est couvert que par la
 * mesure sur le programme RÉEL (cliquet de compte + la mesure du SEAM, qui bâtit le programme du
 * DOCUMENT avec un module modifié EN MÉMOIRE).
 */
const ROOT = path.resolve(__dirname, '..');

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
      expect(erreurs[0].message).toBe('src/noyau/monde/scene.ts absent du programme');
      expect(erreurs[1]).toBe(fermeture);
      expect(Reflect.get(erreur, 'cause')).toBe(erreurs[0]);
      expect(close).toHaveBeenCalledTimes(1);
    } finally { cache.mockRestore(); close.mockRestore(); fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('une session empruntée reste ouverte après une erreur d’analyse', () => {
    const session = virtualProgram({});
    const close = vi.spyOn(API.prototype, 'close');
    try {
      expect(() => auditSceneFieldEditability(VIRTUAL_ROOT, session)).toThrow('src/noyau/monde/scene.ts absent du programme');
      expect(close).not.toHaveBeenCalled();
    } finally { close.mockRestore(); session.dispose(); }
  });
  // scripts/guards/lib/tsProgram.mjs ; src/analyse-retention-guard.test.ts
  const perimetre = detenteur(() => programmeDuPerimetre(ROOT), (session) => session.dispose());
  /** L'audit du dépôt, les écritures que l'aller-retour de l'éditeur Godot joue comprises (`ecrituresJouees`). */
  const ecritures = detenteur(() => ecrituresJouees());
  const auditReel = detenteur(() => auditSceneFieldEditability(ROOT, perimetre(), { ecrituresJouees: ecritures() }));

  it('aucun champ n’est joignable seulement par le pipeline d’authoring, hors cliquet nommé', { timeout: 120_000 }, () => {
    const orphelins = orphanFields(auditReel());
    // Rendu en TEXTE : l'échec doit NOMMER les champs et leur `fichier:ligne`, pas afficher « …(9) ».
    const detail = orphelins
      .map((r) => `${r.id} (${r.at}) — écrivains : ${r.pipeline.join(', ') || 'AUCUN'}`)
      .join('\n');
    expect(ids(orphelins).sort(), detail).toEqual([...TROUS_CONNUS].sort());
  });

  it('l’aller-retour partagé crédite tout ce que crédite chaque porteur joué SEUL à ses branches', { timeout: 120_000 }, () => {
    // Un porteur rejoué ne s'ajoute pas à `out` aux empreintes déjà jouées (`ecrituresJouees.testkit.ts`) : une offre ainsi
    // sautée ne doit cacher aucune des offres qu'elle ouvre (`SceneEntity.combat.spells` sous `combat/ajouter`).
    const ligne = (r: { id: string; authors: string[] }) => `${r.id} ← ${r.authors.join(', ')}`;
    const avecLesSeuls = auditSceneFieldEditability(ROOT, perimetre(), { ecrituresJouees: [...ecritures(), ...ecrituresDesPorteursSeuls()] });
    expect(avecLesSeuls.map(ligne)).toEqual(auditReel().map(ligne));
  });

  it('crédite une écriture qui traverse `Array.map` — sonde réelle : `SceneEffectZone.tiles` ← `mapSpec.ts`', { timeout: 120_000 }, () => {
    // Un littéral rendu par un callback de `map` perd sa freshness : `getContextualType` ne le
    // rattache à rien, et `tsc` lui-même ne signale pas la suppression du champ écrit. Un champ
    // vivant y était donc rapporté « écrivains : AUCUN » — un faux négatif qui invite à supprimer du
    // code vivant. `src/noyau/mapSpec.ts:902` (`const namedZones: SceneEffectZone[] = […].map(…)`)
    // est la sonde : l'annotation de la collection porte le type, la garde doit la lire.
    const rows = auditReel();
    const zone = (field: string) => rows.find((r) => r.id === `SceneEffectZone.${field}`);
    for (const field of ['tiles', 'area', 'id', 'label', 'z']) {
      expect(zone(field)?.pipeline, `SceneEffectZone.${field} sans écrivain de pipeline`).toContain(
        'src/noyau/mapSpec.ts'
      );
    }
    // Le littéral IMBRIQUÉ dans ce même retour de callback est crédité aussi — mais seulement sur le
    // membre d'union réellement écrit (`kind: 'rect'`), jamais sur `disc`.
    expect(zone('area.w')?.pipeline).toContain('src/noyau/mapSpec.ts');
    expect(zone('area.radius')?.pipeline).not.toContain('src/noyau/mapSpec.ts');
  });

  it('crédite ce que l’éditeur Godot écrit en jouant `editer` — sonde réelle : le Test de traversée d’une zone d’effet', { timeout: 120_000 }, () => {
    expect(auditReel().find((r) => r.id === 'SceneEffectZone.crossTest')?.authors).toContain(ALLER_RETOUR);
  });

  it('une écriture jouée crédite le DERNIER pas de son chemin et, d’un objet écrit entier, chacune de ses clés, marchés sur le type `Scene`, si le document a changé, la valeur relue est la jouée et la saisie n’est pas du JSON', () => {
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': `export interface Rect { kind: 'rect'; w: number }
export interface Disc { kind: 'disc'; radius: number }
export interface Test { difficulty: string }
export interface SceneEffectZone { id: string; area: Rect | Disc; crossTest?: Test; perRound?: unknown[]; tags?: Record<string, { n: number }> }
export interface Scene { id: string; effectZones: SceneEffectZone[] }\n`,
    });
    const doc = (zone: Record<string, unknown> = {}) => ({ id: 's', effectZones: [{ id: 'z', area: { kind: 'disc', radius: 2 }, tags: { a: { n: 1 } }, ...zone }] });
    const jouee = (apres: Record<string, unknown>, chemin: (string | number)[], valeur: unknown, saisie: string, avant: Record<string, unknown> = {}) =>
      ({ avant: doc(avant), apres: doc(apres), chemin: ['effectZones', 0, ...chemin], valeur, saisie });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program, { ecrituresJouees: [
        jouee({ crossTest: { difficulty: 'x' } }, ['crossTest'], { difficulty: 'x' }, 'bouton'),
        jouee({ area: { kind: 'disc', radius: 3 } }, ['area', 'radius'], 3, 'saisieNombre'),
        jouee({ perRound: [] }, ['perRound'], [], 'saisieJson'),
        jouee({}, ['tags', 'a', 'n'], 1, 'saisieNombre'),
        jouee({ area: { kind: 'disc', radius: 2, w: 4 } }, ['area', 'w'], 4, 'saisieNombre'),
      ] });
      expect(rows.filter((r) => r.authors.length).map((r) => [r.id, r.authors])).toEqual([
        ['Disc.radius', [ALLER_RETOUR]],
        ['SceneEffectZone.crossTest', [ALLER_RETOUR]],
        ['Test.difficulty', [ALLER_RETOUR]],
      ]);
    } finally { program.dispose(); }
  });

  it('une propriété PRODUITE PAR UNE FABRIQUE est le champ de son TYPE produit : deux produits d’un même type sont un champ, deux de types distincts en sont deux', () => {
    // `objetDeRef` (`grammaire/ref.ts`) : UNE déclaration `id` pour chaque référence qu'il construit ; `ref(0)` et `ref(1)`
    // produisent le même type, `ref('')` un autre.
    const program = virtualProgram({
      'src/data/schemas/grammaire/ref.ts': `declare function forme<T>(shape: T): { readonly sortie: T };
export function ref<F>(feuille: F) { return forme({ id: feuille }); }\n`,
      'src/data/schemas/defs-scenes/scene.ts': `import { ref } from '../grammaire/ref';
declare function forme<T>(shape: T): { readonly sortie: T };
export const sceneSchema = forme({ id: '', arme: ref(0).sortie, bouclier: ref(1).sortie, embleme: ref('').sortie });\n`,
      'src/noyau/monde/scene.ts': `import type { sceneSchema } from '../../data/schemas/defs-scenes/scene';
export type Scene = (typeof sceneSchema)['sortie'];\n`,
    });
    const doc = (arme: number) => ({ id: 's', arme: { id: arme }, bouclier: { id: 0 }, embleme: { id: 'e' } });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program, { ecrituresJouees: [
        { avant: doc(0), apres: doc(1), chemin: ['arme', 'id'], valeur: 1, saisie: 'saisieNombre' },
      ] });
      expect(rows.filter((r) => r.id.endsWith('.id') && r.id !== 'Scene.id').map((r) => [r.id, r.authors])).toEqual([
        ['Scene.arme.id', [ALLER_RETOUR]],
        ['Scene.embleme.id', []],
      ]);
    } finally { program.dispose(); }
  });

  it('une propriété HÉRITÉE est le champ de sa déclaration : l’écriture par le type dérivé crédite le champ du type de base', () => {
    // `RefASpecialisation extends RefDesignee` (`grammaire/ref.ts`) : `id` est déclaré une fois, par `RefDesignee`.
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': `export interface Base { id: string }
export interface Derivee extends Base { n?: number }
export interface Scene { id: string; a: Base; b: Derivee }\n`,
    });
    const doc = (id: string) => ({ id: 's', a: { id: 'a' }, b: { id } });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program, { ecrituresJouees: [
        { avant: doc('b'), apres: doc('c'), chemin: ['b', 'id'], valeur: 'c', saisie: 'saisieTexte' },
      ] });
      expect(rows.filter((r) => r.id.endsWith('.id') && r.id !== 'Scene.id').map((r) => [r.id, r.authors])).toEqual([['Base.id', [ALLER_RETOUR]]]);
    } finally { program.dispose(); }
  });

  it('NON VACANTE (c) : à travers `Array.map`, seule l’annotation de la COLLECTION crédite — pas un homonyme', () => {
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': `export interface SceneEffectZone { id: string; tiles: number[] }
export interface Scene { id: string; effectZones: SceneEffectZone[]; layers: SceneEffectZone[] }\n`,
      // (a) annotation de collection, (b) type de retour annoté, (c) `push` dans un tableau annoté,
      // (d) `map` imbriqué — les quatre formes réelles du dépôt.
      'src/ui/Zonage.ts': `import type { Scene, SceneEffectZone } from '../noyau/monde/scene';
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
      'Scene.reliefDefaults.ramp', // clé LITTÉRALE d'un type mappé, sans déclaration de propriété
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
      'EncounterDef.victoryCondition.atOrBelowPercent', // membre de l'union VictoryCondition
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
    // 416 = mesure du 2026-11-12 (#3606 M2f1 : `FRONTIERE` retirée, corps des fabriques et annotations de type descendus).
    expect(scope.length, 'périmètre effondré').toBeGreaterThanOrEqual(416);
  });

  it('le périmètre inclut par IDENTITÉ — une feuille d’un AUTRE module composée par le document y entre, et la marche descend dans le corps d’une fabrique', () => {
    // Réplique STRUCTURELLE du seam réel (`sceneSchema` compose `moneyPartialSchema`, feuille de
    // `grammaire/valeurs.ts`, et `conditionSchema`, produit de la fabrique `conditionDe` de `grammaire/`) : le schéma
    // composant vit dans un AUTRE module. La marche part de `sceneSchema` et suit les IDENTITÉS, jusque dans le corps
    // de la fabrique.
    const program = virtualProgram({
      'src/data/schemas/grammaire/mecanique.ts': `declare function forme<T>(shape: T): { readonly sortie: T };
function conditionDe() { return forme({ flag: '' }); }
export const conditionSchema = conditionDe();\n`,
      'src/data/schemas/defs-scenes/communs.ts': `declare function forme<T>(shape: T): { readonly sortie: T };
export const moneySchema = forme({ gold: 0 });\n`,
      'src/data/schemas/defs-scenes/scene.ts': `import { moneySchema } from './communs';
import { conditionSchema } from '../grammaire/mecanique';
declare function forme<T>(shape: T): { readonly sortie: T };
export const sceneSchema = forme({ id: '', cost: moneySchema.sortie, when: conditionSchema.sortie });\n`,
      'src/noyau/monde/scene.ts': `import type { sceneSchema } from '../../data/schemas/defs-scenes/scene';
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
      expect(all, 'le shape que la fabrique construit entre au périmètre').toContain('Scene.when.flag');

    } finally { program.dispose(); }
  });

  it('la frontière porte sur la DÉCLARATION DE PROPRIÉTÉ — un corps inféré d’un schéma est dans le périmètre et se NOMME de son schéma, le vocabulaire partagé n’y est pas', () => {
    // Reproduit STRUCTURELLEMENT ce que `z.infer` fait au TypeChecker : le type porteur est anonyme
    // (son symbole ne vient pas du module du document), mais chaque propriété est déclarée par le
    // `PropertyAssignment` du shape. Le porteur se nomme du `export const xSchema` englobant.
    const program = virtualProgram({
      'src/engine/vocabulaire.ts': `export interface Vocabulaire { mot: string }\n`,
      'src/noyau/monde/scene.ts': `import type { Vocabulaire } from '../../engine/vocabulaire';
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

  it('aucune annotation de type ne masque un shape : toute propriété de la donnée atteinte depuis `Scene` est au périmètre', () => {
    // Détecteur INDÉPENDANT de la marche : le type `Scene` parcouru au TypeChecker, propriété par propriété ; une
    // propriété déclarée sous `src/data/` (cast `as ChampsNommes`, `z.ZodType<{ id: string }>`, `RefDesignee`,
    // `TraitPose`, `Calage`) hors de l'ensemble d'identités est un champ que la marche n'a pas vu. Les types du moteur
    // (`src/engine/`) et du noyau restent hors de cette classe.
    const program = perimetre();
    const checker = program.checker;
    const docNodes = documentDeclarations(program, ROOT);
    const sf = program.program.getSourceFileNames().map((f) => program.program.getSourceFile(f)).find((x) => x?.fileName.endsWith('src/noyau/monde/scene.ts'));
    const sym = sf && checker.getExportsOfModule(checker.getSymbolAtLocation(sf)!).find((x) => x.name === 'Scene');
    if (!sym) throw new Error('type `Scene` introuvable');
    const vus = new Set<unknown>();
    const manques = new Set<string>();
    const visiter = (t: Type | undefined, chemin: string): void => {
      if (!t || vus.has(t)) return;
      vus.add(t);
      if (t.isUnionType() || t.isIntersectionType()) return t.getTypes().forEach((m) => visiter(m, chemin));
      if (checker.isArrayType(t) || checker.isTupleType(t)) return checker.getTypeArguments(t as TypeReference).forEach((a) => visiter(a, chemin));
      if (!(t.flags & TypeFlags.Object)) return;
      const index = checker.getIndexInfosOfType(t).find((i) => i.keyType.flags & TypeFlags.String);
      if (index) visiter(index.valueType, `${chemin}[k]`);
      for (const prop of checker.getPropertiesOfType(t)) {
        const decl = prop.declarations?.[0]?.resolve();
        const ici = `${chemin}.${prop.name}`;
        if (!decl) { visiter(checker.getTypeOfSymbol(prop), ici); continue; }
        const fichier = path.relative(ROOT, decl.getSourceFile().fileName).split(path.sep).join('/');
        if (docNodes.has(decl) || fichier === 'src/noyau/monde/scene.ts') visiter(checker.getTypeOfSymbolAtLocation(prop, decl), ici);
        else if (fichier.startsWith('src/data/')) manques.add(`${ici} @ ${fichier}`);
      }
    };
    visiter(checker.getDeclaredTypeOfSymbol(sym), 'Scene');
    expect([...manques].sort(), 'propriétés de la donnée que la marche ne voit pas').toEqual([]);
  });

  it('l’inclusion par IDENTITÉ est LOAD-BEARING sur le programme RÉEL — la frontière par MODULE perd des champs NOMMÉS', () => {
    // Rabattre `declaredInScene` sur les deux FICHIERS du document perd les champs nommés ici (mutation
    // mesurée) : ce sont les seuls du périmètre déclarés hors du document.
    // #1463 (2026-10-26) : le Trait POSÉ du document est la forme INFÉRÉE de son schéma
    // (`traitInstanceSchema`, `TraitPose`) et non plus l'instance RÉSOLUE du moteur — la rangée de Trait
    // et sa provenance (`SourceRef`, composée par `source`/`alsoIn`) entrent donc au périmètre.
    // #1463 PR-3b : la fourchette (`Plage`) de la pose, et les clés de l'Indice par Localisation — shape
    // DÉRIVÉ (`tableTotale`), propriétés synthétiques rattachées à la déclaration de `parLocalisation`.
    // #1463 Trait 3b-2 : la pose, récursive par `confere`, a un type DÉCLARÉ (`TraitPose`) ; ses champs
    // se nomment à leur premier porteur du document.
    // #3012 S4b : `entryPoints` et `stations[].pos` composent `ptSchema` (`defs-scenes/communs.ts`), le `Pt` du noyau.
    // #3606 M1a : les options d'une entité sont la sortie de `optionalDeSceneSchema` (la note « swap », ses octrois de
    // Caractéristique et de Compétence), et une Amélioration celle de `navalTraitRefSchema`.
    // #3606 M1b : le profil personnalisé est la sortie de `customStatblockSchema` (`defs-scenes/communs.ts`) ; sa
    // pose de Trait nomme les champs de la pose, à son premier porteur, et son Talent est `TalentRef`.
    // #3606 M1c : l'apparence d'une entité est l'entrée d'`entityAppearanceSchema` (`grammaire/valeurs.ts`) ; ses
    // couleurs, clés d'emplacement de palette d'un type mappé.
    // #3606 M2f1 : la marche descend dans le corps des fabriques — l'`id` d'une référence (`objetDeRef`, `grammaire/ref.ts`),
    // la prose adressée d'une réplique (`proseNommee`, `grammaire/prose.ts`) et son adresse (`grammaire/valeurs.ts`) ; et
    // à travers l'annotation de type d'un schéma (`RefASpecialisation`, `TraitPose`, le `{ id: string }` d'un
    // `z.ZodType<…>`, `ChampsNommes`) ou d'un type manuscrit du document (`Calage`).
    const DOC = ['src/noyau/monde/scene.ts', 'src/data/schemas/defs-scenes/scene.ts'];
    const fichier = (r: { decl: ts.Declaration }) =>
      path.relative(ROOT, r.decl.getSourceFile().fileName).split(path.sep).join('/');
    const scope: { id: string; decl: ts.Declaration }[] = sceneScope(perimetre(), ROOT);
    const horsDocument = scope.filter((r) => !DOC.includes(fichier(r)));
    expect(
      horsDocument.map((r) => `${r.id} @ ${fichier(r)}`).sort(),
      'ce que la frontière par MODULE perdrait'
    ).toEqual([
      'AuthoredShipPoste.selectedAmmo.id @ src/data/schemas/grammaire/ref.ts',
      'Calage.x @ src/data/props.types.ts',
      'Calage.y @ src/data/props.types.ts',
      'CaracteristiqueChiffree.characteristic @ src/data/schemas/grammaire/valeurs.ts',
      'CaracteristiqueChiffree.value @ src/data/schemas/grammaire/valeurs.ts',
      'CharStats.B @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.M @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.agilite @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.capacite-de-combat @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.capacite-de-tir @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.dexterite @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.endurance @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.force @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.force-mentale @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.initiative @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.intelligence @ src/data/schemas/defs-scenes/communs.ts',
      'CharStats.sociabilite @ src/data/schemas/defs-scenes/communs.ts',
      'Couleurs.accent @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.accent.id @ src/data/schemas/grammaire/ref.ts',
      'Couleurs.bois @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.cheveux @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.corne @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.corps @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.cuir @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.fourrure @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.metal @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.peau @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.plume @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.vet1 @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.vet2 @ src/data/schemas/grammaire/valeurs.ts',
      'Couleurs.yeux @ src/data/schemas/grammaire/valeurs.ts',
      'CustomStatblock.char @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.followsCharacterRules @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.groups @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.inert @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.label @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.randomChars @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.size @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.skills @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.skills.value @ src/data/index.ts',
      'CustomStatblock.spells @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.talents @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.traits @ src/data/schemas/defs-scenes/communs.ts',
      'CustomStatblock.traits.alsoIn @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.arg @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.confere @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.count @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.difficulte @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.hidden @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.id @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.maison @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.matiere @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.natural @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.parLocalisation @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.plage @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.range @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.source @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.traits.value @ src/data/schemas/grammaire/reference.ts',
      'CustomStatblock.type @ src/data/schemas/defs-scenes/communs.ts',
      'Dialogue.start.id @ src/data/schemas/grammaire/ref.ts',
      'DialogueNode.adapteDe @ src/data/schemas/grammaire/prose.ts',
      'DialogueNode.desc @ src/data/schemas/grammaire/prose.ts',
      'DialogueNode.descRef @ src/data/schemas/grammaire/prose.ts',
      'DialogueNode.descRef.book @ src/data/schemas/grammaire/valeurs.ts',
      'DialogueNode.descRef.ch @ src/data/schemas/grammaire/valeurs.ts',
      'DialogueNode.descRef.parts @ src/data/schemas/grammaire/valeurs.ts',
      'EntityAppearance.apparencesObjets @ src/data/schemas/grammaire/valeurs.ts',
      'EntityAppearance.apparencesObjets.id @ src/data/schemas/grammaire/valeurs.ts',
      'EntityAppearance.armurePortee @ src/data/schemas/grammaire/valeurs.ts',
      'EntityAppearance.couleurs @ src/data/schemas/grammaire/valeurs.ts',
      'EntityAppearance.embleme @ src/data/schemas/grammaire/valeurs.ts',
      'EntityAppearance.embleme.id @ src/data/schemas/grammaire/ref.ts',
      'EntityAppearance.sex @ src/data/schemas/grammaire/valeurs.ts',
      'EntityAppearance.species @ src/data/schemas/grammaire/valeurs.ts',
      'EntityAppearance.tenue @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentBlocs.b0 @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentBlocs.b1 @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentBlocs.finSec @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentBlocs.finSecOcc @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentBlocs.kind @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentBlocs.sec @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentBlocs.secOcc @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentBlocs.sum @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentCellule.col @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentCellule.kind @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentCellule.row @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentCellule.sec @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentCellule.secOcc @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentCellule.sum @ src/data/schemas/grammaire/valeurs.ts',
      'FragmentCellule.table @ src/data/schemas/grammaire/valeurs.ts',
      'MarchandDeScene.archetype.id @ src/data/schemas/grammaire/ref.ts',
      'MoneyPartial.brass @ src/data/schemas/grammaire/valeurs.ts',
      'MoneyPartial.gold @ src/data/schemas/grammaire/valeurs.ts',
      'MoneyPartial.silver @ src/data/schemas/grammaire/valeurs.ts',
      'OffreDeTaverne.id @ src/data/schemas/grammaire/ref.ts',
      'OptionalSwap.grant @ src/data/schemas/grammaire/reference.ts',
      'OptionalSwap.grant.value @ src/data/schemas/grammaire/reference.ts',
      'OptionalSwap.label @ src/data/schemas/grammaire/reference.ts',
      'OptionalSwap.note @ src/data/schemas/grammaire/reference.ts',
      'OptionalSwap.remove @ src/data/schemas/grammaire/reference.ts',
      'OptionalSwap.size @ src/data/schemas/grammaire/reference.ts',
      'OptionalSwap.wounds @ src/data/schemas/grammaire/reference.ts',
      'ParLocalisation.brasD @ src/data/schemas/grammaire/reference.ts',
      'ParLocalisation.brasG @ src/data/schemas/grammaire/reference.ts',
      'ParLocalisation.corps @ src/data/schemas/grammaire/reference.ts',
      'ParLocalisation.jambeD @ src/data/schemas/grammaire/reference.ts',
      'ParLocalisation.jambeG @ src/data/schemas/grammaire/reference.ts',
      'ParLocalisation.tete @ src/data/schemas/grammaire/reference.ts',
      'Plage.max @ src/data/schemas/grammaire/valeurs.ts',
      'Plage.min @ src/data/schemas/grammaire/valeurs.ts',
      'Pt.x @ src/data/schemas/defs-scenes/communs.ts',
      'Pt.y @ src/data/schemas/defs-scenes/communs.ts',
      'Pt.z @ src/data/schemas/defs-scenes/communs.ts',
      'RefASpecialisation.choix @ src/data/schemas/grammaire/ref.ts',
      'RefASpecialisation.id @ src/data/schemas/grammaire/ref.ts',
      'RefASpecialisation.spec @ src/data/schemas/grammaire/ref.ts',
      'Scene.startMessage.adapteDe @ src/data/schemas/grammaire/prose.ts',
      'Scene.startMessage.source @ src/data/schemas/grammaire/prose.ts',
      'SceneEntity.upgrades.id @ src/data/schemas/grammaire/ref.ts',
      'SceneEntity.upgrades.value @ src/data/schemas/grammaire/reference.ts',
      'SourceRef.book @ src/data/schemas/grammaire/valeurs.ts',
      'SourceRef.note @ src/data/schemas/grammaire/valeurs.ts',
      'SourceRef.page @ src/data/schemas/grammaire/valeurs.ts',
      'SourceRef.quote @ src/data/schemas/grammaire/valeurs.ts',
      'TalentRef.id @ src/data/schemas/grammaire/reference.ts',
      'TalentRef.spec @ src/data/schemas/grammaire/reference.ts',
      'TalentRef.times @ src/data/schemas/grammaire/reference.ts',
    ]);
    // Contre-témoin : `Rect` ne doit RIEN à l'inclusion par identité — il est déclaré DANS le document,
    // son renommage `Trigger.rect.*` → `Rect.*` vient du NOMMAGE du porteur rendu par `z.infer`.
    expect(fichier(scope.find((r) => r.id === 'Rect.z')!)).toBe('src/data/schemas/defs-scenes/scene.ts');
  });

  /**
   * RECENSEMENT des types exportés par `noyau/monde/scene.ts`, confronté à ce que `docs/architecture.md`
   * AFFIRME. Le mode de panne fermé ici est celui qu'a trouvé l'audit de fermeture L1a (#1466) : le doc
   * a continué d'annoncer « les 32 autres types restent MANUSCRITS » après la bascule de 22 d'entre eux
   * en `z.infer` (ba123074e) — une référence vivante qui ment, qu'aucun rouge ne signalait. Le doc est
   * donc LU, ses trois affirmations (total, `z.infer`, liste NOMINATIVE des manuscrits) sont comparées à
   * la mesure AST : un type qui bascule sans que le doc suive est rouge, et l'inverse aussi.
   */
  const censusScene = () => {
    const sf = ast({ rel: 'scene.ts', text: fs.readFileSync(path.resolve(ROOT, 'src/noyau/monde/scene.ts'), 'utf8') })!;
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

  it('`docs/architecture.md` DIT la vérité sur les types de `noyau/monde/scene.ts` (total, `z.infer`, manuscrits NOMMÉS)', () => {
    const doc = fs.readFileSync(path.resolve(ROOT, 'docs/architecture.md'), 'utf8');
    const bloc = /\n {2}monde\/scene\.ts {2}([\s\S]*?)\n {2}\S/.exec(doc)?.[1];
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
    const SCENE = 'src/noyau/monde/scene.ts';
    const brut = fs.readFileSync(path.resolve(ROOT, SCENE), 'utf8');
    const program = programAvec({
      [SCENE]:
        `${brut}\nexport type __SondeManuscrit = Scene;\n` +
        `export type __SondeSchema = import('zod').z.infer<typeof import('../../data/schemas/defs-scenes/scene').sceneSchema>;\n`,
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
  const DOCUMENT = ['src/noyau/monde/scene.ts', 'src/data/schemas/defs-scenes/scene.ts'];
  const programAvec = (patch: Record<string, string>) =>
    repoProgram(ROOT, (fileNames) => fileNames.filter((f) => DOCUMENT.includes(path.relative(ROOT, f).split(path.sep).join('/'))), patch);

  it('NON VACANTE (a) : un champ frais, écrit par personne, est rapporté orphelin', () => {
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': `export interface Scene {
  id: string;
  champFraisSansControle?: string;
}\n`,
      'src/ui/Editeur.ts': `import type { Scene } from '../noyau/monde/scene';
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
      'src/noyau/monde/scene.ts': `export interface Scene {
  id: string;
  flags: Record<string, boolean>;
}\n`,
      // Deux littéraux de forme IDENTIQUE, dans le même dossier d'éditeur : seul celui dont le type
      // porteur est `Scene` écrit la scène. L'autre remplit le contexte d'évaluation d'un `when`.
      'src/ui/Editeur.ts': `import type { Scene } from '../noyau/monde/scene';
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

  it('les clés LITTÉRALES d’un type mappé (`Record<\'a\' | \'b\', V>`) sont au périmètre, rattachées au champ porteur, et créditées une à une', () => {
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': `export type Cote = 'gauche' | 'droite';
export interface Scene { id: string; armure: Record<Cote, number> }\n`,
      // Clé CALCULÉE pilotée par un littéral (l'idiome des rangées de l'inspecteur) : seul `gauche` s'écrit.
      'src/ui/Armure.ts': `import type { Scene } from '../noyau/monde/scene';
const COTE = 'gauche' as const;
export const poser = (s: Scene, n: number): Scene => ({ ...s, id: s.id, armure: { ...s.armure, [COTE]: n } });\n`,
    });
    try {
      const scope = sceneScope(program, VIRTUAL_ROOT);
      expect(ids(scope).sort()).toEqual(['Scene.armure', 'Scene.armure.droite', 'Scene.armure.gauche', 'Scene.id']);
      const porteur = scope.find((e) => e.id === 'Scene.armure')!.decl;
      expect(scope.find((e) => e.id === 'Scene.armure.gauche')!.decl, 'rattachée à la déclaration du champ porteur').toBe(porteur);
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(rows.find((r) => r.id === 'Scene.armure.gauche')?.authors).toEqual(['src/ui/Armure.ts']);
      expect(ids(orphanFields(rows)), 'la clé jamais écrite reste orpheline').toEqual(['Scene.armure.droite']);
    } finally { program.dispose(); }
  });

  it('le crédit suit les MAPPINGS du chemin d’édition réel (`Partial<T>`, patch passé en argument)', () => {
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': `export interface WallSeg { x: number; window?: boolean }
export interface Scene { walls: WallSeg[] }\n`,
      'src/ui/Inspecteur.ts': `import type { Scene, WallSeg } from '../noyau/monde/scene';
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
    'src/noyau/monde/scene.ts': `export interface Scene { id: string; flags: Record<string, boolean>; notes: string }\n`,
    'src/noyau/sceneEdit.ts': `import type { Scene } from '../noyau/monde/scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: { ...s.flags, ...patch } };
}
export function setNotes(s: Scene, v: string): Scene {
  return { ...s, notes: v };
}\n`,
    'src/ui/editor/editorState.ts': `export { setSceneFlags, setNotes } from '../../noyau/sceneEdit';\n`,
  };

  it('NON VACANTE (d) : une primitive hors interface RÉ-EXPORTÉE mais jamais APPELÉE ne crédite rien', () => {
    const program = virtualProgram({
      ...PONT,
      // L'inspecteur appelle `setNotes` et n'appelle jamais `setSceneFlags` — exactement l'état du
      // dépôt au 2026-07-26. Le ré-export n'est PAS un appelant.
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../noyau/monde/scene';
import { setNotes } from './editorState';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(ids(orphanFields(rows))).toEqual(['Scene.flags']);
      // Témoins positifs : la primitive APPELÉE crédite, et l'écriture directe de l'interface aussi.
      expect(rows.find((r) => r.id === 'Scene.notes')?.authors).toEqual(['src/noyau/sceneEdit.ts']);
      expect(rows.find((r) => r.id === 'Scene.id')?.authors).toEqual(['src/ui/editor/Inspecteur.ts']);

    } finally { program.dispose(); }
  });

  it('NON VACANTE (e) : un HOMONYME appelé depuis l’interface ne réveille pas la primitive muette', () => {
    const program = virtualProgram({
      ...PONT,
      // Même NOM, autre module (hors chemin de l'auteur) : la fermeture d'appels résout un SYMBOLE,
      // pas un nom — l'appel ci-dessous ne rend pas `sceneEdit.setSceneFlags` atteignable.
      'src/state/runtimeFlags.ts': `import type { Scene } from '../noyau/monde/scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: patch };
}\n`,
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../noyau/monde/scene';
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
      'src/noyau/sceneEdit.ts': `import type { Scene } from '../noyau/monde/scene';
export function setSceneFlags(s: Scene, patch: Record<string, boolean>): Scene {
  return { ...s, flags: { ...s.flags, ...patch } };
}
export function setNotes(s: Scene, v: string): Scene {
  return setSceneFlags({ ...s, notes: v }, { touche: true });
}\n`,
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../noyau/monde/scene';
import { setNotes } from './editorState';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    try {
      expect(ids(orphanFields(auditSceneFieldEditability(VIRTUAL_ROOT, program)))).toEqual([]);

    } finally { program.dispose(); }
  });

  it('le chemin Godot crédite : une primitive atteinte depuis la méthode `editer` du pont, et elle seule', () => {
    // Aucun fichier d'interface : `setNotes` n'est appelée que par `editer`, `setSceneFlags` que par une autre méthode
    // du pont (la partie, que l'auteur n'édite pas).
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': PONT['src/noyau/monde/scene.ts'],
      'src/noyau/sceneEdit.ts': PONT['src/noyau/sceneEdit.ts'],
      'hotes/godot/pont/pont.ts': `import type { Scene } from '../../../src/noyau/monde/scene';
import { setNotes, setSceneFlags } from '../../../src/noyau/sceneEdit';
export function creerPont(s: Scene) {
  return {
    editer(v: string) { return setNotes(s, v); },
    jouer() { return setSceneFlags(s, { vu: true }); },
  };
}\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(rows.find((r) => r.id === 'Scene.notes')?.authors).toEqual(['src/noyau/sceneEdit.ts']);
      expect(ids(orphanFields(rows)).sort()).toEqual(['Scene.flags', 'Scene.id']);
    } finally { program.dispose(); }
  });

  it('le helper à CLÉ `champ<T, K extends keyof T>(o, k, v)` qui écrit `o[k]` crédite la clé littérale passée, un lecteur de même signature rien', () => {
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': PONT['src/noyau/monde/scene.ts'],
      'src/noyau/sceneEdit.ts': `import type { Scene } from '../noyau/monde/scene';
function champ<T extends object, K extends keyof T>(o: T, k: K, v: T[K] | undefined): T {
  const out = { ...o };
  if (v === undefined) delete out[k];
  else out[k] = v;
  return out;
}
function lire<T extends object, K extends keyof T>(o: T, k: K): T[K] {
  return o[k];
}
export const setNotes = (s: Scene, v: string): Scene => champ(s, 'notes', v);
export const drapeaux = (s: Scene) => lire(s, 'flags');\n`,
      'src/ui/editor/Inspecteur.ts': `import type { Scene } from '../../noyau/monde/scene';
import { drapeaux, setNotes } from '../../noyau/sceneEdit';
declare function setScene(s: Scene): void;
export const saisirNotes = (s: Scene, v: string) => setScene(setNotes(s, v));
export const voir = (s: Scene) => drapeaux(s);
export const renommer = (s: Scene, v: string): Scene => ({ ...s, id: v });\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      expect(rows.find((r) => r.id === 'Scene.notes')?.authors).toEqual(['src/noyau/sceneEdit.ts']);
      expect(ids(orphanFields(rows))).toEqual(['Scene.flags']);
    } finally { program.dispose(); }
  });

  it('la valeur d’un AUTRE type affectée à un champ lui apporte ses champs ; celle du même type ne fait que recopier', () => {
    const program = virtualProgram({
      'src/noyau/monde/scene.ts': `export interface Emprise { x: number; w: number }
export interface Partie { id: string; foot: Emprise }
export interface Scene { parts: Partie[] }\n`,
      // `Rect` n'est pas `Emprise` : le rectangle tiré au pointeur écrit `foot.x` et `foot.w`. Recopier l'emprise d'une
      // autre partie (`foot: modele.foot`) n'écrit rien.
      'src/ui/editor/Poignee.ts': `import type { Partie, Scene } from '../../noyau/monde/scene';
interface Rect { x: number; w: number }
declare function rectTire(): Rect;
export const redimensionner = (s: Scene): Scene => ({ ...s, parts: s.parts.map((p): Partie => ({ ...p, foot: rectTire() })) });\n`,
      'src/ui/editor/Copie.ts': `import type { Partie } from '../../noyau/monde/scene';
export const copier = (p: Partie, modele: Partie): Partie => ({ ...p, foot: modele.foot });\n`,
    });
    try {
      const rows = auditSceneFieldEditability(VIRTUAL_ROOT, program);
      for (const id of ['Emprise.x', 'Emprise.w']) expect(rows.find((r) => r.id === id)?.authors, id).toEqual(['src/ui/editor/Poignee.ts']);
    } finally { program.dispose(); }
  });
});

import type { HitLocation } from '../engine/types';
import type { FlowTestNode } from '../engine/flowCore';
import criticalsJson from './criticals.json';
import { deDeTirageDe } from './rangees';
import { datasetDe, type EntreeDe, type EntreeVivante } from './datasets';
import type { DeDeTable } from '../engine/tables';
import type * as critiquesDef from './schemas/defs/criticals';
import type { critEscalationSchema } from './schemas/defs/criticals';
import type { z } from 'zod';

/**
 * Tables de Blessures critiques par Localisation — LES DEUX systèmes (#1657 B2a, #1682) : le Livre de
 * base (« Traumatisme », LDB 18) et l'approche ALTERNATIVE d'Aux Armes (AA 07), servie quand la règle
 * facultative `combat-aa-blessures` vaut `aa`.
 *
 * La DONNÉE vit dans `criticals.json` (éditable au Compendium) : 8 documents-tables, un par
 * (`jeu` × `localisation`), chacun avec SON dé de tirage (`die`). Ce module n'est que le TYPE + le
 * chargement + la projection des Localisations. Ajouter/régler un Critique = éditer le JSON ; ajouter
 * un 9ᵉ tableau = ajouter un document, sans une ligne de moteur.
 *
 * EFFET IMMÉDIAT du coup = `ops: GameOp[]` (PB en ignorant BE+PA via `{op:'wounds', ignoreTB, ignoreAP}`,
 * LDB 18 l.62 ; États via `{op:'condition'}` ; colonne « Blessures » d'AA 07 l.40 en `{op:'wounds'}`),
 * appliqué par `applyOps` — MÊME langue que sorts/traits/maladies. `test` = nœud `test` du Flow,
 * auto-résolu (RNG seedé) : sa branche `fail` porte la conséquence. `lethal` = résultat « Mort »
 * (instantané + sauvetage par Destin — PAS un simple `reduceToZero`). `traumas` = SPEC de Trauma à
 * engendrer. `desc` = texte canon (LONG TERME), verbatim.
 */
export type CritEntry = CritDoc['entries'][number];

/** Le nœud `test` du `Flow` (`engine/flowCore.ts`) tel qu'une rangée de Critique le porte — la forme
 *  UNIQUE du jet en donnée, partagée avec les sorts, les talents et les scènes. Jamais une graphie
 *  propriétaire : l'atelier du Codex l'édite avec le `FlowEditor` commun. */
export type CritTestNode = FlowTestNode;

/** SYSTÈME de règles dont un tableau est tiré — le DISCRIMINANT de la collection (`jeu` du document). */
export type JeuDeCritique = CritDoc['jeu'];

/** Famille de Localisation d'un tableau : les 4 tables couvrent les 6 `HitLocation` (LDB 18). */
export type CritTableKey = CritDoc['localisation'];

/** Déclaration d'escalade gatée par les soins — partagée par les deux jeux. Instanciée par
 *  `stampCriticalEscalation` (trauma.ts) sur la plaie chirurgicale du critique. */
export type CritEscalation = z.output<typeof critEscalationSchema>;
export type CritTable = CritEntry[];

/** Un document-table de `criticals.json` : l'ENVELOPPE de la fabrique (identité, `source`…), ses
 *  rangées (`DocumentARangees`, `grammaire/document.ts`) et son dé de tirage (`die`), plus SON jeu et
 *  SA Localisation. */
export type CritDoc = EntreeVivante<EntreeDe<typeof critiquesDef>>;

/** Les 8 documents-tables, dans leur ordre authoré (LDB puis Aux Armes). */
export const CRITIQUE_DOCS: CritDoc[] = datasetDe<typeof critiquesDef>(criticalsJson);

/**
 * Rangées LIVE d'UN document-table, par id de DOCUMENT — FAIL-FAST : un id absent laisserait une
 * catégorie Codex sur un tableau vide, sans un mot (patron `rangeesDe`, `src/data/rangees.ts`).
 */
export function critiqueEntries(docId: string): CritTable {
  const doc = CRITIQUE_DOCS.find((d) => d.id === docId);
  if (!doc) {
    throw new Error(`critiqueEntries : tableau « ${docId} » absent de criticals.json (ids : ${CRITIQUE_DOCS.map((d) => d.id).join(', ')}).`);
  }
  return doc.entries;
}

/** Table de rattachement d'une Localisation (repli Bras, LDB 76 l.21, pour une loc sans table dédiée) —
 *  SOURCE UNIQUE de la projection loc→clé de table, partagée par `critiqueTable` (les lignes) et par la
 *  déclaration d'étape à table (l'`id` de table tirée). */
export function critTableKeyFor(location: HitLocation): CritTableKey {
  if (location === 'tete' || location === 'corps') return location;
  if (location === 'jambeG' || location === 'jambeD') return 'jambe';
  return 'bras';
}

/**
 * Le document-table d'un (`jeu`, `localisation`) — FAIL-FAST : un jeu ou une famille sans document
 * est une donnée amputée, pas un cas à absorber en silence.
 */
export function critiqueDoc(jeu: JeuDeCritique, key: CritTableKey): CritDoc {
  const doc = CRITIQUE_DOCS.find((d) => d.jeu === jeu && d.localisation === key);
  if (!doc) throw new Error(`critiqueDoc : aucun tableau « ${jeu} » pour la Localisation « ${key} » dans criticals.json.`);
  return doc;
}

/** Le DÉ DE TIRAGE du tableau d'un (`jeu`, `localisation`) : le `die` VIVANT de son document
 *  (`deDeTirageDe`), lu à l'appel. */
export function critiqueDie(jeu: JeuDeCritique, key: CritTableKey): DeDeTable {
  return deDeTirageDe<typeof critiquesDef>(criticalsJson, critiqueDoc(jeu, key).id);
}

/**
 * Table de Critiques d'une Localisation, dans le JEU actif — REPLI sur le Tableau des BRAS pour toute
 * Localisation SANS Tableau dédié (tentacule, queue, aile isolée…), résultat décrit pour la loc réelle
 * touchée (LDB 76 l.21). SOURCE UNIQUE de la résolution loc→table : `resolveCritique` passe TOUJOURS
 * par ici, jamais un cas par-nom dispersé. Aujourd'hui les 6 `HitLocation` sont toutes couvertes par
 * une table dédiée (le repli n'y est jamais exercé) — invariant gardé par `criticals.test.ts`.
 */
export function critiqueTable(jeu: JeuDeCritique, location: HitLocation): CritTable {
  return critiqueDoc(jeu, critTableKeyFor(location)).entries;
}

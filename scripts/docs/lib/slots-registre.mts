// VOLET SLOTS du doc `docs/structures-donnees.md` (#1466 L1a, volet A) — le côté DÉCLARÉ des
// références, croisé au côté OBSERVÉ du scan. Lib PURE : consommée par le générateur
// `scripts/docs/build-structures.mts` et les gardes de `src/data/` (`slots-contrat`, `refs-migrated`…).
//
// Le DÉCLARÉ est ce que le PARSE valide (#1473 R1) : chaque document est parsé par son schéma réel
// au PARSE DE MESURE (`reperesDuParse`, `src/data/schemas/grammaire/ref.ts`), et chaque case
// `(porteur, clé)` dont la valeur est validée par `idDe` est un SLOT, avec son type.
//
// MANDAT et ANGLES MORTS de ce volet : SOURCES UNIQUES `MANDAT_SLOTS` / `ANGLES_MORTS_SLOTS`
// (`scripts/docs/lib/structures-lexique.mts`) — ils ne se reformulent nulle part.
import { SCHEMA_DEFS } from '../../../src/data/schemas/_registry.generated';
import { SCHEMA_DEFS_SCENES } from '../../../src/data/schemas/_registry-scenes.generated';
import type { SchemaDef } from '../../../src/data/schemas/types';
import { estFeuilleDId, mesureDuParse, reperesDuParse, type TypeEntite } from '../../../src/data/schemas/grammaire/ref';
import { defDe, descendre, enfantsDe } from '../../../src/data/schemas/grammaire/descente';
import { OP_DEFS } from '../../../src/data/schemas/grammaire/mecanique';
import { nomDeDocument, type OccurrenceDeReference, type ReferencesParPorteur } from './structures-scan.mjs';
import { parUnitesDeCode } from '../../guards/lib/lister.mjs';

/**
 * Les defs des DEUX racines, keyées comme le scan key ses documents : par BASENAME. Les defs de
 * `src/scenes` déclarent un CHEMIN RELATIF (`arene/arene-projet.json`) là où `listerDocuments` rend
 * un basename — sans cette normalisation la jointure déclaré × observé serait VIDE sur les scènes.
 */
export function defsDeDocument(): SchemaDef[] {
  return [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES].map((d) => ({ ...d, file: nomDeDocument(d.file) }));
}

/**
 * Un SLOT : une case `(porteur, clé)` d'un document du scan dont la valeur est validée par `idDe` au
 * parse de mesure, avec son type. `path` : son path de DONNÉE, indices normalisés en `[]` ; une
 * référence portée par une CLÉ de record s'y écrit `{}` (la case est alors `(record, clé)`).
 */
export type Slot = {
  readonly dataset: string;
  readonly path: string;
  readonly type: TypeEntite;
  readonly porteur: object;
  readonly cle: string | number;
  readonly parCle: boolean;
};

/** Path de DONNÉE écrit en POSITION de schéma, que le registre des slots regroupe : un rang s'écrit
 *  `[]`, et la clé de record qui porte la référence `{}` (`parCle`) — `[].effects.steps[].test.skill`,
 *  `hauteurs{}`. */
function pathNormalise(path: readonly PropertyKey[], parCle: boolean): string {
  const segments = path.map((k, i) => (parCle && i === path.length - 1 ? '{}' : typeof k === 'number' ? '[]' : `.${String(k)}`));
  return segments.join('').replace(/^\./, '');
}

/** Le nœud du document au path d'un repère, et son porteur (le nœud qui le contient). */
function auPath(dataset: string, document: unknown, path: readonly PropertyKey[]): { porteur: unknown; noeud: unknown } {
  let porteur: unknown = null;
  let noeud: unknown = document;
  for (const k of path) {
    if (noeud === null || typeof noeud !== 'object')
      throw new Error(`slots : le repère « ${path.map(String).join('.')} » de ${dataset} ne descend pas dans le document parsé.`);
    porteur = noeud;
    noeud = (noeud as Record<PropertyKey, unknown>)[k];
  }
  return { porteur, noeud };
}

/** Les slots d'UN document : chaque repère de son parse de mesure, rendu en case du document. */
function slotsDuDocument(dataset: string, schema: SchemaDef['schema'], document: unknown): Slot[] {
  return reperesDuParse(schema, document).map((r) => {
    const { porteur, noeud } = auPath(dataset, document, r.path);
    if (porteur === null || typeof porteur !== 'object' || (!r.parCle && typeof noeud !== 'string'))
      throw new Error(`slots : le repère « ${r.path.map(String).join('.')} » de ${dataset} ne tombe sur aucune chaîne du document parsé.`);
    const cle = r.path[r.path.length - 1] as string | number;
    return { dataset, path: pathNormalise(r.path, r.parCle), type: r.type, porteur, cle, parCle: r.parCle };
  });
}

/** Ce que la jointure lit du scan : les documents PARSÉS et les occurrences keyées par leur case. */
export type ScanDesReferences = {
  brutParNom: ReadonlyMap<string, unknown>;
  referencesParPorteur: ReferencesParPorteur;
  occurrencesDeReference: readonly OccurrenceDeReference[];
};

/** Tous les slots des documents du scan, parsés par leur def (`defsDeDocument`). */
export function slotsDuParse(scan: Pick<ScanDesReferences, 'brutParNom'>, defs: readonly SchemaDef[] = defsDeDocument()): Slot[] {
  return defs.filter((d) => scan.brutParNom.has(d.file)).flatMap((d) => slotsDuDocument(d.file, d.schema, scan.brutParNom.get(d.file)));
}

/**
 * Les NŒUDS D'OP que le parse de mesure atteint (`mesureDuParse › ops`) dans les documents du scan,
 * par IDENTITÉ d'objet : un nœud `GameOp` du corpus absent de cet ensemble n'est validé par aucun
 * schéma — ses références échappent au parse.
 */
export function opsDuParse(scan: Pick<ScanDesReferences, 'brutParNom'>, defs: readonly SchemaDef[] = defsDeDocument()): Set<object> {
  const atteintes = new Set<object>();
  for (const d of defs) {
    if (!scan.brutParNom.has(d.file)) continue;
    const document = scan.brutParNom.get(d.file);
    for (const path of mesureDuParse(d.schema, document).ops) {
      const { noeud } = auPath(d.file, document, path);
      if (noeud === null || typeof noeud !== 'object')
        throw new Error(`ops : le repère « ${path.map(String).join('.')} » de ${d.file} ne tombe sur aucun objet du document parsé.`);
      atteintes.add(noeud);
    }
  }
  return atteintes;
}

/**
 * CHAMPS D'OP À SLOT, lus STATIQUEMENT sur `OP_DEFS` : pour chaque op (chaque membre objet d'une union
 * comprise), chaque champ dont le sous-arbre porte une feuille `idDe`. Une op IMBRIQUÉE (`z.lazy` vers
 * `gameOpSchema`) n'y compte pas : son payload est lu par un raffinement, pas par un enfant du schéma
 * (`grammaire/descente.ts › enfantsDe`), et chaque op a son entrée ici.
 * Clé : `op.champ`, la graphie de `GAMEOP_FIELD_TARGETS` (`scripts/guards/lib/gameOpRefFk.mjs`).
 */
export function champsDOpASlot(opDefs: Readonly<Record<string, unknown>> = OP_DEFS): Set<string> {
  const out = new Set<string>();
  for (const [op, schema] of Object.entries(opDefs)) {
    const membres = defDe(schema)?.type === 'union' ? enfantsDe(schema).map((e) => e.noeud) : [schema];
    for (const membre of membres) {
      for (const champ of enfantsDe(membre)) {
        if (champ.cle === undefined || champ.cle === 'op') continue;
        let aFeuille = false;
        descendre([champ.noeud], ({ noeud }) => {
          if (estFeuilleDId(noeud)) aFeuille = true;
        });
        if (aFeuille) out.add(`${op}.${champ.cle}`);
      }
    }
  }
  return new Set([...out].sort(parUnitesDeCode));
}

/** Un nœud d'op du corpus, tel que le rend `scanGameOpRefs` (`scripts/guards/lib/gameOpRefFk.mjs › noeudsDOp`). */
export type NoeudDOp = { readonly file: string; readonly path: string; readonly op: string; readonly noeud: object };

/** Une chaîne d'un champ d'op à slot qu'AUCUN parse ne juge. */
export type ValeurNonJugee = { dataset: string; path: string; op: string; champ: string; valeur: string };

/**
 * Les chaînes des CHAMPS D'OP À SLOT (`champsASlot`) portées par les nœuds d'op HORS du parse de
 * mesure (absents de `atteintes`, `opsDuParse`), qui ne sont pas une CASE `(porteur, clé)` des slots
 * de leur document (`slotsDuParse`). Le scan des refs d'op saute ces champs parce que le parse les
 * juge : un nœud non atteint n'a pas de parse d'op, sa seule preuve est le parse de SON document.
 */
export function slotsDOpNonJuges(
  noeuds: readonly NoeudDOp[],
  atteintes: ReadonlySet<object>,
  slots: readonly Slot[],
  champsASlot: ReadonlySet<string>,
): ValeurNonJugee[] {
  const cases = new Map<object, Set<string | number>>();
  for (const s of slots) {
    if (s.parCle) continue;
    if (!cases.has(s.porteur)) cases.set(s.porteur, new Set());
    cases.get(s.porteur)!.add(s.cle);
  }
  const out: ValeurNonJugee[] = [];
  for (const n of noeuds) {
    if (atteintes.has(n.noeud)) continue;
    for (const [champ, valeur] of Object.entries(n.noeud)) {
      if (!champsASlot.has(`${n.op}.${champ}`)) continue;
      const visiter = (porteur: object, cle: string | number, v: unknown, path: string) => {
        if (typeof v === 'string') {
          if (!cases.get(porteur)?.has(cle)) out.push({ dataset: n.file, path, op: n.op, champ, valeur: v });
          return;
        }
        if (Array.isArray(v)) { v.forEach((x, i) => visiter(v, i, x, `${path}[${i}]`)); return; }
        if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visiter(v, k, x, `${path}.${k}`);
      };
      visiter(n.noeud, champ, valeur, `${n.path}.${champ}`);
    }
  }
  return out;
}

const cleDeCouple = (c: { dataset: string; champ: string }) => `${c.dataset} | ${c.champ}`;

/** Les CASES `(porteur, clé)` inscrites par le scan qui sont des slots. */
function casesTouchees(scan: ScanDesReferences, slots: readonly Slot[]): Map<object, Set<string | number>> {
  const touchees = new Map<object, Set<string | number>>();
  for (const s of slots) {
    if (!scan.referencesParPorteur.get(s.porteur)?.has(s.cle)) continue;
    if (!touchees.has(s.porteur)) touchees.set(s.porteur, new Set());
    touchees.get(s.porteur)!.add(s.cle);
  }
  return touchees;
}

/**
 * Les occurrences de référence OBSERVÉES que des slots TOUCHENT : celles dont une case au moins est un
 * slot. Toucher n'est pas atteindre : une occurrence n'est ATTEINTE que si TOUTES ses cases le sont
 * (`couplesDeReference`).
 */
export function occurrencesTouchees(scan: ScanDesReferences, slots: readonly Slot[]): Set<OccurrenceDeReference> {
  const touchees = new Set<OccurrenceDeReference>();
  for (const [porteur, cles] of casesTouchees(scan, slots))
    for (const k of cles) touchees.add(scan.referencesParPorteur.get(porteur)!.get(k)!);
  return touchees;
}

/** Une ligne du registre des slots (doc §6.1) : un (document, path, type), ses valeurs et les couples qu'elles touchent. */
export type LigneDeSlots = { dataset: string; path: string; type: TypeEntite; valeurs: number; couples: string[] };

/** Le REGISTRE des slots, une ligne par (document, path de slot, type), triée. */
export function registreDesSlots(scan: ScanDesReferences, slots: readonly Slot[]): LigneDeSlots[] {
  const groupes = new Map<string, Slot[]>();
  for (const s of slots) {
    const k = `${s.dataset}\u0000${s.path}\u0000${s.type}`;
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k)!.push(s);
  }
  return [...groupes.values()]
    .map((g) => ({
      dataset: g[0].dataset,
      path: g[0].path,
      type: g[0].type,
      valeurs: g.length,
      couples: [...new Set([...occurrencesTouchees(scan, g)].map(cleDeCouple))].sort(parUnitesDeCode),
    }))
    .sort((a, b) => parUnitesDeCode(a.dataset, b.dataset) || parUnitesDeCode(a.path, b.path) || parUnitesDeCode(a.type, b.type));
}

/** Un couple `(dataset, champ)` de la strate `Référence` : ses occurrences OBSERVÉES, et celles que le déclaré ATTEINT. */
export type CoupleDeReference = { dataset: string; champ: string; occurrences: number; atteintes: number };

/**
 * Tous les couples observés, avec leur compte d'occurrences et la part ATTEINTE : une occurrence l'est
 * quand elle a au moins une case et que chacune est un slot.
 */
export function couplesDeReference(scan: ScanDesReferences, slots: readonly Slot[]): CoupleDeReference[] {
  const touchees = casesTouchees(scan, slots);
  const avecCase = new Set<OccurrenceDeReference>();
  const manquees = new Set<OccurrenceDeReference>();
  for (const [porteur, cases] of scan.referencesParPorteur)
    for (const [k, o] of cases) {
      avecCase.add(o);
      if (!touchees.get(porteur)?.has(k)) manquees.add(o);
    }
  const couples = new Map<string, CoupleDeReference>();
  for (const o of scan.occurrencesDeReference) {
    const cle = cleDeCouple(o);
    if (!couples.has(cle)) couples.set(cle, { dataset: o.dataset, champ: o.champ, occurrences: 0, atteintes: 0 });
    const c = couples.get(cle)!;
    c.occurrences += 1;
    if (avecCase.has(o) && !manquees.has(o)) c.atteintes += 1;
  }
  return [...couples.values()].sort((a, b) => parUnitesDeCode(a.dataset, b.dataset) || parUnitesDeCode(a.champ, b.champ));
}

/**
 * COUVERTURE : les couples porteurs de références OBSERVÉES (strate `Référence` du scan) dont une
 * occurrence au moins n'est pas ATTEINTE (une de ses cases n'est pas un slot). C'est la dette d'ADOPTION du registre — elle se
 * solde concept par concept en L2/L3 (#1473), jamais en retirant une ligne seule. Stock
 * `SLOTS_SANS_DECLARATION`, keyé par le compte OBSERVÉ total ; ce que la mesure ne voit pas est dit
 * à `ANGLES_MORTS_SLOTS`.
 */
export function champsSansSlot(scan: ScanDesReferences, slots: readonly Slot[]): CoupleDeReference[] {
  return couplesDeReference(scan, slots).filter((c) => c.atteintes < c.occurrences);
}

/** Un couple et le compte de ses occurrences INATTEIGNABLES. */
export type CoupleInatteignable = { dataset: string; champ: string; occurrences: number };

/**
 * INATTEIGNABLES : par couple, les occurrences dont AUCUNE case ne porte de chaîne — aucune n'est un
 * slot, quel que soit le schéma. Stock `SLOTS_INATTEIGNABLES`.
 */
export function occurrencesInatteignables(scan: ScanDesReferences): CoupleInatteignable[] {
  const atteignables = new Set<OccurrenceDeReference>();
  for (const [porteur, cases] of scan.referencesParPorteur)
    for (const [k, o] of cases) if (typeof (porteur as Record<string | number, unknown>)[k] === 'string') atteignables.add(o);
  const couples = new Map<string, CoupleInatteignable>();
  for (const o of scan.occurrencesDeReference) {
    if (atteignables.has(o)) continue;
    const cle = cleDeCouple(o);
    if (!couples.has(cle)) couples.set(cle, { dataset: o.dataset, champ: o.champ, occurrences: 0 });
    couples.get(cle)!.occurrences += 1;
  }
  return [...couples.values()].sort((a, b) => parUnitesDeCode(a.dataset, b.dataset) || parUnitesDeCode(a.champ, b.champ));
}

/** Les couples dont TOUTES les occurrences observées sont ATTEINTES — la JOINTURE. */
export function champsJoints(scan: ScanDesReferences, slots: readonly Slot[]): string[] {
  return couplesDeReference(scan, slots)
    .filter((c) => c.atteintes === c.occurrences)
    .map(cleDeCouple)
    .sort();
}

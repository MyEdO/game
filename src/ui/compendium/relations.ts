/**
 * Brique RELATIONNELLE du Codex — SOURCE UNIQUE des références INVERSES (« qui pointe vers cette
 * entité ? ») et de l'index par livre. Construite en inversant les références DÉJÀ STRUCTURÉES de
 * `src/data` (creature.traits/skills/talents/spells/trappings ; careerLevel.* ; species.* ;
 * talent.passive grantCareer* ; spell.domainId + gods.* ; trapping.qualities/subType ;
 * trait.grantsManeuvers ; mutation.traits ; skill.characteristic).
 *
 * **100 % id-based → langue-agnostique** : on inverse des `id` STABLES, jamais des libellés. Le
 * `label` porté par un `Referrer` n'est QUE l'affichage (= `CodexItem.label`, résolu par
 * `codexLookup`). Aucune regex, aucune logique branchée sur du texte.
 *
 * **Fraîcheur** : comme les projections du registre (`makeCategory`), les index (graphe inverse,
 * catalogue par livre, index de libellés, regex d'auto-liage) sont RE-CALCULÉS quand la version du
 * Codex bouge (`codexLookupVersion` / `invalidateCodexLookup`, bumpée au persist d'une édition). Les
 * datasets étant mutés EN PLACE (`overrides.ts::setDataset`), re-construire relit la donnée FRAÎCHE —
 * les sections inverses, le contenu des fiches Livre et l'auto-liage suivent une édition sans reload.
 *
 * Le registre (`registry.ts`) en tire les SECTIONS inverses ; les refs AVANT restent projetées par
 * le registre (rendu riche : choix « A ou B », Indices d'instance) — ici, c'est la couche d'INVERSION
 * et d'INDEX, pas une seconde copie des refs avant.
 */
import {
  species, careers, careerLevels, skills, talents, trappings, creatures, traits, mutations,
  spells, gods, domains, classes, maneuvers, qualities, characteristics, etats, maladies,
  locations, stars, mutationTables, advancementBaseId, careersForSpecies, findCareerById,
} from '../../data';
import type { AdvancementRef } from '../../data';
import { isOptionalNote } from '../../engine/statEntry';
import { effectiveEntry } from '../../engine/variants';
import { spellEffectOps } from '../../state/flow';
import type { Flow, TriggeredEffect } from '../../state/flow';
import { codexLookupVersion } from './registry';
import { resolveQualities } from '../../engine/qualities/dispatch';

/** Un référant (entité QUI pointe vers la cible) — ouvrable au Codex via (category, id). */
export interface Referrer {
  /** Catégorie Codex du référant (clé de `CODEX`) — pour le lien `CodexRef`. */
  category: string;
  /** Identité STABLE du référant (`CodexItem.id`) — clé de dédoublonnage/navigation. */
  id: string;
  /** Libellé d'affichage = `CodexItem.label`. */
  label: string;
  /** Contexte optionnel (« N2 », « facultatif »…) — fusionné en cas de doublon. */
  detail?: string;
}
/** Un groupe de référants de MÊME catégorie (rendu en UNE section inverse). */
export interface ReverseGroup {
  category: string;
  /** Titre FR de la section (display — « Créatures ayant ce trait »…). */
  title: string;
  referrers: Referrer[];
}

/** Accès à une projection RE-CALCULÉE quand la version du Codex bouge (persist d'une édition —
 *  `invalidateCodexLookup`) : miroir de `makeCategory` (registry.ts). Construite paresseusement,
 *  cachée tant que `codexLookupVersion()` ne change pas ; le prochain accès après invalidation
 *  reconstruit depuis les datasets live. */
function versionCached<T>(build: () => T): () => T {
  let value: T;
  let builtAt = -1;
  return () => {
    const v = codexLookupVersion();
    if (builtAt !== v) {
      value = build();
      builtAt = v;
    }
    return value;
  };
}

// ── Construction du graphe inverse ─────────────────────────────────────────────
// Clé = `${targetCategory}:${targetId}` → liste BRUTE de référants (dédupliquée à la lecture). Titres
// FR des sections DÉCLARÉS AU SITE de chaque relation (4e argument d'`addReverse`), clé
// `${targetCat}:${refCat}` ; sans titre déclaré, `GENERIC_PLURAL` en repli.
const rkey = (cat: string, id: string): string => `${cat}:${id}`;

interface ReverseGraph {
  /** `${targetCat}:${targetId}` → référants bruts. */
  reverse: Map<string, Referrer[]>;
  /** `${targetCat}:${refCat}` → titre FR de section. */
  titles: Map<string, string>;
}

/** ids de base d'une liste d'`AdvancementRef` (référence, régime de spécialisation compris ;
 *  `{pick}` → chaque branche de son `of`). */
function advancementIds(list: AdvancementRef[] | undefined): string[] {
  const out: string[] = [];
  for (const a of list ?? []) {
    if ('pick' in a) out.push(...advancementIds(a.of));
    else { const id = advancementBaseId(a); if (id) out.push(id); }
  }
  return out;
}

/** États INFLIGÉS — ops `condition` des effets (Sort = Flow ; Trait/Qualité/Talent/Domaine =
 *  TriggeredEffect[].flow). On réutilise le walker `spellEffectOps` (zéro parsing maison). */
const conditionIdsInFlow = (flow: Flow | undefined): string[] =>
  spellEffectOps(flow).flatMap((o) => (o.op === 'condition' ? [o.id] : []));
const conditionIdsInEffects = (effects: TriggeredEffect[] | undefined): string[] =>
  (effects ?? []).flatMap((e) => conditionIdsInFlow(e.flow));

/** Graphe inverse + titres, RE-CALCULÉ à chaque version : inverse les références structurées de `src/data`. */
const graph = versionCached<ReverseGraph>(() => {
  const REVERSE = new Map<string, Referrer[]>();
  const TITLES = new Map<string, string>();

  /** Enregistre une arête inverse : `target` (cat,id) est référencée PAR `by` (referrer).
   *  `title` = titre FR de la section inverse pour cette paire (cible, catégorie du référant). */
  const addReverse = (targetCat: string, targetId: string | null | undefined, by: Referrer, title?: string): void => {
    if (title) TITLES.set(`${targetCat}:${by.category}`, title);
    if (!targetId) return;
    const k = rkey(targetCat, targetId);
    const arr = REVERSE.get(k);
    if (arr) arr.push(by);
    else REVERSE.set(k, [by]);
  };

  // 1) Espèces (cat `races`) → compétences/talents de race + carrières accessibles.
  for (const s of species) {
    const by: Referrer = { category: 'races', id: s.id, label: s.label };
    for (const id of advancementIds(s.skills)) addReverse('skills', id, by);
    for (const id of advancementIds(s.talents)) addReverse('talents', id, by);
    // Carrières accessibles à l'espèce (LDB 05) → inverse « Races y accédant » sur la carrière.
    for (const c of careersForSpecies(s.refCareer)) addReverse('careers', c.id, by, 'Races y accédant');
  }

  // 2) Carrières (cat `careers`) → classe.
  for (const c of careers) addReverse('classes', c.class, { category: 'careers', id: c.id, label: c.label }, 'Carrières de la classe');

  // 3) Niveaux de carrière → compétences/talents/possessions/caractéristiques (référant = la CARRIÈRE, rang en détail).
  for (const lv of careerLevels) {
    const career = findCareerById(lv.career);
    if (!career) continue;
    const by: Referrer = { category: 'careers', id: career.id, label: career.label, detail: `N${lv.level}` };
    for (const id of advancementIds(lv.skills)) addReverse('skills', id, by, 'Carrières (par rang)');
    for (const id of advancementIds(lv.talents)) addReverse('talents', id, by, 'Carrières (par rang)');
    for (const k of lv.characteristics) addReverse('characteristics', k, by, 'Carrières (avancée)');
    for (const t of lv.trappings) if ('id' in t) addReverse('trappings', t.id, by, 'Carrières (par rang)');
  }

  // 4) Compétences → caractéristique de test.
  for (const s of skills) addReverse('characteristics', s.characteristic, { category: 'skills', id: s.id, label: s.label }, 'Compétences liées');

  // 5) Talents → octrois de carrière (grantCareerSkill/Talent) + bonus de carac (charMod).
  for (const t of talents) {
    const by: Referrer = { category: 'talents', id: t.id, label: t.label };
    for (const op of t.passive ?? []) {
      if (op.op === 'grantCareerSkill') addReverse('skills', op.skill.id, by, 'Talents le conférant');
      else if (op.op === 'grantCareerTalent') addReverse('talents', op.talent.id, by, 'Talents le conférant');
      else if (op.op === 'charMod') addReverse('characteristics', op.char, by, 'Talents (bonus de départ)');
    }
  }

  // 6) Créatures → traits (+ facultatifs) · compétences · talents · sorts · possessions.
  for (const c of creatures) {
    const by: Referrer = { category: 'creatures', id: c.id, label: c.label };
    for (const tr of c.traits) addReverse('traits', tr.id, by, 'Créatures ayant ce trait');
    // Les optionnels COMPOSÉS (notes « tous les traits »/« swap ») n'ont pas d'`id` de trait → seuls
    // les optionnels ORDINAIRES (`TraitInstance`) alimentent le rétro-liage « facultatif de X ».
    for (const tr of c.optionals) if (!isOptionalNote(tr)) addReverse('traits', tr.id, { ...by, detail: 'facultatif' }, 'Créatures ayant ce trait');
    for (const sk of c.skills) addReverse('skills', sk.id, by);
    for (const ta of c.talents) addReverse('talents', ta.id, by);
    for (const sp of c.spells) addReverse('spells', sp, by, 'Créatures la lançant');
    for (const tp of c.trappings) if ('id' in tp) addReverse('trappings', tp.id, by, 'Créatures la possédant');
  }

  // 7) Possessions → qualités + groupe d'objet.
  for (const t of trappings) {
    const by: Referrer = { category: 'trappings', id: t.id, label: t.label };
    for (const r of resolveQualities({ qualities: t.qualities, subType: t.subType })) addReverse('qualities', r.id, by, 'Équipements ayant cette qualité');
    addReverse('weaponGroups', t.subType, by, 'Objets du groupe');
  }

  // 8) Classes → possessions de départ.
  for (const cl of classes) {
    const by: Referrer = { category: 'classes', id: cl.id, label: cl.label };
    for (const t of cl.trappings) if ('id' in t) addReverse('trappings', t.id, by, 'Possession de classe');
  }

  // 9) Traits → manœuvres conférées.
  for (const t of traits) {
    const by: Referrer = { category: 'traits', id: t.id, label: t.label };
    for (const m of t.grantsManeuvers ?? []) addReverse('maneuvers', m.id, by, 'Traits l’accordant');
  }

  // 10) Mutations → traits conférés.
  for (const m of mutations) {
    const by: Referrer = { category: 'mutations', id: m.id, label: m.label };
    for (const op of m.passive ?? []) if (op.op === 'grantTrait') addReverse('traits', op.traitId, by, 'Mutations conférant ce trait');
  }

  // 11) Sorts → domaine.
  for (const s of spells) addReverse('domains', s.domainId, { category: 'spells', id: s.id, label: s.label }, 'Sorts du domaine');

  // 12) Dieux/Cultes → bénédictions + miracles.
  for (const g of gods) {
    const by: Referrer = { category: 'gods', id: g.id, label: g.label };
    for (const b of g.blessings) addReverse('spells', b, { ...by, detail: 'Bénédiction' }, 'Cultes (Bénédictions / Miracles)');
    for (const mi of g.miracles) addReverse('spells', mi, { ...by, detail: 'Miracle' }, 'Cultes (Bénédictions / Miracles)');
    for (const cs of g.chaosSpells ?? []) addReverse('spells', cs, { ...by, detail: 'Sort du Chaos' }, 'Cultes (Bénédictions / Miracles)');
  }

  // 13) États INFLIGÉS — ops `condition` des effets (Sort = Flow ; Trait/Qualité/Talent/Domaine = TriggeredEffect[].flow).
  for (const s of spells.map((x) => effectiveEntry(x))) for (const id of conditionIdsInFlow(s.effects)) addReverse('etats', id, { category: 'spells', id: s.id, label: s.label }, 'Sorts l’infligeant');
  for (const t of traits) for (const id of conditionIdsInEffects(t.effects)) addReverse('etats', id, { category: 'traits', id: t.id, label: t.label }, 'Traits l’infligeant');
  for (const q of qualities) for (const id of conditionIdsInEffects(q.effects)) addReverse('etats', id, { category: 'qualities', id: q.id, label: q.label }, 'Qualités d’arme l’infligeant');
  for (const t of talents) for (const id of conditionIdsInEffects(t.effects)) addReverse('etats', id, { category: 'talents', id: t.id, label: t.label }, 'Talents l’infligeant');
  for (const d of domains) for (const id of conditionIdsInEffects(d.effects)) addReverse('etats', id, { category: 'domains', id: d.id, label: d.label }, 'Domaines l’infligeant');

  // 14) Mutation ← Table de Corruption qui la tire (inversion de mutationTable.ranges[].mutation).
  for (const tab of mutationTables) for (const r of tab.ranges) addReverse('mutations', r.mutation, { category: 'mutationTables', id: tab.id, label: tab.label, detail: `${r.min}–${r.max}` }, 'Tables de Corruption la tirant');
  // 15) Lieu ← sous-lieux (inversion de location.parent, désormais un id de parent).
  for (const l of locations) if (l.parent) addReverse('locations', l.parent, { category: 'locations', id: l.id, label: l.label }, 'Sous-lieux');

  return { reverse: REVERSE, titles: TITLES };
});

// ── Repli des titres (display) : nom pluriel générique du référant, quand l'arête n'a pas déclaré
//    de titre (« Races », « Créatures »…). Les titres SPÉCIFIQUES vivent au site de chaque relation.
const GENERIC_PLURAL: Record<string, string> = {
  races: 'Races', careers: 'Carrières', classes: 'Classes', skills: 'Compétences', talents: 'Talents',
  trappings: 'Équipements', qualities: 'Qualités', creatures: 'Créatures', traits: 'Traits',
  mutations: 'Mutations', spells: 'Sorts', domains: 'Domaines', gods: 'Cultes', maneuvers: 'Manœuvres',
  weaponGroups: 'Groupes d’objet', characteristics: 'Caractéristiques', etats: 'États',
};
const reverseTitle = (targetCat: string, refCat: string): string =>
  graph().titles.get(`${targetCat}:${refCat}`) ?? GENERIC_PLURAL[refCat] ?? refCat;

/** Ordre stable des catégories (référants d'une fiche ET contenu d'un livre) — les plus parlantes
 *  d'abord ; une catégorie hors liste est repoussée en fin (via `orderOf`). */
const REF_CAT_ORDER = ['races', 'classes', 'careers', 'characteristics', 'skills', 'talents', 'creatures', 'mutations', 'mutationTables', 'trappings', 'qualities', 'weaponGroups', 'spells', 'domains', 'gods', 'traits', 'maneuvers', 'etats', 'maladies', 'stars', 'locations'];
const orderOf = (cat: string): number => (REF_CAT_ORDER.indexOf(cat) + 1) || 99;

/**
 * Références INVERSES d'une entité (category, id) — GROUPÉES par catégorie de référant, dédupliquées
 * (un même référant à plusieurs rangs fusionne ses détails), triées (ordre stable puis alpha).
 * Vide si l'entité n'est référencée nulle part. Source unique des sections « inverses » du Codex.
 */
export function reverseGroups(category: string, id: string): ReverseGroup[] {
  const raw = graph().reverse.get(rkey(category, id));
  if (!raw?.length) return [];
  const byCat = new Map<string, Map<string, Referrer>>(); // refCat → (id → référant fusionné)
  for (const r of raw) {
    const m = byCat.get(r.category) ?? new Map<string, Referrer>();
    const prev = m.get(r.id);
    if (prev) {
      // Fusion des détails distincts (« N1 » + « N2 » → « N1, N2 »).
      const details = new Set([...(prev.detail ? prev.detail.split(', ') : []), ...(r.detail ? [r.detail] : [])]);
      prev.detail = details.size ? [...details].join(', ') : undefined;
    } else m.set(r.id, { ...r });
    byCat.set(r.category, m);
  }
  const groups: ReverseGroup[] = [];
  for (const cat of [...byCat.keys()].sort((a, b) => orderOf(a) - orderOf(b))) {
    const referrers = [...byCat.get(cat)!.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    groups.push({ category: cat, title: reverseTitle(category, cat), referrers });
  }
  return groups;
}

// ── Index par LIVRE + index de libellés (auto-liage) ────────────────────────────────────────────
/** Une entité cataloguée : sa catégorie Codex, son identité STABLE, son libellé, son livre/page source. */
interface CatalogEntry { category: string; id: string; label: string; book?: string; page?: number; }

/** Liste plate de TOUTES les entités cataloguées (pour byBook + labelIndex), RE-CALCULÉE par version. */
const catalog = versionCached<CatalogEntry[]>(() => {
  const CATALOG: CatalogEntry[] = [];
  const pushCatalog = (category: string, items: { id: string; label: string; source?: { book: string; page: number } | null }[]): void => {
    for (const it of items) CATALOG.push({ category, id: it.id, label: it.label, book: it.source?.book, page: it.source?.page });
  };
  pushCatalog('races', species);
  pushCatalog('careers', careers);
  pushCatalog('classes', classes);
  pushCatalog('skills', skills);
  pushCatalog('talents', talents);
  pushCatalog('trappings', trappings);
  pushCatalog('qualities', qualities as { id: string; label: string; source?: { book: string; page: number } }[]);
  pushCatalog('etats', etats);
  pushCatalog('maneuvers', maneuvers);
  pushCatalog('domains', domains as { id: string; label: string; source?: { book: string; page: number } }[]);
  pushCatalog('spells', spells);
  pushCatalog('creatures', creatures as { id: string; label: string; source?: { book: string; page: number } }[]);
  pushCatalog('traits', traits);
  pushCatalog('mutations', mutations as { id: string; label: string; source?: { book: string; page: number } | null }[]);
  pushCatalog('stars', stars);
  pushCatalog('locations', locations as { id: string; label: string; source?: { book: string; page: number } }[]);
  pushCatalog('characteristics', characteristics as { id: string; label: string }[]);
  CATALOG.push(...gods.map((g) => ({ category: 'gods', id: g.id, label: g.label, book: g.source?.book, page: g.source?.page })));
  CATALOG.push(...maladies.map((m) => ({ category: 'maladies', id: m.id, label: m.label })));
  return CATALOG;
});

/** Contenu d'un livre, GROUPÉ par catégorie (« par type ») — pour la fiche Livre. Les entités portent
 *  leur livre dans `source.book` = l'`id` STABLE du livre (jamais un libellé) ; on matche par cet id
 *  (relation id-pure, i18n-safe). Trié par catégorie (`orderOf`) puis alpha. */
export function bookContents(bookId: string | undefined): { category: string; entries: { id: string; label: string }[] }[] {
  const keys = new Set(bookId ? [bookId] : []);
  const byCat = new Map<string, { id: string; label: string }[]>();
  for (const e of catalog()) {
    if (!e.book || !keys.has(e.book)) continue;
    const arr = byCat.get(e.category) ?? [];
    arr.push({ id: e.id, label: e.label });
    byCat.set(e.category, arr);
  }
  return [...byCat.entries()]
    .map(([category, entries]) => ({ category, entries: entries.sort((a, b) => a.label.localeCompare(b.label, 'fr')) }))
    .sort((a, b) => orderOf(a.category) - orderOf(b.category));
}

/**
 * Index d'auto-liage (LOCALE-SCOPED) : libellé normalisé (minuscule, sans accent) → (category, label)
 * de l'entité à lier. Construit depuis les libellés de la LOCALE active (ici FR) → 100 %
 * langue-agnostique de principe (dérivé des données, jamais une chaîne FR en dur). Les libellés
 * ambigus (même texte pour 2 entités) et trop courts (< 4) sont ÉCARTÉS pour ne pas sur-lier.
 * RE-CALCULÉ par version (suit une édition Codex).
 */
const deburrLower = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const labelIndexCached = versionCached<Map<string, { category: string; label: string }>>(() => {
  const seen = new Map<string, { category: string; label: string } | null>();
  for (const e of catalog()) {
    const key = deburrLower(e.label);
    if (key.length < 4) continue;
    seen.set(key, seen.has(key) ? null : { category: e.category, label: e.label }); // collision → null (ambigu)
  }
  return new Map([...seen.entries()].filter((x): x is [string, { category: string; label: string }] => x[1] != null));
});
export function labelIndex(): Map<string, { category: string; label: string }> {
  return labelIndexCached();
}

/** Catégories dont le VOCABULAIRE apparaît en prose (règles) → auto-liées dans les descriptions.
 *  On EXCLUT les noms propres (créatures/sorts/objets/lieux…) : ils bloatent le matcher et sur-lient. */
const LINKABLE_CATS = new Set(['characteristics', 'skills', 'talents', 'etats', 'maneuvers', 'traits', 'qualities', 'domains']);

/** ── HOMONYMES du vocabulaire auto-liable (même libellé NU, catégories DIFFÉRENTES) ──
 *  Collisions RÉELLES du catalogue (relevées 2026-07-13, `deburrLower` sur libellé entier), classées
 *  par NATURE — c'est elle qui DÉCIDE la résolution d'un match NU (sans contexte de fiche) :
 *
 *   A. MÊME concept, deux REPRÉSENTATIONS (un match nu tombe TOUJOURS juste — on LIE, priorité à la
 *      représentation canonique via `PRIORITY_CAT_ORDER`, cf. `SAME_CONCEPT_GROUPS`) :
 *      · talents⇄traits : un Talent joueur miroité en Trait de créature — `Béni`, `Frénésie`,
 *        `Haine`, `Résistance à la Magie`, `Vision nocturne` → on lie le TALENT (règle joueur).
 *      · maneuvers⇄traits : une attaque de créature = Trait passif + Manœuvre jouable — `Morsure`,
 *        `Attaque caudale`, `Cornes`, `Tentacules`, `Langue préhensile`, `Étreinte glaciale`,
 *        `Regard pétrifiant`, `Vomissement`, `Hurlement fantomatique`, `Hurlement de la Bête
 *        indomptable`, `Frisson paralysant` → on lie le TRAIT (forme descriptive citée en prose).
 *
 *   B. Concepts GENUINEMENT DIFFÉRENTS partageant un nom (un match nu n'est JAMAIS tranchable → on NE
 *      LIE PAS ; comportement sûr — la forme PRÉFIXÉE cible chaque sens sans ambiguïté, cf.
 *      `prefixedForms`) :
 *      · characteristics⇄traits : `Corruption` — la JAUGE d'âme (LDB 182) ≠ le Trait de créature.
 *        Nu → aucun lien ; « Points de Corruption » → la jauge. (Régression B3 corrigée : l'ancien
 *        `PRIORITY_CAT_ORDER` liait à tort le « Points de Corruption » d'« Âme pure » au TRAIT.)
 *      · skills⇄talents : `Résistance` — la Compétence ≠ le Talent. Nu → aucun lien ;
 *        « Compétence Résistance »/« Talent Résistance » tranche.
 *      · traits⇄qualities : `Infecté`, `Magique`, `Rapide`, `Taille` — Qualité d'arme ≠ Trait de
 *        créature. Nu → aucun lien.
 *
 *  `selfCategory` (catégorie de la fiche affichante) tranche AVANT cette politique (cf. `resolveLink`). */
const PRIORITY_CAT_ORDER = ['talents', 'traits', 'maneuvers'];
/** Groupes d'homonymes de NATURE A (cf. la table ci-dessus) : un match NU dont TOUTES les catégories
 *  candidates tiennent dans un même groupe est résolu par `PRIORITY_CAT_ORDER` (représentation
 *  canonique). Toute autre collision (nature B, ou débordant un groupe) reste NON liée (sûr). */
const SAME_CONCEPT_GROUPS: ReadonlySet<string>[] = [new Set(['talents', 'traits']), new Set(['maneuvers', 'traits'])];

/** Préfixe de catégorie au SINGULIER, pour les formes préfixées toujours non ambiguës (« Trait Vol »,
 *  « Sort Vol »). Dérivé du libellé PLURIEL déjà déclaré (`GENERIC_PLURAL`) — jamais une table en
 *  dur nouvelle : « Compétences » → « Compétence ». */
const catPrefix = (cat: string): string => { const p = GENERIC_PLURAL[cat] ?? cat; return p.endsWith('s') ? p.slice(0, -1) : p; };

/** Formes PRÉFIXÉES non ambiguës d'une entité liable — clés d'index toujours mono-catégorie :
 *  « Trait X »/« Sort X »/« Compétence X » (préfixe de catégorie au singulier), et pour les
 *  CARACTÉRISTIQUES la forme de JAUGE « Points de X »/« Point de X » : le labelItem naturel d'une
 *  jauge est « Points de … » (LDB 182 « Points de Corruption », caractéristique `corruption` —
 *  jamais « Caractéristique … »). Ces formes tranchent les homonymes de concepts distincts (nature B
 *  ci-dessus) sans ambiguïté. */
const prefixedForms = (cat: string, label: string): string[] =>
  cat === 'characteristics' ? [`Points de ${label}`, `Point de ${label}`] : [`${catPrefix(cat)} ${label}`];

interface LinkCandidate { category: string; id: string; label: string; }

/** Racines de surface (CASSE ORIGINALE conservée — c'est elle qui doit matcher le texte) qui
 *  alimentent le matcher : le libellé lui-même + sa forme préfixée par catégorie, dédupliquées,
 *  plus longues d'abord (« Magie des Arcanes » avant « Magie », « Talent Résistance » avant
 *  « Résistance »). */
const linkRootsCached = versionCached<string[]>(() => {
  const roots = new Set<string>();
  for (const e of catalog()) {
    if (!LINKABLE_CATS.has(e.category) || e.label.length < 4) continue;
    roots.add(e.label);
    for (const form of prefixedForms(e.category, e.label)) roots.add(form);
  }
  return [...roots].sort((a, b) => b.length - a.length);
});

/** Index d'auto-liage LINKABLE (LOCALE-SCOPED), MULTI-VALUÉ — à la différence de `labelIndex`
 *  (général, une collision = écartée), un même libellé peut résoudre PLUSIEURS entités (homonymes
 *  RÉELS, cf. `PRIORITY_CAT_ORDER`) : on ne jette plus, la désambiguïsation se fait à la RÉSOLUTION
 *  (`resolveLink`). Clés : libellé + formes préfixées par catégorie (le pluriel FR régulier est géré
 *  au MATCH par le pattern `linkRe` — chaque mot y accepte un « s » — et ramené au singulier à la
 *  résolution, cf. `lookupCandidates` ; l'index reste keyé au SINGULIER, pas de clés absurdes).
 *  RE-CALCULÉ par version (suit une édition Codex). */
const linkCandidatesCached = versionCached<Map<string, LinkCandidate[]>>(() => {
  const idx = new Map<string, LinkCandidate[]>();
  const add = (key: string, c: LinkCandidate): void => {
    if (key.length < 4) return;
    const arr = idx.get(key);
    if (arr) { if (!arr.some((x) => x.category === c.category && x.id === c.id)) arr.push(c); }
    else idx.set(key, [c]);
  };
  for (const e of catalog()) {
    if (!LINKABLE_CATS.has(e.category)) continue;
    const c: LinkCandidate = { category: e.category, id: e.id, label: e.label };
    add(deburrLower(e.label), c);
    for (const form of prefixedForms(e.category, e.label)) add(deburrLower(form), c);
  }
  return idx;
});

/** Id d'une entité cataloguée par son libellé — résolution de REPLI pour les appelants de
 *  `tokenizeLinks` qui ne connaissent que le libellé de leur propre fiche (Prose hors Codex, non
 *  migrés ce lot, cf. `CodexRef`) : MÊME mécanisme que `codexLookup` (registry.ts) — un Map, pas une
 *  comparaison d'égalité — la décision finale (anti-auto-lien) reste 100 % id-based en aval. */
const idByLabelCached = versionCached<Map<string, string>>(() => {
  const m = new Map<string, string>();
  // Construction seule (parcours inversé = première occurrence gagnante), aucune interrogation par
  // libellé (#602) : c'est un index de TEXTE, alimenté par la couture tolérée.
  const all = catalog();
  for (let i = all.length - 1; i >= 0; i--) m.set(all[i].label, all[i].id);
  return m;
});

/** Candidats d'un fragment matché : lookup direct, puis repli PLURIEL en retirant un « s » final par
 *  mot — le pattern `linkRe` tolère le pluriel FR régulier par mot ; l'index reste keyé au SINGULIER,
 *  la résolution y ramène (« Attaques caudales » → « attaque caudale »). */
const lookupCandidates = (rawText: string): LinkCandidate[] | undefined => {
  const idx = linkCandidatesCached();
  const key = deburrLower(rawText);
  const direct = idx.get(key);
  if (direct?.length) return direct;
  const singular = key.split(/\s+/).map((w) => (w.endsWith('s') ? w.slice(0, -1) : w)).join(' ');
  return singular !== key ? idx.get(singular) : undefined;
};

/** Résout un fragment de texte matché (déjà littéral, casse d'origine) vers SON entité : 1 seul
 *  candidat → direct ; HOMONYME → la catégorie de la fiche affichante (`selfCategory`) tranche EN
 *  PREMIER (dans une desc de trait, « Vol » → le trait) ; sans contexte, seuls les homonymes de
 *  NATURE A (même concept, deux représentations — `SAME_CONCEPT_GROUPS`) sont liés (représentation
 *  canonique via `PRIORITY_CAT_ORDER`) ; toute autre collision reste NON liée (comportement sûr). */
const resolveLink = (rawText: string, selfCategory?: string): LinkCandidate | undefined => {
  const candidates = lookupCandidates(rawText);
  if (!candidates?.length) return undefined;
  if (candidates.length === 1) return candidates[0];
  if (selfCategory) {
    const own = candidates.find((c) => c.category === selfCategory);
    if (own) return own;
  }
  const cats = new Set(candidates.map((c) => c.category));
  const group = SAME_CONCEPT_GROUPS.find((g) => [...cats].every((c) => g.has(c)));
  if (!group) return undefined; // concepts genuinement différents (nature B) → pas de lien nu
  for (const cat of PRIORITY_CAT_ORDER) {
    const hit = candidates.find((c) => c.category === cat);
    if (hit) return hit;
  }
  return undefined;
};

/** Un fragment de prose tokenisé : texte brut, OU une mention d'entité à lier (category+id+label) —
 *  `spec` porte la spécialisation LIBRE absorbée entre parenthèses (« Art (Écriture)» → spec
 *  `Écriture`), non validée contre les données (précédent GAS permissif assumé) ; `text` reste le
 *  VERBATIM affiché (libellé + parenthèse comprise). */
export type LinkToken = string | { category: string; id: string; label: string; spec?: string; text: string };
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Regex des racines auto-liables (RE-CALCULÉE par version) : chaque MOT de la racine accepte un
 *  « s » optionnel (pluriel FR régulier par mot ; le singulier est reformé au lookup, cf.
 *  `lookupCandidates`), plus longues d'abord, bornée aux frontières
 *  de mot Unicode (gère accents/apostrophes français). SENSIBLE À LA CASSE (pas de flag `i`) : la
 *  convention typographique des livres CAPITALISE les termes de jeu (« un test d'Art ») — la casse
 *  discrimine le terme de règle du mot commun (« une œuvre d'art » ne doit pas lier « Art »). Le
 *  lookup (`linkCandidatesCached`) reste normalisé côté index ; seule la CAPTURE dans le texte
 *  respecte la casse (et le pluriel réel) de la source. */
const linkReCached = versionCached<RegExp>(() => {
  const patterns = linkRootsCached().map((root) => root.split(' ').map((w) => `${escapeRe(w)}s?`).join('\\s+'));
  return new RegExp(`(?<![\\p{L}\\p{N}])(${patterns.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
});
const linkRe = (): RegExp => linkReCached();

/** Parenthèse de spécialisation absorbée immédiatement APRÈS un libellé matché (« Art (Écriture) »)
 *  → une SEULE mention (au lieu de couper au milieu). Libre : contenu non validé contre les données
 *  (précédent GAS permissif assumé pour ce lot). */
const SPEC_TAIL = /^\s*\(([^()]{1,60})\)/;

/**
 * Tokenise une prose en alternant texte brut et mentions d'entité à LIER (auto-liage du Codex,
 * façon `dev.html`). PUR & locale-scoped (matcher dérivé des libellés de la locale active, jamais
 * une chaîne FR en dur → multilingue de principe). Écarte les liens vers SOI et les libellés
 * inconnus/courts — la comparaison est 100 % id-based (`selfId` si l'appelant le connaît, sinon
 * résolu depuis `selfLabel` via `idByLabelCached`, repli des appelants non encore migrés).
 * `selfCategory` (catégorie de la fiche affichante) tranche les homonymes en priorité — cf.
 * `resolveLink`/`PRIORITY_CAT_ORDER`. Seul le vocabulaire de RÈGLES est lié.
 */
export function tokenizeLinks(text: string, selfLabel?: string, selfCategory?: string, selfId?: string): LinkToken[] {
  const re = linkRe();
  re.lastIndex = 0;
  const resolvedSelfId = selfId ?? (selfLabel ? idByLabelCached().get(selfLabel) : undefined);
  const out: LinkToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const hit = resolveLink(m[1], selfCategory);
    if (!hit || hit.id === resolvedSelfId) continue; // inconnu / auto-référence → laissé en texte
    if (m.index > last) out.push(text.slice(last, m.index));
    let end = m.index + m[1].length;
    let display = m[1];
    let spec: string | undefined;
    const tail = SPEC_TAIL.exec(text.slice(end));
    if (tail) { spec = tail[1]; display += tail[0]; end += tail[0].length; }
    out.push({ category: hit.category, id: hit.id, label: hit.label, spec, text: display });
    last = end;
    re.lastIndex = end;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

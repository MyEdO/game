/**
 * Brique RELATIONNELLE du Codex — SOURCE UNIQUE des références INVERSES (« qui pointe vers cette
 * entité ? ») et de l'index par livre. Construite en inversant les références DÉJÀ STRUCTURÉES de
 * `src/data`, publiées par les métas de leurs champs, et des résultats des résolveurs métier.
 *
 * **100 % id-based → langue-agnostique** : on inverse des `id` STABLES, jamais des libellés. Le
 * `label` porté par un `Referrer` n'est QUE l'affichage (= `CodexItem.label`). Aucune regex, aucune
 * logique branchée sur du texte.
 *
 * **Fraîcheur** : comme les projections du registre (`makeCategory`), les index (graphe inverse,
 * catalogue par livre, index de libellés, regex d'auto-liage) sont RE-CALCULÉS après une écriture au
 * seam des datasets (`versionDesDatasets`, `memoParVersion`). Les
 * datasets étant mutés EN PLACE (`overrides.ts::setDataset`), re-construire relit la donnée FRAÎCHE —
 * les sections inverses, le contenu des fiches Livre et l'auto-liage suivent une édition sans reload.
 *
 * Le registre (`src/noyau/codex/registry.ts`) en tire les SECTIONS inverses ; les refs AVANT restent projetées par
 * le registre (rendu riche : choix « A ou B », Indices d'instance) — ici, c'est la couche d'INVERSION
 * et d'INDEX, pas une seconde copie des refs avant.
 */
import {
  species, careers, skills, talents, trappingsEffectifs, siegeEngines, findSiegeEngineById, libelleDAuteur, creatures, traits, mutations,
  spells, gods, domains, classes, maneuvers, qualities, characteristics, etats, maladies,
  locations, stars, mutationTables, careersForSpecies, findCareerById, type CareerLevelData,
} from '../../data';
import type { z } from 'zod';
import { effectiveEntry } from '../../engine/variants';
import { deDeLaTableTiree, facesDuDe, fourchette } from '../../engine/tables';
import { spellEffectOps, type TriggeredEffect } from '../../engine/flowCore';
import type { Flow } from '../../data/schemas/defs-scenes/effets';
import { memoParVersion } from '../../data/versionDataset';
import { CLES_DE_DATASET, DATASET_DE_LA_CATEGORIE, DATASET_DE_L_ESPACE, type CleDeDataset } from '../../data/schemas/_cles-de-dataset.generated';
import { RACINES_VIVANTES } from '../../data/_racines-vivantes.generated';
import { SCHEMA_DEFS } from '../../data/schemas/_registry.generated';
import { rangee as rangeeDeCorruption } from '../../data/schemas/defs/mutationTables';
import { baseDe, lireCleDEspace } from '../../data/schemas/grammaire/cle-d-espace';
import { ouverts, pasDeDonnee } from '../../data/schemas/grammaire/descente';
import { espaceDe, reperesDuParse, TYPES, type TypeEntite } from '../../data/schemas/grammaire/ref';
import { auChemin } from '../../lib/objet.mjs';
import { espacesMixtesDeProjectionInverse, projeterInversesCodex } from './projectionInverse';
import { replier } from '../../lib/ordre.mjs';
import { resolveQualities } from '../../engine/qualities/dispatch';

/** Libellé de la fiche Codex d’un engin, qualifié par son livre. */
export function libelleDUnEnginAuCodex(id: string): string {
  const engin = findSiegeEngineById(id);
  return engin ? libelleDAuteur(engin) : id;
}

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

/** Accès à une projection RE-CALCULÉE après une écriture au seam des datasets : `memoParVersion` sur
 *  toutes les clés, miroir de `makeCategory` (`src/noyau/codex/registry.ts`). */
const versionCached = <T,>(build: () => T): (() => T) => memoParVersion(CLES_DE_DATASET, build);

// ── Construction du graphe inverse ─────────────────────────────────────────────
const rkey = (cat: string, id: string): string => `${cat}:${id}`;
const categorieParDataset = new Map(Object.entries(DATASET_DE_LA_CATEGORIE).map(([categorie, { cle }]) => [cle, categorie]));

function categorieDeLEspace(espace: string): string | undefined {
  const dataset = DATASET_DE_L_ESPACE[espace];
  return dataset && categorieParDataset.get(dataset.cle);
}

const categorieParType = new Map(
  (Object.keys(TYPES) as TypeEntite[]).map((type) => [type, categorieDeLEspace(baseDe(lireCleDEspace(espaceDe(type))))]),
);

type EntreeNommee = { id: string; label: string };

const equipements = { trappings: trappingsEffectifs, siegeEngines };
const vuesDEquipement = new Map<string, () => readonly EntreeNommee[]>(Object.entries(equipements));

const sourcesDesReferences = SCHEMA_DEFS.flatMap(({ file, famille, schema, meta }) => {
  const dataset = DATASET_DE_L_ESPACE[file]?.cle;
  const categorie = dataset && categorieParDataset.get(dataset);
  if (!dataset || !categorie || famille !== 'entite' || !Object.values(meta ?? {}).some((champ) => champ.inverseCodex)) return [];
  const [entree] = pasDeDonnee(ouverts([schema]), 0) as z.ZodType[];
  const lireEntrees = vuesDEquipement.get(categorie) ?? (() => RACINES_VIVANTES[file] as readonly EntreeNommee[]);
  const projeter = () => {
    const entrees = lireEntrees();
    return { entrees, cibles: projeterInversesCodex(entree, entrees) };
  };
  let cache: (() => ReturnType<typeof projeter>) | undefined;
  const lire = () => {
    if (!cache) {
      const cles = new Set<CleDeDataset>([dataset]);
      if (categorie === 'trappings') cles.add('reglesOptionnelles');
      // Le seam valide les références globales. Une feuille mixte peut changer de portée sans édition de sa source.
      for (const espace of espacesMixtesDeProjectionInverse(entree)) {
        const cle = DATASET_DE_L_ESPACE[baseDe(lireCleDEspace(espace))]?.cle;
        if (cle) cles.add(cle);
      }
      cache = memoParVersion([...cles], projeter);
    }
    return cache();
  };
  return [{ categorie, lire }];
});

function referantDe(categorie: string, entree: EntreeNommee): Referrer | undefined {
  if (categorie === 'careerLevels') {
    const niveau = entree as CareerLevelData;
    const carriere = findCareerById(niveau.career.id);
    return carriere && { category: 'careers', id: carriere.id, label: carriere.label, detail: `N${niveau.level}` };
  }
  const label = categorie === 'siegeEngines' ? libelleDUnEnginAuCodex(entree.id) : entree.label;
  return { category: categorie, id: entree.id, label };
}

/** États INFLIGÉS — ops `condition` des effets (Sort = Flow ; Trait/Qualité/Talent/Domaine =
 *  TriggeredEffect[].flow). On réutilise le walker `spellEffectOps` (zéro parsing maison). */
const conditionIdsInFlow = (flow: Flow | undefined): string[] =>
  spellEffectOps(flow).flatMap((o) => (o.op === 'condition' ? [o.id.id] : []));
const conditionIdsInEffects = (effects: TriggeredEffect[] | undefined): string[] =>
  (effects ?? []).flatMap((e) => conditionIdsInFlow(e.flow));

/** Graphe des références publiques, recalculé à chaque version des données. */
const graph = versionCached(() => {
  const reverse = new Map<string, Referrer[]>();
  const inverser = (type: TypeEntite, id: string, by: Referrer, detail?: string): void => {
    const categorie = categorieParType.get(type);
    if (!categorie) return;
    const cle = rkey(categorie, id);
    const referants = reverse.get(cle) ?? [];
    referants.push(detail === undefined ? by : { ...by, detail });
    reverse.set(cle, referants);
  };

  for (const { categorie, lire } of sourcesDesReferences) {
    const { entrees, cibles: ciblesParEntree } = lire();
    ciblesParEntree.forEach((cibles, rang) => {
      const by = referantDe(categorie, entrees[rang]);
      if (!by) return;
      for (const { type, id, detail } of cibles) inverser(type, id, by, detail);
    });
  }

  for (const s of species) {
    const by = { category: 'races', id: s.id, label: s.label };
    for (const c of careersForSpecies(s)) inverser('career', c.id, by);
  }

  for (const [category, lireObjets] of Object.entries(equipements)) {
    for (const t of lireObjets()) {
      const by = referantDe(category, t)!;
      for (const q of resolveQualities({ qualities: t.qualities, subType: t.subType?.id })) inverser('quality', q.id, by);
    }
  }

  for (const t of talents) {
    const by = { category: 'talents', id: t.id, label: t.label };
    for (const op of t.passive ?? []) if (op.op === 'charMod') inverser('characteristic', op.characteristic, by);
  }

  for (const s of spells) {
    const by = { category: 'spells', id: s.id, label: s.label };
    for (const id of conditionIdsInFlow(effectiveEntry(s).effects)) inverser('etat', id, by);
  }
  for (const [category, entrees] of Object.entries({ traits, qualities, talents, domains })) {
    for (const e of entrees) {
      const by = { category, id: e.id, label: e.label };
      for (const id of conditionIdsInEffects(e.effects)) inverser('etat', id, by);
    }
  }

  for (const t of mutationTables) {
    const by = { category: 'mutationTables', id: t.id, label: t.label };
    const faces = facesDuDe(deDeLaTableTiree(t));
    for (const r of t.entries) {
      for (const repere of reperesDuParse(rangeeDeCorruption, r)) {
        const id = auChemin(r, repere.path);
        if (repere.type === 'mutation' && typeof id === 'string') inverser(repere.type, id, by, fourchette(r.min, r.max, faces));
      }
    }
  }

  return reverse;
});

// ── Titres éditoriaux des sections, par catégorie de cible puis de référant ─────
const TITRES_INVERSES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  careers: { races: 'Races y accédant' },
  classes: { careers: 'Carrières de la classe' },
  skills: { careers: 'Carrières (par rang)', talents: 'Talents le conférant' },
  talents: { careers: 'Carrières (par rang)', talents: 'Talents le conférant' },
  characteristics: { careers: 'Carrières (avancée)', skills: 'Compétences liées', talents: 'Talents (bonus de départ)' },
  trappings: { careers: 'Carrières (par rang)', creatures: 'Créatures la possédant', trappings: 'Armes qui la tirent', siegeEngines: 'Armes qui la tirent', classes: 'Possession de classe' },
  traits: { creatures: 'Créatures ayant ce trait', mutations: 'Mutations conférant ce trait' },
  spells: { creatures: 'Créatures la lançant', gods: 'Cultes (Bénédictions / Miracles)' },
  qualities: { trappings: 'Équipements ayant cette qualité', siegeEngines: 'Équipements ayant cette qualité' },
  weaponGroups: { trappings: 'Objets du groupe', siegeEngines: 'Objets du groupe' },
  maneuvers: { traits: 'Traits l’accordant' },
  domains: { spells: 'Sorts du domaine' },
  etats: {
    spells: 'Sorts l’infligeant', traits: 'Traits l’infligeant', qualities: 'Qualités d’arme l’infligeant',
    talents: 'Talents l’infligeant', domains: 'Domaines l’infligeant',
  },
  mutations: { mutationTables: 'Tables de Corruption la tirant' },
  locations: { locations: 'Sous-lieux' },
};

const GENERIC_PLURAL: Record<string, string> = {
  races: 'Races', careers: 'Carrières', classes: 'Classes', skills: 'Compétences', talents: 'Talents',
  trappings: 'Équipements', siegeEngines: 'Engins de siège', qualities: 'Qualités', creatures: 'Créatures', traits: 'Traits',
  mutations: 'Mutations', spells: 'Sorts', domains: 'Domaines', gods: 'Cultes', maneuvers: 'Manœuvres',
  weaponGroups: 'Groupes d’objet', characteristics: 'Caractéristiques', etats: 'États',
};
const reverseTitle = (targetCat: string, refCat: string): string =>
  TITRES_INVERSES[targetCat]?.[refCat] ?? GENERIC_PLURAL[refCat] ?? refCat;

/** Ordre stable des catégories (référants d'une fiche ET contenu d'un livre) — les plus parlantes
 *  d'abord ; une catégorie hors liste est repoussée en fin (via `orderOf`). */
const REF_CAT_ORDER = ['races', 'classes', 'careers', 'characteristics', 'skills', 'talents', 'creatures', 'mutations', 'mutationTables', 'trappings', 'siegeEngines', 'qualities', 'weaponGroups', 'spells', 'domains', 'gods', 'traits', 'maneuvers', 'etats', 'maladies', 'stars', 'locations'];
const orderOf = (cat: string): number => (REF_CAT_ORDER.indexOf(cat) + 1) || 99;

/**
 * Références INVERSES d'une entité (category, id) — GROUPÉES par catégorie de référant, dédupliquées
 * (un même référant à plusieurs rangs fusionne ses détails), triées (ordre stable puis alpha).
 * Vide si l'entité n'est référencée nulle part. Source unique des sections « inverses » du Codex.
 */
export function reverseGroups(category: string, id: string): ReverseGroup[] {
  const raw = graph().get(rkey(category, id));
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
  pushCatalog('trappings', trappingsEffectifs());
  pushCatalog('siegeEngines', siegeEngines().map(({ id, source }) => ({ id, source, label: libelleDUnEnginAuCodex(id) })));
  pushCatalog('qualities', qualities as { id: string; label: string; source?: { book: string; page: number } }[]);
  pushCatalog('etats', etats);
  pushCatalog('maneuvers', maneuvers);
  pushCatalog('domains', domains as { id: string; label: string; source?: { book: string; page: number } }[]);
  pushCatalog('spells', spells);
  pushCatalog('creatures', creatures as { id: string; label: string; source?: { book: string; page: number } }[]);
  pushCatalog('traits', traits);
  pushCatalog('mutations', mutations);
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
 * Index d'auto-liage (LOCALE-SCOPED) : libellé replié (`replier`) → (category, label)
 * de l'entité à lier. Construit depuis les libellés de la LOCALE active (ici FR) → 100 %
 * langue-agnostique de principe (dérivé des données, jamais une chaîne FR en dur). Les libellés
 * ambigus (même texte pour 2 entités) et trop courts (< 4) sont ÉCARTÉS pour ne pas sur-lier.
 * RE-CALCULÉ par version (suit une édition Codex).
 */
const labelIndexCached = versionCached<Map<string, { category: string; label: string }>>(() => {
  const seen = new Map<string, { category: string; label: string } | null>();
  for (const e of catalog()) {
    const key = replier(e.label);
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
 *  Collisions RÉELLES du catalogue (relevées 2026-07-13, `replier` sur libellé entier), classées
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
    add(replier(e.label), c);
    for (const form of prefixedForms(e.category, e.label)) add(replier(form), c);
  }
  return idx;
});

/** Candidats d'un fragment matché : lookup direct, puis repli PLURIEL en retirant un « s » final par
 *  mot — le pattern `linkRe` tolère le pluriel FR régulier par mot ; l'index reste keyé au SINGULIER,
 *  la résolution y ramène (« Attaques caudales » → « attaque caudale »). */
const lookupCandidates = (rawText: string): LinkCandidate[] | undefined => {
  const idx = linkCandidatesCached();
  const key = replier(rawText);
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
 * inconnus/courts — la fiche affichante s'écarte par sa catégorie et son id STABLE (`selfCategory`, `selfId`), jamais par son libellé.
 * `selfCategory` (catégorie de la fiche affichante) tranche les homonymes en priorité — cf.
 * `resolveLink`/`PRIORITY_CAT_ORDER`. Seul le vocabulaire de RÈGLES est lié.
 */
export function tokenizeLinks(text: string, selfCategory?: string, selfId?: string): LinkToken[] {
  const re = linkRe();
  re.lastIndex = 0;
  const out: LinkToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const hit = resolveLink(m[1], selfCategory);
    if (!hit || (hit.id === selfId && hit.category === selfCategory)) continue; // inconnu / auto-référence → laissé en texte
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

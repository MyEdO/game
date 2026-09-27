import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { fileURLToPath } from 'node:url';
import { skills, talents, careerLevels, species, stars, specCatalogOf, specLabel, specPoolOf, specResolves, specEntryId } from './index';
import tablesJson from './tables.json';
import activitiesJson from './activities.json';
import tavernGamesJson from './tavernGames.json';
import crewRolesJson from './crew-roles.json';
import { estSpecialisable, refOuSpec } from './schemas/grammaire/ref';

/**
 * CONTRAT DE DONNÉE #1342 L3 — deux axes ORTHOGONAUX sur une entrée `specs[]` : `source` dit d'où
 * l'entrée vient, `pool: false` dit qu'elle n'est pas PROPOSÉE d'office (`LDB 09 l.40`).
 *
 * BORNE DE CE FICHIER : les datasets SCANNÉS ci-dessous (`PORTES_JOUEUR`) — pas « le LDB 09 ». La
 * mesure du 2026-08-23 interdit le contrat « toute entrée du pool est énumérée par le LDB 09 » :
 * ~150 entrées héritées (Langue, Métier, Savoir…) ne figurent dans AUCUNE liste « Spécialisations : »
 * du chapitre et ne portent pas de `source`. Ce qui EST gardé ici rend le pool correct :
 *  1. une entrée hors pool est attestée ailleurs → elle porte une `source` ;
 *  2. toute spec demandée par une PORTE JOUEUR résout, et résout DANS le pool — sinon l'écran qui
 *     l'affiche ne peut pas l'offrir ;
 *  3. un EMPLACEMENT (`choix: true`, joker « au choix ») ne vise jamais une entrée à pool vide
 *     (`LDB 09 l.40`) — garde `#1897` en fin de fichier (`choixSansPoolJoueur`). Pour un TALENT, des
 *     `specs` inline ne font pas un domaine groupé (`LDB 10 l.17` ; `attirant`, `EDOC 12 l.84`) ; une
 *     COMPÉTENCE à `specs` est Groupée (`LDB 09 l.40`) et son pool vide est refusé par « aucune
 *     Compétence spécialisable n’a un pool VIDE » (describe `L2 #1548`, catalogue RÉSOLU, inline compris) ;
 *  4. VALIDITÉ ⊇ POOL, par construction, sur chaque def.
 */
const DEFS = [...skills, ...talents];

/** Datasets qui PROPOSENT une spec à un joueur : liste de Carrière, liste d'espèce, signe astral,
 *  op passive `grantCareerSkill` d'un Talent (`engine/talentEffects.ts#careerSkillAdditions`), table
 *  d'effets, Activité hors combat, jeu de taverne, rôle d'équipage. */
const PORTES_JOUEUR: [string, unknown][] = [
  ['careerLevels', careerLevels], ['species', species], ['stars', stars],
  ['talents(passive/grantCareerSkill)', talents], ['tables', tablesJson],
  ['activities', activitiesJson], ['tavernGames', tavernGamesJson], ['crewRoles', crewRolesJson],
];

/**
 * DETTE NOMINATIVE DATÉE (2026-08-23) — refs de porte joueur dont la `spec` est encore un LIBELLÉ FR
 * (ou une spéc absente du catalogue) : elles ne résolvent pas, donc ne peuvent pas être confrontées
 * au pool. Extinction : #1342 (3ᵉ vie de #1341). Liste FERMÉE : une clé de plus = rouge (nouvelle
 * dette), une clé PÉRIMÉE = rouge aussi (le stock a décru, la liste doit décroître avec lui).
 */
const REFS_EN_LIBELLE: string[] = [];

const DEF_BY_ID = new Map(DEFS.map((d) => [d.id, d]));
/** Ids de COMPÉTENCE — le concept dont la sentinelle est ÉTEINTE (L2 #1548). */
const EST_COMPETENCE = new Set(skills.map((s) => s.id));
/** « au choix » / « Environnement au choix » : un EMPLACEMENT à désigner, pas une spécialisation. */
const SENTINELLE_CHOIX = /au choix/i;

/** Toutes les refs `(defId, spec)` d'une porte joueur. La clé de def se lit d'ABORD sur les champs
 *  QUALIFIÉS (`skillId`/`talentId`/`skill`), PUIS sur l'`id` du nœud lui-même : depuis la référence
 *  emboîtée du lot 3b (L2 #1548), une réf de Compétence s'écrit `skill: { id, spec }` — la spéc est
 *  posée À CÔTÉ de l'id du nœud, donc ce repli est le chemin NORMAL de cette composition plate. */
function refsDePorte(): { where: string; defId: string; spec: string }[] {
  const out: { where: string; defId: string; spec: string }[] = [];
  const walk = (node: unknown, where: string): void => {
    if (Array.isArray(node)) { node.forEach((x) => walk(x, where)); return; }
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    const defId = (n.skillId ?? n.talentId ?? n.skill ?? n.id) as string | undefined;
    if (typeof defId === 'string' && typeof n.spec === 'string') out.push({ where, defId, spec: n.spec });
    for (const v of Object.values(n)) walk(v, where);
  };
  for (const [where, data] of PORTES_JOUEUR) walk(data, where);
  return out;
}

describe('#1342 L3 — contrat `pool` des spécialisations', () => {
  it('toute entrée `pool: false` porte une `source`', () => {
    const nues: string[] = [];
    for (const def of DEFS) {
      for (const e of def.specs ?? []) if (e.pool === false && !e.source) nues.push(`${def.id}/${e.id}`);
    }
    expect(nues, `entrée(s) hors pool sans attestation :\n${nues.join('\n')}`).toEqual([]);
  });

  it('toute spec demandée par une PORTE JOUEUR résout et est DANS le pool (hors dette nominative)', () => {
    const horsPool: string[] = [];
    const detteVue = new Set<string>();
    const detteNeuve: string[] = [];
    /** Sentinelles portées par une réf de COMPÉTENCE : ce stock est ÉTEINT (L2 #1548 commit 4bis — la
     *  donnée écrit `choix`), et le rester est le contrat. */
    const sentinellesDeCompetence: string[] = [];
    for (const { where, defId, spec } of refsDePorte()) {
      if (SENTINELLE_CHOIX.test(spec)) {
        // Une sentinelle de TALENT survit : `talentRefSchema` (`schemas/grammaire/reference.ts`) n'a
        // pas de régime `choix`, et l'ouvrir bute sur son pool FERMÉ — concept loté L3 (#1463).
        if (EST_COMPETENCE.has(defId)) sentinellesDeCompetence.push(`${where}|${defId}|${spec}`);
        continue;
      }
      const def = DEF_BY_ID.get(defId);
      if (!def) continue; // le defId n'est pas une Compétence/Talent (garde d'existence : refs-migrated)
      const cle = `${where}|${defId}|${spec}`;
      if (!specResolves(def, spec)) {
        if (REFS_EN_LIBELLE.includes(cle)) detteVue.add(cle);
        else detteNeuve.push(`${cle} (ne résout pas — dette de migration NEUVE, cf. #1342)`);
        continue;
      }
      if (!specPoolOf(def).includes(spec)) horsPool.push(`${cle} : hors pool (l'écran ne peut pas l'offrir)`);
    }
    expect(
      sentinellesDeCompetence,
      `sentinelle « au choix » sur une réf de Compétence — poser \`choix: true\` (ou \`choix: [ids]\`) :\n${sentinellesDeCompetence.join('\n')}`,
    ).toEqual([]);
    expect(detteNeuve, detteNeuve.join('\n')).toEqual([]);
    expect(horsPool, horsPool.join('\n')).toEqual([]);
    const perimees = REFS_EN_LIBELLE.filter((k) => !detteVue.has(k));
    expect(perimees, `clé(s) de dette PÉRIMÉE(s) — la ref a été migrée, retirer la ligne :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('VALIDITÉ ⊇ POOL', () => {
    const fuites: string[] = [];
    for (const def of DEFS) {
      for (const id of specPoolOf(def)) if (!specResolves(def, id)) fuites.push(`${def.id}/${id}`);
      const inline = (def.specs ?? []).map(specEntryId);
      if (inline.length) expect(specPoolOf(def).length, def.id).toBeLessThanOrEqual(inline.length);
    }
    expect(fuites, `spec(s) proposées mais non valides :\n${fuites.join('\n')}`).toEqual([]);
  });
});

/**
 * EXTENSION 2026-08-30 (L2 #1548, commit 3b) — MÊME contrat, périmètre ÉLARGI et axe RESSERRÉ.
 *
 * PÉRIMÈTRE MESURÉ : TOUS les `src/data/**.json` (walk récursif du dossier, 121 fichiers au relevé),
 * pas seulement les 8 `PORTES_JOUEUR` ci-dessus. L'AXE, lui, est plus étroit que celui des portes :
 * on n'exige pas ici que la spéc résolve (188 valeurs distinctes sont du TEXTE LIBRE authoré, légitime
 * sur les domaines ouverts : Langue, Métier, Savoir…), on exige qu'elle ne soit JAMAIS le LIBELLÉ FR
 * d'une entrée du catalogue de sa propre def.
 *
 * MESURE QUI L'EXIGE : `testValue` apparie la spéc possédée par ÉGALITÉ STRICTE
 * (`s.spec === spec`, `src/engine/skills.ts:76`) et les Compétences possédées portent l'ID. Une spéc
 * écrite « Ingénieur » au lieu de `ingenieur` n'apparie donc AUCUNE instance : le Test retombe sur la
 * Caractéristique de repli et les avances sont PERDUES (héros Métier (Ingénieur) +40, Int 30 : 30
 * mesuré au lieu de 70). Stock avant correctif : 4 (`steam-breakdown.json`, chemin réel
 * `seaVoyageFlow.ts:2020`), ramenés à l'id par `scripts/migrations/2026-08-30-spec-en-id-de-catalogue.mjs`.
 *
 * ANGLES MORTS ÉNONCÉS :
 *  - la clé de def n'est lue que sur `skillId` / `skill` de chaîne / `id` du nœud porteur : une réf
 *    de Compétence désignée par un champ d'un AUTRE nom échappe à la mesure ;
 *  - les défs de COMPÉTENCE et de TALENT sont confrontées (#1646, L-ref-3 du 2026-09-01 : les 5 spécs
 *    en libellé de `sens-aiguise` — 4 dans `mutations.json`, 1 dans `spells.json`, résolues par
 *    `PairedSense` et non par `testValue` — portent leur id) ; le volet SENTINELLE, lui, reste borné
 *    aux Compétences : `talentRefSchema` n'a pas de régime `choix`, et les 4 « Au choix » de
 *    `maitre-artisan` de `creatures.json` survivent à #1457 — leur extinction demande le régime `choix`
 *    des réfs de Talent de statbloc (#1621) ;
 *  - une spéc qui n'apparie AUCUNE entrée du catalogue de sa def n'est pas mesurée (texte libre d'un
 *    domaine ouvert) ;
 *  - un libellé AMBIGU (deux entrées du même catalogue au même libellé normalisé) n'est pas départagé.
 */
const DOSSIER_DATA = fileURLToPath(new URL('.', import.meta.url));
/** DEUXIÈME racine de donnée authorée : les projets de scène composent la MÊME grammaire
 *  (`defs-scenes/communs.ts#competenceChiffreeSchema` = `refOuSpec('skill', { value })`), donc le même
 *  invariant s'y mesure. Un scan borné à `src/data` laissait cette racine hors garde. */
const DOSSIER_SCENES = fileURLToPath(new URL('../scenes/', import.meta.url));
const RACINES: [string, string][] = [['data/', DOSSIER_DATA], ['scenes/', DOSSIER_SCENES]];

/** Normalisation de COMPARAISON seulement (NFD + casse) : jamais une conversion de donnée. */
const normLabel = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * DETTE NOMINATIVE DATÉE — spécs de Compétence encore écrites en LIBELLÉ FR de leur propre catalogue.
 * Liste FERMÉE et DÉCROISSANTE : une clé de plus = rouge (régression), une clé périmée = rouge aussi.
 * VIDE depuis 2026-08-30 (L2 #1548, commit 3b) : les 4 `metier|Ingénieur` de `steam-breakdown.json`
 * ont été migrées.
 */
const SPECS_EN_LIBELLE: { cle: string; date: string; lot: string }[] = [];

const fichiersDeDonnees = (dir: string): string[] =>
  listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => join(dir, rel));

describe('L2 #1548 — aucune `spec` de Compétence ni de Talent écrite en LIBELLÉ (`src/data` ET `src/scenes`)', () => {
  /** Par id de Compétence : « cet id résout-il ? » et l'index LIBELLÉ normalisé → id attendu. */
  const CATALOGUE = new Map(skills.map((s) => [
    s.id,
    { def: s, parLabel: new Map(specCatalogOf(s).map((id) => [normLabel(specLabel('skills', s.id, id)), id])) },
  ]));
  /** Même index pour les TALENTS — même doctrine id/label, autre porte de résolution. */
  const CATALOGUE_TALENT = new Map(talents.map((t) => [
    t.id,
    { def: t, parLabel: new Map(specCatalogOf(t).map((id) => [normLabel(specLabel('talents', t.id, id)), id])) },
  ]));

  const fichiers = RACINES.flatMap(([racine, dir]) =>
    fichiersDeDonnees(dir).map((abs) => ({ abs, ou: `${racine}${abs.slice(dir.length).replace(/\\/g, '/')}` })),
  );

  it('le walk couvre bien TOUS les datasets JSON (périmètre non vide, non réduit à un fichier)', () => {
    expect(fichiers.length).toBeGreaterThan(100);
  });

  it('la racine `src/scenes` est bien SCANNÉE (les projets de scène composent la même grammaire)', () => {
    expect(fichiers.filter((f) => f.ou.startsWith('scenes/')).length).toBeGreaterThan(0);
  });

  it('toute `spec` adjacente à un id de Compétence ou de Talent est un ID du catalogue ou du TEXTE LIBRE — jamais un libellé, jamais la sentinelle', () => {
    const regressions: string[] = [];
    /** CONTRAT POSITIF (L2 #1548, commit 4bis) : le littéral « au choix » ne désigne RIEN au catalogue
     *  — un emplacement non désigné s'écrit `choix` (`refOuSpec`). Stock ÉTEINT sur les Compétences,
     *  sur les DEUX racines authorées (`src/data` : les 53 du bestiaire + les 2 ops
     *  `grantCareerSkill` ; `src/scenes` : les projets). Ce scan DOUBLE le verrou de schéma
     *  `ref.ts#SENTINELLE_DE_SPEC` : il nomme le site en donnée, le schéma refuse au parse. */
    const sentinelles: string[] = [];
    const vues = new Set<string>();
    const walk = (node: unknown, ou: string): void => {
      if (Array.isArray(node)) { node.forEach((x) => walk(x, ou)); return; }
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      const defId = (typeof n.skillId === 'string' && n.skillId)
        || (typeof n.skill === 'string' && n.skill)
        || (typeof n.id === 'string' && n.id) || null;
      const spec = n.spec;
      if (defId && typeof spec === 'string' && CATALOGUE.has(defId)) {
        if (SENTINELLE_CHOIX.test(spec)) sentinelles.push(`${ou}|${defId}|${spec}`);
        const cat = CATALOGUE.get(defId)!;
        const attendu = cat.parLabel.get(normLabel(spec));
        if (attendu && !specResolves(cat.def, spec)) {
          const cle = `${ou}|${defId}|${spec}`;
          if (SPECS_EN_LIBELLE.some((d) => d.cle === cle)) vues.add(cle);
          else regressions.push(`${cle} — LIBELLÉ FR du catalogue (id attendu « ${attendu} ») : \`testValue\` n'appariera aucune spéc possédée`);
        }
      }
      const talentDefId = (typeof n.talentId === 'string' && n.talentId)
        || (typeof n.talent === 'string' && n.talent)
        || (typeof n.id === 'string' && n.id) || null;
      if (talentDefId && typeof spec === 'string' && CATALOGUE_TALENT.has(talentDefId)) {
        const cat = CATALOGUE_TALENT.get(talentDefId)!;
        const attendu = cat.parLabel.get(normLabel(spec));
        if (attendu && !specResolves(cat.def, spec)) {
          const cle = `${ou}|${talentDefId}|${spec}`;
          if (SPECS_EN_LIBELLE.some((d) => d.cle === cle)) vues.add(cle);
          else regressions.push(`${cle} — LIBELLÉ FR du catalogue de Talent (id attendu « ${attendu} ») : une spéc authorée est un ID`);
        }
      }
      for (const v of Object.values(n)) walk(v, ou);
    };
    for (const { abs, ou } of fichiers) {
      let data: unknown;
      try { data = JSON.parse(readFileSync(abs, 'utf8')); } catch { continue; }
      walk(data, ou);
    }
    expect(
      sentinelles,
      `sentinelle « au choix » restée en \`spec\` de Compétence — la forme est \`choix: true\` / \`choix: [ids]\` :\n${sentinelles.join('\n')}`,
    ).toEqual([]);
    expect(regressions, regressions.join('\n')).toEqual([]);
    const perimees = SPECS_EN_LIBELLE.filter((d) => !vues.has(d.cle)).map((d) => d.cle);
    expect(perimees, `clé(s) de dette PÉRIMÉE(s) — migrée(s), retirer la ligne :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('chaque ligne de dette porte sa DATE et son LOT', () => {
    expect(SPECS_EN_LIBELLE.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !d.lot?.trim()).map((d) => d.cle)).toEqual([]);
  });
});

/**
 * VERROU PAR CONSTRUCTION de la sentinelle — le schéma REFUSE, il ne se contente pas d'être scanné.
 * Un contrat qui n'inspecte que les fichiers d'un dossier laisse revenir la sentinelle par TOUTE
 * donnée neuve ; `savoir` est une entrée OUVERTE (`ref.ts#entreeOuverte`), donc le garde-fou
 * « catalogue fermé » ne l'atteint pas : le refus lui est propre.
 */
describe('L2 #1548 — `refOuSpec` refuse la sentinelle AU PARSE (`ref.ts#SENTINELLE_DE_SPEC`)', () => {
  /** LE nœud du statbloc de créature : `refOuSpec('skill', { value }, 'specOuChoixFacultatifs')`
   *  (`defs/creatures.ts`, porteur d'EMPLACEMENT) — la sonde porte donc sa `value`. */
  const skillRef = refOuSpec('skill', { value: z.number().optional() }, 'specOuChoixFacultatifs');

  it('refuse le littéral « au choix » posé en `spec` d’une Compétence spécialisable', () => {
    const r = skillRef.safeParse({ id: 'savoir', spec: 'au choix', value: 65 });
    expect(r.success).toBe(false);
  });

  it('refuse la sentinelle quelle que soit sa CASSE et son séparateur', () => {
    for (const graphie of ['Au choix', 'AU CHOIX', 'au-choix', 'Au  choix']) {
      expect(skillRef.safeParse({ id: 'savoir', spec: graphie, value: 65 }).success, graphie).toBe(false);
    }
  });

  it('refuse la sentinelle glissée dans un `choix` BORNÉ', () => {
    expect(skillRef.safeParse({ id: 'savoir', choix: ['loi', 'au choix'] }).success).toBe(false);
  });

  it('accepte les deux formes LÉGITIMES : une spéc du catalogue, et l’emplacement non désigné `choix`', () => {
    expect(skillRef.safeParse({ id: 'savoir', spec: 'loi', value: 65 }).success).toBe(true);
    expect(skillRef.safeParse({ id: 'savoir', choix: true, value: 65 }).success).toBe(true);
  });

  it('refuse `spec` ET `choix` ensemble (XOR des deux régimes)', () => {
    expect(skillRef.safeParse({ id: 'savoir', spec: 'loi', choix: true }).success).toBe(false);
  });

  it('refuse un `choix` sur une Compétence qui ne déclare AUCUNE spécialisation', () => {
    expect(skillRef.safeParse({ id: 'esquive', choix: true }).success).toBe(false);
  });
});

/**
 * INVARIANT `estSpecialisable ⟹ specPoolOf ≠ []` — une Compétence dont le catalogue est NON VIDE doit
 * proposer au moins une spéc `pool` : sinon le tirage d'une spéc n'a aucun candidat et le `throw` de
 * `designateSpec` (`src/state/spawn.ts`) devient atteignable en partie.
 *
 * PÉRIMÈTRE : `estSpecialisable` lit le catalogue RÉSOLU (espace `<fichier>#[<id>].specs` de l'INDEX
 * DES IDS), `specs[]` inline et `specsSource` compris — mesuré 2026-08-31 : `corps-a-corps`,
 * `focalisation` et `projectiles` ont 0 spéc inline pour 8/9/10 au registre.
 */
describe('L2 #1548 — toute Compétence spécialisable propose au moins une spéc au tirage', () => {
  it('les défs à `specsSource` sont bien DANS le périmètre (le volet inline les saute)', () => {
    const parSource = skills.filter((s) => s.specsSource && (s.specs ?? []).length === 0);
    expect(parSource.length).toBeGreaterThan(0);
    expect(parSource.every((s) => estSpecialisable('skill', s.id))).toBe(true);
  });

  it('aucune Compétence spécialisable n’a un pool VIDE', () => {
    const vides = skills.filter((s) => estSpecialisable('skill', s.id) && specPoolOf(s).length === 0).map((s) => s.id);
    expect(
      vides,
      `Compétence(s) au catalogue NON VIDE mais sans aucune spéc \`pool\` — \`designateSpec\` (src/state/spawn.ts) n'a aucun candidat à tirer et LÈVE :\n${vides.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * SENS MANQUANT du critère #1342 L3 (#1457 B2) — le premier `it` de ce fichier ne garde qu'un sens
 * (`pool: false ⇒ source`) : rien n'exigeait qu'une entrée statbloc-only SOIT mise hors pool. Elle
 * restait donc PROPOSÉE d'office par le créateur/l'avancement (`LDB 09 l.40`, `specPoolOf`), et le
 * geste de la migration `2026-08-23-specs-statbloc-hors-pool.mjs` n'était rejouable que par sa TABLE
 * — mesure du 2026-09-01 : `skills.json` porte 32 entrées hors pool, `talents.json` en portait 0.
 *
 * CONTRAT POSITIF, sur les DEUX catalogues (Compétences ET Talents) : une entrée de `specs[]` qui
 *  1. porte une `source` — donc n'appartient PAS au pool imprimé de base (cf. premier `it` : hors
 *     pool ⇒ attestée ailleurs ; contraposée : une entrée NUE ne peut pas être mise hors pool), et
 *  2. n'est employée, sur les DEUX racines authorées, que par `src/data/creatures.json`,
 * porte `pool: false`. Même mesure que la migration statbloc-hors-pool (critères « employée par un
 * statbloc » / « citée par aucune ligne joueur »), élargie des 3 listes joueur de la migration à
 * TOUS les datasets — donc plus prudente : un consommateur hors `creatures.json`, quel qu'il soit,
 * suffit à laisser l'entrée au pool.
 *
 * ANGLES MORTS ÉNONCÉS :
 *  - le critère RAW de la migration (« libellé ÉNUMÉRÉ par la liste imprimée du LDB ») n'est PAS
 *    remesuré ici : ce fichier ne lit aucun `Source/` (cf. borne en tête). Le filtre `source` le
 *    couvre en pratique — aucune des entrées attestées ne cite le pool imprimé de base — mais une
 *    entrée sourcée qu'une liste imprimée énumérerait serait réclamée hors pool à tort ;
 *  - « statbloc » est lu comme « le fichier `creatures.json` » : un statbloc inline d'un projet de
 *    `src/scenes` compte comme un consommateur ORDINAIRE, donc laisse l'entrée au pool ;
 *  - la clé de def se lit sur `skillId`/`talentId`/`skill`/`id` du nœud porteur, comme partout dans
 *    ce fichier : une réf portée par un champ d'un autre nom échappe à la mesure.
 */
describe('#1457 B2 — une spec ATTESTÉE dont le seul consommateur est un statbloc est HORS POOL', () => {
  const FICHIER_STATBLOCS = 'data/creatures.json';

  /** `defId|specId` → fichiers qui l'emploient (`data/x.json`, `scenes/y.json`). */
  const consommateurs = new Map<string, Set<string>>();
  for (const [racine, dir] of RACINES) {
    for (const abs of fichiersDeDonnees(dir)) {
      const ou = `${racine}${abs.slice(dir.length).replace(/\\/g, '/')}`;
      let data: unknown;
      try { data = JSON.parse(readFileSync(abs, 'utf8')); } catch { continue; }
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!node || typeof node !== 'object') return;
        const n = node as Record<string, unknown>;
        const defId = (n.skillId ?? n.talentId ?? n.skill ?? n.id) as string | undefined;
        if (typeof defId === 'string' && typeof n.spec === 'string' && DEF_BY_ID.has(defId)) {
          const cle = `${defId}|${n.spec}`;
          if (!consommateurs.has(cle)) consommateurs.set(cle, new Set());
          consommateurs.get(cle)!.add(ou);
        }
        for (const v of Object.values(n)) walk(v);
      };
      walk(data);
    }
  }

  const statblocSeul = (defId: string, specId: string): boolean => {
    const ou = consommateurs.get(`${defId}|${specId}`);
    return !!ou && ou.size === 1 && ou.has(FICHIER_STATBLOCS);
  };

  it('la mesure ATTEINT bien les statblocs (sinon le contrat est vide et toujours vert)', () => {
    const vues = [...consommateurs.values()].filter((ou) => ou.has(FICHIER_STATBLOCS));
    expect(vues.length).toBeGreaterThan(50);
  });

  it('les DEUX catalogues sont dans le périmètre (Compétences ET Talents)', () => {
    const horsPool = DEFS.filter((d) => (d.specs ?? []).some((e) => e.pool === false)).map((d) => d.id);
    expect(horsPool.some((id) => EST_COMPETENCE.has(id)), 'aucune Compétence hors pool').toBe(true);
    expect(horsPool.some((id) => !EST_COMPETENCE.has(id)), 'aucun Talent hors pool').toBe(true);
  });

  it('toute spec ATTESTÉE employée par les SEULS statblocs porte `pool: false`', () => {
    const manquants: string[] = [];
    for (const def of DEFS) {
      for (const e of def.specs ?? []) {
        if (!e.source || e.pool === false) continue;
        if (statblocSeul(def.id, specEntryId(e))) {
          manquants.push(
            `${def.id}/${specEntryId(e)} (${e.source.book} ${e.source.page ?? '?'}) : ${FICHIER_STATBLOCS} est son SEUL consommateur`,
          );
        }
      }
    }
    expect(
      manquants,
      'spéc(s) attestées que seul un statbloc emploie et que le pool PROPOSE quand même — poser ' +
        `\`pool: false\` (par la migration qui les a créées, jamais à la main) :\n${manquants.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * #1897 — un EMPLACEMENT se désigne dans le pool JOUEUR de son entrée (`LDB 09 l.40` ; `specPoolOf` :
 * `wildcardSpecs` au créateur et à l'avancement, `designateSpec` au spawn). EMPLACEMENT = `choix: true`
 * (avancement, ops à `choix`, statblocs) ou joker `spec` « au choix » (`SENTINELLE_CHOIX`, réfs de
 * Talent de statbloc) ; `choix: [ids]` propose ses ids et n'est pas mesuré. Une entrée dont le
 * catalogue n'est fait que de specs `pool: false` rendrait l'emplacement indésignable : refusé ici, à
 * l'authoring, sur les DEUX racines authorées. La clé de def se lit sur l'`id` du nœud porteur ; un id
 * commun à une Compétence et à un Talent (`resistance`) n'est fautif que si AUCUNE des deux n'a de pool.
 */
type DefASpecs = Parameters<typeof specPoolOf>[0];
function choixSansPoolJoueur(documents: [string, unknown][], defsDe: (id: string) => DefASpecs[]): { vus: number; fautes: string[] } {
  let vus = 0;
  const fautes: string[] = [];
  const walk = (node: unknown, ou: string): void => {
    if (Array.isArray(node)) { node.forEach((x) => walk(x, ou)); return; }
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    const emplacement = n.choix === true ? 'choix' : typeof n.spec === 'string' && SENTINELLE_CHOIX.test(n.spec) ? n.spec : null;
    if (typeof n.id === 'string' && emplacement) {
      const defs = defsDe(n.id);
      if (defs.length) {
        vus++;
        if (defs.every((d) => specPoolOf(d).length === 0)) fautes.push(`${ou} : « ${n.id} » en « ${emplacement} » — pool joueur VIDE`);
      }
    }
    for (const v of Object.values(n)) walk(v, ou);
  };
  for (const [ou, doc] of documents) walk(doc, ou);
  return { vus, fautes };
}

describe('#1897 — un emplacement ne vise jamais une entrée à pool JOUEUR vide', () => {
  const defsDe = (id: string): DefASpecs[] => [...skills, ...talents].filter((d) => d.id === id);
  const documents: [string, unknown][] = RACINES.flatMap(([racine, dir]) =>
    fichiersDeDonnees(dir).map((abs): [string, unknown] => [`${racine}${abs.slice(dir.length).replace(/\\/g, '/')}`, JSON.parse(readFileSync(abs, 'utf8'))]),
  );

  it('les deux racines authorées : aucun emplacement sur une entrée sans pool joueur', () => {
    const { vus, fautes } = choixSansPoolJoueur(documents, defsDe);
    expect(vus, 'aucun `choix` vu : le walk ne mesurerait rien').toBeGreaterThan(0);
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('la garde MORD : un catalogue fait de specs `pool: false` seules rend le `choix` fautif, nommément', () => {
    const fixture: DefASpecs[] = [{ specs: [{ id: 'statbloc-seul', label: 'Statbloc seul', pool: false }] } as DefASpecs];
    const { fautes } = choixSansPoolJoueur(
      [['fixture.json', [{ id: 'x', choix: true }, { id: 'x', spec: 'au choix' }, { id: 'x', choix: ['statbloc-seul'] }, { id: 'x', spec: 'statbloc-seul' }]]],
      (id) => (id === 'x' ? fixture : []),
    );
    expect(fautes).toEqual(['fixture.json : « x » en « choix » — pool joueur VIDE', 'fixture.json : « x » en « au choix » — pool joueur VIDE']);
  });

  it('une entrée à `specs` inline toutes `pool: false` et SANS emplacement qui la vise n’est pas fautive (`attirant`, `LDB 08 l.140`)', () => {
    const fixture: DefASpecs[] = [{ specs: [{ id: 'public-restreint', label: 'Public restreint', pool: false }] } as DefASpecs];
    const { fautes } = choixSansPoolJoueur([['fixture.json', [{ id: 'x' }, { id: 'x', spec: 'public-restreint' }]]], (id) => (id === 'x' ? fixture : []));
    expect(fautes).toEqual([]);
  });
});

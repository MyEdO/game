/**
 * LES MIGRATIONS DÉJÀ JOUÉES ET RETOUCHÉES, REJOUÉES SUR UN ARBRE JETABLE (#1467 L1b V-FLIP-ENTITE).
 *
 * `2026-08-28-l1b-6a` a renommé `type`→`polarite` (qualities), `6c` `type`→`nature`
 * (characteristics), `6b` `type`→`acces` (skills), `6d` `type`→`categorie` (trappings) et `6e`
 * `type`→`ecole` (spells). L'adoption de `document()` a ensuite posé une clé d'ENVELOPPE `type` — le
 * NOM DU DOCUMENT — sur ces mêmes entrées, que ces scripts lisaient comme l'ancien scalaire
 * ressuscité (« arbitrage requis » sur toutes les entrées, rejeu ROUGE). Ils distinguent désormais
 * les deux par `typeAncien()` — 6a/6c à la vague 11b, 6b à la vague 12a, 6d/6e à la vague 12b.
 * CINQ scripts sont donc tenus ici ; ajouter une retouche sans ajouter son cas laisserait le geste le
 * plus risqué du lot sans témoin. Ce fichier tient la famille `type`→<clé métier> sur `src/data` ; la
 * famille « bump de FORME » du document de projet (`src/scenes/<c>/<c>-projet.json`) est tenue par sa
 * sœur `src/scenes/migrations-format-projet.test.ts`, même doctrine, `Cas` incompatible (ni `type`,
 * ni cardinal, ni la même indentation de sérialiseur). Il tient enfin, au PRÉSENT et sur les `.json`
 * de `src/data` PARTITIONNÉS SANS RESTE, l'enveloppe `id, type` que les vagues 10 à 12 ont posée
 * (dernier `describe`) — c'est la SEULE garde de ce contrat, les vagues ne le redoublent pas.
 *
 * RETOUCHER UN SCRIPT DÉJÀ JOUÉ est le geste le plus risqué du lot : ce test le tient. Il exécute les
 * VRAIS fichiers de `scripts/migrations/` — copiés dans un arbre temporaire pour que leur
 * `new URL('../../')` y résolve — sur des fixtures GELÉES ici (aucun `git show` : un test qui en
 * dépend casse en clone superficiel).
 *
 * Trois cas par script :
 *  A. donnée HISTORIQUE, dont le `type` porte encore la valeur métier → migrée, valeur conservée ;
 *  B. COLLISION forcée : un `type` hors vocabulaire, que rien ne permet de trancher → fail-fast
 *     BRUYANT, exit 1, rien d'écrit ;
 *  C. ARBITRAGE « porte À LA FOIS » : `type` métier ET clé neuve sur la même entrée → mord toujours.
 *
 * Le NO-OP sur l'état courant de l'arbre est mesuré sur la donnée RÉELLE par le rejeu
 * (`scripts/migrations/replay.mjs`, job CI `migrations` et pre-push) ; ce qui est tenu ICI, c'est ce
 * dont ce rejeu dépend : la donnée committée est à l'ÉTAT D'ARRIVÉE (`type` d'enveloppe + clé neuve
 * sur chaque entrée), sans quoi le rejeu emprunterait une autre branche que celle qu'il croit.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));

interface Cas {
  readonly script: string;
  readonly fichier: string;
  /** Clé NEUVE que la migration a introduite (`polarite`/`nature`). */
  readonly cleNeuve: string;
  /** Cardinal EXIGÉ par le script (constante `ATTENDU`). */
  readonly cardinal: number;
  /** Valeurs historiques du scalaire `type`, cyclées pour peupler la fixture. */
  readonly valeurs: readonly string[];
  /**
   * Fichier ANNEXE que le script lit AUSSI et dont il exige le cardinal (`6d` : `merchantFamilies`,
   * 7 entrées, où il renomme `match.trappingType`→`match.categorie`). Il est écrit À SON ÉTAT DÉJÀ
   * MIGRÉ : les quatre cas ci-dessous portent sur le fichier PRINCIPAL, l'annexe ne doit jamais être
   * ce qui fait rougir — sans quoi le cas C mesurerait la mauvaise cause.
   */
  readonly annexe?: { readonly fichier: string; readonly contenu: readonly Record<string, unknown>[] };
}

const CAS: readonly Cas[] = [
  {
    script: '2026-08-28-l1b-6a-qualities-polarite.mjs',
    fichier: 'qualities.json',
    cleNeuve: 'polarite',
    cardinal: 59,
    valeurs: ['atout', 'defaut'],
  },
  {
    script: '2026-08-28-l1b-6c-characteristics-nature.mjs',
    fichier: 'characteristics.json',
    cleNeuve: 'nature',
    cardinal: 19,
    valeurs: ['roll', 'wounds', 'extra', 'mv', 'points', 'compteur'],
  },
  {
    script: '2026-08-28-l1b-6b-skills-acces.mjs',
    fichier: 'skills.json',
    cleNeuve: 'acces',
    cardinal: 48,
    // La graphie accentuée `avancée` que 6b NORMALISE est absente d'ici à dessein : le cas A compare
    // la valeur rendue à la valeur d'entrée, il ne mesurerait pas le renommage mais la normalisation
    // (couverte, elle, par la preuve post-écriture du script lui-même).
    valeurs: ['base', 'avancee'],
  },
  {
    script: '2026-08-28-l1b-6d-trappings-categorie.mjs',
    fichier: 'trappings.json',
    cleNeuve: 'categorie',
    cardinal: 441,
    valeurs: ['melee', 'ranged', 'ammunition', 'armor', 'trapping'],
    annexe: {
      fichier: 'merchantFamilies.json',
      contenu: Array.from({ length: 7 }, (_, i) => ({ id: `f-${i}`, match: { categorie: 'trapping' } })),
    },
  },
  {
    script: '2026-08-28-l1b-6e-spells-ecole.mjs',
    fichier: 'spells.json',
    cleNeuve: 'ecole',
    cardinal: 576,
    // `6e` n'a PAS de vocabulaire fermé (l'école est un libellé hérité, 18 valeurs) : il exige une
    // chaîne NON VIDE. Le cas C ci-dessous en tient compte — cf. `collisionne`.
    valeurs: ['Magie mineure', 'Magie Mineure', 'Petite Magie'],
  },
];

/**
 * Ce qu'une valeur de `type` doit valoir pour que le script REFUSE de trancher. Deux régimes réels :
 * un vocabulaire FERMÉ (6a/6b/6c/6d) où toute valeur étrangère mord, et 6e qui n'exige qu'une chaîne
 * NON VIDE — sa seule valeur refusable est donc `''`. Sans cette distinction, le cas C serait VERT
 * sur 6e en croyant tester un fail-fast.
 */
const collisionne = (cas: Cas): string => (cas.script.includes('-6e-') ? '' : 'valeur-inconnue');

/** Écrit `data` à la forme CANONIQUE que les deux scripts exigent avant de lire. */
const canonique = (data: unknown) => JSON.stringify(data, null, 2);

/** Arbre jetable : `<tmp>/scripts/migrations/<script>` + `<tmp>/src/data/<fichier>`. */
function arbre(cas: Cas, entrees: Record<string, unknown>[]): { dir: string; cible: string; script: string } {
  const dir = mkdtempSync(join(tmpdir(), 'mig-11b-'));
  mkdirSync(join(dir, 'scripts', 'migrations'), { recursive: true });
  mkdirSync(join(dir, 'src', 'data'), { recursive: true });
  const script = join(dir, 'scripts', 'migrations', cas.script);
  copyFileSync(join(RACINE, 'scripts', 'migrations', cas.script), script);
  const cible = join(dir, 'src', 'data', cas.fichier);
  writeFileSync(cible, canonique(entrees), 'utf8');
  if (cas.annexe) writeFileSync(join(dir, 'src', 'data', cas.annexe.fichier), canonique(cas.annexe.contenu), 'utf8');
  return { dir, cible, script };
}

/** Joue le script ; rend le code de sortie et le contenu du fichier APRÈS. */
function joue(cas: Cas, entrees: Record<string, unknown>[]): { code: number; apres: string; avant: string } {
  const { dir, cible, script } = arbre(cas, entrees);
  const avant = readFileSync(cible, 'utf8');
  let code = 0;
  try {
    execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    code = (e as { status?: number }).status ?? 1;
  }
  const apres = readFileSync(cible, 'utf8');
  rmSync(dirname(dirname(dirname(cible))), { recursive: true, force: true });
  void dir;
  return { code, apres, avant };
}

/** Fixture HISTORIQUE : l'ancien scalaire `type`, aucune clé neuve, aucune enveloppe. */
const historique = (cas: Cas) =>
  Array.from({ length: cas.cardinal }, (_, i) => ({ id: `e-${i}`, type: cas.valeurs[i % cas.valeurs.length], label: `E${i}` }));

describe.each(CAS)('migration $script — retouchée pour le `type` d’ENVELOPPE', (cas) => {
  it('A. donnée HISTORIQUE : le renommage joue, et la valeur est CONSERVÉE entrée par entrée', () => {
    const entrees = historique(cas);
    const { code, apres } = joue(cas, entrees);
    expect(code, 'la migration doit réussir sur la donnée historique').toBe(0);
    const attendu = entrees.map((e) => ({ id: e.id, [cas.cleNeuve]: e.type, label: e.label }));
    expect(apres).toBe(canonique(attendu));
  });

  it('B. COLLISION : une entrée dont le `type` n’est NI l’enveloppe NI une valeur connue → fail-fast, rien d’écrit', () => {
    const entrees = historique(cas);
    entrees[0] = { id: 'e-0', type: collisionne(cas), label: 'E0' };
    const { code, apres, avant } = joue(cas, entrees);
    expect(code, 'une valeur hors vocabulaire doit ARRÊTER la migration').toBe(1);
    expect(apres, 'aucune écriture avant arbitrage').toBe(avant);
  });

  it('C. ARBITRAGE : ancien `type` ET clé neuve sur la même entrée → mord toujours, rien d’écrit', () => {
    const entrees = historique(cas);
    entrees[0] = { id: 'e-0', type: cas.valeurs[0], label: 'E0', [cas.cleNeuve]: cas.valeurs[0] };
    const { code, apres, avant } = joue(cas, entrees);
    expect(code, 'la double graphie reste un arbitrage, jamais un choix silencieux').toBe(1);
    expect(apres, 'aucune écriture avant arbitrage').toBe(avant);
  });

  /**
   * ÉTAT D'ARRIVÉE de la donnée RÉELLE, sans quoi le rejeu CI n'exercerait pas ce qu'il croit
   * exercer : c'est parce que le fichier committé porte le `type` d'ENVELOPPE et la clé neuve sur
   * CHAQUE entrée que le no-op mesuré par `scripts/migrations/replay.mjs` passe par la branche
   * « déjà migré ». Le `type` d'enveloppe se DÉRIVE du nom de fichier, comme la partition en fin de
   * fichier — aucune valeur recopiée, aucun cardinal : la donnée grandit, le contrat ne bouge pas.
   */
  it('la donnée RÉELLE est à l’état d’arrivée : `type` d’enveloppe et clé neuve sur CHAQUE entrée', () => {
    const enveloppe = cas.fichier.replace(/\.json$/, '');
    const entrees = JSON.parse(readFileSync(join(RACINE, 'src', 'data', cas.fichier), 'utf8')) as Record<string, unknown>[];
    expect(entrees.length, `${cas.fichier} est vide : le rejeu n’exercerait plus rien`).toBeGreaterThan(0);
    const horsEnveloppe = entrees.filter((e) => e.type !== enveloppe).map((e) => `${cas.fichier} ${String(e.id)} : type ${JSON.stringify(e.type)}`);
    expect(horsEnveloppe, `entrée(s) au \`type\` ≠ ${JSON.stringify(enveloppe)} :\n${horsEnveloppe.slice(0, 10).join('\n')}`).toEqual([]);
    const sansCleNeuve = entrees.filter((e) => !(cas.cleNeuve in e)).map((e) => `${cas.fichier} ${String(e.id)}`);
    expect(sansCleNeuve, `entrée(s) sans \`${cas.cleNeuve}\` :\n${sansCleNeuve.slice(0, 10).join('\n')}`).toEqual([]);
  });
});

/**
 * FIDÉLITÉ DE LA VAGUE 12b — la migration `type` n'ajoute QUE `type`, sur toutes les entrées des
 * derniers datasets `entite`, et retire la SEULE `desc: ""` qu'elle DÉCLARE (`species › humains-tileens`).
 *
 * La migration porte déjà cette preuve en post-écriture, mais elle ne la porte QUE le jour où elle
 * écrit : rejouée sur l'état final, elle sort en no-op sans rien comparer. Ce test-ci la tient au
 * PRÉSENT, sur l'arbre committé — un `type` retiré, une charge utile modifiée ou une purge non
 * déclarée le fait rougir, sans dépendre d'un rejeu.
 */
describe('vague 12b — la donnée porte son `type` et RIEN d’autre n’a bougé', () => {
  /**
   * PÉRIMÈTRE de la vague — ses datasets ENCORE DOCUMENTÉS, recopiés de la table `TYPES` de la migration. Le
   * `type` attendu, lui, n'est PAS repris : l'enveloppe (`id,type` en tête, `type` = nom de base) est
   * gardée UNE fois, sur tout `src/data`, par la partition en fin de fichier. Ne reste ici que ce qui
   * est PROPRE à 12b : sa purge déclarée, le champ qu'elle tue, celui qu'elle GARDE.
   */
  const PERIMETRE_12B = [
    'actions.json',
    'activities.json',
    'creatures.json',
    'night-stakes.json',
    'psychology.json',
    'raceAppearance.json',
    'species.json',
    'spells.json',
    'structureAppearance.json',
    'tavernGames.json',
    'trappings.json',
  ] as const;
  const lu = (f: string) => JSON.parse(readFileSync(join(RACINE, 'src', 'data', f), 'utf8')) as Record<string, unknown>[];

  it('AUCUNE `desc` vide ne subsiste, et `species › humains-tileens` n’en porte plus du tout', () => {
    const vides: string[] = [];
    for (const f of PERIMETRE_12B) {
      for (const e of lu(f)) if (e.desc === '') vides.push(`${f} ${String(e.id)}`);
    }
    expect(vides, 'la chaîne vide est un TROISIÈME état — absente plutôt que vide').toEqual([]);
    const tileens = lu('species.json').find((e) => e.id === 'humains-tileens');
    expect(tileens, '`humains-tileens` a disparu de species.json').toBeDefined();
    expect('desc' in tileens!, 'la purge DÉCLARÉE de la vague 12b retire la clé, elle ne la vide pas').toBe(false);
  });

  it('`creatures › group` est MORT de la donnée, et `title` y SURVIT (#1541)', () => {
    const creatures = lu('creatures.json');
    expect(creatures.filter((e) => 'group' in e), '`group` est soldé : 0 porteur, 0 consommateur').toEqual([]);
    // Le contre-témoin : la même vague qui tue `group` ne touche PAS `title`, qualificatif de statbloc
    // recopié du livre (règle 5 — on ne détruit pas de la donnée sourcée).
    const porteurs = creatures.filter((e) => 'title' in e);
    expect(porteurs.length, '`title` est REQUIS (nullable ≠ optional) : toutes les entrées le portent').toBe(creatures.length);
    expect(porteurs.filter((e) => e.title !== null).length, 'aucun `title` renseigné : la vague l’aurait vidé').toBeGreaterThan(0);
  });
});

/**
 * ENVELOPPE `id,type` — la garde EXHAUSTIVE, sur les `.json` de `src/data` PARTITIONNÉS SANS RESTE.
 *
 * C'est la SEULE garde de ce contrat : les `describe` ci-dessus ne tiennent que ce qui est propre à
 * leur vague. Le contrat lui-même est celui de `src/data/schemas/grammaire/sans-livre.ts:22`, que les
 * vagues 10 à 12 écrivent toutes et que le schéma tient par `z.literal(<type>)`.
 *
 * Le périmètre n'est pas une liste recopiée, et il ne se rétrécit pas non plus par un filtre muet :
 * les fichiers sont PARTITIONNÉS, et la partition « autre » est asservie à VIDE. Un `.json` qui n'est
 * ni un tableau d'entrées ni une racine à `id` fait rougir tant qu'il n'est pas NOMMÉ ici avec sa
 * raison — un filtre `Array.isArray` seul laissait 41 racines OBJET hors scan sans le dire, alors que
 * les 41 satisfont le même contrat, sur la RACINE au lieu de chaque entrée.
 */
describe('enveloppe — les `.json` de `src/data`, partitionnés SANS reste', () => {
  const estObjet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

  const FICHIERS = listerDossier(join(RACINE, 'src', 'data')).filter((f) => f.endsWith('.json'));
  const DOCS = FICHIERS.map((f) => [f, JSON.parse(readFileSync(join(RACINE, 'src', 'data', f), 'utf8')) as unknown] as const);

  /** PARTITION 1 — racine TABLEAU d'entrées : le contrat porte sur CHAQUE entrée. */
  const TABLEAUX = DOCS.filter(([, doc]) => Array.isArray(doc) && doc.length > 0 && doc.every(estObjet)).map(
    ([f, doc]) => [f, doc as Record<string, unknown>[]] as const,
  );
  /** PARTITION 2 — racine OBJET à `id` (familles `config`/`table`) : le contrat porte sur la RACINE. */
  const OBJETS = DOCS.filter(([, doc]) => estObjet(doc) && typeof doc.id === 'string').map(
    ([f, doc]) => [f, doc as Record<string, unknown>] as const,
  );
  /** PARTITION 3 — le RESTE, asservi à VIDE : mesuré 0/119 le 2026-09-05. */
  const PARTITIONNES = new Set([...TABLEAUX, ...OBJETS].map(([f]) => f));
  const AUTRES = FICHIERS.filter((f) => !PARTITIONNES.has(f));

  /** Plancher mesuré le 2026-09-18 : 121 `.json` = 79 tableaux + 42 racines objet + 0 reste
   *  (121 → 119 : les trois catalogues de matières fusionnent en `materials.json`, #1686 lot 2 ;
   *  119 → 120 : `terrains.json` naît du registre TS des 25 sols, #1690 ;
   *  120 → 121 : `semences-de-scene.json` naît des littéraux d'`emptyScene`, #1716). */
  const PLANCHER = 121;

  /** Le contrat, identique aux deux partitions : tête `id,type`, `type` = nom de base du dataset. */
  const horsContrat = (fichier: string, doc: Record<string, unknown>, quoi: string): string[] => {
    const attendu = fichier.replace(/\.json$/, '');
    const cles = Object.keys(doc);
    const fautes: string[] = [];
    if (cles[0] !== 'id' || cles[1] !== 'type') fautes.push(`${fichier} ${quoi} : tête ${cles.slice(0, 2).join(',')} ≠ id,type`);
    if (doc.type !== attendu) fautes.push(`${fichier} ${quoi} : type ${JSON.stringify(doc.type)} ≠ ${JSON.stringify(attendu)}`);
    return fautes;
  };

  it(`les ${PLANCHER} \`.json\` tombent tous dans une partition CONNUE, sans reste`, () => {
    expect(
      AUTRES,
      'ni tableau d’entrées ni racine à `id` : à NOMMER ici avec sa raison, jamais à filtrer en silence',
    ).toEqual([]);
    expect(TABLEAUX.length + OBJETS.length + AUTRES.length).toBe(FICHIERS.length);
    expect(FICHIERS.length).toBeGreaterThanOrEqual(PLANCHER);
    // Les quatre datasets que le cycle 10⇄12a « tenait » par accident, nommés pour qu'un scan qui
    // les perdrait ne puisse pas rester vert.
    const tableaux = TABLEAUX.map(([f]) => f);
    for (const f of ['props.json', 'raw.manifest.json', 'materials.json', 'terrains.json']) {
      expect(tableaux, `${f} hors de la partition « tableau »`).toContain(f);
    }
    // Et trois témoins de la partition OBJET, celle qu'un filtre `Array.isArray` excluait en silence.
    const objets = OBJETS.map(([f]) => f);
    for (const f of ['weather.json', 'montures.json', 'donnees.manifest.json']) {
      expect(objets, `${f} hors de la partition « racine objet »`).toContain(f);
    }
  });

  it('racine TABLEAU : chaque ENTRÉE ouvre sur `id`, `type`, et son `type` est le NOM DE BASE', () => {
    const fautes = TABLEAUX.flatMap(([f, doc]) => doc.flatMap((e) => horsContrat(f, e, String(e.id))));
    expect(fautes, `entrée(s) hors enveloppe :\n${fautes.slice(0, 10).join('\n')}`).toEqual([]);
  });

  it('racine OBJET : le DOCUMENT ouvre sur `id`, `type`, et son `type` est le NOM DE BASE', () => {
    const fautes = OBJETS.flatMap(([f, doc]) => horsContrat(f, doc, '(racine)'));
    expect(fautes, `document(s) hors enveloppe :\n${fautes.slice(0, 10).join('\n')}`).toEqual([]);
  });
});

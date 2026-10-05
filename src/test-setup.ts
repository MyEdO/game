/**
 * Setup global Vitest (`test.setupFiles`).
 *
 * 1. RESET DES SINGLETONS ENTRE TESTS (requis par `test.isolate: false`, cf. vite.config.ts).
 *    `isolate: false` partage le graphe de modules entre fichiers d'un même worker (le moteur pur +
 *    ~1 Mo de `src/data/*.json` sont évalués UNE fois par worker, au lieu d'une fois par fichier) → la
 *    suite passe de ~80 s à ~17 s. Contrepartie : les SINGLETONS de module gardent leur état d'un test
 *    à l'autre. On repart donc d'un état NEUF avant CHAQUE test (les hooks de setupFile sont les plus
 *    EXTERNES → s'exécutent AVANT le `beforeEach` propre du fichier, qui pose ensuite son décor) :
 *    - le STORE Zustand (`useGame`) : même reset « zéro-maintenance » que `startScene` (le JSON
 *      round-trip retire les fonctions → seules les données sont remises à plat ; le merge partiel de
 *      zustand préserve les actions).
 *    - le REGISTRE DES RÈGLES OPTIONNELLES (`engine/policy`) : `loadRuleOverrides({})` purge toute
 *      surcharge runtime → toutes les règles reviennent à leur défaut RAW (sinon une règle maison
 *      posée par un test — `cleave`, `combat-optional-rules`… — fuit dans un test pur ultérieur).
 *    - le REGISTRE DES CONSÉQUENCES DE CASCADE (`state/cascade`) : peuplé à l'import par les modules de
 *      domaine (restFlow/combatFlow/travelFlow — TOUJOURS importés ici via le store), mais aussi PAR
 *      LES TESTS (`cascade.test` enregistre un faux `shelter`, `cadence-rapide` un faux `tally`…). On
 *      capture le registre RÉEL avant chaque test et on le restaure après (retrait des kinds ajoutés,
 *      restauration des kinds écrasés) — sinon un faux applier écrase le vrai et fuit (ex. `shelter`
 *      écrasé → `rest-flow` n'insère plus l'Exposition).
 *    - le RNG DE COMBAT (`state/battleRng`) : semé par `seedBattleRng`/`store.seedRng`, il garde sinon
 *      la POSITION de flux laissée par le fichier précédent (cf. le bloc `seedBattleRng` ci-dessous).
 *    - la PRÉFÉRENCE « Dés fixés » (`engine/fixedDie`, `resetDesFixes`) et le DRAPEAU de ré-entrance
 *      `onOwnTestFailed` (`state/triggeredEffects`, `resetOwnTestFailedGuard`) — cf. les commentaires
 *      du `beforeEach` ci-dessous.
 *    - le REGISTRE DES SCÈNES (`sceneRegistry`, `state/store`) : peuplé par `registerScene`/`loadProject`
 *      — donc aussi par des TESTS. Vidé en `afterEach` (`resetSceneRegistry`) : la pollution INTER-fichiers meurt. PORTÉE RÉELLE, mesurée et gardée par
 *      `state/scene-registry-isolation.test.ts` : un enregistrement de TÊTE DE FICHIER (module,
 *      `beforeAll`) ne vaut que pour le PREMIER test — le teardown l'efface comme les autres. Un fichier
 *      qui a besoin du registre sur PLUSIEURS tests l'(ré)enregistre en `beforeEach` (`shipwreck.test.ts`,
 *      via `freshState`). Une scène laissée au registre changeait le comportement des fichiers suivants
 *      du worker : `transitionTo` est un NO-OP sur scène inconnue (`state/store.ts`) — la même clôture
 *      de séquence transitionnait ou non selon la partition, d'où des rouges CI verts en local (#1014).
 *    - la PILE DES COUCHES DISMISSIBLES et sa PORTE clavier (`state/dismissStack` + `ui/useDismissLayer`,
 *      `resetDismissLayers`) : la pile des surfaces congédiables et le refcount de l'écouteur Échap sont
 *      des singletons de module. Le congédiement allant à la couche du DESSUS, une couche laissée par un fichier
 *      voisin décide si Échap atteint la surface qu'un banc mesure ou une autre : le rendez-vous entre
 *      l'appui et la surface dépendait de l'ordre des fichiers du worker (#1442, rouges CI intermittents
 *      sur `ui/compendium/CodexRef.hooks.test.tsx`, verts en local). Mesuré : une couche étrangère au
 *      sommet reproduit le rouge à l'identique, et le TEMPS n'y change rien (la fermeture est synchrone).
 *      Les bancs de la couture gardent en plus leur propre `resetDismissLayers` en `beforeEach` — ils
 *      posent leur décor de pile, ils ne dépendent pas de ce filet.
 *    - les REGISTRES D'ART du rig (cf. `rigArtRegistrySignatures` plus bas) : objets de module, donc
 *      partagés par tous les fichiers du worker. Un test qui en pose un le remet lui-même : on DÉTECTE
 *      leur dérive après chaque test, on échoue AU SITE qui l'a laissée, puis on remet EN PLACE la
 *      valeur capturée au chargement (`ART_RIG_ORIGINE`) — le test suivant part des tables d'origine.
 *      Un nettoyage `delete` sur une clé que le registre déclarait VRAIMENT amputait
 *      la plaque (gantelet/soleret/gorgerin) pour tous les fichiers suivants — CI rouge sur le golden
 *      de combat et `enemyProfile`, verte en local, selon l'ordre des fichiers du worker (2026-07-29).
 *
 * 2. FILET D'ISOLATION DES TIMERS. Le combat planifie l'IA et l'enchaînement des tours via de VRAIS
 *    `setTimeout` (`combatFlow.ts`/`combatDirector.ts`/`combatAuto.ts`, via `scheduleCombatTimer` de
 *    `state/combatTimers.ts`) qui MUTENT `battle` et tirent `battleRng` (singleton de module) à leur
 *    échéance. Un test qui arme `vi.useFakeTimers()` sans le restaurer laisse des timers fantômes :
 *    `vi.useRealTimers()` DÉSINSTALLE l'horloge factice et JETTE ses timers en attente (en mode réel,
 *    c'est un no-op → ZÉRO risque). Mais un test SYNCHRONE qui déclenche un beat de combat AVANT de
 *    rendre la main arme un timer RÉEL (`setTimeout` natif, pas `vi.useFakeTimers`) que `vi.useRealTimers()`
 *    ne touche pas : sous `isolate:false` (module partagé entre fichiers du worker), ce timer en vol se
 *    déclenche pendant un test ULTÉRIEUR et corrompt son `battle`/sa séquence de RNG (#405, flake
 *    d'ordonnancement). `clearTrackedTimers()` annule tout timer tracé encore en vol au teardown (#405, #415).
 *
 * 3. BARRIÈRE DE FUITE DOM (`residusDom`/`messageResiduDom`, `afterEach`). react-dom est lui aussi un
 *    module partagé par le worker sous `isolate:false` : une racine laissée MONTÉE par un fichier se met
 *    à jour hors `act()` pendant les fichiers suivants (« Attempted to synchronously unmount a root while
 *    React was already rendering », « Should not already be working ») et leurs rendus deviennent VIDES
 *    (#1619). Tout nœud ÉLÉMENT resté enfant de `document.body` ou de `document.head` après un test
 *    échoue AU FICHIER FAUTIF, puis est retiré : le fichier suivant part d'un document vierge (#2286).
 *    Banc : `src/residu-dom-barriere.test.ts`.
 *
 * 4. BARRIÈRE DES RACINES MONTÉES ET DES `act()` EN VOL (`instrumenterRacines`/`messageRacineMontee`/
 *    `messageActEnVol`, `afterEach`). Le nœud resté dans `document.body` n'est qu'un SYMPTÔME : une
 *    racine montée sur un conteneur DÉTACHÉ ne laisse aucun nœud et reste pourtant au planificateur
 *    react-dom du worker. Le compte est pris sur le PROTOTYPE des racines (`render` inscrit le fichier
 *    courant, `unmount` le retire) : chaque fichier est jugé sur ce QU'IL a rendu, et la fuite se dit
 *    chez lui, jamais chez la victime qui lève « Should not already be working » plus loin (#1724).
 *
 * 5. GARDE DE PARTAGE (`partagesDeLEtat`, `afterEach`, #2097) : l'état laissé par le test n'atteint
 *    aucune donnée par identité. Racines et sources : `state/partage.testkit.ts`.
 *
 * Les barrières §1 (art), §3, §4 et §5 jouent en TROIS temps : elles LISENT toutes les fuites, REMETTENT
 * l'état partagé à vierge, puis JUGENT par un seul `throw` qui joint tous les verdicts. Aucune ne
 * masque l'autre, et aucun résidu ne survit à son verdict pour accuser la victime suivante (#2286).
 */
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { useGame, resetSceneRegistry, scenesDuRegistre, type GameState } from './state/store';
import { partagesDeLEtat } from './state/partage.testkit';
import './data/overrides'; // gel des entrées du catalogue au chargement (#2097)
import { loadRuleOverrides } from './engine/policy';
import { cascadeAppliers } from './state/cascade';
import { clearTrackedTimers } from './state/combatTimers';
import { resetOwnTestFailedGuard } from './state/triggeredEffects';
import { resetDesFixes } from './engine/fixedDie';
import { seedBattleRng } from './state/battleRng';
import { reinitWebglRefusé } from './gameIso/stage/webglSupport';
import { resetDismissLayers } from './ui/useDismissLayer';

// État initial figé UNE fois (le `stringify` est la moitié coûteuse, et le geler à l'init le rend
// immunisé à toute mutation du gabarit) ; chaque test n'en `parse` qu'une copie fraîche.
const PRISTINE_STATE = JSON.stringify(useGame.getInitialState());
let cascadeSnapshot: Record<string, (typeof cascadeAppliers)[string]> = {};

/**
 * Modules d'art des parts du rig, énumérés STRUCTURELLEMENT (`import.meta.glob` eager) : une famille
 * de parts déposée demain sous `parts/<famille>/` est couverte d'office, sans toucher ce fichier.
 * On prend `index.ts` (tables dérivées : `ARMOUR`, `TENUE_BY_ID`, `HEADS`…) ET `_registry.generated.ts`
 * (listes de defs : `HAIRSTYLE_DEFS`, `WEAPON_DEFS`… — `shields`/`weapons` n'ont pas d'`index.ts`).
 */
const RIG_PART_MODULES = import.meta.glob<Record<string, unknown>>(
  './gameIso/rig/parts/*/{index,_registry.generated}.ts',
  { eager: true },
);

/** Poids d'une valeur d'art : somme des longueurs de ses chaînes et de ses clés, en profondeur.
 *  N'alloue rien (contrairement à `JSON.stringify`) : 1,17 ms l'empreinte des 42 registres (~4,37 Mo
 *  d'art) contre 9,55 ms pour un `JSON.stringify` équivalent — mesuré 2026-08-23, régime établi sur
 *  3 148 tests. Prise à CHAQUE `afterEach` (granularité = LE TEST), elle coûte 3,7 s des 40 s de
 *  `src/engine` en mono-worker, soit ~23 s de CPU cumulés sur les 19 584 tests de la suite. */
const artWeight = (v: unknown, depth = 0): number => {
  if (typeof v === 'string') return v.length;
  if (v === null || v === undefined || typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v !== 'object' || depth > 16) return 2;
  let n = 0;
  if (Array.isArray(v)) {
    for (const e of v) n += 1 + artWeight(e, depth + 1);
    return n;
  }
  for (const [k, e] of Object.entries(v as Record<string, unknown>)) n += k.length + artWeight(e, depth + 1);
  return n;
};

/**
 * Signature PAR REGISTRE des tables d'art du rig : `clé:poids` par entrée, dans l'ordre de déclaration.
 * Détecte l'ajout, le retrait, le déplacement ET la SUBSTITUTION d'une valeur sous une clé existante
 * (`delete ARMOUR.plaque.pied` comme `ARMOUR.plaque.pied = '<g/>'` changent le poids de `plaque`).
 *
 * Angles morts ASSUMÉS, nominatifs :
 * - substitution de poids cumulé EXACTEMENT identique ;
 * - exports FONCTION, non pesables : `appendageArt`/`appendageFeature` (appendages), `feat`/
 *   `featureMorpho`/`elementsOf` (elements), `swapEye`/`applyEyes`/`eyesArtFromKeys` (eyes),
 *   `hairstylesForSex` (hairstyles) — aucun ne détient d'art, tous lisent une table pesée ici ;
 * - un `Map`/`Set` pèserait 0 (aucun à ce jour parmi les exports de `parts/*`) ;
 * - les registres d'art hors `parts/` : `rig/creatures/`, `rig/plans/`, `gameIso/catalog/`.
 */
export function rigArtRegistrySignatures(): Map<string, string> {
  const sigs = new Map<string, string>();
  for (const [cle, reg] of registresArtRig()) {
    const parts: string[] = [];
    for (const [k, entry] of Object.entries(reg)) {
      const id = entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
        ? (entry as { id: string }).id
        : k;
      parts.push(`${id}:${artWeight(entry)}`);
    }
    sigs.set(cle, parts.join('|'));
  }
  return sigs;
}

/** Registres d'art du rig, clé `famille#export` : l'unique énumération que signent les signatures et
 *  que la remise restaure. */
function registresArtRig(): Map<string, Record<string, unknown>> {
  const regs = new Map<string, Record<string, unknown>>();
  for (const [path, mod] of Object.entries(RIG_PART_MODULES)) {
    const family = path.split('/parts/')[1] ?? path;
    for (const [name, reg] of Object.entries(mod)) {
      if (reg && typeof reg === 'object') regs.set(`${family}#${name}`, reg as Record<string, unknown>);
    }
  }
  return regs;
}

type ArtObjet = Record<string, unknown>;

/** Cliché d'un objet d'art : la RÉFÉRENCE de l'objet et ses entrées dans l'ordre, chaque valeur objet
 *  clichée à son tour. Garder les références (et non une copie) rend la remise EXACTE : un objet
 *  imbriqué retiré ou substitué est remis lui-même, identité comprise. */
class ClicheArt {
  entrees: [string, unknown][] = [];
  constructor(readonly ref: ArtObjet, readonly longueur: number | null) {}
}

function clicherArt(v: unknown, vus = new Map<object, ClicheArt>()): unknown {
  if (v === null || typeof v !== 'object') return v;
  const deja = vus.get(v);
  if (deja) return deja;
  const c = new ClicheArt(v as ArtObjet, Array.isArray(v) ? v.length : null);
  vus.set(v, c);
  for (const [k, e] of Object.entries(v)) c.entrees.push([k, clicherArt(e, vus)]);
  return c;
}

/** Remet l'objet cliché EN PLACE : longueur, ordre des clés, valeurs et objets imbriqués d'origine.
 *  Rien n'est écrit là où rien n'a bougé (un sous-objet gelé reste intouché). */
function remettreArt(c: ClicheArt, vus = new Set<ClicheArt>()): void {
  if (vus.has(c)) return;
  vus.add(c);
  const o = c.ref;
  if (c.longueur !== null) {
    if ((o as unknown as unknown[]).length !== c.longueur) (o as unknown as unknown[]).length = c.longueur;
  } else {
    const cles = Object.keys(o);
    if (cles.length !== c.entrees.length || c.entrees.some(([k], i) => k !== cles[i])) {
      for (const k of cles) delete o[k];
    }
  }
  for (const [k, e] of c.entrees) {
    const attendu = e instanceof ClicheArt ? e.ref : e;
    if (o[k] !== attendu || !(k in o)) o[k] = attendu;
    if (e instanceof ClicheArt) remettreArt(e, vus);
  }
}

const PRISTINE_RIG_REGISTRIES = rigArtRegistrySignatures();
/** Cliché d'ORIGINE de chaque registre d'art, pris une fois au chargement du worker : la source de
 *  la remise après une dérive. */
const ART_RIG_ORIGINE = new Map([...registresArtRig()].map(([cle, reg]) => [cle, clicherArt(reg) as ClicheArt]));

/** Dérive de chaque registre d'art par rapport à l'origine : ligne de verdict par registre dérivé. */
function deriveArtRig(): Map<string, string> {
  const now = rigArtRegistrySignatures();
  const drifted = new Map<string, string>();
  for (const [reg, sig] of now) {
    const was = PRISTINE_RIG_REGISTRIES.get(reg);
    if (was === sig) continue;
    drifted.set(reg, was === undefined
      ? `${reg} : registre APPARU`
      : `${reg}\n  attendu = ${was}\n  obtenu  = ${sig}`);
  }
  for (const reg of PRISTINE_RIG_REGISTRIES.keys()) if (!now.has(reg)) drifted.set(reg, `${reg} : registre DISPARU`);
  return drifted;
}

/** Remet en place, à leur valeur d'origine, les registres d'art nommés. */
function remettreArtRig(cles: Iterable<string>): void {
  for (const cle of cles) {
    const origine = ART_RIG_ORIGINE.get(cle);
    if (origine) remettreArt(origine);
  }
}

/** Verdict de la barrière d'art : message nommant le fichier et les registres dérivés, ou `null`. */
export function messageDeriveArt(fichier: string, derives: readonly string[]): string | null {
  if (!derives.length) return null;
  return (
    `Registre d'art du rig laissé MUTÉ par ${fichier} (les tables de gameIso/rig/parts sont partagées par le worker).\n`
    + `Capturer la valeur d'origine et la REMETTRE (jamais un \`delete\` sec sur une clé déclarée).\n`
    + derives.join('\n')
  );
}

/** Description d'un nœud ÉLÉMENT résiduel : `<tag class="…">`, jamais son contenu (le nom suffit à
 *  retrouver le montage fautif, le contenu ferait un message illisible). */
export function residusDom(body: { children: ArrayLike<Element> } | null | undefined): string[] {
  if (!body) return [];
  return Array.from(body.children as ArrayLike<Element>).map((el) => {
    const tag = el.tagName.toLowerCase();
    const cls = el.getAttribute?.('class');
    return cls ? `<${tag} class="${cls}">` : `<${tag}>`;
  });
}

/** Clé d'un fichier de test dans les verdicts des barrières : chemin POSIX relatif à la racine du dépôt. */
export function cleFichierTest(testPath: string | undefined, racine = process.cwd()): string {
  if (!testPath) return '(fichier inconnu)';
  const p = testPath.split('\\').join('/');
  const r = racine.split('\\').join('/').replace(/\/$/, '');
  return p.startsWith(`${r}/`) ? p.slice(r.length + 1) : p;
}

/** Verdict de la barrière : message d'échec nommant le fichier, ou `null` s'il n'y a aucun résidu. */
export function messageResiduDom(
  fichier: string,
  conteneur: 'document.body' | 'document.head',
  residus: readonly string[],
): string | null {
  if (!residus.length) return null;
  return (
    `Nœud(s) laissé(s) dans ${conteneur} par ${fichier} (${residus.length}) : ${residus.join(' ')}\n`
    + `Sous test.isolate:false, react-dom est partagé par tout le worker : une racine restée montée se met à jour `
    + `hors act() pendant les fichiers SUIVANTS, qui rendent alors le vide (#1619).\n`
    + `Démonter ce que le test monte ET retirer son hôte (monterRacine/demonterRacines de src/monterRacine.testkit.ts).`
  );
}

/** Racine react-dom telle que la barrière l'observe : les deux gestes qui ouvrent et ferment un
 *  montage. */
type RacineReact = { render(children: unknown): void; unmount(): void };

/** Racines RENDUES et non démontées, chacune associée au fichier de test qui l'a rendue.
 *  La barrière de nœuds ci-dessus ne voit qu'un enfant resté dans `document.body` : une racine
 *  montée sur un conteneur DÉTACHÉ y est invisible, alors qu'elle reste inscrite au planificateur
 *  react-dom du worker (`isolate:false`) et se réveille — abonnement au store remis à plat en
 *  `beforeEach`, minuteur, promesse — pendant un fichier SUIVANT, qui lève alors « Should not
 *  already be working » sous son propre `act()` (#1724). */
const racinesRendues = new Map<RacineReact, string>();
let racinesInstrumentees = false;
/** File d'`act()` de react : `actQueue` reste non nulle tant qu'un `act()`
 *  n'a pas rendu la main — un `act()` asynchrone jamais attendu la laisse ouverte. */
let fileAct: { actQueue: unknown } | null = null;
/** File déjà DITE : une file ouverte reste ouverte aux tests suivants, elle ne se redit pas. */
let fileActSignalee: unknown = null;

/** Vrai tant que la file d'`act()` de react n'est pas rendue — le lecteur que les bancs mesurent. */
export function fileActOuverte(): boolean {
  return fileAct !== null && fileAct.actQueue !== null;
}

/**
 * Pose le compte des racines sur le PROTOTYPE des racines react-dom : `createRoot` rend toujours une
 * instance de ce prototype, donc TOUT montage du worker y passe, quel que soit le fichier et sans
 * qu'il ait rien à déclarer. La racine-sonde qui sert à atteindre le prototype n'est jamais RENDUE :
 * elle n'entre pas au registre. Chargement paresseux : la partition `node` n'évalue pas react-dom.
 *
 * Angles morts DITS :
 * - `hydrateRoot` rend une instance d'un AUTRE prototype (`ReactDOMHydrationRoot`), non couverte —
 *   aucun appel dans `src/` à ce jour ; un premier usage se couvre ICI, pas au site.
 * - une racine rendue au corps du MODULE d'un fichier de test, ou dans un `beforeAll`, l'est avant
 *   le premier teardown : sur le PREMIER fichier du worker elle précède la pose du filet et n'est pas
 *   comptée, ailleurs elle est effacée par le vidage du registre au teardown suivant — ce verdict-là
 *   dépend de l'ordre des fichiers, un montage de test appartient à un `it`.
 */
export async function instrumenterRacines(): Promise<void> {
  if (racinesInstrumentees || typeof document === 'undefined') return;
  racinesInstrumentees = true;
  const [{ createRoot }, react] = await Promise.all([import('react-dom/client'), import('react')]);
  const internes = (react as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: { actQueue: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  if (!internes || !Object.prototype.hasOwnProperty.call(internes, 'actQueue')) {
    throw new Error(
      `Barrière des act() : file d'act introuvable dans react ${(react as { version?: string }).version ?? '(version inconnue)'}`
      + ' — champ actQueue absent.',
    );
  }
  fileAct = internes;
  const proto = Object.getPrototypeOf(
    createRoot(document.createElement('div')) as unknown as RacineReact,
  ) as RacineReact;
  const rendre = proto.render;
  const demonter = proto.unmount;
  proto.render = function (this: RacineReact, children: unknown) {
    racinesRendues.set(this, cleFichierTest(expect.getState().testPath));
    return rendre.call(this, children);
  };
  proto.unmount = function (this: RacineReact) {
    racinesRendues.delete(this);
    return demonter.call(this);
  };
}

/** Fichiers dont une racine est RENDUE et non démontée à cet instant, dans l'ordre de montage. */
export function fichiersDesRacinesRendues(): string[] {
  return [...racinesRendues.values()];
}

/** Verdict de la barrière des racines : message d'échec nommant le fichier qui a RENDU la racine
 *  restée montée, ou `null` s'il n'y a rien à dire. */
export function messageRacineMontee(fichiers: readonly string[]): string | null {
  if (!fichiers.length) return null;
  return (
    `Racine(s) react-dom laissée(s) MONTÉE(S), rendue(s) par : ${[...new Set(fichiers)].join(' ')}\n`
    + `Sous test.isolate:false, react-dom est partagé par tout le worker : une racine encore montée se met à jour `
    + `hors act() pendant les fichiers SUIVANTS, qui lèvent « Should not already be working » (#1724) ou rendent le vide (#1619).\n`
    + `Démonter ce que le test rend (act(() => root.unmount()) en afterEach) — un conteneur détaché de document.body ne dispense pas du démontage.`
  );
}

/** Verdict de la barrière des `act()` : message d'échec nommant le fichier où la file OUVERTE est
 *  constatée, ou `null` s'il n'y a rien à dire.
 *  Portée MESURÉE : ce volet ne sait nommer que le fichier COURANT — l'objet de module `react` est un
 *  espace de noms ESM que vitest rend non redéfinissable (« Cannot redefine property: act »), donc
 *  aucune enveloppe ne peut retenir qui a OUVERT la file. La file ouverte le restant aux tests
 *  suivants, elle se dit UNE fois (identité de `fileAct.actQueue` mémorisée) : le premier accusé est le
 *  plus proche de l'ouvreur, jamais toute la file d'attente derrière lui. */
export function messageActEnVol(fichier: string, enVol: boolean): string | null {
  if (!enVol) return null;
  return (
    `act() encore EN VOL à la fin d'un test de ${fichier} (file d'act de react non rendue).\n`
    + `Un act() asynchrone s'attend (await act(async () => …)) : sans quoi son travail s'écoule pendant le test SUIVANT, `
    + `hors de son act() à lui (#1724).`
  );
}

/** Verdict de la garde de partage (§5) : les chemins de l'état vers une donnée, ou `null`. */
export function messagePartage(partages: readonly string[]): string | null {
  if (!partages.length) return null;
  return (
    `État mutable laissé PARTAGÉ avec une donnée par ce test (#2097), ${partages.length} chemin(s) :\n`
    + `${partages.slice(0, 12).join('\n')}\n`
    + `Copier à la COUTURE qui a stocké la donnée. Un test qui bâtit son état hors des coutures du jeu passe `
    + `par leur porte (\`spawnEnemy\`…).`
  );
}

// Compte des racines react-dom (cf. `instrumenterRacines`) : posé au premier test qui dispose d'un
// DOM, une seule fois par worker. Hook à part, et ENREGISTRÉ EN PREMIER (les hooks jouent dans leur
// ordre d'enregistrement) : le filet est en place avant le moindre montage, et la remise à plat des
// singletons ci-dessous reste synchrone.
beforeEach(async () => {
  await instrumenterRacines();
});

beforeEach(() => {
  useGame.setState(JSON.parse(PRISTINE_STATE) as Partial<GameState>);
  loadRuleOverrides({});
  // PRÉFÉRENCE « Dés fixés » (`engine/fixedDie`) : singleton de module, donc PARTAGÉ entre fichiers de
  // test sous `isolate:false` — un fichier qui l'allume sans le rendre contamine les suivants (une
  // fenêtre de pose de dé s'y ouvre, l'attaque suspend, les Blessures n'arrivent jamais). Remis à zéro
  // au même titre que le registre des règles optionnelles : l'ordre d'exécution ne décide de rien.
  resetDesFixes();
  // RNG DE COMBAT (`state/battleRng`) : singleton de module lui aussi, SEMÉ par tout fichier qui appelle
  // `seedBattleRng`/`store.seedRng`. Sans remise à zéro, un fichier qui a semé une graine fixe lègue au
  // suivant un flux à position ARBITRAIRE : les tests qui ne sèment pas (et lisent un dé « au hasard »)
  // deviennent dépendants de l'ordre des fichiers du worker — flake d'ordonnancement, comme les timers
  // (#405) et « Dés fixés » ci-dessus.
  // GRAINE FIXE (#1788) : un harnais à l'horloge rend TOUS les tests à la fois irreproductibles — un
  // rouge ne se rejoue pas, et un vert ne prouve que le tirage du jour. Un test qui dépend de la
  // graine le dit en la posant lui-même (patron `state/dual-wield.test.ts:32`) ; les autres n'ont
  // besoin que d'un point de départ IDENTIQUE d'un test à l'autre, et c'est ce que cette ligne pose.
  seedBattleRng(1);
  resetOwnTestFailedGuard(); // drapeau de re-entrance onOwnTestFailed (auto-reset par try/finally ; filet doctrinal)
  // VERDICT « pas de contexte volumique » (`gameIso/stage/webglSupport`) : singleton de module, et
  // LATCHÉ par construction (le jeu ne revient jamais d'un contexte refusé). jsdom n'a aucun contexte
  // WebGL : tout montage d'écran de monde SANS renderer de banc le pose — les fichiers suivants du
  // worker monteraient alors le message d'erreur au lieu du monde (`isolate:false`).
  reinitWebglRefusé();
  // PILE DES COUCHES DISMISSIBLES + PORTE clavier d'Échap (`ui/useDismissLayer`) : singletons de module
  // eux aussi, et le congédiement va à la couche du DESSUS — une couche laissée par un fichier voisin prend l'appui
  // à la place de la surface que le banc mesure (portée et mesure : §1 de l'en-tête). Sans DOM la remise
  // à plat ne touche que la pile : aucun écouteur n'est branché sur un environnement `node`.
  resetDismissLayers();
  cascadeSnapshot = { ...cascadeAppliers };
});

afterEach(() => {
  // LECTURE des fuites de racines et de la file d'`act()`, EN TÊTE et INCONDITIONNELLE : le registre
  // est vidé ici même, avant toute barrière qui puisse `throw`. Une inscription qui survivrait à un
  // teardown interrompu se dirait au test SUIVANT, d'un autre fichier s'il n'en reste pas ici : le
  // fautif est alors innocenté et sa victime accusée — l'inverse de ce que cette barrière promet.
  const racinesFuites = fichiersDesRacinesRendues();
  racinesRendues.clear();
  const fileOuverte = fileAct !== null && fileAct.actQueue !== null;
  const fileNeuve = fileOuverte && fileAct!.actQueue !== fileActSignalee;
  if (fileOuverte) fileActSignalee = fileAct!.actQueue;
  // PARTAGE (#2097) : lu AVANT le vidage du registre des scènes, qui en est une source.
  const partages = partagesDeLEtat(useGame.getState(), scenesDuRegistre());
  // REGISTRE DES SCÈNES (`state/store`) : vidé APRÈS CHAQUE test —
  // aucune scène enregistrée par un test (`registerScene`/`loadProject`) ne traverse vers un autre
  // fichier du worker (`isolate:false`). Portée exacte : en-tête §1 + `state/scene-registry-isolation.test.ts`.
  resetSceneRegistry();
  for (const k of Object.keys(cascadeAppliers)) if (!(k in cascadeSnapshot)) delete cascadeAppliers[k];
  Object.assign(cascadeAppliers, cascadeSnapshot);
  vi.useRealTimers();
  clearTrackedTimers();
  // Barrières §1 (art), §3 (nœuds), §4 (racines, act) et §5 (partage) en trois temps — cf. fin de l'en-tête.
  // Observées au hook le plus EXTERNE, donc APRÈS les `afterEach` du fichier (démontage, `cleanup()`).
  // 1. LIRE toutes les fuites de CE test.
  const fichier = cleFichierTest(expect.getState().testPath);
  const residusBody = typeof document !== 'undefined' ? residusDom(document.body) : [];
  const residusHead = typeof document !== 'undefined' ? residusDom(document.head) : [];
  const derivesArt = deriveArtRig();
  // 2. REMETTRE l'état partagé à vierge : aucun résidu ne survit à son verdict.
  remettreArtRig(derivesArt.keys());
  if (typeof document !== 'undefined') {
    document.body.replaceChildren();
    document.head.replaceChildren();
  }
  // 3. JUGER : un seul `throw`, chaque fuite dite UNE fois chez le fichier qui l'a laissée.
  const verdicts = [
    messageResiduDom(fichier, 'document.body', residusBody),
    messageResiduDom(fichier, 'document.head', residusHead),
    messageRacineMontee(racinesFuites),
    messageActEnVol(fichier, fileNeuve),
    messageDeriveArt(fichier, [...derivesArt.values()]),
    messagePartage(partages),
  ].filter((m): m is string => m !== null);
  if (verdicts.length) throw new Error(verdicts.join('\n'));
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { stripLiterals } from './cascade-step-difficulty-guard.test';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * CLIQUET — une étape de cascade qui LANCE dit son ENJEU (#1117, arbitrage user : « Louvoyage… ça
 * se mange ? » / « Faudrait globaliser ça, histoire qu'on sache pourquoi on fait un jet »). Une étape
 * qui LANCE doit ÉNONCER ce qu'elle met en jeu (`CascadeStep.stake`, référence de donnée résolue par
 * `resolveStake`) : sans lui, la modale demande un jet sans dire pourquoi.
 *
 * Le discriminant est la FORME, pas un drapeau : `stepInteraction` (`state/cascade.ts`) rend `'jet'
 * dès que `step.target != null` — `interactive` ne gouverne QUE les rangées d'une étape à
 * participants (`stepReady`, cas `batch`). Une étape mono est donc rendue et lancée par le joueur
 * qu'elle porte ou non `interactive: true`, et `result: null` y est facultatif : ces deux champs
 * n'ont jamais mesuré ce que le cliquet vise.
 *
 * Même parseur que `cascade-step-difficulty-guard` (commentaires et contenus de chaînes/gabarits
 * neutralisés avant le parcours d'accolades) — un invariant par fichier. Baseline NOMINATIVE et
 * DÉCROISSANTE : un site doté ABAISSE sa ligne.
 */

/** COUVERTURE des quatre scans : `src/state` (les flux) ET `src/scenes` (les Flows AUTHORÉS des
 *  documents de scène — ils décrivent des jets pour de vrai, et un `testFlow` y est aussi muet
 *  qu'ailleurs). Un détecteur ne mesure que sa couverture : elle est NOMMÉE ici, la clé de baseline
 *  porte le dossier (`state/…`, `scenes/…`). */
const SRC = join(process.cwd(), 'src');
const SCAN_ROOTS = [join(SRC, 'state'), join(SRC, 'scenes')];

/** Corpus RÉEL d'un jeu de racines : marche, lecture et mémoïsation par clé dans
 *  `scripts/guards/lib/sourceCorpus.mjs` — PARESSEUX, payé au 1ᵉʳ `it` qui le demande, jamais à la
 *  collecte des tests. Le PÉRIMÈTRE reste ici : `.ts` seuls (aucun `.tsx` sous `state/`+`scenes/`),
 *  hors tests. */
function corpus(roots: string[]): { file: string; src: string }[] {
  return readCorpus(roots, { exts: ['.ts'] }).map(({ abs, text }) => ({ file: abs, src: text }));
}

/** Tous les fichiers scannés, tous dossiers de couverture confondus. */
const scanned = () => corpus(SCAN_ROOTS);
/** Clé de baseline d'un fichier scanné : chemin RELATIF à `src/` (`state/combatFlow.ts`). */
const keyOf = (f: string) => f.slice(SRC.length + 1).split(sep).join('/');

/** `stripLiterals` mémoïsé par CONTENU — jamais par chemin : une fixture ne peut pas usurper le
 *  résultat d'un fichier réel. Les quatre scans lisent le même corpus, la neutralisation est une. */
const _strip = new Map<string, string>();
function strip(src: string): string {
  let v = _strip.get(src);
  if (v === undefined) { v = stripLiterals(src); _strip.set(src, v); }
  return v;
}

/** Le DÉLIMITEUR de propriété (`{` ou `,`) est REGARDÉ par un lookbehind de largeur FIXE, ses blancs
 *  sont CAPTURÉS. Un délimiteur consommé se retirerait du texte offert au site SUIVANT : le `{` pris
 *  comme première lettre d'une valeur (`target: {`) rendrait la propriété imbriquée invisible (morsure
 *  plus bas). Coût des trois motifs sur le corpus (243 fichiers, 4,3 Mo, mesuré le 2026-08-23) :
 *  34 ms en largeur FIXE contre 66 ms en largeur VARIABLE (`(?<=[{,]\s*)`), à MATCHS IDENTIQUES
 *  (482 / 6 / 148 sites). L'index du site est celui du nom de propriété : `m.index` décalé des blancs
 *  capturés. */
const siteDe = (m: RegExpMatchArray): number => m.index! + (m[1]?.length ?? 0);

/** Les trois motifs de PROPRIÉTÉ des scans, et l'énumération de leurs sites (index du nom de
 *  propriété dans `s`). Nommés pour être MORDUS directement : c'est ici que se joue le repérage. */
export const RX_TARGET = /(?<=[{,])(\s*)target\s*(?::\s*[^\s,}]|[,}])|\.\.\.rollStep\(/g;
export const RX_SIDE = /(?<=[{,])(\s*)side\s*:\s*[^\s,}]/g;
export const RX_LITERAL = /(?<=[{,])(\s*)(?:skill|characteristic)\s*:\s*[^\s,}]/g;
export const sitesDe = (s: string, rx: RegExp): number[] => [...s.matchAll(rx)].map(siteDe);

/** L'accolade en `start` OUVRE-t-elle un littéral ? Celle d'un corps de fonction, d'une interface ou
 *  d'un bloc est précédée d'autre chose que `ouvreurs` ou `return`. Lecture à REBOURS depuis `start`,
 *  en O(blancs) : la question ne porte que sur le dernier caractère non blanc. La même décision prise
 *  sur `s.slice(0, start)` copie le préfixe ENTIER du fichier à CHAQUE site — le fichier passe alors
 *  de 1,0 s à 11,1 s, soit 91 % de son coût (mesuré le 2026-08-23, les deux formes vertes). */
function ouvreUnLitteral(s: string, start: number, ouvreurs: string): boolean {
  let k = start - 1;
  while (k >= 0 && /\s/.test(s[k])) k--;
  if (k < 0) return false;
  if (ouvreurs.includes(s[k])) return true;
  if (k < 5 || s.slice(k - 5, k + 1) !== 'return') return false;
  return k === 5 || !/[A-Za-z0-9_]/.test(s[k - 6]);
}

/** La propriété `name` est-elle posée au PREMIER niveau du littéral `lit` ? (Un `kind` enfoui dans un
 *  sous-objet — `outcome: { kind }` d'un Test étendu — ne fait pas de son porteur une étape.) */
function hasTopLevelKey(lit: string, name: string): boolean {
  let depth = 0;
  for (const m of lit.matchAll(new RegExp(`[{}]|(?<=[{,]\\s*)${name}\\s*[:,}]`, 'g'))) {
    if (m[0] === '{') depth++;
    else if (m[0] === '}') depth--;
    else if (depth === 1) return true;
  }
  return false;
}

/** Étapes qui LANCENT (cible posée), sans `stake` — renvoie leurs numéros de ligne (1-based). */
export function stepsWithoutStake(src: string): number[] {
  const s = strip(src);
  // Le scan lit des DÉCLARATIONS : un enjeu se pose au montage (`monoStep({ …, stake })`), jamais
  // après coup — aucun site de `src/state`/`src/scenes` n'affecte `stake` sur une étape construite
  // (mesuré : 0 occurrence de `.stake =`). La pose différée n'est donc pas un angle mort du scan.
  const lines: number[] = [];
  const seen = new Set<number>();
  // Les formes qui LANCENT, telles que `stepInteraction` les reconnaît (`state/cascade.ts`) :
  //  - `'jet'`   = une CIBLE en position de PROPRIÉTÉ (`target: <expr>` ou le raccourci `target,`) ;
  //    une valeur de chaîne est blanchie par `stripLiterals` → `target: 'party'` (cible d'un EFFET)
  //    ne matche pas ;
  //  - `...rollStep({…})` = la MÊME cible, posée par le MONTEUR CANONIQUE (#1153) : depuis que les
  //    flux DÉCLARENT leur ligne au lieu de la calculer, la cible n'est plus un littéral de l'étape.
  //    Sans cette forme, le cliquet devient AVEUGLE sur tout site migré (couverture, pas exemption) ;
  // HORS SCAN, parce que le TYPE tient déjà l'invariant (un scan qui double le compilateur n'ajoute
  // que du bruit et une baseline à entretenir) :
  //  - la DÉCLARATION d'un mint MONO (`actor:` + `kind`) : `MonoSpec.stake` est REQUIS
  //    (`rollSeam.ts`) — une étape mono qui ne parle pas de son enjeu ne compile pas, et une valeur
  //    muette est refusée bruyamment par `monoStep` (`refusePorte`). Sonde TUEUSE :
  //    `built-brand-lint.test.ts` (« l'ENJEU des étapes MONO »), sur un programme TypeScript réel ;
  //  - le TIRAGE SUR TABLEAU (`table:`) : DEUX fabriques seulement produisent une étape à table qui
  //    LANCE (marque `BuiltCascadeStep`, lint de forge mesuré par `built-brand-lint`) —
  //    `tableStep`/`tableStepDone`, dont `TableSpec.stake` est REQUIS (`rollSeam.ts`). La 3ᵉ fabrique
  //    exemptée du lint, `revealToStep`, n'en produit aucune : son `opts.table` est une déclaration
  //    RÉSOLUE au type (`CascadeTableDone`, `revealStep.ts`), mesuré par `reveal.test.ts`
  //    (« `revealToStep` ne produit jamais un tirage À FAIRE »).
  for (const m of s.matchAll(RX_TARGET)) {
    const i = siteDe(m);
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start < 0 || seen.has(start)) continue;
    seen.add(start);
    if (!ouvreUnLitteral(s, start, '([,=?')) continue;
    depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = s.slice(start, end);
    if (!hasTopLevelKey(lit, 'kind')) continue; // CONTRIBUTEUR batch (aucun kind) / pending d'un autre flux

    if (!/\b(actorId|actor|worldOwner|rollLabel)\s*[:,}]/.test(lit)) continue; // aucun lanceur nommé : pas une étape
    // `stake:`, raccourci `stake,` — et `{ …, stake }` en dernière propriété (le littéral est tranché
    // AVANT son accolade fermante : la fin de chaîne y tient lieu de délimiteur).
    if (/\bstake\s*(?:[,:]|$)/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/**
 * Jets DÉCRITS au seam (`RollRequest`, `state/rollSeam.ts`) sans enjeu — l'AUTRE forme qui lance :
 * `openRoll` construit l'étape à partir d'elle, donc un `RollRequest` muet produit une étape muette
 * que le scan d'étapes ci-dessus ne peut pas voir (le littéral d'étape est DANS le seam, générique).
 *
 * ANCRE (#1479) : le CÔTÉ (`side`), seul champ que toute `RollRequest` porte depuis la mort du champ
 * `klass` — sur lequel ce scan s'ancrait. Un détecteur ancré sur un champ supprimé ne mesure PLUS
 * RIEN et rend une baseline vide par FAIL-OPEN ; la paire (`side` + `actionLabel`) est ce qui
 * distingue une requête de jet de tout autre littéral.
 *
 * CONTRAT (#1117 vague 3, « `RollRequest.stake` devient-il REQUIS ? ») : le champ reste optionnel au
 * TYPE tant que la baseline ci-dessous est peuplée, et s'y ferme le jour où elle atteint 0. La garde
 * rend le critère mesurable : tout site soldé s'y retire, tout site neuf muet ROUGIT.
 */
export function rollRequestsWithoutStake(src: string): number[] {
  const s = strip(src);
  const lines: number[] = [];
  const seen = new Set<number>();
  for (const m of s.matchAll(RX_SIDE)) {
    const i = siteDe(m);
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start < 0 || seen.has(start)) continue;
    seen.add(start);
    if (!ouvreUnLitteral(s, start, '([,=?')) continue;
    depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = s.slice(start, end);
    if (!hasTopLevelKey(lit, 'actionLabel')) continue; // pas une `RollRequest` (un `side` d'autre chose)
    if (/\bstake\s*(?:[,:]|$)/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/** Baseline NOMINATIVE des `RollRequest` muettes — même contrat que celle des étapes.
 *  RE-MESURÉE le 2026-08-24 (#1479, ancre `side`) : les TROIS entrées de `seaVoyageFlow.ts` ont
 *  disparu — c'étaient des SONDES DE SURFACE (`RollRequest` de convenance passées à `resolveSurface`
 *  pour router des étapes DÉJÀ mintées), et la surface se dérive désormais des PORTEURS des étapes
 *  elles-mêmes. `seaActivities.ts` a suivi le même chemin : sa semaine est POUSSÉE à `openSequence`
 *  d'un bloc, sans sonde ni tri au call-site. */
const BASELINE_REQ: Record<string, number> = {
  // La PORTE elle-même : la `RollRequest` GÉNÉRIQUE d'`openPartyTest`, dont le `stake` est TRANSMIS
  // en RACCOURCI (`{ stake }`, forme que le scan ne lit pas comme une déclaration d'enjeu).
  'state/rollSeam.ts': 1,
};

/**
 * TROISIÈME forme qui lance : un `FlowTest` passé à `testFlow(…)` et joué par `runCombatFlow` —
 * `resolveFlowTest` en fait une étape via `simpleTriggeredTestStep`, DANS le seam. Le littéral
 * d'étape est donc générique : les deux scans ci-dessus ne peuvent pas le voir muet (trou trouvé en
 * recette L2 sur l'Approche menaçante, `combatFlow.approachFearTrigger`). Un détecteur ne mesure que
 * sa couverture : celle-ci est le 1ᵉʳ argument littéral de `testFlow(`.
 */
export function flowTestsWithoutStake(src: string): number[] {
  const s = strip(src);
  const lines: number[] = [];
  for (const m of s.matchAll(/\btestFlow\s*\(\s*\{/g)) {
    const start = s.indexOf('{', m.index!);
    let depth = 0;
    let end = -1;
    for (let j = start + 1; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = s.slice(start, end);
    if (/\bstake\s*(?:[,:]|$)/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/**
 * QUATRIÈME forme qui lance — nommée par le JUGE avant qu'une recette ne la trouve. Les trois scans
 * précédents mesurent des PORTES (le littéral d'étape, la `RollRequest` du seam, le 1ᵉʳ argument de
 * `testFlow`) ; or un jet se DÉCRIT dans un littéral, et ce littéral entre par bien d'autres portes :
 * un nœud `{ kind:'test', test:{…} }` monté à la main, un `FlowTest` passé DIRECTEMENT à
 * `openSkillTest`, un `spec` d'`openPartyTest`, un `extendedTest`, un pending de chirurgie. Toutes
 * produisent un jet, aucune n'était mesurée.
 *
 * Le discriminant est donc la FORME du DESCRIPTEUR, pas la fonction qui le reçoit : un littéral qui
 * nomme CE QU'ON TESTE (`skill` / `characteristic`) ET COMMENT (difficulté fixe, dynamique, ou
 * opposition) DÉCRIT un jet, et doit dire ce qu'il met en jeu. Cette couverture est un SUR-ENSEMBLE de
 * celle de `flowTestsWithoutStake` — c'est exactement ce que PROUVE le rejeu de l'ancien périmètre
 * ci-dessous, site par site.
 *
 * NB `noSupport`/`gate`/`menace`/`label` ne sont PAS requis : facultatifs sur un descripteur réel, les
 * exiger rétrécirait la mesure au sous-ensemble le mieux authoré — l'inverse du but.
 */
export function literalTestsWithoutStake(src: string): number[] {
  const s = strip(src);
  const lines: number[] = [];
  const seen = new Set<number>();
  for (const m of s.matchAll(RX_LITERAL)) {
    const i = siteDe(m);
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start < 0 || seen.has(start)) continue;
    seen.add(start);
    if (!ouvreUnLitteral(s, start, '([,=?:')) continue; // pas un littéral
    depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = s.slice(start, end);
    // Un `FlowTest` réel nomme SA difficulté (fixe ou dynamique) OU son OPPOSITION (un Test opposé n'a
    // pas de difficulté propre — Piège-lame, LDB 62 l.280 : sans cette branche, la mesure perdrait un
    // site que l'ancien scan voyait, cf. le rejeu ci-dessous).
    if (!hasTopLevelKey(lit, 'difficulty') && !hasTopLevelKey(lit, 'difficultyBy') && !hasTopLevelKey(lit, 'opposed')) continue;
    if (/\bstake\s*(?:[,:]|$)/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/** Baseline NOMINATIVE de la 4ᵉ forme — stock mesuré le 2026-08-06 : 19 descripteurs de jet muets
 *  sur 11 fichiers, dont 7 que les trois scans précédents ne voyaient PAS ; 12 sur 8 fichiers depuis
 *  que les producteurs de `testFlow` sont dotés ; 4 sur 3 fichiers depuis que le HORS-COMBAT est doté
 *  (Test étendu, Commandant d'équipe, Avantage par Compétence, Ragot d'auberge, marché terrestre ×2,
 *  Chirurgie/rééducation, Recherche active, port ×3) ; 3 sur 2 depuis que la Prière d'un Présage dit
 *  le sien (#1262 V2 L6b) ; VIDE depuis que les Flows AUTHORÉS de scène ont leur forme d'enjeu
 *  (#1262 V2 L6c, `AuthoredStake`) — `src/state` ET `src/scenes` sont soldés pour cette forme.
 *  SUR-ENSEMBLE de `BASELINE_FLOW` (les arguments de `testFlow` ont la même forme), donc chaque
 *  fichier y compte au moins autant. Décroissante comme les autres : un site doté ABAISSE sa ligne. */
const BASELINE_LITERAL: Record<string, number> = {};

/** Baseline NOMINATIVE des `FlowTest` muets. `src/state` est SOLDÉ (vague 5) : ses 7 producteurs de
 *  Flow, joués par `runCombatFlow` OU `runFlow`, fournissent leur `FlowTest.stake` (Escalade et Saut →
 *  la fiche Chute ; Surprise → l'État Surpris ; Vigilance → le Talent ; Focalisation interrompue et
 *  Récolte → leur fiche ; Piège-lame → l'Atout qui la porte). VIDE depuis #1262 V2 L6c : les Flows
 *  AUTHORÉS des documents de scène ont leur forme d'enjeu (`AuthoredStake` — le texte voyage avec le
 *  document, arbitrage user 2026-08-12), et c'est `validateScene` qui les tient (structurel, il voit
 *  AUSSI les Flows des projets JSON que ce scan de sources ne lit pas). Ce scan garde ce que le
 *  validateur ne voit pas : un `testFlow` de source TS hors document validé. */
const BASELINE_FLOW: Record<string, number> = {};

/**
 * Baseline NOMINATIVE (fichier → étapes qui lancent, encore sans enjeu). VIDE depuis #1262 V2 L6b :
 * les 12 sites terrestres/maritimes qui restaient muets (périls de route ×2, attelage forcé ×2,
 * Exposition d'Étape, Natation du naufrage, Embrigadement ×2, Activités en mer ×2, Prière d'un
 * Présage) sont dotés, et la nuit de repos pose son enjeu À LA DÉCLARATION.
 *
 * CE QUE CE SCAN GARDE (le type ne l'attrape pas) : les étapes montées À LA MAIN, hors mint — un
 * littéral `{ kind, actorId, target, … }` que rien n'oblige à passer par `monoStep` (`shipwreck.ts`
 * en produit un). Baseline vide = tout site NEUF, minté ou manuscrit, rougit.
 */
const BASELINE: Record<string, number> = {
  // ÉTAPES À TABLE : le TYPE les tient (#1262 V2 L6, `TableSpec.stake` requis) — plus de baseline, plus
  // de volet de scan (cf. `stepsWithoutStake`). L'enjeu posé à la construction DESCEND ensuite à la
  // ligne jouée, `stakeAtTableRow` (`state/cascade.ts`).
  // ÉTAPES MONO : le TYPE les tient aussi (#1262 V2 L6d, `MonoSpec.stake` requis) — plus de baseline,
  // plus de volet `actor:` (cf. `stepsWithoutStake`). Les deux derniers relais génériques (les
  // fabriques de `combat/triggeredTest.ts`) reçoivent l'enjeu DÉRIVÉ de l'entité porteuse quand la
  // donnée n'en déclare pas ; la complétude de cette dérivation sur les 74 `FlowTest` de
  // `src/data/*.json` est mesurée par `flowtest-derived-stake.test.ts`.
};

describe('MORSURE du repérage de site — le délimiteur se REGARDE, il ne se consomme pas', () => {
  it('deux propriétés IMBRIQUÉES de même nom rendent DEUX sites', () => {
    expect(sitesDe("{ target: { target: 'x' } }", RX_TARGET)).toHaveLength(2);
    expect(sitesDe("{ side: { side: 'x' } }", RX_SIDE)).toHaveLength(2);
    expect(sitesDe("{ skill: {skill: 'y'} }", RX_LITERAL)).toHaveLength(2);
  });
});

describe('cliquet — une étape de cascade qui LANCE dit son ENJEU (#1117)', () => {
  it('aucun site NEUF sans enjeu, et toute baseline assainie est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const { file, src } of scanned()) {
      const found = stepsWithoutStake(src);
      if (found.length) counts[keyOf(file)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['Étape de cascade qui LANCE sans enjeu — le joueur doit savoir ce que le jet met en jeu (`stake`, résolu par `resolveStake`) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  it('aucune `RollRequest` NEUVE sans enjeu, et toute baseline soldée est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const { file, src } of scanned()) {
      const found = rollRequestsWithoutStake(src);
      if (found.length) counts[keyOf(file)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE_REQ[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['Jet DÉCRIT au seam sans enjeu (`RollRequest.stake`) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE_REQ)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  it('4ᵉ FORME : aucun DESCRIPTEUR de jet littéral neuf sans enjeu, et toute baseline soldée est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const { file, src } of scanned()) {
      const found = literalTestsWithoutStake(src);
      if (found.length) counts[keyOf(file)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE_LITERAL[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['`FlowTest` monté À LA MAIN sans enjeu (hors `testFlow`) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE_LITERAL)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  /**
   * REJEU DE L'ANCIEN PÉRIMÈTRE — la 4ᵉ forme ne se croit pas sur parole : restreinte aux littéraux
   * que le scan de `testFlow(` voyait DÉJÀ, la mesure par la FORME doit rendre EXACTEMENT les mêmes
   * lignes. Un sur-ensemble qui perdrait un ancien site serait une régression déguisée en élargissement.
   *
   * Deux corpus, parce que l'arbre MAIGRIT : un CORPUS FIGÉ (les quatre formes réellement rencontrées
   * dans ce chantier, recopiées telles quelles) qui mord même le jour où tout site réel est doté, et
   * l'arbre COURANT — dont le compte reste égal à la somme de `BASELINE_FLOW`.
   */
  const CORPUS_FIGE = [
    // Test SIMPLE à difficulté fixe (Focalisation interrompue, `combatFlow`).
    `const flow = testFlow({ skill: 'calme', difficulty: 'difficile', label: 'Focalisation interrompue' }, EMPTY_FLOW, brise);`,
    // Test OPPOSÉ sans difficulté propre (Piège-lame, `combatFlow`).
    `const flow = testFlow({ characteristic: 'force', label: 'Piège-lame', opposed: { attacker: 'force', attackerLabel: 'Force', bonusSL: pbt.defSL } }, gagne, EMPTY_FLOW);`,
    // Difficulté portée par une EXPRESSION (Escalade, `climbMove`).
    `flow: testFlow({ skill: 'Escalade', difficulty: c.difficulty ?? 'intermediaire', label: 'Escalade' }, EMPTY_FLOW, chute),`,
    // Descripteur multi-lignes avec opposition (Surprise d'embuscade, `combatFlow`).
    `const flow = testFlow(\n  { skill: 'perception', difficulty: 'intermediaire', label: 'Surprise',\n    opposed: { attacker: 'agilite', attackerSkill: 'discretion' } },\n  EMPTY_FLOW,\n  onLose,\n);`,
  ];

  it('REJEU : sur l’ancien périmètre (`testFlow`), la mesure par la FORME rend les MÊMES lignes', () => {
    // (a) CORPUS FIGÉ — indépendant de l'état de l'arbre : chaque forme vue par `testFlow` l'est aussi
    // par la FORME, et l'enjeu posé les éteint toutes les deux.
    for (const [i, src] of CORPUS_FIGE.entries()) {
      expect(flowTestsWithoutStake(src), `corpus ${i} : l’ancien scan ne le voit plus`).toHaveLength(1);
      expect(literalTestsWithoutStake(src), `corpus ${i} : la FORME PERD un site que testFlow voyait`).toHaveLength(1);
      const dote = src.replace(/label: '([^']+)'/, `label: '$1', stake: combatStakeRef('k')`);
      expect(flowTestsWithoutStake(dote), `corpus ${i} : enjeu posé, encore vu muet`).toHaveLength(0);
      expect(literalTestsWithoutStake(dote), `corpus ${i} : enjeu posé, encore vu muet`).toHaveLength(0);
    }
    // (b) ARBRE COURANT — le sur-ensemble ne perd aucun site réel.
    const manquants: string[] = [];
    let ancien = 0;
    for (const { file, src } of scanned()) {
      const old = flowTestsWithoutStake(src);
      if (!old.length) continue;
      ancien += old.length;
      const neuf = new Set(literalTestsWithoutStake(src));
      const perdus = old.filter((l) => !neuf.has(l));
      if (perdus.length) manquants.push(`${keyOf(file)} : lignes ${perdus.join(', ')} vues par testFlow, PERDUES par la forme`);
    }
    expect(manquants, ['Sites de l’ancien périmètre non retrouvés :', ...manquants].join('\n')).toEqual([]);
    // Compte EXACT de l'ancien périmètre (somme de `BASELINE_FLOW`) — s'il bouge, la comparaison
    // ci-dessus porterait sur un autre stock que celui mesuré.
    expect(ancien).toBe(Object.values(BASELINE_FLOW).reduce((a, b) => a + b, 0));
  });

  it('FAIL-CLOSED (4ᵉ forme) : les DEUX formes propres sont détectées, et l’enjeu les éteint', () => {
    const noeud = `const n = { kind: 'test', test: { skill: 'escalade', difficulty: 'intermediaire' }, success: EMPTY_FLOW, fail: f };`;
    const noeudAvec = `const n = { kind: 'test', test: { skill: 'escalade', difficulty: 'intermediaire', stake: flowStakeRef('climb-roll') }, success: EMPTY_FLOW, fail: f };`;
    const direct = `openSkillTest(get, set, { characteristic: 'force-mentale', difficulty: 'difficile' }, EMPTY_FLOW, fail);`;
    const directAvec = `openSkillTest(get, set, { characteristic: 'force-mentale', difficulty: 'difficile', stake: combatStakeRef('actGate') }, EMPTY_FLOW, fail);`;
    const dynamique = `const t = { skill: 'calme', difficultyBy: [{ cond: c, difficulty: 'accessible' }] };`;
    const pasUnTest = `const a = { skill: 'artisanat', label: 'Fabriquer' };`; // aucune difficulté : pas un FlowTest
    expect(literalTestsWithoutStake(noeud)).toHaveLength(1);
    expect(literalTestsWithoutStake(noeudAvec)).toHaveLength(0);
    expect(literalTestsWithoutStake(direct)).toHaveLength(1);
    expect(literalTestsWithoutStake(directAvec)).toHaveLength(0);
    expect(literalTestsWithoutStake(dynamique), 'la difficulté DYNAMIQUE compte autant que la fixe').toHaveLength(1);
    expect(literalTestsWithoutStake(pasUnTest)).toHaveLength(0);
  });

  it('aucun `FlowTest` NEUF sans enjeu, et toute baseline soldée est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const { file, src } of scanned()) {
      const found = flowTestsWithoutStake(src);
      if (found.length) counts[keyOf(file)] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE_FLOW[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['`FlowTest` joué par le seam sans enjeu (`FlowTest.stake`) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE_FLOW)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : un `FlowTest` synthétique sans enjeu est DÉTECTÉ, avec enjeu il ne l’est pas', () => {
    const sans = `const f = testFlow({ skill: 'calme', difficulty: 'intermediaire', label: 'Approche' }, EMPTY_FLOW, brise);`;
    const avec = `const f = testFlow({ skill: 'calme', difficulty: 'intermediaire', label: 'Approche', stake: combatStakeRef('combatPsych', { entryId: 'peur' }) }, EMPTY_FLOW, brise);`;
    expect(flowTestsWithoutStake(sans)).toHaveLength(1);
    expect(flowTestsWithoutStake(avec)).toHaveLength(0);
  });

  it('FAIL-CLOSED : une `RollRequest` synthétique sans enjeu est DÉTECTÉE, avec enjeu elle ne l’est pas', () => {
    const sans = `openRoll(get, set, { side: { actorId: h.id }, actionLabel: 'Prier', test: { skill: 'priere' }, difficulty: 'intermediaire' }, K);`;
    const avec = `openRoll(get, set, { side: { actorId: h.id }, actionLabel: 'Prier', test: { skill: 'priere' }, difficulty: 'intermediaire', stake: combatStakeRef('k') }, K);`;
    // NON-RÉGRESSION SUR L'ANCRE RÉELLE (#1479) : le scan part de `side` — un littéral qui en porte un
    // SANS `actionLabel` n'est pas une `RollRequest` (c'est le côté d'autre chose) et ne doit rien
    // compter. Une fixture sans `side` ne toucherait même pas le scanner : elle ne prouverait rien.
    const sideSansActionLabel = `const cfg = { side: { actorId: h.id }, label: 'x' };`;
    expect(rollRequestsWithoutStake(sans)).toHaveLength(1);
    expect(rollRequestsWithoutStake(avec)).toHaveLength(0);
    expect(rollRequestsWithoutStake(sideSansActionLabel), 'un `side` hors RollRequest (aucun actionLabel)').toHaveLength(0);
  });

  it('FAIL-CLOSED : une étape synthétique qui LANCE sans enjeu est DÉTECTÉE, avec enjeu elle ne l’est pas', () => {
    const sans = `const s = { id: \`x-\${a}\`, kind: 'k', actorId: h.id, base: 40, target: 40, result: null };`;
    // Forme RÉELLE d'un enjeu depuis #1117 : une RÉFÉRENCE de donnée produite par la porte unique —
    // un texte au call-site ne compile plus (`stake?: StakeRef`), le scanner voit l'appel.
    const avec = `const s = { id: 'x', kind: 'k', actorId: h.id, base: 40, target: 40, stake: voyageStakeRef('k') };`;
    const raccourci = `const s = { id: 'x', kind: 'k', actorId: h.id, base: 40, target: 40, stake };`;
    const temoin = `const s = { id: 'x', kind: 'k', actorId: h.id, base: 40, target: 40, interactive: false };`;
    const sansJet = `const s = { id: 'x', kind: 'reveal', actorId: h.id, result: null };`;
    const cibleTexte = `const e = { type: 'exposureNight', kind: 'froid', count: 2, target: 'party' };`;
    const contributeur = `const p = { id: h.id, base: 40, target: 40, result: null, interactive: true };`;
    const corpsDeFonction = `function f(): boolean { const kind = 'k'; const actorId = h.id; return { target } != null; }`;
    // `kind` VIVANT (`deviation` : la fenêtre unique de la Blessure critique, #1426) — une fixture sur
    // un kind mort ne prouve rien du scan réel.
    const tableSans = `const s = { id: 'x', kind: 'deviation', actorId: t.id, table: critSeverityDecl(t, loc) };`;
    const tableAvec = `const s = { id: 'x', kind: 'deviation', actorId: t.id, table: critSeverityDecl(t, loc), stake: combatStakeRef('critSeverity') };`;
    expect(stepsWithoutStake(sans)).toHaveLength(1);
    expect(stepsWithoutStake(avec)).toHaveLength(0);
    expect(stepsWithoutStake(raccourci)).toHaveLength(0);
    expect(stepsWithoutStake(temoin), '`interactive` ne gouverne pas le rendu d’une étape mono : elle lance quand même').toHaveLength(1);
    expect(stepsWithoutStake(sansJet), 'une étape d’affichage ne met rien en jeu').toHaveLength(0);
    expect(stepsWithoutStake(cibleTexte), 'la cible d’un EFFET (`target: \'party\'`) n’est pas une cible de jet').toHaveLength(0);
    expect(stepsWithoutStake(contributeur), 'CONTRIBUTEUR d’une étape batch : l’enjeu est porté par l’ÉTAPE').toHaveLength(0);
    expect(stepsWithoutStake(corpsDeFonction), 'un corps de fonction n’est pas un littéral d’étape').toHaveLength(0);
    expect(stepsWithoutStake(tableSans), 'le TIRAGE est tenu par le TYPE (`TableSpec.stake` requis) — hors scan').toHaveLength(0);
    expect(stepsWithoutStake(tableAvec)).toHaveLength(0);
  });

  /**
   * PARTITION du volet `actor:`, RETIRÉ en #1262 V2 L6d — ce qu'il attrapait est passé au TYPE
   * (`MonoSpec.stake` requis), et ce qui reste au SCAN est nommé ici plutôt que supposé :
   *  - la DÉCLARATION d'un mint mono (avec ou sans enjeu) sort du scan : le compilateur la tient, et
   *    les deux trous connus du volet (raccourci `actor,`, `kind` apporté par SPREAD — #1271) meurent
   *    avec lui, puisque le type ne se laisse berner par aucune des deux formes ;
   *  - l'étape MANUSCRITE (hors mint) reste vue par le volet `target:` — c'est la seule chose que le
   *    type ne peut pas atteindre, et c'est ce que le scan garde.
   */
  it('PARTITION : la déclaration d’un mint mono sort du scan (le TYPE la tient), le manuscrit y reste', () => {
    const mint = `const st = monoStep({ id: 'expo-1', kind: 'stageExposure', actor: h, label: 'Exposition', difficulty: diff, ligne: { test: { skill: 'resistance' } } });`;
    const raccourci = `const st = monoStep({ id: 'x', kind: 'k', actor, label: 'L', difficulty: diff });`;
    const parSpread = `const st = monoStep({ ...commun, actor: h, ligne: { valeur: 40 } });`;
    const manuscrit = `const s = { id: 'x', kind: 'k', actorId: h.id, base: 40, target: 40, result: null };`;
    expect(stepsWithoutStake(mint), 'le mint mono est tenu par `MonoSpec.stake` (requis) — hors scan').toHaveLength(0);
    expect(stepsWithoutStake(raccourci), 'ancien trou #1271 (raccourci `actor,`) : sans objet, le type ne s’y trompe pas').toHaveLength(0);
    expect(stepsWithoutStake(parSpread), 'ancien trou #1271 (`kind` par spread) : idem').toHaveLength(0);
    expect(stepsWithoutStake(manuscrit), 'l’étape MANUSCRITE reste la part du scan').toHaveLength(1);
  });
});

/**
 * #1117 (arbitrage user, recette 4 : « Échec : vitesse ×0.8 » côté enjeu vs « vitesse −20 % » côté
 * conséquence — MÊME fait, DEUX notations). La langue du JOUEUR est celle de la Source : MSRC 7 l.17
 * dit « la vitesse … est réduite ce jour-là de 20% » et « divisée par deux ». Le FACTEUR multiplicatif
 * (×0.8, ×0.5) est la langue du MOTEUR : il ne sort jamais à l'écran.
 */
describe('« un signe, un sens » — les enjeux et leurs conséquences parlent la même langue (#1117)', () => {
  const FACTEUR = /×\s*0[.,]\d/; // ×0.8 / ×0,5 — jamais côté joueur

  it('aucun gabarit d’enjeu n’exprime une réduction en FACTEUR', () => {
    const stakes = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'voyage-stakes.json'), 'utf8')) as { kind: string; template: string }[];
    const fautifs = stakes.filter((e) => FACTEUR.test(e.template)).map((e) => `${e.kind} — ${e.template}`);
    expect(fautifs, ['Enjeu exprimé en facteur (langue du moteur) — dire le % ou la division, comme la Source :', ...fautifs].join('\n')).toEqual([]);
  });

  it('aucune ligne de conséquence des flux de voyage n’en exprime non plus', () => {
    const fautifs: string[] = [];
    for (const f of ['riverVoyageFlow.ts', 'seaVoyageFlow.ts']) {
      const src = stripLiterals(readFileSync(join(SRC, 'state', f), 'utf8'));
      // On lit le fichier ENTIER hors commentaires : une ligne de journal est du texte de gabarit.
      if (FACTEUR.test(src)) fautifs.push(f);
    }
    expect(fautifs, ['Ligne de voyage exprimée en facteur :', ...fautifs].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : le motif reconnaît bien un facteur, et laisse passer % et ÷', () => {
    expect(FACTEUR.test('vitesse ×0.8 aujourd’hui')).toBe(true);
    expect(FACTEUR.test('vitesse −20 % aujourd’hui')).toBe(false);
    expect(FACTEUR.test('vitesse ÷2 aujourd’hui')).toBe(false);
    expect(FACTEUR.test('Survitesse M+5 — 2 Dégât(s)')).toBe(false); // un multiplicateur ENTIER n'est pas visé
  });
});

/**
 * L'enjeu AUTHORÉ reste au CONTENU (#1262 V2 L6c). `AuthoredStake` (`{ authored: '…' }`) est la forme
 * ouverte aux DOCUMENTS de campagne par l'arbitrage user du 2026-08-12 — « l'enjeu d'un Flow authoré
 * s'AUTHORE DANS LA SCÈNE ». Ce n'est PAS une amnistie du texte au call-site : le MOTEUR (`src/state`,
 * `src/engine`) continue de passer par les portes fail-closed de dataset, sans quoi la zone d'enjeu
 * redeviendrait le champ libre que l'arbitrage Z5 a fermé — et une paraphrase de règle y rentrerait
 * par la fenêtre.
 *
 * COUVERTURE, nommée : les sources de `src/state` et `src/engine`, hors tests. L'ÉDITEUR
 * (`src/ui/editor`) en écrit, lui, par construction — c'est la plume de l'auteur ; les documents
 * (`src/scenes`, projets JSON) en portent.
 */
describe('l’enjeu AUTHORÉ reste au contenu — le moteur passe par les datasets (#1262 V2 L6c)', () => {
  const MOTEUR = [join(SRC, 'state'), join(SRC, 'engine')];
  // La FORME du littéral d'enjeu authoré : `{ authored: … }` — `AuthoredStake` n'a que ce champ (ses
  // deux autres sont `never`), il ouvre donc toujours son accolade. Une ANNOTATION de paramètre
  // (`captureMutation(current: Scene, authored: Scene)`) ne pose aucun enjeu et suit une virgule.
  const AUTHORED = /\{\s*authored\s*:/;

  it('aucun enjeu authoré à la main dans `src/state` / `src/engine`', () => {
    const fautifs: string[] = [];
    for (const { file, src } of corpus(MOTEUR)) {
      if (AUTHORED.test(strip(src))) fautifs.push(keyOf(file));
    }
    expect(fautifs, ['Enjeu AUTHORÉ dans le moteur — un jet du moteur nomme son dataset (`combatStakeRef`…), il n’écrit pas sa phrase :', ...fautifs].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : le motif attrape bien un enjeu authoré, et laisse passer une réf de dataset', () => {
    expect(AUTHORED.test(stripLiterals(`const s = { stake: { authored: 'ce que le jet met en jeu' } };`))).toBe(true);
    expect(AUTHORED.test(stripLiterals(`const s = { stake: combatStakeRef('climbTest') };`))).toBe(false);
    expect(AUTHORED.test(stripLiterals(`// authored: un commentaire n'est pas un site`))).toBe(false);
    expect(AUTHORED.test(stripLiterals(`export function captureMutation(current: Scene, authored: Scene) {}`)), 'une ANNOTATION de type n’est pas un enjeu posé').toBe(false);
    expect(AUTHORED.test(stripLiterals(`const s = { stake: { authored: texte } };`)), 'valeur par variable : un enjeu posé quand même').toBe(true);
  });
});

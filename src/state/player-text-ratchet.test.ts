/**
 * CINQ CLIQUETS DU MURAGE DU TEXTE JOUEUR (#1318 V8a₀, étendus en V8a₁ puis E7). Le verrou passe SEUL — la
 * marque `PlayerText` est exigée par le champ pilote (`CascadeStep.label`) ET par les 7 portes du seam
 * (`rollSeam`) — et les STOCKS que ce verrou met au jour sont GELÉS ici plutôt que migrés dans le
 * même geste : ce sont des échafaudages à lot d'extinction NOMMÉ, pas des baselines muettes.
 *
 *  1. `rawText(` — le FOSSILE est MORT (E7-FINAL) : son dernier site de production est passé au
 *     minteur du texte authoré et le module `i18n/rawText.ts` est SUPPRIMÉ. Le cliquet SURVIT au
 *     module, converti en TRIPWIRE à zéro tolérance : le gel est vide, donc toute réapparition du
 *     nom — module ressuscité, helper homonyme ailleurs — rougit nominativement.
 *  2. `as CascadeStep` — le contournement de CONTENEUR (T2) dans les fichiers de TEST. En production
 *     il n'en reste AUCUN (mesuré, et le lint l'y refuse : `built-brand-lint.test.ts`) ; les tests sont
 *     hors du sélecteur, donc c'est CE cliquet qui les tient — sans lui, « les tests sont exclus »
 *     serait un trou et non un choix.
 *  3. `dataLabel('…')` — le littéral FR passé au MINTEUR du texte authoré (V8a₁). Sans lui, `dataLabel`
 *     serait le fossile renommé. CIBLE 0 dès sa pose, donc SANS gel.
 *  4. l'IMPORT de `i18n/fixtureText` hors d'un HARNAIS (E7) — le successeur qui a repris les 138 appels
 *     de test est muré par CHEMIN D'IMPORT. CIBLE 0, SANS gel.
 *  5. `fixtureText(` hors d'un HARNAIS (E7) — la serrure 4 seule laisserait passer un ré-export ;
 *     l'appel est donc compté à part. CIBLE 0, SANS gel. Dans les tests, l'outil est LIBRE.
 *
 * Le SEUL cliquet à porter encore un gel est le 2 : ses DEUX rouges, mesurés plus bas, sont un fichier qui
 * DÉPASSE son gel et un fichier ABSENT du gel qui s'y met. Descendre SOUS son gel ne rougit pas (c'est le
 * but) — mais le gel doit être abaissé dans le même commit, ce que le volet « le gel est SERRÉ » rapporte.
 * Les cliquets SANS gel (1 depuis la mort du fossile, 3, 4, 5) n'ont qu'un rouge : toute occurrence hors de
 * son lieu licite — pour le 1, il n'en existe plus aucun.
 *
 * CE QUE CES CLIQUETS NE VOIENT PAS (dette nommée V8a₁ — ils comptent des APPELS, pas des littéraux
 * FR en général ; les deux dernières sont consignées AU SITE, pas seulement ici) :
 *  - les champs de texte encore NON marqués du seam : `RollRequest.actionLabel` (`rollSeam.ts`, 8ᵉ
 *    porte — ses littéraux sont policés par `roll-action-label-guard.test.ts`), `BandPorteur.label`,
 *    `CascadeStep.rollLabel`, `options[].detail` ;
 *  - `dataLabel(repli)` typé `string` et non `PlayerText` : un ID de dégradation doit y passer — c'est
 *    le cliquet 3 qui ferme ce trou, pas le type ;
 *  - les résolveurs de donnée encore `string` : `conditionLabel`, `damageTypeLabel`,
 *    `SPEC_SOURCES[].label` (`data/index.ts`) ;
 *  - le nom `rawText` employé pour AUTRE CHOSE qu'un minteur (`ui/compendium/relations.ts` le prend comme
 *    nom de PARAMÈTRE) : le cliquet 1 compte des APPELS `rawText(`, donc un paramètre homonyme APPELÉ y
 *    rougirait à tort — angle mort inverse, dit ici et sans site actuel ;
 *  - la météo de Scène (`Scene['weather']`) : son libellé FR vit désormais SUR LE NŒUD
 *    (`sceneWeatherSchema`, `defs-scenes/scene.ts`, #1694) et le hub de ville le LIT — la carte FR hors
 *    catalogue a disparu du call-site, le gel de locale du module de schéma reste. L'axe VOYAGE, lui,
 *    n'a AUCUNE carte : le libellé d'une météo d'Étape vit dans `weather.json` seul, servi par l'unique
 *    porte `engine/travelStages.ts::weatherCondition` (#1580) ;
 *  - le GEL DE LOCALE au chargement des cartes dérivées du catalogue — `setLocale` les laisserait en FR
 *    en silence ; consigné sur `setLocale` lui-même (`i18n/index.ts`).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * GEL VIDE — LE FOSSILE EST MORT (E7-FINAL, 2026-08-17). Le compte est 0 partout, et
 * `src/i18n/rawText.ts` n'existe plus dans l'arbre.
 *
 * Les deux stocks se sont éteints par des voies DIFFÉRENTES, et c'est ce qui rend le zéro vrai : les 138
 * appels des harnais sont passés à `i18n/fixtureText` (E7), un minteur RÉSERVÉ AUX TESTS et muré par
 * chemin d'import (cliquets T4/T5, en bas de ce fichier) ; le dernier site de PRODUCTION
 * (`noyau/combatManeuvers.ts`) est passé au minteur du texte AUTHORÉ, `dataLabel`, parce que le texte
 * qu'il portait est le `label` d'une entité de catalogue et non une phrase écrite au call-site.
 *
 * CE QUE CETTE CONSTANTE DEVIENT : un TRIPWIRE, pas un gel. Vide, elle fait rougir toute occurrence de
 * `rawText(` où qu'elle soit — le module ne peut pas ressusciter en silence, et un helper homonyme posé
 * ailleurs se signale au même titre. `compteAppels` garde donc son rôle entier : détecter la
 * RÉSURRECTION. Il ne se relève pas ; il n'a plus rien à relever.
 */
export const GEL_RAW_TEXT: Readonly<Record<string, number>> = {};

/** GEL DU 2026-08-17 (`as CascadeStep` en TEST) — 35 casts dans 15 fichiers. Zéro en production. E7 en a
 *  éteint DEUX, dans des fichiers déjà ouverts pour la migration : leur cast ne servait qu'à blanchir un
 *  `label` écrit au call-site — minté en fixture, le littéral satisfait le type et le cast tombe. */
export const GEL_AS_CASCADE_STEP: Readonly<Record<string, number>> = {
  'src/state/act-gate-possession.test.ts': 2,
  'src/state/bargain-soutien-departage.test.ts': 2,
  'src/state/cascade-bande-possession.test.ts': 1,
  'src/state/cascade-batch-socle.test.ts': 1,
  'src/state/cascade-quantite-second.test.ts': 6,
  'src/noyau/cascade.test.ts': 2,
  'src/state/combat-tables-choix-porte.test.ts': 1,
  'src/state/departage-etats-non-fondus.test.ts': 3,
  'src/state/miscast-step.test.ts': 1,
  'src/state/rest-flow.test.ts': 1,
  'src/state/zone-cross-test-gate.test.ts': 1,
  'src/ui/CascadeTableMode.test.tsx': 1,
  'src/ui/VoyageScreen.test.tsx': 1,
  'src/ui/cascade-rolled-phase.test.tsx': 1,
  'src/ui/cascade-subtitle.test.tsx': 11,
};

/** Appels du fossile dans un texte source (le module fossile le DÉFINIT, il ne l'appelle pas). */
export function compteAppels(source: string): number {
  return (source.match(/\brawText\s*\(/g) ?? []).length;
}

/** Un HARNAIS de test — le seul lieu où `fixtureText` est licite (cliquets T4/T5, en bas de fichier). */
export const estHarnais = (f: string): boolean => /\.test(-d)?\.tsx?$/.test(f);

/** Le chemin de module du minteur de fixture, EXTENSION COMPRISE : `moduleResolution: 'bundler'` accepte
 *  `'./fixtureText'` comme `'./fixtureText.js'` (et `.ts`/`.mjs`/`.cjs`/`.jsx`/`.tsx`) — exiger la quote
 *  collée au nom laissait passer la forme suffixée, qui COMPILE. */
const CHEMIN_FIXTURE = String.raw`['"][^'"]*\/fixtureText(?:\.[mc]?[jt]sx?)?['"]`;

/** Le fichier IMPORTE-t-il `i18n/fixtureText` ? (`import`/`export … from`, `import()` dynamique, `require`) */
export function importeFixtureText(source: string): boolean {
  return new RegExp(`(?:from|import|require)\\s*\\(?\\s*${CHEMIN_FIXTURE}`).test(source);
}

/**
 * NOMS SOUS LESQUELS le minteur est APPELÉ dans un fichier : le nom nu, PLUS tout BINDING LOCAL que ses
 * imports lui donnent. Sans cela, `import { fixtureText as marque }` puis `marque('…')` échappait au
 * compteur (mesuré) — la serrure d'import seule ne suffit pas non plus, car un HUB qui ré-exporte
 * déplace l'import d'un cran. Formes couvertes : nommée (avec ou sans `as`), NAMESPACE (`* as F` →
 * `F.fixtureText`), défaut, et destructuration d'un `require`/`import()` (`{ fixtureText: m }`).
 */
export function nomsAppelFixtureText(source: string): string[] {
  const noms = new Set(['fixtureText']);
  const clause = (c: string): void => {
    const ns = c.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
    if (ns) noms.add(`${ns[1]}.fixtureText`);
    const acc = c.match(/\{([^}]*)\}/);
    if (acc) {
      for (const part of acc[1].split(',')) {
        const m = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s*(?:as|:)\s*([A-Za-z_$][\w$]*))?$/);
        if (m) noms.add(m[2] ?? m[1]);
      }
    }
    const def = c.replace(/\{[^}]*\}/g, '').replace(/\*\s*as\s+[A-Za-z_$][\w$]*/g, '').match(/^\s*([A-Za-z_$][\w$]*)/);
    if (def && def[1] !== 'type') noms.add(def[1]);
  };
  const statique = new RegExp(`(?:import|export)\\s+([^;]*?)\\s*from\\s*${CHEMIN_FIXTURE}`, 'g');
  const dynamique = new RegExp(`(?:const|let|var)\\s+([^=]*?)=\\s*(?:await\\s+)?(?:import|require)\\s*\\(\\s*${CHEMIN_FIXTURE}`, 'g');
  for (const rx of [statique, dynamique]) {
    let m: RegExpExecArray | null;
    while ((m = rx.exec(source))) clause(m[1]);
  }
  return [...noms];
}

/** Appels du minteur de fixture, sous TOUS ses noms locaux (le module le DÉFINIT, il ne l'appelle pas).
 *  Le nom doit être ENTIER à gauche (`(?<![\w$.])`) : sans quoi `F.fixtureText(` d'un import NAMESPACE
 *  serait compté deux fois — une par son binding qualifié, une par le nom nu qui s'y termine. */
export function compteFixtureText(source: string): number {
  return nomsAppelFixtureText(source).reduce((n, nom) => {
    const motif = nom.replace(/[.$]/g, (c) => `\\${c}`);
    return n + (source.match(new RegExp(`(?<![\\w$.])${motif}\\s*\\(`, 'g')) ?? []).length;
  }, 0);
}

/** Casts de conteneur dans un texte source. TEXTUEL : il voit donc aussi les mentions en commentaire —
 *  d'où l'exclusion des deux fichiers qui NOMMENT le motif au lieu de l'employer (ci-dessous). */
export function compteCasts(source: string): number {
  return (source.match(/\bas\s+CascadeStep\b/g) ?? []).length;
}

/** Hors recensement du cliquet 2 (`as CascadeStep`) : ces fichiers NOMMENT ce motif (sondes de mutation,
 *  JSDoc du verrou) au lieu de l'employer — les compter ferait mentir un stock dont la cible est 0.
 *
 *  Cette liste exempte un fichier de PRODUCTION (`pendings.ts`, qui décrit le murage au JSDoc de
 *  `CascadeStepBase`). C'est précisément ce qu'aucun AUTRE cliquet ne peut se permettre : une exemption de
 *  production est un angle mort, et un angle mort ne s'hérite pas. D'où le passage EXPLICITE à `recense`
 *  pour les cinq cliquets, et la disparition du paramètre par DÉFAUT qui la propageait en silence. */
const HORS_CASCADE_STEP = new Set([
  'src/state/player-text-ratchet.test.ts',
  'src/state/built-brand-lint.test.ts',
  'src/noyau/pendings.ts',
]);

/** Hors recensement du cliquet 1 (`rawText(`) : les DEUX HARNAIS qui nomment encore le motif — celui-ci
 *  (sondes de mutation) et `built-brand-lint.test.ts` (JSDoc du verrou).
 *
 *  RIEN D'AUTRE, et surtout pas `src/noyau/pendings.ts` : ce module de PRODUCTION ne nomme plus `rawText`
 *  depuis la mort du fossile, donc l'exempter rendrait le tripwire AVEUGLE dans un fichier de production —
 *  exactement ce que la prose de tête promet de ne jamais être (« toute occurrence, où qu'elle soit »).
 *  La sonde « le tripwire VOIT un fichier de production » plus bas mesure les deux jeux sur un arbre
 *  factice : le bon rougit, l'ancien reste vert. */
const HORS_RAW_TEXT = new Set([
  'src/state/player-text-ratchet.test.ts',
  'src/state/built-brand-lint.test.ts',
]);

/** Hors recensement du cliquet 3 (`dataLabel('…')`) : CE fichier seul, dont les sondes écrivent la prose
 *  qu'il refuse. Aucun fichier de production — le cliquet 3 est à cible 0 SANS gel, il n'a pas de stock à
 *  couvrir. */
const HORS_DATA_LABEL_SONDES = new Set(['src/state/player-text-ratchet.test.ts']);

/** Hors recensement des cliquets 4 et 5 : CE fichier seul, qui nomme le motif en sondes. Rien d'autre —
 *  surtout pas un fichier de production. */
const HORS_FIXTURE = new Set(['src/state/player-text-ratchet.test.ts']);

/** Recensement fichier → compte sur un arbre (chemins POSIX relatifs à la racine). L'exclusion est DITE
 *  par l'appelant, et le paramètre est REQUIS : un défaut ferait hériter à un cliquet l'angle mort d'un
 *  autre — c'est comme ça que le cliquet 1 s'est retrouvé aveugle à un fichier de production. */
export function recense(
  racine: string,
  compte: (s: string) => number,
  filtre: ((f: string) => boolean) | undefined,
  hors: ReadonlySet<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const base = join(racine, 'src');
  for (const { abs, text } of readCorpus([base], { tests: true })) {
    // La clé est POSIX depuis `racine` — `racine` peut être un arbre FACTICE hors dépôt (sondes de
    // mutation), où le `rel` du corpus (relatif à la racine du DÉPÔT) ne veut rien dire.
    const child = `src/${relative(base, abs).split('\\').join('/')}`;
    if (hors.has(child)) continue;
    if (filtre && !filtre(child)) continue;
    const n = compte(text);
    if (n > 0) out[child] = n;
  }
  return out;
}

/**
 * LITTÉRAUX FR passés EN ARGUMENT DIRECT au minteur `dataLabel` (#1318 V8a₁) — la garde qui empêche
 * le fossile de renaître sous un autre nom. `dataLabel` mint le texte AUTHORÉ en donnée ; si un
 * call-site pouvait y écrire une phrase FR, il ne serait qu'un `rawText` renommé. CIBLE ZÉRO, SANS
 * GEL : ce cliquet n'a jamais eu de stock à absorber, donc il n'en accepte aucun.
 *
 * Balayage : chaque appel `dataLabel(` est lu jusqu'à SA parenthèse fermante, en suivant la
 * profondeur des `(`/`[`/`{` et en sautant le contenu des chaînes. Ne comptent que les littéraux de
 * PROFONDEUR 0 (les arguments eux-mêmes) portant AU MOINS DEUX lettres : un id passé à un appel
 * imbriqué (`dataLabel(refLabel('skills', …))`) ou une clé d'index (`CHAR_LABELS['intelligence']`)
 * n'est pas du texte joueur, et une dégradation d'UNE lettre (`'?'`, `'A'`) n'est pas de la prose.
 *
 * ANGLE MORT ASSUMÉ, et il est STRUCTUREL : ce cliquet ne voit que les littéraux écrits AU CALL-SITE. Une
 * CARTE FR en dur vivant dans `src/engine` — l'étalon de classe est `SIZE_LABEL`
 * (`engine/size.ts`, littéraux nus) — passée à `dataLabel` en repli est BLANCHIE sans un
 * mot : l'argument est une expression, pas une chaîne. C'est voulu (un repli dérivé du catalogue est
 * licite, cf. le JSDoc de `dataLabel`), mais ça veut dire qu'une telle carte reste du FR hors catalogue,
 * invisible à `setLocale`, et que seule sa relecture la tient.
 * PÉRIMÈTRE MESURÉ (2026-08-30) : `CHAR_LABELS` (`engine/types.ts:58`) et `DEFENSE_LABEL`
 * (`engine/combat.ts:494`) ne sont PAS de cette classe — ils sont bâtis entièrement sur `t('char.*')` /
 * `t('defense.*')`, donc AU catalogue. Ce qui leur reste est le GEL DE LOCALE au chargement du module,
 * consigné sur `setLocale` lui-même (dernier point de cette liste) — un défaut d'un AUTRE axe.
 */
export function litterauxDataLabel(source: string): string[] {
  const out: string[] = [];
  const rx = /\bdataLabel\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source))) {
    let i = m.index + m[0].length, prof = 0;
    while (i < source.length) {
      const c = source[i];
      if (c === '(' || c === '[' || c === '{') { prof++; i++; continue; }
      if (c === ']' || c === '}') { prof--; i++; continue; }
      if (c === ')') { if (prof === 0) break; prof--; i++; continue; }
      if (c === "'" || c === '"' || c === '`') {
        const debut = i;
        for (i++; i < source.length && source[i] !== c; i++) if (source[i] === '\\') i++;
        i++;
        const lit = source.slice(debut, i);
        if (prof === 0 && (lit.slice(1, -1).match(/\p{L}/gu) ?? []).length >= 2) out.push(lit);
        continue;
      }
      i++;
    }
  }
  return out;
}

/** Le module qui DÉFINIT `dataLabel` (et le NOMME en JSDoc) est hors du balayage : il en parle. */
const HORS_DATA_LABEL = new Set(['src/data/index.ts', 'src/data/mutations.ts']);

/** Violations d'un cliquet : dépassement d'un gel, ou fichier NEUF hors gel. Vide = vert. */
export function violations(recensement: Record<string, number>, gel: Readonly<Record<string, number>>, quoi: string): string[] {
  return Object.entries(recensement)
    .filter(([f, n]) => n > (gel[f] ?? 0))
    .map(([f, n]) => `${f} : ${n} ${quoi} pour un gel de ${gel[f] ?? 0}`);
}

/** Entrées de gel qui SURESTIMENT l'arbre : à rabaisser dans le commit qui les a fait descendre. */
function relachees(reel: Record<string, number>, gel: Readonly<Record<string, number>>): string[] {
  return Object.entries(gel)
    .filter(([f, n]) => (reel[f] ?? 0) < n)
    .map(([f, n]) => `${f} : gel ${n} > ${reel[f] ?? 0} mesuré — abaisser le gel dans CE commit`);
}

const somme = (m: Record<string, number>): number => Object.values(m).reduce((a, b) => a + b, 0);

describe('#1318 E7-FINAL — le fossile `rawText` est MORT : le cliquet devient un TRIPWIRE (zéro tolérance)', () => {
  const reel = recense(process.cwd(), compteAppels, undefined, HORS_RAW_TEXT);

  it('le MODULE n’existe plus dans l’arbre — c’est la mort, pas une extinction d’usage', () => {
    expect(existsSync(join(process.cwd(), 'src/i18n/rawText.ts')), 'le registre des fossiles promettait la suppression du module, pas seulement un compte à 0').toBe(false);
  });

  it('AUCUN fichier de l’arbre n’appelle le fossile — ni en production, ni dans un harnais', () => {
    expect(Object.keys(reel), 'les harnais sont passés à `i18n/fixtureText`, la production à `t()`/`dataLabel`').toEqual([]);
  });

  it('le TRIPWIRE est armé : le gel est VIDE, donc aucun fichier n’a de tolérance', () => {
    expect(GEL_RAW_TEXT, 'une entrée ici rouvrirait un gel là où il n’y a plus rien à geler').toEqual({});
    expect(somme(GEL_RAW_TEXT)).toBe(0);
    expect(violations(reel, GEL_RAW_TEXT, 'appel(s) de rawText')).toEqual([]);
    expect(relachees(reel, GEL_RAW_TEXT)).toEqual([]);
  });

  /**
   * LE TRIPWIRE VOIT LES FICHIERS DE PRODUCTION — la sonde qui a trouvé le défaut, promue en test.
   *
   * Le cliquet 1 partageait l'exemption du cliquet 2, qui contient `src/noyau/pendings.ts` (un module de
   * PRODUCTION, exempté là-bas parce qu'il NOMME `as CascadeStep` au JSDoc). Cette justification n'a
   * jamais valu pour `rawText` — et depuis la mort du fossile, `pendings.ts` ne nomme même plus le motif :
   * l'exemption ne couvrait plus rien qu'un ANGLE MORT, dans le seul fichier où il coûte le plus cher.
   *
   * Les deux jeux sont rejoués sur un ARBRE FACTICE, pas sur des chaînes : c'est `recense` (parcours,
   * filtre, exclusion) qui est mesuré, pas un regex isolé. La PRÉIMAGE du défaut est assertée telle
   * quelle — vert AVEUGLE avec l'ancien jeu — sans quoi le vert du bon jeu ne prouverait rien.
   */
  it('SONDE PROMUE : un `rawText(` dans un fichier de PRODUCTION exempté ailleurs est VU (l’ancien jeu était aveugle)', () => {
    const faux = mkdtempSync(join(tmpdir(), 'tripwire-rawtext-'));
    try {
      mkdirSync(join(faux, 'src/noyau'), { recursive: true });
      writeFileSync(join(faux, 'src/noyau/pendings.ts'), 'export const l = rawText("Tempête");\n', 'utf8');

      const vu = recense(faux, compteAppels, undefined, HORS_RAW_TEXT);
      expect(vu, 'le jeu propre du cliquet 1 n’exempte AUCUN fichier de production').toEqual({ 'src/noyau/pendings.ts': 1 });
      expect(violations(vu, GEL_RAW_TEXT, 'appel(s) de rawText')).toEqual(['src/noyau/pendings.ts : 1 appel(s) de rawText pour un gel de 0']);

      const aveugle = recense(faux, compteAppels, undefined, HORS_CASCADE_STEP);
      expect(aveugle, 'PRÉIMAGE DU DÉFAUT : hériter de l’exemption du cliquet 2 rendait ce rouge invisible').toEqual({});
      expect(violations(aveugle, GEL_RAW_TEXT, 'appel(s) de rawText'), 'vert AVEUGLE — un fossile ressuscité en production passait').toEqual([]);
    } finally {
      rmSync(faux, { recursive: true, force: true });
    }
  });

  it('MUTATION : un SEUL appel, dans N’IMPORTE quel fichier, rougit nominativement', () => {
    expect(violations({ 'src/noyau/combatManeuvers.ts': 1 }, GEL_RAW_TEXT, 'appel(s) de rawText')).toEqual(['src/noyau/combatManeuvers.ts : 1 appel(s) de rawText pour un gel de 0']);
    expect(violations({ 'src/state/nouveauFlux.ts': 1 }, GEL_RAW_TEXT, 'appel(s) de rawText')).toEqual(['src/state/nouveauFlux.ts : 1 appel(s) de rawText pour un gel de 0']);
  });

  it('MUTATION : un fichier qui DESCEND sous son gel ne rougit pas — la sémantique que le cliquet 2 emploie encore', () => {
    expect(violations({ 'src/state/un-harnais.test.ts': 3 }, { 'src/state/un-harnais.test.ts': 5 }, 'appel(s)')).toEqual([]);
  });

  it('le compteur voit les formes réelles d’appel, et il verrait la RÉSURRECTION du module par ses appelants', () => {
    expect(compteAppels("label: rawText('X'), autre: rawText(`${a}`)")).toBe(2);
    // La DÉFINITION seule reste invisible au compteur (elle n'appelle pas) : c'est la sonde d'existence
    // ci-dessus qui tient ce flanc, et les deux ensemble ferment la résurrection.
    expect(compteAppels('export const rawText = (s: string): PlayerText => s as PlayerText;')).toBe(0);
  });
});

describe('#1318 V8a₀ T2 — les `as CascadeStep` des TESTS sont GELÉS (la production n’en a plus)', () => {
  const reel = recense(process.cwd(), compteCasts, undefined, HORS_CASCADE_STEP);

  it('AUCUN cast de conteneur en PRODUCTION — c’est le lint qui l’y refuse, et le fait le confirme', () => {
    expect(Object.keys(reel).filter((f) => !estFichierVitest(f)), 'un `as CascadeStep` hors test rouvrirait la voie canonique').toEqual([]);
  });

  it('les fichiers de TEST ne dépassent pas leur gel', () => {
    expect(violations(reel, GEL_AS_CASCADE_STEP, 'cast(s) `as CascadeStep`')).toEqual([]);
  });

  it('le gel est SERRÉ, et son TOTAL est dit (cible 0 — V8a₁ passe ces tests par les portes)', () => {
    expect(relachees(reel, GEL_AS_CASCADE_STEP)).toEqual([]);
    expect(somme(GEL_AS_CASCADE_STEP)).toBe(35);
  });

  it('MUTATION : un cast de PLUS dans un test gelé rougit', () => {
    expect(violations({ 'src/noyau/cascade.test.ts': 3 }, GEL_AS_CASCADE_STEP, 'cast(s) `as CascadeStep`'))
      .toEqual(['src/noyau/cascade.test.ts : 3 cast(s) `as CascadeStep` pour un gel de 2']);
  });

  it('MUTATION : un test NEUF qui caste rougit', () => {
    expect(violations({ 'src/state/neuf.test.ts': 1 }, GEL_AS_CASCADE_STEP, 'cast(s) `as CascadeStep`'))
      .toEqual(['src/state/neuf.test.ts : 1 cast(s) `as CascadeStep` pour un gel de 0']);
  });
});

describe('#1318 V8a₁ T3 — le minteur `dataLabel` n’accepte AUCUN littéral FR (cible 0, sans gel)', () => {
  const reel = recense(process.cwd(), (s) => litterauxDataLabel(s).length, (f) => !HORS_DATA_LABEL.has(f), HORS_DATA_LABEL_SONDES);

  it('l’arbre RÉEL ne passe jamais de prose au minteur du texte AUTHORÉ', () => {
    expect(Object.keys(reel), '`dataLabel` mint la DONNÉE ; une phrase FR écrite au call-site va au catalogue (`t()`)').toEqual([]);
  });

  it('MUTATION : une phrase FR en argument est vue', () => {
    expect(litterauxDataLabel("label: dataLabel('Perte de sang'),")).toEqual(["'Perte de sang'"]);
  });

  it('MUTATION : une phrase FR en REPLI (2ᵉ argument) est vue aussi', () => {
    expect(litterauxDataLabel('label: dataLabel(peril.label, "Péril inconnu"),')).toEqual(['"Péril inconnu"']);
  });

  it('un appel à VARIABLES, et une dégradation à une seule lettre, restent verts', () => {
    expect(litterauxDataLabel('dataLabel(peril.label)')).toEqual([]);
    expect(litterauxDataLabel("dataLabel(src?.label, '?')")).toEqual([]);
    expect(litterauxDataLabel("dataLabel(x, 'A')")).toEqual([]);
  });

  it('le balayage s’arrête à SA parenthèse, et ne voit que les arguments DIRECTS', () => {
    // Un id de catégorie sous appel imbriqué, une clé d'index, le voisin d'à côté : rien de tout ça
    // n'est un texte joueur écrit en argument du minteur.
    expect(litterauxDataLabel("stepDetail(dataLabel(refLabel('skills', { id })), t('step.evitement'))")).toEqual([]);
    expect(litterauxDataLabel("dataLabel(CHAR_LABELS[o.char ?? 'intelligence'])")).toEqual([]);
    // …mais la prose posée EN argument reste vue, même après un argument imbriqué.
    expect(litterauxDataLabel("dataLabel(f(x), 'Péril inconnu')")).toEqual(["'Péril inconnu'"]);
  });
});

/**
 * CE QUE CES DEUX SERRURES GARDENT, ET CE QU'ELLES NE GARDENT PAS (#1318 E7) — elles tiennent la
 * FRONTIÈRE prod/test, PAS le VOLUME. Avant E7, le stock FR des harnais était borné par un gel de 138
 * qui ne pouvait que descendre ; après, il est LIBRE (`toBeGreaterThan(0)`, jamais un compte figé).
 * C'est une PERTE DE CLIQUET, assumée : c'est le prix de l'extinction du fossile — regeler le volume des
 * fixtures reviendrait à rendre `fixtureText` aussi contraint que `rawText`, donc à ne rien avoir éteint.
 * Ce qui reste mesuré, et ne se négocie pas : aucun fichier de production ne l'importe ni ne l'appelle.
 */
describe('#1318 E7 T4/T5 — le SUCCESSEUR `fixtureText` est muré aux HARNAIS (cible 0 hors test, sans gel)', () => {
  const imports = recense(process.cwd(), (s) => (importeFixtureText(s) ? 1 : 0), undefined, HORS_FIXTURE);
  const appels = recense(process.cwd(), compteFixtureText, undefined, HORS_FIXTURE);

  it('T4 : aucun fichier HORS HARNAIS n’IMPORTE le minteur de fixture', () => {
    expect(
      Object.keys(imports).filter((f) => !estHarnais(f)),
      'un import hors harnais ferait de `fixtureText` le fossile renommé : le texte va au catalogue (`t()`) ou au minteur de donnée (`dataLabel`)',
    ).toEqual([]);
  });

  it('T5 : aucun fichier HORS HARNAIS n’APPELLE le minteur de fixture', () => {
    expect(
      Object.keys(appels).filter((f) => !estHarnais(f)),
      'la serrure d’import seule laisserait passer un ré-export : l’appel est compté à part',
    ).toEqual([]);
  });

  it('les HARNAIS, eux, l’emploient — le stock repris au fossile est là, et il n’est PLUS borné (cf. JSDoc)', () => {
    expect(Object.keys(appels).every(estHarnais)).toBe(true);
    expect(somme(appels), 'les tests sont LIBRES de leur outil : ce compte est mesuré, pas figé').toBeGreaterThan(0);
  });

  it('T4/T5 n’héritent d’AUCUNE exemption d’un autre cliquet : un fichier de PROD exempté ailleurs est vu', () => {
    expect(HORS_CASCADE_STEP.has('src/noyau/pendings.ts'), 'ce fichier de production est hors du cliquet 2…').toBe(true);
    expect(HORS_FIXTURE.has('src/noyau/pendings.ts'), '…et doit rester SOUS T4/T5, sans quoi la serrure a un angle mort de production').toBe(false);
    expect(HORS_RAW_TEXT.has('src/noyau/pendings.ts'), '…et SOUS le cliquet 1, dont la prose promet « où qu’elle soit »').toBe(false);
    expect([...HORS_FIXTURE]).toEqual(['src/state/player-text-ratchet.test.ts']);
  });

  it('MUTATION : un module de PRODUCTION qui importe le minteur est vu', () => {
    expect(importeFixtureText("import { fixtureText } from '../i18n/fixtureText';")).toBe(true);
    expect(importeFixtureText("const { fixtureText } = await import('./i18n/fixtureText');")).toBe(true);
  });

  /**
   * LES TROIS FORMES QUI PASSAIENT (audit E7) — toutes COMPILENT sous `moduleResolution: 'bundler'`, donc
   * « ça ne compile pas » n'était pas une garde. Elles sont ici en sondes REJOUABLES, pas en promesse.
   */
  it('MUTATION : l’import SUFFIXÉ `.js` (que le bundler résout) est vu — extension comprise', () => {
    expect(importeFixtureText("import { fixtureText as marque } from '../i18n/fixtureText.js';")).toBe(true);
    expect(importeFixtureText("import { fixtureText } from '../i18n/fixtureText.ts';")).toBe(true);
  });

  it('MUTATION : l’appel ALIASÉ est compté sous son BINDING LOCAL, pas sous le nom nu', () => {
    const alias = "import { fixtureText as marque } from '../i18n/fixtureText.js';\nexport const l = marque('Bande');";
    expect(nomsAppelFixtureText(alias)).toContain('marque');
    expect(compteFixtureText(alias), 'sans le binding, `marque(…)` passait les DEUX serrures').toBe(1);
    const ns = "import * as F from '../i18n/fixtureText.js';\nexport const l = F.fixtureText('Bande');";
    expect(compteFixtureText(ns), 'un namespace compte UNE fois, pas deux (le nom nu s’y termine)').toBe(1);
    // Les deux formes de chargement RUNTIME sont mesurées ICI et non par mutation d'arbre : écrites dans
    // un module de production, elles cassent la COLLECTE avant d'atteindre le cliquet (mesuré) — un rouge
    // de chargement ne prouverait pas la serrure.
    const req = "const { fixtureText: m } = require('../i18n/fixtureText.js');\nexport const l = m('Bande');";
    expect(compteFixtureText(req)).toBe(1);
    expect(importeFixtureText(req), 'le `require` est un import : T4 le voit aussi').toBe(true);
    const dyn = "const { fixtureText: d } = await import('../i18n/fixtureText.js');\nexport const l = d('Bande');";
    expect(compteFixtureText(dyn)).toBe(1);
    expect(importeFixtureText(dyn)).toBe(true);
  });

  it('MUTATION : le HUB qui RÉ-EXPORTE est vu à sa racine — la chaîne casse là, pas chez son consommateur', () => {
    const hub = "export { fixtureText } from './fixtureText.js';";
    expect(importeFixtureText(hub), 'un `export … from` est un import : le hub de PROD rougit').toBe(true);
    // Le consommateur du hub, lui, n'est PAS vu (il n'importe pas le module) — limite ASSUMÉE et sans
    // effet : le hub qu'il consommerait ne peut pas exister en production, T4 l'y refuse à la source.
    expect(importeFixtureText("import { fixtureText as m } from './hub';")).toBe(false);
  });

  it('un import VOISIN, et un nom qui commence pareil, ne sont pas des faux rouges', () => {
    expect(importeFixtureText("import type { PlayerText } from './playerText';")).toBe(false);
    expect(importeFixtureText("import { x } from './fixtureTextures';")).toBe(false);
    expect(importeFixtureText("import { x } from './fixtureText.json';")).toBe(false);
  });

  it('le compteur voit les formes réelles d’appel, et pas la DÉFINITION du minteur', () => {
    expect(compteFixtureText("label: fixtureText('X'), autre: fixtureText(`${a}`)")).toBe(2);
    expect(compteFixtureText('export const fixtureText = (s: string): PlayerText => s as PlayerText;')).toBe(0);
  });
});

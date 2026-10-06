/**
 * LE VERROU DE FORGE se mesure (#1262) — la marque `BuiltCascadeStep` est REQUISE, donc le type seul
 * suffirait… si le cast n'existait pas. Le lint (murs `murs/marques` et `murs/conteneur`, `oxlint.config.mjs`) mure les
 * routes de forge ; ce test les LANCE sur la config RÉELLE (lanceur Oxlint, pas une copie de règle) et
 * exige le rouge. Sans lui, un sélecteur trop étroit laisse passer en silence : la sonde d'origine
 * (`TSAsExpression > TSTypeReference`, enfant DIRECT) rendait 0 erreur sur trois des quatre routes.
 *
 * La 4ᵉ route — annoter une valeur déjà élargie — est une LIMITE ASSUMÉE, dite au JSDoc de
 * `stepBrand.ts` : elle est ici en témoin explicite, jamais en oubli.
 */
import { describe, it, expect } from 'vitest';
import { creerBancLint, selectionnerMessages } from '../../scripts/guards/lib/lint.testkit.mjs';
import { virtualProgram, libererSessions } from '../../scripts/guards/lib/tsProgram.mjs';
import { readFileSync } from 'node:fs';

/** Fichier de test SOUS le périmètre de la règle (jamais un minteur, qui est exempté). */
const SOUS_LA_REGLE = 'src/state/__sonde-verrou-marque.ts';

const eslint = creerBancLint();

/** Les deux murs de la marque d'origine (`oxlint.config.mjs`, plugin `murs`). */
const MURS_DE_MARQUE = new Set(['murs/marques', 'murs/conteneur']);

async function messagesDeVerrou(code: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath: SOUS_LA_REGLE });
  return selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? '')).map((m) => `${m.line}:${m.column}`);
}

const ENTETE = "import type { BuiltCascadeStep } from './stepBrand';\ndeclare const o: unknown;\n";

describe('#1262 — le lint mure les ROUTES DE FORGE de la marque', () => {
  it('`x as BuiltCascadeStep` — la forme directe', async () => {
    expect(await messagesDeVerrou(`${ENTETE}export const a = o as BuiltCascadeStep;\n`)).toHaveLength(1);
  });

  it('`<BuiltCascadeStep>x` — l’autre syntaxe de cast (nœud TSTypeAssertion, pas TSAsExpression)', async () => {
    expect(await messagesDeVerrou(`${ENTETE}export const b = <BuiltCascadeStep>o;\n`)).toHaveLength(1);
  });

  it('`x as BuiltCascadeStep[]` — un tableau s’interpose entre le cast et la référence', async () => {
    expect(await messagesDeVerrou(`${ENTETE}export const c = o as BuiltCascadeStep[];\n`)).toHaveLength(1);
  });

  it('`as unknown as readonly BuiltCascadeStep[]` — la route RÉALISTE vers `openSequence.steps`', async () => {
    expect(await messagesDeVerrou(`${ENTETE}export const d = [] as unknown as readonly BuiltCascadeStep[];\n`)).toHaveLength(1);
  });

  it('la marque JUMELLE (`BuiltRollRow`, monteur de rangée) est murée par la même règle', async () => {
    const code = "import type { BuiltRollRow } from '../ui/rollRowBuild';\ndeclare const o: unknown;\nexport const e = o as BuiltRollRow;\n";
    expect(await messagesDeVerrou(code)).toHaveLength(1);
  });

  it('LIMITE ASSUMÉE : annoter une valeur déjà élargie passe — aucun nœud de cast à interdire', async () => {
    const code = "import type { BuiltCascadeStep } from './stepBrand';\ndeclare const brut: any;\nexport const f: BuiltCascadeStep = brut;\n";
    expect(await messagesDeVerrou(code), 'documentée au JSDoc de `stepBrand.ts` — jamais un oubli').toHaveLength(0);
  });

  /**
   * LA ROUTE DE L'ALIAS (#1262 V3 Lf) — les sélecteurs de cast filtrent par NOM d'identifiant : une
   * seule ligne (`type A = BuiltRollRow`) suffisait à sortir du radar, et le cast passait alors tsc ET
   * eslint (mesuré EXIT 0 avant fermeture). L'alias est donc refusé À SA DÉCLARATION — mais seulement
   * quand le type ALIASÉ EST la marque : « aucun alias légitime n'existe » est FAUX, mesuré (4 sites,
   * `nightBands.ts` l.104/115/116 + `cascade.ts` l.57, types de CALLBACK qui exigent des étapes
   * mintées). Employer la marque dans une signature n'est pas la déguiser — les deux cas sont ici.
   */
  it('`type A = BuiltRollRow` — l’ALIAS est refusé à sa DÉCLARATION (sinon le cast repasse par un autre nom)', async () => {
    const code = [
      "import type { BuiltRollRow } from '../ui/rollRowBuild';",
      'declare const o: unknown;',
      'type AliasSonde = BuiltRollRow;',
      'export const i = o as AliasSonde;',
    ].join('\n');
    expect(await messagesDeVerrou(code), 'la route alias doit être MURÉE, pas seulement dite').toHaveLength(1);
  });

  it('l’alias sous un TABLEAU (`type B = readonly BuiltCascadeStep[]`) est refusé aussi', async () => {
    const code = [
      "import type { BuiltCascadeStep } from './stepBrand';",
      'declare const o: unknown;',
      'type AliasTab = readonly BuiltCascadeStep[];',
      'export const j = o as AliasTab;',
    ].join('\n');
    expect(await messagesDeVerrou(code)).toHaveLength(1);
  });

  it('un cast SANS rapport avec le murage n’est pas touché (ni marque, ni CONTENEUR d’étape)', async () => {
    const code = "import type { Combatant } from '../engine/types';\ndeclare const o: unknown;\nexport const g = o as Combatant;\n";
    expect(await messagesDeVerrou(code), '`CascadeStep` n’est plus un cas neutre : il est muré depuis #1318 T2 (cf. le volet CONTENEURS)').toHaveLength(0);
  });

  it('un type de CALLBACK qui EXIGE des étapes mintées passe : employer la marque n’est pas la déguiser', async () => {
    const code = [
      "import type { BuiltCascadeStep } from './stepBrand';",
      'type Applier = (rowInserts: readonly BuiltCascadeStep[]) => BuiltCascadeStep[];',
      'export const l: Applier = (r) => [...r];',
    ].join('\n');
    expect(await messagesDeVerrou(code), 'forme RÉELLE de `nightBands.ts`/`cascade.ts` — la fauche serait le murage lui-même').toHaveLength(0);
  });

  it('LIMITE ASSUMÉE : le RENOMMAGE À L’IMPORT échappe encore — dit au JSDoc de `stepBrand.ts`, jamais un oubli', async () => {
    const code = [
      "import type { BuiltRollRow as S } from '../ui/rollRowBuild';",
      'declare const o: unknown;',
      'export const k = o as S;',
    ].join('\n');
    expect(await messagesDeVerrou(code), 'résidu MESURÉ (le sélecteur filtre par nom) : il est dit, pas couvert').toHaveLength(0);
  });

  /** Les MINTEURS sont SOUS la règle : chaque cast légitime porte son exemption AU SITE, aucune au fichier. */
  it.each([
    ['src/state/rollSeam.ts', 'declare const sonde: unknown;\nexport const forge = sonde as BuiltCascadeStep;'],
    ['src/state/revealStep.ts', 'declare const sonde: unknown;\nexport const forge = sonde as BuiltCascadeStep;'],
    ['src/ui/rollRowBuild.ts', 'declare const sonde: unknown;\nexport const forge = sonde as BuiltRollRow;'],
    ['src/i18n/index.ts', "export const forge = 'sonde' as PlayerText;"],
  ])('le minteur `%s` lint propre, et un SECOND cast y rougit', async (fichier, second) => {
    const [res] = await eslint.lintFiles([fichier]);
    expect(selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? ''))).toHaveLength(0);
    const reel = readFileSync(fichier, 'utf8');
    const [cast] = await eslint.lintText(`${reel}\n${second}\n`, { filePath: fichier });
    expect(selectionnerMessages(cast, (m) => m.ruleId === 'murs/marques'), 'un cast non justifié doit rougir').toHaveLength(1);
  });

  it('`saves.ts` ne contient aucun cast de marque ni directive d’exemption, et ne rend aucune erreur de lint', async () => {
    const reel = readFileSync('src/state/saves.ts', 'utf8');
    expect(reel, 'aucun cast de marque dans ce fichier').not.toMatch(/as\s+Built(CascadeStep|RollRow)/);
    expect(reel, 'aucune directive qui l’exempte').not.toMatch(/murs\/(marques|conteneur)/);
    const [res] = await eslint.lintFiles(['src/state/saves.ts']);
    expect(selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? ''))).toHaveLength(0);
    expect(res.errorCount, 'aucune autre erreur de lint sur le fichier').toBe(0);
  });

  it('cas planté : un cast ajouté dans `saves.ts` est REFUSÉ — la règle y mord, sans exemption au fichier', async () => {
    const reel = readFileSync('src/state/saves.ts', 'utf8');
    const augmente = `${reel}\ndeclare const sonde: unknown;\nexport const forge = sonde as BuiltCascadeStep;\n`;
    const [res] = await eslint.lintText(augmente, { filePath: 'src/state/saves.ts' });
    expect(selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? '')), 'un cast non justifié doit rougir').toHaveLength(1);
  });

  it('la marque d’ADRESSE (`AdresseDeCreation`, #1988) : un cast hors de sa fabrique est refusé', async () => {
    const code = "import type { AdresseDeCreation } from '../engine/adresseDeCreation';\ndeclare const o: string;\nexport const a = o as AdresseDeCreation;\n";
    expect(await messagesDeVerrou(code), 'un libellé casté en adresse indexerait les choix de création').toHaveLength(1);
  });

  it('la fabrique `adresseDeCreation.ts` lint propre : son unique cast et ses fabriques portent leur exemption AU SITE', async () => {
    const [res] = await eslint.lintFiles(['src/engine/adresseDeCreation.ts']);
    expect(selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? ''))).toHaveLength(0);
    expect(res.errorCount).toBe(0);
    const reel = readFileSync('src/engine/adresseDeCreation.ts', 'utf8');
    const [cast] = await eslint.lintText(`${reel}\nexport const forge = (s: string) => s as AdresseDeCreation;\n`, { filePath: 'src/engine/adresseDeCreation.ts' });
    expect(selectionnerMessages(cast, (m) => MURS_DE_MARQUE.has(m.ruleId ?? '')), 'un SECOND cast dans la fabrique doit rougir').toHaveLength(1);
    const [texte] = await eslint.lintText(`${reel}\nexport const ecrite = 'signe:3';\n`, { filePath: 'src/engine/adresseDeCreation.ts' });
    expect(selectionnerMessages(texte, (m) => MURS_DE_MARQUE.has(m.ruleId ?? '')), 'une adresse écrite hors des fabriques doit rougir').toHaveLength(1);
  });

  /** ENTRE deux fabriques : l'exemption est sur la ligne de chaque fabrique, aucun bloc ne couvre ses voisines. */
  it.each([
    ['cast', '  forge: (s: string) => s as AdresseDeCreation,'],
    ['adresse littérale', "  ecrite: 'signe:3',"],
    ['préfixe de famille', "  prefixe: 'espece:',"],
  ])('une forge (%s) insérée ENTRE deux fabriques rougit', async (_forme, insere) => {
    const lignes = readFileSync('src/engine/adresseDeCreation.ts', 'utf8').split('\n');
    const apres = lignes.findIndex((l) => l.trimStart().startsWith('especeTirage:'));
    expect(lignes[apres + 1], 'la fixture tombe entre `especeTirage` et la fabrique suivante').toMatch(/eslint-disable-next-line murs\/marques/);
    lignes.splice(apres + 1, 0, insere);
    const [res] = await eslint.lintText(lignes.join('\n'), { filePath: 'src/engine/adresseDeCreation.ts' });
    expect(selectionnerMessages(res, (m) => m.ruleId === 'murs/marques').map((m) => m.line)).toEqual([apres + 2]);
  });

  /** L'adresse ÉCRITE en texte : tsc laisse un objet intermédiaire à clés littérales entrer dans un
   *  `Record<AdresseDeCreation, V>` (JSDoc de `engine/adresseDeCreation.ts`), le lint la refuse à l'écriture. */
  it.each([
    ['clé littérale', "export const p = { 'espece:talents:0': { id: 'perspicace' } };"],
    ['valeur littérale', "export const a = 'dotation:0.1';"],
    ['gabarit ouvert sur une famille', 'const i = 2;\nexport const o = { [`carriere:competences:${i}`]: 1 };'],
    ['gabarit sans expression', 'export const o = { [`espece:talents:1:tirage:0`]: 1 };'],
  ])('une adresse de création écrite en texte (%s) est refusée', async (_forme, code) => {
    expect(await messagesDeVerrou(`${code}\n`)).toHaveLength(1);
  });

  /** Le PRÉFIXE de famille écrit en texte recopie la grammaire hors de `engine/adresseDeCreation.ts` (`deFamille`, `tirageSous`). */
  it.each([
    ['littéral espece', "export const p = 'espece:';"],
    ['littéral carriere', "export const p = 'carriere:';"],
    ['littéral ajout', "export const p = 'ajout:';"],
    ['littéral signe', "export const p = 'signe:';"],
    ['littéral dotation', "export const p = 'dotation:';"],
    ['littéral espece:talents', "export const p = 'espece:talents:';"],
    ['littéral carriere:competences', "export const p = 'carriere:competences:';"],
    ['gabarit sans expression', 'export const p = `carriere:`;'],
  ])('un préfixe de famille écrit en texte (%s) est refusé', async (_forme, code) => {
    expect(await messagesDeVerrou(`${code}\n`)).toHaveLength(1);
  });

  it('un texte sans la forme d’une adresse ni d’un préfixe passe : libellé, étape de flux, gabarit de clé d’écran, gabarit étranger', async () => {
    const code = "const i = 1;\nexport const o = { 'Arme (au choix)': 1, etape: 'carriere:relance', ecran: `espece:${i}`, t: `x:${i}` };\n";
    expect(await messagesDeVerrou(code)).toHaveLength(0);
  });
});

/**
 * LES `@ts-expect-error` DU MURAGE SONT-ILS TUEURS ? (#1262 B4) — `roll-seam-mints.test.ts` atteste
 * que `pushCombatStep` refuse un littéral, par des directives `@ts-expect-error`. Une directive ne
 * vaut que si l'erreur attendue EXISTE : sous l'ancienne signature (`CascadeStep`), elle devient
 * INUTILISÉE et `tsc` rougit (TS2578) — c'est ce qui rend le test tueur plutôt que décoratif.
 *
 * Mesuré ICI sur un programme TypeScript RÉEL (API du compilateur, deux variantes de la MÊME
 * signature), pas sur une relecture du fichier : la sonde de mutation du lot devient une garde
 * REJOUABLE, au lieu d'une preuve à refaire à la main.
 */
const SONDE = (signature: 'BuiltCascadeStep' | 'CascadeStep') => `
declare const BRAND: unique symbol;
type CascadeStep = { id: string; kind: string };
type BuiltCascadeStep = CascadeStep & { readonly [BRAND]: true };
declare function pushCombatStep(step: ${signature}): void;
// @ts-expect-error — littéral nu : la marque de mint est absente
pushCombatStep({ id: 'e', kind: 'k' });
`;

function codesDeDiagnostic(code: string): number[] {
  const session = virtualProgram({ 'sonde-murage.ts': code });
  const erreurs: unknown[] = [];
  try { return [...session.program.getSyntacticDiagnostics(), ...session.program.getSemanticDiagnostics()].map((d) => d.code); }
  catch (erreur) { erreurs.push(erreur); throw erreur; }
  finally { libererSessions([session], erreurs); }
}

describe('#1262 B4 — la sonde de murage de `pushCombatStep` est TUEUSE', () => {
  it('signature MURÉE (`BuiltCascadeStep`) : la directive est CONSOMMÉE — zéro diagnostic', () => {
    expect(codesDeDiagnostic(SONDE('BuiltCascadeStep'))).toEqual([]);
  });

  it('signature D’AVANT (`CascadeStep`) : le littéral passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE('CascadeStep')), 'sans ce rouge, les `@ts-expect-error` du lot ne prouveraient rien').toContain(2578);
  });
});

/**
 * L'ENJEU D'UN TIRAGE EST REQUIS AU TYPE (#1262 V2 L6) — `TableSpec.stake` a perdu son `?`
 * (`rollSeam.ts`), et le cliquet textuel a perdu son volet `table:` dans le même geste
 * (`cascade-step-stake-guard.test.ts`). Le murage n'est complet qu'à DEUX serrures : celle-ci ferme
 * les mints (`tableStep`/`tableStepDone`), et `revealStep.ts` ferme la 3ᵉ fabrique exemptée du lint
 * ci-dessus — son `opts.table` accepte seulement une déclaration RÉSOLUE (`CascadeTableDone`), mesuré
 * par `reveal.test.ts`. Ce qui remplace le scan doit MORDRE : la sonde rejoue les DEUX signatures sur
 * un programme TypeScript réel — requise, la directive est consommée ; optionnelle, elle devient
 * inutilisée (TS2578). Sans ce rouge, les `@ts-expect-error` de `roll-seam-mints` ne prouveraient
 * rien, et le lot aurait retiré un scan sans rien mettre à sa place.
 */
const SONDE_ENJEU = (enjeu: 'stake: Stake' | 'stake?: Stake') => `
type Stake = { key: { dataset: string; kind: string } };
type TableSpec = { id: string; kind: string; label: string; actorId: string; table: { tableId: string }; ${enjeu} };
declare function tableStep(spec: TableSpec): void;
// @ts-expect-error — tirage MUET : l'enjeu est requis
tableStep({ id: 't', kind: 'k', label: 'Tirage', actorId: 'H1', table: { tableId: 'x' } });
`;

describe('#1262 V2 L6 — la sonde du murage de l’ENJEU des tirages est TUEUSE', () => {
  it('enjeu REQUIS : la directive est CONSOMMÉE — zéro diagnostic', () => {
    expect(codesDeDiagnostic(SONDE_ENJEU('stake: Stake'))).toEqual([]);
  });

  it('enjeu OPTIONNEL (l’état d’avant) : le tirage muet passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_ENJEU('stake?: Stake')), 'sans ce rouge, retirer le volet `table:` du cliquet laisserait un trou').toContain(2578);
  });
});

/**
 * L'ENJEU D'UNE ÉTAPE MONO EST REQUIS AU TYPE (#1262 V2 L6d) — deuxième famille murée, après les
 * tirages. La différence de forme est VOULUE et se lit ici : `stake: StakeRef | undefined` (et non
 * `stake: StakeRef`) supprime l'OMISSION — le déclarant DOIT parler de son enjeu — tout en laissant
 * exprimable le résiduel honnête (un porteur non résoluble), que la porte `monoStep` refuse alors
 * bruyamment (`refusePorte` : DEV throw, PROD journalisé). Une valeur muette ne peut donc plus
 * arriver par distraction, seulement par déclaration explicite — et elle se voit.
 *
 * La sonde rejoue les DEUX signatures sur un programme TypeScript réel : requise, la directive est
 * consommée ; optionnelle, elle devient inutilisée (TS2578). Sans ce rouge, le champ pourrait
 * redevenir `stake?:` sans qu'aucun test ne bouge.
 */
const SONDE_MONO = (enjeu: 'stake: Stake | undefined' | 'stake?: Stake') => `
type Stake = { key: { dataset: string; kind: string } };
type MonoSpec = { id: string; kind: string; label: string; actor: { id: string }; ${enjeu} };
declare function monoStep(spec: MonoSpec): void;
// @ts-expect-error — étape mono MUETTE : l'enjeu doit être déclaré
monoStep({ id: 'm', kind: 'k', label: 'L', actor: { id: 'H1' } });
`;

describe('#1262 V2 L6d — la sonde du murage de l’ENJEU des étapes MONO est TUEUSE', () => {
  it('enjeu REQUIS (valeur possiblement `undefined`) : la directive est CONSOMMÉE', () => {
    expect(codesDeDiagnostic(SONDE_MONO('stake: Stake | undefined'))).toEqual([]);
  });

  it('enjeu OPTIONNEL (l’état d’avant) : l’étape muette passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_MONO('stake?: Stake')), 'sans ce rouge, le murage des monos ne prouverait rien').toContain(2578);
  });
});

/**
 * LA RANGÉE DE JET EST MURÉE AU TYPE (#1262 V3 Lf) — jumelle de la marque d'étape : `BuiltRollRow`
 * porte une propriété REQUISE et `RollShell.rows` l'exige (`readonly BuiltRollRow[]`), donc
 * un littéral monté à la main ne compile plus. C'est ce requis qui a REMPLACÉ le cliquet de comptage
 * `ui/roll-row-mount-ratchet.test.ts` (mort au même lot) : sans cette sonde, plus rien ne mesurerait
 * la porte au type, et un retour à la propriété optionnelle passerait en silence.
 *
 * Deux signatures rejouées sur un programme TypeScript réel : requise, la directive est consommée ;
 * optionnelle (l'état d'avant), le littéral nu passe et la directive devient INUTILISÉE (TS2578).
 */
const SONDE_RANGEE = (marque: 'readonly [BRAND]: true' | 'readonly [BRAND]?: true') => `
declare const BRAND: unique symbol;
type RollRowData = { row: { d?: { roll: number } }; rolled?: boolean; onRoll?: () => void };
type BuiltRollRow = RollRowData & { ${marque} };
declare function RollShell(props: { rows: readonly BuiltRollRow[] }): void;
// @ts-expect-error — rangée montée À LA MAIN : la marque de la porte est absente
RollShell({ rows: [{ row: {}, rolled: false }] });
`;

describe('#1262 V3 Lf — le murage de la RANGÉE de jet est TUEUR', () => {
  it('marque REQUISE : la directive est CONSOMMÉE — zéro diagnostic', () => {
    expect(codesDeDiagnostic(SONDE_RANGEE('readonly [BRAND]: true'))).toEqual([]);
  });

  it('marque OPTIONNELLE (l’état d’avant) : le littéral nu passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_RANGEE('readonly [BRAND]?: true')), 'sans ce rouge, la mort du cliquet laisserait un trou').toContain(2578);
  });
});

/**
 * UN CHOIX N'EST JAMAIS DE GROUPE — MURÉ AU TYPE (#1262 V4 M2). `groupOwner` fait rendre l'owner `'*'`
 * par l'arbitre ; le choix, lui, se pose au niveau de l'ÉTAPE (`setCascadeChoice`) et n'a pas de
 * porteur — n'importe quel siège trancherait la voie d'autrui. La garde RUNTIME qui le vérifiait
 * (`cascade.assertChoixJamaisPartage`) est morte avec son registre : mesuré, l'unique producteur
 * d'étape à `options` est `rollSeam.choiceStep`, et les deux poseurs de `groupOwner` (`bandStep`,
 * `hostStep`) n'exposent aucun champ `options`. Reste la déclaration — fermée par `groupOwner?: never`.
 *
 * CE QUE LE `never` AJOUTE, mesuré ici : sur un LITTÉRAL frais, la propriété excédentaire suffisait
 * déjà (les deux signatures sont vertes) ; c'est l'objet ÉLARGI passé par variable ou épandage qui
 * passait en silence sans lui. La sonde joue donc la forme SPREAD — sans elle, retirer le `never`
 * ne ferait rougir aucun test.
 */
const SONDE_CHOIX = (go: 'groupOwner?: never' | '') => `
type Option = { key: string; label: string };
type ChoiceSpec = { id: string; kind: string; label: string; actorId: string; options: readonly Option[]; ${go} };
declare function pushChoice(spec: ChoiceSpec): void;
declare const base: { id: string; kind: string; label: string; actorId: string; options: readonly Option[] };
const large = { ...base, groupOwner: true };
// @ts-expect-error — un choix de GROUPE : le champ est refusé au type
pushChoice(large);
`;

describe('#1262 V4 M2 — le murage du CHOIX DE GROUPE est TUEUR', () => {
  it('`groupOwner?: never` : l’objet élargi est REFUSÉ, la directive est CONSOMMÉE', () => {
    expect(codesDeDiagnostic(SONDE_CHOIX('groupOwner?: never'))).toEqual([]);
  });

  it('SANS le champ (l’état d’avant) : l’épandage passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_CHOIX('')), 'sans ce rouge, la mort de la garde runtime laisserait un trou').toContain(2578);
  });
});

/**
 * LA MARQUE DU TEXTE JOUEUR (#1318 V8a₀) — troisième marque sous le MÊME verrou : `PlayerText`
 * (`src/i18n/playerText.ts`) n'a que trois minteurs (`i18n.t`, `data.dataLabel`/`data.refLabel`,
 * `rollSeam.composeRollLabel`), donc la seule autre fabrique est le cast. Les CINQ formes du patron
 * sont rejouées ici sur la config RÉELLE : sans elles, ajouter un nom au sélecteur serait une
 * déclaration, pas un murage.
 *
 * Chaque minteur est SOUS la règle avec son exemption AU SITE : `i18n/index.ts` et `state/rollSeam.ts`
 * sont mesurés par le volet des minteurs du verrou de forge (#1988), `i18n/fixtureText.ts` par les deux
 * volets du bas — un second cast y échoue.
 */
const ENTETE_TEXTE = "import type { PlayerText } from '../i18n/playerText';\ndeclare const o: unknown;\n";

describe('#1318 V8a₀ — le lint mure les ROUTES DE FORGE du texte joueur', () => {
  it('`x as PlayerText` — la forme directe', async () => {
    expect(await messagesDeVerrou(`${ENTETE_TEXTE}export const a = o as PlayerText;\n`)).toHaveLength(1);
  });

  it('`<PlayerText>x` — l’autre syntaxe de cast (TSTypeAssertion)', async () => {
    expect(await messagesDeVerrou(`${ENTETE_TEXTE}export const b = <PlayerText>o;\n`)).toHaveLength(1);
  });

  it('`x as PlayerText[]` — un tableau s’interpose entre le cast et la référence', async () => {
    expect(await messagesDeVerrou(`${ENTETE_TEXTE}export const c = o as PlayerText[];\n`)).toHaveLength(1);
  });

  it('`as unknown as readonly PlayerText[]` — la route RÉALISTE vers une liste de libellés', async () => {
    expect(await messagesDeVerrou(`${ENTETE_TEXTE}export const d = [] as unknown as readonly PlayerText[];\n`)).toHaveLength(1);
  });

  it('`type A = PlayerText` — l’ALIAS est refusé à sa DÉCLARATION (le verrou filtre par NOM)', async () => {
    const code = `${ENTETE_TEXTE}type AliasTexte = PlayerText;\nexport const e = o as AliasTexte;\n`;
    expect(await messagesDeVerrou(code), 'la route alias doit être MURÉE, pas seulement dite').toHaveLength(1);
  });

  it('un type de SIGNATURE qui EXIGE du texte minté passe : employer la marque n’est pas la déguiser', async () => {
    const code = [
      "import type { PlayerText } from '../i18n/playerText';",
      'type Rendu = (lignes: readonly PlayerText[]) => PlayerText;',
      'export const f: Rendu = (l) => l[0];',
    ].join('\n');
    expect(await messagesDeVerrou(code)).toHaveLength(0);
  });

  /**
   * LE SUCCESSEUR DES HARNAIS EST SOUS LA MÊME RÈGLE (#1318 E7) — `i18n/fixtureText.ts` marque les
   * libellés des fixtures de test. Il est réservé aux harnais par les cliquets T4/T5
   * (`player-text-ratchet.test.ts`), et sa fabrique reste UN cast, exempté AU SITE comme celle du
   * fossile : sans le volet symétrique ci-dessous, rien ne mesurerait qu'un 2ᵉ cast y échoue.
   */
  it('le MINTEUR DE FIXTURE `i18n/fixtureText.ts` passe la règle : son unique cast porte sa directive AU SITE', async () => {
    const [res] = await eslint.lintFiles(['src/i18n/fixtureText.ts']);
    expect(selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? '')), 'la directive posée couvre le cast du minteur de fixture').toHaveLength(0);
    expect(res.errorCount, 'aucune autre erreur de lint sur le minteur de fixture').toBe(0);
  });

  it('un cast de PLUS dans le minteur de fixture (sans sa directive) est REFUSÉ — l’exemption n’est pas au fichier', async () => {
    const reel = readFileSync('src/i18n/fixtureText.ts', 'utf8');
    const second = `${reel}\ndeclare const sonde: unknown;\nexport const forge2 = sonde as PlayerText;\n`;
    const [res] = await eslint.lintText(second, { filePath: 'src/i18n/fixtureText.ts' });
    expect(selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? '')), 'un 2ᵉ cast non justifié doit rougir').toHaveLength(1);
  });
});

/**
 * LE CHAMP PILOTE EST MURÉ AU TYPE (#1318 V8a₀) — `CascadeStep.label` (resserré sur `CascadeStepBase`,
 * pas sur `RollParticipant`) accepte seulement un `PlayerText`. La sonde rejoue les DEUX signatures sur
 * un programme TypeScript réel : marquée, la directive est CONSOMMÉE ; en `string` (l'état d'avant), le
 * littéral passe et la directive devient INUTILISÉE (TS2578). Sans ce rouge, le champ pourrait
 * redevenir `label?: string` sans qu'aucun test ne bouge.
 */
const SONDE_TEXTE = (champ: 'label?: PlayerText' | 'label?: string') => `
declare const BRAND: unique symbol;
type PlayerText = string & { readonly [BRAND]: true };
type CascadeStep = { id: string; kind: string; ${champ} };
declare function pushStep(step: CascadeStep): void;
// @ts-expect-error — libellé écrit au call-site : il n'est sorti d'aucun minteur de texte joueur
pushStep({ id: 'e', kind: 'k', label: 'Retirer la voile (chavirage)' });
`;

describe('#1318 V8a₀ — le murage du CHAMP PILOTE (`CascadeStep.label`) est TUEUR', () => {
  it('champ MARQUÉ (`PlayerText`) : la directive est CONSOMMÉE — zéro diagnostic', () => {
    expect(codesDeDiagnostic(SONDE_TEXTE('label?: PlayerText'))).toEqual([]);
  });

  it('champ `string` (l’état d’avant) : le littéral passe, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_TEXTE('label?: string')), 'sans ce rouge, le murage du texte joueur ne prouverait rien').toContain(2578);
  });
});

/**
 * LES PORTES DU SEAM N'ACCEPTENT AUCUN LITTÉRAL (#1318 V8a₀) — LE contrat du lot, et celui qui
 * manquait : marquer `CascadeStep.label` ne mordait QUE sur la déclaration directe d'une étape. La voie
 * CANONIQUE passe par les constructeurs de `rollSeam` (`monoStep`/`tableStep`/`choiceStep`/
 * `quantityStep`/`displayStep`/`bandStep`/`hostStep`), dont le cast interne `as BuiltCascadeStep`
 * BLANCHISSAIT le champ : mesuré, ~45 sites de production posaient un libellé écrit à la main et `tsc`
 * restait vert. Le `label` de leurs SPECS est donc marqué à son tour — la marque est exigée AU
 * PARAMÈTRE, en amont du cast.
 *
 * La sonde reproduit la forme EXACTE de la porte (spec en entrée, cast vers la marque en sortie) et
 * rejoue les deux signatures : marquée, la directive est consommée ; en `string` (l'état d'avant), le
 * littéral traverse la porte et la directive devient INUTILISÉE (TS2578). Sans ce rouge, le murage
 * pourrait redevenir cosmétique sans qu'aucun test ne bouge.
 */
const SONDE_PORTE = (champ: 'label: PlayerText' | 'label: string') => `
declare const TEXTE: unique symbol;
declare const ETAPE: unique symbol;
type PlayerText = string & { readonly [TEXTE]: true };
type CascadeStep = { id: string; kind: string; label?: PlayerText };
type BuiltCascadeStep = CascadeStep & { readonly [ETAPE]: true };
type MonoSpec = { id: string; kind: string; ${champ} };
declare function pousse(step: BuiltCascadeStep): void;
function monoStep(spec: MonoSpec): BuiltCascadeStep {
  return { id: spec.id, kind: spec.kind, label: spec.label } as BuiltCascadeStep;
}
// @ts-expect-error — libellé écrit au call-site : la PORTE le refuse, son cast interne ne le blanchit plus
pousse(monoStep({ id: 'e', kind: 'k', label: 'Retirer la voile (chavirage)' }));
`;

describe('#1318 V8a₀ — les PORTES du seam refusent un littéral (le cast interne ne blanchit plus)', () => {
  it('spec MARQUÉE : la directive est CONSOMMÉE — zéro diagnostic', () => {
    expect(codesDeDiagnostic(SONDE_PORTE('label: PlayerText'))).toEqual([]);
  });

  it('spec en `string` (l’état d’avant) : le littéral TRAVERSE la porte, la directive devient INUTILISÉE (TS2578)', () => {
    expect(codesDeDiagnostic(SONDE_PORTE('label: string')), 'c’est CE rouge qui manquait : le mur ne mordait pas sur la voie canonique').toContain(2578);
  });
});

/**
 * LES DEUX CONTOURNEMENTS DE CONTENEUR (#1318 V8a₀ T1/T2) — un champ marqué ne protège que la
 * DÉCLARATION ; recomposer l'étape entière le blanchit. `Object.assign` (dont la signature ne vérifie
 * rien contre la cible) et `x as CascadeStep` sont donc murés par le lint, sur la config RÉELLE.
 *
 * Les TESTS sont hors de ce sélecteur, à dessein : leurs `as CascadeStep` sont GELÉS nominativement et
 * décroissants (`player-text-ratchet.test.ts`), là où le code de PRODUCTION n'en a plus aucun (mesuré).
 * Le dernier volet le prouve — sans lui, « les tests sont exclus » serait une affirmation, pas un fait.
 */
describe('#1318 V8a₀ T1/T2 — le lint mure les CONTENEURS qui blanchissent le libellé', () => {
  it('T1 : `Object.assign(step, { label: "…" })` est REFUSÉ dans un fichier de flux', async () => {
    const code = "declare const step: object;\nObject.assign(step, { label: 'Hop' });\n";
    expect(await messagesDeVerrou(code)).toHaveLength(1);
  });

  it('T1 : un `Object.assign` SANS `label` n’est pas touché (la règle ne mord que le champ marqué)', async () => {
    const code = "declare const o: object;\nObject.assign(o, { icon: 'x', kind: 'k' });\n";
    expect(await messagesDeVerrou(code)).toHaveLength(0);
  });

  it('T2 : `x as CascadeStep` est REFUSÉ dans un fichier de flux', async () => {
    const code = "import type { CascadeStep } from './pendings';\ndeclare const o: unknown;\nexport const a = o as CascadeStep;\n";
    const [res] = await eslint.lintText(code, { filePath: 'src/state/__sonde-conteneur.ts' });
    expect(selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? ''))).toHaveLength(1);
  });

  it('T2 : le même cast dans un fichier de TEST passe — le stock y est GELÉ au cliquet, pas muré', async () => {
    const code = "import type { CascadeStep } from './pendings';\ndeclare const o: unknown;\nexport const b = o as CascadeStep;\n";
    const [res] = await eslint.lintText(code, { filePath: 'src/state/__sonde-conteneur.test.ts' });
    expect(selectionnerMessages(res, (m) => MURS_DE_MARQUE.has(m.ruleId ?? '')), 'la portée du sélecteur est un CHOIX mesuré, pas un oubli').toHaveLength(0);
  });

});

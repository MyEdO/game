/**
 * GARDE — la GRAPHIE de la prose de scène, mesurée sur le CODE qui AUTHORE.
 *
 * QUESTION : un producteur de document de scène (générateur de campagne, scénario de test, fixture)
 * écrit-il encore l'ancienne graphie que `sceneSchema`/`effectSchema` ont retirée au lot #1467 L1b
 * V-P2 (`scenes[].description`, `DialogueNode.text`, `DialogueChoice.text`, et le `text` des effets
 * `journal`/`document`/`setObjective`) ?
 *
 * POURQUOI ELLE EXISTE : le contrat de donnée (`schema-contract.test.ts`) ne voit que les documents
 * COMMITTÉS. Un générateur resté à l'ancienne graphie est invisible pour lui — jusqu'au jour où un
 * auteur le relance et produit un document que `parseProject` REFUSE. C'est exactement le trou par
 * lequel `scripts/loup-et-saumure/generate.mjs` et `scripts/barge-du-sel/generate.mjs` sont passés :
 * migrés au geste du même lot, ils n'étaient gardés par rien.
 *
 * PÉRIMÈTRE : `src/**` et `scripts/**`, tests COMPRIS (une fixture de test est un producteur comme
 * un autre — trois d'entre elles ont été trouvées à l'ancienne graphie par ce même lot). Les blocs
 * de FRONTMATTER y sont MASQUÉS (`masquerFrontmatter`) : `description` y est une clé de fiche ; le
 * `meta` d'un script de workflow aussi (`masquerMetaDeWorkflow`) : `description` y est une clé exigée ;
 * une définition d'outil MCP aussi (`masquerDefinitionDOutil`) : `description` y est une clé du protocole.
 *
 * ANGLE MORT DÉCLARÉ : la détection est TEXTUELLE et ancrée sur des formes d'AUTHORING littérales
 * (`type: 'journal', text:`, `description:` d'une scène, `choices: [{ text:`). Un document construit
 * par épissure (`{ ...noeud, text }`) ou par une clé calculée lui échappe — le contrat de donnée et
 * le typecheck restent les filets pour ces formes-là. La propriété RACCOURCIE d'un effet
 * (`{ type: 'setObjective', id, text }`) est, elle, COUVERTE (#1522) : c'est par ce trou exact que les
 * helpers `OBJ` des deux générateurs nommés ci-dessus sont restés verts à la graphie schema-3. La
 * même forme raccourcie reste hors portée pour `choices` (aucun porteur mesuré).
 * Second angle mort, MONO-LIGNE : les deux motifs d'effet sont ancrés par `[^\n]*?`, donc un effet ÉCLATÉ
 * sur plusieurs lignes (`{\n  type: 'journal',\n  text: …`) ou dont le `text` PRÉCÈDE son `type:` leur
 * échappe — 0 porteur mesuré aujourd'hui dans `src/**` ni `scripts/**`.
 */
import { describe, expect, it } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { detenteur } from '../detenteur.testkit';

/** Racines d'AUTHORING balayées — le code qui PRODUIT des documents de scène. */
const RACINES = ['src', 'scripts'];
const EXTS = ['.ts', '.tsx', '.mjs', '.mts', '.js'];

/**
 * EXEMPTIONS au SITE, nominatives et MESURÉES :
 *  - CE fichier — il PORTE les formes surveillées (motifs et texte forgé du contrôle de morsure) :
 *    s'auto-mesurer le rendrait rouge par construction ;
 *  - `scripts/ops/board.mjs` et son test — `description` y est le champ OBLIGATOIRE de
 *    `ProjectV2SingleSelectFieldOptionInput` (API GraphQL GitHub, forme introspectée le 2026-09-15) :
 *    l'outil projette l'état des chantiers sur un Project, il ne produit aucun document de scène.
 */
const NOMS_EXEMPTS = new Set([
  'src/data/scene-prose-graphie-guard.test.ts',
  'scripts/ops/board.mjs',
  'scripts/ops/board.test.mjs',
]);
const estExempt = (rel: string): boolean => NOMS_EXEMPTS.has(rel);

/** Les formes d'authoring RETIRÉES par #1467 L1b V-P2, chacune avec sa cible. */
const FORMES: readonly { motif: RegExp; quoi: string; cible: string }[] = [
  { motif: /type:\s*'(?:journal|document|setObjective)'[^\n]*?,\s*text:/g, quoi: "effet `journal`/`document`/`setObjective` à `text`", cible: 'desc' },
  { motif: /choices:\s*\[\s*\{\s*text:/g, quoi: '`DialogueChoice.text`', cible: 'label' },
  // La lookbehind écarte trois voisinages qui ne sont JAMAIS une propriété d'objet : le backtick
  // (mention en prose de JSDoc, `` `description:` ``), l'ancre `^` d'un littéral d'expression
  // régulière (`/^description:\s*(.+)$/m`) — c'est sous ces deux formes que les générateurs de docs
  // lisent le frontmatter YAML d'un `SKILL.md` —, et la QUOTE ouvrante : une chaîne qui COMMENCE par
  // `description:` est une ligne YAML de fiche citée, jamais une clé de scène (un document de scène
  // écrirait `'description': x`, la quote se plaçant ENTRE la clé et le deux-points).
  { motif: /(?<![A-Za-z0-9_$`^'"])description:/g, quoi: '`description` de scène/projet', cible: 'desc' },
  // Propriété RACCOURCIE : ancrée sur le `type:` de l'effet, donc aveugle aux `text` LÉGITIMES
  // (`narrative.text`, `TrappingRef.text`) que le lot #1467 L1b a laissés intacts.
  { motif: /type:\s*'(?:journal|document|setObjective)'[^\n]*?,\s*text\s*[,})]/g, quoi: "effet `journal`/`document`/`setObjective` à `text` RACCOURCI", cible: 'desc' },
];

/**
 * FRONTMATTER masqué AVANT toute mesure — exclusion STRUCTURELLE, jamais un site ni un fichier.
 *
 * Un bloc `---`…`---` est l'en-tête d'une FICHE (mémoire, skill), format où `description:` est une
 * clé LÉGITIME : rien de ce qui vit là n'authore un document de scène. Le bloc est reconnu à ses
 * DÉLIMITEURS, y compris quand une fixture le construit en lignes de code
 * (`'---', 'name: x', 'description: y', '---'`) — c'est cette forme qui a fait rougir la garde sur
 * deux fiches mémoire, et une exemption au fichier aurait rendu ces fichiers aveugles au reste.
 *
 * Les lignes masquées sont VIDÉES, jamais retirées : les `fichier:ligne` rendus restent ceux du
 * fichier réel.
 */
const DELIMITEUR_FRONTMATTER = /^\s*['"`]?---['"`]?,?\s*$/;

function masquerFrontmatter(texte: string): string {
  let dedans = false;
  return texte
    .split('\n')
    .map((ligne) => {
      if (DELIMITEUR_FRONTMATTER.test(ligne)) {
        dedans = !dedans;
        return '';
      }
      return dedans ? '' : ligne;
    })
    .join('\n');
}

/**
 * `meta` de WORKFLOW masqué AVANT toute mesure — exclusion STRUCTURELLE, sur le modèle du frontmatter.
 *
 * Le littéral `export const meta = {` ouvre le `meta` d'un script de workflow, dont `description` est
 * une clé EXIGÉE (porte de forme des workflows, règle `meta` : `scripts/ops/workflows.test.mjs`) :
 * rien de ce qui vit là n'authore un document de scène. Le bloc court jusqu'à sa ligne fermante `}`
 * en COLONNE 0, y compris quand une fixture porte la source d'un workflow dans un gabarit dont le
 * texte s'ouvre sur ce littéral ; ce qui PRÉCÈDE le littéral sur sa ligne reste mesuré.
 *
 * Les lignes masquées sont VIDÉES, jamais retirées : les `fichier:ligne` rendus restent ceux du
 * fichier réel.
 */
const OUVERTURE_META = /export const meta = \{\s*$/;
const FERMETURE_META = /^\}/;

function masquerMetaDeWorkflow(texte: string): string {
  let dedans = false;
  return texte
    .split('\n')
    .map((ligne) => {
      if (dedans) {
        if (FERMETURE_META.test(ligne)) dedans = false;
        return '';
      }
      const ouverture = OUVERTURE_META.exec(ligne);
      if (!ouverture) return ligne;
      dedans = true;
      return ligne.slice(0, ouverture.index);
    })
    .join('\n');
}

/**
 * DÉFINITION D'OUTIL MCP masquée AVANT toute mesure — exclusion STRUCTURELLE, sur le modèle du `meta`.
 *
 * Un objet littéral qui porte, à son premier niveau, les trois clés `name`, `description` ET
 * `inputSchema` est la définition d'un outil (`tools/list` du protocole MCP, où `description` est une
 * clé de l'outil ; `OUTIL_SUIVI`, scripts/ops/suiviDonnee.mjs) : rien de ce qui vit là n'authore un
 * document de scène. L'objet s'ouvre sur une ligne terminée par `{` et court jusqu'à la ligne `}` de
 * MÊME indentation ; son premier niveau est l'indentation de sa première ligne non vide. Un objet auquel
 * manque l'une des trois clés reste mesuré.
 *
 * Les lignes masquées sont VIDÉES, jamais retirées : les `fichier:ligne` rendus restent ceux du
 * fichier réel.
 */
const OUVERTURE_OBJET = /^(\s*)\S.*\{\s*$/;
const CLES_D_OUTIL = ['name', 'description', 'inputSchema'];

function masquerDefinitionDOutil(texte: string): string {
  const lignes = texte.split('\n');
  for (let i = 0; i < lignes.length; i += 1) {
    const ouverture = OUVERTURE_OBJET.exec(lignes[i]);
    if (!ouverture) continue;
    const fin = lignes.findIndex((l, k) => k > i && l.startsWith(`${ouverture[1]}}`));
    if (fin < 0) continue;
    const corps = lignes.slice(i + 1, fin);
    const niveau = /^(\s*)/.exec(corps.find((l) => l.trim() !== '') ?? '')?.[1] ?? '';
    const cles = new Set(corps.map((l) => new RegExp(`^${niveau}([A-Za-z_$][\\w$]*)\\s*:`).exec(l)?.[1]).filter(Boolean));
    if (!CLES_D_OUTIL.every((c) => cles.has(c))) continue;
    for (let k = i + 1; k < fin; k += 1) lignes[k] = '';
    i = fin;
  }
  return lignes.join('\n');
}

const masquer = (texte: string): string => masquerDefinitionDOutil(masquerMetaDeWorkflow(masquerFrontmatter(texte)));

describe('graphie de la prose de scène — aucun producteur ne réécrit la forme retirée (#1467 L1b)', () => {
  const corpus = detenteur(() => readCorpus(RACINES, { exts: EXTS, tests: true }).filter((f) => !estExempt(f.rel)));

  it('le corpus balayé est NON VIDE et couvre les deux racines (sans quoi la garde serait un no-op vert)', () => {
    expect(corpus().length).toBeGreaterThan(500);
    expect(corpus().some((f) => f.rel.startsWith('src/'))).toBe(true);
    expect(corpus().some((f) => f.rel.startsWith('scripts/'))).toBe(true);
  });

  it('la garde MORD : chaque forme surveillée est reconnue sur un texte forgé', () => {
    const forge = [
      "flowOf([{ type: 'journal', text: 'x' }])",
      "choices: [{ text: 'Revenir', next: 'a' }]",
      "description: 'une scène',",
      "({ type: 'setObjective', id: 'm', text })",
    ];
    for (const [i, f] of FORMES.entries()) {
      f.motif.lastIndex = 0;
      expect(new RegExp(f.motif.source, 'g').test(forge[i]), `la forme « ${f.quoi} » n'est plus détectée`).toBe(true);
    }
  });

  it('frontmatter : la clé `description` d’une FICHE passe, celle d’une scène reste attrapée', () => {
    // Forme RÉELLE d'une fixture de fiche mémoire : l'en-tête construit en lignes de code.
    const fixtureDeFiche = [
      'const fiche = [',
      "  '---',",
      "  'name: user-doctrine-x',",
      "  'description: Doctrine utilisateur',",
      "  'metadata: ',",
      "  '---',",
      '].join(SAUT);',
    ].join('\n');
    const documentDeScene = "const scene = { id: 'a', description: 'une scène' };";
    // Forme RÉELLE d'un test de lecteur de frontmatter : la ligne YAML ATTENDUE, citée entre quotes
    // (`scripts/guards/budget-contexte.test.mjs:63`) — hors de tout bloc `---`, donc jamais masquée.
    const ligneYamlCitee = "assert.equal(ligneDeDescription(doc), 'description: d');";
    const mord = (src: string) => new RegExp(FORMES[2].motif.source, 'g').test(masquerFrontmatter(src));
    expect(mord(fixtureDeFiche), 'un en-tête de fiche est lu comme un document de scène').toBe(false);
    expect(mord(ligneYamlCitee), 'une ligne YAML CITÉE est lue comme un document de scène').toBe(false);
    expect(mord(documentDeScene), 'un `description:` HORS frontmatter doit rester attrapé').toBe(true);
    // Le masque ne DÉCALE aucune ligne : la garde cite des `fichier:ligne`.
    expect(masquerFrontmatter(fixtureDeFiche).split('\n')).toHaveLength(fixtureDeFiche.split('\n').length);
  });

  it('meta de workflow : la clé `description` d’un `meta` passe, celle d’une scène hors meta reste attrapée', () => {
    // Forme RÉELLE d'une fixture de workflow : la source du script portée par un gabarit.
    const fixtureDeWorkflow = [
      'const SOURCE = `export const meta = {',
      "  name: 'temoin',",
      "  description: 'Script témoin.',",
      "  phases: [{ title: 'Scout' }],",
      '}',
      '',
      "const scene = { id: 'a', description: 'une scène' }`;",
    ].join('\n');
    const trouve = (src: string) => [...masquer(src).matchAll(new RegExp(FORMES[2].motif.source, 'g'))].map((m) => masquer(src).slice(0, m.index).split('\n').length);
    expect(trouve(fixtureDeWorkflow), 'seul le `description:` de scène HORS meta est attrapé, à sa ligne').toEqual([7]);
    expect(masquer(fixtureDeWorkflow).split('\n')).toHaveLength(fixtureDeWorkflow.split('\n').length);
  });

  it('définition d’outil MCP : la clé `description` d’un objet `name` + `description` + `inputSchema` passe, une scène voisine reste attrapée', () => {
    // Forme RÉELLE : `OUTIL_SUIVI` (scripts/ops/suiviDonnee.mjs), description continuée sur deux lignes.
    const definition = [
      'export const OUTIL_SUIVI = {',
      "  name: 'suivi',",
      "  description: 'Écrit le suivi de vague '",
      "    + 'par un lot de mutations.',",
      '  inputSchema: z.toJSONSchema(Lot),',
      '}',
      "const scene = { id: 'a', description: 'une scène' }",
      'const presque = {',
      "  name: 'scène',",
      "  description: 'sans inputSchema, ce n’est pas un outil',",
      '}',
    ].join('\n');
    const trouve = (src: string) => [...masquer(src).matchAll(new RegExp(FORMES[2].motif.source, 'g'))].map((m) => masquer(src).slice(0, m.index).split('\n').length);
    expect(trouve(definition), 'seuls la scène et l’objet sans `inputSchema` sont attrapés, à leur ligne').toEqual([7, 10]);
    expect(masquer(definition).split('\n')).toHaveLength(definition.split('\n').length);
  });

  it('aucun site à l’ancienne graphie dans `src/**` ni `scripts/**`', () => {
    const trouves: string[] = [];
    for (const f of corpus()) {
      const texte = masquer(f.text);
      for (const forme of FORMES) {
        const re = new RegExp(forme.motif.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(texte)) !== null) {
          const ligne = texte.slice(0, m.index).split('\n').length;
          trouves.push(`${f.rel}:${ligne} — ${forme.quoi} → migrer en \`${forme.cible}\``);
        }
      }
    }
    expect(trouves.sort()).toEqual([]);
  });
});

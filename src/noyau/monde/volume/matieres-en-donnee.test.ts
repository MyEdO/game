import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../../../scripts/guards/lib/sourceCorpus.mjs';
import { dossierDe } from '../../../../scripts/guards/lib/couches.mjs';
import { codeSeul as sansCommentaires } from '../../../../scripts/guards/lib/commentPoison.mjs';
import { materials, semencesDeScene, terrains } from '../../../data';
import { detenteur } from '../../../lib/detenteur.testkit';

/**
 * GARDE DÉRIVÉE (#1691, élargie #1715, #1716, #1789) — aucune couche ÉMETTRICE du monde ne NOMME une
 * matière, ni un TERRAIN : ni le SOL qu'une scène neuve reçoit (semence, #1716), ni un id de
 * `terrains.json` en littéral (#1716, #1789).
 *
 * Les trois scans partagent le corpus (`fichiers`). Les neutraliseurs de matières et de sols
 * décrivent les homonymes par leur champ ou leur union de types. Chaque entrée est éprouvée
 * sur les producteurs réels pour qu'une exemption devenue inutile soit retirée.
 *
 * Le relief était le dernier domaine de `MaterialRef` dont l'id était choisi EN CODE
 * (`floors.ts` : `'pilier'`, `'pierre'`, `'terre'`) ; il vient de la donnée comme les autres — la
 * SCÈNE (`reliefDefaults`) pour les parois de relief, le TERRAIN (`terrains.json › matiere`) pour le
 * flanc d'un bloc plein, le BÂTIMENT (`buildings.json › roofMaterial`) pour sa couverture par
 * défaut. Ce que la garde interdit, c'est le RETOUR de ce choix : un id de `materials.json` écrit en
 * dur dans une couche qui ÉMET de la géométrie ou du catalogue.
 *
 * PÉRIMÈTRE : les modules de géométrie du monde et les autres producteurs du noyau.
 * La dérivation des masses de toiture résout leur matière dans le document de scène.
 */
const NOYAU = dossierDe('noyau');
const BUILDERS_DU_NOYAU = `${NOYAU}/monde/volume`;

const horsVolume = (rel: string) => !rel.startsWith(`${BUILDERS_DU_NOYAU}/`);

/**
 * Les SIGNAUX STRUCTURELS des producteurs du noyau hors volume, chacun neutralisé par `codeSeul` — aucun nom de fichier,
 * aucune ligne : c'est la FORME qui dit qu'un littéral n'est pas une émission de matière.
 *  - la clé `scope:` porte la PORTÉE d'un avertissement de validation, où `plan` est le plan de scène ;
 *  - une ligne faite des seuls membres d'une union de type (`| 'a' | 'b'`) déclare un vocabulaire, où `terre` est un
 *    mot du lexique (`MotDuLexique`, #3614).
 */
const SIGNAUX_STRUCTURELS = [
  { nom: 'clé `scope:` (portée d’un avertissement)', re: /\bscope:/ },
  { nom: 'ligne de membres d’une union de type', re: /^\s*(?:\|\s*'[^'\n]*'\s*)+;?\s*$/ },
] as const;

/** Les signaux structurels, en une seule passe. */
const LIGNE_STRUCTURELLE = new RegExp(SIGNAUX_STRUCTURELS.map((s) => s.re.source).join('|'));

function fichiersDuPerimetre(): { rel: string; code: string }[] {
  return readCorpus([NOYAU], { exts: ['.ts'] }).map(({ rel, text }) => ({ rel, code: text }));
}

/** Le code SANS ses commentaires, lignes préservées — mesure COMMUNE aux deux bras (matières et
 *  semence de terrain) : une réf en prose n'est jamais une émission, quel que soit le vocabulaire.
 *  La coupe vient de la primitive de garde (`codeSeul`, `scripts/guards/lib/commentPoison.mjs`), qui
 *  balaie les CHAÎNES et les littéraux de regex avant de blanchir un span de commentaire : un `//`
 *  à l'intérieur d'une chaîne (`'http://x'`) ne tronque pas la ligne, et la mesure des littéraux qui
 *  suivent reste faite. */
function codeNu(src: string): string[] {
  return sansCommentaires(src).split('\n');
}

/** Un littéral de chaîne VIDÉ, ses bornes gardées : une neutralisation ne déplace aucune colonne. */
const litteraux = (t: string) => t.replace(/(['"`])[^'"`\n]*\1/g, (m) => `${m[0]}_${m[0]}`);

/** Un mot lu dans le code, échappé pour entrer dans une expression (`'+x'`, membre d'une union de familles). */
const echappe = (mot: string) => mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** UNION de littéraux d'un TYPE (`'lieu' | 'commerce' | 'plan'`) : un type ne rend rien — il DÉCLARE
 *  le vocabulaire d'un état d'IU. Neutralisée comme une collection, pas comme un fichier. */
const UNION_DE_LITTERAUX = /(['"`])[^'"`\n]*\1(\s*\|\s*(['"`])[^'"`\n]*\3)+/g;

/** Neutralisation d'un CHAMP dont le vocabulaire N'EST PAS celui des matières, à l'écriture
 *  (`part: 'pilier'`) comme à la comparaison (`w.scope === 'plan'`) : c'est le NOM DU CHAMP qui est
 *  le signal, jamais le fichier. Chacun a un homonyme au dataset des matières (`pilier`, `plan`). */
const champHorsMatiere = (champs: string) => {
  const ecriture = new RegExp(`\\b(${champs})\\s*:\\s*(['"\`])[^'"\`]*\\2`, 'g');
  const comparaison = new RegExp(`\\b(${champs})\\s*(===|!==|==|!=)\\s*(['"\`])[^'"\`]*\\3`, 'g');
  return (code: string) => code.replace(ecriture, '$1: _').replace(comparaison, '$1 $2 _');
};

type Neutraliseur = { nom: string; applique: (code: string) => string };

/**
 * UNE entrée de neutraliseur PAR CHAMP, produite depuis le VOCABULAIRE de chaque champ : le contrat
 * de vie se juge alors au grain du champ, et un homonyme que plus aucun site n'exerce rougit SEUL.
 * Groupés, quatre champs partageaient un verdict — trois morts passaient sous le vivant.
 */
const neutraliseursDeChamp = (vocabulaires: Record<string, string>): Neutraliseur[] =>
  Object.entries(vocabulaires).map(([champ, vocabulaire]) => ({
    nom: `champ \`${champ}\` (${vocabulaire})`,
    applique: champHorsMatiere(champ),
  }));

const NEUTRALISEURS = neutraliseursDeChamp({ part: 'partie de face' });

/**
 * Le code SEUL, lignes préservées (le rapport porte des `fichier:ligne`) :
 *  - commentaires de bloc et de ligne retirés — une réf en prose n'est pas une émission ;
 *  - chaque NEUTRALISEUR de `NEUTRALISEURS` appliqué à la ligne ; `sauf` en retire UN, et c'est
 *    ainsi que le test de vie mesure ce que chacun blanchit RÉELLEMENT dans le périmètre ;
 *  - les signaux structurels du noyau (`SIGNAUX_STRUCTURELS`), neutralisés sur leur ligne.
 */
function codeSeul(src: string, sauf?: string): string {
  return sansCommentaires(src)
    .split('\n')
    .map((l) => {
      let code = l;
      for (const n of NEUTRALISEURS) if (n.nom !== sauf) code = n.applique(code);
      return LIGNE_STRUCTURELLE.test(code) ? litteraux(code) : code;
    })
    .join('\n');
}

/** Un id CITÉ en littéral (la mesure commune des trois bras). */
const citeId = (id: string) => new RegExp(`(['"\`])${id}\\1`);
/** Une ligne qui CITE en littéral l'id d'une matière, en une seule expression compilée une fois. */
const citeUneMatiere = (ligne: string) => CITE_UNE_MATIERE.test(ligne);
const CITE_UNE_MATIERE = new RegExp(`(['"\`])(?:${materials.map((m) => m.id).join('|')})\\1`);

/** Les MEMBRES littéraux d'une UNION, déclarée (`type X = 'a' | 'b'`) comme écrite en place. */
const membresDUnion = (union: string): string[] => [...union.matchAll(/(['"`])([^'"`\n]*)\1/g)].map((m) => m[2]);

/** Les ids de `terrains.json`, mémoïsés — le registre des sols contre lequel une union se juge. */
const idsTerrain = (() => {
  let vus: Set<string> | null = null;
  return () => (vus ??= new Set(terrains.map((t) => t.id)));
})();

/** CLAUSE PARTAGÉE du bras terrain : une union dont TOUS les membres sont des ids de terrain n'est
 *  pas un vocabulaire propre, c'est une LISTE RÉCITÉE — elle n'entre pas au répertoire
 *  (`vocabulaireDUnion`) et le neutraliseur d'union en place ne la blanchit pas. */
const membresSontTousDesTerrains = (union: string): boolean => {
  const membres = membresDUnion(union);
  return membres.length > 0 && membres.every((v) => idsTerrain().has(v));
};

/**
 * VOCABULAIRE D'UNION déclaré DANS LE FICHIER (`type X = 'a' | 'b' | …`) — le pendant, pour les ids de
 * terrain, de ce que `clesDOnglet` fait des clés d'IU : une valeur qui appartient à un vocabulaire
 * déclaré ici est de CE vocabulaire, pas du registre des sols, et sa lecture (`=== 'vide'`,
 * `capacite: 'porte'`, une table de priorité) est le MÊME signal que sa déclaration.
 *
 * La garde reste fermée sur le cas qui compte : une union dont TOUS les membres sont des ids de
 * terrain n'est pas un vocabulaire propre, c'est une LISTE DE TERRAINS récitée en code — elle
 * n'entre pas dans le répertoire, et la ligne reste comptée.
 */
const vocabulaireDUnion = (src: string): Set<string> => {
  const mots = new Set<string>();
  for (const m of src.matchAll(/\btype\s+\w+\s*=\s*([^;{}]*?);/g)) {
    const membres = membresDUnion(m[1]);
    if (membres.length < 2 || membresSontTousDesTerrains(m[1])) continue;
    for (const v of membres) mots.add(v);
  }
  return mots;
};

/**
 * Les NEUTRALISEURS du bras TERRAIN, chacun NOMMÉ — même contrat que `NEUTRALISEURS` : un neutraliseur
 * que plus aucun site du PÉRIMÈTRE n'exerce est une exemption morte, et le test de vie le rend ROUGE.
 * Aucun nom de fichier, aucune ligne : c'est la FORME qui dit qu'un littéral n'est pas un id de sol.
 *  - le VOCABULAIRE D'UNION déclaré dans le fichier (capacité d'arête, résultat de dépilage…) ;
 *  - une UNION de littéraux ÉCRITE EN PLACE (paramètre, champ) qui porte AU MOINS un membre hors du
 *    registre des sols : elle DÉCLARE un vocabulaire propre, elle n'émet pas. Une union dont TOUS les
 *    membres sont des ids de terrain est une LISTE RÉCITÉE — même clause qu'au répertoire
 *    `vocabulaireDUnion`, et la ligne reste comptée ;
 *  - UNE entrée par CHAMP dont le vocabulaire n'est pas celui des sols (`neutraliseursDeChamp`, la
 *    même fabrique que le bras des matières) — `key` (clé de récap / d'IU), `kind` (type de
 *    SÉLECTION d'un éditeur, `route`), `weather` (météo, `neige`) :
 *    chacun a un homonyme au registre des terrains, et chacun rougit SEUL quand son site meurt.
 */
const NEUTRALISEURS_TERRAIN: readonly { nom: string; applique: (code: string, mots: Set<string>) => string }[] = [
  {
    nom: 'VOCABULAIRE d’union déclaré dans le fichier',
    applique: (code, mots) =>
      mots.size ? code.replace(new RegExp(`(['"\`])(?:${[...mots].map(echappe).join('|')})\\1`, 'g'), (m) => `${m[0]}_${m[0]}`) : code,
  },
  {
    nom: 'UNION de littéraux écrite en place',
    applique: (code) =>
      code.replace(UNION_DE_LITTERAUX, (union) => (membresSontTousDesTerrains(union) ? union : litteraux(union))),
  },
  ...neutraliseursDeChamp({
    key: 'clé de récap / d’IU',
    kind: 'type de sélection d’un éditeur',
    weather: 'météo',
  }),
];

/** Le code d'une couche SANS ses commentaires ni ses homonymes de terrain, lignes préservées. `sauf` en
 *  retire UN neutraliseur — c'est ainsi que le test de vie mesure ce que chacun blanchit RÉELLEMENT. */
function codeHorsTerrain(src: string, sauf?: string): string {
  const mots = vocabulaireDUnion(src);
  return codeNu(src)
    .map((l) => {
      let code = l;
      for (const n of NEUTRALISEURS_TERRAIN) if (n.nom !== sauf) code = n.applique(code, mots);
      return code;
    })
    .join('\n');
}

describe('couches émettrices du monde — aucune matière ni aucun terrain nommé en dur (#1691, #1715, #1716, #1789)', () => {
  const fichiers = detenteur(fichiersDuPerimetre);

  it('le scan couvre les producteurs du noyau et la géométrie du monde (sanity)', () => {
    const chemins = fichiers().map((f) => f.rel);
    expect(chemins, 'la dérivation des masses de toiture et le schéma de scène sont scannés').toEqual(
      expect.arrayContaining([`${NOYAU}/sceneEdit.ts`, `${NOYAU}/monde/scene.ts`]),
    );
    expect(chemins, 'les faces de sol et les triangles du volume sont scannés').toEqual(
      expect.arrayContaining([`${BUILDERS_DU_NOYAU}/floors.ts`, `${BUILDERS_DU_NOYAU}/worldTris.ts`]),
    );
    expect(materials.length).toBeGreaterThan(5);
  });

  it('les HOMONYMES des producteurs du noyau hors volume portent tous un signal STRUCTUREL, et aucun ne survit à la neutralisation', () => {
    const nus: { rel: string; ligne: number; texte: string }[] = [];
    for (const f of fichiers().filter((x) => horsVolume(x.rel))) {
      const sansCommentaires = codeNu(f.code);
      sansCommentaires.forEach((l, i) => {
        if (citeUneMatiere(l))
          nus.push({ rel: f.rel, ligne: i + 1, texte: l });
      });
    }
    expect(nus.length, 'plus aucun homonyme chez les producteurs hors volume : la neutralisation ne prouve plus rien.').toBeGreaterThan(0);
    expect(
      nus.filter((n) => !SIGNAUX_STRUCTURELS.some((s) => s.re.test(n.texte))).map((n) => `${n.rel}:${n.ligne}`),
      `Littéral de matière chez les producteurs hors volume sans signal structurel — signaux connus : ${SIGNAUX_STRUCTURELS.map((s) => s.nom).join(', ')}.`,
    ).toEqual([]);
    for (const s of SIGNAUX_STRUCTURELS)
      expect(nus.some((n) => s.re.test(n.texte)), `le signal « ${s.nom} » n’est plus exercé par aucun site.`).toBe(true);
  });

  /**
   * CONTRAT DE VIE des neutraliseurs — le pendant, pour la table `NEUTRALISEURS`, de ce que
   * `SIGNAUX_STRUCTURELS` exige site par site : un neutraliseur se juge à ce qu'il BLANCHIT
   * RÉELLEMENT. L'attendu est DÉRIVÉ du corpus (aucun nom de fichier ici) : on rejoue le scan en
   * retirant UN neutraliseur, et la différence de littéraux comptés est ce qu'il porte. Zéro
   * différence = exemption morte, à re-trier — pas à garder « au cas où ».
   */
  it('chaque NEUTRALISEUR est exercé par un site du périmètre (aucune exemption morte)', () => {
    for (const n of NEUTRALISEURS) {
      const exerce = fichiers().some((f) => {
        const avec = codeSeul(f.code).split('\n');
        return codeSeul(f.code, n.nom)
          .split('\n')
          .some((l, i) => citeUneMatiere(l) && !citeUneMatiere(avec[i]));
      });
      expect(exerce, `neutraliseur mort : « ${n.nom} » ne blanchit plus aucun site du périmètre — re-trier l’exemption.`).toBe(true);
    }
  });

  /**
   * SECOND BRAS (#1716) — le SOL d’une scène neuve vient de la DONNÉE, jamais du code.
   *
   * Le vocabulaire est DÉRIVÉ, comme celui des matières : la valeur cherchée est
   * `semences-de-scene.json › terrain` elle-même (un id de `terrains.json`, tenu au parse par
   * `idDe('terrain')`) — change la semence au Codex, la garde suit le jour même, sans une ligne.
   *
   * ZÉRO, sans aucune neutralisation : la semence ne se nomme nulle part chez les producteurs scannés, ni
   * en pose (`.fill(…)`, `?? …`, `= …` : c’est la donnée qui la fournit) ni en collection — une
   * collection qui la nommerait serait une liste de terrains récitée en code, la classe de
   * `BARE_GROUND`, que le vocabulaire dérivé de `terrains.json` rend inutile.
   */
  it('la SEMENCE de terrain ne se nomme nulle part : le sol d’une scène neuve vient de la donnée (#1716)', () => {
    const semence = semencesDeScene.terrain.id;
    expect(terrains.some((t) => t.id === semence), `la semence « ${semence} » n’est pas un terrain : la garde mesure un vocabulaire mort.`).toBe(true);
    const cite = (id: string) => new RegExp(`(['"\`])${id}\\1`);
    const fautes: string[] = [];
    for (const f of fichiers()) {
      codeNu(f.code).forEach((l, i) => {
        if (cite(semence).test(l)) fautes.push(`${f.rel}:${i + 1} — « ${semence} »`);
      });
    }
    expect(
      fautes,
      'une couche émettrice NOMME le sol de départ : il vient de `semences-de-scene.json › terrain` ' +
        '(`DEFAULT_TERRAIN`, `noyau/monde/scene.ts`), éditable au Codex — jamais d’un littéral.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });

  /**
   * TROISIÈME BRAS (#1716) — le SCHÉMA du monde ne récite aucun terrain.
   *
   * Vocabulaire DÉRIVÉ, comme les deux autres : la liste cherchée est `terrains.json › id` ENTIÈRE —
   * un terrain déposé demain au Codex est gardé le jour même, sans une ligne ici. La moitié
   * « matière » de la clause est tenue par le bras des ids de `materials.json` ci-dessous, qui scanne
   * le même périmètre.
   *
   * Les HOMONYMES (`porte` capacité d’arête, `vide` résultat de dépilage, `neige` météo, `bois`
   * cargaison, `route` clé de récap et type de SÉLECTION d’éditeur) sont neutralisés par FORME
   * (`NEUTRALISEURS_TERRAIN`) : vocabulaire d’union déclaré dans le fichier, union écrite en place,
   * nom de champ. AUCUN site toléré, aucune liste d’exemption, aucun nom de fichier :
   * le stock mesuré est vide.
   *
   * Périmètre : le même corpus `fichiers` que le scan des matières (#1789).
   */
  it('aucune couche émettrice du noyau ne porte un id de terrain en littéral (#1716, #1789)', () => {
    const ids = terrains.map((t) => t.id);
    expect(ids.length, 'vocabulaire de terrains VIDE : la garde mesurerait le néant.').toBeGreaterThan(0);
    const fautes: string[] = [];
    for (const f of fichiers()) {
      codeHorsTerrain(f.code).split('\n').forEach((l, i) => {
        for (const id of ids) if (citeId(id).test(l)) fautes.push(`${f.rel}:${i + 1} — « ${id} »`);
      });
    }
    expect(
      fautes,
      'une couche émettrice NOMME un terrain : le porteur d’un rôle se demande au dataset ' +
        '(`terrainAbsent`/`terrainHorsGrille`, `noyau/monde/terrain`), une semence vient de ' +
        '`semences-de-scene.json` et un défaut de compilateur de `defauts-de-compilation.json` — ' +
        'jamais d’un littéral. En couche de RENDU ou d’IU, le terrain se LIT sur la tuile ou sur le ' +
        '`MaterialRef` reçu, se DÉRIVE de `terrains` / `terrainsAvecGlyphe`, ou se demande au dataset ' +
        'PAR RÔLE — jamais choisi en code.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });

  /**
   * CONTRAT DE VIE des neutraliseurs du bras TERRAIN — même mesure que pour les matières, sur le MÊME
   * périmètre : on rejoue le scan du corpus en retirant UN neutraliseur, et la différence d'ids
   * comptés est ce qu'il porte.
   */
  it('chaque neutraliseur du bras TERRAIN est exercé par un site du périmètre (aucune exemption morte)', { timeout: 30_000 }, () => {
    const ids = terrains.map((t) => t.id);
    const cite = (l: string) => ids.some((id) => citeId(id).test(l));
    for (const n of NEUTRALISEURS_TERRAIN) {
      const exerce = fichiers().some((f) => {
        const avec = codeHorsTerrain(f.code).split('\n');
        return codeHorsTerrain(f.code, n.nom)
          .split('\n')
          .some((l, i) => cite(l) && !cite(avec[i]));
      });
      expect(exerce, `neutraliseur mort : « ${n.nom} » ne blanchit plus aucun site du périmètre — re-trier l’exemption.`).toBe(true);
    }
  });

  /**
   * SONDE de la CLAUSE d'union (#1789) — mesurée sur des sources SYNTHÉTIQUES, vocabulaire tiré du
   * dataset (aucun id récité ici) : une union dont TOUS les membres sont des sols est une LISTE
   * RÉCITÉE et reste comptée ; un SEUL membre hors registre en fait un vocabulaire propre, blanchi.
   */
  it('une union TOUT-TERRAIN reste comptée, une union à membre hors registre est blanchie', () => {
    const ids = terrains.map((t) => t.id);
    expect(ids.length, 'moins de deux terrains : la sonde d’union ne mesure rien.').toBeGreaterThan(1);
    const [a, b] = ids;
    const horsRegistre = 'hors-registre-des-sols';
    expect(ids).not.toContain(horsRegistre);
    const compte = (src: string) =>
      codeHorsTerrain(src)
        .split('\n')
        .filter((l) => ids.some((id) => citeId(id).test(l))).length;
    expect(
      compte(`type Sol = '${a}' | '${b}';`),
      `liste de terrains récitée blanchie : « ${a} | ${b} » n’est pas un vocabulaire propre, elle doit rester comptée.`,
    ).toBe(1);
    expect(
      compte(`function f(x: '${horsRegistre}' | '${a}') {}`),
      'une union qui porte un membre hors du registre des sols DÉCLARE un vocabulaire : elle se blanchit.',
    ).toBe(0);
  });

  /**
   * SONDE de la COUPE des commentaires (#1789) — elle balaie les CHAÎNES : un `//` à l'intérieur d'un
   * littéral (`'http://x'`) n'est pas un début de commentaire. Une coupe naïve à `indexOf('//')`
   * tronquerait la ligne AVANT la mesure et rendrait AVEUGLE tout ce qui suit l'URL sur cette ligne :
   * angle mort des DEUX bras, puisque `codeNu` est leur mesure commune. Vocabulaire tiré du dataset.
   */
  it('la coupe des commentaires préserve les CHAÎNES : un `//` dans un littéral n’aveugle pas la ligne', () => {
    const [sol] = terrains.map((t) => t.id);
    const compte = (src: string) =>
      codeHorsTerrain(src)
        .split('\n')
        .filter((l) => citeId(sol).test(l)).length;
    expect(compte(`const u = 'http://x'; // '${sol}'`), 'un id CITÉ EN COMMENTAIRE est une réf en prose, jamais une émission.').toBe(0);
    expect(compte(`const t = '${sol}'; // ok`), 'un id émis en CODE reste compté, commentaire ou pas.').toBe(1);
    expect(
      compte(`const a = 'http://x', b = '${sol}';`),
      'littéral APRÈS une URL sur la même ligne : une coupe naïve à `//` tronquerait avant la mesure et l’émission passerait.',
    ).toBe(1);
  });

  it('la neutralisation est structurelle : comparer une partie laisse visible une comparaison de matière', () => {
    const sol = fichiers().find((f) => f.rel === `${BUILDERS_DU_NOYAU}/floors.ts`);
    const homonyme = materials.find(({ id }) => sol?.code.includes(`part: '${id}'`));
    expect(homonyme, 'la géométrie du sol fournit un homonyme de matière pour le champ part').toBeDefined();
    const id = homonyme!.id;
    expect(citeUneMatiere(codeSeul(`face.part === '${id}'`))).toBe(false);
    expect(citeUneMatiere(codeSeul(`face.material === '${id}'`))).toBe(true);
  });

  it('aucun id de `materials.json` n’apparaît en littéral dans les couches émettrices', () => {
    const fautes: string[] = [];
    for (const f of fichiers()) {
      const code = codeSeul(f.code);
      const lignes = code.split('\n');
      for (const m of materials) {
        const re = new RegExp(`(['"\`])${m.id}\\1`);
        lignes.forEach((l, i) => {
          if (re.test(l)) fautes.push(`${f.rel}:${i + 1} — « ${m.id} » (domaine ${m.domain})`);
        });
      }
    }
    expect(
      fautes,
      'une couche émettrice NOMME une matière : la matière d’une face vient de la DONNÉE (scène `reliefDefaults`, ' +
        'terrain `matiere`, bâtiment `roofMaterial`, masse de toit `material`, recette de décor `primitive.material`), jamais du code.\n  ' +
        fautes.join('\n  '),
    ).toEqual([]);
  });
});

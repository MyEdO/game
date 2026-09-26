/**
 * GARDE DE GRAMMAIRE (#1466 L1a) — les formes de la grammaire ne se re-tapent pas, et les portes
 * ne s'étendent pas.
 *
 * Une forme écrite dans `schemas/grammaire/` (référence, source, dé, quantité, apparence…) est la
 * SEULE graphie de son concept. Un littéral `z.object`/`z.strictObject`/`z.looseObject` qui en
 * recouvre la signature ailleurs est une seconde graphie — c'est exactement ce que le dénominateur
 * L0 du chantier (`STRUCTURES_REDECLARATIONS`) mesure côté donnée. Et un `.extend(` posé sur une
 * porte de la grammaire lui fait PERDRE son registre et sa `.meta()` (zod 4.4.3, cf. en-tête de
 * `grammaire/ref.ts`) : la porte étendue n'est plus la porte.
 *
 * Le VOCABULAIRE n'est pas recopié ici : il est DÉRIVÉ par introspection des schémas eux-mêmes
 * (`valeurs.ts`, `reference.ts`, fabriques de `ref.ts`) — une signature qui change change la garde.
 *
 * En-tête structuré `GARDE` (#1475) : la garde se déclare elle-même, et un test tient cette
 * déclaration — angles morts compris.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { envDeDepotForge } from '../../scripts/guards/lib/depotGabarit.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { neufsDe } from '../../scripts/migrations/replay.mjs';
import { scan } from '../../scripts/guards/lib/grammaireGuard.mjs';
import { GRAMMAIRE_STOCK } from '../../scripts/guards/lib/grammaireStock.mjs';
import { ecartsDeStock } from '../../scripts/guards/lib/stock.mjs';
import { defDe, enfantsDe, PROFONDEUR_MAX } from './schemas/grammaire/slots';
import * as valeurs from './schemas/grammaire/valeurs';
import * as reference from './schemas/grammaire/reference';
import { ref, specRef, pick, typedRef } from './schemas/grammaire/ref';
import { qualityRefSchema } from './schemas/grammaire/reference';

const GARDE = {
  question:
    'A — quelles FORMES de la grammaire sont re-tapées ailleurs (littéral zod dont le jeu de clés EST ' +
    'une signature déjà écrite, ou qui porte une graphie historique de référence) ? B — quelle PORTE de ' +
    'la grammaire est ÉTENDUE (`.extend` : zod 4.4.3 perd registre et `.meta()`) ? C — la liste ne ' +
    'peut-elle que DÉCROÎTRE (aucun site hors stock, aucune entrée sans site) ?',
  primitive:
    'AST TypeScript (`scripts/guards/lib/grammaireGuard.mjs`, `scan(rel, contenu, regles)`) sur le corpus ' +
    'de `readCorpus` (`sourceCorpus.mjs`) — jamais une regex de ligne. Les RÈGLES (signatures, alias) sont ' +
    'DÉRIVÉES par introspection des schémas de la grammaire, jamais recopiées.',
  perimetre:
    'les `*.ts` de PRODUCTION de `src/data/schemas/defs/`, `src/data/schemas/defs-scenes/` et `src/state/` ' +
    '(redéclarations + `.extend`), plus `src/data/schemas/grammaire/` pour le seul `.extend` — les littéraux ' +
    'de la grammaire SONT le canon, ils ne le redéclarent pas.',
  angleMort: [
    'le volet `redeclaration` exige l’ÉGALITÉ des jeux de clés : un littéral qui ne recopie qu’une PARTIE ' +
      'd’une forme (`{n, sides}` sans `plus`), ou qui la recopie CHARGÉE d’une charge utile (un document ' +
      'porteur de `id` + `type`), n’est pas vu — ces deux cas sont mesurés côté DONNÉE par ' +
      '`STRUCTURES_REDECLARATIONS` (signature projetée, `+…`), pas ici.',
    'les signatures à UNE seule clé (`{fixed}`, `{roll}`, `{dice}`, `{wildcard}`) sont écartées du volet ' +
      '`redeclaration` : elles collisionneraient avec tout champ homonyme. Les graphies de référence à une ' +
      'clé sont tenues par le volet `alias` à la place.',
    'un littéral portant un SPREAD (`...scheduleShape`) est HORS du volet `redeclaration` : son jeu de clés ' +
      'réel n’est pas lisible à l’AST, l’égalité y serait fausse dans les deux sens. Le volet `alias`, lui, ' +
      'reste rendu sur les clés ÉCRITES.',
    'une VARIANTE de discriminée (un littéral portant un `z.literal(…)`) est hors du volet `redeclaration` : ' +
      'son `type`/`kind` nomme la variante, pas le type d’une entité — une référence re-tapée DANS une variante ' +
      'reste vue par le volet `alias`, mais la forme `{id, type}` d’un effet n’est pas comptée comme `typedRef`.',
    'un schéma construit DYNAMIQUEMENT (fabrique qui reçoit sa `shape` en paramètre, `z.object(shape)` sans ' +
      'littéral) est invisible : le scan lit une FORME écrite, pas un objet calculé au chargement.',
    'le récepteur d’un `.extend` n’est reconnu que s’il est un IDENTIFIANT importé d’un module de grammaire ' +
      '(ou une const locale en `…Schema` d’un module de grammaire) : `picked.partial().extend(…)` dans une ' +
      'fabrique générique (`variantOf`, `valeurs.ts`) échappe au scan, son récepteur étant un paramètre.',
    'le périmètre est celui de l’invariant (defs, defs-scenes, state, + grammaire pour `.extend`) : une ' +
      'redéclaration posée dans `src/engine/**` ou `src/ui/**` est HORS garde.',
    'un symbole DÉPLACÉ vers `src/data/schemas/grammaire/` y perd ses trouvailles `alias` sans qu’aucune ' +
      'graphie n’ait bougé : la graphie de la grammaire EST le canon (`PERIMETRE_FABRIQUES`, scanné ' +
      '`sansRedeclaration`), donc sa ligne de stock devient périmée par SORTIE DE PÉRIMÈTRE et non par ' +
      'solde — c’est une perte de COUVERTURE, du même genre que celle qu’avait produite l’adoption de ' +
      '`document()` (#1467 L1b V-FLIP-ENTITE-b). Les `alias` que `scan(…, sansRedeclaration: false)` relève ' +
      'dans la grammaire sont hors stock par construction ; ils sont ÉNUMÉRÉS et comptés par le test ' +
      '« les graphies de la grammaire sont hors stock par construction », qui rougit si l’un naît ou meurt.',
  ],
  baseline: {
    fichier: 'scripts/guards/lib/grammaireStock.mjs',
    decroissant: true,
    raison:
      'Le stock initial est le RELEVÉ du 2026-08-25, lot par lot : chaque entrée meurt par le commit qui ' +
      'fait ADOPTER la forme de la grammaire à son site (lots L2/L3/L4 #1463, L1a #1466 pour les portes ' +
      'étendues). Une entrée neuve est une dérive, jamais une exception à inscrire.',
  },
  ticket: '#1466',
} as const;

/** Périmètre des DEUX volets (redéclaration + `.extend`). */
const PERIMETRE = ['src/data/schemas/defs', 'src/data/schemas/defs-scenes', 'src/state'];
/** Périmètre du seul volet `.extend` — les littéraux de la grammaire SONT le canon. */
const PERIMETRE_FABRIQUES = ['src/data/schemas/grammaire'];

/**
 * Signatures d'objet DÉCLARÉES par la grammaire, dérivées par marche des schémas (`enfantsDe`, la
 * descente unique) : chaque nœud `object` rencontré donne le jeu de ses clés, nommé par les symboles
 * exportés qui le portent. Aucune liste de clés n'est écrite à la main.
 *
 * Un même jeu de clés est porté par PLUSIEURS schémas (`{n,plus,sides}` → 4 candidats,
 * `{id,spec}` → 2) : le `nom` d'une signature est donc la liste TRIÉE de TOUS ses porteurs, jointe
 * par `|`. Retenir un seul candidat rendrait le `detail` du stock tributaire de l'ordre des exports
 * (un `Map` premier-arrivé), et retenir le premier ALPHABÉTIQUE désignerait un canon FAUX
 * (`{book,note,page}` s'annoncerait `castingNumberModSchema` plutôt que `sourceRefSchema`). La
 * liste complète est à la fois déterministe et vraie ; la raison de chaque entrée du stock nomme,
 * elle, le schéma COMMUN visé par l'adoption.
 *
 * @param melanger permet de rejouer la dérivation dans un AUTRE ordre d'exports (preuve de stabilité).
 */
function signaturesDeLaGrammaire(
  melanger: (entrees: [string, unknown][]) => [string, unknown][] = (entrees) => entrees,
): { nom: string; cles: string[] }[] {
  const out = new Map<string, { noms: Set<string>; cles: string[] }>();
  const marcher = (noeud: unknown, nom: string, ancetres: ReadonlySet<unknown>, profondeur: number): void => {
    if (!noeud || typeof noeud !== 'object' || ancetres.has(noeud) || profondeur > PROFONDEUR_MAX) return;
    const def = defDe(noeud);
    if (!def) return;
    if (def.type === 'object' && def.shape) {
      const cles = Object.keys(def.shape);
      if (cles.length >= 2) {
        const cle = cles.slice().sort().join(',');
        const porteurs = out.get(cle) ?? { noms: new Set<string>(), cles };
        porteurs.noms.add(nom);
        out.set(cle, porteurs);
      }
    }
    const pile = new Set(ancetres).add(noeud);
    for (const e of enfantsDe(def)) marcher(e.noeud, nom, pile, profondeur + 1);
  };
  const sources: Record<string, unknown> = { ...valeurs, ...reference };
  for (const [nom, v] of melanger(Object.entries(sources))) if (defDe(v)) marcher(v, nom, new Set(), 0);
  // Les fabriques FERMÉES de `ref.ts` ne rendent leur forme qu'APPELÉES : la signature cible
  // (`{id, spec, choix}`, `{pick, of}`…) est le canon que toute réf re-tapée recouvre.
  const fabriques: [string, unknown][] = [
    ['ref()', ref('skill')],
    ['specRef()', specRef('skill')],
    ['pick()', pick('skill')],
    ['typedRef()', typedRef()],
  ];
  for (const [nom, v] of melanger(fabriques)) marcher(v, nom, new Set(), 0);
  return [...out.values()].map(({ noms, cles }) => ({ nom: [...noms].sort().join('|'), cles }));
}

/** GRAPHIES HISTORIQUES de référence (invariant #1466, corps du ticket) : une clé qui désigne une
 *  entité sous son ancien nom, là où la grammaire écrit `ref(type)`. */
const ALIAS = ['skillId', 'talentId', 'trappingId', 'traitId', 'skill', 'ref', 'wildcard', 'specOptions'];

/** Toutes les trouvailles du périmètre, clé `<fichier>:<symbole>[.<champ>]|<motif>|<detail>`. */
function trouvailles(): { cle: string; ligne: number }[] {
  const regles = { signatures: signaturesDeLaGrammaire(), alias: ALIAS };
  const out: { cle: string; ligne: number }[] = [];
  const relever = (fichiers: readonly { rel: string; text: string }[], sansRedeclaration: boolean) => {
    for (const f of fichiers)
      for (const t of scan(f.rel, f.text, { ...regles, sansRedeclaration }))
        out.push({ cle: `${f.rel}:${t.symbole}${t.champ ? '.' + t.champ : ''}|${t.motif}|${t.detail}`, ligne: t.ligne });
  };
  relever(readCorpus(PERIMETRE), false);
  relever(readCorpus(PERIMETRE_FABRIQUES), true);
  return out;
}

describe('garde de grammaire — en-tête structuré (#1475)', () => {
  it('la garde se déclare : question A→B→C, primitive, périmètre, angles morts, baseline décroissante, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('grammaireGuard.mjs');
    expect(GARDE.perimetre).toContain('defs-scenes');
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(6);
    expect(
      GARDE.angleMort.some((a) => /SPREAD/.test(a)),
      'l’angle mort du SPREAD doit être déclaré nommément.',
    ).toBe(true);
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/grammaireStock.mjs', decroissant: true });
    expect(GARDE.ticket).toBe('#1466');
  });
});

describe('vocabulaire de la grammaire — DÉRIVÉ des schémas, jamais recopié', () => {
  const signatures = signaturesDeLaGrammaire();

  it('l’introspection VOIT les formes canoniques (une dérivation muette rendrait la garde vacueuse)', () => {
    expect(signatures.length).toBeGreaterThan(10);
    const parCles = new Set(signatures.map((s) => s.cles.slice().sort().join(',')));
    for (const attendue of ['id,spec', 'book,note,page', 'n,plus,sides', 'x,y'])
      expect(parCles, `signature canonique « ${attendue} » perdue par l’introspection.`).toContain(attendue);
  });

  it('le detail d’une signature à 2 candidats est STABLE quel que soit l’ordre des exports', () => {
    const detailParCles = (l: { nom: string; cles: string[] }[]) =>
      new Map(l.map((s) => [s.cles.slice().sort().join(','), s.nom]));
    const direct = detailParCles(signaturesDeLaGrammaire());
    const inverse = detailParCles(signaturesDeLaGrammaire((e) => [...e].reverse()));
    expect(inverse, 'le `detail` du stock dépendrait de l’ordre des exports — une entrée rougirait sans qu’aucune forme n’ait changé.').toEqual(direct);

    // Sans signature HOMONYME, l’assertion ci-dessus serait vacueuse : on mesure qu’il y en a.
    const homonymes = [...direct.values()].filter((nom) => nom.includes('|'));
    expect(homonymes.length, 'aucune signature à 2+ porteurs : le test de stabilité ne mesure plus rien.').toBeGreaterThanOrEqual(3);
  });
});

describe('rejeu des migrations — le verdict VOIT le fichier NEUF (#1466 T3bis-a)', () => {
  it('`neufsDe` rend les `??` d’un VRAI dépôt, et ni le suivi ni le modifié', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'replay-neufs-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: tmp, env: envDeDepotForge(), stdio: 'pipe' });
    git('init', '-q');
    writeFileSync(join(tmp, 'suivi.json'), '{}');
    git('add', 'suivi.json');
    git('-c', 'user.email=g@g', '-c', 'user.name=g', 'commit', '-qm', 'base');

    expect(neufsDe(tmp, ['.']), 'un arbre propre n’a aucun fichier neuf.').toEqual([]);

    writeFileSync(join(tmp, 'suivi.json'), '{"a":1}');
    expect(neufsDe(tmp, ['.']), 'un fichier MODIFIÉ est vu par `git diff`, pas par ce volet.').toEqual([]);

    writeFileSync(join(tmp, 'neuf.json'), '{}');
    expect(neufsDe(tmp, ['.']), 'un fichier CRÉÉ est invisible à `git diff` : c’est CE volet qui le nomme.').toEqual(['neuf.json']);
  });
});

/**
 * `qualityRefSchema` — une référence d'Atout/Défaut est `{id, value?}` et RIEN d'autre. Ce que le livre
 * imprime entre parenthèses est une MAGNITUDE (`AA 08 l.87` « Taillade (XA) », l.136 « Taillade (1A) »),
 * pas une spécialisation : elle vit en `value`, et sa FORME d'affichage est déclarée par la qualité
 * (`QualityData.indice.unite`). La clé `spec` était une seconde graphie de la même chose ; le verrou est
 * ICI, au parse, pour qu'aucune donnée ne puisse la reposer en silence (#1661).
 */
describe('`qualityRefSchema` — `{id, value?}` : la MAGNITUDE est une valeur, jamais une `spec`', () => {
  it('`spec` est REFUSÉE au parse, et le refus NOMME la clé', () => {
    const r = qualityRefSchema.safeParse({ id: 'taillade', spec: '1A' });
    expect(r.success, 'une réf de qualité à `spec` passe encore : la graphie parallèle peut revenir en donnée.').toBe(false);
    expect(
      r.success ? '' : JSON.stringify(r.error.issues),
      'le refus ne nomme pas `spec` — un auteur ne saurait pas quoi corriger.',
    ).toContain('spec');
    expect(qualityRefSchema.safeParse({ id: 'taillade', spec: '1A', value: 1 }).success, '`spec` reste refusée même accompagnée de `value`.').toBe(false);
  });

  it('les formes LÉGITIMES passent — id seul, id + Indice', () => {
    expect(qualityRefSchema.safeParse({ id: 'tranchante' }).success, 'une qualité sans Indice doit passer.').toBe(true);
    expect(qualityRefSchema.safeParse({ id: 'taillade', value: 2 }).success, 'la forme PLEINE `{id, value}` doit passer.').toBe(true);
  });

  it('les 3 refus STRUCTURELS tiennent — `strictObject` n’est pas perdu', () => {
    expect(qualityRefSchema.safeParse({ id: 'a', extra: 1 }).success, 'clé EN TROP acceptée : le `strict` est tombé.').toBe(false);
    expect(qualityRefSchema.safeParse({ value: 3 }).success, '`id` MANQUANT accepté.').toBe(false);
    expect(qualityRefSchema.safeParse({ id: 'a', value: 'x' }).success, '`value` NON NUMÉRIQUE accepté.').toBe(false);
  });
});

describe('formes re-tapées et portes étendues — stock nominatif daté, DÉCROISSANT', () => {
  const sites = trouvailles();
  const ecarts = ecartsDeStock({
    observe: sites,
    stock: Object.keys(GRAMMAIRE_STOCK).map((cle) => ({ cle })),
    cle: (s) => s.cle,
    remede: { neuve: (cle, s) => `${cle} (ligne ${s.ligne})` },
  });

  it('le scan VOIT des sites (un scan aveugle rendrait le cliquet vacueux)', () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it('AUCUN site hors stock — une graphie neuve est ROUGE et NOMMÉE', () => {
    expect(
      ecarts.neuves,
      `Site(s) de grammaire non déclaré(s) dans GRAMMAIRE_STOCK :\n${ecarts.neuves.join('\n')}`,
    ).toEqual([]);
  });

  it('AUCUNE entrée sans site — le stock ne peut que DÉCROÎTRE', () => {
    expect(
      ecarts.perimees,
      `Entrée(s) de GRAMMAIRE_STOCK sans site correspondant :\n${ecarts.perimees.join('\n')}`,
    ).toEqual([]);
  });

  // La grammaire n'est scannée que pour `.extend` : ses graphies de référence sont le CANON. Ce test
  // REND cette perte de couverture VISIBLE et CHIFFRÉE — sans lui, un symbole déplacé vers la grammaire
  // sortirait du stock en silence, et le cliquet décroissant lirait une évasion comme un solde.
  it('les graphies de la grammaire sont hors stock par construction — la liste est NOMMÉE et son cardinal TENU', () => {
    const regles = { signatures: signaturesDeLaGrammaire(), alias: ALIAS };
    const dansLaGrammaire = readCorpus(PERIMETRE_FABRIQUES)
      .flatMap((f) => scan(f.rel, f.text, { ...regles, sansRedeclaration: false }).map((t) => ({ f, t })))
      .filter(({ t }) => t.motif === 'alias')
      .map(({ f, t }) => `${f.rel}:${t.symbole}${t.champ ? '.' + t.champ : ''}|${t.detail}`)
      .sort();
    expect(dansLaGrammaire).toEqual([
      'src/data/schemas/grammaire/mecanique.ts:OP_DEFS.corruptionExposure|skill',
      // `domeWard` est une op TYPÉE (`OP_DEFS`, #1508 T3 G0) : le Trait que le dôme octroie se nomme par
      // la graphie CANONIQUE d'un octroi (`traitId`), la même que `removeTrait` — d'où la ligne ici.
      'src/data/schemas/grammaire/mecanique.ts:OP_DEFS.domeWard|traitId',
      // `giveTrapping` est une op TYPÉE (`OP_DEFS`, #1903) : l'objet se nomme par `trappingId`, la graphie de
      // `GameOp` (`src/engine/ops.ts`) et de `conditionSchema`.
      'src/data/schemas/grammaire/mecanique.ts:OP_DEFS.giveTrapping|trappingId',
      'src/data/schemas/grammaire/mecanique.ts:OP_DEFS.removeTrait|traitId',
      // `summon` est une op TYPÉE (#1882) : la créature invoquée se nomme par le champ `ref` du moteur
      // (`engine/ops.ts`), tenu par `idDe('creature')`.
      'src/data/schemas/grammaire/mecanique.ts:OP_DEFS.summon|ref',
      'src/data/schemas/grammaire/mecanique.ts:conditionSchema|trappingId',
      'src/data/schemas/grammaire/mecanique.ts:extendedTestSchema|skill',
      'src/data/schemas/grammaire/mecanique.ts:flowTestSchema|skill',
      'src/data/schemas/grammaire/mecanique.ts:travelTableEntrySchema.mount.riderTest|skill',
      'src/data/schemas/grammaire/reference.ts:trappingRefSchema|wildcard',
    ]);
    const auStock = dansLaGrammaire.filter((cle) => cle in GRAMMAIRE_STOCK);
    expect(auStock, `Graphie(s) de la grammaire inscrite(s) au stock, qui ne l'y verra jamais : ${auStock.join(', ')}`).toEqual([]);
  });

  it('chaque entrée porte son LOT de mort et sa DATE (une liste sans échéance est un régime)', () => {
    const muettes = Object.entries(GRAMMAIRE_STOCK)
      .filter(([, v]) => !/^L[1234][a-d]? #14\d\d$/.test(v.lot) || v.date !== '2026-08-25')
      .map(([k, v]) => `${k} → lot « ${v.lot} », date « ${v.date} »`);
    expect(muettes, `Entrée(s) sans lot à la graphie du stock ou sans date :\n${muettes.join('\n')}`).toEqual([]);
  });
});

describe('la garde elle-même — jouée sur un fichier-jouet (preuve de câblage)', () => {
  const regles = { signatures: signaturesDeLaGrammaire(), alias: ALIAS };

  it('une redéclaration de `{id, spec}`, une graphie `skillId` et un `.extend` de porte SORTENT', () => {
    const jouet = [
      "import { z } from 'zod';",
      "import { refSchema } from '../grammaire/reference';",
      'export const aSchema = z.strictObject({ id: z.string(), spec: z.string().optional() });',
      'export const bSchema = z.strictObject({ skillId: z.string(), niveau: z.number() });',
      'export const cSchema = refSchema.extend({ value: z.number() });',
    ].join('\n');
    const motifs = scan('src/data/schemas/defs/jouet.ts', jouet, regles).map((t) => `${t.symbole}|${t.motif}`);
    expect(motifs).toContain('aSchema|redeclaration');
    expect(motifs).toContain('bSchema|alias');
    expect(motifs).toContain('cSchema|extend');
  });

  // #1467 L1b V-FLIP-ENTITE-b — la fabrique `document()` passe ses CHAMPS en 3ᵉ argument, sans
  // fabrique zod autour. Tant que le scan ne visitait que `z.object`/`z.strictObject`/`z.looseObject`,
  // l'adoption FAISAIT DISPARAÎTRE les trouvailles d'un def : perte de COUVERTURE que le cliquet
  // décroissant lisait comme un solde. Les deux graphies réelles de `champs` sont couvertes.
  it('les CHAMPS passés à `document()` sont scannés — littéral INLINE', () => {
    const jouet = [
      "import { z } from 'zod';",
      "import { document } from '../grammaire/document';",
      "const doc = document('jouet', 'entite', { skillId: z.string(), niveau: z.number() }, { skillId: { label: 'X' }, niveau: { label: 'Y' } }, EXPO);",
      '',
    ].join('\n');
    const motifs = scan('src/data/schemas/defs/jouet.ts', jouet, regles).map((t) => `${t.symbole}|${t.motif}|${t.detail}`);
    expect(motifs).toEqual(['doc|alias|skillId']);
  });

  it('les CHAMPS passés à `document()` sont scannés — const NOMMÉE référencée', () => {
    const jouet = [
      "import { z } from 'zod';",
      "import { document } from '../grammaire/document';",
      'const champs = { skillId: z.string(), niveau: z.number() };',
      "const doc = document('jouet', 'entite', champs, { skillId: { label: 'X' }, niveau: { label: 'Y' } }, EXPO);",
      '',
    ].join('\n');
    const motifs = scan('src/data/schemas/defs/jouet.ts', jouet, regles).map((t) => `${t.symbole}|${t.motif}|${t.detail}`);
    expect(motifs).toEqual(['champs|alias|skillId']);
  });

  it('les autres arguments de `document()` ne sont PAS scannés — seule la 3ᵉ position porte les champs', () => {
    // `meta` (4ᵉ) porte des libellés, pas des schémas : une clé y nommant une graphie historique
    // n'est pas une forme re-tapée. Le scan ne doit pas la relever.
    const jouet = [
      "import { z } from 'zod';",
      "import { document } from '../grammaire/document';",
      "const doc = document('jouet', 'entite', { niveau: z.number() }, { niveau: { label: 'skillId' } }, EXPO);",
      '',
    ].join('\n');
    expect(scan('src/data/schemas/defs/jouet.ts', jouet, regles)).toEqual([]);
  });

  it('un littéral SANS forme de la grammaire ne sort pas (le scan ne rougit pas au hasard)', () => {
    const sain = "import { z } from 'zod';\nexport const dSchema = z.strictObject({ titre: z.string(), poids: z.number() });\n";
    expect(scan('src/data/schemas/defs/sain.ts', sain, regles)).toEqual([]);
  });
});

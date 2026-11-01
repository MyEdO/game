import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  orphelinesMesurees, buildConsumerCorpus, isConsumed, sceneConsumerCorpus, EXCLUDED_CATEGORY_FILES, regenerations,
  CATEGORY_FILES, clesDObjet,
} from '../../scripts/guards/lib/entityConsumers.mjs';
import { ENTITY_ORPHAN_RATCHET } from '../../scripts/guards/lib/entityOrphanStock.mjs';
import { cleDeSite, ecartDuVolet, remedeNomme } from '../../scripts/guards/lib/stock.mjs';
import { ecartDeRegeneration, texteEnPlace } from '../../scripts/guards/lib/stockDeSites.mjs';

/**
 * Cliquet décroissant des entités de catalogue SANS CONSOMMATEUR (généralise `tables.json`/#734 à
 * `traits`/`talents`/`qualities`/`maneuvers`/`skills`/`props`/`vehicles`/`creatures` — périmètre
 * retenu/écarté, définition d'un consommateur, angles morts déclarés : cf. l'en-tête de
 * `scripts/docs/build-entity-orphans.mjs`). Rapport généré : `docs/orphelines-donnees.md`.
 *
 * UN SEUL contrat, dans les DEUX sens : l'écart nominatif au stock (`ecartDuVolet`,
 * `scripts/guards/lib/stock.mjs`). Aucun PLAFOND, aucun compte de FAMILLE par livre : ce qu'une
 * dette ne peut pas faire, c'est croître SANS SE DÉCLARER, et c'est l'entrée `{ fichier, ref,
 * occurrence }` — qui NOMME le dataset à ouvrir — que la porte de plage (`croissanceDesStocks`) voit
 * à l'append. Un compte, lui, lui est invisible, et laisse en plus passer la SUBSTITUTION.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = `${ROOT}src/data`;
const SRC_DIR = `${ROOT}src`;
const STOCK = 'scripts/guards/lib/entityOrphanStock.mjs';

describe('cliquet — toute entité de catalogue retenu a un CONSOMMATEUR (curée, non atteinte = dette)', () => {
  const sites = orphelinesMesurees(DATA_DIR, SRC_DIR);
  const { neuves, perimees } = ecartDuVolet({ sites, stock: ENTITY_ORPHAN_RATCHET, ou: STOCK });

  it('aucune entité NEUVE sans consommateur hors du stock — câbler, jamais stocker', () => {
    expect(neuves, `entité(s) NEUVE(s) sans consommateur — câbler (donnée qui la référence, ou code) :\n${neuves.join('\n')}`).toEqual([]);
  });

  it('le stock cliqueté ne peut que DÉCROÎTRE — toute entrée désormais consommée en sort', () => {
    expect(perimees, `entrée(s) du stock désormais consommée(s) — retirer leur ligne (ou :\n` +
      `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/entityConsumers.mjs) :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('le stock committé est un point fixe de sa régénération', () => {
    for (const r of regenerations(sites)) expect(ecartDeRegeneration(r, texteEnPlace(r.chemin))).toBeNull();
  });

  it("chaque entrée NOMME le dataset où l'entité est déclarée — c'est ce que la porte de plage voit", () => {
    const muettes = ENTITY_ORPHAN_RATCHET.filter((e) => !/^src\/data\/[a-z]+\.json$/.test(e.fichier));
    expect(muettes, `Entrées dont le \`fichier\` n'est pas un chemin de dataset : elles seraient INVISIBLES\n` +
      `à \`croissanceDesStocks\`, et un append ne coûterait rien :\n  ${JSON.stringify(muettes)}`).toEqual([]);
  });

  /** SUBSTITUTION à compte constant — une orpheline câblée pendant qu'une autre naît. Un contrat qui
   *  COMPTE (plafond, ligne-famille `(catalogue, livre) + max`) rend VERT sur ce cas ; l'écart
   *  nominatif le voit des DEUX côtés. Forgé EN MÉMOIRE, le stock du disque n'est jamais touché. */
  it('une SUBSTITUTION à compte CONSTANT rougit : la découverte est neuve, la bidon est périmée', () => {
    const substitue = [
      ...ENTITY_ORPHAN_RATCHET.slice(1),
      { fichier: 'src/data/creatures.json', ref: 'creature-qui-n-existe-pas', occurrence: 1 },
    ];
    expect(substitue, 'la forge doit rester à taille CONSTANTE, sinon elle ne prouve rien')
      .toHaveLength(ENTITY_ORPHAN_RATCHET.length);
    const ecart = ecartDuVolet({ sites, stock: substitue, ou: STOCK });
    expect(remedeNomme(ecart.neuves, cleDeSite(ENTITY_ORPHAN_RATCHET[0])), 'la découverte doit ressortir NEUVE').toBe(true);
    expect(remedeNomme(ecart.perimees, cleDeSite(substitue[substitue.length - 1])), "l'entrée bidon doit ressortir SOLDÉE").toBe(true);
  });
});

describe('corpus des SCÈNES — le contenu joué CONSOMME, ce qu\'il pose ne consomme pas', () => {
  const sceneCorpus = sceneConsumerCorpus(SRC_DIR);
  // Corpus dans la configuration des catalogues ÉCARTÉS : c'est la seule où un `trapping` est privé de
  // sa PROPRE déclaration (sinon `trappings.json` se cite lui-même et tout témoin serait vicié).
  const withScenes = buildConsumerCorpus(DATA_DIR, SRC_DIR, EXCLUDED_CATEGORY_FILES);
  const withoutScenes = withScenes.replace(sceneCorpus, '');

  it('une entité citée UNIQUEMENT par une scène est CONSOMMÉE — les documents de projet sont dans le corpus', () => {
    // `bonnet-de-fou` est octroyé par un `effect.trappingId` de `arene-projet.json` et n'apparaît
    // nulle part ailleurs : c'est l'un des 15 gains mesurés du corpus élargi (#1553 L2).
    expect(isConsumed(withoutScenes, 'bonnet-de-fou'), 'témoin VICIÉ : cet id est aussi cité hors des scènes — en choisir un autre parmi les gains mesurés').toBe(false);
    expect(isConsumed(withScenes, 'bonnet-de-fou'), "cité par une scène mais absent du corpus partagé — `buildConsumerCorpus` n'agrège plus `sceneConsumerCorpus`").toBe(true);
  });

  it("l'id PROPRE d'une entité posée ne consomme RIEN — poser n'est pas citer", () => {
    // Témoin réel : `arene-projet.json` pose un PERSONNAGE d'id `chaland` (un badaud,
    // dont la `ref` nomme sa fiche, #1882).
    const arene = JSON.parse(readFileSync(`${ROOT}src/scenes/arene/arene-projet.json`, 'utf8'));
    const pose = arene.scenes.flatMap((s: { entities?: { id: string; ref?: string }[] }) => s.entities ?? [])
      .find((e: { id: string }) => e.id === 'chaland');
    expect(pose, 'témoin VIDE : plus aucune entité posée ne porte l\'id `chaland` — rebaser le témoin sur une autre identité propre').toBeTruthy();
    expect(pose.ref, 'témoin VICIÉ : la `ref` de cette entité CITE désormais `chaland`, une vraie citation').not.toBe('chaland');
    expect(isConsumed(sceneCorpus, 'chaland')).toBe(false);
  });
});

describe("auto-citation — une entrée qui cite son PROPRE id ne se consomme pas, l'homonyme d'un autre catalogue si", () => {
  // Fixture nommée : un `griffon-fixture` de bestiaire qui répète DEUX fois son id (`appearance.species`,
  // `appearance.tenue`), un décor HOMONYME dans `props.json`, et une créature `loup-fixture` qui cite la
  // créature `chien-fixture`.
  let racine = '';
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'entity-orphans-'));
    const dataDir = join(racine, 'src', 'data');
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(join(racine, 'src', 'scenes'));
    const catalogues: Record<string, unknown[]> = {
      creatures: [
        { id: 'griffon-fixture', appearance: { species: 'griffon-fixture', tenue: 'griffon-fixture' } },
        { id: 'loup-fixture', appearance: { species: 'chien-fixture' } },
        { id: 'chien-fixture' },
      ],
      props: [{ id: 'griffon-fixture' }],
    };
    for (const [cat, file] of Object.entries(CATEGORY_FILES)) writeFileSync(join(dataDir, file), JSON.stringify(catalogues[cat] ?? []));
  });
  afterAll(() => rmSync(racine, { recursive: true, force: true }));

  it("orphelines EXACTEMENT : l'auto-citée et celle que personne ne cite ; l'homonyme et la citée sont consommées", () => {
    expect(orphelinesMesurees(join(racine, 'src', 'data'), join(racine, 'src'))).toEqual([
      { file: 'src/data/creatures.json', ref: 'griffon-fixture' },
      { file: 'src/data/creatures.json', ref: 'loup-fixture' },
    ]);
  });
});

describe("clé d'objet — une clé de littéral d'objet du code de prod égale à un id le consomme, citée ou non", () => {
  // Fixture nommée : `vouivrefixture` n'est qu'une clé NUE d'un littéral de prod, `aigle-fixture` une
  // clé CITÉE du même littéral ; `cerffixture` n'est qu'une clé d'un fichier de TEST, hors corpus.
  let racine = '';
  beforeAll(() => {
    racine = mkdtempSync(join(tmpdir(), 'entity-orphans-cles-'));
    const dataDir = join(racine, 'src', 'data');
    mkdirSync(dataDir, { recursive: true });
    mkdirSync(join(racine, 'src', 'scenes'));
    const creatures = [{ id: 'vouivrefixture' }, { id: 'aigle-fixture' }, { id: 'cerffixture' }];
    for (const [cat, file] of Object.entries(CATEGORY_FILES)) writeFileSync(join(dataDir, file), JSON.stringify(cat === 'creatures' ? creatures : []));
    writeFileSync(join(racine, 'src', 'forme.ts'), "export const FORME = { vouivrefixture: 'oiseau', 'aigle-fixture': 'oiseau' };\n");
    writeFileSync(join(racine, 'src', 'forme.test.ts'), "export const T = { cerffixture: 'oiseau' };\n");
  });
  afterAll(() => rmSync(racine, { recursive: true, force: true }));

  it('les deux graphies rendent le même verdict ; la clé d\'un test ne consomme rien', () => {
    expect(orphelinesMesurees(join(racine, 'src', 'data'), join(racine, 'src'))).toEqual([
      { file: 'src/data/creatures.json', ref: 'cerffixture' },
    ]);
  });

  it('chaque clé est rendue avec sa ligne, en chemin relatif au `src`', () => {
    expect(clesDObjet(join(racine, 'src'))).toEqual([
      { cle: 'vouivrefixture', loc: 'forme.ts:1' },
      { cle: 'aigle-fixture', loc: 'forme.ts:1' },
    ]);
  });
});

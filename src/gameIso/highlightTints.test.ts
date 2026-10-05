import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HIGHLIGHT_TINTS,
  RANGE_BAND_TINT,
  WALK_TINT,
  RUN_TINT,
  INTENT_TINT,
  RING_TARGET_TINT,
  ENEMY_CUE_TINT,
  RING_CROWD_TINT,
  RING_ALLY_TINT,
  INVALID_TINT,
  GOLD_TINT,
  GOLD_DARK_TINT,
  HALO_TINT,
  ZONE_SMOKE_TINT,
  ZONE_FIRE_TINT,
  ENGAGE_TINT,
  THREAT_TINT,
  ACTIVE_HALO_TINT,
} from './highlightTints';
import { ACTIVE_RING, ENEMY_RING, HERO_RING, ALLY_TINT, ENEMY_TINT, ACTIVE_TINT, NEUTRAL_TINT } from './teamColors';
import { CALAGE_APLAT, CALAGE_ARETES } from './backends/webgl/calageProps';
import { teintesJeu } from '../data';
/** Le DOCUMENT entier (enveloppe + `entries`) — ce que le schéma parse depuis #1467 L1b V-FLIP-RECORD. */
import teintesJeuJson from '../data/teintesJeu.json';

/** Document FORGÉ : l'enveloppe réelle du document, avec une carte de teintes de test sous `entries`
 *  — c'est le DOCUMENT que le schéma parse, jamais la carte nue. */
const doc = (entries: Record<string, string>) => ({ ...teintesJeuJson, entries });
import {
  TEINTE_KEYS,
  GROUPES_SURBRILLANCE,
  GROUPES_IDENTITE,
  IDENTITE_HEROS_KEYS,
  PARTAGES_NOMMES,
  PAIRES_SUPERPOSEES,
  SEUIL_IDENTITE_HEROS,
  distanceTeinte,
  schema,
  type TeinteId,
} from '../data/schemas/defs/teintesJeu';

/**
 * Les TEINTES DE JEU sont en DONNÉE (`src/data/teintesJeu.json`) ; trois façades les nomment
 * (`highlightTints.ts` pour les surbrillances, `teamColors.ts` pour l'identité d'unité,
 * `backends/webgl/calageProps.ts` pour le mode calage de l'éditeur). Ce fichier
 * garde les trois coutures de cette bascule :
 *  1. PARITÉ liste-de-clés du schéma ⇄ JSON réel ⇄ ce que les façades servent — `src/data` recopie
 *     `TEINTE_KEYS` faute de pouvoir importer `src/gameIso` (pureté de couche, `oxlint.config.mjs`), patron
 *     `WALL_PART_KEYS` ⇄ `relief.test.ts` ;
 *  2. ÉGALITÉ JSON ↔ vars CSS de repli homonymes de `src/ui/styles/base.css` (les feuilles de style
 *     les consomment encore) — `HIGHLIGHT_TINTS` est la projection `id → var` qui les apparie ;
 *  3. RÔLES DISJOINTS : aucun octet partagé entre une surbrillance transitoire et une identité
 *     persistante, hors partage NOMMÉ — c'est l'invariant du schéma, éprouvé ici sur la donnée RÉELLE
 *     et sur des objets forgés (le schéma doit REFUSER une collision, pas seulement l'éviter).
 * ANGLE MORT : les surcharges de `--x` faites hors `:root` (thème, media query) ne sont pas mesurées.
 */
const CSS = readFileSync(fileURLToPath(new URL('../ui/styles/base.css', import.meta.url)), 'utf8');

/** Valeur déclarée d'une variable CSS (première déclaration rencontrée), ou null. */
function cssVar(nom: string): string | null {
  const m = CSS.match(new RegExp(`${nom}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

/** Câblage constante nommée → id de teinte, façade `highlightTints`. */
const RELAIS_SURBRILLANCE: [string, TeinteId, string][] = [
  ['WALK_TINT', 'zone-marche', WALK_TINT],
  ['RUN_TINT', 'zone-course', RUN_TINT],
  ['INTENT_TINT', 'zone-intention', INTENT_TINT],
  ['ZONE_SMOKE_TINT', 'zone-fumee', ZONE_SMOKE_TINT],
  ['ZONE_FIRE_TINT', 'zone-feu', ZONE_FIRE_TINT],
  ['RING_TARGET_TINT', 'signal-cible', RING_TARGET_TINT],
  ['RING_CROWD_TINT', 'signal-foule', RING_CROWD_TINT],
  ['RING_ALLY_TINT', 'signal-allie', RING_ALLY_TINT],
  ['ENEMY_CUE_TINT', 'signal-ennemi', ENEMY_CUE_TINT],
  ['ENGAGE_TINT', 'signal-engagement', ENGAGE_TINT],
  ['THREAT_TINT', 'signal-menace', THREAT_TINT],
  ['INVALID_TINT', 'signal-invalide', INVALID_TINT],
  ['GOLD_TINT', 'or-surbrillance', GOLD_TINT],
  ['GOLD_DARK_TINT', 'or-contour', GOLD_DARK_TINT],
  ['HALO_TINT', 'or-halo', HALO_TINT],
  ['ACTIVE_HALO_TINT', 'anneau-actif', ACTIVE_HALO_TINT],
  ['RANGE_BAND_TINT.bonus', 'bande-bonus', RANGE_BAND_TINT.bonus],
  ['RANGE_BAND_TINT.neutre', 'bande-neutre', RANGE_BAND_TINT.neutre],
  ['RANGE_BAND_TINT.malus', 'bande-malus', RANGE_BAND_TINT.malus],
];

/** Câblage constante nommée → id de teinte, façade `teamColors`. `ACTIVE_RING`/`ACTIVE_TINT` visent
 *  la MÊME entrée que le halo de case : un seul signal « l'unité qui joue », trois surfaces. */
const RELAIS_IDENTITE: [string, TeinteId, string][] = [
  ['ACTIVE_RING', 'anneau-actif', ACTIVE_RING],
  ['ACTIVE_TINT', 'anneau-actif', ACTIVE_TINT],
  ['ENEMY_RING', 'anneau-ennemi', ENEMY_RING],
  ['ALLY_TINT', 'equipe-allie', ALLY_TINT],
  ['ENEMY_TINT', 'equipe-ennemi', ENEMY_TINT],
  ['NEUTRAL_TINT', 'equipe-neutre', NEUTRAL_TINT],
  ['HERO_RING[0]', 'identite-heros-1', HERO_RING[0]],
  ['HERO_RING[1]', 'identite-heros-2', HERO_RING[1]],
  ['HERO_RING[2]', 'identite-heros-3', HERO_RING[2]],
  ['HERO_RING[3]', 'identite-heros-4', HERO_RING[3]],
];

/** Câblage constante nommée → id de teinte, façade `backends/webgl/calageProps` (mode calage de
 *  l'éditeur : aplat du décor volumique et ses arêtes). */
const RELAIS_EDITEUR: [string, TeinteId, string][] = [
  ['CALAGE_APLAT', 'editeur-calage-aplat', CALAGE_APLAT],
  ['CALAGE_ARETES', 'editeur-calage-aretes', CALAGE_ARETES],
];

describe('teintes de jeu — PARITÉ schéma ⇄ donnée ⇄ façades', () => {
  it('la liste de clés du schéma est EXACTEMENT celle du JSON (recopie gardée, cf. pureté de src/data)', () => {
    expect([...TEINTE_KEYS].sort()).toEqual(Object.keys(teintesJeu).sort());
  });

  it('chaque id porte un préfixe de groupe DÉCLARÉ — aucune teinte hors des deux familles', () => {
    const prefixes = [...GROUPES_SURBRILLANCE, ...GROUPES_IDENTITE];
    for (const k of TEINTE_KEYS) expect([k, prefixes.some((p) => k.startsWith(p))]).toEqual([k, true]);
  });

  it('les trois façades servent TOUTES les clés, sans en inventer', () => {
    const servies = [...RELAIS_SURBRILLANCE, ...RELAIS_IDENTITE, ...RELAIS_EDITEUR].map(([, id]) => id);
    expect([...new Set(servies)].sort()).toEqual([...TEINTE_KEYS].sort());
  });

  it.each([...RELAIS_SURBRILLANCE, ...RELAIS_IDENTITE, ...RELAIS_EDITEUR])('%s relaie la valeur de `%s`', (_nom, id, valeur) => {
    expect(valeur).toBe(teintesJeu[id]);
  });

  it('les bandes de portée couvrent les trois tons du builder', () => {
    expect(Object.keys(RANGE_BAND_TINT).sort()).toEqual(['bonus', 'malus', 'neutre']);
  });
});

describe('teintes de jeu — ÉGALITÉ JSON ↔ vars CSS de repli (base.css)', () => {
  it('la sonde lit bien une var connue (et rend null sur une var absente)', () => {
    expect(cssVar('--combat-run')).toBe('#9b6be0');
    expect(cssVar('--teinte-qui-nexiste-pas')).toBeNull();
  });

  it('la projection id → var ne cite que des ids RÉELS', () => {
    for (const id of Object.keys(HIGHLIGHT_TINTS)) expect([...TEINTE_KEYS]).toContain(id);
  });

  it.each(Object.entries(HIGHLIGHT_TINTS))('`%s` == sa var CSS %s', (id, nom) => {
    expect(cssVar(nom)).toBe(teintesJeu[id as TeinteId]);
  });
});

describe('teintes de jeu — RÔLES DISJOINTS (surbrillance ⇄ identité), invariant du schéma', () => {
  const surbrillances = TEINTE_KEYS.filter((k) => GROUPES_SURBRILLANCE.some((p) => k.startsWith(p)));
  const identites = TEINTE_KEYS.filter((k) => GROUPES_IDENTITE.some((p) => k.startsWith(p)));
  const exempt = new Set(PARTAGES_NOMMES.flatMap((p) => [`${p.a}|${p.b}`, `${p.b}|${p.a}`]));

  it('la donnée du dépôt PASSE le schéma', () => {
    expect(schema.safeParse(teintesJeuJson).success).toBe(true);
  });

  it('aucune surbrillance ne peint l’octet d’une identité (hors partage NOMMÉ)', () => {
    const collisions = surbrillances.flatMap((s) =>
      identites
        .filter((i) => teintesJeu[s] === teintesJeu[i] && !exempt.has(`${s}|${i}`))
        .map((i) => `${s} == ${i} (${teintesJeu[s]})`),
    );
    expect(collisions).toEqual([]);
  });

  it('chaque partage ASSUMÉ est RÉEL (une exemption morte ne se garde pas)', () => {
    for (const p of PARTAGES_NOMMES) expect([p.a, teintesJeu[p.a]]).toEqual([p.a, teintesJeu[p.b]]);
  });

  it('le partage NOMMÉ ne vaut que pour SA paire — repeindre une AUTRE surbrillance sur la même identité échoue', () => {
    // `or-halo` prend l'octet d'`equipe-allie` : paire non déclarée, l'exemption d'`or-surbrillance` ne la couvre pas.
    expect(schema.safeParse(doc({ ...teintesJeu, 'or-halo': teintesJeu['equipe-allie'] })).success).toBe(false);
  });

  it('le partage NOMMÉ ne vaut pas « dans l’autre sens » — repeindre l’identité exemptée sur une AUTRE surbrillance échoue', () => {
    // `equipe-neutre` est exemptée AVEC `or-surbrillance`, pas avec `or-halo` : la paire forgée reste inconnue.
    expect(schema.safeParse(doc({ ...teintesJeu, 'equipe-neutre': teintesJeu['or-halo'] })).success).toBe(false);
  });

  it('l’invariant porte sur le CROISEMENT des deux familles — deux surbrillances au même octet passent', () => {
    // PÉRIMÈTRE mesuré : `zone-feu` peint comme `zone-marche` est ACCEPTÉ (aucune identité en jeu). La
    // donnée du dépôt porte déjà deux tels doublets intra-famille (`bande-bonus`/`signal-allie`,
    // `bande-malus`/`signal-ennemi`).
    expect(schema.safeParse(doc({ ...teintesJeu, 'zone-feu': teintesJeu['zone-marche'] })).success).toBe(true);
  });

  it('la collision se mesure sur l’OCTET, pas sur la casse écrite', () => {
    const forge = { ...teintesJeu, 'zone-marche': teintesJeu['identite-heros-1'].toUpperCase() };
    expect(schema.safeParse(doc(forge)).success).toBe(false);
  });

  it('le schéma REFUSE une collision non nommée (`zone-marche` repeint en couleur du héros 1)', () => {
    const forge = { ...teintesJeu, 'zone-marche': teintesJeu['identite-heros-1'] };
    expect(schema.safeParse(doc(forge)).success).toBe(false);
  });

  it('les 4 identités de héros restent SÉPARÉES, et le schéma refuse deux jumelles', () => {
    const distances = IDENTITE_HEROS_KEYS.flatMap((a, i) =>
      IDENTITE_HEROS_KEYS.slice(i + 1).map((b) => distanceTeinte(teintesJeu[a], teintesJeu[b])),
    );
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(SEUIL_IDENTITE_HEROS);
    const forge = { ...teintesJeu, 'identite-heros-4': teintesJeu['identite-heros-3'] };
    expect(schema.safeParse(doc(forge)).success).toBe(false);
  });

  it('une clé MANQUANTE ou une couleur mal formée échoue au chargement', () => {
    const { 'zone-feu': _absente, ...ampute } = teintesJeu;
    expect(schema.safeParse(doc(ampute)).success).toBe(false);
    expect(schema.safeParse(doc({ ...teintesJeu, 'zone-feu': 'orange' })).success).toBe(false);
    expect(schema.safeParse(doc({ ...teintesJeu, 'zone-inconnue': '#123456' })).success).toBe(false);
  });
});

describe('teintes de jeu — PAIRES SUPERPOSÉES (le tapis peint SOUS le pion)', () => {
  it('chaque paire déclarée tient le plancher des identités', () => {
    const serrées = PAIRES_SUPERPOSEES.map((p) => [
      `${p.surbrillance} ⇄ ${p.identite}`,
      distanceTeinte(teintesJeu[p.surbrillance], teintesJeu[p.identite]) >= SEUIL_IDENTITE_HEROS,
    ]);
    expect(serrées).toEqual(PAIRES_SUPERPOSEES.map((p) => [`${p.surbrillance} ⇄ ${p.identite}`, true]));
  });

  it('la liste couvre le tapis de MARCHE contre les QUATRE identités de héros', () => {
    expect(PAIRES_SUPERPOSEES.map((p) => `${p.surbrillance}|${p.identite}`)).toEqual(
      IDENTITE_HEROS_KEYS.map((h) => `zone-marche|${h}`),
    );
  });

  it('le schéma REFUSE une paire superposée TROP PROCHE, octets pourtant distincts', () => {
    // #3d7fd0 : un bleu de Marche à 49,4 de l'anneau du héros 1 — la non-collision d'octet le laissait passer.
    const forge = { ...teintesJeu, 'zone-marche': '#3d7fd0' };
    expect(distanceTeinte(forge['zone-marche'], teintesJeu['identite-heros-1'])).toBeLessThan(SEUIL_IDENTITE_HEROS);
    expect(schema.safeParse(doc(forge)).success).toBe(false);
  });

  it('ANGLE MORT du périmètre : un croisement NON superposé sous le seuil reste admis', () => {
    // Seules les paires inscrites dans `PAIRES_SUPERPOSEES` portent le plancher : une `zone-fumee`
    // posée à 22,6 de l'anneau du héros 4 passe, faute d'être déclarée superposée. Sur la donnée du
    // dépôt, le croisement le plus serré hors liste est `zone-course` ⇄ `identite-heros-4`, à 71,2.
    const forge = { ...teintesJeu, 'zone-fumee': '#8a6cff' };
    expect(distanceTeinte(forge['zone-fumee'], teintesJeu['identite-heros-4'])).toBeLessThan(SEUIL_IDENTITE_HEROS);
    expect(schema.safeParse(doc(forge)).success).toBe(true);
    expect(distanceTeinte(teintesJeu['zone-course'], teintesJeu['identite-heros-4'])).toBeLessThan(SEUIL_IDENTITE_HEROS);
  });

  it('la Marche garde son DÉTACHEMENT du sol volumique (la lisibilité ne se paie pas sur la pâleur)', () => {
    // Unité du dépôt : moyenne des canaux, sol volumique mesuré à 73 (`backends/webgl/dynamicMarkMeshes.ts:113`),
    // opacité du tapis de Marche 0,32 (`backends/webgl/highlightMeshes.ts:96`).
    const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0) / 3;
    const détachement = 0.32 * (lum(teintesJeu['zone-marche']) - 73);
    expect(détachement).toBeGreaterThanOrEqual(24.2);
  });
});

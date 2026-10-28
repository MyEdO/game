import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { CODEX, depuisEnveloppe } from './registry';
import { books } from '../../data';
import { EXEMPTS } from '../../data/schemas/exposition-derivee';

/**
 * Gel de FORME du Codex + cliquet de PROVENANCE (#1467 L1b V-CODEX).
 *
 * Le registre projette une catégorie par entrée des tables ci-dessous. Aucune mesure ne porte un id,
 * un compte ou une liste d'entrées : ajouter une donnée de forme connue ne fait rougir aucune d'elles
 * (#2995). Cinq mesures, aucune n'étant un dump des items :
 *
 *  1. CLÉS — pour chaque catégorie, le hash de l'ensemble des FORMES d'item distinctes (clés triées).
 *     Aucune valeur n'est filtrée : une clé posée à `undefined`/`null` compte comme présente. Une forme
 *     qui apparaît ou disparaît fait rougir ; un item de plus à une forme connue, jamais.
 *  2. FORME — l'UNION des clés par catégorie, à but de DIAGNOSTIC lisible. Ni (1) ni (2) ne voient un
 *     item isolé qui gagne ou perd une clé qu'une autre forme porte déjà : ce qui compte de cet angle,
 *     que la provenance de la donnée arrive à l'item, c'est (5) qui l'attrape.
 *  3. ANGLE MORT DE (5) — les catégories que le mapping déduit n'atteint pas (Critiques, nichés dans
 *     leur document-table ; cargaisons, tableaux partiels) : chaque item y porte les champs déclarés.
 *  4. CANAL UNIQUE — la provenance passe par `source`, jamais par un fait de `meta` intitulé
 *     « Source » : le canal en double se lit à l'écran, aucune mesure de forme ne l'attrape.
 *     Son second volet gèle la VALEUR : tout `source.book` projeté est une ABRÉVIATION du
 *     catalogue `books`, jamais l'id brut qu'un site oubliant `src()` laisserait passer.
 *  5. PROVENANCE — pour chaque entrée de `src/data/*.json` portant `source` ou `desc`, hors vocabulaire
 *     que son def déclare interne à l'application (`EXEMPTS`, `exposition-derivee.ts`), l'item Codex
 *     de MÊME id doit les porter aussi. Le mapping dataset→catégorie est DÉDUIT (inclusion des ids),
 *     jamais une table à maintenir ; son ANGLE MORT (les tableaux qu'aucune catégorie ne couvre
 *     ENTIÈREMENT) est lui-même gelé, cf. `PARTIELS`/`ORPHELINS`.
 *
 * Régénérer les baselines : mesurer `CODEX` avec le même calcul que `clesDe`/`formeDe`/le corps du
 * test de provenance, et recopier les tables ci-dessous. Un écart NON VOULU se lit catégorie par
 * catégorie ; un écart VOULU se re-gèle avec sa raison dans le message de commit.
 */

const DATA_DIR = resolve(__dirname, '../../data');
/** Les datasets de `src/data`, listés UNE fois — deux faits ci-dessous les relisent tous. */
const DATASETS = listerDossier(DATA_DIR).filter((x) => x.endsWith('.json'));

/** sha256 (16 hex) de l'ensemble des formes d'item distinctes (clés triées) d'une catégorie. */
const CLES: Record<string, string> = {
  "arcanePhenomena": '886ec722aaecdd8b',
  "advancementCosts": '865800cac699c951',
  "disponibilite": 'be7be9a901f0f010',
  "sizes": '8617635e65741ec9',
  "drivingMishap": 'ed935a21da6026cc',
  "drunkenness": 'a51735b3d8064fc7',
  "encumbranceTiers": '7ec365878940bd8f',
  "riverNavigation": 'c36032d40e3c6576',
  "grapple": 'be7be9a901f0f010',
  "miscastMinor": '73266016a0d1fdd2',
  "miscastMajor": '73266016a0d1fdd2',
  "miscastWrath": '73266016a0d1fdd2',
  "nightStakes": '379df048977ddf91',
  "voyageStakes": '379df048977ddf91',
  "flowStakes": '379df048977ddf91',
  "combatStakes": '3f2728177225d7f2',
  "races": '090b503dc034548c',
  "careers": '4a1e1257849261cb',
  "characteristics": '8f583e09b7e35f6e',
  "classes": '379df048977ddf91',
  "stars": '8f583e09b7e35f6e',
  "skills": '8f583e09b7e35f6e',
  "talents": 'de6ae6078edd292d',
  "axes": 'c5ccf60afbeb7d87',
  "trappings": '603115f165e3cb6c',
  "siegeEngines": 'b3582e558e2c6a8a',
  "weaponGroups": '15b1ab79bf407e8a',
  "qualities": '3f2728177225d7f2',
  "etats": '57a6bfb12a966af1',
  "maladies": '8f583e09b7e35f6e',
  "symptoms": '57a6bfb12a966af1',
  "mutations": '14efb19a1299ec2f',
  "materials": '5e54bf1063ade837',
  "mutationTables": '15b1ab79bf407e8a',
  "effectTables": '0efad77909a216b4',
  "maneuvers": '8f583e09b7e35f6e',
  "psychologie": '8d61fe8ff86828dc',
  "domains": 'de1aa7f76f613e28',
  "spells": '8f583e09b7e35f6e',
  "gods": '8ef65740e30ca4c5',
  "ventsTourbillonnants": 'cc7975018f78a439',
  "creatures": 'd395e55f45ebbd79',
  "traits": '9a093506fbe77ca8',
  "locations": '7cadf9f2dd12544f',
  "books": '07b120469c3198ea',
  "careerLevels": '5501677f8f8939bf',
  "eyes": '15b1ab79bf407e8a',
  "hairs": '15b1ab79bf407e8a',
  "calendarMonths": '8d0caf6fd088004a',
  "calendarIntercalary": '8d0caf6fd088004a',
  "calendarWeekdays": 'bbf72cb62b75aad4',
  "calendarPhases": '06f42ede145518a6',
  "weather": '8d0caf6fd088004a',
  "weatherConditions": '632aa0a2a519310f',
  "raceAppearance": 'bbe20fc5f0a09aea',
  "pregens": '4d948e61d0850dcc',
  "oups": '865800cac699c951',
  "interludeEvents": 'd8970b82531d0dd6',
  "peripeties": 'd8970b82531d0dd6',
  "activities": '603115f165e3cb6c',
  "massBattlePowerEstimate": '632aa0a2a519310f',
  "massBattleMightModifiers": '632aa0a2a519310f',
  "massBattleWarMachines": '7ec365878940bd8f',
  "massBattleStructures": '7ec365878940bd8f',
  "massBattleHazards": 'd8970b82531d0dd6',
  "details": '8617635e65741ec9',
  "semencesDeScene": '8617635e65741ec9',
  "defautsDeCompilation": '8617635e65741ec9',
  "names": 'a98fa4eded20b737',
  "structures": '3cfcbcc97343fd44',
  "terrains": 'ccbd49ae53a50267',
  "buildings": '7b343ef76a1171dd',
  "vehicles": 'bdfb8a6b68d945e1',
  "celestialHouses": 'd8970b82531d0dd6',
  "groups": '95aff48bfd7137c0',
  "psychologies": '379df048977ddf91',
  "seaShanties": '787b0cd98af7f936',
  "crewRoles": 'b5e5a374b03e8f25',
  "crewTestTypes": 'c36032d40e3c6576',
  "navalTraits": 'c95dd6aa4d6baad5',
  "shipStations": '632aa0a2a519310f',
  "traumas": 'a7ad957d8671f158',
  "criticalsTete": '8f583e09b7e35f6e',
  "criticalsBras": '8f583e09b7e35f6e',
  "criticalsCorps": '8f583e09b7e35f6e',
  "criticalsJambe": '5837eb6693a3d9e3',
  "aaCriticalsTete": '8f583e09b7e35f6e',
  "aaCriticalsBras": '8f583e09b7e35f6e',
  "aaCriticalsCorps": '8f583e09b7e35f6e',
  "aaCriticalsJambe": '8f583e09b7e35f6e',
  "incidentsMonture": 'a51735b3d8064fc7',
  "problemesVehicule": 'a51735b3d8064fc7',
  "rencontresPositives": 'a51735b3d8064fc7',
  "rencontresFortuites": 'a51735b3d8064fc7',
  "rencontresDangereuses": 'a51735b3d8064fc7',
  "shipCriticalsCargaison": 'a51735b3d8064fc7',
  "shipCriticalsGreement": 'a51735b3d8064fc7',
  "shipCriticalsCoque": 'a51735b3d8064fc7',
  "shipCriticalsAvirons": 'a51735b3d8064fc7',
  "shipCriticalsEquipements": 'a51735b3d8064fc7',
  "riverCriticalsGreement": 'a51735b3d8064fc7',
  "riverCriticalsAvirons": 'a51735b3d8064fc7',
  "riverCriticalsGouvernail": 'a51735b3d8064fc7',
  "riverCriticalsCoque": 'a51735b3d8064fc7',
  "riverCriticalsSuperstructure": 'a51735b3d8064fc7',
  "seaManannFactors": '7ec365878940bd8f',
  "seaBoardEvents": 'd8970b82531d0dd6',
  "seaPortEvents": 'd8970b82531d0dd6',
  "waterExposure": '787b0cd98af7f936',
  "navalPorts": '029671927d6cb344',
  "navalProgression": 'd8970b82531d0dd6',
  "shipHullSizes": 'c36032d40e3c6576',
  "shipSpeedTraits": '7ec365878940bd8f',
  "shipConstructionTraits": '7ec365878940bd8f',
  "seaNavigation": 'be7be9a901f0f010',
  "seaPerils": '379df048977ddf91',
  "seaWeather": 'c36032d40e3c6576',
  "montures": 'fc072dd256014b9b',
  "tavernGames": '632aa0a2a519310f',
  "obsessions": '06f42ede145518a6',
  "reglesOptionnelles": '1c5ecb5575a73f57',
  "surincantation": '865800cac699c951',
  "structureCriticals": 'ed935a21da6026cc',
  "artilleryMisfire": 'ed935a21da6026cc',
  "landCargo": '7ec365878940bd8f',
  "seaCargo": 'bbf72cb62b75aad4',
  "riverPerils": '8d0caf6fd088004a',
  "crewMoraleFactors": 'd6999c398eb1da98',
  "crewMoraleBands": '97b338e5362dfa4e',
  "steamBreakdowns": '97b338e5362dfa4e',
  "regles": '25fe3060daf41860',
};

/** Union des clés PRÉSENTES par catégorie (diagnostic lisible — un item isolé qui gagne une clé que
 *  ses voisins portent déjà lui échappe : c'est `CLES` qui l'attrape). */
const FORME: Record<string, string> = {
  "arcanePhenomena": 'desc group id label meta sections source sub',
  "advancementCosts": 'id label meta source sub',
  "disponibilite": 'id label sections source',
  "sizes": 'id label sections',
  "drivingMishap": 'desc id label meta sub',
  "drunkenness": 'desc id label meta sections sub',
  "encumbranceTiers": 'id label meta source',
  "riverNavigation": 'id label meta sections source',
  "grapple": 'id label sections source',
  "miscastMinor": 'id label meta sections source sub',
  "miscastMajor": 'id label meta sections source sub',
  "miscastWrath": 'id label meta sections source sub',
  "nightStakes": 'desc id label sections source',
  "voyageStakes": 'desc id label sections source',
  "flowStakes": 'desc id label sections source', // #1920 B14 (2026-09-24) : `sub` (`flow/phase`) retiré
  "combatStakes": 'desc id label sections source sub',
  "races": 'appearance desc group id label meta source tabs',
  "careers": 'desc group id label meta source sub tabs',
  "characteristics": 'desc id label meta sections source sub',
  "classes": 'desc id label sections source',
  "stars": 'desc id label meta sections source sub',
  "skills": 'desc id label meta sections source sub',
  "talents": 'desc id label maison meta sections source',
  "axes": 'desc id label maison meta sections',
  "trappings": 'desc id label maison meta sections source sub',
  "siegeEngines": 'appearance desc id label meta previewRef sections source sub',
  "weaponGroups": 'id label sections source sub',
  "qualities": 'desc id label sections source sub',
  "etats": 'desc id label maison sections source',
  "maladies": 'desc id label meta sections source sub',
  "symptoms": 'desc id label maison sections source',
  "mutations": 'appearance desc group id label previewPorteur sections source sub',
  "materials": 'group id label meta sub',
  "mutationTables": 'id label sections source sub',
  "effectTables": 'id label maison sections source sub',
  "maneuvers": 'desc id label meta sections source sub',
  "psychologie": 'appearance desc group id label meta sections source sub',
  "domains": 'desc id label maison meta sections source',
  "spells": 'desc id label meta sections source sub',
  "gods": 'desc id label sections source sub',
  "ventsTourbillonnants": 'id label meta sub',
  "creatures": 'appearance desc group id label maison meta previewRef sections source statblock sub',
  "traits": 'appearance desc id label maison meta sections source sub',
  "locations": 'desc group id label sections source sub',
  "books": 'desc group id label sections sub',
  "careerLevels": 'group id label sections source sub',
  "eyes": 'id label sections source sub',
  "hairs": 'id label sections source sub',
  "calendarMonths": 'id label source sub',
  "calendarIntercalary": 'id label source sub',
  "calendarWeekdays": 'id label source',
  "calendarPhases": 'id label sub',
  "weather": 'id label source sub',
  "weatherConditions": 'desc id label meta source',
  "raceAppearance": 'appearance id label meta sub',
  "pregens": 'id label meta sections sub',
  "oups": 'id label meta source sub',
  "interludeEvents": 'desc id label source sub',
  "peripeties": 'desc id label source sub',
  "activities": 'desc id label maison meta sections source sub',
  "massBattlePowerEstimate": 'desc id label meta source',
  "massBattleMightModifiers": 'desc id label meta source',
  "massBattleWarMachines": 'id label meta source',
  "massBattleStructures": 'id label meta source',
  "massBattleHazards": 'desc id label source sub',
  "details": 'id label sections',
  "semencesDeScene": 'id label sections',
  "defautsDeCompilation": 'id label sections',
  "names": 'id label sections sub',
  "structures": 'desc id label maison meta sections source sub',
  "terrains": 'id label maison meta sections',
  "buildings": 'id label maison meta',
  "vehicles": 'desc id label meta source',
  "celestialHouses": 'desc id label source sub',
  "groups": 'id label maison source',
  "psychologies": 'desc id label sections source',
  "seaShanties": 'desc id label meta sections source',
  "crewRoles": 'desc id label maison sections source',
  "crewTestTypes": 'id label meta sections source',
  "navalTraits": 'desc id label maison sections source sub',
  "shipStations": 'desc id label meta source',
  "traumas": 'desc id label maison sections source sub',
  "criticalsTete": 'desc id label meta sections source sub',
  "criticalsBras": 'desc id label meta sections source sub',
  "criticalsCorps": 'desc id label meta sections source sub',
  "criticalsJambe": 'desc id label maison meta sections source sub',
  "aaCriticalsTete": 'desc id label meta sections source sub',
  "aaCriticalsBras": 'desc id label meta sections source sub',
  "aaCriticalsCorps": 'desc id label meta sections source sub',
  "aaCriticalsJambe": 'desc id label meta sections source sub',
  "incidentsMonture": 'desc id label meta sections sub',
  "problemesVehicule": 'desc id label meta sections sub',
  "rencontresPositives": 'desc id label meta sections sub',
  "rencontresFortuites": 'desc id label meta sections sub',
  "rencontresDangereuses": 'desc id label meta sections sub',
  "shipCriticalsCargaison": 'desc id label meta sections sub',
  "shipCriticalsGreement": 'desc id label meta sections sub',
  "shipCriticalsCoque": 'desc id label meta sections sub',
  "shipCriticalsAvirons": 'desc id label meta sections sub',
  "shipCriticalsEquipements": 'desc id label meta sections sub',
  "riverCriticalsGreement": 'desc id label meta sections sub',
  "riverCriticalsAvirons": 'desc id label meta sections sub',
  "riverCriticalsGouvernail": 'desc id label meta sections sub',
  "riverCriticalsCoque": 'desc id label meta sections sub',
  "riverCriticalsSuperstructure": 'desc id label meta sections sub',
  "seaManannFactors": 'id label meta source',
  "seaBoardEvents": 'desc id label source sub',
  "seaPortEvents": 'desc id label source sub',
  "waterExposure": 'desc id label meta sections source',
  "navalPorts": 'desc group id label meta sections source',
  "navalProgression": 'desc id label source sub',
  "shipHullSizes": 'id label meta sections source',
  "shipSpeedTraits": 'id label meta source',
  "shipConstructionTraits": 'id label meta source',
  "seaNavigation": 'id label sections source',
  "seaPerils": 'desc id label sections source',
  "seaWeather": 'id label meta sections source',
  "montures": 'id label meta sections',
  "tavernGames": 'desc id label meta source',
  "obsessions": 'id label sub',
  "reglesOptionnelles": 'desc id label maison meta source sub',
  "surincantation": 'id label meta source sub',
  "structureCriticals": 'desc id label meta sub',
  "artilleryMisfire": 'desc id label meta sub',
  "landCargo": 'id label meta source',
  "seaCargo": 'id label source',
  "riverPerils": 'id label source sub',
  "crewMoraleFactors": 'desc id label source',
  "crewMoraleBands": 'desc id label meta source sub',
  "steamBreakdowns": 'desc id label meta source sub',
  "regles": 'desc id label sections source',
};

/** ANGLE MORT de la PROVENANCE : catégories dont la donnée échappe au mapping déduit — les Critiques
 *  (rangées nichées dans un document-table, `criticals.json#0` en `ORPHELINS`) et les cargaisons
 *  (`land-cargo.json#0`, `sea-cargo.json#0` en `PARTIELS`). Chaque item y porte les champs déclarés. */
const PORTES_HORS_MAPPING: Record<string, readonly ('desc' | 'source')[]> = {
  criticalsTete: ['desc', 'source'],
  criticalsBras: ['desc', 'source'],
  criticalsCorps: ['desc', 'source'],
  criticalsJambe: ['desc', 'source'],
  aaCriticalsTete: ['desc', 'source'],
  aaCriticalsBras: ['desc', 'source'],
  aaCriticalsCorps: ['desc', 'source'],
  aaCriticalsJambe: ['desc', 'source'],
  landCargo: ['source'],
  seaCargo: ['source'],
};
/** Cliquet POSITIF DÉCROISSANT : catégories dont ≥1 item DÉFAUSSE une `source`/`desc` que la donnée
 *  porte (#1472 T3). Plus AUCUN item apparié ne tait ce que sa donnée porte. Le gel à vide est l'assertion : une projection qui redroppe un champ
 *  repeuple cette table et rougit, nominativement. Ne JAMAIS y réinscrire une catégorie. */
const MUETS: Record<string, number> = {};

/** ANGLE MORT du mapping déduit : tableaux qu'une catégorie couvre PARTIELLEMENT (ids en commun,
 *  mais pas tous) — ils sortent du cliquet de provenance. Gelé : un dataset qui cesse d'être
 *  couvert en entier atterrit ici et rougit, au lieu de disparaître du filet en silence.
 *  Ce qui est gelé est le TABLEAU (fichier + rang), jamais son nombre d'entrées : un dataset
 *  app-owned croît légitimement, et un cardinal gelé ferait payer un recalage à chaque ajout (#1812). */
const PARTIELS: string[] = [
  "land-cargo.json#0",
  "merchants.json#0",
  "river-navigation.json#0",
  "sea-cargo.json#0",
  "sea-perils.json#0",
  "sea-perils.json#1",
  "sea-perils.json#2",
  "sea-weather.json#3",
  "water-exposure.json#0",
];

/** Tableaux identifiés qu'AUCUNE catégorie ne touche (manifestes d'outillage, vocabulaires de
 *  rendu, tables nichées exposées autrement). Gelé au même titre que `PARTIELS` — le tableau,
 *  jamais son cardinal. */
const ORPHELINS: string[] = [
  // Les DOCUMENTS-tables de `criticals.json` (#1657 B2a) — même angle mort que `miscast.json#0` :
  // ce que le Codex expose, ce sont leurs RANGÉES, jamais le document porteur. Un document sans item
  // Codex propre n'est donc pas un manque, c'est la charge qui compte.
  "criticals.json#0",
  "miscast.json#0",
  "reseau-routier.json#0",
  "river-navigation.json#1",
  "sea-cargo.json#1",
  "sea-events.json#3",
  "sea-navigation.json#0",
  "sea-weather.json#0",
  "sea-weather.json#1",
  "sea-weather.json#2",
  // La table « Tomber du gréement » (#1657 B3-2b-c, MDG 13 l.684) : un document-table de PLUS, même
  // angle mort que `criticals.json#0` — ce que le Codex expose, ce sont les RANGÉES de Critiques qui
  // s'y réfèrent (l'op `fall` de leur échec), jamais la table de hauteurs elle-même.
  "ship-criticals.json#0",
];

const clesDe = (items: readonly object[]): string =>
  createHash('sha256').update([...new Set(items.map((i) => Object.keys(i).sort().join(',')))].sort().join('\n')).digest('hex').slice(0, 16);

function formeDe(items: readonly object[]): string {
  const k = new Set<string>();
  for (const i of items) for (const key of Object.keys(i)) k.add(key);
  return [...k].sort().join(' ');
}

/** Tableaux d'entrées IDENTIFIÉES nichés dans un JSON de donnée (un fichier peut en porter plusieurs). */
function tableauxIdentifies(v: unknown, out: Record<string, unknown>[][] = []): Record<string, unknown>[][] {
  if (Array.isArray(v)) {
    if (v.length && v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')) out.push(v as Record<string, unknown>[]);
    return out;
  }
  if (v && typeof v === 'object') for (const x of Object.values(v)) tableauxIdentifies(x, out);
  return out;
}

describe('Codex — défaut d’enveloppe (#1467 L1b)', () => {
  it('les FORMES d’item de chaque catégorie sont celles gelées (aucune n’apparaît ni ne disparaît)', () => {
    const mesure: Record<string, string> = {};
    for (const c of CODEX) mesure[c.key] = clesDe(c.items);
    expect(mesure).toEqual(CLES);
  });

  it('la FORME de chaque catégorie est celle gelée', () => {
    const mesure: Record<string, string> = {};
    for (const c of CODEX) mesure[c.key] = formeDe(c.items);
    expect(mesure).toEqual(FORME);
  });

  it('ANGLE MORT de la provenance : chaque item des catégories hors mapping porte ses champs déclarés', () => {
    const manques: string[] = [];
    for (const [cle, champs] of Object.entries(PORTES_HORS_MAPPING)) {
      const c = CODEX.find((x) => x.key === cle);
      if (!c) { manques.push(`${cle}: catégorie absente du Codex`); continue; }
      for (const i of c.items) for (const k of champs) if (!(k in i)) manques.push(`${cle}/${i.id}: ${k}`);
    }
    expect(manques).toEqual([]);
  });

  it('la PROVENANCE a UN seul canal : `source`, jamais un fait de méta intitulé « Source »', () => {
    const doublons = CODEX.flatMap((c) =>
      c.items.flatMap((i) => (i.meta ?? []).filter((f) => /^sources?$/i.test(f.label.trim())).map((f) => `${c.key}/${i.id}: ${f.label}`)),
    );
    expect(doublons).toEqual([]);
  });

  it('la VALEUR de `source.book` est une ABRÉVIATION du catalogue, jamais l’id brut du livre', () => {
    const abreviations = new Set(books.map((b) => b.abbr));
    const bruts = CODEX.flatMap((c) =>
      c.items
        .filter((i) => i.source && !abreviations.has(i.source.book))
        .map((i) => `${c.key}/${i.id}: book=${i.source!.book}`),
    );
    expect(bruts).toEqual([]);
  });

  it('le vocabulaire interne déclaré au def ne constitue pas une dette de provenance', () => {
    expect([...PARTIELS, ...ORPHELINS].filter((cle) => EXEMPTS[cle.split('#')[0]]?.kind === 'vocabulaire-app-interne')).toEqual([]);
  });

  it('PROVENANCE : un item dont la donnée porte source/desc les porte au Codex — et l’angle mort du mapping est gelé', () => {
    const muets: Record<string, number> = {};
    const apparies: string[] = [];
    const partiels: string[] = [];
    const orphelins: string[] = [];
    for (const f of DATASETS) {
      if (EXEMPTS[f]?.kind === 'vocabulaire-app-interne') continue;
      for (const [n, arr] of tableauxIdentifies(JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8'))).entries()) {
        const ids = arr.map((e) => e.id as string);
        let etat: 'total' | 'partiel' | 'orphelin' = 'orphelin';
        for (const c of CODEX) {
          const byId = new Map(c.items.map((i) => [i.id, i]));
          const couverts = ids.filter((id) => byId.has(id)).length;
          if (couverts === 0) continue;
          if (couverts < ids.length) { if (etat === 'orphelin') etat = 'partiel'; continue; }
          etat = 'total';
          let m = 0;
          for (const e of arr) {
            const item = byId.get(e.id as string)!;
            const porteSource = !!(e.source && typeof e.source === 'object');
            const porteDesc = typeof e.desc === 'string' && e.desc.length > 0;
            if ((porteSource && !item.source) || (porteDesc && !item.desc)) m++;
          }
          if (m) muets[c.key] = Math.max(muets[c.key] ?? 0, m);
        }
        // La clé gelée est le TABLEAU (fichier + rang), jamais son cardinal (#1812).
        (etat === 'total' ? apparies : etat === 'partiel' ? partiels : orphelins).push(`${f}#${n}`);
      }
    }
    expect(muets).toEqual(MUETS);
    expect(partiels).toEqual(PARTIELS);
    expect(orphelins).toEqual(ORPHELINS);
    // Les listes GELÉES sont celles des DÉFAUTS (`PARTIELS`, `ORPHELINS`), qui doivent DÉCROÎTRE ; les
    // appariés sont le RESTE, et leur nombre croît à chaque dataset relié au Codex — geler ce compte
    // ferait payer un recalage à ce lot-là (#1812).
  });
});

describe('depuisEnveloppe — le défaut lui-même', () => {
  const enveloppe = { id: 'x', label: 'X', desc: 'prose', source: { book: 'livre-de-base', page: 42 } };

  it('la source passe par src() : ABRÉVIATION du livre, jamais son id', () => {
    expect(depuisEnveloppe(enveloppe).source).toEqual({ book: 'LDB', page: 42 });
  });

  it('les extras l’emportent sur le défaut (le renommage reste visible au site)', () => {
    expect(depuisEnveloppe(enveloppe, { desc: 'enjeu', label: 'Autre' })).toMatchObject({ desc: 'enjeu', label: 'Autre' });
  });

  it('desc ET source absentes restent ABSENTES — ni chaîne vide, ni null', () => {
    const item = depuisEnveloppe({ id: 'x', label: 'X' });
    expect(Object.keys(item)).toEqual(['id', 'label']);
  });

  it('`maison` est projetée telle quelle quand la donnée la porte, et sa CLÉ reste absente sinon', () => {
    const raison = 'aucun folio n’imprime de catalogue de sols';
    expect(depuisEnveloppe({ ...enveloppe, maison: raison }).maison).toBe(raison);
    expect(Object.keys(depuisEnveloppe({ id: 'x', label: 'X' }))).not.toContain('maison');
  });

  it('la donnée RÉELLE arrive à l’item : toute entrée de `src/data/*.json` portant `maison` le porte au Codex', () => {
    // INVARIANT, pas un cardinal : le défaut d’enveloppe ne prouve rien seul — c’est le PASSAGE par
    // les catégories qui compte. Même déduction du mapping que le test de PROVENANCE ci-dessus
    // (inclusion des ids), donc aucune table à tenir ; une catégorie qui perdrait la projection se
    // dénoncerait ici avec le NOM de l’entrée muette.
    const muets: string[] = [];
    for (const f of DATASETS) {
      for (const arr of tableauxIdentifies(JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')))) {
        const porteuses = arr.filter((e) => typeof e.maison === 'string' && e.maison.length > 0);
        if (!porteuses.length) continue;
        for (const c of CODEX) {
          const byId = new Map(c.items.map((i) => [i.id, i]));
          if (arr.some((e) => !byId.has(e.id as string))) continue; // couverture PARTIELLE : hors mapping
          for (const e of porteuses) if (byId.get(e.id as string)!.maison !== e.maison) muets.push(`${c.key}/${e.id}`);
        }
      }
    }
    expect(muets).toEqual([]);
  });
});

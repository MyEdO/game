/**
 * CLIQUET NOMINATIF « un enjeu porte sa RÈGLE » (#1117 L0b) — jumeau du cliquet « une étape dit son
 * enjeu », à l'étage de la DONNÉE : chaque entrée de `stakes.json`
 * doit renvoyer vers la fiche de sa règle, pour que la règle soit à UN CLIC.
 *
 * Le schéma EXIGE cette porte de toute cascade sauf le voyage (`schemas/defs/stakes.ts`) ; le stock
 * VOYAGE restant est ÉNUMÉRÉ nominativement et DÉCROISSANT : chaque lot de curation (patron L0a)
 * retire ses ids d'ici. Un renvoi MORT casse au parse (`foyerDeRegleSchema`,
 * `src/data/schemas/grammaire/valeurs.ts`).
 */
import { describe, it, expect } from 'vitest';
import {
  STAKES,
  regles, skills, symptoms, etats, talents, qualities, spells,
  psychologies, seaShanties, crewTestTypes, maladies, maneuvers, resolveStake,
  mutations, mutationTables, interludeEvents, trappings, traits, creatures, ACTIVITIES,
} from './index';
import { CATEGORY_BY_SOURCE_KIND } from '../engine/types';
import { STRUCTURE_CRITICALS } from './structureCriticals';
import { ARTILLERY_MISFIRE } from './artilleryMisfire';
import miscastRawJson from './miscast.json';
import { rangeesDe } from './rangees';
import type * as imparfaites from './schemas/defs/miscast';


/** Entrées d'enjeu de VOYAGE encore sans fiche — chacune attend SA curation verbatim (patron L0a).
 *  Mesuré le 2026-08-06 : 12 sur 33 ; 11 sur 41 depuis que l'Exposition renvoie à SA fiche (#1262 V2
 *  L6b — EDOC 08 l.90 convoque le Test de LDB p181 : UNE entrée sert la nuit ET l'Étape terrestre).
 *  Retirer un id d'ici est le geste de solde. */
const VOYAGE_STAKES = STAKES.filter((e) => e.cascade === 'voyage');
const VOYAGE_SANS_REGLE = [
  // Fluvial — périls de rivière (MSRC 7 : tables de dangers).
  'fleuve-peril-evitement',
  'fleuve-peril-detection',
  // Maritime — survitesse, rythme forcé, épuisement, maladies de bord, exposition, dégagement.
  'mer-survitesse',
  'mer-forcer-le-rythme',
  'mer-epuisement',
  'mer-scorbut',
  'mer-mal-de-mer',
  'mer-tonneau-expose',
  'mer-tonneau-contamine',
  'mer-degagement',
];

/** UN id RÉEL par catégorie Codex atteignable depuis une nature de source — la sonde du chemin RÉEL
 *  (`resolveStake`) : un pool absent rendrait `rule: undefined` sur une entrée pourtant existante. */
const PROBE_ID: Record<string, string> = {
  spells: spells[0].id, talents: talents[0].id, traits: traits[0].id, trappings: trappings[0].id,
  qualities: qualities[0].id, maladies: maladies[0].id, symptoms: symptoms[0].id,
  mutations: mutations[0].id, etats: etats[0].id, psychologies: psychologies[0].id,
  maneuvers: maneuvers[0].id, creatures: creatures[0].id, activities: ACTIVITIES[0].id,
  regles: regles[0].id, tavernGames: 'cerevis',
  imparfaiteMineure: 'mineure-signe-de-sorciere', imparfaiteMajeure: 'majeure-voix-fantomatiques',
  imparfaiteMineureVdm: 'mineure-vdm-signe-de-sorciere', imparfaiteMajeureVdm: 'majeure-vdm-voix-fantomatiques',
  colereDesDieux: 'colere-purifier-la-chair',
};

describe('cliquet — un enjeu porte sa RÈGLE (#1117)', () => {
  it('le stock VOYAGE sans règle est EXACTEMENT celui énuméré (ni plus — ni périmé)', () => {
    const sans: string[] = VOYAGE_STAKES.filter((e) => !e.rule).map((e) => e.id).sort();
    const attendu = [...VOYAGE_SANS_REGLE].sort();
    const neufs = sans.filter((id) => !VOYAGE_SANS_REGLE.includes(id));
    expect(neufs, 'entrée d’enjeu NEUVE sans règle — une entrée qui naît naît avec sa fiche').toEqual([]);
    const soldes = VOYAGE_SANS_REGLE.filter((id) => !sans.includes(id));
    expect(soldes, 'stock PÉRIMÉ : ces entrées ont désormais leur règle — les retirer de la liste').toEqual([]);
    expect(sans).toEqual(attendu);
  });

  it('le stock DÉCROÎT : le plafond mesuré ne remonte pas', () => {
    expect(VOYAGE_STAKES.filter((e) => !e.rule).length).toBeLessThanOrEqual(11);
  });

  /**
   * Fiches curées en L1a pour les MODALES MONO : chaque fiche curée pour un jet est référencée par un
   * enjeu de `stakes.json`. Une fiche qui perdrait son référent (câblage retiré) rougit — c'est la dette
   * muette que l'amendement A combat.
   */
  const FICHES_L1A_CABLEES = [
    'course', 'desengagement', 'fuite', 'chute',
    'influences-corruptrices', 'dissipation', 'au-contact',
  ];

  it('les fiches L1a existent ET sont CÂBLÉES — plus aucune en attente', () => {
    const absentes = FICHES_L1A_CABLEES.filter((id) => !regles.some((r) => r.id === id));
    expect(absentes, 'fiche annoncée par L1a mais absente du catalogue').toEqual([]);

    const referencees = new Set(
      STAKES.flatMap((e) => (e.rule?.type === 'regle' ? [e.rule.id] : [])),
    );
    const orphelines = FICHES_L1A_CABLEES.filter((id) => !referencees.has(id));
    expect(orphelines, 'fiche L1a SANS référent : son jet ne la cite plus (câblage L1b perdu)').toEqual([]);
  });

  /** Un enjeu de COMBAT à `entryFromSource` (#1117 L2) n'a pas de blanc-seing : le PRODUCTEUR doit
   *  pouvoir nommer une catégorie que le résolveur sait interroger. */
  it('chaque nature de SOURCE a son pool d’entrées', () => {
    // La table des natures de source est TOTALE — le pool doit l'être.
    const POOLS_MANQUANTS = Object.values(CATEGORY_BY_SOURCE_KIND).filter(
      (cat) => !resolveStake({ key: { dataset: 'combat', kind: 'agir-malgre-effet', entryId: PROBE_ID[cat], entryCategory: cat } }).rule,
    );
    expect(POOLS_MANQUANTS, 'catégorie de source sans pool : le renvoi replierait en silence').toEqual([]);
  });

  /** Cas NOMINATIF de la nature de source la plus récente (`colereDesDieux`) : une rangée de Colère
   *  exigeant un jet renvoie à SA PROPRE fiche Codex, jamais au foyer du `kind` (amendement A). */
  it('une rangée de Colère des dieux renvoie sa règle : sa fiche, pas celle du kind', () => {
    const r = resolveStake({
      key: { dataset: 'combat', kind: 'agir-malgre-effet', entryId: 'colere-purifier-la-chair', entryCategory: 'colereDesDieux' },
    });
    expect(r.rule).toEqual({ category: 'colereDesDieux', id: 'colere-purifier-la-chair' });
  });

  /**
   * L'enjeu d'une Psychologie vit SUR SON ENTRÉE (#1117 L2, patron `ActivityDef.stake`) : ses
   * conséquences lui sont propres (`resolution`/`failCondition`/`failAmount`/`becomes`), donc un
   * gabarit au `kind` serait tautologique. Toute entrée qui déclare un `test` doit porter son enjeu ;
   * une psychologie NEUVE arrive avec le sien, ou rougit ici.
   */
  it('chaque Psychologie qui LANCE un Test porte son enjeu, et l’enjeu prime sur le gabarit du kind', () => {
    const sans = psychologies.filter((p) => p.test && !p.stake).map((p) => p.id);
    expect(sans, 'psychologie testable sans enjeu : son étape retomberait sur le gabarit générique').toEqual([]);
    const sansForme = psychologies.filter((p) => p.stake && !p.stakeForm).map((p) => p.id);
    expect(sansForme, 'enjeu sans forme déclarée (stakeForm)').toEqual([]);
    // Chemin RÉEL : la descente à l'entrée doit rendre le texte DE L'ENTRÉE, pas celui du kind.
    const gabarit = STAKES.find((e) => e.id === 'combat-psychologie')!.template;
    for (const p of psychologies.filter((x) => x.stake)) {
      const r = resolveStake({ key: { dataset: 'combat', kind: 'combat-psychologie', entryId: p.id }, values: { indice: 2 } });
      expect(r.text, `${p.id} : l’étape rend le gabarit du kind au lieu de l’enjeu de l’entrée`).not.toBe(gabarit);
      expect(r.rule, `${p.id} : renvoi hors de sa propre fiche`).toEqual({ category: 'psychologies', id: p.id });
    }
  });

  /**
   * MÊME contrat pour les MANŒUVRES (#1117 L2 vague 4b) : `applyManeuverEffects` exécute des
   * `TriggeredEffect[]` AUTHORÉS par manœuvre — aucune formule commune, donc rien de générique à
   * dire au `kind`. Une manœuvre qui fait LANCER sa cible (`defense` autre qu'`auto`) doit énoncer
   * ce que ce jet met en jeu ; toutes portent leur enjeu, y compris celles à `effects: []`, qui le
   * disent honnêtement. Une manœuvre NEUVE arrive avec le sien, ou rougit ici.
   */
  it('chaque manœuvre porte son enjeu, et l’enjeu prime sur le gabarit du kind', () => {
    const testantes = maneuvers.filter((m) => m.defense && m.defense !== 'auto');
    expect(testantes.length, 'aucune manœuvre à jet mesurée : le critère a glissé').toBeGreaterThan(0);
    const sansJet = testantes.filter((m) => !m.stake).map((m) => m.id);
    expect(sansJet, 'manœuvre qui fait LANCER sa cible sans enjeu : l’étape retomberait sur le gabarit générique').toEqual([]);
    const sans = maneuvers.filter((m) => !m.stake).map((m) => m.id);
    expect(sans, 'manœuvre sans enjeu — même à `effects: []`, elle doit le dire').toEqual([]);
    const sansForme = maneuvers.filter((m) => m.stake && !m.stakeForm).map((m) => m.id);
    expect(sansForme, 'enjeu sans forme déclarée (stakeForm)').toEqual([]);
    // Chemin RÉEL : la descente à l'entrée doit rendre le texte DE L'ENTRÉE, pas celui du kind.
    const gabarit = STAKES.find((e) => e.id === 'combat-manoeuvre-defense')!.template;
    // Les trous d'un enjeu (`{regleDuType}` du Souffle) reçoivent les valeurs de la composition (`ManeuverDef.enjeu`).
    const remplir = (texte: string) => texte.replace(/\{(\w+)\}/g, (_m, nom: string) => `«${nom}»`);
    for (const m of maneuvers) {
      const values = Object.fromEntries([...(m.stake ?? '').matchAll(/\{(\w+)\}/g)].map(([, nom]) => [nom, `«${nom}»`]));
      const r = resolveStake({ key: { dataset: 'combat', kind: 'combat-manoeuvre-defense', entryId: m.id }, ...(Object.keys(values).length ? { values } : {}) });
      expect(r.text, `${m.id} : l’étape rend le gabarit du kind au lieu de l’enjeu de l’entrée`).not.toBe(gabarit);
      expect(r.text, `${m.id} : enjeu vide`).toBe(remplir(m.stake!));
      expect(r.rule, `${m.id} : renvoi hors de sa propre fiche`).toEqual({ category: 'maneuvers', id: m.id });
    }
  });

  /** Une `entryCategory` ne vaut que si le RÉSOLVEUR sait l'interroger (`STAKE_ENTRY_POOLS`,
   *  `src/data/index.ts`) : sinon le renvoi replie SILENCIEUSEMENT sur le foyer du kind — le repli
   *  déclaré deviendrait un repli subi. Mesuré SUR LE CHEMIN RÉEL (`resolveStake` avec un id VRAI de
   *  la catégorie), jamais sur une copie parallèle de la table de pools. */
  it('chaque `entryCategory` déclarée fait DESCENDRE le renvoi à l’entrée jouée', () => {
    const POOLS: Record<string, { id: string }[]> = {
      symptoms, seaShanties, crewTestTypes, maladies, psychologies, maneuvers, spells, skills,
      // Familles à TABLE (vague 4b) : la ligne tirée est l'entrée jouée — les pools sont lus sur les
      // MÊMES fichiers que le Codex édite, jamais sur une copie du résolveur.
      mutations, mutationTables, interludeEvents,
      artilleryMisfire: ARTILLERY_MISFIRE,
      structureCriticals: STRUCTURE_CRITICALS,
      colereDesDieux: rangeesDe<typeof imparfaites>(miscastRawJson, 'miscast-colere'),
    };
    const muettes: string[] = [];
    for (const e of STAKES) {
      if (!e.entryCategory) continue;
      const pool = POOLS[e.entryCategory];
      if (!pool?.length) { muettes.push(`${e.id} → catégorie « ${e.entryCategory} » inconnue du test`); continue; }
      const entryId = pool[0].id;
      // Les TROUS du gabarit sont remplis d'une valeur sonde : `resolveStake` est fail-closed sur un
      // trou vide, et ce test-ci mesure le RENVOI, pas le texte (la valeur réelle vient du producteur).
      const values = Object.fromEntries([...(e.template ?? '').matchAll(/\{(\w+)\}/g)].map((m) => [m[1], '·']));
      const rule = resolveStake({ key: { dataset: e.cascade, kind: e.id, entryId }, values }).rule;
      if (rule?.category !== e.entryCategory || rule.id !== entryId) {
        muettes.push(`${e.id} → attendu ${e.entryCategory}:${entryId}, obtenu ${rule ? `${rule.category}:${rule.id}` : 'aucun renvoi'}`);
      }
    }
    expect(muettes, 'entryCategory sans pool dans le résolveur : le renvoi replie en silence sur le kind').toEqual([]);
  });

  /** #2968 L19 — l'enjeu se résout à son id, dans sa cascade : `{ dataset: cascade, kind: id }` rend SON
   *  gabarit et SON foyer. */
  it('chaque enjeu de `stakes.json` se résout à SON id, dans SA cascade', () => {
    const ecarts: string[] = [];
    for (const e of STAKES) {
      const values = Object.fromEntries([...(e.template ?? '').matchAll(/\{(\w+)\}/g)].map((m) => [m[1], '·']));
      const r = resolveStake({ key: { dataset: e.cascade, kind: e.id }, values });
      const attendu = e.template?.replace(/\{\w+\}/g, '·');
      if (r.text !== attendu || r.rule?.id !== e.rule?.id) {
        ecarts.push(`${e.cascade}/${e.id} → texte ${r.text === attendu ? 'tenu' : 'ÉTRANGER'}, foyer ${r.rule?.id ?? 'aucun'} ≠ ${e.rule?.id ?? 'aucun'}`);
      }
    }
    expect(ecarts, 'une clé résolue hors de sa cascade sert l’enjeu d’une autre entrée').toEqual([]);
  });
});

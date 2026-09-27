/**
 * CLIQUET NOMINATIF « un enjeu porte sa RÈGLE » (#1117 L0b) — jumeau du cliquet « une étape dit son
 * enjeu » (`state/cascade-step-stake-guard`), à l'étage de la DONNÉE : chaque entrée d'un dataset
 * d'enjeux doit renvoyer vers une fiche de `regles.json`, pour que la règle soit à UN CLIC.
 *
 * Le stock RESTANT est ÉNUMÉRÉ nominativement et DÉCROISSANT : chaque lot de curation (patron L0a)
 * retire ses ids d'ici. Fail-closed : une entrée NEUVE sans règle, ou un renvoi MORT, échoue.
 * La nuit est SOLDÉE (15/15 depuis L0a) — aucune tolérance n'y est ouverte.
 */
import { describe, it, expect } from 'vitest';
import {
  NIGHT_STAKES, VOYAGE_STAKES, FLOW_STAKES, COMBAT_STAKES,
  regles, skills, symptoms, etats, talents, qualities, spells,
  characteristics, psychologies, seaShanties, crewTestTypes, maladies, maneuvers, resolveStake,
  mutations, mutationTables, interludeEvents, trappings, traits, creatures, ACTIVITY_STAKES,
} from './index';
import { CATEGORY_BY_SOURCE_KIND } from '../engine/types';
import { STEAM_BREAKDOWNS } from '../engine/shipBuild';
import { STRUCTURE_CRITICALS } from './structureCriticals';
import miscastRawJson from './miscast.json';


/** Entrées d'enjeu de VOYAGE encore sans fiche — chacune attend SA curation verbatim (patron L0a).
 *  Mesuré le 2026-08-06 : 12 sur 33 ; 11 sur 41 depuis que l'Exposition renvoie à SA fiche (#1262 V2
 *  L6b — EDOC 08 l.90 convoque le Test de LDB p181 : UNE entrée sert la nuit ET l'Étape terrestre).
 *  Retirer un id d'ici est le geste de solde. */
const VOYAGE_SANS_REGLE = [
  // Fluvial — périls de rivière (MSRC 7 : tables de dangers).
  'river-peril-nav',
  'river-peril-detect',
  // Maritime — survitesse, rythme forcé, épuisement, maladies de bord, exposition, dégagement.
  'sea-overspeed',
  'sea-force-pace',
  'sea-epuisement',
  'sea-scorbut',
  'sea-mal-de-mer',
  'sea-tonneau-expose',
  'sea-tonneau-contamine',
  'sea-degagement',
];

/** UN id RÉEL par catégorie Codex atteignable depuis une nature de source — la sonde du chemin RÉEL
 *  (`resolveStake`) : un pool absent rendrait `rule: undefined` sur une entrée pourtant existante. */
const PROBE_ID: Record<string, string> = {
  spells: spells[0].id, talents: talents[0].id, traits: traits[0].id, trappings: trappings[0].id,
  qualities: qualities[0].id, maladies: maladies[0].id, symptoms: symptoms[0].id,
  mutations: mutations[0].id, etats: etats[0].id, psychologies: psychologies[0].id,
  maneuvers: maneuvers[0].id, creatures: creatures[0].id, activities: ACTIVITY_STAKES[0].id,
  regles: regles[0].id, tavernGames: 'cerevis',
  miscastMinor: 'mineure-signe-de-sorciere', miscastMajor: 'majeure-voix-fantomatiques',
  miscastWrath: 'colere-purifier-la-chair',
};

describe('cliquet — un enjeu porte sa RÈGLE (#1117)', () => {
  it('la cascade de NUIT est soldée : chaque entrée renvoie vers une fiche', () => {
    const sans = NIGHT_STAKES.filter((e) => !e.rule).map((e) => e.id);
    expect(sans, 'entrée de nuit sans règle — la nuit est soldée depuis L0a').toEqual([]);
  });

  it('le stock VOYAGE sans règle est EXACTEMENT celui énuméré (ni plus — ni périmé)', () => {
    const sans = VOYAGE_STAKES.filter((e) => !e.rule).map((e) => e.id).sort();
    const attendu = [...VOYAGE_SANS_REGLE].sort();
    const neufs = sans.filter((id) => !VOYAGE_SANS_REGLE.includes(id));
    expect(neufs, 'entrée d’enjeu NEUVE sans règle — une entrée qui naît naît avec sa fiche').toEqual([]);
    const soldes = VOYAGE_SANS_REGLE.filter((id) => !sans.includes(id));
    expect(soldes, 'stock PÉRIMÉ : ces entrées ont désormais leur règle — les retirer de la liste').toEqual([]);
    expect(sans).toEqual(attendu);
  });

  it('aucun renvoi MORT : chaque `rule` déclarée existe dans SON foyer', () => {
    // Le foyer peut être une ENTITÉ (amendement A) : la catégorie voyage avec l'id. Les trois datasets
    // passent par le MÊME contrôle — un renvoi mort est un renvoi mort, quelle que soit la famille.
    const FOYERS: Record<string, { id: string }[]> = {
      regles, skills, symptoms, etats, talents, qualities, spells,
      characteristics, psychologies, seaShanties, crewTestTypes, maladies, maneuvers,
      steamBreakdowns: STEAM_BREAKDOWNS,
    };
    const cat = (e: { ruleCategory?: string | undefined }) => e.ruleCategory ?? 'regles';
    const morts = [...NIGHT_STAKES, ...VOYAGE_STAKES, ...FLOW_STAKES, ...COMBAT_STAKES]
      .filter((e) => e.rule && !(FOYERS[cat(e as { ruleCategory?: string })] ?? []).some((x) => x.id === e.rule))
      .map((e) => `${e.id} → ${cat(e as { ruleCategory?: string })}:${e.rule}`);
    expect(morts, 'renvoi vers un foyer inexistant').toEqual([]);
  });

  it('le stock DÉCROÎT : le plafond mesuré ne remonte pas', () => {
    expect(VOYAGE_STAKES.filter((e) => !e.rule).length).toBeLessThanOrEqual(11);
  });

  /**
   * Fiches curées en L1a pour les MODALES MONO : leur consommateur (`flow-stakes`, id de jet
   * {flow, phase}) est né en L1b — le stock d'attente est SOLDÉ. L'assertion reste, INVERSÉE : chaque
   * fiche curée pour un jet DOIT désormais être référencée par un dataset d'enjeu. Une fiche qui
   * perdrait son référent (câblage retiré) rougit — c'est la dette muette que l'amendement A combat.
   */
  const FICHES_L1A_CABLEES = [
    'course', 'desengagement', 'fuite', 'chute',
    'influences-corruptrices', 'dissipation', 'au-contact',
  ];

  it('les fiches L1a existent ET sont CÂBLÉES — plus aucune en attente', () => {
    const absentes = FICHES_L1A_CABLEES.filter((id) => !regles.some((r) => r.id === id));
    expect(absentes, 'fiche annoncée par L1a mais absente du catalogue').toEqual([]);

    const referencees = new Set(
      [...NIGHT_STAKES, ...VOYAGE_STAKES, ...FLOW_STAKES].map((e) => e.rule).filter((r): r is string => !!r),
    );
    const orphelines = FICHES_L1A_CABLEES.filter((id) => !referencees.has(id));
    expect(orphelines, 'fiche L1a SANS référent : son jet ne la cite plus (câblage L1b perdu)').toEqual([]);
  });

  /**
   * Les enjeux de MODALE MONO sont soldés dès leur naissance : chaque entrée porte SA porte de
   * lecture — le foyer du jet (`rule` + `ruleCategory`) ou la catégorie de l'ENTRÉE jouée
   * (`entryCategory`). Aucune tolérance ouverte : le dataset naît sans dette.
   */
  it('chaque enjeu de modale mono porte SA porte (foyer ou entrée)', () => {
    const sans = FLOW_STAKES.filter((e) => !e.entryCategory && !(e.rule && e.ruleCategory)).map((e) => e.id);
    expect(sans, 'enjeu de modale mono sans foyer ni catégorie d’entrée').toEqual([]);
  });

  /** Même contrat pour la cascade de COMBAT (#1117 L2) : le dataset naît sans dette. */
  it('chaque enjeu de combat porte SA porte (foyer, entrée déclarée, ou entrée de la SOURCE)', () => {
    const sans = COMBAT_STAKES.filter((e) => !e.entryCategory && !e.entryFromSource && !(e.rule && e.ruleCategory)).map((e) => e.id);
    expect(sans, 'enjeu de combat sans foyer ni catégorie d’entrée').toEqual([]);
    // `entryFromSource` n'est pas un blanc-seing : le PRODUCTEUR doit pouvoir nommer une catégorie que
    // le résolveur sait interroger. La table des natures de source est TOTALE — le pool doit l'être.
    const POOLS_MANQUANTS = Object.values(CATEGORY_BY_SOURCE_KIND).filter(
      (cat) => !resolveStake({ key: { dataset: 'combat', kind: 'actGate', entryId: PROBE_ID[cat], entryCategory: cat } }).rule,
    );
    expect(POOLS_MANQUANTS, 'catégorie de source sans pool : le renvoi replierait en silence').toEqual([]);
  });

  /** Cas NOMINATIF de la nature de source la plus récente (`miscastWrath`) : une rangée de Colère
   *  exigeant un jet renvoie à SA PROPRE fiche Codex, jamais au foyer du `kind` (amendement A). */
  it('une rangée de Colère des dieux renvoie sa règle : sa fiche, pas celle du kind', () => {
    const r = resolveStake({
      key: { dataset: 'combat', kind: 'actGate', entryId: 'colere-purifier-la-chair', entryCategory: 'miscastWrath' },
    });
    expect(r.rule).toEqual({ category: 'miscastWrath', id: 'colere-purifier-la-chair' });
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
    const gabarit = COMBAT_STAKES.find((e) => e.kind === 'combatPsych')!.template;
    for (const p of psychologies.filter((x) => x.stake)) {
      const r = resolveStake({ key: { dataset: 'combat', kind: 'combatPsych', entryId: p.id }, values: { indice: 2 } });
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
    const gabarit = COMBAT_STAKES.find((e) => e.kind === 'maneuverDefense')!.template;
    for (const m of maneuvers) {
      const r = resolveStake({ key: { dataset: 'combat', kind: 'maneuverDefense', entryId: m.id } });
      expect(r.text, `${m.id} : l’étape rend le gabarit du kind au lieu de l’enjeu de l’entrée`).not.toBe(gabarit);
      expect(r.text, `${m.id} : enjeu vide`).toBe(m.stake);
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
      structureCriticals: STRUCTURE_CRITICALS,
      miscastWrath: (miscastRawJson as unknown as { id: string; entries: { id: string }[] }[]).find((d) => d.id === 'miscast-colere')!.entries,
    };
    const muettes: string[] = [];
    for (const [dataset, e] of [
      ...FLOW_STAKES.map((x) => ['flow' as const, x] as const),
      ...COMBAT_STAKES.map((x) => ['combat' as const, x] as const),
    ]) {
      if (!e.entryCategory) continue;
      const pool = POOLS[e.entryCategory];
      if (!pool?.length) { muettes.push(`${e.id} → catégorie « ${e.entryCategory} » inconnue du test`); continue; }
      const entryId = pool[0].id;
      const kind = 'kind' in e ? e.kind : e.id;
      // Les TROUS du gabarit sont remplis d'une valeur sonde : `resolveStake` est fail-closed sur un
      // trou vide, et ce test-ci mesure le RENVOI, pas le texte (la valeur réelle vient du producteur).
      const values = Object.fromEntries([...(e.template ?? '').matchAll(/\{(\w+)\}/g)].map((m) => [m[1], '·']));
      const rule = resolveStake({ key: { dataset, kind, entryId }, values }).rule;
      if (rule?.category !== e.entryCategory || rule.id !== entryId) {
        muettes.push(`${e.id} → attendu ${e.entryCategory}:${entryId}, obtenu ${rule ? `${rule.category}:${rule.id}` : 'aucun renvoi'}`);
      }
    }
    expect(muettes, 'entryCategory sans pool dans le résolveur : le renvoi replie en silence sur le kind').toEqual([]);
  });
});

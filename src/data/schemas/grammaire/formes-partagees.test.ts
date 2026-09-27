/**
 * `trappingRefSchema` (`src/data/schemas/grammaire/reference.ts`) — branche `{creatureId}` ouverte au SOCLE
 * POSSESSIONS #615/#617 §9 (dotation BÊTE, `creatures.json`), en plus des branches existantes.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { trappingRefSchema } from './reference';
import { flowTestSchema, gameOpSchema } from './mecanique';
import { TESTS_DE_CORRUPTION, bornesSchema, ecartDeCoPresenceDesBornes, plageOuverteSchema, plageSchema } from './valeurs';
import { schemaForFile, validateDataset, validateDocument } from '../validate';
import criticals from '../../criticals.json';
import localisation from '../../localisation.json';
import structureCriticals from '../../structure-criticals.json';
import riverCriticals from '../../river-criticals.json';
import shipCriticals from '../../ship-criticals.json';
import waterExposure from '../../water-exposure.json';
import mutationTables from '../../mutationTables.json';
import obsessions from '../../obsessions.json';
import miscast from '../../miscast.json';
import arcanePhenomena from '../../arcane-phenomena.json';
import ventsTourbillonnants from '../../vents-tourbillonnants.json';
import tables from '../../tables.json';
import interludeEvents from '../../interludeEvents.json';
import drunkenness from '../../drunkenness.json';
import weather from '../../weather.json';
import tavernGames from '../../tavernGames.json';
import artilleryMisfire from '../../artillery-misfire.json';
import crewMorale from '../../crew-morale.json';
import drivingMishap from '../../driving-mishap.json';
import landCargo from '../../land-cargo.json';
import seaCargo from '../../sea-cargo.json';
import massBattle from '../../mass-battle.json';
import navalProgression from '../../naval-progression.json';
import riverNavigation from '../../river-navigation.json';
import seaEvents from '../../sea-events.json';
import seaWeather from '../../sea-weather.json';
import steamBreakdown from '../../steam-breakdown.json';
import advancementCosts from '../../advancementCosts.json';
import reglesOptionnelles from '../../reglesOptionnelles.json';
import species from '../../species.json';
import vehicles from '../../vehicles.json';
import trappings from '../../trappings.json';
import structures from '../../structures.json';
import careers from '../../careers.json';
import navalTraits from '../../naval-traits.json';
import qualities from '../../qualities.json';
import traits from '../../traits.json';
import { corruptionExposureSchema } from '../defs-scenes/effets';
import { menaceIds } from '../../../engine/menace';
import { resolveTrappingChoices } from '../../../engine/trappingChoices';
import { trappingRefLabel, type TrappingRef } from '../../index';


/** Les paths de DONNÉE des fautes de `valeur` au schéma de `fichier` — le LIEU rendu nomme un élément
 *  d'une collection à clé par sa clé (`schemas/validate.ts`), le path garde son rang. */
const pathsRefuses = (fichier: string, valeur: unknown): string[] =>
  (validateDocument(schemaForFile(fichier)!, valeur) ?? []).map((f) => f.chemin.join('.'));

describe('trappingRefSchema — branches de TrappingRef', () => {
  it('accepte {id} de catalogue (+ count optionnel)', () => {
    expect(trappingRefSchema.safeParse({ id: 'epee-courte' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ id: 'epee-courte', count: { fixed: 2 } }).success).toBe(true);
  });

  it('accepte {text} narratif hors catalogue', () => {
    expect(trappingRefSchema.safeParse({ text: 'collection d’alcool sans pareille' }).success).toBe(true);
  });

  it('accepte {vehicleId} — dotation véhicule', () => {
    expect(trappingRefSchema.safeParse({ vehicleId: 'chariot-leger' }).success).toBe(true);
  });

  it('accepte {creatureId} — dotation bête (#615/#617 §9)', () => {
    expect(trappingRefSchema.safeParse({ creatureId: 'mule' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ creatureId: 'mule', count: { fixed: 1 } }).success).toBe(true);
  });

  it('refuse un mélange de branches (strictObject)', () => {
    expect(trappingRefSchema.safeParse({ id: 'epee-courte', vehicleId: 'chariot-leger' }).success).toBe(false);
    expect(trappingRefSchema.safeParse({ creatureId: 'mule', vehicleId: 'chariot-leger' }).success).toBe(false);
  });

  it('accepte {choice} — dotation « X ou Y » migrée (chantier #654 Lot 3)', () => {
    const ref = { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] };
    expect(trappingRefSchema.safeParse(ref).success).toBe(true);
  });

  it('{choice} migré (Arbalète de poing ou pistolet) résout la 2e branche via resolveTrappingChoices', () => {
    const ref: TrappingRef = { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] };
    const label = trappingRefLabel(ref);
    expect(resolveTrappingChoices([ref], { [label]: trappingRefLabel({ id: 'pistolet' }) })).toEqual([
      { id: 'pistolet' },
    ]);
  });
});

/**
 * `plageSchema` (`grammaire/valeurs.ts`, vague `plage` #1463 P1) — les deux bornes d'une rangée de
 * table de tirage se déclarent UNE fois et se composent par la SHAPE. Le spread est un ANGLE MORT du
 * scanner de redéclarations (`scripts/docs/lib/structures-scan.mts` lit les littéraux par AST et ne
 * résout pas un spread, cf. `grammaire/reference.ts:37-38`) : l'extinction d'une ligne de stock ne
 * prouve donc RIEN sur le parse. Ce gate est POSITIF — il mesure que la garde des bornes tient
 * encore, au schéma partagé ET à chaque site adoptant, par la porte de validation réelle
 * (`validateDataset`).
 */
describe('plageSchema — fourchette PARTAGÉE des rangées de table', () => {
  const CHARGE = { min: 1, max: 10 };

  it('accepte les deux bornes, et REFUSE une rangée sans `min` / sans `max` — message NOMMANT la borne', () => {
    expect(plageSchema.safeParse(CHARGE).success).toBe(true);
    for (const borne of ['min', 'max'] as const) {
      const { [borne]: _absente, ...ampute } = CHARGE;
      const r = plageSchema.safeParse(ampute);
      expect(r.success, `une rangée sans \`${borne}\` a été ACCEPTÉE`).toBe(false);
      expect(r.error!.issues.map((i) => i.path.join('.')), `l'issue ne nomme pas \`${borne}\``).toContain(borne);
    }
  });

  it('reste STRICT après composition par SHAPE — une clé inconnue est refusée', () => {
    const etendu = z.strictObject({ ...plageSchema.shape, mutation: plageSchema.shape.min });
    expect(etendu.safeParse({ ...CHARGE, mutation: 3 }).success).toBe(true);
    expect(etendu.safeParse({ ...CHARGE, mutation: 3, inconnue: 1 }).success).toBe(false);
    expect(etendu.safeParse({ ...CHARGE }).success).toBe(false); // la charge utile reste requise
  });

  /** Position d'un jeu de taverne par son ID (jamais par sa place : la donnée est réordonnable au Codex). */
  const jeuDeTaverne = (id: string) => String((tavernGames as ReadonlyArray<{ id: string }>).findIndex((j) => j.id === id));
  /** Position d'un document-table de Blessures critiques par son ID — même règle : jamais par son rang. */
  const docCritique = (id: string) => String((criticals as ReadonlyArray<{ id: string }>).findIndex((d) => d.id === id));

  /**
   * Chaque document ADOPTANT est mesuré sur SA donnée réelle : on ampute la première rangée à deux
   * bornes de son `min`, et la porte doit refuser en nommant le CHEMIN de la borne. Une composition
   * débranchée (spread perdu, borne rendue optionnelle) laisserait passer.
   */
  const SITES: ReadonlyArray<readonly [string, unknown, string[]?]> = [
    // Les DEUX jeux vivent dans le même fichier (#1657 B2a) : chacun se mesure sur SON document-table,
    // une composition débranchée ne pouvant se cacher derrière le premier rencontré.
    ['criticals.json', criticals, [docCritique('criticals-ldb-tete'), 'entries']],
    ['criticals.json', criticals, [docCritique('criticals-aa-tete'), 'entries']],
    ['localisation.json', localisation],
    ['structure-criticals.json', structureCriticals],
    ['river-criticals.json', riverCriticals],
    ['ship-criticals.json', shipCriticals],
    // Descente EXPLICITE : `modifiers[].auto` porte aussi deux bornes (`{kind:'woundsLost', op:'between'}`),
    // mais ce sont des bornes de BLESSURES PERDUES dans une condition — pas une rangée de table de
    // tirage, donc hors composition. La table lue par `findTableEntry` est `diseases`.
    ['water-exposure.json', waterExposure, ['diseases']],
    ['mutationTables.json', mutationTables],
    ['obsessions.json', obsessions],
    ['miscast.json', miscast],
    ['arcane-phenomena.json', arcanePhenomena],
    ['vents-tourbillonnants.json', ventsTourbillonnants],
    ['tables.json', tables],
    ['interludeEvents.json', interludeEvents],
    ['drunkenness.json', drunkenness],
    ['weather.json', weather],
    // Deux sites de rangée y composent (`table` d'un jeu à score par plage, `pot.rows` d'un jeu à mises) ;
    // sans descente, le parcours tomberait sur `pot.targetRange` — la plage adoptée NUE en P1-a.
    ['tavernGames.json', tavernGames, [jeuDeTaverne('torchon'), 'table']],
    ['tavernGames.json', tavernGames, [jeuDeTaverne('al-zahr'), 'pot', 'rows']],
    ['artillery-misfire.json', artilleryMisfire],
    ['crew-morale.json', crewMorale, ['bands']],
    ['driving-mishap.json', drivingMishap],
    // Deux tables de tirage distinctes : la qualité SECRÈTE du vin (d100 de prix) et les rumeurs
    // commerciales (d100 de prose) — la seconde ne serait jamais atteinte sans descente.
    ['land-cargo.json', landCargo, ['wineQuality']],
    ['land-cargo.json', landCargo, ['rumours']],
    ['mass-battle.json', massBattle, ['hazards']],
    ['naval-progression.json', navalProgression],
    // Les deux tables d10 du vent fluvial partagent le MÊME schéma de rangée (`bandRow`) : chacune
    // se mesure, une composition débranchée ne pouvant se cacher derrière la première rencontrée.
    ['river-navigation.json', riverNavigation, ['windForces']],
    ['river-navigation.json', riverNavigation, ['windDirections']],
    ['sea-events.json', seaEvents, ['boardEvents']],
    ['sea-events.json', seaEvents, ['portEvents']],
    ['sea-events.json', seaEvents, ['fastVoyage', 'paliers']],
    ['sea-weather.json', seaWeather, ['table']],
    ['sea-weather.json', seaWeather, ['roseDesVents']],
    ['steam-breakdown.json', steamBreakdown],
  ];

  /** Chemin de la PREMIÈRE rangée `{min, max}` numériques rencontrée en parcours stable. */
  const premiereFourchette = (v: unknown, chemin: string[] = []): string[] | null => {
    if (Array.isArray(v)) {
      for (const [i, e] of v.entries()) {
        const t = premiereFourchette(e, [...chemin, String(i)]);
        if (t) return t;
      }
      return null;
    }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.min === 'number' && typeof o.max === 'number') return chemin;
      for (const [k, e] of Object.entries(o)) {
        const t = premiereFourchette(e, [...chemin, k]);
        if (t) return t;
      }
    }
    return null;
  };

  const ampute = (v: unknown, chemin: readonly string[]): unknown => {
    if (!chemin.length) {
      const { min: _min, ...reste } = v as Record<string, unknown>;
      return reste;
    }
    const [tete, ...suite] = chemin;
    if (Array.isArray(v)) return v.map((e, i) => (String(i) === tete ? ampute(e, suite) : e));
    return { ...(v as Record<string, unknown>), [tete]: ampute((v as Record<string, unknown>)[tete], suite) };
  };

  const descend = (v: unknown, chemin: readonly string[]) =>
    chemin.reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], v);

  for (const [fichier, data, sous = []] of SITES) {
    it(`${fichier}${sous.length ? ` › ${sous.join('.')}` : ''} : sa donnée réelle passe, la MÊME rangée sans \`min\` est REFUSÉE`, () => {
      const relatif = premiereFourchette(descend(data, sous));
      const chemin = relatif && [...sous, ...relatif];
      expect(chemin, `aucune rangée {min,max} trouvée dans ${fichier}`).not.toBeNull();
      expect(validateDataset(fichier, data)).toBeNull();
      const err = validateDataset(fichier, ampute(data, chemin!));
      expect(err, `${fichier} accepte une rangée sans borne basse`).not.toBeNull();
      expect(pathsRefuses(fichier, ampute(data, chemin!))).toContain([...chemin!, 'min'].join('.'));
    });
  }
});

/**
 * `flowTestSchema.menace` (#1346) — CLÉ ÉTRANGÈRE vers un id de spec du talent « Résistance (Menace) »
 * (LDB 10 l.1016-1020). La liste est OUVERTE côté RAW : elle n'est donc PAS figée dans le code, elle
 * est résolue au catalogue (`talents.json`) à la VALIDATION. Un tag hors catalogue est refusé au
 * chargement DEV (`dev-validate`), au contrat CI (`schema-contract.test.ts`) et à la sauvegarde Codex.
 */
describe('flowTestSchema.menace — FK vers les specs du talent Résistance', () => {
  const parse = (menace?: string) => flowTestSchema.safeParse({ skill: { id: 'resistance' }, ...(menace != null ? { menace } : {}) });

  it('accepte un id de spec EXISTANT, et l’absence de tag', () => {
    for (const id of menaceIds()) expect(parse(id).success, `spec authorée « ${id} » refusée`).toBe(true);
    expect(parse().success).toBe(true); // un Test sans Menace reste valide
    expect(menaceIds().length).toBeGreaterThan(0); // le catalogue mesuré n'est pas vide
  });

  it('REFUSE le libellé capitalisé (« Poison ») — un id n’est pas un label', () => {
    const r = parse('Poison');
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message).join('\n')).toContain('menace « Poison »');
  });

  it('REFUSE un id hors catalogue, et le message DIT la valeur ET les valeurs admises', () => {
    const r = parse('exposition');
    expect(r.success).toBe(false);
    const msg = r.error!.issues.map((i) => i.message).join('\n');
    expect(msg).toContain('menace « exposition »');
    expect(msg).toContain('resistance');
    for (const id of menaceIds()) expect(msg).toContain(id);
  });
});

/**
 * `corruptionExposure.skill` (`refTestDeCorruption`, `grammaire/valeurs.ts`) — le Test d'Exposition se
 * joue avec l'UNE des deux Compétences que la règle offre (`LDB 19 l.23-75`). Une référence de
 * Compétence NUE laisserait passer les 100+ entrées de `skills.json` : le runtime
 * (`state/corruptionFlow.ts`) les raboterait en silence et la donnée mentirait. Les DEUX portes du
 * même concept — l'op `GameOp` et l'effet de scène — partagent la MÊME borne.
 */
describe('corruptionExposure.skill — borné aux deux Compétences du Test (LDB 19 l.23-75)', () => {
  const portes = {
    'op GameOp': (skill?: { id: string }) => gameOpSchema.safeParse({ op: 'corruptionExposure', level: 'mineure', ...(skill ? { skill } : {}) }),
    'effet de scène': (skill?: { id: string }) => corruptionExposureSchema.safeParse({ type: 'corruptionExposure', level: 'mineure', ...(skill ? { skill } : {}) }),
  };

  for (const [nom, parse] of Object.entries(portes)) {
    it(`${nom} : accepte les deux Compétences de l'alphabet, et l'absence (choix du joueur)`, () => {
      expect(TESTS_DE_CORRUPTION).toEqual(['resistance', 'calme']);
      for (const id of TESTS_DE_CORRUPTION) expect(parse({ id }).success, `« ${id} » refusé`).toBe(true);
      expect(parse().success).toBe(true);
    });

    it(`${nom} : REFUSE une Compétence hors alphabet, et le message NOMME la valeur et la paire`, () => {
      const r = parse({ id: 'charme' });
      expect(r.success).toBe(false);
      const msg = r.error!.issues.map((i) => i.message).join('\n');
      expect(msg).toContain('charme');
      expect(msg).toContain('resistance');
      expect(msg).toContain('calme');
      expect(msg).toContain('LDB 19 l.23-75');
    });
  }
});

/**
 * `plageOuverteSchema` (`grammaire/valeurs.ts`, #1463 L-gram-1) — la fourchette dont la DERNIÈRE
 * bande n'a pas de plafond (`max: null` ; LDB 07 l.49, bande « 71 et + » l.70). Même angle mort
 * qu'au-dessus : le scanner ne résout pas un spread, le gate est donc POSITIF et passe par la porte
 * réelle (`validateDataset`).
 */
describe('plageOuverteSchema — la bande FINALE reste OUVERTE', () => {
  it('accepte `max: null` et un plafond chiffré, REFUSE `max` absent et une borne non numérique', () => {
    expect(plageOuverteSchema.safeParse({ min: 71, max: null }).success).toBe(true);
    expect(plageOuverteSchema.safeParse({ min: 0, max: 5 }).success).toBe(true);
    for (const cas of [{ min: 71 }, { max: null }, { min: 71, max: '∞' }]) {
      expect(plageOuverteSchema.safeParse(cas).success, `${JSON.stringify(cas)} a été ACCEPTÉ`).toBe(false);
    }
    // Le nœud OUVERT ne se substitue pas au fermé : `plageSchema` refuse toujours la borne ouverte.
    expect(plageSchema.safeParse({ min: 71, max: null }).success).toBe(false);
  });

  it('advancementCosts.json : sa donnée réelle passe, la MÊME bande sans `min` est REFUSÉE', () => {
    const bandes = advancementCosts as ReadonlyArray<Record<string, unknown>>;
    expect(validateDataset('advancementCosts.json', bandes)).toBeNull();
    expect(bandes.filter((b) => b.max === null).length, 'plus aucune bande OUVERTE : la sonde ne mesure rien.').toBe(1);
    const { min: _absente, ...ampute } = bandes[0];
    const err = validateDataset('advancementCosts.json', [ampute, ...bandes.slice(1)]);
    expect(err, 'une bande sans borne basse est acceptée').not.toBeNull();
    expect(pathsRefuses('advancementCosts.json', [ampute, ...bandes.slice(1)])).toContain('0.min');
  });
});

/**
 * `bornesSchema` (`grammaire/valeurs.ts`, #1463 L-gram-1) — bornes de SAISIE d'un réglage, concept
 * `bornes` du lexique. Le refine de co-présence ne traverse pas le spread de la shape : le site le
 * re-branche sur la MÊME fonction (`ecartDeCoPresenceDesBornes`), et c'est cette liaison-là que le
 * volet `reglesOptionnelles.json` mesure à la porte réelle.
 */
describe('bornesSchema — les deux bornes d’un réglage vont par paire', () => {
  it('l’invariant a UN porteur : `ecartDeCoPresenceDesBornes`, que le nœud et le site appellent tous deux', () => {
    // Le nœud `bornesSchema` n'est consommé comme SCHÉMA par aucun def (le spread ne transporte pas
    // son refine) : ce qui se vérifie ici est la FONCTION partagée — la seule écriture de la règle,
    // appelée par le nœud ET par `defs/reglesOptionnelles.ts` (volet suivant, à la porte réelle).
    expect(ecartDeCoPresenceDesBornes({ min: 1, max: 10 })).toBeNull();
    expect(ecartDeCoPresenceDesBornes({})).toBeNull();
    expect(ecartDeCoPresenceDesBornes({ min: 1 })?.borne).toBe('max');
    expect(ecartDeCoPresenceDesBornes({ max: 10 })?.borne).toBe('min');
    // … et le nœud de la grammaire la porte bien, lui aussi (sa shape est ce que les sites épandent).
    expect(Object.keys(bornesSchema.shape).sort()).toEqual(['max', 'min', 'step']);
    expect(bornesSchema.safeParse({ min: 1, max: 10, step: 1 }).success).toBe(true);
    const r = bornesSchema.safeParse({ min: 1 });
    expect(r.success, 'le nœud accepte une borne SEULE').toBe(false);
    expect(r.error!.issues.map((i) => i.path.join('.'))).toContain('max');
  });

  it('reglesOptionnelles.json : sa donnée réelle passe, le MÊME réglage privé de `max` est REFUSÉ', () => {
    const regles = reglesOptionnelles as ReadonlyArray<Record<string, unknown>>;
    expect(validateDataset('reglesOptionnelles.json', regles)).toBeNull();
    const bornees = regles.filter((r) => typeof r.min === 'number' && typeof r.max === 'number');
    // 23→24 (#1599) : la fenêtre de conscience par Détermination (LDB 20 l.170).
    // 24→29 (#1612, 2026-09-06) : les CINQ réglages `param` de l'Activité Mendier, tous bornés —
    // `mendier-heures-par-jour` (1..12), `mendier-discours` (−30..30), `mendier-apparence-bonus`
    // (−30..30), `mendier-surpris-pct` (0..100) et `mendier-amende-sous` (0..240). LDB 09 l.97/l.99 ne
    // chiffre AUCUN d'entre eux (durée du créneau, discours, apparence, chance d'être surpris, sanction
    // des gardes) : cinq valeurs maison éditables, aucune figée au moteur.
    expect(bornees.length, 'plus aucun réglage borné : la sonde ne mesure rien.').toBe(29);
    expect(
      bornees.filter((r) => r.kind !== 'param').map((r) => r.id),
      'un réglage borné n’est pas un paramètre chiffré : la co-présence mesurée 29/29 ne porte plus sur la même population.',
    ).toEqual([]);
    const i = regles.indexOf(bornees[0]);
    const { max: _absente, ...ampute } = bornees[0];
    const err = validateDataset('reglesOptionnelles.json', [...regles.slice(0, i), ampute, ...regles.slice(i + 1)]);
    expect(err, 'un réglage à borne basse SEULE est accepté').not.toBeNull();
    expect(pathsRefuses('reglesOptionnelles.json', [...regles.slice(0, i), ampute, ...regles.slice(i + 1)])).toContain(`${i}.max`);
  });
});

/**
 * `water-exposure.json › modifiers[].auto` — le prédicat `{kind:'woundsLost', op:'between'}` porte
 * ses deux bornes par la SHAPE de `plageSchema` (#1463 L-gram-1). Ce ne sont pas les bornes d'une
 * rangée tirable (la table du document, `diseases`, compose depuis P1-a) : c'est le MÊME nœud de
 * bornes, sur un autre porteur.
 */
describe('water-exposure › auto.between — les deux bornes du prédicat', () => {
  it('sa donnée réelle passe, le MÊME prédicat sans `max` est REFUSÉ', () => {
    const doc = waterExposure as { modifiers: ReadonlyArray<Record<string, unknown>> };
    expect(validateDataset('water-exposure.json', doc)).toBeNull();
    const i = doc.modifiers.findIndex((m) => (m.auto as { op?: string } | undefined)?.op === 'between');
    expect(i, 'aucun prédicat `between` : la sonde ne mesure rien.').toBeGreaterThanOrEqual(0);
    const auto = doc.modifiers[i].auto as Record<string, unknown>;
    const { max: _absente, ...ampute } = auto;
    const modifiers = doc.modifiers.map((m, j) => (j === i ? { ...m, auto: ampute } : m));
    expect(
      validateDataset('water-exposure.json', { ...doc, modifiers }),
      'un prédicat `between` sans borne haute est accepté',
    ).not.toBeNull();
  });
});

/**
 * POPULATIONS DE RÉFÉRENCE entrées en garde au lot L-gram-2 (#1463) — sonde A du design jugé,
 * promue en contrat. Les quatre populations résolvent à 100 % contre leur catalogue, et chacune est
 * mesurée AVEC son cardinal : une population qui se viderait rendrait la garde vacueuse, une valeur
 * qui cesserait de résoudre est une FK morte. `ref(type)` refuse déjà l'id inconnu AU PARSE
 * (`grammaire/ref.ts`) — sauf pour les Atouts d'objet, qui passent par `qualityRefSchema` (sans FK,
 * #1615/#1621) : c'est LÀ que cette mesure est la seule garde.
 */
describe('références migrées — les 4 populations résolvent contre leur catalogue (#1463 L-gram-2)', () => {
  const ids = (liste: ReadonlyArray<{ id: string }>) => new Set(liste.map((e) => e.id));
  const CATALOGUES = {
    careers: ids(careers as ReadonlyArray<{ id: string }>),
    navals: ids(navalTraits as ReadonlyArray<{ id: string }>),
    qualities: ids(qualities as ReadonlyArray<{ id: string }>),
    traits: ids(traits as ReadonlyArray<{ id: string }>),
  };

  it('species.json › previewCareer — 27 aperçus, 27 carrières résolues', () => {
    const vus = (species as ReadonlyArray<{ previewCareer?: { id: string } }>).flatMap((s) => (s.previewCareer ? [s.previewCareer.id] : []));
    expect(vus.length, 'la population des aperçus de vitrine a disparu.').toBe(27);
    expect(vus.filter((id) => !CATALOGUES.careers.has(id)), 'carrière d’aperçu hors de careers.json').toEqual([]);
  });

  // 19 → 20 : la barge fluviale gagne le Trait `cale` (#1657 B3-2b-a — MSRC 07 l.94 gate le Critique
  // de Superstructure sur « si le bateau dispose d'une cale », MSRC 10 l.90 la dit du navire marchand).
  it('vehicles.json › ship.traits — 20 Traits navals résolus, et AUCUN au bestiaire', () => {
    const vus = (vehicles as ReadonlyArray<{ ship?: { traits?: ReadonlyArray<{ id: string }> } }>).flatMap((v) => v.ship?.traits ?? []);
    expect(vus.length, 'la population des Traits de navire a disparu.').toBe(20);
    expect(vus.filter((t) => !CATALOGUES.navals.has(t.id)), 'Trait de navire hors de naval-traits.json').toEqual([]);
    expect(
      vus.filter((t) => CATALOGUES.traits.has(t.id)),
      'un Trait de navire existe AUSSI au bestiaire : le foyer des deux catalogues cesse d’être disjoint, et composer `traitInstanceSchema` redeviendrait tentant.',
    ).toEqual([]);
  });

  it('trappings.json › qualities — 438 Atouts résolus (la seule garde de cette population)', () => {
    const vus = (trappings as ReadonlyArray<{ qualities?: ReadonlyArray<{ id: string }> }>).flatMap((t) => t.qualities ?? []);
    expect(vus.length, 'la population des Atouts d’objet a disparu.').toBe(438);
    expect(vus.filter((q) => !CATALOGUES.qualities.has(q.id)), 'Atout hors de qualities.json').toEqual([]);
  });

  it('structures.json › traits — 5 Traits de structure résolus', () => {
    const vus = (structures as ReadonlyArray<{ traits?: ReadonlyArray<{ id: string }> }>).flatMap((s) => s.traits ?? []);
    expect(vus.length, 'la population des Traits de structure a disparu.').toBe(5);
    expect(vus.filter((t) => !CATALOGUES.traits.has(t.id)), 'Trait de structure hors de traits.json').toEqual([]);
  });
});

/**
 * COUVERTURE des deux tableaux de PRIX D'OFFRE (#1463 L-gram-3) — `ecartsDeCouverture` composé dans
 * `defs/sea-cargo.ts` et `defs/land-cargo.ts`. Gate POSITIF par la porte réelle (`validateDataset`) :
 * un refine ne se voit pas au scan de structures, et une garde jamais vue ROUGE ne prouve rien.
 *
 * Les quatre modes de panne, chacun avec le message qu'il doit NOMMER :
 *  - un TROU (une bande commence après la fin de la précédente) — le lookup replierait en silence ;
 *  - un CHEVAUCHEMENT (deux bandes couvrent la même valeur) — la seconde devient inatteignable ;
 *  - la dernière bande MARITIME plafonnée alors que MDG 15 l.383 écrit « 4 ou plus » ;
 *  - la dernière bande TERRESTRE ouverte alors que MSRC 13 l.150-156 n'écrit aucun « ou plus ».
 */
describe('prix d’offre — les bandes couvrent leur domaine d’un seul tenant (#1463 L-gram-3)', () => {
  /** Remplace la N-ième bande d'un `sell.<cle>` par une version modifiée (copie, jamais l'arbre). */
  const muter = (doc: unknown, cle: string, i: number, patch: Record<string, unknown>) => {
    const d = doc as { sell: Record<string, Record<string, unknown>[]> };
    const bandes = d.sell[cle].map((b, j) => (j === i ? { ...b, ...patch } : b));
    return { ...d, sell: { ...d.sell, [cle]: bandes } };
  };

  it('sea-cargo.json › sell.offerPrice : la donnée réelle passe ; TROU, CHEVAUCHEMENT et plafond sur la bande FINALE sont REFUSÉS', () => {
    expect(validateDataset('sea-cargo.json', seaCargo)).toBeNull();

    const trou = validateDataset('sea-cargo.json', muter(seaCargo, 'offerPrice', 3, { min: 5 }));
    expect(trou, 'un TROU entre deux bandes est accepté').not.toBeNull();
    expect(trou).toContain('commence à 5 au lieu de 4');

    const chevauchement = validateDataset('sea-cargo.json', muter(seaCargo, 'offerPrice', 1, { min: 1 }));
    expect(chevauchement, 'un CHEVAUCHEMENT est accepté').not.toBeNull();
    expect(chevauchement).toContain('commence à 1 au lieu de 2');

    const plafonnee = validateDataset('sea-cargo.json', muter(seaCargo, 'offerPrice', 3, { max: 9 }));
    expect(plafonnee, 'la bande « 4 ou plus » accepte un plafond').not.toBeNull();
    expect(plafonnee).toContain('est la DERNIÈRE et porte un plafond');
  });

  it('land-cargo.json › sell.offerByRichesse : la donnée réelle passe ; TROU, CHEVAUCHEMENT, bande FINALE ouverte et débordement d’échelle sont REFUSÉS', () => {
    expect(validateDataset('land-cargo.json', landCargo)).toBeNull();

    const trou = validateDataset('land-cargo.json', muter(landCargo, 'offerByRichesse', 2, { min: 4 }));
    expect(trou, 'un TROU entre deux bandes est accepté').not.toBeNull();
    expect(trou).toContain('commence à 4 au lieu de 3');

    const chevauchement = validateDataset('land-cargo.json', muter(landCargo, 'offerByRichesse', 1, { min: 1 }));
    expect(chevauchement, 'un CHEVAUCHEMENT est accepté').not.toBeNull();
    expect(chevauchement).toContain('commence à 1 au lieu de 2');

    // Côté TERRE, le livre n'écrit aucun « ou plus » : la borne haute est REQUISE (`plageSchema`),
    // et `max: null` est refusé AU TYPE, avant même la mesure de couverture.
    const ouverte = validateDataset('land-cargo.json', muter(landCargo, 'offerByRichesse', 4, { max: null }));
    expect(ouverte, 'la dernière bande terrestre accepte une borne haute OUVERTE').not.toBeNull();
    expect(ouverte).toContain('sell.offerByRichesse.4.max');

    // Le domaine s'arrête à 5 (MSRC 13 l.52-60) : une bande qui déborde n'a aucun indice à couvrir.
    const deborde = validateDataset('land-cargo.json', muter(landCargo, 'offerByRichesse', 4, { max: 6 }));
    expect(deborde, 'la table déborde l’échelle des indices imprimés').not.toBeNull();
    expect(deborde).toContain("s'arrête à 6 au lieu de 5");
  });
});

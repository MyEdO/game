/**
 * `trappingRefSchema` (`src/data/schemas/grammaire/reference.ts`) — dotation de POSSESSION `{id, type}`
 * (SOCLE POSSESSIONS #615/#617 §9, #3012), en plus des branches existantes.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { nommerChamps, metaDesChamps } from './meta';
import { trappingRefSchema } from './reference';
import { flowTestSchema, gameOpSchema } from './mecanique';
import { NATURES_D_INFLUENCE, bornesSchema, ecartDeCoPresenceDesBornes, ecartsDeCouverture, plageOuverteSchema, plageSchema } from './valeurs';
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
import vehicles from '../../vehicles.json';
import classesDuDisque from '../../classes.json';
import traits from '../../traits.json';
import { corruptionExposureSchema } from '../defs-scenes/effets';
import { menaceIds } from '../../../engine/menace';
import { dotationsDuHeros, resolveTrappingChoices } from '../../../engine/trappingChoices';
import { adresseDeCreation } from '../../../engine/adresseDeCreation';
import { avecDotations, CARRIERE_FIXTURE } from '../../dotations.fixture';
import type { TrappingRef } from '../../index';


/** Les paths de DONNÉE des fautes de `valeur` au schéma de `fichier` — le LIEU rendu nomme un élément
 *  d'une collection à clé par sa clé (`schemas/validate.ts`), le path garde son rang. */
const pathsRefuses = (fichier: string, valeur: unknown): string[] =>
  (validateDocument(schemaForFile(fichier)!, valeur) ?? []).map((f) => f.chemin.join('.'));

describe('trappingRefSchema — branches de TrappingRef', () => {
  it('accepte {id} de catalogue (+ count optionnel)', () => {
    expect(trappingRefSchema.safeParse({ id: 'epee-de-cour' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ id: 'epee-de-cour', count: { fixed: 2 } }).success).toBe(true);
  });

  it('accepte {text} narratif hors catalogue', () => {
    expect(trappingRefSchema.safeParse({ text: 'collection d’alcool sans pareille' }).success).toBe(true);
  });

  it('accepte {id, type: vehicle} — dotation véhicule', () => {
    expect(trappingRefSchema.safeParse({ id: 'chariot-leger', type: 'vehicle' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ id: 'chariot-leger', type: 'vehicle', label: 'La Grise' }).success).toBe(true);
  });

  it('accepte {id, type: creature} — dotation bête (#615/#617 §9)', () => {
    expect(trappingRefSchema.safeParse({ id: 'mule', type: 'creature' }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ id: 'mule', type: 'creature', count: { fixed: 1 } }).success).toBe(true);
  });

  it('refuse l’ancienne graphie, un id hors du catalogue de son `type`, un mélange de branches', () => {
    expect(trappingRefSchema.safeParse({ creatureId: 'mule' }).success).toBe(false);
    expect(trappingRefSchema.safeParse({ vehicleId: 'chariot-leger' }).success).toBe(false);
    expect(trappingRefSchema.safeParse({ id: 'mule', type: 'vehicle' }).success).toBe(false);
    expect(trappingRefSchema.safeParse({ id: 'mule', type: 'monture' }).success).toBe(false);
    expect(trappingRefSchema.safeParse({ id: 'epee-de-cour', type: 'vehicle', qualityChoice: true }).success).toBe(false);
  });

  it('accepte une somme, un objet à sa valeur, une mention de nature connue ; refuse une nature inconnue (#4053)', () => {
    expect(trappingRefSchema.safeParse({ monnaie: 'silver', count: { roll: { n: 3, sides: 10 } } }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ id: 'bijoux', valeur: { monnaie: 'gold', count: { fixed: 50 } } }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ label: 'Pamphlétaires', nature: 'personne', count: { fixed: 3 } }).success).toBe(true);
    expect(trappingRefSchema.safeParse({ label: 'Apprenti', nature: 'objet' }).success).toBe(false);
    expect(trappingRefSchema.safeParse({ monnaie: 'florin', count: { fixed: 1 } }).success).toBe(false);
  });

  it('accepte {choice} — dotation « X ou Y » migrée (chantier #654 Lot 3)', () => {
    const ref = { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] };
    expect(trappingRefSchema.safeParse(ref).success).toBe(true);
  });

  it('{choice} migré (Arbalète de poing ou pistolet) résout la 2e branche via resolveTrappingChoices', () => {
    const ref: TrappingRef = { choice: [{ id: 'arbalete-de-poing' }, { id: 'pistolet' }] };
    const resolues = avecDotations(CARRIERE_FIXTURE, { classe: [], niveau: [ref] }, () =>
      resolveTrappingChoices(dotationsDuHeros(CARRIERE_FIXTURE), { [adresseDeCreation.dotation([0])]: 1 }));
    expect(resolues).toEqual([{ id: 'pistolet' }]);
  });
});

// LDB 05 l.552 ; #4053
describe('classes.json — une Classe ne porte que des dotations sans texte', () => {
  const classe = classesDuDisque[0];
  const classeDotee = (trappings: unknown[]) => [{ ...classe, trappings }];

  it('une Classe nommée qui porte un `{text}`, à la racine ou dans un `{choice}`, est refusée', () => {
    expect(validateDataset('classes.json', classeDotee([{ id: 'dague' }, { choice: [{ id: 'capuchon' }, { id: 'masque' }] }]))).toBeNull();
    expect(validateDataset('classes.json', classeDotee([{ id: 'dague' }, { text: 'Déjeuner' }]))).toEqual(expect.stringContaining(`« ${classe.id} »`));
    expect(validateDataset('classes.json', classeDotee([{ choice: [{ id: 'capuchon' }, { text: 'Masque' }] }]))).toEqual(expect.stringContaining(`« ${classe.id} »`));
  });
});

/**
 * `plageSchema` (`grammaire/valeurs.ts`, vague `plage` #1463 P1) — les deux bornes d'une rangée de
 * table de tirage se déclarent UNE fois et se composent par la SHAPE. Le spread est un ANGLE MORT du
 * scanner de redéclarations (`scripts/docs/lib/structures-scan.mts` lit les littéraux par AST et ne
 * résout pas un spread, cf. `grammaire/reference.ts:145-146`) : l'extinction d'une ligne de stock ne
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
    const etendu = nommerChamps(z.strictObject({ ...plageSchema.shape, mutation: plageSchema.shape.min }), { ...metaDesChamps(plageSchema, { exigees: true }), mutation: { label: 'mutation' } });
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
    // Deux tables de tirage distinctes : la qualité SECRÈTE du vin (MSRC 13 l.97) et les rumeurs
    // commerciales (MSRC 13 l.283) — la seconde ne serait jamais atteinte sans descente.
    ['land-cargo.json', landCargo, ['qualiteDuVin']],
    ['land-cargo.json', landCargo, ['rumeurs']],
    ['mass-battle.json', massBattle, ['hazards', 'entries']],
    ['naval-progression.json', navalProgression],
    // Les deux tables du vent fluvial partagent le MÊME schéma de rangée (`bandRow`) : chacune
    // se mesure, une composition débranchée ne pouvant se cacher derrière la première rencontrée.
    ['river-navigation.json', riverNavigation, ['windForces']],
    ['river-navigation.json', riverNavigation, ['windDirections']],
    ['sea-events.json', seaEvents, ['boardEvents']],
    ['sea-events.json', seaEvents, ['portEvents']],
    ['sea-events.json', seaEvents, ['fastVoyage', 'entries']],
    ['sea-weather.json', seaWeather, ['table', 'entries']],
    ['sea-weather.json', seaWeather, ['roseDesVents', 'entries']],
    ['steam-breakdown.json', steamBreakdown],
  ];

  /** Chemin de la PREMIÈRE rangée `{min, max}` rencontrée en parcours stable — borne numérique, ou `null` d’une bande OUVERTE. */
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
      const borne = (b: unknown) => typeof b === 'number' || b === null;
      if (borne(o.min) && borne(o.max)) return chemin;
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
 * `flowTestSchema.menace` (#1346) — CLÉ ÉTRANGÈRE vers un id de spec du talent « Résistance
 * (Menace) » (LDB 10 l.1016-1020), jugée par `menaceSchema` (`specFermeeDe('talent', 'resistance')`) :
 * résolue au catalogue (`talents.json`) à la VALIDATION.
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
    expect(r.error!.issues.map((i) => i.message).join('\n')).toContain('« Poison » est absente des spécialisations de « resistance » au catalogue des talents (talents.json).');
  });

  it('REFUSE un id hors catalogue, et le message DIT la valeur, l’entrée et son catalogue', () => {
    const r = parse('exposition');
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message).join('\n')).toContain('« exposition » est absente des spécialisations de « resistance » au catalogue des talents (talents.json).');
  });
});

/**
 * `corruptionExposure.nature` (`natureDInfluenceSchema`, `grammaire/valeurs.ts`) — la nature de
 * l'Influence est l'UNE des clés de la fiche `influences-corruptrices` (`LDB 19 l.29`). Les DEUX portes
 * du même concept — l'op `GameOp` et l'effet de scène — partagent la MÊME borne.
 */
describe('corruptionExposure.nature — bornée aux clés de `influences-corruptrices` (LDB 19 l.29)', () => {
  const portes = {
    'op GameOp': (nature?: string) => gameOpSchema.safeParse({ op: 'corruptionExposure', level: 'mineure', ...(nature ? { nature } : {}) }),
    'effet de scène': (nature?: string) => corruptionExposureSchema.safeParse({ type: 'corruptionExposure', level: 'mineure', ...(nature ? { nature } : {}) }),
  };

  for (const [nom, parse] of Object.entries(portes)) {
    it(`${nom} : accepte EXACTEMENT les clés de la fiche, et l'absence (choix du joueur)`, () => {
      expect(NATURES_D_INFLUENCE).toEqual(['physique', 'spirituelle']);
      for (const n of NATURES_D_INFLUENCE) expect(parse(n).success, `« ${n} » refusée`).toBe(true);
      expect(parse().success).toBe(true);
    });

    it(`${nom} : REFUSE une compétence à la place d'une nature`, () => {
      expect(parse('resistance').success).toBe(false);
    });
  }
});

/**
 * `plageOuverteSchema` (`grammaire/valeurs.ts`, #1463 L-gram-1) — la fourchette dont la DERNIÈRE
 * bande n'a pas de plafond (`max: null` ; LDB 07 l.49, bande « 71 et + » l.70), ou la PREMIÈRE pas de
 * plancher (`min: null` ; MDG 14 l.199, « 50 ou moins »). Même angle mort
 * qu'au-dessus : le scanner ne résout pas un spread, le gate est donc POSITIF et passe par la porte
 * réelle (`validateDataset`).
 */
describe('plageOuverteSchema — la bande EXTRÊME reste OUVERTE', () => {
  it('accepte `max: null`, `min: null` et des bornes chiffrées, REFUSE une borne absente et une borne non numérique', () => {
    expect(plageOuverteSchema.safeParse({ min: 71, max: null }).success).toBe(true);
    expect(plageOuverteSchema.safeParse({ min: null, max: 50 }).success).toBe(true);
    expect(plageOuverteSchema.safeParse({ min: 0, max: 5 }).success).toBe(true);
    for (const cas of [{ min: 71 }, { max: null }, { min: 71, max: '∞' }]) {
      expect(plageOuverteSchema.safeParse(cas).success, `${JSON.stringify(cas)} a été ACCEPTÉ`).toBe(false);
    }
    // Le nœud OUVERT ne se substitue pas au fermé : `plageSchema` refuse toujours la borne ouverte.
    expect(plageSchema.safeParse({ min: 71, max: null }).success).toBe(false);
  });

  it("couverture `ecartsDeCouverture(…, 'ouverte', 'ouverte')` : plancher et plafond ouverts exigés, aux deux bouts seulement", () => {
    const nom = (f: { min: number | null; max: number | null }) => `[${f.min},${f.max}]`;
    expect(ecartsDeCouverture([{ min: 51, max: 100 }, { min: null, max: 50 }, { min: 101, max: null }], 'ouverte', 'ouverte', nom)).toEqual([]);
    expect(ecartsDeCouverture([{ min: 0, max: 50 }, { min: 51, max: null }], 'ouverte', 'ouverte', nom)).toHaveLength(1);
    expect(ecartsDeCouverture([{ min: null, max: 50 }, { min: 51, max: null }], 0, 'ouverte', nom)).toHaveLength(1);
    expect(ecartsDeCouverture([{ min: null, max: 50 }, { min: null, max: 70 }], 'ouverte', 70, nom)).toHaveLength(1);
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
    expect(bornees.length, 'plus aucun réglage borné : la sonde ne mesure rien.').toBeGreaterThan(0);
    expect(
      bornees.filter((r) => r.kind !== 'param').map((r) => r.id),
      'un réglage borné n’est pas un paramètre chiffré : la co-présence mesurée ne porte plus sur la même population.',
    ).toEqual([]);
    const i = regles.indexOf(bornees[0]);
    const { max: _absente, ...ampute } = bornees[0];
    const err = validateDataset('reglesOptionnelles.json', [...regles.slice(0, i), ampute, ...regles.slice(i + 1)]);
    expect(err, 'un réglage à borne basse SEULE est accepté').not.toBeNull();
    expect(pathsRefuses('reglesOptionnelles.json', [...regles.slice(0, i), ampute, ...regles.slice(i + 1)])).toContain(`${i}.max`);
  });

  it('reglesOptionnelles.json : un `param` sans ses bornes et un `mode` sans ses `options` sont REFUSÉS (#4081)', () => {
    const regles = reglesOptionnelles as ReadonlyArray<Record<string, unknown>>;
    const amputer = (kind: string, champs: readonly string[]): string[] => {
      const i = regles.findIndex((r) => r.kind === kind);
      expect(i, `aucune règle \`${kind}\` : la sonde ne mesure rien`).toBeGreaterThanOrEqual(0);
      const ampute = Object.fromEntries(Object.entries(regles[i]).filter(([k]) => !champs.includes(k)));
      return pathsRefuses('reglesOptionnelles.json', [...regles.slice(0, i), ampute, ...regles.slice(i + 1)]).map((p) => p.replace(`${i}.`, ''));
    };
    expect(amputer('param', ['min', 'max', 'step'])).toEqual(['min', 'max']);
    expect(amputer('mode', ['options'])).toEqual(['options']);
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
 * FOYERS DISJOINTS (#1463 L-gram-2) : un Trait de navire résout dans `naval-traits.json` (`ref('navalTrait')`
 * le juge au parse) et n'existe pas au bestiaire — sinon composer `traitInstanceSchema` redeviendrait tentant.
 */
describe('vehicles.json › ship.traits — foyer disjoint du bestiaire (#1463 L-gram-2)', () => {
  it('Traits navals, AUCUN au bestiaire', () => {
    const bestiaire = new Set((traits as ReadonlyArray<{ id: string }>).map((e) => e.id));
    const vus = (vehicles as ReadonlyArray<{ ship?: { traits?: ReadonlyArray<{ id: string }> } }>).flatMap((v) => v.ship?.traits ?? []);
    expect(vus.length, 'la population des Traits de navire a disparu.').toBeGreaterThan(0);
    expect(
      vus.filter((t) => bestiaire.has(t.id)),
      'un Trait de navire existe AUSSI au bestiaire : le foyer des deux catalogues cesse d’être disjoint, et composer `traitInstanceSchema` redeviendrait tentant.',
    ).toEqual([]);
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
  /** Remplace la N-ième bande d'un `vente.<cle>` par une version modifiée (copie, jamais l'arbre). */
  const muter = (doc: unknown, cle: string, i: number, patch: Record<string, unknown>) => {
    const d = doc as { vente: Record<string, Record<string, unknown>[]> };
    const bandes = d.vente[cle].map((b, j) => (j === i ? { ...b, ...patch } : b));
    return { ...d, vente: { ...d.vente, [cle]: bandes } };
  };

  it('sea-cargo.json › vente.prixDOffre : la donnée réelle passe ; TROU, CHEVAUCHEMENT et plafond sur la bande FINALE sont REFUSÉS', () => {
    expect(validateDataset('sea-cargo.json', seaCargo)).toBeNull();

    const trou = validateDataset('sea-cargo.json', muter(seaCargo, 'prixDOffre', 3, { min: 5 }));
    expect(trou, 'un TROU entre deux bandes est accepté').not.toBeNull();
    expect(trou).toContain('commence à 5 au lieu de 4');

    const chevauchement = validateDataset('sea-cargo.json', muter(seaCargo, 'prixDOffre', 1, { min: 1 }));
    expect(chevauchement, 'un CHEVAUCHEMENT est accepté').not.toBeNull();
    expect(chevauchement).toContain('commence à 1 au lieu de 2');

    const plafonnee = validateDataset('sea-cargo.json', muter(seaCargo, 'prixDOffre', 3, { max: 9 }));
    expect(plafonnee, 'la bande « 4 ou plus » accepte un plafond').not.toBeNull();
    expect(plafonnee).toContain('est la DERNIÈRE et porte un plafond');
  });

  it('land-cargo.json › vente.offreParRichesse : la donnée réelle passe ; TROU, CHEVAUCHEMENT, bande FINALE ouverte et débordement d’échelle sont REFUSÉS', () => {
    expect(validateDataset('land-cargo.json', landCargo)).toBeNull();

    const trou = validateDataset('land-cargo.json', muter(landCargo, 'offreParRichesse', 2, { min: 4 }));
    expect(trou, 'un TROU entre deux bandes est accepté').not.toBeNull();
    expect(trou).toContain('commence à 4 au lieu de 3');

    const chevauchement = validateDataset('land-cargo.json', muter(landCargo, 'offreParRichesse', 1, { min: 1 }));
    expect(chevauchement, 'un CHEVAUCHEMENT est accepté').not.toBeNull();
    expect(chevauchement).toContain('commence à 1 au lieu de 2');

    // Côté TERRE, le livre n'écrit aucun « ou plus » : la borne haute est REQUISE (`plageSchema`),
    // et `max: null` est refusé AU TYPE, avant même la mesure de couverture.
    const ouverte = validateDataset('land-cargo.json', muter(landCargo, 'offreParRichesse', 4, { max: null }));
    expect(ouverte, 'la dernière bande terrestre accepte une borne haute OUVERTE').not.toBeNull();
    expect(ouverte).toContain('Règles de vente › Mise à prix selon la Richesse 5 › Maximum');
    expect(pathsRefuses('land-cargo.json', muter(landCargo, 'offreParRichesse', 4, { max: null }))).toContain('vente.offreParRichesse.4.max');

    // Le domaine s'arrête à 5 (MSRC 13 l.52-60) : une bande qui déborde n'a aucun indice à couvrir.
    const deborde = validateDataset('land-cargo.json', muter(landCargo, 'offreParRichesse', 4, { max: 6 }));
    expect(deborde, 'la table déborde l’échelle des indices imprimés').not.toBeNull();
    expect(deborde).toContain("s'arrête à 6 au lieu de 5");
  });
});

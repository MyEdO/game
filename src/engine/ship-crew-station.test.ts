/**
 * #1657 (« concept jet/Test : 65 lignes au stock FORMES, aucun def n'importe un schéma de jet
 * partagé ») B3-2b-a — QUI encaisse un coup à l'ÉQUIPAGE : la PRÉSENCE que le livre nomme, épinglée
 * par le joueur, jamais une inférence.
 *
 * Contrats POSITIFS, mesurés sur les rangées RÉELLES de `ship-criticals.json` / `river-criticals.json`
 * (aucune fixture de `crewHit` écrite ici — une rangée qui change de cible doit rougir) :
 *  1. `bancs-fracasses` (MDG 13 l.756 « Si un Personnage se trouve aux avirons ») : le PNJ ET le héros
 *     ÉPINGLÉS aux avirons sont visés ; le cuisinier qui POSSÈDE la compétence Ramer mais se tient sur
 *     le pont ne l'est pas — le livre demande qui s'y TROUVE, pas qui sait y servir ;
 *  2. `gouvernail-fluvial` (MSRC 07 l.86 « les échardes infligent +5 Dégâts au timonier », SINGULIER) :
 *     seul le `shipRole` timonier ÉPINGLÉ encaisse ; trois marins à Voile 70 non épinglés ne sont
 *     personne — une affectation déduite des Compétences en ferait trois timoniers ;
 *  3. `superstructure-fluvial` (MSRC 07 l.94 « Si le bateau dispose d'une cale ») : sur une coque sans
 *     le Trait naval `cale`, la station est FERMÉE et personne n'est touché ; sur la barge qui le
 *     porte, seuls les occupants de la cale le sont ;
 *  4. le REPLI sans exposé (MDG 13 l.584 « le coup touche la Coque » ; MSRC 07 l.70) : plus aucun
 *     abandon silencieux — le coup retombe sur la Localisation AUTHORÉE par le jeu de tables.
 *
 * Le RNG est SEEDÉ (`makeRNG`) : ces contrats ne dépendent d'aucune horloge.
 */
import { describe, it, expect } from 'vitest';
import { applyCrewHit, applyHullCritical, rollShipCritical, shipStationOuverte } from './shipCritical';
import { makeRNG } from './dice';
import { SHIP_CRIT_SET, RIVER_CRIT_SET, type ShipCritKey, type ShipCritSet } from '../data/shipCriticals';
import { shipStations } from '../data';
import { hullNavalTraits } from './navalTraits';
import type { Combatant } from './types';
import { combattantDeTest } from './combattantDeTest.testkit';

/** Marin minimal — `applyOps` (BE 3, PA 0) et `exposedCrew` (vivant, PB > 0) ont ce qu'il leur faut. */
const marin = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, label: id, kind: 'npc',
    characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 42, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
    skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
    armour: { corps: 0 }, wounds: { current: 20, max: 20, base: 20 }, advantage: 0, ...over,
  }) as unknown as Combatant;

/** Coque d'un véhicule RÉEL — ses Traits navals décident des stations ouvertes (`requiresTrait`). */
const coque = (vehicleId: string): Combatant => combattantDeTest({ id: 'hull', creatureId: vehicleId });

/** La rangée RÉELLE, tirée par le producteur avec un dé FORCÉ sur son `min` — jamais un littéral. */
const rangee = (jeu: ShipCritSet, loc: ShipCritKey, min: number) => rollShipCritical(loc, makeRNG(1), min, jeu);

const victimes = (hull: Combatant, crew: Combatant[], loc: ShipCritKey, min: number, jeu: ShipCritSet) =>
  applyCrewHit(hull, crew, rangee(jeu, loc, min).crewHit!, makeRNG(1));

describe('coup à l’équipage — la STATION est ÉPINGLÉE, jamais déduite (#1657 B3-2b-a)', () => {
  it('1. « Bancs fracassés » (MDG 13 l.756) vise qui se TROUVE aux avirons — pas qui SAIT ramer', () => {
    const rameurPnj = marin('rameur-pnj', { shipStation: 'avirons' });
    const rameurHeros = marin('rameur-heros', { kind: 'hero', shipStation: 'avirons' } as Partial<Combatant>);
    // Le cuisinier POSSÈDE Ramer 70 (une inférence par compétence le désignerait) et se tient sur le pont.
    const cuisinier = marin('cuisinier', { shipStation: 'pont', skills: [{ id: 'ramer', value: 70 }] } as unknown as Partial<Combatant>);
    const sansStation = marin('sans-station');

    const out = victimes(coque('galere-de-guerre'), [rameurPnj, rameurHeros, cuisinier, sansStation], 'avirons', 9, SHIP_CRIT_SET);
    expect(out.victims, 'les deux ÉPINGLÉS aux avirons, et eux seuls').toEqual(['rameur-pnj', 'rameur-heros']);
    expect(out.testFlow, 'la rangée appelle un Test d’Athlétisme : le nœud part par la porte').toBeTruthy();
    expect(out.stationsFermees, 'les avirons n’exigent aucun Trait naval').toEqual([]);
  });

  it('2. « Gouvernail » fluvial (MSRC 07 l.86) ne touche QUE le timonier ÉPINGLÉ', () => {
    const timonier = marin('timonier', { shipRole: 'timonier' });
    // Trois marins à Voile 70 : une déduction par Compétence les ferait tous timoniers (MSRC 07 l.86 dit « au timonier »).
    const voiliers = ['v1', 'v2', 'v3'].map((id) => marin(id, { skills: [{ id: 'voile', value: 70 }] } as unknown as Partial<Combatant>));

    const avec = victimes(coque('barge-fluviale'), [timonier, ...voiliers], 'gouvernail', 1, RIVER_CRIT_SET);
    expect(avec.victims).toEqual(['timonier']);
    expect(avec.hits.map((h) => h.crewId), 'MSRC 07 l.86 : aucun Test, la conséquence est CERTAINE').toEqual(['timonier']);
    expect(timonier.wounds.current, '+5 Dégâts − BE 3').toBe(20 - 2);

    const sans = victimes(coque('barge-fluviale'), voiliers, 'gouvernail', 1, RIVER_CRIT_SET);
    expect(sans.victims, 'pas de timonier épinglé, pas de barre : personne').toEqual([]);
    for (const v of voiliers) expect(v.wounds.current, `${v.id} touché par inférence`).toBe(20);
  });

  it('3. « Superstructure » fluviale (MSRC 07 l.94) est GATÉE par le Trait naval « cale »', () => {
    const enCale = () => [marin('soutier', { shipStation: 'cale' }), marin('pontier', { shipStation: 'pont' })];

    const sansCale = victimes(coque('barque-fluviale'), enCale(), 'superstructure', 1, RIVER_CRIT_SET);
    expect(sansCale.victims, 'MSRC 07 l.70 : la barque est un « bateau ouvert »').toEqual([]);
    expect(sansCale.stationsFermees, 'la station fermée est NOMMÉE — l’appelant la journalise').toEqual(['cale']);

    const avecCale = victimes(coque('barge-fluviale'), enCale(), 'superstructure', 1, RIVER_CRIT_SET);
    expect(avecCale.victims, 'seuls les occupants de la cale').toEqual(['soutier']);
    expect(avecCale.stationsFermees).toEqual([]);
  });

  it('3bis. le GATE de station vit en DONNÉE (`requiresTrait`), aucune station n’est codée en dur', () => {
    const gatees = shipStations.filter((s) => s.requiresTrait).map((s) => `${s.id} ⇐ ${s.requiresTrait!.id}`);
    expect(gatees, 'les deux présences que le livre fait payer : MSRC 07 l.94, MDG 12 l.299')
      .toEqual(['nid-de-pie ⇐ nid-de-pie', 'cale ⇐ cale']);
    // Toute coque ouvre les présences non gatées ; la barque n'ouvre ni cale ni nid-de-pie.
    for (const s of shipStations) {
      expect(shipStationOuverte(hullNavalTraits(coque('barque-fluviale')), s.id), `${s.id} sur la barque`).toBe(!s.requiresTrait);
    }
    expect(shipStationOuverte(hullNavalTraits(coque('barge-fluviale')), 'cale'), 'la barge commerciale porte le Trait').toBe(true);
    expect(() => shipStationOuverte(hullNavalTraits(coque('barge-fluviale')), 'gaillard-d-arriere')).toThrow(/station inconnue/);
  });

  it('4. aucun marin exposé : le coup RETOMBE sur la Localisation authorée, il n’est plus abandonné', () => {
    expect(SHIP_CRIT_SET.replisSansExpose.cible, 'MDG 13 l.584 : « le coup touche la Coque »').toBe('coque');
    expect(RIVER_CRIT_SET.replisSansExpose.cible, 'MSRC 07 l.70 arbitré en donnée (règle 7)').toBe('coque');

    // Localisation « Équipage » forcée (d100 = 1 sur la table `navire`), équipage VIDE.
    const hull = coque('cogue');
    const out = applyHullCritical(hull, [], 'voile', makeRNG(7), 1, 1);
    expect(out.location, 'le coup se perdait en silence (`shipCrit.crewNoneExposed` + abandon)').toBe('coque');
    expect(out.lines[0], 'le repli n’est pas DIT au joueur').toContain('aucun marin exposé');
    expect(out.lines[1], 'aucune rangée de coque n’a été résolue derrière le repli').toContain('Critique navire');
  });

  it('5. coque SANS `creatureId` : aucune station gatée n’est ouverte, et elle est NOMMÉE (jamais un silence)', () => {
    // Une coque de scène montée sans type (`vehicleCombatant` n'a pas tourné) n'a AUCUN Trait naval :
    // `cale` et `nid-de-pie` y sont fermées, `pont`/`greement`/`avirons` restent ouvertes à tout bateau.
    const sansType = { id: 'hull-nu' } as unknown as Combatant;
    const out = victimes(sansType, [marin('soutier', { shipStation: 'cale' })], 'superstructure', 1, RIVER_CRIT_SET);
    expect(out.victims).toEqual([]);
    expect(out.stationsFermees).toEqual(['cale']);
    expect(shipStationOuverte(hullNavalTraits(sansType), 'pont'), 'toute coque a un pont').toBe(true);
  });

  it('6. cible MIXTE (ouverte + fermée) : la station ouverte touche, la fermée est NOMMÉE — jamais tout ou rien', () => {
    // MDG 13 l.680 : une même épreuve vise le gréement ET le nid-de-pie. Sur une coque sans nid-de-pie
    // (amélioration payante, MDG 12 l.299), la moitié fermée ne doit ni tout annuler ni se taire.
    const enHaut = marin('vigie', { shipStation: 'nid-de-pie' });
    const surLePont = marin('matelot', { shipStation: 'pont' });
    const hit = { crewTarget: { stations: ['nid-de-pie', 'pont'] }, ops: [] } as unknown as Parameters<typeof applyCrewHit>[2];
    const out = applyCrewHit(coque('barque-fluviale'), [enHaut, surLePont], hit, makeRNG(1));
    expect(out.victims, 'le pont touche, le nid-de-pie absent n’emporte pas le reste').toEqual(['matelot']);
    expect(out.stationsFermees).toEqual(['nid-de-pie']);
  });
});

/**
 * #1657 — le coup à l'ÉQUIPAGE d'un Critique de coque : son JET vit dans le nœud `test` du Flow
 * (B2c), et ce nœud part par la PORTE canonique au lieu d'être roulé dans le moteur (B3-2).
 *
 * Contrat POSITIF, mesuré sur la donnée RÉELLE (`river-criticals.json`, `ship-criticals.json`) :
 *  1. le nœud est LU par la grammaire partagée — `noeudTest(flowSchema, { difficulteRequise: true,
 *     echecSeulServi: true })` accepte les nœuds de la base, et REFUSE nominativement un nœud sans
 *     `difficulty`, un nœud à branche de réussite peuplée, un nœud à `fail` embranché ;
 *  2. le porteur ne garde que ce qu'il DÉCRIT — QUI encaisse (`crewTarget`) ; il ne redit ni le
 *     sujet du jet, ni sa Difficulté, ni la conséquence ;
 *  3. un coup SANS jet n'est pas une épreuve : il porte `ops` (MSRC 07 l.82), et le XOR
 *     `test` ⊕ `ops` est verrouillé par le schéma ;
 *  4. `applyCrewHit` DÉSIGNE et REND : sur 40 seeds × chaque porteur RÉEL, il rend exactement les
 *     victimes que `posteCrew`/`exposedCrew` désignent, le nœud AUTHORÉ tel quel, et ne consomme
 *     AUCUN dé au-delà du tirage du poste — donc aucune Blessure ne tombe hors d'une fenêtre ;
 *  5. l'ENJEU est posé par le PRODUCTEUR (`rollShipCritical`) et renvoie à SA rangée dans la
 *     catégorie Codex de la Localisation touchée.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyCrewHit, exposedCrew, rollShipCritical, shipCritEntryCodexCategory } from './shipCritical';
import { spellOps } from './flowCore';
import { makeRNG, type RNG } from './dice';
import { resolveStake } from '../data';
import type { Combatant, ShipPoste } from './types';
import { SHIP_CRIT_SET, RIVER_CRIT_SET, type ShipCritEntry, type ShipCritKey, type ShipCritSet } from '../data/shipCriticals';
import { shipCrewHitSchema, flowSchema, noeudTest } from '../data/schemas/grammaire/mecanique';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const DATA = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'data');
const lire = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8')) as { tables: Record<string, ShipCritEntry[]> };
const FICHIERS = ['river-criticals.json', 'ship-criticals.json'] as const;
const JEUX: [ShipCritSet, string][] = [[RIVER_CRIT_SET, 'river-criticals.json'], [SHIP_CRIT_SET, 'ship-criticals.json']];

/** LE schéma du PORTEUR, celui que `shipCritEntrySchema` compose — jamais une recomposition locale :
 *  une option perdue dans `grammaire/mecanique.ts` doit rougir ICI. */
const schemaDuCoup = shipCrewHitSchema;

/** Les porteurs de coup, LUS dans la donnée — jamais une liste d'ids écrite ici. */
const coups = () =>
  FICHIERS.flatMap((f) =>
    Object.values(lire(f).tables)
      .flat()
      .filter((e) => e.crewHit)
      .map((e) => ({ fichier: f, id: e.id, hit: e.crewHit! })),
  );

/** Les porteurs de coup RÉSOLUS par le producteur (dé FORCÉ sur le `min` de la rangée → c'est bien SA
 *  ligne qui sort), avec la Localisation qui les porte — la seule voie par laquelle `state` les voit. */
const coupsResolus = () =>
  JEUX.flatMap(([jeu, fichier]) =>
    Object.entries(jeu.tables).flatMap(([loc, rows]) => (rows ?? [])
      .filter((e) => e.crewHit)
      .map((e) => ({ fichier, jeu, loc: loc as ShipCritKey, id: e.id, resolu: rollShipCritical(loc as ShipCritKey, makeRNG(1), e.min, jeu) }))),
  );

/** Marin minimal — assez pour `testValue` (Ag/I) + `applyOps` wounds (BE=3, PA=0). */
const sailor = (id: string, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, name: id, kind: 'npc',
    characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 42, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
    skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
    armour: { corps: 0 }, wounds: blessuresDeBase(40), advantage: 0, ...over,
  })) as unknown as Combatant;

/** Coque RÉELLE (`barge-fluviale`) : elle porte le Trait naval `cale`, donc TOUTES les stations que
 *  les rangées de ce train visent (pont/avirons/cale) sont OUVERTES à son bord — la désignation se
 *  mesure sans être masquée par le gate `requiresTrait` (`MSRC 07 l.94`), qui a ses propres morsures. */
const coqueAvecPostes = (crewIds: string[]): Combatant => {
  const poste: ShipPoste = { item: { uid: 'p1', name: 'Canon' } as never, side: 'tribord', crewIds };
  return {
    id: 'hull', creatureId: 'barge-fluviale',
    postes: [poste, { ...poste, item: { uid: 'p2', name: 'Pierrier' } as never, side: 'babord' }],
  } as unknown as Combatant;
};

/** RNG qui COMPTE ses tirages — l'ordre de consommation est le vrai gate du train. */
function rngCompteur(seed: number): RNG & { tirages: number[] } {
  const base = makeRNG(seed);
  const tirages: number[] = [];
  return {
    tirages,
    int: (min: number, max: number) => {
      const v = base.int(min, max);
      tirages.push(v);
      return v;
    },
  } as RNG & { tirages: number[] };
}

/** Équipage EXPOSÉ d'un poste tiré au sort — transcription VERBATIM de `posteCrew` (privé au moteur) :
 *  c'est la SEULE part du coup que le RNG décide encore, et ce test la fige. */
function posteCrewAttendu(hull: Combatant, crew: Combatant[], rng: RNG): Combatant[] {
  const postes = hull.postes;
  if (!postes?.length) return [];
  const poste = postes[rng.int(0, postes.length - 1)];
  return (poste.crewIds ?? [])
    .map((id) => crew.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && !c.dead && (c.wounds?.current ?? 0) > 0);
}

describe('coup à l’équipage — le JET vit dans le nœud `test` du Flow (#1657 B2c)', () => {
  it('les porteurs sont LUS par la grammaire partagée, et chacun dit ce qu’il est', () => {
    const tous = coups();
    expect(tous.length, 'la sonde mesure quelque chose').toBe(16);
    expect(tous.filter((c) => c.hit.test).map((c) => c.id)).toEqual([
      'greement-fluvial', 'superstructure-fluvial',
      // Les CINQ rangées du gréement MDG (l.711/l.714/l.715/l.717/l.718) : « sous peine de tomber »
      // — leur échec fait CHUTER (op `fall`, hauteur au livre l.684), #1657 B3-2b-c.
      'vergue-detachee', 'greement-degrade', 'voiles-detruites', 'vergue-brisee', 'mat-brise',
      'coque-degradee', 'gouvernail-endommage', 'quille-dechiquetee', 'gouvernail-brise',
      'bancs-disperses', 'bancs-fracasses', 'canon-detache',
    ]);
    // Aucun Test appelé par le livre → pas de nœud : MSRC 07 l.82 « les échardes infligent +5 Dégâts
    // aux rameurs », MSRC 07 l.86 « … au timonier ».
    expect(tous.filter((c) => c.hit.ops).map((c) => c.id)).toEqual(['rames-fluvial', 'gouvernail-fluvial']);

    for (const { fichier, id, hit } of tous) {
      expect(Boolean(hit.test) !== Boolean(hit.ops), `${fichier}/${id} : XOR test ⊕ ops rompu`).toBe(true);
      if (!hit.test) continue;
      expect(schemaDuCoup.safeParse(hit).success, `${fichier}/${id} : porteur refusé par la grammaire`).toBe(true);
      // Le PORTEUR ne redit rien du jet : ni sujet, ni Difficulté, ni conséquence.
      expect(Object.keys(hit).filter((k) => k !== 'test' && k !== 'crewTarget'), `${fichier}/${id}`).toEqual([]);
      // La branche de RÉUSSITE est vide : seul l'échec est servi.
      expect(spellOps(hit.test.success, 'target'), `${fichier}/${id} : branche success peuplée`).toEqual([]);
      expect(spellOps(hit.test.fail, 'target').length, `${fichier}/${id} : branche fail vide`).toBeGreaterThan(0);
    }
  });

  it('le SCHÉMA DU PORTEUR refuse ce que le moteur ne saurait pas jouer (difficulté absente, réussite peuplée, échec embranché, XOR rompu)', () => {
    const porteur = coups().find((c) => c.hit.test)!.hit;
    const noeud = porteur.test!;
    const avec = (n: unknown) => ({ ...porteur, test: n });
    // La branche de RÉUSSITE peuplée et l'ÉCHEC EMBRANCHÉ sont des charges VALIDES en soi : seul le
    // resserrement `echecSeulServi` les refuse. On le PROUVE en les repassant au contrat NON resserré
    // (patron `disease-noeud-test.test.ts`) — sans quoi une charge malformée rendrait l'assertion VACUE.
    const sansEchecSeul = noeudTest(flowSchema, { difficulteRequise: true });
    const reussitePeuplee = { ...noeud, success: noeud.fail };
    const echecEmbranche = { ...noeud, fail: { kind: 'if', cond: { kind: 'flag', expr: 'x' }, then: noeud.fail } };
    expect(sansEchecSeul.safeParse(reussitePeuplee).success, 'la charge « réussite peuplée » est INVALIDE en soi — l’assertion serait vacue').toBe(true);
    expect(sansEchecSeul.safeParse(echecEmbranche).success, 'la charge « échec embranché » est INVALIDE en soi — l’assertion serait vacue').toBe(true);

    expect(schemaDuCoup.safeParse(avec({ ...noeud, test: { ...noeud.test, difficulty: undefined } })).success, 'un nœud sans Difficulté passe').toBe(false);
    expect(schemaDuCoup.safeParse(avec(reussitePeuplee)).success, 'une branche de réussite peuplée passe').toBe(false);
    expect(schemaDuCoup.safeParse(avec(echecEmbranche)).success, 'un échec embranché passe').toBe(false);
    expect(schemaDuCoup.safeParse({ ...porteur, ops: [] }).success, 'un porteur à la fois épreuve ET certain passe').toBe(false);
    expect(schemaDuCoup.safeParse({ crewTarget: { stations: ['pont'] } }).success, 'un porteur sans aucune issue passe').toBe(false);
    // La CIBLE est REQUISE et FERMÉE : elle se déclare, elle se choisit dans les catalogues, et une
    // liste de stations en porte au moins une.
    expect(schemaDuCoup.safeParse({ test: noeud }).success, 'un porteur SANS cible passe').toBe(false);
    expect(schemaDuCoup.safeParse(avec(noeud) as object && { ...porteur, crewTarget: 'deck' }).success, 'le mot-valise « deck » passe encore').toBe(false);
    expect(schemaDuCoup.safeParse({ ...porteur, crewTarget: { stations: [] } }).success, 'une liste de stations VIDE passe').toBe(false);
    expect(schemaDuCoup.safeParse({ ...porteur, crewTarget: { stations: ['gaillard-d-arriere'] } }).success, 'une station hors catalogue passe').toBe(false);
    expect(schemaDuCoup.safeParse({ ...porteur, crewTarget: { role: 'grand-amiral' } }).success, 'un rôle hors catalogue passe').toBe(false);
  });
});

describe('coup à l’équipage — le moteur DÉSIGNE et REND, il ne roule plus (#1657 B3-2)', () => {
  it('40 seeds × chaque porteur RÉEL : victimes = la désignation `crewTarget`, nœud rendu TEL QUEL, aucun dé d’issue', () => {
    for (const { fichier, id, resolu } of coupsResolus()) {
      const hit = resolu.crewHit!;
      for (let seed = 1; seed <= 40; seed++) {
        const ids = ['m1', 'm2', 'm3'];
        // Chaque marin est ÉPINGLÉ à la station/au rôle que la rangée vise : la désignation se mesure
        // sur l'épinglage RÉEL, jamais sur une inférence (MDG 13 l.680, MSRC 07 l.78/l.82/l.86/l.94).
        const cible = hit.crewTarget;
        const epingle = (c: Combatant): Combatant => Object.assign(c, 'poste' in cible ? {}
          : 'role' in cible ? { shipRole: cible.role.id }
            : { shipStation: cible.stations[0] });
        const equipage = ids.map((i) => epingle(sailor(i)));
        const temoins = ids.map((i) => epingle(sailor(i)));
        const rng = rngCompteur(seed);
        const rngTemoin = rngCompteur(seed);

        const out = applyCrewHit(coqueAvecPostes(ids), equipage, hit, rng);
        const attendues = 'poste' in cible
          ? posteCrewAttendu(coqueAvecPostes(ids), temoins, rngTemoin)
          : exposedCrew(temoins).filter((c) => ('role' in cible
            ? c.shipRole === cible.role.id
            : c.shipStation !== undefined && cible.stations.includes(c.shipStation)));

        expect(out.victims, `${fichier}/${id} seed ${seed} : victimes`).toEqual(attendues.map((c) => c.id));
        expect(rng.tirages, `${fichier}/${id} seed ${seed} : un dé d’ISSUE est encore tiré`).toEqual(rngTemoin.tirages);
        if (hit.test) {
          expect(out.testFlow, `${fichier}/${id} : le nœud AUTHORÉ n’est pas rendu tel quel`).toBe(hit.test);
          expect(out.hits, `${fichier}/${id} : une conséquence est appliquée avant la fenêtre`).toEqual([]);
          expect(equipage.map((c) => c.wounds.current), `${fichier}/${id} seed ${seed} : Blessures hors fenêtre`).toEqual([40, 40, 40]);
        } else {
          // Coup CERTAIN (MSRC 07 l.82) : la conséquence tombe sur place, sans jet.
          expect(out.hits.map((h) => h.crewId), `${fichier}/${id}`).toEqual(attendues.map((c) => c.id));
        }
      }
    }
  });

  it('ENJEU posé par le producteur : chaque nœud renvoie à SA rangée, dans la catégorie de sa Localisation', () => {
    const mesures = coupsResolus().filter(({ resolu }) => resolu.crewHit?.test);
    expect(mesures.length, 'la sonde du producteur n’a rien mesuré').toBe(14);
    for (const { fichier, jeu, loc, id, resolu } of mesures) {
      const stake = resolu.crewHit!.test!.test.stake;
      expect(stake, `${fichier}/${id} : nœud sans enjeu`).toBeTruthy();
      expect(resolveStake(stake!).rule, `${fichier}/${id} : renvoi hors de sa propre rangée`)
        .toEqual({ category: shipCritEntryCodexCategory(jeu.id, loc), id });
    }
  });
});

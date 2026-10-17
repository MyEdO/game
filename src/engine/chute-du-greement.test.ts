import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { applyCrewHit, rollShipCritical } from './shipCritical';
import { applyOps, type GameOp } from './ops';
import { applyFall } from './movement';
import { hullShipSize, shipSizeOfLength } from './shipBuild';
import { makeRNG, roll as rollDes } from './dice';
import { hasCondition } from './conditions';
import { SHIP_CRIT_SET, findFallTable, type ShipCritEntry } from '../data/shipCriticals';
import { findVehicleById, shipConstruction } from '../data';
import type { Combatant } from './types';
import { schema as shipCriticalsSchema } from '../data/schemas/defs/ship-criticals';
import shipCriticalsJson from '../data/ship-criticals.json';

/**
 * #1657 B3-2b-c — TOMBER DU GRÉEMENT (MDG 13 l.678-688).
 *
 * « Plusieurs Critiques peuvent faire tomber un Personnage du gréement. Consultez le tableau qui suit
 * pour déterminer de quelle hauteur il tombe. Dans cette situation, les Personnages dans le nid-de-pie
 * doivent aussi effectuer un Test pour savoir s'ils tombent, et vont tomber d'encore plus haut que ceux
 * qui sont sur le gréement. » (l.680)
 *
 * Contrats POSITIFS, mesurés sur les rangées RÉELLES de `ship-criticals.json` (aucune fixture de
 * `crewHit` écrite ici — une rangée qui change de cible ou de Difficulté doit rougir) :
 *  1. les CINQ rangées « sous peine de tomber » (l.711/l.714/l.715/l.717/l.718) portent leur épreuve
 *     d'Athlétisme à la Difficulté IMPRIMÉE, une seule pour les DEUX présences (l.680) ;
 *  2. « Mât brisé » sur une coque MOYENNE : le gréement ET le nid-de-pie sont dans les victimes de la
 *     MÊME épreuve ; l'échec fait tomber de 2d10 m et de 25 m (l.686-688), Dégâts 3/m + 1d10 réduits
 *     par le seul BE et État À Terre si la perte dépasse le BE (LDB 15 l.80, l.84) ;
 *  3. le nid-de-pie tombe TOUJOURS de plus haut que le gréement (l.680), sur les trois bandes ;
 *  4. la table couvre les SEPT Tailles du tableau standard (MDG 12 l.122-129) — aucune coque n'a de
 *     hauteur muette ;
 *  5. hors contexte de coque, l'op NOMME son anomalie : jamais une chute de 0 m en silence ;
 *  6. la formule de chute (LDB 15 l.80) n'a qu'UN foyer dans tout `src/**`.
 *
 * Le RNG est SEEDÉ (`makeRNG`) : ces contrats ne dépendent d'aucune horloge.
 */

/** Marin minimal — `applyOps` (BE 3, PA 0) et `exposedCrew` (vivant, PB > 0) ont ce qu'il leur faut. */
const marin = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, label: id, kind: 'npc',
    characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 42, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 },
    skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [],
    armour: { corps: 0 }, wounds: { current: 200, max: 200, base: 200 }, advantage: 0, ...over,
  }) as unknown as Combatant;

/** Coque d'un véhicule RÉEL. `upgrades` = Améliorations d'INSTANCE (le nid-de-pie s'achète, MDG 12 l.299). */
const coque = (vehicleId: string, upgrades: { id: string }[] = []): Combatant =>
  ({ id: 'hull', bodyShape: 'vehicule', creatureId: vehicleId, upgrades } as unknown as Combatant);

/** Une rangée RÉELLE du gréement, tirée par le producteur avec son dé FORCÉ — jamais un littéral. */
const rangee = (min: number) => rollShipCritical('greement', makeRNG(1), min, SHIP_CRIT_SET);

/** Les ops de la branche d'ÉCHEC, telles qu'elles sont AUTHORÉES (la porte joue cette branche). */
const opsDEchec = (min: number): GameOp[] => {
  const fail = rangee(min).crewHit!.test!.fail as { kind: string; effect: { type: string; ops: GameOp[] } };
  return fail.effect.ops;
};

/** Le patrouilleur : 25 m → Taille MOYENNE (MDG 12 l.126, 21-35) ; sa Taille est LUE, pas supposée. */
const MOYENNE = coque('bateau-de-patrouille', [{ id: 'nid-de-pie' }]);

describe('les CINQ rangées du gréement jouent leur Test (MDG 13, règle 7 : plus rien en prose seule)', () => {
  const ATTENDU: [number, string, string][] = [
    [3, 'vergue-detachee', 'accessible'], //   MDG 13 l.711
    [6, 'greement-degrade', 'intermediaire'], // MDG 13 l.714
    [7, 'voiles-detruites', 'accessible'], //  MDG 13 l.715
    [9, 'vergue-brisee', 'intermediaire'], //  MDG 13 l.717
    [10, 'mat-brise', 'complexe'], //          MDG 13 l.718
  ];

  it.each(ATTENDU)('d10 %i — « %s » : Athlétisme %s, UNE épreuve pour le gréement ET le nid-de-pie', (min, id, difficulty) => {
    const crit = rangee(min as number);
    expect(crit.id).toBe(id);
    const hit = crit.crewHit!;
    expect(hit.crewTarget, 'l.680 : « les Personnages dans le nid-de-pie doivent AUSSI effectuer un Test »')
      .toEqual({ stations: ['greement', 'nid-de-pie'] });
    expect(hit.test!.test.skill).toEqual({ id: 'athletisme' });
    expect(hit.test!.test.difficulty).toBe(difficulty);
    expect(opsDEchec(min as number).map((o) => o.op), 'l’échec fait TOMBER — pas « À Terre »').toEqual(['fall']);
  });

  it('les 5 sont exactement celles dont la prose dit « Si un Personnage se TROUVE dans le gréement »', () => {
    const table = SHIP_CRIT_SET.tables.greement as ShipCritEntry[];
    const avecCoup = table.filter((e) => e.crewHit).map((e) => e.id);
    const presenceImmediate = table.filter((e) => /se trouve dans le gréement/.test(e.note)).map((e) => e.id);
    expect(avecCoup).toEqual(ATTENDU.map(([, id]) => id));
    expect(avecCoup, 'la prose et la mécanique disent la MÊME chose').toEqual(presenceImmediate);
    // `cordages-rompus` (l.709) dit AUSSI « sous peine de tomber du gréement », mais sa condition est
    // un GESTE À VENIR (« Si un membre d'équipage GRIMPE au gréement », 25 %) : ce n'est pas un coup à
    // l'équipage du Critique, et le moteur n'a pas de Trigger de changement de station (inventaire #1657).
    const grimpe = table.filter((e) => /grimpe au gréement/.test(e.note)).map((e) => e.id);
    expect(grimpe).toEqual(['cordages-rompus']);
    expect(avecCoup).not.toContain('cordages-rompus');
  });
});

describe('« Mât brisé » (l.718) : les deux présences tombent, chacune de SA hauteur (l.684-688)', () => {
  it('gréement ET nid-de-pie sont visés par la MÊME épreuve', () => {
    const gabier = marin('gabier', { shipStation: 'greement' } as Partial<Combatant>);
    const vigie = marin('vigie', { kind: 'hero', shipStation: 'nid-de-pie' } as Partial<Combatant>);
    const pontier = marin('pontier', { shipStation: 'pont' } as Partial<Combatant>);

    const out = applyCrewHit(MOYENNE, [gabier, vigie, pontier], rangee(10).crewHit!, makeRNG(1));
    expect(out.victims, 'une épreuve, deux présences — le pont est épargné').toEqual(['gabier', 'vigie']);
    expect(out.stationsFermees, 'le nid-de-pie est OUVERT : la coque porte l’Amélioration (MDG 12 l.299)').toEqual([]);
    expect(out.testFlow, 'le nœud part par la porte, il n’est pas roulé ici').toBeTruthy();
  });

  it('sans l’Amélioration « nid-de-pie », la station est FERMÉE et nommée (MDG 12 l.299)', () => {
    const vigie = marin('vigie', { shipStation: 'nid-de-pie' } as Partial<Combatant>);
    const gabier = marin('gabier', { shipStation: 'greement' } as Partial<Combatant>);
    const out = applyCrewHit(coque('bateau-de-patrouille'), [gabier, vigie], rangee(10).crewHit!, makeRNG(1));
    expect(out.victims).toEqual(['gabier']);
    expect(out.stationsFermees).toEqual(['nid-de-pie']);
  });

  it('l’ÉCHEC applique la chute : 2d10 m au gréement, 25 m au nid-de-pie (Moyenne), Dégâts LDB 15 l.80', () => {
    const ops = opsDEchec(10);
    for (let seed = 1; seed <= 40; seed++) {
      const gabier = marin('gabier', { shipStation: 'greement' } as Partial<Combatant>);
      const vigie = marin('vigie', { shipStation: 'nid-de-pie' } as Partial<Combatant>);
      const be = 3; // Endurance 31 → BE 3
      const lignes = [
        ...applyOps(gabier, ops, { rng: makeRNG(seed), hull: MOYENNE }),
        ...applyOps(vigie, ops, { rng: makeRNG(seed), hull: MOYENNE }),
      ];
      const metres = lignes.map((l) => Number(/chute de (\d+) m/.exec(l)![1]));
      expect(metres[0], `seed ${seed} : gréement = 2d10 m`).toBeGreaterThanOrEqual(2);
      expect(metres[0], `seed ${seed} : gréement = 2d10 m`).toBeLessThanOrEqual(20);
      expect(metres[1], 'nid-de-pie : 25 m, hauteur FIXE du livre').toBe(25);
      expect(metres[1], 'l.680 : « vont tomber d’encore plus haut »').toBeGreaterThan(metres[0]);
      // 3 Dégâts/m + 1d10, réduits par le BE et par lui seul (LDB 15 l.80).
      const perdu = (c: Combatant, m: number) => {
        const lost = 200 - c.wounds.current;
        expect(lost, `seed ${seed} : ${c.id} 3×${m} + 1d10 − BE`).toBeGreaterThanOrEqual(3 * m + 1 - be);
        expect(lost).toBeLessThanOrEqual(3 * m + 10 - be);
        // « Si vous subissez plus de Points de Blessure … que votre Bonus d'Endurance » (l.84).
        expect(hasCondition(c, 'a-terre'), `seed ${seed} : ${c.id} À Terre ⇔ perte > BE`).toBe(lost > be);
      };
      perdu(gabier, metres[0]);
      perdu(vigie, metres[1]);
    }
  });
});

describe('la TABLE de hauteur (MDG 13 l.684-688) est en donnée, et elle est TOTALE', () => {
  const table = findFallTable('tomberDuGreement')!;

  it('les SEPT Tailles du tableau standard sont couvertes (MDG 12 l.122-129) — aucune coque muette', () => {
    const couvertes = table.bandes.flatMap((b) => b.tailles).sort();
    const toutes = shipConstruction.standard.map((r) => r.size).sort();
    expect(couvertes).toEqual(toutes);
    expect(new Set(couvertes).size, 'aucune Taille dans DEUX bandes').toBe(couvertes.length);
  });

  it('chaque bande fait tomber le nid-de-pie de plus haut que le gréement (l.680)', () => {
    for (const b of table.bandes) {
      const des = b.hauteurs.greement as { dice: { n: number; sides: number } };
      const nid = b.hauteurs['nid-de-pie'] as number;
      expect(nid, `bande ${b.tailles.join('/')}`).toBeGreaterThan(des.dice.n * des.dice.sides);
    }
  });

  it('la Taille se DÉDUIT de la longueur, elle ne s’authore pas sur la coque', () => {
    expect(hullShipSize(MOYENNE)).toBe('moyenne');
    expect(shipSizeOfLength(findVehicleById('bateau-de-patrouille')!.ship!.lengthM)).toBe('moyenne');
    expect(hullShipSize(coque('chariot-leger')), 'un véhicule sans profil naval n’a pas de Taille de bateau').toBeUndefined();
  });
});

/**
 * LE SCHÉMA REFUSE ce que le moteur ne saurait lire (sonde du juge de diff promue en test, #1657) :
 * la colonne d'une bande est keyée par un ID DE STATION (`ship-stations.json`) et sa bande par une
 * TAILLE de bateau (MDG 12 l.122-129). Une coquille d'authoring (« nid-de-pi ») rendrait la station
 * MUETTE au runtime — l'op nommerait bien son anomalie, mais au moment de la chute : le parse la
 * refuse AVANT, nominativement.
 */
describe('la table de chute est FERMÉE au parse (stations et Tailles du catalogue, jamais du texte libre)', () => {
  const doc = () => structuredClone(shipCriticalsJson) as Record<string, unknown>;
  const bande0 = (d: Record<string, unknown>) => (d.tablesDeChute as { bandes: Record<string, unknown>[] }[])[0].bandes[0];

  it('le JSON RÉEL passe (sinon les refus ci-dessous ne prouveraient rien)', () => {
    expect(shipCriticalsSchema.safeParse(doc()).success).toBe(true);
  });

  it('clé de station INCONNUE (« nid-de-pi ») → refus NOMINATIF, jamais une colonne muette', () => {
    const d = doc();
    bande0(d).hauteurs = { greement: { dice: { n: 1, sides: 10 } }, 'nid-de-pi': 12 };
    const r = shipCriticalsSchema.safeParse(d);
    expect(r.success).toBe(false);
    const dit = JSON.stringify(r.success ? [] : r.error.issues);
    expect(dit).toContain('nid-de-pi');
    expect(dit, 'le refus doit dire QUE LA CLÉ est invalide').toContain('invalid_key');
  });

  it('Taille de bateau INCONNUE (« gigantesque ») → refus, le tableau standard est fermé (MDG 12 l.122-129)', () => {
    const d = doc();
    bande0(d).tailles = ['gigantesque'];
    expect(shipCriticalsSchema.safeParse(d).success).toBe(false);
  });
});

describe('l’op `fall` NOMME ses anomalies (règle 7 : jamais un repli muet)', () => {
  const cible = () => marin('gabier', { shipStation: 'greement' } as Partial<Combatant>);

  it('hors contexte de coque : anomalie nommée, jamais une chute de 0 m', () => {
    const c = cible();
    expect(() => applyOps(c, opsDEchec(10), { rng: makeRNG(1) })).toThrow(/aucune Taille de coque/);
    expect(c.wounds.current, 'rien n’a été appliqué en douce').toBe(200);
  });

  it('table de hauteur inconnue : anomalie nommée', () => {
    expect(() => applyOps(cible(), [{ op: 'fall', hauteur: { table: { id: 'tomberDeLaLune' } } }], { rng: makeRNG(1), hull: MOYENNE }))
      .toThrow(/table de hauteur inconnue/);
  });

  it('station sans colonne de hauteur : anomalie nommée', () => {
    const pontier = marin('pontier', { shipStation: 'pont' } as Partial<Combatant>);
    expect(() => applyOps(pontier, opsDEchec(10), { rng: makeRNG(1), hull: MOYENNE })).toThrow(/colonne de hauteur/);
    const sansStation = marin('sans-station');
    expect(() => applyOps(sansStation, opsDEchec(10), { rng: makeRNG(1), hull: MOYENNE })).toThrow(/colonne de hauteur/);
  });
});

/**
 * FOYER UNIQUE de la chute (LDB 15 l.80) — `applyFall` (`engine/movement.ts`). La formule « 3 Dégâts
 * par mètre + 1d10 » ne doit exister qu'à CET endroit : un second site (un flux qui recalcule ses
 * dégâts de chute à la main) divergerait le jour où la règle bouge, sans qu'aucun test métier ne rougisse.
 */
describe('« 3 × mètres + 1d10 » n’a qu’UN foyer dans `src/**`', () => {
  /** La formule mesurée : un facteur 3 sur une variable (dans les DEUX ordres — « 3 * m » comme
   *  « m * 3 ») ET un d10, sur la MÊME ligne. Angle mort DÉCLARÉ : une formule éclatée sur deux
   *  lignes (« const base = 3 * m; » puis « base + d10(rng) ») échappe au détecteur — il mesure une
   *  LIGNE, pas une expression. */
  const TROIS_PAR_METRE = /(3\s*\*\s*[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*\s*\*\s*3)/;
  // Le dé de la formule s'écrit en APPEL (`d10(rng)`) comme en VALEUR REÇUE (`d10Chute`, #1508 : le
  // 1d10 tombe à la porte, `applyFall` le lit) — le détecteur voit le NOM du dé dans les deux cas,
  // sans quoi une copie de la formule sur un dé posé lui échapperait.
  const D10 = /\bd10/i;
  const FORMULE = { test: (l: string) => TROIS_PAR_METRE.test(l) && D10.test(l) };

  it('AUCUN site hors `engine/movement.ts` ne réécrit la formule', () => {
    const fautifs: string[] = [];
    // Le recensement s'EXCLUT lui-même : ses fixtures de morsure ÉCRIVENT la formule qu'il traque.
    for (const { rel, text } of readCorpus(['src'], { tests: true })) {
      if (rel.endsWith('chute-du-greement.test.ts')) continue;
      const nom = rel.slice('src/'.length);
      text.split('\n').forEach((l, i) => {
        if (FORMULE.test(l) && nom !== 'engine/movement.ts') fautifs.push(`${nom}:${i + 1}`);
      });
    }
    expect(fautifs, 'site(s) recalculant les Dégâts de chute : passer par `applyFall` (engine/movement.ts, LDB 15 l.80)').toEqual([]);
  });

  it('le détecteur MORD : la formule INJECTÉE est vue, DANS LES DEUX ORDRES', () => {
    expect(FORMULE.test('  const lost = Math.max(0, 3 * m + d10(rng) - be);')).toBe(true);
    expect(FORMULE.test('  applyFall(c, metres, d10Chute);')).toBe(false);
    expect(FORMULE.test('  const lost = Math.max(0, d10(rng) + metres * 3 - be);'), 'ordre inverse').toBe(true);
    expect(FORMULE.test('  const lost = Math.max(0, 3 * m + d10Chute - be);'), 'sur un dé POSÉ aussi').toBe(true);
    expect(FORMULE.test('  const trois = 3 * facteur;'), 'un ×3 SANS dé n’est pas la chute').toBe(false);
  });

  it('et ce foyer est bien celui que l’op joue : mêmes Blessures, même État', () => {
    const parLOp = marin('op', { shipStation: 'nid-de-pie' } as Partial<Combatant>);
    const parLaBrique = marin('brique');
    applyOps(parLOp, opsDEchec(10), { rng: makeRNG(7), hull: MOYENNE });
    // 25 m = la colonne nid-de-pie d'une coque Moyenne (entière : aucun dé de hauteur), et le 1d10 de
    // Dégâts est le PREMIER tirage de la même graine — la brique reçoit exactement ce que l'op tire.
    applyFall(parLaBrique, 25, rollDes(1, 10, makeRNG(7)));
    expect(parLOp.wounds.current).toBe(parLaBrique.wounds.current);
    expect(hasCondition(parLOp, 'a-terre')).toBe(hasCondition(parLaBrique, 'a-terre'));
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applierDe } from '../noyau/cascade';
import { draineCascade } from './cascade.testkit';
import { seedBattleRng } from '../noyau/battleRng';
import { makePregens } from '../data/pregens';
import { emptyScene } from '../noyau/monde/scene';
import { bandeTriggeredTest } from '../noyau/combat/triggeredTest';
import { rollShipCritical } from '../engine/shipCritical';
import { SHIP_CRIT_SET } from '../data/shipCriticals';
import { hullShipSize } from '../engine/shipBuild';
import { makeRNG } from '../engine/dice';
import { hasCondition } from '../engine/conditions';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from '../noyau/pendings';
import { desDuTest } from '../engine/dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * #1657 B3-2b-c — LA COQUE SUIT LE COUP JUSQU'À LA CHUTE.
 *
 * La hauteur dont on tombe est celle de la TABLE, lue par (Taille du bateau × station) — `MDG 13
 * l.684`. Elle n'est donc PAS dans le nœud : c'est le CONTEXTE de la coque qui la donne, et ce
 * contexte doit survivre à la cadence du héros (le nœud part par la porte, le jet se joue dans une
 * fenêtre, la branche d'échec ne s'applique que plus tard, depuis une étape SÉRIALISÉE).
 *
 * Ce que ces cas verrouillent, dans l'ordre où ils peuvent casser :
 *  1. la bande PORTE l'id de la coque (`meta.hullId`, jumeau de `casterId`) ;
 *  2. l'applier la RECONSTITUE depuis l'état (`coqueParId` : véhicule du trajet ici, file de combat
 *     en mer) et la branche d'échec fait tomber chacun de SA hauteur ;
 *  3. la voie INLINE (porteur sans siège) reçoit la même coque, et journalise la chute.
 *
 * Sans ce fil, l'op `fall` NOMMERAIT son anomalie au lieu de tomber (aucune chute muette) — c'est ce
 * que la mutation de ce lot a montré en rouge.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

/** Le patrouilleur : 25 m → Taille MOYENNE (MDG 12 l.126) — 2d10 m au gréement, 25 m au nid-de-pie.
 *  Le nid-de-pie est une AMÉLIORATION d'instance (MDG 12 l.299), posée sur la coque du trajet. */
function coqueMoyenne(): Combatant {
  const c = vehicleCombatant(findVehicleById('bateau-de-patrouille')!)!;
  return { ...c, upgrades: [{ id: 'nid-de-pie' }] };
}

/** CE QUE LE JOUEUR LIT : une chute jouée COMBAT OUVERT va au journal de COMBAT
 *  (`combatLog.journaliser`, seule surface ouverte alors) ; hors combat, au journal d'exploration. */
const lu = (): string[] => [...(get().battle?.log ?? []).map((e) => e.text), ...get().journal];

/** Le nœud RÉEL de « Mât brisé » (MDG 13 l.718) — jamais un littéral. */
const noeudMatBrise = () => rollShipCritical('greement', makeRNG(1), 10, SHIP_CRIT_SET).crewHit!.test!;

function aBord(party: Combatant[], coque: Combatant): void {
  useGame.setState({
    party,
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, travelRecap: null, pendingRest: null,
    pendingCascade: null, suspendedCascades: [], pendingLogQueue: [], journal: [],
    gameTime: 8 * 60, lastUpkeepDay: 0,
    net: { ...get().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
    travelPlan: { routeId: 'r1', km: 45, mode: 'mer', vehicle: coque },
  } as never);
}

describe('#1657 B3-2b-c — la chute du gréement traverse la porte avec SA coque', () => {
  beforeEach(() => seedBattleRng(1));

  it('(i) la bande PORTE l’id de la coque, et la Taille s’en déduit (MDG 12 l.122-129)', () => {
    const coque = coqueMoyenne();
    const [gabier, vigie] = makePregens(idNeufDeBanc).slice(0, 2);
    const party = [{ ...gabier, shipStation: 'greement' }, { ...vigie, shipStation: 'nid-de-pie' }];
    aBord(party, coque);

    const bande = bandeTriggeredTest(get, set, party, noeudMatBrise(), 'sonde-chute', { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Mât brisé', hull: coque });
    expect(bande, 'aucune bande : le Test d’Athlétisme est resté silencieux').toBeTruthy();
    expect(bande!.participants!.map((p) => p.id)).toEqual(party.map((h) => h.id));
    expect(bande!.meta!.hullId, 'sans cet id, la branche d’échec n’a plus de Taille de bateau').toBe(coque.id);
    expect(hullShipSize(coque)).toBe('moyenne');
    for (const h of get().party) expect(h.wounds.current, `${h.id} : quelqu’un est tombé avant le jet`).toBe(h.wounds.max);
  });

  it('(ii) l’ÉCHEC fait tomber chacun de SA hauteur : 2d10 m au gréement, 25 m au nid-de-pie (l.686)', () => {
    const coque = coqueMoyenne();
    const [gabier, vigie] = makePregens(idNeufDeBanc).slice(0, 2);
    const party = [{ ...gabier, shipStation: 'greement' }, { ...vigie, shipStation: 'nid-de-pie' }];
    aBord(party, coque);
    const bande = bandeTriggeredTest(get, set, party, noeudMatBrise(), 'sonde-chute', { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Mât brisé', hull: coque })!;
    const pvAvant = new Map(get().party.map((h) => [h.id, h.wounds.current]));

    const rates: CascadeStep = {
      ...bande,
      participants: bande.participants!.map((p) => ({
        ...p, result: { roll: 98, target: p.target!, success: false, sl: -5, crit: false, fumble: false },
      })),
    };
    applierDe('triggeredBatchTest')!(get, set, rates, undefined, { steps: [rates], index: 0 });

    // #1508 : l'échec n'applique plus la chute — il OUVRE ses dés. La hauteur du gréement est un dé
    // (2d10), celle du nid-de-pie un ENTIER (aucun dé de hauteur, seuls les Dégâts se tirent) : c'est
    // déjà lisible sur les étapes ouvertes, AVANT qu'aucune Blessure ne tombe.
    const ouvertes = get().pendingCascade!.participants.filter((s) => s.kind === 'opsDe');
    const pourLe = (id: string) => ouvertes.filter((s) => s.actorId === id);
    expect(pourLe(gabier.id).map((s) => s.de!.spec), 'gréement d’une coque Moyenne = 2d10 m (l.686), puis les Dégâts')
      .toEqual([{ n: 2, sides: 10 }]);
    expect(pourLe(vigie.id).map((s) => s.de!.spec), 'nid-de-pie : hauteur FIXE (25 m, l.687) — seuls les Dégâts se tirent')
      .toEqual([{ n: 1, sides: 10 }]);
    for (const h of get().party) expect(h.wounds.current, `${h.id} a encaissé AVANT ses dés`).toBe(pvAvant.get(h.id));

    // Les dés tombent (aucun siège ne les pose : le socle les lance) — la hauteur se dit alors au journal.
    draineCascade(get);
    const de = (id: string) => get().party.find((h) => h.id === id)!;
    const perte = (id: string) => pvAvant.get(id)! - de(id).wounds.current;
    const dit = JSON.stringify(get().journal);
    const hauteurDe = (c: Combatant) => Number(new RegExp(`${c.label} — Tomber du gréement : chute de (\\d+) m`).exec(dit)![1]);
    expect(hauteurDe(de(gabier.id)), 'gréement d’une coque Moyenne = 2d10 m (l.686)').toBeGreaterThanOrEqual(2);
    expect(hauteurDe(de(gabier.id))).toBeLessThanOrEqual(20);
    expect(hauteurDe(de(vigie.id)), 'nid-de-pie d’une coque Moyenne = 25 m, hauteur FIXE (l.687)').toBe(25);
    expect(hauteurDe(de(vigie.id)), 'l.680 : le nid-de-pie tombe de plus haut').toBeGreaterThan(hauteurDe(de(gabier.id)));
    expect(perte(gabier.id), 'le gabier n’est pas tombé').toBeGreaterThan(0);
    expect(perte(vigie.id), 'la vigie n’est pas tombée').toBeGreaterThan(0);
    // 3 × 25 + 1d10 dépasse tout Bonus d'Endurance : la vigie est À Terre (LDB 15 l.84).
    expect(hasCondition(de(vigie.id), 'a-terre'), 'perte > BE ⇒ À Terre').toBe(true);
  });

  it('(iii) la RÉUSSITE ne fait tomber personne (la branche d’échec porte seule la conséquence)', () => {
    const coque = coqueMoyenne();
    const party = makePregens(idNeufDeBanc).slice(0, 2).map((h) => ({ ...h, shipStation: 'greement' }));
    aBord(party, coque);
    const bande = bandeTriggeredTest(get, set, party, noeudMatBrise(), 'sonde-chute', { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Mât brisé', hull: coque })!;
    const reussies: CascadeStep = {
      ...bande,
      participants: bande.participants!.map((p) => ({
        ...p, result: { roll: 5, target: p.target!, success: true, sl: 3, crit: false, fumble: false },
      })),
    };
    applierDe('triggeredBatchTest')!(get, set, reussies, undefined, { steps: [reussies], index: 0 });
    for (const h of get().party) expect(h.wounds.current, `${h.id} est tombé sur une RÉUSSITE`).toBe(h.wounds.max);
  });

  it('(v) voie COMBAT : la coque vit dans la FILE (arbitrage 2026-07-16 « les navires sont des combattants »)', () => {
    const coque = coqueMoyenne();
    const [gabier] = makePregens(idNeufDeBanc).slice(0, 1);
    const party = [{ ...gabier, shipStation: 'greement' }];
    aBord(party, coque);
    // Aucun trajet : la coque n'est atteignable QUE par la file de combat.
    useGame.setState({
      travelPlan: null,
      battle: {
        combatants: [...party, coque], order: party.map((h) => h.id), baseOrder: party.map((h) => h.id),
        turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
        movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
      },
    } as never);

    const bande = bandeTriggeredTest(get, set, party, noeudMatBrise(), 'sonde-combat', { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Mât brisé', hull: coque })!;
    expect(bande.meta!.hullId).toBe(coque.id);
    const rates: CascadeStep = {
      ...bande,
      participants: bande.participants!.map((p) => ({
        ...p, result: { roll: 98, target: p.target!, success: false, sl: -5, crit: false, fumble: false },
      })),
    };
    applierDe('triggeredBatchTest')!(get, set, rates, undefined, { steps: [rates], index: 0 });
    // La coque de la FILE a bien été retrouvée : sa Taille a donné le dé de hauteur (#1508 — la chute
    // s'ANNONCE au lieu de s'appliquer, et c'est ce dé qui prouve la lecture de la coque).
    const ouverte = get().pendingCascade!.participants.find((s) => s.kind === 'opsDe');
    expect(ouverte, 'aucun dé de chute : la coque de la FILE n’a pas été retrouvée').toBeTruthy();
    expect(ouverte!.de!.spec, 'coque Moyenne au gréement').toEqual({ n: 2, sides: 10 });
    draineCascade(get);
    expect(JSON.stringify(lu())).toMatch(/chute de [0-9]+ m/);
    const tombe = get().battle!.combatants.find((c) => c.id === gabier.id)!;
    expect(tombe.wounds.current, 'le gabier n’est pas tombé').toBeLessThan(tombe.wounds.max);
    useGame.setState({ battle: null } as never);
  });

  it('(vi) coque DISPARUE entre le mint et la résolution : refus NOMMÉ, jamais un crash ni 0 m muet', () => {
    // La situation RÉELLE : la bande naît en mer, la cascade est SUSPENDUE (`suspendActiveCascade` —
    // un combat s'ouvre, une scène change), et sa reprise (`resumeSuspendedCascade`) tombe après la
    // fin du voyage : `travelPlan.vehicle` n'existe plus, et la coque n'est dans aucune file.
    const coque = coqueMoyenne();
    const party = makePregens(idNeufDeBanc).slice(0, 1).map((h) => ({ ...h, shipStation: 'greement' }));
    aBord(party, coque);
    const bande = bandeTriggeredTest(get, set, party, noeudMatBrise(), 'sonde-disparue', { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Mât brisé', hull: coque })!;
    const pvAvant = get().party[0].wounds.current;

    useGame.setState({ travelPlan: null, battle: null } as never); // le voyage s'achève, la coque sort de l'état
    const rates: CascadeStep = {
      ...bande,
      participants: bande.participants!.map((p) => ({
        ...p, result: { roll: 98, target: p.target!, success: false, sl: -5, crit: false, fumble: false },
      })),
    };
    const rendu = applierDe('triggeredBatchTest')!(get, set, rates, undefined, { steps: [rates], index: 0 });

    const dit = JSON.stringify(rendu);
    expect(dit, `le refus n'est pas NOMMÉ : ${dit}`).toContain('n’est plus en jeu');
    // Le refus NOMME l'étape par son libellé (celui de la bande — la Compétence lancée).
    expect(dit, 'le refus ne dit pas DE QUOI il parle').toContain(bande.label);
    expect(get().party[0].wounds.current, 'une chute a été appliquée SANS hauteur connue').toBe(pvAvant);
  });

  it('(iv) voie INLINE (porteur sans siège) : la même coque, et la chute est DITE au journal', () => {
    const coque = coqueMoyenne();
    const party = makePregens(idNeufDeBanc).slice(0, 1);
    aBord(party, coque);
    /** Un gabier PNJ : aucun siège ne le tient (il n'est pas du groupe) → voie inline. Agilité 1 :
     *  son Athlétisme Complexe (−10) échoue hors des jets qui réussissent d'office (LDB 09). */
    const gabier = {
      id: 'gabier', name: 'Gabier', label: 'Gabier', kind: 'npc',
      characteristics: { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 31, endurance: 31, initiative: 31, agilite: 1, dexterite: 31, intelligence: 31, 'force-mentale': 31, sociabilite: 31 },
      skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [], items: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      wounds: { current: 200, max: 200 }, advantage: 0, movement: 4, bodyShape: 'humanoide',
      shipStation: 'greement',
    } as unknown as Combatant;

    // Le PNJ est ENREGISTRÉ à la file de combat (il est en jeu), mais absent du groupe : personne ne le
    // tient. La chute doit donc l'ATTEINDRE — un porteur en jeu n'encaisse pas dans le vide.
    set({ battle: { combatants: [...party, gabier, coque], log: [], round: 1, turn: 0, over: false } } as never);

    const bande = bandeTriggeredTest(get, set, [...party, gabier], noeudMatBrise(), 'sonde-inline', { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Mât brisé', hull: coque });
    expect(bande!.participants!.map((p) => p.id), 'le PNJ ne prend PAS de rangée').toEqual(party.map((h) => h.id));
    // #1508 : la voie inline ANNONCE elle aussi son dé. Aucun siège ne tient ce PNJ → le socle le tire
    // d'office, et la HAUTEUR ouverte est celle de SA coque (Moyenne = 2d10 m, MDG 13 l.684) : c'est là
    // que se lit « la même coque », pas dans une valeur déjà encaissée.
    const hauteur = get().pendingCascade!.participants.find((p) => p.de && p.actorId === 'gabier');
    expect(hauteur, `la chute n’a ouvert aucun dé : ${JSON.stringify(get().pendingCascade?.participants.map((p) => p.id))}`).toBeTruthy();
    expect(hauteur!.de!.spec, 'gréement d’une coque Moyenne = 2d10 m').toEqual({ n: 2, sides: 10 });
    expect(hauteur!.de!.unite).toBe('m');
    expect(hauteur!.de!.result, 'aucun siège ne le tient : le socle le tire à l’ouverture').not.toBeNull();

    const lignes = [...draineCascade(get), ...lu()];
    const chute = lu().find((l) => /Tomber du gréement/.test(l));
    expect(chute, `la voie inline n’a rien dit de la chute : ${lignes.join(' | ')}`).toBeTruthy();
    expect(chute).toMatch(/[0-9]+ m/);
    const apres = get().battle!.combatants.find((c) => c.id === 'gabier')!;
    expect(200 - apres.wounds.current, 'la chute est ENCAISSÉE par le PNJ en jeu').toBeGreaterThan(0);
    expect(hasCondition(apres, 'a-terre'), 'À Terre (LDB 15 l.80)').toBe(true);
  });
});

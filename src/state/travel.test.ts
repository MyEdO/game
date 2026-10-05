/**
 * #T2 Voyage — flux store : trajets sur la carte du monde (temps, rations, paiement, péripéties
 * d'auteur, interruption/reprise). RAW : section « Voyage » du LDB (`51 - Magie du Chaos.md`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { emptyScene, Scene } from './scene';
import { buildEncounter } from './encounterAuthoring';
import { WorldMap } from './worldMap';
import { campaignStart } from '../engine/clock';
import { toBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { rationCount } from '../engine/provisions';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, ItemInstance } from '../engine/types';
import type { Possession } from '../engine/possession';
import { draineCascade } from './cascadeTestKit';
import { objetDeTest } from '../engine/objetDeTest.testkit';

const ration = (uid: string): ItemInstance => (objetDeTest({ uid, trappingId: 'ration', kind: 'misc', qualities: [], enc: 0, equipped: false }));

const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
    ...p,
  } as Combatant);

function sceneA(): Scene {
  const s = emptyScene(10, 10);
  s.id = 'lieu-a-scene';
  s.label = 'Village A';
  // Rencontre pour la péripétie d'auteur « brigands » (statblock → pas de dépendance bestiaire).
  const enc = buildEncounter({
    id: 'enc-test',
    enemies: [{ statblock: { type: 'statblock', label: 'Brigand', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }],
  });
  s.entities.push(...enc.entities);
  s.encounters = [enc.encounter];
  return s;
}
function sceneB(): Scene {
  const s = emptyScene(10, 10);
  s.id = 'lieu-b-scene';
  s.label = 'Bourg B';
  return s;
}

function map(routePatch: Partial<WorldMap['routes'][0]> = {}): WorldMap {
  return {
    id: 'carte-test', label: 'Carte de test',
    places: [
      { id: 'pa', label: 'Village A', pos: { x: 20, y: 50 }, scene: 'lieu-a-scene' },
      { id: 'pb', label: 'Bourg B', pos: { x: 70, y: 40 }, scene: 'lieu-b-scene' },
    ],
    routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 12, modes: ['pied'], perilDie: 0, ...routePatch }],
  };
}

/** Charge le projet de test (2 scènes + carte) et pose le groupe. La bourse de départ (5 pistoles =
 *  60 sous) vit sur le meneur, seedée après le chargement du projet (#531). */
function setup(worldMap: WorldMap, party: Combatant[] = [hero({ items: [ration('r1'), ration('r2'), ration('r3')] })], possessions: Possession[] = []) {
  useGame.setState({ party });
  useGame.getState().loadProject([sceneA(), sceneB()], 'lieu-a-scene', worldMap);
  if (possessions.length) useGame.setState({ possessions });
  creditBourse(useGame.getState, useGame.setState, party[0].id, { gold: 0, silver: 5, brass: 0 });
}

/** Déroule la cascade OUVERTE (jour `travelDay` OU nuit) : roule chaque étape-jet puis avance jusqu'à
 *  sa clôture. Depuis la Phase B, les jets du JOUR de voyage (Activités d'Étape, Exposition, péripéties
 *  Survie/Perception) sont une cascade influençable qui SUSPEND la journée → il faut la drainer. */
function drainCascade(): void {
  let guard = 0;
  while (useGame.getState().pendingCascade && guard++ < 200) {
    const p = useGame.getState().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur?.participants && cur.participants.some((part) => !part.result)) { for (const part of cur.participants) if (!part.result) useGame.getState().cascadeBatchRoll(part.id); }
    else if (cur?.table && !cur.table.result) useGame.getState().cascadeTableRoll(cur.id); // étape à TABLE (Météo d'Étape…)
    else if (cur && cur.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    else useGame.getState().cascadeNext();
  }
}

/** Dort à une halte de nuit : « Dormir » puis déroule la CASCADE séquentielle (lance + valide chaque
 *  jet) s'il y en a une — sinon (rien à influencer) la route a déjà repris. La fin de cascade reprend
 *  le voyage (purpose 'travel'). */
function sleepThroughHalt(): void {
  useGame.getState().restSleep();
  drainCascade();
}

beforeEach(() => {
  seedBattleRng(1);
});

describe('startTravel — à pied', () => {
  it('court trajet (12 km à M4, 3 h) : arrive le jour même, horloge avancée, transition vers la scène du lieu', () => {
    setup(map());
    const t0 = useGame.getState().gameTime;
    expect(t0).toBe(campaignStart());
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    expect(st.travelPlan).toBeNull();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.gameTime - t0).toBe(180); // 12 km ÷ 4 km/h = 3 h (l.222)
    expect(st.journal.some((l) => l.includes('Arrivée à Bourg B'))).toBe(true);
  });

  it('trajet multi-jours (30 km à M4) : 6 h/jour (LDB 51 l.195), HALTE de nuit (modale de Repos), rations consommées', () => {
    setup(map({ km: 30 }));
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'pied');
    // Nuit 1 : le voyage se SUSPEND sur la modale de Repos (campement — pas d'auberge sur la route).
    let st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-a-scene'); // toujours en route
    expect(st.pendingRest?.phase).toBe('setup');
    expect(st.pendingRest?.places.auberge).toBeFalsy();
    sleepThroughHalt(); // « Dormir » → cascade (ou reprise directe) → la route repart au matin
    st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    // Jour 1 : 6 h de marche (24 km) + nuit jusqu'à l'aube ; jour 2 : 1 h 30 (6 km) → > 17 h au total.
    expect(st.gameTime - t0).toBeGreaterThan(17 * 60);
    expect(st.journal.some((l) => /dort jusqu|aube/i.test(l))).toBe(true);
    // L'entretien quotidien a consommé une ration au franchissement de jour.
    expect(rationCount(st.party[0])).toBe(2);
  });

  it('marche forcée (allure > 6 h/jour) : les jets ouvrent la cascade INFLUENÇABLE de la halte de nuit', () => {
    setup(map({ km: 60 })); // assez long pour une halte de nuit après le 1er jour
    useGame.getState().startTravel('r1', 'pied', { hoursPerDay: 8 }); // > 6 h → marche forcée (LDB 51 l.195)
    const p = useGame.getState().pendingRest!;
    expect(p.phase).toBe('setup');
    expect((p.travelMarch ?? []).length).toBeGreaterThan(0); // héros à tester en marche forcée
    useGame.getState().restSleep();
    const cas = useGame.getState().pendingCascade!;
    // Le jet de marche forcée du jour est une ÉTAPE influençable de la cascade de nuit.
    expect(cas.participants[0].kind).toBe('forcedMarch');
    expect(cas.participants.filter((s) => s.kind === 'forcedMarch').length).toBe(1); // 1 héros
  });

  it('route à RELAIS (inns) : la halte de nuit propose l’auberge — chambre privée débitée, puis arrivée', () => {
    setup(map({ km: 30, inns: true }));
    creditBourse(useGame.getState, useGame.setState, 'h', { gold: 2, silver: 0, brass: 0 }); // la nuitée est débitée de la bourse (restFlow → payFromGroup)
    useGame.getState().startTravel('r1', 'pied');
    const p = useGame.getState().pendingRest!;
    expect(p.places.auberge).toBe(true);
    expect(p.perHero[useGame.getState().party[0].id].lodging).toBe('privee'); // défaut auberge
    const before = toBrass(partyMoneyTotal(useGame.getState));
    sleepThroughHalt();
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(before - 120 - 12); // chambre 10 pa + repas 1 pa
    expect(useGame.getState().scene?.id).toBe('lieu-b-scene');
  });

  it('la vitesse est celle du PLUS LENT (l.222) : M3 dans le groupe → 4 h pour 12 km', () => {
    setup(map(), [hero(), hero({ id: 'h2', label: 'Nain', movement: 3 })]);
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'pied');
    expect(useGame.getState().gameTime - t0).toBe(240);
  });

  it('marche forcée : une allure de 10 h/jour évite la nuit de camp sur 30 km', () => {
    setup(map({ km: 30 }));
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'pied', { hoursPerDay: 10 });
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.gameTime - t0).toBe(450); // 30 km ÷ 4 km/h = 7 h 30, d'une traite
    // Marche forcée (LDB 51 l.195) : Tests de Résistance journalisés.
    expect(st.journal.some((l) => l.includes('marche forcée'))).toBe(true);
  });
});

describe('startTravel — transports payants (LDB 51 l.178-189)', () => {
  it('diligence : débite prix/km × km × passagers et voyage à M6', () => {
    setup(map({ modes: ['pied', 'diligence'] })); // 12 km — bourse de départ : 5 SC = 60 PA
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'diligence', { classeId: 'exterieur' }); // 1 sou/km × 12 × 1 passager
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(toBrass(partyMoneyTotal(() => st))).toBe(48); // 60 − 12
    expect(st.gameTime - t0).toBe(120); // 12 km ÷ 6 km/h = 2 h
  });

  it('bourse insuffisante → voyage refusé', () => {
    setup(map({ modes: ['diligence'], prices: { diligence: 100 } })); // 1200 PA ≫ 60 PA
    useGame.getState().startTravel('r1', 'diligence', { classeId: 'interieur' });
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-a-scene'); // pas parti
    expect(st.travelPlan).toBeNull();
    expect(toBrass(partyMoneyTotal(() => st))).toBe(60); // rien débité
    expect(st.journal.some((l) => l.includes('dépasse les moyens'))).toBe(true);
  });

  it('vitesse d’auteur sur la route (EiS ch.1 : diligence à 3 km/h) respectée', () => {
    setup(map({ modes: ['diligence'], speed: { diligence: 3 } }));
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'diligence', { classeId: 'exterieur' });
    expect(useGame.getState().gameTime - t0).toBe(240); // 12 km ÷ 3 km/h = 4 h
  });
});

describe('péripéties d’auteur — interruption et reprise', () => {
  it('péripétie à 100 % qui démarre un combat : le RÉCIT s’affiche AVANT — le combat part à l’acquittement', () => {
    setup(map({
      km: 30,
      perils: [{ label: 'Brigands sur la route !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-test' }] }],
    }));
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // la péripétie du jour est une étape de la cascade travelDay → la drainer
    let st = useGame.getState();
    // DIFFÉRÉ derrière le récit : pas de combat tant que le recap n'est pas acquitté
    // (sinon on se retrouve en combat sans comprendre ce qui arrive).
    expect(st.battle).toBeNull();
    expect(st.travelRecap?.then?.kind).toBe('effects');
    expect(st.travelPlan?.interrupted).toBe(true);
    expect(st.travelPlan!.kmDone).toBeGreaterThan(0);
    expect(st.journal.some((l) => l.includes('Brigands sur la route'))).toBe(true);
    // Pas d'esquive : la reprise est REFUSÉE tant que l'embuscade attend son acquittement.
    useGame.getState().resumeTravel();
    expect(useGame.getState().travelRecap?.then).toBeTruthy();
    expect(useGame.getState().travelPlan?.interrupted).toBe(true);
    // « Faire face » : l'acquittement déclenche le combat.
    useGame.getState().dismissTravelRecap();
    st = useGame.getState();
    expect(st.battle).toBeTruthy();
    expect(st.travelRecap).toBeNull();
    // Victoire simulée → reprise (la péripétie est neutralisée pour ne pas re-déclencher).
    useGame.setState({ battle: null, mode: 'exploration' });
    const wm = useGame.getState().worldMap!;
    useGame.setState({ worldMap: { ...wm, routes: wm.routes.map((r) => ({ ...r, perils: [] })) } });
    useGame.getState().resumeTravel();
    st = useGame.getState();
    expect(st.travelPlan).toBeNull();
    expect(st.scene?.id).toBe('lieu-b-scene');
  });

  it('interrompu sur le DERNIER kilomètre (kmDone = km) : la reprise arrive sans rejouer la journée', () => {
    // 12 km à M4 = 3 h → la péripétie tombe le jour de l'arrivée ; la reprise ne doit PAS re-tirer
    // la péripétie (sinon une péripétie à 100 % boucle indéfiniment).
    setup(map({ perils: [{ label: 'Toujours là !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-test' }] }] }));
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // péripétie du jour en cascade → drainer pour l'interruption
    expect(useGame.getState().travelPlan?.interrupted).toBe(true);
    expect(useGame.getState().travelPlan?.kmDone).toBeCloseTo(12);
    useGame.getState().dismissTravelRecap(); // « Faire face » → le combat démarre
    expect(useGame.getState().battle).toBeTruthy();
    useGame.setState({ battle: null, mode: 'exploration' });
    useGame.getState().resumeTravel(); // péripétie TOUJOURS à 100 % — ne doit plus se déclencher
    const st = useGame.getState();
    expect(st.travelPlan).toBeNull();
    expect(st.scene?.id).toBe('lieu-b-scene');
  });

  it('« Attaqués ! » (table d10) configuré : l’acquittement transitionne et lance la rencontre (noSurprise)', () => {
    setup(map());
    useGame.setState({
      travelRecap: {
        fromLabel: 'Village A', toLabel: 'Bourg B', mode: 'pied', status: 'interrupted', km: 12, kmDone: 6, days: [],
        then: { kind: 'ambush', scene: 'lieu-a-scene', encounter: 'enc-test', noSurprise: true },
      },
    });
    useGame.getState().dismissTravelRecap();
    const st = useGame.getState();
    expect(st.battle).toBeTruthy();
    expect(st.travelRecap).toBeNull();
  });

  it('péripétie purement narrative (journal) : le voyage continue', () => {
    setup(map({ perils: [{ label: 'Un colporteur partage la route.', chancePct: 100, effects: [{ type: 'journal', desc: 'Il vend des amulettes.' }] }] }));
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // péripétie narrative en cascade travelDay → drainer, puis arrivée
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene'); // arrivé malgré la péripétie
    expect(st.journal.some((l) => l.includes('colporteur'))).toBe(true);
  });
});

describe('nourriture en voyage (LDB 18 l.337-343)', () => {
  it('sans rations, un long voyage affame le groupe (compteur de faim) et bloque la récup nocturne', () => {
    setup(map({ km: 72 }), [hero({ items: [], wounds: { current: 5, max: 12 } })]); // 3 jours pleins à M4
    useGame.getState().startTravel('r1', 'pied');
    // Chaque nuit : halte (modale de Repos) → dormir (cascade) → reprendre la route au matin.
    for (let n = 0; n < 6 && useGame.getState().pendingRest; n++) {
      sleepThroughHalt();
    }
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    const h = st.party[0];
    expect(h.hunger?.days).toBeGreaterThanOrEqual(2); // plusieurs jours sans manger
    expect(st.journal.some((l) => l.includes('affamé'))).toBe(true); // récup bloquée journalisée (rest.ts)
  });

  it('openWorldMap/closeWorldMap : overlay piloté par le store (pas en combat)', () => {
    setup(map());
    useGame.getState().openWorldMap();
    expect(useGame.getState().worldMapOpen).toBe(true);
    useGame.getState().closeWorldMap();
    expect(useGame.getState().worldMapOpen).toBe(false);
  });
});

describe('récapitulatif de voyage (audit M4) — modale à l’arrivée/interruption', () => {
  it('arrivée : recap « arrived » avec ses journées et les lignes de péripétie', () => {
    setup(map({ perils: [{ label: 'Un colporteur partage la route.', chancePct: 100, effects: [{ type: 'journal', desc: 'Il vend des amulettes.' }] }] }));
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // péripétie du jour en cascade travelDay → drainer, puis recap d'arrivée
    const r = useGame.getState().travelRecap!;
    expect(r.status).toBe('arrived');
    expect(r.fromLabel).toBe('Village A');
    expect(r.toLabel).toBe('Bourg B');
    expect(r.kmDone).toBeCloseTo(12);
    expect(r.days.length).toBe(1); // 12 km à M4 = 3 h
    expect(r.days[0].lines.some((l) => l.text.includes('colporteur'))).toBe(true);
    useGame.getState().dismissTravelRecap();
    expect(useGame.getState().travelRecap).toBeNull();
  });

  it('interruption par péripétie de combat : recap « interrupted » avec km restants ; la reprise produit SON recap', () => {
    setup(map({
      km: 30,
      perils: [{ label: 'Brigands sur la route !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-test' }] }],
    }));
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // péripétie du jour en cascade travelDay → drainer pour l'interruption
    let r = useGame.getState().travelRecap!;
    expect(r.status).toBe('interrupted');
    expect(r.kmDone).toBeLessThan(30);
    expect(r.days[0].lines.some((l) => l.text.includes('Brigands'))).toBe(true);
    // « Faire face » : le combat différé démarre à l'acquittement du recap.
    useGame.getState().dismissTravelRecap();
    expect(useGame.getState().battle).toBeTruthy();
    // victoire simulée → reprise : nouveau segment, nouveau recap
    useGame.setState({ battle: null, mode: 'exploration' });
    const wm = useGame.getState().worldMap!;
    useGame.setState({ worldMap: { ...wm, routes: wm.routes.map((x) => ({ ...x, perils: [] })) } });
    useGame.getState().resumeTravel();
    r = useGame.getState().travelRecap!;
    expect(r.status).toBe('arrived');
    expect(useGame.getState().scene?.id).toBe('lieu-b-scene');
  });

  it('surcharge (vitesse 0) : recap « stalled »', () => {
    // Force la vitesse à pied à 0 via le Déplacement d'auteur de la route.
    setup(map({ speed: { pied: 0 } }));
    useGame.getState().startTravel('r1', 'pied');
    expect(useGame.getState().travelRecap?.status).toBe('stalled');
    expect(useGame.getState().travelPlan?.interrupted).toBe(true);
  });
});

/**
 * Sous-système OPTIONNEL « Voyage par Étapes » (EDOC 8). Défaut OFF = voyage jour-par-jour
 * INCHANGÉ (aucune ligne de Météo/Étape) ; ON = jet de Météo par jour, Approvisionnement et
 * Exposition de fin d'Étape optionnels.
 */
describe('Voyage par Étapes (EDOC 8, règle optionnelle)', () => {
  afterEach(() => {
    resetRule('travel-etapes');
    resetRule('travel-etapes-count-bonus');
    resetRule('travel-attraper-froid');
  });

  it('OFF (défaut) : voyage INCHANGÉ — aucune ligne de Météo/Étape, arrivée identique au chemin de base', () => {
    setup(map({ km: 12, perilDie: 0 }));
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'pied');
    const st = useGame.getState();
    // Comportement de base : arrive le jour même (12 km à M4 = 3 h), comme le test de référence.
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.gameTime - t0).toBe(180);
    expect(st.journal.some((l) => l.includes('Arrivée à Bourg B'))).toBe(true);
    // Aucune trace du sous-système d'Étapes (la règle est éteinte → chemin court-circuité).
    expect(st.journal.some((l) => l.includes('Météo'))).toBe(false);
    expect(st.journal.some((l) => l.includes('Approvisionnement'))).toBe(false);
    expect(st.journal.some((l) => l.includes("Exposition de fin d'Étape"))).toBe(false);
  });

  it('ON : la Météo du jour est journalisée (libellé seul — le d100 est un tirage de MONDE, pas montré)', () => {
    setRule('travel-etapes', true);
    setup(map({ km: 12, perilDie: 0 }));
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // cascade travelDay (postes) → drainer, puis arrivée
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene'); // arrive toujours (l'enrichissement ne bloque pas la route)
    const weatherLine = st.journal.find((l) => l.includes('Météo'));
    expect(weatherLine).toBeDefined();
    expect(weatherLine).not.toMatch(/\(\d+\)/); // aucun d100 dans la prose (« y'a que le MJ qui voit le jet »)
  });

  it('ON, sans « Attraper froid » : les POSTES se résolvent, mais aucun Test d’Exposition de fin d’Étape', () => {
    setRule('travel-etapes', true);
    // Héros au poste Récupérer (sans Test, n'ouvre PAS la porte « Plein air ») → l'Exposition resterait
    // possible si le flag était mis, mais il ne l'est pas ici.
    const h = hero({ travelRole: 'recuperer', items: [ration('r1')] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // cascade travelDay (poste Récupérer) → drainer
    const st = useGame.getState();
    expect(st.journal.some((l) => l.includes("Exposition de fin d'Étape"))).toBe(false);
    // Le poste assigné (Récupérer) a bien été résolu pour l'Étape (EDOC 8 l.131 : un héros = une Activité).
    expect(st.journal.some((l) => l.includes('Récupérer'))).toBe(true);
  });

  it('ON : un héros au poste Approvisionnement fourrage (Test de Survie en extérieur, EDOC 8 l.145)', () => {
    setRule('travel-etapes', true);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ id: 'survie-en-exterieur', advances: 20 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // cascade travelDay (poste Approvisionnement) → drainer
    const st = useGame.getState();
    // Le Test lui-même est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — succès sans effet
    // propre (rien à re-print, #295 Lot 5) : on vérifie la CONSÉQUENCE réelle (ration OU Exténué),
    // quelle que soit l'issue du jet.
    const gotRation = (st.party[0].items ?? []).length > 0;
    const exhausted = st.party[0].conditions.some((c) => c.id === 'extenue');
    expect(gotRation || exhausted).toBe(true);
  });

  it('ON + travel-attraper-froid : un Test d’Exposition de fin d’Étape est tenté (héros sans manteau)', () => {
    setRule('travel-etapes', true);
    setRule('travel-attraper-froid', true);
    // Hiver garantit pluie/neige/blizzard fréquents ; on balaie quelques graines pour en obtenir un
    // (la météo est seedée — au moins une graine produit des intempéries imposant un Test).
    let exposed = false;
    for (let seed = 1; seed <= 20 && !exposed; seed++) {
      seedBattleRng(seed);
      const winter = campaignStart() + 0; // la date par défaut (fin Jahrdrung) suffit : printemps a aussi pluie/neige
      // Poste Récupérer : pas de « Plein air » → la porte `suppressExposure` reste fermée, l'Exposition se joue.
      setup(map({ km: 12, perilDie: 0 }), [hero({ travelRole: 'recuperer' })]);
      useGame.setState({ gameTime: winter });
      useGame.getState().startTravel('r1', 'pied');
      drainCascade(); // cascade travelDay (poste + Exposition insérée) → drainer
      if (useGame.getState().journal.some((l) => l.includes("Exposition de fin d'Étape"))) exposed = true;
    }
    expect(exposed).toBe(true);
  });

  it('saison froide + Exposition RATÉE : le Rhume commun contracté en route se DÉCLARE à la Phase d’arrivée (EDOC 8 l.92, EDOC 9 l.21)', () => {
    setRule('travel-etapes', true);
    setRule('travel-attraper-froid', true);
    let sick: { id: string; phase: string; minutesLeft: number; durationMinutes: number } | undefined;
    for (let seed = 1; seed <= 40 && !sick; seed++) {
      seedBattleRng(seed);
      setup(map({ km: 12, perilDie: 0 }), [hero({ travelRole: 'recuperer' })]);
      useGame.setState({ gameTime: campaignStart() }); // fin Jahrdrung = printemps, saison froide
      useGame.getState().startTravel('r1', 'pied');
      drainCascade();
      sick = (useGame.getState().party[0].diseases ?? []).find((d) => d.id === 'rhume-commun');
    }
    expect(sick, 'aucune Exposition ratée en saison froide sur 40 graines').toBeDefined();
    // Le trajet (12 km à pied) tient dans la journée : le groupe est ARRIVÉ à destination…
    expect(useGame.getState().scene?.id, 'le voyage doit avoir abouti à la scène de destination').toBe('lieu-b-scene');
    // …et la Phase d'arrivée a déclaré la maladie contractée en route : phase active, durée authorée
    // en place du reste d'incubation, ligne au journal.
    expect(sick!.phase).toBe('active');
    expect(sick!.minutesLeft).toBe(sick!.durationMinutes);
    expect(useGame.getState().journal.some((l) => l.includes('les symptômes de « Rhume commun » se déclarent'))).toBe(true);
  });

  it('ré-exposition d’un héros déjà enrhumé : la durée du Rhume est PROLONGÉE de 1d10 jours (EDOC 8 l.122)', () => {
    setRule('travel-etapes', true);
    setRule('travel-attraper-froid', true);
    const JOUR = 24 * 60;
    let mesure: { avant: number; apres: number } | undefined;
    for (let seed = 1; seed <= 40 && !mesure; seed++) {
      seedBattleRng(seed);
      // Rhume DÉJÀ actif au départ (5 jours restants) : il ne se re-contracte pas, il s'allonge.
      const porteur = hero({ travelRole: 'recuperer' });
      porteur.diseases = [{ id: 'rhume-commun', symptoms: [], phase: 'active', minutesLeft: 5 * JOUR, durationMinutes: 5 * JOUR }];
      setup(map({ km: 12, perilDie: 0 }), [porteur]);
      useGame.setState({ gameTime: campaignStart() });
      useGame.getState().startTravel('r1', 'pied');
      drainCascade();
      const dz = (useGame.getState().party[0].diseases ?? []).find((d) => d.id === 'rhume-commun')!;
      if (dz.durationMinutes > 5 * JOUR) mesure = { avant: 5 * JOUR, apres: dz.durationMinutes };
    }
    expect(mesure, 'aucune Exposition ratée sur 40 graines').toBeDefined();
    const jours = (mesure!.apres - mesure!.avant) / JOUR;
    expect(jours).toBeGreaterThanOrEqual(1);
    expect(jours).toBeLessThanOrEqual(10);
    expect(Number.isInteger(jours)).toBe(true);
    expect(useGame.getState().journal.some((l) => /de nouveau exposé, « Rhume commun » traîne/.test(l))).toBe(true);
  });

  it('porte « Plein air » : un héros réussit Plein air → le groupe SAUTE le Test d’Exposition (EDOC 8 l.141)', () => {
    setRule('travel-etapes', true);
    setRule('travel-attraper-froid', true);
    // Héros expert en Survie au poste Plein air : sa réussite dispense tout le groupe de l'Exposition.
    let suppressed = false;
    for (let seed = 1; seed <= 20 && !suppressed; seed++) {
      seedBattleRng(seed);
      const h = hero({ travelRole: 'plein-air', skills: [{ id: 'survie-en-exterieur', advances: 60 } as any] });
      setup(map({ km: 12, perilDie: 0 }), [h]);
      useGame.setState({ gameTime: campaignStart() });
      useGame.getState().startTravel('r1', 'pied');
      drainCascade(); // cascade travelDay (Plein air, l'Exposition sautée si réussi) → drainer
      const st = useGame.getState();
      const j = st.journal;
      // Plein air joué et réussi (aucun Exténué — l'échec en porte un, #295 Lot 5 : le Test lui-même
      // est DÉJÀ affiché par la rangée de l'étape), et aucune Exposition cette Étape.
      const exhausted = st.party[0].conditions.some((c) => c.id === 'extenue');
      if (!exhausted && !j.some((l) => l.includes("Exposition de fin d'Étape"))) suppressed = true;
    }
    expect(suppressed).toBe(true);
  });

  it('poste Établir des cartes : Test ÉTENDU de cartographie cumulé via extendedTestStep (EDOC 8 l.161)', () => {
    setRule('travel-etapes', true);
    const h = hero({ travelRole: 'etablir-cartes', skills: [{ id: 'metier', spec: 'Cartographe', advances: 80 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // cascade travelDay (poste Établir des cartes, Test étendu) → drainer
    const j = useGame.getState().journal;
    expect(j.some((l) => l.includes('Cartographie') || l.includes("carte de l'itinéraire est ACHEVÉE"))).toBe(true);
  });

  it('véhicule à coque : `plan.vehicle` est bâti depuis la facette hull (Diligence E45/B50)', () => {
    setRule('travel-etapes', true);
    // Trajet > 36 km/jour (M6 × 6 h) → halte de nuit, `travelPlan` persiste (vehicle inspectable).
    // Extérieur 1 sou/km × 50 km = 50 PA ≤ 60 PA de bourse de départ.
    setup(map({ km: 50, modes: ['diligence'], perilDie: 0 }));
    useGame.getState().startTravel('r1', 'diligence', { classeId: 'exterieur' });
    const plan = useGame.getState().travelPlan;
    expect(plan?.vehicle?.bodyShape).toBe('vehicule');
    expect(plan?.vehicle?.wounds.max).toBe(50);
    expect(plan?.vehicle?.characteristics.endurance).toBe(45);
  });

  it('à pied : aucun `plan.vehicle` (pas de coque pour un trajet à pied)', () => {
    setRule('travel-etapes', true);
    setup(map({ km: 12, perilDie: 0 }));
    useGame.getState().startTravel('r1', 'pied');
    drainCascade(); // cascade travelDay éventuelle (poste par défaut) → drainer, puis arrivée
    // Trajet bouclé le jour même → plan purgé ; le départ n'aura de toute façon créé aucune coque.
    expect(useGame.getState().travelPlan).toBeNull();
  });

  it('Rencontre : un échec d’Activité déclenche une Rencontre EDOC (texte verbatim au journal)', () => {
    setRule('travel-etapes', true);
    // Héros nul en Survie au poste Approvisionnement → échec quasi certain → Rencontre (dangereuse/fortuite).
    let met = false;
    for (let seed = 1; seed <= 20 && !met; seed++) {
      seedBattleRng(seed);
      const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ id: 'survie-en-exterieur', advances: 0 } as any] });
      setup(map({ km: 12, perilDie: 0 }), [h]);
      useGame.getState().startTravel('r1', 'pied');
      drainCascade(); // cascade travelDay (échec de poste → Rencontre à l'agrégation) → drainer
      if (useGame.getState().journal.some((l) => l.includes('Rencontre'))) met = true;
    }
    expect(met).toBe(true);
  });

  it('setTravelRole épingle puis détache le rôle de marche PERSISTANT', () => {
    setup(map(), [hero({ id: 'h1' })]);
    useGame.getState().setTravelRole('h1', 'plein-air');
    expect(useGame.getState().party[0].travelRole).toBe('plein-air');
    useGame.getState().setTravelRole('h1', null);
    expect(useGame.getState().party[0].travelRole).toBeUndefined();
  });
});

/**
 * Montures et attelages en voyage (EDOC 7, règle optionnelle `travel-allures`) : voyage en selle
 * (vitesse par allure l.140, endurance l.142-146, Incidents de monte l.148-174) et allure forcée
 * d'un attelage (l.229 + Problème de véhicule l.253).
 */
describe('Montures & attelages (EDOC 7, règle optionnelle travel-allures)', () => {
  afterEach(() => {
    resetRule('travel-allures');
  });

  /** Possession `nature: 'bete'` montable (SOCLE POSSESSIONS #617/#618) — `cheval-de-monte` = Palefroi. */
  const mountPossession = (
    uid: string, ownerId: string, creatureId = 'cheval-de-monte',
    injury?: 'sangle-cassee' | 'perte-d-un-fer' | 'boiteux' | 'patte-brisee',
  ): Possession => ({ uid, ownerId, nature: 'bete', ref: { creatureId }, location: { kind: 'avec-le-groupe' }, items: [], mountInjury: injury });

  it('OFF (défaut) : le départ « en selle » est refusé', () => {
    const h = hero();
    setup(map(), [h], [mountPossession('m1', h.id)]);
    useGame.getState().startTravel('r1', 'monture');
    expect(useGame.getState().travelPlan).toBeNull();
    expect(useGame.getState().scene?.id).toBe('lieu-a-scene');
  });

  it('ON sans monture pour chaque héros vivant : refusé', () => {
    setRule('travel-allures', true);
    const h = hero();
    setup(map(), [h, hero({ id: 'h2', label: 'Nain' })], [mountPossession('m1', h.id)]);
    useGame.getState().startTravel('r1', 'monture');
    expect(useGame.getState().travelPlan).toBeNull();
    expect(useGame.getState().scene?.id).toBe('lieu-a-scene');
  });

  it('ON, groupe monté : 12 km au trot (Palefroi M7 → 17,5 km/h, EDOC 07 l.140) = 41 min', () => {
    setRule('travel-allures', true);
    const h = hero();
    setup(map(), [h], [mountPossession('m1', h.id)]);
    const t0 = useGame.getState().gameTime;
    useGame.getState().startTravel('r1', 'monture', { allure: 'trot' });
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.gameTime - t0).toBe(Math.round((12 / 17.5) * 60)); // 41 min
    expect(st.journal.some((l) => l.includes('en selle') && l.includes('trot'))).toBe(true);
  });

  it('sur-endurance au galop (Chien BE 2, 6 h) : la bête s’épuise — Incident de monte ou effondrement', () => {
    setRule('travel-allures', true);
    // Chien M4 : galop 12 km/h, endurance ½ BE = 1 h → une longue journée dépasse LARGEMENT.
    const h = hero();
    setup(map({ km: 80 }), [h], [mountPossession('m1', h.id, 'chien-de-trait')]);
    useGame.getState().startTravel('r1', 'monture', { allure: 'galop' });
    const j = useGame.getState().journal;
    expect(j.some((l) => l.includes('Incident de monte') || l.includes('s’effondre') || l.includes("s'effondre"))).toBe(true);
  });

  it('bête perdue en route (Boiteux/Patte brisée/morte) : la route continue à pied', () => {
    setRule('travel-allures', true);
    // La cascade du chien épuisé finit toujours par le rendre inutilisable ou mort sur 80 km au galop.
    let degraded = false;
    for (let seed = 1; seed <= 20 && !degraded; seed++) {
      seedBattleRng(seed);
      const h = hero();
      setup(map({ km: 80 }), [h], [mountPossession('m1', h.id, 'chien-de-trait')]);
      useGame.getState().startTravel('r1', 'monture', { allure: 'galop' });
      const st = useGame.getState();
      if (st.journal.some((l) => l.includes('la route continue à pied'))) {
        degraded = true;
        // Le plan (s'il court encore) est repassé à pied.
        if (st.travelPlan) expect(st.travelPlan.mode).toBe('pied');
      }
    }
    expect(degraded).toBe(true);
  });

  it('fer/sangle/boiteux sont remis en état à l’ARRIVÉE (choix documenté — RAW sans coût ni durée)', () => {
    setRule('travel-allures', true);
    const h = hero();
    setup(map(), [h], [mountPossession('m1', h.id, 'cheval-de-monte', 'perte-d-un-fer')]);
    useGame.getState().startTravel('r1', 'monture'); // au pas (le fer force déjà le pas)
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene');
    const mount = st.possessions.find((p) => p.uid === 'm1')!;
    expect(mount.nature === 'bete' ? mount.mountInjury : undefined).toBeUndefined();
    expect(st.journal.some((l) => l.includes('remise en état'))).toBe(true);
  });

  it('la séquelle déclarée HORS de portée des soins (Patte brisée) survit à l’arrivée — le boiteux du même voyage, lui, est soigné', () => {
    setRule('travel-allures', true);
    const h = hero();
    setup(map(), [h], [
      mountPossession('m1', h.id, 'cheval-de-monte', 'patte-brisee'),
      mountPossession('m2', h.id, 'poney', 'boiteux'),
    ]);
    useGame.getState().startTravel('r1', 'pied'); // aucune des deux bêtes n'est montable (`preventsMount`)
    const st = useGame.getState();
    expect(st.scene?.id).toBe('lieu-b-scene'); // le voyage est bien ARRIVÉ (sinon l'assertion suivante serait vide)
    const injuryOf = (uid: string) => {
      const p = st.possessions.find((x) => x.uid === uid)!;
      return p.nature === 'bete' ? p.mountInjury : undefined;
    };
    expect(injuryOf('m2')).toBeUndefined(); // TÉMOIN : les soins d'arrivée ont bien tourné
    expect(injuryOf('m1')).toBe('patte-brisee'); // …et n'ont rien pu pour celle-ci (`notHealedByCare`)
  });

  it('chute de selle (Dégâts de Chute, EDOC 07 l.167/l.174) : le héros encaisse ET `party` est FLUSHÉ (nouvelle référence, re-rendu HUD/fiche)', () => {
    setRule('travel-allures', true);
    // Chien M4/BE2 au galop sur 80 km : Incidents de monte garantis ; on cherche une graine qui produit
    // une chute de selle (Sangle cassée/Perte d'un fer ratée, l.166/l.171) sans tuer/estropier la bête
    // avant (le héros doit rester en selle assez longtemps pour chuter au moins une fois).
    let fell = false;
    for (let seed = 1; seed <= 60 && !fell; seed++) {
      seedBattleRng(seed);
      const h = hero();
      setup(map({ km: 80 }), [h], [mountPossession('m1', h.id, 'chien-de-trait')]);
      const partyRefBefore = useGame.getState().party;
      const woundsBefore = useGame.getState().party[0].wounds.current;
      useGame.getState().startTravel('r1', 'monture', { allure: 'galop' });
      // Le 1d10 des Dégâts de chute de selle tombe à la PORTE (#1508) : l'étape à dé nu appendue à la
      // journée est jouée ici, comme n'importe quel jet de la séquence de voyage.
      draineCascade(useGame.getState);
      const st = useGame.getState();
      const heroAfter = st.party.find((p) => p.id === h.id);
      if (heroAfter && heroAfter.wounds.current < woundsBefore) {
        fell = true;
        // Le `set` de fin de journée porte une NOUVELLE référence `party` (flush) — sinon les abonnés
        // Zustand keyés par référence (`useGame(s => s.party)`, HUD/fiche) ne re-rendent jamais la
        // mutation en place d'`applyFall` (régression relevée en revue #617/#618 Lot 2).
        expect(st.party).not.toBe(partyRefBefore);
        expect(heroAfter.wounds.current).toBeLessThan(woundsBefore);
      }
    }
    expect(fell).toBe(true);
  });

  it('attelage forcé (diligence, l.229) : Tests de Conduite d’attelage par km ; Échec Stupéfiant → Problème de véhicule', () => {
    setRule('travel-allures', true);
    // Conducteur sans Compétence (Ag 30 → cible basse) : échecs fréquents, Stupéfiants fréquents.
    let problem = false;
    for (let seed = 1; seed <= 30 && !problem; seed++) {
      seedBattleRng(seed);
      setup(map({ km: 30, modes: ['diligence'], prices: { diligence: 1 } }));
      useGame.getState().startTravel('r1', 'diligence', { classeId: 'exterieur', allure: 'galop' });
      drainCascade(); // #270 : le Test de Conduite d'attelage au km est une étape influençable (conducteur piloté par un humain)
      const st = useGame.getState();
      // La coque est créée dès que l'allure est forcée (les Dégâts du Problème doivent porter).
      expect(st.journal.some((l) => l.includes("Conduite d'attelage (allure forcée)"))).toBe(true);
      if (st.journal.some((l) => l.includes('Problème de véhicule'))) problem = true;
      // Fin de trajet propre : arrivé, ou dégradé à pied (véhicule hors d'usage), ou halte de nuit.
      while (useGame.getState().pendingRest && useGame.getState().travelPlan) sleepThroughHalt();
    }
    expect(problem).toBe(true);
  });

  it('attelage « Endommagé » : le reste du trajet se fait à la cadence de base (vehicleLame)', () => {
    setRule('travel-allures', true);
    // On cherche une graine où le Problème tiré est « Endommagé » (01-50 Incontrôlable maîtrisé exclu).
    let lame = false;
    for (let seed = 1; seed <= 60 && !lame; seed++) {
      seedBattleRng(seed);
      setup(map({ km: 200, modes: ['diligence'], prices: { diligence: 1 } }), [hero({ items: [ration('r1'), ration('r2'), ration('r3')] })]);
      creditBourse(useGame.getState, useGame.setState, 'h', { gold: 5, silver: 0, brass: 0 });
      useGame.getState().startTravel('r1', 'diligence', { classeId: 'exterieur', allure: 'galop' });
      drainCascade(); // #270 : le Test de Conduite d'attelage au km est une étape influençable (conducteur piloté par un humain)
      if (useGame.getState().travelPlan?.vehicleLame) lame = true;
      while (useGame.getState().pendingRest && useGame.getState().travelPlan && !lame) {
        sleepThroughHalt();
        if (useGame.getState().travelPlan?.vehicleLame) lame = true;
      }
    }
    expect(lame).toBe(true);
    expect(useGame.getState().journal.some((l) => l.includes('Endommagé'))).toBe(true);
  });
});

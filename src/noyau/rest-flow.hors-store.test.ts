/**
 * Modale de REPOS (noyau/restFlow) : offre par lieu/zone, choix PAR HÉROS (couchage + pitance,
 * orthogonaux), coût RAW (LDB 66), Exposition d'un campement (LDB 18 l.327-334). UNE NUIT comme
 * PLUSIEURS passent par une CHAÎNE de cascades séquentielles influençables (#347, `openRestNight`/
 * `continueRestNights`) — chaque jet = une étape, verrouillée à « Valider » avant le suivant, chaque
 * nuit reconstruite APRÈS que la précédente ait été validée (jamais de jet pré-résolu). Le moteur de
 * nuit `sleepParty` (chemin EAGER — cheat `reposerLeGroupe`, clôture d'interlude) reste testé par
 * rest.hors-store.test / upkeep-cascade.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { itemFromTrappingById } from '../engine/items';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { offresDeLAubergeDeScene } from './worldMap';
import { restPlacesHere, lodgingOptions, prixDeLOffre } from './restFlow';
import { makeRNG } from '../engine/dice';
import type { QualiteDeRepos } from '../data/schemas/grammaire/valeurs';
import { addRestZone } from './sceneEdit';
import { restSchema } from '../data/schemas/defs-scenes/effets';
import { resolveStake } from '../data';
import { contractDisease, tickDisease, diseaseDefs } from '../engine/disease';
import { spellOps } from '../engine/flowCore';
import { battleRng as battleRngFor } from './battleRng';
import { seedBattleRng } from './battleRng';
import { emptyScene, reposDeScene } from './monde/scene';
import { toBrass, type Money } from '../engine/money';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { stacks, addCondition } from '../engine/conditions';

import { MINUTES_PER_DAY } from '../engine/clock';
import type { Combatant, ItemInstance } from '../engine/types';
import { WORLD_STEP_OWNER, type CascadeStep } from './pendings';
import { deFixe } from '../engine/dice.testkit';
import { setCadence } from '../engine/cadence';
import { cascadeDeTest, draineCascade } from './cascade.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const ration = (uid: string): ItemInstance => ({ ...itemFromTrappingById('ration', idsDeTest)!, uid, enc: 0 });

/** Pose la bourse de la BANDE à un montant EXACT : purge toute bourse existante, puis crédite le doyen
 *  (les tests de repos ne vérifient que le TOTAL du groupe, qu'il tienne sur une ou plusieurs bourses). */
function setGroupPurse(m: Money): void {
  banc.setState((s) => ({ party: s.party.map((h) => ({ ...h, items: (h.items ?? []).filter((i) => i.trappingId !== 'bourse') })) }));
  creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, m);
}

/** Verrouille un ÉCHEC garanti (dé 100, DR négatif) sur l'étape COURANTE — BANDE (une rangée par
 *  héros, #1117 L3) ou étape mono. No-op sur une étape sans jet. */
function failCurrent(): void {
  const p = banc.getState().pendingCascade!;
  const cur = p.participants[p.cursor];
  const ko = (t: number) => ({ roll: 100, target: t, sl: -5, success: false });
  const at = (patch: Record<string, unknown>) =>
    banc.setState({ pendingCascade: { ...p, participants: p.participants.map((s, i) => (i === p.cursor ? { ...s, ...patch } as CascadeStep : s)) } });
  if (cur.participants) at({ participants: cur.participants.map((r) => (r.result ? r : { ...r, result: ko(r.target) })) });
  else if (cur.target != null && !cur.result) at({ result: ko(cur.target) });
}

/** Lance l'étape COURANTE au RNG — bande (chaque rangée) ou mono. */
function rollCurrent(): void {
  const p = banc.getState().pendingCascade!;
  const cur = p.participants[p.cursor];
  if (cur.participants) { for (const r of cur.participants) if (!r.result) banc.getState().jetLancer('cascadeEnBande', r.id); }
  else if (cur.target != null && !cur.result) banc.getState().jetLancer('cascade', cur.id);
}

/** Déroule la cascade de nuit (lance + valide chaque étape) jusqu'à la fin ; renvoie les `kind` vus
 *  (les étapes INSÉRÉES en cours de route — Exposition après l'abri — y figurent). */
function walkCascade(): string[] {
  const kinds: string[] = [];
  let guard = 0;
  while (banc.getState().pendingCascade && guard++ < 60) {
    kinds.push(banc.getState().pendingCascade!.participants[banc.getState().pendingCascade!.cursor].kind);
    rollCurrent();
    banc.getState().jetValider('cascade');
  }
  return kinds;
}

/** Force l'abri de fortune à ÉCHOUER (pour exercer l'Exposition) : verrouille un échec sur l'étape
 *  courante avant de la valider. Renvoie, par étape traversée, son `kind` et son nombre de RANGÉES. */
function walkCascadeAbriFails(): { kind: string; rows: number }[] {
  const seen: { kind: string; rows: number }[] = [];
  let guard = 0;
  while (banc.getState().pendingCascade && guard++ < 60) {
    const p = banc.getState().pendingCascade!;
    const cur = p.participants[p.cursor];
    seen.push({ kind: cur.kind, rows: cur.participants?.length ?? 0 });
    failCurrent();
    banc.getState().jetValider('cascade');
  }
  return seen;
}

const hero = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'h1', label: 'Hilda', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(12, 8), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, ...p,
  }) as Combatant);

beforeEach(() => {
  banc.setState({
    party: [hero(), hero({ id: 'h2', label: 'Bruno', items: [ration('r1')] })],
    battle: null, pendingRest: null, scene: emptyScene('scene-test', 10, 10),
  });
  setGroupPurse({ gold: 2, silver: 0, brass: 0 }); // bourse de bande = 2 CO (480 sc)
});

describe('ouvrirLeRepos / choix par héros', () => {
  it('auberge : choix PERSONNELS et orthogonaux — un héros en chambre+repas, l’autre dort dehors avec sa ration', () => {
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { auberge: true, camp: true } });
    const p = banc.getState().pendingRest!;
    expect(p.perHero['h1'].lodging).toBe('chambre-1'); // défaut auberge
    banc.getState().fenetreChoisir('repos', 'couchage', 'dehors', 'h2');
    banc.getState().fenetreChoisir('repos', 'pitance', 'ration', 'h2'); // manger sa ration et dormir à la belle étoile
    const cfg = banc.getState().pendingRest!.perHero;
    expect(cfg['h2']).toEqual({ lodging: 'dehors', food: 'ration' });
    // Coût : 1 chambre privée (couvre 2, ici 1 occupant) 10 pa + 1 repas 1 pa = 132 sc.
    banc.getState().fenetreValider('repos');
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(480 - 120 - 12);
    // Nuit UNIQUE → CASCADE (plus de bilan) : météo clémente → seulement les jets de récupération.
    expect(banc.getState().pendingRest).toBeNull();
    const cas = banc.getState().pendingCascade!;
    // UNE fenêtre « Récupération » (#1117 L3), une RANGÉE par héros à soigner (8/12 PB).
    expect(cas.participants.length).toBe(1);
    expect(cas.participants[0].kind).toBe('recuperation');
    expect(cas.participants[0].participants!.map((r) => r.id)).toEqual(['h1', 'h2']);
    walkCascade();
    expect(banc.getState().pendingCascade).toBeNull(); // cascade terminée
  });

  it('bourse insuffisante : Dormir refusé (on peut alors choisir la belle étoile, gratuite)', () => {
    setGroupPurse({ gold: 0, silver: 0, brass: 5 });
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { auberge: true, camp: true } });
    banc.getState().fenetreValider('repos'); // refus (privée + repas impayables)
    expect(banc.getState().pendingRest?.phase).toBe('setup');
    for (const id of ['h1', 'h2']) {
      banc.getState().fenetreChoisir('repos', 'couchage', 'dehors', id);
      banc.getState().fenetreChoisir('repos', 'pitance', 'rien', id);
    }
    banc.getState().fenetreValider('repos'); // gratuit → dort (cascade, plus de bilan)
    expect(banc.getState().pendingRest).toBeNull();
    expect(banc.getState().pendingCascade).toBeTruthy();
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(5);
  });

  it('campement sous la pluie sans tente : ABRI raté → l’Exposition est INSÉRÉE (2 VAGUES, 2 campeurs par vague)', () => {
    const sc = emptyScene('scene-test', 10, 10);
    sc.weather = 'pluie'; // difficile → 2 Tests/nuit si pas d'abri
    banc.setState({ scene: sc });
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { camp: true } });
    banc.getState().fenetreValider('repos');
    const cas = banc.getState().pendingCascade!;
    expect(cas.participants[0].kind).toBe('abri-de-fortune'); // l'abri de fortune ouvre la séquence
    // L'Exposition n'est insérée qu'à la validation de l'abri (dépendance) — absente avant.
    expect(cas.participants.some((s) => s.kind === 'exposition-nocturne')).toBe(false);
    const seen = walkCascadeAbriFails(); // abri raté → campement exposé
    // 2 Tests RAW (pluie, sans abri) = 2 VAGUES successives, chacune UNE fenêtre à 2 rangées (2 campeurs) :
    // les 4 jets RAW sont tous là, mais en DEUX fenêtres au lieu de quatre.
    expect(seen.filter((s) => s.kind === 'exposition-nocturne').map((s) => s.rows)).toEqual([2, 2]);
  });

  it('cascade : valider un TEST QUOTIDIEN de maladie raté applique son `onFail` (applicateur maladie-test-quotidien, #674)', () => {
    // DERNIER maillon de prod : la bande est verrouillée par `jetValider('cascade')`, l'applier `maladie-test-quotidien`
    // lit `row.meta.onFail` et le passe à `applyOps`. Aucun appel direct au moteur ici.
    const h = banc.getState().party[0];
    h.diseases = [contractDisease('pneumonie', battleRngFor())!];
    banc.setState((s) => ({ party: [...s.party] }));
    const onFail = spellOps(diseaseDefs()['pneumonie'].dailyTest!.test.echec, 'target');
    const bande = (id: string) => cascadeDeTest([
      { id, kind: 'maladie-test-quotidien', label: fixtureText('Fièvre (Pneumonie)'), aggregate: 'none',
        participants: [{ id: h.id, interactive: true, label: 'Résistance', base: 30, target: 30,
          meta: { diseaseName: 'pneumonie', symptomId: 'fievre', opsEchec: onFail },
          result: { roll: 99, target: 30, sl: -6, success: false } }] },
    ], { title: 'Entretien', purpose: 'travel' });

    banc.setState({ pendingCascade: bande('bande-dz1') });
    banc.getState().jetValider('cascade');
    const fievre = () => banc.getState().party[0].diseases![0].symptoms.find((s) => s.symptomId === 'fievre');
    expect(fievre()!.severity, '1er échec : la Fièvre passe Grave').toBe('grave');

    banc.setState({ pendingCascade: bande('bande-dz2') });
    banc.getState().jetValider('cascade');
    const symptomes = banc.getState().party[0].diseases![0].symptoms.map((s) => s.symptomId);
    expect(symptomes, '2ᵉ échec, Fièvre DÉJÀ Grave : l’échelon suivant tombe').toContain('toxine');
  });

  it('cascade : valider une MARCHE FORCÉE ratée applique +Exténué (applicateur marche-forcee)', () => {
    const h = banc.getState().party[0];
    const exten0 = stacks(h, 'extenue');
    // Cascade à une BANDE de marche forcée (#1117 L3), jet de la rangée figé sur un ÉCHEC.
    banc.setState({ pendingCascade: cascadeDeTest([
      { id: 'bande-m1', kind: 'marche-forcee', label: fixtureText('Marche forcée'), aggregate: 'none',
        participants: [{ id: h.id, interactive: true, label: 'Résistance', base: 40, target: 40, result: { roll: 99, target: 40, sl: -4, success: false } }] },
    ], { title: 'Marche', purpose: 'travel' }) });
    banc.getState().jetValider('cascade'); // verrouille l'échec → +Exténué (applyForcedMarch)
    expect(stacks(banc.getState().party[0], 'extenue')).toBe(exten0 + 1);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('avec une TENTE dans le paquetage : pas d’Exposition par nuit difficile (note de campement au journal)', () => {
    const sc = emptyScene('scene-test', 10, 10);
    sc.weather = 'pluie';
    banc.setState({ scene: sc });
    banc.getState().party[1].items!.push({ ...itemFromTrappingById('tente', idsDeTest)!, uid: 't', enc: 2, equipped: false });
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { camp: true } });
    banc.getState().fenetreValider('repos');
    const cas = banc.getState().pendingCascade!;
    expect(cas.participants.some((s) => s.kind === 'exposition-nocturne')).toBe(false); // tente → 0 Test difficile
    expect(cas.log.some((l) => /tente/i.test(l))).toBe(true); // « La tente est montée… »
  });
});

describe('régression T-bourse (#531, buildNightCascade) — gages débités CETTE nuit ne droppent pas les mutations eager', () => {
  beforeEach(() => setCadence('rapide')); // cadence auto : la paie se résout seule (pas de Conseil de bord)

  it('la dissipation d’Exténué (mutation eager, sans jet) du héros DÉBITÉ pour les gages est PERSISTÉE', () => {
    const solo = hero({ id: 'h1', label: 'Hilda', wounds: blessuresDeBase(12), items: [ration('r1')] }); // PB plein → needsRecoveryRoll=false
    addCondition(solo, 'extenue', 1);
    banc.setState({
      party: [solo], battle: null, pendingRest: null, scene: emptyScene('scene-test', 10, 10),
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, crew: [{ roleId: 'mousse', count: 1 }] },
      gameTime: 6 * MINUTES_PER_DAY + 6 * 60, lastUpkeepDay: 6, // veille d'un franchissement de semaine (MDG 14)
    });
    creditBourse(banc.getState, banc.setState, 'h1', { gold: 10, silver: 0, brass: 0 }); // couvre largement le gage du Mousse (288 sc)
    expect(stacks(banc.getState().party[0], 'extenue')).toBe(1);

    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { camp: true } });
    banc.getState().fenetreChoisir('repos', 'couchage', 'dehors', 'h1');
    banc.getState().fenetreChoisir('repos', 'pitance', 'ration', 'h1'); // mange sa ration : jamais affamé, la récupération s'applique
    banc.getState().fenetreValider('repos');

    // Les gages ont bien été prélevés cette nuit-là (le débit CLONE l'objet héros — `withBourseMoney`).
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeLessThan(toBrass({ gold: 10, silver: 0, brass: 0 }));
    // AVANT le fix : la dissipation d'Exténué (mutation eager, l.523/534 de buildNightCascade) s'appliquait
    // sur la réf PÉRIMÉE (capturée avant le débit) et se perdait au commit final — le héros restait Exténué
    // malgré une nuit de repos complète.
    expect(stacks(banc.getState().party[0], 'extenue')).toBe(0);
  });
});

describe('couchage À BORD (MDG) — le navire n’est pas un bivouac', () => {
  it('en mer, `bord` est le SEUL couchage : « dehors » ne figure PAS dans l’offre', () => {
    expect(lodgingOptions({ places: { bord: true }, offres: [] })).toEqual(['bord']);
    // Sur la rivière (mouillage possible), `bord` s’ajoute au campement, la belle étoile reste offerte.
    expect(lodgingOptions({ places: { camp: true, bord: true }, offres: [] })).toEqual(['bord', 'dehors']);
  });

  it('nuit à bord sous la tempête : ABRITÉ (aucune étape d’Exposition), la récupération a bien lieu', () => {
    const sc = emptyScene('scene-test', 10, 10);
    sc.weather = 'tempete'; // extrême à terre — mais on est à bord (hamacs, abrité)
    banc.setState({ scene: sc });
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { bord: true } });
    expect(banc.getState().pendingRest!.perHero['h1'].lodging).toBe('bord'); // défaut = à bord
    banc.getState().fenetreValider('repos');
    const cas = banc.getState().pendingCascade!;
    expect(cas.participants.some((s) => s.kind === 'exposition-nocturne' || s.kind === 'abri-de-fortune')).toBe(false);
    expect(cas.participants.every((s) => s.kind === 'recuperation')).toBe(true); // récupération (Résistance +20) inchangée
    walkCascade();
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('à terre SANS navire : offre inchangée (pas de couchage `bord`)', () => {
    expect(lodgingOptions({ places: { camp: true }, offres: [] })).toEqual(['dehors']);
    expect(lodgingOptions({ places: { auberge: true }, offres: offresDeLAubergeDeScene() })).toEqual(['commune', 'dehors']);
  });
});

describe('repos MULTI-JOURS (#347) — chaîne de cascades nuit-par-nuit, jamais un jet pré-résolu', () => {
  const forceFailCurrent = failCurrent; // même geste (bande ou mono), sur la nuit courante de la chaîne

  /** Déroule TOUTE la chaîne de nuits (échecs garantis sur chaque étape-jet) jusqu'à ce qu'aucune
   *  cascade ne reste pendante — renvoie le nombre de fois où une cascade de nuit s'est ouverte. */
  function walkNightChain(maxSteps = 200): number {
    let nights = 0;
    let sawEmpty = true;
    let guard = 0;
    while (guard++ < maxSteps) {
      const p = banc.getState().pendingCascade;
      if (!p) {
        if (!sawEmpty) { nights++; sawEmpty = true; }
        if (!banc.getState().pendingCascade) break; // rien d'autre ne s'ouvrira
        continue;
      }
      sawEmpty = false;
      forceFailCurrent();
      banc.getState().jetValider('cascade');
    }
    return nights;
  }

  it('2 nuits d’affilée sans ration : CHAQUE nuit est SA PROPRE cascade influençable, non pré-résolue', () => {
    const starving = hero({ id: 'h1', label: 'Hilda', hunger: { days: 1, tests: 0, failures: 0 } });
    banc.setState({ party: [starving], scene: emptyScene('scene-test', 10, 10), pendingRest: null }); // camp (gratuit) → aucune bourse à semer
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { camp: true }, days: 4 }); // days>1 → repos multi-jours authoré (op `rest`)
    banc.getState().fenetreChoisir('repos', 'pitance', 'rien', 'h1');
    banc.getState().fenetreValider('repos');

    // Nuit 1 (jour 1→2) : le Test de Faim tombe (l.417 : tous les 2 jours) — étape NON pré-résolue.
    expect(banc.getState().pendingRest).toBeNull(); // basculé en cascade, plus de bilan
    const cas1 = banc.getState().pendingCascade!;
    expect(cas1.purpose).toBe('night');
    expect(cas1.restNights).toEqual({ p: expect.objectContaining({ days: 4 }), nightsLeft: 3 }); // 3 nuits ENCORE à enchaîner
    const faim1 = cas1.participants.find((s) => s.kind === 'faim')!;
    expect(faim1).toBeTruthy();
    expect(banc.getState().party[0].hunger!.tests).toBe(0); // DIFFÉRÉ, pas roulé en eager

    // Valider la nuit 1 (échec garanti) → conséquence appliquée UNE fois.
    forceFailCurrent();
    banc.getState().jetValider('cascade');
    expect(banc.getState().party[0].hunger!.tests).toBe(1);
    expect(banc.getState().party[0].hunger!.failures).toBe(1); // 1er échec (l.422)

    // Nuit 2 (jour 2→3) : la chaîne a enchaîné SEULE (dispatchCascadeDone → continueRestNights) — la
    // cascade de la nuit SUIVANTE s'ouvre automatiquement (jamais un bilan silencieux entre les deux).
    const cas2 = banc.getState().pendingCascade;
    // jour 2→3 : days%2 != 0 → pas de Test de Faim cette nuit-ci (cadence RAW, l.422) → 0 étape → la
    // chaîne enchaîne DIRECTEMENT (silencieusement pour cette nuit SANS jet, jamais un jet tissé).
    if (cas2) expect(cas2.restNights?.nightsLeft).toBeLessThan(3);
  });

  it('escalade CUMULATIVE de la Faim PORTÉE d’une nuit à l’autre (compteur persisté sur le héros)', () => {
    const starving = hero({ id: 'h1', label: 'Hilda', hunger: { days: 0, tests: 0, failures: 0 } });
    banc.setState({ party: [starving], scene: emptyScene('scene-test', 10, 10), pendingRest: null }); // camp (gratuit) → aucune bourse à semer
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { camp: true }, days: 4 });
    banc.getState().fenetreChoisir('repos', 'pitance', 'rien', 'h1');
    banc.getState().fenetreValider('repos');
    walkNightChain();

    expect(banc.getState().pendingCascade).toBeNull(); // toute la chaîne close, aucune reste pendante
    const h = banc.getState().party[0];
    expect(h.hunger!.tests).toBe(2); // Tests aux jours 2 et 4 (l.422 : tous les 2 jours)
    expect(h.hunger!.failures).toBe(2); // les 2 Tests, forcés à l'échec → escalade au 2ᵉ échec
  });
});

describe('qualité de l’hébergement — prix et Courante galopante (LDB 66 l.5)', () => {
  /** Les deux héros prennent l'offre par défaut de l'auberge : une chambre privée partagée et deux repas. */
  const nuitALAuberge = (quality: QualiteDeRepos): void => {
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { auberge: true }, quality });
    expect(Object.values(banc.getState().pendingRest!.perHero)).toEqual([{ lodging: 'chambre-1', food: 'repas' }, { lodging: 'chambre-1', food: 'repas' }]);
    banc.getState().fenetreValider('repos');
  };
  const prixListes = toBrass(prixDeLOffre({ id: 'chambre' }, 'normale')) + 2 * toBrass(prixDeLOffre({ id: 'repas' }, 'normale'));

  it('piètre : la moitié des prix listés ; normale : les prix listés ; grande : le double', () => {
    const payes = (['pietre', 'normale', 'grande'] as const).map((q) => {
      setGroupPurse({ gold: 2, silver: 0, brass: 0 });
      nuitALAuberge(q);
      walkCascade();
      return 480 - toBrass(partyMoneyTotal(banc.getState));
    });
    expect(payes).toEqual([prixListes / 2, prixListes, prixListes * 2]);
  });

  it('seul le repas de piètre qualité expose à la Courante galopante, sur le d100 ≤ 10', () => {
    const graine = Array.from({ length: 1000 }, (_, i) => i + 1).find((s) => makeRNG(s).int(1, 100) <= 10)!;
    const exposes = (quality: QualiteDeRepos): string[] => {
      banc.setState({ party: [hero(), hero({ id: 'h2', label: 'Bruno' })] });
      setGroupPurse({ gold: 2, silver: 0, brass: 0 });
      seedBattleRng(graine);
      nuitALAuberge(quality);
      const steps = banc.getState().pendingCascade!.participants;
      const ids = steps.filter((s) => s.kind === 'contagion' && s.meta?.diseaseName === 'courante-galopante')
        .flatMap((s) => s.participants?.map((r) => r.id) ?? (s.actorId ? [s.actorId] : []));
      walkCascade();
      return ids;
    };
    expect(exposes('pietre')).toContain('h1');
    expect([exposes('normale'), exposes('grande')]).toEqual([[], []]);
  });

  it('le seuil du risque est 10 % : le d100 à 11 n’expose pas le premier dormeur de piètre qualité', () => {
    expect(makeRNG(65).int(1, 100)).toBe(11);
    banc.setState({ party: [hero(), hero({ id: 'h2', label: 'Bruno' })] });
    setGroupPurse({ gold: 2, silver: 0, brass: 0 });
    seedBattleRng(65);
    nuitALAuberge('pietre');
    const exposes = banc.getState().pendingCascade!.participants
      .filter((s) => s.kind === 'contagion' && s.meta?.diseaseName === 'courante-galopante')
      .flatMap((s) => s.participants?.map((r) => r.id) ?? (s.actorId ? [s.actorId] : []));
    walkCascade();
    expect(exposes).not.toContain('h1');
  });
});

describe('restPlacesHere — offre paramétrable sur la ZONE', () => {
  it('zone de repos prioritaire sur la scène ; scène sans rien = camp ; tout à false = interdit', () => {
    const sc = emptyScene('scene-test', 10, 10);
    sc.rest = { camp: true };
    sc.restZones = [{ rect: { x: 0, y: 0, w: 3, h: 3 }, places: { auberge: true }, quality: 'pietre' }];
    // Dans la zone (0-2) : l'auberge piètre du quartier.
    let here = restPlacesHere({ scene: sc, partyPos: { x: 1, y: 1 } } as never);
    expect(here).toEqual({ places: { auberge: true }, quality: 'pietre' });
    // Hors zone : l'offre de la scène (camp).
    here = restPlacesHere({ scene: sc, partyPos: { x: 5, y: 5 } } as never);
    expect(here?.places).toEqual({ camp: true });
    // Repos interdit (tout à false).
    sc.rest = { camp: false };
    expect(restPlacesHere({ scene: sc, partyPos: { x: 5, y: 5 } } as never)).toBeNull();
  });

  it('#803 — zone de repos au rez (z absent/0) inactive quand le groupe campe à l’étage 1', () => {
    const sc = emptyScene('scene-test', 10, 10);
    sc.rest = { camp: true };
    sc.restZones = [{ rect: { x: 0, y: 0, w: 3, h: 3 }, places: { auberge: true }, quality: 'pietre' }];
    const rez = restPlacesHere({ scene: sc, partyPos: { x: 1, y: 1, z: 0 } } as never);
    expect(rez).toEqual({ places: { auberge: true }, quality: 'pietre' });
    // Même case (x,y) mais à l'étage 1 : la zone du rez ne s'applique plus → repli sur l'offre de scène.
    const etage = restPlacesHere({ scene: sc, partyPos: { x: 1, y: 1, z: 1 } } as never);
    expect(etage?.places).toEqual({ camp: true });
    // La zone posée avec z:1 s'applique à l'étage 1.
    sc.restZones = [{ rect: { x: 0, y: 0, w: 3, h: 3, z: 1 }, places: { auberge: true } }];
    expect(restPlacesHere({ scene: sc, partyPos: { x: 1, y: 1, z: 1 } } as never)?.places).toEqual({ auberge: true });
    expect(restPlacesHere({ scene: sc, partyPos: { x: 1, y: 1, z: 0 } } as never)?.places).toEqual({ camp: true });
  });
});

describe('offre de repos implicite — l’éditeur lit ce que le repos applique', () => {
  it('scène sans offre, ou à offre posée : `reposDeScene` égale l’offre de `restPlacesHere` ; une zone neuve naît sur l’offre implicite', () => {
    for (const rest of [undefined, { auberge: true }, { maison: true, camp: false }]) {
      const sc = { ...emptyScene('scene-test', 10, 10), ...(rest ? { rest } : {}) };
      expect(restPlacesHere({ scene: sc, partyPos: { x: 5, y: 5 } } as never)?.places ?? null, JSON.stringify(rest)).toEqual(reposDeScene(sc));
    }
    const zone = addRestZone(emptyScene('scene-test', 10, 10), { x: 0, y: 0, w: 2, h: 2 }).scene.restZones![0];
    expect(zone.places).toEqual(reposDeScene(emptyScene('scene-test', 10, 10)));
  });
});

describe('effet `rest` (éditeur)', () => {
  it('LEGACY sans lodging : ouvre la modale en contexte maison (gratuit) — et la nuit dort vraiment', () => {
    const t0 = banc.getState().gameTime ?? 0;
    applyEffects(banc.getState, banc.setState, [{ type: 'rest' }]);
    const p = banc.getState().pendingRest!;
    expect(p.places.maison).toBe(true);
    banc.getState().fenetreValider('repos');
    expect((banc.getState().gameTime ?? 0)).toBeGreaterThan(t0);
  });

  it('trois qualités : la nuit à l’auberge porte la qualité de l’effet, et le schéma refuse une autre', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'rest', lodging: 'auberge', quality: 'grande' }]);
    expect(banc.getState().pendingRest!.quality).toBe('grande');
    expect(restSchema.safeParse({ type: 'rest', quality: 'grande' }).success).toBe(true);
    expect(restSchema.safeParse({ type: 'rest', quality: 'luxe' }).success).toBe(false);
  });
});

/**
 * Le RENVOI de règle d'une étape de MALADIE descend au SYMPTÔME joué (#1117, escalade user
 * 2026-08-06 : « Blessé (Blessure Purulente) » ouvrait l'INTRO du chapitre des maladies, du propos
 * d'auteur MJ, au lieu de la fiche du symptôme). Le symptôme voyage dans le `meta` du Test différé,
 * de son émission (`engine/disease`) jusqu'à la clé d'enjeu de l'étape (`{dataset, kind, entryId}`).
 */

/**
 * CHEMIN RÉEL du joueur (recette 2026-08-06) : héros MALADE → auberge → « Dormir » → la cascade de
 * nuit s'ouvre → l'étape « Blessé » porte SON symptôme, donc son renvoi de règle pointe la fiche du
 * SYMPTÔME (Codex « Symptômes »), pas l'intro du chapitre des maladies.
 *
 * Ce test passe par `ouvrirLeRepos` + `fenetreValider('repos')` — les DEUX bâtisseurs de la nuit s'exécutent, dans le
 * MÊME ordre qu'en jeu. Une version qui n'appelait que `deferredUpkeepSteps` était VERTE alors que le
 * navigateur était ROUGE : le second bâtisseur écrasait la clé. Le test suit le chemin du joueur.
 */
describe('CHEMIN RÉEL — la règle d’une étape de maladie est celle du SYMPTÔME (#1117)', () => {
  function malade(): Combatant {
    const h = banc.getState().party[0]!;
    seedBattleRng(7);
    const dz = contractDisease('blessure-purulente', battleRngFor())!;
    h.diseases = [...(h.diseases ?? []), dz];
    // Comme le helper de recette `__wfrp.disease(..., { phase:'active' })` : on AVANCE le vrai cycle.
    if (dz.phase === 'incubation') tickDisease(h, dz.minutesLeft, battleRngFor(), () => {});
    banc.setState((s) => ({ party: [...s.party] }));
    return h;
  }

  it('« Dormir » à l’auberge → l’étape du symptôme porte son `entryId` et renvoie à SA fiche', () => {
    malade();
    setGroupPurse({ gold: 5, silver: 0, brass: 0 });
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { auberge: true } });
    banc.getState().fenetreValider('repos');
    const p = banc.getState().pendingCascade;
    expect(p, 'la cascade de nuit s’ouvre').toBeTruthy();
    const step = p!.participants.find((s) => s.kind === 'maladie-test-quotidien');
    expect(step, 'la nuit d’un malade porte le Test de cycle du symptôme').toBeTruthy();
    expect(step!.meta?.symptomId, 'le symptôme voyage jusqu’à l’étape').toBe('blesse');
    expect(step!.stake, 'la clé d’enjeu NOMME l’entrée jouée').toHaveProperty('key.entryId', 'blesse');
    expect(resolveStake(step!.stake!).rule, 'le renvoi pointe la fiche du SYMPTÔME').toEqual({ category: 'symptoms', id: 'blesse' });
    // REPLI prouvé AU BÂTISSEUR, sur le MÊME chemin réel : une étape SANS entrée jouée (Récupération)
    // ne fabrique aucun `entryId` et garde la fiche de son `kind`.
    const recovery = p!.participants.find((s) => s.kind === 'recuperation');
    expect(recovery, 'la nuit porte aussi le Test de Récupération').toBeTruthy();
    expect(recovery!.stake).toHaveProperty('key');
    expect(recovery!.stake, 'aucune entrée jouée : pas d’entryId fabriqué').not.toHaveProperty('key.entryId');
    expect(resolveStake(recovery!.stake!).rule).toEqual({ category: 'regles', id: 'guerison-des-blessures' });
  });
});

/** MDG 14 l.208 : la nuit à bord, l'équipage collectif (`porteursABord`) expose et est exposé comme un PJ. #4243 */
describe('Contagion de nuit à bord — l’équipage collectif (MDG 14 l.208 ; #4243)', () => {
  const verole = () => contractDisease('verole-urticante', deFixe(1) as never, { incubation: 0, duration: 5 })!;

  /** Le groupe `party` dort `places` avec la cogue de campagne, dont l'équipage porte `equipage`. */
  function dormir(party: Combatant[], places: { bord?: boolean; camp?: boolean }, equipage: { diseases?: ReturnType<typeof verole>[] } = {}): void {
    banc.setState({
      party, scene: emptyScene('scene-test', 6, 6),
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, ...(equipage.diseases ? { porteurDeLEquipage: equipage } : {}) },
    } as never);
    banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places });
    for (const h of party) banc.getState().fenetreChoisir('repos', 'pitance', 'rien', h.id);
    banc.getState().fenetreValider('repos');
  }
  const rangeesDeContagion = () => banc.getState().pendingCascade!.participants
    .filter((s) => s.kind === 'contagion').flatMap((s) => s.participants!.map((r) => r.id));
  /** Déroule la nuit : les Tests de Contagion échouent (dé 100), les autres se lancent. */
  function nuitAvecContagionRatee(): void {
    draineCascade(banc.getState, 60, (etape) => (etape.kind === 'contagion' ? 100 : undefined));
  }

  it('un PJ contagieux à bord expose l’équipage : sa rangée de monde rejoint la bande, l’échec lui donne la maladie', () => {
    dormir([hero({ id: 'm1', diseases: [verole()] }), hero({ id: 's1', label: 'Sain' })], { bord: true });
    expect(rangeesDeContagion()).toEqual(['s1', WORLD_STEP_OWNER]);
    nuitAvecContagionRatee();
    expect(banc.getState().vessel!.porteurDeLEquipage?.diseases?.map((d) => d.id)).toEqual(['verole-urticante']);
    expect(banc.getState().party.find((h) => h.id === 's1')!.diseases?.map((d) => d.id)).toEqual(['verole-urticante']);
  });

  it('hors du bord, l’équipage n’est ni exposé ni source', () => {
    dormir([hero({ id: 'm1', diseases: [verole()] }), hero({ id: 's1', label: 'Sain' })], { camp: true });
    expect(rangeesDeContagion()).toEqual(['s1']);
  });

  it('l’équipage contagieux à bord expose chaque PJ sain, une rangée chacun', () => {
    dormir([hero({ id: 's1' }), hero({ id: 's2', label: 'Bruno' })], { bord: true }, { diseases: [verole()] });
    expect(rangeesDeContagion()).toEqual(['s1', 's2']);
  });
});

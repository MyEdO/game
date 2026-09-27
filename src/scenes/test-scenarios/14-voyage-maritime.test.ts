import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../../state/store';
import { testScenarios } from './index';
import { seedBattleRng } from '../../state/battleRng';
import { distributeCredit, partyMoneyTotal } from '../../state/bourseFlow';
import { findSpell } from '../../data';
import { knowsCastingSkill, isArcaneSpell, isMagicMissile } from '../../engine/magic';
import { spellEffectOps } from '../../engine/flowCore';
import { avanceEtapeCascade, draineCascade } from '../../state/cascadeTestKit';

const scen = testScenarios.find((s) => s.id === 'voyage-maritime')!;
const get = () => useGame.getState();

/** Lance le scénario EXACTEMENT comme le menu (setParty → loadProject → money → vessel). */
function launch(seed = 1) {
  seedBattleRng(seed);
  const g = get();
  g.setParty(scen.makeParty());
  g.loadProject([scen.scene, ...(scen.extraScenes ?? [])], scen.scene.id, scen.worldMap ?? null);
  if (scen.money) distributeCredit(get, useGame.setState, scen.money); // bourses du groupe (SOCLE POSSESSIONS #531)
  if (scen.vessel) useGame.setState({ vessel: scen.vessel });
  // La carte d'ENTRÉE de zone est une étape d'AFFICHAGE de cascade (#942 L8) : comme toute fenêtre de
  // cascade, elle gèle les actions du bord (`startTravel` compris) tant qu'elle n'est pas acquittée.
  // Le scénario l'acquitte donc, comme un joueur, AVANT d'appareiller.
  draineCascade(get);
}

/** Dort à une halte de nuit (« Dormir » → cascade de nuit → reprise de la route au matin). */
function sleepThroughHalt(): void {
  get().restSleep();
  draineCascade(get, 80);
}

/** Déroule la traversée jusqu'à l'ACCOSTAGE (travelPlan retombé à null + scène du port d'arrivée) —
 *  la journée est UNE cascade `purpose:'travelDay'` (#275 Ronde 2 cran 3) : roule chaque étape (mono ou
 *  À PARTICIPANTS), saute les Activités, dort aux haltes. Renvoie les `kind` d'étape rencontrés (Tests
 *  d'équipage de voyage : progression/orientation/entretien…). */
function sailToPort(maxSteps = 400): string[] {
  const kinds: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    if (!get().travelPlan && get().scene?.id === 'test-mer-arrivee') break; // arrivé
    if (get().pendingCascade) {
      const k = avanceEtapeCascade(get);
      if (k !== undefined) kinds.push(k);
      continue;
    }
    if (get().pendingSeaActivities) { get().seaActivitiesConfirm({}); continue; }
    if (get().pendingRest) { sleepThroughHalt(); continue; }
    if (get().pendingShoreLeave) { get().resolveShoreLeave(true); continue; } // accoste : relâche accordée par défaut (MDG 15 l.245)
    if (!get().travelPlan) break; // sécurité : plus de plan et pas au port → on s'arrête
  }
  return kinds;
}

describe('Scénario Voyage maritime — enregistrement & carte', () => {
  it('est dans la section Naval, avec route MARITIME (milles) entre 2 ports dont un à phare + le navire de campagne', () => {
    expect(scen.category).toBe('naval');
    expect(scen.vessel?.vehicleId).toBe('cogue');
    const route = scen.worldMap!.routes.find((r) => r.id === 'route-marienburg')!;
    expect(route.sea).toBe(true);
    expect(route.modes).toContain('mer');
    const marienburg = scen.worldMap!.places.find((p) => p.id === 'p-marienburg')!;
    expect(marienburg.port).toBeTruthy();
    expect(marienburg.port!.lighthouse).toBe(true);
    expect(scen.extraScenes?.some((s) => s.id === 'test-mer-arrivee')).toBe(true);
  });

  it('cap EST — vent de dos sur les dominantes d\'ouest (MDG 13 l.253), jamais de face permanent (#408)', () => {
    const route = scen.worldMap!.routes.find((r) => r.id === 'route-marienburg')!;
    expect(route.seaHeading).toBe('est');
  });
});

describe('Scénario Voyage maritime — durée bornée sur un échantillon de seeds (#408)', () => {
  /** `seaHeading: 'ouest'` (avant fix #408) mettait le cap DIRECTEMENT contre les vents dominants
   *  d'ouest (`windAspect` → 'face' quand cap==vent, Affaler quasi systématique dès Vent violent) :
   *  sur seeds 1..30, la traversée s'étirait jusqu'à 106,875 jours (moyenne 12,1) au lieu des
   *  « plusieurs jours » attendus. Cap EST (vent de dos dominant) : plafond large pour couvrir la
   *  variance légitime des tempêtes (RAW), mais qui aurait échoué sur l'ancien cap.
   *
   *  MESURE du 2026-09-27 (#1897 ; MDG 13 l.272, l.294 ; MDG 14 l.242) :
   *  [2,875 · 1,875 · 1,875 · 1,875 · 10,875 · 3,875 · 1,875 · 13,875 · 2,875 · 1,875 · 1,875 · 1,875
   *   · 1,875 · 1,875 · 2,875], max 13,875 (seed 8), moyenne 3,608 ; équipages décalés (graines
   *  +1 / +2 / +7000) : max 13,875 / 16,875 / 21,875. Le plafond de 42 j n'est donc pas serré : il
   *  reste la borne qui aurait ROUGI sur l'ancien cap ouest. */
  it('aucune des 15 premières seeds ne dépasse 42 jours de mer (l\'ancien cap ouest atteignait 106,875)', () => {
    const days: number[] = [];
    for (let seed = 1; seed <= 15; seed++) {
      launch(seed);
      const t0 = get().gameTime;
      get().startTravel('route-marienburg', 'mer');
      sailToPort(2000);
      days.push((get().gameTime - t0) / (24 * 60));
    }
    for (const d of days) expect(d).toBeLessThanOrEqual(42);
    expect(days.reduce((a, b) => a + b, 0) / days.length).toBeLessThan(10);
  });
});

describe('Scénario Voyage maritime — beat de Magie des mers (lancer en mer)', () => {
  const navi = scen.makeParty().find((h) => h.id === 'mar-navi')!;

  it('le Navigateur est un Astromancien : il maîtrise l’incantation et connaît Bienfait de Bel Shanaar', () => {
    expect(knowsCastingSkill(navi, 'langue', 'magick')).toBe(true); // incantation des Arcanes
    expect(knowsCastingSkill(navi, 'focalisation')).toBe(true); // Test étendu de Focalisation
    expect(navi.spells).toContain('bienfait-de-bel-shanaar'); // runtime = id de sort
    const sp = findSpell('Bienfait de Bel Shanaar')!;
    expect(sp.domainId).toBe('cieux');
    expect(isArcaneSpell(sp)).toBe(true); // → bouton « ✨ Focaliser »
    expect(isMagicMissile(sp)).toBe(false); // non offensif → lançable en mer, hors combat
  });

  it('Bienfait de Bel Shanaar a un effet MÉCANIQUE : +2 DR aux Tests d’Orientation (skillDRBonus)', () => {
    const sp = findSpell('Bienfait de Bel Shanaar')!;
    const ops = spellEffectOps(sp.effects);
    const dr = ops.find((o) => o.op === 'skillDRBonus') as { op: string; skill: string; bonus: number } | undefined;
    expect(dr).toBeTruthy();
    expect(dr!.skill).toEqual({ id: 'orientation' });
    expect(dr!.bonus).toBe(2);
  });
});

describe('Scénario Voyage maritime — traversée JOUABLE de bout en bout', () => {
  beforeEach(() => launch(1));

  it('appareille, enchaîne des jours de mer (Tests d’équipage + haltes) et ACCOSTE au Grand Port', () => {
    const t0 = get().gameTime;
    expect(get().scene?.id).toBe('test-mer-depart');
    get().startTravel('route-marienburg', 'mer'); // mode MER : appareillage sur le navire de campagne
    expect(get().travelPlan?.mode).toBe('mer');
    expect(get().travelPlan?.sea).toBeTruthy();

    const kinds = sailToPort();

    // ARRIVÉE : la traversée est finie, on est à Marienburg, plusieurs jours ont passé.
    expect(get().travelPlan).toBeNull();
    expect(get().scene?.id).toBe('test-mer-arrivee');
    expect(get().gameTime - t0).toBeGreaterThanOrEqual(2 * 24 * 60); // ≥ 2 jours de mer
    // Les Tests d’équipage de VOYAGE ont bien été joués (Progression quotidienne, Orientation).
    expect(kinds).toContain('progression');
    expect(kinds).toContain('orientation');
    // La coque partie endommagée a fait l’objet d’un entretien du soir (Test d’équipage d’entretien).
    expect(kinds).toContain('entretien');
    expect(get().journal.join('\n')).toMatch(/Accostage|Marienburg/);
  });

  it('à quai : l’écran Port ouvre et propose réparation + offres de commerce', () => {
    get().startTravel('route-marienburg', 'mer');
    sailToPort();
    expect(get().scene?.id).toBe('test-mer-arrivee');

    // Coque endommagée persistée sur le navire de campagne → réparable au chantier (1 CO/Blessure).
    const woundsBefore = get().vessel!.wounds!.current;
    expect(woundsBefore).toBeLessThan(get().vessel!.wounds!.max);
    const goldBefore = partyMoneyTotal(get).gold;
    get().portRepair();
    expect(get().vessel!.wounds!.current).toBe(get().vessel!.wounds!.max); // remise à neuf
    expect(partyMoneyTotal(get).gold).toBeLessThan(goldBefore); // 1 CO par Blessure

    // Écran Port : offres de commerce du grand port cosmopolite (Production + Surplus).
    get().openPort();
    expect(get().port!.placeId).toBe('p-marienburg');
    expect(get().port!.offers.length).toBeGreaterThan(0);
  });
});

/**
 * MENDIER (`LDB 09 l.97-99`) — l'Activité, et les trois pièces de vocabulaire qu'elle a demandées au
 * socle : le terme `{sl}` d'une `Formula`, l'op `money` (bourse PERSONNELLE), et le dé de MONDE
 * attaché à une Activité (`worldRolls`).
 *
 * RAW verbatim (`Source/Warhammer v4 - Livre de base version corrigee/09 - Competences.md:97`) :
 * « Un Test réussi vous vaudra un nombre de sous de cuivre égal à votre Bonus de Sociabilité x DR par
 * heure de la part des passants […] Si vous n'obtenez pas de DR, mais que vous réussissez quand même
 * le Test, vous ne réussissez à glaner qu'un sou. Un Échec Stupéfiant (-6) signifie que vous vous êtes
 * peut-être attiré des ennuis […] »
 * `l.99` : « les Personnages surpris à mendier par leurs pairs ou associés perdront probablement leur
 * Statut, à moins qu'ils n'aient déjà une Carrière de Mendiant, ou une autre Carrière sans ressources. »
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dossierDesProjetsLivres, listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { basename, join } from 'node:path';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { toBrass } from '../engine/money';
import { bourseOf, bourseBrass } from '../engine/bourse';
import { applyOps, resolveFormula, FORMULA_OBJECT_KEYS, type Formula } from '../engine/ops';
import { activityById, activityTestMod, activityAvailableAt, matchOutcomes } from '../engine/activities';
import { findEffectTableById } from '../data/effectTables';
import { schema as activitiesSchema } from '../data/schemas/defs/activities';
import { statusOf, statusMeets } from '../engine/social';
import { aPassifVisible } from '../engine/trauma';
import { buildActorView } from '../engine/actorView';
import { careers } from '../data';
import { buildActivityWorldRollSteps } from './activityWorldRolls';
import { interludeCatalog } from './interludeFlow';
import { setRule, resetRule } from '../engine/policy';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { WorldMap } from './worldMap';

/** Humains (Reiklander), « Affable *ou* Perspicace » (LDB 05 l.490) : Perspicace, la Sociabilité reste nue. */
const PERSPICACE = { 'espece:talents:0': { id: 'perspicace' } };

const ROOT = join(import.meta.dirname, '..', '..');

/** Le gain RAW de Mendier, tel qu'authoré : (Bonus de Sociabilité × DR) × heures. */
const GAIN: Formula = {
  times: {
    of: { times: { of: { bonusOf: 'sociabilite' }, factor: { sl: true } } },
    factor: { rule: 'mendier-heures-par-jour' },
  },
};

function heros(soc: number): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Mendiant', seed: 1, speciesTalentChoices: PERSPICACE });
  h.characteristics.sociabilite = soc;
  return h;
}

describe('Formula `{sl}` — le DR du Test courant (LDB 09 l.97 « Bonus de Sociabilité x DR »)', () => {
  it('BSoc 4, DR 3 → 12 ; le facteur d’heures multiplie ensuite', () => {
    const h = heros(45); // Bonus de Sociabilité = 4
    expect(resolveFormula({ times: { of: { bonusOf: 'sociabilite' }, factor: { sl: true } } }, h, makeRNG(1), undefined, undefined, undefined, undefined, undefined, 3)).toBe(12);
    setRule('mendier-heures-par-jour', 4);
    expect(resolveFormula(GAIN, h, makeRNG(1), undefined, undefined, undefined, undefined, undefined, 3)).toBe(48);
    resetRule('mendier-heures-par-jour');
  });

  it('hors contexte de Test (aucun DR passé) : 0, jamais NaN', () => {
    const h = heros(45);
    const n = resolveFormula(GAIN, h, makeRNG(1));
    expect(Number.isNaN(n)).toBe(false);
    expect(n).toBe(0);
  });

  it('`sl` est DÉCLARÉE aux clés de Formula — la garde de données la connaît', () => {
    expect([...FORMULA_OBJECT_KEYS]).toContain('sl');
  });
});

/**
 * MUTATION (op `money`) : rebrancher `applyOps` sur `o.brass` au lieu de `o.montant.brass`
 * (`engine/ops.ts` case 'money') — les quatre `it` de ce bloc tombent (`bourseBrass` reste à 0, la
 * `Formula` n'est plus trouvée). Le NOM de la charge est le contrat (`monnaie-forme-unique`, sonde A).
 */
describe('op `money` — la bourse PERSONNELLE de la cible (bourse = trapping, LDB 61 l.29)', () => {
  it('crédite un héros qui n’a PAS de bourse : l’instance est créée', () => {
    const h = heros(45);
    h.items = (h.items ?? []).filter((i) => i.trappingId !== 'bourse');
    expect(bourseOf(h)).toEqual({ gold: 0, silver: 0, brass: 0 });
    const lignes = applyOps(h, [{ op: 'money', montant: { brass: 37 } }], { rng: makeRNG(1), label: 'Mendier' });
    expect(bourseBrass(h)).toBe(37);
    expect(h.items!.some((i) => i.trappingId === 'bourse')).toBe(true);
    expect(lignes.join(' ')).toContain('Mendiant');
  });

  it('débit BORNÉ à 0 : la bourse tombe à zéro ET la ligne dit ce qui a RÉELLEMENT été perdu', () => {
    const h = heros(45);
    h.items = (h.items ?? []).filter((i) => i.trappingId !== 'bourse');
    applyOps(h, [{ op: 'money', montant: { brass: 10 } }], { rng: makeRNG(1) });
    const lignes = applyOps(h, [{ op: 'money', montant: { brass: -50 } }], { rng: makeRNG(1) });
    expect(bourseBrass(h)).toBe(0);
    // Le solde ne descend pas sous 0 : la ligne annonce les 10 sous réellement retirés, pas les 50 demandés.
    expect(lignes.join(' ')).toContain('10 sc');
    expect(lignes.join(' ')).not.toContain('50 sc');
  });

  it('le montant est une `Formula` : `{sl}` y entre par `ctx.sl`', () => {
    const h = heros(45);
    h.items = (h.items ?? []).filter((i) => i.trappingId !== 'bourse');
    setRule('mendier-heures-par-jour', 4);
    applyOps(h, [{ op: 'money', montant: { brass: GAIN } }], { rng: makeRNG(1), sl: 3 });
    expect(bourseBrass(h)).toBe(48);
    resetRule('mendier-heures-par-jour');
  });

  it('`src/engine/bourse.ts` reste PUR : aucun import de `src/state` (règle stricte 3)', () => {
    const src = readFileSync(join(ROOT, 'src/engine/bourse.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\.\/state\//);
  });
});

describe('Exemption de Statut (LDB 09 l.99) — DÉRIVÉE du registre des carrières, jamais listée', () => {
  /** Les carrières dont le Statut d'ENTRÉE (niveau 1) n'atteint pas Bronze 1 : « sans ressources ». */
  const sansRessources = careers
    .map((c) => c.id)
    .filter((id) => !statusMeets(statusOf(id, 1), 'Bronze 1'));

  it('le registre en porte au moins une, et Mendiant en est', () => {
    expect(sansRessources.length).toBeGreaterThan(0);
    expect(sansRessources).toContain('mendiant');
  });

  it('aucune étape de monde pour une Carrière sans ressources ; UNE pour les autres', () => {
    const def = activityById('mendier')!;
    for (const id of sansRessources) {
      const h = createHero({ speciesId: 'humains-reiklander', careerId: id, label: id, seed: 1, speciesTalentChoices: PERSPICACE });
      expect(buildActivityWorldRollSteps(def, h), `exempté : ${id}`).toEqual([]);
    }
    const soldat = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'S', seed: 1, speciesTalentChoices: PERSPICACE });
    expect(buildActivityWorldRollSteps(def, soldat)).toHaveLength(1);
  });

  it('l’exemption lit le Statut d’ENTRÉE de la carrière, pas l’avancement du porteur', () => {
    const def = activityById('mendier')!;
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'mendiant', label: 'M', seed: 1, speciesTalentChoices: PERSPICACE });
    h.careerLevel = 4; // le Mendiant monté en grade reste d'une Carrière sans ressources
    expect(buildActivityWorldRollSteps(def, h)).toEqual([]);
  });
});

describe('Modificateurs du Test (LDB 09 l.97 : discours + apparence)', () => {
  afterEach(() => { resetRule('mendier-discours'); resetRule('mendier-apparence-bonus'); });

  it('sans atteinte visible : seul le discours entre', () => {
    setRule('mendier-discours', -10);
    setRule('mendier-apparence-bonus', 10);
    const def = activityById('mendier')!;
    const h = heros(45);
    expect(activityTestMod(def, h).mod).toBe(-10);
  });

  /** Vers du Reik (MSRC 16 l.140) : la cloque au VISAGE est la lésion apparente du catalogue —
   *  `symptoms.json › vers-du-reik.visiblePassive` gaté par `visibleLocations`. */
  function avecLesionVisible(loc: 'tete' | 'corps'): Combatant {
    const h = heros(45);
    h.diseases = [{
      id: 'vers-du-reik', phase: 'active', minutesLeft: 4320, durationMinutes: 4320,
      blisterLocation: loc, symptoms: [{ symptomId: 'vers-du-reik' }],
    }];
    return h;
  }

  it('la lésion APPARENTE (tête) bascule le terme conditionnel ; la même lésion cachée (corps) non', () => {
    setRule('mendier-discours', -10);
    setRule('mendier-apparence-bonus', 10);
    const def = activityById('mendier')!;
    expect(aPassifVisible(avecLesionVisible('tete'))).toBe(true);
    expect(aPassifVisible(avecLesionVisible('corps'))).toBe(false);
    expect(activityTestMod(def, avecLesionVisible('tete')).mod).toBe(0); // −10 discours +10 apparence
    expect(activityTestMod(def, avecLesionVisible('corps')).mod).toBe(-10); // témoin : rien de visible
  });

  it('le LIBELLÉ de la ligne nomme les termes RETENUS (une seule ligne de mod à l’écran)', () => {
    setRule('mendier-discours', -10);
    setRule('mendier-apparence-bonus', 10);
    const def = activityById('mendier')!;
    expect(activityTestMod(def, avecLesionVisible('tete')).label).toBe('Discours + Apparence');
    expect(activityTestMod(def, avecLesionVisible('corps')).label).toBe('Discours');
  });
});

describe('Échec Stupéfiant (LDB 09 l.97 : « des ennuis ») — la bande RENVOIE à la table MAISON', () => {
  it('−6 et pire renvoient au tirage de `mendier-ennuis` ; un échec ORDINAIRE ne renvoie à rien', () => {
    const def = activityById('mendier')!;
    const bandes = matchOutcomes(def, { success: false, sl: -7 });
    expect(bandes).toHaveLength(1);
    expect(bandes[0].ops).toEqual([{ op: 'rollTable', tableId: 'mendier-ennuis' }]);
    expect(matchOutcomes(def, { success: false, sl: -2 })).toEqual([]);
    expect(matchOutcomes(def, { success: false, sl: -6 })).toHaveLength(1);
  });

  it('les trois volets NOMMÉS par le livre sont tirables, et seuls les deux premiers marquent le héros', () => {
    const table = findEffectTableById('mendier-ennuis');
    expect(table.die).toBe('d10');
    expect(table.rows.map((r) => `${r.min}-${r.max}`)).toEqual(['1-3', '4-7', '8-10']);
    setRule('mendier-amende-sous', 12);
    for (const r of table.rows) {
      const h = heros(45);
      applyOps(h, [{ op: 'money', montant: { brass: 100 } }], { rng: makeRNG(1) });
      const pvAvant = h.wounds.current;
      const bourseAvant = bourseBrass(h);
      applyOps(h, r.ops, { rng: makeRNG(7) });
      const marque =
        h.wounds.current !== pvAvant || (h.conditions ?? []).length > 0 || bourseBrass(h) !== bourseAvant;
      expect(marque, r.label).toBe(r.ops.length > 0);
    }
    resetRule('mendier-amende-sous');
  });

  /**
   * Le volet des gardes de `mendier-ennuis` (`LDB 09 l.97`) porte une AMENDE et RIEN d'autre — le
   * champ `maison` de la table dit d'où vient ce choix, les deux branches de l'arbitrage étant
   * exclusives. Fait MESURÉ qui rend l'amende seule applicable : la table n'est tirée que par la
   * bande « échec à −6 DR » (`activities.json › mendier.outcomes`), où aucune op `money` n'a rien
   * crédité — confisquer les sous du jour retirerait zéro.
   *
   * MUTATION : retirer l'op `money` de la rangée 1-3 de `tables.json` — les deux bourses restent à
   * leur solde d'entrée et les trois `expect` de montant tombent ; y remettre une op `condition`
   * fait tomber l'`expect` d'exclusivité.
   */
  it('le volet des GARDES prend une amende ÉDITABLE, bornée à zéro, et elle SEULE', () => {
    const gardes = findEffectTableById('mendier-ennuis').rows.find((r) => r.min === 1)!;
    setRule('mendier-amende-sous', 30);
    const bourseNue = (soc: number, sous: number): Combatant => {
      const h = heros(soc);
      h.items = (h.items ?? []).filter((i) => i.trappingId !== 'bourse');
      if (sous) applyOps(h, [{ op: 'money', montant: { brass: sous } }], { rng: makeRNG(1) });
      return h;
    };
    const riche = bourseNue(45, 100);
    applyOps(riche, gardes.ops, { rng: makeRNG(7) });
    expect(bourseBrass(riche), '100 − 30 d’amende').toBe(70);
    expect(gardes.ops.map((o) => o.op), 'la branche AMENDE exclut l’État de l’autre branche').toEqual(['money']);
    expect(riche.conditions ?? []).toEqual([]);

    const pauvre = bourseNue(45, 5);
    applyOps(pauvre, gardes.ops, { rng: makeRNG(7) });
    expect(bourseBrass(pauvre), 'on ne doit jamais d’argent').toBe(0);

    // La valeur vient de la RÈGLE, pas d'une constante : la changer change l'amende.
    setRule('mendier-amende-sous', 7);
    const autre = bourseNue(45, 100);
    applyOps(autre, gardes.ops, { rng: makeRNG(7) });
    expect(bourseBrass(autre)).toBe(93);
    resetRule('mendier-amende-sous');
  });
});

/**
 * LIEU — `LDB 09 l.97` : « La Compétence de Charme peut être utilisée pour mendier dans les rues. »
 * Les rues sont PARTOUT : l'Activité est proposable à tout lieu de la carte du monde, et hors carte.
 *
 * MUTATION : poser `"where": ["altdorf"]` sur l'entrée `mendier` d'`activities.json` — les deux `it`
 * de ce bloc tombent (hors carte refusé, et tout lieu livré autre qu'Altdorf perd l'Activité).
 */
describe('Lieu — Mendier se fait « dans les rues » (LDB 09 l.97), donc PARTOUT', () => {
  /** Les lieux de carte RÉELLEMENT livrés, DÉRIVÉS des projets de campagne — jamais une liste tenue
   *  à la main : une campagne neuve entre dans la mesure sans toucher ce test. */
  function lieuxLivres(): { projet: string; id: string }[] {
    const scenes = dossierDesProjetsLivres(ROOT);
    return listerProjetsLivres(ROOT)
      .flatMap((rel) => {
        const fichier = basename(rel);
        const projet = JSON.parse(readFileSync(join(scenes, rel), 'utf8')) as
          { worldMap?: { places?: { id: string }[] } };
        return (projet.worldMap?.places ?? []).map((p) => ({ projet: fichier, id: p.id }));
      });
  }

  it('l’entrée authorée ne porte aucun gate de lieu, et hors carte l’Activité reste proposable', () => {
    const def = activityById('mendier')!;
    expect(def.where, 'aucun id de lieu ne conditionne Mendier').toBeUndefined();
    expect(activityAvailableAt(def, null)).toBe(true);
  });

  it('proposable sur CHAQUE lieu des campagnes livrées (population DÉRIVÉE des projets)', () => {
    const def = activityById('mendier')!;
    const lieux = lieuxLivres();
    // NON-VACUITÉ, jamais un cardinal : un lieu ajouté ou retiré à une campagne entre dans la mesure
    // sans toucher ce test — seule une carte SANS aucun lieu le rendrait muet.
    expect(lieux.length, 'aucun lieu dérivé : la sonde ne mesurerait rien').toBeGreaterThan(0);
    expect(
      lieux.filter((l) => !activityAvailableAt(def, l.id)).map((l) => `${l.projet}/${l.id}`),
      'lieu(x) livré(s) où Mendier n’est pas proposable',
    ).toEqual([]);
  });
});

describe('Mendier de bout en bout (bandes de DR, LDB 09 l.97)', () => {
  const carte = (): WorldMap => ({
    id: 'w', label: 'Carte',
    places: [{
      id: 'halle', label: 'La Halle', pos: { x: 10, y: 10 }, scene: testScene.id,
      market: { taille: 2, richesse: 2, produits: [] } as never,
    }],
    routes: [],
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1, speciesTalentChoices: PERSPICACE });
    a.characteristics.sociabilite = 45; // Bonus de Sociabilité = 4
    useGame.setState({ party: [a], battle: null, interlude: null, bank: [], pendingActivity: null, journal: [], pendingCascade: null });
    useGame.getState().startScene(testScene);
    useGame.setState({ worldMap: carte() });
    vi.clearAllTimers();
    useGame.getState().seedRng(13);
    seedBattleRng(13);
    setRule('mendier-heures-par-jour', 4);
    setRule('mendier-surpris-pct', 0); // le dé de monde est testé à part : ici on isole les bandes
    useGame.getState().startInterlude(3);
    draineCascade(useGame.getState);
  });
  afterEach(() => {
    resetRule('mendier-heures-par-jour'); resetRule('mendier-surpris-pct');
    vi.clearAllTimers(); vi.useRealTimers();
  });

  const heroId = () => useGame.getState().party[0].id;
  const bourse = () => toBrass(bourseOf(useGame.getState().party[0]));

  function joue(sl: number, success: boolean, roll = 1): void {
    useGame.getState().interludeActivity(heroId(), 'mendier');
    expect(useGame.getState().pendingActivity?.activityId).toBe('mendier');
    useGame.getState().activityRoll();
    useGame.setState({ pendingActivity: { ...useGame.getState().pendingActivity!, roll, success, sl } });
    useGame.getState().activityConfirm();
    draineCascade(useGame.getState);
  }

  it('l’Activité est au CATALOGUE d’interlude du lieu courant', () => {
    expect(interludeCatalog(useGame.getState()).map((d) => d.id)).toContain('mendier');
    expect(useGame.getState().pendingActivity).toBeNull();
  });

  it('les `testMods` sont FONDUS dans la ligne de mod du pending (UNE ligne à l’écran)', () => {
    setRule('mendier-discours', -20);
    useGame.getState().interludeActivity(heroId(), 'mendier');
    const pa = useGame.getState().pendingActivity!;
    expect(pa.mod).toBe(-20);
    expect(pa.modLabel).toBe('Discours');
    resetRule('mendier-discours');
  });

  it('réussite SANS DR (DR 0) : « vous ne réussissez à glaner qu’un sou »', () => {
    const avant = bourse();
    joue(0, true);
    expect(bourse() - avant).toBe(1);
  });

  it('réussite à +3 DR : (Bonus de Sociabilité 4 × 3) × 4 heures = 48 sous', () => {
    const avant = bourse();
    joue(3, true);
    expect(bourse() - avant).toBe(48);
  });

  it('Échec Stupéfiant (−7 ≤ −6) : aucun GAIN — l’issue vient de la table des ennuis', () => {
    setRule('mendier-amende-sous', 0); // l’amende est ÉDITABLE : à zéro, seule l’absence de gain se mesure ici
    const avant = bourse();
    joue(-7, false);
    expect(bourse()).toBe(avant);
    resetRule('mendier-amende-sous');
  });

  it('échec ORDINAIRE (−2) : ni gain, ni table', () => {
    const avant = bourse();
    joue(-2, false);
    expect(bourse()).toBe(avant);
  });

  /**
   * L'ENJEU du gain — `LDB 23 l.166`. La clause d'« Argent à gaspiller » porte sur TOUTE pièce en
   * bourse à la clôture, sans exception pour la provenance : les sous mendiés y passent comme les
   * autres, et seul un dépôt bancaire y échappe. C'est ce que le `stake` de l'Activité annonce au
   * joueur AVANT qu'il n'engage son Activité.
   *
   * MUTATION : neutraliser la purge de bourse d'`interludeEnd` (`state/interludeFlow.ts`) — la bourse
   * garde ses 48 sous et le premier `expect` tombe ; retirer le dépôt du filet de survie fait tomber le
   * second.
   */
  it('le gain suit « Argent à gaspiller » : la bourse est vidée à la clôture, le dépôt bancaire SURVIT', () => {
    joue(3, true);
    expect(bourse(), '(BSoc 4 × 3 DR) × 4 heures').toBe(48);
    useGame.setState({ bank: [{ heroId: heroId(), kind: 'stash', brass: 60, rate: 5 }] });
    useGame.getState().interludeEnd();
    draineCascade(useGame.getState);
    expect(bourse(), 'LDB 23 l.166 : les pièces restantes sont perdues').toBe(0);
    expect(useGame.getState().bank).toEqual([{ heroId: useGame.getState().party[0].id, kind: 'stash', brass: 60, rate: 5 }]);
  });
});

/**
 * `ActorView.visiblePassive` est PARESSEUX (`engine/actorView.ts`) : `aPassifVisible` rebalaie tout
 * le collecteur `passiveMods`, et la vue se rebâtit à CHAQUE évaluation de `Condition` — alors qu'une
 * seule famille de Condition le lit (le terme d'apparence de Mendier, LDB 09 l.97).
 *
 * MUTATION : remettre `visiblePassive: aPassifVisible(c)` à plat dans l'objet de `buildActorView` —
 * le balayage a lieu À LA CONSTRUCTION, donc `apres1 === avant` et le premier `expect` tombe.
 */
describe('Vue d’acteur — `visiblePassive` ne balaie qu’à la LECTURE, et une seule fois', () => {
  /** Compte les lectures de `traumas`, que `passiveMods` traverse à chaque balayage. */
  function sonde(): { h: Combatant; lectures: () => number } {
    const h = heros(45);
    const traumas = h.traumas ?? [];
    let n = 0;
    Object.defineProperty(h, 'traumas', { get: () => { n++; return traumas; }, configurable: true });
    return { h, lectures: () => n };
  }

  it('la construction ne déclenche rien ; le premier accès balaie ; le second est mémoïsé', () => {
    const { h, lectures } = sonde();
    const vue = buildActorView(h)!;
    const avant = lectures();
    expect(vue.visiblePassive).toBe(false);
    const apres1 = lectures();
    expect(apres1, 'lire `visiblePassive` déclenche le balayage').toBeGreaterThan(avant);
    void vue.visiblePassive;
    expect(lectures(), 'mémoïsé : le 2ᵉ accès ne rebalaie pas').toBe(apres1);
  });

  it('la VALEUR est inchangée, lésion apparente comprise, et survit à une copie à plat', () => {
    const malade = heros(45);
    malade.diseases = [{
      id: 'vers-du-reik', phase: 'active', minutesLeft: 4320, durationMinutes: 4320,
      blisterLocation: 'tete', symptoms: [{ symptomId: 'vers-du-reik' }],
    }];
    expect(buildActorView(malade)!.visiblePassive).toBe(true);
    expect({ ...buildActorView(malade)! }.visiblePassive, '`enumerable` : la copie à plat garde le champ').toBe(true);
    expect(buildActorView(heros(45))!.visiblePassive).toBe(false);
  });
});

/**
 * Un modificateur de Test d'Activité est AFFICHÉ avant l'engagement (ligne de pré-jet du volet) : la
 * valeur montrée EST celle qui s'applique. Un terme tiré au jet (`{dice}`, `{rolled}`) rendrait
 * l'écran menteur — le parse le REFUSE, nominativement, sur la donnée réelle mutée.
 *
 * MUTATION : retirer la boucle `testMods` du `superRefine` de `schemas/defs/activities.ts` — la
 * donnée dopée passe et les deux `expect` de refus tombent.
 */
describe('`testMods.mod` est DÉTERMINISTE — garde de DONNÉE (#1612)', () => {
  const REELLES = JSON.parse(readFileSync(join(ROOT, 'src/data/activities.json'), 'utf8')) as Record<string, unknown>[];
  const CIBLE = REELLES.findIndex((a) => Array.isArray(a.testMods) && a.testMods.length > 0);
  const dope = (mod: unknown): Record<string, unknown>[] => {
    const m = JSON.parse(JSON.stringify(REELLES)) as Record<string, unknown>[];
    (m[CIBLE].testMods as Record<string, unknown>[])[0].mod = mod;
    return m;
  };

  it('la donnée RÉELLE passe, et la cible des mutations existe', () => {
    expect(CIBLE).toBeGreaterThanOrEqual(0);
    expect(activitiesSchema.safeParse(REELLES).success).toBe(true);
  });

  it('un `mod` à `{dice}` est REFUSÉ, et le message NOMME le terme et l’Activité', () => {
    const r = activitiesSchema.safeParse(dope({ dice: { n: 1, sides: 10 } }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const message = r.error.issues.map((i) => i.message).join('\n');
      expect(message).toContain('{dice}');
      expect(message).toContain(String(REELLES[CIBLE].id));
    }
  });

  it('un `mod` à `{rolled}` NICHÉ sous un `times` est REFUSÉ aussi — la garde descend la formule', () => {
    const r = activitiesSchema.safeParse(dope({ times: { of: { rolled: true }, factor: 2 } }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.message).join('\n')).toContain('{rolled}');
  });

  it('un `mod` à `{rule}` (la forme authorée) reste ACCEPTÉ', () => {
    expect(activitiesSchema.safeParse(dope({ rule: 'mendier-discours' })).success).toBe(true);
  });
});

describe('Dé de MONDE « surpris à mendier » (LDB 09 l.99) — par la PORTE, avec sa cible réglable', () => {
  afterEach(() => resetRule('mendier-surpris-pct'));

  it('la cible de l’étape EST la règle optionnelle (aucune constante au moteur)', () => {
    const def = activityById('mendier')!;
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'S', seed: 1, speciesTalentChoices: PERSPICACE });
    setRule('mendier-surpris-pct', 35);
    const [step] = buildActivityWorldRollSteps(def, h);
    expect(step.target).toBe(35);
    expect(step.evaluation).toBe('seuil'); // pas un Test : aucune Difficulté ne s'y applique
    expect(step.worldOwner).toBe(true);
  });
});

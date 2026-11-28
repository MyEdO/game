/**
 * Câblage RÉEL du pas de Surincantation « Durée » jusqu'à `rollTable.extraRollsPerStep` (EDOC 13
 * l.270-276), pour la feuille `on:'target'` NON-missile (site `runCastFlow` ~combatFlow.ts l.4048) —
 * la 3ᵉ des trois occurrences de `runCastFlow` dans `applyCast`. Passe par le VRAI flux de commit
 * (réglage `incantation.surincantationDuree` + `jetValider('incantation')`, comme la modale) — AUCUN `extras`/`ctx` forgé à la main : si
 * le site d'appel omet `overcastDurationSteps`, ce test doit ÉCHOUER.
 *
 * Le jet sur le Tableau est DÉCLINABLE (l.276 « vous POUVEZ ») — le réglage `incantation.jetsDeTable` borne le
 * nombre de jets sans jamais raccourcir la prolongation de durée (couplage ASYMÉTRIQUE).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ligneDeTexte } from '../engine/journal';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { CastResult } from '../engine/magic';
import { cliquerSurLeCombattant } from './combatOrParty';
import { projeter } from '../hote/projection';
import { resolvePlusExtension, tickDurations } from '../engine/conditions';
import { sortsDisponibles } from '../engine/sortsDuPnj';
import { withPreRollFixedDie } from './combatFlow';
import { battleRng } from './battleRng';
import { draineEtapes } from './cascade.testkit';
import { chargerLaSave, exporterLaSauvegarde, lireSave, snapshotSave } from './persistance/save';

let banc: Banc;
describe('Câblage — pas de Surincantation Durée → rollTable.extraRollsPerStep (feuille on:target, non-missile)', () => {
  beforeEach(() => { banc = ouvrirLeBanc(); });

  it('2 pas alloués (modale, réglage `incantation.surincantationDuree`) → 3 octrois sur le Tableau ET durée ×3, « à la fois » (EDOC 13 l.276)', () => {
    const W = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
    W.talents = [...(W.talents ?? []), { talentId: 'magie-du-chaos', spec: 'nurgle', times: 1 }];
    W.spells = ['allure-demoniaque'];
    W.characteristics.sociabilite = 40; // Bonus 4 → durée de base non nulle, la prolongation ×3 est mesurable
    banc.setState({ party: [W] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    banc.getState().ensemencerLeTirage(7);
    const b = banc.getState().battle!;
    const heroC = b.combatants.find((c) => c.label === 'W')!;
    const turn = b.order.indexOf(heroC.id);
    banc.setState({ battle: { ...b, turn, action: 'incantation', selectedSpellId: 'allure-demoniaque', acted: false } });
    cliquerSurLeCombattant(banc.getState, heroC.id); // cible = soi (spell.target.kind === 'self')
    expect(banc.getState().pendingCast).not.toBeNull();
    // Résultat de Test FIGÉ (préconditions du scénario, PAS le câblage sous test) : DR 12 → budget
    // de Surincantation = floor((12 − NI 8) / 2) = 2 pas, alloués ci-dessous via la VRAIE action de
    // modale `jetRegler('incantation', 'surincantationDuree', …)` (jamais `pendingCast.result`/`extras` composé pour l'occasion).
    banc.setState((s) => ({ pendingCast: { ...s.pendingCast!, result: { cast: true, roll: 20, target: 90, sl: 12, isCritical: false, isFumble: false, log: ligneDeTexte('ok') } as CastResult } }));
    banc.getState().jetRegler('incantation', 'surincantationDuree', 2);
    expect(banc.getState().pendingCast!.overcast).toEqual({ range: 0, zone: 0, duration: 2, targets: 0, damage: 0 });
    banc.getState().jetValider('incantation'); // « Appliquer » — VRAI applyCast → runCastFlow (site sous test)
    const heroAfter = banc.getState().battle?.combatants.find((c) => c.id === heroC.id) ?? banc.getState().party.find((h) => h.id === heroC.id)!;
    const octrois = (heroAfter.activeEffects ?? []).filter((e) => e.grantedTrait || e.grantedMutation);
    expect(octrois).toHaveLength(3); // 1 + 2 pas de Durée — PAS 1 (preuve du câblage)
    // « À la fois » (EDOC 13 l.276) : le MÊME pas prolonge aussi la durée (×(1+2)=×3), portée par
    // CHAQUE ActiveEffect posé par ce lancement.
    for (const e of octrois) expect(e.duration).toEqual({ scale: 'rounds', left: 12 }); // (Bonus Soc. 4) × 3
  });

  const setup = () => {
    const W = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
    W.talents = [...(W.talents ?? []), { talentId: 'magie-du-chaos', spec: 'nurgle', times: 1 }];
    W.spells = ['allure-demoniaque'];
    W.characteristics.sociabilite = 40;
    banc.setState({ party: [W] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    banc.getState().ensemencerLeTirage(7);
    const b = banc.getState().battle!;
    const heroC = b.combatants.find((c) => c.label === 'W')!;
    const turn = b.order.indexOf(heroC.id);
    banc.setState({ battle: { ...b, turn, action: 'incantation', selectedSpellId: 'allure-demoniaque', acted: false } });
    cliquerSurLeCombattant(banc.getState, heroC.id);
    banc.setState((s) => ({ pendingCast: { ...s.pendingCast!, result: { cast: true, roll: 20, target: 90, sl: 12, isCritical: false, isFumble: false, log: ligneDeTexte('ok') } as CastResult } }));
    banc.getState().jetRegler('incantation', 'surincantationDuree', 2);
    return heroC.id;
  };

  it('2 pas alloués, 1 jet CHOISI (réglage `incantation.jetsDeTable`) → 2 octrois ET durée toujours ×3 (déclinable, EDOC 13 l.276)', () => {
    const heroId = setup();
    banc.getState().jetRegler('incantation', 'jetsDeTable', 1);
    expect(banc.getState().pendingCast!.chosenTableRolls).toBe(1);
    banc.getState().jetValider('incantation');
    const heroAfter = banc.getState().battle?.combatants.find((c) => c.id === heroId) ?? banc.getState().party.find((h) => h.id === heroId)!;
    const octrois = (heroAfter.activeEffects ?? []).filter((e) => e.grantedTrait || e.grantedMutation);
    expect(octrois).toHaveLength(2); // 1 + 1 jet choisi — PAS 3
    for (const e of octrois) expect(e.duration).toEqual({ scale: 'rounds', left: 12 }); // durée ×3 malgré le jet décliné
  });

  it('2 pas alloués, 0 jet CHOISI → 1 octroi ET durée toujours ×3', () => {
    const heroId = setup();
    banc.getState().jetRegler('incantation', 'jetsDeTable', 0);
    expect(banc.getState().pendingCast!.chosenTableRolls).toBe(0);
    banc.getState().jetValider('incantation');
    const heroAfter = banc.getState().battle?.combatants.find((c) => c.id === heroId) ?? banc.getState().party.find((h) => h.id === heroId)!;
    const octrois = (heroAfter.activeEffects ?? []).filter((e) => e.grantedTrait || e.grantedMutation);
    expect(octrois).toHaveLength(1);
    for (const e of octrois) expect(e.duration).toEqual({ scale: 'rounds', left: 12 });
  });
});

describe('Allure démoniaque de Tzeentch — EDOC 13 l.245, l.276', () => {
  const SORT = 'allure-demoniaque';
  const SORT_DE_FEU = 'couronne-de-flammes';
  const SORT_DE_VIE = 'ecorce';
  const ORIGINE = { kind: 'sort', id: SORT };

  function lancerAllure(graineDeTable: number) {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
    h.talents = [{ talentId: 'magie-du-chaos', spec: 'tzeentch', times: 1 }];
    h.spells = [SORT];
    h.characteristics.intelligence = 90;
    h.characteristics.sociabilite = 40;
    h.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 5 }];
    const banc = ouvrirLeBanc({
      desFixes: true,
      reglesMaison: { 'magie-vdm-incantation': false },
      etat: { party: [h] },
    });
    const jeu = banc.getState;
    const porteur = () => jeu().party[0];
    const etape = () => {
      const sequence = jeu().pendingCascade;
      return sequence?.participants[sequence.cursor];
    };
    jeu().incanterLeSort(h.id, SORT_DE_FEU, h.id);
    expect(jeu().pendingCast, 'le Domaine ne précède pas le choix').toBeNull();
    jeu().incanterLeSort(h.id, SORT, h.id);
    withPreRollFixedDie(jeu, banc.setState,
      () => jeu().jetLancer('incantation'),
      () => jeu().jetImposerLeResultat('incantation', 7));
    expect(jeu().pendingCast?.result).toMatchObject({ roll: 7, cast: true });
    jeu().ensemencerLeTirage(graineDeTable);
    return { banc, jeu, porteur, etape };
  }

  it('fait choisir le Domaine avant tout octroi, puis ouvre ses sorts jusqu’à l’expiration', () => {
    const { banc, jeu, porteur, etape } = lancerAllure(4);
    jeu().jetValider('incantation');
    const choix = etape()!;
    const domaines = choix.options?.map(({ key }) => key);
    expect(choix).toMatchObject({ kind: 'choixDeTrait', actorId: porteur().id, meta: { opsDeCtx: { gele: { rolled: 10 } } } });
    expect(domaines).toEqual(expect.arrayContaining(['feu', 'vie', 'nurgle', 'slaanesh', 'tzeentch']));
    expect(domaines).not.toEqual(expect.arrayContaining(['gueule']));
    expect(domaines).not.toEqual(expect.arrayContaining(['indivisible']));
    expect(porteur().traits?.some((trait) => trait.id === 'lanceur-de-sorts')).toBeFalsy();
    expect(sortsDisponibles(porteur())).toEqual([SORT]);
    const projection = projeter(jeu(), 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 });
    expect(projection.fenetre?.etape).toEqual({ id: choix.id, genre: 'choixDeTrait', interaction: 'choix', choix: domaines });

    const json = exporterLaSauvegarde(snapshotSave(jeu(), '2026-11-21T00:00:00.000Z'));
    const lue = lireSave(json);
    if (typeof lue === 'string') throw new Error(lue);
    banc.setState(chargerLaSave(lue).etat);
    jeu().jetRegler('cascade', 'choix', 'Feu', choix.id);
    expect(etape()?.chosen).toBeUndefined();
    jeu().jetRegler('cascade', 'choix', 'feu', choix.id);
    expect(etape()?.chosen).toBe('feu');
    expect(porteur().traits?.some((trait) => trait.id === 'lanceur-de-sorts')).toBeFalsy();
    jeu().jetValider('cascade');
    draineEtapes(jeu);

    const effet = porteur().activeEffects?.find((e) => e.grantedTrait?.id === 'lanceur-de-sorts');
    if (!effet) throw new Error('Le Domaine choisi doit produire un effet qui accorde le Trait.');
    expect(effet).toMatchObject({ grantedTrait: { id: 'lanceur-de-sorts', arg: 'feu', src: ORIGINE }, duration: { scale: 'rounds', left: 4 } });
    expect(porteur().spells).toEqual([SORT]);
    expect(sortsDisponibles(porteur())).toContain(SORT_DE_FEU);
    expect(sortsDisponibles(porteur())).not.toContain(SORT_DE_VIE);
    expect(battleRng().int(1, 100), 'choisir le Domaine ne retire aucun dé').toBe(34);
    jeu().incanterLeSort(porteur().id, SORT_DE_FEU, porteur().id);
    expect(jeu().pendingCast?.spellId).toBe(SORT_DE_FEU);
    jeu().jetAnnuler('incantation');
    for (let round = 0; round < 4; round++) tickDurations(porteur());
    expect(effet.awaitingExtension).toBe(true);
    resolvePlusExtension(porteur(), effet, false);
    expect(sortsDisponibles(porteur())).toEqual([SORT]);
    jeu().incanterLeSort(porteur().id, SORT_DE_FEU, porteur().id);
    expect(jeu().pendingCast).toBeNull();
  });

  it('deux rangées 10 font deux choix distincts sans relancer le Tableau', () => {
    const { banc, jeu, porteur, etape } = lancerAllure(36);
    const pending = jeu().pendingCast!;
    banc.setState({ pendingCast: { ...pending, result: { ...pending.result!, sl: 10 } } });
    jeu().jetRegler('incantation', 'surincantationDuree', 1);
    jeu().jetValider('incantation');
    const premier = etape()!;
    jeu().jetRegler('cascade', 'choix', 'feu', premier.id);
    jeu().jetValider('cascade');
    const second = etape()!;
    expect(second.kind).toBe('choixDeTrait');
    expect(second.id).not.toBe(premier.id);
    expect(second.chosen).toBeUndefined();
    jeu().jetRegler('cascade', 'choix', 'mort', second.id);
    jeu().jetValider('cascade');
    const accordes = (porteur().activeEffects ?? []).filter((e) => e.grantedTrait?.id === 'lanceur-de-sorts');
    expect(accordes.map((e) => e.grantedTrait!.arg)).toEqual(['feu', 'mort']);
    expect(accordes.map((e) => e.duration)).toEqual([{ scale: 'rounds', left: 8 }, { scale: 'rounds', left: 8 }]);
    expect(battleRng().int(1, 100)).toBe(26);
  });
});

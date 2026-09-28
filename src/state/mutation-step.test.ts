import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyMutation, gainCorruption, mutationNatureTableId, mutationTableIdFor } from './corruptionFlow';
import { bonus, effectiveChar } from '../engine/characteristics';
import { stepInteraction, rollTableStep, tableStepDef } from './cascade';
import { seedBattleRng, battleRng } from './battleRng';
import { makeRNG, d100 } from '../engine/dice';
import {
  mutationKindFor, mutationNatureRows, attachMutation, mutationLimitExceeded, corruptionThresholdExceeded,
} from '../engine/corruption';
import {
  mutationTableIds, mutationAt, mutationSubTableFor, mutationTableRows, rollMutation,
} from '../data/mutations';
import { species } from '../data';
import { createHero } from '../engine/character';
import { setDesFixes, resetDesFixes, desFixes } from '../engine/fixedDie';
import { canFixDie } from './netOwnership';
import { draineCascade } from './cascadeTestKit';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

/**
 * MUTATION de Corruption en étapes à TABLE (#942 L5) — les TROIS tirages de la dissolution (LDB 19
 * l.73-83 : « effectuez un lancer de pourcentage et reportez-vous au tableau qui suit pour définir si
 * c'est votre corps ou votre esprit qui va renaître », puis le Tableau de Corruption, puis la
 * sous-table « Tête bestiale » EDOC 12) passent par le résolveur d'étape UNIQUE (`rollTableStep`) et
 * se CHAÎNENT par insertion. Le lookup mécanique reste au moteur (`mutationKindFor` / `mutationAt`).
 *
 * Les étapes sont POUSSÉES INCONDITIONNELLEMENT (#1426) : ni l'option « Dés fixés » ni le siège
 * n'entrent dans leur DÉCLARATION. Ce que le socle en fait est SA politique (`cascade.poserLeCurseur` :
 * fenêtre pour qui tient la victime, résolution d'office sinon), et l'option n'ajoute que la POSE du
 * dé. Le flux d'aléa, lui, ne bouge pas (sonde différentielle ci-dessous).
 */

const HUMAIN = 'humains-reiklander';

function heroSolo(speciesId = HUMAIN, seed = 4): Combatant {
  const h = createHero({ speciesId, careerId: 'soldat', label: 'H', seed });
  h.corruption = 6;
  useGame.setState({ battle: null, party: [h], pendingCascade: null, suspendedCascades: [] });
  return useGame.getState().party[0];
}

/** Le chemin d'AVANT (référence de la sonde) : d100 de nature, puis `rollMutation` (qui tire son d100
 *  et redescend seul dans la sous-table), puis l'attache. */
function cheminAvant(hero: Combatant, seed: number) {
  seedBattleRng(seed);
  const rng = battleRng();
  const kindRoll = d100(rng);
  const kind = mutationKindFor(hero.species, kindRoll);
  const m = rollMutation(mutationTableIdFor(kind), rng);
  const clone = structuredClone(hero);
  attachMutation(clone, m, rng);
  return { kindRoll, kind, m, suivant: d100(rng), clone };
}

describe('Mutation — les trois tirages en étapes à table (#942 L5)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes();
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [] });
  });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); resetRule('corruption-tables-edoc');
    // Hygiène de sortie : ce fichier laisse des séquences OUVERTES au milieu de leurs tirages (fenêtre
    // de pose). Le socle (`src/test-setup.ts`) remet le store à PRISTINE avant chaque test, mais on ne
    // lègue pas un slot occupé à un lecteur d'état qui tournerait entre deux tests.
    useGame.setState({ pendingCascade: null, suspendedCascades: [] });
  });

  it('SENTINELLE : le fichier démarre option « Dés fixés » ÉTEINTE (aucune fuite d’un autre fichier)', () => {
    expect(desFixes()).toBe(false);
  });

  it('registre : une entrée par table RÉELLE de mutationTables.json, lignes projetées de la DONNÉE (par référence)', () => {
    expect(mutationTableIds().length).toBeGreaterThan(0);
    for (const id of mutationTableIds()) {
      const def = tableStepDef(id)!;
      expect(def, `table « ${id} » non enregistrée`).toBeDefined();
      expect(def.rows).toBe(mutationTableRows(id)); // par RÉFÉRENCE : zéro duplication de fourchettes
      expect(def.die).toBe(100);
      // La ligne d'affichage est le libellé de la mutation atteinte par le dé (lookup moteur).
      const row = def.rows[0];
      expect(def.lines(row.min)[0]).toBe(mutationAt(id, row.min).label);
    }
  });

  it('registre : une table « corps ou esprit » par SEUIL d’espèce, et son dé concorde avec le lookup moteur', () => {
    // Toutes les espèces de la donnée (Elfe 0, Nain 5, Halfling/Ogre 10, Humain 50…) ont leur table.
    for (const sp of species) {
      const def = tableStepDef(mutationNatureTableId(sp.id))!;
      expect(def, `espèce « ${sp.id} » sans table de nature`).toBeDefined();
      expect(def.rows).toBe(mutationNatureRows(sp.id)); // les lignes du Tableau viennent du MOTEUR
    }
    // Elfe : « Esprit 01-100 » — une seule ligne, aucune ligne Corps (LDB 19 l.78-81).
    const elfe = tableStepDef(mutationNatureTableId('hauts-elfes'))!;
    expect(elfe.rows.map((r) => r.id)).toEqual(['mentale']);
    // Sur TOUT le dé et pour chaque seuil distinct, l'id de ligne EST la nature du moteur.
    for (const sp of ['hauts-elfes', 'nains', 'halflings', HUMAIN]) {
      const decl = { tableId: mutationNatureTableId(sp), spec: { n: 1, sides: 100 } };
      for (let die = 1; die <= 100; die++) {
        expect(rollTableStep({ ...decl, forcedRoll: die }, makeRNG(1)).id, `${sp} @${die}`).toBe(mutationKindFor(sp, die));
      }
    }
  });

  it('`rollMutation` : le dé INJECTÉ résout la table de PREMIER niveau et s’ARRÊTE avant la sous-table', () => {
    // « Tête bestiale » (EDOC 12) : la ligne PORTE une sous-table alignée.
    const ligne = mutationTableRows('edoc-phys-khorne').find((r) => r.id === 'tete-bestiale')!;
    const premier = makeRNG(9).int(1, 100); // le flux reste INTACT : aucun dé consommé par un dé posé
    const rng = makeRNG(9);
    const m = rollMutation('edoc-phys-khorne', rng, ligne.min);
    expect(m.id).toBe('tete-bestiale'); // ARRÊT : la sous-table n'a PAS été ré-tirée d'office
    expect(m.roll).toBe(ligne.min);
    expect(d100(rng), 'un dé a été consommé malgré le dé posé').toBe(premier);
    // Le SECOND tirage est injectable à son tour → la descente est pilotable niveau par niveau.
    const sub = mutationSubTableFor('edoc-phys-khorne', m)!;
    expect(sub).toBe('edoc-tete-bestiale-khorne');
    const feuille = rollMutation(sub, makeRNG(3), 1);
    expect(feuille.id).toBe(mutationAt(sub, 1).id);
    expect(mutationSubTableFor(sub, feuille)).toBeNull();
    // Sans dé posé, la descente automatique reste celle d'avant (sous-table ré-tirée dans la foulée).
    expect(rollMutation('edoc-phys-khorne', scripted([ligne.min, 1])).id).toBe(mutationAt(sub, 1).id);
  });

  it('SONDE DIFFÉRENTIELLE (option ÉTEINTE) : même mutation, mêmes effets ET même flux RNG qu’avant', () => {
    for (const sp of [HUMAIN, 'nains', 'hauts-elfes']) {
      for (let seed = 1; seed <= 12; seed++) {
        const hero = heroSolo(sp, seed);
        const ref = cheminAvant(hero, seed);
        seedBattleRng(seed);
        applyMutation(useGame.getState, useGame.setState, hero);
        draineCascade(useGame.getState); // les trois dés tombent au RANG de leur étape, dans le même ordre
        const apres = d100(battleRng()); // dé SUIVANT → mesure la consommation exacte du flux
        expect(hero.mutations?.length, `${sp}/${seed}`).toBe(1);
        expect(hero.mutations![0].id, `${sp}/${seed} : mutation différente`).toBe(ref.m.id);
        expect(hero.mutations![0].roll, `${sp}/${seed} : dé de table différent`).toBe(ref.m.roll);
        expect(apres, `${sp}/${seed} : le flux RNG a été décalé`).toBe(ref.suivant);
        expect(hero.traits?.length ?? 0).toBe(ref.clone.traits?.length ?? 0);
      }
    }
  });

  it('option ÉTEINTE : les étapes sont LÀ quand même — aucun dé posable, et la mutation tombe en les jouant', () => {
    const hero = heroSolo();
    seedBattleRng(5);
    const lines = applyMutation(useGame.getState, useGame.setState, hero);
    expect(lines, 'rien ne se dit avant que le dernier dé ne tombe').toEqual([]);
    const nature = useGame.getState().pendingCascade!.participants[0];
    expect(nature.kind).toBe('mutationNature');
    expect(stepInteraction(nature)).toBe('table');
    expect(canFixDie(useGame.getState(), hero.id), 'option ÉTEINTE : la pose n’est pas offerte').toBe(false);
    expect(hero.mutations ?? []).toHaveLength(0);
    // La séquence jouée dénoue : nature → table → mutation attachée + révélation (#942 L8 : la
    // révélation n'est pas une file parallèle, c'est une étape d'AFFICHAGE de la même séquence).
    const kinds = draineCascade(useGame.getState);
    expect(kinds.slice(0, 2)).toEqual(['mutationNature', 'mutationTable']);
    expect(useGame.getState().party[0].mutations?.length).toBe(1);
    expect(kinds).toContain('mutation');
  });

  it('option ACTIVE + victime contrôlée : étape de NATURE non résolue, AUCUNE mutation attachée', () => {
    const hero = heroSolo();
    setDesFixes(true);
    const lines = applyMutation(useGame.getState, useGame.setState, hero);
    expect(lines).toEqual([]);
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.kind).toBe('mutationNature');
    expect(stepInteraction(step)).toBe('table'); // dé À POSER → les deux affordances de la modale
    expect(step.table).toMatchObject({ tableId: mutationNatureTableId(hero.species), spec: { n: 1, sides: 100 } });
    expect(step.table!.result).toBeUndefined();
    expect(hero.mutations ?? []).toHaveLength(0);
  });

  it('LDB 19 l.76 « D’ABORD, vous perdez… ENSUITE, effectuez un lancer » : les Points sont débités À L’ENTRÉE, fenêtre comprise', () => {
    const hero = heroSolo();
    const bfm = bonus(effectiveChar(hero, 'force-mentale'));
    expect(bfm, 'fixture sans perte mesurable').toBeGreaterThan(0);
    setDesFixes(true);
    const avant = hero.corruption!;
    applyMutation(useGame.getState, useGame.setState, hero);
    expect(hero.corruption, 'les Points ne sont pas débités avant les tirages').toBe(Math.max(0, avant - bfm));
    // CONSÉQUENCE mesurée du débit : pendant la fenêtre de pose, le seuil est relu sur la Corruption
    // DÉJÀ amputée → un nouveau gain n'ouvre PAS un second Test de seuil (donc pas de 2ᵉ mutation).
    expect(corruptionThresholdExceeded(hero)).toBe(false);
    gainCorruption(useGame.getState, useGame.setState, hero, 1);
    expect(useGame.getState().pendingCorruption, 'un 2ᵉ Test de seuil s’est rouvert pendant la fenêtre').toBeNull();
  });

  it('POSER les dés : nature → table → la mutation posée est celle appliquée', () => {
    const hero = heroSolo();
    setDesFixes(true);
    applyMutation(useGame.getState, useGame.setState, hero);
    // Dé de NATURE posé sur « Corps » (Humain : 01-50) → la table PHYSIQUE est insérée.
    const nature = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeTableSetForcedRoll(nature.id, 12);
    expect(useGame.getState().pendingCascade!.participants[0].fixed).toBe(true);
    useGame.getState().cascadeNext();
    const table = useGame.getState().pendingCascade!.participants[1];
    expect(table.kind).toBe('mutationTable');
    expect(table.table!.tableId).toBe('physique');
    expect(table.table!.result).toBeUndefined();
    expect(hero.mutations ?? []).toHaveLength(0); // toujours rien appliqué
    // LIGNE choisie dans la donnée, posée par son dé.
    const ligne = mutationTableRows('physique')[3];
    useGame.getState().cascadeTableSetForcedRoll(table.id, ligne.min);
    useGame.getState().cascadeNext();
    const victime = useGame.getState().party[0];
    expect(victime.mutations!.map((m) => m.id), 'la ligne posée n’est pas celle appliquée').toEqual([ligne.id]);
    expect(victime.mutations![0].roll).toBe(ligne.min);
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'mutation' && !!s.reveal)).toBe(true);
  });

  it('l’applier CONSOMME la ligne tirée (`result.id`) : un `mod` sur l’étape ne désynchronise pas affiché/appliqué', () => {
    const hero = heroSolo(); // Humain : Corps 01-50, Esprit 51-100
    setDesFixes(true);
    applyMutation(useGame.getState, useGame.setState, hero);
    // Un modificateur PORTÉ par la déclaration (ce que toute table d'étape peut déclarer, cf. la
    // réduction d'overkill des Critiques) : le lookup se fait sur le dé EFFECTIF. Un applier qui
    // referait SON lookup sur le dé NATUREL appliquerait une autre ligne que celle montrée.
    const p = useGame.getState().pendingCascade!;
    useGame.setState({
      pendingCascade: { ...p, participants: p.participants.map((s, i) => (i === 0 ? { ...s, table: { ...s.table!, mod: 30 } } : s)) },
    });
    const nature = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeTableSetForcedRoll(nature.id, 30); // naturel 30 (Corps) → effectif 60 (Esprit)
    const posee = useGame.getState().pendingCascade!.participants[0];
    expect(posee.table!.result).toMatchObject({ roll: 30, die: 60, id: 'mentale' });
    useGame.getState().cascadeNext();
    const table = useGame.getState().pendingCascade!.participants[1];
    expect(table.table!.tableId, 'la table insérée n’est pas celle de la ligne AFFICHÉE').toBe('mentale');
    expect(table.mutation!.kind).toBe('mentale');
  });

  it('POSER les dés, ligne à SOUS-TABLE : une TROISIÈME étape est insérée et pilotée', () => {
    setRule('corruption-tables-edoc', 'edoc');
    const hero = heroSolo();
    setDesFixes(true);
    applyMutation(useGame.getState, useGame.setState, hero, undefined, 'khorne');
    const nature = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeTableSetForcedRoll(nature.id, 12); // Corps
    useGame.getState().cascadeNext();
    const table = useGame.getState().pendingCascade!.participants[1];
    expect(table.table!.tableId).toBe('edoc-phys-khorne');
    const bestiale = mutationTableRows('edoc-phys-khorne').find((r) => r.id === 'tete-bestiale')!;
    useGame.getState().cascadeTableSetForcedRoll(table.id, bestiale.min);
    useGame.getState().cascadeNext();
    // Sous-table INSÉRÉE (pas appliquée d'office) : le 3e dé reste à poser.
    const sous = useGame.getState().pendingCascade!.participants[2];
    expect(sous.kind).toBe('mutationTable');
    expect(sous.table!.tableId).toBe('edoc-tete-bestiale-khorne');
    expect(sous.table!.result).toBeUndefined();
    expect(useGame.getState().party[0].mutations ?? []).toHaveLength(0);
    const animal = mutationTableRows('edoc-tete-bestiale-khorne')[2];
    useGame.getState().cascadeTableSetForcedRoll(sous.id, animal.min);
    useGame.getState().cascadeNext();
    const victime = useGame.getState().party[0];
    expect(victime.mutations!.map((m) => m.id)).toEqual([animal.id]);
    expect(victime.corruption, 'les Points de Corruption ne sont pas perdus (l.76)').toBeLessThan(6);
  });

  it('LIMITES de Corruption (l.87) : la damnation tombe aussi par le chemin des dés posés', () => {
    const hero = heroSolo();
    hero.characteristics.endurance = 1; // BE 0 → une seule mutation physique suffit
    hero.characteristics['force-mentale'] = 1;
    setDesFixes(true);
    applyMutation(useGame.getState, useGame.setState, hero);
    const nature = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeTableSetForcedRoll(nature.id, 12);
    useGame.getState().cascadeNext();
    const table = useGame.getState().pendingCascade!.participants[1];
    useGame.getState().cascadeTableSetForcedRoll(table.id, mutationTableRows('physique')[0].min);
    useGame.getState().cascadeNext();
    const victime = useGame.getState().party[0];
    expect(mutationLimitExceeded(victime)).toBe(true);
    expect(victime.damned).toBe(true);
  });

  it('victime NON contrôlée par le siège local (ennemi sans siège MJ) : l’étape est POUSSÉE et le socle la résout D’OFFICE', () => {
    const hero = heroSolo();
    setDesFixes(true);
    const npc = { ...structuredClone(hero), id: 'npc-1', kind: 'enemy' } as Combatant;
    npc.mutations = [];
    // Le PNJ est ATTEIGNABLE par `actorIn` (sinon la fenêtre se fermerait pour une simple cible
    // introuvable, pas pour la bonne raison) : sans siège MJ pris, il n'est contrôlé par personne.
    useGame.setState({ party: [hero, npc] });
    seedBattleRng(2);
    applyMutation(useGame.getState, useGame.setState, npc);
    // Le porteur n'est tenu par AUCUN siège : le socle a déjà tiré l'étape sous le curseur, elle naît
    // résolue (`cascade.poserLeCurseur`). Aucune branche de flux n'a décidé ça : c'est la politique.
    const nature = useGame.getState().pendingCascade!.participants[0];
    expect(nature.kind).toBe('mutationNature');
    expect(nature.table!.result, 'une table sans siège est restée non tirée').toBeTruthy();
    draineCascade(useGame.getState);
    expect(useGame.getState().party[1].mutations?.length).toBe(1);
  });
});

/** RNG scripté (dés imposés dans l'ordre) — même utilitaire que `data/mutationTables.test.ts`. */
function scripted(values: number[]) {
  let i = 0;
  return { int: () => values[i++] ?? 1 };
}

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyMiscast } from './combatFlow';
import { seedBattleRng, battleRng } from './battleRng';
import { makeRNG, d100 } from '../engine/dice';
import { createHero } from '../engine/character';
import { stepInteraction, tableStepDef } from './cascade';
import { avanceEtapeCascade, draineCascade } from './cascadeTestKit';
import { canFixDie } from './netOwnership';
import {
  rollMiscast, miscastTableId, miscastRowAt, MISCAST_TABLE_ROWS, MISCAST_TABLE_LABELS, type MiscastSeverity,
} from '../engine/miscast';
import { hasBookMarker } from '../data/bookMarker';
import { hasCondition } from '../engine/conditions';
import { bonus, effectiveChar } from '../engine/characteristics';
import { corruptionThresholdExceeded } from '../engine/corruption';
import { setDesFixes, resetDesFixes, desFixes } from '../engine/fixedDie';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

/**
 * INCANTATION IMPARFAITE / COLÈRE DES DIEUX en étape à TABLE (#942 L6) — le d100 des Tableaux
 * (LDB 46 l.34-80, LDB 40 l.52-89) passe par le résolveur d'étape UNIQUE (`rollTableStep`), et les
 * RELANCES prescrites par une ligne sont des étapes INSÉRÉES, pilotables niveau par niveau :
 *  - « 96-00 Chaos en cascade : effectuez un nouveau lancer sur le Tableau des Incantations
 *    Imparfaites Majeures » (LDB 46 l.55) ;
 *  - « 91-95 Multiplication d'infortune : effectuez deux lancers sur cette table, en relançant tous
 *    les résultats entre 91-00 » (l.54).
 * Le +10 par Point de Péché de la Colère (« ajoutez-y +10 pour chaque Point de Péché que vous avez
 * déjà accumulé », LDB 40 l.46) est DÉCLARÉ en `mod` sur l'étape — le lookup se fait sur le dé
 * EFFECTIF.
 *
 * L'étape est POUSSÉE INCONDITIONNELLEMENT (#1426) : ni l'option « Dés fixés » ni le siège n'entrent
 * dans sa DÉCLARATION. Ce que le socle en fait est SA politique (`cascade.poserLeCurseur` : fenêtre
 * pour qui tient le lanceur, résolution d'office sinon), et l'option n'ajoute que la POSE du dé. Les
 * dés tirés restent ceux du moteur, dans le même ordre (sonde différentielle ci-dessous).
 */

/** JOUE les étapes de la séquence en cours en retenant, POUR CHAQUE tirage d'Imparfaite, son dé
 *  EFFECTIF et la ligne atteinte — le kit de drainage ferme la cascade, ces faits seraient perdus. */
function joueEnRetenant(max = 30): { des: number[]; lignes: string[] } {
  const des: number[] = [];
  const lignes: string[] = [];
  const vus = new Set<string>(); // une étape ne se compte qu'UNE fois, même si le curseur y revient
  for (let i = 0; i < max && useGame.getState().pendingCascade; i++) {
    const p = useGame.getState().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (!cur) break;
    if (cur.kind === 'miscastTable' && !cur.table?.result) useGame.getState().cascadeTableRoll(cur.id);
    const jouee = useGame.getState().pendingCascade?.participants[p.cursor];
    if (jouee?.kind === 'miscastTable' && jouee.table?.result && !vus.has(jouee.id)) {
      vus.add(jouee.id);
      des.push(jouee.table.result.die);
      lignes.push(jouee.table.result.id);
    }
    avanceEtapeCascade(useGame.getState);
  }
  return { des, lignes };
}

function mageSolo(seed = 3): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', rng: makeRNG(seed) });
  h.wounds.max = 200;
  h.wounds.current = 200;
  useGame.setState({ battle: null, party: [h], pendingCascade: null, suspendedCascades: [], pendingLogQueue: [] });
  return useGame.getState().party[0];
}

const steps = (): CascadeStep[] => (useGame.getState().pendingCascade?.participants ?? []) as CascadeStep[];
const stepAt = (i: number) => steps()[i];
const poser = (id: string, roll: number) => useGame.getState().cascadeTableSetForcedRoll(id, roll);
const suivant = () => useGame.getState().cascadeNext();

/** RNG scripté (dés imposés dans l'ordre) — même utilitaire que `state/mutation-step.test.ts`. */
function scripted(values: number[]) {
  let i = 0;
  return { int: () => values[i++] ?? 1 };
}

describe('Imparfaite/Colère — le tirage en étape à table (#942 L6)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes();
    useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); resetRule('magic-vdm-incantation');
    // Hygiène de sortie : ce fichier laisse des séquences OUVERTES au milieu de leurs tirages.
    useGame.setState({ pendingCascade: null, suspendedCascades: [] });
  });

  it('SENTINELLE : le fichier démarre option « Dés fixés » ÉTEINTE (aucune fuite d’un autre fichier)', () => {
    expect(desFixes()).toBe(false);
  });

  it('registre : une entrée par table RÉELLE de miscast.json, lignes projetées de la DONNÉE (par référence)', () => {
    for (const [id, rows] of Object.entries(MISCAST_TABLE_ROWS)) {
      const def = tableStepDef(id)!;
      expect(def, `table « ${id} » non enregistrée`).toBeDefined();
      expect(def.rows).toBe(rows); // par RÉFÉRENCE : zéro duplication de fourchettes
      expect(def.die).toBe(100);
      expect(def.label).toBe(MISCAST_TABLE_LABELS[id]);
      // Surface JOUEUR : aucun libellé ne porte de référence de livre (`docs/charte-ui.md`).
      expect(hasBookMarker(def.label), `provenance dans « ${def.label} »`).toBe(false);
      const row = rows[0];
      expect(def.lines(row.min)[0]).toBe(miscastRowAt(id, row.min).label);
    }
  });

  it('la table déclarée SUIT le jeu de tables en vigueur (LDB, ou VDM sous la règle optionnelle)', () => {
    expect(miscastTableId('mineure')).toBe('miscast-mineure');
    expect(miscastTableId('colere')).toBe('miscast-colere');
    setRule('magic-vdm-incantation', true);
    expect(miscastTableId('mineure')).toBe('miscast-mineure-vdm');
    expect(miscastTableId('majeure')).toBe('miscast-majeure-vdm');
    expect(miscastTableId('colere'), 'la Colère des dieux n’est pas révisée par VDM').toBe('miscast-colere');
  });

  it('`rollMiscast` : le dé INJECTÉ résout la ligne et s’ARRÊTE avant la relance (aucun dé consommé)', () => {
    const premier = makeRNG(9).int(1, 100); // le flux reste INTACT : un dé posé n'en consomme aucun
    const rng = makeRNG(9);
    const casc = rollMiscast('mineure', rng, 0, undefined, 96);
    expect(casc.reroll, 'la relance a été jouée d’office au lieu d’être rendue').toBe('majeure');
    expect(casc.label).toBe('Chaos en cascade');
    expect(casc.ops, 'une ligne à relance n’applique RIEN').toEqual([]);
    expect(casc.rolls).toEqual([96]);
    expect(d100(rng), 'un dé a été consommé malgré le dé posé').toBe(premier);
    // 91-95 : la MULTIPLICATION est rendue de la même façon (deux lancers à piloter).
    expect(rollMiscast('mineure', makeRNG(1), 0, undefined, 91).reroll).toBe('mineure-x2');
    // Ligne TERMINALE : le dé posé donne son contrecoup, sans relance.
    const feu = rollMiscast('majeure', makeRNG(1), 0, undefined, 26);
    expect(feu.label).toBe('Feu de l’âme'.replace('’', "'"));
    expect(feu.reroll).toBeUndefined();
    expect(feu.ops.length).toBeGreaterThan(0);
    // SANS dé posé, la descente automatique reste celle d'avant (relance jouée dans la foulée).
    const auto = rollMiscast('mineure', scripted([96, 26]));
    expect(auto.reroll, 'un tirage NATUREL ne rend pas de relance à piloter').toBeUndefined();
    expect(auto.label).toBe(`Chaos en cascade → ${feu.label}`);
  });

  it('SONDE DIFFÉRENTIELLE (option ÉTEINTE) : le dé de TÊTE et sa ligne sont ceux du moteur — le tirage n’est pas décalé', () => {
    // Ce qui se compare AU MOTEUR est le dé d'ENTRÉE : les relances, elles, sont des étapes, et une
    // étape résolue APPLIQUE avant que la suivante ne tire (la descente auto de `rollMiscast` tire
    // tout d'abord). Le nombre de jets, lui, reste celui que la ligne prescrit — chaque relance a SON
    // étape, aucune n'est jouée d'office (vérifié ligne à ligne ci-dessous).
    for (const sev of ['mineure', 'majeure', 'colere'] as MiscastSeverity[]) {
      for (let seed = 1; seed <= 12; seed++) {
        const hero = mageSolo(seed);
        seedBattleRng(seed);
        const ref = rollMiscast(sev, battleRng()); // le moteur, qui descend seul ses relances
        seedBattleRng(seed);
        applyMiscast(useGame.getState, useGame.setState, hero, sev);
        const { des, lignes } = joueEnRetenant();
        expect(des[0], `${sev}/${seed} : le dé de tête du flux a été décalé`).toBe(ref.rolls[0]);
        expect(lignes[0], `${sev}/${seed} : la ligne du dé de tête n’est pas celle du moteur`)
          .toBe(miscastRowAt(miscastTableId(sev), des[0]).id);
        // Une ligne de tête qui PRESCRIT une relance a bien reçu une étape de plus — et une ligne
        // terminale n'en a pas reçu : les relances se pilotent, elles ne se jouent pas d'office.
        const prescrit = !!rollMiscast(sev, makeRNG(1), 0, undefined, des[0]).reroll;
        expect(lignes.length > 1, `${sev}/${seed} : la relance de la ligne de tête`).toBe(prescrit);
      }
    }
  });

  it('option ÉTEINTE : l’étape est LÀ quand même — aucun dé posable, et le contrecoup tombe en la jouant', () => {
    const hero = mageSolo();
    seedBattleRng(5);
    const lines = applyMiscast(useGame.getState, useGame.setState, hero, 'majeure');
    expect(lines, 'la ligne du Tableau se dit à son étape, pas à l’appel').not.toContain(undefined);
    const st = stepAt(0);
    expect(st.kind).toBe('miscastTable');
    expect(stepInteraction(st)).toBe('table');
    expect(st.table!.result, 'un siège tient le lanceur : le socle ne tire pas à sa place').toBeUndefined();
    expect(canFixDie(useGame.getState(), hero.id), 'option ÉTEINTE : la pose n’est pas offerte').toBe(false);
    draineCascade(useGame.getState);
    expect(useGame.getState().party[0].conditions?.length ?? 0, 'aucun effet du contrecoup appliqué').toBeGreaterThan(0);
  });

  it('option ACTIVE + siège qui contrôle le LANCEUR : étape à TABLE non résolue, AUCUN effet appliqué', () => {
    const hero = mageSolo();
    setDesFixes(true);
    const lines = applyMiscast(useGame.getState, useGame.setState, hero, 'majeure');
    expect(lines).toEqual([]);
    const st = stepAt(0);
    expect(st.kind).toBe('miscastTable');
    expect(stepInteraction(st)).toBe('table'); // dé À POSER → les deux affordances de la modale
    expect(st.table).toMatchObject({ tableId: 'miscast-majeure', spec: { n: 1, sides: 100 } });
    expect(st.table!.mod, 'aucun modificateur hors Colère').toBeUndefined();
    expect(st.table!.result).toBeUndefined();
    expect(hero.conditions).toEqual([]);
    expect(steps().some((s) => s.kind === 'miscast'), 'une révélation avant le dé').toBe(false);
  });

  it('96-00 « Chaos en cascade » : l’étape MAJEURE est INSÉRÉE, et rien n’est appliqué avant son dé', () => {
    const hero = mageSolo();
    setDesFixes(true);
    applyMiscast(useGame.getState, useGame.setState, hero, 'mineure');
    poser(stepAt(0).id, 96);
    expect(stepAt(0).table!.result).toMatchObject({ roll: 96, die: 96, id: 'mineure-chaos-en-cascade' });
    expect(stepAt(0).fixed).toBe(true);
    suivant();
    const majeure = stepAt(1);
    expect(majeure.kind).toBe('miscastTable');
    expect(majeure.miscast!.severity).toBe('majeure');
    expect(majeure.table!.tableId).toBe('miscast-majeure');
    expect(majeure.table!.result, 'la relance a été tirée d’office au lieu d’être posée').toBeUndefined();
    expect(hero.conditions, 'un effet appliqué avant le dernier dé').toEqual([]);
    // Dé de la MAJEURE posé sur « Feu de l'âme » (26-30) : c'est CETTE ligne qui s'applique.
    poser(majeure.id, 26);
    suivant();
    expect(hasCondition(hero, 'en-flammes'), 'la ligne posée n’est pas celle appliquée').toBe(true);
    expect(steps().some((s) => s.kind === 'miscast')).toBe(true);
  });

  it('91-95 « Multiplication d’infortune » : DEUX étapes insérées, et un 91-00 d’une fille se RELANCE', () => {
    const hero = mageSolo();
    setDesFixes(true);
    applyMiscast(useGame.getState, useGame.setState, hero, 'mineure');
    poser(stepAt(0).id, 91);
    suivant();
    const filles = steps().slice(1, 3);
    expect(filles.map((s) => s.kind)).toEqual(['miscastTable', 'miscastTable']);
    expect(filles.every((s) => s.miscast!.severity === 'mineure' && s.miscast!.rerollHigh)).toBe(true);
    expect(new Set(filles.map((s) => s.id)).size, 'deux étapes au même id').toBe(2);
    // « en relançant tous les résultats entre 91-00 » : la fille qui retombe haut insère UNE relance.
    poser(filles[0].id, 96);
    suivant();
    const relance = steps()[2];
    expect(relance.miscast!.rerollHigh, 'un 96 d’une relance bornée a basculé sur la Majeure').toBe(true);
    expect(relance.table!.tableId).toBe('miscast-mineure');
    expect(relance.table!.result).toBeUndefined();
    // Dé terminal : le contrecoup de CETTE ligne s'applique (36-40 « Secousse spirituelle » → À Terre).
    poser(relance.id, 36);
    suivant();
    expect(hasCondition(hero, 'a-terre')).toBe(true);
  });

  it('COLÈRE : le +10 par Point de Péché résout la ligne au TIRAGE, puis le Péché expire', () => {
    const hero = mageSolo();
    hero.sinPoints = 1;
    setDesFixes(true);
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    const st = stepAt(0);
    // Le modificateur est DÉCLARÉ vivant (compteur de l'acteur), pas figé à l'ouverture.
    expect(st.table).toMatchObject({ tableId: 'miscast-colere', spec: { n: 1, sides: 100 }, modPerActor: { counter: 'sinPoints', factor: 10 } });
    expect(hero.sinPoints, 'le Péché expire AVANT le lancer').toBe(1);
    // 95 naturel + 10 = 105 → « Châtiment » (101-105), une ligne INATTEIGNABLE sans Point de Péché.
    poser(st.id, 95);
    expect(stepAt(0).table!.result).toMatchObject({ roll: 95, die: 105, id: 'colere-chatiment' });
    expect(stepAt(0).table!.mod, 'le mod RÉELLEMENT appliqué reste lisible sur l’étape').toBe(10);
    expect(miscastRowAt('miscast-colere', 95).id, 'sans le mod, 95 tombe ailleurs').toBe('colere-redoutez-ma-colere');
    suivant();
    // « Après le lancer et avoir appliqué le résultat, réduisez vos Points de Péché de 1 » (LDB 40 l.46).
    expect(hero.sinPoints).toBe(0);
    expect(hero.wounds.current, '« Châtiment » : total de Blessures réduit à 0').toBe(0);
  });

  it('SONDE B — un Péché GAGNÉ pendant la fenêtre de pose n’est pas écrasé : l’expiation DÉCRÉMENTE le vivant', () => {
    const hero = mageSolo();
    hero.sinPoints = 3;
    setDesFixes(true);
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    const st = stepAt(0);
    poser(st.id, 1); // naturel 1 + 3×10 = 31
    expect(stepAt(0).table!.result).toMatchObject({ roll: 1, die: 31 });
    suivant();
    expect(hero.sinPoints, 'une expiation ré-écrite depuis l’instantané ramènerait 3 à 2').toBe(2);
    // Le même gain PENDANT la fenêtre : le total vivant est 4 au dénouement → 3, jamais 2.
    const autre = mageSolo();
    autre.sinPoints = 3;
    applyMiscast(useGame.getState, useGame.setState, autre, 'colere');
    autre.sinPoints = 4; // Péché gagné entre l'ouverture de l'étape et le dé
    poser(stepAt(0).id, 1);
    expect(stepAt(0).table!.result!.die, 'le mod a été figé à l’ouverture (30 au lieu de 40)').toBe(41);
    suivant();
    expect(autre.sinPoints, 'le Péché gagné pendant la fenêtre a été écrasé par l’instantané').toBe(3);
  });

  it('SONDE E — RAFALE de deux Colères : la 2ᵉ tire au total EXPIÉ, et expie à son tour', () => {
    const hero = mageSolo();
    hero.sinPoints = 2;
    setDesFixes(true);
    // Les DEUX étapes sont poussées avant que l'une ne soit résolue (rafale d'un même round).
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    // Les deux Colères se DÉSIGNENT par leur nature, jamais par leur position : la conséquence d'une
    // étape s'INSÈRE derrière elle (#1508, `cascade.poseDansLaSequence`), donc la 2ᵉ Colère n'est plus
    // forcément la 2ᵉ du tableau — et ce qui se joue ici est « la Colère suivante », pas « l'index 1 ».
    const coleres = () => steps().filter((s) => s.kind === 'miscastTable');
    expect(coleres()).toHaveLength(2);
    poser(coleres()[0].id, 1);
    expect(coleres()[0].table!.result!.die, '1 + 2×10').toBe(21);
    suivant();
    expect(hero.sinPoints).toBe(1);
    // La CONSÉQUENCE de la 1ʳᵉ Colère se glisse DERRIÈRE elle (#1508) au lieu d'aller en fin de
    // séquence : c'est une disposition d'INGÉNIERIE (une étape poussée par un applier est sa suite
    // immédiate), pas une règle — aucun passage source ne prescrit l'ordre entre deux Colères.
    // Ce que le RAW tient ici est ailleurs, et reste vérifié plus bas : la 2ᵉ se tire au total EXPIÉ.
    expect(steps().map((s) => s.kind)).toEqual(['miscastTable', 'miscast', 'miscastTable']);
    suivant();
    // 2ᵉ étape : son modificateur est relu MAINTENANT (1 Péché), pas celui de son ouverture (2).
    poser(coleres()[1].id, 1);
    expect(coleres()[1].table!.result!.die, 'la 2ᵉ Colère a tiré au total PÉRIMÉ').toBe(11);
    suivant();
    expect(hero.sinPoints, 'la 2ᵉ expiation n’a pas eu lieu').toBe(0);
  });

  it('SONDE E bis — « Tout lancer » sur la rafale : le mod vivant tient HORS modale, la garde de ligne reste muette', () => {
    // Le pilote AUTOMATIQUE (`cascadeResolveAll`) doit composer la déclaration comme la modale :
    // sinon la 2ᵉ Colère se résoudrait au total périmé, sans personne pour le voir.
    const hero = mageSolo();
    hero.sinPoints = 2;
    setDesFixes(true);
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    const avant = steps().filter((s) => s.kind === 'miscastTable').map((s) => s.id);
    expect(() => useGame.getState().cascadeResolveAll(), 'la garde de ligne a levé sur un chemin légitime').not.toThrow();
    // « Tout lancer » laisse la séquence en BILAN (curseur en fin) : les étapes tirées s'y relisent.
    const tirees = avant.map((id) => steps().find((s) => s.id === id)!);
    expect(tirees.every(Boolean), 'une étape de la rafale a disparu du bilan').toBe(true);
    const mods = tirees.map((s) => s.table!.mod);
    expect(mods, '2 Péchés puis 1 après la 1ʳᵉ expiation').toEqual([20, 10]);
    for (const s of tirees) expect(s.table!.result!.die).toBe(s.table!.result!.roll + s.table!.mod!);
    expect(hero.sinPoints, 'les deux expiations : 2 → 1 → 0').toBe(0);
  });

  it('SONDE A bis — les Points de Sorcellerie tombent UN PAR UN : le Test de seuil s’ouvre AU gain qui franchit', () => {
    // LDB 19 l.70 : le Test de Résistance se joue à CHAQUE gain. Un gain groupé de N n'en jouerait
    // qu'un seul — d'où `sorceryCorruptionLines` qui appelle `gainCorruption(…, 1)` N fois.
    const seuilDe = (c: Combatant) => bonus(effectiveChar(c, 'force-mentale')) + bonus(effectiveChar(c, 'endurance'));

    // (a) LOIN du seuil : les deux jets versent DEUX Points, chacun sa ligne « +1 » (jamais un « +2 »).
    const loin = mageSolo();
    loin.resilience = 0;
    loin.corruption = 0;
    setDesFixes(true);
    applyMiscast(useGame.getState, useGame.setState, loin, 'mineure', { sorceryCorruption: true });
    poser(stepAt(0).id, 96); // Chaos en cascade → une relance : 2 jets, donc 2 Points
    suivant();
    expect(loin.corruption, 'le 1ᵉʳ jet n’a pas versé SON Point à SON étape').toBe(1);
    poser(steps().find((s) => s.id.endsWith('-majeure'))!.id, 26); // ligne terminale
    suivant();
    expect(loin.corruption, 'le jet de la relance n’a pas versé le sien').toBe(2);
    expect(useGame.getState().pendingCorruption, 'un Test de seuil loin du seuil').toBeNull();
    const gains = useGame.getState().pendingCascade!.participants
      .flatMap((s) => (s.outcome ?? []).map((l) => l.text))
      .filter((t) => /Points? de Corruption/.test(t)); // « Points » au pluriel = un gain GROUPÉ, à voir
    expect(gains.length, `gains rendus : ${gains.join(' | ')}`).toBe(2);
    for (const g of gains) expect(g, 'un gain groupé au lieu d’un gain par jet').toMatch(/\+1 Point de Corruption/);

    // (a bis) OPTION ÉTEINTE : le chemin est LE MÊME (les dés se tirent à leur étape au lieu de s'y
    // poser), donc l'exigence « un par un » tient sans qu'AUCUN dénouement ne porte deux jets — c'est
    // ce qu'on mesure : autant de Points que d'étapes jouées, et jamais un gain groupé « +2 ».
    resetDesFixes();
    useGame.setState({ pendingCascade: null, suspendedCascades: [] });
    const graine = [...Array(80)].map((_, i) => i + 1)
      .find((s) => { seedBattleRng(s); return rollMiscast('mineure', battleRng()).tableRolls === 2; })!;
    expect(graine, 'aucune graine à DEUX jets : le cas multi-jets n’est pas exercé').toBeDefined();
    const inline = mageSolo();
    inline.resilience = 0;
    inline.corruption = 0;
    seedBattleRng(graine);
    applyMiscast(useGame.getState, useGame.setState, inline, 'mineure', { sorceryCorruption: true });
    const jets = joueEnRetenant().des.length;
    expect(jets, 'la relance n’a pas reçu SON étape').toBeGreaterThan(1);
    expect(inline.corruption, 'un Point par JET (LDB 49 l.5)').toBe(jets);
    const rendus = useGame.getState().journal.filter((t) => /Points? de Corruption/.test(t));
    for (const g of rendus) expect(g, 'un gain groupé « +2 » au lieu de gains « +1 »').toMatch(/\+1 Point de Corruption/);

    // (b) JUSTE sous le seuil : c'est le gain QUI FRANCHIT qui ouvre le Test de Résistance — donc dès
    // le PREMIER jet. Un gain groupé de 2 ne l'aurait joué qu'une fois, après coup.
    useGame.setState({ pendingCascade: null, suspendedCascades: [], pendingCorruption: null });
    const bord = mageSolo();
    bord.resilience = 0;
    bord.corruption = seuilDe(bord);
    expect(corruptionThresholdExceeded(bord), 'fixture déjà au-delà du seuil').toBe(false);
    applyMiscast(useGame.getState, useGame.setState, bord, 'mineure', { sorceryCorruption: true });
    poser(stepAt(0).id, 96);
    suivant();
    expect(bord.corruption).toBe(seuilDe(bord) + 1);
    expect(useGame.getState().pendingCorruption, 'aucun Test de seuil ouvert AU gain qui franchit').not.toBeNull();
    expect(useGame.getState().pendingCorruption!.heroId).toBe(bord.id);
  });

  it('SONDE F — hors Colère, AUCUN modificateur n’est déclaré (le moteur n’en applique aucun)', () => {
    for (const sev of ['mineure', 'majeure'] as MiscastSeverity[]) {
      const hero = mageSolo();
      hero.sinPoints = 4; // des Péchés QUI NE COMPTENT PAS pour une Imparfaite
      setDesFixes(true);
      applyMiscast(useGame.getState, useGame.setState, hero, sev);
      const decl = stepAt(0).table!;
      expect(decl.modPerActor, `${sev} : un modificateur de Péché déclaré hors Colère`).toBeUndefined();
      poser(stepAt(0).id, 40);
      // Ligne AFFICHÉE == ligne APPLIQUÉE : le dé effectif est le naturel, sans glissement.
      expect(stepAt(0).table!.result).toMatchObject({ roll: 40, die: 40 });
      expect(hero.sinPoints, 'un Péché expié hors Colère').toBe(4);
      useGame.setState({ pendingCascade: null, suspendedCascades: [] });
    }
  });

  it('SONDE A — Corruption de Sorcellerie : 1 Point PAR JET, MÊME compte option allumée ou éteinte', () => {
    // LDB 49 l.5 : « À chaque fois qu'un pratiquant de la Sorcellerie fait un jet sur le Tableau des
    // Incantations Imparfaites, il gagne 1 Point de Corruption. » Un 96-00 = DEUX jets (la ligne + sa
    // relance sur la Majeure) → 2 Points, que les dés soient posés ou tirés.
    const poseSonPoint = () => {
      const hero = mageSolo();
      hero.corruption = 0;
      hero.resilience = 0; // « Je te renie ! » n'ouvre pas de modale de choix pendant la sonde
      setDesFixes(true);
      applyMiscast(useGame.getState, useGame.setState, hero, 'mineure', { sorceryCorruption: true });
      poser(stepAt(0).id, 96); // Chaos en cascade → relance
      suivant();
      poser(steps().find((s) => s.id.endsWith('-majeure'))!.id, 26); // ligne terminale
      suivant();
      return hero.corruption ?? 0;
    };
    expect(poseSonPoint(), 'le jet de la relance ne compte pas').toBe(2);
    // Le COMPTE de jets du moteur, sur les trois formes de cascade (c'est lui que les deux modes lisent).
    expect(rollMiscast('mineure', scripted([40])).tableRolls).toBe(1);
    expect(rollMiscast('mineure', scripted([96, 26])).tableRolls, 'un 96-00 compte SES DEUX jets').toBe(2);
    expect(rollMiscast('mineure', scripted([91, 95, 40, 30])).tableRolls, 'les résultats 91-00 relancés sont des jets eux aussi').toBe(4);
    // OPTION ÉTEINTE (les dés tombent à leur étape) : sur la MÊME graine, l'écart avec/sans
    // Sorcellerie vaut exactement le nombre d'ÉTAPES jouées — une valeur mécanique ne dépend pas de
    // l'option de confort, et le compte de jets se lit sur la séquence RÉELLE, pas sur un second chemin.
    resetDesFixes();
    // Graines RETENUES : celles dont le flux CASCADE réellement (sinon la sonde ne mesurerait que le
    // cas à un seul jet et laisserait passer un agrégat) + une graine mono comme témoin.
    const compte = (seed: number) => { seedBattleRng(seed); return rollMiscast('mineure', battleRng()).tableRolls; };
    const toutes = [...Array(80)].map((_, i) => i + 1);
    const multi = toutes.filter((s) => compte(s) > 1).slice(0, 3);
    const mono = toutes.find((s) => compte(s) === 1)!;
    expect(multi.length, 'aucune graine ne cascade : le cas multi-jets n’est pas exercé').toBeGreaterThan(0);
    for (const seed of [...multi, mono]) {
      const sans = mageSolo(); sans.corruption = 0; sans.resilience = 0;
      seedBattleRng(seed);
      applyMiscast(useGame.getState, useGame.setState, sans, 'mineure');
      const etapesSans = joueEnRetenant().des.length;
      const avec = mageSolo(); avec.corruption = 0; avec.resilience = 0;
      seedBattleRng(seed);
      applyMiscast(useGame.getState, useGame.setState, avec, 'mineure', { sorceryCorruption: true });
      const etapes = joueEnRetenant().des.length;
      expect(etapes, `graine ${seed} : la Sorcellerie a changé le nombre de jets`).toBe(etapesSans);
      expect((avec.corruption ?? 0) - (sans.corruption ?? 0), `graine ${seed} : ${etapes} étape(s) de Tableau`).toBe(etapes);
    }
  });

  it('SONDE G — la ligne APPLIQUÉE est celle AFFICHÉE : un modificateur qui bouge après le dé lève', () => {
    const hero = mageSolo();
    hero.sinPoints = 1;
    setDesFixes(true);
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    poser(stepAt(0).id, 95); // effectif 105 → « Châtiment »
    hero.sinPoints = 4; // sabotage : le compteur bouge entre le dé et la validation
    expect(() => suivant()).toThrow(/n'est pas celle affichée/);
  });

  it('lanceur NON contrôlé par le siège local (ennemi sans siège MJ) : l’étape est POUSSÉE et le socle la résout D’OFFICE', () => {
    const hero = mageSolo();
    setDesFixes(true);
    const npc = { ...structuredClone(hero), id: 'npc-1', kind: 'enemy' } as Combatant;
    npc.conditions = [];
    useGame.setState({ party: [hero, npc] });
    seedBattleRng(2);
    applyMiscast(useGame.getState, useGame.setState, npc, 'majeure');
    // Aucun siège ne tient ce porteur : l'étape sous le curseur naît RÉSOLUE (`cascade.poserLeCurseur`).
    const st = stepAt(0);
    expect(st.kind).toBe('miscastTable');
    const tire = st.table!.result;
    expect(tire, 'une table sans siège est restée non tirée').toBeTruthy();
    expect(tire!.id, 'le dé tiré d’office ne désigne pas la ligne du Tableau')
      .toBe(miscastRowAt('miscast-majeure', tire!.die).id);
    expect(draineCascade(useGame.getState)).toContain('miscastTable');
    expect(useGame.getState().pendingCascade, 'la séquence résolue d’office ne se ferme pas').toBeNull();
  });
});

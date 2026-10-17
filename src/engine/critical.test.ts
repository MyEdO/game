import { describe, it, expect, afterEach } from 'vitest';
import { makeRNG } from './dice';
import type { RNG } from './dice';
import {
  resolveCritique, jeuDeCritique, critiqueTriviale, aaCriticalOffset, aaDeathByCriticalCount,
  critLocationRoll, critWoundLocation, prendreAmputationsDifferees,
  critEntryCodexCategory, findCritEntrySuffered,
} from './critical';
import { removeSurgicalTrauma, permanentAmputations } from './trauma';
import { applyOps, type GameOp } from './ops';
import { spellOps, type Flow, type FlowTestNode } from './flowCore';
import { setRule, resetRule } from './policy';
import { CRITIQUE_DOCS, critiqueTable, type JeuDeCritique } from '../data/criticals';
import locJson from '../data/localisation.json';
import type { Combatant, HitLocation } from './types';

/**
 * Blessures critiques par Localisation — UN lecteur, DEUX jeux (#1657 B2a, #1682) : le Livre de base
 * (« Traumatisme », LDB 18) et l'approche ALTERNATIVE d'Aux Armes (AA 07). Le corps de ce fichier est
 * PARAMÉTRÉ par `jeu` partout où la règle est la même — ce qui reste propre à chacun (le modificateur
 * de SÉVÉRITÉ du d100 et le libellé de journal) est nommé, et le reste est joué deux fois.
 */

/** RNG scripté : renvoie les valeurs dans l'ordre, bornées au domaine demandé. */
function seq(...values: number[]): RNG {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, values[i++])) };
}

const cible = (E = 30): Combatant =>
  ({
    id: 't', name: 'Cible', label: 'Cible', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 0, max: 12 },
    conditions: [], skills: [], traumas: [], critEntriesSuffered: [], bodyShape: 'humanoide',
  }) as unknown as Combatant;

const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
const JEUX: JeuDeCritique[] = ['ldb', 'aa'];

/** Étapes d'un Flow rendu en `seq` (le nœud puis sa suite) — lecture NOMINATIVE, aucune forme supposée. */
const flowEtapes = (f: Flow | undefined): Flow[] => (f && f.kind === 'seq' ? f.steps : f ? [f] : []);
/** Le nœud `test` d'un Flow qui EN EST un — rouge nommé sinon (jamais un `undefined` silencieux). */
function noeudDeTest(f: Flow | undefined): FlowTestNode {
  if (!f || f.kind !== 'test') throw new Error(`noeud test attendu, recu : ${f ? f.kind : 'rien'}`);
  return f;
}
/** Ops d'une feuille `do` — la conséquence telle qu'elle partira à `applyOps`. */
const opsDe = (f: Flow | undefined): GameOp[] => spellOps(f, 'target');
/** Le Flow d'amputation d'une rangée NOMMÉE — dé de sévérité FORCÉ sur son propre `min`. */
function critFlowAmputation(jeu: JeuDeCritique, loc: HitLocation, entryId: string): Flow | undefined {
  const e = critiqueTable(jeu, loc).find((x) => x.id === entryId)!;
  const r = resolveCritique(jeu, cible(), loc, makeRNG(1), { forcedRoll: e.min });
  expect(r.entryId).toBe(entryId);
  return r.testFlow;
}

// ---------------------------------------------------------------------------------------------
// CORPS PARAMÉTRÉ — ce que les deux jeux tiennent à l'identique.
// ---------------------------------------------------------------------------------------------
describe.each(JEUX)('resolveCritique (%s) — invariants partagés par les deux jeux', (jeu) => {
  it('résout une entrée de la table de la Localisation, avec ses ops d’effet immédiat', () => {
    const r = resolveCritique(jeu, cible(), 'tete', makeRNG(1));
    expect(r.location).toBe('tete');
    expect(typeof r.label).toBe('string');
    expect(Array.isArray(r.ops)).toBe(true); // PB + États en GameOp, appliqués par applyOps
    expect(critiqueTable(jeu, 'tete').some((e) => e.id === r.entryId)).toBe(true);
  });

  it('les traumatismes produits portent la Localisation du critique', () => {
    for (let s = 1; s <= 40; s++) {
      for (const t of resolveCritique(jeu, cible(), 'corps', makeRNG(s)).traumas) expect(t.location).toBe('corps');
    }
  });

  it('chaque `amputation` déclarée porte `{difficulty, sequels}` non vide', () => {
    let count = 0;
    for (const doc of CRITIQUE_DOCS.filter((d) => d.jeu === jeu)) {
      for (const e of doc.entries) {
        if (!e.amputation) continue;
        count++;
        expect(e.amputation.difficulty).toBeTruthy();
        expect(Array.isArray(e.amputation.sequels)).toBe(true);
        expect(e.amputation.sequels.length).toBeGreaterThan(0);
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  it('chaque nœud `test` porte sa Difficulté et une branche `fail` qui applique quelque chose', () => {
    let count = 0;
    for (const doc of CRITIQUE_DOCS.filter((d) => d.jeu === jeu)) {
      for (const e of doc.entries) {
        if (!e.test) continue;
        count++;
        expect(e.test.kind, `${e.id}`).toBe('test');
        expect(e.test.test.difficulty, `${e.id} : difficulté absente`).toBeTruthy();
        expect(spellOps(e.test.fail, 'target').length, `${e.id} : branche fail vide`).toBeGreaterThan(0);
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  /**
   * Repli « Tableau des Bras » (LDB 76 l.21 : « Si un animal possède une Localisation sans Tableau de
   * Critiques, comme un tentacule, une queue ou une aile, faites un jet sur le Tableau des Bras et
   * décrivez le résultat de façon appropriée. ») — garde EXHAUSTIVE, la classe et pas les cas.
   */
  describe('critiqueTable — repli Tableau des Bras (LDB 76 l.21)', () => {
    const shapes = (locJson as { personnage: { shapes: Record<string, { loc: HitLocation }[]> } }).personnage.shapes;
    const producedLocs = new Set<HitLocation>();
    for (const entries of Object.values(shapes)) for (const e of entries) producedLocs.add(e.loc);

    it('localisation.json (humanoide/serpent/araignee) ne produit que des locs déjà couvertes', () => {
      expect(producedLocs.size).toBeGreaterThan(0);
      for (const loc of producedLocs) expect(critiqueTable(jeu, loc).length, `loc ${loc}`).toBeGreaterThan(0);
    });

    it('les 6 HitLocation résolvent sur une table DÉDIÉE (les deux côtés partagent la leur, aucun repli exercé)', () => {
      expect(critiqueTable(jeu, 'brasG')).toBe(critiqueTable(jeu, 'brasD'));
      expect(critiqueTable(jeu, 'jambeG')).toBe(critiqueTable(jeu, 'jambeD'));
      expect(critiqueTable(jeu, 'tete')).not.toBe(critiqueTable(jeu, 'brasD'));
      expect(critiqueTable(jeu, 'corps')).not.toBe(critiqueTable(jeu, 'brasD'));
      expect(critiqueTable(jeu, 'jambeG')).not.toBe(critiqueTable(jeu, 'brasD'));
      for (const loc of LOCS) expect(critiqueTable(jeu, loc).length).toBeGreaterThan(0);
    });

    it('une loc SANS table dédiée (tentacule/queue/aile future) retombe réellement sur la table des Bras', () => {
      const bras = critiqueTable(jeu, 'brasD');
      for (const exotic of ['tentacule', 'queue', 'aile'] as unknown as HitLocation[]) {
        expect(critiqueTable(jeu, exotic)).toBe(bras);
      }
    });
  });
});

// ---------------------------------------------------------------------------------------------
// CE QUI DIVERGE — la SÉVÉRITÉ et le LIBELLÉ de journal, et rien d'autre.
// ---------------------------------------------------------------------------------------------
describe('sévérité et journal — les deux seules divergences entre les jeux', () => {
  it('LDB 18 l.17 ; #1595 c.6222318751 : −20 si 0 < dépassement < BE, strictement ; minimum 01', () => {
    const jet = (overkill: number, de = 50): number => resolveCritique('ldb', cible(45), 'corps', seq(de), { overkill }).roll; // BE 4
    expect(jet(0)).toBe(50);
    expect(jet(1)).toBe(30);
    expect(jet(3)).toBe(30);
    expect(jet(4), 'égalité : pas de −20').toBe(50);
    expect(jet(6)).toBe(50);
    expect(jet(1, 10), 'minimum 01').toBe(1);
  });

  it('AA 07 l.36 : +10 par Blessure au-delà de 0 — et le décalage pousse jusqu’à la ligne LÉTALE plafond', () => {
    expect(aaCriticalOffset(0)).toBe(0);
    expect(aaCriticalOffset(8)).toBe(80); // exemple l.54
    // Torse, d100 40 + overkill 8 (+80) = 120 ≥ 116 → « Éventré » (Mort), AA 07 l.157.
    const r = resolveCritique('aa', cible(), 'corps', seq(40), { overkill: 8 });
    expect(r.roll).toBe(120);
    expect(r.label).toBe('Éventré');
    expect(r.lethal).toBe(true);
  });

  it('le journal nomme le jeu qui a résolu', () => {
    expect(resolveCritique('ldb', cible(), 'corps', seq(15)).log.startsWith('Blessure critique (')).toBe(true);
    expect(resolveCritique('aa', cible(), 'corps', seq(15)).log.startsWith('Blessure critique AA (')).toBe(true);
  });
});

describe('jeuDeCritique — la règle optionnelle choisit le jeu, `twice` reste au chemin LDB', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('défaut = LDB ; `combat-aa-blessures = aa` = Aux Armes ; Sauvagerie (`twice`) reste LDB', () => {
    expect(jeuDeCritique()).toBe('ldb');
    setRule('combat-aa-blessures', 'aa');
    expect(jeuDeCritique()).toBe('aa');
    expect(jeuDeCritique(true)).toBe('ldb'); // LDB 41 l.170 : l'Atout ne coexiste pas avec la variante
  });

  it('les deux jeux tirent des tables DIFFÉRENTES au même dé', () => {
    const aa = resolveCritique('aa', cible(), 'corps', seq(15));
    const ldb = resolveCritique('ldb', cible(), 'corps', seq(15));
    expect(aa.label).toBe("Rien qu'une égratignure !");
    expect(ldb.label).not.toBe(aa.label);
  });
});

// ---------------------------------------------------------------------------------------------
// LIVRE DE BASE — les lignes nommées (LDB 18).
// ---------------------------------------------------------------------------------------------
describe('Livre de base (LDB 18 « Traumatisme ») — lignes nommées', () => {
  it('le résultat 00 (létal) est mortel', () => {
    const r = resolveCritique('ldb', cible(), 'tete', makeRNG(1));
    if (r.roll === 100) expect(r.lethal).toBe(true);
  });

  it('la table Corps comporte des Fractures, qui réduisent Force et Agilité de 30', () => {
    for (let s = 1; s <= 60; s++) {
      const frac = resolveCritique('ldb', cible(), 'corps', makeRNG(s)).traumas.find((t) => t.label.startsWith('Fracture'));
      if (!frac) continue;
      expect(frac.ops).toContainEqual({ op: 'charMod', char: 'force', mod: -30 });
      expect(frac.ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -30 });
      return;
    }
    throw new Error('aucune Fracture trouvée sur 60 seeds');
  });

  // « Doigt sectionné » (BRAS 81-85) : « Amputation (Accessible) », sans nœud `test` de rangée → le
  // critique ne consomme qu'UN dé (la sévérité), et rend le Test d'Amputation à ouvrir par la porte.
  it('Doigt sectionné : un SEUL dé au moteur, et le Test d’Amputation (Accessible) rendu à la porte', () => {
    const r = resolveCritique('ldb', cible(30), 'brasD', seq(83)); // un seul dé : rien d'autre ne tire
    expect(r.entryId).toBe('doigt-sectionne');
    const [noeud, perte] = flowEtapes(r.testFlow);
    expect(noeudDeTest(noeud).test).toMatchObject({ skill: { id: 'resistance' }, difficulty: 'accessible', label: 'Amputation' });
    expect(opsDe(perte)).toEqual([{ op: 'amputer', sequels: ['doigt-ampute'], loc: 'brasD' }]);
    expect(r.traumas).toEqual([]);                                    // la plaie vient de l'op, à l'application
  });

  it('Doigt sectionné : l’op POSE la plaie chirurgicale et la séquelle, quel que soit le sort du Test (l.121)', () => {
    const [, perte] = flowEtapes(resolveCritique('ldb', cible(30), 'brasD', seq(83)).testFlow);
    const c = cible(30);
    applyOps(c, opsDe(perte), {});
    expect(c.traumas!.some((t) => t.needsSurgery && t.label.startsWith('Amputation'))).toBe(true);
    expect(c.traumas!.some((t) => t.traumaId === 'doigt-ampute')).toBe(true);
  });

  it('« Bouche explosée » : le 1d10 de la LIGNE (`unites`) pilote le comptage de bout en bout', () => {
    // d100=83 → « Bouche explosée » (81-85) ; le 1d10 des dents DÉCLARÉ par la ligne (`amputation.unites`)
    // est désormais tiré par l'op, à l'application — c'est une QUANTITÉ, pas un Test.
    const [, perte] = flowEtapes(resolveCritique('ldb', cible(30), 'tete', seq(83)).testFlow);
    const c = cible(30);
    applyOps(c, opsDe(perte), { rng: seq(7) });
    const dents = c.traumas!.find((t) => t.traumaId === 'dents-perdues')!;
    expect(dents.count).toBe(7);
    expect(dents.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -3 }); // 7 dents = 3 paires
  });

  it('« Pied sectionné » : l’op pose la plaie chirurgicale ET la séquelle permanente de mobilité', () => {
    const [, perte] = flowEtapes(resolveCritique('ldb', cible(30), 'jambeD', seq(95)).testFlow); // 94-96
    const c = cible(30);
    applyOps(c, opsDe(perte), {});
    expect(c.traumas!.some((t) => t.needsSurgery)).toBe(true);
    expect(c.traumas!.some((t) => t.ops?.some((o) => o.op === 'moveScale') && !t.needsSurgery)).toBe(true);
  });

  it('la séquelle permanente survit à la Chirurgie (le membre reste absent)', () => {
    const [, perte] = flowEtapes(resolveCritique('ldb', cible(30), 'jambeD', seq(95)).testFlow);
    const c = cible(30);
    applyOps(c, opsDe(perte), {});
    c.criticalWounds = 1;
    removeSurgicalTrauma(c); // opère la plaie chirurgicale
    expect(c.traumas!.some((t) => t.needsSurgery)).toBe(false); // plaie réparée
    expect(c.traumas!.some((t) => t.ops?.some((o) => o.op === 'moveScale'))).toBe(true); // mobilité réduite à VIE
  });

  // #195 — variantes de la table JAMBE.
  it('Orteil contusionné : le nœud de la rangée part en `testFlow` (Résistance) — la pénalité d’Agilité est sa branche `fail`', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(5)); // 5 = crit « Orteil contusionné »
    const n = r.testFlow as Extract<typeof r.testFlow, { kind: 'test' }>;
    expect(n.kind).toBe('test');
    expect(n.test.skill).toEqual({ id: 'resistance' }); // LDB 18 l.164 : « Test de Résistance » (la COMPÉTENCE)
    expect(spellOps(n.fail, 'target')).toContainEqual({ op: 'charMod', char: 'agilite', mod: -10, durationRounds: 2 });
    expect(spellOps(n.success, 'target')).toEqual([]); // Test réussi : aucune pénalité
    expect(r.ops.some((o) => o.op === 'charMod')).toBe(false); // l'issue vient de la porte, pas du moteur
  });
  it('l’entrée porte une note maison traçant la valeur `durationRounds` (règle stricte 7)', () => {
    const e = critiqueTable('ldb', 'jambeD').find((x) => x.id === 'orteil-contusionne')!;
    expect(e.maison).toBeTruthy();
    expect(spellOps(e.test!.fail, 'target')[0]).toMatchObject({ op: 'charMod', char: 'agilite', mod: -10, durationRounds: 2 });
  });

  // « Tendon rompu » (71-75) : « Votre jambe devient inutilisable (voir Membres Amputés) » = disable DIRECT,
  // sans Test ni Difficulté d'amputation → séquelle permanente `membre-inferieur-ampute`, PAS de plaie chirurgicale.
  it('Tendon rompu : séquelle permanente « membre inférieur amputé » SANS plaie chirurgicale ni test d’amputation', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(72, 40)); // 72 = crit ; 40 = le nœud `test` (Difficile) de la ligne
    const disable = r.traumas.find((t) => t.traumaId === 'membre-inferieur-ampute')!;
    expect(disable).toBeTruthy();
    expect(disable.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(disable.ops).toContainEqual({ op: 'skillMod', skill: { id: 'esquive' }, mod: -20 });
    expect(disable.needsSurgery).toBeFalsy(); // pas une amputation chirurgicale : membre inutilisable
    expect(r.traumas.some((t) => t.needsSurgery && t.label === 'Amputation')).toBe(false);
    expect(r.traumas.some((t) => t.label.startsWith('Déchirure'))).toBe(true); // + Déchirure musculaire (Majeur)
  });

  // « Pied écrasé » (91-93) : un Test Accessible (+20) ; échec → perte d'1 orteil + 1 par DR en dessous de 0,
  // ET le pied reste une plaie chirurgicale (perte du pied sans Chirurgie sous 1d10 jours).
  it('Pied écrasé : la plaie À ÉCHÉANCE est posée par l’escalade — le Test ne décide que de la PERTE', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(92, 5)); // 92 crit ; 5 = 1d10 échéance (escalade)
    expect(r.entryId).toBe('pied-ecrase');
    const plaie = r.traumas.find((t) => t.needsSurgery && t.label === 'Amputation')!;
    expect(plaie.amputateAfterDays).toBe(5);
    expect(plaie.amputateSequel).toBe('membre-inferieur-ampute');
    expect(r.traumas.some((t) => t.traumaId === 'orteil-ampute')).toBe(false); // rien n'est perdu avant le Test
  });
  it('Pied écrasé : sur un ÉCHEC à −2 DR, l’op retire 3 orteils SANS doubler la plaie à échéance', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(92, 5));
    const n = noeudDeTest(r.testFlow);
    const fail = n.fail as Extract<Flow, { kind: 'seq' }>;
    const c = cible(30);
    c.traumas = r.traumas;
    applyOps(c, opsDe(fail.steps[fail.steps.length - 1]), { sl: -2 });
    const orteil = c.traumas!.find((t) => t.traumaId === 'orteil-ampute')!;
    expect(orteil.count).toBe(3); // 1 + 2 DR
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -3 });
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'capacite-de-combat', mod: -3 });
    const plaies = c.traumas!.filter((t) => t.needsSurgery && t.label === 'Amputation');
    expect(plaies).toHaveLength(1);                        // une seule plaie par membre
    expect(plaies[0].amputateAfterDays).toBe(5);           // et son échéance est intacte
  });
  it('Pied écrasé : Test RÉUSSI → aucun orteil perdu, mais le pied reste une plaie chirurgicale', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(92, 7));
    expect(spellOps(noeudDeTest(r.testFlow).success, 'target')).toEqual([]); // réussite : rien
    const plaie = r.traumas.find((t) => t.needsSurgery && t.label === 'Amputation')!;
    expect(plaie.amputateAfterDays).toBe(7);
    expect(plaie.amputateSequel).toBe('membre-inferieur-ampute');
  });
});

// ---------------------------------------------------------------------------------------------
// AUX ARMES — les lignes nommées (AA 07).
// ---------------------------------------------------------------------------------------------
describe('Aux Armes (AA 07, approche alternative) — lignes nommées', () => {
  it('la colonne « Blessures » (l.40) est une op `wounds` EN TÊTE, suivie des États immédiats', () => {
    // Torse, d100 15 → « Rien qu'une égratignure ! » (11-20) : Blessures 1 + 1 État Hémorragique.
    const r = resolveCritique('aa', cible(), 'corps', seq(15));
    expect(r.label).toBe("Rien qu'une égratignure !");
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }, { op: 'condition', id: 'hemorragique', value: 1 }]);
    expect(r.lethal).toBe(false);
  });

  it('nœud `test` de la rangée : RENDU par `testFlow`, jamais roulé — sa branche `fail` porte l’À Terre (l.140)', () => {
    // Torse 21-25 « Coup au ventre » : 1 Sonné + Résistance Facile (+40) sous peine À Terre.
    const r = resolveCritique('aa', cible(), 'corps', seq(22));
    expect(r.label).toBe('Coup au ventre');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }, { op: 'condition', id: 'sonne', value: 1 }]);
    const n = r.testFlow as Extract<typeof r.testFlow, { kind: 'test' }>;
    expect(n.test.difficulty).toBe('facile');
    expect(spellOps(n.fail, 'target')).toEqual([{ op: 'condition', id: 'a-terre', value: 1 }]);
  });

  it('lignes triviales « T » (l.79) DÉRIVÉES — non létales et sans perte de Blessure', () => {
    expect(critiqueTriviale('aa', 'brasD', 5)).toBe(true);   // 01-10 « Choc au poignet » = T
    expect(critiqueTriviale('aa', 'brasD', 25)).toBe(false); // 21-25 « Coupure mineure » = 1 Blessure
    // Une ligne LÉTALE ne perd aucune Blessure (« Mort » n'a pas de colonne) et n'est POURTANT pas
    // triviale : la clause `!lethal` de la dérivation porte tout le poids ici. Sans elle, une mort
    // n'incrémenterait plus `criticalWounds` (AA 07 l.73 : le compte qui tue).
    for (const doc of CRITIQUE_DOCS) {
      for (const e of doc.entries) {
        if (!e.lethal) continue;
        expect((e.ops ?? []).some((o) => o.op === 'wounds'), `${e.id} : une létale sans op wounds`).toBe(false);
        expect(critiqueTriviale(doc.jeu, doc.localisation === 'bras' ? 'brasD' : doc.localisation === 'jambe' ? 'jambeD' : doc.localisation, e.min), `${e.id} : la mort est comptée triviale`).toBe(false);
      }
    }
  });

  it('les 6 rangées triviales sont EXACTEMENT celles qui ne perdent aucune Blessure (bijection re-mesurée)', () => {
    const triviales = CRITIQUE_DOCS.flatMap((d) => d.entries.filter((e) => !e.lethal && !(e.ops ?? []).some((o) => o.op === 'wounds')).map((e) => e.id));
    expect(triviales.sort()).toEqual(['aa-bras-01', 'aa-bras-11', 'aa-corps-01', 'aa-jambe-01', 'aa-jambe-11', 'aa-tete-01']);
  });

  it('mort par accumulation de Blessures Critiques (l.73)', () => {
    expect(aaDeathByCriticalCount(true, 0, 3, 2)).toBe(true);   // Inconscient + 0 PB + 3 > BE 2
    expect(aaDeathByCriticalCount(false, 0, 3, 2)).toBe(false); // pas Inconscient
    expect(aaDeathByCriticalCount(true, 4, 3, 2)).toBe(false);  // PB > 0
    expect(aaDeathByCriticalCount(true, 0, 2, 2)).toBe(false);  // 2 n'est pas > 2
  });

  // #125 / #153 — sous-effets RÉCURRENTS/chiffrés STRUCTURÉS (GameOp à durée, op `disarm`).
  it('« Choc au bras » (bras 11-20, l.113) : lâche l’objet + main inutilisable 1d10−BE Rounds', () => {
    const r = resolveCritique('aa', cible(), 'brasG', seq(15));
    expect(r.label).toBe('Choc au bras');
    expect(r.ops).toEqual([
      { op: 'disarm' },
      {
        op: 'maxWeaponHands', hands: 1,
        durationRounds: { minimum: 1, of: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] } },
      },
    ]);
  });

  it('« Clef de bras » (bras 51-55, l.118) : lâche l’objet + bras inutilisable 1d10 Rounds', () => {
    const r = resolveCritique('aa', cible(), 'brasG', seq(53));
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2, ignoreTB: true, ignoreAP: true }, { op: 'disarm' }, { op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Clavicule tordue » (corps 41-45, l.144) : lâche l’objet + bras inutilisable 1d10 Rounds', () => {
    const r = resolveCritique('aa', cible(), 'corps', seq(43));
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2, ignoreTB: true, ignoreAP: true }, { op: 'disarm' }, { op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Cheville tordue » (jambe 21-25, l.166) : −10 Ag pendant 1d10 Rounds', () => {
    const r = resolveCritique('aa', cible(), 'jambeG', seq(23));
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }, { op: 'charMod', char: 'agilite', mod: -10, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Genou tordu » (jambe 51-55, l.170) : −20 Ag pendant 1d10 Rounds', () => {
    const r = resolveCritique('aa', cible(), 'jambeG', seq(53));
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2, ignoreTB: true, ignoreAP: true }, { op: 'charMod', char: 'agilite', mod: -20, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Orteil contusionné » (jambe 01-10, l.164) : la branche `fail` du nœud rendu porte −10 Ag 1 Round', () => {
    const r = resolveCritique('aa', cible(), 'jambeG', seq(5));
    expect(r.label).toBe('Orteil contusionné');
    expect(r.ops).toEqual([]); // aucun effet immédiat : tout tient au Test
    const n = r.testFlow as Extract<typeof r.testFlow, { kind: 'test' }>;
    expect(spellOps(n.fail, 'target')).toEqual([{ op: 'charMod', char: 'agilite', mod: -10, durationRounds: 1 }]);
  });

  it('« Perte d’équilibre » (jambe 11-20, l.165) : le nœud teste l’ATHLÉTISME, pas la Résistance', () => {
    const r = resolveCritique('aa', cible(), 'jambeG', seq(15));
    expect(r.label).toBe("Perte d'équilibre");
    const n = r.testFlow as Extract<typeof r.testFlow, { kind: 'test' }>;
    expect(n.test.skill).toEqual({ id: 'athletisme' }); // AA 07 l.165
    expect(spellOps(n.fail, 'target')).toEqual([{ op: 'condition', id: 'a-terre', value: 1 }]);
    expect(critiqueTable('aa', 'jambeG').find((e) => e.id === 'aa-jambe-11')!.test!.test.skill).toEqual({ id: 'athletisme' });
  });

  // #1657 B3-1b — l'Amputation (LDB 18 l.237) est FABRIQUÉE, jamais roulée : ce que le moteur rend est
  // le/les nœud(s) `test` que la porte ouvrira, et l'op `amputer` qui pose plaie + séquelles.
  it('« Oreille mutilée » (tête 61-65, l.237) : AUCUN dé consommé, un nœud de Résistance Accessible rendu', () => {
    const r = resolveCritique('aa', cible(), 'tete', seq(63)); // un SEUL dé : la sévérité ; plus aucun jet ici
    expect(r.label).toBe('Oreille mutilée');
    // Les États du Test (À Terre / Sonné / Inconscient, l.237) ne sont plus pré-décidés au moteur : seuls
    // restent les effets IMMÉDIATS que la ligne inflige (Blessures, Assourdi, Hémorragique).
    expect(r.ops.filter((o) => o.op === 'condition').map((o) => o.id)).toEqual(['assourdi', 'hemorragique']);
    expect(r.traumas).toEqual([]);                              // ni plaie ni séquelle pré-posées
    const [noeud, perte] = flowEtapes(r.testFlow);
    expect(noeudDeTest(noeud).test.skill).toEqual({ id: 'resistance' });   // LDB 18 l.237
    expect(noeudDeTest(noeud).test.difficulty).toBe('accessible');
    expect(spellOps(noeudDeTest(noeud).success, 'target')).toEqual([]);
    expect(opsDe(perte)).toEqual([{ op: 'amputer', sequels: ['oreille-perdue'], loc: 'tete' }]);
  });

  it('« Oreille mutilée » : les États du Test sont ÉCHELONNÉS par DR dans la branche `fail` (l.237)', () => {
    const n = noeudDeTest(flowEtapes(resolveCritique('aa', cible(), 'tete', seq(63)).testFlow)[0]);
    const fail = n.fail as Extract<Flow, { kind: 'seq' }>;
    expect(opsDe(fail.steps[0])).toEqual([{ op: 'condition', id: 'a-terre', value: 1 }]);
    const paliers = fail.steps.slice(1).map((etape) => etape as Extract<Flow, { kind: 'if' }>);
    expect(paliers.map((pal) => pal.cond)).toEqual([
      { kind: 'slThreshold', op: '<=', value: -2 },
      { kind: 'slThreshold', op: '<=', value: -4 },
    ]);
    expect(paliers.map((pal) => opsDe(pal.then))).toEqual([
      [{ op: 'condition', id: 'sonne', value: 1 }],
      [{ op: 'condition', id: 'inconscient', value: 1 }],
    ]);
  });

  it('« Main mutilée » (LDB bras 94-96, l.124) : DEUX Tests — la rangée PUIS l’amputation, la séquelle HORS du Test', () => {
    // RAW l.124 : « Vous perdez votre main – Amputation (Difficile). […] Réussissez un Test de
    // Résistance Difficile (-20) ou gagnez les États Sonné et À Terre » — deux jets, pas un doublon.
    const [rangee, amputation] = flowEtapes(critFlowAmputation('ldb', 'brasD', 'main-mutilee'));
    expect(noeudDeTest(rangee).test.difficulty).toBe('difficile');
    const [noeud, perte] = flowEtapes(amputation);
    expect(noeudDeTest(noeud).test.difficulty).toBe('difficile');
    expect(noeudDeTest(noeud).test.label).toBe('Amputation');   // distinct du libellé de la rangée
    expect(opsDe(perte)).toEqual([{ op: 'amputer', sequels: ['main-bras-ampute'], loc: 'brasD' }]);
  });

  it('« Pied écrasé » (l.180) : le Test GATE la perte — `amputer` est DANS `fail`, échelonné par DR', () => {
    const r = resolveCritique('aa', cible(), 'jambeD', seq(50), { overkill: 6 }); // 50 + 60 → 110
    expect(r.label).toBe('Pied écrasé');
    const n = noeudDeTest(r.testFlow);                         // un seul nœud : la perte est dans SA branche
    expect(n.test.difficulty).toBe('accessible');
    expect(spellOps(n.success, 'target')).toEqual([]);          // réussi → aucun orteil, aucun État
    const fail = n.fail as Extract<Flow, { kind: 'seq' }>;
    expect(opsDe(fail.steps[fail.steps.length - 1])).toEqual([
      { op: 'amputer', sequels: ['orteil-ampute'], loc: 'jambeD', unitesPerSL: { every: 1, amount: 1, onFailure: true } },
    ]);
  });

  it('« Pied écrasé » : sur un DR INJECTÉ de −3, l’op retire 1 + 3 = 4 orteils (l.180)', () => {
    const n = noeudDeTest(resolveCritique('aa', cible(), 'jambeD', seq(50), { overkill: 6 }).testFlow);
    const fail = n.fail as Extract<Flow, { kind: 'seq' }>;
    const c = cible();
    applyOps(c, opsDe(fail.steps[fail.steps.length - 1]), { sl: -3 });
    expect(c.traumas!.find((t) => t.traumaId === 'orteil-ampute')!.count).toBe(4);
    expect(c.traumas!.some((t) => t.needsSurgery)).toBe(true);  // la plaie chirurgicale suit la séquelle
  });

  // ESCALADE de la ligne (LDB 18 l.122 « Pour chaque Round au cours duquel vous ne recevez pas d'Aide
  // Médicale, vous perdez un autre doigt » ; l.180 pour le délai de Chirurgie) : elle vit SUR la plaie
  // chirurgicale, que le nœud d'Amputation ne pose qu'à la porte — le critère doit donc la CRÉER.
  it.each([
    { jeu: 'ldb' as JeuDeCritique, loc: 'brasD' as HitLocation, id: 'main-ouverte', de: 88, overkill: 0 },
    { jeu: 'aa' as JeuDeCritique, loc: 'brasD' as HitLocation, id: 'aa-bras-116', de: 98, overkill: 2 }, // 98 + 2×10 = 118
  ])('« Main ouverte » ($jeu, l.122) : la plaie chirurgicale PORTE l’escalade par Round', ({ jeu, loc, id, de, overkill }) => {
    const r = resolveCritique(jeu, cible(), loc, seq(de), { overkill });
    expect(r.entryId).toBe(id);
    const plaie = r.traumas.find((t) => t.needsSurgery && t.label === 'Amputation')!;
    expect(plaie, 'aucune plaie chirurgicale : l’escalade par Round n’a plus de porteur').toBeTruthy();
    expect(plaie.perRound).toEqual({ versTraumaId: 'doigt-ampute' });
    expect(plaie.awaitingMedicalAid).toBe(true);
    expect(plaie.location).toBe(loc);
  });

  it.each([
    { jeu: 'ldb' as JeuDeCritique, loc: 'jambeD' as HitLocation, id: 'pied-ecrase', de: 92, overkill: 0 },
    { jeu: 'aa' as JeuDeCritique, loc: 'jambeD' as HitLocation, id: 'aa-jambe-106', de: 90, overkill: 2 }, // 90 + 2×10 = 110
  ])('« Pied écrasé » ($jeu, l.180) : la MEME plaie porte le délai de Chirurgie', ({ jeu, loc, id, de, overkill }) => {
    const r = resolveCritique(jeu, cible(), loc, seq(de, 5), { overkill });
    expect(r.entryId).toBe(id);
    const plaies = r.traumas.filter((t) => t.needsSurgery && t.label === 'Amputation');
    expect(plaies, 'une plaie chirurgicale et une seule par membre').toHaveLength(1);
    expect(plaies[0].amputateAfterDays).toBe(5);
    expect(plaies[0].amputateSequel).toBe('membre-inferieur-ampute');
  });

  it('« Main ouverte » : sur le chemin RÉEL, l’op `amputer` NE DOUBLE PAS la plaie qui porte l’escalade', () => {
    const r = resolveCritique('ldb', cible(), 'brasD', seq(88));
    const c = cible();
    c.traumas = r.traumas;                                   // ce qu'`applyCriticalToTarget` pose avant la porte
    const [, perte] = flowEtapes(r.testFlow);
    applyOps(c, opsDe(perte), {});                           // ce que la porte applique en jouant le nœud
    const plaies = c.traumas!.filter((t) => t.needsSurgery && t.label === 'Amputation');
    expect(plaies).toHaveLength(1);
    expect(plaies[0].perRound, 'l’escalade a été perdue à l’application').toEqual({ versTraumaId: 'doigt-ampute' });
    expect(c.traumas!.some((t) => t.traumaId === 'doigt-ampute'), 'le doigt de la ligne n’est pas posé').toBe(true);
  });

  it('« Mâchoire mutilée » : la QUANTITÉ (1d10 dents) reste un dé de l’op, pas un Test (l.237)', () => {
    const [, amputation] = flowEtapes(critFlowAmputation('ldb', 'tete', 'machoire-mutilee'));
    const [, perte] = flowEtapes(amputation);
    expect(opsDe(perte)).toEqual([
      { op: 'amputer', sequels: ['langue-amputee', 'dents-perdues'], loc: 'tete', unites: { dice: { n: 1, sides: 10 } } },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// AMPUTATION DIFFÉRÉE — même patron pour les deux jeux (« Une fois la rencontre terminée… »).
// ---------------------------------------------------------------------------------------------
describe.each([
  { jeu: 'ldb' as JeuDeCritique, roll: 48 },
  { jeu: 'aa' as JeuDeCritique, roll: 58 },
])('amputation DIFFÉRÉE ($jeu) — « Une fois la rencontre terminée… » (l.171)', ({ jeu, roll }) => {
  const marqueur = () => resolveCritique(jeu, cible(30), 'jambeD', seq(roll)); // un seul dé : rien d'autre ne tire

  it('ARME le nœud sur le marqueur `pendingAmputation` : aucun dé, aucune séquelle, aucun État ici', () => {
    const r = marqueur();
    expect(r.label).toBe("Coupure à l'orteil");
    expect(r.testFlow).toBeUndefined();                    // le Test ne part PAS dans le geste du critique
    expect(r.traumas.find((t) => t.pendingAmputation)!.label).toBe("Coupure à l'orteil");
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(false);
    // Seuls restent les effets IMMÉDIATS de la ligne (Blessures + Hémorragique) : aucun État du Test.
    expect(r.ops.filter((o) => o.op === 'condition').map((o) => o.id)).toEqual(['hemorragique']);
  });

  it('le nœud ARMÉ est le GATE Intermédiaire (l.171) dont l’échec joue le Test d’Amputation Accessible (l.237)', () => {
    const gate = noeudDeTest(marqueur().traumas.find((t) => t.pendingAmputation)!.pendingAmputation);
    expect(gate.test.skill).toEqual({ id: 'resistance' });
    expect(gate.test.difficulty).toBe('intermediaire');
    expect(spellOps(gate.success, 'target')).toEqual([]);   // gate réussi → PAS d'amputation du tout
    const [interne, perte] = flowEtapes(gate.fail);
    expect(noeudDeTest(interne).test.difficulty).toBe('accessible');
    expect(opsDe(perte)).toEqual([{ op: 'amputer', sequels: ['orteil-ampute'], loc: 'jambeD' }]);
  });

  it('les DEUX Tests portent des LIBELLÉS distincts — deux « Résistance » homonymes seraient injoignables', () => {
    const gate = noeudDeTest(marqueur().traumas.find((t) => t.pendingAmputation)!.pendingAmputation);
    const interne = noeudDeTest(flowEtapes(gate.fail)[0]);
    expect(gate.test.label).toBe("Coupure à l'orteil");
    expect(interne.test.label).toBe('Amputation');
  });

  it('`prendreAmputationsDifferees` CONSOMME le marqueur et rend le Flow à ouvrir par la porte', () => {
    const c = cible(30);
    c.traumas = marqueur().traumas;
    const dus = prendreAmputationsDifferees(c);
    expect(dus.map((d) => d.label)).toEqual(["Coupure à l'orteil"]);
    expect(dus[0].flow.kind).toBe('test');
    expect(c.traumas!.some((t) => t.pendingAmputation)).toBe(false);   // marqueur consommé
    expect(prendreAmputationsDifferees(c)).toEqual([]);                // et non rejouable
  });
});

// ---------------------------------------------------------------------------------------------
// SÉQUELLES PERMANENTES et LECTURE d'un id subi.
// ---------------------------------------------------------------------------------------------
describe('permanentAmputations — séquelles permanentes par id de fiche (LDB 18 l.233-285, DROITIER)', () => {
  it('jambe : pied (membre-inferieur-ampute) → Mouvement ÷2 + −20 Esquive ; orteil → −1 Ag/CC', () => {
    const [pied] = permanentAmputations(['membre-inferieur-ampute'], 'jambeG');
    expect(pied.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(pied.ops).toContainEqual({ op: 'skillMod', skill: { id: 'esquive' }, mod: -20 });
    const [orteil] = permanentAmputations(['orteil-ampute'], 'jambeD');
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -1 });
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'capacite-de-combat', mod: -1 });
  });
  it('bras (DROIT ou GAUCHE) main amputée : interdit d’arme à 2 mains, AUCUN charMod (#101 LDB 18 l.263)', () => {
    for (const loc of ['brasD', 'brasG'] as const) {
      const [main] = permanentAmputations(['main-bras-ampute'], loc);
      expect(main.ops?.some((o) => o.op === 'maxWeaponHands')).toBe(true);
      expect(main.ops?.some((o) => o.op === 'charMod')).toBeFalsy(); // la pénalité −20 est portée par amputationCombatPenalty
    }
  });
  it('bras : doigt (perte d’UN doigt) → count 1, AUCUN charMod (#101 LDB 18 l.251), pas la règle de la main', () => {
    const [doigt] = permanentAmputations(['doigt-ampute'], 'brasD');
    expect(doigt.traumaId).toBe('doigt-ampute');
    expect(doigt.count).toBe(1);
    expect(doigt.ops?.some((o) => o.op === 'charMod')).toBeFalsy();
    expect(doigt.ops?.some((o) => o.op === 'maxWeaponHands')).toBeFalsy();
  });
  it('tête : « Coup défigurant » cumule œil (−5 Soc) + nez (−20 Soc)', () => {
    const s = permanentAmputations(['nez-ampute', 'oeil-perdu'], 'tete');
    expect(s.map((x) => x.label).sort()).toEqual(['Nez amputé', 'Œil perdu']);
    expect(s.find((x) => x.label === 'Nez amputé')!.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -20 });
  });
  it('tête : « Mâchoire mutilée » — la LIGNE fait perdre 1d10 dents (`unites`), la langue n’est pas comptée', () => {
    const s = permanentAmputations(['langue-amputee', 'dents-perdues'], 'tete', 4);
    expect(s.find((x) => x.label === 'Langue amputée')!.ops).toContainEqual({ op: 'skillMod', skill: { id: 'langue' }, mod: -100 });
    expect(s.find((x) => x.label === 'Langue amputée')!.count).toBeUndefined(); // séquelle non cumulative
    const dents = s.find((x) => x.traumaId === 'dents-perdues')!;
    expect(dents.count).toBe(4);
    expect(dents.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -2 }); // 4 dents = 2 paires
  });
  it('les 4 lignes qui font perdre des dents sont TOUTES en table Tête et déclarent leur quantité', () => {
    // Aucune ligne de Bras/Corps/Jambe n'octroie `dents-perdues` : le comptage vient de la LIGNE, pas
    // de la Localisation — la garde `location === 'tete'` de l'ancien moteur n'avait aucun cas à couvrir.
    const porteuses = CRITIQUE_DOCS.flatMap((d) =>
      d.entries.filter((e) => e.amputation?.sequels.includes('dents-perdues')).map((e) => ({ table: `${d.jeu}-${d.localisation}`, e })));
    expect(porteuses.map((p) => p.table).sort()).toEqual(['aa-tete', 'aa-tete', 'ldb-tete', 'ldb-tete']);
    expect(porteuses.every((p) => p.e.amputation!.unites != null)).toBe(true);
  });
});

describe('findCritEntrySuffered — UNE boucle sur les 8 documents (id subi → entrée + table + jeu)', () => {
  it('retrouve une entrée de CHAQUE document, avec sa table et son jeu', () => {
    for (const doc of CRITIQUE_DOCS) {
      const found = findCritEntrySuffered(doc.entries[0].id)!;
      expect(found, `${doc.id}`).toBeTruthy();
      expect(found.table).toBe(doc.localisation);
      expect(found.jeu).toBe(doc.jeu);
      expect(critEntryCodexCategory(found.table, found.jeu)).toBe(
        `${doc.jeu === 'aa' ? 'aaCriticals' : 'criticals'}${doc.localisation === 'tete' ? 'Tete' : doc.localisation === 'bras' ? 'Bras' : doc.localisation === 'corps' ? 'Corps' : 'Jambe'}`,
      );
    }
  });
  it('un id inconnu rend `undefined` (aucune levée : le Codex reste défensif)', () => {
    expect(findCritEntrySuffered('id-qui-n-existe-pas')).toBeUndefined();
  });
});

describe('critLocationRoll — localisation d’un Coup Critique (1d100 direct, p.159)', () => {
  it('retourne une HitLocation valide', () => {
    expect(LOCS).toContain(critLocationRoll(makeRNG(3)));
  });
  it('respecte la forme du corps (Localisations Alternatives p.312)', () => {
    // serpent : seulement Tête / Corps ; araignée : seulement Tête / Pattes(jambeD) / Abdomen(corps)
    for (let s = 1; s <= 40; s++) {
      expect(['tete', 'corps']).toContain(critLocationRoll(makeRNG(s), 'serpent'));
      expect(['tete', 'jambeD', 'corps']).toContain(critLocationRoll(makeRNG(s), 'araignee'));
    }
  });
});

describe('critWoundLocation — règle UNIQUE de localisation du Coup Critique (LDB 18 l.53)', () => {
  it('sans override → 1d100 frais (= critLocationRoll au même seed)', () => {
    expect(critWoundLocation(makeRNG(3), 'humanoide')).toBe(critLocationRoll(makeRNG(3), 'humanoide'));
  });
  it('avec override (loc choisie / Critique pré-montré) → l’override, jamais le tirage', () => {
    expect(critWoundLocation(makeRNG(3), 'humanoide', 'tete')).toBe('tete');
    // forme du corps ignorée quand l'override est fourni (c'est une loc déjà résolue en amont).
    expect(critWoundLocation(makeRNG(7), 'serpent', 'jambeD')).toBe('jambeD');
  });
});

describe('CriticalResolved.naturel : le d100 du tableau, avant le modificateur de sévérité (LDB 10 l.773 ; #1595 c.6227274650 Q3)', () => {
  it('aa, 8 Blessures au-delà de 0 : roll 128, naturel 48 (AA 07 l.36)', () => {
    const r = resolveCritique('aa', cible(), 'corps', makeRNG(1), { overkill: 8, forcedRoll: 48 });
    expect(r.roll).toBe(128);
    expect(r.naturel).toBe(48);
  });
  it('ldb, dépassement sous le BE : roll 28, naturel 48 (LDB 18 l.17)', () => {
    const r = resolveCritique('ldb', cible(), 'corps', makeRNG(1), { overkill: 1, forcedRoll: 48 });
    expect(r.roll).toBe(28);
    expect(r.naturel).toBe(48);
  });
});

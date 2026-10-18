import { describe, expect, it, vi } from 'vitest';
// `./pont` en tête : il fixe l'ordre d'évaluation du graphe de `src/state` (voir pont.ts).
import { creerPont, type CombattantVu, type Erreur, type Pont, type Resultat, type Vue } from './pont';
import { findCreatureById } from '../../../src/data';
import { makePregens } from '../../../src/data/pregens';
import { hasActiveFlag } from '../../../src/engine/activeFlags';
import { gainAdvantage } from '../../../src/engine/advantage';
import { groupAdvantage } from '../../../src/engine/advantagePool';
import { assertAttackWeapon, compteDuCoup, initiativeOrder, resolveMelee } from '../../../src/engine/combat';
import { hasCritRollTwiceTalent } from '../../../src/engine/combatFeatures/dispatch';
import { addCondition, appliquerMortSubite, applyZeroWounds, COND, hasCondition, isOutOfAction } from '../../../src/engine/conditions';
import { critiqueTriviale, jeuDeCritique, regimeDePorteur, resolveCritique, type CriticalResolved } from '../../../src/engine/critical';
import { makeRNG, type RNG } from '../../../src/engine/dice';
import { effectiveMovement } from '../../../src/engine/encumbrance';
import { applyOps } from '../../../src/engine/ops';
import { isInanimate } from '../../../src/engine/structures';
import { consolidateAmputations, reinjuryBleed } from '../../../src/engine/trauma';
import type { Combatant } from '../../../src/engine/types';
import { bestDefenseMode } from '../../../src/state/combatManeuvers';
import { creatureToCombatant } from '../../../src/state/spawn';

const panne = vi.hoisted(() => ({ reinjuryBleed: false }));

vi.mock('../../../src/engine/trauma', async (original) => {
  const reel = await original<typeof import('../../../src/engine/trauma')>();
  return {
    ...reel,
    reinjuryBleed: (...a: Parameters<typeof reel.reinjuryBleed>) => {
      if (panne.reinjuryBleed) throw new Error('panne-reinjuryBleed');
      return reel.reinjuryBleed(...a);
    },
  };
});

type Reponse = { ok: true; vue?: Vue; resultat?: Resultat } | { ok: false; erreur: Erreur };

const appel = (pont: Pont, methode: Exclude<keyof Pont, 'sondeExceptionNue'>, entree?: unknown): Reponse =>
  JSON.parse((pont[methode] as (json?: string) => string)(entree === undefined ? undefined : JSON.stringify(entree)));

const vueDe = (r: Reponse): Vue => {
  if (!r.ok || !r.vue) throw new Error(`réponse sans vue : ${JSON.stringify(r)}`);
  return r.vue;
};

const natureDe = (r: Reponse): string | undefined => (r.ok ? undefined : r.erreur.nature);

function partieDemarree(graine: number): { pont: Pont; vue: Vue; attaquant: CombattantVu; cible: CombattantVu } {
  const pont = creerPont();
  const vue = vueDe(appel(pont, 'demarrer', { graine }));
  const attaquant = vue.combattants.find((c) => c.id === vue.actif)!;
  const cible = vue.combattants.find((c) => c.camp !== attaquant.camp)!;
  return { pont, vue, attaquant, cible };
}

/** La rencontre DIRECTE, sans le pont : mêmes combattants, même graine, même ordre d'initiative. */
function rencontreDirecte(graine: number) {
  const brigand = findCreatureById('brigand')!;
  const combattants = [
    ...makePregens().slice(0, 4),
    creatureToCombatant(brigand, 'brigand-1', { x: 0, y: 0 }),
    creatureToCombatant(brigand, 'brigand-2', { x: 0, y: 1 }),
  ];
  const rng = makeRNG(graine);
  const ordre = initiativeOrder(combattants, rng).map((c) => c.id);
  return { combattants, rng, ordre };
}

/** L'appel DIRECT des coutures d'une attaque, composées comme combatFlow.ts:2721-2879 sans le pont. */
function attaqueDirecte(rng: RNG, attaquant: Combatant, cible: Combatant): Resultat {
  const arme = assertAttackWeapon(attaquant.weapons, true);
  const res = resolveMelee(attaquant, cible, arme, rng, { defense: bestDefenseMode(cible) });
  const twice = hasActiveFlag(attaquant, 'critRollTwice') || hasCritRollTwiceTalent(attaquant);
  const { compte, lieu, coupCritique } = compteDuCoup(res, arme, attaquant, cible, 0);
  if (res.advantageTo === 'attacker') gainAdvantage(attaquant, 1);
  let perdues: number | undefined;
  const critiques: CriticalResolved[] = [];
  let mortSubite = false;
  if (res.hit && (compte.blessures || compte.critiques.length || compte.mortSubite || coupCritique)) {
    if (compte.relance) res.location = lieu;
    res.woundsLost = compte.blessures;
    const avant = cible.wounds.current;
    cible.wounds.current = Math.max(0, avant - compte.blessures);
    perdues = avant - cible.wounds.current;
    const log: string[] = [];
    const reinj = isInanimate(cible) ? 0 : reinjuryBleed(cible, lieu);
    if (reinj > 0) addCondition(cible, COND.hemorragique, reinj);
    if (compte.mortSubite) appliquerMortSubite(cible, log);
    mortSubite = compte.mortSubite;
    for (const entree of compte.critiques) {
      const jeu = jeuDeCritique(twice);
      const crit = resolveCritique(jeu, cible, lieu, rng, { overkill: entree.overkill, twice });
      critiques.push(crit);
      if (!(jeu === 'aa' && critiqueTriviale('aa', crit.location, crit.roll))) cible.criticalWounds = (cible.criticalWounds ?? 0) + 1;
      cible.tookCriticalThisFight = true;
      cible.critEntriesSuffered = [...(cible.critEntriesSuffered ?? []), crit.entryId];
      if (crit.traumas.length) {
        cible.traumas = [...(cible.traumas ?? []), ...crit.traumas];
        consolidateAmputations(cible);
      }
      if (crit.lethal) {
        cible.dead = true;
        break;
      }
      applyOps(cible, crit.ops, { rng, location: lieu });
    }
    if (regimeDePorteur(cible).clore && cible.wounds.current <= 0 && !cible.dead && !hasCondition(cible, COND.inconscient)) applyZeroWounds(cible);
  }
  if (res.advantageTo === 'defender') {
    gainAdvantage(cible, 1);
    if (!groupAdvantage()) attaquant.advantage = 0;
  }
  if (res.hit && res.woundsLost && !groupAdvantage()) cible.advantage = 0;
  return JSON.parse(JSON.stringify({
    touche: res.hit,
    jetAttaque: res.attackerRoll,
    cibleAttaque: res.attackerDetail?.target,
    drAttaque: res.attackerDetail?.sl,
    jetDefense: res.defenderDetail?.roll ?? res.defenderRoll,
    cibleDefense: res.defenderDetail?.target,
    drDefense: res.defenderDetail?.sl,
    drNet: res.netSL,
    localisation: res.location,
    degats: res.damage,
    blessuresPerdues: perdues,
    critique: res.critical,
    critiques: critiques.map((c) => ({ libelle: c.label, localisation: c.location, mortel: c.lethal })),
    mortSubite,
    journal: res.log,
  }));
}

const etatDirect = (c: Combatant) => ({
  blessures: c.wounds.current,
  blessuresMax: c.wounds.max,
  avantage: c.advantage,
  etats: c.conditions.map((e) => ({ id: e.id, valeur: e.value })),
  mouvement: effectiveMovement(c),
  horsDeCombat: isOutOfAction(c),
});

const BORNE_D_ATTAQUES = 500;

/** Une partie jouée par le pont jusqu'à son issue : l'actif frappe le premier adversaire debout, puis passe.
 *  Chaque attaque est rejouée par l'appel direct, à la même graine, et comparée. */
function partieJusquALIssue(graine: number) {
  const { pont, vue: depart } = partieDemarree(graine);
  const direct = rencontreDirecte(graine);
  expect(depart.ordre).toEqual(direct.ordre);
  let vue = depart;
  const resultats: Resultat[] = [];
  while (!vue.issue && resultats.length < BORNE_D_ATTAQUES) {
    const attaquant = vue.combattants.find((c) => c.id === vue.actif)!;
    const cible = vue.combattants.find((c) => c.camp !== attaquant.camp && !c.horsDeCombat)!;
    const r = appel(pont, 'attaquer', { attaquant: attaquant.id, cible: cible.id });
    if (!r.ok) throw new Error(`graine ${graine} : ${JSON.stringify(r.erreur)}`);
    const a = direct.combattants.find((c) => c.id === attaquant.id)!;
    const c = direct.combattants.find((x) => x.id === cible.id)!;
    expect(r.resultat).toEqual(attaqueDirecte(direct.rng, a, c));
    const apres = (id: string) => etatVu(r.vue!.combattants.find((x) => x.id === id)!);
    expect(apres(a.id)).toEqual(etatDirect(a));
    expect(apres(c.id)).toEqual(etatDirect(c));
    resultats.push(r.resultat!);
    vue = r.vue!;
    if (!vue.issue) vue = vueDe(appel(pont, 'finDeTour'));
  }
  return { vue, resultats };
}

const etatVu = ({ blessures, blessuresMax, avantage, etats, mouvement, horsDeCombat }: CombattantVu) =>
  ({ blessures, blessuresMax, avantage, etats, mouvement, horsDeCombat });

describe('pont wfrpPont — contrat (#2793)', () => {
  it('attaquer, sérialisé à travers le pont, égale l’appel direct des coutures à graine égale (20 graines)', () => {
    let touches = 0;
    for (let graine = 1; graine <= 20; graine++) {
      const { pont, attaquant, cible } = partieDemarree(graine);
      const direct = rencontreDirecte(graine);
      const a = direct.combattants.find((c) => c.id === attaquant.id)!;
      const c = direct.combattants.find((x) => x.id === cible.id)!;
      const attendu = attaqueDirecte(direct.rng, a, c);
      const r = appel(pont, 'attaquer', { attaquant: attaquant.id, cible: cible.id });
      if (!r.ok) throw new Error(`graine ${graine} : ${JSON.stringify(r.erreur)}`);
      expect(r.resultat).toEqual(attendu);
      const apres = (id: string) => etatVu(r.vue!.combattants.find((x) => x.id === id)!);
      expect(apres(attaquant.id)).toEqual(etatDirect(a));
      expect(apres(cible.id)).toEqual(etatDirect(c));
      if (attendu.touche) touches += 1;
    }
    expect(touches).toBeGreaterThan(0);
  });

  it('une partie atteint son issue par la chaîne des Blessures critiques, égale à l’appel direct coup par coup (5 graines)', () => {
    let critiques = 0;
    let mortsSubites = 0;
    for (let graine = 1; graine <= 5; graine++) {
      const { vue, resultats } = partieJusquALIssue(graine);
      expect(vue.issue, `graine ${graine} : ${resultats.length} attaques`).not.toBeNull();
      critiques += resultats.reduce((n, r) => n + r.critiques.length, 0);
      mortsSubites += resultats.filter((r) => r.mortSubite).length;
    }
    expect(critiques).toBeGreaterThan(0);
    expect(mortsSubites).toBeGreaterThan(0);
  });

  it('refuse un déplacement au-delà du Mouvement, un id inconnu, un JSON invalide, une seconde attaque', () => {
    const { pont, attaquant, cible } = partieDemarree(7);
    expect(natureDe(appel(pont, 'deplacer', { id: attaquant.id, cases: attaquant.mouvement + 1 }))).toBe('refus');
    expect(natureDe(appel(pont, 'deplacer', { id: 'inconnu', cases: 1 }))).toBe('entree');
    expect(natureDe(JSON.parse(pont.deplacer('{')))).toBe('entree');
    expect(appel(pont, 'attaquer', { attaquant: attaquant.id, cible: cible.id }).ok).toBe(true);
    expect(natureDe(appel(pont, 'attaquer', { attaquant: attaquant.id, cible: cible.id }))).toBe('refus');
  });

  it('une méthode appelée avant demarrer rend la nature « etat »', () => {
    const pont = creerPont();
    expect(natureDe(appel(pont, 'vue'))).toBe('etat');
    expect(natureDe(appel(pont, 'deplacer', { id: 'x', cases: 1 }))).toBe('etat');
  });

  it('une exception levée dans une couture rend { nature: exception, pile, partiels } sans jamais lever', () => {
    panne.reinjuryBleed = true;
    try {
      const echecs: Erreur[] = [];
      for (let graine = 1; graine <= 60; graine++) {
        const { pont, attaquant, cible } = partieDemarree(graine);
        let brut = '';
        expect(() => { brut = pont.attaquer(JSON.stringify({ attaquant: attaquant.id, cible: cible.id })); }).not.toThrow();
        const r: Reponse = JSON.parse(brut);
        if (!r.ok) echecs.push(r.erreur);
      }
      expect(echecs.length).toBeGreaterThan(0);
      for (const e of echecs) {
        expect(e.nature).toBe('exception');
        expect(e.message).toBe('panne-reinjuryBleed');
        expect(e.pile).toContain('panne-reinjuryBleed');
        expect(e.action.methode).toBe('attaquer');
        expect((e.partiels as Resultat).touche).toBe(true);
      }
    } finally {
      panne.reinjuryBleed = false;
    }
  });

  it('simulerAttaque n’altère pas la vue', () => {
    const { pont, attaquant, cible } = partieDemarree(3);
    const avant = appel(pont, 'vue');
    const s = appel(pont, 'simulerAttaque', { attaquant: attaquant.id, cible: cible.id, graine: 99 });
    expect(s.ok && s.resultat).toBeTruthy();
    expect(appel(pont, 'vue')).toEqual(avant);
  });

  it('sondeExceptionNue lève', () => {
    expect(() => creerPont().sondeExceptionNue()).toThrow('sonde-exception-nue');
  });
});

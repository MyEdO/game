import { describe, expect, it, vi } from 'vitest';
// `./pont` en tête : il fixe l'ordre d'évaluation du graphe de `src/state` (voir pont.ts).
import { creerPont, type Apercu, type CombattantVu, type Erreur, type Jet, type Pont, type Resultat, type Vue } from './pont';
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
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../../../src/engine/types';
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

type Reponse = { ok: true; vue?: Vue; resultat?: Resultat; apercu?: Apercu; jet?: Jet } | { ok: false; erreur: Erreur };

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

/** Une partie dont l'actif est un héros, sa cible le premier adversaire. */
function partieAuHeros(depuis: number) {
  for (let graine = depuis; graine < depuis + 200; graine++) {
    const partie = partieDemarree(graine);
    if (partie.attaquant.camp === 'heros') return { graine, ...partie };
  }
  throw new Error(`aucune graine dès ${depuis} ne donne la main à un héros`);
}

const jetDe = (r: Reponse): Jet => {
  if (!r.ok || !r.jet) throw new Error(`réponse sans jet : ${JSON.stringify(r)}`);
  return r.jet;
};

const apercuDe = (r: Reponse): Apercu => {
  if (!r.ok || !r.apercu) throw new Error(`réponse sans aperçu : ${JSON.stringify(r)}`);
  return r.apercu;
};

/** Une attaque lancée par la modale, dont le jet de l'attaquant réussit (`voulu`) ou échoue. */
function attaqueLancee(voulu: boolean) {
  for (let depuis = 1; depuis < 400;) {
    const partie = partieAuHeros(depuis);
    depuis = partie.graine + 1;
    appel(partie.pont, 'apercuAttaque', { attaquant: partie.attaquant.id, cible: partie.cible.id });
    const jet = jetDe(appel(partie.pont, 'lancerAttaque'));
    if (jet.attaque.reussite === voulu && jet.influences.relancer.restants > 0) return { ...partie, jet };
  }
  throw new Error(`aucune graine ne donne un jet d'attaquant ${voulu ? 'réussi' : 'raté'} avec de la Chance`);
}

describe('pont wfrpPont — modale d’attaque (#2870)', () => {
  it('l’aperçu donne la cible = base + modificateurs + Difficulté, bornée, et le jet lancé la confirme', () => {
    for (const localisation of [null, 'tete', 'jambeG'] as const) {
      const { pont, attaquant, cible } = partieAuHeros(1);
      const a = apercuDe(appel(pont, 'apercuAttaque', { attaquant: attaquant.id, cible: cible.id, localisation }));
      const difficulte = (Object.keys(DIFFICULTY_LABELS) as Difficulty[]).find((d) => DIFFICULTY_LABELS[d] === a.attaque.difficulte);
      expect(difficulte, a.attaque.difficulte).toBeDefined();
      const brute = a.attaque.base + a.attaque.mods.reduce((n, m) => n + m.valeur, 0) + DIFFICULTY_MODIFIERS[difficulte!];
      expect(a.attaque.cible).toBe(Math.max(0, Math.min(100, brute)));
      expect(a.localisation).toBe(localisation);
      expect(a.localisations).toHaveLength(7);
      expect(a.localisations[0]).toEqual({ id: null, libelle: 'Au hasard' });
      expect(a.sousTitre).toBe(`${attaquant.libelle} — Attaque (${a.attaque.competence})`);
      expect(a.defense).not.toBeNull();
      expect(jetDe(appel(pont, 'lancerAttaque')).attaque.cible).toBe(a.attaque.cible);
    }
  });

  it('viser une Localisation abaisse la cible de l’aperçu', () => {
    const { pont, attaquant, cible } = partieAuHeros(1);
    const auHasard = apercuDe(appel(pont, 'apercuAttaque', { attaquant: attaquant.id, cible: cible.id }));
    const tete = apercuDe(appel(pont, 'apercuAttaque', { attaquant: attaquant.id, cible: cible.id, localisation: 'tete' }));
    expect(tete.attaque.cible).toBe(Math.max(0, auHasard.attaque.cible - 20));
  });

  it('lancer puis appliquer égale attaquer à graine égale (Blessures, résultat, vue)', () => {
    let touches = 0;
    for (let depuis = 1, n = 0; n < 15; n++) {
      const modale = partieAuHeros(depuis);
      depuis = modale.graine + 1;
      const direct = partieDemarree(modale.graine);
      appel(modale.pont, 'apercuAttaque', { attaquant: modale.attaquant.id, cible: modale.cible.id, localisation: null });
      const jet = jetDe(appel(modale.pont, 'lancerAttaque'));
      const r1 = appel(modale.pont, 'appliquerAttaque');
      const r2 = appel(direct.pont, 'attaquer', { attaquant: modale.attaquant.id, cible: modale.cible.id });
      if (!r1.ok || !r2.ok) throw new Error(JSON.stringify([r1, r2]));
      expect(r1.resultat).toEqual(r2.resultat);
      expect(r1.vue).toEqual(r2.vue);
      expect(jet.gagnant === 'attaquant').toBe(r1.resultat!.touche);
      if (r1.resultat!.touche) touches += 1;
    }
    expect(touches).toBeGreaterThan(0);
  });

  it('appliquer vide l’attaque en cours ; une seconde attaque est refusée', () => {
    const { pont, attaquant, cible } = attaqueLancee(true);
    expect(appel(pont, 'appliquerAttaque').ok).toBe(true);
    expect(natureDe(appel(pont, 'appliquerAttaque'))).toBe('etat');
    expect(natureDe(appel(pont, 'apercuAttaque', { attaquant: attaquant.id, cible: cible.id }))).toBe('refus');
  });

  it('relancer dépense un Point de Chance, une seule fois, et seulement sur un jet raté', () => {
    const { pont, jet } = attaqueLancee(false);
    expect(jet.influences.relancer.possible).toBe(true);
    const relance = jetDe(appel(pont, 'relancerAttaque'));
    expect(relance.influences.relancer.restants).toBe(jet.influences.relancer.restants - 1);
    expect(relance.influences.relancer.possible).toBe(false);
    expect(natureDe(appel(pont, 'relancerAttaque'))).toBe('refus');

    const reussi = attaqueLancee(true);
    expect(reussi.jet.influences.relancer.possible).toBe(false);
    expect(natureDe(appel(reussi.pont, 'relancerAttaque'))).toBe('refus');
  });

  it('+1 DR dépense un Point de Chance et ajoute 1 DR au jet de l’attaquant ; sans Chance, +1 DR et relancer sont refusés', () => {
    const { pont, jet } = attaqueLancee(false);
    let courant = jet;
    for (let restants = jet.influences.plusUnDR.restants; restants > 0; restants--) {
      expect(courant.influences.plusUnDR.possible).toBe(true);
      const suivant = jetDe(appel(pont, 'chancePlusUnDR'));
      expect(suivant.attaque.dr).toBe(courant.attaque.dr + 1);
      expect(suivant.attaque.jet).toBe(courant.attaque.jet);
      expect(suivant.influences.plusUnDR.restants).toBe(restants - 1);
      courant = suivant;
    }
    expect(courant.influences.plusUnDR.possible).toBe(false);
    expect(courant.influences.relancer.possible).toBe(false);
    expect(natureDe(appel(pont, 'chancePlusUnDR'))).toBe('refus');
    expect(natureDe(appel(pont, 'relancerAttaque'))).toBe('refus');
  });

  it('annuler vide l’attaque avant le jet et est refusé après lancer', () => {
    const { pont, attaquant, cible } = partieAuHeros(1);
    appel(pont, 'apercuAttaque', { attaquant: attaquant.id, cible: cible.id });
    expect(appel(pont, 'annulerAttaque').ok).toBe(true);
    expect(natureDe(appel(pont, 'lancerAttaque'))).toBe('etat');
    appel(pont, 'apercuAttaque', { attaquant: attaquant.id, cible: cible.id });
    expect(appel(pont, 'lancerAttaque').ok).toBe(true);
    expect(natureDe(appel(pont, 'annulerAttaque'))).toBe('refus');
    expect(natureDe(appel(pont, 'lancerAttaque'))).toBe('refus');
  });

  it('rend { ok:false } sur une entrée invalide, sans jamais lever', () => {
    expect(natureDe(appel(creerPont(), 'apercuAttaque', { attaquant: 'x', cible: 'y' }))).toBe('etat');
    const { pont, attaquant, cible, vue } = partieAuHeros(1);
    expect(natureDe(JSON.parse(pont.apercuAttaque('{')))).toBe('entree');
    expect(natureDe(appel(pont, 'apercuAttaque', { attaquant: attaquant.id }))).toBe('entree');
    expect(natureDe(appel(pont, 'apercuAttaque', { attaquant: 'inconnu', cible: cible.id }))).toBe('entree');
    expect(natureDe(appel(pont, 'apercuAttaque', { attaquant: attaquant.id, cible: cible.id, localisation: 'nez' }))).toBe('entree');
    const allie = vue.combattants.find((c) => c.camp === 'heros' && c.id !== attaquant.id)!;
    expect(natureDe(appel(pont, 'apercuAttaque', { attaquant: attaquant.id, cible: allie.id }))).toBe('refus');
    expect(natureDe(appel(pont, 'apercuAttaque', { attaquant: allie.id, cible: cible.id }))).toBe('refus');
    for (const m of ['lancerAttaque', 'relancerAttaque', 'chancePlusUnDR', 'appliquerAttaque', 'annulerAttaque'] as const) {
      expect(natureDe(appel(pont, m)), m).toBe('etat');
    }
  });
});

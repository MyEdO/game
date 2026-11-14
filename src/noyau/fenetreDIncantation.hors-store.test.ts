/**
 * LA FENÊTRE D'INCANTATION EN DONNÉES (#3059) : chaque réglage que `fenetreDIncantation` annonce refuse exactement ce
 * que son verbe refuse, au banc du noyau (`desFixes` : le dé se pose par `jetImposerLeResultat('incantation')`). Incantation
 * Critique : LDB 46 l.26-32 (« si le Sort inflige des Dégâts, il inflige également une Blessure Critique », l.30) ;
 * Projectile en Zone d'Effet : LDB 47 l.453 ; Prières : LDB 40 ; Surincantation : LDB 47 l.15 ; pose de la zone :
 * LDB 47 l.15, l.28. Lanceur au siège MJ : réponse Q3 du design jugé (#3059).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { fenetreDIncantation, refusDuChoixCritique, refusDeLaForme, refusDuPasDeSurincantation, refusDeLaPose, refusDuReglage } from './fenetreDIncantation';
import { castSpell } from './combatFlow';
import { spells, findSpellById, type SpellData } from '../data/index';
import type { EntreeVivante } from '../data/datasets';
import { setDataset } from '../data/overrides';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { createHero } from '../engine/character';
import { castAfterCrit, castInfoIsPrayer, castingNumberOf, counterspellValue, defaultCritChoice, sortInfligeDesDegats, type CritChoice } from '../engine/magic';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { Jeu } from './etat';
import { REGLAGE_DE_L_AXE } from './reglagesDuJet';

const carreau = findSpellById('carreau')!;
/** Sorts d'épreuve, clones du Carreau (Magie des Arcanes, une cible à portée) : seuls NI, Projectile, effets et Durée changent. */
const epreuve = (id: string, champs: Partial<SpellData>): EntreeVivante<SpellData> => ({ ...carreau, id, label: id, ...champs });
const BLESSURES: SpellData['effects'] = { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount: 3 }] } }] };
const ROUNDS = { kind: 'rounds', value: { charOf: 'force-mentale' } } as const;
const armure = findSpellById('armure-aethyrique')!;
/** L'anatomie d'un Rituel du catalogue (VDM 02 l.377-393), que l'épreuve reprend. */
const anatomie = findSpellById('art-de-la-malediction')?.ritual;
if (!anatomie) throw new Error('art-de-la-malediction ne porte plus son anatomie de Rituel');
const FIXTURES = {
  // Rituel au NI réduit pour un lanceur du Domaine du Feu (VDM 02 l.398) : armure durable, donc dissipable.
  rituel: { ...armure, id: 'epreuve-rituel', label: 'epreuve-rituel', cn: 10, isRitual: true, ritual: { ...anatomie, reduced: { domains: ['feu'], cn: 4, xp: anatomie.xp } } },
  degats: epreuve('epreuve-degats', { cn: 0, missile: false, effects: BLESSURES }),
  sansDegats: epreuve('epreuve-sans-degats', { cn: 0, missile: false, duration: ROUNDS }),
  puissance: epreuve('epreuve-puissance', { cn: 30, missile: false, duration: ROUNDS }),
  priere: epreuve('epreuve-priere', { cn: 4, missile: false, family: 'beni', duration: ROUNDS }),
} satisfies Record<string, EntreeVivante<SpellData>>;

const original = [...spells];
beforeAll(() => { setDataset('spells', [...original, ...Object.values(FIXTURES)]); });
afterAll(() => { setDataset('spells', original); });

/** Lanceur maîtrisant Langue (Magick) et Prière : le dé 11 est un double réussi (Incantation Critique). */
function lanceur(id: string): Combatant {
  const h = herosDeScenario(idsDeTest, 'sorcier');
  h.id = id; h.label = id;
  h.skills = [
    ...h.skills.filter((s) => s.id !== 'langue' && s.id !== 'priere'),
    { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 },
    { id: 'priere', characteristic: 'sociabilite', advances: 60 },
  ] as typeof h.skills;
  return h;
}

/** Hors combat : `L` incante `spellId` sur `V` ; le dé `de` est posé par ses coutures, sauf `de` nul (jet à venir). */
function horsCombat(spellId: string, de: number | null = 11): { banc: Banc; V: Combatant } {
  const banc = ouvrirLeBanc({ desFixes: true });
  const L = lanceur('L');
  const V = { ...lanceur('V'), wounds: blessuresDeBase(30) } as Combatant;
  L.spells = [spellId];
  banc.setState({ battle: null, party: [L, V] });
  // Une Prière se pose ouverte : le lanceur d'épreuve n'a pas de culte.
  if (castInfoIsPrayer(findSpellById(spellId)!)) banc.setState({ pendingCast: { casterId: L.id, targetId: V.id, spellId, missile: false, focused: false, result: null } });
  else banc.getState().incanterLeSort(L.id, spellId, V.id);
  expect(banc.getState().pendingCast, `chemin : ${spellId} s’ouvre`).toMatchObject({ casterId: L.id, spellId });
  if (de != null) {
    banc.getState().jetLancer('incantation');
    banc.getState().jetImposerLeResultat('incantation', de);
  }
  return { banc, V };
}

const choisi = (s: Jeu) => s.pendingCast?.critChoice;
const effet = (s: Jeu, c: CritChoice) => fenetreDIncantation(s)?.critique?.options.find((o) => o.valeur === c);

describe('Incantation Critique : l’effet offert par la fenêtre est celui que le verbe accepte (LDB 46 l.26-32)', () => {
  it('Sort à op de Dégâts hors Projectile : « Blessure Critique » offerte et acceptée (LDB 46 l.30)', () => {
    const { banc } = horsCombat(FIXTURES.degats.id);
    expect(banc.getState().pendingCast!.result, 'le double 11 lance le Sort').toMatchObject({ cast: true, isCritical: true });
    expect(effet(banc.getState(), 'critique')?.refus ?? null).toBeNull();
    banc.getState().jetRegler('incantation', 'effetCritique', 'critique');
    expect(choisi(banc.getState())).toBe('critique');
  });

  it('Arme aethyrique : ses attaques infligent les Dégâts, pas le Sort — « Blessure Critique » refusée', () => {
    const { banc } = horsCombat('arme-aethyrique');
    expect(banc.getState().pendingCast!.result!.isCritical).toBe(true);
    expect(effet(banc.getState(), 'critique')?.refus).toBeTruthy();
    banc.getState().jetRegler('incantation', 'effetCritique', 'critique');
    expect(choisi(banc.getState())).toBeUndefined();
    banc.getState().jetRegler('incantation', 'effetCritique', 'ineluctable');
    expect(choisi(banc.getState()), 'les deux autres effets restent offerts').toBe('ineluctable');
  });

  it('Prière : aucune Incantation Critique (LDB 40) — ni fenêtre, ni verbe', () => {
    const { banc } = horsCombat(FIXTURES.priere.id);
    expect(fenetreDIncantation(banc.getState())!.critique).toBeNull();
    expect(refusDuChoixCritique(banc.getState(), 'critique')).toBeTruthy();
    banc.getState().jetRegler('incantation', 'effetCritique', 'critique');
    expect(choisi(banc.getState())).toBeUndefined();
  });

  for (const id of [FIXTURES.degats.id, FIXTURES.sansDegats.id, FIXTURES.puissance.id, 'arme-aethyrique']) {
    for (const c of ['critique', 'puissance', 'ineluctable'] as const) {
      it(`contrat ${id} / ${c} : refus annoncé ⇔ verbe qui refuse`, () => {
        const { banc } = horsCombat(id);
        const refus = effet(banc.getState(), c)?.refus ?? null;
        expect(refus, 'la fenêtre et le refus pur disent la même chose').toBe(refusDuChoixCritique(banc.getState(), c));
        banc.getState().jetRegler('incantation', 'effetCritique', c);
        expect(choisi(banc.getState()) === c).toBe(refus === null);
      });
    }
  }
});

describe('Incantation Critique d’un lanceur humain : aucun effet retenu par défaut (B7)', () => {
  it('jet sous le NI à Critique : `choisie` nulle, le Sort ne part pas, ni Surincantation ni clôture avant le choix', () => {
    const { banc } = horsCombat(FIXTURES.puissance.id);
    const s = banc.getState();
    expect(s.pendingCast!.result, 'le double 11 réussit sous le NI 30').toMatchObject({ cast: false, isCritical: true });
    expect(fenetreDIncantation(s)!.critique!.choisie).toBeNull();
    expect(castAfterCrit(s.pendingCast!.result!, s.pendingCast!.critChoice), '« Puissance totale » n’est pas lue en douce').toBe(false);
    expect(fenetreDIncantation(s)!.surincantation).toBeNull();
    banc.getState().jetValider('incantation');
    expect(banc.getState().pendingCast, 'la clôture attend le choix').toBeTruthy();
    banc.getState().jetRegler('incantation', 'effetCritique', 'puissance');
    expect(castAfterCrit(banc.getState().pendingCast!.result!, banc.getState().pendingCast!.critChoice), 'choisi, le Sort part (LDB 46 l.31)').toBe(true);
  });
});

describe('Blessure Critique d’un Sort à Dégâts hors Projectile (LDB 46 l.30)', () => {
  it('l’effet choisi inflige une Blessure critique à la cible qui subit les Dégâts', () => {
    const { banc, V } = horsCombat(FIXTURES.degats.id);
    banc.getState().jetRegler('incantation', 'effetCritique', 'critique');
    banc.getState().jetValider('incantation');
    banc.reprendreTout();
    const cible = banc.getState().party.find((c) => c.id === V.id)!;
    expect(cible.wounds.current, 'les Dégâts du Sort sont subis').toBeLessThan(30);
    expect(cible.criticalWounds ?? 0).toBe(1);
  });

  it('témoin : « Force inéluctable » n’inflige aucune Blessure critique', () => {
    const { banc, V } = horsCombat(FIXTURES.degats.id);
    banc.getState().jetRegler('incantation', 'effetCritique', 'ineluctable');
    banc.getState().jetValider('incantation');
    banc.reprendreTout();
    expect(banc.getState().party.find((c) => c.id === V.id)!.criticalWounds ?? 0).toBe(0);
  });
});

describe('forme d’arme invoquée et ton de la Prière : le verbe refuse ce que la fenêtre n’offre pas', () => {
  it('Arme aethyrique : une forme hors des formes du lanceur est refusée, une forme offerte est retenue (LDB 47)', () => {
    const { banc } = horsCombat('arme-aethyrique', null);
    const vue = fenetreDIncantation(banc.getState())!;
    const L = banc.getState().party[0];
    expect(vue.forme!.options.map((o) => o.valeur)).toEqual(conjureFormOptions(L).map((f) => f.weapon));
    expect(refusDeLaForme(banc.getState(), 'corde')).toBeTruthy();
    banc.getState().jetRegler('incantation', 'formeConjuree', 'corde');
    expect(banc.getState().pendingCast!.conjureForm).toBeUndefined();
    const offerte = vue.forme!.options[vue.forme!.options.length - 1].valeur as string;
    banc.getState().jetRegler('incantation', 'formeConjuree', offerte);
    expect(banc.getState().pendingCast!.conjureForm?.weapon).toBe(offerte);
  });

  it('un Sort n’a pas de ton de Prière : le ton discret refusé, comme la fenêtre le dit (LDB 40 l.42)', () => {
    const { banc } = horsCombat(FIXTURES.sansDegats.id, null);
    expect(fenetreDIncantation(banc.getState())!.ton).toBeNull();
    expect(refusDuReglage(banc.getState(), 'discret')).toBeTruthy();
    banc.getState().jetRegler('incantation', 'discret', true);
    expect(banc.getState().pendingCast!.discreet).toBeUndefined();
  });
});

/** Le combat de l'épreuve (`enc-mutants`) : le héros `H` et l'ennemi lanceur `E`, en Langue (Magick). */
function enCombat(banc: Banc) {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'H', careerTalent: { id: 'magie-mineure' }, seed: 707 });
  h.spells = ['explosion', 'carreau'];
  banc.setState({ party: [h] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const [E, ...autres] = b.combatants.filter((c) => c.kind === 'ennemi');
  autres.forEach((e) => (e.dead = true));
  H.skills = [...H.skills.filter((s) => s.id !== 'langue'), { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 }] as typeof H.skills;
  H.characteristics['force-mentale'] = 40;
  H.wounds = blessuresDeBase(99, 99, H);
  E.characteristics.intelligence = 48; E.characteristics['force-mentale'] = 53;
  E.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 40 }];
  E.spells = [FIXTURES.degats.id, FIXTURES.sansDegats.id];
  H.pos = { x: 2, y: 2 }; E.pos = { x: 4, y: 2 };
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), acted: false }, pendingCast: null, pendingCounterspell: null, pendingCascade: null });
  return { H: banc.getState().battle!.combatants.find((c) => c.id === H.id)!, E: banc.getState().battle!.combatants.find((c) => c.id === E.id)! };
}

describe('pose de la Zone d’Effet : refusée sur un Sort qui ne part pas, la partie continue (LDB 47 l.15, l.28)', () => {
  it('Explosion ratée : la pose de la zone (`incantation.carte`) refusée, la fenêtre reste ouverte et s’applique', () => {
    const banc = ouvrirLeBanc({ desFixes: true });
    const { H } = enCombat(banc);
    banc.setState({ battle: { ...banc.getState().battle!, action: 'incantation', selectedSpellId: 'explosion' } });
    banc.getState().cliquerLaCase({ x: 9, y: 9 });
    expect(banc.getState().pendingCast, 'chemin : la zone s’ouvre sans centre').toMatchObject({ casterId: H.id, zone: { center: null } });
    banc.getState().jetLancer('incantation');
    banc.getState().jetImposerLeResultat('incantation', 99);
    expect(banc.getState().pendingCast!.result!.cast).toBe(false);
    expect(fenetreDIncantation(banc.getState())!.pose!.refus).toBe(refusDeLaPose(banc.getState(), true));
    expect(refusDeLaPose(banc.getState(), true)).toBeTruthy();
    banc.getState().jetRegler('incantation', 'carte', 'zone');
    expect(banc.getState().pendingCast!.zone!.placing, 'la fenêtre ne s’efface pas').toBeFalsy();
    banc.getState().jetValider('incantation');
    expect(banc.getState().pendingCast, 'l’incantation ratée se clôt : rien ne bloque').toBeNull();
  });
});

describe('lanceur ennemi au siège MJ : il surincante et annule comme un héros, jugé par la possession (Q3)', () => {
  it('annuler avant le jet, puis surincanter le jet lancé', () => {
    const banc = ouvrirLeBanc({ desFixes: true });
    const { H, E } = enCombat(banc);
    banc.setState({ net: { ...banc.getState().net, gmSeat: 0 } });
    const ouvrir = () => banc.setState({ pendingCast: { casterId: E.id, targetId: H.id, spellId: FIXTURES.sansDegats.id, missile: false, focused: false, result: null } });
    ouvrir();
    expect(fenetreDIncantation(banc.getState())!.annulation).toBeNull();
    banc.getState().jetAnnuler('incantation');
    expect(banc.getState().pendingCast, 'l’ennemi du MJ renonce').toBeNull();
    ouvrir();
    banc.getState().jetLancer('incantation');
    banc.getState().jetImposerLeResultat('incantation', 3);
    const sur = fenetreDIncantation(banc.getState())!.surincantation!;
    expect(sur.axes.find((a) => a.axe === 'duration')!.refusDAllouer).toBeNull();
    banc.getState().jetRegler('incantation', 'surincantationDuree', 1);
    expect(banc.getState().pendingCast!.overcast?.duration).toBe(1);
  });

  for (const gmSeat of [0, undefined]) {
    it(`contrat, siège MJ ${gmSeat ?? 'absent'} : pour chaque axe, refus annoncé ⇔ pas refusé`, () => {
      const banc = ouvrirLeBanc({ desFixes: true });
      const { H, E } = enCombat(banc);
      banc.setState({ net: { ...banc.getState().net, gmSeat: 0 } });
      banc.setState({ pendingCast: { casterId: E.id, targetId: H.id, spellId: FIXTURES.sansDegats.id, missile: false, focused: false, result: null } });
      banc.getState().jetLancer('incantation');
      banc.getState().jetImposerLeResultat('incantation', 3);
      banc.setState({ net: { ...banc.getState().net, gmSeat } });
      expect(refusDuPasDeSurincantation(banc.getState(), 'duration', 1) === null, 'le pas de Durée revient au seul siège qui pilote le lanceur').toBe(gmSeat === 0);
      for (const axe of ['range', 'duration', 'targets'] as const) {
        const avant = banc.getState().pendingCast!.overcast?.[axe] ?? 0;
        const refus = refusDuPasDeSurincantation(banc.getState(), axe, avant + 1);
        banc.getState().jetRegler('incantation', REGLAGE_DE_L_AXE[axe], avant + 1);
        expect((banc.getState().pendingCast!.overcast?.[axe] ?? 0) > avant, axe).toBe(refus === null);
      }
    });
  }
});

describe('le lanceur que conduit le moteur écrit sa politique au jet ; le lanceur humain non (B7)', () => {
  it('ennemi sans siège MJ, Sort à Dégâts : Incantation Critique écrite au jet (`defaultCritChoice`)', () => {
    const banc = ouvrirLeBanc();
    const { H, E } = enCombat(banc);
    let res: NonNullable<Jeu['pendingCast']> | null = null;
    // Recherche BORNÉE et déterministe d'un jet d'IA critique : le sujet est l'écriture du choix.
    for (let seed = 1; seed <= 200 && !res; seed++) {
      banc.getState().ensemencerLeTirage(seed);
      banc.setState({ pendingCast: null, pendingCascade: null, pendingCounterspell: null });
      castSpell(banc.getState, banc.setState, E, H, FIXTURES.degats.id);
      const pc = banc.getState().pendingCast;
      if (pc?.result?.isCritical) res = pc;
    }
    expect(res, 'la fenêtre de graines produit une Incantation Critique de l’IA').toBeTruthy();
    expect(res!.critChoice).toBe(defaultCritChoice(res!.result!, sortInfligeDesDegats(FIXTURES.degats)));
  });
});

describe('le NI d’un Sort se lit à un seul site, `castingNumberOf` (B3)', () => {
  it('Rituel au NI réduit : l’effet durable porte le NI que le lanceur a vaincu, celui que la Dissipation visera (VDM 02 l.398 ; LDB 46 l.158)', () => {
    const banc = ouvrirLeBanc({ desFixes: true });
    const L = lanceur('L');
    L.talents = [...L.talents.filter((t) => t.talentId !== 'magie-des-arcanes'), { talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }];
    L.spells = [FIXTURES.rituel.id];
    banc.setState({ battle: null, party: [L] });
    banc.getState().incanterLeSort(L.id, FIXTURES.rituel.id, L.id);
    banc.getState().jetLancer('incantation');
    banc.getState().jetImposerLeResultat('incantation', 3);
    expect(banc.getState().pendingCast!.result, 'chemin : le Rituel part au NI réduit').toMatchObject({ cast: true, niRequired: 4 });
    banc.getState().jetValider('incantation');
    banc.reprendreTout();
    const porteur = banc.getState().party.find((c) => c.id === L.id)!;
    const effet = (porteur.activeEffects ?? []).find((e) => e.spell?.spellId === FIXTURES.rituel.id);
    expect(effet?.spell?.ni).toBe(castingNumberOf(FIXTURES.rituel, false, {}, [], porteur));
  });
});

describe('la valeur du Contre-sort se lit à un seul site, `counterspellValue` (LDB 46 l.156 ; LDB 17 l.68)', () => {
  it('voie Résilience : la cible du jet forcé est la valeur que lisent le jet et la fenêtre', () => {
    const banc = ouvrirLeBanc();
    const { H, E } = enCombat(banc);
    H.resilience = 1;
    banc.setState({
      pendingCast: { casterId: E.id, targetId: H.id, spellId: FIXTURES.sansDegats.id, missile: false, focused: false,
        result: { cast: true, roll: 30, target: 60, sl: 3, isCritical: false, isFumble: false, log: 'x', niRequired: 0 } },
      pendingCounterspell: { participants: [{ id: H.id, interactive: true, declared: 'solo', result: null }] },
    } as unknown as Partial<Jeu>);
    banc.getState().jetForcerLaReussite('contreSort', H.id);
    const part = banc.getState().pendingCounterspell!.participants[0];
    expect(part.result?.counter.target).toBe(counterspellValue(banc.getState().battle!.combatants.find((c) => c.id === H.id)!));
  });
});


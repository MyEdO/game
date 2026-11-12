import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Jeu } from './etat';
import { castSpell, routeCounterspell, counterspellCandidates, isDispellableCast, withPreRollFixedDie } from './combatFlow';
import { FLOWS } from './rollFlowSpecs';
import { effectivelyHostile } from '../engine/relations';
import type { SpellLike } from '../engine/magic';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { reluDans } from './combatDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #1029 / #1031 / #1040 — Contre-sort (`LDB 46 l.156`) :
 *  - MOMENT : « vous pouvez opposer le Test d'Incantation » — la fenêtre naît du JET ; quand le
 *    lanceur doit encore trancher son Incantation Critique, elle attend ce choix (`l.32`) ;
 *  - VERROUS : seuls la Prière et « Force inéluctable » avec DR suffisant (`l.32`) ferment la
 *    dissipation — « Puissance totale » (`l.31`) est explicitement dissipable ;
 *  - HOSTILITÉ : on ne contre que le Sort d'un lanceur actuellement hostile (cf. `effectivelyHostile`,
 *    `engine/relations.ts`) ;
 *  - PLUSIEURS contre-lanceurs par incantation, chacun consommant SON essai du Round (#1040, site
 *    canonique `jetValider('contreSort')`, `combatSlice.ts`) ;
 *  - #1031 : après le jet, renoncer à l'incantation est REFUSÉ (`LDB 46 l.24`, verrou de
 *    `jetAnnuler('incantation')`, `combatSlice.ts`) — aucun Contre-sort orphelin.
 */

const CRIT = { roll: 11, target: 60, sl: 1, isCritical: true, isFumble: false, log: 'x' };

function setup() {
  const mk = (label: string, seed: number) => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label, careerTalent: { id: 'magie-mineure' }, seed });
    h.spells = ['flechette'];
    return h;
  };
  banc.setState({ party: [mk('W1', 707), mk('W2', 101)] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  const b = banc.getState().battle!;
  const heroes = b.combatants.filter((c) => c.kind === 'heros');
  const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
  enemies.slice(2).forEach((e) => (e.dead = true));
  const [E, E2] = enemies;
  for (const e of [E, E2]) {
    if (!e) continue;
    e.characteristics.intelligence = 48; e.characteristics['force-mentale'] = 53;
    e.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
    e.spells = ['carreau'];
  }
  heroes.forEach((h, i) => { h.pos = { x: 10, y: 10 + i }; h.wounds = blessuresDeBase(99, 99, h); });
  E.pos = { x: 12, y: 10 };
  if (E2) E2.pos = { x: 12, y: 11 };
  banc.setState({ battle: { ...b }, pendingCast: null, pendingCounterspell: null, pendingCascade: null });
  return { heroes: (heroes as Combatant[]).map((c) => reluDans(banc.getState, c)), E: reluDans(banc.getState, E), E2: reluDans(banc.getState, E2) };
}

/** Incantation FIGÉE de `caster` sur `target` (aucun aléa : le sujet est l'aiguillage). */
function freeze(caster: Combatant, target: Combatant, result: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  banc.setState({
    pendingCounterspell: null,
    pendingCast: {
      casterId: caster.id, targetId: target.id, spellId: 'carreau', missile: true, focused: false,
      result, ...extra,
    },
  } as unknown as Partial<Jeu>);
}

describe('#1029/#1040 — le Contre-sort au RAW : moment, verrous, hostilité, N contre-lanceurs', () => {
  it('« Puissance totale » (LDB 46 l.31) est DISSIPABLE : la fenêtre s’ouvre malgré un DR insuffisant', () => {
    const { heroes, E } = setup();
    freeze(E, heroes[0], { ...CRIT, cast: false, missile: false }, { missile: false, critChoice: 'puissance' });
    expect(routeCounterspell(banc.getState, banc.setState)).toBe(true);
    expect(banc.getState().pendingCounterspell!.participants.map((p) => p.id)).toContain(heroes[0].id);
  });

  it('« Force inéluctable » (LDB 46 l.32) avec DR suffisant : AUCUNE fenêtre, aucun jet de Dissipation', () => {
    const { heroes, E } = setup();
    freeze(E, heroes[0], { ...CRIT, cast: true }, { missile: false, critChoice: 'ineluctable' });
    expect(routeCounterspell(banc.getState, banc.setState)).toBe(false);
    expect(banc.getState().pendingCounterspell).toBeNull();
    expect(banc.getState().pendingCast!.result!.log, 'aucun Contre-sort inline non plus').toBe('x');
    expect(heroes[0].dispelledThisRound).toBeFalsy();
    // Le MÊME choix sans le DR (« si vous obtenez suffisamment de DR ») ne verrouille rien.
    const SORT = { label: 'Carreau', ecole: 'Sort', family: 'arcane', cn: 4, duration: null, desc: '' } as SpellLike;
    freeze(E, heroes[0], { ...CRIT, cast: false }, { missile: false, critChoice: 'ineluctable' });
    expect(isDispellableCast(banc.getState().pendingCast!, SORT)).toBe(true);
    // Et SANS choix enregistré, rien n'est « inéluctable » : LDB 46 l.28 — sans choix, l'effet est le
    // lancer sur les Imparfaites Mineures, PAS un des trois. La garde ne lit QUE `pc.critChoice`.
    freeze(E, heroes[0], { ...CRIT, cast: true }, { missile: false });
    expect(isDispellableCast(banc.getState().pendingCast!, SORT),
      'un Critique non tranché n’est pas une Force inéluctable implicite').toBe(true);
  });

  it('« Incantation Critique » (LDB 46 l.30) reste dissipable : la fenêtre s’ouvre', () => {
    const { heroes, E } = setup();
    freeze(E, heroes[0], { ...CRIT, cast: true }, { critChoice: 'critique' });
    expect(routeCounterspell(banc.getState, banc.setState)).toBe(true);
    expect(banc.getState().pendingCounterspell).toBeTruthy();
  });

  it('MOMENT : lanceur SURFACÉ à Critique — rien au jet, la fenêtre suit le choix d’effet (jetValider@incantation)', () => {
    banc.getState().ensemencerLeTirage(9);
    const { heroes, E } = setup();
    const [H] = heroes;
    freeze(H, E, { ...CRIT, cast: true }); // le héros manuel tient sa modale : le choix de Critique est DÛ
    expect(routeCounterspell(banc.getState, banc.setState), 'la Dissipation attend le choix').toBe(false);
    expect(banc.getState().pendingCounterspell).toBeNull();
    expect(banc.getState().pendingCast!.counterspellRouted, 'le moment n’est pas consommé').toBeFalsy();
    expect(banc.getState().pendingCast!.result!.log, 'aucune Dissipation avant le choix').toBe('x');
    expect(E.dispelledThisRound).toBeFalsy();
    // AUCUN clic : « Appliquer » n'applique RIEN (LDB 46 l.28 — sans choix, l'effet retenu n'est aucun
    // des trois) ; la situation reste ouverte au lieu d'avancer sur un défaut lu en douce.
    banc.getState().jetValider('incantation');
    expect(banc.getState().pendingCast, 'l’incantation attend le choix').toBeTruthy();
    expect(banc.getState().pendingCast!.critChoice).toBeUndefined();
    expect(E.dispelledThisRound, 'aucune Dissipation tant que le choix n’est pas écrit').toBeFalsy();
    banc.getState().jetRegler('incantation', 'effetCritique', 'puissance'); // choix tranché → dissipable (l.31)
    banc.getState().jetValider('incantation');
    // Contre-lanceur ENNEMI sans siège MJ : pas de fenêtre, c'est le chant INLINE — mais il a bien
    // lieu, et APRÈS le choix : le moment du Contre-sort suit la résolution du Critique.
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dispelledThisRound,
      'la Dissipation s’est jouée une fois le choix d’effet tranché').toBe(true);
    expect(banc.getState().battle!.log.some((e) => e.text.includes('Contre-sort de'))).toBe(true);
  });

  it('HOSTILITÉ (arbitrage 2026-08-03) : un ennemi ne contre pas le Sort d’un ennemi ; le héros, si', () => {
    const { heroes, E, E2 } = setup();
    expect(E2, 'la rencontre fournit un second ennemi').toBeTruthy();
    expect(effectivelyHostile(E2, E)).toBe(false);
    expect(effectivelyHostile(heroes[0], E)).toBe(true);
    const ids = counterspellCandidates(banc.getState().battle, banc.getState().scene, E, heroes[0]).map((c) => c.id);
    expect(ids, 'un lanceur du même camp que le lanceur n’est pas candidat').not.toContain(E2.id);
    expect(ids).toContain(heroes[0].id);
  });

  it('PLUSIEURS candidats : la fenêtre naît vierge, la PHASE 1 verrouille les dés, puis chaque déclaré chante', () => {
    banc.getState().ensemencerLeTirage(9);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    castSpell(banc.getState, banc.setState, E, h1, 'carreau'); // lanceur IA : jet figé + aiguillage
    const pcs = banc.getState().pendingCounterspell!;
    expect(pcs.participants.map((p) => p.id)).toEqual(expect.arrayContaining([h1.id, h2.id]));
    expect(pcs.participants.every((p) => !p.result), 'personne ne roule d’office').toBe(true);
    const laisserPasser = () => FLOWS.contreSort.fermetures(banc.getState).annuler;
    expect(laisserPasser(), 'phase 1 : « Laisser passer » attend les déclarations').toBe('declarationsDues');
    const cur = () => banc.getState().battle!.combatants;
    // PHASE 1 (#1042/#1059) : la composition se règle AVANT les dés — un jet lancé ici ne part pas.
    banc.getState().jetLancer('contreSort', h1.id);
    expect(banc.getState().pendingCounterspell!.participants.every((p) => !p.result), 'aucun dé tant que la fenêtre n’a pas déclaré').toBe(true);
    expect(cur().find((c) => c.id === h1.id)!.dispelledThisRound, 'le verrou de phase ne brûle rien').toBeFalsy();
    banc.getState().jetRegler('contreSort', 'declaration', 'solo', h1.id);
    banc.getState().jetRegler('contreSort', 'declaration', 'passer', h2.id);
    banc.getState().jetLancer('contreSort', h1.id);
    expect(laisserPasser(), 'phase 2 : le déclaré chante, « Laisser passer » se ferme').toBe('jetLance');
    expect(cur().find((c) => c.id === h1.id)!.dispelledThisRound, 'l’essai du chanteur est consommé').toBe(true);
    expect(cur().find((c) => c.id === h2.id)!.dispelledThisRound, 'celui qui a passé garde le sien').toBeFalsy();
  });

  it('AGRÉGATION (#1040) : une rangée gagnante d’un AUTRE que le premier chanteur dissipe', () => {
    const { heroes, E, E2 } = setup();
    const [h1] = heroes;
    // Lanceur SURFACÉ (héros) : sa modale tient encore l'incantation après la fenêtre — l'issue de la
    // Dissipation y revient, mesurable telle quelle.
    freeze(h1, E, { cast: true, roll: 30, target: 60, sl: 5, isCritical: false, isFumble: false, log: 'x' });
    const rate = { dispelled: false, counter: { roll: 90, target: 40, sl: -3, success: false, isDouble: false }, casterNetSL: 8, log: 'raté' };
    const gagne = { dispelled: true, counter: { roll: 5, target: 40, sl: 4, success: true, isDouble: false }, casterNetSL: 1, log: 'DISSIPÉ' };
    banc.setState({ pendingCounterspell: { participants: [
      { id: E.id, interactive: true, declared: 'solo', result: rate },
      { id: E2.id, interactive: true, declared: 'solo', result: gagne },
    ] } } as unknown as Partial<Jeu>);
    banc.getState().jetValider('contreSort');
    const res = banc.getState().pendingCast!.result!;
    expect(res.dispelled, 'un succès quelconque dissipe (LDB 46 l.156)').toBe(true);
    expect(res.log).toContain('DISSIPÉ');
  });

  it('« Laisser passer » APRÈS un chant GAGNANT est INERTE : le Sort dissipé ne se résout pas quand même', () => {
    const { heroes, E } = setup();
    const [h1] = heroes;
    freeze(h1, E, { cast: true, roll: 30, target: 60, sl: 5, isCritical: false, isFumble: false, log: 'x' });
    const gagne = { dispelled: true, counter: { roll: 5, target: 40, sl: 4, success: true, isDouble: false }, casterNetSL: 1, log: 'Contre-sort : le Sort est DISSIPÉ.' };
    banc.setState({ pendingCounterspell: { participants: [{ id: E.id, interactive: true, declared: 'solo', result: gagne }] } } as unknown as Partial<Jeu>);
    banc.getState().jetAnnuler('contreSort'); // clic tardif : décliner n'existe plus, un chant a eu lieu
    expect(banc.getState().pendingCounterspell, 'la fenêtre reste — l’issue chantée doit s’appliquer').toBeTruthy();
    banc.getState().jetValider('contreSort');
    expect(banc.getState().pendingCast!.result!.dispelled, 'le Contre-sort gagnant n’est pas jeté à la poubelle').toBe(true);
  });

  it('lanceur CONDUIT PAR LE MOTEUR + Critique : son choix d’effet est ÉCRIT dans `pc.critChoice`', () => {
    const { heroes, E } = setup();
    const [h1] = heroes;
    let critique = false;
    let ecrit: string | undefined;
    // Recherche BORNÉE et déterministe d'un jet d'IA critique (double réussi) : le sujet est l'ÉCRITURE
    // du choix, pas la probabilité du Critique.
    for (let seed = 1; seed <= 60 && !critique; seed++) {
      banc.getState().ensemencerLeTirage(seed);
      banc.setState({ pendingCast: null, pendingCascade: null, pendingCounterspell: null });
      for (const c of banc.getState().battle!.combatants) c.dispelledThisRound = undefined;
      castSpell(banc.getState, banc.setState, E, h1, 'carreau'); // lanceur IA : jet figé + aiguillage
      const pc = banc.getState().pendingCast;
      if (pc?.result?.isCritical) { critique = true; ecrit = pc.critChoice; }
    }
    expect(critique, 'la fenêtre de seeds produit bien une Incantation Critique de l’IA').toBe(true);
    expect(ecrit, 'l’IA a ÉCRIT son choix au jet (plus de défaut lu en douce par les gardes)').toBeTruthy();
  });

  /** Le geste « Fixer le dé » AVANT le jet, tel que le socle #939 le pose : jet naturel PUIS
   *  substitution, encadrés en UN geste atomique (`withPreRollFixedDie`). */
  const preArmer = (de: number) => withPreRollFixedDie(
    banc.getState, banc.setState,
    () => banc.getState().jetLancer('incantation'),
    () => banc.getState().jetImposerLeResultat('incantation', de),
  );

  it('dé PRÉ-ARMÉ double (repro recette #1029) : aucune fenêtre avant le choix d’effet, puis fenêtre sur le VRAI résultat', () => {
    banc.getState().ensemencerLeTirage(4);
    const { heroes, E } = setup();
    const [H] = heroes;
    H.characteristics.intelligence = 99; // le dé 33 PASSE et fait un double (Critique) ; 99 serait un échec (LDB 12 l.25-28)
    castSpell(banc.getState, banc.setState, H, E, 'flechette');
    preArmer(33);
    const pc = banc.getState().pendingCast!;
    expect(pc.result!.roll, 'le jet retenu est la valeur SAISIE, pas le naturel').toBe(33);
    expect(pc.result!.isCritical, 'un double saisi EST un Critique').toBe(true);
    expect(banc.getState().pendingCounterspell, 'aucune Dissipation actée sur un résultat périmé').toBeNull();
    expect(E.dispelledThisRound, 'aucun chant inline sur le jet naturel').toBeFalsy();
    expect(pc.counterspellRouted, 'le moment reste DÛ : le choix d’effet décide de la dissipabilité').toBeFalsy();
    // Choix tranché → l'aiguilleur s'exécute sur le résultat FINAL.
    banc.getState().jetRegler('incantation', 'effetCritique', 'puissance');
    banc.getState().jetValider('incantation');
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dispelledThisRound,
      'la Dissipation se joue une fois le Critique tranché').toBe(true);
  });

  it('dé PRÉ-ARMÉ non-double : la Dissipation part AU jet, sur la valeur armée', () => {
    banc.getState().ensemencerLeTirage(4);
    const { heroes, E } = setup();
    const [H] = heroes;
    H.characteristics.intelligence = 99;
    castSpell(banc.getState, banc.setState, H, E, 'flechette');
    preArmer(23); // réussite, non-double
    const pc = banc.getState().pendingCast!;
    expect(pc.result!.roll).toBe(23);
    expect(pc.result!.isCritical).toBe(false);
    expect(pc.counterspellRouted, 'le moment du Contre-sort a bien eu lieu AU jet').toBe(true);
    expect(E.dispelledThisRound, 'le contre-lanceur IA a chanté sur le résultat FINAL').toBe(true);
  });

  it('Résilience PRÉ-JET : même contrat atomique (aucune Dissipation sur le jet naturel)', () => {
    banc.getState().ensemencerLeTirage(4);
    const { heroes, E } = setup();
    const [H] = heroes;
    H.characteristics.intelligence = 99;
    H.resilience = 1;
    castSpell(banc.getState, banc.setState, H, E, 'flechette');
    banc.getState().jetForcerLaReussite('incantation'); // avant le jet : le geste lance puis force (`auJetDu`)
    const pc = banc.getState().pendingCast!;
    expect(pc.forcee, 'la réussite est achetée par la Résilience').toBe(true);
    // L'aiguillage a vu le résultat FINAL : soit il a routé (non-critique), soit il attend le choix
    // d'effet (Critique) — jamais une Dissipation jouée sur le jet naturel intermédiaire.
    expect(pc.result!.isCritical ? !pc.counterspellRouted : pc.counterspellRouted).toBe(true);
  });

  it('« Laisser passer » : aucun surfacé n’a tenté → le meilleur contre-lanceur IA de la fenêtre chante', () => {
    banc.getState().ensemencerLeTirage(5);
    const { heroes, E } = setup();
    const [h1] = heroes;
    freeze(h1, E, { cast: true, roll: 30, target: 60, sl: 3, isCritical: false, isFumble: false, log: 'Sort lancé' });
    banc.setState({ pendingCounterspell: { participants: [
      { id: heroes[1].id, interactive: true, declared: 'solo', result: null },
      { id: E.id, interactive: false, declared: 'solo', result: null },
    ] } } as unknown as Partial<Jeu>);
    // Phase de déclaration CLOSE (#1042/#1059) : « Laisser passer » n'existe qu'ensuite.
    banc.getState().jetAnnuler('contreSort');
    expect(banc.getState().pendingCounterspell).toBeNull();
    expect(banc.getState().pendingCast!.result!.log, 'l’IA a chanté à leur place').toContain('Contre-sort de');
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.dispelledThisRound).toBe(true);
  });
});

describe('#1031 — renoncer à une incantation LANCÉE est refusé (plus de Contre-sort orphelin)', () => {
  it('POST-JET (chemin d’un intent réseau) : jetAnnuler@incantation est inerte, le journal le dit, la fenêtre reste liée', () => {
    const { heroes, E } = setup();
    const [H] = heroes;
    freeze(H, E, { cast: true, roll: 30, target: 60, sl: 3, isCritical: false, isFumble: false, log: 'Sort lancé' });
    banc.setState({ pendingCounterspell: { participants: [{ id: E.id, interactive: true, result: null }] } } as unknown as Partial<Jeu>);
    banc.getState().jetAnnuler('incantation');
    expect(banc.getState().pendingCast, 'l’incantation lancée reste en place').toBeTruthy();
    expect(banc.getState().pendingCounterspell, 'la fenêtre garde son incantation (jamais orpheline)').toBeTruthy();
    expect(banc.getState().refus?.texte, 'le refus est DIT au joueur, jamais silencieux').toBe(t('cs.castCancelLocked', { name: H.label }));
  });

  it('PRÉ-JET : jetAnnuler@incantation passe et purge toute fenêtre de Contre-sort liée', () => {
    const { heroes, E } = setup();
    const [H] = heroes;
    castSpell(banc.getState, banc.setState, H, E, 'flechette'); // pas de jet : pendingCast.result null
    banc.setState({ pendingCounterspell: { participants: [{ id: E.id, interactive: true, result: null }] } } as unknown as Partial<Jeu>);
    banc.getState().jetAnnuler('incantation');
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().pendingCounterspell, 'rien ne survit à l’incantation qu’elle oppose').toBeNull();
  });
});

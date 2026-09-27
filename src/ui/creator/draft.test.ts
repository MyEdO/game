import { describe, it, expect } from 'vitest';
import {
  newDraft,
  skillsSubMessage,
  withSpecies,
  withCareer,
  rollDraftSpecies,
  rollDraftCareer,
  rollDraftChars,
  rollDraftTalents,
  speciesXp,
  careerXp,
  charsXp,
  xpTotal,
  charRolls,
  draftChars,
  resolvedSpeciesTalents,
  speciesTalentRandomCount,
  speciesTalentRandomDrawn,
  talentsDone,
  careerSkillEntries,
  careerAdvTotal,
  evenCareerSkillAdvances,
  validateStep,
  stepIds,
  starXp,
  rollDraftStar,
  rollDraftAstrology,
  buildHero,
  draftWealth,
  draftSpecies,
  draftLevel,
  careerCharKeys,
  coastalSwapAvailable,
  careerRollPool,
  withCoastalSwap,
  speciesTalentChoiceEntries,
  trappingSlotResolved,
} from './draft';
import { CHAR_KEYS } from '../../engine/types';
import { rigSpeciesId, trappingRefLabel, type TrappingRef } from '../../data';
import { pettySpellQuota, probeHero, type CreatorDraft } from './draft';
import { adresseDeCreation, speciesSkillDefaults, designer } from '../../engine/character';
import type { RefDesignee } from '../../data/schemas/grammaire/ref';
import { careerSkillAdditions } from '../../engine/talentEffects';
import { spells, stars, celestialHouses, species as allSpecies, careersForSpecies } from '../../data';

// Page blanche : `newDraft` ne pré-tire plus race/carrière — les tests posent explicitement les
// mêmes défauts dérivés qu'avant (1ʳᵉ espèce du LDB, sa 1ʳᵉ carrière accessible).
const DEFAULT_SPECIES = allSpecies.find((s) => s.source.book === 'livre-de-base')!;
const DEFAULT_CAREER = careersForSpecies(DEFAULT_SPECIES.refCareer)[0]!;
const draft = () => withCareer(withSpecies(newDraft(1234), DEFAULT_SPECIES.id), DEFAULT_CAREER.id);

/** Spécialisation par défaut des jokers de carrière (1re du pool LIBRE) + répartition par défaut des
 *  40 Augmentations (`evenCareerSkillAdvances`). */
function carrierePrete(d: CreatorDraft): Pick<CreatorDraft, 'specChoices' | 'skillAdvances'> {
  let specChoices: Record<string, string> = {};
  for (const { adresse, ref } of careerSkillEntries(d)) {
    if (ref.choix == null) continue;
    const c = careerSkillEntries({ ...d, specChoices }).find((e) => e.adresse === adresse)!;
    specChoices = { ...specChoices, [adresse]: designer('skill', c.ref, undefined, c.libre).spec! };
  }
  return { specChoices, skillAdvances: evenCareerSkillAdvances({ ...d, specChoices }) };
}

/** Brouillon minimal VALIDE jusqu'à l'étape 4 (répartitions par défaut, specs résolues). */
function readyDraft() {
  const d = draft();
  const sp = draftSpecies(d)!;
  const level = draftLevel(d)!;
  // Résolution des entrées « (Au choix) » / « (A ou B) » qui reçoivent des augmentations
  // de la carrière par défaut.
  return {
    ...d,
    charsRolled: true, // gestes « Tirer aux dés » posés (#393 agentivité : exigés par la validation)
    talentsRolled: true,
    charAdvancesAlloc: { [level.characteristics[0]]: 5 }, // une Caractéristique du Niveau 1 de la carrière
    fateSplit: { fate: Math.ceil(sp.fate.extra / 2), resilience: Math.floor(sp.fate.extra / 2) },
    speciesPlus5: speciesSkillDefaults(sp).plus5,
    speciesPlus3: speciesSkillDefaults(sp).plus3,
    ...carrierePrete(d),
    speciesTalentChoices: { 'espece:talents:0': 1 },
    careerTalent: 'id' in level.talents[0] ? designer('talent', level.talents[0]) : undefined, // un Talent du Niveau 1 de la carrière (LDB 05 l.535)
    label: 'Testeur',
  };
}

describe('B3 — Répartition simple des Compétences de carrière (étape 5)', () => {
  it('produit des clés de Compétence totalisant 40, lues par la grille/validation', () => {
    const d = draft(); // 8 Compétences de Niveau 1 (LDB 05 l.535)
    const alloc = evenCareerSkillAdvances(d);
    // Toutes les clés sont des Compétences RECONNUES de la grille (careerSkillEntries).
    expect(Object.keys(alloc).every((k) => careerSkillEntries(d).some((c) => c.cle === k))).toBe(true);
    // +5 × 8 Compétences = 40, compté par careerAdvTotal (la grille ET validateStep).
    expect(careerAdvTotal({ ...d, skillAdvances: alloc })).toBe(40);
  });
  it('n\'est PAS effacée par la répartition des Compétences de race (champs disjoints)', () => {
    const d = draft();
    const sp = draftSpecies(d)!;
    // Carrière remplie, PUIS répartition de race appliquée (le symptôme rapporté).
    const after = {
      ...d,
      skillAdvances: evenCareerSkillAdvances(d),
      speciesPlus5: speciesSkillDefaults(sp).plus5,
      speciesPlus3: speciesSkillDefaults(sp).plus3,
    };
    expect(careerAdvTotal(after)).toBe(40); // la carrière RESTE à 40
  });
});

describe('aléatoire FIGÉ (anti-savescum)', () => {
  it('les dix jets 2d10 sont identiques à chaque lecture ; une relance change le lot', () => {
    const d = draft();
    expect(charRolls(d)).toEqual(charRolls(d));
    const rerolled = { ...d, charRerolls: 1 };
    expect(charRolls(rerolled)).not.toEqual(charRolls(d));
    expect(charRolls(rerolled)).toEqual(charRolls(rerolled));
  });
  it('le tirage d\'espèce est unique et ne se relance pas', () => {
    const d1 = rollDraftSpecies(draft());
    expect(d1.speciesRoll).toBeTruthy();
    expect(rollDraftSpecies(d1)).toBe(d1); // déjà tiré → no-op
  });
  it('les talents d\'espèce aléatoires sont identiques à chaque résolution (seed fixe)', () => {
    const d = rollDraftTalents(draft()); // geste 5c posé — Reiklander : « 3 Talent aléatoire »
    expect(resolvedSpeciesTalents(d)).toEqual(resolvedSpeciesTalents(d));
    // Changer un choix « A ou B » ne re-tire pas les dés des aléatoires.
    const d2 = { ...d, speciesTalentChoices: { 'espece:talents:0': 1 } };
    const randoms = (x: RefDesignee[]) => x.filter((t) => !['perspicace', 'affable', 'destinee'].includes(t.id));
    expect(randoms(resolvedSpeciesTalents(d2))).toEqual(randoms(resolvedSpeciesTalents(d)));
  });
});

describe('agentivité (#393, amendement « ossature enforcée ») — aucun résultat aléatoire avant le GESTE', () => {
  it('caractéristiques : base d\'espèce seule avant le geste, jets révélés après — geste idempotent', () => {
    const d = draft();
    const sp = draftSpecies(d)!;
    for (const k of CHAR_KEYS) expect(draftChars(d)[k]).toBe(sp.baseChar[k] ?? 20); // aucun 2d10 pré-affiché
    const rolled = rollDraftChars(d);
    expect(rolled.charsRolled).toBe(true);
    expect(rollDraftChars(rolled)).toBe(rolled); // déjà tiré → no-op (les valeurs restent figées par le seed)
    const rolls = charRolls(rolled);
    CHAR_KEYS.forEach((k, i) => expect(draftChars(rolled)[k]).toBe((sp.baseChar[k] ?? 20) + rolls[i]));
  });
  it('validation étape 3 : le geste est EXIGÉ pour les voies aux dés, pas pour les 100 Points', () => {
    expect(validateStep(draft(), 'chars')).toBe('Tirez vos Caractéristiques aux dés.');
    expect(validateStep({ ...draft(), charMode: 'pointBuy' as const }, 'chars')).not.toMatch(/aux dés/);
  });
  it('talents aléatoires : AUCUN tiré avant le geste (ni liste ni résolution), révélés après — figés par le seed', () => {
    const d = draft(); // Reiklander : « 3 Talent aléatoire »
    expect(speciesTalentRandomCount(d)).toBe(3);
    expect(speciesTalentRandomDrawn(d)).toEqual([]); // rien à l'écran avant le geste
    const before = resolvedSpeciesTalents(d);
    const rolled = rollDraftTalents(d);
    const drawn = speciesTalentRandomDrawn(rolled);
    expect(drawn).toHaveLength(3);
    expect(resolvedSpeciesTalents(rolled)).toHaveLength(before.length + drawn.length);
    expect(speciesTalentRandomDrawn(rollDraftTalents(draft()))).toEqual(drawn); // découverte, jamais un re-tirage
  });
  it('validation 5c : le tirage des Talents aléatoires est exigé (validateStep + talentsDone)', () => {
    const untirés = { ...readyDraft(), talentsRolled: false };
    expect(validateStep(untirés, 'skills')).toBe('Tirez vos Talents aléatoires aux dés.');
    expect(talentsDone(untirés)).toBe(false);
    expect(validateStep(readyDraft(), 'skills')).toBeNull();
    expect(talentsDone(readyDraft())).toBe(true);
  });
  it('changer d\'espèce réinitialise le geste des Talents (la table de tirage appartient à l\'espèce)', () => {
    const rolled = rollDraftTalents(draft());
    const other = allSpecies.find((s) => s.id !== rolled.speciesId)!.id;
    expect(withSpecies(rolled, other).talentsRolled).toBe(false);
  });
});

describe('Riverains ⇄ Côtiers (MDG 09 l.9, #393 P2 correctif utilisateur)', () => {
  const swappableSpecies = allSpecies.find((s) => coastalSwapAvailable(withSpecies(newDraft(1), s.id)))!;
  const swappable = () => withSpecies(newDraft(1234), swappableSpecies.id);

  it('la table effective exclut Riverains XOR Côtiers selon la bascule — jamais les deux', () => {
    const off = careerRollPool({ ...swappable(), coastalSwap: false });
    expect(off.some((c) => c.class === 'cotiers')).toBe(false);
    expect(off.some((c) => c.class === 'riverains')).toBe(true);
    const on = careerRollPool({ ...swappable(), coastalSwap: true });
    expect(on.some((c) => c.class === 'riverains')).toBe(false);
    expect(on.some((c) => c.class === 'cotiers')).toBe(true);
  });

  it('anti-exploit : la bascule refuse de changer d\'état une fois un jet posé (relance gratuite bloquée)', () => {
    const rolled = rollDraftCareer(swappable());
    expect(rolled.careerRolls.length).toBeGreaterThan(0);
    const before = rolled.careerRolls;
    const attempted = withCoastalSwap(rolled, !rolled.coastalSwap);
    expect(attempted.coastalSwap).toBe(rolled.coastalSwap); // état INCHANGÉ
    expect(attempted.careerRolls).toBe(before); // jets INTACTS (pas de reset détourné)
  });

  it('la bascule fonctionne normalement tant qu\'aucun jet n\'existe', () => {
    const d = swappable();
    expect(d.careerRolls.length).toBe(0);
    const swapped = withCoastalSwap(d, !d.coastalSwap);
    expect(swapped.coastalSwap).toBe(!d.coastalSwap);
  });
});

describe('bonus de PX (LDB 04/05)', () => {
  it('espèce : +20 tant qu\'on choisit une espèce de la borne tirée, 0 sinon', () => {
    const d1 = rollDraftSpecies(draft());
    expect(speciesXp(d1)).toBe(20);
    // Une espèce HORS de la borne tirée perd le bonus (la borne d100 ne contient pas tout).
    const outside = ['nains', 'halflings', 'hauts-elfes'].find((id) => !d1.speciesRoll!.ids.includes(id))!;
    expect(speciesXp(withSpecies(d1, outside))).toBe(0);
  });
  it('carrière : +50 (1er jet), +25 (parmi 3), 0 (libre / relances)', () => {
    const d1 = rollDraftCareer(draft());
    expect(careerXp(d1)).toBe(50);
    // Une carrière hors des bornes tirées (refusée sans relancer) → choix libre, 0 PX.
    const rolledIds = new Set(d1.careerRolls.flatMap((r) => r.ids));
    const other = ['soldat', 'artisan', 'apothicaire'].find((id) => !rolledIds.has(id))!;
    expect(careerXp(withCareer(d1, other))).toBe(0);
    const d3 = rollDraftCareer(d1);
    expect(d3.careerRolls).toHaveLength(3);
    expect(careerXp(withCareer(d3, d3.careerRolls[2].ids[0]))).toBe(25);
    const dFree = rollDraftCareer(d3); // « continuez à relancer » (LDB 05 l.212)
    expect(careerXp(dFree)).toBe(0);
  });
  it('caractéristiques : +50 gardées, +25 réassignées, 0 après relance ou 100 Points — et 0 sans le GESTE', () => {
    expect(charsXp(draft())).toBe(0); // pas de bonus pour un tirage jamais lancé (#393 agentivité)
    const d = rollDraftChars(draft());
    expect(charsXp(d)).toBe(50);
    expect(charsXp({ ...d, charMode: 'reassigned' })).toBe(25);
    expect(charsXp({ ...d, charRerolls: 1 })).toBe(0);
    expect(charsXp({ ...d, charMode: 'pointBuy' })).toBe(0);
  });
});

describe('careerCharKeys (Augmentations de carrière)', () => {
  it('renvoie les Caractéristiques de carrière en clés CharKey (jamais vide pour une carrière réelle)', () => {
    const d = withCareer(draft(), 'soldat');
    const keys = careerCharKeys(d);
    expect(keys.length).toBeGreaterThan(0); // sinon la grille d'allocation est vide → étape infranchissable
    // La donnée EST déjà en abréviations : chaque clé doit être un CharKey valide (régression #566 :
    // un mapping libellé→clé renvoyait `undefined` pour tout → liste vide).
    for (const k of keys) expect(CHAR_KEYS).toContain(k);
    expect(keys).toContain('capacite-de-combat'); // Soldat : Capacité de Combat est de carrière
    expect(keys).toEqual(draftLevel(d)!.characteristics);
  });
});

describe('validation des étapes', () => {
  it('Caractéristiques : 5 Augmentations et split Destin/Résilience exigés', () => {
    const d = rollDraftChars(draft());
    expect(validateStep(d, 'chars')).toMatch(/5 Augmentations/);
    const ok = readyDraft();
    expect(validateStep(ok, 'chars')).toBeNull();
  });
  it('Caractéristiques : réassignation = permutation stricte des dix jets', () => {
    const d = { ...readyDraft(), charMode: 'reassigned' as const };
    expect(validateStep(d, 'chars')).toBeNull();
    const bad = { ...d, assignment: { ...d.assignment, 'capacite-de-combat': d.assignment['capacite-de-tir'] } };
    expect(validateStep(bad, 'chars')).toMatch(/une seule fois/);
  });
  it('Compétences : 40 augmentations, max 10, 3+3 compétences d\'espèce, talent choisi', () => {
    const d = readyDraft();
    expect(validateStep(d, 'skills')).toBeNull();
    expect(validateStep({ ...d, skillAdvances: {} }, 'skills')).toMatch(/40 Augmentations/);
    expect(validateStep({ ...d, speciesPlus5: [] }, 'skills')).toMatch(/3 Compétences/);
    expect(validateStep({ ...d, careerTalent: undefined }, 'skills')).toMatch(/Talent de carrière/);
  });
});

describe('buildHero — bout en bout', () => {
  it('héros conforme : PX bonus, Augmentations, libellés résolus, désignations posées', () => {
    let d = readyDraft();
    d = { ...d, age: 20, height: 175, eyes: 'Bleu', hair: 'Brun' };
    const hero = buildHero(d, 'h-test');
    expect(hero.xp).toBe(xpTotal(d));
    expect(Object.values(hero.charAdvances ?? {}).reduce((a, b) => a + (b ?? 0), 0)).toBe(5);
    for (const s of hero.skills) expect(`${s.spec ?? ''}`).not.toMatch(/au choix/i);
    expect(hero.details?.age).toBe(20);
    expect(hero.appearance?.species).toBe(rigSpeciesId(d.speciesId));
    // Le total des dix Caractéristiques = somme du brouillon (transferts +5 de talents possibles).
    const sum = CHAR_KEYS.reduce((a, k) => a + hero.characteristics[k], 0);
    const draftSum = CHAR_KEYS.reduce((a, k) => a + draftChars(d)[k], 0);
    expect(sum).toBeGreaterThanOrEqual(draftSum + 5); // + 5 Augmentations (+ éventuels +5 de talents)
  });
  it('la richesse initiale est figée et conforme au Statut', () => {
    const d = readyDraft();
    expect(draftWealth(d)).toEqual(draftWealth(d));
  });
  it('careerSkillEntries : les huit Compétences de départ du Niveau (LDB 05 l.535)', () => {
    const d = readyDraft();
    expect(careerSkillEntries(d).map((c) => c.adresse)).toEqual((draftLevel(d)?.skills ?? []).map((_, i) => adresseDeCreation.carriereCompetence(i)));
  });
  it.each(['maitre-artisan', 'artiste'])('un ajout de Talent (%s) est hors de la grille des 40 Augmentations (LDB 05 l.535)', (id) => {
    const d = { ...readyDraft(), careerTalent: { id } };
    const adds = careerSkillAdditions(probeHero(d));
    expect(adds.length).toBeGreaterThan(0);
    const entries = careerSkillEntries(d);
    for (const a of adds) expect(entries.some((c) => c.adresse === adresseDeCreation.ajout(a.id))).toBe(false);
  });
});

describe('Possessions — emplacement `{wildcard:\'arme\'}` (LDB 05 l.542-583, construct de choix d\'équipement)', () => {
  const WEAPON_SLOT = 'Arme (au choix)'; // trappingRefLabel({ wildcard: 'arme' })

  it('trappingChoices (id STABLE) résout l\'emplacement en l\'objet catalogue choisi', () => {
    // Prêtre Guerrier (Novice) : seule carrière du LDB à porter { wildcard: 'arme' } (l.1).
    const d = { ...withCareer(readyDraft(), 'pretre-guerrier'), specChoices: {}, careerTalent: { id: 'obstine' }, trappingChoices: { [WEAPON_SLOT]: 'baton-de-combat' } };
    const hero = buildHero(d, 'h-weapon');
    expect((hero.items ?? []).some((it) => it.trappingId === 'baton-de-combat')).toBe(true);
    // Sans choix : `resolveTrappingChoices` laisse le `{wildcard}` NON résolu — aucun objet fantôme.
    const noChoice = buildHero({ ...d, trappingChoices: {} }, 'h-noweapon');
    expect((noChoice.items ?? []).some((it) => it.trappingId === 'baton-de-combat')).toBe(false);
  });

  it('validateStep(\'trappings\') exige la résolution du `{wildcard}` de la carrière', () => {
    const base = { ...withCareer(readyDraft(), 'pretre-guerrier'), specChoices: {}, careerTalent: { id: 'obstine' }, wealthRoll: true };
    expect(validateStep({ ...base, trappingChoices: {} }, 'trappings')).toMatch(/Arme \(au choix\)/);
    expect(validateStep({ ...base, trappingChoices: { [WEAPON_SLOT]: 'baton-de-combat' } }, 'trappings')).toBeNull();
  });
});

describe('trappingSlotResolved — emplacement `{choice}` (construct de choix d\'équipement, Lot 1/2)', () => {
  it('un `{choice}` résolu vers la 2e branche est tenu pour résolu (et vers la bonne branche)', () => {
    const ref: TrappingRef = { choice: [{ id: 'epee' }, { id: 'hache' }] };
    const label = trappingRefLabel(ref);
    expect(trappingSlotResolved(ref, {})).toBe(false); // aucun choix posé : pas encore résolu à l'étape
    expect(trappingSlotResolved(ref, { [label]: trappingRefLabel({ id: 'hache' }) })).toBe(true);
    expect(trappingSlotResolved(ref, { [label]: 'inconnu' })).toBe(false);
  });

  it('un `{choice}` imbriqué exige la résolution RÉCURSIVE de la branche choisie', () => {
    const inner: TrappingRef = { choice: [{ id: 'dague' }, { wildcard: 'arme' }] };
    const outer: TrappingRef = { choice: [inner, { id: 'hache' }] };
    const outerLabel = trappingRefLabel(outer);
    const innerLabel = trappingRefLabel(inner);
    const wildcardLabel = trappingRefLabel({ wildcard: 'arme' });
    // Branche externe pointée vers `inner`, mais `inner` (lui-même un `{choice}`) pas encore résolu.
    expect(trappingSlotResolved(outer, { [outerLabel]: innerLabel })).toBe(false);
    // `inner` pointé vers son wildcard, mais ce wildcard est SANS id choisi.
    expect(trappingSlotResolved(outer, { [outerLabel]: innerLabel, [innerLabel]: wildcardLabel })).toBe(false);
    // Chaîne complète résolue jusqu'à la feuille.
    expect(trappingSlotResolved(outer, { [outerLabel]: innerLabel, [innerLabel]: wildcardLabel, [wildcardLabel]: 'epee' })).toBe(true);
  });

  it('un `{id, qualityChoice}` est TOUJOURS résolu — choisi ou non (défaut raffine, #657 Lot 2)', () => {
    const ref: TrappingRef = { id: 'fleuret', qualityChoice: true };
    const label = trappingRefLabel(ref);
    expect(trappingSlotResolved(ref, {})).toBe(true); // aucun choix : le résolveur défaute sur raffine
    expect(trappingSlotResolved(ref, { [label]: 'solide' })).toBe(true);
  });

  it('une branche `{choice}` qui est un `{id, qualityChoice}` reste résolue même non tranchée', () => {
    const branch: TrappingRef = { id: 'fleuret', qualityChoice: true };
    const outer: TrappingRef = { choice: [{ id: 'miroir-a-main' }, branch] };
    const outerLabel = trappingRefLabel(outer);
    const branchLabel = trappingRefLabel(branch);
    expect(trappingSlotResolved(outer, { [outerLabel]: branchLabel })).toBe(true);
  });
});

describe('Magie mineure à la création (LDB 10 l.714) — BFM sorts inclus au Talent', () => {
  /** Brouillon Sorcier valide (Niveau 1 : talent « Magie mineure » choisissable). */
  function sorcererDraft() {
    const base = withCareer(readyDraft(), 'sorcier');
    return {
      ...base,
      charAdvancesAlloc: { 'force-mentale': 5 },
      ...carrierePrete(base),
      careerTalent: { id: 'magie-mineure' },
    };
  }
  const minorsOf = (n: number) => spells.filter((s) => s.ecole === 'Magie mineure').slice(0, n).map((s) => s.id);

  it('quota = BFM final ; l\'étape 4 exige EXACTEMENT ce nombre de sorts', () => {
    const d = sorcererDraft();
    const quota = pettySpellQuota(d);
    expect(quota).toBeGreaterThan(0);
    expect(validateStep(d, 'skills')).toMatch(/sorts de Magie mineure/);
    expect(validateStep({ ...d, pettySpells: minorsOf(quota) }, 'skills')).toBeNull();
    expect(validateStep({ ...d, pettySpells: minorsOf(quota - 1) }, 'skills')).toMatch(/sorts de Magie mineure/);
  });

  it('buildHero mémorise les sorts choisis (0 PX — inclus au Talent)', () => {
    const d = sorcererDraft();
    const picks = minorsOf(pettySpellQuota(d));
    const hero = buildHero({ ...d, pettySpells: picks }, 'h-petty');
    for (const m of picks) expect(hero.spells).toContain(m);
    expect(hero.xp).toBe(xpTotal(d)); // rien payé
  });

  it('sans le Talent : quota 0, aucune exigence à l\'étape 4', () => {
    expect(pettySpellQuota(readyDraft())).toBe(0);
    expect(validateStep(readyDraft(), 'skills')).toBeNull();
  });

  /** Talent « +5 FM » (Imperturbable, LDB 10) au quota : verrouille la source UNIQUE des +5 de
   *  talent (`baseWithTalents`, jamais une boucle manuelle re-implémentée dans `pettySpellQuota`).
   *  Humains (Tiléens) portent le choix « Imperturbable ou Affable » (Affable = Sociabilité, témoin
   *  neutre) ; BFM figé en `pointBuy` pour franchir la décade sans dépendre du tirage. */
  it('talent « +5 FM » (Imperturbable) : quota supérieur au témoin sans bonus de FM', () => {
    const tileenSorcererDraft = (talentPick: 'imperturbable' | 'affable') => {
      const base = withCareer(withSpecies(newDraft(4321), 'humains-tileens'), 'sorcier');
      const sp = draftSpecies(base)!;
      const speciesTalentChoices: Record<string, number> = {};
      for (const { adresse, options } of speciesTalentChoiceEntries(base)) {
        speciesTalentChoices[adresse] = Math.max(0, options.findIndex((o) => 'id' in o && o.id === talentPick));
      }
      return {
        ...base,
        charMode: 'pointBuy' as const,
        pointBuy: { ...base.pointBuy, 'force-mentale': 7 }, // base 20 + 7 = 27 (bonus 2), à la frontière de décade
        charsRolled: true,
        talentsRolled: true,
        speciesPlus5: speciesSkillDefaults(sp).plus5,
        speciesPlus3: speciesSkillDefaults(sp).plus3,
        speciesTalentChoices,
        ...carrierePrete(base),
        careerTalent: { id: 'magie-mineure' },
      };
    };
    const withImperturbable = pettySpellQuota(tileenSorcererDraft('imperturbable'));
    const withoutFmBonus = pettySpellQuota(tileenSorcererDraft('affable'));
    expect(withImperturbable).toBe(withoutFmBonus + 1);
  });
});

describe('signe astral (ADE II 3) — étape, tirage, PX et effet', () => {
  it('stepIds insère « star » juste après « chars » (règle activée par défaut)', () => {
    const ids = stepIds();
    expect(ids).toContain('star');
    expect(ids.indexOf('star')).toBe(ids.indexOf('chars') + 1);
  });

  it('rollDraftStar : tirage FIGÉ (seed) ; le signe gardé = le signe tiré', () => {
    const d = rollDraftStar(draft());
    expect(d.starRoll).toBeTruthy();
    expect(d.star).toBe(d.starRoll);
    expect(rollDraftStar(draft()).starRoll).toBe(d.starRoll); // déterministe
  });

  it('starXp : +25 si le tirage est gardé, 0 si choix libre (l.36)', () => {
    const rolled = rollDraftStar(draft());
    expect(starXp(rolled)).toBe(25);
    const other = stars.find((s) => s.id !== rolled.starRoll)!.id;
    expect(starXp({ ...rolled, star: other })).toBe(0);
    expect(starXp(draft())).toBe(0); // aucun tirage
  });

  it('rollDraftAstrology : une lecture par Demeure céleste, depuis la DONNÉE (ADE II 3 l.504-512)', () => {
    const d = rollDraftAstrology(draft());
    expect(d.ascendant).toBeTruthy();
    expect(celestialHouses.length).toBe(5);
    expect(d.dwellings!.map((w) => w.house)).toEqual(celestialHouses.map((h) => h.id));
    for (const w of d.dwellings!) expect(w.sign).toBeTruthy();
    expect(rollDraftAstrology(draft()).dwellings).toEqual(d.dwellings); // figé par le seed
  });

  it('buildHero applique les ±carac du signe aux attributs de départ', () => {
    const base = readyDraft();
    const a = buildHero(base, 'h-nostar');
    const b = buildHero({ ...base, star: 'wymund-l-anachorete' }, 'h-star'); // id ; +2 Soc, +2 I, -3 Int
    expect(b.characteristics.sociabilite - a.characteristics.sociabilite).toBe(2);
    expect(b.characteristics.initiative - a.characteristics.initiative).toBe(2);
    expect(b.characteristics.intelligence - a.characteristics.intelligence).toBe(-3);
    expect(b.star).toBe('wymund-l-anachorete');
  });
});

/** Un choix « A ou B » de Talent d'espèce se keye par l'ADRESSE de son entrée dans `sp.talents`, jamais par
 *  un libellé (#1923) : renommer une option ne déprend aucun brouillon écrit. */
describe('clés des choix de Talents d’espèce : l’adresse de l’entrée', () => {
  it('chaque entrée « A ou B » de chaque espèce est adressée par son rang dans `sp.talents`', () => {
    for (const sp of allSpecies) {
      const attendues = sp.talents.flatMap((a, i) => ('pick' in a ? [adresseDeCreation.especeTalent(i)] : []));
      expect(speciesTalentChoiceEntries(withSpecies(newDraft(7), sp.id)).map((e) => e.adresse)).toEqual(attendues);
    }
  });
});

describe('5b — un joker de carrière sur une Compétence déjà tenue (LDB 05 l.535)', () => {
  it('le bandeau nomme le refus `slot.takenByOther`, que la sélection n\'offre plus', () => {
    const d = withCareer(withSpecies(newDraft(1), 'humains-reiklander'), 'gladiateur');
    const joker = careerSkillEntries(d).find((c) => c.ref.choix != null)!;
    expect(joker.libre('bagarre')).toBe(false);
    const pris = { ...d, specChoices: { [joker.adresse]: 'bagarre' } };
    expect(skillsSubMessage(pris, 'career')).toBe('« Corps à corps (Bagarre) » : déjà pris par un autre emplacement de ce Niveau de Carrière.');
  });
});

import { describe, it, expect } from 'vitest';
import type { Weapon } from '../types';
import { hasQuality, qualitySum, qualityCritTriggered, parryDRAdjust, isUnbreakable, attackDRAdjust, dangerousNine, reloadDRTarget, magazineSize, resolveQualities, qualityArmourBypasses } from './dispatch';
import { craftEncDelta } from './craftEconomy';
import { findQualityById, qualityIdByLabel, findTrappingById, qualityRefLabel, trappings } from '../../data';
import { itemFromTrappingById } from '../items';
import { parseQualityInstance } from './normalize';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { objetDeTest } from '../objetDeTest.testkit';

/** Libellés FR (lisibles) → `QualityInstance[]` structurées (parseur d'authoring). */
const q_ = (qs: string[]) => qs.map((s) => parseQualityInstance(s)!);
const w = (qualities: string[], over: Partial<Weapon> = {}): Weapon => ({ label: 'W', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: q_(qualities), ...over });

describe('dispatch — hasQuality compare par ID de qualité (label/casse/Indice tolérés en entrée)', () => {
  it('hasQuality(porteur, qualityId) reconnaît la qualité quelle que soit la forme stockée', () => {
    expect(hasQuality(w(['Précise']), 'precise')).toBe(true); // label canonique en runtime
    expect(hasQuality(w(['précise']), 'precise')).toBe(true); // casse
    expect(hasQuality(w(['precise']), 'precise')).toBe(true); // id en runtime
    expect(hasQuality(w(['Solide 3']), 'solide')).toBe(true); // ignore l'Indice
    expect(hasQuality(w(['Perforante']), 'precise')).toBe(false);
    expect(hasQuality(undefined, 'precise')).toBe(false);
  });
});

describe('dispatch — durcissement : un porteur au champ `qualities` absent (donnée corrompue / vieux save) ne fait pas tomber la chaîne', () => {
  const malformed = { name: 'X' } as unknown as Weapon; // aucun `qualities`
  it('resolveQualities tolère l’absence de `qualities` (→ liste vide, pas de throw)', () => {
    expect(resolveQualities(malformed)).toEqual([]);
    expect(hasQuality(malformed, 'precise')).toBe(false);
    expect(qualitySum(malformed, 'attackMod')).toBe(0);
  });
  it('craftEncDelta tolère l’absence de `qualities` (→ 0)', () => {
    expect(craftEncDelta(malformed)).toBe(0);
  });
});

describe('dispatch — sommes numériques depuis le registre', () => {
  it('attackMod : Précise = +10', () => {
    expect(qualitySum(w(['Précise']), 'attackMod')).toBe(10);
    expect(qualitySum(w([]), 'attackMod')).toBe(0);
  });
  it('armourReduction : Perforante = 1', () => {
    expect(qualitySum(w(['Perforante']), 'armourReduction')).toBe(1);
  });
  it('attackDRAdjust : Pointue = +1 DR au Test RÉUSSI seulement (LDB 62 l.288)', () => {
    expect(attackDRAdjust(w(['Pointue']), true)).toBe(1);
    expect(attackDRAdjust(w(['Pointue']), false)).toBe(0);
    expect(attackDRAdjust(w([]), true)).toBe(0);
  });
});

describe('dispatch — Empaleuse (critTrigger sur multiple de 10)', () => {
  it('déclenche un Critique si le jet est multiple de 10', () => {
    expect(qualityCritTriggered(w(['Empaleuse']), 20)).toBe(true);
    expect(qualityCritTriggered(w(['Empaleuse']), 23)).toBe(false);
    expect(qualityCritTriggered(w([]), 20)).toBe(false);
  });
});

describe('dispatch — parade (Défensive +1 défenseur, À Enroulement -1 attaquant)', () => {
  it('Défensive +1, À Enroulement -1, combinés', () => {
    expect(parryDRAdjust(w(['Défensive']), w([]))).toBe(1);
    expect(parryDRAdjust(w([]), w(['À Enroulement']))).toBe(-1);
    expect(parryDRAdjust(w(['Défensive']), w(['À Enroulement']))).toBe(0);
    expect(parryDRAdjust(undefined, w([]))).toBe(0);
  });
});

describe('dispatch — Incassable', () => {
  it('isUnbreakable vrai seulement avec l’Atout Incassable', () => {
    expect(isUnbreakable(w(['Incassable']))).toBe(true);
    expect(isUnbreakable(w([]))).toBe(false);
  });
});

describe('Aux Armes p.89 — qualités de mêlée câblées', () => {
  it('Déséquilibrée : -1 DR à la parade quand c’est l’arme du DÉFENSEUR (sans effet sur l’arme de l’attaquant)', () => {
    expect(parryDRAdjust(w(['Déséquilibrée']), w([]))).toBe(-1);
    expect(parryDRAdjust(w(['Défensive']), w(['Déséquilibrée']))).toBe(1);
  });
  it('Taillade : sur Critique, Hémorragique AUTOMATIQUE puis choix d’un 2ᵉ au prix de l’Indice (AA 08 l.87)', () => {
    const eff = findQualityById('taillade')?.effects?.[0];
    expect(eff?.trigger).toBe('onCrit');
    const flow = eff?.flow;
    expect(flow?.kind, 'la séquence « État automatique puis offre » a disparu').toBe('seq');
    const steps = flow?.kind === 'seq' ? flow.steps : [];
    const auto = steps[0]?.kind === 'do' && steps[0].effect.type === 'ops' ? steps[0].effect.ops : undefined;
    expect(auto?.[0]).toMatchObject({ op: 'condition', id: 'hemorragique' });
    const choix = steps[1];
    expect(choix?.kind).toBe('choice');
    if (choix?.kind !== 'choice') throw new Error('nœud de choix absent');
    expect(choix.advantageCost).toBe('$indice'); // X = l'Indice imprimé (1A / 2A), jamais un coût figé
    const sup = choix.yes.kind === 'do' && choix.yes.effect.type === 'ops' ? choix.yes.effect.ops : undefined;
    expect(sup?.[0]).toMatchObject({ op: 'condition', id: 'hemorragique' });
    expect(findQualityById('taillade')?.capabilities).toBeUndefined(); // plus de capability bespoke
  });
  it('Déstabilisante : effet onHit data-driven — choix (2 Av) → Test opposé Force/Athlétisme → À Terre (effects, donnée)', () => {
    const eff = findQualityById('destabilisante')?.effects?.[0];
    expect(eff?.trigger).toBe('onHit');
    expect(eff?.on).toBe('victim');
    // Nœud `choice` opt-in coûtant 2 Avantages (cadence-aware : modale héros / auto IA).
    const choice = eff?.flow;
    expect(choice?.kind).toBe('choice');
    if (choice?.kind !== 'choice') throw new Error('flow doit être un choice');
    expect(choice.advantageCost).toBe(2);
    // Branche `yes` = Test OPPOSÉ Force/Athlétisme des deux côtés (défenseur jette F+athletisme,
    // attaquant pré-jeté opposed{F+athletisme}).
    const test = choice.yes;
    expect(test.kind).toBe('test');
    if (test.kind !== 'test') throw new Error('yes doit être un test');
    expect(test.test.characteristic).toBe('force');
    expect(test.test.skill).toEqual({ id: 'athletisme' }); // id stable (≠ libellé — multilangue-safe)
    expect(test.test.opposed?.attacker).toBe('force');
    expect(test.test.opposed?.attackerSkill).toBe('athletisme');
    // Défenseur PERD l'opposition (branche `fail`) → l'attaquant l'emporte → cible À Terre.
    expect(test.fail.kind).toBe('do');
    if (test.fail.kind !== 'do' || test.fail.effect.type !== 'ops') throw new Error('fail doit poser un État');
    expect(test.fail.effect.ops[0]).toMatchObject({ op: 'condition', id: 'a-terre' });
  });
});

describe('Aux Armes — qualités d’artillerie câblées', () => {
  it('Arme d’équipe maniée seul : Indice ≥ 3 → Imprécise (-1 DR), Indice ≥ 4 → Dangereuse', () => {
    expect(attackDRAdjust(w(["Arme d'équipe 2"]), true)).toBe(0);
    expect(attackDRAdjust(w(["Arme d'équipe 3"]), true)).toBe(-1);
    expect(dangerousNine(w(["Arme d'équipe 4"]), 19, false)).toBe(true); // 19 contient un 9, échec
    expect(dangerousNine(w(["Arme d'équipe 3"]), 19, false)).toBe(false); // Indice 3 : pas Dangereuse
  });
  it('Arme d’équipe : Recharge DOUBLÉE (reloadDRTarget)', () => {
    expect(reloadDRTarget({ qualities: q_(['Recharge 3']), reload: 3 })).toBe(3);
    expect(reloadDRTarget({ qualities: q_(['Recharge 3', "Arme d'équipe 2"]), reload: 3 })).toBe(6);
  });
  it('Salve : chargeur d’Indice tirs avant rechargement (magazineSize)', () => {
    expect(magazineSize(w(['Salve 7']))).toBe(7);
    expect(magazineSize(w(['Recharge 3']))).toBeUndefined();
  });
  it('Tir de zone : qualité de zone reconnue dans la donnée (capabilities.areaFire)', () => {
    expect(findQualityById('tir-de-zone')?.capabilities?.areaFire).toBe(true);
  });
});

describe('Poudre imprégnée d’Aqshy (AA 08 l.544) — seuil de Maladresse élargi {8,9}', () => {
  it('Dangereuse seule (LDB 62 l.315) : Maladresse sur 9 (dizaines OU unités), jamais sur 8 seul', () => {
    expect(dangerousNine(w(['Dangereuse']), 91, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse']), 19, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse']), 99, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse']), 84, false)).toBe(false);
  });
  it('Poudre imprégnée d’Aqshy (via weaponWithAmmo) : Maladresse sur 8 OU 9 (AA 08 l.544)', async () => {
    const { weaponWithAmmo } = await import('../items');
    const weapon = w(['Empaleuse']);
    const ammo = objetDeTest({ trappingId: 'poudre-impregnee-d-aqshy', qualities: q_(["Poudre imprégnée d'Aqshy"]), damage: { plusBF: false, flat: 2 } });
    const armed = weaponWithAmmo(weapon, ammo);
    expect(dangerousNine(armed, 84, false)).toBe(true); // 8 en dizaines
    expect(dangerousNine(armed, 48, false)).toBe(true); // 8 en unités
    expect(dangerousNine(armed, 91, false)).toBe(true); // 9 toujours couvert
    expect(dangerousNine(armed, 73, false)).toBe(false); // ni 8 ni 9
  });
  it('Test RÉUSSI : jamais de Maladresse, même avec un digit du seuil', async () => {
    const { weaponWithAmmo } = await import('../items');
    const weapon = w(['Empaleuse']);
    const ammo = objetDeTest({ trappingId: 'poudre-impregnee-d-aqshy', qualities: q_(["Poudre imprégnée d'Aqshy"]), damage: { plusBF: false, flat: 2 } });
    const armed = weaponWithAmmo(weapon, ammo);
    expect(dangerousNine(armed, 84, true)).toBe(false);
  });
  it('Dangereuse + Poudre d’Aqshy combinées : union des seuils {8,9}', () => {
    expect(dangerousNine(w(['Dangereuse', "Poudre imprégnée d'Aqshy"]), 84, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse', "Poudre imprégnée d'Aqshy"]), 91, false)).toBe(true);
    expect(dangerousNine(w(['Dangereuse', "Poudre imprégnée d'Aqshy"]), 73, false)).toBe(false);
  });
});

describe('catalogue — entrées attendues', () => {
  it('contient les qualités d’arme implémentées', () => {
    for (const k of ['Précise', 'Perforante', 'Pointue', 'Empaleuse', 'Défensive', 'À Enroulement', 'Pistolet', 'Incassable', 'Inoffensive', 'Dévastatrice', 'Percutante',
      'Léger', 'Pratique', 'Raffiné', 'Solide', 'Bâclé', 'Laid', 'Peu Fiable', 'Volumineux',
      'Taillade', 'Déséquilibrée', 'Déstabilisante', // Aux Armes p.89 — câblées (effets onCrit/onHit data-driven / defenderParryDR)
      "Arme d'équipe", 'Salve', 'Tir de zone']) { // Aux Armes p.124/126/89 — artillerie câblée (sous-effectif / chargeur / zone)
      expect(qualityIdByLabel(k), k).toBeTruthy();
    }
  });
});

describe('couture label→id — toute qualité d’arme/armure des données se résout par son LIBELLÉ', () => {
  // `parseQuality` (authoring : « Solide 3 » saisi à l'éditeur) passe par `qualityIdByLabel`, la
  // SEULE couture label→id tolérée (CLAUDE.md). Ce banc refuse qu'un libellé du catalogue n'y résolve
  // PAS, ou qu'il y résolve sur une entrée d'un AUTRE nom (masquage par slug).
  const parSousType = (prefixe: string) => {
    const path = fileURLToPath(new URL('../../data/qualities.json', import.meta.url));
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    const all = (Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>)) as { id: string; label: string; subType?: string }[];
    return all.filter((q) => (q.subType ?? '').toLowerCase().startsWith(prefixe));
  };
  const masquees = (entrees: { id: string; label: string }[]) =>
    entrees.filter((q) => findQualityById(qualityIdByLabel(q.label) ?? '')?.label.toLowerCase() !== q.label.toLowerCase()).map((q) => q.label);

  it('chaque Atout/Défaut d’ARME se résout sur une entrée du MÊME libellé', () => {
    const armes = parSousType('arme');
    expect(armes.length).toBeGreaterThan(0);
    expect(masquees(armes)).toEqual([]);
  });
  // Pénalités « % en Discrétion/Perception » : pas des qualités nommées — parsées par
  // wearPenalty.ts directement depuis la donnée d'armure (LDB 63, colonne Pénalités).
  const ARMURE_HORS_CATALOGUE = new Set(['% en discretion', '% en perception']);
  it('chaque Atout/Défaut d’ARMURE se résout sur une entrée du MÊME libellé', () => {
    const armures = parSousType('armure').filter((q) => !ARMURE_HORS_CATALOGUE.has(q.label));
    expect(armures.length).toBeGreaterThan(0);
    expect(masquees(armures)).toEqual([]);
  });

  // DOUBLON DE MODÉLISATION DU DÉPÔT, borné ici : `qualities.json` porte DEUX entrées sous le même
  // libellé imprimé « Immobilisante » — `immobilisante` (LDB 62 l.256-258) et `immobilisante-fixe`
  // (`qualities.json:270-279`), dont la `desc` recopie AA 08 l.310, la NOTE de l'arme Filet lesté.
  // Conséquence mesurée : l'authoring par libellé n'en atteint qu'une (`qualityIdByLabel` rend l'id
  // CANONIQUE, le slug du libellé → `immobilisante`) ; le runtime reste sur l'id (`{ id: 'immobilisante-fixe' }` authorée
  // en donnée, `zi-filets.test.ts`). Curation de la donnée : ticket de curation ouvert par l'orchestrateur.
  it('le doublon de libellé du catalogue est CONNU et borné à « Immobilisante »', () => {
    const parLabel = new Map<string, string[]>();
    for (const q of parSousType('')) parLabel.set(q.label.toLowerCase(), [...(parLabel.get(q.label.toLowerCase()) ?? []), q.id]);
    expect([...parLabel].filter(([, ids]) => ids.length > 1)).toEqual([['immobilisante', ['immobilisante', 'immobilisante-fixe']]]);
    expect(parseQualityInstance('Immobilisante')).toEqual({ id: 'immobilisante' });
  });
});

/**
 * L'INDICE authoré d'un Atout va de la donnée au COÛT joué ET au libellé imprimé — Taillade (XA) :
 * « Vous pouvez dépenser X Avantages pour que votre opposant subisse 1 État Hémorragique
 * supplémentaire » (AA 08 l.87 ; colonne Atouts l.136 « Taillade (1A) », l.304 « Taillade (2A) »).
 * La FORME du libellé est pilotée par la donnée (`QualityData.indice.unite`), jamais par l'id : sans
 * unité, le livre accole la valeur nue (LDB 62 l.33 « Protectrice 2 », l.66 « Recharge 1 »).
 */
describe('Indice d’un Atout — il atteint le COÛT du choix et le libellé IMPRIMÉ', () => {
  const flamberge = findTrappingById('zweihander-flamberge')!;
  /** Toutes les références d'Atout INDICÉ à unité du catalogue — mesurées, jamais listées à la main. */
  const refsTaillade = () =>
    trappings.flatMap((t) => (t.qualities ?? []).filter((q) => q.id === 'taillade').map((q) => ({ id: t.id, q })));

  it('la donnée porte l’Indice, et `resolveQualities` le fait TRAVERSER jusqu’à `indice`', () => {
    expect(flamberge.qualities?.find((q) => q.id === 'taillade')?.value, 'le porteur de référence a perdu son Indice en donnée').toBe(2);
    const resolue = resolveQualities({ qualities: flamberge.qualities!, subType: flamberge.subType })
      .find((r) => r.id === 'taillade')!;
    expect(resolue.indice).toBe(2);
    expect(qualityRefLabel({ id: resolue.id, value: resolue.indice })).toBe('Taillade (2A)');
  });

  it('l’UNITÉ vient de la donnée : avec unité → parenthèses, sans unité → valeur nue, sans Indice → rien', () => {
    expect(findQualityById('taillade')?.indice?.unite, 'l’unité imprimée par AA 08 l.87 a quitté la donnée').toBe('A');
    expect(findQualityById('solide')?.indice?.unite).toBeUndefined();
    expect(qualityRefLabel({ id: 'taillade', value: 1 })).toBe('Taillade (1A)');
    expect(qualityRefLabel({ id: 'solide', value: 3 })).toBe('Solide 3');
    expect(qualityRefLabel({ id: 'devastatrice' })).toBe('Dévastatrice');
  });

  it('l’Indice survit à la matérialisation en OBJET DE SAC et au round-trip JSON', () => {
    const item = itemFromTrappingById('zweihander-flamberge')!;
    const porte = item.qualities.find((q) => q.id === 'taillade')!;
    expect(porte.value, 'l’Indice est perdu à la matérialisation (`qualityInstance`)').toBe(2);
    const relu = JSON.parse(JSON.stringify(item)) as typeof item;
    expect(relu.qualities.find((q) => q.id === 'taillade')?.value, 'l’Indice est perdu à la sauvegarde').toBe(2);
    expect(qualityRefLabel(relu.qualities.find((q) => q.id === 'taillade')!)).toBe('Taillade (2A)');
  });

  it('le libellé imprimé se REPARSE en Indice (aller-retour d’authoring)', () => {
    expect(parseQualityInstance('Taillade (1A)')).toEqual({ id: 'taillade', value: 1 });
    expect(parseQualityInstance('Solide 3')).toEqual({ id: 'solide', value: 3 });
  });

  it('les CINQ armes de Taillade du catalogue portent un Indice et rendent leur parenthèse (population mesurée)', () => {
    const refs = refsTaillade();
    expect(refs.length, 'la population des armes de Taillade a disparu : le test ne mesure plus rien.').toBe(5);
    expect(refs.map(({ q }) => q.value).sort()).toEqual([1, 1, 1, 2, 2]);
    for (const { id, q } of refs)
      expect(qualityRefLabel(q), `${id} : l’Indice ne se rend pas`).toBe(`Taillade (${q.value}A)`);
  });

  it('le COÛT du choix authoré est le TEMPLATE `$indice` (aucun coût figé en donnée)', () => {
    const flow = findQualityById('taillade')?.effects?.[0]?.flow;
    expect(flow?.kind).toBe('seq');
    const choix = flow?.kind === 'seq' ? flow.steps.find((f) => f.kind === 'choice') : undefined;
    expect(choix, 'le nœud `choice` de Taillade a disparu : le coût en Avantages n’est plus offert').toBeDefined();
    expect(choix?.kind === 'choice' ? choix.advantageCost : null).toBe('$indice');
  });
});

describe('qualityArmourBypasses — Perforante ignore le non-métal (LDB 62 l.270)', () => {
  it('une arme Perforante déclare le bypass nonMetal', () => {
    expect(qualityArmourBypasses(w(['Perforante']))).toEqual(['nonMetal']);
  });
  it('sans Perforante → aucun bypass', () => {
    expect(qualityArmourBypasses(w(['Précise']))).toEqual([]);
  });
});

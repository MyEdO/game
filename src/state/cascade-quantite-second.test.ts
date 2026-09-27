/**
 * LES DEUX EXTENSIONS DE LA COQUILLE DE CASCADE (#1279 Sf), mesurées SUR LE SOCLE — hors de tout
 * domaine : ce sont des zones du contrat, pas des montages de taverne.
 *
 *  1. La 6ᵉ INTERACTION « quantité » : une SAISIE NUMÉRIQUE bornée, là où une plage large sortait en
 *     autant de boutons qu'elle a de valeurs.
 *  2. La SECONDE LECTURE d'un jet — Test COMBINÉ (`LDB 12 l.202-208`), verbatim l.206 : « Faire un
 *     seul Test, en comparant donc un unique jet de pourcentage avec la valeur de ces deux
 *     Compétences est bien plus simple. »
 *
 * Le porteur est un héros quelconque et le `kind` est synthétique : si l'un de ces cas ne tenait que
 * par un jeu de taverne, l'extension ne serait pas générique.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { startCascade, registerCascadeApplier, stepInteraction, stepReady, clampStepAmount, secondReadOf, runCascadeImmediate } from './cascade';
import { quantityStep, monoStep, freeCons } from './rollSeam';
import { combatStakeRef } from '../data';
import { evaluateCombinedTest } from '../engine/tests';
import type { CascadeStep } from './pendings';

const get = useGame.getState.bind(useGame);

function hero() {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
  useGame.setState({ party: [h], battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
  return get().party[0];
}

/** Nombres RETENUS par l'applier à la validation — ce que le socle a réellement transmis. */
const retenus: number[] = [];
registerCascadeApplier('mesure-quantite', (_g, _s, step) => {
  retenus.push(step.amount ?? -1);
  return { consequences: freeCons([`retenu ${step.amount}`]) };
});

beforeEach(() => {
  retenus.length = 0;
  useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
});

describe('Étape « quantité » — la 6ᵉ interaction de la coquille', () => {
  it('une étape à `quantity` est l’interaction « quantite », et elle naît PRÊTE sur sa valeur d’ouverture', () => {
    const h = hero();
    const st = quantityStep({ id: 'q', kind: 'mesure-quantite', label: fixtureText('Combien ?'), actorId: h.id, min: 1, max: 100, value: 42 })!;
    expect(stepInteraction(st as CascadeStep)).toBe('quantite');
    expect(stepReady(st as CascadeStep), 'un compteur n’a pas d’état vide').toBe(true);
    expect((st as CascadeStep).amount).toBe(42);
    // Sans valeur d'ouverture déclarée : le minimum de la plage.
    expect((quantityStep({ id: 'q2', kind: 'mesure-quantite', label: fixtureText('C'), actorId: h.id, min: 5, max: 9 })! as CascadeStep).amount).toBe(5);
  });

  it('la porte REFUSE une plage vide (aucun nombre à poser) — jamais une fenêtre en impasse', () => {
    const h = hero();
    // DEV : la porte throw ; c'est le refus lui-même qui est mesuré.
    expect(() => quantityStep({ id: 'q', kind: 'mesure-quantite', label: fixtureText('C'), actorId: h.id, min: 10, max: 3 })).toThrow();
  });

  it('la BORNE est un site unique : la saisie est ramenée dans la plage et calée sur le pas', () => {
    expect(clampStepAmount({ min: 1, max: 100 }, 250)).toBe(100);
    expect(clampStepAmount({ min: 1, max: 100 }, -8)).toBe(1);
    expect(clampStepAmount({ min: 0, max: 20, step: 5 }, 7), 'calé depuis le minimum').toBe(5);
    expect(clampStepAmount({ min: 2, max: 20, step: 5 }, 9)).toBe(7);
    // TOTALE : un champ vidé rend `NaN` (`Number('')`) — il ne traverse pas ; les infinis tombent
    // sur la borne qu'ils visent.
    expect(clampStepAmount({ min: 3, max: 100 }, Number.NaN)).toBe(3);
    expect(clampStepAmount({ min: 3, max: 100 }, Number.POSITIVE_INFINITY)).toBe(100);
    expect(clampStepAmount({ min: 3, max: 100 }, Number.NEGATIVE_INFINITY)).toBe(3);
  });

  it('le poseur d’état écrit le nombre BORNÉ sur l’étape courante, et l’applier le reçoit', () => {
    const h = hero();
    const st = quantityStep({ id: 'q', kind: 'mesure-quantite', label: fixtureText('Combien ?'), actorId: h.id, min: 1, max: 100, value: 1 })!;
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [st] });
    get().cascadeAmount('q', 77);
    expect(get().pendingCascade!.participants[0].amount).toBe(77);
    // Hors plage : borné, jamais cru sur parole ; étape étrangère : no-op.
    get().cascadeAmount('q', 100000);
    expect(get().pendingCascade!.participants[0].amount).toBe(100);
    get().cascadeAmount('autre-etape', 3);
    expect(get().pendingCascade!.participants[0].amount).toBe(100);
    get().cascadeNext();
    expect(retenus).toEqual([100]);
    expect(get().pendingCascade).toBeNull();
  });

  it('résolution IMMÉDIATE : l’étape passe sur sa valeur d’ouverture, sans fenêtre ni défaut parallèle', () => {
    const h = hero();
    const st = quantityStep({ id: 'q', kind: 'mesure-quantite', label: fixtureText('Combien ?'), actorId: h.id, min: 1, max: 100, value: 30 })!;
    runCascadeImmediate(useGame.getState, useGame.setState, [st as CascadeStep]);
    expect(retenus).toEqual([30]);
    expect(get().pendingCascade, 'aucune fenêtre laissée pendante').toBeNull();
  });
});

describe('Seconde lecture d’un jet — Test COMBINÉ (LDB 12 l.202-208)', () => {
  it('le MÊME dé tranche la seconde valeur (aucun second tirage), issue de `evaluateCombinedTest`', () => {
    const decl = { label: 'Initiative', target: 40, base: 40 };
    const res = { roll: 38, target: 55, sl: 1, success: true };
    const lu = secondReadOf(decl, res)!;
    expect(lu.roll, 'le dé de la ligne, jamais un nouveau').toBe(38);
    const attendu = evaluateCombinedTest(38, 55, 40).b;
    expect([lu.success, lu.sl]).toEqual([attendu.success, attendu.sl]);
    // Le même dé peut réussir l'une et rater l'autre — c'est tout l'objet de la seconde lecture.
    const rate = secondReadOf(decl, { roll: 48, target: 55, sl: 0, success: true })!;
    expect([rate.success, rate.target]).toEqual([false, 40]);
  });

  /**
   * CE QUI DISCRIMINE un vrai juge de règle d'un `roll <= target` recopié : les deux cas où le RAW
   * s'écarte de la comparaison nue (`LDB 12`) — un 96-00 rate TOUJOURS, même sous une cible de 99 ;
   * et le DR se compte par DIZAINES, donc un dé de peu supérieur à la cible peut rendre 0 DR sans
   * être une réussite. Sur des valeurs qui ne les touchent pas, les deux implémentations
   * s'accorderaient : ce test tiendrait alors sans rien tenir.
   */
  it('cas DISCRIMINANTS : 96-00 rate même à cible 99, et le DR se compte par dizaines', () => {
    const cible99 = { label: 'Initiative', target: 99 };
    const lu = secondReadOf(cible99, { roll: 97, target: 40, sl: -1, success: false })!;
    expect(lu.success, '97 ≤ 99 en arithmétique, mais 96-00 est un échec automatique').toBe(false);
    expect(lu, "l'issue vient du juge du moteur, pas d'une comparaison recopiée")
      .toMatchObject({ success: evaluateCombinedTest(97, 40, 99).b.success, sl: evaluateCombinedTest(97, 40, 99).b.sl });
    // Dé de 5 au-dessus de la cible : échec, mais 0 DR (même dizaine) — une lecture « sl = 0 ⇒ réussi »
    // ou « échec ⇒ sl < 0 » se briserait ici.
    const proche = secondReadOf({ label: 'Initiative', target: 40 }, { roll: 45, target: 70, sl: 2, success: true })!;
    const ref = evaluateCombinedTest(45, 70, 40).b;
    expect([proche.success, proche.sl]).toEqual([ref.success, ref.sl]);
    expect([proche.success, proche.sl]).toEqual([false, 0]);
  });

  it('sans déclaration ou sans jet : rien (une ligne ordinaire n’a qu’une lecture)', () => {
    expect(secondReadOf(undefined, { roll: 10, target: 50, sl: 4, success: true })).toBeUndefined();
    expect(secondReadOf({ label: 'Initiative', target: 40 }, null)).toBeUndefined();
  });

  it('la PORTE transmet la déclaration jusqu’à l’étape : la fenêtre annonce ses DEUX cibles', () => {
    const h = hero();
    const st = monoStep({
      id: 'm', kind: 'mesure-quantite', label: fixtureText('Test combiné'), actor: h,
      difficulty: 'intermediaire', ligne: { test: { skill: 'pari' } },
      second: { label: 'Initiative', target: 40, base: 40, difficulty: 'intermediaire' },
      stake: combatStakeRef('tavernGame', { values: { jeu: 'x', adversaire: 'y', mise: 'aucune' } }),
    })! as CascadeStep;
    expect(st.second).toEqual({ label: 'Initiative', target: 40, base: 40, difficulty: 'intermediaire' });
  });
});

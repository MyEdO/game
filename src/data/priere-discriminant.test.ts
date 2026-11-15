/**
 * DISCRIMINANT de Prière — une SEULE source de vérité : la `family` (`beni` / `invocation`).
 *
 * `LDB 40 l.13` — verbatim : « Pour proférer une Bénédiction ou un Miracle, effectuez un Test de
 * **Prière Intermédiaire (+0)**. »
 *
 * Le piège que ce test ferme : la branche d'incantation se lisait sur un champ-drapeau OPTIONNEL
 * (`isPrayer`) doublonnant la `family` REQUISE. Le drapeau manquait sur 35 entrées, qui roulaient
 * donc un Test de Langue (Magick) opposé à un Niveau d'Incantation — un refus sec pour un prêtre.
 * Trois volets : l'invariant du DATASET, le CÂBLAGE du moteur sur littéral nu, et le SCHÉMA qui
 * interdit la résurrection du doublon.
 */
import { describe, it, expect } from 'vitest';
import { schema as spellsSchema } from './schemas/defs/spells';
import { spells } from './index';
import { castInfo, isDispellableSpell, type SpellLike } from '../engine/magic';

const FAMILLES_PRIERE = ['beni', 'invocation'];

describe('dataset — la famille COMMANDE la branche de résolution', () => {
  it('`castInfo(s).skill === "priere"` ⇔ famille Béni/Invocation, sur tout le catalogue', () => {
    const divergentes = spells
      .filter((s) => (castInfo(s).skill.id === 'priere') !== FAMILLES_PRIERE.includes(s.family))
      .map((s) => `${s.id} (family=${s.family} → skill=${castInfo(s).skill.id})`);
    expect(divergentes).toEqual([]);
  });

  it('aucune Bénédiction/Miracle ne se voit opposer un Niveau d’Incantation', () => {
    const avecNI = spells
      .filter((s) => FAMILLES_PRIERE.includes(s.family) && castInfo(s).requireNI)
      .map((s) => s.id);
    expect(avecNI).toEqual([]);
  });

  it('une Prière n’est pas dissipable ; un Sort arcanique l’est (`LDB 46 l.156`)', () => {
    const dissipables = spells.filter((s) => FAMILLES_PRIERE.includes(s.family) && isDispellableSpell(s));
    expect(dissipables.map((s) => s.id)).toEqual([]);
    expect(spells.filter((s) => s.family === 'arcane').every((s) => isDispellableSpell(s))).toBe(true);
  });
});

describe('câblage — le moteur lit la FAMILLE, jamais un champ-drapeau', () => {
  /** Littéral NU : la famille tranche seule, la donnée ne porte aucun champ-drapeau. */
  const beni: SpellLike = { label: 'Bénédiction témoin', ecole: 'Béni', family: 'beni', cn: null };
  const invocation: SpellLike = { label: 'Miracle témoin', ecole: 'Miracle', family: 'invocation', cn: null };
  const arcane: SpellLike = { label: 'Sort témoin', ecole: 'Arcane', family: 'arcane', cn: 4 };

  it('Béni et Invocation roulent le Test de Prière, sans Niveau d’Incantation', () => {
    expect(castInfo(beni)).toEqual({ skill: { id: 'priere' }, requireNI: false });
    expect(castInfo(invocation)).toEqual({ skill: { id: 'priere' }, requireNI: false });
  });

  it('un Sort arcanique roule Langue (Magick) contre son Niveau d’Incantation', () => {
    expect(castInfo(arcane)).toEqual({ skill: { id: 'langue', spec: 'magick' }, requireNI: true, caracDuDomaine: true });
  });

  it('la dissipabilité suit la même famille', () => {
    expect(isDispellableSpell(beni)).toBe(false);
    expect(isDispellableSpell(invocation)).toBe(false);
    expect(isDispellableSpell(arcane)).toBe(true);
  });

  it('une famille ABSENTE reste un Sort (aucun repli sur `cn: null`)', () => {
    expect(castInfo({ label: 'Sans famille', ecole: '?', cn: null })).toEqual({ skill: { id: 'langue', spec: 'magick' }, requireNI: true, caracDuDomaine: true });
  });
});

describe('schéma — le doublon ne peut PAS ressusciter', () => {
  const entree = () => {
    const e = JSON.parse(JSON.stringify(spells.find((s) => s.id === 'benediction-de-guerison')));
    delete e.variants;
    return e;
  };

  it('l’entrée réelle valide', () => {
    const parsed = spellsSchema.safeParse([entree()]);
    expect(parsed.error?.message ?? 'ok').toBe('ok');
  });

  it('la MÊME entrée re-taguée `isPrayer` est REFUSÉE par le `strictObject`', () => {
    expect(spellsSchema.safeParse([{ ...entree(), isPrayer: true }]).success).toBe(false);
  });
});

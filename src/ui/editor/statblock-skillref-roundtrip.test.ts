/**
 * CONTRAT POSITIF (L2 #1548, commit 4bis) — l'éditeur de statbloc de SCÈNE fait un round-trip TEXTE
 * des `SkillRef` (`skillRefLabel` → textarea → `parseSkillRef`). Il ne doit jamais en ressortir le
 * littéral « Au choix » posé en `spec`, ni perdre le bornage d'un choix, ni stocker un LIBELLÉ FR là
 * où la forme demande un id.
 *
 * CE QUI REFUSE LA SENTINELLE, ET OÙ : `ref.ts#SENTINELLE_DE_SPEC`, un refus NOMINATIF du schéma
 * dans `noeudASpecialisation`, posé AVANT le court-circuit des entrées à spécialisation ouverte.
 * `savoir` est l'une d'elles (`ref.ts#entreeOuverte`), donc le garde-fou « spéc hors catalogue » ne
 * l'atteint PAS : sans ce refus propre, `{ id: 'savoir', spec: 'au choix' }` parse.
 * Le refus est verrouillé par `src/data/spec-pool-contrat.test.ts` ; ici on garde la porte TEXTE.
 * `LDB 09 l.40`.
 */
import { describe, it, expect } from 'vitest';
import { parseSkillRef, parseTalentRef, parseTraitInstance } from './refFormatLivre';
import { skillRefLabel, talentRefLabel, type SkillRef, type TalentRef } from '../../data';
import { formatTrait } from '../../engine/traits/dispatch';
import type { TraitPose } from '../../data/schemas/grammaire/reference';
import { traitInstanceSchema } from '../../data/schemas/grammaire/reference';

const CAS: SkillRef[] = [
  { id: 'savoir', spec: 'loi', value: 80 },
  { id: 'corps-a-corps', spec: 'base', value: 52 },
  { id: 'savoir', choix: true, value: 65 },
  { id: 'metier', choix: ['armurier', 'forgeron'], value: 50 },
  { id: 'esquive', value: 48 },
];

/** Le MEME format livre porte le Talent : sa spécialisation ET son NIVEAU (`times` ≥2, LDB 44). */
const CAS_TALENT: TalentRef[] = [
  { id: 'lire-ecrire' },
  { id: 'magie-des-arcanes', spec: 'bete' },
  { id: 'maitrise-du-combat', times: 3 },
  // Spéc PAR ID, rendue « Savoir-vivre (Mercenaires) » et relue à l'id : `mercenaires` est au catalogue
  // (AA 04 l.119). Sans entrée de catalogue, le round-trip porterait du texte libre, pas l'id que
  // l'en-tête exige.
  { id: 'savoir-vivre', spec: 'mercenaires' },
];

describe('Format livre — round-trip texte d’une SkillRef (L2 #1548)', () => {
  for (const ref of CAS) {
    it(`« ${skillRefLabel(ref)} » revient à l'identique`, () => {
      const rendu = parseSkillRef(skillRefLabel(ref));
      expect(rendu).toEqual(ref);
      expect(JSON.stringify(rendu)).not.toMatch(/au choix/i); // jamais le littéral en donnée
    });
  }
});

describe('Format livre — round-trip texte d’une TalentRef (L2 #1548)', () => {
  for (const ref of CAS_TALENT) {
    it(`« ${talentRefLabel(ref)} » revient à l'identique`, () => {
      expect(parseTalentRef(talentRefLabel(ref))).toEqual(ref);
    });
  }
});

/** Le MÊME format livre porte le Trait (LDB 85) : « Nom (Argument) Indice », l'argument d'un Trait à
 *  registre rendu à ses ids. */
describe('format livre — Trait', () => {
  it('parseTraitInstance normalise Indice/argument/casse', () => {
    expect(parseTraitInstance('Démoniaque 8+')).toEqual({ id: 'demoniaque', value: 8 });
    expect(parseTraitInstance('Toile 40')).toEqual({ id: 'toile', value: 40 });
    expect(parseTraitInstance('Immunité (Poison)')).toEqual({ id: 'immunite', arg: 'poison' });
    expect(parseTraitInstance('À Sang-froid').id).toBe('a-sang-froid'); // casse de la donnée ≠ id canonique
    expect(parseTraitInstance('Vol 100')).toEqual({ id: 'vol', value: 100 });
    expect(parseTraitInstance('Nuée').id).toBe('nuee');
    expect(parseTraitInstance('Taille (Énorme)')).toEqual({ id: 'taille', arg: 'enorme' });
    expect(parseTraitInstance('Armure 4')).toEqual({ id: 'armure', value: 4 });
  });

  it('va-et-vient formatTrait → parseTraitInstance : l’argument d’un Trait à registre revient à son id, un texte libre reste', () => {
    const allerRetour = (t: TraitPose) => parseTraitInstance(formatTrait(t));
    for (const t of [
      { id: 'corruption', arg: 'moderee' }, // LDB 85 l.85
      { id: 'venin', arg: 'difficile' }, // LDB 85 l.423
      { id: 'souffle', value: 12, arg: 'feu' },
      { id: 'haine', arg: 'noble' },
      { id: 'haine', arg: 'homme-bete' },
      { id: 'venin', arg: 'de Très Facile à Très Difficile' },
    ] as TraitPose[])
      expect(allerRetour(t), JSON.stringify(t)).toEqual(t);
    expect(formatTrait({ id: 'venin', arg: 'difficile' })).toBe('Venin (Difficile)');
    expect(formatTrait({ id: 'corruption', arg: 'moderee' })).toBe('Corruption (Modérée)');
    expect(parseTraitInstance('Corruption (mineure)'), 'casse de saisie ignorée').toEqual({ id: 'corruption', arg: 'mineure' });
    expect(parseTraitInstance('Venin (TRÈS DIFFICILE)'), 'casse de saisie ignorée').toEqual({ id: 'venin', arg: 'tresDifficile' });
  });

  it('une saisie qui joint plusieurs specs n’est pas découpée : une instance, refusée au parse sur un registre fermé', () => {
    const saisie = parseTraitInstance('Haine (Noble, Homme-bête)');
    expect(saisie).toEqual({ id: 'haine', arg: 'Noble, Homme-bête' });
    expect(traitInstanceSchema.safeParse(saisie).success).toBe(false);
    expect(traitInstanceSchema.safeParse(parseTraitInstance('Haine (Noble)')).success).toBe(true);
  });
});

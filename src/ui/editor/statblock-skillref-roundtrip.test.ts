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
import { parseSkillRef, parseTalentRef } from './refFormatLivre';
import { skillRefLabel, talentRefLabel, type SkillRef, type TalentRef } from '../../data';

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
  // Spéc PAR ID, rendue « Savoir-vivre (Armée) » et relue à l'id : `armee` est au catalogue
  // (frenchy.bzh 13 l.128, folio 30). Sans entrée de catalogue, le round-trip porterait du texte
  // libre, pas l'id que l'en-tête exige.
  { id: 'savoir-vivre', spec: 'armee' },
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

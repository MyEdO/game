/**
 * CONTRAT POSITIF (#1548) — la couture d'édition des refs de créature à l'atelier du Codex
 * (`refsEnLignes` en rendu, `lignesEnRefs` au commit, exactement ce que le champ appelle) rend l'OBJET
 * à l'identique : ouvrir une fiche puis reposer le texte sans y toucher ne doit RIEN changer à la
 * donnée — ni le bornage d'un choix, ni la spécialisation (en `id`), ni le niveau d'un Talent.
 *
 * La mesure porte sur les 4 régimes de `SkillRef` (nu / spéc désignée / « Au choix » / choix BORNÉ) et
 * sur la donnée RÉELLE ENTIÈRE (`creatures.json`) — pas sur un échantillon choisi.
 */
import { describe, it, expect } from 'vitest';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';
import { creatures, skillRefLabel, talentRefLabel, type SkillRef, type TalentRef } from '../../data';
import { parseSkillRef, parseTalentRef } from '../editor/refFormatLivre';
import { refsEnLignes, lignesEnRefs } from '../editor/codex/CodexEdit';

const allerRetourSkills = (refs: SkillRef[]) => lignesEnRefs(refsEnLignes(refs, skillRefLabel), parseSkillRef);
const allerRetourTalents = (refs: TalentRef[]) => lignesEnRefs(refsEnLignes(refs, talentRefLabel), parseTalentRef);

describe('Atelier du Codex — round-trip des refs d’une créature (#1548)', () => {
  it('choix BORNÉ (« Métier (Armurier ou Forgeron) 50 ») : l’objet revient deep-equal', () => {
    const refs: SkillRef[] = [{ id: 'metier', choix: ['armurier', 'forgeron'], value: 50 }];
    expect(allerRetourSkills(refs)).toEqual(refs);
  });

  it('les 4 régimes de SkillRef (nu / spéc / au choix / choix borné) reviennent deep-equal', () => {
    const refs: SkillRef[] = [
      { id: 'esquive', value: 48 },
      { id: 'discretion', spec: 'urbaine', value: 40 },
      { id: 'savoir', choix: true, value: 65 },
      { id: 'savoir', choix: ['voies-fluviales', 'itineraires'], value: 55 },
    ];
    expect(allerRetourSkills(refs)).toEqual(refs);
  });

  it('TalentRef : spécialisation ET niveau (times ≥2) survivent au round-trip', () => {
    const refs: TalentRef[] = [{ id: 'lire-ecrire' }, { id: 'magie-des-arcanes', spec: 'bete' }, { id: 'maitrise-du-combat', times: 3 }];
    expect(allerRetourTalents(refs)).toEqual(refs);
  });

  it('bestiaire ENTIER : aucune créature ne perd une Compétence ni un Talent', () => {
    const ecarts: string[] = [];
    for (const c of creatures) {
      const skills = allerRetourSkills(c.skills);
      if (jsonCanonique(skills) !== jsonCanonique(c.skills)) ecarts.push(`${c.id}.skills : ${jsonCanonique(c.skills)} → ${jsonCanonique(skills)}`);
      const talents = allerRetourTalents(c.talents);
      if (jsonCanonique(talents) !== jsonCanonique(c.talents)) ecarts.push(`${c.id}.talents : ${jsonCanonique(c.talents)} → ${jsonCanonique(talents)}`);
    }
    expect(ecarts, `refs altérées par un aller-retour d'édition : ${ecarts.slice(0, 8).join(' | ')}`).toEqual([]);
  });
});

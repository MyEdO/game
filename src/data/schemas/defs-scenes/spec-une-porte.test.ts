/**
 * UNE porte pour la validité d'une spécialisation (#3081) — `refusDeSpec` (`grammaire/ref.ts`). Un même
 * couple (entrée, spécialisation) reçoit le même verdict partout où une donnée le porte : la Compétence
 * au statbloc de `creatures.json`, au statbloc de scène et au profil de PNJ embarqué ; le Talent aux
 * mêmes trois sites (`talentRefSchema`) et à la grammaire (`refOuSpec('talent')`). Les seuls écarts
 * déclarés sont les deux passes de `talentRefSchema` : la sentinelle (#1463 L3) et le texte d'instance
 * d'un Talent sans catalogue (#1621). FIXTURE : `grammaire/specs.testkit.ts`. `LDB 09 l.40` ; `LDB 08 l.140`.
 */
import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import { narratifSchema } from './narratif';
import { customStatblockSchema } from './communs';
import { entreePartielle } from '../defs/creatures';
import { emptyNarratif } from '../../../noyau/monde/campaignNarratif';
import { refOuSpec, refusDeSpec, type RefusDeSpec } from '../grammaire/ref';
import { avecLesEntreesDeSpecs as avecLaFixture, CREEE, FERMEE, LIBELLE, OUVERTE, SANS, SPEC } from '../grammaire/specs.testkit';

const SENTINELLE = 'Au choix';

/** Les fautes d'un parse rendues sous `chemin` — le verdict d'UN site. */
const fautesSous = (r: z.ZodSafeParseResult<unknown>, chemin: readonly PropertyKey[]): number =>
  (r.error?.issues ?? []).filter((i) => chemin.every((k, n) => i.path[n] === k)).length;

/** Les trois sites qui portent une Compétence ou un Talent de statbloc, chacun par son document. */
const SITES = {
  'statbloc de créature': (champ: 'skills' | 'talents', ref: object) => fautesSous(entreePartielle.safeParse({ [champ]: [ref] }), [champ, 0]),
  'statbloc de scène': (champ: 'skills' | 'talents', ref: object) => fautesSous(customStatblockSchema.safeParse({ type: 'statblock', [champ]: [ref] }), [champ, 0]),
  'profil de PNJ': (champ: 'skills' | 'talents', ref: object) =>
    fautesSous(narratifSchema.safeParse({ ...emptyNarratif(), presetsPnj: [{ id: 'pnj-fixture', profil: { [champ]: [ref] } }] }), ['presetsPnj', 0, 'profil', champ, 0]),
};

/** Les deux passes de `talentRefSchema` : refus de la grammaire que le statbloc de Talent admet. */
const PASSES_DU_TALENT: readonly RefusDeSpec[] = ['sentinelle', 'nonSpecialisable'];

const CAS = [
  { entree: OUVERTE, spec: SPEC },
  { entree: OUVERTE, spec: CREEE },
  { entree: OUVERTE, spec: LIBELLE },
  { entree: FERMEE, spec: SPEC },
  { entree: FERMEE, spec: CREEE },
  { entree: FERMEE, spec: SENTINELLE },
  { entree: SANS, spec: CREEE },
] as const;

describe('#3081 — une seule porte juge la spécialisation, ouverte, fermée ou sans catalogue', () => {
  for (const { entree, spec } of CAS) {
    it(`Compétence « ${entree} » (${spec}) : le verdict de \`refusDeSpec\` à chaque site, une faute au plus`, () =>
      avecLaFixture(() => {
        const attendu = refusDeSpec('skill', entree, spec) === null ? 0 : 1;
        for (const [site, fautes] of Object.entries(SITES)) expect(fautes('skills', { id: entree, spec, value: 40 }), site).toBe(attendu);
      }));

    it(`Talent « ${entree} » (${spec}) : le verdict de \`refusDeSpec\` à la grammaire, et aux statblocs hors des deux passes`, () =>
      avecLaFixture(() => {
        const refus = refusDeSpec('talent', entree, spec);
        const ref = { id: entree, spec };
        expect(fautesSous(refOuSpec('talent').safeParse(ref), []), 'grammaire').toBe(refus === null ? 0 : 1);
        const auStatbloc = refus === null || PASSES_DU_TALENT.includes(refus) ? 0 : 1;
        for (const [site, fautes] of Object.entries(SITES)) expect(fautes('talents', ref), site).toBe(auStatbloc);
      }));
  }

  it('les cas couvrent chaque verdict : admise, libellé, hors catalogue, et les deux passes', () =>
    avecLaFixture(() => {
      const verdicts = CAS.map(({ entree, spec }) => String(refusDeSpec('talent', entree, spec)));
      expect([...new Set(verdicts)].sort()).toEqual(['horsCatalogue', 'libelle', 'nonSpecialisable', 'null', 'sentinelle']);
    }));

  it('un Talent inconnu porteur d’une spécialisation est refusé à chaque statbloc', () =>
    avecLaFixture(() => {
      for (const [site, fautes] of Object.entries(SITES)) expect(fautes('talents', { id: 'fixture-3081-inconnu', spec: CREEE }), site).toBe(1);
    }));
});

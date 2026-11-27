/**
 * Kit de test des spécialisations (#3081) — un régime vivant synthétique pose, pour les Compétences et
 * les Talents, une entrée OUVERTE (`specsOpen`), une FERMÉE et une SANS catalogue, les deux premières
 * au même catalogue (`SPEC`, libellé `LIBELLE`), puis repose le précédent ; une porte qui juge sous un catalogue
 * (#5070) reçoit celui qui porte ces fiches. Un test qui juge une
 * spécialisation le fait sur ces fiches fabriquées, jamais sur une entrée du corpus.
 */
import { espaceDe, lireLEspace, type TypeEntite } from './ref';
import { cleDesLibelles, cleDesSpecs, cleFiltree } from './cle-d-espace';
import { poserRegimeVivant } from './idsVivants';
import type { Catalogue } from '../catalogue/catalogue';
import { catalogueAvec } from '../../catalogueAvec.testkit';
import { idDeFixture } from '../../idDeFixture.testkit';

export const OUVERTE = 'fixture-3081-ouverte';
export const FERMEE = 'fixture-3081-fermee';
export const SANS = 'fixture-3081-sans-catalogue';
export const SPEC = 'spec-du-catalogue';
export const LIBELLE = 'Spécialisation du catalogue';
export const CREEE = 'specialisation-creee';

/** Les espaces de la fixture d'un type, ajoutés à ceux du régime en place. */
const espacesDe = (type: TypeEntite): [string, ReadonlySet<string>][] => {
  const espace = espaceDe(type);
  const avec = (cle: string, ...ids: string[]): ReadonlySet<string> => new Set([...(lireLEspace(cle) ?? []), ...ids]);
  return [
    [espace, avec(espace, OUVERTE, FERMEE, SANS)],
    [cleFiltree(espace, { champ: 'specsOpen' }), avec(cleFiltree(espace, { champ: 'specsOpen' }), OUVERTE)],
    ...[OUVERTE, FERMEE].flatMap((id): [string, ReadonlySet<string>][] => [
      [cleDesSpecs(espace, id), new Set([SPEC])],
      [cleDesLibelles(cleDesSpecs(espace, id)), new Set([LIBELLE])],
    ]),
  ];
};

const IDS = [OUVERTE, FERMEE, SANS];
const SOURCE = { book: idDeFixture('book', 'livre-de-la-fixture-3081'), page: 1 };

/** Une Compétence et un Talent DÉCLARÉS de chaque id de la fixture, ajoutés à la base vivante (`catalogueAvec`) : le
 *  verdict d'une spécialisation ne lit que le régime posé et ces ids, la base porte le reste d'un projet jugé. */
const COMPETENCES = IDS.map((id) => ({ id, type: 'skills' as const, label: id, characteristic: 'dexterite' as const, acces: 'base' as const, source: SOURCE }));
const TALENTS = IDS.map((id) => ({ id, type: 'talents' as const, label: id, max: null, test: null, source: SOURCE }));
const CAT = catalogueAvec({ 'skills.json': COMPETENCES, 'talents.json': TALENTS });

/** Joue `verifier` sous le régime de la fixture, avec le catalogue qui porte ses fiches, puis repose le régime précédent. */
export function avecLesEntreesDeSpecs(verifier: (cat: Catalogue) => void): void {
  const espaces = new Map([...espacesDe('skill'), ...espacesDe('talent')]);
  const precedent = poserRegimeVivant((cle) => espaces.get(cle) ?? precedent?.(cle));
  try {
    verifier(CAT);
  } finally {
    poserRegimeVivant(precedent);
  }
}

/**
 * Kit de test des spécialisations (#3081) — un régime vivant synthétique pose, pour les Compétences et
 * les Talents, une entrée OUVERTE (`specsOpen`), une FERMÉE et une SANS catalogue, les deux premières
 * au même catalogue (`SPEC`, libellé `LIBELLE`), puis repose le précédent. Un test qui juge une
 * spécialisation le fait sur ces fiches fabriquées, jamais sur une entrée du corpus.
 */
import { espaceDe, lireLEspace, type TypeEntite } from './ref';
import { cleDesLibelles, cleDesSpecs, cleFiltree } from './cle-d-espace';
import { poserRegimeVivant } from './idsVivants';

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

/** Joue `verifier` sous le régime de la fixture, puis repose le régime précédent. */
export function avecLesEntreesDeSpecs(verifier: () => void): void {
  const espaces = new Map([...espacesDe('skill'), ...espacesDe('talent')]);
  const precedent = poserRegimeVivant((cle) => espaces.get(cle) ?? precedent?.(cle));
  try {
    verifier();
  } finally {
    poserRegimeVivant(precedent);
  }
}

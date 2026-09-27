/**
 * Normalisation d'un nom pour comparaison robuste : minuscules, accents (diacritiques) retirés,
 * espaces de bord ôtés (#2004).
 */
export const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Nom ACCESSIBLE d'un contrôle, calculé comme le navigateur le calcule pour les formes de l'app :
 * `aria-label`, puis le `<label>` qui porte le contrôle (sans le texte des contrôles qu'il enveloppe)
 * ou le texte du bouton, puis `title`, puis `placeholder`. Partagé par les gardes de noms uniques.
 */

const texteSans = (label: Element): string => {
  const copie = label.cloneNode(true) as Element;
  copie.querySelectorAll('input, select, textarea').forEach((c) => c.remove());
  return copie.textContent ?? '';
};

export function nomAccessible(el: HTMLElement): string {
  const brut = el.getAttribute('aria-label')
    ?? (el instanceof HTMLButtonElement
      ? el.textContent
      : [...((el as HTMLInputElement).labels ?? [])].map(texteSans).join(' '))
    ?? '';
  const nom = brut.replace(/\s+/g, ' ').trim();
  return nom || (el.getAttribute('title') ?? el.getAttribute('placeholder') ?? '').trim();
}

/** Contrôles SANS nom et noms portés par plusieurs contrôles, dans `racine`. */
export function defautsDeNoms(racine: Element) {
  const controles = [...racine.querySelectorAll<HTMLElement>('button, input:not([type="hidden"]), select, textarea')];
  const noms = controles.map((c) => `${c.tagName.toLowerCase()}${c.getAttribute('type') === 'checkbox' ? '[case]' : ''}|${nomAccessible(c)}`);
  // Un contrôle sans nom se désigne par le champ qui le porte : l'échec dit OÙ le nom manque.
  const champ = (c: HTMLElement) => (c.closest('.ed-field')?.firstElementChild?.textContent ?? '').trim().slice(0, 60);
  return {
    total: controles.length,
    sansNom: controles.filter((_, i) => noms[i].endsWith('|')).map((c) => `${noms[controles.indexOf(c)]} dans « ${champ(c)} »`),
    doublons: [...new Set(noms.filter((n, i) => noms.indexOf(n) !== i))],
  };
}

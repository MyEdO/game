/**
 * SearchFilterField — champ de filtre texte PARTAGÉ (Palette, Inspecteur de scène, sélecteurs
 * d'Interlude…). Remplace les implémentations indépendantes (`searchBox()` de Palette, la rangée
 * `pal-search-row` recopiée d'Inspector, les deux `useMemo` jumeaux d'InterludeScreen).
 *
 * `useFilteredList` couvre le cas UNE liste ⇄ UNE recherche (état possédé) ; `filterByLabel` est la
 * fonction PURE sous-jacente, réutilisable quand plusieurs listes partagent UNE seule recherche
 * (ex. Inspector : entités + toits + points d'entrée filtrés par le même champ).
 */
import { useMemo, useState } from 'react';
import { Icon } from './Icon';

/** Filtre pur (substring insensible à la casse, PAS d'accent-fold — cf. `noyau/codex/search.ts` pour
 *  le besoin multi-champs/accent-insensible du Codex, contrat distinct). */
export function filterByLabel<T>(items: T[], getLabel: (item: T) => string, search: string): T[] {
  const q = search.trim().toLowerCase();
  return q ? items.filter((it) => getLabel(it).toLowerCase().includes(q)) : items;
}

/** Hook : possède l'état de recherche + la liste filtrée d'UNE collection. */
export function useFilteredList<T>(items: T[], getLabel: (item: T) => string) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterByLabel(items, getLabel, search), [items, getLabel, search]);
  return { search, setSearch, filtered };
}

/** Champ de saisie — `icon` affiche la rangée `<Icon interface/rechercher>` + input (Palette/Inspector) ;
 *  sans, un `<input>` nu (Interlude, classe `interlude-search`). */
export function SearchFilterField({
  value,
  onChange,
  placeholder,
  className,
  icon = false,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  icon?: boolean;
  ariaLabel?: string;
}) {
  const input = (
    <input
      className={className ?? 'search-filter'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
    />
  );
  if (!icon) return input;
  return (
    <div className="pal-search-row">
      <Icon id="interface/rechercher" size="sm" />
      {input}
    </div>
  );
}

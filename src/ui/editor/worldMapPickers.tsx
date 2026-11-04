/**
 * Pickers de RÉFÉRENCE de l'éditeur de carte du monde (#419) — 3 primitives partagées entre le
 * panneau Lieu et le panneau Route : icône de médaillon, fond d'ambiance, et sélecteur de référence
 * générique (scène/service/port/rencontre) avec recherche. Composition `MediaSelect` + `SearchFilterField`
 * (patron `WeaponWildcardPicker`, `src/ui/creator/CharacterCreator.tsx`) : UN seul chemin, les 6 sites de
 * `<select>` de référence brut de l'ancien fichier monolithique y sont migrés.
 */
import { Icon } from '../Icon';
import { ICON_DEFS } from '../../data/icons';
import { BACKDROPS } from '../backdrops';
import { SceneBackdrop } from '../SceneBackdrop';
import { MediaSelect, type MediaOption } from '../MediaSelect';
import { SearchFilterField, useFilteredList } from '../SearchFilterField';

/** Options du picker d'icône (#361) : catalogue COMPLET `src/data/icons` — un id du registre, jamais
 *  un emoji libre. Composition MediaSelect + Icon (patron `ItemIcon`/`MediaSelect`). */
const ICON_OPTIONS: MediaOption[] = [
  { key: '', media: <Icon id="map-tool/pin" size="sm" />, label: 'Épingle par défaut' },
  ...Object.values(ICON_DEFS)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ({ key: d.id, media: <Icon id={d.id} size="sm" />, label: d.label, sub: d.id })),
];

/** Picker d'icône de médaillon (lieu/POI) — remplace le champ « emoji libre » (#361, BLOQUANT doctrine
 *  no-emoji-affordance). Une valeur héritée hors catalogue (emoji d'ancienne donnée) n'est PAS
 *  proposée à la ressaisie mais reste signalée dans le déclencheur. */
export function IconField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  const known = value != null && !!ICON_DEFS[value];
  return (
    <label className="ed-field">
      {label}
      <MediaSelect
        options={ICON_OPTIONS}
        value={known ? value : undefined}
        onSelect={(k) => onChange(k || undefined)}
        placeholder={value && !known ? `Icône héritée « ${value} » — choisir dans le catalogue` : 'Épingle par défaut'}
      />
    </label>
  );
}

/** Options du picker de bande d'ambiance (#371) : catalogue COMPLET `src/ui/backdrops`, patron IconField. */
const BACKDROP_OPTIONS: MediaOption[] = [
  { key: '', media: undefined, label: 'Repli d’ambiance (dégradé)' },
  ...Object.values(BACKDROPS)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ({ key: d.id, label: d.label, sub: d.id })),
];

/** Picker de fond d'ambiance (`SceneBackdrop`) — même patron que `IconField` (`MediaSelect`). */
export function BackdropField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  const known = value != null && !!BACKDROPS[value];
  return (
    <label className="ed-field">
      {label}
      <MediaSelect
        options={BACKDROP_OPTIONS}
        value={known ? value : ''}
        onSelect={(k) => onChange(k || undefined)}
        placeholder={value && !known ? `Fond hérité « ${value} » — choisir dans le catalogue` : 'Repli d’ambiance (dégradé)'}
      />
      <div style={{ marginTop: 6, maxWidth: 260 }}><SceneBackdrop backdropId={known ? value : undefined} /></div>
    </label>
  );
}

/** Picker de référence GÉNÉRIQUE (scène/service/port/rencontre…) — UNIQUE chemin de l'éditeur de carte
 *  du monde pour un `<select>` de référence (#419, dette « 6 duplications locales du même select »).
 *  Recherche (`SearchFilterField`) affichée dès que la liste dépasse quelques entrées. */
export function RefSelect<T>({ label, options, getId, getLabel, value, onChange, nullableLabel, placeholder }: {
  label?: string;
  options: readonly T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  value: string;
  onChange: (id: string) => void;
  /** Libellé de l'option vide (omis = pas de choix vide, une référence reste requise). */
  nullableLabel?: string;
  placeholder?: string;
}) {
  const { search, setSearch, filtered } = useFilteredList([...options], getLabel);
  const mediaOptions: MediaOption[] = [
    ...(nullableLabel != null ? [{ key: '', label: nullableLabel }] : []),
    ...filtered.map((o) => ({ key: getId(o), label: getLabel(o) })),
  ];
  const field = (
    <>
      {options.length > 6 && <SearchFilterField value={search} onChange={setSearch} placeholder="Filtrer…" icon />}
      <MediaSelect options={mediaOptions} value={value} onSelect={onChange} placeholder={placeholder ?? '— choisir —'} />
    </>
  );
  return label ? <label className="ed-field">{label}{field}</label> : field;
}

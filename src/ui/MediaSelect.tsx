import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Sélecteur « visuel » PARTAGÉ — déclencheur + popover de rangées `média + texte`, là où un `<select>`
 * natif ne peut pas afficher d'icône (sélecteurs d'armes/armure de la fiche, menu « Donner »…). Le
 * `média` est un ReactNode quelconque : `ItemIcon` (objet) ou `CharFrame` (héros). Source UNIQUE de ce
 * motif (l'ancien markup ad-hoc `give-*` est dissous ici).
 *
 * Options rendues EAGER dans le DOM (repliées par CSS quand fermé) — le métier reste chez l'appelant,
 * ce composant ne fait que rendre et propager `onSelect`. Combobox accessible : ouverture clic/Enter/
 * Espace, fermeture Échap + clic-extérieur.
 */
export interface MediaOption {
  key: string;
  media?: ReactNode;
  label: ReactNode;
  /** Détail secondaire à droite du libellé (ex. « PA 2 », « Bras+Corps »). */
  sub?: ReactNode;
  disabled?: boolean;
}

export interface MediaSelectProps {
  options: MediaOption[];
  /** Clé de l'option courante (surbrillance + contenu du déclencheur par défaut). */
  value?: string;
  onSelect: (key: string) => void;
  /** Contenu du déclencheur quand aucune option n'est sélectionnée (et pas de `trigger` custom). */
  placeholder?: ReactNode;
  /** Déclencheur custom (ex. icône cadeau) — remplace le contenu « média + libellé » par défaut. */
  trigger?: ReactNode;
  /** Classe du bouton déclencheur (défaut : aspect « select » `.ms-trigger`). */
  triggerClassName?: string;
  /** Alignement du popover sous le déclencheur. */
  align?: 'left' | 'right';
  title?: string;
  className?: string;
}

export function MediaSelect({
  options, value, onSelect, placeholder, trigger, triggerClassName, align = 'left', title, className,
}: MediaSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = value != null ? options.find((o) => o.key === value) : undefined;
  const pick = (key: string) => { setOpen(false); onSelect(key); };

  return (
    <div ref={rootRef} className={`media-select align-${align}${className ? ' ' + className : ''}`}>
      <button
        type="button"
        className={triggerClassName ?? 'ms-trigger'}
        title={title}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
      >
        {trigger ?? (selected
          ? <><span className="ms-media">{selected.media}</span><span className="ms-label">{selected.label}</span></>
          : <span className="ms-label ms-placeholder">{placeholder}</span>)}
        {!trigger && <span className="ms-caret" aria-hidden>▾</span>}
      </button>
      <ul className="ms-list" role="listbox">
        {options.map((o) => (
          <li
            key={o.key}
            role="option"
            aria-selected={o.key === value}
            aria-disabled={o.disabled}
            className="ms-opt"
            tabIndex={o.disabled ? -1 : 0}
            onClick={() => { if (!o.disabled) pick(o.key); }}
            onKeyDown={(e) => { if (!o.disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(o.key); } }}
          >
            {o.media != null && <span className="ms-media">{o.media}</span>}
            <span className="ms-label">{o.label}</span>
            {o.sub != null && <span className="ms-sub">{o.sub}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

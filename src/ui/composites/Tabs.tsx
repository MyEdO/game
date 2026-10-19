import { useRef, type ReactNode } from 'react';
import { rovingKeyDown } from './rovingFocus';

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  /** Badge de comptage (primitive `.count`, cf. `styles/components.css`). */
  count?: number;
  /** Le badge de comptage passe en alerte (ex. erreurs de validation non résolues). */
  alert?: boolean;
}

/**
 * Tabs — LA primitive UNIQUE de navigation par onglets (#314 : remplace les 5 systèmes gelés par le
 * cliquet #288 — `.port-tabs`/`.zone-tabs`/`.logic-tabs`/`.merchant-tabs`+`.merch-subtabs`/`.sheet-tabs`).
 * Markup, comportement ET présentation UNIQUES (`role="tablist"`/`"tab"`, `aria-selected`, roving
 * tabindex — flèches Gauche/Droite/Home/End déplacent le focus ET activent l'onglet, cf. pattern
 * WAI-ARIA Tabs). Une seule présentation chartée « Atelier du scribe » [entériné 2026-07-14, #414] :
 * « Disons que je ne vois pas l'intérêt d'en avoir plus que 1 » — la prop `variant` est morte.
 * `trailing` reçoit un contrôle HORS tablist, rendu après les onglets dans la même rangée.
 */
export function Tabs<K extends string>({
  tabs,
  active,
  onChange,
  trailing,
  className,
  label,
}: {
  tabs: TabItem<K>[];
  /** Onglet actif ; `null` = aucun sélectionné (ex. dock replié). */
  active: K | null;
  onChange: (key: K) => void;
  trailing?: ReactNode;
  className?: string;
  /** `aria-label` du tablist — à fournir quand le titre de l'écran ne le porte pas déjà. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const activeIdx = Math.max(0, tabs.findIndex((t) => t.key === active));
  const onKeyDown = rovingKeyDown<HTMLDivElement>({
    containerRef: ref,
    selector: '[role="tab"]',
    count: tabs.length,
    activeIndex: activeIdx,
    onActivate: (idx) => onChange(tabs[idx].key),
  });
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      className={`tabs${className ? ` ${className}` : ''}`}
      onKeyDown={onKeyDown}
    >
      {tabs.map((t, i) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          tabIndex={active === t.key || (active == null && i === 0) ? 0 : -1}
          className={`tab-btn${active === t.key ? ' active' : ''}${t.alert ? ' alert' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null && <span className="count">{t.count}</span>}
        </button>
      ))}
      {trailing}
    </div>
  );
}

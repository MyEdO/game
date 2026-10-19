import { useState, type ReactNode } from 'react';
import { Tabs } from './composites/Tabs';

/** Un onglet d'une fiche d'entité. `content` est rendu paresseusement (seul l'onglet actif s'affiche). */
export interface EntryTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Présentation PARTAGÉE d'une fiche d'entité « riche » : en-tête (figurine + titre + accroche) puis
 * ONGLETS internes (Profil / Description / …) qui répartissent le contenu — donc tout se voit SANS
 * scroller un long pavé. SOURCE UNIQUE de la page d'espèce du créateur ET de la fiche du Codex
 * (réutilise `.main-head` de `creator.css` + la primitive `<Tabs>`).
 *
 * L'onglet actif est mémorisé par `id` STABLE : les appelants keyent chaque onglet par une identité
 * sémantique invariante d'une fiche à l'autre (CodexEntry : slug du titre de section ; créateur :
 * `profil`/`carrieres`/…). Feuilleter les créatures garde donc « Caractéristiques » ouvert par simple
 * égalité d'id (l'onglet absent retombe sur le 1er). Ne PAS remonter le composant via `key` côté appelant.
 */
export function TabbedEntry({
  figure,
  title,
  aside,
  blurb,
  meta,
  band,
  tabs,
}: {
  /** Figurine/aperçu à gauche du titre (rig, illustration…). */
  figure?: ReactNode;
  title: ReactNode;
  /** Élément à droite du titre (badge source, sous-titre…). */
  aside?: ReactNode;
  /** Accroche courte sous le titre. */
  blurb?: ReactNode;
  /** Faits-clés TOUJOURS visibles dans l'en-tête (jamais cachés dans un onglet). */
  meta?: ReactNode;
  /** Bande PLEINE LARGEUR entre l'en-tête et les onglets (statbloc compact d'une créature…). */
  band?: ReactNode;
  tabs: EntryTab[];
}) {
  const [active, setActive] = useState<string | undefined>(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <>
      <div className="main-head">
        {figure}
        <div>
          <h2>
            {title}
            {aside}
          </h2>
          {blurb && <p className="hint">{blurb}</p>}
          {meta}
        </div>
      </div>
      {band}
      {tabs.length > 1 && (
        <Tabs
          className="zone-tabnav"
          tabs={tabs.map((t) => ({ key: t.id, label: t.label }))}
          active={current?.id ?? null}
          onChange={(id) => setActive(id)}
        />
      )}
      {current?.content}
    </>
  );
}

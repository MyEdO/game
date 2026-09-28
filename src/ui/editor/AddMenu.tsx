/**
 * MENU D'AJOUT de l'atelier — définition UNIQUE du motif « bouton + liste groupée de blocs à
 * insérer » : « + Effet » (EffectList), « + Bloc » (FlowEditor), « + Op mécanique » (GameOpEditor).
 * Les rangées composent la primitive canon `ListRow` ; le menu est une `BoiteAncree` contre son
 * bouton. Ses boutons vivent dans des panneaux DÉFILANTS collés au bas de l'écran (dock Logique) : un
 * menu posé dans le flux de son ancêtre y serait rogné par l'`overflow` de celui-ci.
 */
import { useRef, useState, type ReactNode } from 'react';
import { ListRow } from '../ListRow';
import { BoiteAncree, usePlacementAncre } from '../BoiteAncree';

/** VOCABULAIRE d'un menu : les types offerts, groupés, SANS action. Un registre le publie une fois
 *  (`EFFECT_MENU_GROUPS`, `OP_MENU_GROUPS`) et tous ses menus le partagent — c'est ce qui garantit
 *  qu'ajouter et changer de type proposent EXACTEMENT la même liste. */
export interface TypeMenuItem {
  key: string;
  label: ReactNode;
}
export interface TypeMenuGroup {
  title: string;
  items: TypeMenuItem[];
}

export interface AddMenuItem extends TypeMenuItem {
  onPick: () => void;
}
export interface AddMenuGroup {
  title: string;
  items: AddMenuItem[];
}

/** Unique passage du VOCABULAIRE à un menu ACTIONNABLE. */
export function pickable(groups: TypeMenuGroup[], onPick: (key: string) => void): AddMenuGroup[] {
  return groups.map((group) => ({
    title: group.title,
    items: group.items.map((item) => ({ ...item, onPick: () => onPick(item.key) })),
  }));
}

/** Largeur du menu : le placement la borne au viewport. */
const MENU_W = 330;

export function AddMenu({ label, groups }: { label: string; groups: AddMenuGroup[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [bouton, setBouton] = useState<HTMLElement | null>(null);
  const placement = usePlacementAncre(bouton, MENU_W);

  const basculer = () => {
    const el = ref.current;
    setBouton(el?.open ? el.querySelector('summary') : null);
  };
  const pick = (item: AddMenuItem) => () => {
    if (ref.current) ref.current.open = false;
    setBouton(null);
    item.onPick();
  };

  return (
    <details className="eff-add" ref={ref} onToggle={basculer}>
      <summary className="btn small">{label}</summary>
      {placement && (
        <BoiteAncree placement={placement} className="eff-add-menu panel">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mini-title">{g.title}</div>
              {g.items.map((it) => (
                <ListRow key={it.key} label={it.label} onClick={pick(it)} />
              ))}
            </div>
          ))}
        </BoiteAncree>
      )}
    </details>
  );
}

/** Report des valeurs connues sur un bloc NEUF : le type visé décide des champs qui existent, la
 *  mémoire fournit leurs valeurs. Le discriminant reste celui du type visé. Pure, donc vérifiable
 *  sans navigateur. */
export function convertTo<T extends object>(fresh: T, memoire: Record<string, unknown>, discriminant: string): T {
  const out: Record<string, unknown> = { ...(fresh as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    if (key === discriminant) continue;
    if (memoire[key] !== undefined) out[key] = memoire[key];
  }
  return out as T;
}

/** CHANGER le type d'un bloc déjà authoré. Même primitive, même vocabulaire et même geste
 *  DÉLIBÉRÉ que l'ajout (`AddMenu`) — et CONVERSION, jamais fabrication : les champs que le type
 *  visé connaît aussi gardent leur valeur, et ceux qu'il ignore attendent dans la mémoire de la
 *  rangée, de sorte qu'un aller-retour de type rende le texte saisi. Le document, lui, ne porte
 *  jamais que les champs du type courant. */
export function TypeMenu<T extends object>({
  value,
  discriminant,
  currentLabel,
  groups,
  make,
  onChange,
}: {
  value: T;
  /** Nom du champ qui PORTE le type (`type` pour un Effect, `op` pour un GameOp). */
  discriminant: string;
  currentLabel: string;
  groups: TypeMenuGroup[];
  make: (key: string) => T;
  onChange: (next: T) => void;
}) {
  const memoire = useRef<Record<string, unknown>>({});
  return (
    <AddMenu
      label={`Type : ${currentLabel}`}
      groups={pickable(groups, (key) => {
        memoire.current = { ...memoire.current, ...(value as Record<string, unknown>) };
        onChange(convertTo(make(key), memoire.current, discriminant));
      })}
    />
  );
}

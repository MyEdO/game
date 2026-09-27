import { useId, type ReactNode } from 'react';
import { Icon } from './Icon';
import { GatedAction } from './GatedAction';
import type { IconIdInput } from './icons';
import { RuleDivider } from './Ornaments';
import { t } from '../i18n';

/**
 * MenuCard — primitive du patron « vrai menu » : une carte qui empile un en-tête, des SECTIONS de
 * grands boutons pleine largeur (icône + libellé) séparées par un filet titré. Source UNIQUE
 * composée par le MENU PRINCIPAL (`MainMenu`, carte plein-champ centrée) ET le MENU SYSTÈME plein
 * écran EN JEU (`GameMenu`, pause + ses sous-écrans Coopération/Options) — MÊME langage visuel.
 * Ne jamais recoder un `.menu-card` ni un `<button className="btn">` de menu à la main : composer
 * `MenuCard` > `MenuSection` > `MenuButton` (et `MenuToggle` pour un interrupteur de menu).
 *
 * HAUTEUR (#1847) : la carte est une COLONNE bornée à la place que son hôte lui laisse
 * (`max-height: 100%`), et elle n'a qu'UN scrollport, `.menu-card-body` — `header`, `head` et
 * `footer` restent ancrés, seules les sections défilent. Un menu qui défile en PAGE emporte son
 * titre et ses actions hors du champ d'un coup ; la course appartient au corps, pas à la surface.
 */
export function MenuCard({ header, head, footer, large, className, children }: {
  /** En-tête de la carte (titre, sous-titre/méta) — rendu avant les sections, hors du défileur. */
  header?: ReactNode;
  /** Bande FIXE entre l'en-tête et le corps défilant (barre d'onglets d'un sous-écran). */
  head?: ReactNode;
  /** Pied de carte (note discrète) — rendu après les sections, hors du défileur. */
  footer?: ReactNode;
  /** Carte-CATALOGUE : plafond relevé (760px, 1600px au-delà de 1440px) pour une carte qui porte une
   *  GRILLE plutôt qu'une colonne de boutons. Distinct du `wide` de `MenuSubScreen` (720px). */
  large?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`menu-card${large ? ' menu-card-large' : ''}${className ? ` ${className}` : ''}`}>
      {header}
      {head}
      <div className="menu-card-body">{children}</div>
      {footer}
    </div>
  );
}

/**
 * EN-TÊTE de `MenuCard` : titre + `lead` (bouton Retour du sous-écran) + méta optionnelle
 * (sous-titre de scène, `ScreenMeta`). Sous-composant de la MÊME primitive — le markup de l'en-tête
 * (`.menu-card-head`/`-title`/`-meta`/`-sub`) ne se réécrit à aucun appelant : `MenuSubScreen` et le
 * menu système (`GameMenu`) le COMPOSENT.
 */
export function MenuCardHead({ title, lead, sub, meta, className }: {
  title: ReactNode;
  /** Élément AVANT le titre (bouton « Retour » d'un sous-écran). */
  lead?: ReactNode;
  /** Sous-titre discret de la méta (ex. nom de scène). */
  sub?: ReactNode;
  /** Méta de droite (`ScreenMeta` : date, jamais la bourse en menu système). */
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`menu-card-head${className ? ` ${className}` : ''}`}>
      {lead}
      <h2 className="menu-card-title">{title}</h2>
      {(sub != null || meta != null) && (
        <div className="menu-card-meta">
          {sub != null && <span className="menu-card-sub">{sub}</span>}
          {meta}
        </div>
      )}
    </div>
  );
}

/**
 * SOUS-ÉCRAN de menu (Coopération, Options, salon coop) : la MÊME carte plein écran, en-tête
 * « Retour » + titre. Vit ICI (à côté de `MenuCard`, dont c'est une composition) et non dans un
 * foyer, parce que les TROIS s'en servent : le menu SYSTÈME en jeu (`GameMenu`), le menu PRINCIPAL
 * hors partie (`MainMenu` → `OptionsScreen`) et le salon coop (`CoopLobby`) — même langage, un seul
 * markup. `wide` est une LARGEUR et rien d'autre (720px) : la HAUTEUR est le contrat de `MenuCard`,
 * qui vaut pour tous ses composeurs — un sous-écran ne possède pas de règle de cadre à lui (#1847).
 * `head` reçoit ce qui doit rester EN TÊTE, hors du défileur (la barre d'onglets d'Options) ; il est
 * passé tel quel à la carte.
 */
export function MenuSubScreen({ title, onBack, backLabel, wide, head, children }: {
  title: ReactNode;
  onBack: () => void;
  /** Libellé du bouton de retour quand « Retour » MENT : le salon coop en sort (« Quitter »). */
  backLabel?: ReactNode;
  wide?: boolean;
  /** Bande FIXE entre l'en-tête et le corps défilant (barre d'onglets). */
  head?: ReactNode;
  children: ReactNode;
}) {
  return (
    <MenuCard
      className={`game-menu-card game-menu-sub${wide ? ' game-menu-sub-wide' : ''}`}
      header={<MenuCardHead
        className="menu-sub-head"
        lead={<button type="button" className="btn small btn-ghost menu-back" onClick={onBack}>
          <Icon id="ui/undo" size="sm" /> {backLabel ?? t('gameMenu.back')}
        </button>}
        title={title}
      />}
      head={head}
    >
      {children}
    </MenuCard>
  );
}

/** Section de menu : filet séparateur (fleuron si `label` absent, titré sinon) + liste verticale de
 *  `MenuButton`. `rule={false}` supprime le filet (première section adossée à l'en-tête). */
export function MenuSection({ label, rule = true, ruleClassName, className, children }: {
  label?: ReactNode;
  rule?: boolean;
  ruleClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      {rule && <RuleDivider label={label} className={ruleClassName} />}
      <div className={`menu-buttons${className ? ` ${className}` : ''}`}>{children}</div>
    </>
  );
}

/** Grand bouton de menu : `<Icon>` + libellé, pleine largeur. `href` → lien (`<a>`, ex. galeries) ;
 *  `tone` mappe les variantes canon `.btn-primary`/`.btn-test` ; `refus` ferme le bouton sur sa raison
 *  (`GatedAction`). */
export function MenuButton({ icon, tone, onClick, href, target, rel, title, refus, children }: {
  icon: IconIdInput;
  tone?: 'primary' | 'test';
  onClick?: () => void;
  href?: string;
  target?: string;
  rel?: string;
  title?: string;
  /** Raison pour laquelle le bouton est fermé. */
  refus?: string;
  children: ReactNode;
}) {
  const id = useId();
  const primary = tone === 'primary';
  const cls = `btn menu-btn${primary ? ' btn-primary' : tone === 'test' ? ' btn-test' : ''}`;
  if (href) {
    return (
      <a className={`${cls} menu-link`} href={href} target={target} rel={rel} title={title}>
        <Icon id={icon} /> {children}
      </a>
    );
  }
  if (refus) {
    return (
      <GatedAction
        id={id}
        label={<><Icon id={icon} /> {children}</>}
        enabled={false}
        reason={refus}
        onClick={() => {}}
        primary={primary}
        btnClassName={`menu-btn${tone === 'test' ? ' btn-test' : ''}`}
      />
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} title={title}>
      <Icon id={icon} /> {children}
    </button>
  );
}

/** Interrupteur de menu (case à cocher alignée + libellé) — motif partagé, remplace le `.radio` de
 *  talent détourné (case cochée mal alignée, feedback juge). */
export function MenuToggle({ checked, onChange, children }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="menu-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

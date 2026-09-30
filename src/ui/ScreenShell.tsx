import { useId, useRef, type ReactNode } from 'react';
import { useModalA11y } from './Modal';
import { CadrePied, CadreFermer } from './Cadre';
import { ScreenMeta } from './ScreenMeta';
import { SceneBackdrop } from './SceneBackdrop';
import { Row } from './Layout';
import type { Money } from '../engine/money';
import type { AmbianceCadre } from '../state/campaignNarratif';

/**
 * ScreenShell — LA coquille UNIQUE des écrans plein-champ (carte du monde, port/escale, marché,
 * dossier de navire, négoce…). Extraite du patron de facto `.worldmap-overlay` : voile plein écran
 * (z-index 90, sous les modales) + en-tête (titre à gauche, méta + actions + fermeture à droite) + corps.
 * Comme `<Modal>`, elle porte l'a11y de dialogue (`role="dialog"`, focus initial + piège Tab, Échap =
 * `onClose`) via `useModalA11y` — plus AUCUN écran ne recode `.worldmap-overlay`/`.worldmap-head`.
 *
 * Fermeture (#362) : `closeLabel` par défaut « ✕ Fermer » — SEULE exception tolérée un vrai autre
 * VERBE d'action (ex. « Réduire » pour un panneau qui se replie sans fermer le flux), jamais une
 * simple synonymie du même geste (« Quitter »).
 *
 * Méta d'en-tête (#362) : slot `meta` STANDARD `{ time?, money? }` — date/bourse rendues dans
 * `.worldmap-head-actions` (JAMAIS dans `.screen-toolbar`, qui reste aux `<Tabs>`/filtres et casse
 * sur deux lignes avec un contenu large). Barre d'outils : slot `tabs` OPTIONNEL rendu dans
 * `.screen-toolbar`, sous l'en-tête — l'écran y pose la primitive `<Tabs>` (onglets réels) et/ou du
 * contenu libre, tel quel. `className` est un crochet pour les DESCENDANTS de l'écran.
 *
 * Habillage générique (#371 lot 2) : `body` bascule le traitement du CORPS, seul à défiler sous
 * l'en-tête et la barre d'outils ancrés, jamais le voile (#1993 ; règle 4, CLAUDE.md) — `'full'`
 * (défaut) pour un écran-canevas (carte, plan) qui remplit tout le cadre et porte lui-même son
 * défileur (rail `.screen-scroll` ou corps propre) ; `'centered'` borne et centre le corps dans une
 * colonne (`.screen-colonne`, ~960px), qui défile dans le rail `.screen-scroll` que la coquille pose
 * — le réflexe pour un écran de PANNEAUX/LECTURE (marché, dossier, hub) sans quoi le contenu colle à
 * gauche avec un océan vide à droite en large (famille « vide non habité » du juge, #371) ;
 * `'centered-wide'` (politique grand écran, docs/charte-ui.md) — même bornage/centrage mais plafond
 * relevé (`data-large`, ~1400px au-delà de 1440px) pour un écran-GRILLE/catalogue (tables de
 * négoce…) qui profite de plus de colonnes utiles.
 * `backdrop` pose la bande d'ambiance (`SceneBackdrop`, lot 1) sous l'en-tête/barre d'outils, au-dessus du
 * corps — absente du prop = pas de bande ; fournie (même id inconnu) = toujours un rendu
 * (repli élégant géré par `SceneBackdrop`, jamais un trou).
 *
 * Pied (`footer`) : `CadrePied`, le pied des trois cadres, hors du rail et dans la colonne du corps
 * (même largeur, même alignement). Seul un corps borné en a un : la coquille possède alors le
 * défileur, et le pied reste à l'écran.
 *
 * Ambiance (#717) : `ambiance` pose `data-ambiance` sur le voile — une STRATE DE MATIÈRE (tokens
 * `--amb-*`, `styles/base.css`), pas une classe d'écran : le parchemin d'une veillée s'assombrit
 * partout dans le sous-arbre sans qu'aucun écran ne redessine sa peau.
 */
/** Corps : un canevas (`'full'`) remplit le cadre et n'a pas de pied ; un corps borné défile dans le
 *  rail de la coquille, et peut porter un pied. */
type CorpsEcran =
  | { body?: 'full'; footer?: never }
  | { body: 'centered' | 'centered-wide'; footer?: ReactNode };

export function ScreenShell({
  title,
  onClose,
  closeLabel = '✕ Fermer',
  meta,
  actions,
  tabs,
  backdrop,
  body = 'full',
  ambiance,
  className,
  footer,
  etape,
  children,
}: CorpsEcran & {
  title: ReactNode;
  /** Échap / bouton de fermeture. */
  onClose: () => void;
  /** Libellé du bouton de fermeture (défaut « ✕ Fermer »). */
  closeLabel?: ReactNode;
  /** Slot d'en-tête STANDARD date/bourse (opt-in) — `time` = instant de campagne, `money` = bourse du groupe. */
  meta?: { time?: number; money?: Money };
  /** Boutons d'en-tête AVANT la fermeture (rendus à droite, à côté du bouton Fermer). */
  actions?: ReactNode;
  /** Barre d'outils OPTIONNELLE (`.screen-toolbar`) : `<Tabs>` et/ou badges de l'écran, tels quels. */
  tabs?: ReactNode;
  /** Bande d'ambiance (id du registre `src/ui/backdrops`) — opt-in, rendue sous l'en-tête/barre d'outils. */
  backdrop?: string;
  /** Strate de MATIÈRE de l'écran (#717) — posée en `data-ambiance` sur le voile : les tokens
   *  `--amb-*` (`styles/base.css`) s'y rescopent et les matières déjà en place (parchemin, cartes)
   *  les lisent. Absente = aucune ambiance (comportement inchangé). */
  ambiance?: AmbianceCadre;
  /** Crochet d'appelant pour SES descendants — la boîte elle-même ne se vise pas (§5.3,
   *  `css-modules-guard.test.ts`) : sa matière est un état ci-dessus (`ambiance`). */
  className?: string;
  /** Étape courante de l'écran : quand elle change, le focus entre sur la cible de l'étape (`useFocusEmprunte`). */
  etape?: string | number;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const titreId = useId();
  useModalA11y(boxRef, onClose, { kind: 'ecran-plein-champ', etape }); // aucun early-return : monté = affiché
  const large = body === 'centered-wide' || undefined;
  return (
    <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titreId} data-ambiance={ambiance} className={`worldmap-overlay${className ? ` ${className}` : ''}`}>
      <Row justify="between" className="worldmap-head">
        <h2 id={titreId}>{title}</h2>
        <Row justify="end" className="worldmap-head-actions">
          <ScreenMeta meta={meta} />
          {actions}
          <CadreFermer onClose={onClose}>{closeLabel}</CadreFermer>
        </Row>
      </Row>
      {tabs != null && <Row className="screen-toolbar">{tabs}</Row>}
      {backdrop !== undefined && <SceneBackdrop backdropId={backdrop} />}
      {body === 'full' ? children : (
        <>
          <div className="screen-scroll">
            <div className="screen-colonne" data-large={large}>{children}</div>
          </div>
          {footer != null && <div className="screen-colonne" data-large={large}><CadrePied>{footer}</CadrePied></div>}
        </>
      )}
    </div>
  );
}

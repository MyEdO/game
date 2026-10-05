import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Split, Stack } from './Layout';
import { ramenerEnVue } from './useRamenerEnVue';

/** Breakpoint canon d'empilement — passé aux primitives de placement (`Split stackBelow`,
 *  `Stack rowBelow`) ET lu par la mise en vue du détail : une seule valeur pour les trois. */
export const MASTER_DETAIL_STACK_BREAKPOINT_PX = 700;

/** Marge de tolérance (px) pour « au bord » — évite un flottant de 0,3px (sous-pixel, zoom navigateur)
 *  qui empêcherait `data-at-top`/`data-at-bottom` de se poser alors que le rail EST au bord. */
const EDGE_EPSILON_PX = 1;

/**
 * Stampe `data-at-top`/`data-at-bottom` sur le rail scrollable — SEUL mécanisme de mesure de bord
 * de scroll de la primitive (verdict utilisateur #535 : le cue de bord doit être DYNAMIQUE, un
 * gradient disparaît quand son bord est atteint). Posé ICI (`MasterDetail`, coût nul pour tous ses
 * écrans) plutôt que par consommateur — le RENDU (le cue lui-même) reste scopé créateur en CSS
 * (`docs/charte-ui.md` § « Cue de bord de rail scrollable »), cette primitive ne sait pas qui
 * consomme les attributs. rAF-throttlé (scroll haute fréquence) ; `ResizeObserver` guette aussi le
 * CONTENU (la cérémonie séquentielle de l'étape Caractéristiques change la hauteur du rail en
 * continu, sans événement `scroll` natif) ; mesuré au montage pour poser l'état initial AVANT
 * peinture (`useEffect` synchronisé au commit — pas de flash de cue sur un rail déjà à un bord).
 */
function useScrollEdgeAttrs(ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf: number | null = null;
    const measure = () => {
      raf = null;
      const atTop = el.scrollTop <= EDGE_EPSILON_PX;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - EDGE_EPSILON_PX;
      el.toggleAttribute('data-at-top', atTop);
      el.toggleAttribute('data-at-bottom', atBottom);
    };
    const schedule = () => {
      if (raf != null) return;
      raf = requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // jsdom (tests/galerie) n'implémente pas `ResizeObserver` — dégrade en scroll/resize seuls.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

/** Un clic dans un champ de recherche/texte de la liste ne doit JAMAIS déclencher le scroll — seule
 *  une activation d'un contrôle de SÉLECTION (bouton, option, lien) compte. */
function isActionableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, [role="option"], a[href]') !== null;
}

/**
 * MasterDetail — GABARIT DE COMPOSITION UNIQUE d'un maître-détail (liste à gauche, détail au
 * centre) : deux slots posés sur `Split`/`Stack` (couche LAYOUT), empilement ≤700px (breakpoints
 * canon), 360px sans scroll horizontal. Réconciliation avec la piste ÉCARTÉE `useMasterDetail` (CLAUDE.md « Pistes
 * évaluées puis écartées ») : le rejet portait sur le HOOK D'ÉTAT PARTAGÉ (marchand ⇄ carte
 * divergent après sélection) — il reste écarté. Cette primitive est un GABARIT DE LAYOUT pur :
 * aucun état de sélection dedans, l'appelant possède `list`/`detail` (boutons a11y natifs ou
 * `role="listbox"`/`role="option"` posés par l'appelant selon son besoin).
 *
 * En mode EMPILÉ (liste puis détail l'un sous l'autre), une liste longue peut placer le détail
 * loin sous le pli : une sélection change bien le détail mais ne se VOIT pas (recette #343). On
 * délègue les clics/activations clavier du slot liste (capture, pas de contrat de sélection à
 * connaître) et on scrolle le slot détail en vue une fois le re-render posé.
 */
export function MasterDetail({
  list,
  detail,
  listLabel,
  action,
  aside = 'sm',
  className,
}: {
  /** Slot GAUCHE — items de sélection (l'appelant en possède l'état). */
  list: ReactNode;
  /** Slot CENTRE — détail de l'item sélectionné (ou son état vide). */
  detail: ReactNode;
  /** `aria-label` du conteneur de liste. */
  listLabel?: string;
  /** Slot d'ACTION de la liste (« Ajouter un… ») : collé SOUS le rail, hors de son défilement —
   *  jamais perdu au pied d'une liste longue. */
  action?: ReactNode;
  /** Largeur du rail de liste (`Split` prop `aside`) : `sm` rail étroit, `lg` liste qui respire. */
  aside?: 'sm' | 'lg';
  className?: string;
}) {
  const detailRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);
  useScrollEdgeAttrs(listRef);

  const handleListInteraction = useCallback((e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if (!isActionableTarget(e.target)) return;
    // rAF : laisser le re-render de l'appelant poser le nouveau détail avant de mesurer sa position.
    requestAnimationFrame(() => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      if (!window.matchMedia(`(max-width: ${MASTER_DETAIL_STACK_BREAKPOINT_PX}px)`).matches) return;
      // `block: 'start'` — SEULE politique différente du défaut : empilé, le détail vit SOUS la
      // liste, et 'nearest' ne bougerait rien tant qu'un de ses pixels affleure le bas du champ.
      ramenerEnVue(detailRef.current, { block: 'start' });
    });
  }, []);

  const rail = (
    <Stack
      ref={listRef}
      className="master-detail-list"
      gap="xs"
      rowBelow={MASTER_DETAIL_STACK_BREAKPOINT_PX}
      aria-label={listLabel}
      onClickCapture={handleListInteraction}
      onKeyDownCapture={handleListInteraction}
    >
      {list}
    </Stack>
  );
  return (
    <Split className={className} aside={aside} gap="lg" stackBelow={MASTER_DETAIL_STACK_BREAKPOINT_PX}>
      {action == null ? rail : (
        <div className="master-detail-rail">
          {rail}
          <div className="master-detail-action">{action}</div>
        </div>
      )}
      <div ref={detailRef}>{detail}</div>
    </Split>
  );
}

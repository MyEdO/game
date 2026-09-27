import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { atteignable, poserFocus, useFocusEmprunte, visibleFocusables } from './focus';
import { dialogueDuDessus, useDismissLayer } from './useDismissLayer';
import { subscribeDismissStack, type OnDismiss } from '../state/dismissStack';
import { ModalSubject } from './ModalSubject';
import { Row } from './Layout';
import { CadrePied, CadreFermer, PRIMAIRE_DU_PIED, PIED_DU_CADRE, CROIX_DU_CADRE } from './Cadre';
import type { Combatant } from '../engine/types';

/**
 * CADRE PARTAGÉ de toutes les modales du jeu — source unique du squelette (voile plein écran + boîte +
 * titre + bandeau « sujet » optionnel). Uniformise l'aspect ET la qualité : chaque modale ne fournit
 * que son contenu propre (résultat, actions). Le bandeau `subject` (portrait + nom du combattant
 * concerné, via `ModalSubject`) garantit qu'on sait TOUJOURS à qui la modale s'applique.
 *
 * Boîte en colonne : tête (titre, croix), bandeau `subject`, corps `.modal-body` qui défile
 * (`children`), pied `CadrePied` (`footer`, `Cadre.tsx`) qui reste. `champ`, `plein`, `voile`, `taille` et
 * `gangrene` sont des ÉTATS posés en `data-*` sur le voile (`styles/modal.css`).
 *
 * @clavier-hors-registre Tab et Échap appartiennent au DIALOGUE ouvert (`useModalA11y`, pattern
 * WAI-ARIA) : ni raccourcis d'application ni remappables (garde `ui/raccourcis-registre.test.ts`).
 */

/** Options d'un GROUPE DE CHOIX de la modale (segmented `.seg`, grille `.rm-loc-grid`, sélecteur de dé
 *  `.rm-die-pick`) — `<button>` qui vivent HORS du pied (`.cadre-pied`). Le clavier doit pouvoir les COCHER,
 *  sinon une étape « choix » (déviation de Critique, Parade/Esquive, dé choisi…) est un cul-de-sac :
 *  son bouton de validation reste garrotté. */
function choiceOptions(box: HTMLElement): HTMLButtonElement[] {
  return [...box.querySelectorAll<HTMLButtonElement>('.seg button, .rm-loc-grid button, .rm-die-pick button')]
    .filter(atteignable);
}

/** GESTE d'un dialogue : un bouton `.btn`, ou l'onglet ouvert d'une barre `<Tabs>`. */
const GESTE = '.btn, [role="tab"][aria-selected="true"]';

/** Gestes VISIBLES de la boîte, sauf la croix du cadre. */
const gestesDe = (box: HTMLElement): HTMLElement[] =>
  visibleFocusables(box).filter((el) => el.matches(GESTE) && !el.matches(CROIX_DU_CADRE));

/** Cible de focus de la boîte — source UNIQUE, partagée par l'ouverture et le sauvetage. Elle ne
 *  tombe que sur un GESTE du dialogue, jamais sur un autre contrôle (jauge, portrait, lien) ni sur la
 *  croix du cadre : option de choix, sinon primaire du pied, sinon 1er geste du corps, sinon 1er geste
 *  (de sortie) du pied, sinon la boîte elle-même (`tabindex=-1`) : le focus entre toujours dans le
 *  dialogue. Patron de dialogue WAI-ARIA (APG) : le point de départ du travail, jamais la sortie.
 *  - une option RETENUE porte `aria-pressed` (`selected` d'`OptionChooser`) ; l'option `.btn-primary`
 *    n'est que mise en avant, et c'est elle qui est OFFERTE la première ;
 *  - `initial` : une option seulement si AUCUNE n'est retenue (le 1er Entrée la coche, au lieu de
 *    taper un bouton de validation inerte) ;
 *  - `rescue` : le groupe de choix RÉVÉLÉ (l'option retenue, sinon l'offerte) — c'est lui qui vient de
 *    remplacer le contrôle disparu. */
function focusTarget(box: HTMLElement, mode: 'initial' | 'rescue'): HTMLElement {
  const gestes = gestesDe(box);
  const opts = choiceOptions(box);
  const retenue = opts.find((b) => b.getAttribute('aria-pressed') === 'true');
  const offerte = opts.find((b) => b.classList.contains('btn-primary')) ?? opts[0];
  const choice = mode === 'rescue' ? (retenue ?? offerte) : retenue ? undefined : offerte;
  const pied = gestes.filter((el) => el.closest(PIED_DU_CADRE));
  const corps = gestes.filter((el) => !el.closest(PIED_DU_CADRE));
  const cible = choice ?? pied.find((el) => el.matches(PRIMAIRE_DU_PIED)) ?? corps[0] ?? pied[0];
  if (cible) return cible;
  if (!box.hasAttribute('tabindex')) box.tabIndex = -1;
  return box;
}

/** Cible d'ouverture d'un dialogue : `focusTarget` initial — évite que le focus atterrisse sur un
 *  bouton sans intérêt (« rien ne répond »). */
const cibleDialogue = (box: HTMLElement) => focusTarget(box, 'initial');

/** Cible d'une surface EMBARQUÉE dans un dialogue déjà ouvert (jet posé dans l'infirmerie) : la cible
 *  d'ouverture de ce dialogue, qui porte les gestes de la surface à son pied. Montée AVEC son dialogue
 *  (le focus n'y est pas encore), elle n'emprunte rien : le dialogue emprunte pour elle. */
export const cibleEmbarquee = (box: HTMLElement): HTMLElement | null => {
  const dialogue = box.closest<HTMLElement>('[role="dialog"]');
  return dialogue && dialogue.contains(document.activeElement) ? focusTarget(dialogue, 'initial') : null;
};

/** Comportement a11y des dialogues (pattern WAI-ARIA) : focus déplacé dans la boîte à l'ouverture,
 *  piège de focus (Tab/Shift+Tab bouclent), Échap = `onClose` quand il existe — seule la modale du
 *  DESSUS de la pile (`dialogueDuDessus`, la dernière ouverte) réagit, jamais le dernier
 *  `[role=dialog]` de l'ordre du document. Consommé par tout dialogue de la pile.
 *
 *  @param kind libellé de DIAGNOSTIC de la couche empilée.
 *  @param actif le dialogue est-il RÉELLEMENT à l'écran. DISTINCT d'« annulable » : un composant monté
 *   en permanence (menu système fermé) ou qui rend `null` sous condition n'a AUCUNE couche — sans quoi il empilerait une couche fantôme qui mange le
 *   congédiement de toute la session.
 *  @param etape l'étape courante du dialogue (`useFocusEmprunte`). */
export function useModalA11y(
  boxRef: RefObject<HTMLDivElement>,
  onClose?: OnDismiss,
  { kind = 'modale', actif = true, etape }: { kind?: string; actif?: boolean; etape?: string | number } = {},
) {
  useFocusEmprunte(boxRef, actif, cibleDialogue, etape);
  // SAUVETAGE du focus : un contrôle focalisé que le rendu DÉMONTE (« Résilience » cède la place au
  // groupe de choix du dé, « Lancer » au résultat…) laisse le focus sur <body> — le piège Tab est
  // rompu et la tabulation suivante s'échappe vers l'arrière-plan. On le replace DANS la boîte, sur la
  // cible révélée. Observateur de MUTATIONS et non effet de rendu : la transition peut venir de l'état
  // LOCAL d'une rangée, qui ne re-rend pas cette boîte — un effet d'ici ne serait pas rejoué.
  useEffect(() => {
    const box = boxRef.current;
    if (!actif || !box) return;
    const had = { current: box.contains(document.activeElement) };
    const onFocusIn = () => { had.current = true; };
    box.addEventListener('focusin', onFocusIn);
    const obs = new MutationObserver(() => {
      if (!had.current || !document.body.contains(box)) return;
      if (dialogueDuDessus() !== box) return;
      const ae = document.activeElement;
      if (ae && ae !== document.body && box.contains(ae)) return;
      // Focus parti VOLONTAIREMENT sur un élément vivant hors de la boîte : on ne le rapatrie pas.
      if (ae && ae !== document.body && document.body.contains(ae)) { had.current = false; return; }
      poserFocus(focusTarget(box, 'rescue'));
    });
    obs.observe(box, { childList: true, subtree: true });
    return () => { obs.disconnect(); box.removeEventListener('focusin', onFocusIn); };
  }, [boxRef, actif]);
  // REPLI quand une couche se retire (dialogue fermé, bulle, panneau) en laissant le focus sur <body> —
  // son invocateur n'existe plus : le dialogue qui DEVIENT le dessus le reprend. Évaluation
  // d'ingénierie, au-delà de l'APG cité par `useFocusEmprunte`. Lu à la tâche SUIVANTE, jamais dans
  // le retrait : congédiée par Échap (`dismissTop`), une couche est dépilée AVANT que le rendu ne
  // retire sa boîte ; retirée par un `blur` (bulle de focus), elle l'est pendant que le focus passe
  // au contrôle suivant, <body> le temps de l'événement.
  useEffect(() => {
    const box = boxRef.current;
    if (!actif || !box) return;
    let relecture: ReturnType<typeof setTimeout> | undefined;
    const reprendre = () => {
      const ae = document.activeElement;
      if (ae && ae !== document.body) return;
      if (dialogueDuDessus() !== box) return;
      poserFocus(focusTarget(box, 'rescue'));
    };
    const desabonner = subscribeDismissStack((e) => {
      if (e.type !== 'pop') return;
      clearTimeout(relecture);
      relecture = setTimeout(reprendre, 0);
    });
    return () => { desabonner(); clearTimeout(relecture); };
  }, [boxRef, actif]);
  // CONGÉDIEMENT : le dialogue est une COUCHE de la pile (`dismissStack`, #1476) — Échap et le
  // bouton B de la manette y arrivent par la couture unique `resoudreEchap`, qui congédie la couche
  // du DESSUS (la dernière ouverte), jamais le dernier `[role=dialog]` de l'ordre du document — un
  // portal ajouté en fin de `body` mentait sur l'ordre d'ouverture. Sans `onClose`, la couche est
  // BLOQUANTE : elle consomme la touche sans rien fermer (un jet posé doit être résolu). Un `onClose`
  // qui rend `false` garde la couche à l'écran (congédiement PARTIEL, #1752).
  useDismissLayer(kind, onClose ?? null, actif, undefined, { boite: boxRef, dialogue: true });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const box = boxRef.current;
      if (!box || dialogueDuDessus() !== box) return;
      // Un CONTRÔLE focalisé possède sa touche, OÙ QU'IL VIVE dans le document — `document.activeElement`
      // est global, alors que la boîte n'est qu'un sous-arbre. Juger par CONTAINMENT (`box.contains(ae)`)
      // était faux au socle : tout contrôle actionnable rendu en PORTAL (`createPortal(document.body)`)
      // — popover de règle, menu, infobulle actionnable — se faisait voler sa touche par la boîte
      // pendant qu'une modale était ouverte (recette B3a 13b/13c : Entrée sur « Ouvrir la fiche »
      // résolvait la cascade via le repli « Tout lancer »).
      const ae = document.activeElement;
      const activeButton = ae instanceof HTMLButtonElement && !ae.disabled;
      // Focus posé sur un ÉLÉMENT RÉEL hors de la boîte (portal) : il n'appartient pas à ce dialogue,
      // la boîte ne décide pas pour lui. `body` (focus nulle part) reste à la boîte, c'est son repli.
      const focusElsewhere = !!ae && ae !== document.body && !box.contains(ae);
      const els = visibleFocusables(box);
      if (e.key === 'Enter') {
        // Bouton focalisé → activation NATIVE (cocher une option de choix, cliquer Lancer/Terminer…).
        // Depuis un champ de saisie, Entrée SOUMET la boîte (nom de campagne → « Enregistrer », mise de
        // taverne → « Jouer », semaine en mer → « Valider la semaine ») : un champ qui doit garder son
        // Entrée la CONSOMME chez lui (`preventDefault` + `stopPropagation`, cf. le sélecteur de dé de
        // `ForcedRollPicker`), il ne se déclare pas ici.
        // Sinon (focus sur la boîte/aucun) → repli sur le bouton primaire.
        if (activeButton || focusElsewhere) return;
        const primary = box.querySelector<HTMLElement>(PRIMAIRE_DU_PIED);
        if (primary && primary.getClientRects().length) { e.preventDefault(); primary.click(); }
        return;
      }
      // Flèches = navigation de focus (roving) sur TOUS les contrôles visibles → options de choix, toggles
      // segmentés (Parade/Esquive) et boutons d'action navigables au clavier seul, sans chasser le Tab.
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        // NE PAS voler les flèches d'un champ de formulaire (select/number/texte) → édition native préservée.
        if (ae && /^(SELECT|INPUT|TEXTAREA)$/.test(ae.tagName)) return;
        // MÊME frontière que pour Entrée : un contrôle porté par portal navigue chez lui (un popover a
        // ses propres flèches), la boîte ne rove pas par-dessus.
        if (focusElsewhere) return;
        if (!els.length) return;
        e.preventDefault();
        const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[i < 0 ? (dir === 1 ? 0 : els.length - 1) : (i + dir + els.length) % els.length].focus();
        return;
      }
      if (e.key !== 'Tab') return;
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      const horsDesControles = active === box || !box.contains(active);
      if (e.shiftKey && (active === first || horsDesControles)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || horsDesControles)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [boxRef]);
}

/** Nom du dialogue : un `title` rendu en tête (il EST le nom accessible), ou un `label` quand le
 *  corps porte déjà son propre titre (fiche, Codex) — jamais un dialogue sans nom. */
type ModalName = { title: ReactNode; label?: never } | { label: string; title?: never };

export function Modal({
  title,
  label,
  subject,
  champ = false,
  plein = false,
  voile,
  taille,
  gangrene,
  kind,
  className,
  onClose,
  croix = false,
  backdropClose = false,
  footer,
  etape,
  children,
}: ModalName & {
  /** Combattant concerné → tuile-portrait en bandeau (omis si absent). */
  subject?: Combatant | null;
  /** CHAMP LISIBLE : le champ de bataille se lit sous la fenêtre (voile allégé, ancrage par bandes
   *  sur l'écran de campagne). État posé en `data-champ` sur le voile. */
  champ?: boolean;
  /** PLEIN ÉCRAN ≤560 : la fenêtre prend tout le téléphone. Posé par la seule `RollShell`, pour
   *  tout hôte de jet. État posé en `data-plein` sur le voile. */
  plein?: boolean;
  /** `'opaque'` : sous les modales de jet, la scène n'a plus à rester lisible et une modale peut
   *  s'ouvrir par-dessus (fin de combat). `'reference'` : lecteur passif (fiche) sous les modales
   *  actives. Défaut : voile allégé, au rang le plus haut. */
  voile?: 'opaque' | 'reference';
  /** Boîte : `'apercu'` (380px, inspection d'un combattant), `'lecture'` (560px, page de document ou
   *  de butin), `'large'` (760px), `'planche'` (fiche : 880px, hauteur stable), `'vaste'` (écran
   *  hébergé bord à bord). Défaut : 520px. */
  taille?: 'apercu' | 'lecture' | 'large' | 'planche' | 'vaste';
  /** Gangrène du cadre (#492) : la Corruption du porteur ternit l'or de la boîte. */
  gangrene?: 'ronge' | 'seuil';
  /** Nom de la couche de congédiement (`dismissStack`) — défaut `modale`. */
  kind?: string;
  /** Crochet d'appelant pour SES descendants — la boîte elle-même ne se vise pas (§5.3,
   *  `css-modules-guard.test.ts`) : géométrie et matière sont des états ci-dessus. */
  className?: string;
  /** Échap = ce callback (l'équivalent du bouton Fermer/Annuler visible). Absent → modale
   *  NON annulable (un jet posé doit être résolu). `false` en retour : la boîte RESTE montée et
   *  garde sa couche (`dismissStack.ts`). */
  onClose?: OnDismiss;
  /** La tête porte la croix de fermeture (`CadreFermer`) — lecteurs passifs sans pied (planche). */
  croix?: boolean;
  /** Cliquer le voile ferme aussi (lecteurs passifs : document, fiche…) — jamais par défaut. */
  backdropClose?: boolean;
  /** PIED : les gestes de sortie, hors du défileur (`CadrePied`). */
  footer?: ReactNode;
  /** Étape courante du dialogue : quand elle change, le focus entre sur la cible de l'étape (`useFocusEmprunte`). */
  etape?: string | number;
  children?: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const titreId = useId();
  useModalA11y(boxRef, onClose, { kind, etape }); // aucun early-return : la boîte montée est la boîte affichée
  const fermer = croix && onClose ? <CadreFermer onClose={onClose} /> : null;
  const titre = label === undefined ? <h3 id={titreId} className="modal-title">{title}</h3> : null;
  return (
    <div
      className="modal-overlay"
      data-champ={champ || undefined}
      data-plein={plein || undefined}
      data-voile={voile}
      data-taille={taille}
      data-gangrene={gangrene}
      onClick={backdropClose && onClose ? onClose : undefined}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={label === undefined ? titreId : undefined}
        aria-label={label}
        className={`modal${className ? ` ${className}` : ''}`}
        onClick={backdropClose ? (e) => e.stopPropagation() : undefined}
      >
        {fermer ? <Row justify={titre ? 'between' : 'end'} className="modal-tete">{titre}{fermer}</Row> : titre}
        {subject && <ModalSubject c={subject} />}
        <div className="modal-body">{children}</div>
        <CadrePied>{footer}</CadrePied>
      </div>
    </div>
  );
}

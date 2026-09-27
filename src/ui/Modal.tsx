import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { useDismissLayer } from './useDismissLayer';
import type { OnDismiss } from '../state/dismissStack';
import { ModalSubject } from './ModalSubject';
import type { Combatant } from '../engine/types';

/**
 * CADRE PARTAGÉ de toutes les modales du jeu — source unique du squelette (voile plein écran + boîte +
 * titre + bandeau « sujet » optionnel). Uniformise l'aspect ET la qualité : chaque modale ne fournit
 * que son contenu propre (résultat, actions). Le bandeau `subject` (portrait + nom du combattant
 * concerné, via `ModalSubject`) garantit qu'on sait TOUJOURS à qui la modale s'applique.
 *
 * `variant` choisit la famille de classes ('roll' = roll-modal, 'plain' = boîte
 * nue stylée par `className`) ; `className` ajoute une classe spécifique (ex. inspection). Le contenu
 * spécifique passe en `children`.
 */
const FOCUSABLE = 'button, [href], input, select, textarea';

/** Focusables VISIBLES d'un conteneur (non `disabled`, effectivement rendus) — source UNIQUE du
 *  calcul partagé par le piège Tab et tout consommateur clavier. */
export function visibleFocusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0);
}

/** Comportement a11y des dialogues (pattern WAI-ARIA) : focus déplacé dans la boîte à l'ouverture,
 *  piège de focus (Tab/Shift+Tab bouclent), Échap = `onClose` quand il existe — seule la modale du
 *  DESSUS (dernier [role=dialog] du document) réagit.
 *
 *  @clavier-hors-registre Tab et Échap appartiennent ici au DIALOGUE ouvert (pattern WAI-ARIA) : ils
 *  ne sont ni des raccourcis d'application ni remappables (garde `ui/raccourcis-registre.test.ts`).
 *
 *  Pour les dialogues au markup spécifique (Fiche, Inspection…) qui ne passent pas par <Modal> :
 *  poser role="dialog" + appeler ce hook. */
/** Options d'un GROUPE DE CHOIX de la modale (segmented `.seg`, grille `.rm-loc-grid`, sélecteur de dé
 *  `.rm-die-pick`) — `<button>` qui vivent HORS `.modal-actions`. Le clavier doit pouvoir les COCHER,
 *  sinon une étape « choix » (déviation de Critique, Parade/Esquive, dé choisi…) est un cul-de-sac :
 *  son bouton de validation reste garrotté. */
function choiceOptions(box: HTMLElement): HTMLButtonElement[] {
  return [...box.querySelectorAll<HTMLButtonElement>('.seg button, .rm-loc-grid button, .rm-die-pick button')]
    .filter((el) => !el.disabled && el.getClientRects().length > 0);
}

/** Cible de focus de la boîte — source UNIQUE, partagée par l'ouverture et le sauvetage :
 *  option de choix, sinon bouton primaire de la barre, sinon 1er focusable.
 *  - `initial` : une option seulement si AUCUNE n'est tranchée (le 1er Entrée la coche, au lieu de
 *    taper un bouton de validation inerte) ;
 *  - `rescue` : le groupe de choix RÉVÉLÉ prime (l'option en cours, sinon la première) — c'est lui
 *    qui vient de remplacer le contrôle disparu. */
function focusTarget(box: HTMLElement, mode: 'initial' | 'rescue'): HTMLElement | null {
  const opts = choiceOptions(box);
  const selected = opts.find((b) => b.classList.contains('on') || b.classList.contains('btn-primary'));
  const choice = mode === 'rescue' ? (selected ?? opts[0] ?? null) : (opts.length && !selected ? opts[0] : null);
  const primary = box.querySelector<HTMLElement>('.modal-actions .btn-primary:not([disabled])');
  return choice ?? (primary?.getClientRects().length ? primary : null) ?? visibleFocusables(box)[0] ?? null;
}

/** @param kind identifiant STABLE de la surface empilée (`dismissStack`) — il n'entre dans aucun rang.
 *  @param actif le dialogue est-il RÉELLEMENT à l'écran. DISTINCT d'« annulable » : un composant monté
 *   en permanence (menu système fermé) ou qui rend `null` sous condition n'a AUCUNE couche — sans quoi il empilerait une couche fantôme qui mange le
 *   congédiement de toute la session. */
export function useModalA11y(
  boxRef: RefObject<HTMLDivElement>,
  onClose?: OnDismiss,
  { kind = 'modale', actif = true }: { kind?: string; actif?: boolean } = {},
) {
  // Focus initial UTILE (cf. `focusTarget`) : évite que le focus atterrisse sur un bouton sans intérêt
  // (« rien ne répond »).
  // RESTORE : à la fermeture, le focus revient à l'élément qui l'avait AVANT l'ouverture (déclencheur du
  // bouton/carte) — sinon un joueur clavier perd son point de navigation à chaque modale fermée.
  // `actif` fait partie des DÉPENDANCES : une boîte qui n'existe qu'à l'ouverture (`{actif && <div
  // ref=…>}`) n'a pas d'élément au premier rendu, et l'objet `ref` ne change jamais d'identité — sans
  // cette dépendance l'effet sortirait à vide une fois pour toutes (#1752).
  useEffect(() => {
    const box = boxRef.current;
    if (!actif || !box) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusTarget(box, 'initial')?.focus();
    return () => {
      if (previouslyFocused && document.body.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [boxRef, actif]);
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
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== box) return;
      const ae = document.activeElement;
      if (ae && ae !== document.body && box.contains(ae)) return;
      // Focus parti VOLONTAIREMENT sur un élément vivant hors de la boîte : on ne le rapatrie pas.
      if (ae && ae !== document.body && document.body.contains(ae)) { had.current = false; return; }
      focusTarget(box, 'rescue')?.focus();
    });
    obs.observe(box, { childList: true, subtree: true });
    return () => { obs.disconnect(); box.removeEventListener('focusin', onFocusIn); };
  }, [boxRef, actif]);
  // CONGÉDIEMENT : le dialogue est une COUCHE de la pile (`dismissStack`, #1476) — Échap et le
  // bouton B de la manette y arrivent par la couture unique `resoudreEchap`, qui congédie la couche
  // du DESSUS (la dernière ouverte), jamais le dernier `[role=dialog]` de l'ordre du document — un
  // portal ajouté en fin de `body` mentait sur l'ordre d'ouverture. Sans `onClose`, la couche est
  // BLOQUANTE : elle consomme la touche sans rien fermer (un jet posé doit être résolu). Un `onClose`
  // qui rend `false` garde la couche à l'écran (congédiement PARTIEL, #1752).
  useDismissLayer(kind, 'modale', onClose ?? null, actif);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const box = boxRef.current;
      if (!box) return;
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== box) return;
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
        const primary = box.querySelector<HTMLElement>('.modal-actions .btn-primary:not([disabled])');
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
      if (e.shiftKey && (active === first || !box.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !box.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [boxRef]);
}

const VARIANT_CLASS = { roll: ' roll-modal', plain: '' } as const;

export function Modal({
  title,
  subject,
  variant = 'roll',
  voile,
  kind,
  className,
  onClose,
  backdropClose = false,
  children,
}: {
  title: ReactNode;
  /** Combattant concerné → tuile-portrait en bandeau (omis si absent). */
  subject?: Combatant | null;
  variant?: 'roll' | 'plain';
  /** Voile OPAQUE, sous les modales de jet : la scène n'a plus à rester lisible et une modale peut
   *  s'ouvrir par-dessus (fin de combat). Défaut : voile allégé, au rang le plus haut. */
  voile?: 'opaque';
  /** Nom de la couche de congédiement (`dismissStack`) — défaut `modale`. */
  kind?: string;
  className?: string;
  /** Échap = ce callback (l'équivalent du bouton Fermer/Annuler visible). Absent → modale
   *  NON annulable (un jet posé doit être résolu). */
  onClose?: () => void;
  /** Cliquer le voile ferme aussi (lecteurs passifs : document, fiche…) — jamais par défaut. */
  backdropClose?: boolean;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // NOM ACCESSIBLE : le titre rendu EST le nom du dialogue — aucun appelant n'a à le redire.
  const titreId = useId();
  useModalA11y(boxRef, onClose, kind ? { kind } : undefined); // aucun early-return : la boîte montée est la boîte affichée
  return (
    <div className="modal-overlay" data-voile={voile} onClick={backdropClose && onClose ? onClose : undefined}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        className={`modal${VARIANT_CLASS[variant]}${className ? ` ${className}` : ''}`}
        onClick={backdropClose ? (e) => e.stopPropagation() : undefined}
      >
        <h3 id={titreId}>{title}</h3>
        {subject && <ModalSubject c={subject} />}
        {children}
      </div>
    </div>
  );
}

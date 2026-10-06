/**
 * APPUI LONG — primitive PARTAGÉE du geste secondaire au doigt et au stylet (spec HUD combat, geste
 * secondaire d'une alvéole, d'un portrait, d'un jeton : clic droit à la souris, appui long au
 * tactile, touche Menu au clavier).
 *
 * Le geste s'ARME au `pointerdown` du BOUTON PRINCIPAL d'un pointeur qui n'est PAS une souris, se
 * DÉCLENCHE au bout de `delai`, et s'ANNULE au relâchement comme au mouvement au-delà de `TOLERANCE`
 * (un glissement n'est pas un appui). La souris a le clic droit : son clic gauche, même LENT, reste
 * le geste primaire de la surface — sur le plateau, #1822 (2026-10-05) : « le clique gauche déclenche
 * l'attaque et le clique droit inspecte » ; la primitive l'étend à toutes ses surfaces.
 *
 * La SUITE de l'appui s'écoute À LA FENÊTRE, jamais sur l'élément : dès que le pointeur SORT de
 * l'alvéole, les `pointermove`/`pointerup` ne lui sont plus destinés (ils ne sont dispatchés qu'aux
 * ancêtres de la CIBLE), et le glissement n'annulait donc rien — mesuré en recette navigateur
 * (2026-08-23 : glissements de 25 px puis 60 px, modale ouverte quand même). La capture de pointeur
 * (`setPointerCapture`) est demandée en plus, là où le navigateur la porte. Le franchissement de
 * BORDURE (`pointerleave`) n'est plus, lui, un signal d'annulation : il ment dans les deux sens —
 * muet quand le pointeur part sous une surface qui capte le survol, et ÉMIS sous un pointeur immobile
 * dès qu'un re-rendu déplace la case sous lui. Seule la DISTANCE parcourue décide.
 *
 * L'appui qui a déclenché AVALE la salve d'événements natifs qui le suit (`consomme`, lu par `click`
 * ET par `contextmenu`) : sans quoi le doigt lèverait le geste secondaire PUIS l'action primaire de
 * l'alvéole, et le `contextmenu` que le navigateur dérive de l'appui long rappellerait le geste.
 * L'avalement vaut TANT QUE l'appui déclenché est tenu, puis `FENETRE_AVALEMENT` à compter du
 * RELÂCHEMENT : un doigt levé longtemps après le seuil ne rejoue pas le geste primaire. Le
 * `pointerdown` suivant que l'hôte lui TRANSMET remet tout à zéro (le plateau ne transmet que ceux
 * d'une entité à fiche).
 */
import { useCallback, useEffect, useRef } from 'react';

/** Seuil d'immobilité, en pixels : au-delà, le doigt glisse (défilement, visée), il n'appuie plus. */
const TOLERANCE = 10;
/** Seuil de durée par défaut, en ms — au-delà d'un clic ordinaire, en deçà d'une attente ressentie. */
export const DELAI_APPUI_LONG = 450;
/** Durée, comptée depuis le RELÂCHEMENT, pendant laquelle l'appui long déclenché AVALE encore les
 *  événements natifs qui le suivent (au doigt, le navigateur émet `contextmenu` PUIS `click` après le
 *  lever) : chacun d'eux consulte le même verdict, et la fenêtre expire d'elle-même — une activation
 *  clavier ultérieure n'est pas avalée. */
export const FENETRE_AVALEMENT = 700;

/** Les trois événements de FENÊTRE qui composent la suite d'un appui armé. */
const SUITE = ['pointermove', 'pointerup', 'pointercancel'] as const;

/** L'appui tel que la primitive le lit : position, bouton, et l'élément à qui demander la CAPTURE.
 *  Type STRUCTUREL (jamais `React.PointerEvent`) — la primitive ne dépend d'aucun typage de React. */
export interface AppuiPointeur {
  clientX: number;
  clientY: number;
  button?: number;
  pointerId?: number;
  /** `'mouse'` : l'appui n'arme rien (la souris a le clic droit). Absent = pointeur non souris. */
  pointerType?: string;
  currentTarget?: { setPointerCapture?(id: number): void; releasePointerCapture?(id: number): void } | null;
}

export interface LongPress {
  handlers: {
    onPointerDown: (e: AppuiPointeur) => void;
  };
  /** L'événement en cours suit-il un appui long DÉJÀ déclenché ? Lisible par CHACUN des événements
   *  natifs de la salve (`contextmenu` PUIS `click` au doigt) : la réponse tient tant que l'appui est
   *  tenu, puis `FENETRE_AVALEMENT` ms après son relâchement ; le `pointerdown` suivant la remet à zéro. */
  consomme: () => boolean;
  /** DÉSARME l'appui en cours, sans attendre la suite : l'hôte qui lit lui-même un autre geste sur le
   *  même pointeur (panoramique, second doigt) le tranche avant la `TOLERANCE` de la primitive. */
  annuler: () => void;
}

export function useLongPress(action: (() => void) | undefined, delai = DELAI_APPUI_LONG): LongPress {
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const declenche = useRef(0);
  /** Instant du RELÂCHEMENT de l'appui déclenché ; 0 tant qu'il est tenu. */
  const relache = useRef(0);
  /** Capture de pointeur EN COURS, à rendre à l'annulation. */
  const capture = useRef<{ cible: NonNullable<AppuiPointeur['currentTarget']>; id: number } | null>(null);
  /** Écouteur de fenêtre POSÉ (donc à retirer) : sa présence EST l'état « appui armé ». */
  const suite = useRef<((e: Event) => void) | null>(null);
  const geste = useRef(action);
  geste.current = action;

  const annuler = useCallback(() => {
    // Un appui DÉJÀ déclenché que l'on désarme est relâché ici : sa fenêtre d'avalement court.
    if (declenche.current > 0 && relache.current === 0) relache.current = Date.now();
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    depart.current = null;
    const ecoute = suite.current;
    suite.current = null;
    if (ecoute) for (const type of SUITE) window.removeEventListener(type, ecoute);
    const prise = capture.current;
    capture.current = null;
    // Le navigateur rend la capture de lui-même dans plusieurs cas (élément retiré, `pointercancel`).
    try {
      prise?.cible.releasePointerCapture?.(prise.id);
    } catch {
      capture.current = null;
    }
  }, []);

  useEffect(() => annuler, [annuler]);

  /** La SUITE de l'appui, lue à la fenêtre : seul le DÉPLACEMENT au-delà du seuil — ou la fin du
   *  contact — annule. Le pointeur peut avoir quitté l'alvéole depuis longtemps. */
  const surLaSuite = useCallback(
    (e: Event) => {
      if (e.type !== 'pointermove') {
        annuler();
        return;
      }
      const d = depart.current;
      if (!d) return;
      const { clientX, clientY } = e as unknown as { clientX: number; clientY: number };
      if (Math.abs(clientX - d.x) > TOLERANCE || Math.abs(clientY - d.y) > TOLERANCE) annuler();
    },
    [annuler],
  );

  const onPointerDown = useCallback(
    (e: AppuiPointeur) => {
      annuler();
      declenche.current = 0;
      relache.current = 0;
      if (!geste.current || e.pointerType === 'mouse') return;
      // BOUTON PRINCIPAL seulement. Là où le `contextmenu` naît À L'APPUI (macOS, Linux), un clic
      // droit maintenu déclencherait le geste une 2ᵉ fois au bout du délai — à N≥2, le panneau que
      // le clic droit vient d'ouvrir se refermerait tout seul.
      if ((e.button ?? 0) !== 0) return;
      depart.current = { x: e.clientX, y: e.clientY };
      // CAPTURE (là où le navigateur la porte) : le pointeur reste rattaché à l'alvéole jusqu'au
      // relâchement — au doigt, c'est ce qui fait arriver la suite du geste à la bonne cible.
      const cible = e.currentTarget;
      if (cible?.setPointerCapture && typeof e.pointerId === 'number') {
        try {
          cible.setPointerCapture(e.pointerId);
          capture.current = { cible, id: e.pointerId };
        } catch {
          capture.current = null;
        }
      }
      suite.current = surLaSuite;
      for (const type of SUITE) window.addEventListener(type, surLaSuite);
      minuteur.current = setTimeout(() => {
        minuteur.current = null;
        declenche.current = Date.now();
        relache.current = 0;
        geste.current?.();
      }, delai);
    },
    [annuler, delai, surLaSuite],
  );

  const consomme = useCallback(
    () => declenche.current > 0 && (relache.current === 0 || Date.now() - relache.current < FENETRE_AVALEMENT),
    [],
  );

  return { handlers: { onPointerDown }, consomme, annuler };
}

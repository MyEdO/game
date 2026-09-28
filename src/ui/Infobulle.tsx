/**
 * COUCHE D'INFOBULLE — une boîte par ancrage (`docs/charte-ui.md`, « une seule infobulle par ancrage,
 * jamais une 2ᵉ boîte concurrente »). La couche possède la position (`BoiteAncree`), le pont de
 * survol, l'épinglage, la sourdine, Échap, le clic hors de la boîte, `aria-describedby`, le portail,
 * le toucher et ↓. Le CONTENU (texte, rôle et activation de l'ancrage, nom accessible) appartient à
 * l'appelant, qui ne lui passe que des booléens (`OptionsInfobulle`).
 *
 * ANCRAGE déclaré au balisage : l'appelant étale `ancrage` sur l'élément qui l'ancre (attribut
 * `data-infobulle`, présent dès le rendu). La couche n'écoute jamais cet élément : elle écoute le
 * DOCUMENT et résout l'ancrage de chaque événement au moment où il arrive (`ancrageDe`). La racine de
 * la boîte porte un marqueur d'ARRÊT : un nœud de la boîte ne résout aucun ancrage au-delà d'elle.
 *
 * DÉLÉGATION UNIQUE : un seul jeu d'écouteurs du document pour toute la couche, posé à la première
 * instance inscrite et retiré à la dernière (patron de `useDismissLayer.ts`, `brancherPorte`). Chaque
 * événement est routé à l'instance qui POSSÈDE l'ancrage résolu (`inscrites`, clé : la valeur
 * `data-infobulle` de l'ancrage), et les autres instances l'apprennent comme un geste AILLEURS.
 *
 * CONGÉDIÉE : Échap, un clic hors de la boîte, la porte, la sourdine ou la bascule referment la boîte ;
 * si le pointeur ou le focus occupait alors l'ancrage ou la boîte, ce qui continue de l'occuper ne la
 * rouvre pas (APG, Tooltip Pattern : « Escape: Dismisses the Tooltip ») — le focus rendu à l'ancrage,
 * un survol sans sortie, un focus redonné sans départ. Une ENTRÉE neuve (le pointeur ou le focus
 * arrivé d'ailleurs, `quitte` passé) ou un geste explicite (↓, bascule) rouvre.
 *
 * FOCUS : tant que la boîte est épinglée ou tient le focus, elle l'EMPRUNTE (`useFocusEmprunte`), et
 * son origine est le contrôle de l'ancrage (`controleDe`) — jamais le nœud focalisé au hasard.
 *
 * @clavier-hors-registre ↓ appartient au CONTRÔLE focalisé de l'ancrage (`aria-keyshortcuts`), où le
 * registre s'efface (`notWhenControlFocused`, `state/keybindings.ts`) ; la délégation le lit au document
 * parce que la couche n'écoute jamais l'ancrage. Échap passe par la pile (`useDismissLayer`).
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { BoiteAncree, usePlacementAncre } from './BoiteAncree';
import { useDismissLayer } from './useDismissLayer';
import { focusSansIntention, useFocusEmprunte } from './focus';

const ANCRE = 'data-infobulle';
const ARRET = 'data-infobulle-arret';
const ANCRE_OU_ARRET = `[${ANCRE}],[${ARRET}]`;
const CONTROLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const PONT_DE_SURVOL_MS = 160;
const LARGEUR = 320;

/** L'ancrage d'un nœud : le `[data-infobulle]` le plus proche, sauf si la racine d'une boîte vient avant. */
const ancrageDe = (n: EventTarget | null): HTMLElement | null => {
  if (!(n instanceof Element)) return null;
  const el = n.closest<HTMLElement>(ANCRE_OU_ARRET);
  return el?.hasAttribute(ANCRE) ? el : null;
};

/** Le contrôle que désigne un ancrage : lui-même s'il est focalisable, sinon son 1ᵉʳ descendant qui l'est. */
const controleDe = (ancre: HTMLElement): HTMLElement | null =>
  ancre.matches(CONTROLE) ? ancre : ancre.querySelector<HTMLElement>(CONTROLE);

const dans = (el: Element | null | undefined, n: EventTarget | null): boolean => !!el && n instanceof Node && el.contains(n);

interface EvenementsDelegues {
  mouseover: MouseEvent;
  mouseout: MouseEvent;
  focusin: FocusEvent;
  focusout: FocusEvent;
  click: MouseEvent;
  keydown: KeyboardEvent;
  mousedown: MouseEvent;
}
type TypeDelegue = keyof EvenementsDelegues;
/** Les types délégués, et leur phase : `keydown` à la CAPTURE (↓ épingle avant tout écouteur local). */
const PHASES: Record<TypeDelegue, boolean> = {
  mouseover: false, mouseout: false, focusin: false, focusout: false, click: false, keydown: true, mousedown: false,
};

/** Ce qu'une instance reçoit de la délégation : `ici`, un événement dont l'ancrage résolu est le sien ;
 *  `ailleurs`, tout autre événement. */
interface Routage {
  ici: { [T in TypeDelegue]?: (e: EvenementsDelegues[T], a: HTMLElement) => void };
  ailleurs: { [T in TypeDelegue]?: (e: EvenementsDelegues[T]) => void };
}

const inscrites = new Map<string, Routage>();

function deleguer(e: Event): void {
  const type = e.type as TypeDelegue;
  const a = ancrageDe(e.target);
  const proprio = a ? inscrites.get(a.getAttribute(ANCRE)!) : undefined;
  for (const routage of inscrites.values()) {
    if (routage === proprio) (routage.ici[type] as ((e: Event, a: HTMLElement) => void) | undefined)?.(e, a!);
    else (routage.ailleurs[type] as ((e: Event) => void) | undefined)?.(e);
  }
}

function inscrire(id: string, routage: Routage): () => void {
  if (inscrites.size === 0) for (const [type, capture] of Object.entries(PHASES)) document.addEventListener(type, deleguer, capture);
  inscrites.set(id, routage);
  return () => {
    inscrites.delete(id);
    if (inscrites.size === 0) for (const [type, capture] of Object.entries(PHASES)) document.removeEventListener(type, deleguer, capture);
  };
}

export interface OptionsInfobulle {
  /** La boîte porte de quoi être atteinte au pointeur : pont de survol, et ses événements de pointeur. */
  atteignable: boolean;
  /** ↓ depuis l'ancrage épingle la boîte, et le focus y entre. */
  epinglable: boolean;
  /** Aucune boîte ne s'ouvre, et celle qui est affichée se ferme. */
  sourdine: boolean;
  /** Un clic sur l'ancrage bascule la boîte (au doigt, il n'y a ni survol ni focus). */
  auToucher: boolean;
}

export function useInfobulle(options: OptionsInfobulle) {
  const id = useId();
  const [ancre, setAncre] = useState<HTMLElement | null>(null);
  const [epinglee, setEpinglee] = useState(false);
  const [focusDedans, setFocusDedans] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pont = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ce que les écouteurs du document lisent au moment de l'événement, tenu à jour par les gestes
   *  eux-mêmes (jamais par un effet). `pointeur`, `focus` : chacun occupe l'ancrage ou la boîte ; un
   *  survol ou un focus posé AILLEURS le rend. */
  const vivant = useRef({ ouverte: false, epinglee: false, congediee: false, pointeur: false, focus: false, options });
  vivant.current.options = options;

  const annulerPont = useCallback(() => {
    if (pont.current) { clearTimeout(pont.current); pont.current = null; }
  }, []);
  const poser = useCallback((a: HTMLElement | null, epingler: boolean) => {
    vivant.current.ouverte = !!a;
    vivant.current.epinglee = epingler;
    setAncre(a);
    setEpinglee(epingler);
    if (!a) setFocusDedans(false);
  }, []);
  const fermer = useCallback(() => {
    const v = vivant.current;
    annulerPont();
    if (v.ouverte && (v.pointeur || v.focus)) v.congediee = true;
    poser(null, false);
  }, [annulerPont, poser]);
  const entre = useCallback((a: HTMLElement) => {
    const v = vivant.current;
    if (v.congediee || v.epinglee || v.options.sourdine) return;
    annulerPont();
    poser(a, false);
  }, [annulerPont, poser]);
  const quitte = useCallback(() => {
    const v = vivant.current;
    v.congediee = false;
    if (v.epinglee || !v.ouverte) return;
    annulerPont();
    if (!v.options.atteignable) { poser(null, false); return; }
    pont.current = setTimeout(() => poser(null, false), PONT_DE_SURVOL_MS);
  }, [annulerPont, poser]);
  const epingler = useCallback((a: HTMLElement) => {
    const v = vivant.current;
    if (v.options.sourdine) return;
    annulerPont();
    v.congediee = false;
    poser(a, true);
  }, [annulerPont, poser]);
  /** Bascule depuis un nœud de l'ancrage : épingle la boîte fermée ou affichée, ferme l'épinglée. */
  const bascule = useCallback((depuis: Element) => {
    const a = ancrageDe(depuis);
    if (!a) return;
    if (vivant.current.epinglee) fermer();
    else epingler(a);
  }, [fermer, epingler]);

  useEffect(() => annulerPont, [annulerPont]);
  useEffect(() => { if (options.sourdine) fermer(); }, [options.sourdine, fermer]);

  useEffect(() => {
    const dansLaBoite = (n: EventTarget | null) => dans(boxRef.current, n);
    return inscrire(id, {
      ici: {
        mouseover: (e, a) => {
          const v = vivant.current;
          if (dans(a, e.relatedTarget)) return;
          if (!v.pointeur) v.congediee = false;
          v.pointeur = true;
          entre(a);
        },
        mouseout: (e, a) => {
          if (dans(a, e.relatedTarget) || dansLaBoite(e.relatedTarget)) return;
          vivant.current.pointeur = false;
          quitte();
        },
        focusin: (_e, a) => {
          const v = vivant.current;
          if (!v.focus && !focusSansIntention()) v.congediee = false;
          v.focus = true;
          if (!focusSansIntention()) entre(a);
        },
        focusout: (e, a) => {
          if (dans(a, e.relatedTarget) || dansLaBoite(e.relatedTarget)) return;
          vivant.current.focus = false;
          quitte();
        },
        click: (_e, a) => {
          if (vivant.current.options.auToucher) bascule(a);
        },
        keydown: (e, a) => {
          if (e.key !== 'ArrowDown' || !vivant.current.options.epinglable) return;
          e.preventDefault();
          e.stopPropagation();
          epingler(a);
        },
      },
      ailleurs: {
        mouseover: (e) => { if (!dansLaBoite(e.target)) vivant.current.pointeur = false; },
        focusin: (e) => { if (!dansLaBoite(e.target)) vivant.current.focus = false; },
        mousedown: (e) => { if (vivant.current.ouverte && !dansLaBoite(e.target)) fermer(); },
      },
    });
  }, [id, entre, quitte, epingler, bascule, fermer]);

  const placement = usePlacementAncre(ancre, LARGEUR);
  const ouverte = !!placement;

  // COUCHE de la pile partagée (`dismissStack`) tant que la boîte est à l'écran : Échap et B la
  // congédient ; une couche ouverte au-dessus d'elle la retire.
  useDismissLayer({ kind: 'infobulle', nature: 'popover', plan: 'application', boite: boxRef }, fermer, ouverte, fermer);

  const origine = useCallback(() => (ancre ? controleDe(ancre) : null), [ancre]);
  const cible = useCallback((box: HTMLElement): HTMLElement | null =>
    (box.contains(document.activeElement) ? document.activeElement as HTMLElement : box.querySelector<HTMLElement>(CONTROLE)), []);
  useFocusEmprunte(boxRef, ouverte && (epinglee || focusDedans), cible, undefined, origine);

  const ancrage = {
    [ANCRE]: id,
    ...(ouverte ? { 'aria-describedby': id } : null),
    ...(options.epinglable && !options.sourdine ? { 'aria-keyshortcuts': 'ArrowDown' } : null),
  };

  const boite = (contenu: ReactNode): ReactNode => placement && (
    <BoiteAncree
      ref={boxRef}
      placement={placement}
      id={id}
      className="infobulle"
      role="tooltip"
      {...{ [ARRET]: '' }}
      data-atteignable={options.atteignable ? '' : undefined}
      onMouseEnter={() => { vivant.current.pointeur = true; annulerPont(); }}
      onMouseLeave={(e) => {
        if (ancre?.contains(e.relatedTarget as Node | null)) return;
        vivant.current.pointeur = false;
        quitte();
      }}
      onFocus={() => { vivant.current.focus = true; setFocusDedans(true); }}
      onBlur={(e) => {
        if (dans(boxRef.current, e.relatedTarget)) return;
        setFocusDedans(false);
        if (!dans(ancre, e.relatedTarget)) vivant.current.focus = false;
      }}
    >
      {contenu}
    </BoiteAncree>
  );

  return { ancrage, epinglee, bascule, fermer, boite };
}

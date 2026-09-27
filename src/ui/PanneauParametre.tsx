/**
 * PANNEAU-PARAMÈTRE BORNÉ — primitive PARTAGÉE (spec HUD combat zone 10, « garde anti-liste :
 * panneau borné au paramètre — munition, localisation, objets d'UNE pastille, sort à dissiper d'UN
 * porteur »).
 *
 * Un geste est déjà décidé ; il lui manque UN paramètre, et la situation en borne les valeurs. Le
 * panneau NAÎT DE SON DÉCLENCHEUR (il est ancré à l'alvéole/la pastille qui l'a ouvert — jamais une
 * boîte flottante au centre de l'écran), montre les candidats RÉELS, et se referme au premier clic.
 * Son annulation est GRATUITE par construction : Échap ou un clic dehors le ferment sans rien
 * engager — aucune ressource n'est dépensée par l'ouverture.
 *
 * CE QUE CE N'EST PAS : un menu, un tiroir, un catalogue. Une liste EXHAUSTIVE (tous les sorts du
 * héros, tout l'inventaire) n'est pas un paramètre — elle vit à son écran, et la console garde ses
 * alvéoles.
 *
 * COMPOSITION, aucune réinvention : les boutons sont ceux d'`OptionChooser` (layout `grid`), le
 * placement dans le viewport est la fonction PURE `computePopoverPos` déjà écrite pour `CodexRef`
 * (côté qui a le plus de place, `maxHeight` borné au réel — jamais de débordement), et l'a11y de
 * dialogue est le hook partagé `useModalA11y` (focus au montage sur le 1ᵉʳ candidat, piège Tab,
 * flèches, retour du focus au déclencheur à la fermeture) — comme `InspectPanel`/`CharacterSheet`,
 * dialogues au markup propre. Le congédiement (Échap, B de la manette) est celui de tout le monde :
 * le panneau est une COUCHE de la pile partagée (`useModalA11y` la pousse), congédiée quand elle est la
 * couche du dessus (`coucheDuDessus`).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { OptionChooser, type RollOption } from './OptionChooser';
import { useModalA11y } from './Modal';
import { computePopoverPos, type PopoverPlacement } from './compendium/CodexRef';

/** Largeur cible du panneau : une valeur de paramètre tient sur une ligne, pas une colonne d'écran. */
const PANNEAU_W = 280;

/** Un candidat-PARAMÈTRE : ce qu'`OptionChooser` sait rendre, plus la MÉTA qui fait décider (« NI 3 »,
 *  « ×12 », « progression 2/3 ») et la CONSÉQUENCE éventuelle du choix (« consomme l'Action »). */
export interface ParamOption extends RollOption {
  meta?: ReactNode;
  consequence?: ReactNode;
  /** VISUEL du candidat, à sa GAUCHE : un portrait quand le paramètre est une PERSONNE (affecter
   *  quelqu'un à un poste). La rangée devient `[visuel] [nom] [méta]`, composée ICI — un appelant qui
   *  bricolerait sa propre rangée en `content` verrait son nom chassé à droite et sa méta reléguée
   *  sous le portrait (la grille de la primitive range par POSITION). */
  visuel?: ReactNode;
}

export interface PanneauParametreProps {
  /** DÉCLENCHEUR du panneau (l'alvéole cliquée, la pastille) : il l'ancre. `null` = rien à ancrer,
   *  donc rien à rendre — le panneau ne flotte jamais tout seul au milieu de l'écran.
   *  `Element` et non `HTMLElement` : une pastille d'ENTITÉ vit dans le SVG du plateau, et le panneau
   *  ne lui demande que son rectangle et son appartenance — les deux existent sur tout élément. */
  anchor: Element | null;
  /** Ce que le panneau DEMANDE, en une ligne (« Quel Sort dissiper ? ») — c'est aussi son nom
   *  accessible. Nommé `intitule` et non `title` : la prose du panneau est RENDUE à l'écran, jamais
   *  déposée dans une infobulle native (garde `console-no-title-only`). */
  intitule: string;
  options: ParamOption[];
  /** Fermeture SANS commit (Échap, clic dehors) — et fermeture APRÈS commit, appelée par le panneau. */
  onClose: () => void;
}

export function PanneauParametre({ anchor, intitule, options, onClose }: PanneauParametreProps) {
  const [pos, setPos] = useState<PopoverPlacement | null>(null);

  // Placement AU MONTAGE et à chaque changement d'ancre : le rect du déclencheur, borné au viewport.
  useLayoutEffect(() => {
    if (!anchor) { setPos(null); return; }
    setPos(computePopoverPos(anchor.getBoundingClientRect(), window.innerWidth, window.innerHeight, PANNEAU_W));
  }, [anchor]);

  if (!anchor || !pos || options.length === 0) return null;
  // La BOÎTE est un composant à part : `useModalA11y` agit au MONTAGE de son élément, et le panneau
  // ne rend rien tant que son placement n'est pas calculé (premier rendu = `null`). Monter la boîte
  // seulement quand elle est réellement affichée est ce qui donne au hook un élément à focaliser.
  return <PanneauBoite anchor={anchor} intitule={intitule} options={options} onClose={onClose} pos={pos} />;
}

function PanneauBoite({ anchor, intitule, options, onClose, pos }: Omit<PanneauParametreProps, 'anchor'> & { anchor: Element; pos: PopoverPlacement }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const fermer = useCallback(() => closeRef.current(), []);
  // ANNULATION GRATUITE : le panneau s'empile comme couche `panneau-parametre` — Échap le congédie
  // tant qu'il est la couche du DESSUS, et rien d'autre ne bouge (ni curseur tactique, ni intention
  // armée, ni menu système). Une couche d'application ouverte APRÈS lui (modale) passe devant.
  useModalA11y(panelRef, fermer, { kind: 'panneau-parametre' }); // `PanneauBoite` n'est monté QUE placé et affiché → actif par défaut

  // CLIC DEHORS : ferme aussi, sans rien engager.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      // Le DÉCLENCHEUR compte comme « dedans » : son propre clic rouvrirait sinon ce qu'il vient de fermer.
      if (panelRef.current?.contains(t) || anchor.contains(t)) return;
      fermer();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [anchor, fermer]);

  // UN CLIC = COMMIT + FERMETURE : la fermeture est portée par la primitive, jamais recopiée à chaque
  // call-site (un panneau qui reste ouvert après son choix est un menu, pas un paramètre).
  // La valeur DÉJÀ POSÉE (`selected` — la munition en chambre, le Sort déjà entamé) se DIT : le
  // relief seul (`on` d'`OptionChooser`) laissait le candidat courant indiscernable des autres
  // (sonde du juge vision). Le mot vient de la primitive, donc de la même source que la classe.
  // Un candidat peut porter un VISUEL (portrait) : la rangée est alors `[visuel] [nom] [méta]`, et
  // c'est la primitive qui la range — le seul choix borné de PERSONNES du jeu reste sur CE mécanisme.
  const rendues: RollOption[] = options.map((o) => ({
    ...o,
    content: (
      <>
        {o.visuel != null ? <span className="pp-visuel">{o.visuel}</span> : null}
        <span className="pp-nom">{o.label}</span>
        {o.meta != null ? <span className="pp-meta">{o.meta}</span> : null}
        {o.selected ? <span className="pp-meta" data-actuel="">valeur actuelle</span> : null}
        {o.consequence != null ? <span className="pp-meta">{o.consequence}</span> : null}
      </>
    ),
    onSelect: o.onSelect
      ? () => { o.onSelect!(); fermer(); }
      : undefined,
  }));

  return createPortal(
    <div
      ref={panelRef}
      className="pp-panel panel"
      role="dialog"
      aria-label={intitule}
      data-panneau-parametre=""
      style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
    >
      <span className="mini-title pp-title">{intitule}</span>
      <OptionChooser options={rendues} layout="grid" />
    </div>,
    document.body,
  );
}

/**
 * CodexRef — primitive PARTAGÉE de référence contextuelle. Enrobe un libellé d'entité (talent,
 * compétence, équipement, état, sort, trait, signe…) : au survol/focus, un popover montre sa
 * description + sa source ; un clic ouvre le Codex sur la fiche. C'est LA primitive popover du
 * jeu (il n'y en avait pas) — remplace les `title=desc` bruts et les libellés « nus ».
 *
 * C'est aussi l'UNIQUE porteur de la RAISON D'UN REFUS (`refus`) : une case, une pastille ou un
 * bouton fermés restent PROPRES à l'écran, et disent pourquoi au survol/focus.
 *
 * Le popover est rendu en PORTAL (document.body) en `position: fixed`, positionné depuis le rect
 * du déclencheur : il échappe ainsi à TOUT clipping `overflow` (fiche, panneaux…) et à tout
 * contexte d'empilement. `pointer-events: none` → pur tooltip, pas de pont de survol ; le clic
 * (déclencheur) ouvre le Codex.
 */
import { isValidElement, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../state/store';
import { codexLookup, codexLookupById } from './registry';
import { mdToText } from '../Prose';
import { useDismissLayer } from '../useDismissLayer';

const truncate = (s: string, n = 400): string => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/** Le contenu du déclencheur porte-t-il du TEXTE ? Une `Icon` rend un `<svg aria-hidden>` : un
 *  déclencheur qui n'a QUE des icônes serait MUET pour un lecteur d'écran. On dérive alors son nom
 *  accessible du `label` — correctif DANS la primitive, jamais N props recopiées aux call-sites. */
export function nodeHasText(node: ReactNode): boolean {
  return nodeText(node).trim().length > 0;
}

/** TEXTE porté par un nœud, récursivement — un élément non textuel (`Icon` → `<svg aria-hidden>`)
 *  n'y contribue rien. SOURCE UNIQUE de la dérivation « contenu riche → nom accessible » : `nodeHasText`
 *  en est la sonde booléenne, et un titre de coquille y prend son libellé de renvoi (`RollShell`). */
export function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (isValidElement(node)) return nodeText((node.props as { children?: ReactNode }).children);
  return '';
}

/** Pont de survol (ms) : sous `wrap`, délai avant fermeture pour que le pointeur ATTEIGNE le
 *  popover — il y porte la seule porte vers la fiche. Annulé dès qu'il y entre. */
const HOVER_BRIDGE_MS = 160;
const POP_W = 320;
const GAP = 6;
const MARGIN = 8;

export interface PopoverPlacement {
  left: number;
  /** Ancré par le HAUT (placé sous le déclencheur) — `bottom` absent. */
  top?: number;
  /** Ancré par le BAS (placé au-dessus) — indépendant de la hauteur réelle, `top` absent. */
  bottom?: number;
  maxHeight: number;
  width: number;
}

/** Place un popover dans le viewport SANS deviner sa hauteur : on le pose du côté (dessous/dessus)
 *  qui a le PLUS de place et on borne `maxHeight` à cette place réelle → jamais de débordement haut
 *  ni bas (symétrique au bornage horizontal déjà fait sur `left`/`width`). Pur → testable. */
export function computePopoverPos(
  rect: { left: number; top: number; bottom: number },
  vw: number,
  vh: number,
  popW = POP_W,
): PopoverPlacement {
  const width = Math.min(popW, vw - 2 * MARGIN);
  const left = Math.max(MARGIN, Math.min(rect.left, vw - width - MARGIN));
  const below = vh - rect.bottom - GAP - MARGIN; // place disponible sous le déclencheur
  const above = rect.top - GAP - MARGIN; // place disponible au-dessus
  const cap = Math.floor(vh * 0.6);
  return below >= above
    ? { left, top: rect.bottom + GAP, maxHeight: Math.max(0, Math.min(below, cap)), width }
    : { left, bottom: vh - rect.top + GAP, maxHeight: Math.max(0, Math.min(above, cap)), width };
}

/** LE TITRE du chrome de nom — titre, et sous-titre quand le nom d'INSTANCE surmonte le nom de
 *  référence. Ces deux spans sont la matrice du nom à l'écran : le popover du Codex les porte, et le
 *  peintre de plaques de nom du monde les repose au-dessus de l'entité (`stage/PlaquesDeNom`) — UNE
 *  définition, donc un seul endroit où leur matière se retouche. */
export function CodexTitre({ title, sub }: { title?: ReactNode; sub?: ReactNode }): JSX.Element {
  return (
    <>
      {title ? <span className="codex-pop-title">{title}</span> : null}
      {sub ? <span className="codex-pop-sub">{sub}</span> : null}
    </>
  );
}

export function CodexRef({
  category,
  refus,
  id,
  label,
  children,
  className,
  hideIfUnknown = false,
  ariaLabel,
  ariaPrefix,
  inline = false,
  instance,
  tooltipOnly = false,
  wrap = false,
  suppressPopover = false,
  provenances,
  fallback,
}: {
  category?: string;
  /** RAISON DE REFUS du contrôle englobé — rendue EN TÊTE du popover, jamais en texte permanent sous
   *  le libellé (arbitrage user 2026-08-24 : « Je n'ai jamais validé ces "textes" impossible a lire
   *  sous le nom des capacités, même Rogue Trader qui est notre interface de départ n'a pas un tel
   *  comportement. »). C'est l'UNIQUE infobulle du jeu qui la porte : une case de console gatée, une
   *  action de `GatedAction` désactivée, une pastille refusée passent toutes par ici — le texte visible
   *  naît au survol ET au focus (clavier comme manette), et l'`aria-describedby` du contrôle reste
   *  câblé sur sa propre copie accessible. Un popover peut n'avoir QUE cela (aucune cible au Codex). */
  refus?: string;
  /** Identité STABLE de la cible — PRÉFÉRÉE quand fournie (`codexLookupById`) ; `label` reste requis
   *  (affichage + repli de résolution pour les cas SANS id stable : `EntityChoice` — entrées « A ou B »
   *  éclatées d'un libellé brut — et l'auto-liage de prose depuis une donnée sans id). */
  id?: string;
  label: string;
  /** Texte affiché si différent du libellé d'entrée (ex. libellé avec spécialisation). */
  children?: ReactNode;
  className?: string;
  /** Pour un déclencheur-icône (info) : ne rien rendre si l'entrée est inconnue (pas d'icône morte). */
  hideIfUnknown?: boolean;
  /** NOM ACCESSIBLE du déclencheur — nécessaire quand le contenu est une ICÔNE seule (`Icon` rend un
   *  `<svg aria-hidden>` : sans nom, le bouton serait MUET). À DÉFAUT il se DÉRIVE du `label` : ne le
   *  poser que pour nommer AUTREMENT que la fiche (« Règle : Cauchemars »). Rendu en `aria-label`
   *  SEUL — jamais un `title` : l'infobulle native est proscrite, le popover EST le mécanisme. */
  ariaLabel?: string;
  /** RÔLE du déclencheur, préfixé au nom DÉRIVÉ de la fiche (« Règle » → « Règle : Chute »). Pour un
   *  déclencheur-icône dont le nom doit dire à quoi il mène sans que l'appelant ait à connaître le
   *  libellé de la cible — c'est la primitive qui le résout (`codexLookupById`), et lui seul. Ignoré
   *  quand `ariaLabel` est posé (il nomme déjà tout) ou quand le contenu porte du texte. */
  ariaPrefix?: string;
  /** Ref en PLEINE PROSE (hors cadre) : réintroduit l'indice pointillé. Par défaut (libellé déjà
   *  encadré : chip/tag/stat-chip/titre) aucun soulignement — cf. `.codex-ref.codex-inline`. */
  inline?: boolean;
  /** Instance paramétrée portant les Indices (« 8 Tentacules +8 ») — affichée en tête du popover
   *  et transmise au Codex à l'ouverture (le Codex « prend en compte les Indices »). */
  instance?: string;
  /** POPOVER SEUL : survol/clic → info, mais le clic n'ouvre PAS la fiche Codex. Le clic (et
   *  Entrée/Espace, focus+clic tactile) BASCULE le popover (fermé par Échap, clic ailleurs, ou
   *  un 2e clic sur le déclencheur) — pour un déclencheur déjà cliquable par ailleurs (cellule
   *  d'équipement = picker au clic), utiliser `tooltipOnly` empêche l'ouverture concurrente de la
   *  fiche tout en gardant l'info accessible sans survol (tactile/clavier). */
  tooltipOnly?: boolean;
  /** ENGLOBE un contrôle DÉJÀ interactif (un `<button>` de dépense de ressource) : la surface
   *  enveloppante n'intercepte RIEN — ni clic, ni rôle, ni tabindex (deux contrôles imbriqués
   *  déclencheraient les deux actions au même clic). Le popover s'ouvre au survol ET au focus du
   *  contrôle enfant (`focusin` remonte) : c'est le BOUTON qui devient l'affordance de règle, sans
   *  ⓘ voisin (#1078). La FICHE reste atteignable — le popover porte un bouton « Ouvrir la fiche »
   *  activable au pointeur (pont de survol) ou par ↓ depuis le contrôle (épinglage + focus). */
  wrap?: boolean;
  /** POPOVER TU : tant que ce drapeau est levé, aucun popover ne s'ouvre (survol, focus, épinglage)
   *  et celui qui était affiché se ferme. Pour un déclencheur dont le CLIC ouvre à l'écran quelque
   *  chose que la boîte recouvrirait — une case de la console de combat qui arme une intention peint
   *  sa portée sur le terrain (`localIntent`). Le drapeau retombé, le déclencheur retrouve son
   *  comportement entier : l'information de règle n'est pas retirée, elle attend. */
  suppressPopover?: boolean;
  /** Noms de PROVENANCE portés par le popover (soutiens d'un Test, octroyeurs d'un bonus) — la chip
   *  reste sobre, le détail se lit au survol/à l'épinglage (arbitrage user 2026-08-05). */
  provenances?: string[];
  /** Contenu de SECOURS quand l'entrée n'est pas au catalogue (arme invoquée/enchantée…) : un popover
   *  est tout de même rendu au survol (sub + body), sans ouverture de fiche. */
  fallback?: { sub?: string; body?: string };
}) {
  const openCodex = useGame((s) => s.openCodex);
  const item = category ? (id ? codexLookupById(category, id) : undefined) ?? codexLookup(category, label) : undefined;
  // La PORTE vers la fiche (`openFiche` plus bas) se sait dès la résolution : le pont de survol en
  // dépend, et il se décide AVANT les hooks qui le portent.
  const porte = !tooltipOnly && !!item;
  // La BOÎTE doit-elle rester atteignable au pointeur (pont de survol + événements) ? Sous `wrap`, oui
  // dès qu'elle porte quelque chose à atteindre : la porte vers la fiche, ou un corps de secours.
  const boiteAtteignable = wrap && (porte || !!fallback);
  const ref = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<PopoverPlacement | null>(null);
  // Épinglé (mode `tooltipOnly` : clic/Entrée/Espace ; mode `wrap` : ↓ depuis le contrôle) — le
  // popover reste ouvert hors survol, fermé par Échap, clic ailleurs, ou un 2e déclenchement.
  // Hors ces deux modes le popover reste un pur tooltip de survol/focus.
  const [pinned, setPinned] = useState(false);
  // Le popover est un `role="tooltip"` : il ne DIT rien tant qu'il n'est pas RATTACHÉ à son
  // déclencheur (règle stricte 4). Le lien ne vaut que lorsqu'il est À L'ÉCRAN — un
  // `aria-describedby` qui vise un nœud absent ne décrit rien.
  const tipId = useId();

  const cancelHide = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }, []);
  const showAt = useCallback(() => {
    if (suppressPopover) return;
    cancelHide();
    const el = ref.current;
    if (el) setPos(computePopoverPos(el.getBoundingClientRect(), window.innerWidth, window.innerHeight));
  }, [cancelHide, suppressPopover]);
  const show = useCallback(() => { if (!pinned) showAt(); }, [pinned, showAt]);
  // Sous `wrap`, le popover porte la SEULE porte vers la fiche : il ne peut pas mourir à l'instant
  // où le pointeur quitte le déclencheur (le trajet vers lui le tuerait). Fermeture DIFFÉRÉE,
  // annulée dès que le pointeur entre dedans. Hors `wrap` : fermeture immédiate (pur tooltip).
  const hide = useCallback(() => {
    if (pinned) return;
    // Le pont n'existe QUE pour laisser le pointeur ATTEINDRE la boîte : celle qui porte la porte vers
    // la fiche, et celle de SECOURS (`fallback`), qui n'a pas d'entrée au catalogue mais reste du
    // contenu à lire. Un refus seul est un pur tooltip : il se ferme net au `blur`/`mouseleave`.
    if (!boiteAtteignable) { setPos(null); return; }
    cancelHide();
    hideTimer.current = setTimeout(() => setPos(null), HOVER_BRIDGE_MS);
  }, [pinned, boiteAtteignable, cancelHide]);
  const unpin = useCallback(() => { cancelHide(); setPinned(false); setPos(null); }, [cancelHide]);

  useEffect(() => cancelHide, [cancelHide]);

  // Le drapeau `suppressPopover` se lève souvent APRÈS l'ouverture : le focus que le clic donne au
  // contrôle englobé ouvre le popover, et c'est ce même clic qui arme à l'écran ce que la boîte
  // recouvrirait. On ferme donc ce qui est affiché ; `showAt` interdit toute réouverture tant que le
  // drapeau tient.
  useEffect(() => { if (suppressPopover) unpin(); }, [suppressPopover, unpin]);

  // Échap referme le popover dès qu'il est À L'ÉCRAN — épinglé OU simplement affiché (survol/focus
  // sous `wrap`, où la fermeture est différée par le pont de survol). La couverture d'origine (#1078
  // B3a « Échap en couches ») ne visait que l'ÉPINGLÉ : un popover de chip resté affiché au-dessus du
  // CTA d'une modale de jet ne répondait donc pas à Échap, et sa boîte (pointer-events auto sous
  // `wrap`) interceptait le clic sur « Continuer » (recette #1117, vécu 3 fois).
  // Clic HORS du déclencheur ET hors du popover referme aussi. Le popover porté compte comme
  // « dedans » : sous `wrap` il est cliquable (sa porte vers la fiche), et un `mousedown` dessus le
  // démonterait avant que le `click` n'atteigne le bouton.
  // COUCHE de la pile partagée (`dismissStack`, #1476) tant que le popover est À L'ÉCRAN : le
  // congédiement (Échap, B) le referme, et s'arrête là — il n'ouvre plus le menu système derrière.
  const congedier = useCallback(() => {
    const wasPinned = pinned;
    unpin();
    // Le focus ne revient au contrôle englobé QUE s'il était parti DANS le popover (épinglage) —
    // sinon il n'a jamais bougé, et le re-focaliser rouvrirait le popover à l'instant même par
    // `onFocus={show}` : Échap semblait alors « ne rien fermer » (recette #1117).
    if (wrap && wasPinned) ref.current?.querySelector('button')?.focus();
  }, [pinned, unpin, wrap]);
  // Une couche ouverte AU-DESSUS (modale, panneau-paramètre) recouvre la surface : le popover, qui
  // n'était qu'une infobulle posée sur l'écran d'en dessous, se retire au lieu de rester dessous.
  useDismissLayer('popover-codex', 'popover', congedier, pinned || !!pos, congedier);

  useEffect(() => {
    if (!pinned && !pos) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return;
      unpin();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pinned, pos, unpin]);

  // Épinglage clavier sous `wrap` : le focus ENTRE dans le popover, sur sa porte — sans quoi la
  // fiche ne serait atteignable qu'à la souris (le portal est en fin de `body`, hors ordre de Tab).
  useEffect(() => {
    if (pinned && wrap) openBtnRef.current?.focus();
  }, [pinned, wrap]);

  // Sans entrée catalogue NI fallback : icône-déclencheur → rien ; libellé → texte simple. La classe
  // `codex-ref` reste portée — elle habille l'affordance (`.codex-ref.ab-codex-info`), et sans elle
  // le repli perdrait sa mise en forme au lieu de rester la même surface, muette.
  if (!item && !fallback && !refus) return hideIfUnknown ? null : <span className={`codex-ref codex-static${className ? ` ${className}` : ''}`}>{children ?? label}</span>;

  const title = item?.label ?? label;
  const body = item ? (item.desc ? truncate(mdToText(item.desc)) : null) : (fallback?.body || null);
  const popSub = item?.sub ?? fallback?.sub;
  // Faits-clés (Dégâts/PA/Prix/NI/Portée…) DANS le tooltip — pas seulement la prose : le survol
  // d'une arme/d'un sort devient informatif sans ouvrir la fiche. Compact, 4 max.
  const metaLine = item?.meta?.length ? truncate(item.meta.slice(0, 4).map((m) => `${m.label} ${m.value}`).join(' · '), 140) : null;
  const src = item?.source;
  const inst = instance && instance !== title ? instance : undefined;
  // La FICHE existe-t-elle ? (`openFiche` = le popover porte sa porte « Ouvrir la fiche »). Qui
  // ACTIONNE cette porte diffère : hors `wrap`, le déclencheur lui-même ; sous `wrap`, le
  // déclencheur enveloppe un contrôle qui a DÉJÀ son action (dépenser une ressource) — la surface
  // ne prend donc aucune interaction, et la porte devient un vrai bouton DANS le popover, atteint
  // au pointeur ou par ↓ depuis le contrôle (#1078).
  const openFiche = porte;
  const wrapperOpens = !wrap && openFiche;
  const togglePopover = !wrap && tooltipOnly && (!!item || !!fallback);
  const clickable = wrapperOpens || togglePopover;
  const open = () => { if (item && category) openCodex({ category, id: item.id, label: item.label, instance: inst }); };
  const toggle = () => { if (pinned) unpin(); else if (!suppressPopover) { showAt(); setPinned(true); } };
  const activate = wrapperOpens ? open : togglePopover ? toggle : undefined;
  // TAP sur un contrôle REFUSÉ : au doigt, il n'y a ni survol ni focus — le tap MONTRE la raison (il
  // n'agit pas : le contrôle englobé est `aria-disabled`, son clic est inerte). Patron mobile standard.
  // L'enveloppe ne devient pas pour autant un contrôle (ni rôle, ni tabindex) : elle écoute, c'est tout.
  const tapRefus = wrap && !!refus && !activate;
  // La porte clavier du popover (↓) suit le popover : mise en sourdine, elle n'est ni annoncée ni
  // active — jamais un raccourci qui n'ouvre rien.
  const pinFromWrap = wrap && openFiche && !suppressPopover;
  // NOM ACCESSIBLE : l'`ariaLabel` explicite prime ; sinon on le DÉRIVE de la FICHE (`title` =
  // `item.label`, repli sur `label`) dès que le déclencheur ne porte aucun texte (déclencheur-icône).
  // Sans cette dérivation, les déclencheurs ⓘ du dépôt seraient des boutons MUETS. `ariaPrefix` y
  // ajoute le RÔLE du renvoi (« Règle : … ») : le nom dit toujours la CIBLE, jamais le contexte qui
  // l'entoure — un appelant qui prêtait son propre titre nommait la mauvaise fiche.
  const derive = ariaPrefix ? `${ariaPrefix} : ${title}` : title;
  const accessibleName = ariaLabel ?? (nodeHasText(children ?? label) ? undefined : derive);

  return (
    <span
      ref={ref}
      className={`codex-ref${inline ? ' codex-inline' : ''}${clickable ? '' : ' codex-static'}${className ? ` ${className}` : ''}`}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? 'button' : undefined}
      aria-expanded={togglePopover ? pinned : undefined}
      {...(accessibleName ? { 'aria-label': accessibleName } : null)}
      {...(pos ? { 'aria-describedby': tipId } : null)}
      {...(pinFromWrap ? {
        // La porte clavier ne se DEVINE pas : elle s'annonce (lecteur d'écran + infobulle native).
        'aria-keyshortcuts': 'ArrowDown',
        title: `${title} — ↓ : fiche`,
      } : null)}
      onClick={activate ?? (tapRefus ? toggle : undefined)}
      onKeyDown={(e) => {
        // ↓ épingle et entre dans le popover (le contrôle englobé ignore cette touche : son
        // Entrée/Espace reste SA dépense). Même idiome qu'un bouton de menu.
        // `stopPropagation` : la touche est CONSOMMÉE ici — sans quoi le listener global de jeu
        // (`useGameKeyboard`) la voit aussi et le curseur tactique de combat court avec elle
        // (recette B3a, capture 04). Ceinture ET bretelles avec `notWhenControlFocused` posé sur
        // les bindings `cursor-*` : le socle protège TOUT contrôle focalisé, ceci protège ce geste
        // même si un listener futur ne consultait pas le registre.
        if (pinFromWrap && e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          showAt();
          setPinned(true);
          return;
        }
        if (activate && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          activate();
        }
      }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children ?? label}
      {pos &&
        createPortal(
          <span
            ref={popRef}
            id={tipId}
            className="codex-pop"
            // Placement CALCULÉ → variables CSS lues par `.codex-pop` (arbitrage user A2, 2026-09-18).
            // Sous `wrap` le popover est ACTIONNABLE (il porte la porte) : un ÉTAT est un ATTRIBUT,
            // jamais une variable — `[data-atteignable]` lui rend les événements de pointeur que
            // `.codex-pop` neutralise pour le pur tooltip.
            style={{
              '--pop-top': pos.top != null ? `${pos.top}px` : 'auto',
              '--pop-bottom': pos.bottom != null ? `${pos.bottom}px` : 'auto',
              '--pop-left': `${pos.left}px`,
              '--pop-w': `${pos.width}px`,
              '--pop-h': `${pos.maxHeight}px`,
            } as CSSProperties}
            data-atteignable={boiteAtteignable ? '' : undefined}
            role="tooltip"
            onMouseEnter={cancelHide}
            onMouseLeave={hide}
          >
            {/* Le REFUS ouvre le popover : c'est la réponse à « pourquoi je ne peux pas ? », avant
                toute règle. Il ne s'écrit nulle part ailleurs à l'écran (arbitrage 2026-08-24). */}
            {refus && <span data-refus="">{refus}</span>}
            <CodexTitre title={inst ?? title} sub={inst ? title : undefined} />
            {popSub && <span className="codex-pop-sub">{popSub}</span>}
            {metaLine && <span className="codex-pop-meta">{metaLine}</span>}
            {/* PROVENANCES de la chip (qui soutient, qui octroie) — arbitrage user 2026-08-05 :
                « Normalement les informations de ce genre sont dans le hover codex non ? ». Elles
                vivent DANS le popover, jamais en badges flottants à côté de la chip. */}
            {provenances?.length ? <span className="codex-pop-meta">{provenances.join(' · ')}</span> : null}
            {body && <span className="codex-pop-body">{body}</span>}
            {(src || openFiche) && (
              <span className="codex-pop-foot">
                {src && <span className="codex-src">{src.book} p.{src.page}</span>}
                {/* La PORTE vers la fiche. Sous `wrap` c'est un vrai bouton (clic ET clavier) :
                    le déclencheur, lui, garde son action propre. Sinon, mention : c'est le
                    déclencheur qui est cliquable. */}
                {openFiche && (wrap
                  ? (
                    <button
                      ref={openBtnRef}
                      type="button"
                      /* Contrôle RÉEL → il compose le token de bouton partagé (`.btn.btn-ghost`,
                         `components.css`) ; `.codex-pop-open` ne garde que son placement en pied. */
                      className="btn btn-ghost codex-pop-open"
                      data-atteignable=""
                      onClick={() => { open(); unpin(); }}
                    >
                      Ouvrir la fiche
                    </button>
                  )
                  : <span className="codex-pop-open">Ouvrir la fiche</span>)}
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}

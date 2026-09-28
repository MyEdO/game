/**
 * CodexRef — primitive PARTAGÉE de référence contextuelle. Enrobe un libellé d'entité (talent,
 * compétence, équipement, état, sort, trait, signe…) : au survol/focus, son infobulle montre sa
 * description et sa source ; un clic ouvre le Codex sur la fiche. La boîte, son placement et ses
 * gestes sont ceux de la couche d'infobulle (`useInfobulle`) : `CodexRef` n'en fournit que le CONTENU.
 *
 * C'est aussi l'UNIQUE porteur de la RAISON D'UN REFUS (`refus`) : une case, une pastille ou un
 * bouton fermés restent PROPRES à l'écran, et disent pourquoi au survol/focus.
 */
import { isValidElement, type ReactNode } from 'react';
import { useGame } from '../../state/store';
import { codexLookup, codexLookupById } from './registry';
import { mdToText } from '../Prose';
import { useInfobulle } from '../Infobulle';
import { coupeAuMot } from '../../lib/coupeAuMot.mjs';

/** Borne du corps de l'infobulle, en caractères (`coupeAuMot`). */
export const BORNE_DU_CORPS = 400;

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

/** LE TITRE du chrome de nom — titre, et sous-titre quand le nom d'INSTANCE surmonte le nom de
 *  référence. Ces deux spans sont la matrice du nom à l'écran : l'infobulle du Codex les porte, et le
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
  sourdine = false,
  provenances,
  fallback,
}: {
  category?: string;
  /** RAISON DE REFUS du contrôle englobé — rendue EN TÊTE de l'infobulle, jamais en texte permanent
   *  sous le libellé (arbitrage user 2026-08-24 : « Je n'ai jamais validé ces "textes" impossible a lire
   *  sous le nom des capacités, même Rogue Trader qui est notre interface de départ n'a pas un tel
   *  comportement. »). C'est l'UNIQUE infobulle du jeu qui la porte : une case de console gatée, une
   *  action de `GatedAction` désactivée, une pastille refusée passent toutes par ici — le texte visible
   *  naît au survol ET au focus (clavier comme manette). Une infobulle peut n'avoir QUE cela (aucune
   *  cible au Codex). */
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
   *  SEUL. Le `title` de la porte ↓ (:178) est une 2ᵉ boîte native, purgée au lot B, design R-M2 v4. */
  ariaLabel?: string;
  /** RÔLE du déclencheur, préfixé au nom DÉRIVÉ de la fiche (« Règle » → « Règle : Chute »). Pour un
   *  déclencheur-icône dont le nom doit dire à quoi il mène sans que l'appelant ait à connaître le
   *  libellé de la cible — c'est la primitive qui le résout (`codexLookupById`), et lui seul. Ignoré
   *  quand `ariaLabel` est posé (il nomme déjà tout) ou quand le contenu porte du texte. */
  ariaPrefix?: string;
  /** Ref en PLEINE PROSE (hors cadre) : réintroduit l'indice pointillé. Par défaut (libellé déjà
   *  encadré : chip/tag/stat-chip/titre) aucun soulignement — cf. `.codex-ref.codex-inline`. */
  inline?: boolean;
  /** Instance paramétrée portant les Indices (« 8 Tentacules +8 ») — affichée en tête de l'infobulle
   *  et transmise au Codex à l'ouverture (le Codex « prend en compte les Indices »). */
  instance?: string;
  /** INFOBULLE SEULE : survol/clic → info, mais le clic n'ouvre PAS la fiche Codex. Le clic (et
   *  Entrée/Espace) BASCULE l'infobulle (fermée par Échap, clic ailleurs, ou un 2e clic sur le
   *  déclencheur) — pour un déclencheur déjà cliquable par ailleurs (cellule d'équipement = picker au
   *  clic), `tooltipOnly` empêche l'ouverture concurrente de la fiche tout en gardant l'info
   *  accessible sans survol (tactile/clavier). */
  tooltipOnly?: boolean;
  /** ENGLOBE un contrôle DÉJÀ interactif (un `<button>` de dépense de ressource) : la surface
   *  enveloppante n'intercepte RIEN — ni clic, ni rôle, ni tabindex (deux contrôles imbriqués
   *  déclencheraient les deux actions au même clic). L'infobulle s'ouvre au survol ET au focus du
   *  contrôle enfant : c'est le BOUTON qui devient l'affordance de règle, sans ⓘ voisin (#1078). La
   *  FICHE reste atteignable — l'infobulle porte un bouton « Ouvrir la fiche » activable au pointeur
   *  (pont de survol) ou par ↓ depuis le contrôle (épinglage + focus). */
  wrap?: boolean;
  /** SOURDINE (`useInfobulle`) : tant qu'elle tient, aucune infobulle ne s'ouvre et celle qui était
   *  affichée se ferme. Pour un déclencheur dont le CLIC ouvre à l'écran quelque chose que la boîte
   *  recouvrirait — une case de la console de combat qui arme une intention peint sa portée sur le
   *  terrain (`localIntent`). */
  sourdine?: boolean;
  /** Noms de PROVENANCE portés par l'infobulle (soutiens d'un Test, octroyeurs d'un bonus) — la chip
   *  reste sobre, le détail se lit au survol/à l'épinglage (arbitrage user 2026-08-05). */
  provenances?: string[];
  /** Contenu de SECOURS quand l'entrée n'est pas au catalogue (arme invoquée/enchantée…) : une
   *  infobulle est tout de même rendue au survol (sub + body), sans ouverture de fiche. */
  fallback?: { sub?: string; body?: string };
}) {
  const openCodex = useGame((s) => s.openCodex);
  const item = category ? (id ? codexLookupById(category, id) : undefined) ?? codexLookup(category, label) : undefined;
  // La PORTE vers la fiche : sous `wrap`, un vrai bouton DANS l'infobulle ; sinon le déclencheur lui-même.
  const porte = !tooltipOnly && !!item;
  const wrapperOpens = !wrap && porte;
  const bascule = !wrap && tooltipOnly && (!!item || !!fallback);
  const clickable = wrapperOpens || bascule;
  const bulle = useInfobulle({
    // Sous `wrap`, la boîte porte quelque chose à atteindre : la porte vers la fiche, ou un corps de secours.
    atteignable: wrap && (porte || !!fallback),
    epinglable: wrap && porte,
    sourdine,
    // TAP sur un contrôle REFUSÉ : au doigt, ni survol ni focus — le tap MONTRE la raison.
    auToucher: wrap && !!refus && !clickable,
  });

  // Sans entrée catalogue NI fallback : icône-déclencheur → rien ; libellé → texte simple. La classe
  // `codex-ref` reste portée — elle habille l'affordance (`.codex-ref.ab-codex-info`), et sans elle
  // le repli perdrait sa mise en forme au lieu de rester la même surface, muette.
  if (!item && !fallback && !refus) return hideIfUnknown ? null : <span className={`codex-ref codex-static${className ? ` ${className}` : ''}`}>{children ?? label}</span>;

  const title = item?.label ?? label;
  const body = item ? (item.desc ? coupeAuMot(mdToText(item.desc), BORNE_DU_CORPS) : null) : (fallback?.body || null);
  const popSub = item?.sub ?? fallback?.sub;
  // Faits-clés (Dégâts/PA/Prix/NI/Portée…) DANS l'infobulle — pas seulement la prose. Compact, 4 max.
  const metaLine = item?.meta?.length ? coupeAuMot(item.meta.slice(0, 4).map((m) => `${m.label} ${m.value}`).join(' · '), 140) : null;
  const src = item?.source;
  const inst = instance && instance !== title ? instance : undefined;
  const open = () => { if (item && category) openCodex({ category, id: item.id, label: item.label, instance: inst }); };
  const activate = wrapperOpens ? () => open() : bascule ? (el: Element) => bulle.bascule(el) : undefined;
  // NOM ACCESSIBLE : l'`ariaLabel` explicite prime ; sinon on le DÉRIVE de la FICHE (`title` =
  // `item.label`, repli sur `label`) dès que le déclencheur ne porte aucun texte (déclencheur-icône).
  // `ariaPrefix` y ajoute le RÔLE du renvoi (« Règle : … ») : le nom dit toujours la CIBLE.
  const derive = ariaPrefix ? `${ariaPrefix} : ${title}` : title;
  const accessibleName = ariaLabel ?? (nodeHasText(children ?? label) ? undefined : derive);
  // BASCULE `tooltipOnly` = patron TOGGLETIP (Inclusive Components, « Tooltips & Toggletips ») : le
  // déclencheur n'a pas d'état déplié ; à l'activation, le texte de la bulle est écrit dans une région
  // `role="status"` montée avec lui, et vidée à la fermeture.
  const annonce = bascule
    ? [refus, inst ?? title, inst ? title : undefined, popSub, metaLine, provenances?.join(' · '), body].filter(Boolean).join('. ')
    : null;

  return (
    <>
      <span
        className={`codex-ref${inline ? ' codex-inline' : ''}${clickable ? '' : ' codex-static'}${className ? ` ${className}` : ''}`}
        tabIndex={clickable ? 0 : undefined}
        role={clickable ? 'button' : undefined}
        {...(accessibleName ? { 'aria-label': accessibleName } : null)}
        {...bulle.ancrage}
        {...(wrap && porte && !sourdine ? { title: `${title} — ↓ : fiche` } : null)}
        onClick={activate ? (e) => activate(e.currentTarget) : undefined}
        onKeyDown={activate ? (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          activate(e.currentTarget);
        } : undefined}
      >
        {children ?? label}
      </span>
      {bulle.boite(
        <>
          {/* Le REFUS ouvre l'infobulle : c'est la réponse à « pourquoi je ne peux pas ? », avant
              toute règle. Il ne s'écrit nulle part ailleurs à l'écran (arbitrage 2026-08-24). */}
          {refus && <span className="codex-pop-refus" data-refus="">{refus}</span>}
          <CodexTitre title={inst ?? title} sub={inst ? title : undefined} />
          {popSub && <span className="codex-pop-sub">{popSub}</span>}
          {metaLine && <span className="codex-pop-meta">{metaLine}</span>}
          {/* PROVENANCES de la chip (qui soutient, qui octroie) — arbitrage user 2026-08-05 :
              « Normalement les informations de ce genre sont dans le hover codex non ? ». */}
          {provenances?.length ? <span className="codex-pop-meta">{provenances.join(' · ')}</span> : null}
          {body && <span className="codex-pop-body">{body}</span>}
          {(src || porte) && (
            <span className="codex-pop-foot">
              {src && <span className="codex-src">{src.book} p.{src.page}</span>}
              {/* La PORTE vers la fiche. Sous `wrap` c'est un vrai bouton (clic ET clavier) : le
                  déclencheur, lui, garde son action propre. Sinon, mention : c'est le déclencheur
                  qui est cliquable. */}
              {porte && (wrap
                ? (
                  <button
                    type="button"
                    /* Contrôle RÉEL → il compose le token de bouton partagé (`.btn.btn-ghost`,
                       `components.css`) ; `.codex-pop-open` ne garde que son placement en pied. */
                    className="btn btn-ghost codex-pop-open"
                    data-atteignable=""
                    onClick={() => { open(); bulle.fermer(); }}
                  >
                    Ouvrir la fiche
                  </button>
                )
                : <span className="codex-pop-open">Ouvrir la fiche</span>)}
            </span>
          )}
        </>,
      )}
      {annonce !== null && <span className="hors-ecran" role="status">{bulle.epinglee ? annonce : ''}</span>}
    </>
  );
}

import type { ReactNode, Ref } from 'react';
import { CodexRef, nodeText } from './compendium/CodexRef';

/** Les trois branches de raison de `GatedAction`, sous forme de props à répandre. */
export type PropsDeRaison =
  | { reason: string; reasonId?: never }
  | { reasonId: string; reason?: never }
  | { reason?: never; reasonId?: never };

/** Raison OPTIONNELLE : rend la branche `reason` quand la cause EXISTE, et la 3ᵉ branche (aucune
 *  raison) sinon — jamais une chaîne VIDE, qui laisserait un contrôle refusé sans rien à faire lire.
 *  L'action reste atteignable dans les deux cas (`aria-disabled`) : c'est le TEXTE qui manquerait. */
export const raisonSi = (raison: string | undefined | null): PropsDeRaison =>
  (raison ? { reason: raison } : {});

/** Liaison OPTIONNELLE à une raison DÉJÀ rendue à l'écran (bannière, rappel) — même règle. */
export const lieeA = (id: string | undefined | null): PropsDeRaison =>
  (id ? { reasonId: id } : {});

/**
 * Action GATÉE — bouton d'engagement dont l'indisponibilité porte sa RAISON, lue AU SURVOL et AU FOCUS
 * (souris, clavier, manette) dans l'unique infobulle du jeu (`CodexRef refus`), et liée par
 * `aria-describedby` à sa copie accessible hors écran (un `title` seul reste invisible à l'arbre a11y,
 * recette 2026-07-12 ; un texte permanent sous le libellé est REFUSÉ — arbitrage user 2026-08-24 :
 * « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue Trader
 * qui est notre interface de départ n'a pas un tel comportement. »). Primitive PARTAGÉE (hub de ville « Entrer au port/chantier », écran d'équipe
 * « Commencer », panneau Sorts de la fiche « Lancer » — #371/#516) : tout bouton principal désactivé
 * pour une raison intelligible la COMPOSE au lieu d'un `<button disabled title=…>` muet. Pose
 * `.gated-action` (components.css).
 *
 * DEUX formes, selon QUI porte la raison :
 *  - `reason` : la raison est portée ICI — infobulle au survol/focus du bouton, plus copie accessible
 *    hors écran dans le conteneur `.gated-action` — forme d'une action isolée, dont la cause
 *    d'indisponibilité lui est propre ;
 *  - `reasonId` : la raison est déjà rendue UNE fois par l'appelant (N actions gatées par la MÊME
 *    cause : les rangées d'un registre sous un même verrou, l'infobulle qui enveloppe une alvéole) —
 *    l'action s'y LIE sans dupliquer le texte, et se rend alors SANS conteneur, donc composable dans
 *    un contexte inline.
 *
 * Dans TOUTES les formes, un contrôle refusé porte `aria-disabled` et JAMAIS `disabled` : il reste
 * atteignable au clavier, à la manette et au doigt (table des primitives, CLAUDE.md).
 */
/** TON d'un bouton, en STRUCTURE : mis en avant (`primary`), classe d'appelant (`btnClassName`). */
export type TonBouton = { primary: boolean; btnClassName?: string };

/** Classe d'un bouton de ce ton : `btn`, `btn-primary` s'il est mis en avant, les variantes de la
 *  primitive (`bare` → `btn-nu`, `tactile` → `btn-tactile`), puis la classe d'appelant. Source UNIQUE
 *  de la composition, lue par `GatedAction`, `OptionChooser` et `RollShell`. */
export function classeBouton({ primary, btnClassName, bare = false, tactile = false }: TonBouton & { bare?: boolean; tactile?: boolean }): string {
  return ['btn', primary && 'btn-primary', bare && 'btn-nu', tactile && 'btn-tactile', btnClassName].filter(Boolean).join(' ');
}

export function GatedAction({
  id,
  label,
  ariaLabel,
  ariaPressed,
  descOfferte,
  enabled,
  reason,
  reasonId,
  onClick,
  primary = true,
  className,
  btnClassName,
  bare = false,
  dense = false,
  tactile = false,
  arretePointeur = false,
  raisonInline = false,
  btnRef,
}: {
  id: string;
  label: ReactNode;
  /** Nom ACCESSIBLE du bouton, obligatoire dès que `label` n'est pas du texte lisible (glyphe `↺`,
   *  icône) : posé en `aria-label` ET en `title`. Absent = le nom vient du contenu du bouton. */
  ariaLabel?: string;
  /** État PRESSÉ d'un contrôle à bascule (chip d'option, option retenue d'une grille) : l'action
   *  gatée est parfois un TOGGLE, et son état doit rester lisible à l'arbre a11y même quand elle est
   *  fermée. Simple report de l'attribut ARIA du site — aucune règle ne s'y décide. */
  ariaPressed?: boolean;
  /** Description de l'action à l'état OFFERT, portée en `title` (passe-plat du `title` natif que le
   *  site portait avant de composer la primitive : le coût d'une réparation, l'assiette d'une
   *  surcharge…). N'apparaît JAMAIS sur une action fermée — là, seule la raison parle. */
  descOfferte?: string;
  enabled: boolean;
  onClick: () => void;
  /** Style primaire (dégradé sang) — défaut. `false` = bouton neutre (action rétrogradée). */
  primary?: boolean;
  /** Classes SUPPLÉMENTAIRES du `<button>` (ex. `small` dans une rangée compacte) — la taille reste
   *  au bouton, `className` reste réservé au conteneur `.gated-action`. */
  btnClassName?: string;
  /** Variante NUE (`.btn-nu`) : le bouton n'apporte AUCUNE boîte (padding, hauteur mini, rayon,
   *  ombre) — pour une alvéole qui porte déjà sa géométrie (rack d'États de la console). La variante
   *  vit DANS la primitive (`base.css`), jamais en neutralisation de `.btn` depuis un conteneur. */
  bare?: boolean;
  /** Variante DENSE (`.gated-action.dense`, components.css) : l'action tient dans une colonne étroite
   *  (pied de la frise d'initiative) — texte enroulé, graduation réduite du bouton. Même règle que
   *  `bare` : la densité vit chez la primitive, jamais chez l'appelant. Porte
   *  sur le CONTENEUR, donc sans effet dans la forme `reasonId` (rendue sans conteneur). */
  dense?: boolean;
  /** Variante TACTILE (`.btn.btn-tactile`, base.css) : le bouton tient la cible de la charte (≥ 40 px)
   *  à TOUT pointeur, et pas seulement sous `pointer: coarse` — pour un contrôle posé dans le monde,
   *  où rien ne garantit la densité d'un panneau. Comme `bare`/`dense` : la variante vit chez la
   *  primitive, jamais en neutralisation de `.btn` depuis la feuille d'un écran. */
  tactile?: boolean;
  /** Le bouton CONSOMME ses événements de pointeur (`stopPropagation` sur pointerdown/up/move/click) —
   *  pour un contrôle posé SUR une surface de picking (le SVG du monde, qui écoute tout à sa racine) :
   *  sans cela un clic vaudrait le geste ET le clic-monde qui est dessous, et le simple fait de POSER le
   *  pointeur sur le bouton re-résoudrait le monde sous ce pixel — le survol sauterait à la case qui est
   *  derrière le bouton (réticule déplacé en combat ; hors combat, l'entité survolée change, et le
   *  contrôle qu'on vise se démonte avant d'avoir été cliqué). Le pointeur posé sur le contrôle
   *  appartient au CHROME, pas au monde. */
  arretePointeur?: boolean;
  /** RAISON RENDUE EN CLAIR sous le bouton, au lieu de l'infobulle de survol/focus — OPT-IN, réservé
   *  au refus qui est le SEUL signal d'un écran : l'attente d'un invité en coop (écran d'équipe), le
   *  diagnostic d'authoring d'un outil d'éditeur, l'entrée refusée d'une activité. Ailleurs, une case
   *  fermée reste PROPRE et dit pourquoi au survol (arbitrage user 2026-08-24). C'est un choix de
   *  PLACEMENT du texte, rien d'autre : le contrôle reste `aria-disabled` et atteignable, comme
   *  toutes les autres formes. */
  raisonInline?: boolean;
  /** Référence sur le BOUTON — pour l'ancrer à ce qu'il ouvre (un panneau-paramètre naît de son
   *  déclencheur, jamais du conteneur qui l'entoure). */
  btnRef?: Ref<HTMLButtonElement>;
} & (
  | {
      /** Raison d'indisponibilité — rendue sous le bouton quand `enabled=false` (info de DÉCISION). */
      reason: string;
      reasonId?: never;
      className?: string;
    }
  | {
      /** Id de la raison DÉJÀ rendue par l'appelant : l'action s'y lie, sans conteneur ni doublon. */
      reasonId: string;
      reason?: never;
      className?: never;
    }
  | {
      /** NI l'un NI l'autre : action JAMAIS refusable — le refus n'est pas un état de ce contrôle (il
       *  compose la primitive pour sa matière et son a11y, pas pour une raison). À préférer à un
       *  `reason=""` : le contrôle resterait refusé et atteignable, mais sans rien à faire lire — le
       *  type dit alors que le refus n'est pas un état de ce contrôle, au lieu de le taire. */
      reason?: never;
      reasonId?: never;
      className?: string;
    }
)) {
  // `aria-describedby` ne pointe QUE sur un texte qui existe : sans `reasonId` ni `reason`, l'attribut
  // désignerait un `<p>` vide — une description fantôme qu'un lecteur d'écran annonce comme un silence.
  // Corollaire : une raison VIDE (`reason=""`/`reasonId=""`) est une erreur d'appel, jamais une
  // permission — le contrôle reste refusé et atteignable, il n'a simplement rien à faire lire. D'où le
  // `||` et non `??` : une chaîne vide n'est pas une cible, elle rendrait `aria-describedby=""`.
  const describedBy = enabled ? undefined : (reasonId || (reason ? `${id}-reason` : undefined));
  // La raison vit dans l'INFOBULLE de CE contrôle quand il la porte lui-même (`reason`) et que
  // l'appelant ne l'a pas demandée en clair. Les autres formes (`reasonId`) la tiennent ailleurs :
  // infobulle de l'appelant, ou récapitulatif déjà à l'écran.
  const bulle = !enabled && !raisonInline && !!reason;
  // Un contrôle REFUSÉ ne porte JAMAIS `disabled` : l'attribut HTML le retire de l'ordre de
  // tabulation, rend `.focus()` inopérant, l'exclut du filtre de la manette (`visibleFocusables`) et
  // lui coupe tout événement de pointeur — sa raison ne serait alors lisible qu'à la souris, et il
  // disparaîtrait de la navigation. Patron ARIA canon, TOUTES formes confondues : `aria-disabled` +
  // clic INERTE. Le bouton reste atteignable au clavier, à la manette, et au doigt.
  const arret = arretePointeur ? (e: { stopPropagation: () => void }) => e.stopPropagation() : undefined;
  const button = (
    <button
      type="button"
      ref={btnRef}
      className={classeBouton({ primary, btnClassName, bare, tactile })}
      aria-disabled={!enabled || undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={enabled && descOfferte ? descOfferte : ariaLabel}
      aria-describedby={describedBy}
      onPointerDown={arret}
      onPointerMove={arret}
      onPointerUp={arret}
      onClick={(e) => { arret?.(e); if (!enabled) return; onClick(); }}
    >
      {label}
    </button>
  );
  if (reasonId) return button;
  return (
    <div className={`gated-action${dense ? ' dense' : ''}${className ? ` ${className}` : ''}`}>
      {bulle
        ? <CodexRef label={ariaLabel ?? nodeText(label)} refus={reason} wrap>{button}</CodexRef>
        : button}
      {/* La raison : EN CLAIR sous le bouton quand l'écran la réclame (`raisonInline`), sinon sa copie
          HORS ÉCRAN, qu'un lecteur d'écran lit par `aria-describedby` sans survol. Elle est là dès
          qu'il y a une raison à lire — et le `<p>` comme l'attribut tombent ensemble quand il n'y en a pas. */}
      {!enabled && !!reason && <p className={raisonInline ? 'gated-action-reason' : 'hors-ecran'} id={`${id}-reason`}>{reason}</p>}
    </div>
  );
}

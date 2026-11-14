import { createElement, forwardRef, type ForwardedRef, type HTMLAttributes, type ReactNode } from 'react';
import type { VerrouDesMots } from '../noyau/fabriquesDuNoyau';

/**
 * COUCHE LAYOUT (#1800) — les quatre concepts de PLACEMENT d'un écran, en liste FERMÉE :
 * `Stack` (pile), `Row` (rangée), `Grid` (grille), `Split` (deux colonnes dont une bornée).
 * Leur matière vit dans `src/ui/styles/layout.css` ; ici, rien que le rendu des props en classe et
 * en attributs `data-*`.
 *
 * Un écran COMPOSE ces primitives et celles d'IDENTITÉ (`components.css`) : il n'écrit ni CSS
 * d'identité (cliquet (xxi)) ni style inline (cliquet (xxii)) — d'où le `style` INTERDIT PAR LE
 * TYPE sur les quatre. Une géométrie calculée se pose en VARIABLE CSS sur l'élément qui la porte,
 * jamais en propriété inline (docs/charte-ui.md § « Architecture CSS »).
 *
 * Les valeurs d'espacement sont des PAS de l'échelle `--sp-*` (base.css), jamais des pixels ; les
 * cassures sont les breakpoints canon (règle stricte 4). Les deux cassures portent leur SENS :
 * `stackBelow` (Row/Grid/Split deviennent une pile) et `rowBelow` (Stack devient une rangée).
 *
 * Les quatre transmettent leur `ref` : un conteneur de placement est aussi ce qu'on MESURE (bord de
 * défilement, mise en vue) — `MasterDetail` en dépend.
 */

/** Un pas de l'échelle d'espacement `--sp-*` (base.css). */
export type Espace = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Breakpoint canon du projet (règle stricte 4, `docs/charte-ui.md`). */
export type Cassure = 900 | 700 | 560;

/** Balises légales sous une primitive de placement : le placement est aveugle à la sémantique, mais
 *  la sémantique de l'écran ne doit pas être perdue dans une soupe de `<div>`. */
type Balise =
  | 'div' | 'section' | 'article' | 'nav' | 'header' | 'footer' | 'form'
  | 'ul' | 'ol' | 'li' | 'fieldset' | 'span' | 'label' | 'button';

/** Ce que l'appelant passe EN PLUS du placement (id, role, aria-*, data-testid, onClick…) — `style`
 *  n'en fait pas partie : une propriété CSS inline est un refus de compilation. */
type Rest = Omit<HTMLAttributes<HTMLElement>, 'style' | 'className'> & { className?: string };

const joindre = (base: string, sien?: string) => (sien ? `${base} ${sien}` : base);

/** Rendu commun : la classe de la primitive, les attributs `data-*` non vides, puis le reste. Un
 *  attribut dont la prop est absente n'est PAS rendu — c'est ce qui laisse la valeur par défaut de
 *  la feuille (`var(--gap, …)`) répondre. */
function rendre(
  balise: Balise,
  classe: string,
  data: Record<string, string | number | undefined>,
  reste: Rest,
  children: ReactNode,
  ref: ForwardedRef<HTMLElement>,
) {
  const attrs: Record<string, unknown> = { ...reste, ref, className: joindre(classe, reste.className) };
  for (const [cle, valeur] of Object.entries(data)) if (valeur !== undefined) attrs[cle] = valeur;
  return createElement(balise, attrs, children);
}

type StackProps = {
  gap?: Espace;
  pad?: Espace;
  align?: 'stretch' | 'start' | 'center' | 'end';
  /** Sous cette cassure, la pile devient une rangée qui s'enroule. */
  rowBelow?: Cassure;
  as?: Balise;
  children: ReactNode;
} & Rest;

/** PILE verticale. Sous `rowBelow`, elle devient une rangée qui s'enroule. */
export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { gap, pad, align, rowBelow, as = 'div', children, ...reste }, ref,
) {
  return rendre(as, 'stack', {
    'data-gap': gap,
    'data-pad': pad,
    'data-align': align,
    'data-row-below': rowBelow,
  }, reste, children, ref);
});

type RowProps = {
  gap?: Espace;
  pad?: Espace;
  align?: 'center' | 'start' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'between' | 'end' | 'center';
  /** `false` : la rangée ne s'enroule pas — elle déborde ou défile. */
  wrap?: boolean;
  /** La rangée vit DANS une ligne de texte (elle en suit la ligne de base) au lieu d'occuper sa
   *  propre bande — une rangée de tuiles après un libellé sur la même ligne. */
  inline?: boolean;
  /** Sous cette cassure, la rangée devient une pile. */
  stackBelow?: Cassure;
  as?: Balise;
  children: ReactNode;
} & Rest;

/** RANGÉE horizontale, qui s'enroule par défaut. Sous `stackBelow`, elle devient une pile. */
export const Row = forwardRef<HTMLElement, RowProps>(function Row(
  { gap, pad, align, justify, wrap = true, inline, stackBelow, as = 'div', children, ...reste }, ref,
) {
  return rendre(as, 'row', {
    'data-gap': gap,
    'data-pad': pad,
    'data-align': align,
    'data-justify': justify,
    'data-wrap': wrap ? undefined : 'no',
    'data-inline': inline ? '' : undefined,
    'data-stack-below': stackBelow,
  }, reste, children, ref);
});

type GridProps = {
  gap?: Espace;
  pad?: Espace;
  /** Largeur minimale d'une colonne auto : `sm` 240px, `md` 340px, `lg` 400px. */
  min?: 'sm' | 'md' | 'lg';
  /** Nombre de colonnes FIXES — exclusif de `min`. */
  cols?: 2 | 3 | 4;
  /** Hauteur des cases d'une rangée : `start` les hisse en haut, `stretch` les égale (défaut : `start`). */
  align?: 'start' | 'stretch';
  stackBelow?: Cassure;
  as?: Balise;
  children: ReactNode;
} & Rest;

/** GRILLE : colonnes AUTOMATIQUES (`min`, largeur minimale d'une carte) ou FIXES (`cols`) — jamais
 *  les deux. Avec `cols`, elle s'empile sous 700px sauf `stackBelow` contraire. */
export const Grid = forwardRef<HTMLElement, GridProps>(function Grid(
  { gap, pad, min, cols, align, stackBelow, as = 'div', children, ...reste }, ref,
) {
  return rendre(as, 'grid', {
    'data-gap': gap,
    'data-pad': pad,
    'data-align': align,
    'data-min': cols ? undefined : min,
    'data-cols': cols,
    'data-stack-below': stackBelow ?? (cols ? 700 : undefined),
  }, reste, children, ref);
});

type SplitProps = {
  gap?: Espace;
  pad?: Espace;
  /** Largeur de la colonne bornée : `sm` 160-240px, `md` 270px, `lg` 240px-1,3fr. */
  aside?: 'sm' | 'md' | 'lg';
  /** Côté de la colonne bornée (défaut : au début). */
  side?: 'debut' | 'fin';
  /** La colonne bornée reste visible au défilement — remise dans le flux sous la cassure. */
  sticky?: boolean;
  /** Hauteur des deux colonnes : `start` les hisse en haut, `stretch` les égale (défaut : `start`). */
  align?: 'start' | 'stretch';
  stackBelow?: Cassure;
  as?: Balise;
  children: ReactNode;
} & Rest;

/** VERROU : le côté de la colonne bornée ne prend que des mots du lexique (#3977). */
const verrouDuCote: VerrouDesMots<NonNullable<SplitProps['side']>> = true;
void verrouDuCote;

/** SPLIT : une colonne BORNÉE + le contenu. La colonne bornée est le PREMIER enfant ; `side='fin'`
 *  la renvoie à droite, et c'est alors le DERNIER enfant qui est borné. S'empile sous 700px sauf
 *  `stackBelow` contraire. */
export const Split = forwardRef<HTMLElement, SplitProps>(function Split(
  { gap, pad, aside, side, sticky, align, stackBelow = 700, as = 'div', children, ...reste }, ref,
) {
  return rendre(as, 'split', {
    'data-gap': gap,
    'data-pad': pad,
    'data-aside': aside,
    'data-side': side,
    'data-sticky': sticky ? '' : undefined,
    'data-align': align,
    'data-stack-below': stackBelow,
  }, reste, children, ref);
});

/** Modificateur d'ENFANT — prend la place restante d'une pile ou d'une rangée : `<h2 {...grow}>`. */
export const grow = { 'data-grow': '' } as const;
/** Modificateur d'ENFANT — se cale au bout de la rangée : `<button {...pushEnd}>`. */
export const pushEnd = { 'data-push': 'end' } as const;
/** Modificateur d'ENFANT — occupe toute la largeur d'une `Grid` : `<section {...spanFull}>`. */
export const spanFull = { 'data-span': 'full' } as const;

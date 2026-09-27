/**
 * Prose — primitive UNIQUE de rendu des descriptions (champs de prose des données, en **Markdown**).
 *
 * Règle 5 du projet : une description est un copié/collé VERBATIM de la source (Markdown), jamais du
 * HTML. Cette primitive rend ce Markdown en React via `react-markdown` (+ GFM) — le HTML brut N'EST
 * PAS interprété (pas de `rehype-raw`) → sûr sur du contenu éditable au Codex, pas de
 * `dangerouslySetInnerHTML`.
 *
 * Auto-liage : les mentions du vocabulaire de RÈGLES (carac/compétences/talents/états/manœuvres/
 * traits/qualités/domaines) deviennent des `CodexRef` cliquables (façon dev.html), via le plugin
 * rehype ci-dessous qui réutilise le tokeniseur PUR `tokenizeLinks` (source unique) — aucune logique
 * de liage dupliquée, ni HTML brut injecté (`dangerouslySetInnerHTML` proscrit ici).
 *
 * CONTRAT DU LIAGE (#1392 Lot E) : l'appariement de libellé n'a lieu QUE si l'appelant dit CE QU'IL
 * REND — la prop `porteur` (`{ type, id, chemin }`, `liage.ts`), c'est-à-dire le champ
 * d'entrée d'où sort ce texte, VERBATIM. Sans `porteur`, le markdown est rendu tel quel : aucune
 * mention n'est liée. Deux états, aucun intermédiaire.
 */
import { useMemo, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodexRef } from './compendium/CodexRef';
import { ParchmentCard } from './ParchmentCard';
import { tokenizeLinks } from './compendium/relations';
import type { Porteur } from './liage';

/** Nœud HAST minimal (sous-ensemble manipulé par le plugin d'auto-liage). */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Sous-arbres dont le texte n'est PAS auto-lié (liens existants, code). */
// `exergue` : une citation est la VOIX du livre, pas du texte de règle — le walk s'arrête à
// l'élément, donc rien n'y est lié (verdict juge vision : « Fileuses du Destin », dans une citation
// de l'Agitateur, pointait la règle des Points de Destin).
const NO_LINK_TAGS = new Set(['a', 'code', 'pre', 'exergue']);

/** Plugin rehype : remplace dans chaque nœud texte les mentions de règles par un élément `coderef`
 *  (mappé plus bas sur `CodexRef`). `tokenizeLinks` reste la SOURCE unique du matcher. */
function autolink(tree: HastNode, selfCategory: string, selfId: string): void {
  const walk = (node: HastNode): void => {
    if (!node.children?.length || (node.tagName && NO_LINK_TAGS.has(node.tagName))) return;
    const next: HastNode[] = [];
    for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string') {
        const tokens = tokenizeLinks(child.value, selfCategory, selfId);
        if (tokens.length === 1 && typeof tokens[0] === 'string') {
          next.push(child);
        } else {
          for (const t of tokens) {
            if (typeof t === 'string') next.push({ type: 'text', value: t });
            else
              next.push({
                type: 'element',
                tagName: 'coderef',
                // `instance` = texte verbatim absorbant la spécialisation entre parenthèses (« Art
                // (Écriture) ») — la fiche ouverte reste le libellé de base (`reflabel`) ; `instance`
                // n'affecte que l'affichage du popover (cf. `CodexRef`), la fiche ne se paramètre pas.
                properties: { category: t.category, refid: t.id, reflabel: t.label, instance: t.spec ? t.text : undefined },
                children: [{ type: 'text', value: t.text }],
              });
          }
        }
      } else {
        walk(child);
        next.push(child);
      }
    }
    node.children = next;
  };
  walk(tree);
}

/**
 * EXERGUE : couple « citation + attribution » de la convention d'épigraphe WFRP — un paragraphe
 * ENTIÈREMENT cité `« … »` (souvent en italique) SUIVI d'un paragraphe d'attribution (tiret
 * `–`/`—`/`-`, parfois échappé `\-`). Prédicats posés sur le TEXTE du `<p>` (les citations sont sous
 * `<em>` : matcher le markdown rendu, jamais la source).
 */
const QUOTE_PARA = /^\s*«/;
const ATTRIB_PARA = /^\s*\\?\s*[–—-]/;

/** Texte concaténé d'un sous-arbre HAST (le `<p>` peut porter `<em>`/`<strong>`). */
function texteDe(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(texteDe).join('');
}

/**
 * Plugin rehype BORNÉ (prop `exergues`) : TOUT couple de deux `<p>` consécutifs citation+attribution
 * devient un bloc `exergue` À SA PLACE dans la prose. Activé par la DÉFINITION de catégorie du
 * registre (`careers`), jamais par un test de catégorie au rendu : les « Points de vue » d'une race
 * (`species`) sont des sections de livre sous leur propre titre, pas des épigraphes — sans la prop,
 * elles restent des paragraphes (fidèle au livre).
 */
function exergues(tree: HastNode): void {
  const enfants = tree.children;
  if (!enfants?.length) return;
  // `mdast-util-to-hast` intercale un nœud texte `"\n"` entre deux blocs (mesuré : `ROOT children:
  // element:p | text:"\n" | element:p | …`) — l'appariement saute ces blancs, sinon deux paragraphes
  // ne sont JAMAIS adjacents et le plugin ne voit aucun couple.
  const estP = (n: HastNode | undefined): boolean => !!n && n.type === 'element' && n.tagName === 'p';
  const estBlanc = (n: HastNode | undefined): boolean => !!n && n.type === 'text' && !(n.value ?? '').trim();
  const out: HastNode[] = [];
  for (let i = 0; i < enfants.length; i++) {
    const a = enfants[i];
    if (estP(a)) {
      // Prochain nœud SIGNIFIANT après `a` (les blancs traversés sont absorbés dans l'enveloppe).
      let j = i + 1;
      while (j < enfants.length && estBlanc(enfants[j])) j++;
      const b = enfants[j];
      if (estP(b)) {
        const q = texteDe(a).trim();
        const at = texteDe(b).trim();
        if (QUOTE_PARA.test(q) && q.includes('»') && ATTRIB_PARA.test(at)) {
          out.push({ type: 'element', tagName: 'exergue', properties: {}, children: [a, b] });
          i = j;
          continue;
        }
      }
    }
    out.push(a);
  }
  tree.children = out;
}

const COMPONENTS = {
  // Bloc d'exergue injecté par le plugin `exergues` → la carte-parchemin PARTAGÉE.
  exergue: ({ children }: { children?: ReactNode }) => (
    <div className="prose-exergue"><ParchmentCard>{children}</ParchmentCard></div>
  ),
  // Élément synthétique injecté par `autolink` → notre popover/lien de Codex.
  coderef: ({ node, children }: { node?: HastNode; children?: ReactNode }) => {
    const props = (node?.properties ?? {}) as { category?: string; refid?: string; reflabel?: string; instance?: string };
    return (
      <CodexRef category={String(props.category ?? '')} id={props.refid} label={String(props.reflabel ?? '')} instance={props.instance} inline>
        {children}
      </CodexRef>
    );
  },
} as Components;

/**
 * Rend une description Markdown (verbatim de la source) en React.
 *
 * `porteur` = le champ d'entrée d'où sort ce texte (`{ type, id, chemin }`). PRÉSENT : les mentions
 * du vocabulaire de règles deviennent des `CodexRef` — `porteur.type` tranche les homonymes
 * (`PRIORITY_CAT_ORDER`), `porteur.id` porte l'anti-auto-lien. ABSENT : aucun appariement de libellé
 * n'a lieu (le plugin ne s'exécute pas) — une prose synthétisée, runtime ou d'UI ne lie rien.
 * `exergues` (donnée de CATÉGORIE, cf. `registry.ts`) : rend les couples citation+attribution en
 * carte-parchemin à leur place — et RIEN n'y est lié, une citation étant la voix du livre et non du
 * texte de règle.
 */
export function Prose({ md, porteur, exergues: avecExergues }: { md: string; porteur?: Porteur; exergues?: boolean }) {
  // Mémo sur les VALEURS du porteur (type/id), pas sur l'objet : les appelants le composent à la volée
  // (`{ type, id, chemin }`), un mémo par référence re-tokeniserait la prose à chaque rendu.
  const type = porteur?.type;
  const id = porteur?.id;
  const rehypePlugins = useMemo(
    () => [
      // ORDRE SIGNIFIANT : les exergues d'abord — `autolink` doit trouver l'élément `exergue` déjà
      // posé pour s'y arrêter (`NO_LINK_TAGS`).
      ...(avecExergues ? [() => exergues] : []),
      ...(type && id ? [() => (tree: HastNode) => autolink(tree, type, id)] : []),
    ],
    [type, id, avecExergues],
  );
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins} components={COMPONENTS}>
      {md}
    </ReactMarkdown>
  );
}

/** Markdown → texte brut (tooltips/blurbs où l'on ne peut pas rendre de React). Approximatif (suffisant
 *  pour un aperçu tronqué) : retire la syntaxe d'emphase/listes/liens/titres et normalise les espaces. */
export function mdToText(md: string): string {
  return md
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')        // code inline/fence
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')          // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')       // liens → texte
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')            // titres
    .replace(/^\s{0,3}>\s?/gm, '')                 // citations
    .replace(/^\s*[-*+]\s+/gm, '')                 // puces
    .replace(/^\s*\d+\.\s+/gm, '')                 // listes ordonnées
    .replace(/(\*\*|__)(.*?)\1/g, '$2')            // gras
    .replace(/(\*|_)(.*?)\1/g, '$2')               // italique
    .replace(/~~(.*?)~~/g, '$1')                   // barré
    .replace(/\s+/g, ' ')
    .trim();
}

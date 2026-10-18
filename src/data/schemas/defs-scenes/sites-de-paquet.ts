/**
 * SITES DE CONDITION ET D'EFFET d'un paquet de campagne (#2539) — UN énumérateur, partagé par le visiteur
 * des références narratives (`./refs-narratives.ts`) et par la garde « lu ⇒ produit »
 * (`src/scenes/drapeau-lu-produit.test.ts`). Une liste de sites tenue ailleurs rate le site suivant.
 *
 * Sites, dans l'ordre du document :
 *  - scène : `when` des déclencheurs et des choix de dialogue ; chaque RACINE de Flow (`racinesDeFlow` :
 *    déclencheurs, actions d'entité, choix de dialogue, `onVictory`) et l'arbre entier par `walkFlow` —
 *    `cond` des `if`, `gate` et `difficultyBy[].cond` des `test`, feuilles `do` et les Flows qu'elles
 *    PORTENT (`carriedFlows`) ; `crossTest` des zones d'effet ;
 *  - carte du monde : `when` des lieux et des routes, Effects des péripéties de route ;
 *  - narratif : `when` de la clôture.
 * Chaque site rend son CHEMIN complet (renommage, fautes), son LIEU lisible (messages de garde) et son
 * PORTEUR (la liste à clé du document et l'id de l'élément — portée d'une faute de `validateScene`). La
 * forme n'est pas vérifiée : le document peut être brut (avant `normalizeScene`).
 */
import { carriedFlows, isFlowNode, racinesDeFlow, walkFlow, type CheminDeFlow, type Flow, type GenreDeRacineDeFlow } from '../../../engine/flowCore';

type Chemin = readonly (string | number)[];
type Objet = Record<string, unknown>;

/** L'élément du document qui porte un site : sa liste à clé (`triggers`, `routes`…, `narratif` pour la
 *  clôture) et son id. */
export interface PorteurDeSite {
  readonly liste: string;
  readonly id: string;
}

/** Une Condition RACINE d'un site (ses sous-Conditions se parcourent par `noeudsDeCondition`). */
export interface SiteDeCondition {
  readonly chemin: Chemin;
  readonly lieu: string;
  readonly porteur: PorteurDeSite;
  readonly condition: Objet;
}

/** Un Effet (feuille `do`, péripétie de route). */
export interface SiteDEffet {
  readonly chemin: Chemin;
  readonly lieu: string;
  readonly porteur: PorteurDeSite;
  readonly effet: Objet;
}

export interface SitesDuPaquet {
  readonly conditions: SiteDeCondition[];
  readonly effets: SiteDEffet[];
}

/** Ce que l'énumérateur lit d'un paquet. */
export interface PaquetASites {
  readonly scenes: readonly unknown[];
  readonly worldMap?: unknown;
  readonly narratif?: unknown;
}

const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Objet => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Objet) : {});
const estObjet = (v: unknown): v is Objet => !!v && typeof v === 'object' && !Array.isArray(v);
const idDe = (o: Objet): string => (typeof o.id === 'string' ? o.id : '?');

const NOM_DE_RACINE: { readonly [G in GenreDeRacineDeFlow]: string } = {
  trigger: 'déclencheur', entity: 'action', dialogue: 'dialogue', encounter: 'rencontre',
};
const LISTE_DE_RACINE: { readonly [G in GenreDeRacineDeFlow]: string } = {
  trigger: 'triggers', entity: 'entities', dialogue: 'dialogues', encounter: 'encounters',
};

const vide = (): { conditions: SiteDeCondition[]; effets: SiteDEffet[] } => ({ conditions: [], effets: [] });
type Sortie = ReturnType<typeof vide>;

/** Où vit un site : son lieu lisible et son porteur. */
type Ou = { readonly lieu: string; readonly porteur: PorteurDeSite };

function pousseCondition(out: Sortie, v: unknown, chemin: Chemin, ou: Ou): void {
  if (estObjet(v)) out.conditions.push({ chemin, ...ou, condition: v });
}

/** Sites d'un `FlowTest` : son `gate` et chaque `difficultyBy[].cond`. */
function sitesDeTest(test: unknown, chemin: Chemin, ou: Ou, out: Sortie): void {
  const t = objet(test);
  pousseCondition(out, t.gate, [...chemin, 'gate'], ou);
  liste(t.difficultyBy).forEach((d, k) => pousseCondition(out, objet(d).cond, [...chemin, 'difficultyBy', k, 'cond'], ou));
}

function sitesDEffet(effet: unknown, chemin: Chemin, ou: Ou, out: Sortie): void {
  if (!estObjet(effet)) return;
  out.effets.push({ chemin, ...ou, effet });
  for (const porte of carriedFlows(effet)) sitesDeFlow(porte.flow, [...chemin, ...porte.chemin], ou, out);
}

function sitesDeFlow(flow: Flow<unknown>, chemin: Chemin, ou: Ou, out: Sortie): void {
  walkFlow(flow, (noeud, sous: CheminDeFlow) => {
    const ici = [...chemin, ...sous];
    if (noeud.kind === 'do') sitesDEffet(noeud.effect, [...ici, 'effect'], ou, out);
    else if (noeud.kind === 'if') pousseCondition(out, noeud.cond, [...ici, 'cond'], ou);
    else if (noeud.kind === 'test') sitesDeTest(noeud.test, [...ici, 'test'], ou, out);
  });
}

/** Les sites d'UNE scène, chemins préfixés de `chemin`. */
export function sitesDeLaScene(scene: unknown, chemin: Chemin = []): SitesDuPaquet {
  const out = vide();
  const sc = objet(scene);
  const nom = idDe(sc);
  liste(sc.triggers).forEach((t, i) => {
    const id = idDe(objet(t));
    pousseCondition(out, objet(t).when, [...chemin, 'triggers', i, 'when'], { lieu: `${nom} › déclencheur ${id}`, porteur: { liste: 'triggers', id } });
  });
  liste(sc.dialogues).forEach((d, i) => {
    const id = idDe(objet(d));
    liste(objet(d).nodes).forEach((n, j) =>
      liste(objet(n).choices).forEach((c, k) =>
        pousseCondition(out, objet(c).when, [...chemin, 'dialogues', i, 'nodes', j, 'choices', k, 'when'], { lieu: `${nom} › dialogue ${id}`, porteur: { liste: 'dialogues', id } }),
      ),
    );
  });
  for (const r of racinesDeFlow(scene))
    if (isFlowNode(r.flow)) sitesDeFlow(r.flow, [...chemin, ...r.chemin], { lieu: `${nom} › ${NOM_DE_RACINE[r.porteur.genre]} ${r.porteur.id}`, porteur: { liste: LISTE_DE_RACINE[r.porteur.genre], id: r.porteur.id } }, out);
  liste(sc.effectZones).forEach((z, i) => {
    const id = idDe(objet(z));
    sitesDeTest(objet(z).crossTest, [...chemin, 'effectZones', i, 'crossTest'], { lieu: `${nom} › zone ${id}`, porteur: { liste: 'effectZones', id } }, out);
  });
  return out;
}

/** Les sites de la carte du monde, chemins préfixés de `chemin`. */
export function sitesDeLaCarte(worldMap: unknown, chemin: Chemin = []): SitesDuPaquet {
  const out = vide();
  const carte = objet(worldMap);
  liste(carte.places).forEach((l, i) => {
    const id = idDe(objet(l));
    pousseCondition(out, objet(l).when, [...chemin, 'places', i, 'when'], { lieu: `carte › lieu ${id}`, porteur: { liste: 'places', id } });
  });
  liste(carte.routes).forEach((r, i) => {
    const id = idDe(objet(r));
    const ou = { lieu: `carte › route ${id}`, porteur: { liste: 'routes', id } };
    pousseCondition(out, objet(r).when, [...chemin, 'routes', i, 'when'], ou);
    liste(objet(r).perils).forEach((p, j) =>
      liste(objet(p).effects).forEach((e, k) => sitesDEffet(e, [...chemin, 'routes', i, 'perils', j, 'effects', k], ou, out)),
    );
  });
  return out;
}

/** Les sites du narratif (la clôture), chemins préfixés de `chemin`. */
export function sitesDuNarratifDuPaquet(narratif: unknown, chemin: Chemin = []): SitesDuPaquet {
  const out = vide();
  pousseCondition(out, objet(objet(narratif).cloture).when, [...chemin, 'cloture', 'when'], { lieu: 'narratif › clôture', porteur: { liste: 'narratif', id: 'cloture' } });
  return out;
}

/** TOUS les sites d'un paquet, dans l'ordre du document. */
export function sitesDuPaquet(p: PaquetASites): SitesDuPaquet {
  const parts = [
    ...p.scenes.map((s, i) => sitesDeLaScene(s, ['scenes', i])),
    sitesDeLaCarte(p.worldMap, ['worldMap']),
    sitesDuNarratifDuPaquet(p.narratif, ['narratif']),
  ];
  return { conditions: parts.flatMap((x) => x.conditions), effets: parts.flatMap((x) => x.effets) };
}

/** Chaque nœud d'une Condition (elle-même et ses sous-Conditions `all`/`any`/`not`), avec son chemin. */
export function noeudsDeCondition(cond: Objet, chemin: Chemin): { noeud: Objet; chemin: Chemin }[] {
  const out: { noeud: Objet; chemin: Chemin }[] = [{ noeud: cond, chemin }];
  if (Array.isArray(cond.of)) cond.of.forEach((c, j) => { if (estObjet(c)) out.push(...noeudsDeCondition(c, [...chemin, 'of', j])); });
  else if (estObjet(cond.of)) out.push(...noeudsDeCondition(cond.of, [...chemin, 'of']));
  return out;
}

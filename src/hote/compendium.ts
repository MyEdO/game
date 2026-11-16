/**
 * LE COMPENDIUM À L'ÉCRAN D'UN HÔTE (#4020) : les zones `compendium.*` de la session du Compendium
 * (`SessionDuCompendium`, `src/noyau/codex/session.ts`) : ses familles, ses catégories, sa recherche et ses facettes, la
 * liste de ses entrées, la fiche de l'entrée montrée, entière (`CodexItem`), chaque référence un bouton qui la suit, et
 * l'atelier de son entrée, le formulaire tiré du schéma (`src/hote/formulaire.ts`). Chaque bouton joue `{ compendium }`,
 * un geste du Compendium ; un formulaire joue `{ type, args }` (`gesteDuCompendium` le relit).
 */
import {
  advancementLabel,
  atelierIdentifiable,
  categoryByKey,
  CODEX_GROUPS,
  codexGroupLabel,
  compendium,
  categoriesDeLaFamille,
  deDeLAtelier,
  entreeMontree,
  entreesListees,
  facettesOffertes,
  formulaireDeLAtelier,
  isEditableCategory,
  renvoisDeLEntree,
  tokenizeLinks,
  type CodexItem,
  type CodexRow,
  type GesteDuCompendium,
  type RefusDuCompendium,
  type SessionDuCompendium,
} from '../noyau/index';
import { t } from '../i18n';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { estObjet } from '../lib/objet.mjs';
import { bouton, choix, ligne, type Bouton, type Choix, type Entite, type Formulaire, type Ligne, type Puce } from './elements';
import { elementsDuFormulaireTire, refusDeValeurDit, valeurDuFormulaire, type ElementDuFormulaire, type EcrivainDuFormulaire } from './formulaire';

/**
 * La réponse de `compendium` porte les zones du Compendium (`zonesDuCompendium`, `src/hote/compendium.ts`) : chaque
 * bouton joue `{ compendium }`, un geste du Compendium, que l'hôte rend à la méthode `compendium` ; chaque formulaire
 * `{ type, args }`. La fiche porte l'entrée entière : chaque référence (lien de libellé, rangée, prose, renvoi inverse)
 * est un bouton qui la suit. « Enregistrer » et « Supprimer » rendent `donnees`, que l'hôte écrit au dépôt servi.
 * @contrat Compendium
 */
export interface ZonesDuCompendium {
  /** chaque famille du Codex (`CODEX_GROUPS`) en choix, la consultée pressée, jouant `{ geste: 'famille', famille }` */
  'compendium.familles': Choix[];
  /** les catégories de la famille, à plat puis par sous-groupe (`clustersIn`), chacune jouant `{ geste: 'categorie' }`, la consultée pressée */
  'compendium.categories': Choix[];
  /**
   * le formulaire de recherche, `{ type: 'recherche', args: [terme] }`, puis chaque facette utile en liste de
   * valeurs comptées, une cochée pressée, jouant `{ geste: 'facette', cle, valeur }`
   */
  'compendium.recherche': (Formulaire | Choix)[];
  /** les entrées de la catégorie qui passent la recherche et les facettes, en liste, la montrée pressée, chacune jouant `{ geste: 'montrer', id }` */
  'compendium.liste': Choix[];
  /**
   * la fiche de l'entrée montrée : sa tête, chaque section, sa prose et ses renvois, en entités ; chaque référence
   * un bouton `{ geste: 'suivre', categorie, id, instance? }`
   */
  'compendium.fiche': Entite[];
  /**
   * l'atelier : « Modifier » et « Nouvelle entrée » hors de lui ; ouvert, son formulaire tiré du schéma, son
   * identifiant, le dé de sa table, « Abandonner », « Enregistrer », « Supprimer »
   */
  'compendium.atelier': (Ligne | Bouton | Choix | Formulaire)[];
  /** le refus du dernier geste, en clair, ou rien */
  'compendium.etat': Ligne[];
}

/** Le jeu du geste du Compendium `compendium`. */
const jeu = (g: GesteDuCompendium) => ({ compendium: g });

/** Le refus `refus` du dernier geste, dit à l'auteur : tel quel, ou celui d'une valeur écrite à son chemin (`refusDeValeurDit`). */
export const refusDuCompendiumDit = (refus: RefusDuCompendium): string => (typeof refus === 'string' ? refus : refusDeValeurDit(refus.refus, refus.chemin));

/** Si `g` est l'issue d'une écriture au dépôt : `{ geste: 'enregistrement', reussi, refus? }`, `refus` un texte. */
export function estLIssueDUneTransaction(g: unknown): g is Extract<GesteDuCompendium, { geste: 'enregistrement' }> {
  if (!estObjet(g) || g.geste !== 'enregistrement' || typeof g.reussi !== 'boolean') return false;
  const cles = Object.keys(g).length;
  return 'refus' in g ? cles === 3 && typeof g.refus === 'string' : cles === 2;
}

/** Le bouton du geste `g`, refusé de ce que la session `s` refuse à ce geste (`compendium`), sans le jouer. */
const boutonDuGeste = (s: SessionDuCompendium, id: string, libelle: string, g: GesteDuCompendium, presse = false): Bouton => {
  const refus = compendium(s, g).refus;
  return bouton(id, libelle, jeu(g), presse, refus === null ? null : refusDuCompendiumDit(refus));
};

/** Le bouton qui suit la référence `categorie`/`id`, son libellé montré `show` porteur de l'instance quand il diffère de `label`. */
const suivre = (id: string, ref: { category: string; id: string; label: string; show?: string }, texte = ref.show ?? ref.label): Bouton =>
  bouton(id, texte, jeu({ geste: 'suivre', categorie: ref.category, id: ref.id, ...(ref.show !== undefined && ref.show !== ref.label ? { instance: ref.show } : {}) }));

const puce = (id: string, libelle: string, valeur: string | null, detail: string | null = null): Puce => ({ type: 'puce', id, ton: 'neutre', libelle, valeur, detail, jeu: null });

/** Les éléments de la rangée `r` de la fiche, d'id `id` : une prose, une ligne ; un couple clé/valeur, une puce, un bouton
 *  qui suit son libellé lié ; une référence, un bouton qui la suit ; une pastille, une puce ; un choix d'avancement, sa
 *  ligne (`advancementLabel`) puis chaque option qui désigne une entrée en bouton ; un sous-titre, un bloc replié (son
 *  texte en détail), une note, une ligne ; une couleur, une puce de son code. */
function elementsDeLaRangee(id: string, r: CodexRow): (Ligne | Puce | Bouton)[] {
  switch (r.t) {
    case 'text': return [ligne(id, r.text)];
    case 'kv': return r.kref ? [suivre(id, r.kref, `${r.k} : ${r.v}`)] : [puce(id, r.k, r.v)];
    case 'ref': return [suivre(id, r, r.badge ? `${r.show} (${r.badge})` : r.show)];
    case 'chip': return [puce(id, r.label, r.badge ?? null)];
    case 'choice': {
      const ids: string[] = [];
      const parcourir = (a: unknown): void => {
        if (!estObjet(a)) return;
        if (Array.isArray(a.of)) a.of.forEach(parcourir);
        else if (typeof a.id === 'string') ids.push(a.id);
      };
      parcourir(r.advancement);
      const libelle = (cible: string) => categoryByKey(r.category)?.items.find((i) => i.id === cible)?.label ?? cible;
      return [ligne(id, advancementLabel(r.category, r.advancement)), ...ids.map((cible, i) => suivre(`${id}/${i}`, { category: r.category, id: cible, label: libelle(cible) }))];
    }
    case 'sub': return [ligne(id, r.label, 'neutre')];
    case 'fold': return [ligne(id, r.summary, 'neutre', r.text)];
    case 'couleur': return [puce(id, r.k, r.v)];
    case 'nb': return [ligne(id, r.text)];
  }
}

const entite = (id: string, nom: string, elements: Entite['elements']): Entite => ({ type: 'entite', id, ton: 'neutre', nom, elements });

/** La fiche de l'entrée `item` de la catégorie `categorie`, instance `instance` : sa tête (sous-titre, faits, statbloc,
 *  raison maison, source), chaque section de ses onglets (sinon chaque section) titrée de son onglet, sa prose et chaque
 *  renvoi qu'elle porte (`tokenizeLinks`), puis ses renvois inverses (`renvoisDeLEntree`). */
function ficheDe(s: SessionDuCompendium, categorie: string, item: CodexItem, instance: string | undefined): Entite[] {
  const tete = entite('tete', instance ?? item.label, [
    ...(item.sub ? [ligne('sub', item.sub)] : []),
    ...(item.meta ?? []).map((f, i) => (f.kref ? suivre(`meta/${i}`, f.kref, `${f.label} : ${f.value}`) : puce(`meta/${i}`, f.label, f.value))),
    ...(item.statblock ? [...item.statblock.profile.map((f, i) => puce(`profil/${i}`, f.label, f.value)), ...item.statblock.traits.flatMap((r, i) => elementsDeLaRangee(`trait/${i}`, r))] : []),
    ...(item.maison ? [ligne('maison', t('ecran.compendium.maison', { raison: item.maison }))] : []),
    ...(item.source ? [ligne('source', t('ecran.compendium.source', { livre: item.source.book, page: item.source.page }))] : []),
  ]);
  const onglets = item.tabs ?? (item.sections ?? []).map((section) => ({ title: section.title, sections: [section] }));
  const sections = onglets.flatMap((o, io) => o.sections.map((sec, is) => entite(`section/${io}/${is}`, [o.title, sec.title].filter((x, i, l) => x && l.indexOf(x) === i).join(' › '), sec.rows.flatMap((r, ir) => elementsDeLaRangee(`${io}/${is}/${ir}`, r)))));
  const jetons = item.desc ? tokenizeLinks(item.desc, categorie, item.id) : [];
  const liens = jetons.flatMap((j) => (typeof j === 'string' ? [] : [j]));
  const prose = item.desc ? [entite('prose', t('ecran.compendium.description'), [
    ligne('texte', jetons.map((j) => (typeof j === 'string' ? j : j.text)).join('')),
    ...liens.map((l, i) => suivre(`lien/${i}`, { category: l.category, id: l.id, label: l.label }, l.text)),
  ])] : [];
  const renvois = renvoisDeLEntree(s).map((g) => entite(`renvoi/${g.category}`, g.title, g.referrers.map((r) => suivre(`${g.category}/${r.id}`, r, r.detail ? `${r.label} (${r.detail})` : r.label))));
  return [tete, ...sections, ...prose, ...renvois];
}

/** L'écrivain du formulaire de l'atelier, porteur la catégorie ouverte : ses gestes se jouent en gestes du Compendium. */
const ecrivainDe = (categorie: string): EcrivainDuFormulaire<string> => ({
  porteur: categorie,
  emballe: ({ porteur: _, ...g }) => jeu(g),
});

/** Le formulaire de verbe `verbe`, d'une saisie de texte `nom` valant `valeur`. */
const formulaireDeTexte = (id: string, libelle: string, verbe: string, nom: string, valeur: string, refus: string | null = null): Formulaire => ({
  type: 'formulaire', id, libelle, verbe, focus: false, refus,
  champs: [{ type: 'saisieTexte', id: nom, ton: 'neutre', nom, optionnel: true, libelle, valeur }],
});

/** Les éléments de l'atelier de `s` : fermé, « Modifier » et « Nouvelle entrée » ; ouvert, son formulaire tiré du schéma
 *  (`formulaireDeLAtelier`, `elementsDuFormulaireTire`), le formulaire de son identifiant, celui du dé de sa table s'il en
 *  porte un, et ses trois boutons. */
function atelierDe(s: SessionDuCompendium): (Ligne | Bouton | Choix | Formulaire)[] {
  const a = s.atelier;
  if (!a) {
    if (s.categorie === null || !isEditableCategory(s.categorie)) return [];
    return [boutonDuGeste(s, 'modifier', t('ecran.compendium.modifier'), { geste: 'modifier' }), boutonDuGeste(s, 'creer', t('ecran.compendium.creer'), { geste: 'creer' })];
  }
  const f = formulaireDeLAtelier(s)!;
  const elements: ElementDuFormulaire[] = elementsDuFormulaireTire(ecrivainDe(a.categorie), f.champs, f.donnee, f.retire, f.retraits);
  const id = typeof a.entree.id === 'string' ? a.entree.id : '';
  const de = deDeLAtelier(a);
  return [
    ligne('titre', t('ecran.compendium.atelier', { categorie: categoryByKey(a.categorie)!.label })),
    ...elements,
    ...(atelierIdentifiable(a) ? [formulaireDeTexte('identifier', t('ecran.compendium.identifiant'), 'identifier', 'id', id)] : []),
    ...(de === undefined ? [] : [formulaireDeTexte('enTete', t('ecran.compendium.de'), 'enTete', 'valeur', de)]),
    boutonDuGeste(s, 'abandonner', t('ecran.compendium.abandonner'), { geste: 'abandonner' }),
    boutonDuGeste(s, 'enregistrer', t('ecran.compendium.enregistrer'), { geste: 'enregistrer' }),
    boutonDuGeste(s, 'supprimer', t('ecran.compendium.supprimer'), { geste: 'supprimer' }),
  ];
}

/** Les zones de la session `s` (`ZonesDuCompendium`). */
export function zonesDuCompendium(s: SessionDuCompendium): ZonesDuCompendium {
  const { flat, clusters } = categoriesDeLaFamille(s);
  const boutonDeCategorie = (c: { key: string; label: string }) => bouton(c.key, c.label, jeu({ geste: 'categorie', categorie: c.key }), s.categorie === c.key);
  const montree = entreeMontree(s);
  const refus = s.refus;
  return {
    'compendium.familles': [choix('familles', t('ecran.compendium.familles'), CODEX_GROUPS.map((f) => bouton(f, codexGroupLabel(f), jeu({ geste: 'famille', famille: f }), s.famille === f)))],
    'compendium.categories': [
      ...(flat.length ? [choix('categories', t('ecran.compendium.categories'), flat.map(boutonDeCategorie), 'liste')] : []),
      ...clusters.map((c) => choix(`groupe/${c.id}`, c.label, c.cats.map(boutonDeCategorie), 'liste')),
    ],
    'compendium.recherche': s.categorie === null ? [] : [
      formulaireDeTexte('recherche', t('ecran.compendium.rechercher'), 'recherche', 'terme', s.recherche),
      ...facettesOffertes(s).map(({ facet, values }) => choix(`facette/${facet.key}`, facet.label, values.map((v) => bouton(v.value, `${v.value} (${v.count})`, jeu({ geste: 'facette', cle: facet.key, valeur: v.value }), (s.facettes[facet.key] ?? []).includes(v.value))), 'liste')),
    ],
    'compendium.liste': s.categorie === null ? [] : [choix('entrees', categoryByKey(s.categorie)!.label, entreesListees(s).map((i) => bouton(i.id, i.label, jeu({ geste: 'montrer', id: i.id }), s.montree?.id === i.id)), 'liste')],
    'compendium.fiche': montree && s.categorie !== null ? ficheDe(s, s.categorie, montree, s.montree?.instance) : [],
    'compendium.atelier': atelierDe(s),
    'compendium.etat': refus === null ? [] : [ligne('refus', refusDuCompendiumDit(refus), 'alerte')],
  };
}

/** Les verbes des formulaires des zones du Compendium. */
const VERBES = ['recherche', 'identifier', 'enTete', 'valeur'] as const;

/** Le geste du Compendium que joue le formulaire `jeu` (`{ type, args }`) des zones `z` : la recherche, son terme ;
 *  l'identifiant de l'entrée ouverte ; le dé de sa table ; une valeur du formulaire tiré du schéma de l'atelier
 *  (`valeurDuFormulaire`), son porteur la catégorie ouverte ; `undefined` si les zones ne portent pas ce formulaire ou
 *  si `args` n'est pas ce qu'il saisit. */
export function gesteDuCompendium(z: ZonesDuCompendium, s: SessionDuCompendium, jeuJoue: unknown): GesteDuCompendium | undefined {
  if (!estObjet(jeuJoue) || !VERBES.includes(jeuJoue.type as (typeof VERBES)[number]) || !Array.isArray(jeuJoue.args)) return undefined;
  if (jeuJoue.type === 'valeur') {
    const lu = valeurDuFormulaire(z['compendium.atelier'], jeuJoue);
    if (!lu || lu.porteur !== s.atelier?.categorie) return undefined;
    return { geste: 'valeur', chemin: lu.chemin, ...('valeur' in lu ? { valeur: lu.valeur } : {}) };
  }
  const offert = [...z['compendium.recherche'], ...z['compendium.atelier']].some((e) => e.type === 'formulaire' && e.verbe === jeuJoue.type);
  const [texte, ...reste] = jeuJoue.args as unknown[];
  if (!offert || reste.length || (texte !== undefined && typeof texte !== 'string')) return undefined;
  const valeur = (texte as string | undefined) ?? '';
  return jeuJoue.type === 'recherche' ? { geste: 'recherche', terme: valeur } : jeuJoue.type === 'identifier' ? { geste: 'identifier', id: valeur } : { geste: 'enTete', valeur };
}

/** Le bouton des zones `z` qui joue `{ compendium: geste }`, celui qui l'offre sans refus d'abord ; `undefined` sans lui. */
export function boutonDuCompendium(z: ZonesDuCompendium, geste: unknown): Bouton | undefined {
  const cle = jsonCanonique({ compendium: geste });
  const boutons = Object.values(z).flat().flatMap((e: Ligne | Bouton | Choix | Formulaire | Entite) => (e.type === 'bouton' ? [e] : e.type === 'choix' || e.type === 'liste' ? e.valeurs : e.type === 'entite' ? e.elements.filter((x): x is Bouton => x.type === 'bouton') : []));
  const jouant = boutons.filter((b) => jsonCanonique(b.jeu) === cle);
  return jouant.find((b) => !b.refus) ?? jouant[0];
}

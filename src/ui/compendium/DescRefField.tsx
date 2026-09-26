/**
 * Éditeur d'une ADRESSE DE PROSE (`descRef`, #1389 — épique #1388) : l'entrée ne recopie pas le texte
 * du livre, elle DÉSIGNE le passage. Le champ compose l'adresse de haut en bas — livre, chapitre,
 * section, puis un à trois fragments — et montre à chaque geste le texte que l'adresse RÉSOUT.
 *
 * L'empreinte `sum` n'est JAMAIS saisie : elle est RECALCULÉE par `empreinteDe` à chaque changement de
 * fragment. Un auteur ne peut donc pas écrire une empreinte fausse, et une adresse qui ne résout pas
 * porte le message du parseur à l'écran plutôt qu'une empreinte inventée.
 *
 * Le chapitre est chargé par son adresse-URL (`chargerChapitre`, `src/data/source/chapitres.ts`) —
 * l'unique consommateur de ce chargeur. Le chemin JOUEUR, lui, ne charge rien : la prose adressée est
 * matérialisée au build (`scripts/source/prose-source-plugin.mjs`).
 *
 * Composition : `OptionChooser` (nature du fragment), `NumberField` (chapitre et bornes de blocs),
 * `SearchFilterField` (les chapitres à 30 sections et plus), `Prose` (aperçu) — aucun contrôle nu.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { books } from '../../data';
import { estExtrait } from '../../data/schemas/grammaire/livres-extraits';
import { chargerChapitre, chargerManifeste, type ChapitreManifeste, type Manifeste } from '../../data/source/chapitres';
import {
  blocsCouverts,
  empreinteDe,
  estErreur,
  graphieDeChapitre,
  largeurDeChapitre,
  normText,
  resoudreAdresse,
  resoudreFragment,
  tablesDeLaLigne,
  tablesOf,
  type ChapitreParse,
  type CodeErreur,
  type DescRef,
  type Fragment,
  type FragmentCellule,
  type Section,
  type TableDeSection,
} from '../../data/source/decoupe';
import { GatedAction } from '../GatedAction';
import { NumberField } from '../NumberField';
import { OptionChooser } from '../OptionChooser';
import { SearchFilterField, filterByLabel } from '../SearchFilterField';
import { Prose } from '../Prose';

/**
 * Ce que chaque code de refus du parseur veut dire À L'AUTEUR, et ce qu'il doit faire. La table est
 * EXHAUSTIVE par le TYPE (`satisfies Record<CodeErreur, string>`) : un code neuf sans phrase ne
 * compile pas. Le détail technique du parseur reste disponible, en second rang — un code moteur brut
 * en première ligne n'est pas un texte d'auteur.
 */
export const PHRASE_REFUS = {
  'section-inconnue': 'Cette section n’existe pas dans le chapitre choisi — rechoisissez-en une dans la liste.',
  'bornes-hors-limites': 'Les numéros de bloc sortent de la section — la plage admise est indiquée à côté des champs.',
  'empreinte-divergente': 'Le texte du livre a changé sous cette adresse — relisez le passage, puis rescellez-la.',
  'ligne-introuvable': 'Aucune ligne de la table ne porte cette clé — choisissez-en une dans la liste.',
  'ligne-ambigue': 'Plusieurs lignes de la section portent cette clé — prenez une clé qui ne désigne qu’une ligne.',
  'table-sans-en-tetes': 'La table de cette section n’a pas d’en-têtes : une cellule ne s’y adresse pas — passez en « blocs ».',
  'colonne-inconnue': 'Cette colonne n’existe pas dans la table — choisissez un en-tête de la liste.',
  'fragment-trop-court': 'Ce fragment est trop court pour un montage : il en faut au moins 40 caractères — étendez les bornes de blocs.',
  'fragment-ambigu': 'Ce texte apparaît plusieurs fois dans le chapitre : l’adresse désignerait un autre passage — étendez le fragment.',
  'fragments-chevauchants': 'Deux fragments de ce montage citent le même passage — déplacez l’un d’eux sur d’autres blocs.',
  'montage-hors-plafond': 'Une adresse monte trois fragments au plus — retirez-en un.',
} satisfies Record<CodeErreur, string>;

/** `ligne-ambigue` quand la rangée PROPOSE le choix de la table : le remède est ce choix. */
export const PHRASE_LIGNE_AMBIGUE_TABLE = 'Plusieurs tables de la section portent cette clé — choisissez sa table dans la liste « table ».';

/** Le chapitre n'offre plus AUCUN bloc à citer — la seule raison qui parle du CHAPITRE. */
const RAISON_EPUISE = 'Ce chapitre n’a aucun bloc adressable de plus.';

/**
 * Raison d'un refus NÉ DE L'AJOUT : le chapitre a des blocs libres, mais poser un 2ᵉ fragment
 * ferait basculer l'adresse en MONTAGE, et les seuils de la règle D (`resoudreAdresse`) mordraient
 * alors un fragment qui allait très bien seul. La phrase dit CE fragment et le geste qui lève le
 * refus — jamais « chapitre épuisé », qui enverrait l'auteur chercher au mauvais endroit.
 */
function raisonDeNaissance({ error, fragment }: { error: CodeErreur; fragment?: number }): string {
  const n = (fragment ?? 0) + 1;
  if (error === 'fragment-trop-court') {
    return `Ajouter un fragment rendrait le fragment ${n} trop court pour un montage (40 caractères au minimum) : étendez d’abord ses bornes de blocs.`;
  }
  if (error === 'fragment-ambigu') {
    return `Ajouter un fragment rendrait le fragment ${n} ambigu — son texte apparaît ailleurs dans le chapitre : étendez d’abord ses bornes de blocs.`;
  }
  return `Ajouter un fragment mettrait le fragment ${n} en faute. ${PHRASE_REFUS[error]}`;
}

/** Les chargeurs RÉELS — le défaut de la prop `chargeurs`, figé une fois pour que le composant ne
 *  refabrique pas son objet d'injection à chaque rendu (l'effet de chargement en dépend). */
const CHARGEURS_REELS: ChargeursSource = { chapitre: chargerChapitre, manifeste: chargerManifeste };

/** Seuil au-delà duquel une liste (sections, chapitres) reçoit son champ de filtre. */
const SECTIONS_A_FILTRER = 30;
/** Plafond de fragments d'une adresse (`descRefSchema`, `grammaire/valeurs.ts`). */
const MAX_FRAGMENTS = 3;

/** Adresse d'une section : c'est `slug#occ` que le fragment STOCKE, le titre n'est qu'un guide. */
const cleSection = (slug: string, occ: number) => `${slug}#${occ}`;

/** Le fragment de cellule SANS discriminant de table (`FragmentCellule.table`). */
function sansTable(x: FragmentCellule): FragmentCellule {
  const reste = { ...x };
  delete reste.table;
  return reste;
}
/** Libellé d'une table TITRÉE : son titre, et son rang quand la section en porte plusieurs de ce titre. */
function libelleTable(t: TableDeSection, toutes: TableDeSection[]): string {
  const memes = toutes.filter((u) => u.cle != null && normText(u.table.titre ?? '') === normText(t.table.titre ?? ''));
  return memes.length > 1 ? `${t.table.titre} (${memes.findIndex((u) => u.cle === t.cle) + 1})` : t.table.titre ?? '';
}

/** Les options d'un `<select>` contrôlé, PLUS sa valeur courante si elle n'y est pas (`sectionsPour`). */
const avecCourante = (valeurs: string[], courante: string) => (valeurs.includes(courante) ? [] : [courante]);

/** Une section SANS titre est le PRÉAMBULE d'extraction (« Pages PDF 27-47 »), pas un passage du
 *  livre : elle se nomme comme tel et passe en fin de liste (`sectionsOrdonnees`). */
const libelleSection = (s: Section) => `${cleSection(s.slug, s.occ)} — ${s.title || 'préambule (sans titre)'}`;
/** Sections TITRÉES d'abord, préambule en dernier — l'ordre du document est conservé dans chaque groupe. */
const sectionsOrdonnees = (l: Section[]): Section[] => [...l.filter((s) => s.title), ...l.filter((s) => !s.title)];

/** Libellé d'un chapitre : son TITRE, jamais le nom de fichier de l'extraction (`17 - _GoBack.md`). */
const libelleChapitre = (c: ChapitreManifeste) => `${c.ch} — ${c.titre || '(chapitre sans titre)'}`;

/** Le message MOTEUR d'un refus, replié derrière la primitive `.fold` (`components.css`, slots
 *  `.fold-title` / `.fold-body`) : la phrase d'auteur reste en tête, le détail ne se lit que sur
 *  geste — et il n'est jamais collé au filet de la boîte. */
function DetailTechnique({ texte }: { texte: string }) {
  return (
    <details className="fold">
      <summary><span className="fold-title">détail technique</span></summary>
      <div className="fold-body"><span className="de-hint">{texte}</span></div>
    </details>
  );
}

/**
 * Les deux chargeurs du `Source/`, INJECTÉS. Le défaut est le module réel ; un test passe une
 * fixture. C'est une porte de composition, pas un point d'extension : le mock de MODULE est interdit
 * dans ce dépôt (`src/vi-mock-isolate-guard.test.ts` — la suite partage son graphe, `isolate: false`,
 * un `vi.mock` fuit d'un fichier de test à l'autre).
 */
export interface ChargeursSource {
  chapitre: (book: string, ch: string) => Promise<ChapitreParse>;
  manifeste: () => Promise<Manifeste>;
}

export function DescRefField({ label, value, onChange, chargeurs }: {
  label: string;
  value: DescRef | undefined;
  onChange: (v: DescRef | undefined) => void;
  /** Défaut = les chargeurs réels (`data/source/chapitres.ts`). */
  chargeurs?: ChargeursSource;
}) {
  const { chapitre: lireChapitre, manifeste: lireManifeste } = chargeurs ?? CHARGEURS_REELS;
  const uid = useId();
  const livres = useMemo(() => books.filter((b) => estExtrait(b.id)), []);
  const [manifeste, setManifeste] = useState<Manifeste | null>(null);
  // Le chapitre chargé PORTE l'adresse pour laquelle il l'a été : sans cet appariement, un rendu qui
  // survient entre deux chargements lit les sections de l'ANCIEN chapitre (mesuré en recette : passer
  // de 21 à 22 amorçait un fragment sur `psychologie#1`, absent du nouveau chapitre).
  const [charge, setCharge] = useState<{ book: string; ch: string; parse: ChapitreParse } | null>(null);
  const [etat, setEtat] = useState<'vide' | 'chargement' | 'pret' | 'erreur'>('vide');
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState('');
  const [filtreCh, setFiltreCh] = useState('');

  // `null` = aucun manifeste servi (build sans assets, ou refus) : le chapitre se saisit au numéro.
  // L'échec n'est pas mémorisé par le chargeur — un remontage retente.
  useEffect(() => {
    let vivant = true;
    lireManifeste().then(
      (m) => { if (vivant) setManifeste(m); },
      () => { if (vivant) setManifeste(null); },
    );
    return () => { vivant = false; };
  }, []);

  const book = value?.book ?? '';
  const ch = value?.ch ?? '';
  useEffect(() => {
    if (!book || !ch) { setCharge(null); setEtat('vide'); return; }
    let vivant = true;
    // Le chapitre PRÉCÉDENT est lâché DÈS le départ du chargement : tant que le nouveau n'est pas là,
    // le champ n'a PAS de sections, et rien (ni l'amorce, ni les listes) ne travaille sur les vieilles.
    setCharge(null);
    setEtat('chargement');
    lireChapitre(book, ch).then(
      (c) => { if (vivant) { setCharge({ book, ch, parse: c }); setEtat('pret'); setErreur(''); } },
      (e: unknown) => { if (vivant) { setCharge(null); setEtat('erreur'); setErreur(e instanceof Error ? e.message : String(e)); } },
    );
    return () => { vivant = false; };
  }, [book, ch]);

  /**
   * Le chapitre chargé POUR l'adresse courante, ou `null` — jamais celui d'une adresse précédente.
   *
   * DEUX mécanismes indépendants couvrent la réponse PÉRIMÉE d'un chapitre abandonné, et chacun
   * suffit SEUL (mesuré : couper l'un laisse la suite verte) — le drapeau `vivant` du nettoyage
   * d'effet, qui jette la réponse tardive, et cet APPARIEMENT, qui la refuse même posée. C'est
   * l'appariement qui est le porteur du contrat : lui seul couvre aussi le rendu qui SURVIENT entre
   * deux chargements, où aucune promesse n'a encore été rejetée (le cas mesuré en recette : passer de
   * 21 à 22 amorçait un fragment sur `psychologie#1`, absent du nouveau chapitre — garde rouge à sa
   * coupe, `DescRefField.test.tsx` « l'amorce ne cite jamais l'ANCIEN »).
   */
  const chapitre: ChapitreParse | null = charge && charge.book === book && charge.ch === ch ? charge.parse : null;

  const parts: Fragment[] = value?.parts ?? [];
  const sections = chapitre?.sections ?? [];
  const filtrable = sections.length >= SECTIONS_A_FILTRER && parts.length > 0;
  const sectionsFiltrees = filtrable ? filterByLabel(sections, libelleSection, filtre) : sections;
  const sectionDe = (f: Fragment) => sections.find((s) => s.slug === f.sec && s.occ === f.secOcc);
  const chapitresDuLivre = manifeste?.[book]?.chapitres;
  const chapitresFiltrables = (chapitresDuLivre?.length ?? 0) >= SECTIONS_A_FILTRER;
  const chapitresVus = chapitresFiltrables
    ? filterByLabel(chapitresDuLivre ?? [], libelleChapitre, filtreCh)
    : chapitresDuLivre ?? [];

  /** Sections proposées à UN fragment : celles que le filtre laisse passer (titrées d'abord, préambule
   *  en dernier), PLUS la sienne — un `<select>` qui perd son option courante réécrit l'adresse au
   *  premier rendu. */
  const sectionsPour = (f: Fragment): Section[] => {
    const vues = sectionsOrdonnees(sectionsFiltrees);
    const sienne = sectionDe(f);
    if (!sienne || vues.includes(sienne)) return vues;
    return [sienne, ...vues];
  };

  /**
   * Le fragment NEUF cite un passage LIBRE : jamais un bloc déjà couvert par l'adresse en cours.
   * La couverture vient du prédicat UNIQUE du parseur (`blocsCouverts`, celui-là même dont le verrou
   * `fragments-chevauchants` se sert) — une `cellule` couvre le bloc de sa table, donc le fragment
   * neuf ne retombe pas dessus. Ordre de recherche : la section COURANTE d'abord (quel que soit le
   * genre du dernier fragment), puis les sections titrées suivantes, puis les précédentes.
   * `null` = il n'y a plus rien à ajouter, et le bouton porte alors sa raison.
   *
   * Le PRÉAMBULE d'extraction (section sans titre) n'est jamais candidat tant qu'une section titrée à
   * blocs existe — ce n'est pas un passage du livre.
   *
   * Rend le fragment, ou la RAISON de n'en proposer aucun : il y en a deux, et les confondre a déjà
   * menti à l'écran (« chapitre épuisé » sur un chapitre à 12 sections titrées libres).
   */
  const fragmentNeuf = (): { frag: Fragment } | { frag: null; raison: string } => {
    if (!chapitre) return { frag: null, raison: RAISON_EPUISE };
    const couverts = new Map<Section, Set<number>>();
    for (const f of parts) {
      const s = sectionDe(f);
      if (!s) continue;
      const deja = couverts.get(s) ?? new Set<number>();
      for (const k of blocsCouverts(chapitre, f)) deja.add(k);
      couverts.set(s, deja);
    }
    // La faute que l'adresse porte DÉJÀ, avant tout ajout : c'est l'étalon. Un candidat n'a pas à
    // réparer un fragment fautif, mais il ne doit pas non plus en ABÎMER un sain.
    const avant = parts.length ? resoudreAdresse(chapitre, { book, ch, parts }) : null;
    const fauteAvant = avant && estErreur(avant) ? avant : null;
    // Faute NÉE de l'ajout sur un fragment jusque-là SAIN : aucun autre candidat ne la lèvera (le
    // fragment abîmé l'est par le seul fait d'entrer dans un MONTAGE — les seuils de la règle D ne
    // s'appliquent qu'à partir de deux fragments). On la retient pour que le bouton dise la VRAIE
    // cause, au lieu d'annoncer un chapitre épuisé qui ne l'est pas.
    let naissance: { error: CodeErreur; fragment?: number } | null = null;
    // C'est le RÉSOLVEUR qui tranche, jamais une seconde copie de ses seuils.
    const tient = (f: Fragment): boolean => {
      const sum = empreinteDe(chapitre, f);
      if (typeof sum !== 'string') return false;
      const res = resoudreAdresse(chapitre, { book, ch, parts: [...parts, { ...f, sum }] });
      if (!estErreur(res)) return true;
      // L'adresse était DÉJÀ fautive : le candidat n'y est pour rien, et elle ne doit pas condamner
      // tous les candidats. La faute d'avant SURVIT forcément à l'ajout, et à l'identique — d'où le
      // test sur sa seule PRÉSENCE, sans comparer code ni indice : `resoudreAdresse` résout les
      // fragments dans l'ordre et rend au PREMIER refus, le chevauchement est jugé avant la boucle,
      // et un candidat est toujours poussé EN QUEUE — un fragment déjà refusé l'est donc encore, au
      // même indice, avant que le candidat ne soit seulement examiné. Comparer code et indice a été
      // MESURÉ non mordant (aucun cas atteignable ne les fait diverger).
      if (fauteAvant) return true;
      // Faute sur le CANDIDAT (dernier indice) : c'est ce candidat-là qui ne va pas, on en essaie un
      // autre. Faute AILLEURS : elle est née de l'ajout, et vise un fragment qui allait bien.
      if (res.fragment !== parts.length) naissance = { error: res.error, fragment: res.fragment };
      return false;
    };
    const libreDans = (s: Section): number | null => {
      const pris = couverts.get(s) ?? new Set<number>();
      for (let i = 0; i < s.blocks.length; i++) {
        if (pris.has(i)) continue;
        if (tient({ kind: 'blocs', sec: s.slug, secOcc: s.occ, b0: i, b1: i, sum: '' })) return i;
      }
      return null;
    };
    const titrees = sections.filter((s) => s.blocks.length > 0 && s.title);
    const candidates = titrees.length ? titrees : sections.filter((s) => s.blocks.length > 0);
    const courante = parts.length ? sectionDe(parts[parts.length - 1]) : undefined;
    const rang = courante ? sections.indexOf(courante) : -1;
    const ordre = [
      ...(courante && candidates.includes(courante) ? [courante] : []),
      ...candidates.filter((s) => sections.indexOf(s) > rang && s !== courante),
      ...candidates.filter((s) => sections.indexOf(s) < rang && s !== courante),
    ];
    for (const s of ordre) {
      const libre = libreDans(s);
      if (libre != null) return { frag: { kind: 'blocs', sec: s.slug, secOcc: s.occ, b0: libre, b1: libre, sum: '' } };
    }
    return { frag: null, raison: naissance ? raisonDeNaissance(naissance) : RAISON_EPUISE };
  };

  /** SCELLE un fragment sur le chapitre chargé — `sum` ne vient jamais d'une saisie. */
  const sceller = (f: Fragment): Fragment => {
    if (!chapitre) return f;
    const sum = empreinteDe(chapitre, f);
    return { ...f, sum: typeof sum === 'string' ? sum : '' };
  };

  /**
   * Pose l'adresse TELLE QU'ELLE EST : aucune empreinte n'est recalculée ici. Le scellement se fait au
   * point du geste (`majeur` pour le fragment muté, `sceller` pour un fragment neuf), et le
   * rescellement GLOBAL n'a qu'une porte, le bouton « Resceller après relecture ».
   *
   * C'est le cœur du contrat : si poser rescellait tout, un geste sur le fragment 1 reposerait
   * l'empreinte d'un fragment 2 divergent — l'avertissement et le bouton disparaîtraient, et l'adresse
   * ferait foi sur un texte que personne n'a relu.
   */
  const poser = (suite: Fragment[]) => { onChange({ book, ch, parts: suite }); };

  /** Remplace le fragment `i` par le résultat de `muter`, et rescelle CE fragment-là seulement. */
  const majeur = (i: number, muter: (f: Fragment) => Fragment) =>
    poser(parts.map((f, j) => (j === i ? sceller(muter(f)) : f)));

  // AMORCE : choisir un livre puis un chapitre laissait une adresse VIDE, sans un mot. Dès que le
  // chapitre chargé EST celui de l'adresse courante et que l'adresse n'a aucun fragment, le champ en
  // pose un — l'auteur voit immédiatement une rangée et un aperçu. Si le chapitre n'offre rien,
  // « + Fragment » dit pourquoi. La garde d'appariement (`chapitre`) interdit d'amorcer sur les
  // sections d'un chapitre précédent.
  useEffect(() => {
    if (!chapitre || parts.length > 0) return;
    const neuf = fragmentNeuf();
    if (!neuf.frag) return;
    onChange({ book, ch, parts: [sceller(neuf.frag)] });
    // Les dépendances utiles sont le CHAPITRE chargé et le fait que l'adresse soit vide :
    // `fragmentNeuf` et `onChange` sont refabriqués à chaque rendu et relanceraient l'effet en boucle.
  }, [chapitre, parts.length]);

  // Résolution du MONTAGE (aperçu complet) ET de chaque fragment SÉPARÉMENT : un montage qui échoue
  // ne doit pas effacer l'aperçu de ses fragments valides ni laisser l'auteur deviner LEQUEL cloche.
  const resolu = chapitre && value && value.parts.length > 0 ? resoudreAdresse(chapitre, value) : null;
  const parFragment = chapitre ? parts.map((f) => resoudreFragment(chapitre, f)) : [];
  const rescellable = resolu != null && estErreur(resolu) && resolu.error === 'empreinte-divergente';
  /** L'erreur de MONTAGE (`fragment-trop-court`, `fragment-ambigu`, chevauchement) DÉSIGNE son
   *  fragment : elle s'affiche dans SA rangée, pas en pied de champ. */
  const erreurDeRangee = (i: number): { error: CodeErreur; detail: string } | null => {
    const propre = parFragment[i];
    if (propre && estErreur(propre)) return propre;
    if (resolu && estErreur(resolu) && resolu.fragment === i) return resolu;
    return null;
  };

  return (
    <div className="ed-field">
      <span>{label} — adresse du passage dans le Source (l’empreinte est recalculée, jamais saisie)</span>

      <div className="de-reflrow">
        <select
          aria-label="Livre du passage"
          value={book}
          onChange={(e) => onChange(e.target.value ? { book: e.target.value, ch: '', parts: [] } : undefined)}
        >
          <option value="">— (choisir un livre extrait) —</option>
          {livres.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        {chapitresDuLivre ? (
          <select
            aria-label="Chapitre du passage"
            value={ch}
            disabled={!book}
            onChange={(e) => onChange({ book, ch: e.target.value, parts: [] })}
          >
            <option value="">— (chapitre) —</option>
            {/* Le TITRE nomme le chapitre. Le nom de fichier de l'extraction n'est JAMAIS un repli :
                il porte les mêmes ancres Word (`17 - _GoBack.md`) que le titre écarté. */}
            {chapitresVus.map((c) => <option key={c.ch} value={c.ch}>{libelleChapitre(c)}</option>)}
          </select>
        ) : (
          /* Sans manifeste, le LIVRE est inconnu : la saisie ne peut pas connaître sa largeur de
             graphie, elle pose donc la largeur MINIMALE du numéro (`07`, `105`) et c'est la
             résolution contre le disque qui juge la largeur juste (volet F,
             `src/data/prose-resolution.test.ts`). */
          <NumberField
            variant="champ"
            label="chapitre"
            placeholder="NN"
            width={84}
            min={1}
            vide
            disabled={!book}
            value={ch ? Number(ch) : null}
            onChange={(n) => onChange({
              book,
              ch: n == null ? '' : graphieDeChapitre(n, largeurDeChapitre(n)),
              parts: [],
            })}
          />
        )}
      </div>

      {/* Un livre peut porter 87 chapitres (`livre-de-base`) : au-delà du seuil, la liste reçoit le
          MÊME champ de filtre que celle des sections. */}
      {chapitresFiltrables && (
        <div className="de-reflrow">
          <SearchFilterField value={filtreCh} onChange={setFiltreCh} placeholder="filtrer les chapitres…" ariaLabel="Filtrer les chapitres du livre" />
          <em className="de-hint">
            {chapitresVus.length === 0
              ? 'aucun chapitre ne correspond'
              : `${chapitresVus.length} / ${chapitresDuLivre?.length ?? 0} chapitres`}
          </em>
        </div>
      )}

      {etat === 'chargement' && <em className="de-hint">Chargement du chapitre…</em>}
      {/* DEUX causes d'échec, deux phrases. Le `Source/` n'est émis en assets QU'EN DEV (le corpus
          des 16 livres VF ne part pas sur le web public, `scripts/source/prose-source-plugin.mjs`) :
          hors dev, il n'y a NI manifeste NI chapitre, et le champ le dit au lieu d'accuser une
          adresse juste. Manifeste servi mais chapitre absent = c'est bien l'adresse qui cloche. */}
      {etat === 'erreur' && (
        <div className="ed-field">
          <span className="de-warn">
            {manifeste === null
              ? 'Le Source n’est pas embarqué dans ce build : l’adresse s’édite sur le poste de développement.'
              : 'Ce chapitre n’a pas pu être chargé — vérifiez le livre et son numéro.'}
          </span>
          <DetailTechnique texte={erreur ?? ''} />
        </div>
      )}

      {etat === 'pret' && filtrable && (
        <div className="de-reflrow">
          <SearchFilterField value={filtre} onChange={setFiltre} placeholder="filtrer les sections…" ariaLabel="Filtrer les sections du chapitre" />
          <em className="de-hint">
            {sectionsFiltrees.length === 0
              ? 'aucune section ne correspond'
              : `${sectionsFiltrees.length} / ${sections.length} sections`}
          </em>
        </div>
      )}

      {etat === 'pret' && parts.map((f, i) => {
        const section = sectionDe(f);
        const tablesSection = section ? tablesOf(section) : [];
        const tables = tablesSection.map((t) => t.table);
        // Tables dont une rangée porte la clé de ligne choisie : à deux et plus, la ligne s'adresse dans
        // SA table (`FragmentCellule.table`, #1739) — seule une table TITRÉE a une clé à proposer.
        const portent = section && f.kind === 'cellule' ? tablesDeLaLigne(section, f.row) : [];
        const tablesTitreesDeLaLigne = portent.filter((t) => t.cle != null);
        const lignes = tables.flatMap((t) => t.rows.map((r) => r[0]));
        // Colonnes = en-têtes des tables qui portent la ligne (celle de `table` s'il est posé) ; sans
        // ligne trouvée, celles de toute la section.
        const deLaLigne = section && f.kind === 'cellule' ? tablesDeLaLigne(section, f.row, f.table) : [];
        const colonnes = (deLaLigne.length ? deLaLigne.map((t) => t.table) : tables).flatMap((t) => t.headers);
        const choixDeTable = f.kind === 'cellule' && ((portent.length > 1 && tablesTitreesDeLaLigne.length > 0) || f.table != null);
        /** Libellé de la table POSÉE hors des tables titrées de la ligne : son titre, jamais sa clé. */
        const tableAbsente = (cle: string) => {
          const t = tablesSection.find((u) => u.cle === cle);
          return t ? `${libelleTable(t, tablesSection)} — table absente de la ligne` : 'table absente de la section';
        };
        const dernierBloc = Math.max(0, (section?.blocks.length ?? 1) - 1);
        return (
          <div className="de-reflrow" key={i} data-fragment={i}>
            <select
              aria-label={`Section du fragment ${i + 1}`}
              value={cleSection(f.sec, f.secOcc)}
              onChange={(e) => {
                const s = sections.find((x) => cleSection(x.slug, x.occ) === e.target.value);
                if (s) majeur(i, (x) => ({ ...x, sec: s.slug, secOcc: s.occ }));
              }}
            >
              {!section && (
                <option value={cleSection(f.sec, f.secOcc)}>{cleSection(f.sec, f.secOcc)} — section absente du chapitre</option>
              )}
              {sectionsPour(f).map((s) => (
                <option key={cleSection(s.slug, s.occ)} value={cleSection(s.slug, s.occ)}>
                  {libelleSection(s)}{filtrable && !sectionsFiltrees.includes(s) ? ' (section courante)' : ''}
                </option>
              ))}
            </select>
            {/* Segment BLOCS/CELLULE : « cellule » se REFUSE quand la section n'a pas de table, et sa
                raison se lit au survol/focus/tap dans l'infobulle partagée (`OptionChooser` prop
                `refus` → `CodexRef`, `aria-disabled`, clic inerte) — jamais un texte inline. */}
            <OptionChooser
              layout="seg"
              idPrefix={`${uid}-${i}`}
              groupLabel={`Fragment ${i + 1}`}
              options={[
                {
                  key: 'blocs',
                  label: 'blocs',
                  selected: f.kind === 'blocs',
                  title: 'Une suite contiguë de blocs de la section',
                  onSelect: () => majeur(i, (x) => ({ kind: 'blocs', sec: x.sec, secOcc: x.secOcc, b0: 0, b1: 0, sum: '' })),
                },
                {
                  key: 'cellule',
                  label: 'cellule',
                  selected: f.kind === 'cellule',
                  refus: tables.length === 0
                    ? 'Cette section ne contient aucune table : il n’y a pas de cellule à adresser.'
                    : undefined,
                  title: tables.length === 0 ? undefined : 'Une case de table, désignée par sa clé de ligne et son en-tête de colonne',
                  onSelect: () => majeur(i, (x) => ({
                    kind: 'cellule',
                    sec: x.sec,
                    secOcc: x.secOcc,
                    row: tables[0]?.rows[0]?.[0] ?? '',
                    // La première colonne est la colonne-CLÉ (`1d100`, `Résultat`) : l'adresser rendrait
                    // la clé elle-même. Défaut = la première colonne qui porte du contenu.
                    col: tables[0]?.headers[1] ?? tables[0]?.headers[0] ?? '',
                    sum: '',
                  })),
                },
              ]}
            />
            {f.kind === 'blocs' ? (
              <>
                <NumberField variant="champ" label="premier bloc" width={84}
                  min={0} max={dernierBloc} value={f.b0}
                  onChange={(n) => majeur(i, (x) => (x.kind === 'blocs' ? { ...x, b0: n, b1: Math.max(n, x.b1) } : x))} />
                <NumberField variant="champ" label="dernier bloc" width={84}
                  min={f.b0} max={dernierBloc} value={f.b1}
                  onChange={(n) => majeur(i, (x) => (x.kind === 'blocs' ? { ...x, b1: n } : x))} />
                <em className="de-hint">0 à {dernierBloc}</em>
              </>
            ) : tables.length === 0 ? (
              // Adresse chargée en `cellule` sur une section sans table : la PHRASE, jamais deux combos vides.
              <span className="de-warn">{PHRASE_REFUS['table-sans-en-tetes']}</span>
            ) : (
              <>
                <label className="de-cell"><span>ligne</span>
                  <select aria-label={`Fragment ${i + 1} — ligne de la table`} value={f.row}
                    onChange={(e) => majeur(i, (x) => (x.kind === 'cellule' ? { ...sansTable(x), row: e.target.value } : x))}>
                    {avecCourante(lignes, f.row).map((v) => <option key="courante" value={v}>{v} — ligne absente de la section</option>)}
                    {lignes.map((v, k) => <option key={k} value={v}>{v}</option>)}
                  </select>
                </label>
                <label className="de-cell"><span>colonne</span>
                  <select aria-label={`Fragment ${i + 1} — colonne de la table`} value={f.col}
                    onChange={(e) => majeur(i, (x) => (x.kind === 'cellule' ? { ...x, col: e.target.value } : x))}>
                    {avecCourante(colonnes, f.col).map((v) => <option key="courante" value={v}>{v} — colonne absente de la section</option>)}
                    {colonnes.map((v, k) => <option key={k} value={v}>{v}</option>)}
                  </select>
                </label>
                {choixDeTable && (
                  <label className="de-cell"><span>table</span>
                    <select aria-label={`Fragment ${i + 1} — table de la ligne`} value={f.table ?? ''}
                      onChange={(e) => majeur(i, (x) => (x.kind !== 'cellule' ? x : e.target.value ? { ...x, table: e.target.value } : sansTable(x)))}>
                      <option value="">—</option>
                      {f.table != null && avecCourante(tablesTitreesDeLaLigne.map((t) => t.cle ?? ''), f.table).map((v) => <option key="courante" value={v}>{tableAbsente(v)}</option>)}
                      {tablesTitreesDeLaLigne.map((t) => <option key={t.cle} value={t.cle}>{libelleTable(t, tablesSection)}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
            {/* L'empreinte affichée dérive de la RÉSOLUTION, jamais de `f.sum` seul : un `sum` périmé
                sur un fragment qui ne résout pas est une affordance qui ment (mesuré en recette :
                16 hex sur une rangée « section absente du chapitre »). */}
            <label className="de-cell" title="Recalculée à chaque geste, jamais saisie">
              <span>empreinte</span>
              <output aria-label={`Fragment ${i + 1} — empreinte`} className="de-hint">
                {parFragment[i] && !estErreur(parFragment[i]) && f.sum
                  ? f.sum
                  : 'pas d’empreinte : l’adresse ne résout pas'}
              </output>
            </label>
            <button className="btn small danger" title="Retirer le fragment"
              onClick={() => poser(parts.filter((_, j) => j !== i))}>✕</button>
            {/* L'erreur vit DANS la rangée qu'elle DÉSIGNE — la sienne, ou celle que l'erreur de
                montage nomme (`ErreurResolution.fragment`) : avec trois fragments, un message en pied
                de champ ne dirait pas lequel corriger. */}
            {(() => {
              const err = erreurDeRangee(i);
              if (!err) return null;
              return (
                <div className="ed-field">
                  <span className="de-warn">{err.error === 'ligne-ambigue' && choixDeTable ? PHRASE_LIGNE_AMBIGUE_TABLE : PHRASE_REFUS[err.error]}</span>
                  <DetailTechnique texte={`${err.error} : ${err.detail}`} />
                </div>
              );
            })()}
          </div>
        );
      })}

      {etat === 'pret' && (() => {
        // Bouton d'engagement dont l'indisponibilité PORTE SA RAISON au survol/focus/tap : jamais un
        // `disabled` muet, jamais une mention permanente sous le bouton (arbitrage user 2026-08-24).
        // Au plafond, `fragmentNeuf` n'a rien à chercher : sur un chapitre à 1 474 blocs (LDB 08) il
        // coûtait 25 ms à CHAQUE rendu pour un résultat que le plafond rend inutile.
        const plafond = parts.length >= MAX_FRAGMENTS;
        const neuf = plafond ? null : fragmentNeuf();
        // TROIS raisons distinctes, jamais confondues : le plafond, le chapitre épuisé, et la faute
        // que l'ajout FERAIT NAÎTRE sur un fragment sain (`raisonDeNaissance`) — celle-là nomme le
        // fragment à corriger, là où « chapitre épuisé » enverrait chercher au mauvais endroit.
        const raison = plafond ? 'Une adresse monte trois fragments au plus.' : neuf!.frag ? RAISON_EPUISE : neuf!.raison;
        return (
          <div className="de-reflrow">
            <GatedAction
              id={`${uid}-fragment`}
              label="+ Fragment"
              enabled={!plafond && !!neuf?.frag}
              reason={raison}
              primary={false}
              btnClassName="small"
              onClick={() => { if (neuf?.frag) poser([...parts, sceller(neuf.frag)]); }}
            />
          </div>
        );
      })()}

      {/* APERÇU — composé des fragments résolus INDIVIDUELLEMENT, dans l'ordre : un montage qui échoue
          ne fait plus disparaître le texte des fragments valides, et le fragment fautif est marqué à sa
          place. Quand tout résout, c'est le texte du MONTAGE (celui qui fera foi) qui est rendu, par la
          MÊME primitive. */}
      {parts.length > 0 && chapitre && (
        <div className="panel">
          {/* Un fragment est MARQUÉ quand il ne résout pas SEUL, ou quand l'erreur de MONTAGE le
              désigne (deux fragments qui citent le même passage : sans cela l'aperçu composait le
              texte EN DOUBLE, sans un mot). */}
          <Prose md={resolu && !estErreur(resolu)
            ? resolu.md
            : parFragment
              .map((r, i) => (estErreur(r) || (resolu && estErreur(resolu) && resolu.fragment === i)
                ? `*[fragment ${i + 1} : non résolu]*`
                : r.md))
              .join('\n\n')} />
        </div>
      )}
      {/* Seule une erreur qui ne DÉSIGNE aucun fragment reste en pied (`montage-hors-plafond`). */}
      {resolu && estErreur(resolu) && resolu.fragment == null && (
        <div className="ed-field">
          <span className="de-warn">{PHRASE_REFUS[resolu.error]}</span>
          <DetailTechnique texte={`${resolu.error} : ${resolu.detail}`} />
        </div>
      )}
      {/* Le rescellement est un GESTE de l'auteur, jamais automatique : reposer l'empreinte sans qu'il
          ait relu ferait dire à l'adresse un texte qu'il n'a pas vu — la corruption silencieuse que
          l'adressage existe pour empêcher. */}
      {rescellable && (
        <button className="btn small" title="Repose l’empreinte de chaque fragment sur le texte du livre TEL QU’IL EST AUJOURD’HUI — à ne faire qu’après avoir relu le passage."
          onClick={() => poser(parts.map(sceller))}>
          Resceller après relecture
        </button>
      )}
    </div>
  );
}

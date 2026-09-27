/**
 * Inférence de formulaire DEPUIS la donnée (pas de schéma par dataset → un nouveau dataset s'édite
 * tout seul). Métadonnées de RENDU uniquement : décrit comment afficher un champ, sans introduire de
 * structure intermédiaire — on édite les vrais objets de `src/data`. Consommé par `CodexEdit`.
 */
import { LIBELLES_ENVELOPPE, type CleEnveloppe } from '../../data/schemas/grammaire/document';
import { valeursDe, type MetaChamp } from '../../data/schemas/grammaire/meta';
import { adresseUnPassage } from '../../data/schemas/grammaire/valeurs';
import { enfantsDe } from '../../data/schemas/grammaire/descente';

export type FieldKind = 'text' | 'textarea' | 'number' | 'checkbox' | 'stringList' | 'numberList' | 'source' | 'descRef' | 'recordNumber' | 'recordText' | 'object' | 'json' | 'select';

export interface FieldDesc {
  key: string;
  /** Libellé FR affiché (`libelleDuChamp`) — AFFICHAGE seul : `key` reste l'identité du champ. */
  label: string;
  kind: FieldKind;
  /** Le champ est null/absent sur au moins une entrée (autorise le vide). */
  nullable: boolean;
  /** Valeurs NOMMÉES d'un champ ÉNUMÉRÉ (`kind: 'select'`) — `valeur → libellé FR`, lues SUR LE NŒUD. */
  valeurs?: Readonly<Record<string, string>>;
  /** NŒUD zod du champ, quand l'appelant en tient un — ce que le sous-formulaire redescend pour
   *  retrouver les libellés de valeurs de SES propres champs (#1694). */
  noeud?: unknown;
  /** Valeur POSÉE par le def (littéral d'enveloppe) : elle s'AFFICHE, elle ne se saisit pas. */
  fige?: boolean;
}

function kindOf(key: string, v: unknown): FieldKind {
  // `source` = composite {book,page} SEULEMENT quand la donnée l'est réellement — un `source` MAISON
  // (littéral string, ex. `axes.json` #409, aucune page RAW à citer) retombe sur l'inférence générique
  // (chaîne courte) plutôt que le widget livre/page (qui écraserait la valeur par un objet au 1er edit).
  if (key === 'source' && v != null && typeof v === 'object') return 'source';
  if (key === 'desc') return 'textarea';
  // `descRef` = ADRESSE d'un passage du `Source/` (#1389) : livre/chapitre/section/fragments, avec une
  // empreinte que l'auteur ne saisit JAMAIS. L'inférence générique en ferait un sous-formulaire d'objet.
  if (key === 'descRef') return 'descRef';
  if (typeof v === 'string') return v.length > 80 ? 'textarea' : 'text';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'checkbox';
  // Tableau d'objets = json (un éditeur dédié le sort du repli ; chaînes = stringList, nombres = numberList).
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) return 'stringList';
    if (v.every((x) => typeof x === 'number')) return 'numberList';
    return 'json';
  }
  if (v && typeof v === 'object') {
    if ('book' in (v as object) && 'page' in (v as object)) return 'source';
    const vals = Object.values(v as Record<string, unknown>);
    // Record homogène : valeurs toutes nombres → grille de nombres ; toutes chaînes → grille de textes.
    if (vals.length > 0 && vals.every((x) => typeof x === 'number' || x === null)) return 'recordNumber';
    if (vals.length > 0 && vals.every((x) => typeof x === 'string')) return 'recordText';
    // Objet de config hétérogène (ex. interludeEvents.fx, raceAppearance.eyes) → sous-formulaire inféré
    // (récursif) plutôt que JSON brut — chaque sous-champ retrouve son kind structuré.
    return 'object';
  }
  return 'text';
}

/**
 * Le champ `cle` est-il DÉRIVÉ d'un autre champ de CETTE entrée ? Un champ dérivé ne s'offre pas à
 * l'édition : sa valeur ne vient pas de l'auteur, et la saisir serait écrite nulle part (la porte de
 * sérialisation la retire) tout en donnant à l'écran deux surfaces pour un même texte.
 *
 * SEUL cas aujourd'hui — la PROSE ADRESSÉE (#1389) : quand l'entrée porte `descRef`, sa `desc` est le
 * texte que l'adresse RÉSOUT, injecté au chargement du module par `wfrp:prose-source` et retiré au
 * save par `versDisque` (`grammaire/prose.ts`). Le champ d'adresse prend sa place, à SA position
 * (l'ordre des champs suit la donnée : le `desc` matérialisé s'y pose là où `descRef` vit).
 *
 * GESTE « DÉTACHER » : l'auteur qui remet le livre de l'adresse à vide fait rendre `undefined` à
 * `DescRefField` — l'entrée ne porte plus d'adresse, et `desc` redevient éditable, avec la prose
 * matérialisée pour valeur initiale. Reprendre la prose à la main est donc UN geste, pas une saisie
 * en double.
 *
 * SEUIL : une adresse ne dérive la prose que quand elle ADRESSE un passage — `adresseUnPassage`
 * (`grammaire/valeurs.ts`), qui lit le seuil `MIN_FRAGMENTS` que `descRefSchema` pose lui-même sur
 * `parts`. L'état INTERMÉDIAIRE de la composition (livre choisi, chapitre et fragments à venir :
 * `{ book, ch: '', parts: [] }`, ce que `DescRefField` rend dès le choix du livre) garde donc
 * « Description » éditable, avec la prose matérialisée — sans ce seuil, l'aller-retour vide→livre
 * laisse l'écran sans prose ni message tant que chapitre + section + blocs ne sont pas ressaisis
 * (recette 2026-09-14). Aucune surface en double n'apparaît pour autant : une adresse incomplète est
 * refusée à la sauvegarde par `descRefSchema` (`parts` `.min(MIN_FRAGMENTS)`, `grammaire/valeurs.ts`),
 * et une adresse complète fait passer `versDisque`, qui retire `desc`.
 */
export function estDerive(entree: Record<string, unknown>, cle: string): boolean {
  return cle === 'desc' && adresseUnPassage(entree.descRef);
}

/**
 * RÉGIME de libellé d'un champ : à quel étage du document il vit, et quelle méta d'édition le nomme.
 * L'enveloppe (`id`/`desc`/`source`…) n'existe qu'au PREMIER NIVEAU : un `maison` de bande de coût
 * (`naval-traits.json install.installation.bands[]`) ou un `id` d'op (`activities.json outcomes[].ops[]`)
 * PARTAGE la clé d'un champ d'enveloppe sans en être un. `LIBELLES_ENVELOPPE` est indexée par
 * `CleEnveloppe` (`grammaire/document.ts`), et ces clés ne décrivent que le premier niveau —
 * `document()` refuse d'ailleurs une méta dessus. Y appliquer le nom d'enveloppe nommerait un champ
 * qui n'existe pas à cet étage.
 */
export interface RegimeDeLibelle {
  /** Méta d'édition du document, par le canal registre (`SchemaDef.meta`) — champs de premier niveau. */
  meta?: Readonly<Record<string, MetaChamp>>;
  /** NŒUD OBJET du niveau édité (`noeudObjet`, `schemas/validate.ts`) — porteur des libellés de
   *  VALEURS de ses champs, à TOUTE profondeur : le libellé du CHAMP est un autre axe (`meta`). */
  noeud?: unknown;
  /** `document` = champ de premier niveau ; `profondeur` = sous-champ (méta dérivée : lot #1466 L6). */
  niveau?: 'document' | 'profondeur';
}

/**
 * Cascade du LIBELLÉ d'un champ (#1466 L1a, point 6), au régime `document` : clé d'ENVELOPPE → table
 * FR de la fabrique (`LIBELLES_ENVELOPPE`, seule détentrice de ces noms puisque `document()` refuse
 * une méta dessus) ; sinon méta d'édition du def ; sinon la clé technique — seam d'extinction à
 * mesure de l'adoption (L1b #1467).
 *
 * Au régime `profondeur`, un sous-champ rend TOUJOURS sa clé : enveloppe et méta décrivent le PREMIER
 * NIVEAU du document (`document()` exige une méta par clé de `champs`, tous de premier niveau), et le
 * nommage d'un sous-champ est la dérivation du lot #1466 L6.
 *
 * EXCLUSION : `type` sur un document SANS méta (donc sans handle) n'est pas le type de document mais
 * un DISCRIMINANT de charge utile (characteristics/qualities/skills/trappings/spells, mesuré) — le
 * libeller « Type de document » mentirait à l'écran.
 */
export function libelleDuChamp(key: string, { meta, niveau = 'document' }: RegimeDeLibelle = {}): string {
  if (niveau === 'profondeur') return key;
  // Lecture sur les PROPRES clés de la table (jamais la chaîne de prototypes : `toString` rendrait
  // une fonction là où l'écran attend une chaîne).
  if (Object.prototype.hasOwnProperty.call(LIBELLES_ENVELOPPE, key) && !(key === 'type' && !meta)) return LIBELLES_ENVELOPPE[key as CleEnveloppe];
  return meta?.[key]?.label ?? key;
}

/** Champs (ordre = 1re apparition), type inféré du 1er échantillon non-null de chaque clé — et, pour
 *  un tableau, de l'UNION de ses éléments sur toutes les entrées ; libellé par `libelleDuChamp`
 *  (la `meta` du def, quand il en a une, arrive par le registre de schémas). */
export function inferFields(entries: Record<string, unknown>[], regime: RegimeDeLibelle = {}): FieldDesc[] {
  const keys: string[] = [];
  for (const e of entries) for (const k of Object.keys(e)) if (!keys.includes(k)) keys.push(k);
  return keys.map((key) => {
    let sample: unknown;
    let sawNull = false;
    // Un TABLEAU se classe sur l'UNION de ses éléments à travers TOUTES les entrées : `every` est VRAI
    // à vide, donc un premier échantillon `[]` (fréquent en tête de dataset) ne prouve RIEN sur la forme
    // des éléments — et une liste d'OBJETS ne peut jamais tomber en `stringList`/`numberList` (#1548).
    // DEUX cliquets : `editfields-union-elements.test.ts` tient l'ALGORITHME (union vs premier
    // échantillon) sur des entrées forgées ; `editfields-listes-objets.test.ts` scanne la DONNÉE
    // réelle de toutes les catégories éditables. Mesuré 2026-08-31 : le second reste VERT sous
    // l'algorithme « premier échantillon » (les champs qui basculeraient sont tous filtrés par
    // `dedicatedFieldKeys`/`refFieldCfg`) — seul le premier mord.
    const elements: unknown[] = [];
    for (const e of entries) {
      const v = e[key];
      if (v == null) { sawNull = true; continue; }
      if (Array.isArray(v)) elements.push(...v);
      if (sample === undefined) sample = v;
    }
    const echantillon = Array.isArray(sample) ? elements : sample;
    // Un champ ÉNUMÉRÉ se rend en `select` : ses options ET leurs libellés viennent de son NŒUD
    // (`enumNomme`, #1694), jamais de la donnée observée — une valeur qu'aucune entrée ne porte encore
    // reste proposable, et une valeur inconnue de l'enum n'est pas proposée. Le NŒUD vaut à TOUTE
    // profondeur : un champ énuméré de sous-formulaire se nomme comme un champ de racine.
    const noeud = enfantsDe(regime.noeud).find((e) => e.cle === key)?.noeud;
    const valeurs = valeursDe(noeud);
    const nullable = sawNull || sample === undefined;
    if (valeurs) return { key, label: libelleDuChamp(key, regime), kind: 'select' as FieldKind, nullable, valeurs, noeud };
    return { key, label: libelleDuChamp(key, regime), kind: kindOf(key, echantillon), nullable, noeud };
  });
}

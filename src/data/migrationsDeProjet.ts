/**
 * Les MIGRATIONS de FORME du document de projet (`ProjectDoc`, `state/worldMap.ts`), keyées par `schema`
 * de DÉPART : `SCHEMA_PROJET` en dérive (`schemas/defs-scenes/projet.ts`, `versionCourante`, #2226).
 * Chaînées par `migrateDoc` dans la porte `parseProject` (`state/worldMap.ts`).
 */
import type { Fige, ReliefDefaults, SceneRoofDefaults } from '../state/scene';
import type { MigrationMap } from '../state/migrateDoc';
import type { NarratifBlock } from '../state/campaignNarratif';
import { graphieOpsDeTalentDeep } from './graphieOpsDeTalent';
import { remapSortsFusionnesDeep } from './sortsFusionnes';
import { findPropById, findSpeciesById, creatureSemee, vehiculeSeme, navireSeme } from './index';
import { typeNonNomme } from './schemas/defs-scenes/scene';

/** Le narratif vide que posait la migration 2 → 3. */
// 782383c32
const NARRATIF_VIDE_2_VERS_3 = (): NarratifBlock => ({ affaires: [], indices: [], presetsPnj: [], objets: [] });

/** L'id de l'action de fouille que posait la migration 10 → 11. */
// 81e015d55
const ACTION_FOUILLER_10_VERS_11 = 'fouiller';

/** Renomme UNE clé d'un objet EN PLACE (position préservée), sans la créer si elle est absente. */
function renommeCle(o: Record<string, unknown>, de: string, vers: string): Record<string, unknown> {
  if (!(de in o)) return o;
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k === de ? vers : k, v]));
}

/** Pose `type: 'statblock'` (1ʳᵉ clé) sur le profil embarqué d'une entité de scène, s'il en porte un
 *  et qu'il ne l'annonce pas encore. Une entité SANS `statblock` traverse intacte. */
function typeDeStatbloc(e: unknown): unknown {
  if (!e || typeof e !== 'object') return e;
  const ent = e as Record<string, unknown>;
  const sb = ent.statblock;
  if (!sb || typeof sb !== 'object' || 'type' in (sb as object)) return ent;
  return { ...ent, statblock: { type: 'statblock', ...(sb as Record<string, unknown>) } };
}

/** Un effet narratif porte sa prose sous `text` en schema 3 (`journal`, `document`, `setObjective`). */
const EFFETS_A_PROSE = new Set(['journal', 'document', 'setObjective']);

/**
 * Descente RECONNAISSANTE d'un document schema 3 : un porteur est reconnu à sa FORME (un nœud de
 * dialogue porte `choices`, un effet narratif porte un `type` de `EFFETS_A_PROSE`), jamais par
 * exclusion — le `text` d'une op `narrative` ou d'un `TrappingRef` traverse intact.
 */
function migreProse(v: unknown, dansNodes: boolean): unknown {
  if (Array.isArray(v)) return v.map((x) => migreProse(x, dansNodes));
  if (!v || typeof v !== 'object') return v;
  const src = v as Record<string, unknown>;
  let o: Record<string, unknown> = Object.fromEntries(
    Object.entries(src).map(([k, x]) => [k, migreProse(x, k === 'nodes' ? true : k === 'choices' ? false : dansNodes)]),
  );
  const estNoeud = dansNodes && Array.isArray(o.choices);
  const estEffetNarratif = typeof o.type === 'string' && EFFETS_A_PROSE.has(o.type);
  if (estNoeud || estEffetNarratif) o = renommeCle(o, 'text', 'desc');
  // Prose ABSENTE = clé absente (les snapshots d'`ItemInstance` embarqués portaient `desc: null`).
  if (o.desc === null) { const { desc: _nul, ...reste } = o; o = reste; }
  return o;
}

/** Les CHOIX d'un dialogue : `text` y était un LIBELLÉ, pas de la prose. */
function migreChoix(scenes: unknown): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    const sc = s as Record<string, unknown>;
    if (!Array.isArray(sc.dialogues)) return sc;
    return {
      ...sc,
      dialogues: sc.dialogues.map((d) => {
        const dl = d as Record<string, unknown>;
        if (!Array.isArray(dl.nodes)) return dl;
        return {
          ...dl,
          nodes: dl.nodes.map((n) => {
            const nd = n as Record<string, unknown>;
            if (!Array.isArray(nd.choices)) return nd;
            return { ...nd, choices: nd.choices.map((c) => renommeCle(c as Record<string, unknown>, 'text', 'label')) };
          }),
        };
      }),
    };
  });
}

/**
 * SEMENCES GELÉES des migrations 7 → 8 et 8 → 9 — les valeurs que le code posait EN DUR au moment de
 * chaque lot (#1691 relief, #1715 toiture), figées ici avec leur migration.
 *
 * Elles ne lisent PAS la semence du jour (`semences-de-scene.json`, #1716) et ne doivent jamais le
 * faire : une migration reconstitue ce qu'un projet de bibliothèque utilisateur AVAIT, pas ce qu'une
 * scène neuve recevrait aujourd'hui — si l'auteur ré-édite sa semence, ses vieux projets doivent
 * continuer à se rendre à l'identique. C'est aussi ce que mesurent la parité avec les scripts de
 * dépôt (`scripts/migrations/2026-09-07-1691-…mjs`, `2026-09-09-1715-…mjs`), eux aussi gelés.
 */
const SEMENCE_RELIEF_1691 = {
  cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier',
} as const satisfies Fige<ReliefDefaults>;
const SEMENCE_TOITURE_1715 = {
  material: 'toit-ardoise', pitchDeg: 45, riseMaxStoreys: 1,
} as const satisfies Fige<SceneRoofDefaults>;

/**
 * Pose une clé de SCÈNE sur chaque scène d'un document, à la POSITION que `emptyScene` lui donne —
 * geste PARTAGÉ par les migrations qui EXIGENT un nouveau champ de scène (#1691 `reliefDefaults`,
 * #1715 `roofDefaults`) : c'est le même mouvement, pas deux.
 *
 * Trois invariants, tenus ici une seule fois : une scène qui porte DÉJÀ la clé traverse INTACTE (un
 * document hybride n'est pas réécrit — c'est le schéma qui juge sa forme) ; l'ANCRE absente met la
 * clé en queue plutôt que de deviner un rang ; ce qui n'est pas une liste de scènes traverse tel
 * quel (`parseProject` le refuse ensuite, en le nommant).
 *
 * La valeur est une FABRIQUE : chaque scène reçoit SA copie, jamais un objet partagé entre scènes.
 */
function poseSurChaqueScene(
  scenes: unknown,
  cle: string,
  valeur: () => unknown,
  ancre: { avant: string } | { apres: string },
): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    if (!s || typeof s !== 'object' || cle in s) return s;
    const sc = s as Record<string, unknown>;
    const cles = Object.keys(sc);
    const pose: [string, unknown] = [cle, valeur()];
    const repere = 'avant' in ancre ? ancre.avant : ancre.apres;
    const rang = cles.indexOf(repere);
    const coupe = rang < 0 ? cles.length : 'avant' in ancre ? rang : rang + 1;
    const entree = (k: string): [string, unknown] => [k, sc[k]];
    return Object.fromEntries([...cles.slice(0, coupe).map(entree), pose, ...cles.slice(coupe).map(entree)]);
  });
}

/**
 * Pose la clé `cle` en QUEUE de chaque ENTITÉ de chaque scène que `retient` désigne — sœur de
 * `poseSurChaqueScene`, d'un cran plus bas dans le document.
 *
 * MÊMES trois invariants : une entité qui porte DÉJÀ la clé traverse INTACTE, ce qui n'est pas une
 * liste traverse tel quel (`parseProject` le refuse ensuite en le nommant), la valeur est une
 * FABRIQUE (chaque entité reçoit SA copie). La clé et la valeur peuvent se lire sur l'entité retenue
 * (#1882 : `ref` ou `statblock` selon l'espèce).
 *
 * QUEUE, sans ancre : c'est la place que l'ÉDITEUR donne à un champ posé sur une entité existante
 * (`editEntity` étale l'entité puis le patch, `state/sceneEdit.ts`) — la migration écrit donc ce que
 * l'auteur aurait écrit à la main.
 */
function poseSurChaqueEntite(
  scenes: unknown,
  cle: string | ((ent: Record<string, unknown>) => string),
  valeur: (ent: Record<string, unknown>) => unknown,
  retient: (ent: Record<string, unknown>) => boolean,
): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    if (!s || typeof s !== 'object' || !Array.isArray((s as Record<string, unknown>).entities)) return s;
    const sc = s as Record<string, unknown>;
    const entities = (sc.entities as unknown[]).map((e) => {
      if (!e || typeof e !== 'object') return e;
      const ent = e as Record<string, unknown>;
      if (!retient(ent)) return ent;
      const k = typeof cle === 'string' ? cle : cle(ent);
      return k in ent ? ent : { ...ent, [k]: valeur(ent) };
    });
    return { ...sc, entities };
  });
}

/** Une entité dont le TYPE de décor porte des places assises — la seule capacité qui vive sur le
 *  TYPE, donc la seule population que l'activation d'instance (#1687) concerne.
 *
 *  Le catalogue est lu à l'INSTANT de la migration : un type qui gagnerait des `seatSlots` plus tard
 *  n'active rétroactivement aucune instance — l'activation reste un opt-in d'AUTEUR, à la case de
 *  l'inspecteur. */
const porteDesPlaces = (ent: Record<string, unknown>): boolean =>
  ent.kind === 'prop' && (findPropById(typeof ent.ref === 'string' ? ent.ref : undefined)?.seatSlots?.length ?? 0) > 0;

/** Un décor qui ne NOMME aucun type — la population que le bump 11 → 12 nomme explicitement. */
const decorSansType = (ent: Record<string, unknown>): boolean => ent.kind === 'prop' && ent.ref === undefined;

/** Le type que le rendu DONNAIT à un décor sans `ref` avant #877. Ce littéral ne vit QUE dans la
 *  migration 11 → 12 : une migration FIGE un passé, elle ne pose pas un défaut. */
const REF_DU_RENDU_AVANT_877 = 'tonneau';

/** Un personnage qui ne NOMME aucune fiche (`typeNonNomme`) — la population que le bump 12 → 13 nomme. */
const personnageSansFiche = (ent: Record<string, unknown>): boolean =>
  ent.kind === 'personnage' && typeNonNomme({ id: String(ent.id), kind: 'personnage', ref: ent.ref, statblock: ent.statblock, presetId: ent.presetId }) !== undefined;

/** Le profil standard (`LDB 77 l.7`) de l'espèce AUTHORÉE de l'entité — lu au catalogue à l'INSTANT de
 *  la migration ; `undefined` pour une espèce absente, un id de rig ou une espèce sans profil. */
const profilDeLEspece = (ent: Record<string, unknown>): string | undefined => {
  const species = (ent.appearance as { species?: unknown } | undefined)?.species;
  return typeof species === 'string' ? findSpeciesById(species)?.profilStandard?.id : undefined;
};

/** Le statbloc que la branche `!ref` de `spawnEnemy` posait avant #1882 (`state/spawn.ts`) : même
 *  libellé, même profil. Porté par l'entité, il passe par la branche `statblock`, qui reçoit
 *  l'`appearance` : la forme du corps suit alors l'espèce authorée (`bodyShapeForSpecies`). Ce littéral ne
 *  vit QUE dans la migration 12 → 13. */
const FICHE_DU_SPAWN_AVANT_1882 = (): Record<string, unknown> => ({ type: 'statblock', label: 'Ennemi', char: { B: 10 } });

/** Un porteur VIDE (`ref: ''`, `presetId: ''`) n'est pas un porteur (`typeNonNomme`) : le bump 12 → 13 le
 *  retire avant de nommer la fiche, même politique que l'absence. */
function sansPorteurVide(scenes: unknown): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    if (!s || typeof s !== 'object' || !Array.isArray((s as Record<string, unknown>).entities)) return s;
    const sc = s as Record<string, unknown>;
    const entities = (sc.entities as unknown[]).map((e) => {
      if (!e || typeof e !== 'object' || !personnageSansFiche(e as Record<string, unknown>)) return e;
      return Object.fromEntries(Object.entries(e).filter(([k, v]) => !((k === 'ref' || k === 'presetId') && v === '')));
    });
    return { ...sc, entities };
  });
}

/**
 * La fouille d'un décor devient une ACTION AUTHORÉE, et l'enveloppe `usable` vide se NOMME (#1687).
 *
 * L'enveloppe prend la PLACE qu'occupait `interact` (patron `renommeCle`) : le document migré est
 * celui que l'auteur aurait écrit. L'ancien `consume` (le décor disparaît) traverse tel quel ; son
 * absence devient `unique` — la fouille sans butin restait en place, marquée jouée. Une entité sans
 * `interact` ni `usable` traverse INTACTE, et ce qui n'est pas une liste traverse tel quel
 * (`parseProject` le refuse ensuite, en le nommant).
 */
function migreActionsAuthorees(scenes: unknown): unknown {
  if (!Array.isArray(scenes)) return scenes;
  return scenes.map((s) => {
    if (!s || typeof s !== 'object' || !Array.isArray((s as Record<string, unknown>).entities)) return s;
    const sc = s as Record<string, unknown>;
    const entities = (sc.entities as unknown[]).map((e) => {
      if (!e || typeof e !== 'object') return e;
      const ent = e as Record<string, unknown>;
      const it = ent.interact as { flow?: unknown; consume?: boolean } | undefined;
      const avant = ent.usable as Record<string, unknown> | undefined;
      if (it === undefined && avant === undefined) return ent;
      const base: Record<string, unknown> = avant && Object.keys(avant).length === 0 ? { assise: true } : { ...avant };
      const usable = it?.flow === undefined
        ? base
        : {
          ...base,
          actions: [
            ...(Array.isArray(base.actions) ? base.actions : []),
            { id: ACTION_FOUILLER_10_VERS_11, flow: it.flow, ...(it.consume ? { consume: true } : { unique: true }) },
          ],
        };
      return Object.fromEntries(
        Object.entries(ent)
          .filter(([k]) => !(k === 'usable' && ent.interact !== undefined))
          .map(([k, v]) => (k === 'interact' || k === 'usable' ? ['usable', usable] : [k, v])),
      );
    });
    return { ...sc, entities };
  });
}

/** La forme SOURCE d'une référence de sort de preset au format 14 : objet de clé UNIQUE `id`, chaîne
 *  non vide — le seul élément qui se dénude SANS PERTE (`{ id, spec }` perdrait `spec`). */
const estSortSource = (s: unknown): s is { id: string } =>
  !!s && typeof s === 'object' && !Array.isArray(s) && Object.keys(s).length === 1
  && typeof (s as { id?: unknown }).id === 'string' && (s as { id: string }).id.length > 0;

/** `{ id }` → id nu dans `presetsPnj[].profil.spells` (bump 14 → 15, #1897) ; le reste traverse intact. */
function denudeSortsDePreset(narratif: unknown): unknown {
  const nb = narratif as { presetsPnj?: unknown } | null;
  if (!nb || typeof nb !== 'object' || !Array.isArray(nb.presetsPnj)) return narratif;
  const presetsPnj = nb.presetsPnj.map((p) => {
    const profil = (p as { profil?: { spells?: unknown } } | null)?.profil;
    if (!profil || !Array.isArray(profil.spells)) return p;
    const spells = profil.spells.map((s) => (estSortSource(s) ? s.id : s));
    return { ...(p as object), profil: { ...profil, spells } };
  });
  return { ...nb, presetsPnj };
}

/** Migrations SÉQUENTIELLES de ProjectDoc : la clé N met à niveau un schema N → N+1. `2` injecte le
 *  bloc `narratif` vide (#765 — un projet schema 2 est un paquet SANS narratif). `3` porte les
 *  RÔLES DE PROSE du lot #1467 L1b V-P2 : c'est la MÊME transformation que les migrations de dépôt
 *  (`scripts/migrations/2026-08-27-l1b-3{a,b,g,h}-*.mjs`), appliquée au CHARGEMENT — sans elle, un
 *  projet exporté avant ce lot (bibliothèque utilisateur, `.json` portable) mourrait sur le schéma.
 *  Ajouter ici la migration N→N+1 pour tout futur bump, plutôt que de refuser en silence des projets
 *  antérieurs valides : `SCHEMA_PROJET` en dérive. */
export const PROJECT_MIGRATIONS = {
  2: (doc) => ({ ...doc, narratif: NARRATIF_VIDE_2_VERS_3() }),
  3: (doc) => {
    // Un document SANS `scenes` valide traverse INTACT : c'est `parseProject` qui le refuse, avec son
    // message actionnable — une migration ne doit jamais transformer une donnée absente en exception.
    if (!Array.isArray(doc.scenes)) return doc;
    const scenesProse = migreProse(doc.scenes, false) as unknown[];
    const scenes = (migreChoix(scenesProse) as Record<string, unknown>[]).map((s) => {
      const avecDesc = renommeCle(s, 'description', 'desc');
      // Prose ABSENTE = clé absente : ni `null`, ni chaîne vide (le schéma pose `.min(1).optional()`).
      if (avecDesc.desc === '' || avecDesc.desc === null) { const { desc: _sans, ...reste } = avecDesc; return reste; }
      return avecDesc;
    });
    const meta = doc.meta && typeof doc.meta === 'object'
      ? renommeCle(doc.meta as Record<string, unknown>, 'description', 'desc')
      : doc.meta;
    return { ...doc, scenes, ...(doc.meta !== undefined ? { meta } : {}) };
  },
  /**
   * `4` APLATIT l'enveloppe (#1467 L1b V-formeProjet) : les champs de la poche `meta` remontent à la
   * RACINE et `version` y devient `versionContenu`. Le renommage n'est pas cosmétique, et le risque
   * MESURÉ n'est pas un refus : `parseProject` pose `version: obj.schema` EN DERNIER dans le spread,
   * donc un `version` de CONTENU à la racine serait ÉCRASÉ par le numéro de forme, puis PURGÉ avec la
   * clé de travail avant le retour. Gardé sous le nom `version`, le numéro de l'auteur ne survivrait
   * donc JAMAIS à un chargement — perte SILENCIEUSE (aucune erreur), et `importDecision` comparerait
   * 0 à 0 pour l'éternité. Le nom distinct est ce qui met le numéro hors de portée de l'écrasement.
   */
  4: (doc) => {
    const { meta, ...reste } = doc;
    if (!meta || typeof meta !== 'object') return reste;
    const { version: versionContenu, ...identite } = meta as Record<string, unknown>;
    return {
      ...reste,
      ...identite,
      ...(versionContenu !== undefined ? { versionContenu } : {}),
    };
  },
  /**
   * `5` donne au LIBELLÉ sa graphie canonique (#1467 L1b V-P7) : la clé `nom` d'une scène et de la
   * carte du monde devient `label`, à sa POSITION exacte. Les deux portaient un libellé d'affichage
   * pur — l'identité est `id`, présente sur les deux depuis toujours. Le même passage pose le `type`
   * des statblocs EMBARQUÉS (`scenes[].entities[].statblock`) : un document embarqué s'annonce dans
   * la donnée, et le schéma l'EXIGE désormais (`defs-scenes/communs.ts`) — sans ce passage, tout
   * projet antérieur (bibliothèque utilisateur, `.json` portable) mourrait au parse.
   */
  5: (doc) => {
    const scenes = Array.isArray(doc.scenes)
      ? doc.scenes.map((s) => {
        const sc = renommeCle(s as Record<string, unknown>, 'nom', 'label');
        if (!Array.isArray(sc.entities)) return sc;
        return { ...sc, entities: sc.entities.map(typeDeStatbloc) };
      })
      : doc.scenes;
    const worldMap = doc.worldMap && typeof doc.worldMap === 'object'
      ? renommeCle(doc.worldMap as Record<string, unknown>, 'nom', 'label')
      : doc.worldMap;
    return {
      ...doc,
      ...(doc.scenes !== undefined ? { scenes } : {}),
      ...(doc.worldMap !== undefined ? { worldMap } : {}),
    };
  },
  /**
   * `6` fait S'ANNONCER le document et ses scènes (#1552) : `type: 'projet'` à la racine,
   * `type: 'scene'` sur chaque scène embarquée — même geste que le `type: 'statblock'` de la 5→6, et
   * même raison : un document embarqué s'annonce dans la donnée, et le schéma l'EXIGE désormais.
   * Le même passage pose la PROVENANCE quand le document n'en porte aucune : `maison`, la seule
   * que la migration puisse DIRE sans inventer (un folio ne se devine pas ; le document en porte
   * un, ou il dit qu'il n'en a pas). L'IDENTITÉ, elle, ne se fabrique pas : un projet antérieur
   * sans `id`/`label`/`versionContenu` ressort tel quel de la migration et se fait REFUSER par le
   * schéma, qui NOMME les champs manquants (arbitrage 2026-08-31 : un projet se nomme).
   */
  6: (doc) => {
    const scenes = Array.isArray(doc.scenes)
      ? doc.scenes.map((s) => (s && typeof s === 'object' && !('type' in s) ? { type: 'scene', ...(s as object) } : s))
      : doc.scenes;
    const provenance = doc.source === undefined && doc.maison === undefined
      ? { maison: MAISON_PROJET_AUTHORE }
      : {};
    return {
      type: 'projet',
      ...doc,
      ...(doc.scenes !== undefined ? { scenes } : {}),
      ...provenance,
    };
  },
  /**
   * `7` pose les MATIÈRES DE RELIEF de chaque scène (#1691) : `reliefDefaults`, EXIGÉ par
   * `sceneSchema` depuis que `gameIso/builders/floors.ts` ne choisit plus aucune matière. Les valeurs
   * posées sont `SEMENCE_RELIEF_1691` — exactement ce que le builder choisissait en dur avant le
   * lot, donc un projet de bibliothèque utilisateur se rend à l'identique après migration. La clé va
   * à la POSITION que la création lui donne (`emptyScene`) : juste avant `layers`. Une scène qui en
   * porte déjà un traverse INTACTE (un document hybride n'est pas réécrit par cette migration ; c'est
   * le schéma qui juge sa forme).
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-07-1691-relief-defaults-scenes.mjs`
   * (parité mesurée par `projet-migration-7-vers-8.test.ts`).
   */
  7: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueScene(doc.scenes, 'reliefDefaults', () => ({ ...SEMENCE_RELIEF_1691 }), { avant: 'layers' }) }
      : {}),
  }),
  /**
   * `8` pose la TOITURE PAR DÉFAUT de chaque scène (#1715) : `roofDefaults`, EXIGÉ par `sceneSchema`
   * depuis que la dérivation des masses ne choisit plus ni couverture, ni pente de référence, ni
   * borne de comble (`toitureEffective`, `state/sceneEdit.ts`). Les valeurs posées sont
   * `SEMENCE_TOITURE_1715` — exactement ce que la dérivation appliquait en dur avant le lot, donc un
   * projet de bibliothèque utilisateur se rend à l'identique après migration. La clé va à la POSITION
   * que la création lui donne (`emptyScene`) : juste après `reliefDefaults`. Une scène qui en porte
   * déjà une traverse INTACTE.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-09-1715-roof-defaults-scenes.mjs`
   * (parité mesurée par `projet-migration-8-vers-9.test.ts`).
   */
  8: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueScene(doc.scenes, 'roofDefaults', () => ({ ...SEMENCE_TOITURE_1715 }), { apres: 'reliefDefaults' }) }
      : {}),
  }),
  /**
   * `9` ACTIVE les décors qui étaient assis-ables AVANT le lot #1687 : `usable: {}` sur chaque entité
   * dont le TYPE porte des `seatSlots`. Depuis ce lot, l'assise d'un siège autonome est une propriété
   * de l'INSTANCE, activée par l'auteur (verbatim utilisateur 2026-09-09 : « on doit pouvoir
   * s'assoire sur une chaise si dans l'éditeur on l'active ») : sans ce passage, les meubles à places
   * d'un projet de bibliothèque utilisateur deviendraient MUETS. Une entité qui porte déjà `usable`
   * traverse INTACTE.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-10-1687-usable-sieges.mjs`
   * (parité mesurée par `projet-migration-9-vers-10.test.ts`).
   */
  9: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueEntite(doc.scenes, 'usable', () => ({}), porteDesPlaces) }
      : {}),
  }),
  /**
   * `10` donne à l'enveloppe `usable` ses deux faits NOMMÉS (#1687) : la fouille quitte le champ
   * `interact`, que le schéma ne connaît plus, pour devenir une ACTION AUTHORÉE du vocabulaire ouvert
   * (`usable.actions`), et l'enveloppe VIDE posée par la 9→10 — qui disait « assise activée » par sa
   * seule PRÉSENCE — dit désormais `assise: true`. Sans ce passage, un projet de bibliothèque
   * utilisateur serait REFUSÉ au parse sur sa première clé `interact` (`strictObject`) et ses meubles
   * à places redeviendraient muets.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-11-1687-actions-authorees.mjs`
   * (parité mesurée par `projet-migration-10-vers-11.test.ts`).
   */
  10: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined ? { scenes: migreActionsAuthorees(doc.scenes) } : {}),
  }),
  /**
   * `11` NOMME le type de tout décor qui n'en nommait aucun (#877) : `ref` devient REQUISE sur une
   * entité `kind:'prop'` et résolue au registre `props.json` (`defs-scenes/scene.ts`). Avant ce lot,
   * le MONDE remplaçait la ref absente par un littéral en dur ; la migration ÉCRIT ce que le monde
   * DESSINAIT, donc le décor de scène d'un projet de bibliothèque utilisateur ressort inchangé. Le
   * backend SPRITE, qui ne dessinait RIEN d'une ref absente, s'ALIGNE dessus — c'est la divergence
   * qui meurt, pas le dessin. Sans ce passage, le projet serait REFUSÉ au parse sur son premier
   * décor sans type.
   * Une entité qui porte déjà `ref` traverse INTACTE, et un décor à ref MORTE n'est pas de ce ressort :
   * il se fait NOMMER par le schéma, jamais remplacer.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-21-877-ref-de-decor-nommee.mjs`
   * (parité mesurée par `projet-migration-11-vers-12.test.ts`).
   */
  11: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueEntite(doc.scenes, 'ref', () => REF_DU_RENDU_AVANT_877, decorSansType) }
      : {}),
  }),
  /**
   * `12` NOMME la fiche de tout personnage qui n'en nommait aucune (#1882) : un porteur (`ref`,
   * `statblock` ou `presetId`) devient REQUIS sur une entité `kind:'personnage'`
   * (`PORTEURS_DU_TYPE`, `defs-scenes/scene.ts`). L'espèce authorée porte un profil standard
   * (`LDB 77 l.7`, `species.json`) → `ref` = ce profil ; sinon (espèce absente, id de rig, espèce
   * sans profil) → le statbloc de la branche `!ref` d'avant #1882, écrit en `statblock` explicite
   * (`FICHE_DU_SPAWN_AVANT_1882` : libellé et profil identiques, forme du corps de l'espèce). Sans ce passage, le
   * projet serait REFUSÉ au parse sur son premier personnage sans fiche.
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-23-1882-fiche-de-personnage-nommee.mjs`
   * (parité mesurée par `projet-migration-12-vers-13.test.ts`).
   */
  12: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? {
        scenes: poseSurChaqueEntite(
          sansPorteurVide(doc.scenes),
          (ent) => (profilDeLEspece(ent) ? 'ref' : 'statblock'),
          (ent) => profilDeLEspece(ent) ?? FICHE_DU_SPAWN_AVANT_1882(),
          personnageSansFiche,
        ),
      }
      : {}),
  }),
  /** 13 → 14 (#1882) : `livingRefSchema.creatureId`, `givePossession.ref.vehicleId` et `setVessel.vehicleId` exigent un id RÉSOLU
   *  (`idDe`). Avant, l'effet neuf (`make`, éditeur) semait `''` : ce vide reçoit ce que l'outil sème
   *  aujourd'hui (`creatureSemee`, `vehiculeSeme`, `navireSeme`). Pendant applicatif du script de dépôt
   *  `scripts/migrations/2026-09-24-1882-refs-vivantes-semees.mjs` (parité : `projet-migration-13-vers-14.test.ts`). */
  13: (doc) => semeLesRefsVides(doc) as typeof doc,
  /**
   * `14` DÉNUDE la référence de sort d'un preset de PNJ (#1897) : `narratif.presetsPnj[].profil` reprend
   * le def créature, dont `spells` adopte `refs('spell')` — `{ id }` devient l'id nu, À SA PLACE. Sans ce
   * passage, un projet de bibliothèque utilisateur serait REFUSÉ au parse sur son premier sort de preset.
   * Un élément déjà nu traverse INTACT ; ce qui ne se dénude pas SANS PERTE (`{ id, spec }`, `{ id: '' }`)
   * et ce qui n'est pas une liste traversent tels quels (`parseProject` les refuse ensuite, en les nommant).
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-24-1897-projet-sorts-de-preset-ids-nus.mjs`,
   * qui refuse les mêmes formes : parité mesurée par `projet-migration-14-vers-15.test.ts`, qui joue la
   * MÊME fixture par les deux.
   */
  14: (doc) => ({
    ...doc,
    ...(doc.narratif !== undefined ? { narratif: denudeSortsDePreset(doc.narratif) } : {}),
  }),
  /**
   * `15` fait désigner à chaque id de sort FUSIONNÉ par #1897 l'entrée qui l'a absorbé
   * (`SORTS_FUSIONNES_1897`, table GELÉE), à toute place de sort du document — primitive
   * `remapSortsFusionnesDeep` (`src/data/sortsFusionnes.ts`), la même que `ROSTER_MIGRATIONS[4]`. Sans ce
   * passage, un projet de bibliothèque utilisateur qui cite un sort fusionné serait REFUSÉ au parse
   * (`idDe('spell')`).
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-24-1897-projet-sorts-fusionnes.mjs`
   * (parité mesurée par `projet-migration-15-vers-16.test.ts`, qui joue la MÊME fixture par les deux).
   */
  15: (doc) => remapSortsFusionnesDeep(doc) as Record<string, unknown>,
  /**
   * `16` écrit la référence de Talent des ops `grantTalent` / `grantCareerTalent` à la graphie
   * `talent: { id, spec? }` (#1473, train 2a) — primitive `graphieOpsDeTalentDeep`
   * (`src/data/graphieOpsDeTalent.ts`). Sans ce passage, un projet de bibliothèque utilisateur qui porte
   * une op de Talent serait REFUSÉ au parse (op typée, `grammaire/mecanique.ts`).
   * Pendant applicatif du script de dépôt `scripts/migrations/2026-09-24-2a-1473-projet-graphie-ops-de-talent.mjs`
   * (parité mesurée par `projet-migration-16-vers-17.test.ts`, qui joue la MÊME fixture par les deux).
   */
  16: (doc) => graphieOpsDeTalentDeep(doc) as Record<string, unknown>,
} satisfies MigrationMap;

/** Toute réf. VIDE d'un `startPursuit` (`foes[].ref.creatureId`), d'un `givePossession` (`ref.creatureId`,
 *  `ref.vehicleId`) ou d'un `setVessel` (`vehicleId`), où que l'effet soit niché dans le DOCUMENT (Scène,
 *  péril de route de `worldMap`, …), reçoit la réf. que l'outil sème (`PROJECT_MIGRATIONS[13]`). Le reste
 *  traverse à l'identique. */
export function semeLesRefsVides(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(semeLesRefsVides);
  if (!v || typeof v !== 'object') return v;
  const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, semeLesRefsVides(x)])) as Record<string, unknown>;
  const seme = (ref: unknown): unknown => {
    if (!ref || typeof ref !== 'object') return ref;
    const r = ref as Record<string, unknown>;
    if (r.creatureId === '') return { ...r, creatureId: creatureSemee() };
    if (r.vehicleId === '') return { ...r, vehicleId: vehiculeSeme() };
    return r;
  };
  if (o.type === 'setVessel' && o.vehicleId === '') return { ...o, vehicleId: navireSeme() };
  if (o.type === 'givePossession') return { ...o, ref: seme(o.ref) };
  if (o.type === 'startPursuit' && Array.isArray(o.foes))
    return { ...o, foes: o.foes.map((f) => (f && typeof f === 'object' ? { ...(f as object), ref: seme((f as { ref?: unknown }).ref) } : f)) };
  return o;
}

/** Provenance d'une campagne AUTHORÉE À L'ÉDITEUR : aucun livre ne la publie, et un folio ne se
 *  devine pas. SOURCE UNIQUE — posée par la migration 6→7 sur un projet qui n'en portait aucune,
 *  et par l'éditeur sur un projet qu'il nomme pour la première fois (`src/ui/editor/Editor.tsx`). */
export const MAISON_PROJET_AUTHORE =
  'campagne authorée à l’éditeur de scènes — aucun livre ne la publie, le document ne cite aucun folio à sa racine';

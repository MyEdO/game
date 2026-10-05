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
  // #1467
  if (o.desc === null) { const { desc: _nul, ...reste } = o; o = reste; }
  return o;
}

// #1467
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

// #877
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

// #1882
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

// #765 · #1467
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
  // #1467
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
  // #1467
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
  // #1552
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
  // #1691
  7: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueScene(doc.scenes, 'reliefDefaults', () => ({ ...SEMENCE_RELIEF_1691 }), { avant: 'layers' }) }
      : {}),
  }),
  // #1715
  8: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueScene(doc.scenes, 'roofDefaults', () => ({ ...SEMENCE_TOITURE_1715 }), { apres: 'reliefDefaults' }) }
      : {}),
  }),
  // #1687
  9: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueEntite(doc.scenes, 'usable', () => ({}), porteDesPlaces) }
      : {}),
  }),
  // #1687
  10: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined ? { scenes: migreActionsAuthorees(doc.scenes) } : {}),
  }),
  // #877
  11: (doc) => ({
    ...doc,
    ...(doc.scenes !== undefined
      ? { scenes: poseSurChaqueEntite(doc.scenes, 'ref', () => REF_DU_RENDU_AVANT_877, decorSansType) }
      : {}),
  }),
  // #1882 · LDB 77 l.7
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
  // #1882
  13: (doc) => semeLesRefsVides(doc) as typeof doc,
  // #1897
  14: (doc) => ({
    ...doc,
    ...(doc.narratif !== undefined ? { narratif: denudeSortsDePreset(doc.narratif) } : {}),
  }),
  // #1897
  15: (doc) => remapSortsFusionnesDeep(doc) as Record<string, unknown>,
  // #1473
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

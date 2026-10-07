import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { livreExtraitDe } from '../../scripts/guards/lib/rawRefIntegrity.mjs';
import { parseProject, ProjetRefuse, type ProjectDoc } from '../state/worldMap';
import { validateScene } from '../state/validateScene';
import { emptyScene } from '../state/scene';
import { emptyNarratif } from '../state/campaignNarratif';
import { books, buildings, findCrewRoleById, findNavalTrait, findVehicleById } from '../data';
import { findManannFactor } from '../engine/seaVoyage';
import { MERCHANTS } from '../state/merchants';
import { rigSpeciesVocab } from '../gameIso/rig/appearance';
import { TENUE_BY_ID } from '../gameIso/rig/parts/tenues';
import type { Effect } from '../state/scene';
import { carriedFlows, flowFromEffects, racinesDeFlow, walkFlow, type Flow } from '../state/flow';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';
import { auPlusProcheAncetre, coDescendre, type PointDeDonnee } from '../data/schemas/grammaire/descente';
import { projetSchema } from '../data/schemas/defs-scenes/projet';

/**
 * Garde TRANSVERSE (#809) : tout paquet bundlé `src/scenes/*.../*-projet.json` doit se relire dans
 * le modèle COURANT — `parseProject` sans lever, avec une IDENTITÉ valide (`id`/`label`/
 * `versionContenu`, plats à la racine depuis #1467 L1b). Couvre TOUT paquet présent OU futur (glob
 * récursif de `src/scenes`, jamais une liste de noms en dur), puis `validateScene` sans erreur. C'est
 * la garde du contenu COMMITÉ au format courant (#2404) : aucun chargement ne migre, un paquet d'une
 * autre forme rougit ici avant d'atteindre un joueur.
 */
const bundledFiles = listerProjetsLivres();

/** Erreurs de contenu d'un paquet, chacune NOMMANT son fautif (scène / portée / réf) — jamais un compte. */
function erreursDe(doc: Pick<ProjectDoc, 'scenes' | 'worldMap'>): string[] {
  return validateScene(doc.scenes, doc.worldMap)
    .filter((w) => w.level === 'error')
    .map((w) => `${w.sceneId} [${w.scope}${w.refId ? ` ${w.refId}` : ''}] ${w.message}`);
}

/** TOUS les `Effect` posés par un paquet, chacun avec la scène qui le porte : chaque racine
 *  (`racinesDeFlow`), l'arbre entier (`walkFlow`) et les Flows portés par une feuille (`carriedFlows`). */
function effetsDuProjet(doc: Pick<ProjectDoc, 'scenes'>): { sceneId: string; eff: Effect }[] {
  const out: { sceneId: string; eff: Effect }[] = [];
  const marche = (flow: Flow, sceneId: string): void =>
    walkFlow(flow, (noeud) => {
      if (noeud.kind !== 'do') return;
      out.push({ sceneId, eff: noeud.effect });
      for (const { flow: porte } of carriedFlows(noeud.effect)) marche(porte, sceneId);
    });
  for (const sc of doc.scenes) for (const r of racinesDeFlow(sc)) marche(r.flow as Flow, sc.id);
  return out;
}

describe('paquets de campagne bundlés — se relisent tous dans le modèle COURANT (#809)', () => {
  it('au moins un paquet trouvé (la garde couvre réellement quelque chose)', () => {
    expect(bundledFiles.length).toBeGreaterThan(0);
  });

  /**
   * NON-VACUITÉ des gardes ci-dessous : chaque famille a un SUJET dans les paquets livrés. Aucun
   * compte n'est écrit — seulement « il en existe ». Une famille tombée à zéro rend sa garde muette :
   * le rouge dit laquelle, à charge de retirer la garde ou de rendre son sujet.
   */
  it('chaque famille de garde a au moins un sujet dans les paquets livrés', () => {
    const docs = bundledFiles.map((f) => parseProject(lireProjetLivre(f)));
    const entites = docs.flatMap((d) => d.scenes.flatMap((sc) => sc.entities));
    const rencontres = docs.flatMap((d) => d.scenes.flatMap((sc) => sc.encounters));
    const muettes = Object.entries({
      'amélioration navale d’instance': entites.some((e) => e.upgrades?.length),
      'coffre à munitions de poste': entites.some((e) => (e.postes ?? []).some((p) => p.ammo?.length)),
      'équipage exposé (crewIds)': entites.some((e) => e.crewIds?.length),
      'marchand à archétype': entites.some((e) => e.merchant?.archetype),
      'CustomStatblock d’auteur': entites.some((e) => e.statblock),
      'victoire par seuil de Blessures': rencontres.some((enc) => enc.victoryCondition?.type === 'woundsThreshold'),
      'dialogue joueur': docs.some((d) => d.scenes.some((sc) => sc.dialogues.length > 0)),
      'Effect de campagne': docs.some((d) => effetsDuProjet(d).length > 0),
    }).filter(([, sujet]) => !sujet).map(([nom]) => nom);
    expect(muettes, 'famille(s) de garde sans sujet — la garde ne mesure plus rien').toEqual([]);
  });

  it.each(bundledFiles.map((f) => [f] as const))('%s : parseProject ne lève pas et porte une identité valide', (file) => {
    const raw = lireProjetLivre(file);
    const doc = parseProject(raw);
    expect(doc.id, `${file} : identité absente — régénérer via projectDoc()`).toBeTruthy();
    expect(typeof doc.id).toBe('string');
    expect(doc.id!.length).toBeGreaterThan(0);
    expect(typeof doc.label).toBe('string');
    expect(doc.label!.length).toBeGreaterThan(0);
    expect(typeof doc.versionContenu).toBe('number');
  });

  /**
   * Une entité `personnage` n'a d'apparence à résoudre que par sa RÉF (créature/véhicule du catalogue)
   * ou par son ESPÈCE (`appearance.species`) : `entityRigProfileFor` (`src/gameIso/rig/enemyProfile.ts:270-274`)
   * n'en dérive AUCUNE sans l'une des deux, et le rendu signale l'entité muette en dev. Garde TRANSVERSE :
   * elle couvre les 4 paquets bundlés et tout paquet FUTUR par le même glob — aucune ligne à ajouter.
   */
  it.each(bundledFiles.map((f) => [f] as const))(
    '%s : toute entité PERSONNAGE résout son apparence (réf de catalogue OU Espèce du rig, tenue résolue)',
    (file) => {
      const doc = parseProject(lireProjetLivre(file));
      const muettes: string[] = [];
      const inconnues: string[] = [];
      for (const sc of doc.scenes)
        for (const e of sc.entities) {
          if (e.kind !== 'personnage') continue;
          const species = e.appearance?.species;
          if (!e.ref && !species) muettes.push(`${sc.id}:${e.id} (${e.label ?? e.statblock?.label ?? 'sans nom'})`);
          if (species && !rigSpeciesVocab().has(species)) inconnues.push(`${sc.id}:${e.id} espèce « ${species} »`);
          if (e.appearance?.tenue && !TENUE_BY_ID[e.appearance.tenue]) inconnues.push(`${sc.id}:${e.id} tenue « ${e.appearance.tenue} »`);
        }
      expect(muettes, 'entité(s) de personnage sans réf NI Espèce — le rig n’a rien à dessiner et le rendu le signale en dev').toEqual([]);
      expect(inconnues, 'espèce/tenue hors des registres du rig — l’apparence retombe en repli muet').toEqual([]);
    },
  );

  /**
   * Toute entité `personnage` porte un NOM affichable au combat : soit sa réf de catalogue (le label
   * vient de la créature/du véhicule, `spawn.ts:275`), soit le label de son CustomStatblock d'auteur
   * (`spawn.ts:339` lit `sb.label` SANS repli — un statbloc sans label spawne un combattant anonyme).
   * Le `label` d'entité, lui, est facultatif : les ennemis de rencontre n'en portent pas.
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : toute entité PERSONNAGE porte un nom résoluble (réf, ou label de statbloc)', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const anonymes: string[] = [];
    for (const sc of doc.scenes)
      for (const e of sc.entities) {
        if (e.kind !== 'personnage') continue;
        if (!e.ref && !e.statblock?.label && !e.label) anonymes.push(`${sc.id}:${e.id}`);
      }
    expect(anonymes, 'entité(s) de personnage sans nom — le combattant spawne anonyme (spawn.ts:339)').toEqual([]);
  });

  /** Et le CustomStatblock d'auteur porte SON label : `spawn.ts:339` le lit sans repli — le `label`
   *  d'entité ne le sauve pas, il n'est jamais consulté par ce chemin. */
  it.each(bundledFiles.map((f) => [f] as const))('%s : tout CustomStatblock d’auteur porte son label', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const fautifs = doc.scenes.flatMap((sc) => sc.entities.filter((e) => e.statblock && !e.statblock.label).map((e) => `${sc.id}:${e.id}`));
    expect(fautifs).toEqual([]);
  });

  /**
   * `validateScene` est le juge du CONTENU d'un projet (réfs cassées, connectivité, empreinte de spawn,
   * porte orpheline, arrivée de carte du monde — familles couvertes sur fixtures par
   * `state/validateScene-contenu.test.ts`). Un paquet livré ne part avec AUCUNE de ses erreurs : la garde
   * ne nomme ni scène ni contenu, elle relit le verdict du moteur sur ce que le glob trouve.
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : validateScene ne rend AUCUNE erreur', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    expect(erreursDe(doc)).toEqual([]);
  });

  /**
   * ARMEMENT ET ÉQUIPAGE D'UNE COQUE — les contrats que le moteur naval lit sur l'authoring, relus
   * PAR GLOB : une amélioration d'instance (`upgrades`) est un trait du catalogue (`findNavalTrait`),
   * un poste servable porte un coffre à munitions dont chaque pièce est une munition en quantité, sa
   * sélection persistante (`ammoUid`) désigne une pièce RÉELLEMENT en soute (sinon `selectedAmmo` ne
   * la retrouve pas), et un équipage exposé (`crewIds`) nomme des entités de SA scène.
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : coques — upgrades du catalogue, coffres à munitions cohérents, équipage exposé résoluble', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const fautifs: string[] = [];
    for (const sc of doc.scenes) {
      const ids = new Set(sc.entities.map((e) => e.id));
      for (const e of sc.entities) {
        for (const u of e.upgrades ?? [])
          if (!findNavalTrait(u.id)) fautifs.push(`${sc.id}:${e.id} amélioration navale « ${u.id} » absente du catalogue`);
        for (const id of e.crewIds ?? [])
          if (!ids.has(id)) fautifs.push(`${sc.id}:${e.id} équipage exposé « ${id} » : aucune entité de cette scène`);
        for (const p of e.postes ?? []) {
          for (const a of p.ammo ?? []) {
            if (a.kind !== 'ammo') fautifs.push(`${sc.id}:${e.id}/${p.trappingId} : « ${a.uid} » n’est pas une munition`);
            if ((a.qty ?? 0) <= 0) fautifs.push(`${sc.id}:${e.id}/${p.trappingId} : munition « ${a.uid} » en quantité nulle`);
          }
          if (p.ammoUid && !(p.ammo ?? []).some((a) => a.uid === p.ammoUid))
            fautifs.push(`${sc.id}:${e.id}/${p.trappingId} : ammoUid « ${p.ammoUid} » hors du coffre`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  /** Un marchand d'auteur pointe un ARCHÉTYPE du registre (`state/merchants.ts`) — sinon son stock est vide. */
  it.each(bundledFiles.map((f) => [f] as const))('%s : tout marchand référence un archétype RÉEL du registre', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const fautifs = doc.scenes.flatMap((sc) =>
      sc.entities
        .filter((e) => e.merchant?.archetype && !MERCHANTS[e.merchant.archetype])
        .map((e) => `${sc.id}:${e.id} archétype « ${e.merchant!.archetype} »`),
    );
    expect(fautifs).toEqual([]);
  });

  /**
   * EFFETS DE CAMPAGNE, relus par glob — chacun est une RÉFÉRENCE, jamais une valeur devinée :
   * `adjustManann` porte un facteur du catalogue (`MANANN_FACTORS`, jamais un delta brut),
   * `setVessel` un véhicule du catalogue et un roster de rôles réels en effectif non nul,
   * `setObjective` un id d'objectif non vide (la pile est keyée par id STABLE).
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : tout Effect de campagne référence du catalogue (Manann, navire, rôles d’équipage, objectif)', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const fautifs: string[] = [];
    for (const { sceneId, eff } of effetsDuProjet(doc)) {
      if (eff.type === 'adjustManann' && (!eff.factorId || !findManannFactor(eff.factorId)))
        fautifs.push(`${sceneId} : adjustManann sans facteur du catalogue (« ${String(eff.factorId)} »)`);
      if (eff.type === 'setVessel') {
        if (!findVehicleById(eff.vehicleId)) fautifs.push(`${sceneId} : setVessel « ${eff.vehicleId} » absent de vehicles.json`);
        for (const hire of eff.crew ?? []) {
          if (!findCrewRoleById(hire.roleId)) fautifs.push(`${sceneId} : rôle d’équipage « ${hire.roleId} » absent de crew-roles.json`);
          if (hire.count <= 0) fautifs.push(`${sceneId} : rôle d’équipage « ${hire.roleId} » embauché à ${hire.count}`);
        }
      }
      if (eff.type === 'setObjective' && !eff.id) fautifs.push(`${sceneId} : setObjective sans id stable`);
    }
    expect(fautifs).toEqual([]);
  });

  /** Une condition de victoire par seuil de Blessures cible une entité de SA scène, sous un seuil utile. */
  it.each(bundledFiles.map((f) => [f] as const))('%s : toute victoire par seuil de Blessures cible une entité de sa scène', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const fautifs: string[] = [];
    for (const sc of doc.scenes) {
      const ids = new Set(sc.entities.map((e) => e.id));
      for (const enc of sc.encounters) {
        const vc = enc.victoryCondition;
        if (vc?.type !== 'woundsThreshold') continue;
        if (!ids.has(vc.targetId)) fautifs.push(`${sc.id}/${enc.id} : cible « ${vc.targetId} » absente de la scène`);
        if (!(vc.belowPercent > 0 && vc.belowPercent <= 100)) fautifs.push(`${sc.id}/${enc.id} : seuil ${vc.belowPercent} % hors ]0,100]`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * ZÉRO jargon technique dans les textes JOUEUR (dialogues, journal, modales document, objectifs) :
   * le nom d'une op, d'un champ d'état ou d'une réf de folio n'a rien à faire sous les yeux du joueur.
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : aucun jargon technique dans les textes joueur', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const jargon = /`|INEXPRIMABLE|CONTOURN|\bstate\.|\bvessel\.|\bTODO\b|seaVoyageFlow|op:'testMod'|engine\/ops\.ts|adjustManann|adjustVessel|setVessel|setObjective|saboteurDR|factorId|woundsThreshold|[A-Z]{2,4} \d+ l\.\d/;
    const fautifs: string[] = [];
    for (const sc of doc.scenes)
      for (const d of sc.dialogues)
        for (const n of d.nodes) {
          if (n.desc && jargon.test(n.desc)) fautifs.push(`${sc.id}/${d.id}/${n.id} : node.desc`);
          for (const c of n.choices) if (jargon.test(c.label)) fautifs.push(`${sc.id}/${d.id}/${n.id} : choix « ${c.label} »`);
        }
    for (const { sceneId, eff } of effetsDuProjet(doc)) {
      if (eff.type === 'journal' && eff.desc && jargon.test(eff.desc)) fautifs.push(`${sceneId} : journal « ${eff.desc} »`);
      if (eff.type === 'setObjective' && jargon.test(eff.desc)) fautifs.push(`${sceneId} : objectif « ${eff.desc} »`);
    }
    // Les modales document lisent le registre (#679) : tout document du paquet, remis ou non.
    for (const d of doc.narratif.documents)
      if (jargon.test(d.titre) || jargon.test(d.prose)) fautifs.push(`narratif.documents « ${d.id} » : document « ${d.titre} »`);
    expect(fautifs).toEqual([]);
  });

  it('CONTRE-PREUVE : une réf de créature inexistante glissée dans une COPIE d’un paquet livré rougit la garde, en nommant la scène et l’entité', () => {
    // ⚠ copie EN MÉMOIRE — aucun fichier touché.
    const trouve = bundledFiles
      .map((file) => ({ file, doc: parseProject(lireProjetLivre(file)) }))
      .flatMap(({ file, doc }) =>
        doc.scenes.flatMap((sc) =>
          sc.entities
            .filter((e) => e.kind === 'personnage' && e.ref && !e.statblock && !e.presetId)
            .map((e) => ({ file, doc, sceneId: sc.id, entityId: e.id, entity: e })),
        ),
      )[0];
    expect(trouve, 'aucun paquet livré ne porte de personnage à réf de bestiaire — la contre-preuve n’a plus de sujet').toBeTruthy();
    const { doc, sceneId, entityId, entity } = trouve!;
    const casse = {
      ...doc,
      scenes: doc.scenes.map((sc) =>
        sc.id !== sceneId ? sc : { ...sc, entities: sc.entities.map((e) => (e === entity ? { ...e, ref: 'creature-qui-n-existe-pas' } : e)) },
      ),
    };
    const erreurs = erreursDe(casse);
    expect(erreurs.some((m) => m.includes(sceneId) && m.includes(entityId) && m.includes('creature-qui-n-existe-pas'))).toBe(true);
  });

  it('CONTRE-PREUVE : une transition vers une scène inconnue glissée dans une COPIE d’un paquet livré rougit `validateScene`, en NOMMANT la cible', () => {
    // ⚠ copie EN MÉMOIRE — aucun fichier touché. Le schéma ne lit pas la cible d'une transition : seule
    // cette garde la juge.
    const CIBLE = 'scene-qui-n-existe-pas';
    const trouve = bundledFiles
      .map((file) => parseProject(lireProjetLivre(file)))
      .flatMap((doc) => effetsDuProjet(doc).filter(({ eff }) => eff.type === 'transition').map(({ eff }) => ({ doc, eff })))[0];
    expect(trouve, 'aucun paquet livré ne porte de transition — la contre-preuve n’a plus de sujet').toBeTruthy();
    const { doc, eff } = trouve!;
    (eff as Extract<Effect, { type: 'transition' }>).scene = CIBLE;
    expect(erreursDe(doc).some((m) => m.includes(CIBLE)), 'la transition pendante n’est pas rapportée').toBe(true);
  });

  /**
   * CONTRE-PREUVE de la PORTE d'identité (`parseProject`, `src/state/worldMap.ts`), sur une enveloppe
   * CONSTRUITE — aucun paquet livré n'en est le sujet. L'enveloppe est COMPLÈTE par ailleurs (`label`,
   * `versionContenu`, provenance, narratif) : seule l'identité manque, et le refus porte une faute au
   * chemin `id` — lue dans ses FAUTES, jamais dans le texte du rapport.
   */
  const ENVELOPPE = (identite: Record<string, unknown>) => ({
    type: 'projet',
    label: 'Fixture',
    versionContenu: 1,
    maison: 'fixture de test',
    narratif: emptyNarratif(),
    scenes: [{ ...emptyScene(4, 4), id: 'fixture-scene', label: 'Fixture' }],
    ...identite,
  });
  /** Le refus de la porte pour ce document, ou `null` s'il passe. */
  const refusDe = (doc: unknown): ProjetRefuse | null => {
    try {
      parseProject(doc);
      return null;
    } catch (e) {
      if (e instanceof ProjetRefuse) return e;
      throw e;
    }
  };

  it('la même enveloppe AVEC son identité passe la porte — la contre-preuve ci-dessous ne mesure que l’identité', () => {
    expect(() => parseProject(ENVELOPPE({ id: 'fixture-enveloppe' }))).not.toThrow();
  });

  it('CONTRE-PREUVE : un paquet SANS identité est REFUSÉ À LA PORTE, qui NOMME `id`', () => {
    const refus = refusDe(ENVELOPPE({}));
    expect(refus?.cause).toBe('schema');
    expect(refus?.fautes.some((f) => f.chemin.join('.') === 'id'), 'une faute au chemin `id`').toBe(true);
    expect(refus?.message, 'le rapport des scripts nomme toujours le champ').toMatch(/^\s*- id: /m);
  });

  /**
   * `ArchitectureBody.style` est une RÉFÉRENCE vers `buildings.json` (`idDe('building')`, #1715) : la
   * porte résout l'id, et un corps SANS type de bâtiment reste valide (bourg, hameau, corps
   * composite). Le sujet est un paquet FABRIQUÉ ICI : un paquet livré est la CARTE de son auteur, que
   * ce test laisse intacte — la contre-preuve porte sur une fixture, jamais sur `diligence-projet.json`.
   */
  const PAQUET_ARCHITECTURE = (styles: (string | undefined)[]) => {
    return {
      ...ENVELOPPE({ id: 'fixture-architecture' }),
      scenes: [{
        ...emptyScene(6, 6),
        id: 'fixture-scene',
        label: 'Fixture',
        architecture: styles.map((style, i) => ({
          id: `corps-${i}`,
          ...(style === undefined ? {} : { style }),
          storeys: [{ id: 'z0', z: 0, parts: [{ id: 'p', foot: { x: 0, y: 0, w: 2, h: 2 } }], roomZoneIds: [] }],
          facades: [],
          masses: [],
        })),
      }],
    };
  };
  /** Un type de bâtiment RÉEL, dérivé du catalogue — aucun id récité ici. */
  const TYPE_REEL = buildings[0].id;

  it('un corps TYPÉ et un corps SANS type passent la porte ensemble', () => {
    const doc = parseProject(PAQUET_ARCHITECTURE([TYPE_REEL, undefined]));
    const corps = doc.scenes.flatMap((sc) => sc.architecture ?? []);
    expect(corps.map((b) => b.style)).toEqual([TYPE_REEL, undefined]);
  });

  it('CONTRE-PREUVE : un `style` hors de `buildings.json` est REFUSÉ À LA PORTE, qui NOMME le champ et la valeur', () => {
    expect(buildings.some((b) => b.id === 'bourg'), '« bourg » est devenu un type de bâtiment : la contre-preuve n’a plus de sujet.').toBe(false);
    expect(() => parseProject(PAQUET_ARCHITECTURE(['bourg']))).toThrow(/style/);
    expect(() => parseProject(PAQUET_ARCHITECTURE(['bourg']))).toThrow(/bourg/);
  });
});

/**
 * Règle stricte 5 — une prose de campagne qui DÉCLARE sa source en est un COPIÉ/COLLÉ : chacun de ses
 * paragraphes se retrouve À L'OCTET dans le livre déclaré. Le livre se résout par le REGISTRE
 * (`books.json`, champ `dir` — patron `src/data/book-source-integrity.test.ts`), jamais par un chemin
 * écrit à la main, et AUCUN numéro de ligne du `Source/` n'est cité (CLAUDE.md § Sources VF : la
 * ré-extraction Marker 2026-06-22 les a fait dériver, le texte non). Garde TRANSVERSE : le même glob de
 * paquets livrés, aucune scène ni aucun titre nommé.
 */
const REPO_ROOT = join(__dirname, '..', '..');
/** Champs de PROSE VERBATIM du bloc narratif (`state/campaignNarratif.ts`) : `OuvertureBlock.pitch`,
 *  `IndiceStade.prose`, `DocumentNarratif.prose`, `PresetPnj.profil.desc`. */
const PROSE_KEYS = ['pitch', 'prose', 'desc'] as const;

interface ProseSourcee {
  chemin: string;
  texte: string;
  source: { book?: unknown; page?: unknown };
}

const estSource = (v: unknown): v is ProseSourcee['source'] => v != null && typeof v === 'object' && !Array.isArray(v);

/** Chemin lisible d'un point : un élément de liste est nommé par son `id` quand il en porte un. */
const cheminDe = (p: PointDeDonnee): string =>
  p.chemin
    .map((seg, i) => {
      if (typeof seg === 'string') return `.${seg}`;
      let q: PointDeDonnee = p;
      for (let k = p.chemin.length - 1; k > i; k -= 1) q = q.parent!;
      const id = (q.valeur as { id?: unknown } | null)?.id;
      return `[${typeof id === 'string' ? id : seg}]`;
    })
    .join('');

/** Toute prose du bloc narratif qui porte un `source`, le sien ou celui de son plus proche ancêtre qui
 *  en porte un (`auPlusProcheAncetre` : `PresetPnj.source` pour `profil.desc`) — la prose SANS source est
 *  authorée maison, hors sujet. Co-descente du schéma de projet (`coDescendre`). */
function proseSourcees(narratif: unknown, fichier: string, out: ProseSourcee[]): void {
  coDescendre(projetSchema, { narratif }, (p) => {
    const rec = p.valeur;
    if (rec == null || typeof rec !== 'object' || Array.isArray(rec)) return;
    const propre = (rec as { source?: unknown }).source;
    const source = estSource(propre) ? propre : auPlusProcheAncetre(p, (o) => (estSource(o.source) ? o.source : undefined));
    if (!source) return;
    for (const key of PROSE_KEYS) {
      const texte = (rec as Record<string, unknown>)[key];
      if (typeof texte === 'string') out.push({ chemin: `${fichier}${cheminDe(p)}.${key}`, texte, source });
    }
  });
}

const fichiersMd = (dir: string): string[] =>
  listerArbre(dir, { filtre: (rel) => rel.endsWith('.md') }).map((rel) => join(dir, rel));

const texteParLivre = new Map<string, string>();
/** Tout le texte extrait d'un livre, en un seul tampon — la garde cherche le TEXTE, pas un chapitre. */
function texteDuLivre(bookId: string): string {
  const cache = texteParLivre.get(bookId);
  if (cache != null) return cache;
  const dir = livreExtraitDe(bookId)?.dir;
  if (!dir) throw new Error(`livre « ${bookId} » : aucun dossier Source déclaré dans books.json`);
  const texte = fichiersMd(join(REPO_ROOT, dir)).map((f) => readFileSync(f, 'utf8')).join('\n');
  texteParLivre.set(bookId, texte);
  return texte;
}

const prosesSourcees = bundledFiles.flatMap((file) => {
  const out: ProseSourcee[] = [];
  proseSourcees(parseProject(lireProjetLivre(file)).narratif, file, out);
  return out;
});

describe('prose de campagne SOURCÉE — copiée À L’OCTET du livre déclaré (règle stricte 5)', () => {
  it('au moins une prose sourcée dans les paquets livrés (la garde couvre réellement quelque chose)', () => {
    expect(prosesSourcees.length).toBeGreaterThan(0);
  });

  it('chaque preset à prose ADRESSÉE y est jugé sur sa prose SERVIE (`lireProjetLivre`) : l’adresse ne sort pas de la garde (#680)', () => {
    const vus = new Set(prosesSourcees.map((p) => p.chemin));
    const adresses = bundledFiles.flatMap((rel) => {
      const disque = JSON.parse(readFileSync(join(__dirname, rel), 'utf8')) as {
        narratif?: { presetsPnj?: { id: string; profil?: { descRef?: unknown } }[] };
      };
      return (disque.narratif?.presetsPnj ?? [])
        .filter((p) => p.profil?.descRef !== undefined)
        .map((p) => `${rel}.narratif.presetsPnj[${p.id}].profil.desc`);
    });
    expect(adresses.length, 'aucun preset adressé dans les paquets livrés — l’assertion ne mesurerait rien').toBeGreaterThan(0);
    expect(adresses.filter((c) => !vus.has(c))).toEqual([]);
  });

  it('chaque prose sourcée déclare un livre du REGISTRE et son folio', () => {
    const ids = new Set(books.map((b) => b.id));
    const fautives = prosesSourcees.flatMap((p) => {
      if (typeof p.source.book !== 'string' || !ids.has(p.source.book)) return [`${p.chemin} : book « ${String(p.source.book)} » absent de books.json`];
      if (typeof p.source.page !== 'number') return [`${p.chemin} : folio manquant (source.page)`];
      return [];
    });
    expect(fautives).toEqual([]);
  });

  it('chaque paragraphe d’une prose sourcée est contenu À L’OCTET dans son livre', () => {
    const introuvables = prosesSourcees.flatMap((p) => {
      if (typeof p.source.book !== 'string' || !books.some((b) => b.id === p.source.book)) return [];
      const source = texteDuLivre(p.source.book);
      const paragraphes = p.texte.split('\n\n').map((paragraphe) => paragraphe.trim()).filter((paragraphe) => paragraphe.length > 0);
      // Une prose VIDE qui déclare une source ne cite plus rien, et « chaque paragraphe est dans le
      // livre » y serait vrai sans rien vérifier : c'est l'anomalie elle-même.
      if (paragraphes.length === 0) return [`${p.chemin} → ${p.source.book} : prose VIDE alors qu’elle déclare une source`];
      return paragraphes
        .filter((paragraphe) => !source.includes(paragraphe))
        .map((paragraphe) => `${p.chemin} → ${p.source.book} : « ${coupeAuMot(paragraphe, 60)} » absent du livre (reformulation ou typographie « corrigée »)`);
    });
    expect(introuvables).toEqual([]);
  });
});

type DocDeProvenance = Pick<ProjectDoc, 'source' | 'scenes' | 'narratif'>;

/**
 * Obligation de provenance d'un paquet ADAPTÉ d'un livre (racine `source`) — évaluation d'ingénierie
 * révisable (#2001, design issuecomment-5984347165) : chaque stade d'indice, preset PNJ et ouverture
 * porte son verbatim (`source`) OU `adapteDe` ; chaque nœud de dialogue et effet `journal`, son adresse
 * (`descRef`) OU `adapteDe`. Tout `adapteDe.book` de tout paquet résout `books.json`. Gardée ICI, pas au
 * parse : un stade neuf s'enregistre avant sa réf.
 */
function fautesDeProvenance(doc: DocDeProvenance, fichier: string): string[] {
  const livres = new Set(books.map((b) => b.id));
  const fautes: string[] = [];
  const marche = (v: unknown, chemin: string): void => {
    if (Array.isArray(v)) return v.forEach((x, i) => marche(x, `${chemin}[${i}]`));
    if (v == null || typeof v !== 'object') return;
    const adapte = (v as { adapteDe?: { book?: unknown } }).adapteDe;
    if (adapte !== undefined && !(typeof adapte.book === 'string' && livres.has(adapte.book))) {
      fautes.push(`${fichier}${chemin}.adapteDe : book « ${String(adapte.book)} » absent de books.json`);
    }
    for (const [k, x] of Object.entries(v)) marche(x, `${chemin}.${k}`);
  };
  marche(doc, '');
  if (!doc.source) return fautes;

  const exige = (chemin: string, n: { source?: unknown; descRef?: unknown; adapteDe?: unknown }, verbatim: 'source' | 'descRef'): void => {
    if (n[verbatim] === undefined && n.adapteDe === undefined) fautes.push(`${fichier}${chemin} : ni \`${verbatim}\` ni \`adapteDe\` dans un paquet adapté d’un livre`);
  };
  const { narratif } = doc;
  narratif.indices.forEach((ind) => ind.stades.forEach((st) => exige(`.narratif.indices[${ind.id}].stades[${st.id}]`, st, 'source')));
  narratif.presetsPnj.forEach((p) => exige(`.narratif.presetsPnj[${p.id}]`, p, 'source'));
  if (narratif.ouverture) exige('.narratif.ouverture', narratif.ouverture, 'source');
  for (const sc of doc.scenes) for (const dlg of sc.dialogues) for (const n of dlg.nodes) exige(`.scenes[${sc.id}].dialogues[${dlg.id}].nodes[${n.id}]`, n, 'descRef');
  effetsDuProjet(doc).forEach(({ sceneId, eff }, i) => {
    if (eff.type === 'journal') exige(`.scenes[${sceneId}] journal #${i}`, eff, 'descRef');
  });
  return fautes;
}

describe('provenance d’un paquet adapté d’un livre — verbatim OU `adapteDe` (#2001)', () => {
  it.each(bundledFiles.map((f) => [f] as const))('%s : chaque site porte son verbatim ou `adapteDe`, et tout `adapteDe` résout son livre', (file) => {
    expect(fautesDeProvenance(parseProject(lireProjetLivre(file)), file)).toEqual([]);
  });

  const SOURCE = { book: 'ennemi-dans-l-ombre', page: 12 };
  const ADAPTE = { adapteDe: { book: 'ennemi-dans-l-ombre', page: 14 } };
  const NU = { desc: 'Réplique maison.' };
  const paquet = (node: Record<string, unknown>, journal: Record<string, unknown>, source: typeof SOURCE | null = SOURCE): DocDeProvenance => {
    const sc = emptyScene(4, 4);
    sc.id = 'sc';
    sc.dialogues = [{ id: 'dlg', start: 'n1', nodes: [{ id: 'n1', choices: [], ...node }] }];
    sc.triggers = [{ id: 't', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'journal', ...journal }]) }];
    return { ...(source ? { source } : {}), scenes: [sc], narratif: emptyNarratif() };
  };

  it('un nœud et un journal NUS sous une racine `source` sont nommés', () => {
    expect(fautesDeProvenance(paquet(NU, NU), 'f')).toEqual([
      'f.scenes[sc].dialogues[dlg].nodes[n1] : ni `descRef` ni `adapteDe` dans un paquet adapté d’un livre',
      'f.scenes[sc] journal #0 : ni `descRef` ni `adapteDe` dans un paquet adapté d’un livre',
    ]);
  });

  it('les mêmes, ADRESSÉS (`descRef`), passent : l’adresse est leur verbatim', () => {
    const ADRESSE = { descRef: { book: 'ennemi-dans-l-ombre', ch: '01', parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }] } };
    expect(fautesDeProvenance(paquet({ ...NU, ...ADRESSE }, { ...NU, ...ADRESSE }), 'f')).toEqual([]);
  });

  it('les mêmes, `adapteDe`, passent ; un paquet sans racine `source` n’exige rien', () => {
    expect(fautesDeProvenance(paquet({ ...NU, ...ADAPTE }, { ...NU, ...ADAPTE }), 'f')).toEqual([]);
    expect(fautesDeProvenance(paquet(NU, NU, null), 'f')).toEqual([]);
  });

  it('un `adapteDe.book` inconnu est nommé, même hors racine `source`', () => {
    const inconnu = { ...NU, adapteDe: { book: 'livre-fantome', page: 1 } };
    expect(fautesDeProvenance(paquet(inconnu, { ...NU, ...ADAPTE }, null), 'f')).toEqual([
      'f.scenes[0].dialogues[0].nodes[0].adapteDe : book « livre-fantome » absent de books.json',
    ]);
  });
});

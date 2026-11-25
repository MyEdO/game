import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert, describe, it, expect } from 'vitest';
import { cheminDe, fautesDeProvenance, proseSourcees, type ProseSourcee } from '../../../src/noyau/provenanceDuPaquet.testkit';
import { listerArbre } from '../../../scripts/guards/lib/lister.mjs';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { livreExtraitDe } from '../../../scripts/guards/lib/rawRefIntegrity.mjs';
import { parseProject, type ProjectDoc } from '../../../src/noyau/worldMap';
import { validateScene } from '../../../src/noyau/validateScene';
import { idDuCorps } from '../../../src/noyau/monde/scene';
import { books, findCrewRoleById, findVehicleById } from '../../../src/data';
import { findManannFactor } from '../../../src/engine/seaVoyage';
import type { Effect, Flow } from '../../../src/data/schemas/defs-scenes/effets';
import { carriedFlows, racinesDeFlow, walkFlow } from '../../../src/engine/flowCore';
import { coupeAuMot } from '../../../src/lib/coupeAuMot.mjs';
import { coDescendre, type PointDeDonnee } from '../../../src/data/schemas/grammaire/descente';
import { declarationProseNommee } from '../../../src/data/schemas/grammaire/prose';
import { projetSchema } from '../../../src/data/schemas/defs-scenes/projet';
import { identiteSchema, motifEnMot } from '../../../src/data/schemas/grammaire/campagne';
import { identitesDe, nommer } from '../../../src/noyau/monde/identites';
import { metaDesChamps } from '../../../src/data/schemas/grammaire/meta';
import { raceKeySchema, sexeSchema } from '../../../src/data/schemas/grammaire/valeurs';

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
  const marche = (flow: Flow, sceneId: string): void => {
    walkFlow(flow, (noeud) => {
      if (noeud.kind !== 'effet') return;
      out.push({ sceneId, eff: noeud.effet });
      for (const { flow: porte } of carriedFlows(noeud.effet)) marche(porte, sceneId);
    });
  };
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
      'coffre à munitions de poste': entites.some((e) => (e.postes ?? []).some((p) => p.ammo)),
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
        if (!idDuCorps(e) && !e.statblock?.label && !e.label) anonymes.push(`${sc.id}:${e.id}`);
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
   * `noyau/validateScene-contenu.test.ts`). Un paquet livré ne part avec AUCUNE de ses erreurs : la garde
   * ne nomme ni scène ni contenu, elle relit le verdict du moteur sur ce que le glob trouve.
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : validateScene ne rend AUCUNE erreur', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    expect(erreursDe(doc)).toEqual([]);
  });

  /**
   * ÉQUIPAGE D'UNE COQUE, relu PAR GLOB : un équipage exposé (`crewIds`) nomme des entités de SA scène. Le coffre d'un
   * poste et sa munition choisie se jugent au parse (`authoredShipPosteSchema`, `refusDeLEntite`).
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : coques — équipage exposé résoluble', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const fautifs: string[] = [];
    for (const sc of doc.scenes) {
      const ids = new Set(sc.entities.map((e) => e.id));
      for (const e of sc.entities) {
        for (const id of e.crewIds ?? [])
          if (!ids.has(id)) fautifs.push(`${sc.id}:${e.id} équipage exposé « ${id} » : aucune entité de cette scène`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * EFFETS DE CAMPAGNE, relus par glob — chacun est une RÉFÉRENCE, jamais une valeur devinée :
   * l'op `manann` porte un facteur du catalogue (`MANANN_FACTORS`, jamais un delta brut),
   * `setVessel` un véhicule du catalogue et un roster de rôles réels en effectif non nul,
   * `setObjective` un id d'objectif non vide (la pile est keyée par id STABLE).
   */
  it.each(bundledFiles.map((f) => [f] as const))('%s : tout Effect de campagne référence du catalogue (Manann, navire, rôles d’équipage, objectif)', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const fautifs: string[] = [];
    for (const { sceneId, eff } of effetsDuProjet(doc)) {
      if (eff.type === 'ops') {
        for (const o of eff.ops) {
          if (o.op === 'manann') {
            const id = o.facteur?.id;
            if (!id || !findManannFactor(id)) fautifs.push(`${sceneId} : op manann sans facteur du catalogue (« ${String(id)} »)`);
          }
        }
      }
      if (eff.type === 'setVessel') {
        if (!findVehicleById(eff.navire.id)) fautifs.push(`${sceneId} : setVessel « ${eff.navire.id} » absent de vehicles.json`);
        for (const hire of eff.crew ?? []) {
          if (!findCrewRoleById(hire.roleId)) fautifs.push(`${sceneId} : rôle d’équipage « ${hire.roleId} » absent de crew-roles.json`);
          if (hire.count <= 0) fautifs.push(`${sceneId} : rôle d’équipage « ${hire.roleId} » embauché à ${hire.count}`);
        }
      }
      if (eff.type === 'setObjective' && !eff.id) fautifs.push(`${sceneId} : setObjective sans id stable`);
    }
    expect(fautifs).toEqual([]);
  });

  /** Une condition de victoire par seuil de Blessures porte un seuil utile ; sa cible, le parse la juge parmi les membres. */
  it.each(bundledFiles.map((f) => [f] as const))('%s : toute victoire par seuil de Blessures porte un seuil dans ]0,100]', (file) => {
    const doc = parseProject(lireProjetLivre(file));
    const fautifs: string[] = [];
    for (const sc of doc.scenes) {
      for (const enc of sc.encounters) {
        const vc = enc.victoryCondition;
        if (vc?.type !== 'woundsThreshold') continue;
        if (!(vc.atOrBelowPercent > 0 && vc.atOrBelowPercent <= 100)) fautifs.push(`${sc.id}/${enc.id} : seuil ${vc.atOrBelowPercent} % hors ]0,100]`);
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
    const jargon = /`|INEXPRIMABLE|CONTOURN|\bstate\.|\bvessel\.|\bTODO\b|seaVoyageFlow|op:'testMod'|engine\/ops\.ts|adjustVessel|setVessel|setObjective|saboteurDR|factorId|woundsThreshold|[A-Z]{2,4} \d+ l\.\d/;
    const fautifs: string[] = [];
    for (const sc of doc.scenes)
      for (const d of sc.dialogues)
        for (const n of d.nodes) {
          if (n.desc && jargon.test(n.desc)) fautifs.push(`${sc.id}/${d.id}/${n.id} : node.desc`);
          for (const c of n.choices) if (jargon.test(c.label)) fautifs.push(`${sc.id}/${d.id}/${n.id} : choix « ${c.label} »`);
        }
    for (const { sceneId, eff } of effetsDuProjet(doc)) {
      if (eff.type === 'journal' && eff.desc && jargon.test(eff.desc)) fautifs.push(`${sceneId} : journal « ${eff.desc} »`);
      if (eff.type === 'setObjective' && eff.desc && jargon.test(eff.desc)) fautifs.push(`${sceneId} : objectif « ${eff.desc} »`);
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
            .filter((e) => e.kind === 'personnage' && e.creature && !e.statblock && !e.presetId)
            .map((e) => ({ file, doc, sceneId: sc.id, entityId: e.id, entity: e })),
        ),
      )[0];
    expect(trouve, 'aucun paquet livré ne porte de personnage à réf de bestiaire — la contre-preuve n’a plus de sujet').toBeTruthy();
    const { doc, sceneId, entityId, entity } = trouve!;
    const casse = {
      ...doc,
      scenes: doc.scenes.map((sc) =>
        sc.id !== sceneId ? sc : { ...sc, entities: sc.entities.map((e) => (e === entity ? { ...e, creature: { id: 'creature-qui-n-existe-pas' } } : e)) },
      ),
    };
    const erreurs = erreursDe(casse);
    expect(erreurs.some((m) => m.includes(sceneId) && m.includes(entityId) && m.includes('creature-qui-n-existe-pas'))).toBe(true);
  });

  it('CONTRE-PREUVE : une transition vers une scène inconnue glissée dans une COPIE d’un paquet livré rougit `validateScene`, en NOMMANT la cible', () => {
    // ⚠ copie EN MÉMOIRE — aucun fichier touché. Le projet vivant de l'éditeur ne repasse pas par le schéma du
    // projet, qui juge la cible au parse : `validateScene` la juge pour lui.
    const CIBLE = 'scene-qui-n-existe-pas';
    const trouve = bundledFiles
      .map((file) => parseProject(lireProjetLivre(file)))
      .flatMap((doc) => effetsDuProjet(doc).filter(({ eff }) => eff.type === 'transition').map(({ eff }) => ({ doc, eff })))[0];
    expect(trouve, 'aucun paquet livré ne porte de transition — la contre-preuve n’a plus de sujet').toBeTruthy();
    const { doc, eff } = trouve!;
    (eff as Extract<Effect, { type: 'transition' }>).scene = { id: CIBLE };
    expect(erreursDe(doc).some((m) => m.includes(CIBLE)), 'la transition pendante n’est pas rapportée').toBe(true);
  });
});

/**
 * Règle stricte 5 — une prose de campagne qui DÉCLARE sa source en est un COPIÉ/COLLÉ : chacun de ses
 * paragraphes se retrouve À L'OCTET dans le livre déclaré. Le livre se résout par le REGISTRE
 * (`books.json`, champ `dir` — patron `src/data/book-source-integrity.test.ts`), jamais par un chemin
 * écrit à la main, et AUCUN numéro de ligne du `Source/` n'est cité (AGENTS.md § Sources VF : la
 * ré-extraction Marker 2026-06-22 les a fait dériver, le texte non). Garde TRANSVERSE : le même glob de
 * paquets livrés, aucune scène ni aucun titre nommé.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..');

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
  proseSourcees(parseProject(lireProjetLivre(file)), file, out);
  return out;
});

describe('prose de campagne SOURCÉE — copiée À L’OCTET du livre déclaré (règle stricte 5)', () => {
  it('au moins une prose sourcée dans les paquets livrés (la garde couvre réellement quelque chose)', () => {
    expect(prosesSourcees.length).toBeGreaterThan(0);
  });

  it('chaque preset à prose ADRESSÉE y est jugé sur sa prose SERVIE (`lireProjetLivre`) : l’adresse ne sort pas de la garde (#680)', () => {
    const vus = new Set(prosesSourcees.map((p) => p.chemin));
    const adresses = bundledFiles.flatMap((rel) => {
      const disque = JSON.parse(readFileSync(join(__dirname, '..', '..', rel), 'utf8')) as {
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
    const ids = new Set<string>(books.map((b) => b.id));
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

describe('provenance locale, références présentes résolubles et régime documentaire canonique (#2001)', () => {
  it.each(bundledFiles.map((f) => [f] as const))('%s : provenance locale, références présentes résolubles et régime documentaire canonique', (file) => {
    expect(fautesDeProvenance(parseProject(lireProjetLivre(file)), file)).toEqual([]);
  });
});

/** Les proses de PAQUET d'un projet (champs déclarés par `PROSES_NOMMEES`), par co-descente. */
function prosesDePaquet(projet: unknown): string[] {
  const out: string[] = [];
  coDescendre(projetSchema, projet, (p) => {
    const d = p.noeuds.map(declarationProseNommee).find((x) => x !== undefined);
    const texte = d && p.valeur && typeof p.valeur === 'object' ? (p.valeur as Record<string, unknown>)[d.champ] : undefined;
    if (typeof texte === 'string') out.push(texte);
  });
  return out;
}

/** Un point sous une identité (`identiteSchema`) : ses valeurs ne s'affichent que par `nommer`, jamais telles quelles. */
const sousIdentite = (p: PointDeDonnee): boolean => {
  for (let a: PointDeDonnee | undefined = p; a; a = a.parent) if (a.noeuds.includes(identiteSchema)) return true;
  return false;
};

/** Les textes de régime `designation` d'un projet rendus VERBATIM (`MetaChamp.texte.regime`, au nœud parent du champ). */
function textesDeDesignation(projet: unknown): { chemin: string; texte: string }[] {
  const out: { chemin: string; texte: string }[] = [];
  coDescendre(projetSchema, projet, (p) => {
    const cle = p.chemin[p.chemin.length - 1];
    if (typeof p.valeur !== 'string' || typeof cle !== 'string' || !p.parent || sousIdentite(p)) return;
    if (p.parent.noeuds.some((n) => metaDesChamps(n)?.[cle]?.texte?.regime === 'designation')) out.push({ chemin: cheminDe(p), texte: p.valeur });
  });
  return out;
}

function fautesDeDesignation(projet: ProjectDoc, fichier: string): string[] {
  const ancres = projet.narratif.etats.flatMap((e) => (e.forme.kind === 'heros' ? e.forme.identite?.ancres ?? [] : []));
  if (!ancres.length) return [];
  const motif = motifEnMot(ancres);
  return textesDeDesignation(projet).filter((t) => motif.test(t.texte)).map((t) => `${fichier}${t.chemin} : « ${t.texte} »`);
}

describe('identité d’un état `heros` dans les paquets livrés (EDO 02 l.112-127, #686)', () => {
  const projets = bundledFiles.map((f) => ({ f, p: parseProject(lireProjetLivre(f)) }));
  const identites = projets.flatMap(({ f, p }) => p.narratif.etats.flatMap((e) => (e.forme.kind === 'heros' && e.forme.identite ? [{ f, p, etat: e.id, identite: e.forme.identite }] : [])));

  it('au moins une identité livrée (la garde couvre réellement quelque chose)', () => {
    expect(identites.length).toBeGreaterThan(0);
  });

  it('chaque valeur `source` est contenue À L’OCTET dans son livre', () => {
    const introuvables = identites.flatMap(({ f, etat, identite }) => identite.lignes.flatMap((l) => l.valeurs
      .filter((v) => v.source && !texteDuLivre(v.source.book).includes(v.valeur))
      .map((v) => `${f} ${etat} ${l.espece} ${l.sexe} ${v.repere} : « ${v.valeur} » absent de ${v.source!.book}`)));
    expect(introuvables).toEqual([]);
  });

  it('chaque repère est EFFECTIVEMENT substitué au moins une fois (un repère masqué par un plus long est mort)', () => {
    const morts = identites.flatMap(({ f, p, etat, identite }) => {
      const marques = identitesDe(new Map(identite.reperes.map((r) => [r.fragment, `\uE000${r.id}\uE000`])));
      const tires = new Set(prosesDePaquet(p).flatMap((t) => [...nommer(t, marques).matchAll(/\uE000([^\uE000]+)\uE000/g)].map((m) => m[1])));
      return identite.reperes.filter((r) => !tires.has(r.id)).map((r) => `${f} ${etat} : repère « ${r.id} » jamais substitué`);
    });
    expect(morts).toEqual([]);
  });

  it('aucune ancre dans un texte de régime `designation` : la désignation ne dévoile pas le nom', () => {
    expect(projets.flatMap(({ f, p }) => fautesDeDesignation(p, f))).toEqual([]);
  });

  it('repère une ancre dans le libellé du profil d’un PNJ précomposé', () => {
    const fichier = 'jeu-de-role/campagnes/diligence/diligence-projet.json';
    const id = 'edo-fhluger-dagh';
    const label = 'Kastor Lieberung';
    const projet = parseProject(lireProjetLivre(fichier));
    const profil = projet.narratif.presetsPnj.find((pnj) => pnj.id === id)?.profil;
    assert(profil, `Profil de ${id} dans ${fichier}`);
    profil.label = label;

    expect(fautesDeDesignation(parseProject(projet), fichier)).toEqual([
      `${fichier}.narratif.presetsPnj[${id}].profil.label : « ${label} »`,
    ]);
  });

  it('chaque identité couvre la totalité espèce × sexe', () => {
    const manquants = identites.flatMap(({ f, etat, identite }) => raceKeySchema.options.flatMap((espece) => sexeSchema.options
      .filter((sexe) => !identite.lignes.some((l) => l.espece === espece && l.sexe === sexe))
      .map((sexe) => `${f} ${etat} : ${espece} ${sexe}`)));
    expect(manquants).toEqual([]);
  });
});

/**
 * #2968 L15, #3606 M2d — le nœud d'un dialogue (`start`, `choices[].next`), le dialogue d'une entité (`dialogueId`) et
 * d'un effet `startDialogue`, le locuteur d'un nœud (`nodes[].speakerId`, #3606 M3b0) et l'entité d'un effet
 * (`startDialogue.speakerId`, `openMerchant.entityId`, `medicalAid.entityId`) se désignent par `ref(portee)` : `{ id }` jugé au parse contre la collection `nodes` du MÊME
 * dialogue, `dialogues` ou `entities` de la MÊME scène, que chacun ouvre (`ouvrirPortees`). Fixtures : référence
 * connue, inconnue, écrite en id nu, d'une portée ÉTRANGÈRE (le nœud d'un autre dialogue, le dialogue ou l'entité
 * d'une autre scène), entité de la scène hors du filtre de la portée (un décor n'est ni personnage ni marchand), et
 * portée locale.
 */
import { describe, expect, it } from 'vitest';
import { sceneSchema } from './scene';
import { lireBlocsAvances } from '../blocsAvances';
import { mesureDuParse } from '../grammaire/ref';
import { IDS_PAR_ESPACE } from '../_ids.generated';
import areneProjet from '../../../scenes/arene/arene-projet.json';
import loupEtSaumureProjet from '../../../scenes/loup-et-saumure/loup-et-saumure-projet.json';

type Scene = (typeof areneProjet.scenes)[number];

const HUB = areneProjet.scenes.find((s) => s.id === 'arene-hub')!;
const RANG_ENTITE = HUB.entities.findIndex((e) => e.id === 'maitre');

const messages = (scene: unknown): string[] => {
  const r = sceneSchema.safeParse(scene);
  expect(r.success, 'la scène a parsé alors qu’elle devait être REFUSÉE').toBe(false);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`);
};

/** Le hub, retouché par `retouche` sur une copie. */
const hub = (retouche: (copie: Scene) => void): Scene => {
  const copie = structuredClone(HUB);
  retouche(copie);
  return copie;
};

/** Le chemin de l'effet du premier choix du premier nœud du dialogue du médecin, et le hub où cet effet vaut `effet`. */
const RANG_DIALOGUE = HUB.dialogues.findIndex((d) => d.id === 'dlg-medecin');
const EFFET = `dialogues.${RANG_DIALOGUE}.nodes.0.choices.0.flow.etapes.0.effet`;
const avecEffet = (effet: unknown) => hub((c) => Object.assign(c.dialogues[RANG_DIALOGUE].nodes[0].choices[0].flow!.etapes![0], { effet }));

const PORTEURS = [
  {
    porteur: 'scenes[].dialogues[].start', chemin: 'dialogues.0.start', connue: 'echelle', etrangere: 'rumeurs', catalogue: 'nœuds du dialogue', collection: 'nodes',
    avec: (v: unknown) => hub((c) => Object.assign(c.dialogues[0], { start: v })),
  },
  {
    porteur: 'scenes[].dialogues[].nodes[].choices[].next', chemin: 'dialogues.0.nodes.0.choices.0.next', connue: 'contrats', etrangere: 'rumeurs', catalogue: 'nœuds du dialogue', collection: 'nodes',
    avec: (v: unknown) => hub((c) => Object.assign(c.dialogues[0].nodes[0].choices[0], { next: v })),
  },
  {
    porteur: 'scenes[].entities[].dialogueId', chemin: `entities.${RANG_ENTITE}.dialogueId`, connue: 'dlg-garde', etrangere: 'dlg-prisonnier', catalogue: 'dialogues de la scène', collection: 'dialogues',
    avec: (v: unknown) => hub((c) => Object.assign(c.entities[RANG_ENTITE], { dialogueId: v })),
  },
  {
    porteur: 'scenes[].dialogues[].nodes[].speakerId', chemin: 'dialogues.0.nodes.0.speakerId', connue: 'maitre', etrangere: 'prisonnier', catalogue: 'personnages de la scène', collection: 'entities', horsDuFiltre: ['orn-echoppe-etal'],
    avec: (v: unknown) => hub((c) => Object.assign(c.dialogues[0].nodes[0], { speakerId: v })),
  },
  {
    porteur: 'effet startDialogue.dialogue', chemin: `${EFFET}.dialogue`, connue: 'dlg-garde', etrangere: 'dlg-prisonnier', catalogue: 'dialogues de la scène', collection: 'dialogues',
    avec: (v: unknown) => avecEffet({ type: 'startDialogue', dialogue: v }),
  },
  {
    porteur: 'effet startDialogue.speakerId', chemin: `${EFFET}.speakerId`, connue: 'maitre', etrangere: 'prisonnier', catalogue: 'personnages de la scène', collection: 'entities', horsDuFiltre: ['orn-echoppe-etal'],
    avec: (v: unknown) => avecEffet({ type: 'startDialogue', dialogue: { id: 'dlg-garde' }, speakerId: v }),
  },
  {
    porteur: 'effet openMerchant.entityId', chemin: `${EFFET}.entityId`, connue: 'medecin', etrangere: 'prisonnier', catalogue: 'marchands de la scène', collection: 'entities', horsDuFiltre: ['orn-echoppe-etal', 'maitre'],
    avec: (v: unknown) => avecEffet({ type: 'openMerchant', entityId: v }),
  },
  {
    porteur: 'effet medicalAid.entityId', chemin: `${EFFET}.entityId`, connue: 'medecin', etrangere: 'prisonnier', catalogue: 'personnages de la scène', collection: 'entities', horsDuFiltre: ['orn-echoppe-etal'],
    avec: (v: unknown) => avecEffet({ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: v }),
  },
];

describe('#2968 L15 — dialogues et nœuds désignés par `ref(portee)`', () => {
  it('les scènes réelles parsent, et leurs références sont des slots `local:nodes` / `local:dialogues` au parse de mesure', () => {
    const compte = (projet: { scenes: readonly unknown[] }, cible: string) =>
      projet.scenes.flatMap((s) => {
        expect(sceneSchema.safeParse(s).success).toBe(true);
        return mesureDuParse(sceneSchema, s).reperes.filter((r) => r.type === cible);
      }).length;
    /** Les références de nœud écrites dans la donnée : le `start` de chaque dialogue et chaque `choices[].next`. */
    const nodesEcrits = (projet: { scenes: readonly unknown[] }) =>
      (projet.scenes as { dialogues?: { nodes: { choices?: { next?: unknown }[] }[] }[] }[])
        .flatMap((s) => s.dialogues ?? [])
        .reduce((n, d) => n + 1 + d.nodes.flatMap((x) => x.choices ?? []).filter((c) => c.next !== undefined).length, 0);
    for (const projet of [areneProjet, loupEtSaumureProjet]) {
      expect(compte(projet, 'local:nodes')).toBe(nodesEcrits(projet));
      expect(compte(projet, 'local:dialogues')).toBeGreaterThan(0);
    }
  });

  it.each(PORTEURS)('$porteur : une référence connue parse', ({ avec, connue }) => {
    expect(sceneSchema.safeParse(avec({ id: connue })).success).toBe(true);
  });

  it.each(PORTEURS)('$porteur : une référence inconnue est refusée à son path, sa collection et son id nommés', ({ avec, chemin, catalogue, collection }) => {
    expect(messages(avec({ id: 'cible-inexistante' }))).toEqual([
      `${chemin}.id « cible-inexistante » est absent du catalogue des ${catalogue} (collection « ${collection} » du document).`,
    ]);
  });

  it.each(PORTEURS)('$porteur : une référence écrite en id nu est refusée', ({ avec, connue }) => {
    expect(sceneSchema.safeParse(avec(connue)).success).toBe(false);
  });

  it.each(PORTEURS)('$porteur : l’id d’une portée ÉTRANGÈRE (autre dialogue, autre scène) est refusé', ({ avec, etrangere, catalogue }) => {
    expect(messages(avec({ id: etrangere })).join(' ')).toContain(`« ${etrangere} » est absent du catalogue des ${catalogue}`);
  });

  it.each(PORTEURS.flatMap((p) => (p.horsDuFiltre ?? []).map((id) => ({ ...p, id }))))('$porteur : « $id », une entité de la scène hors du filtre de la portée, est refusée', ({ avec, id, catalogue }) => {
    expect(messages(avec({ id })).join(' ')).toContain(`« ${id} » est absent du catalogue des ${catalogue}`);
  });

  it('la portée est LOCALE : un nœud ajouté au dialogue est désignable, un dialogue retiré de la scène ne l’est plus', () => {
    const ajoute = hub((c) => {
      Object.assign(c.dialogues[0], { nodes: [...c.dialogues[0].nodes, { id: 'nœud-neuf', desc: 'Réplique.', choices: [] }] });
      Object.assign(c.dialogues[0].nodes[0].choices[0], { next: { id: 'nœud-neuf' } });
    });
    expect(sceneSchema.safeParse(ajoute).success).toBe(true);
    const sansGarde = { ...structuredClone(HUB), dialogues: HUB.dialogues.filter((d) => d.id !== 'dlg-garde') };
    expect(messages(sansGarde).join(' ')).toContain('« dlg-garde » est absent du catalogue des dialogues de la scène');
  });

  it('la modale « Avancé » juge les nœuds de chaque dialogue collé, sans la scène', () => {
    expect(lireBlocsAvances({ dialogues: structuredClone(HUB.dialogues) }).ok).toBe(true);
    const casse = structuredClone(HUB.dialogues);
    casse[0].start = { id: 'rumeurs' };
    const lu = lireBlocsAvances({ dialogues: casse });
    expect(lu.ok).toBe(false);
    expect(lu.ok ? '' : lu.rapport).toContain('« rumeurs » est absent du catalogue des nœuds du dialogue');
  });

  it('un id local n’entre dans aucun espace de l’INDEX DES IDS', () => {
    expect(Object.keys(IDS_PAR_ESPACE).filter((c) => /dialogues|nodes/.test(c))).toEqual([]);
  });
});

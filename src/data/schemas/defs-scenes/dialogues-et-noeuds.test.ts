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
import { IDS_PAR_ESPACE } from '../../_ids.generated';
import paquetDeTest from '../../../scenes/fixtures/paquet-de-test.json';

/** La première scène du paquet de test, à trois dialogues (dont un de marchand) et un marchand. */
const HUB = {
  ...structuredClone(paquetDeTest.scenes[0]),
  entities: [
    ...structuredClone(paquetDeTest.scenes[0].entities),
    { id: 'marchand', kind: 'personnage', pos: { x: 0, y: 2 }, label: 'Marchand', creature: { id: 'humain' }, dialogueId: { id: 'dialogue-marchand' }, merchant: { archetype: { id: 'medecin' } } },
  ],
  dialogues: [
    { id: 'dialogue-de-test', start: { id: 'accueil' }, nodes: [
      { id: 'accueil', desc: 'Réplique.', choices: [{ id: 'vers-suite', label: 'Suite', next: { id: 'suite' } }] },
      { id: 'suite', desc: 'Réplique.', choices: [] },
      { id: 'fin', desc: 'Réplique.', choices: [] },
    ] },
    { id: 'dialogue-marchand', start: { id: 'accueil' }, nodes: [
      { id: 'accueil', desc: 'Réplique.', choices: [{ id: 'commercer', label: 'Commercer', flow: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'openMerchant', entityId: { id: 'marchand' } } as Record<string, unknown> }] } }] },
    ] },
    { id: 'dialogue-autre', start: { id: 'ailleurs' }, nodes: [{ id: 'ailleurs', desc: 'Réplique.', choices: [] }] },
  ],
};
type Scene = typeof HUB;
type Choix = { next?: unknown; flow?: { etapes: Record<string, unknown>[] } };

const RANG_ENTITE = HUB.entities.findIndex((e) => e.id === 'adversaire-de-test');

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

/** Le chemin de l'effet du premier choix du dialogue du marchand, et le hub où cet effet vaut `effet`. */
const RANG_DIALOGUE = HUB.dialogues.findIndex((d) => d.id === 'dialogue-marchand');
const EFFET = `dialogues.${RANG_DIALOGUE}.nodes.0.choices.0.flow.etapes.0.effet`;
const avecEffet = (effet: unknown) => hub((c) => Object.assign((c.dialogues[RANG_DIALOGUE].nodes[0].choices[0] as Choix).flow!.etapes[0], { effet }));

/** `etrangere` : un nœud d'un AUTRE dialogue de la scène, ou un id qu'aucune collection de cette scène ne porte. */
const PORTEURS = [
  {
    porteur: 'scenes[].dialogues[].start', chemin: 'dialogues.0.start', connue: 'suite', etrangere: 'ailleurs', catalogue: 'nœuds du dialogue', collection: 'nodes',
    avec: (v: unknown) => hub((c) => Object.assign(c.dialogues[0], { start: v })),
  },
  {
    porteur: 'scenes[].dialogues[].nodes[].choices[].next', chemin: 'dialogues.0.nodes.0.choices.0.next', connue: 'fin', etrangere: 'ailleurs', catalogue: 'nœuds du dialogue', collection: 'nodes',
    avec: (v: unknown) => hub((c) => Object.assign(c.dialogues[0].nodes[0].choices[0], { next: v })),
  },
  {
    porteur: 'scenes[].entities[].dialogueId', chemin: `entities.${RANG_ENTITE}.dialogueId`, connue: 'dialogue-autre', etrangere: 'dialogue-d-une-autre-scene', catalogue: 'dialogues de la scène', collection: 'dialogues',
    avec: (v: unknown) => hub((c) => Object.assign(c.entities[RANG_ENTITE], { dialogueId: v })),
  },
  {
    porteur: 'scenes[].dialogues[].nodes[].speakerId', chemin: 'dialogues.0.nodes.0.speakerId', connue: 'adversaire-de-test', etrangere: 'personnage-d-une-autre-scene', catalogue: 'personnages de la scène', collection: 'entities', horsDuFiltre: ['objet-de-test'],
    avec: (v: unknown) => hub((c) => Object.assign(c.dialogues[0].nodes[0], { speakerId: v })),
  },
  {
    porteur: 'effet startDialogue.dialogue', chemin: `${EFFET}.dialogue`, connue: 'dialogue-autre', etrangere: 'dialogue-d-une-autre-scene', catalogue: 'dialogues de la scène', collection: 'dialogues',
    avec: (v: unknown) => avecEffet({ type: 'startDialogue', dialogue: v }),
  },
  {
    porteur: 'effet startDialogue.speakerId', chemin: `${EFFET}.speakerId`, connue: 'adversaire-de-test', etrangere: 'personnage-d-une-autre-scene', catalogue: 'personnages de la scène', collection: 'entities', horsDuFiltre: ['objet-de-test'],
    avec: (v: unknown) => avecEffet({ type: 'startDialogue', dialogue: { id: 'dialogue-autre' }, speakerId: v }),
  },
  {
    porteur: 'effet openMerchant.entityId', chemin: `${EFFET}.entityId`, connue: 'marchand', etrangere: 'personnage-d-une-autre-scene', catalogue: 'marchands de la scène', collection: 'entities', horsDuFiltre: ['objet-de-test', 'adversaire-de-test'],
    avec: (v: unknown) => avecEffet({ type: 'openMerchant', entityId: v }),
  },
  {
    porteur: 'effet medicalAid.entityId', chemin: `${EFFET}.entityId`, connue: 'marchand', etrangere: 'personnage-d-une-autre-scene', catalogue: 'personnages de la scène', collection: 'entities', horsDuFiltre: ['objet-de-test'],
    avec: (v: unknown) => avecEffet({ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: v }),
  },
];

describe('#2968 L15 — dialogues et nœuds désignés par `ref(portee)`', () => {
  it('le hub parse, et ses références sont des slots `local:nodes` / `local:dialogues` au parse de mesure', () => {
    expect(sceneSchema.safeParse(HUB).success).toBe(true);
    const reperes = mesureDuParse(sceneSchema, HUB).reperes;
    expect(reperes.filter((r) => r.type === 'local:nodes').length, 'trois `start` et un `next`').toBe(4);
    expect(reperes.filter((r) => r.type === 'local:dialogues').length, 'deux `dialogueId`').toBe(2);
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
    const sansMarchand = { ...structuredClone(HUB), dialogues: HUB.dialogues.filter((d) => d.id !== 'dialogue-marchand') };
    expect(messages(sansMarchand).join(' ')).toContain('« dialogue-marchand » est absent du catalogue des dialogues de la scène');
  });

  it('la modale « Avancé » juge les nœuds de chaque dialogue collé, sans la scène', () => {
    expect(lireBlocsAvances({ dialogues: structuredClone(HUB.dialogues) }).ok).toBe(true);
    const casse = structuredClone(HUB.dialogues);
    casse[0].start = { id: 'ailleurs' };
    const lu = lireBlocsAvances({ dialogues: casse });
    expect(lu.ok).toBe(false);
    expect(lu.ok ? '' : lu.rapport).toContain('« ailleurs » est absent du catalogue des nœuds du dialogue');
  });

  it('un id local n’entre dans aucun espace de l’INDEX DES IDS', () => {
    expect(Object.keys(IDS_PAR_ESPACE).filter((c) => /dialogues|nodes/.test(c))).toEqual([]);
  });
});

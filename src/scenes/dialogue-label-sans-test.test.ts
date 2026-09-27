/**
 * GARDE ABSOLUE (#1869) — un libellé de réponse de dialogue ne RECOPIE JAMAIS le Test de son flux,
 * ni le coût de son `cost`.
 *
 * Ce qu'une réponse annonce est DÉRIVÉ : `testAnnonce` (`state/dialogue.ts`) lit la Compétence et la
 * difficulté DANS le flux, et `DialogueBox` les rend en tête de ligne (« 2. [Crochetage —
 * Intermédiaire (+0)] Crocheter la cage. »). Un « (Test de Crochetage) » écrit à la main dans le
 * libellé est une SECONDE vérité : elle survit au changement de Compétence, et le joueur lit deux
 * fois la même chose.
 *
 * ABSOLUE : aucun stock, aucune baseline, aucune exemption — le compte attendu est ZÉRO, et la garde
 * NOMME ses sites (`fichier:ligne`). La mesure vit en lib (`scripts/guards/lib/dialogueLabelTest.mjs`,
 * patron `proseInline.mjs`) ; le vocabulaire des Caractéristiques lui est INJECTÉ depuis sa source
 * (`CHAR_LABELS`), jamais recopié.
 *
 * Le COÛT suit la même loi : la fenêtre le rend en puce (`Coins`, `formatMoney`/`spellMoney`) ; « — 4 pa »
 * écrit dans le libellé redouble la puce. Les unités viennent des deux écritures canon de la monnaie,
 * INJECTÉES comme les autres vocabulaires.
 *
 * Le `test.label` d'un `FlowTest` (« Intuition — quelque chose cloche chez Kramer ») est hors masque
 * PAR CONSTRUCTION : il n'est pas un `choices[].label`, et il nomme légitimement la fenêtre de jet.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHAR_LABELS, DIFFICULTY_LABELS } from '../engine/types';
import { formatMoney, spellMoney } from '../engine/money';
import { mesurerLibellesDeReponse } from '../../scripts/guards/lib/dialogueLabelTest.mjs';
import { avisLibelleRecopie, validateScene } from '../state/validateScene';
import { testScenarios } from './test-scenarios';
import { emptyScene, type Scene } from '../state/scene';
import type { Flow } from '../state/flow';

/** Le vocabulaire que la garde ne redéclare pas : il vient de SA source. */
const VOC = { carac: CHAR_LABELS, difficultes: DIFFICULTY_LABELS, monnaie: { formater: formatMoney, epeler: spellMoney } };

/** Flux à Test d'un choix jouet : Crochetage, Difficile. */
const fluxDeTest = (over: Record<string, unknown> = {}) => ({
  kind: 'test',
  test: { skill: { id: 'crochetage' }, difficulty: 'difficile', label: 'Crocheter la cage', ...over },
  success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] },
});

/** Dépôt JOUET hors dépôt (dossier temporaire) : un document de scène et son catalogue de
 *  Compétences. HORS `src/scenes` du dépôt réel — un document fautif posé en fixture y serait vu par
 *  la mesure ci-dessus (et par toutes les autres gardes qui scannent ce dossier). */
function depotJouet(label: string, flow: unknown = fluxDeTest(), cost?: Record<string, number>): string {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-libelle-'));
  fs.mkdirSync(path.join(racine, 'src/data'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'src/scenes/jouet'), { recursive: true });
  fs.writeFileSync(path.join(racine, 'src/data/skills.json'), JSON.stringify([{ id: 'crochetage', label: 'Crochetage' }]));
  const doc = {
    dialogues: [{ id: 'd', start: 'n', nodes: [{ id: 'n', desc: '…', choices: [{ label, flow, ...(cost ? { cost } : {}) }] }] }],
  };
  fs.writeFileSync(path.join(racine, 'src/scenes/jouet/jouet-projet.json'), JSON.stringify(doc, null, 1));
  return racine;
}

/** Le terme NOMMÉ par la garde pour ce libellé jouet, ou `null` si elle le laisse passer. */
function trouvaille(label: string, flow?: unknown, cost?: Record<string, number>): string | null {
  const trouves = mesurerLibellesDeReponse(VOC, depotJouet(label, flow, cost));
  if (!trouves.length) return null;
  expect(trouves, 'un libellé fautif se nomme UNE fois').toHaveLength(1);
  expect(trouves[0]).toContain('src/scenes/jouet/jouet-projet.json:');
  return trouves[0].replace(/^.*\[/, '').replace(/\]$/, '');
}

describe('#1869 — le libellé d’une réponse ne dit pas le Test de son propre flux', () => {
  it('aucun document de scène ne recopie ce que le tag dérivé dira déjà', () => {
    expect(
      mesurerLibellesDeReponse(VOC),
      'le tag « [Compétence — Difficulté] » et la puce de coût sont DÉRIVÉS de la donnée : retirer la mention du libellé',
    ).toEqual([]);
  });

  it('aucun scénario de test (documents `.ts`) ne lève l’avertissement de libellé à la validation', () => {
    const trouves = testScenarios.flatMap((s) => validateScene([s.scene, ...(s.extraScenes ?? [])], s.worldMap)
      .filter((w) => w.scope === 'dialogue' && w.message.startsWith(`Dialogue « ${w.refId} » : le libellé`))
      .map((w) => `${s.id} › ${w.message}`));
    expect(trouves).toEqual([]);
  });

  // COUVERTURE du détecteur, mesurée sur un dépôt jouet : sans elle, le vert ci-dessus ne dirait
  // rien — un masque muet rend `[]` sur tout. Une classe par cas, NOMMÉE par son terme.
  it('la COMPÉTENCE du flux dans le libellé : nommée, ligne comprise', () => {
    expect(trouvaille('Crocheter la cage (Test de Crochetage).')).toBe('Crochetage');
  });

  it('la SPÉCIALISATION du flux dans le libellé : nommée', () => {
    expect(trouvaille('Superviser la réparation (Charpentier)', fluxDeTest({ skill: { id: 'metier', spec: 'charpentier' } }))).toBe('charpentier');
  });

  it('la CARACTÉRISTIQUE du flux dans le libellé : nommée', () => {
    expect(trouvaille('Forcer le battant (Force)', fluxDeTest({ skill: undefined, characteristic: 'force' }))).toBe(CHAR_LABELS.force);
  });

  it('la DIFFICULTÉ déclarée : nommée sous sa forme complète comme sous son seul nom', () => {
    expect(trouvaille(`Ouvrir — ${DIFFICULTY_LABELS.difficile}`)).toBe(DIFFICULTY_LABELS.difficile);
    expect(trouvaille('Ouvrir (Difficile)')).toBe('Difficile');
  });

  it('le DR CUMULÉ d’un Test étendu : nommé (le tag le porte depuis `targetDR`)', () => {
    const etendu = { kind: 'do', effect: { type: 'extendedTest', skill: { id: 'crochetage' }, label: 'Forcer', targetDR: 5 } };
    expect(trouvaille('Forcer la serrure, 5 DR', etendu)).toBe('5 DR');
  });

  it('le mot « Test » seul suffit : « (Test étendu) » annonce ce que le tag dit déjà', () => {
    expect(trouvaille('Forcer la serrure (Test étendu)')).toBe('Test');
  });

  it('un jet ENFOUI dans le `yes` d’un nœud `choice` annonce autant qu’un jet de tête', () => {
    const enfoui = { kind: 'choice', prompt: 'Insister ?', yes: fluxDeTest(), no: { kind: 'seq', steps: [] } };
    expect(trouvaille('Insister (Test de Crochetage)', enfoui)).toBe('Crochetage');
  });

  const sansTest = { kind: 'seq', steps: [] };

  it('le COÛT recopié dans le libellé : nommé, par sa notation de puce, son nom de pièce ou son abréviation', () => {
    expect(trouvaille('Repas chaud pour le groupe — 4 pa.', sansTest, { silver: 4 })).toBe('4 pa');
    expect(trouvaille('Faire un don au tronc — 1 co.', sansTest, { gold: 1 })).toBe('1 CO');
    expect(trouvaille('Juste un repas (4 sous).', sansTest, { brass: 4 })).toBe('4 sous');
    expect(trouvaille('Juste un repas (4 sc).', sansTest, { brass: 4 })).toBe('4 sc');
  });

  it('le coût : un libellé SANS montant passe, un montant SANS rapport avec le `cost` aussi', () => {
    expect(trouvaille('Repas chaud pour le groupe.', sansTest, { silver: 4 })).toBeNull();
    expect(trouvaille('Nourrir les 4 compagnons.', sansTest, { silver: 4 })).toBeNull();
    expect(trouvaille('Payer 12 pa au passeur.', sansTest, { silver: 4 })).toBeNull();
  });

  it('le masque ne mord PAS le libellé qui dit l’ACTE sans rien annoncer', () => {
    // Le `test.label` du flux (« Crocheter la cage ») CONTIENT le verbe, pas la Compétence : c'est
    // exactement la forme attendue après nettoyage — la garde doit la laisser passer. « Tester » non
    // plus n'est pas le mot « Test » (comparaison en MOT ENTIER).
    expect(trouvaille('Crocheter la cage.')).toBeNull();
    expect(trouvaille('Tester la solidité du battant.')).toBeNull();
  });
});

describe('#1869 — le MÊME masque à la validation de scène rendue à l’éditeur (tout contenu est éditable)', () => {
  /** Projet JOUET, tel que l'éditeur le valide : une scène, un dialogue qu'une entité ouvre, une réponse. */
  const projet = (label: string): Scene[] => [{
    ...emptyScene(),
    id: 'jouet',
    entities: [{ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 1 }, dialogueId: 'd' }],
    dialogues: [{ id: 'd', start: 'n', nodes: [{ id: 'n', desc: '…', choices: [{ label, flow: fluxDeTest() as Flow }] }] }],
  }];
  const avertissements = (label: string) => validateScene(projet(label)).filter((w) => w.scope === 'dialogue' && w.level === 'warn');

  it('un libellé qui répète le Test de sa réponse sort en AVERTISSEMENT, terme nommé', () => {
    const w = avertissements('Crocheter la cage (Test de Crochetage).');
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ level: 'warn', sceneId: 'jouet', refId: 'd' });
    expect(w[0].message).toBe(avisLibelleRecopie('d', 'Crocheter la cage (Test de Crochetage).', 'Crochetage'));
  });

  it('un libellé qui répète le COÛT de sa réponse sort en AVERTISSEMENT, terme nommé', () => {
    const [scene] = projet('Repas chaud pour le groupe — 4 pa.');
    const choix = scene.dialogues[0].nodes[0].choices[0];
    const w = validateScene([{ ...scene, dialogues: [{ ...scene.dialogues[0], nodes: [{ ...scene.dialogues[0].nodes[0], choices: [{ label: choix.label, cost: { silver: 4 } }] }] }] }])
      .filter((x) => x.scope === 'dialogue' && x.level === 'warn');
    expect(w.map((x) => x.message)).toEqual([avisLibelleRecopie('d', 'Repas chaud pour le groupe — 4 pa.', '4 pa')]);
  });

  it('le libellé qui dit l’ACTE sans rien annoncer passe sans avertissement', () => {
    expect(avertissements('Crocheter la cage.')).toEqual([]);
  });
});

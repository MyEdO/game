/**
 * Point de validation partagé (#176) : `validateDataset`/`schemaForFile`/`validateDocument` — la SOURCE
 * UNIQUE utilisée par la sauvegarde Codex (`CodexEdit.save`), le chargement DEV (`dev-validate.ts`) et
 * le contrat CI (`schema-contract.test.ts`). Le contrat CI couvre déjà « chaque JSON réel parse » ; ici
 * on verrouille le CONTRAT de la fonction : valide → null, invalide → message champ-par-champ, fichier
 * non registré → erreur NOMMANT le fichier et le registre à peupler (la porte est STRICTE : un document
 * hors registre ne passe pas en silence).
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateDataset, validateDocument, schemaForFile, rapportDeFautes, cheminLisible } from './validate';
import { listeCle } from './grammaire/collection-cle';
import { schema as characteristicsSchema } from './defs/characteristics';
import { projetSchema } from './defs-scenes/projet';
import areneProjet from '../../scenes/arene/arene-projet.json';

const VALID_CHAR = [
  {
    id: 'capacite-de-combat',
    type: 'characteristics',
    abr: 'CC',
    label: 'Capacité de Combat',
    nature: 'roll',
    desc: 'x',
    source: { book: 'livre-de-base', page: 33 },
  },
];

describe('validateDataset — point de validation partagé (#176)', () => {
  it('une donnée conforme au schéma → null (pas de blocage)', () => {
    expect(validateDataset('characteristics.json', VALID_CHAR)).toBeNull();
  });

  it('une clé inconnue → message ACTIONNABLE champ-par-champ (refus)', () => {
    const bad = [{ ...VALID_CHAR[0], inventedField: 'poison' }];
    const err = validateDataset('characteristics.json', bad);
    expect(err).not.toBeNull();
    expect(err).toContain('characteristics.json');
  });

  it('un champ requis manquant → chemin du champ dans le message', () => {
    const bad = [{ abr: 'CC', label: 'x', nature: 'roll', desc: 'x' }]; // pas de `source`
    const err = validateDataset('characteristics.json', bad);
    expect(err).not.toBeNull();
    expect(err).toContain('0.source');
  });

  it('un fichier NON registré → erreur NOMMANT le fichier et le registre à peupler', () => {
    const err = validateDataset('fichier-inexistant.json', { anything: true });
    expect(err).toContain('fichier-inexistant.json');
    expect(err).toContain('aucun schéma registré');
    expect(err).toContain('defs-scenes/');
    expect(schemaForFile('fichier-inexistant.json')).toBeUndefined();
  });

  it('un document de la racine src/scenes est registré par son CHEMIN relatif', () => {
    expect(schemaForFile('arene/arene-projet.json')).toBe(projetSchema);
    expect(validateDataset('arene/arene-projet.json', areneProjet)).toBeNull();
  });

  it('validateDocument — porte par SCHÉMA (le seam n\'a pas de nom de fichier) : rend les FAUTES', () => {
    expect(validateDocument(projetSchema, areneProjet)).toBeNull();
    const fautes = validateDocument(projetSchema, { ...(areneProjet as object), schema: 2 });
    expect(fautes?.map((f) => f.chemin)).toContainEqual(['schema']);
    expect(rapportDeFautes('Projet', fautes!)).toContain('Projet — JSON invalide');
  });

  it('validateDataset DÉRIVE du rapport des fautes : une seule source du format de ligne', () => {
    const bad = [{ abr: 'CC' }];
    const res = characteristicsSchema.safeParse(bad);
    expect(res.success).toBe(false);
    const fautes = validateDocument(characteristicsSchema, bad)!;
    expect(validateDataset('characteristics.json', bad)).toBe(rapportDeFautes('characteristics.json', fautes));
    expect(fautes.map((f) => f.message)).toEqual(res.error!.issues.map((i) => i.message));
  });

  it('schemaForFile résout le schéma registré par nom de fichier', () => {
    expect(schemaForFile('characteristics.json')).toBe(characteristicsSchema);
  });

  it('validateDataset énumère chaque faute en « lieu: message »', () => {
    const msg = validateDataset('characteristics.json', [{ abr: 'CC' }])!;
    expect(msg.startsWith('characteristics.json — JSON invalide contre son schéma :')).toBe(true);
    expect(msg).toContain('\n  - ');
  });
});

describe('le LIEU d’une faute — un élément de liste à clé se nomme par sa clé, lue sur la valeur (#1897)', () => {
  const element = z.strictObject({ id: z.string(), label: z.string().optional(), n: z.number() });
  const doc = z.strictObject({ items: listeCle(element, 'id').optional(), bruts: z.array(element).optional() });

  it('un rang dans une liste à clé devient `liste « clé »`, le champ fautif suit ; le chemin reste BRUT', () => {
    const [faute] = validateDocument(doc, { items: [{ id: 'a', n: 1 }, { id: 'b', label: 'Bé', n: 'x' }] })!;
    expect(faute.chemin).toEqual(['items', 1, 'n']);
    expect(faute.lieu).toEqual([{ liste: 'items', cle: 'b', libelle: 'Bé' }, 'n']);
    expect(cheminLisible(faute.lieu)).toBe('items « b » › n');
    expect(cheminLisible(faute.lieu, (e) => e.libelle ?? e.cle)).toBe('items « Bé » › n');
  });

  it('une liste SANS clé déclarée garde son rang : la clé ne se devine pas sur un champ `id`', () => {
    const [faute] = validateDocument(doc, { bruts: [{ id: 'a', n: 'x' }] })!;
    expect(cheminLisible(faute.lieu)).toBe('bruts.0.n');
  });

  it('la clé DUPLIQUÉE est le SUJET du message ; le lieu nomme l’élément répété', () => {
    const fautes = validateDocument(doc, { items: [{ id: 'a', n: 1 }, { id: 'a', n: 2 }] })!;
    expect(fautes.map((f) => [f.chemin, cheminLisible(f.lieu), f.message])).toEqual([
      [['items', 1], 'items « a »', '« a » dupliqué : « id » identifie l’élément dans sa liste, il y est unique.'],
    ]);
  });

  it('une clé COMPOSÉE nomme l’élément par sa graphie', () => {
    const arete = z.strictObject({ x: z.number(), y: z.number(), door: z.boolean().optional() });
    const murs = z.strictObject({ walls: listeCle(arete, { nom: 'x,y', de: (w) => `${w.x},${w.y}` }) });
    const lus = (walls: unknown[]) => validateDocument(murs, { walls })!.map((f) => `${cheminLisible(f.lieu)}: ${f.message}`);
    expect(lus([{ x: 1, y: 2 }, { x: 3, y: 4, door: 'oui' }])).toEqual(['walls « 3,4 » › door: Entrée invalide : booléen attendu, chaîne reçu']);
    expect(lus([{ x: 1, y: 2 }, { x: 1, y: 2, door: true }])).toEqual([
      'walls « 1,2 »: « 1,2 » dupliqué : « x,y » identifie l’élément dans sa liste, il y est unique.',
    ]);
  });

  it('le rapport de la porte du projet nomme la scène et l’entité par leur clé, plus par leur rang', () => {
    const brut = structuredClone(areneProjet) as { scenes: { id: string; entities: unknown[] }[] };
    const rang = brut.scenes[0].entities.length;
    brut.scenes[0].entities.push({ id: 'p-1', kind: 'prop', pos: { x: 1, y: 1 }, label: 'Tonneau' });
    const rapport = rapportDeFautes('Projet', validateDocument(projetSchema, brut)!);
    expect(rapport).toContain(`  - scenes « ${brut.scenes[0].id} » › entities « p-1 » › ref: « ref » absente`);
    expect(rapport).not.toContain(`entities.${rang}`);
  });
});

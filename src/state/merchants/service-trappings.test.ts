/**
 * Tarifs de SERVICE (LDB 66 l.12-14 « Nourriture, boisson et hébergement » : chambre/écurie) ≠ objets
 * possédables — trouvaille playtest « l'aubergiste vend des choses qui ne sont pas des objets ».
 * `TrappingData.service` exclut ces entrées du stock marchand ET de l'octroi en inventaire, tout en
 * les gardant comme SOURCE de prix (référencées par id) et visibles au Codex/Compendium.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../store';
import { emptyScene } from '../scene';
import { trappings, findTrappingById } from '../../data';
import { itemFromTrappingById } from '../../engine/items';
import { MERCHANT_ARCHETYPES, MERCHANTS } from './index';
import { schema as merchantsSchema } from '../../data/schemas/defs/merchants';
import type { Combatant } from '../../engine/types';

const SERVICE_IDS = ['chambre-commune-nuit', 'chambre-privee-nuit', 'ecurie-nuit'];

const hero = (): Combatant =>
  ({ id: 'h', name: 'H', items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} }) as unknown as Combatant;

const sceneWithTaverniere = () => {
  const sc = emptyScene(4, 4);
  sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'taverniere' } });
  return sc;
};

describe('trappings service (LDB 66 l.12-14) — pas des objets possédables', () => {
  it('les 3 tarifs d’hébergement/écurie sont tagués service:true', () => {
    for (const id of SERVICE_IDS) {
      expect(findTrappingById(id)?.service, id).toBe(true);
    }
  });

  it('repas-auberge reste un objet ordinaire (Enc 0, RAW le classe avec les boissons, pas « – »)', () => {
    expect(findTrappingById('repas-auberge')?.service).toBeUndefined();
  });

  it('aucune autre entrée du catalogue n’est taguée service (classe exhaustive)', () => {
    const tagged = trappings.filter((t) => t.service).map((t) => t.id).sort();
    expect(tagged).toEqual([...SERVICE_IDS].sort());
  });
});

describe('stock marchand — exclut les services', () => {
  beforeEach(() => { useGame.setState({ party: [hero()], scene: null, merchant: null, merchantStocks: {} }); });

  it('la Tavernière ne met JAMAIS un service en stock (répété — tirage seedé mais couvre le filtre)', () => {
    useGame.setState({ scene: sceneWithTaverniere() });
    useGame.getState().openMerchant('pnj');
    const stock = useGame.getState().merchant!.stock;
    for (const id of SERVICE_IDS) expect(stock.some((l) => l.id === id)).toBe(false);
  });

  it('repas-auberge (objet) reste au curated de la Tavernière', () => {
    expect(MERCHANTS.taverniere.curated).toContain('repas-auberge');
  });
});

describe('curated — référence de trapping hors marqueur `service`, refusée au parse (`defs/merchants.ts`)', () => {
  it('un archétype dont curated nomme un tarif de service est refusé par le schéma de merchants.json', () => {
    const doc = structuredClone(MERCHANT_ARCHETYPES).map((m) =>
      m.id === 'taverniere' ? { ...m, curated: [...(m.curated ?? []), 'chambre-commune-nuit'] } : m,
    );
    const r = merchantsSchema.safeParse(doc);
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message)).toContain(
      '« chambre-commune-nuit » porte le marqueur « service » : cette référence l\'exclut du catalogue des objets (trappings.json).',
    );
    expect(merchantsSchema.safeParse(MERCHANT_ARCHETYPES).success, 'le registre réel passe').toBe(true);
  });
});

describe('itemFromTrappingById — refus bruyant d’octroyer un service en inventaire', () => {
  for (const id of SERVICE_IDS) {
    it(`refuse "${id}" (throw, pas un objet silencieux)`, () => {
      expect(() => itemFromTrappingById(id)).toThrow(/tarif de service/);
    });
  }
});

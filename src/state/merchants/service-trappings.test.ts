/**
 * Tarifs de SERVICE (LDB 66 l.12-14) ≠ objets possédables : hors de `INSTANCIABLE_PAR_ID`
 * (`data/schemas/grammaire/sousListes.ts`), donc hors du stock marchand (`trappingsInstanciables`) et
 * refusés au `curated` d'un archétype (`defs/merchants.ts`), tout en restant au catalogue.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../store';
import { emptyScene } from '../scene';
import { trappings, trappingsInstanciables, findTrappingById } from '../../data';
import { dansLaSousListe } from '../../data/schemas/grammaire/ref';
import { INSTANCIABLE_PAR_ID } from '../../data/schemas/grammaire/sousListes';
import { MERCHANT_ARCHETYPES, MERCHANTS } from './index';
import { schema as merchantsSchema } from '../../data/schemas/defs/merchants';
import type { Combatant } from '../../engine/types';

const horsDeLaVue = () => trappings.filter((t) => !dansLaSousListe(INSTANCIABLE_PAR_ID, t)).map((t) => t.id);

const hero = (): Combatant =>
  ({ id: 'h', name: 'H', items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} }) as unknown as Combatant;

const sceneWithTaverniere = () => {
  const sc = emptyScene(4, 4);
  sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'taverniere' } });
  return sc;
};

describe('trappings service (LDB 66 l.12-14) — au catalogue, hors de la vue', () => {
  it('le catalogue porte des tarifs de service, tous hors de `trappingsInstanciables`', () => {
    expect(horsDeLaVue().length).toBeGreaterThan(0);
    const vue = new Set(trappingsInstanciables().map((t) => t.id));
    expect(horsDeLaVue().filter((id) => vue.has(id))).toEqual([]);
  });

  it('repas-auberge reste un objet ordinaire (Enc 0, RAW le classe avec les boissons, pas « – »)', () => {
    expect(dansLaSousListe(INSTANCIABLE_PAR_ID, findTrappingById('repas-auberge')!)).toBe(true);
  });
});

describe('stock marchand — lit la vue', () => {
  beforeEach(() => { useGame.setState({ party: [hero()], scene: null, merchant: null, merchantStocks: {} }); });

  it('la Tavernière ne met JAMAIS en stock une entrée hors de la vue', () => {
    useGame.setState({ scene: sceneWithTaverniere() });
    useGame.getState().openMerchant('pnj');
    const stock = useGame.getState().merchant!.stock;
    expect(stock.length).toBeGreaterThan(0);
    for (const id of horsDeLaVue()) expect(stock.some((l) => l.id === id), id).toBe(false);
  });

  it('repas-auberge (objet) reste au curated de la Tavernière', () => {
    expect(MERCHANTS.taverniere.curated).toContain('repas-auberge');
  });
});

describe('curated — `refs(\'trapping\', { sousListe: INSTANCIABLE_PAR_ID })`, refusé au parse (`defs/merchants.ts`)', () => {
  it('un archétype dont curated nomme un tarif de service est refusé par le schéma de merchants.json', () => {
    const [service] = horsDeLaVue();
    const doc = structuredClone(MERCHANT_ARCHETYPES).map((m) =>
      m.id === 'taverniere' ? { ...m, curated: [...(m.curated ?? []), service] } : m,
    );
    const r = merchantsSchema.safeParse(doc);
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message)).toContain(
      `« ${service} » porte le marqueur « service » : cette référence l'exclut du catalogue des objets (trappings.json).`,
    );
    expect(merchantsSchema.safeParse(MERCHANT_ARCHETYPES).success, 'le registre réel passe').toBe(true);
  });
});

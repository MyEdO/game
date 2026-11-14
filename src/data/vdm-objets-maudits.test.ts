import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Objets maudits (VDM 12 l.790-926) — chacun porte un Bienfait, un Méfait et un Déclencheur.
 * Un objet dont SEUL le Bienfait est câblé est une donnée ACTIVEMENT fausse en faveur du joueur :
 * pire qu'un objet inerte, puisqu'il paraît correct. Ce fichier tient le CLIQUET : tant qu'un Méfait
 * n'est pas exprimable dans le vocabulaire (`GameOp`/`TriggeredEffect`), son Bienfait ne se pose pas.
 *
 * La règle centrale est STRUCTURELLE (aucune liste d'objets) : un objet `maudit` qui confère un
 * modificateur PASSIF favorable doit porter au moins un effet déclenché — son Méfait. Les autres
 * assertions sont des contrats de fidélité, relus au Source.
 */

type Op = { op: string; mod?: number; amount?: number; resource?: string; skill?: string; ignoreTB?: boolean; ignoreAP?: boolean };
type Trapping = {
  id: string; label?: string; desc?: string; categorie?: string; subType: { id: string } | null; enc?: unknown; reach?: unknown; hands?: number; pa?: number | null;
  damage?: { plusBF: boolean; flat: number } | null;
  qualities: { id: string }[]; passive?: Op[]; onHitEffects?: unknown[];
  consumable?: unknown; consumableDuration?: unknown;
  alsoIn?: { book: string; page: number; quote?: string }[];
};

const TRAPPINGS: Trapping[] = JSON.parse(readFileSync(fileURLToPath(new URL('./trappings.json', import.meta.url)), 'utf8'));
const byId = (id: string): Trapping => {
  const e = TRAPPINGS.find((t) => t.id === id);
  if (!e) throw new Error(`trapping introuvable : ${id}`);
  return e;
};
const isCursed = (t: Trapping): boolean => t.qualities.some((q) => q.id === 'maudit');
/** Modificateur passif FAVORABLE (le Bienfait mécanique d'un objet maudit). */
const boons = (t: Trapping): Op[] => (t.passive ?? []).filter((o) => (o.mod ?? 0) > 0);

describe('objets maudits — aucun Bienfait mécanique sans son Méfait', () => {
  it('tout objet `maudit` porteur d’un modificateur passif favorable porte un effet déclenché', () => {
    const gratuits = TRAPPINGS.filter(isCursed)
      .filter((t) => boons(t).length > 0 && (t.onHitEffects ?? []).length === 0)
      .map((t) => t.id);
    expect(gratuits).toEqual([]);
  });

  it('Épée de retenue : ni bonus passif ni Atout *Taille* — Méfait « l’épée se loge dans une armure » non exprimable', () => {
    const epee = byId('epee-de-retenue');
    expect(epee.passive ?? []).toEqual([]);
    expect(epee.qualities.map((q) => q.id)).toEqual(['maudit']);
  });

  it('Fléau d’attention non sollicitée : aucun bonus passif — Méfait (ciblage prioritaire + perte des niveaux de *Maîtrise du combat*) non exprimable', () => {
    expect(byId('fleau-d-attention-non-sollicitee').passive ?? []).toEqual([]);
  });

  it('Bottes du remords soudain : le seul passif est un MALUS de Discrétion (VDM 12 l.810)', () => {
    const ops = byId('bottes-du-remords-soudain').passive ?? [];
    expect(ops).toHaveLength(1);
    expect(ops[0].skill).toEqual({ id: 'discretion' });
    expect(ops[0].mod).toBeLessThan(0);
  });

  it('Cotte de mailles de bravoure usurpée : 3 PA de mailles Bras+Corps, aucun Bienfait — Méfait (Test de Calme à chaque coup encaissé, difficulté dégressive, fuite, PA suspendus) non exprimable (VDM 12 l.815/819)', () => {
    const cotte = byId('cotte-de-mailles-de-bravoure-usurpee');
    expect(cotte.pa).toBe(3);
    expect(cotte.passive ?? []).toEqual([]);
    expect(cotte.qualities.map((q) => q.id)).toEqual(['maudit']);
  });
});

/**
 * Contrat POSITIF, généralisé à tout le dataset : une armure qui annonce un nombre de PA dans
 * sa PROPRE `desc` doit annoncer le même nombre que son champ `pa` déclaré. Sans ce garde-fou,
 * une transcription fautive (le cas #850 : `pa: 2` contre une desc qui dit « 3 PA ») n'est
 * détectée par aucune autre garde du dataset.
 */
describe('armures — le PA annoncé dans la desc concorde avec le champ `pa` déclaré', () => {
  const PA_MENTION = /(\d+)\s*(?:Points? d['’]Armure|PA\b)/gi;

  const armures = TRAPPINGS.filter(
    (t): t is Trapping & { pa: number; desc: string } =>
      t.categorie === 'armor' && typeof t.pa === 'number' && typeof t.desc === 'string',
  );

  // NON-VACUITÉ : les `it()` ci-dessous ne naissent que des armures dont la desc ANNONCE un PA — sans
  // ce gel, un filtre qui ne sélectionne plus rien (renommage de champ, valeur déplacée) rendrait la
  // garde VERTE et MUETTE. Population mesurée le 2026-08-28 : 7 armures pourvues d'un `pa` numérique et
  // d'une `desc`, dont 1 annonce un PA en toutes lettres. Égalité STRICTE : tout retrait se motive ici.
  it('la population sous garde est celle mesurée (7 armures ; le filtre ne s’est pas vidé)', () => {
    expect(armures.length).toBe(7);
    expect(armures.filter((t) => [...t.desc.matchAll(new RegExp(PA_MENTION.source, 'gi'))].length > 0).map((t) => t.id))
      .toEqual(['cotte-de-mailles-de-bravoure-usurpee']);
  });

  for (const t of armures) {
    const annonces = [...t.desc.matchAll(PA_MENTION)].map((m) => Number(m[1]));
    if (annonces.length === 0) continue;
    it(`${t.id} : desc annonce ${[...new Set(annonces)].join('/')} PA, \`pa\` déclare ${t.pa}`, () => {
      expect(annonces.every((n) => n === t.pa)).toBe(true);
    });
  }
});

describe('objets maudits — Méfaits exprimés', () => {
  it('Dague voleuse de chance : −1 Point de Chance sur une frappe à +2 DR ou moins (VDM 12 l.833)', () => {
    const flat = JSON.stringify(byId('dague-voleuse-de-chance').onHitEffects);
    expect(flat).toContain('"op":"gainResource"');
    expect(flat).toContain('"resource":"fortune"');
    expect(flat).toContain('"amount":-1');
    expect(flat).toContain('"value":2');
  });

  it('Déchireur de sociabilité : la Blessure ignore Endurance ET Armure, et le porteur subit aussi le Test d’Assourdi (VDM 12 l.839)', () => {
    const effects = byId('dechireur-de-sociabilite').onHitEffects ?? [];
    const wounds: Op[] = [];
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n && typeof n === 'object') {
        const rec = n as Record<string, unknown>;
        if (rec.op === 'wounds') wounds.push(rec as Op);
        Object.values(rec).forEach(walk);
      }
    };
    walk(effects);
    expect(wounds.length).toBeGreaterThan(0);
    expect(wounds.every((w) => w.ignoreTB === true && w.ignoreAP === true)).toBe(true);
    // « lui y compris » : `near` EXCLUT le centre (`EffectTargeting`, engine/flowCore) — il faut
    // donc un effet jumeau visant le porteur.
    const selfAssourdi = effects.filter((e) => (e as { on?: unknown }).on === 'soi' && JSON.stringify(e).includes('assourdi'));
    expect(selfAssourdi).toHaveLength(1);
  });

  it('Hache de fureur incessante : profil d’Arme simple (LDB 62 l.32/l.127), aucun Atout du Bienfait', () => {
    const hache = byId('hache-de-fureur-incessante');
    expect(hache.hands).toBeUndefined();
    expect(hache.subType?.id).toBe('base');
    expect(hache.enc).toBe(1);
    expect(hache.reach).toBe('Moyenne');
    expect(hache.damage).toEqual({ plusBF: true, flat: 4 });
    expect(hache.qualities.map((q) => q.id)).toEqual(['maudit']);
  });
});

describe('pierres de pouvoir — desc VERBATIM et bonus non posé (VDM 12 l.729-747)', () => {
  const PIERRES: [string, string, string][] = [
    ['saphir-veritable', 'Azyr', 'Céleste'],
    ['mortegemme', 'Shyish', 'Améthyste'],
    ['ambrespectre', 'Ghur', 'Ambre'],
    ['luminante', 'Hysh', 'Lumière'],
    ['rubis-igne', 'Aqshy', 'Flamboyant'],
    ['pierre-d-or', 'Chamon', 'Doré'],
    ['cristal-de-brume', 'Ulgu', 'Gris'],
    ['vitaellum', 'Ghyran', 'Jade'],
  ];

  const CHAPITRE = readFileSync(
    fileURLToPath(new URL('../../Source/Warhammer v4 - Les Vents de Magie/12 - Artefacts magiques.md', import.meta.url)),
    'utf8',
  );

  for (const [id, vent, college] of PIERRES) {
    it(`${id} : desc = segment CONTIGU du Source (table des 8 Vents comprise, Vent ${vent} / Collège ${college})`, () => {
      const p = byId(id);
      const desc = p.desc ?? '';
      expect(CHAPITRE).toContain(desc); // règle 5 : copié/collé verbatim
      for (const [, v, c] of PIERRES) {
        expect(desc).toContain(v);
        expect(desc).toContain(c);
      }
      expect(desc).toContain(vent);
      expect(desc).toContain(college);
      expect(p.alsoIn).toBeUndefined();
    });

    it(`${id} : aucun \`consumable\` — le +3 DR ne vaut que pour « un Sort d'une couleur associée » (VDM 12 l.744)`, () => {
      const p = byId(id);
      expect(p.consumable).toBeUndefined();
      expect(p.consumableDuration).toBeUndefined();
      expect(p.passive ?? []).toEqual([]);
    });
  }
});

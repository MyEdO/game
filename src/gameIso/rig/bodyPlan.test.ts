import { describe, it, expect } from 'vitest';
import { bodyPlanById, resolveSpecies, planById, planOptsForRecord, resolveById, resolveRender } from './bodyPlan';
import { CREATURES } from './creatures';
import { EYE_OPTIONS } from './parts/eyes';
import { creatures } from '../../data';
import type { EntityAppearance } from '../../engine/authoringAppearance';

/** Plan d'un ID d'espèce canonique (slug de def) et plan d'un ID de record — les deux chemins explicites. */
const planOfSpecies = (id: string): string => resolveSpecies(id).plan;
const planOfId = (id: string): string => bodyPlanById(id);

describe('gabarits auto-enregistrés (plans/defs/ → PLANS dérivé)', () => {
  it('planById résout les 11 gabarits sans registre central', () => {
    for (const id of ['biped', 'quadruped', 'winged', 'serpentine', 'arachnid', 'avian', 'cephalopod', 'spectral', 'squig', 'amorphous', 'jabberslythe']) {
      const p = planById(id);
      expect(p, id).toBeTruthy();
      expect(p.id, `${id} déclare son propre id`).toBe(id);
    }
  });
});

describe('résolution espèce/id → plan (resolveSpecies / bodyPlanById)', () => {
  it('quadrupèdes → quadruped', () => {
    for (const id of ['cheval', 'loup', 'sanglier', 'rat-geant', 'ours', 'chien',
      // exotiques rapatriés en quad (reptilien/batracien/multi-têtes)
      'basilic', 'crapaud', 'hydre']) {
      expect(planOfSpecies(id), id).toBe('quadruped');
    }
  });
  it('humanoïdes peau-humaine + monstres bipèdes (Phase B) → biped', () => {
    for (const id of [
      'vermine-de-choc', 'rat-ogre',
      // Phase B : peaux-vertes, hommes-bêtes, morts-vivants humanoïdes, gros/démons.
      'orc', 'gobelin', 'snotling', 'gor', 'minotaure', 'squelette', 'zombie',
      'troll', 'vampire',
      // jalon 3 : sortis du monolithique
      'liche', 'fimir', 'geant',
    ]) {
      expect(planOfSpecies(id), id).toBe('biped');
    }
  });
  it('id d’espèce hors domaine (rôle générique sans def) → corps d’erreur `manquant`, jamais un bipède', () => {
    for (const id of ['soldat', 'bandit', 'creature-totalement-inconnue-xyz'])
      expect(planOfSpecies(id), id).toBe('manquant');
  });
  it('ailés (griffon/pégase/hippogriffe/dragon) → winged', () => {
    // IDS d'espèce-defs (sans record obligatoire) via resolveSpecies…
    for (const id of ['hippogriffe', 'varghulf']) expect(planOfSpecies(id), id).toBe('winged');
    // …et IDs de record (record→espèce) via bodyPlanById.
    for (const id of ['griffon', 'pegase', 'dragon', 'demigriffon', 'manticore']) expect(planOfId(id), id).toBe('winged');
  });
  it('nouveaux squelettes exotiques → leur plan dédié', () => {
    expect(planOfSpecies('serpent')).toBe('serpentine');
    expect(planOfSpecies('sangsue')).toBe('serpentine');
    expect(planOfSpecies('araignee')).toBe('arachnid');
    expect(planOfSpecies('pigeon')).toBe('avian');
    expect(planOfSpecies('pieuvre')).toBe('cephalopod');
  });
  it('morts-vivants spectraux (ids de record) → spectral', () => {
    for (const id of ['spectre-de-cairn', 'fantome', 'banshee']) expect(planOfId(id), id).toBe('spectral');
  });
  it('squig → squig', () => {
    expect(planOfSpecies('squig')).toBe('squig');
  });
  it('bête des marais → amorphous (gabarit hulk réutilisable)', () => {
    expect(planOfSpecies('bete-des-marais')).toBe('amorphous');
  });
  it('bêtes du Chaos (jabberslythes nommés) → jabberslythe — bespoke ANIMÉ, plus de monolithique', () => {
    expect(planOfSpecies('jabberslythe')).toBe('jabberslythe');
  });
  it('princes démons humanoïdes (illustration LDB p.338) → biped + parts monstrueuses', () => {
    // Fr'hough Mournbreath (LDB 336) rebâti en biped+monster (comme Slenderthigh Whiptongue) —
    // plus de gabarit jabberslythe monolithique pour cette figure humanoïde bipède.
    for (const id of ['slenderthigh-whiptongue', 'fr-hough-mournbreath']) {
      expect(planOfSpecies(id), id).toBe('biped');
    }
  });
  it('engins de siège (baliste / canon) → engin (corps statique, pas un bipède)', () => {
    for (const id of ['baliste', 'canon-petit']) expect(planOfSpecies(id), id).toBe('engin');
  });
});

/** Le corps d'erreur `manquant` n'est atteint que par une espèce d'auteur hors domaine (`fauteDEspece`). */
describe('corps d’erreur `manquant` — atteint par la faute seule', () => {
  it('aucun record du bestiaire ni aucune def de créature ne rend le corps d’erreur', () => {
    const parRecord = creatures.filter((c) => resolveById(c.id).plan === 'manquant').map((c) => c.id);
    const parDef = CREATURES.filter((d) => resolveRender(d.id, undefined, undefined).plan === 'manquant').map((d) => d.id);
    expect({ parRecord, parDef }).toEqual({ parRecord: [], parDef: [] });
  });
  it('une espèce inconnue le rend, et il se dessine sous toutes les vues', () => {
    expect(resolveRender('zzz', undefined, undefined)).toEqual({ kind: 'plan', plan: 'manquant', species: 'zzz', scale: 1 });
    for (const vue of ['front', 'profile', 'back'] as const) expect(planById('manquant').hasView('zzz', vue), vue).toBe(true);
  });
});

describe('planById(engin) — engin de siège statique, ANCRÉ au sol', () => {
  it('enregistré (auto-découverte plans/defs/) et 3 vues distinctes par type', () => {
    const p = planById('engin');
    expect(p?.id).toBe('engin');
    const baliste = (v: 'front' | 'profile' | 'back') => JSON.stringify(p.resolve('baliste', v, {}));
    const canon = (v: 'front' | 'profile' | 'back') => JSON.stringify(p.resolve('canon-petit', v, {}));
    // Les 3 vues d'un engin diffèrent entre elles…
    expect(new Set([baliste('front'), baliste('profile'), baliste('back')]).size).toBe(3);
    // …et la baliste ≠ le canon (silhouettes propres par espèce).
    expect(baliste('profile')).not.toEqual(canon('profile'));
  });
  it('base ANCRÉE à la ligne de sol (y=150) — pas de lévitation', () => {
    for (const v of ['front', 'profile', 'back'] as const) {
      const bones = planById('engin').resolve('canon-petit', v, {});
      expect(bones.length).toBe(1);
      expect(bones[0].matrix[5]).toBe(150); // contact au sol exactement sur l'ancrage aux pieds
    }
  });
  it('cadre son PROPRE portrait (le bloc est au BAS de la boîte → pas de disque vide)', () => {
    // Sans `portraitBox`, le défaut haut-avant (`CREATURE_BOX`, y 14→94) raterait l'engin (y 84→150).
    const box = planById('engin').portraitBox!.split(' ').map(Number);
    expect(box).toHaveLength(4);
    expect(box[1] + box[3]).toBeGreaterThan(120); // le cadre descend dans le BAS de la boîte (≈ sol)
  });
});

describe('planById(winged)', () => {
  it('rend un griffon avec ailes + 4 pattes au sol', () => {
    const bones = planById('winged').resolve('griffon', 'profile', {});
    expect(bones.length).toBeGreaterThan(8);
    expect(bones.filter((b) => b.id.startsWith('pied')).length).toBe(4);
    expect(bones.some((b) => b.id === 'aileD' || b.id === 'aileG')).toBe(true);
  });
  it('recolor : colors.corps change le markup du dragon', () => {
    const a = planById('winged').resolve('dragon', 'profile', {});
    const b = planById('winged').resolve('dragon', 'profile', {}, { colors: { corps: '#aa1133' } });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

describe('planById(quadruped)', () => {
  it('rend des os non vides avec les pieds vers le sol', () => {
    const bones = planById('quadruped').resolve('cheval', 'profile', {});
    expect(bones.length).toBeGreaterThan(8);
    const feet = bones.filter((b) => b.id.startsWith('pied'));
    expect(feet.length).toBe(4);
    const footY = Math.max(...feet.map((b) => b.matrix[5]));
    expect(footY).toBeGreaterThan(120); // pieds dans le bas de la boîte 150
  });
  it('walkPose diffère du repos (la démarche bouge)', () => {
    expect(planById('quadruped').walkPose(0.25)).not.toEqual(planById('quadruped').restPose());
  });
  it('recolor : colors.corps change le markup', () => {
    const a = planById('quadruped').resolve('cheval', 'profile', {});
    const b = planById('quadruped').resolve('cheval', 'profile', {}, { colors: { corps: '#aa1133' } });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

/**
 * Contrat POSITIF du socle `planOptsForRecord` (#1128 L0) — la couture qui fait enfin ARRIVER
 * l'apparence d'un RECORD de plan jusqu'au gabarit (elle n'atteignait AUCUN site avant). Ce qui est
 * verrouillé ici : le SENS de la précédence (une inversion `rec ?? override` doit virer au rouge),
 * la résolution des clés d'yeux en arts, et l'équivalence « aucun record sans apparence ne bouge ».
 */
describe('planOptsForRecord — apparence du RECORD → opts de gabarit (#1128 L0)', () => {
  const SQUIGS = 'nuee-de-squigs-des-cavernes'; // le seul record de plan portant `appearance.colors`

  it('record seul : ses couleurs deviennent les opts', () => {
    expect(planOptsForRecord(SQUIGS)).toEqual({ colors: { corps: '#5a2a7a' }, eyes: undefined });
  });

  it("l'override VIVANT prime sur le record — précédence PAR CHAMP : `colors` bascule EN ENTIER", () => {
    const out = planOptsForRecord(SQUIGS, { colors: { peau: '#112233' } });
    expect(out.colors).toEqual({ peau: '#112233' });
    // Contrat assumé (même formule que `rigAppearance`, le pendant bipède) : `corps` du record ne
    // survit pas à un override qui porte `colors` — l'objet remplace, il ne fusionne pas.
    expect(out.colors?.corps).toBeUndefined();
  });

  it("champ d'override ABSENT : le record garde la main (le socle ne masque rien avec `undefined`)", () => {
    expect(planOptsForRecord(SQUIGS, { sex: 'F' }).colors).toEqual({ corps: '#5a2a7a' });
  });

  it("yeux : clés du catalogue → ARTS, clé inconnue d'override = pas d'override (repli record)", () => {
    expect(planOptsForRecord(undefined, { eyes: { D: 'chat' } }).eyes?.D).toBe(EYE_OPTIONS.chat.art);
    // `eyesArtFromKeys` rend undefined sur une clé hors catalogue → le `??` retombe sur le record.
    const out = planOptsForRecord('demigriffon-adulte', { eyes: { D: 'inconnu' } });
    expect(out.eyes).toBeUndefined(); // ce record ne porte pas d'yeux : rien à replier
  });

  it('id inconnu / absent → opts VIDES (jamais une exception, jamais une apparence de tiers)', () => {
    expect(planOptsForRecord('id-qui-n-existe-pas')).toEqual({ colors: undefined, eyes: undefined });
    expect(planOptsForRecord(undefined)).toEqual({ colors: undefined, eyes: undefined });
  });

  it("ZÉRO changement silencieux : tout record de plan SANS apparence au-delà de `species` rend à l'IDENTIQUE avec ou sans le socle", () => {
    let compares = 0;
    for (const c of creatures) {
      const r = resolveById(c.id);
      if (r.kind !== 'plan') continue;
      const a = c.appearance as EntityAppearance | undefined;
      if (a?.colors || a?.eyes || a?.harnais) continue; // ces records-là DOIVENT changer (leur donnée est enfin lue)
      const plan = planById(r.plan);
      if (!plan) continue;
      const sans = plan.resolve(r.species, 'profile', plan.restPose());
      const avec = plan.resolve(r.species, 'profile', plan.restPose(), planOptsForRecord(c.id));
      expect(JSON.stringify(avec), c.id).toEqual(JSON.stringify(sans));
      compares++;
    }
    expect(compares, 'la boucle a bien comparé le gros du bestiaire de plan').toBeGreaterThan(100);
  });
});

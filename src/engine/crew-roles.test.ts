import { describe, it, expect } from 'vitest';
import { resolveCrewTestByRoles, crewRoleValue, undercrewPenalty, weeklyCrewWageBrass, crewTestSuccess } from './crewMorale';
import { toBrass, priceToMoney } from './money';
import { crewRoles, crewTestTypes, findCrewRoleById } from '../data';
import { traumaById } from './trauma';
import type { Combatant, SkillInstance } from './types';
import type { RNG } from './dice';
import { propulsionDuNavire } from './shipBuild';
import { desEnSuite } from './dice.testkit';

/** Compétence de Navigation d'une Cogue (`propulsionDuNavire`, MDG 13 l.18-19). */
const NAVIGATION = propulsionDuNavire('cogue', undefined, 'maritime')!.competence;

/** Combattant d'équipage minimal : caractéristiques + compétences possédées (carac d'instance = Dex pour
 *  un score prévisible : valeur = Dex + avances). Calqué sur le `mk` de skills.test.ts. */
const mk = (chars: Partial<Record<string, number>>, skills: { id: string; advances: number; spec?: string }[] = []): Combatant =>
  ({
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, ...chars },
    skills: skills.map((s) => ({ ...s, characteristic: 'dexterite' }) as SkillInstance),
    kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [], talents: [],
  }) as unknown as Combatant;

/** RNG déterministe : renvoie la séquence de d100 fournie. */
const seq = (values: number[]): RNG => desEnSuite(values);

describe('Catalogue des rôles d’équipage + types de Test (MDG 14) — données verbatim', () => {
  it('9 rôles, chacun {id,label,skills≥1,desc}', () => {
    expect(crewRoles).toHaveLength(9);
    for (const r of crewRoles) {
      expect(r.id && r.label && r.desc).toBeTruthy();
      expect(r.skills.length).toBeGreaterThanOrEqual(1);
    }
    // Mousse = Voile OU Ramer (le RAW donne deux compétences pour ce rôle).
    expect(findCrewRoleById('mousse')!.skills.map((s) => s.id)).toEqual(['voile', 'ramer']);
  });

  it('chaque type de Test référence des rôles existants, dont son rôle ESSENTIEL', () => {
    for (const tt of crewTestTypes) {
      expect(tt.roles).toContain(tt.essential);
      for (const roleId of tt.roles) expect(findCrewRoleById(roleId)).toBeDefined();
    }
    // Tir de batterie → Artilleur essentiel (MDG 14).
    const batt = crewTestTypes.find((t) => t.id === 'batterie')!;
    expect(batt.essential).toBe('artilleur');
  });
});

describe('Barème de solde (MDG 14 l.293-302) — lu depuis la donnée, #216', () => {
  it('chaque rôle porte un barème quotidien + hebdomadaire et un tag (source RAW ou maison)', () => {
    for (const r of crewRoles) {
      expect(r.wage).toBeDefined();
      expect(r.wage!.daily).toBeDefined();
      expect(r.wage!.weekly).toBeDefined();
      expect(!!r.wage!.source || !!r.wage!.maison).toBe(true); // exactement l'un des deux
    }
    // Correspondances RAW EXPLICITES (nom identique au barème) — MDG 14 page 126.
    expect(findCrewRoleById('mousse')!.wage!.source).toEqual({ book: 'mer-des-griffes', page: 126 });
    expect(findCrewRoleById('chirurgien')!.wage!.source).toEqual({ book: 'mer-des-griffes', page: 126 });
    // Mousse : 3/– par jour, 1 CO 4/– par semaine (colonnes NON multiples l'une de l'autre, verbatim).
    expect(findCrewRoleById('mousse')!.wage!.daily).toEqual({ gold: 0, silver: 3, brass: 0 });
    expect(findCrewRoleById('mousse')!.wage!.weekly).toEqual({ gold: 1, silver: 4, brass: 0 });
    // Correspondances arbitrées → tag maison (pas de tag source).
    expect(findCrewRoleById('capitaine')!.wage!.maison).toBeTruthy();
    expect(findCrewRoleById('capitaine')!.wage!.source).toBeUndefined();
  });

  it('weeklyCrewWageBrass = Σ count × coût hebdomadaire (sous de cuivre) ; roster absent/inconnu = 0', () => {
    // Mousse hebdo = 1 CO 4/– = 240 + 48 = 288 sc ; Capitaine hebdo = 5 CO = 1200 sc.
    expect(weeklyCrewWageBrass([{ roleId: 'mousse', count: 1 }])).toBe(288);
    expect(weeklyCrewWageBrass([{ roleId: 'capitaine', count: 1 }])).toBe(1200);
    expect(weeklyCrewWageBrass([{ roleId: 'mousse', count: 2 }, { roleId: 'capitaine', count: 1 }])).toBe(288 * 2 + 1200);
    expect(weeklyCrewWageBrass([{ roleId: 'mousse', count: 1 }])).toBe(toBrass(priceToMoney(findCrewRoleById('mousse')!.wage!.weekly)));
    expect(weeklyCrewWageBrass(undefined)).toBe(0);
    expect(weeklyCrewWageBrass([])).toBe(0);
    expect(weeklyCrewWageBrass([{ roleId: 'inexistant', count: 3 }])).toBe(0);
  });
});

describe('crewRoleValue — lit la VRAIE valeur de Compétence du membre (meilleure pour Mousse)', () => {
  it('Artilleur → Projectiles (Poudre noire) ; Mousse → meilleure de Voile/Ramer', () => {
    const artilleur = mk({ dexterite: 60 }, [{ id: 'projectiles', advances: 20, spec: 'poudre-noire' }]);
    expect(crewRoleValue(artilleur, findCrewRoleById('artilleur')!, NAVIGATION).value).toBe(80);
    const mousse = mk({ dexterite: 30 }, [{ id: 'voile', advances: 25, spec: 'cogue' }]); // Voile 55 > Ramer (repli 30)
    expect(crewRoleValue(mousse, findCrewRoleById('mousse')!, NAVIGATION).value).toBe(55);
  });
});

describe('crewRoleValue — la Compétence de propulsion du rôle porte la Spécialisation du navire (MDG 13 l.18-19)', () => {
  it('Timonier Voile (Drakkar) 30 / Voile (Cogue) 10 : la Cogue lit Voile (Cogue), le Knarr Voile (Drakkar)', () => {
    const timonier = mk({ dexterite: 40 }, [{ id: 'voile', advances: 30, spec: 'drakkar' }, { id: 'voile', advances: 10, spec: 'cogue' }]);
    const role = findCrewRoleById('timonier')!;
    expect(crewRoleValue(timonier, role, NAVIGATION)).toEqual({ value: 50, used: { id: 'voile', spec: 'cogue' } });
    const knarr = propulsionDuNavire('knarr', undefined, 'maritime', 'voile')!.competence;
    expect(crewRoleValue(timonier, role, knarr)).toEqual({ value: 70, used: { id: 'voile', spec: 'drakkar' } });
  });
});

describe('crewRoleValue — sens transmis au Test (Surdité, LDB 18 : « Tests de Perception basés sur l’ouïe » seulement)', () => {
  it('sense "vue" (voir la lumière d’un phare, MDG 13 l.337) : la Surdité NE pénalise PAS la Vigie', () => {
    const deaf = { ...mk({ dexterite: 40 }, [{ id: 'perception', advances: 0 }]), traumas: [traumaById('surdite', undefined, 'tete')] } as Combatant;
    const vigie = findCrewRoleById('vigie')!;
    expect(crewRoleValue(deaf, vigie, NAVIGATION).value).toBe(20); // sans sens précisé : pénalité par défaut (conservateur)
    expect(crewRoleValue(deaf, vigie, NAVIGATION, 'ouie').value).toBe(20); // sens auditif explicite : pénalisé
    expect(crewRoleValue(deaf, vigie, NAVIGATION, 'vue').value).toBe(40); // sens visuel : la Surdité ne vise QUE l’ouïe
  });
});

describe('resolveCrewTestByRoles — Test d’équipage piloté par rôles (MDG 14)', () => {
  it('le rôle ESSENTIEL (Artilleur pour Tir de batterie) voit son DR compté DOUBLE', () => {
    const artilleur = mk({ dexterite: 70 }, [{ id: 'projectiles', advances: 10, spec: 'poudre-noire' }]); // 80
    const mousse = mk({ dexterite: 40 }, [{ id: 'voile', advances: 10, spec: 'cogue' }]); // 50
    const r = resolveCrewTestByRoles(
      [{ crew: artilleur, roleId: 'artilleur' }, { crew: mousse, roleId: 'mousse' }],
      'batterie', 'intermediaire', 80, NAVIGATION, seq([30, 30]),
    );
    expect(r.contributions[0].label).toBe('Artilleur');
    expect(r.contributions[0].essential).toBe(true);
    expect(r.contributions[0].counted).toBe(r.contributions[0].sl * 2);
    expect(r.contributions[1].essential).toBe(false);
    expect(r.contributions[1].counted).toBe(r.contributions[1].sl);
    expect(r.baseTotal).toBe(r.contributions[0].counted + r.contributions[1].counted);
  });

  it('double-rôle (MDG 14 l.53) : le même jet est +2 crans plus DUR → DR plus faible', () => {
    const x = mk({ dexterite: 50 }, [{ id: 'orientation', advances: 0 }]); // Navigateur 50
    const normal = resolveCrewTestByRoles([{ crew: x, roleId: 'navigateur' }], 'manoeuvre', 'intermediaire', 80, NAVIGATION, seq([30]));
    const doubled = resolveCrewTestByRoles([{ crew: x, roleId: 'navigateur', doubleRole: true }], 'manoeuvre', 'intermediaire', 80, NAVIGATION, seq([30]));
    expect(doubled.contributions[0].sl).toBeLessThan(normal.contributions[0].sl);
  });

  // MDG 14 l.55 « ne peuvent jamais être meilleurs qu'un Succès Minime » · LDB 12 l.110 (bande
  // « 0 ou 1 | Succès Minime ») : le plafond est le HAUT de la bande, 1 DR — un équipage sous-nombré
  // peut encore réussir de justesse (arbitrage utilisateur [entériné 2026-08-03], #1019).
  it('Manque de bras (MDG 14 l.55) : −2 DR ET plafond au Succès Minime — 1 DR au mieux', () => {
    const cap = mk({ dexterite: 70 }, [{ id: 'voile', advances: 10, spec: 'cogue' }]); // Timonier 80
    const moussse = mk({ dexterite: 70 }, [{ id: 'voile', advances: 10, spec: 'cogue' }]); // Mousse 80
    const crew = [{ crew: cap, roleId: 'timonier' }, { crew: moussse, roleId: 'mousse' }];
    const full = resolveCrewTestByRoles(crew, 'manoeuvre', 'intermediaire', 80, NAVIGATION, seq([10, 10]));
    expect(full.total).toBeGreaterThan(1); // équipage complet : bien au-dessus du Succès Minime
    const short = resolveCrewTestByRoles(crew, 'manoeuvre', 'intermediaire', 80, NAVIGATION, seq([10, 10]), { understaffed: true });
    expect(short.total).toBe(1); // plafonné au HAUT de la bande Succès Minime
    expect(crewTestSuccess(short.total)).toBe(true); // …donc encore une réussite (de justesse)
    expect(short.lines.some((l) => /Manque de bras|Succès Minime/.test(l))).toBe(true);
  });

  it('Manque de bras : un total DÉJÀ nul n’est pas remonté par le plafond — 0 reste un échec (MDG 14 l.13)', () => {
    const faible = mk({ dexterite: 20 }, [{ id: 'voile', advances: 10, spec: 'cogue' }]); // Timonier 30
    // Jets à 30 (DR 0 pile) : total brut 0 essentiel compris, −2 de Manque de bras → négatif, puis plafond
    // (Math.min(1, …)) qui ne REMONTE jamais un total. Aucun succès n'est fabriqué par le plafond.
    const short = resolveCrewTestByRoles([{ crew: faible, roleId: 'timonier' }], 'manoeuvre', 'intermediaire', 80, NAVIGATION, seq([30]), { understaffed: true });
    expect(short.total).toBeLessThanOrEqual(0);
    expect(crewTestSuccess(short.total)).toBe(false);
  });
});

describe('undercrewPenalty — Manque de bras GLOBAL d’un grand vaisseau (MDG 14 l.55)', () => {
  it('équipage complet → aucune pénalité', () => {
    expect(undercrewPenalty(50, 50)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false });
    expect(undercrewPenalty(50, 52)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false }); // surnuméraire
  });

  it('moins de 10 % manquant → 0 tranche, pas de malus (le modificateur s’applique PAR tranche de 10 %)', () => {
    expect(undercrewPenalty(50, 46)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false }); // 8 % manquant
  });

  it('10 % manquant → 1 tranche : −2 DR + plafond Succès Minime', () => {
    expect(undercrewPenalty(50, 45)).toEqual({ tranches: 1, dr: -2, capSuccesMinime: true }); // 5/50 = 10 %
  });

  it('pertes lourdes → malus cumulatif par tranche de 10 %', () => {
    expect(undercrewPenalty(50, 35)).toEqual({ tranches: 3, dr: -6, capSuccesMinime: true }); // 30 % manquant
    expect(undercrewPenalty(50, 20)).toEqual({ tranches: 6, dr: -12, capSuccesMinime: true }); // 60 % manquant
  });

  it('nominal inconnu (0) → pas de pénalité (défensif)', () => {
    expect(undercrewPenalty(0, 0)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false });
  });
});

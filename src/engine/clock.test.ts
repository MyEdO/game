import { describe, it, expect } from 'vitest';
import { IMPERIAL_MONTHS, INTERCALARY, WEEKDAYS, daysPerYear, MINUTES_PER_DAY, toDate, fromDate, formatImperial, campaignStart, dayPhase, isNight, minutesUntilNext, dawnMinute, duskMinute, DAY_PHASES, ancreDePhase } from './clock';
import { setDataset } from '../data/overrides';
import { calendarMonths } from '../data';

describe('clock — calendrier impérial', () => {
  it('a 12 mois, 6 intercalaires, 8 jours de semaine ; année auto-cohérente', () => {
    expect(IMPERIAL_MONTHS).toHaveLength(12);
    expect(IMPERIAL_MONTHS[0]).toMatchObject({ label: 'Nachhexen', days: 32 });
    expect(INTERCALARY).toHaveLength(6);
    expect(WEEKDAYS).toHaveLength(8);
    expect(daysPerYear()).toBe(IMPERIAL_MONTHS.reduce((s, m) => s + m.days, 0) + INTERCALARY.length); // 394 + 6 = 400
  });

  it('année = 400 jours (canon EiS Annexe 3 l.20/68) ; mois = 394 = 2×32 + 10×33', () => {
    expect(daysPerYear()).toBe(400);
    expect(IMPERIAL_MONTHS.reduce((s, m) => s + m.days, 0)).toBe(394);
    expect(IMPERIAL_MONTHS.filter((m) => m.days === 32).map((m) => m.label)).toEqual(['Nachhexen', 'Nachgeheim']);
  });

  it('édition LIVE au Codex : éditer une table (setDataset) recalcule l’année à la volée', () => {
    const orig = calendarMonths.map((m) => ({ ...m }));
    const before = daysPerYear();
    setDataset('calendarMonths', [{ ...calendarMonths[0], days: calendarMonths[0].days + 5 }, ...calendarMonths.slice(1)]);
    expect(daysPerYear()).toBe(before + 5); // la dérivation (mémoïsée sur signature) se recalcule depuis la donnée éditée
    setDataset('calendarMonths', orig); // restaurer pour l’isolation des autres tests
    expect(daysPerYear()).toBe(before);
  });

  it('toDate/fromDate font un aller-retour (époque = Hexenstag 2512 00:00)', () => {
    for (const min of [0, 1440, 33 * 1440, 400 * 1440, 400 * 1440 + 17 * 60 + 30]) {
      expect(fromDate(toDate(min))).toBe(min);
    }
  });

  it('les jours intercalaires sont HORS du cycle hebdomadaire (weekday = null)', () => {
    expect(toDate(0).weekday).toBeNull(); // Hexenstag
    expect(toDate(66 * MINUTES_PER_DAY).weekday).toBeNull(); // Mitterfruhl
    expect(toDate(MINUTES_PER_DAY).weekday).toBe('Wellentag'); // 1 Nachhexen 2512 (ancre)
  });

  it('la semaine enjambe les intercalaires sans les compter (canon : « bridge uninterrupted »)', () => {
    // Hexenstag(0) Nachhexen(1..32) Jahrdrung(33..65) Mitterfruhl(66) Pflugzeit(67..)
    const lastJahrdrung = toDate(65 * MINUTES_PER_DAY); // 33 Jahrdrung
    const festival = toDate(66 * MINUTES_PER_DAY); // Mitterfruhl
    const firstPflugzeit = toDate(67 * MINUTES_PER_DAY); // 1 Pflugzeit
    expect(festival.weekday).toBeNull();
    // Les deux jours de mois de part et d'autre de la fête ont des jours de semaine CONSÉCUTIFS.
    const i = WEEKDAYS.findIndex((w) => w.label === lastJahrdrung.weekday);
    expect(WEEKDAYS[(i + 1) % WEEKDAYS.length].label).toBe(firstPflugzeit.weekday);
  });

  it('minute 0 = Hexenstag 2512 (jour intercalaire de Nouvel An)', () => {
    const d = toDate(0);
    expect(d.year).toBe(2512);
    expect(d.intercalary).toBe('Hexenstag');
    expect(d.month).toBeNull();
  });

  it('le 1er jour après Hexenstag = 1 Nachhexen 2512, 00:00', () => {
    const d = toDate(1 * MINUTES_PER_DAY);
    expect(d).toMatchObject({ year: 2512, monthName: 'Nachhexen', day: 1, hour: 0, minute: 0, intercalary: null });
  });

  it('franchit l’intercalaire Mitterfruhl entre Jahrdrung et Pflugzeit', () => {
    // Hexenstag(1) + Nachhexen(32) + Jahrdrung(33) = 66 jours → jour 66 = Mitterfruhl
    const d = toDate(66 * MINUTES_PER_DAY);
    expect(d.intercalary).toBe('Mitterfruhl');
  });

  it('formatImperial affiche date + heure françaises', () => {
    // 32 j Nachhexen + 30e jour de Jahrdrung = totalDays 62 (Hexenstag = jour 0, déjà compté par l'époque).
    const min = (32 + 30) * MINUTES_PER_DAY + 14 * 60 + 30; // 30 Jahrdrung 2512, 14:30
    expect(formatImperial(min)).toMatch(/30 Jahrdrung 2512 CI · 14:30/);
  });

  it('campaignStart() = fin Jahrdrung 2512 08:00', () => {
    const d = toDate(campaignStart());
    expect(d).toMatchObject({ year: 2512, monthName: 'Jahrdrung', day: 33, hour: 8, minute: 0 });
  });
});

describe('clock — phases du jour & obscurité (#T1c)', () => {
  const at = (h: number, m = 0) => h * 60 + m;
  it('dayPhase : 7 phases aux frontières (la nuit enjambe minuit)', () => {
    expect(dayPhase(at(4, 59)).id).toBe('nuit');
    expect(dayPhase(at(5)).id).toBe('aube');
    expect(dayPhase(at(8)).id).toBe('matin');
    expect(dayPhase(at(11)).id).toBe('midi');
    expect(dayPhase(at(14)).id).toBe('apresmidi');
    expect(dayPhase(at(18)).id).toBe('crepuscule');
    expect(dayPhase(at(20)).id).toBe('soir');
    expect(dayPhase(at(22)).id).toBe('nuit');
    expect(dayPhase(at(0)).id).toBe('nuit');
  });
  it('isNight = obscurité 22:00–05:00 (enjambe minuit), découplé des phases', () => {
    expect(isNight(at(22))).toBe(true);
    expect(isNight(at(2))).toBe(true);
    expect(isNight(at(4, 59))).toBe(true);
    expect(isNight(at(5))).toBe(false);
    expect(isNight(at(12))).toBe(false);
    expect(isNight(at(21, 59))).toBe(false);
  });
  it('dayPhase expose label/icon et isNight', () => {
    expect(dayPhase(at(12))).toMatchObject({ id: 'midi', icon: 'time/noon', isNight: false });
    expect(dayPhase(at(23))).toMatchObject({ id: 'nuit', isNight: true });
  });
  // #1467 L1b V-P1 : `dayPhase()` SCANNE `DAY_PHASES` dans l'ordre du fichier et retient la dernière
  // dont `start` ≤ l'heure ; son défaut (`[length - 1]`) suppose que la dernière entrée est celle qui
  // enjambe minuit. Ces deux hypothèses vivaient dans un commentaire. Elles sont ici un CONTRAT sur
  // la donnée : avec des `start` strictement croissants, « la dernière = celle qui enjambe » tient par
  // construction. Aucun tri défensif au chargement — une donnée cassée se DÉNONCE, elle ne se répare
  // pas en silence.
  it('`calendarPhases.json` : `start` STRICTEMENT croissants (contrat du scan de `dayPhase`)', () => {
    const desordres = DAY_PHASES.flatMap((p, i) =>
      i > 0 && p.start <= DAY_PHASES[i - 1].start
        ? [`${DAY_PHASES[i - 1].id} (${DAY_PHASES[i - 1].start}) → ${p.id} (${p.start})`]
        : [],
    );
    expect(desordres, 'ordre du fichier non strictement croissant : le scan de `dayPhase` rendrait une phase fausse').toEqual([]);
    // TÉMOIN POSITIF de l'enjambement : AVANT la première phase (00:00 < aube), le défaut du scan
    // prend la DERNIÈRE entrée — le comportement décrit par le commentaire de `dayPhase` est verrouillé.
    expect(dayPhase(0).id).toBe('nuit');
    expect(DAY_PHASES[DAY_PHASES.length - 1].id).toBe('nuit');
  });

  // #1467 L1b V-P1 : les deux ancres se RÉSOLVENT par id sur la donnée réelle. Elles s'écrivaient
  // l'une en POSITIONNEL (`DAY_PHASES[0]`), l'autre avec un REPLI (`[length - 2]`, qui désigne
  // 'soir' — 20:00, pas 18:00) : deux heures fausses en silence si la donnée bougeait.
  it('ancres DAWN/DUSK : résolues par id sur `calendarPhases.json`, valeurs du dataset réel', () => {
    expect(dawnMinute()).toBe(300); // 05:00
    expect(duskMinute()).toBe(1080); // 18:00
    // Chaque ancre est bien LA phase demandée, pas sa voisine de position.
    expect(DAY_PHASES.find((p) => p.id === 'aube')?.start).toBe(dawnMinute());
    expect(DAY_PHASES.find((p) => p.id === 'crepuscule')?.start).toBe(duskMinute());
    // TÉMOIN du repli mort : 'soir' (l'ancienne cible de `[length - 2]`) n'est PAS le crépuscule.
    expect(DAY_PHASES.find((p) => p.id === 'soir')?.start).not.toBe(duskMinute());
  });

  it('`ancreDePhase` : une ancre absente FAIL-FAST, et le message nomme donnée + id + ids présents', () => {
    const forgees = [
      { id: 'aube', start: 300 },
      { id: 'soir', start: 1200 },
    ];
    expect(ancreDePhase(forgees, 'aube')).toBe(300);
    // La branche d'erreur est ATTEIGNABLE (résolveur pur) : elle n'est pas du texte mort.
    expect(() => ancreDePhase(forgees, 'crepuscule')).toThrow(
      /phase d'ancre « crepuscule » absente de calendarPhases\.json \(ids présents : aube, soir\)/,
    );
    // Donnée VIDE : le message reste lisible, jamais une liste d'ids muette.
    expect(() => ancreDePhase([], 'aube')).toThrow(/ids présents : \(aucun\)/);
  });

  it('minutesUntilNext : plus tard / déjà passé → demain / pile = 0', () => {
    expect(minutesUntilNext(at(14), at(22))).toBe(8 * 60); // 14:00 → 22:00
    expect(minutesUntilNext(at(23), at(22))).toBe(23 * 60); // 23:00 → prochaine 22:00
    expect(minutesUntilNext(at(22), at(22))).toBe(0);
  });
});

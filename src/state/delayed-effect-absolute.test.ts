import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects, fireScheduledEffects } from './combatEffects';
import { flowFromEffects } from './flow';
import { createHero } from '../engine/character';
import { scheduleAt, dayIndex, toDate, fromDate, MINUTES_PER_DAY, minutesUntilNext } from '../engine/clock';
import { bus, EVT } from './bus';
import type { Effect } from './scene';

/**
 * #668 — extension de `delayedEffect`/`setObjective` au JOUR/DATE ABSOLU (`ScheduleSpec`,
 * résolveur UNIQUE `scheduleAt`, engine/clock). Câblage bout-en-bout par le VRAI store (patron
 * `bomb-vertical-slice.test.ts`, seul cas déjà établi pour `delayedEffect`).
 */
describe('scheduleAt — résolveur ScheduleSpec (engine/clock)', () => {
  it('atDate : résout via fromDate (date impériale absolue)', () => {
    const now = 12345;
    const spec = { atDate: { month: 2, day: 10, hour: 9, minute: 30 } };
    const y = toDate(now).year;
    expect(scheduleAt(now, spec)).toBe(fromDate({ year: y, month: 2, monthName: null, day: 10, intercalary: null, weekday: null, hour: 9, minute: 30 }));
  });

  it('afterDays : J+N à atHour:atMinute (défaut minuit)', () => {
    const now = 5 * MINUTES_PER_DAY + 10 * 60; // jour 5, 10:00
    expect(scheduleAt(now, { afterDays: 3, atHour: 0 })).toBe((dayIndex(now) + 3) * MINUTES_PER_DAY);
    expect(scheduleAt(now, { afterDays: 3 })).toBe((dayIndex(now) + 3) * MINUTES_PER_DAY); // défaut minuit
    expect(scheduleAt(now, { afterDays: 2, atHour: 14, atMinute: 30 })).toBe((dayIndex(now) + 2) * MINUTES_PER_DAY + 14 * 60 + 30);
  });

  it('afterMinutes seul : compte à rebours relatif inchangé', () => {
    expect(scheduleAt(1000, { afterMinutes: 60 })).toBe(1060);
    expect(scheduleAt(1000, { afterMinutes: 0 })).toBe(1000);
  });

  it('atHour/atMinute seuls : prochaine occurrence de l’heure du jour inchangée', () => {
    const now = 20 * 60; // 20:00
    expect(scheduleAt(now, { atHour: 22, atMinute: 45 })).toBe(now + minutesUntilNext(now, 22 * 60 + 45));
  });
});

describe('delayedEffect — échéance en JOURS via le store réel', () => {
  beforeEach(() => useGame.setState({ battle: null, flags: {}, scheduledEffects: [], gameTime: 5 * MINUTES_PER_DAY + 8 * 60 }));

  function lonePartyAt(wounds: number) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    h.wounds = { current: wounds, max: wounds };
    useGame.setState({ party: [h] });
    return h;
  }

  it('afterDays:3, atHour:0 : le flag n’est posé qu’une fois le bon JOUR franchi', () => {
    lonePartyAt(30);
    const now = useGame.getState().gameTime;
    const rite: Effect = { type: 'delayedEffect', afterDays: 3, atHour: 0, flow: flowFromEffects([{ type: 'setFlag', flag: 'rituel' }]) };
    applyEffects(useGame.getState, useGame.setState, [rite]);
    const executeAt = (dayIndex(now) + 3) * MINUTES_PER_DAY;
    expect(useGame.getState().scheduledEffects[0].executeAt).toBe(executeAt);

    // Avant l'échéance : le jour J+2 ne déclenche rien.
    useGame.getState().advanceTime(executeAt - now - 60);
    fireScheduledEffects(useGame.getState, useGame.setState);
    expect(useGame.getState().flags.rituel).toBeUndefined();
    expect(useGame.getState().scheduledEffects).toHaveLength(1);

    // Franchissement du jour cible : le flag est posé.
    useGame.getState().advanceTime(60);
    expect(useGame.getState().gameTime).toBe(executeAt);
    expect(useGame.getState().flags.rituel).toBe(true);
    expect(useGame.getState().scheduledEffects).toHaveLength(0);
  });

  it('#668 — un chemin de temps NON-advanceTime (rest/travel/sea) émet EVT.TIME_ADVANCED et tire la minuterie', () => {
    lonePartyAt(30);
    const now = useGame.getState().gameTime;
    const rite: Effect = { type: 'delayedEffect', afterDays: 2, atHour: 0, flow: flowFromEffects([{ type: 'setFlag', flag: 'x' }]) };
    applyEffects(useGame.getState, useGame.setState, [rite]);
    const executeAt = (dayIndex(now) + 2) * MINUTES_PER_DAY;

    // Simule restFlow/travelFlow/seaVoyageFlow : `set({gameTime})` + `bus.emit(EVT.TIME_ADVANCED)`,
    // JAMAIS `advanceTime` — prouve que l'abonnement bus (pas advanceTime seul) tire la minuterie.
    useGame.setState({ gameTime: executeAt });
    bus.emit(EVT.TIME_ADVANCED, { minutes: 1 });

    expect(useGame.getState().flags.x).toBe(true);
    expect(useGame.getState().scheduledEffects).toHaveLength(0);
  });
});

describe('setObjective — échéance posée sur Objective.deadline (#668)', () => {
  beforeEach(() => useGame.setState({ battle: null, flags: {}, objectives: [], gameTime: 5 * MINUTES_PER_DAY + 8 * 60 }));

  it('afterDays:2, atHour:0 : pose deadline = (dayIndex(now)+2)*1440', () => {
    const now = useGame.getState().gameTime;
    const eff: Effect = { type: 'setObjective', id: 'obj', desc: 'Retrouver le Grimm', afterDays: 2, atHour: 0 };
    applyEffects(useGame.getState, useGame.setState, [eff]);
    const obj = useGame.getState().objectives.find((o) => o.id === 'obj');
    expect(obj?.deadline).toBe((dayIndex(now) + 2) * MINUTES_PER_DAY);
  });

  it('sans ScheduleSpec : deadline reste undefined (compat #668)', () => {
    const eff: Effect = { type: 'setObjective', id: 'obj2', desc: 'Sans échéance' };
    applyEffects(useGame.getState, useGame.setState, [eff]);
    const obj = useGame.getState().objectives.find((o) => o.id === 'obj2');
    expect(obj?.deadline).toBeUndefined();
  });
});

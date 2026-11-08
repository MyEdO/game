import { describe, it, expect } from 'vitest';
import { appraiseEstimate } from './appraisal';

describe('appraisal — Évaluation estime ±10 % Rare/Exotique (LDB 59 l.41)', () => {
  it('Rare/Exotique → ±10 % ; sinon prix exact', () => {
    expect(appraiseEstimate('rare', 100)).toEqual({ min: 90, max: 110 });
    expect(appraiseEstimate('exotique', 200)).toEqual({ min: 180, max: 220 });
    expect(appraiseEstimate('commune', 100)).toEqual({ min: 100, max: 100 });
    expect(appraiseEstimate(null, 50)).toEqual({ min: 50, max: 50 });
  });
});

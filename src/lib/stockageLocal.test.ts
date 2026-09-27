import { describe, it, expect, afterEach } from 'vitest';
import { stockageLocal } from './stockageLocal';

const poser = (descripteur: PropertyDescriptor): void => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descripteur });
};

describe('stockageLocal — l’accès protégé au localStorage', () => {
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('rend le localStorage présent', () => {
    const s = { getItem: () => null } as unknown as Storage;
    poser({ value: s, writable: true });
    expect(stockageLocal()).toBe(s);
  });

  it('rend `null` quand il manque', () => {
    expect(stockageLocal()).toBeNull();
  });

  it('rend `null` quand son accès lève (mode privé strict, iframe sandbox)', () => {
    poser({ get: () => { throw new DOMException('accès refusé', 'SecurityError'); } });
    expect(stockageLocal()).toBeNull();
  });
});

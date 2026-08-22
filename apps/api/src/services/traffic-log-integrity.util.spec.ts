import { computeTrafficLogIntegrityHash } from './traffic-log-integrity.util';

describe('computeTrafficLogIntegrityHash', () => {
  const baseFields = {
    serviceType: 'REST',
    ipAddress: '203.0.113.10',
    startedAt: new Date('2026-08-22T10:00:00.000Z'),
    endedAt: new Date('2026-08-22T10:00:00.050Z'),
    connectionId: null,
    userId: 'user-1',
  };

  it('ayni_girdi_ayni_hash_uretir', () => {
    const first = computeTrafficLogIntegrityHash(baseFields);
    const second = computeTrafficLogIntegrityHash({ ...baseFields });

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('farkli_userId_farkli_hash_uretir', () => {
    const first = computeTrafficLogIntegrityHash(baseFields);
    const second = computeTrafficLogIntegrityHash({
      ...baseFields,
      userId: 'user-2',
    });

    expect(first).not.toBe(second);
  });

  it('farkli_connectionId_farkli_hash_uretir', () => {
    const first = computeTrafficLogIntegrityHash(baseFields);
    const second = computeTrafficLogIntegrityHash({
      ...baseFields,
      connectionId: 'ws-connection-1',
    });

    expect(first).not.toBe(second);
  });

  it('farkli_zaman_damgasi_farkli_hash_uretir', () => {
    const first = computeTrafficLogIntegrityHash(baseFields);
    const second = computeTrafficLogIntegrityHash({
      ...baseFields,
      endedAt: new Date('2026-08-22T10:00:05.000Z'),
    });

    expect(first).not.toBe(second);
  });

  it('null_alanlar_cokmeden_islenir', () => {
    const hash = computeTrafficLogIntegrityHash({
      serviceType: 'WS_CONNECTION_START',
      ipAddress: '203.0.113.20',
      startedAt: new Date('2026-08-22T10:00:00.000Z'),
      endedAt: null,
      connectionId: 'ws-connection-2',
      userId: null,
    });

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

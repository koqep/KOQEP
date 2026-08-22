import { sha256Hex } from './crypto.util';

export interface TrafficLogIntegrityFields {
  serviceType: string;
  ipAddress: string;
  startedAt: Date | null;
  endedAt: Date | null;
  connectionId: string | null;
  userId: string | null;
}

// Satırın kendi alanlarından deterministik bir bütünlük hash'i - sonradan
// (RUNBOOK'ta) yeniden hesaplanıp saklanan integrityHash'le karşılaştırılarak
// satırın değiştirilmediği doğrulanabilir. Alan sırası SABİT - Slice D
// (WS) da AYNI fonksiyonu kullanacak, iki yazma yolunun aynı kuralı
// izlediğinden emin olmak için.
export function computeTrafficLogIntegrityHash(
  fields: TrafficLogIntegrityFields,
): string {
  const canonical = [
    fields.serviceType,
    fields.ipAddress,
    fields.startedAt?.toISOString() ?? '',
    fields.endedAt?.toISOString() ?? '',
    fields.connectionId ?? '',
    fields.userId ?? '',
  ].join('|');
  return sha256Hex(canonical);
}

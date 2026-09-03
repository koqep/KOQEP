// M9 Slice C: birden fazla serviste fırlatılan, AYNI anlama gelen hata
// kodları burada toplanır - INVALID_TOKEN_CODE'un (auth.service.ts)
// AYNI gerekçesi: tek dosyada tekrarlanan bir mesaj inline string yeter,
// ama birden fazla DOSYADA aynı code gerekiyorsa gerçek bir yazım
// hatası/drift riski var, tek bir sabit bunu ortadan kaldırır.

export const USER_NOT_FOUND_CODE = 'USER_NOT_FOUND';
export const ROOM_NAME_TAKEN_CODE = 'ROOM_NAME_TAKEN';
export const INVALID_REFRESH_TOKEN_CODE = 'INVALID_REFRESH_TOKEN';
export const INVITE_NO_LONGER_VALID_CODE = 'INVITE_NO_LONGER_VALID';

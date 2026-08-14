import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  // M7a Slice A: web istemcisi artık bu alanı hiç göndermiyor - refresh
  // token'ı httpOnly cookie'den okunuyor (bkz. AuthController.
  // resolveRefreshToken). Mobil/bearer istemciler için opsiyonel olarak
  // korunuyor (ADR-0002: API cookie-agnostic kalmalı).
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

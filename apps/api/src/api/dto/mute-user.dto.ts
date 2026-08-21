import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export const MIN_MUTE_DURATION_HOURS = 1;
export const MAX_MUTE_DURATION_HOURS = 24 * 30; // 30 gün, tahmini üst sınır
// M7b Slice D2: moderatörün stated sebebi - report-message.dto.ts'in
// MAX_REPORT_REASON_LENGTH'iyle AYNI değer, farklı bir kavram (RAPORLAYANIN
// değil moderatörün sebebi) olduğu için ayrı bir sabit.
export const MAX_MODERATION_REASON_LENGTH = 500;

export class MuteUserDto {
  @IsInt()
  @Min(MIN_MUTE_DURATION_HOURS)
  @Max(MAX_MUTE_DURATION_HOURS)
  durationHours: number;

  // ZORUNLU (opsiyonel DEĞİL) - AC "Susturma bildirimi SEBEP içeriyor"
  // diyor, boş bir sebeple bildirim anlamsız kalırdı.
  @IsString()
  @Length(1, MAX_MODERATION_REASON_LENGTH)
  reason: string;
}

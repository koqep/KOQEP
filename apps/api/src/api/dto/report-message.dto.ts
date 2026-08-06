import { IsOptional, IsString, Length } from 'class-validator';

export const MAX_REPORT_REASON_LENGTH = 500;

export class ReportMessageDto {
  // create-room.dto.ts'in description deseniyle aynı - serbest metin,
  // opsiyonel.
  @IsOptional()
  @IsString()
  @Length(0, MAX_REPORT_REASON_LENGTH)
  reason?: string;
}

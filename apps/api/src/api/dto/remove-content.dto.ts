import { IsString, Length } from 'class-validator';
import { MAX_MODERATION_REASON_LENGTH } from './mute-user.dto';

export class RemoveContentDto {
  // mute-user.dto.ts'in reason'ıyla AYNI zorunlu-sebep gerekçesi.
  @IsString()
  @Length(1, MAX_MODERATION_REASON_LENGTH)
  reason: string;
}

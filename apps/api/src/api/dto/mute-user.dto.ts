import { IsInt, Max, Min } from 'class-validator';

export const MIN_MUTE_DURATION_HOURS = 1;
export const MAX_MUTE_DURATION_HOURS = 24 * 30; // 30 gün, tahmini üst sınır

export class MuteUserDto {
  @IsInt()
  @Min(MIN_MUTE_DURATION_HOURS)
  @Max(MAX_MUTE_DURATION_HOURS)
  durationHours: number;
}

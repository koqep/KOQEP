import { IsOptional, IsString, Length } from 'class-validator';

// MAX_ROOM_DESCRIPTION_LENGTH'in (create-room.dto.ts, 200) aynı ilkesi -
// biraz daha cömert çünkü tek satırlık bir "konu" değil, kısa bir bildirim +
// tek bir link sığacak kadar; banner'ı duvara çevirmeyecek kadar kısa.
export const MAX_ROOM_ANNOUNCEMENT_LENGTH = 280;

export class SetRoomAnnouncementDto {
  // Boş/eksik = temizle (RoomModerationService bu normalizasyonu yapıyor).
  @IsOptional()
  @IsString()
  @Length(0, MAX_ROOM_ANNOUNCEMENT_LENGTH)
  announcement?: string;
}

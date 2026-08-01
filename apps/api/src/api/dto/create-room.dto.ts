import { IsOptional, IsString, Length, Matches } from 'class-validator';

export const MIN_ROOM_NAME_LENGTH = 1;
export const MAX_ROOM_NAME_LENGTH = 60;
export const MAX_ROOM_DESCRIPTION_LENGTH = 200;

export class CreateRoomDto {
  // signup.dto.ts'in username deseniyle BİREBİR aynı regex - homoglyph/kılık
  // değiştirme vektörünü (ör. "ɡeneral", "genera1") kökten kapatıyor,
  // Unicode karakterler zaten reddediliyor (M3 kapsam gözden geçirmesi,
  // 2. tur).
  @IsString()
  @Length(MIN_ROOM_NAME_LENGTH, MAX_ROOM_NAME_LENGTH)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  name: string;

  // Serbest metin - okunabilir "konu" burada yaşıyor, slug'a çevrilen adın
  // kendisinde değil.
  @IsOptional()
  @IsString()
  @Length(0, MAX_ROOM_DESCRIPTION_LENGTH)
  description?: string;
}

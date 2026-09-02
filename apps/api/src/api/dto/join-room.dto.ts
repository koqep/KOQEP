import { IsOptional, IsString } from 'class-validator';

// M11c Slice A: şifreli bir oda için gerekli - sınır YOK (CreateRoomDto'nun
// MIN/MAX_ROOM_PASSWORD_LENGTH'i sadece YENİ bir şifre BELİRLERKEN anlamlı,
// burada sadece var olan bir hash'e eşleştiriliyor).
export class JoinRoomDto {
  @IsOptional()
  @IsString()
  password?: string;
}

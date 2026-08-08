import { IsString, Length, Matches } from 'class-validator';
import { MIN_ROOM_NAME_LENGTH, MAX_ROOM_NAME_LENGTH } from './create-room.dto';

export class RenameRoomDto {
  // create-room.dto.ts'in name deseniyle BİREBİR aynı regex (o dosyanın
  // signup.dto.ts ile kurduğu aynı "kopyala, paylaşma" ilkesi) - uzunluk
  // sabitleri zaten export edilmiş olduğu için import ediliyor.
  @IsString()
  @Length(MIN_ROOM_NAME_LENGTH, MAX_ROOM_NAME_LENGTH)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  name: string;
}

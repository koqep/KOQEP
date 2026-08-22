import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  totpCode?: string;

  // M6c Slice B: kullanıcının kendi mesaj içeriğini de kaldırma seçimi -
  // ADR-0005 Addendum #2, avukatın "satır bazlı kişi-belirlenebilirlik"
  // standardı. Varsayılan davranış (alan gönderilmezse) mevcut hâliyle
  // kalır - sadece Message.authorId SetNull, içerik dokunulmaz.
  @IsOptional()
  @IsBoolean()
  redactMessageContent?: boolean;
}

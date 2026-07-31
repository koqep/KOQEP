import { IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  totpCode?: string;
}

import { IsString } from 'class-validator';

export class TotpCodeDto {
  @IsString()
  totpCode: string;
}

import { IsEmail, IsOptional, IsString } from 'class-validator';

export class AssignModeratorDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  totpCode?: string;
}

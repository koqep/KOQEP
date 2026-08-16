import { IsEmail } from 'class-validator';

export class RevokeModeratorDto {
  @IsEmail()
  email: string;
}

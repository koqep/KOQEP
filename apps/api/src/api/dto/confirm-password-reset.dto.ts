import { IsString, Length } from 'class-validator';
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from './signup.dto';

export class ConfirmPasswordResetDto {
  @IsString()
  token: string;

  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  newPassword: string;
}

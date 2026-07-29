import { IsEmail, IsString, Length } from 'class-validator';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
const MAX_INVITE_CODE_LENGTH = 100;

export class SignupDto {
  @IsString()
  @Length(1, MAX_INVITE_CODE_LENGTH)
  inviteCode: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  password: string;
}

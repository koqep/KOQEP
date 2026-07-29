import { IsEmail } from 'class-validator';

export class BlockUserDto {
  @IsEmail()
  email: string;
}

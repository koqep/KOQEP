import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  totpCode?: string;

  // M9 Slice B: giriş anında localStorage'daki tercih - User.locale HENÜZ
  // null'sa (hiç açıkça set edilmediyse) TEK SEFERLİK senkronlanır, aksi
  // halde sessizce yok sayılır (auth.service.ts'in login() metodu).
  @IsOptional()
  @IsIn(['en', 'tr'])
  localeHint?: 'en' | 'tr';
}

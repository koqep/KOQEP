# Kod Stili

<!-- paths yok => her session yüklenir. Kısa tut, sadece linter'ın yakalayamadıkları. -->

- İsimlendirme: fonksiyon `fiilİsim` (`createUser`), boolean `is/has/can` öneki.
- Erken return tercih edilir; iç içe 3 seviyeden fazla `if` yok.
- Hata yut(ma): `catch` içinde sessizce devam edilmez, ya işlenir ya yukarı fırlatılır.
- Public fonksiyonlar tipli; `any` / `Any` kullanımı gerekçesiz geçmez.
- Sihirli sayı yok — adlandırılmış sabit.
- Yorum yerine isim düzelt. Yorum sadece "neden"i açıklar.

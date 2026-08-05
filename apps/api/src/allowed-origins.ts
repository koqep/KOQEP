// WEB_ORIGIN, e-posta doğrulama/şifre sıfırlama linklerinin (auth.service.ts)
// TEK kanonik taban URL'i - o kullanım bilerek WEB_ORIGIN'e dokunmuyor, tek
// bir domain üretmek zorunda. CORS (main.ts, messages.gateway.ts) ise hem
// koqep.com hem www.koqep.com'dan gelen isteklere izin vermeli - bu yüzden
// CORS tarafı, WEB_ORIGIN'den www/www-siz karşılığını hesaplayarak ikisini
// birden allow-list'e ekliyor. Yeni bir env var GEREKTİRMİYOR - domain
// tekrar değişirse tek yerden (WEB_ORIGIN) güncellenir.
export function getAllowedOrigins(
  webOrigin: string | undefined,
): string[] | undefined {
  if (!webOrigin) return undefined;

  const canonical = new URL(webOrigin);
  const alternate = new URL(webOrigin);
  alternate.hostname = canonical.hostname.startsWith('www.')
    ? canonical.hostname.slice('www.'.length)
    : `www.${canonical.hostname}`;

  return [webOrigin, alternate.origin];
}

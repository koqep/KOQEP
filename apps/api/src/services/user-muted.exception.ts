// sendMessage/editMessage SADECE messages.gateway.ts'ten (WS) çağrılıyor,
// REST'ten hiç çağrılmıyor - şekillendirilecek bir HTTP yanıtı yok, bu yüzden
// Nest HttpException DEĞİL, plain bir Error alt sınıfı. Gateway'in catch
// bloğu bunu instanceof ile ayrı bir dal olarak yakalayıp WsException'a
// çeviriyor.
export class UserMutedException extends Error {
  constructor(public readonly mutedUntil: Date) {
    super('Susturulmuşsun.');
  }
}

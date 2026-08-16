# ADR-0009: `RoomMember` üyelik modeli — yayın/liste scoping, erişim kontrolü değil

**Tarih:** 2026-08-15
**Durum:** Kabul edildi

## Bağlam
`docs/BACKLOG.md`'nin `>50 aktif kullanıcı` tetikleyicisi 500 hedefiyle kesin aşıldı. Kod okunarak doğrulandı: `messages.gateway.ts`'in `handleConnection`'ı bağlantıda her soketi TÜM aktif odalara katılıyordu (üyelik kavramı hiç yoktu), oda-geneli broadcast Socket.IO'nun kendi join-state'ini kullanıyordu — yani her mesaj, o odada hiç mesaj görmemiş dahil, o an bağlı TÜM kullanıcılara gidiyordu. 500 eşzamanlı bağlantıda bu bir UX sorunu değil bir KAPASİTE sorunu (her mesaj için N=500 fan-out). `RoomMember` M7a'nın Faz-0 istisnası — mimari bir değişiklik, gerçek mesajlar/ilişkiler birikince retrofit etmek çok daha pahalı olur.

## Karar — üyelik kapasite/keşfedilebilirlik scoping'i, erişim kontrolü DEĞİL
`RoomMember` (userId, roomId, `@@unique`) eklendi. `messages.gateway.ts`'in `handleConnection`'ı artık soketi sadece ÜYE olduğu aktif odalara join ediyor — WS broadcast fan-out'u buradan küçülüyor. **Ama `messages.service.ts`'in `sendMessage`/`getRecentMessages`'ına HİÇBİR erişim-kontrolü eklenmedi** — herhangi bir authed kullanıcı hâlâ herhangi bir aktif odaya isimle yazabilir/okuyabilir, bugünkü gibi. Milestone'un kendi çerçevesi kapasite+keşfedilebilirlik scoping'i, oda gizliliği değil — istenmeyen bir "üye olmalısın" kuralı icat etmek kilitlenme riski taşırdı, hiçbir kazanç için.

**Kabul edilen, belgelenen kenar durum:** `RoomView.tsx`'in gönderme akışı iyimser yerel-ekleme yapmıyor — gönderenin kendi mesajı sadece `message:new` dinleyicisiyle (join'li olduğu odalar için) UI'da görünüyor. Üye olmadığı bir odaya (normal UI akışında olamaz — join-sonra-switch her zaman zorlanıyor) `handleSubmit` çağrılırsa sessiz bir başarı ack'i alır ama mesajını kendi ekranında hiç görmez. Kod değiştirilmedi (normal akışta erişilemez), burada bilerek belgeleniyor.

## Backfill — üç kaynağın birleşimi
İki saf seçenek ("her kullanıcı × her aktif oda" ve "sadece çekirdek odalar") ikisi de yanlıştı: ilki bugünkü "herkes her yerde" davranışını aynen korur, fan-out sorununu hiç çözmez; ikincisi kullanıcı-üretimi bir odada gerçekten aktif konuşan mevcut kullanıcıların o odayı kaybetmesine yol açar. Seçilen: `apps/api/src/db/backfill-room-members.ts` üç kaynağın birleşimi (dedupe edilmiş, `Map<"userId:roomId", ...>` üzerinden, `createMany({skipDuplicates:true})`):

1. **Çekirdek odalar — TÜM kullanıcılar.** Yeni kullanıcıların signup'ta kazanacağı otomatik çekirdek-oda üyeliğiyle simetrik, geriye dönük.
2. **Oda kurucuları** (`Room.creatorId`) — hiç mesaj yazmamış olsalar bile, `createRoom`'un artık kurucuyu otomatik üye yapmasıyla simetrik.
3. **Gerçek katılımcılar** — `Message`'da `DISTINCT authorId, roomId WHERE authorId IS NOT NULL`.

(2) ve (3) oda `status`'una göre FİLTRELENMİYOR (aktif+arşivlenmiş hepsi dahil) — bir kullanıcının arşivlenmiş bir odadaki geçmiş katılımı hâlâ gerçek bir katılım. Sadece (1) doğal olarak aktif-only (çekirdek odalar hiç arşivlenmiyor, ADR-0006).

**Bilinen, kabul edilen sınır:** sessiz bir "lurker" (hiç mesaj yazmamış ama düzenli okuyan bir kullanıcı) bu backfill'de yakalanamaz — bugünkü veri modelinde kullanıcı-başına "görüntüledi" sinyali yok (`Room.lastViewedAt` oda-seviyesinde, kullanıcı-seviyesinde değil). Bu şemanın gerçek bir sınırı, icat edilmiş bir kısayol değil — production ölçeği bugün tek haneli olduğu için pratik etkisi şu an sıfıra yakın.

Migration dosyasının kendisi saf Prisma-üretimi `CREATE TABLE`, sıfır elle-SQL — backfill mantığı ayrı bir Prisma-Client script'inde (`backfill-totp-secrets.ts`'in — M6 Slice E — aynı, gerçek precedent'i). `render.yaml`'ın `preDeployCommand`'ı migration+backfill'i yeni kodun canlıya çıkışından ÖNCE bitirmeyi garanti ediyor (aynı desen), migration+davranış-değişikliğini ayrı bir deploy'a bölmeyi gereksiz kılıyor.

**Backfill'in eşzamanlılık sağlamlığı:** `backfillRoomMembers` önce kaynak sorgularını (tüm kullanıcılar/odalar/mesajlar) okuyor, sonra tek bir `createMany` ile yazıyor — bu okuma-yazma arasında bir kullanıcı/oda silinirse (paralel e2e worker'ların aynı test DB'sine yazdığı senaryoda gerçekten gözlemlendi) FK ihlaliyle patlayabilir. `insertPairs` bu hatayı (P2003) yakalayıp geçerli id'lere göre filtrelenmiş bir KEZ yeniden dener — hata yutulmuyor, işleniyor. Deploy-zamanı script'i olarak normalde tek-yazıcılı bir pencerede çalışıyor, bu sadece savunma amaçlı.

## Disconnect-guard bug'ı + düzeltmesi
`handleConnection`'ın eski "sistemde hiç aktif oda yoksa disconnect et" kontrolü, sorgu üyelik-scoped olunca AYNI mantıkla "bu kullanıcının sıfır üyeliği varsa disconnect et"e dönüşüyordu — `socketRegistry.register()`'DAN ÖNCE çalıştığı için sıfır-üyelikli bir kullanıcı hiç register edilmiyordu. Bu, hem yeni `POST /rooms/:id/join`'in "açık soketleri anlık katır" vaadini bozuyordu (register olmayan bir soket bulunamaz) hem de oda-bağımsız bildirimleri (mute/unmute) etkiliyordu hem de birden fazla e2e testinin (signup'ı bypass eden `prisma.user.create` ile sıfır-üyelikli kullanıcı üreten) `'ready'` beklerken sonsuza kadar asılı kalmasına yol açıyordu. **Düzeltme: kontrol tamamen kaldırıldı.** Sıfır-üyelikli bir soket artık normal bağlanır, register olur, sıfır oda-join'iyle `'ready'` alır — "henüz hiçbir odaya üye değilim, keşfedilebilir odalara bakıyorum" YENİ modelde meşru bir durum.

## Lifecycle bildirimlerinin global broadcast'e geçişi
`notifyRoomRenamed`/`notifyRoomArchived`/`notifyRoomDeleted` bugüne kadar `server.in(roomId).fetchSockets()` kullanıyordu — kodun kendi yorumu bunun bilerek "HERKES bilmeli" (keşfedilebilir-odalar listesini etkiliyor) olduğunu söylüyordu. Üyelik-scoped join'den sonra bu üçü sessizce üye-olmayanlara ulaşmaz hale gelirdi, orijinal niyeti bozardı. Düzeltme: `SocketRegistryService`'e yeni bir `getAllSockets()` erişimcisi eklendi, bu üç metod artık `server.in(roomId)` DEĞİL, TÜM bağlı soket kaydını kullanan gerçek bir global broadcast yapıyor.

## Endpoint'ler ve scope'lar
- **`GET /rooms?scope=mine`** (varsayılan/eksik/geçersiz) — `members:{some:{userId}}`, normal switcher'ın DEĞİŞMEYEN çağrısı.
- **`GET /rooms?scope=discoverable`** — `members:{none:{userId}}`, her zaman `status:'active'`, `Room.name` (`@unique`) üzerinde cursor+limit sayfalama (`messages.service.ts`'in `getRecentMessages`'ıyla AYNI desen). Bilerek alfabetik (`name asc`) — aktiviteye göre sıralama `docs/milestones/M7b-scale-polish.md` Slice E'ye scoped, orada açık bir bağımlılık notuyla.
- **`GET /rooms?scope=all`** — bugünkü tam davranış (düz, filtresiz liste), moderasyon paneli için. Moderatör-kontrolü YOK (`GET /rooms`'un zaten sahip olduğu erişim seviyesiyle birebir aynı). Bu dilimde SAYFALANMIYOR — `docs/BACKLOG.md`'ye somut bir tetikleyiciyle yazıldı (sessiz bırakılmadı).
- **`POST /rooms/:id/join`** — idempotent (`upsert`, her zaman 200), çağıranın açık soketlerini anlık join eder.
- **`POST /rooms/:id/leave`** — kullanıcı-üretimi odalarda idempotent (`deleteMany`). Çekirdek odalar (`CORE_ROOM_NAMES`) `ForbiddenException` ile reddedilir — herkesin ortak buluşma noktası, yanlışlıkla ayrılmak (geri dönüşü olmasa bile) hiçbir gerçek talep yokken inşa edilmiş bir risk. Çağıranın açık soketlerini anlık `.leave()` eder.

## Değerlendirilen alternatifler
- **Üyeliği erişim kontrolüne de bağlamak** (üye olmayan bir odaya yazamama/okuyamama) — reddedildi: milestone'un kapsamı kapasite/keşfedilebilirlik, gizlilik değil; kilitlenme riski taşıyan gerekçesiz bir kısıtlama olurdu.
- **`scope=all`'ı bu dilimde de sayfalamak** — ertelendi, `docs/BACKLOG.md`'ye somut tetikleyiciyle (toplam `Room` satır sayısı 100'ü geçince) yazıldı.
- **Keşif listesini aktiviteye göre sıralamak** — bu dilimin kapsamı dışı, `M7b-scale-polish.md` Slice E'ye scoped, kendi dosyasında açık bir bağımlılık notuyla.

## Sonuçları
- **Olumlu:** WS fan-out artık üyelikle sınırlı — 500 kullanıcı ölçeğinde hedeflenen kapasite sorunu çözüldü. Backfill idempotent ve eşzamanlılığa dayanıklı, her deploy'da güvenle tekrar koşabiliyor.
- **Bedel / kabul edilen risk:** sessiz lurker'lar backfill'de yakalanmıyor (yukarıya bakın) — pratik etki bugün sıfıra yakın, şemanın gerçek bir sınırı.
- **Bu kararı geri almak ne kadar pahalı:** orta-yüksek. `RoomMember` tablosunu kaldırıp eski "herkes her yerde" davranışına dönmek `handleConnection`'ı ve broadcast mantığını geri almayı gerektirir ama şema geriye dönük uyumlu kalır (additive bir tablo, kaldırmak veri kaybı dışında risksiz). Üyelik modelini erişim kontrolüne genişletmek ise ayrı, daha büyük bir karar — bugün bilerek yapılmadı.

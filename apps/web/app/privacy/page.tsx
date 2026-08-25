import Link from "next/link";

const FEEDBACK_EMAIL = "ussasa155@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="animate-fade-in mx-auto max-w-2xl p-4 text-neutral-400">
      <h1 className="mb-2 text-neutral-400">
        <span className="text-muted">#</span> gizlilik politikası
      </h1>

      <p className="mb-8 text-xs">Son güncelleme: 25 Ağustos 2026</p>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 1. Veri Sorumlusu
          </h2>
          <p>Bu Platform&apos;un veri sorumlusu KOQEP&apos;tir.</p>
          <p className="mt-2">
            İletişim:{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 2. Hangi Verileri
            Topluyoruz
          </h2>

          <p className="mt-2 font-semibold text-neutral-300">
            2.1 Kayıt sırasında
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>E-posta adresi</li>
            <li>Kullanıcı adı</li>
            <li>
              Şifre (geri döndürülemez şekilde şifrelenmiş halde saklanır,
              düz metin olarak asla tutulmaz)
            </li>
          </ul>

          <p className="mt-4 font-semibold text-neutral-300">
            2.2 Kullanım sırasında
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>Gönderdiğiniz mesajlar</li>
            <li>Oluşturduğunuz odalar ve açıklamaları</li>
            <li>
              İsteğe bağlı iki faktörlü doğrulama (2FA) kurduysanız, buna ait
              gizli anahtar (şifrelenmiş halde saklanır)
            </li>
          </ul>

          <p className="mt-4 font-semibold text-neutral-300">
            2.3 Bağlantı/trafik bilgisi
          </p>
          <p className="mt-1">
            5651 sayılı Kanun&apos;un yer sağlayıcılara getirdiği yasal
            yükümlülük gereği, Platform&apos;a yapılan bağlantılara ilişkin
            aşağıdaki bilgiler <strong>18 ay süreyle</strong> saklanır:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>IP adresiniz</li>
            <li>Bağlantı/istek zamanı</li>
            <li>Erişilen hizmet türü</li>
            <li>Aktarılan veri miktarı</li>
          </ul>
          <p className="mt-2">
            Bu kayıtlar, kaydedildikleri andan itibaren bütünlük kontrolü
            (kriptografik özet) ile korunur ve 18 ay sonunda otomatik olarak
            silinir. Bu kayıtlar yalnızca yasal yükümlülüğümüzü yerine
            getirmek amacıyla tutulur; pazarlama, profilleme veya üçüncü
            taraflarla paylaşım amacıyla kullanılmaz.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 3. Verilerinizi Kimlerle
            Paylaşıyoruz
          </h2>
          <p>
            Platform&apos;un çalışması için gerekli teknik altyapı
            hizmetlerini (barındırma, e-posta gönderimi, hata takibi gibi)
            sağlayan hizmet sağlayıcılarla, yalnızca hizmetin sunulabilmesi
            için gerekli ölçüde ve açık rızanız alınarak veri paylaşımı
            yapılabilir. Bu sağlayıcılar yurt içinde veya yurt dışında
            konumlu olabilir. Bu rıza, kayıt sırasında bu politikayı ve
            Kullanım Şartları&apos;nı onayladığınız onay kutusuyla alınır —
            kayıt tamamlandığında rıza da verilmiş sayılır, ayrı bir işlem
            gerekmez.
          </p>
          <p className="mt-2">
            Mesajlarınız, katıldığınız odadaki diğer kullanıcılar tarafından
            görülebilir. Bunun dışında hiçbir içeriğinizi üçüncü taraflarla
            paylaşmıyoruz, satmıyoruz veya reklam amacıyla kullanmıyoruz.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 4. Haklarınız
          </h2>

          <p className="mt-2 font-semibold text-neutral-300">
            4.1 Verilerinizi indirme
          </p>
          <p className="mt-1">
            Hesap ayarlarınızdan kendi profilinizi, mesajlarınızı, davet
            kayıtlarınızı ve itibar geçmişinizi JSON formatında
            indirebilirsiniz.
          </p>

          <p className="mt-4 font-semibold text-neutral-300">
            4.2 Hesabınızı silme
          </p>
          <p className="mt-1">Hesabınızı sildiğinizde:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>Hesap bilgileriniz kalıcı olarak silinir</li>
            <li>
              Mesajlarınızın yazarı bilgisi kaldırılır (mesajlar, konuşma
              bağlamını bozmamak için oda içinde kalmaya devam eder, ama
              artık size bağlanamaz)
            </li>
            <li>
              <strong>İsteğe bağlı olarak</strong>, mesaj içeriklerinizin de
              kaldırılmasını seçebilirsiniz (bu seçenek varsayılan olarak
              işaretlidir)
            </li>
            <li>
              Seçtiğiniz seçenekten bağımsız olarak, sistemimiz
              mesajlarınızda e-posta adresi veya telefon numarası gibi
              kişisel bilgi saptarsa bunları otomatik olarak kaldırır
            </li>
          </ul>
          <p className="mt-2">
            Bu yaklaşım &quot;makul çaba&quot; standardına dayanır: hiçbir
            otomatik sistem her türlü kişisel ifşayı (örneğin dolaylı,
            bağlamsal bir ipucu) %100 güvenilirlikle tespit edemez.
            Hesabınızı sildikten sonra eski bir mesajınızda kişisel
            bilginizin kaldığını fark ederseniz,{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>{" "}
            adresinden bize ulaşarak kaldırılmasını talep edebilirsiniz — bu
            talepler manuel olarak, makul bir süre içinde işleme alınır.
          </p>

          <p className="mt-4 font-semibold text-neutral-300">
            4.3 Diğer haklarınız
          </p>
          <p className="mt-1">
            KVKK&apos;nın 11. maddesi kapsamında; verilerinizin işlenip
            işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme,
            işlenme amacını öğrenme, yurt içinde/yurt dışında aktarıldığı
            üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini
            isteme haklarına sahipsiniz. Bu talepler için{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>{" "}
            adresinden bize ulaşabilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 5. Çerezler ve Yerel
            Depolama
          </h2>
          <p>
            Platform çerez (cookie) kullanmaz. Oturumunuzu sürdürmek için
            tarayıcınızın yerel depolama alanı ve güvenli, HTTP-only bir
            oturum çerezi kullanılır — bu, üçüncü taraf izleme amaçlı
            değildir, sadece oturumunuzun açık kalmasını sağlar.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 6. Yaş Sınırı
          </h2>
          <p>
            Platform&apos;u kullanabilmek için 18 yaşını doldurmuş olmanız
            gerekmektedir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 7. Bu Politikadaki
            Değişiklikler
          </h2>
          <p>
            Bu politikada önemli bir değişiklik yaptığımızda, değişikliği
            Platform üzerinden duyururuz.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 8. İki Dilli Metin
          </h2>
          <p>
            Bu politika, Türkçe ve İngilizce sürümleri arasında tutarlı,
            ortak ve genel bir metin olarak tasarlanmıştır — belirli bir
            yargı alanına özgü aşırı ayrıntı barındırmadan, farklı kullanım
            bağlamlarına uyarlanabilecek şekilde hazırlanmıştır.
          </p>
          <p className="mt-2 text-xs">
            Sürümler arasında bir çelişki olması durumunda hangi sürümün
            bağlayıcı sayılacağı henüz kesinleşmedi — bu madde, ortak metin
            avukat onayına sunulduğunda netleştirilecektir.
          </p>
        </section>
      </div>

      <p className="mt-8 flex gap-4 text-xs">
        <Link href="/" className="text-muted hover:text-neutral-400">
          ana sayfaya dön
        </Link>
        <Link href="/privacy/en" className="text-muted hover:text-neutral-400">
          Switch to English
        </Link>
      </p>
    </main>
  );
}

import Link from "next/link";

import { FEEDBACK_EMAIL } from "../../lib/contact";

export default function TermsPage() {
  return (
    <main className="animate-fade-in mx-auto max-w-2xl p-4 text-neutral-400">
      <h1 className="mb-2 text-neutral-400">
        <span className="text-muted">#</span> kullanım şartları
      </h1>

      <p className="mb-8 text-xs">Son güncelleme: 25 Ağustos 2026</p>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 1. Taraflar ve Kapsam
          </h2>
          <p>
            Bu Kullanım Şartları (&quot;Şartlar&quot;), KOQEP
            (&quot;Platform&quot;) ile Platform&apos;a kayıt olan her
            kullanıcı (&quot;Kullanıcı&quot;, &quot;siz&quot;) arasındaki
            ilişkiyi düzenler. KOQEP, davetiye ile katılınan, metin tabanlı,
            gerçek zamanlı bir sohbet hizmetidir ve ücretsiz olarak
            sunulmaktadır.
          </p>
          <p className="mt-2">
            Platform&apos;a kayıt olarak, bu Şartlar&apos;ı ve Gizlilik
            Politikası&apos;nı okuduğunuzu, anladığınızı ve kabul ettiğinizi
            beyan etmiş olursunuz.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 2. Tanımlar
          </h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>
              <strong>Platform</strong>: KOQEP hizmetinin tamamı (web
              arayüzü, sunucular, altyapı).
            </li>
            <li>
              <strong>Kullanıcı İçeriği</strong>: kullanıcıların Platform
              üzerinde oluşturduğu mesaj, oda adı, oda açıklaması ve benzeri
              her türlü içerik.
            </li>
            <li>
              <strong>Moderatör</strong>: Platform tarafından içerik
              denetimi ve kullanıcı yönetimi yetkisiyle görevlendirilmiş
              kullanıcı.
            </li>
            <li>
              <strong>Hesap</strong>: bir kullanıcının Platform&apos;a
              erişimini sağlayan, e-posta adresi ve şifre ile korunan kayıt.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 3. Hesap Oluşturma ve
            Kullanıcı Sorumlulukları
          </h2>
          <p>
            3.1. Platform&apos;u kullanabilmek için 18 yaşını doldurmuş
            olmanız gerekmektedir. Kayıt sırasında yaşınızla ilgili
            verdiğiniz beyan esas alınır.
          </p>
          <p className="mt-2">
            3.2. Hesap bilgilerinizin (özellikle şifrenizin) gizliliğini
            korumak sizin sorumluluğunuzdadır. Hesabınız üzerinden
            gerçekleştirilen tüm işlemlerden siz sorumlusunuz.
          </p>
          <p className="mt-2">
            3.3. Kayıt sırasında sağladığınız bilgilerin doğru olmasını
            sağlamakla yükümlüsünüz.
          </p>
          <p className="mt-2">
            3.4. Hesabınızı başka bir kişiye devredemez, satamaz veya
            paylaşamazsınız.
          </p>
          <p className="mt-2">
            3.5. Platform, davetiye esasıyla çalışır. Aldığınız davetiyeyi
            kullanma ve başkalarına davetiye çıkarma koşulları Platform
            içindeki kurallara tabidir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 4. Kullanıcı İçeriği
          </h2>
          <p>
            4.1. Platform&apos;a gönderdiğiniz her türlü içerikten yalnızca
            siz sorumlusunuz.
          </p>
          <p className="mt-2">
            4.2. İçeriğinizin mülkiyeti size aittir. Platform&apos;u
            kullanarak, bu içeriğin hizmetin sunulması amacıyla (diğer
            kullanıcılara gösterilmesi, sunucularda saklanması, iletilmesi)
            işlenmesine izin vermiş olursunuz. Bu izin, hesabınızı
            sildiğinizde veya içeriğinizi kaldırdığınızda sona erer;
            Gizlilik Politikası&apos;nda açıklanan saklama/silme kuralları
            saklıdır.
          </p>
          <p className="mt-2">
            4.3. Platform, gönderdiğiniz içeriği önceden denetlemez. Ancak
            bildirim üzerine veya kendi takdirine bağlı olarak inceleyebilir,
            kaldırabilir veya ilgili hesap hakkında işlem yapabilir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 5. Yasaklı Davranışlar
          </h2>
          <p>
            Platform&apos;u kullanırken aşağıdaki davranışlardan kaçınmanız
            gerekmektedir:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-neutral-600">
            <li>
              Yasa dışı, tehdit edici, taciz edici, aşağılayıcı veya nefret
              söylemi içeren içerik paylaşmak
            </li>
            <li>Başka bir kişinin kimliğine bürünmek veya yanıltıcı bilgi vermek</li>
            <li>
              Platform&apos;un teknik altyapısına zarar verecek, aşırı yük
              bindirecek, otomatik araçlarla (bot, scraper vb.) yetkisiz
              şekilde erişecek veya güvenlik açıklarından yararlanmaya
              çalışacak eylemlerde bulunmak
            </li>
            <li>Başka kullanıcıların kişisel verilerini izinsiz paylaşmak veya toplamak</li>
            <li>Platform&apos;u ticari amaçlarla, izinsiz reklam veya spam için kullanmak</li>
            <li>
              Küçüklerin (18 yaş altı) Platform&apos;a erişmesini sağlamak
              veya bu yönde teşvik etmek
            </li>
          </ul>
          <p className="mt-2">
            Bu davranışlar; içeriğin kaldırılması, hesabın geçici olarak
            kısıtlanması (susturma) veya hesabın kalıcı olarak kapatılması
            gibi sonuçlar doğurabilir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 6. Moderasyon ve İtiraz
          </h2>
          <p>
            6.1. Platform, kullanıcı bildirimleri ve moderatörlerin kendi
            değerlendirmesi doğrultusunda içerik kaldırabilir, kullanıcıları
            geçici olarak susturabilir veya hesapları kapatabilir. Bu
            kararlar, size iletilen bir gerekçe eşliğinde alınır.
          </p>
          <p className="mt-2">
            6.2. Bir moderasyon kararına itiraz etmek isterseniz,
            gerekçenizi{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>{" "}
            adresine yazarak başvurabilirsiniz; başvurunuz değerlendirilir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 7. Fikri Mülkiyet
          </h2>
          <p>
            7.1. &quot;KOQEP&quot; adı, logosu ve Platform&apos;un kendi
            tasarımı, yazılımı ve arayüzü Platform&apos;a aittir; bu
            Şartlar, size bunlar üzerinde hiçbir hak devretmez.
          </p>
          <p className="mt-2">
            7.2. Kullanıcı İçeriği üzerindeki haklarınız Madde 4&apos;te
            düzenlenmiştir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 8. Hesap Sonlandırma
          </h2>
          <p>
            8.1. Hesabınızı dilediğiniz zaman, hesap ayarlarınızdan kalıcı
            olarak silebilirsiniz.
          </p>
          <p className="mt-2">
            8.2. Bu Şartlar&apos;ı ihlal etmeniz durumunda Platform,
            hesabınızı önceden bildirimde bulunmaksızın kısıtlayabilir veya
            kapatabilir.
          </p>
          <p className="mt-2">
            8.3. Hesap silme işleminin veri üzerindeki etkileri Gizlilik
            Politikası&apos;nda açıklanmıştır.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 9. Hizmetin Değişmesi
            veya Sonlandırılması
          </h2>
          <p>
            Platform, hizmeti dilediği zaman değiştirme, geçici olarak
            askıya alma veya kalıcı olarak sonlandırma hakkını saklı tutar.
            Böyle bir durumda kullanıcılar makul ölçüde önceden
            bilgilendirilmeye çalışılır, ancak bu bir garanti teşkil etmez.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 10. Garanti Reddi ve
            Sorumluluğun Sınırlandırılması
          </h2>
          <p>
            10.1. Platform &quot;olduğu gibi&quot; ve &quot;mevcut
            haliyle&quot; sunulmaktadır. Platform&apos;un kesintisiz,
            hatasız veya güvenlik açığı içermeyen şekilde çalışacağına dair
            bir garanti verilmez.
          </p>
          <p className="mt-2">
            10.2. Platform, hizmeti sunma konusunda herhangi bir yükümlülük
            altına girmez; hizmeti dilediği zaman değiştirebilir,
            kısıtlayabilir veya sonlandırabilir (bkz. Madde 9).
            Platform&apos;u kullanarak, hizmeti olduğu haliyle kabul
            ettiğinizi ve Platform&apos;un kesintisiz, hatasız veya belirli
            bir sonucu garanti eden bir hizmet taahhüdünde bulunmadığını
            kabul edersiniz. Platform&apos;un kullanımından doğabilecek
            zararlara ilişkin sorumluluğu, kasıt ve ağır kusur halleri
            hariç olmak üzere, yasal olarak mümkün olan en geniş ölçüde
            sınırlıdır.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 11. Değişiklikler
          </h2>
          <p>
            Bu Şartlar&apos;da önemli bir değişiklik yaptığımızda,
            değişikliği Platform üzerinden duyururuz. Değişiklik sonrası
            Platform&apos;u kullanmaya devam etmeniz, güncellenmiş şartları
            kabul ettiğiniz anlamına gelir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 12. Bölünebilirlik
          </h2>
          <p>
            Bu Şartlar&apos;ın herhangi bir hükmünün geçersiz veya
            uygulanamaz sayılması, diğer hükümlerin geçerliliğini
            etkilemez.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 13. Tek Politika, İki Dil
          </h2>
          <p>
            Bu Kullanım Şartları ile Gizlilik Politikası, tek ve aynı
            politika metninin Türkçe ve İngilizce dillerindeki
            karşılıklarıdır — içerik olarak birbirinin aynısıdır, sadece
            dilleri farklıdır. Amaçlanan, farklı dillerde farklı
            haklar/yükümlülükler yaratmak değil, aynı metni her iki dilde de
            erişilebilir kılmaktır. Çeviriden kaynaklı bir anlam farkı fark
            ederseniz,{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>{" "}
            adresinden bize bildirebilirsiniz; bu durumda metin gözden
            geçirilir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-neutral-300">
            <span className="text-muted">##</span> 14. İletişim
          </h2>
          <p>
            Sorularınız, itirazlarınız ve talepleriniz için{" "}
            <a
              href={`mailto:${FEEDBACK_EMAIL}`}
              className="text-muted hover:text-neutral-400"
            >
              {FEEDBACK_EMAIL}
            </a>{" "}
            adresinden bize ulaşabilirsiniz.
          </p>
        </section>
      </div>

      <p className="mt-8 flex gap-4 text-xs">
        <Link href="/" className="text-muted hover:text-neutral-400">
          ana sayfaya dön
        </Link>
        <Link href="/terms/en" className="text-muted hover:text-neutral-400">
          Switch to English
        </Link>
      </p>
    </main>
  );
}

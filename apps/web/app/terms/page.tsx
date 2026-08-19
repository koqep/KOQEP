import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="animate-fade-in mx-auto max-w-2xl p-4 text-neutral-400">
      <h1 className="mb-6 text-neutral-400">
        <span className="text-muted">#</span> kullanım şartları
      </h1>

      <p className="mb-6 border border-neutral-800 bg-neutral-900/50 p-3 text-neutral-200">
        TASLAK — bağlayıcı değildir, gerçek hukuki metin henüz yayında değil.
      </p>

      <p className="mb-6 text-xs">
        Bu belgenin Türkçe ve İngilizce sürümleri arasında çelişki olması
        durumunda hangisinin bağlayıcı olacağı henüz hukuki incelemeden
        geçmedi.
      </p>

      <div className="flex flex-col gap-4">
        <p>
          Bu sayfa, KOQEP&apos;i kullanma koşullarını (hesap, davet sistemi,
          moderasyon, içerik sorumluluğu dahil) açıklayacak gerçek kullanım
          şartlarının yerini tutuyor. Metin, 5651/KVKK kapsamındaki hukuki
          kontrol tamamlandıktan sonra buraya yazılacak.
        </p>
        <p>
          Asgari yaş: [YAŞ SINIRI — hukuki incelemeyi bekliyor] (KVKK&apos;nın
          çocuk verisi hükümleri gereği).
        </p>
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

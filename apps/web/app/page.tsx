// NOT: "genel" burada ve apps/api/src/db/dev-seed.constants.ts'de ayrı ayrı hardcode
// (paylaşılan paket yok, bkz. docs/STATE.md Tuzaklar). WS görevinde gerçek veriye bağlanınca kalkar.
const ROOM_NAME = "genel";

export default function RoomPage() {
  return (
    <main className="animate-fade-in mx-auto flex h-dvh max-w-2xl flex-col p-4">
      <header className="border-b border-neutral-800 pb-2">
        <h1 className="text-neutral-400">
          <span className="text-neutral-600">#</span>
          {ROOM_NAME}
        </h1>
      </header>

      <section className="flex-1 overflow-y-auto py-4 text-neutral-500">
        <p>henüz mesaj yok</p>
      </section>

      <form className="flex items-center gap-2 border-t border-neutral-800 pt-2">
        <span className="text-neutral-600">&gt;</span>
        <input
          type="text"
          disabled
          placeholder="mesaj yaz..."
          className="flex-1 bg-transparent text-neutral-200 placeholder-neutral-600 outline-none disabled:cursor-not-allowed"
        />
        <span
          className="terminal-cursor inline-block h-4 w-2 bg-neutral-400"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled
          className="text-neutral-600 disabled:cursor-not-allowed"
        >
          gönder
        </button>
      </form>
    </main>
  );
}

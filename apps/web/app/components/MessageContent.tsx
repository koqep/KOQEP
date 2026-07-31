interface Segment {
  type: "text" | "code";
  value: string;
}

// Basit split - regex bile gerekmiyor. Çift indeksler (0,2,4...) düz
// metin, tek indeksler (1,3,5...) ``` ile ayrılmış kod. Bitmemiş bir blok
// (tek sayıda ```) doğal olarak çöküyor - kalan her şey kod sayılır, çoğu
// markdown parser'ının da yaptığı kabul edilebilir bir yedek davranış.
function parseSegments(content: string): Segment[] {
  return content
    .split("```")
    .map((value, index): Segment => {
      const isCode = index % 2 === 1;
      // ``` hemen ardından gelen tek bir newline geleneksel olarak
      // kırpılır (fenced-block temizliği) - içerideki biçimlendirme
      // dokunulmadan kalıyor.
      const trimmed = isCode
        ? value.replace(/^\n/, "").replace(/\n$/, "")
        : value;
      return { type: isCode ? "code" : "text", value: trimmed };
    })
    .filter((segment) => segment.value.length > 0);
}

export default function MessageContent({ content }: { content: string }) {
  return (
    <>
      {parseSegments(content).map((segment, index) =>
        segment.type === "code" ? (
          <pre
            key={index}
            className="my-1 overflow-x-auto rounded bg-neutral-900 px-2 py-1 font-mono text-neutral-300"
          >
            {segment.value}
          </pre>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
}

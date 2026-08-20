interface Segment {
  type: "text" | "code" | "link";
  value: string;
}

const URL_PATTERN = /https?:\/\/[^\s]+/g;
// Cümle sonuna gelen noktalama linke sızmasın diye ("bkz. https://a.com."
// örneğindeki son nokta cümleye ait, URL'e değil) - href'te kalan karakter
// kümesi kasıtlı dar tutuldu.
const TRAILING_PUNCTUATION = /[.,!?;:)\]}'"]+$/;

// Sadece "text" segment'lerine uygulanıyor - "code" segment'lerine hiç
// dokunulmuyor, kod bloğu içindeki bir URL link'e dönüşmez.
function splitLinks(value: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const rawUrl = match[0];
    const trailing = rawUrl.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
    if (!url) continue;
    if (start > lastIndex) {
      segments.push({ type: "text", value: value.slice(lastIndex, start) });
    }
    segments.push({ type: "link", value: url });
    lastIndex = start + url.length;
    if (trailing) {
      segments.push({ type: "text", value: trailing });
      lastIndex += trailing.length;
    }
  }
  if (lastIndex < value.length) {
    segments.push({ type: "text", value: value.slice(lastIndex) });
  }
  return segments;
}

// Basit split - regex bile gerekmiyor. Çift indeksler (0,2,4...) düz
// metin, tek indeksler (1,3,5...) ``` ile ayrılmış kod. Bitmemiş bir blok
// (tek sayıda ```) doğal olarak çöküyor - kalan her şey kod sayılır, çoğu
// markdown parser'ının da yaptığı kabul edilebilir bir yedek davranış.
function parseSegments(content: string): Segment[] {
  return content.split("```").flatMap((value, index): Segment[] => {
    const isCode = index % 2 === 1;
    if (isCode) {
      // ``` hemen ardından gelen tek bir newline geleneksel olarak
      // kırpılır (fenced-block temizliği) - içerideki biçimlendirme
      // dokunulmadan kalıyor.
      const trimmed = value.replace(/^\n/, "").replace(/\n$/, "");
      return trimmed.length > 0 ? [{ type: "code", value: trimmed }] : [];
    }
    return splitLinks(value);
  });
}

// Güvenlik notu (M7b Slice E): "link" segment'leri href={value}/{value}
// olarak DÜZ JSX ile render ediliyor, dangerouslySetInnerHTML DEĞİL - React
// bu string'i her zaman kaçışlı metin/DOM-özniteliği olarak işler, HTML
// olarak parse ETMEZ. Bağımsız bir ikinci katman da var: href'e giden value
// zaten yukarıdaki /https?:\/\// regex'inden geçmiş olmak ZORUNDA -
// javascript:/data: gibi bir şema regex'e hiç uymadığı için "link" segment'i
// olarak sınıflandırılamaz bile. Biri ileride bu bileşeni
// dangerouslySetInnerHTML kullanacak şekilde değiştirirse bu XSS
// güvenliğini kırar - bu bir REGRESYON'dur.
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
        ) : segment.type === "link" ? (
          <a
            key={index}
            href={segment.value}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-neutral-600 hover:decoration-neutral-300"
          >
            {segment.value}
          </a>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </>
  );
}

"use client";

import { generateLargeAvatarGrid, generateSmallAvatarGrid } from "../../lib/avatar";

// M10 Faz 2 Slice D+E revizyonu: unicode karakter (░▒▓█) yerine gerçek SVG
// kareler - GitHub identicon'unun görsel netliğine benzer, ama MONOKROM
// (currentColor + opaklık, renk YOK). Hash/ızgara mantığı lib/avatar.ts'te
// DEĞİŞMEDEN kalıyor, bu dosya SADECE render.
//
// 0.25/0.5/0.75/1.0 DEĞİL - neutral-950 zemine karşı 12px küçük-avatar
// hücrelerinde 0.25 zar zor görünür kalırdı (WCAG ~1.85:1 kontrast).
const OPACITY_BY_SHADE = [0.28, 0.52, 0.76, 1.0];

interface LargeAvatarProps {
  seed: string;
  className?: string;
}

// Profil paneli - 5x5, hücre-başı 1 birim viewBox, width/height MUTLAKA
// açık set edilmeli (yoksa SVG'nin varsayılan intrinsic boyutu 300x150 CSS
// px'e düşer). shapeRendering="crispEdges" bitişik hücreler arası anti-
// aliasing kaynaklı ince "dikiş" çizgisini öldürüyor.
export function LargeAvatar({ seed, className }: LargeAvatarProps) {
  const grid = generateLargeAvatarGrid(seed);
  return (
    <svg
      aria-hidden="true"
      width={100}
      height={100}
      viewBox="0 0 5 5"
      shapeRendering="crispEdges"
      className={className}
    >
      {grid.map((row, r) =>
        row.map((shade, c) => (
          <rect
            key={`${r}-${c}`}
            x={c}
            y={r}
            width={1}
            height={1}
            fill="currentColor"
            fillOpacity={OPACITY_BY_SHADE[shade]}
          />
        )),
      )}
    </svg>
  );
}

interface SmallAvatarProps {
  seed: string | null;
  className?: string;
}

// Mesaj listesi + hesap menüsü - 1x6 (aynalanmamış). seed null ise (SADECE
// AccountMenu'nün myProfile-yüklenmeden-önceki penceresi) 6 tam-şeffaf rect
// render ediyor - HİÇ SVG render etmemek (width 0) "account" butonunun sol
// kenarını myProfile yüklenince kaydırırdı, bu yüzden AYNI width/height
// korunuyor.
export function SmallAvatar({ seed, className }: SmallAvatarProps) {
  const cells = generateSmallAvatarGrid(seed);
  return (
    <svg
      aria-hidden="true"
      width={72}
      height={12}
      viewBox="0 0 6 1"
      shapeRendering="crispEdges"
      className={className}
    >
      {(cells ?? new Array(6).fill(0)).map((shade: number, i) => (
        <rect
          key={i}
          x={i}
          y={0}
          width={1}
          height={1}
          fill="currentColor"
          fillOpacity={cells ? OPACITY_BY_SHADE[shade] : 0}
        />
      ))}
    </svg>
  );
}

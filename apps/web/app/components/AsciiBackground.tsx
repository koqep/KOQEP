"use client";

import { useEffect, useRef } from "react";

// M11b Slice A: landing sayfasının arka planı - sinüs dalgalarından türeyen,
// yavaşça değişen bir ASCII yoğunluk deseni. Tasarımdan verilen formül
// AYNEN: v = sin(x*0.16 + k*1.7) + sin(y*0.21 - k*1.2) + sin((x+y)*0.09 + k*2.3),
// k = frame * 0.0016 (çok yavaş ilerleme). v kabaca [-3,3] aralığına düşer,
// hem karakter rampasına hem opaklığa eşleniyor.
//
// Gerçek Playwright ekran görüntüsüyle bulundu: orijinal rampa (" .·:-=+*#%@",
// 11 karakterin sadece 1'i boşluk) + 0.05-0.21 opaklık, TEK TEK hücreler
// soluk olsa da 15px'lik bir gridde ~%91 hücre dolu olduğu için TOPLAMDA
// "çok soluk, dikkat dağıtmayan" hedefinin tam tersi, yoğun/belirgin bir
// doku üretiyordu (kullanıcı onayladı, azaltıldı). Formül DEĞİŞMEDİ - sadece
// rampanın boşluk oranı ve opaklık tavanı düşürüldü.
const CHAR_RAMP = "          .·:-=+*#%@";
const CELL_SIZE = 15;
const FONT_SIZE = 12;
const REDRAW_EVERY_N_FRAMES = 5;
const K_STEP = 0.0016;
const MIN_OPACITY = 0.03;
const MAX_OPACITY = 0.1;
// v'nin üç sinüs toplamının teorik aralığı [-3,3] - rampa/opaklık eşlemesi
// bu aralığı [0,1]'e normalize ediyor.
const V_RANGE = 3;

interface Props {
  className?: string;
}

export default function AsciiBackground({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // CLAUDE.md'nin "dikkat dağıtmayan" felsefesiyle tutarlı - hareket
    // azaltma tercihi olan bir ziyaretçi için döngü hiç başlamıyor.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let columns = 0;
    let rows = 0;

    // Canvas'ın ÇİZİM TAMPONU (width/height attribute'ları) CSS boyutundan
    // (className ile verilen w-full h-full) BAĞIMSIZ - bir ResizeObserver
    // olmadan pattern ya bulanıklaşır (tampon küçük, CSS büyük) ya kırpılır
    // (tersi). Grid sütun/satır sayısı da resize'da yeniden hesaplanmalı.
    function syncCanvasSize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(rect.width / CELL_SIZE);
      rows = Math.ceil(rect.height / CELL_SIZE);
    }

    syncCanvasSize();
    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(canvas);

    let frame = 0;
    let rafId: number;

    function draw() {
      if (!ctx || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.font = `${FONT_SIZE}px monospace`;
      ctx.textBaseline = "top";

      const k = frame * K_STEP;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          const v =
            Math.sin(col * 0.16 + k * 1.7) +
            Math.sin(row * 0.21 - k * 1.2) +
            Math.sin((col + row) * 0.09 + k * 2.3);
          const normalized = (v + V_RANGE) / (V_RANGE * 2); // [0,1]
          const rampIndex = Math.min(
            CHAR_RAMP.length - 1,
            Math.floor(normalized * CHAR_RAMP.length),
          );
          const char = CHAR_RAMP[rampIndex];
          if (char === " ") continue;
          const opacity = MIN_OPACITY + normalized * (MAX_OPACITY - MIN_OPACITY);
          ctx.fillStyle = `rgba(230, 230, 230, ${opacity})`;
          ctx.fillText(char, col * CELL_SIZE, row * CELL_SIZE);
        }
      }
    }

    function loop() {
      frame += 1;
      if (frame % REDRAW_EVERY_N_FRAMES === 0) {
        draw();
      }
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
    />
  );
}

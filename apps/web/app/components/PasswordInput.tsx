"use client";

import {
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { inputClassName } from "./formStyles";

interface Props
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "className" | "id"
  > {
  label: string;
}

// Avatar.tsx'in konvansiyonlarını izliyor (aria-hidden, açık width/height,
// currentColor) ama piksel-ızgara DEĞİL - bir göz gerçek şekilde tanınabilir
// olmalı, Avatar'ın hash-türetilmiş soyut deseni burada uygun değil.
function EyeIcon({ slashed }: { slashed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 8S3.5 3 8 3s7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
      <circle cx={8} cy={8} r={2} />
      {slashed && <line x1={2} y1={2} x2={14} y2={14} />}
    </svg>
  );
}

// M11a devamı: eski "show"/"hide" metin-toggle butonu yerine göz ikonu +
// BASILI-TUTMA (momentary) - bırakınca otomatik gizlenir. Üç girdi modu
// için simetrik down/up: mouse, touch, fiziksel klavye (Space/Enter).
//
// Ekran-okuyucu boşluğu: NVDA/JAWS/VoiceOver/TalkBack'in "etkinleştir"
// hareketi çoğu zaman gerçek bir down/up ÜRETMEDEN doğrudan bir `click`
// event'i gönderir - hiçbir down/up handler'ı bunu yakalamaz, buton
// SESSİZCE hiçbir şey yapmaz. hasTrackedPressRef, bu turda GERÇEK bir
// down (mouse/touch/klavye) izlenip izlenmediğini kaydediyor; onClick
// SADECE bayrak false'İKEN (yani hiçbir down/up izlenmediyse, yani bu bir
// AT sentetik click'i) toggle'lıyor - fare/dokunma/klavye kullanıcıları
// momentary davranışı alır, ekran-okuyucu kullanıcıları toggle'a "zarif
// biçimde" düşer (sessiz başarısızlık değil).
export default function PasswordInput({ label, ...inputProps }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const id = useId();
  const hasTrackedPressRef = useRef(false);

  function show() {
    hasTrackedPressRef.current = true;
    setIsVisible(true);
  }

  // mouseup'tan SONRA senkron bir native `click` event'i gelir - bayrak
  // BİLEREK burada temizlenmiyor, onClick'in "bu gerçek bir fare
  // tıklaması" diye ayırt edebilmesi için click'e kadar true kalmalı.
  function hide() {
    setIsVisible(false);
  }

  // mouseleave/touchcancel/blur'dan SONRA hiçbir click event'i GELMEZ
  // (mouseup/touchend element üzerinde tamamlanmadı) - bayrağı burada BİZ
  // temizlemeliyiz, aksi halde bir sonraki GERÇEK AT sentetik click'i
  // yanlışlıkla "zaten ele alındı" sanılıp toggle'lanmaz.
  function hideAndResetFlag() {
    setIsVisible(false);
    hasTrackedPressRef.current = false;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    // Space'in sayfa kaydırma varsayılanını VE Enter/Space'in native click
    // aktivasyonunu bastır - ikisi de override ediliyor, momentary model.
    event.preventDefault();
    show();
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return;
    // Enter native click'i KEYDOWN'da, Space KEYUP'ta tetikler - tek
    // taraflı preventDefault çift-tetiklemeyi TAM engellemez, ikisinde de
    // gerekli. preventDefault native click'i TAMAMEN bastırıyor - onClick
    // hiç tetiklenmeyecek, bayrağı burada BİZ temizlemeliyiz (mouseleave
    // ile aynı gerekçe).
    event.preventDefault();
    hideAndResetFlag();
  }

  function handleClick() {
    if (hasTrackedPressRef.current) {
      hasTrackedPressRef.current = false;
      return;
    }
    setIsVisible((prev) => !prev);
  }

  return (
    <div className="flex flex-col gap-1 text-muted">
      <label htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          {...inputProps}
          id={id}
          type={isVisible ? "text" : "password"}
          className={inputClassName}
        />
        <button
          type="button"
          // "password" kelimesi BİLEREK YOK - "show password"/"hide
          // password" aria-label'ı getByLabel("password") sorgularıyla
          // (bu test süitinde HER YERDE kullanılıyor) substring çakışırdı,
          // strict-mode ihlaline yol açardı (gerçek bir Playwright
          // koşumuyla bulundu) - eski metin-buton da AYNI nedenle sadece
          // "show"/"hide" diyordu.
          aria-label={isVisible ? "hide" : "show"}
          aria-pressed={isVisible}
          title={isVisible ? "hide password" : "show password"}
          onMouseDown={show}
          onMouseUp={hide}
          onMouseLeave={hideAndResetFlag}
          onTouchStart={(event) => {
            // Mobil tarayıcının uzun-basma bağlam menüsünü/metin-seçim
            // callout'unu bastırır, aksi halde touchend hiç gelmeyebilir -
            // ayrıca ~300ms sonraki "hayalet" mouse/click event'lerini de
            // bastırır (touchend'in bayrağı BİZ temizleyebilmemizin nedeni).
            event.preventDefault();
            show();
          }}
          onTouchEnd={hideAndResetFlag}
          onTouchCancel={hideAndResetFlag}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={hideAndResetFlag}
          onClick={handleClick}
          className="shrink-0 p-1 text-muted hover:text-neutral-400"
        >
          <EyeIcon slashed={!isVisible} />
        </button>
      </div>
    </div>
  );
}

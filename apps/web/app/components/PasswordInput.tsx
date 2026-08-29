"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { inputClassName } from "./formStyles";

interface Props
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "className" | "id"
  > {
  label: string;
}

// M11a Slice C: `label` metni ve show/hide butonu AYNI <label>'ın İÇİNDE
// DEĞİL - explicit htmlFor/id kullanılıyor, çünkü implicit label-wraps-input
// deseninde (kod tabanının geri kalanının kullandığı) butonun görünür metni
// ("show"/"hide") label'ın erişilebilir adına karışıp getByLabel("password")
// sorgularını kırardı.
export default function PasswordInput({ label, ...inputProps }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const id = useId();

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
          onClick={() => setIsVisible((prev) => !prev)}
          className="shrink-0 text-muted hover:text-neutral-400"
        >
          {isVisible ? "hide" : "show"}
        </button>
      </div>
    </div>
  );
}

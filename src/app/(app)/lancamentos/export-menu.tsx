"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/i18n/context";
import { getActivityDict } from "@/lib/i18n/dictionaries/activity";

/**
 * CSV leva os filtros ativos da tela (mês ou período, categoria,
 * tipo, busca...) — o que está na lista é o que sai no arquivo.
 */
export function ExportMenu() {
  const locale = useLocale();
  const dict = getActivityDict(locale);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const params = useSearchParams();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const dataParams = new URLSearchParams(params.toString());
  const csvHref = `/api/exportar/lancamentos?${dataParams.toString()}${dataParams.toString() ? "&" : ""}format=csv`;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 min-w-11 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[var(--radius-button)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[0.8125rem] font-medium hover:bg-[var(--surface-2)]"
      >
        <Download className="size-3.5" />
        {dict["Exportar"]}
        <ChevronDown className="size-3.5" />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-20 mt-2 w-64 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-overlay)]">
          <a
            href={csvHref}
            className="flex items-center gap-2.5 rounded-[var(--radius-xs)] px-2.5 py-2 text-[0.8125rem] hover:bg-[var(--surface-2)]"
            onClick={() => setOpen(false)}
          >
            <FileText className="muted size-4" />
            <span>
              {dict["CSV"]}
              <span className="muted block text-xs">{dict["Lançamentos filtrados"]}</span>
            </span>
          </a>
        </div>
      ) : null}
    </div>
  );
}

import { Copy, ImageDown } from "lucide-react";
import { useMemo, useState } from "react";
import { buildWrapped } from "../domain/playLog";
import { wrappedPlain, wrappedText } from "../domain/wrappedText";
import { copyText } from "../platform/clipboard";
import { renderWrapped, savePng } from "../platform/wrappedImage";
import { useLibrary } from "../state/library";
import { usePlayLog } from "../state/playLog";
import { useUi } from "../state/ui";

const DAY_MS = 86_400_000;

/** "Seu ano": hours the app watched grow, plus whole-library facts. Shareable as text or a PNG card. */
export function WrappedPanel() {
  const games = useLibrary((s) => s.games);
  const log = usePlayLog((s) => s.log);
  const toast = useUi((s) => s.toast);
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => [...new Set([thisYear, ...log.map((e) => new Date(e.d * DAY_MS).getUTCFullYear())])].sort((a, b) => b - a), [log, thisYear]);
  const [year, setYear] = useState(thisYear);
  const text = useMemo(() => wrappedText(buildWrapped(log, games, year)), [log, games, year]);

  const copy = async () => toast((await copyText(wrappedPlain(text))) ? "Resumo copiado" : "Não foi possível copiar");
  const image = async () => {
    try {
      const blob = await renderWrapped(text, year);
      if (!blob) return toast("Não foi possível gerar a imagem");
      if (await savePng(`games-gallery-${year}.png`, blob)) toast("Imagem salva");
    } catch (e) {
      toast(`Falha ao salvar a imagem: ${String(e)}`);
    }
  };

  return (
    <section className="panel" aria-label="Seu ano em jogos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 aria-level={2}>Seu ano em jogos</h3>
        <label className="inline-flex items-center gap-2 text-[13px] text-fog">
          Ano
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-3 pr-2 text-mist">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <p className="font-display text-2xl font-bold">{text.headline}</p>
      <ul className="plain">{text.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
      {text.top.length > 0 && (
        <>
          <h4 aria-level={3}>Mais jogados</h4>
          <ol className="plain ranked">{text.top.map((t) => <li key={t}>{t.replace(/^\d+\.\s/, "")}</li>)}</ol>
        </>
      )}
      <ul className="plain muted small">{text.library.map((l) => <li key={l}>{l}</li>)}</ul>
      <p className="muted small">As horas vêm do aumento do total a cada sincronização das lojas (elas informam o total, não as sessões), a partir de quando o app começou a registrar.</p>
      <div className="actions">
        <button className="btn" onClick={() => void copy()}><Copy size={14} aria-hidden /> Copiar texto</button>
        <button className="btn" onClick={() => void image()}><ImageDown size={14} aria-hidden /> Salvar imagem</button>
      </div>
    </section>
  );
}

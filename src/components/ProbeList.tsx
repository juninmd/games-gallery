import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { PROBE_LABEL, type ProbeId, type ProbeResult, runProbe } from "../platform/probes";
import { useSecrets } from "../state/secrets";

const IDS = Object.keys(PROBE_LABEL) as ProbeId[];

/** Runtime smoke test of every remote source, using the credentials saved in this profile. */
export function ProbeList() {
  const { steamId, steamKey, rawgKey } = useSecrets();
  const [results, setResults] = useState<Partial<Record<ProbeId, ProbeResult>>>({});
  const [running, setRunning] = useState<Partial<Record<ProbeId, boolean>>>({});

  const test = async (id: ProbeId) => {
    setRunning((r) => ({ ...r, [id]: true }));
    const result = await runProbe(id, { steamId, steamKey, rawgKey });
    setResults((r) => ({ ...r, [id]: result }));
    setRunning((r) => ({ ...r, [id]: false }));
  };

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Testar conexões</h3>
      <p className="muted small">Cada teste faz uma leitura rápida e só de consulta, com as credenciais salvas neste perfil.</p>
      <ul className="plain sources" aria-live="polite">
        {IDS.map((id) => {
          const r = results[id];
          return (
            <li key={id}>
              <strong>{PROBE_LABEL[id]}</strong>{" "}
              {r && (r.ok
                ? <span className="tag ok"><CheckCircle2 size={12} aria-hidden /> OK</span>
                : <span className="tag warn"><XCircle size={12} aria-hidden /> Falhou</span>)}
              <div className="muted small">{r?.detail ?? "Ainda não testado"}</div>
              <button className="btn ghost" disabled={running[id]} onClick={() => void test(id)}>
                <Activity size={13} aria-hidden /> {running[id] ? "Testando…" : "Testar"}
              </button>
            </li>
          );
        })}
      </ul>
      <button className="btn" disabled={Object.values(running).some(Boolean)} onClick={() => void Promise.all(IDS.map(test))}>Testar todas</button>
    </section>
  );
}

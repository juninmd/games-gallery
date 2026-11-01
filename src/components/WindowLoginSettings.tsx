import { LogIn } from "lucide-react";
import type { WindowLoginStore } from "../platform/native";
import { nativeAvailable } from "../platform/native";
import { useLibrary } from "../state/library";
import { useTasks } from "../state/tasks";

const STORES: { id: WindowLoginStore; name: string; note: string }[] = [
  { id: "battlenet", name: "Battle.net", note: "Lê account.battle.net/api/games-and-subs com a sessão da janela de login." },
  { id: "ea", name: "EA app", note: "Lê os jogos que a conta tem no catálogo da EA (inclui os da Steam e da Epic ligados à conta EA)." },
  { id: "ubisoft", name: "Ubisoft Connect", note: "Usa o ticket que a própria página da Ubisoft envia ao ubiservices. Ainda não validado com conta real." },
];

/**
 * Battle.net and the EA app keep the purchased library on their servers. The login happens in a
 * separate native window that has no access to this app; the session is used once, in memory, and
 * the window is closed. Nothing is stored.
 */
export function WindowLoginSettings() {
  const sync = useLibrary((s) => s.syncWindowLogin);
  const busy = useTasks((s) => s.tasks);
  const native = nativeAvailable();

  return (
    <section className="panel narrow">
      <h3 aria-level={2}>Battle.net, EA app e Ubisoft: biblioteca da conta</h3>
      <p className="muted small">
        Os instalados já vêm dos launchers. Para listar também os comprados, entre na sua conta na janela que abrir.
        A janela é isolada do app, não guarda a sessão depois de fechar e o app não vê a sua senha.
        Se a loja pedir código de verificação, ele é digitado nessa janela.
      </p>
      {!native && <p className="warn-text small">Disponível só no app instalado.</p>}
      <ul className="plain sources">
        {STORES.map((s) => {
          const running = !!busy[`sync:${s.id}-account`];
          return (
            <li key={s.id}>
              <strong>{s.name}</strong>
              <div className="muted small">{s.note}</div>
              <button className="btn primary" disabled={!native || running} onClick={() => void sync(s.id)}>
                <LogIn size={14} aria-hidden /> {running ? "Aguardando o login…" : `Entrar na ${s.name}`}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

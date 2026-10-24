
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

type SessionRow = {
  id: string;
  session_date: string;
  app_name: string;
  club_name: string;
  starting_balance: number;
  ending_balance: number;
  profit_loss: number;
  rake: number;
  notes: string | null;
};

type ClubRow = {
  id: string;
  app_name: string;
  name: string;
};

type PlayerRow = {
  id: string;
  display_name: string;
  role: string;
  created_at: string;
};

export default function Home() {
  const [supabase] = useState(() => createClient());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);

  const [rows, setRows] = useState<SessionRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [profileRole, setProfileRole] = useState("");
  const [message, setMessage] = useState("");
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  const [playerName, setPlayerName] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");

  const [date, setDate] = useState("2026-10-23");
  const [app, setApp] = useState("X-Poker");
  const [club, setClub] = useState("");

  const [start, setStart] = useState("1000");
  const [end, setEnd] = useState("1250");
  const [rake, setRake] = useState("85");
  const [notes, setNotes] = useState("");

  const availableClubs = clubs.filter(
    (item) => item.app_name === app
  );

  async function loadPlayers() {
    setLoadingPlayers(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setPlayers([]);
        return;
      }

      const response = await fetch("/api/players", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível carregar jogadores.");
      }

      setPlayers(result.players ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro ao carregar jogadores."
      );
    } finally {
      setLoadingPlayers(false);
    }
  }

  async function refresh() {
    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth.user) {
      setUser(null);
      setRows([]);
      setClubs([]);
      setPlayers([]);
      setProfileRole("");
      setClub("");
      return;
    }

    setUser(auth.user);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("team_id, role")
      .eq("id", auth.user.id)
      .single();

    if (profileError || !profile?.team_id) {
      setMessage(
        "Sua conta ainda não está vinculada a uma equipe. Verifique seu perfil no Supabase."
      );
      setRows([]);
      setClubs([]);
      setPlayers([]);
      return;
    }

    setProfileRole(profile.role ?? "");

    const { data: clubData, error: clubError } = await supabase
      .from("clubs")
      .select("id, app_name, name")
      .eq("team_id", profile.team_id)
      .eq("active", true)
      .order("name", { ascending: true });

    if (clubError) {
      setMessage("Erro ao carregar clubes: " + clubError.message);
    } else {
      setClubs((clubData ?? []) as ClubRow[]);
    }

    const { data, error } = await supabase
      .from("daily_sessions")
      .select(
        "id,session_date,app_name,club_name,starting_balance,ending_balance,profit_loss,rake,notes"
      )
      .order("session_date", { ascending: false });

    if (error) {
      setMessage("Erro ao carregar lançamentos: " + error.message);
    } else {
      setRows((data ?? []) as SessionRow[]);
    }

    if (profile.role === "owner") {
      await loadPlayers();
    } else {
      setPlayers([]);
    }
  }

  useEffect(() => {
    refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const firstClub = availableClubs[0];

    if (
      !firstClub ||
      !availableClubs.some((item) => item.name === club)
    ) {
      setClub(firstClub?.name ?? "");
    }
  }, [app, clubs]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Login realizado.");
      await refresh();
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setMessage(
      error
        ? error.message
        : "Conta criada. Se a confirmação de e-mail estiver ativa, confirme o e-mail antes de entrar."
    );
  }

  async function invitePlayer(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!playerName.trim() || !playerEmail.trim()) {
      setMessage("Informe o nome e o e-mail do jogador.");
      return;
    }

    setSendingInvite(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const response = await fetch("/api/players/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: playerName.trim(),
          email: playerEmail.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível enviar o convite.");
      }

      setMessage(result.message ?? "Convite enviado com sucesso.");
      setPlayerName("");
      setPlayerEmail("");
      await loadPlayers();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao enviar convite."
      );
    } finally {
      setSendingInvite(false);
    }
  }

  async function saveSession(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      setMessage("Entre novamente para salvar o lançamento.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, team_id")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile?.team_id) {
      setMessage(
        "Sua conta ainda não está vinculada a uma equipe. O administrador precisa configurar seu perfil no Supabase."
      );
      return;
    }

    if (!club || !availableClubs.some((item) => item.name === club)) {
      setMessage("Selecione um clube válido para o aplicativo escolhido.");
      return;
    }

    const { error } = await supabase.from("daily_sessions").insert({
      team_id: profile.team_id,
      player_id: profile.id,
      session_date: date,
      app_name: app,
      club_name: club,
      starting_balance: Number(start),
      ending_balance: Number(end),
      rake: Number(rake),
      notes: notes || null,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Lançamento salvo no banco de dados.");
      await refresh();
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setRows([]);
    setClubs([]);
    setPlayers([]);
    setProfileRole("");
    setClub("");
    setMessage("Você saiu da conta.");
  }

  const money = (n: number) =>
    Number(n).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const totalPL = rows.reduce(
    (sum, row) => sum + Number(row.profit_loss),
    0
  );

  const totalRake = rows.reduce(
    (sum, row) => sum + Number(row.rake),
    0
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">GESTÃO DE POKER</div>
          <h1>Omaha Team Manager</h1>
        </div>
        <span className="pill">MVP</span>
      </header>

      {!user ? (
        <section className="panel auth">
          <h2>Acessar sua conta</h2>
          <p className="muted">
            Entre com seu e-mail ou crie uma conta de teste.
          </p>

          <form onSubmit={signIn} className="form">
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="voce@exemplo.com"
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo de 6 caracteres"
              />
            </label>

            <div className="actions">
              <button type="submit">Entrar</button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  signUp({ preventDefault: () => {} } as React.FormEvent)
                }
              >
                Criar conta
              </button>
            </div>
          </form>

          <p className="hint">
            A autenticação só funciona depois de configurar o projeto Supabase.
          </p>
        </section>
      ) : (
        <>
          <section className="welcome">
            <div>
              <span className="muted">Conectado como</span>
              <strong>{user.email}</strong>
            </div>
            <button className="secondary" onClick={signOut}>
              Sair
            </button>
          </section>

          {profileRole === "owner" && (
            <section className="panel">
              <h2>Gestão de jogadores</h2>
              <p className="muted">
                Convide jogadores para sua equipe. Eles receberão um e-mail
                para concluir o acesso.
              </p>

              <form onSubmit={invitePlayer} className="form">
                <label>
                  Nome do jogador
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    required
                    placeholder="Nome completo"
                  />
                </label>

                <label>
                  E-mail do jogador
                  <input
                    type="email"
                    value={playerEmail}
                    onChange={(e) => setPlayerEmail(e.target.value)}
                    required
                    placeholder="jogador@exemplo.com"
                  />
                </label>

                <button type="submit" disabled={sendingInvite}>
                  {sendingInvite ? "Enviando convite..." : "Convidar jogador"}
                </button>
              </form>

              <div className="playerList">
                <h3>Jogadores da equipe</h3>

                {loadingPlayers ? (
                  <p className="muted">Carregando jogadores...</p>
                ) : players.length === 0 ? (
                  <p className="muted">
                    Nenhum perfil encontrado para esta equipe.
                  </p>
                ) : (
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Função</th>
                          <th>Cadastro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {players.map((player) => (
                          <tr key={player.id}>
                            <td>{player.display_name}</td>
                            <td>
                              {player.role === "owner"
                                ? "Proprietário"
                                : player.role === "manager"
                                ? "Gerente"
                                : "Jogador"}
                            </td>
                            <td>
                              {new Date(player.created_at).toLocaleDateString(
                                "pt-BR"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="metrics">
            <div className="metric">
              <span>Resultado acumulado</span>
              <strong>{money(totalPL)}</strong>
            </div>
            <div className="metric">
              <span>Rake registrado</span>
              <strong>{money(totalRake)}</strong>
            </div>
            <div className="metric">
              <span>Lançamentos</span>
              <strong>{rows.length}</strong>
            </div>
          </section>

          <section className="panel">
            <h2>Novo fechamento diário</h2>
            <p className="muted">
              Um lançamento por clube e aplicativo.
            </p>

            <form onSubmit={saveSession} className="form">
              <div className="grid">
                <label>
                  Data
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </label>

                <label>
                  Aplicativo
                  <select
                    value={app}
                    onChange={(e) => setApp(e.target.value)}
                  >
                    <option value="X-Poker">X-Poker</option>
                    <option value="PPPoker">PPPoker</option>
                  </select>
                </label>
              </div>

              <label>
                Clube
                <select
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  required
                  disabled={availableClubs.length === 0}
                >
                  {availableClubs.length === 0 ? (
                    <option value="">
                      Nenhum clube cadastrado para {app}
                    </option>
                  ) : (
                    availableClubs.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <div className="grid">
                <label>
                  Saldo inicial (R$)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </label>

                <label>
                  Saldo final (R$)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    required
                  />
                </label>
              </div>

              <label>
                Rake do período (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rake}
                  onChange={(e) => setRake(e.target.value)}
                  required
                />
              </label>

              <label>
                Observações (opcional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </label>

              <div className="preview">
                <span>Resultado calculado</span>
                <strong>{money(Number(end) - Number(start))}</strong>
              </div>

              <button type="submit" disabled={!club}>
                Salvar lançamento
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Histórico de lançamentos</h2>

            {rows.length === 0 ? (
              <p className="muted">Nenhum lançamento salvo ainda.</p>
            ) : (
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>App / Clube</th>
                      <th>Saldo inicial</th>
                      <th>Saldo final</th>
                      <th>Up/Down</th>
                      <th>Rake</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.session_date}</td>
                        <td>
                          {row.app_name}
                          <small>{row.club_name}</small>
                        </td>
                        <td>{money(row.starting_balance)}</td>
                        <td>{money(row.ending_balance)}</td>
                        <td
                          className={
                            row.profit_loss >= 0 ? "positive" : "negative"
                          }
                        >
                          {money(row.profit_loss)}
                        </td>
                        <td>{money(row.rake)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {message && <div className="toast">{message}</div>}

      <footer>
        Dados financeiros devem ser conferidos com os registros oficiais dos
        clubes. Não compartilhe senhas de aplicativos de poker.
      </footer>
    </main>
  );
}


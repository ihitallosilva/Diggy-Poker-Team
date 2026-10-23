"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("2026-10-23");
  const [app, setApp] = useState("X-Poker");
  const [club, setClub] = useState("Clube A");
  const [start, setStart] = useState("1000");
  const [end, setEnd] = useState("1250");
  const [rake, setRake] = useState("85");
  const [notes, setNotes] = useState("");

  async function refresh() {
    const { data: auth } = await supabase.auth.getUser();
    setUser(auth.user ?? null);
    if (!auth.user) { setRows([]); return; }
    const { data, error } = await supabase
      .from("daily_sessions")
      .select("id,session_date,app_name,club_name,starting_balance,ending_balance,profit_loss,rake,notes")
      .order("session_date", { ascending: false });
    if (error) setMessage(error.message);
    else setRows((data ?? []) as SessionRow[]);
  }

  useEffect(() => {
    refresh();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { refresh(); });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Login realizado.");
    if (!error) await refresh();
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault(); setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Conta criada. Se a confirmação de e-mail estiver ativa, confirme o e-mail antes de entrar.");
  }

  async function saveSession(e: React.FormEvent) {
    e.preventDefault(); setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setMessage("Entre novamente para salvar o lançamento."); return; }
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("id,team_id").eq("id", authData.user.id).single();
    if (profileError || !profile?.team_id) {
      setMessage("Sua conta ainda não está vinculada a uma equipe. O administrador precisa configurar seu perfil no Supabase.");
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
    if (error) setMessage(error.message);
    else { setMessage("Lançamento salvo no banco de dados."); await refresh(); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setRows([]); setMessage("Você saiu da conta.");
  }

  const money = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const totalPL = rows.reduce((sum, r) => sum + Number(r.profit_loss), 0);
  const totalRake = rows.reduce((sum, r) => sum + Number(r.rake), 0);

  return <main className="shell">
    <header className="topbar"><div><div className="eyebrow">GESTÃO DE POKER</div><h1>Omaha Team Manager</h1></div><span className="pill">MVP</span></header>
    {!user ? <section className="panel auth">
      <h2>Acessar sua conta</h2><p className="muted">Entre com seu e-mail ou crie uma conta de teste.</p>
      <form onSubmit={signIn} className="form">
        <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="voce@exemplo.com"/></label>
        <label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="Mínimo de 6 caracteres"/></label>
        <div className="actions"><button type="submit">Entrar</button><button type="button" className="secondary" onClick={()=>signUp({ preventDefault: () => {} } as React.FormEvent)}>Criar conta</button></div>
      </form>
      <p className="hint">A autenticação só funciona depois de configurar o projeto Supabase.</p>
    </section> : <>
      <section className="welcome"><div><span className="muted">Conectado como</span><strong>{user.email}</strong></div><button className="secondary" onClick={signOut}>Sair</button></section>
      <section className="metrics"><div className="metric"><span>Resultado acumulado</span><strong>{money(totalPL)}</strong></div><div className="metric"><span>Rake registrado</span><strong>{money(totalRake)}</strong></div><div className="metric"><span>Lançamentos</span><strong>{rows.length}</strong></div></section>
      <section className="panel"><h2>Novo fechamento diário</h2><p className="muted">Um lançamento por clube e aplicativo.</p>
        <form onSubmit={saveSession} className="form">
          <div className="grid"><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Aplicativo<select value={app} onChange={e=>setApp(e.target.value)}><option>X-Poker</option><option>PPPoker</option></select></label></div>
          <label>Clube<select value={club} onChange={e=>setClub(e.target.value)}><option>Clube A</option><option>Clube B</option><option>Clube C</option><option>Clube D</option></select></label>
          <div className="grid"><label>Saldo inicial (R$)<input type="number" step="0.01" value={start} onChange={e=>setStart(e.target.value)} required/></label><label>Saldo final (R$)<input type="number" step="0.01" value={end} onChange={e=>setEnd(e.target.value)} required/></label></div>
          <label>Rake do período (R$)<input type="number" min="0" step="0.01" value={rake} onChange={e=>setRake(e.target.value)} required/></label>
          <label>Observações (opcional)<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/></label>
          <div className="preview"><span>Resultado calculado</span><strong>{money(Number(end)-Number(start))}</strong></div>
          <button type="submit">Salvar lançamento</button>
        </form>
      </section>
      <section className="panel"><h2>Histórico de lançamentos</h2>{rows.length===0 ? <p className="muted">Nenhum lançamento salvo ainda.</p> : <div className="tableWrap"><table><thead><tr><th>Data</th><th>App / Clube</th><th>Saldo inicial</th><th>Saldo final</th><th>Up/Down</th><th>Rake</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.session_date}</td><td>{r.app_name}<small>{r.club_name}</small></td><td>{money(r.starting_balance)}</td><td>{money(r.ending_balance)}</td><td className={r.profit_loss>=0?"positive":"negative"}>{money(r.profit_loss)}</td><td>{money(r.rake)}</td></tr>)}</tbody></table></div>}</section>
    </>}
    {message && <div className="toast">{message}</div>}
    <footer>Dados financeiros devem ser conferidos com os registros oficiais dos clubes. Não compartilhe senhas de aplicativos de poker.</footer>
  </main>;
}

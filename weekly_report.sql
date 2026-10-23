-- Relatório semanal por jogador, app e clube.
-- Ajuste as datas do período antes de executar.
select
  p.display_name as jogador,
  s.app_name as aplicativo,
  s.club_name as clube,
  sum(s.profit_loss) as resultado_total,
  sum(s.rake) as rake_total,
  count(*) as lancamentos
from public.daily_sessions s
join public.profiles p on p.id = s.player_id
where s.team_id = public.current_team_id()
  and s.session_date >= date '2026-10-19'
  and s.session_date < date '2026-10-26'
group by p.display_name, s.app_name, s.club_name
order by rake_total desc;

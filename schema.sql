-- Ayala Price — schema mínimo (só configurações)

create table if not exists configuracoes (
  id uuid primary key default gen_random_uuid(),
  chave text unique not null,
  valor text
);

alter table configuracoes disable row level security;
grant all on configuracoes to anon, authenticated;

insert into configuracoes (chave, valor) values
  ('nome_medico', 'Dr. Oscar Misael Ayala Pizana'),
  ('especialidade', 'Clínico Geral Esp. Medicina de Família e Comunidade'),
  ('crm', 'CRM-SC 25531'),
  ('rqe', 'RQE 21185'),
  ('endereco', 'Rua Alfredo João Krieck, 291 — Sala 12, Gravatá, Navegantes/SC'),
  ('telefone', '(47) 99254-6849'),
  ('meta_faturamento', '30000'),
  ('horas_dia', '2.5'),
  ('dias_mes', '22'),
  ('pro_labore', '8000'),
  ('custo_fixo_mensal', '0'),
  ('atendimentos_mes', '55'),
  ('imposto_percentual', '17'),
  ('desconto_especie', '10'),
  ('taxa_debito', '1.5'),
  ('taxa_credito_1x', '2.0'),
  ('taxa_credito_2x', '2.5'),
  ('taxa_credito_3x', '3.0'),
  ('taxa_credito_4x', '3.5'),
  ('taxa_credito_5x', '4.0'),
  ('taxa_credito_6x', '4.5'),
  ('taxa_credito_7x', '5.0'),
  ('taxa_credito_8x', '5.5'),
  ('taxa_credito_9x', '6.0'),
  ('taxa_credito_10x', '6.5')
on conflict (chave) do nothing;

-- Base de defeitos do Quality Vision.
-- Recortes dos defeitos ficam guardados; a foto inteira só por 7 dias (limpeza feita pela função `registrar`).
-- RLS ligada e sem políticas: só a função (service role) lê e escreve.

create table if not exists public.inspecoes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  embarque text, placa text, operador text,
  nota int, resultado text
);

create table if not exists public.defeitos (
  id uuid primary key default gen_random_uuid(),
  inspecao_id uuid not null references public.inspecoes(id) on delete cascade,
  criado_em timestamptz not null default now(),
  lado text, tipo text not null, gravidade int,
  critico boolean not null default false,
  descricao text, acao text, box jsonb,
  origem text not null default 'ia',          -- 'ia' ou 'operador'
  veredito text check (veredito in ('acertou','errou')),  -- retorno do operador sobre a IA
  ignorado boolean not null default false,
  motivo_ignorado text,
  recorte_path text,                          -- recorte do defeito (guardado)
  foto_path text                              -- foto inteira analisada (apagada após 7 dias)
);

create index if not exists defeitos_criado_idx on public.defeitos (criado_em desc);
create index if not exists defeitos_tipo_idx on public.defeitos (tipo);
create index if not exists defeitos_foto_idx on public.defeitos (criado_em) where foto_path is not null;

alter table public.inspecoes enable row level security;
alter table public.defeitos enable row level security;

insert into storage.buckets (id, name, public) values ('defeitos', 'defeitos', false) on conflict (id) do nothing;

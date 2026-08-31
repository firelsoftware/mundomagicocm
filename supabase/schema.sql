-- ============================================================================
--  Mundo Mágico CM — estrutura do banco no Supabase
--
--  Cole este arquivo inteiro no SQL Editor do projeto e execute uma vez.
--  Depois rode o seed.sql para carregar o catálogo.
--
--  Regras de negócio que ficam AQUI e não no navegador (o navegador é público
--  e pode ser adulterado): o preço da reserva e a disponibilidade da data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Constantes do negócio
-- ----------------------------------------------------------------------------

-- Quantos eventos a equipe consegue atender no mesmo dia.
create or replace function public.max_eventos_dia()
returns int language sql immutable as $$ select 3 $$;

-- O valor cadastrado cobre até 4h; cada hora extra custa valor/4.
create or replace function public.horas_base()
returns int language sql immutable as $$ select 4 $$;


-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------

create table if not exists public.categorias (
  id     bigint generated always as identity primary key,
  nome   text not null unique,
  slug   text not null unique,
  ordem  int  not null default 0
);

create table if not exists public.brinquedos (
  id            bigint generated always as identity primary key,
  -- único para o seed poder rodar de novo sem duplicar o catálogo
  nome          text not null unique,
  descricao     text not null default '',
  valor_ate_4h  numeric(10,2) not null default 0 check (valor_ate_4h >= 0),
  imagem_url    text not null default '',
  categoria_id  bigint references public.categorias(id) on delete set null,
  destaque      boolean not null default false,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create index if not exists brinquedos_ativo_idx on public.brinquedos (ativo);

-- Perfil de cada conta. É aqui que mora o privilégio: 'cliente', 'admin' ou 'dono'.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null default '',
  telefone   text not null default '',
  role       text not null default 'cliente' check (role in ('cliente', 'admin', 'dono')),
  -- true enquanto a pessoa ainda usa a senha que OUTRA pessoa definiu por ela.
  -- O site obriga a trocar antes de deixar entrar no painel, para que quem
  -- criou a conta não conheça a senha definitiva do dono do negócio.
  senha_provisoria boolean not null default false,
  criado_em  timestamptz not null default now()
);

-- Para bancos criados antes desta coluna existir.
alter table public.profiles
  add column if not exists senha_provisoria boolean not null default false;

create table if not exists public.bloqueios (
  id           bigint generated always as identity primary key,
  data         date not null,
  dia_inteiro  boolean not null default true,
  slots        int not null default 0 check (slots >= 0),
  hora_inicio  time,
  hora_fim     time,
  motivo       text not null default '',
  criado_em    timestamptz not null default now()
);

create index if not exists bloqueios_data_idx on public.bloqueios (data);

create table if not exists public.reservas (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete set null,
  nome_cliente       text not null check (length(trim(nome_cliente)) > 0),
  telefone_cliente   text not null check (length(trim(telefone_cliente)) > 0),
  data_evento        date not null,
  hora_inicio        time not null,
  qtd_horas          int  not null default 4 check (qtd_horas between 1 and 12),
  local_evento       text not null check (length(trim(local_evento)) > 0),
  itens              jsonb not null default '[]'::jsonb,
  valor_total        numeric(10,2) not null default 0,
  mensagem_whatsapp  text not null default '',
  status             text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  criado_em          timestamptz not null default now()
);

create index if not exists reservas_data_idx on public.reservas (data_evento);

create table if not exists public.depoimentos (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null,
  nome        text not null check (length(trim(nome)) > 0),
  texto       text not null check (length(trim(texto)) > 0),
  imagem_url  text not null default '',
  aprovado    boolean not null default false,
  criado_em   timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- Quem é administrador
--
-- security definer de propósito: a função precisa ler profiles sem passar pelo
-- RLS da própria profiles, senão a policy chamaria a si mesma em loop.
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'dono')
  );
$$;

create or replace function public.is_dono()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'dono'
  );
$$;


-- ----------------------------------------------------------------------------
-- Toda conta nova nasce como cliente
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.raw_user_meta_data ->> 'telefone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ninguém promove a si mesmo: só quem já é dono muda o campo role.
create or replace function public.protege_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- auth.uid() nulo = rodando pelo SQL Editor ou pela service_role. É assim que
  -- o primeiro dono é criado, já que nesse momento ainda não existe nenhum.
  if auth.uid() is not null and not public.is_dono() then
    raise exception 'Somente o dono pode alterar o perfil de acesso.';
  end if;

  -- Rebaixar o último dono trancaria todo mundo para fora da gestão de equipe,
  -- e voltar disso só pelo SQL Editor.
  if old.role = 'dono' and new.role <> 'dono'
     and not exists (
       select 1 from public.profiles
        where role = 'dono' and id <> old.id
     ) then
    raise exception 'É preciso manter ao menos um dono.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protege_role on public.profiles;
create trigger profiles_protege_role
  before update on public.profiles
  for each row execute function public.protege_role();


-- ----------------------------------------------------------------------------
-- Reserva: preço e disponibilidade conferidos no banco
--
-- O total que chega do navegador é descartado e recalculado a partir do preço
-- real cadastrado. A capacidade do dia também é conferida aqui, senão dois
-- clientes poderiam fechar o mesmo horário ao mesmo tempo.
-- ----------------------------------------------------------------------------

create or replace function public.reserva_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  soma        numeric(10,2);
  extras      int;
  ocupados    int;
  bloqueados  int;
  capacidade  int := public.max_eventos_dia();
  base        int := public.horas_base();
begin
  if jsonb_typeof(new.itens) <> 'array' then
    raise exception 'Lista de brinquedos inválida.';
  end if;

  select coalesce(sum(b.valor_ate_4h), 0)
    into soma
    from jsonb_array_elements(new.itens) as item(valor)
    join public.brinquedos b
      on b.id = nullif(valor ->> 'id', '')::bigint
   where b.ativo;

  if soma <= 0 then
    raise exception 'Escolha ao menos um brinquedo disponível.';
  end if;

  extras := greatest(0, new.qtd_horas - base);
  new.valor_total := round(soma + extras * (soma / base), 2);

  -- Cliente não decide se já está pago, nem lança reserva no nome de outro.
  if tg_op = 'INSERT' and not public.is_admin() then
    new.status := 'pendente';
    new.user_id := auth.uid();
  end if;

  if new.status <> 'cancelado' then
    select count(*)
      into ocupados
      from public.reservas
     where data_evento = new.data_evento
       and status <> 'cancelado'
       and (tg_op = 'INSERT' or id <> new.id);

    select coalesce(sum(case when dia_inteiro then capacidade else slots end), 0)
      into bloqueados
      from public.bloqueios
     where data = new.data_evento;

    if ocupados + bloqueados >= capacidade then
      raise exception 'Não há horário livre em %.', to_char(new.data_evento, 'DD/MM/YYYY');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservas_valida on public.reservas;
create trigger reservas_valida
  before insert or update on public.reservas
  for each row execute function public.reserva_valida();


-- ----------------------------------------------------------------------------
-- Consulta pública de disponibilidade
--
-- Devolve só quantas vagas restam, sem expor dados de quem já reservou.
-- ----------------------------------------------------------------------------

-- Os nomes internos levam prefixo de propósito: em RETURNS TABLE as colunas de
-- saída viram identificadores em escopo e colidiriam com os aliases do CTE.
create or replace function public.disponibilidade(dia date)
returns table (data date, capacidade int, ocupados int, bloqueados int, livres int)
language sql
stable
security definer
set search_path = public
as $$
  with numeros as (
    select
      public.max_eventos_dia() as n_capacidade,
      (select count(*)::int from public.reservas r
        where r.data_evento = dia and r.status <> 'cancelado') as n_ocupados,
      (select coalesce(sum(case when b.dia_inteiro then public.max_eventos_dia() else b.slots end), 0)::int
         from public.bloqueios b where b.data = dia) as n_bloqueados
  )
  select dia, n_capacidade, n_ocupados, n_bloqueados,
         greatest(0, n_capacidade - n_ocupados - n_bloqueados)
    from numeros;
$$;


-- ----------------------------------------------------------------------------
-- RLS
--
-- Sem isto qualquer visitante com a chave pública apagaria o catálogo.
-- ----------------------------------------------------------------------------

alter table public.categorias  enable row level security;
alter table public.brinquedos  enable row level security;
alter table public.profiles    enable row level security;
alter table public.reservas    enable row level security;
alter table public.depoimentos enable row level security;
alter table public.bloqueios   enable row level security;

-- Categorias: todo mundo lê, só admin escreve.
drop policy if exists categorias_leitura on public.categorias;
create policy categorias_leitura on public.categorias
  for select using (true);

drop policy if exists categorias_admin on public.categorias;
create policy categorias_admin on public.categorias
  for all using (public.is_admin()) with check (public.is_admin());

-- Brinquedos: o site mostra os ativos; o admin vê e mexe em todos.
drop policy if exists brinquedos_leitura on public.brinquedos;
create policy brinquedos_leitura on public.brinquedos
  for select using (ativo or public.is_admin());

drop policy if exists brinquedos_admin on public.brinquedos;
create policy brinquedos_admin on public.brinquedos
  for all using (public.is_admin()) with check (public.is_admin());

-- Perfis: cada um vê o seu; o admin vê a equipe toda; só o dono cria e remove.
drop policy if exists profiles_proprio on public.profiles;
create policy profiles_proprio on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_edita_proprio on public.profiles;
create policy profiles_edita_proprio on public.profiles
  for update using (id = auth.uid() or public.is_dono())
          with check (id = auth.uid() or public.is_dono());

drop policy if exists profiles_dono_remove on public.profiles;
create policy profiles_dono_remove on public.profiles
  for delete using (public.is_dono() and id <> auth.uid());

-- Reservas: qualquer visitante pede orçamento; só o admin lê e altera.
-- Cliente logado enxerga as próprias reservas.
drop policy if exists reservas_cria on public.reservas;
create policy reservas_cria on public.reservas
  for insert with check (true);

drop policy if exists reservas_leitura on public.reservas;
create policy reservas_leitura on public.reservas
  for select using (public.is_admin() or (user_id is not null and user_id = auth.uid()));

drop policy if exists reservas_admin on public.reservas;
create policy reservas_admin on public.reservas
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists reservas_admin_remove on public.reservas;
create policy reservas_admin_remove on public.reservas
  for delete using (public.is_admin());

-- Depoimentos: o site mostra os aprovados; qualquer um envia, mas entra
-- aguardando revisão — o with check impede publicar direto.
drop policy if exists depoimentos_leitura on public.depoimentos;
create policy depoimentos_leitura on public.depoimentos
  for select using (aprovado or public.is_admin());

drop policy if exists depoimentos_envia on public.depoimentos;
create policy depoimentos_envia on public.depoimentos
  for insert with check (aprovado = false or public.is_admin());

drop policy if exists depoimentos_admin on public.depoimentos;
create policy depoimentos_admin on public.depoimentos
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists depoimentos_admin_remove on public.depoimentos;
create policy depoimentos_admin_remove on public.depoimentos
  for delete using (public.is_admin());

-- Bloqueios: leitura pública porque o calendário do site precisa saber
-- quais datas estão fechadas; só o admin bloqueia.
drop policy if exists bloqueios_leitura on public.bloqueios;
create policy bloqueios_leitura on public.bloqueios
  for select using (true);

drop policy if exists bloqueios_admin on public.bloqueios;
create policy bloqueios_admin on public.bloqueios
  for all using (public.is_admin()) with check (public.is_admin());


-- ----------------------------------------------------------------------------
-- Criar reserva
--
-- Precisa ser função, e não INSERT direto da tela, por um motivo prático: o
-- visitante não tem permissão de LER reservas (e não deve ter — são dados de
-- outros clientes). Só que o site precisa saber o id e o valor que o banco
-- calculou. Um insert com retorno esbarraria justamente na regra de leitura.
--
-- security definer resolve: a função grava e devolve apenas o id e o valor,
-- sem abrir a tabela. As validações de preço e disponibilidade continuam
-- valendo, porque o trigger reserva_valida() roda igual.
-- ----------------------------------------------------------------------------

create or replace function public.criar_reserva(
  p_nome      text,
  p_telefone  text,
  p_data      date,
  p_hora      time,
  p_horas     int,
  p_locais    text[],
  p_itens     jsonb
)
returns table (id uuid, valor_total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  endereco text;
begin
  if array_length(p_locais, 1) is null then
    raise exception 'Informe ao menos um local.';
  end if;

  if array_length(p_locais, 1) > public.max_eventos_dia() then
    raise exception 'No máximo % locais no mesmo dia.', public.max_eventos_dia();
  end if;

  foreach endereco in array p_locais loop
    return query
      insert into public.reservas (
        nome_cliente, telefone_cliente, data_evento, hora_inicio,
        qtd_horas, local_evento, itens, user_id
      ) values (
        btrim(p_nome), btrim(p_telefone), p_data, p_hora,
        p_horas, btrim(endereco), p_itens, auth.uid()
      )
      returning reservas.id, reservas.valor_total;
  end loop;
end;
$$;


-- ----------------------------------------------------------------------------
-- Permissões de acesso pela API
--
-- O RLS decide QUAIS linhas cada um enxerga, mas o Postgres ainda cobra
-- permissão na tabela antes de chegar nesse ponto. Sem os grants abaixo o
-- PostgREST responde "permission denied" mesmo com as policies certas.
--
-- Deixar isto explícito no schema evita depender da opção "expor
-- automaticamente novas tabelas" do painel: funciona com ela ligada ou não.
--
-- Conceder assim é seguro porque toda tabela acima está com RLS ligado — sem
-- policy que autorize, a linha simplesmente não aparece.
-- ----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

-- Visitante não logado: lê o catálogo e manda depoimento.
grant select on public.categorias, public.brinquedos, public.bloqueios, public.depoimentos
  to anon, authenticated;
grant insert on public.depoimentos to anon, authenticated;

-- Reserva só entra pela função acima, então anon não recebe acesso à tabela.
grant select, insert, update, delete on public.reservas to authenticated;
grant select, insert, update, delete on public.categorias, public.brinquedos,
  public.bloqueios, public.depoimentos, public.profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.disponibilidade(date) to anon, authenticated;
grant execute on function public.criar_reserva(text, text, date, time, int, text[], jsonb)
  to anon, authenticated;

-- ============================================================================
--  ATUALIZAÇÃO 01 — senha provisória no primeiro acesso
--
--  Rode este arquivo no SQL Editor se você JÁ instalou o banco antes.
--  Quem instalar do zero pelo instalar.sql não precisa: já vem incluso.
--
--  Para que serve: quem cria a conta de outra pessoa define uma senha
--  provisória. No primeiro login o site obriga a pessoa a trocar. Assim quem
--  criou a conta não fica sabendo a senha definitiva do dono do negócio.
-- ============================================================================

alter table public.profiles
  add column if not exists senha_provisoria boolean not null default false;

comment on column public.profiles.senha_provisoria is
  'true = a pessoa ainda usa a senha que outra pessoa definiu e precisa trocar no próximo acesso.';


-- Marcar uma conta como precisando trocar a senha:
--
--   update public.profiles set senha_provisoria = true
--    where id = 'UID_DA_PESSOA';
--
-- A própria pessoa desmarca ao definir a senha nova pelo site.

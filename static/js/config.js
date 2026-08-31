/* Onde o site encontra o Supabase.
   Preencha os dois campos depois de criar o projeto, em Project Settings > API.

   A chave anon aparece no código-fonte da página e isso é normal: ela só
   permite o que as regras de RLS do banco permitirem. A chave service_role
   ignora o RLS e NUNCA pode entrar aqui nem em qualquer arquivo do repositório. */
window.SUPABASE_CONFIG = {
  url: "https://uzzdnuobuawhcnzjcysu.supabase.co",
  anonKey: "sb_publishable_N8wKc8MV_gk1HWsM7qylqg_6Ap04xg3",
};

window.EMPRESA = {
  nome: "Mundo Mágico CM",
  cidade: "Brasília - DF",
  whatsapp: "5561991540133",
};

/* Precisa bater com max_eventos_dia() e horas_base() do schema.sql.
   Aqui é só para a tela; quem decide de verdade é o banco. */
window.REGRAS = {
  horasBase: 4,
  maxEventosDia: 3,
};

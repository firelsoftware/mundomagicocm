/* Sessão e privilégio do Mundo Mágico CM.

   O perfil de cada conta fica na tabela profiles, coluna role:
     cliente  — quem aluga; entra e volta para a loja
     admin    — equipe; usa o painel
     dono     — equipe; usa o painel e ainda gerencia quem é quem

   Aqui o papel serve só para decidir o que mostrar. Quem impede de verdade um
   cliente de mexer no catálogo é o RLS do banco, não este arquivo. */
(function () {
  "use strict";

  var perfilCache = null;

  function client() {
    var c = window.API && window.API.client();
    if (!c) throw new Error("Supabase não configurado.");
    return c;
  }

  async function sessao() {
    var r = await client().auth.getSession();
    return (r.data && r.data.session) || null;
  }

  /* Guardado em memória porque quase toda página pergunta o papel mais de uma
     vez (menu, guarda de rota, saudação). Zera no login e no logout. */
  async function perfil() {
    if (perfilCache) return perfilCache;

    var s = await sessao();
    if (!s) return null;

    var r = await client()
      .from("profiles")
      .select("id, nome, telefone, role, senha_provisoria")
      .eq("id", s.user.id)
      .single();

    if (r.error) return null;

    perfilCache = Object.assign({ email: s.user.email }, r.data);
    return perfilCache;
  }

  function ehEquipe(p) {
    return !!p && (p.role === "admin" || p.role === "dono");
  }

  /* Cada pessoa entra com o e-mail dela mesma, o de verdade, que ela lê no
     celular. É por ele que chega o link quando alguém esquece a senha — e é
     por isso que não inventamos endereço no domínio do site: mundomagicocm.com.br
     aponta para o GitHub Pages e não tem caixa de entrada. */
  function normalizarLogin(entrada) {
    return String(entrada || "").trim().toLowerCase();
  }

  /* Sem arroba não adianta nem tentar: o Supabase só entende e-mail, e o erro
     que ele devolve ("invalid credentials") faria a pessoa procurar defeito na
     senha em vez de perceber que digitou o endereço pela metade. */
  function exigirEmail(texto) {
    if (texto.indexOf("@") === -1 || texto.indexOf(".") === -1) {
      throw new Error("Digite o e-mail completo, como nome@gmail.com.");
    }
    return texto;
  }

  window.Auth = {
    sessao: sessao,
    perfil: perfil,
    ehEquipe: ehEquipe,

    /* Mensagem genérica de propósito: dizer "essa conta não existe" entrega
       para quem estiver testando quais contas são reais. */
    entrar: async function (identificacao, senha) {
      perfilCache = null;
      var r = await client().auth.signInWithPassword({
        email: exigirEmail(normalizarLogin(identificacao)),
        password: senha,
      });
      if (r.error) throw new Error("Usuário ou senha inválidos.");
      return await perfil();
    },

    normalizarLogin: normalizarLogin,

    /* Manda o link de redefinição para o e-mail da pessoa. O link traz ela de
       volta para trocar-senha/, que é a mesma tela do primeiro acesso — quem
       chega por ali já entra com sessão aberta e só precisa escolher a senha.

       O endereço de retorno precisa estar cadastrado no Supabase em
       Authentication > URL Configuration > Redirect URLs, senão o link ignora
       o destino e joga a pessoa na raiz do site.

       Erro aqui é engolido de propósito. Responder "esse e-mail não tem conta"
       transformaria a tela num jeito de descobrir quem é da equipe; a tela
       sempre diz a mesma coisa, exista a conta ou não. */
    pedirRecuperacao: async function (email, raiz) {
      var destino = new URL((raiz || "../") + "trocar-senha/", window.location.href).href;
      var r = await client().auth.resetPasswordForEmail(normalizarLogin(email), {
        redirectTo: destino,
      });
      if (r.error) console.warn("Recuperação de senha:", r.error.message);
    },

    cadastrar: async function (email, senha, nome, telefone) {
      perfilCache = null;
      var r = await client().auth.signUp({
        email: String(email).trim().toLowerCase(),
        password: senha,
        options: { data: { nome: nome || "", telefone: telefone || "" } },
      });
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },

    sair: async function (destino) {
      perfilCache = null;
      await client().auth.signOut();
      window.location.href = destino || "../";
    },

    /* Para onde ir depois de entrar. Senha provisória vem antes de tudo: quem
       ainda usa a senha que outra pessoa definiu não passa daqui. */
    destino: function (p, raiz) {
      var base = raiz || "";
      if (p && p.senha_provisoria) return base + "trocar-senha/";
      return ehEquipe(p) ? base + "painel/" : base;
    },

    /* Marca que a pessoa já definiu a própria senha. */
    senhaDefinida: async function () {
      var p = await perfil();
      if (!p) throw new Error("Sessão expirada.");
      var r = await client().from("profiles").update({ senha_provisoria: false }).eq("id", p.id);
      if (r.error) throw new Error(r.error.message);
      perfilCache = null;
    },

    /* Colocar no topo de toda página do painel. Devolve o perfil quando pode
       entrar; caso contrário redireciona e não devolve nada. */
    exigirEquipe: async function (raiz) {
      var base = raiz || "../";
      var p = await perfil();
      if (!p) {
        window.location.replace(base + "login/");
        return null;
      }
      // Não adianta digitar o endereço do painel para pular a troca.
      if (p.senha_provisoria) {
        window.location.replace(base + "trocar-senha/");
        return null;
      }
      if (!ehEquipe(p)) {
        window.location.replace(base);
        return null;
      }
      return p;
    },

    exigirDono: async function (raiz) {
      var p = await window.Auth.exigirEquipe(raiz);
      if (!p) return null;
      if (p.role !== "dono") {
        window.location.replace((raiz || "../") + "painel/");
        return null;
      }
      return p;
    },

    /* Troca o link "Entrar" do menu por "Painel" ou "Sair", conforme quem está
       logado. Chamar no DOMContentLoaded de cada página. */
    ajustarMenu: async function (raiz) {
      var link = document.querySelector("[data-menu-conta]");
      if (!link || !window.API.configurado()) return;

      var base = raiz || "";
      var p = await perfil();

      if (!p) {
        link.innerHTML = '<i class="fa-solid fa-user"></i> Entrar';
        link.href = base + "login/";
        return;
      }
      if (ehEquipe(p)) {
        link.innerHTML = '<i class="fa-solid fa-chart-line"></i> Painel';
        link.href = base + "painel/";
        return;
      }
      link.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Sair';
      link.href = "#";
      link.addEventListener("click", function (e) {
        e.preventDefault();
        window.Auth.sair(base);
      });
    },
  };
})();

/* Gestão de equipe. Só o dono chega aqui.

   O que se gerencia é o privilégio, não a conta: mudar profiles.role é uma
   escrita normal de tabela, autorizada pelo RLS. Criar e apagar contas de
   verdade exigiria a chave service_role, que num site publicado ficaria à vista
   de qualquer visitante — por isso esse passo é feito no painel do Supabase.

   As travas abaixo estão repetidas no trigger protege_role() do banco. Aqui
   servem para explicar; lá servem para valer. */
(function () {
  "use strict";

  var eu = null;

  var PAPEIS = [
    ["cliente", "Cliente — só aluga, sem acesso ao painel"],
    ["admin", "Admin — usa o painel inteiro"],
    ["dono", "Dono — usa o painel e gerencia a equipe"],
  ];

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function rotulo(role) {
    return role === "dono" ? "Dono" : role === "admin" ? "Admin" : "Cliente";
  }

  async function recarregar() {
    var equipe = await window.API.listarEquipe();
    var donos = equipe.filter(function (p) { return p.role === "dono"; }).length;

    document.querySelector("[data-equipe]").innerHTML =
      "<table><thead><tr><th>Pessoa</th><th>Perfil atual</th><th>Mudar para</th>" +
      "<th>Senha</th></tr></thead><tbody>" +
      equipe.map(function (p) {
        var souEu = p.id === eu.id;
        var ultimoDono = p.role === "dono" && donos === 1;
        var travado = souEu || ultimoDono;

        var senha = p.senha_provisoria
          ? '<span class="tag senha-pendente">Provisória</span>'
          : souEu
            ? '<span class="vazio">—</span>'
            : '<button class="btn btn-sm btn-ghost" data-exigir-troca="' + esc(p.id) + '">' +
              "Exigir troca</button>";

        var motivo = souEu
          ? "Você não muda o próprio perfil."
          : ultimoDono
            ? "É preciso manter ao menos um dono."
            : "";

        var seletor = travado
          ? '<span class="vazio">' + esc(motivo) + "</span>"
          : '<select data-perfil="' + esc(p.id) + '">' +
              PAPEIS.map(function (par) {
                return '<option value="' + par[0] + '"' + (p.role === par[0] ? " selected" : "") +
                       ">" + esc(par[1]) + "</option>";
              }).join("") +
            "</select>";

        return "<tr>" +
          "<td>" + esc(p.nome || "(sem nome)") + (souEu ? " <small>(você)</small>" : "") +
            (p.telefone ? "<br /><small>" + esc(p.telefone) + "</small>" : "") + "</td>" +
          '<td><span class="tag perfil-' + esc(p.role) + '">' + esc(rotulo(p.role)) + "</span></td>" +
          "<td>" + seletor + "</td>" +
          "<td>" + senha + "</td>" +
          "</tr>";
      }).join("") + "</tbody></table>";
  }

  document.addEventListener("change", async function (e) {
    var sel = e.target.closest("[data-perfil]");
    if (!sel) return;

    var anterior = sel.querySelector("option[selected]");
    try {
      await window.API.definirPerfil(sel.dataset.perfil, sel.value);
      await recarregar();
    } catch (erro) {
      alert(erro.message);
      if (anterior) sel.value = anterior.value;
    }
  });

  document.addEventListener("click", async function (e) {
    if (e.target.closest("[data-sair]")) {
      e.preventDefault();
      window.Auth.sair("../../");
      return;
    }

    var botao = e.target.closest("[data-exigir-troca]");
    if (!botao) return;
    e.preventDefault();

    if (!confirm("Isso obriga a pessoa a escolher uma senha nova no próximo " +
                 "acesso.\n\n" +
                 "Use quando você mesmo definiu a senha dela. Se ela só esqueceu " +
                 "a senha, é mais simples pedir que use o Esqueci minha senha " +
                 "na tela de login.\n\n" +
                 "Prosseguir?")) return;

    try {
      await window.API.exigirTrocaDeSenha(botao.dataset.exigirTroca);
      await recarregar();
    } catch (erro) {
      alert(erro.message);
    }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.API.configurado()) {
      document.querySelector("[data-equipe]").innerHTML =
        '<p class="vazio">Supabase não configurado.</p>';
      return;
    }

    eu = await window.Auth.exigirDono("../../");
    if (!eu) return;

    try {
      await recarregar();
    } catch (erro) {
      document.querySelector("[data-equipe]").innerHTML =
        '<p class="vazio">' + esc(erro.message) + "</p>";
    }
  });
})();

/* Dashboard administrativo.

   A guarda daqui é só de conveniência: esconder a página de quem não é da
   equipe. A proteção real está no RLS — mesmo que alguém abra este arquivo
   direto, o banco recusa ler reservas e gravar no catálogo sem o perfil certo. */
(function () {
  "use strict";

  var perfil = null;
  var categorias = [];

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function dataBR(iso) {
    return iso ? iso.split("-").reverse().join("/") : "";
  }

  function el(seletor) { return document.querySelector(seletor); }

  async function recarregar() {
    var brinquedos = await window.API.listarBrinquedos();
    var reservas = await window.API.listarReservas();
    var depoimentos = await window.API.listarDepoimentos();

    renderStats(brinquedos, reservas, depoimentos);
    renderReservas(reservas);
    renderCatalogo(brinquedos);
    renderDepoimentos(depoimentos);
  }

  function renderStats(brinquedos, reservas, depoimentos) {
    var receita = reservas
      .filter(function (r) { return r.status === "pago"; })
      .reduce(function (t, r) { return t + Number(r.valor_total); }, 0);

    var caixas = [
      [brinquedos.length, "Brinquedos"],
      [brinquedos.filter(function (b) { return b.ativo; }).length, "Ativos no site"],
      [reservas.length, "Reservas"],
      [reservas.filter(function (r) { return r.status === "pendente"; }).length, "Pendentes"],
      ["R$ " + window.API.moeda(receita), "Receita (paga)"],
      [depoimentos.filter(function (d) { return !d.aprovado; }).length, "A revisar"],
    ];

    el("[data-stats]").innerHTML = caixas.map(function (c) {
      return '<div class="stat"><span>' + esc(c[0]) + "</span><p>" + esc(c[1]) + "</p></div>";
    }).join("");
  }

  function renderReservas(reservas) {
    var alvo = el("[data-reservas]");
    if (!reservas.length) {
      alvo.innerHTML = '<p class="vazio">Nenhuma reserva ainda.</p>';
      return;
    }
    alvo.innerHTML = "<table><thead><tr><th>Cliente</th><th>Data</th><th>Local</th>" +
      "<th>Valor</th><th>Status</th></tr></thead><tbody>" +
      reservas.map(function (r) {
        return "<tr>" +
          "<td>" + esc(r.nome_cliente) + "<br /><small>" + esc(r.telefone_cliente) + "</small></td>" +
          "<td>" + dataBR(r.data_evento) + "<br /><small>" + esc(String(r.hora_inicio).slice(0, 5)) +
            " · " + esc(r.qtd_horas) + "h</small></td>" +
          "<td>" + esc(r.local_evento) + "</td>" +
          "<td>R$ " + window.API.moeda(r.valor_total) + "</td>" +
          '<td><select data-status="' + esc(r.id) + '">' +
            ["pendente", "pago", "cancelado"].map(function (s) {
              return '<option value="' + s + '"' + (r.status === s ? " selected" : "") + ">" + s + "</option>";
            }).join("") +
          "</select></td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderCatalogo(brinquedos) {
    var opcoes = function (sel) {
      return categorias.map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === sel ? " selected" : "") + ">" + esc(c.nome) + "</option>";
      }).join("");
    };

    el("[data-catalogo]").innerHTML =
      "<table><thead><tr><th>Nome</th><th>Categoria</th><th>Valor (4h)</th>" +
      "<th>Destaque</th><th>Ativo</th><th></th></tr></thead><tbody>" +
      brinquedos.map(function (b) {
        return '<tr data-brinquedo="' + b.id + '">' +
          '<td><input name="nome" value="' + esc(b.nome) + '" /></td>' +
          '<td><select name="categoria_id">' + opcoes(b.categoria_id) + "</select></td>" +
          '<td><input name="valor_ate_4h" type="number" step="0.01" min="0" class="input-preco" value="' +
            Number(b.valor_ate_4h).toFixed(2) + '" /></td>' +
          '<td style="text-align:center"><input name="destaque" type="checkbox"' + (b.destaque ? " checked" : "") + " /></td>" +
          '<td style="text-align:center"><input name="ativo" type="checkbox"' + (b.ativo ? " checked" : "") + " /></td>" +
          '<td class="acoes-linha">' +
            '<button class="btn btn-sm btn-primary" data-salvar-brinquedo>Salvar</button>' +
            '<button class="btn btn-sm btn-danger" data-excluir-brinquedo>Excluir</button>' +
          "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderDepoimentos(depoimentos) {
    el("[data-depoimentos]").innerHTML =
      "<table><thead><tr><th>Nome</th><th>Depoimento</th><th>Publicado</th><th></th></tr></thead><tbody>" +
      (depoimentos.length ? depoimentos.map(function (d) {
        return '<tr data-depoimento="' + d.id + '">' +
          '<td><input name="nome" value="' + esc(d.nome) + '" /></td>' +
          '<td><textarea name="texto" rows="3">' + esc(d.texto) + "</textarea></td>" +
          '<td style="text-align:center"><input name="aprovado" type="checkbox"' + (d.aprovado ? " checked" : "") + " /></td>" +
          '<td class="acoes-linha">' +
            '<button class="btn btn-sm btn-primary" data-salvar-depoimento>Salvar</button>' +
            '<button class="btn btn-sm btn-danger" data-excluir-depoimento>Excluir</button>' +
          "</td></tr>";
      }).join("") : '<tr><td colspan="4" class="vazio">Nenhum depoimento.</td></tr>') +
      "</tbody></table>";
  }

  function campos(linha) {
    var d = {};
    linha.querySelectorAll("input, select, textarea").forEach(function (c) {
      d[c.name] = c.type === "checkbox" ? c.checked : c.value;
    });
    return d;
  }

  async function comErro(acao) {
    try {
      await acao();
      await recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  document.addEventListener("click", function (e) {
    var alvo = e.target.closest("[data-salvar-brinquedo], [data-excluir-brinquedo], " +
                               "[data-salvar-depoimento], [data-excluir-depoimento], [data-sair]");
    if (!alvo) return;
    e.preventDefault();

    if (alvo.hasAttribute("data-sair")) {
      window.Auth.sair("../");
      return;
    }

    var linha = alvo.closest("tr");

    if (alvo.hasAttribute("data-salvar-brinquedo")) {
      var b = campos(linha);
      comErro(function () {
        return window.API.salvarBrinquedo({
          id: Number(linha.dataset.brinquedo),
          nome: b.nome.trim(),
          categoria_id: Number(b.categoria_id) || null,
          valor_ate_4h: Number(b.valor_ate_4h) || 0,
          destaque: b.destaque,
          ativo: b.ativo,
        });
      });
    } else if (alvo.hasAttribute("data-excluir-brinquedo")) {
      if (!confirm("Remover este brinquedo?")) return;
      comErro(function () { return window.API.excluirBrinquedo(Number(linha.dataset.brinquedo)); });
    } else if (alvo.hasAttribute("data-salvar-depoimento")) {
      var d = campos(linha);
      comErro(function () {
        return window.API.salvarDepoimento({
          id: Number(linha.dataset.depoimento),
          nome: d.nome.trim(),
          texto: d.texto.trim(),
          aprovado: d.aprovado,
        });
      });
    } else if (alvo.hasAttribute("data-excluir-depoimento")) {
      if (!confirm("Remover este depoimento?")) return;
      comErro(function () { return window.API.excluirDepoimento(Number(linha.dataset.depoimento)); });
    }
  });

  document.addEventListener("change", function (e) {
    var sel = e.target.closest("[data-status]");
    if (!sel) return;
    comErro(function () { return window.API.atualizarStatusReserva(sel.dataset.status, sel.value); });
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-form-brinquedo]");
    if (!form) return;
    e.preventDefault();
    var d = campos(form);
    comErro(function () {
      return window.API.salvarBrinquedo({
        nome: d.nome.trim(),
        descricao: (d.descricao || "").trim(),
        valor_ate_4h: Number(d.valor_ate_4h) || 0,
        imagem_url: (d.imagem_url || "").trim(),
        categoria_id: Number(d.categoria_id) || null,
        destaque: d.destaque,
        ativo: true,
      });
    }).then(function () { form.reset(); });
  });

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.API.configurado()) {
      document.querySelector("[data-saudacao]").textContent = "Painel indisponível no momento.";
      ["[data-reservas]", "[data-catalogo]", "[data-depoimentos]"].forEach(function (s) {
        document.querySelector(s).innerHTML = '<p class="vazio">Sem conexão com o banco.</p>';
      });
      return;
    }

    perfil = await window.Auth.exigirEquipe("../");
    if (!perfil) return;

    document.querySelector("[data-saudacao]").textContent =
      "Olá, " + (perfil.nome || perfil.email) + ". Gerencie toda a operação em um só lugar.";

    if (perfil.role === "dono") {
      document.querySelector("[data-so-dono]").hidden = false;
    }

    categorias = await window.API.listarCategorias();
    document.querySelector("[data-categorias]").innerHTML = categorias.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.nome) + "</option>";
    }).join("");

    await recarregar();
  });
})();

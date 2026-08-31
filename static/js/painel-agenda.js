/* Agenda do painel: calendário do mês com os eventos marcados e as datas
   bloqueadas, e o formulário de bloqueio.

   Bloquear aqui reduz de verdade a disponibilidade que o site oferece ao
   cliente: a função disponibilidade() no banco desconta os bloqueios antes de
   liberar a data no carrinho. */
(function () {
  "use strict";

  var MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
               "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  var DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  var hoje = new Date();
  var ano = hoje.getFullYear();
  var mes = hoje.getMonth() + 1;
  var perfil = null;

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function iso(d) {
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  /* Semanas começando no domingo, incluindo os dias vizinhos que completam a
     primeira e a última linha. */
  function semanasDoMes(ano, mes) {
    var primeiro = new Date(ano, mes - 1, 1);
    var ultimo = new Date(ano, mes, 0);
    var cursor = new Date(primeiro);
    cursor.setDate(1 - primeiro.getDay());

    var semanas = [];
    while (cursor <= ultimo) {
      var semana = [];
      for (var i = 0; i < 7; i++) {
        semana.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      semanas.push(semana);
    }
    return semanas;
  }

  async function render() {
    document.querySelector("[data-mes-titulo]").textContent = MESES[mes - 1] + " de " + ano;

    var capacidade = (window.REGRAS && window.REGRAS.maxEventosDia) || 3;
    var reservas = await window.API.listarReservas();
    var bloqueios = await window.API.listarBloqueios(ano, mes);

    var porDia = {};
    reservas.forEach(function (r) {
      (porDia[r.data_evento] = porDia[r.data_evento] || []).push(r);
    });
    var bloqPorDia = {};
    bloqueios.forEach(function (b) {
      (bloqPorDia[b.data] = bloqPorDia[b.data] || []).push(b);
    });

    var html = '<table class="calendario"><thead><tr>' +
      DIAS.map(function (d) { return "<th>" + d + "</th>"; }).join("") +
      "</tr></thead><tbody>";

    semanasDoMes(ano, mes).forEach(function (semana) {
      html += "<tr>";
      semana.forEach(function (dia) {
        var chave = iso(dia);
        var noMes = dia.getMonth() === mes - 1;
        var eventos = (porDia[chave] || []).filter(function (r) { return r.status !== "cancelado"; });
        var bls = bloqPorDia[chave] || [];
        var bloqueados = bls.reduce(function (t, b) {
          return t + (b.dia_inteiro ? capacidade : b.slots);
        }, 0);
        var livres = Math.max(0, capacidade - eventos.length - bloqueados);

        html += '<td class="dia' + (noMes ? "" : " fora-do-mes") +
                (chave === iso(hoje) ? " hoje" : "") + '">' +
          '<span class="dia-numero">' + dia.getDate() + "</span>" +
          eventos.map(function (r) {
            return '<span class="dia-evento" title="' + esc(r.local_evento) + '">' +
                   esc(String(r.hora_inicio).slice(0, 5)) + " " + esc(r.nome_cliente) + "</span>";
          }).join("") +
          bls.map(function (b) {
            return '<span class="dia-bloqueio">' +
              (b.dia_inteiro ? "Fechado" : b.slots + " horário(s)") +
              (b.motivo ? " — " + esc(b.motivo) : "") +
              ' <button class="btn-remover" data-excluir-bloqueio="' + b.id + '" title="Remover bloqueio">' +
              '<i class="fa-solid fa-xmark"></i></button></span>';
          }).join("") +
          (noMes ? '<span class="dia-livres">' + livres + " livre(s)</span>" : "") +
          "</td>";
      });
      html += "</tr>";
    });

    document.querySelector("[data-calendario]").innerHTML = html + "</tbody></table>";
  }

  async function comErro(acao) {
    try {
      await acao();
      await render();
    } catch (e) {
      alert(e.message);
    }
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-sair]")) {
      e.preventDefault();
      window.Auth.sair("../../");
      return;
    }
    if (e.target.closest("[data-mes-anterior]")) {
      if (mes === 1) { mes = 12; ano--; } else { mes--; }
      render().catch(function (erro) { alert(erro.message); });
      return;
    }
    if (e.target.closest("[data-mes-proximo]")) {
      if (mes === 12) { mes = 1; ano++; } else { mes++; }
      render().catch(function (erro) { alert(erro.message); });
      return;
    }
    var remover = e.target.closest("[data-excluir-bloqueio]");
    if (remover) {
      if (!confirm("Remover este bloqueio?")) return;
      comErro(function () {
        return window.API.excluirBloqueio(Number(remover.dataset.excluirBloqueio));
      });
    }
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-form-bloqueio]");
    if (!form) return;
    e.preventDefault();

    var dados = {};
    form.querySelectorAll("input, select").forEach(function (c) { dados[c.name] = c.value; });
    var diaInteiro = dados.tipo === "dia";

    comErro(function () {
      return window.API.criarBloqueio({
        data: dados.data,
        dia_inteiro: diaInteiro,
        slots: diaInteiro ? 0 : Math.max(1, Number(dados.slots) || 1),
        motivo: (dados.motivo || "").trim(),
      });
    }).then(function () { form.reset(); });
  });

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.API.configurado()) {
      document.querySelector("[data-calendario]").innerHTML =
        '<p class="vazio">Sem conexão com o banco.</p>';
      return;
    }

    perfil = await window.Auth.exigirEquipe("../../");
    if (!perfil) return;

    if (perfil.role === "dono") {
      document.querySelector("[data-so-dono]").hidden = false;
    }

    await render();
  });
})();

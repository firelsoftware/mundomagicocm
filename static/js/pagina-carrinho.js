/* Página do carrinho: renderiza os itens, calcula o orçamento e grava a reserva
   no Supabase.

   O total mostrado aqui é só uma prévia. Quem define o valor gravado é o trigger
   reserva_valida() no banco, que recalcula a partir do preço real cadastrado —
   por isso o link do WhatsApp é montado com o que o banco devolveu, não com o
   que esta tela somou. */
(function () {
  "use strict";

  var lista = document.getElementById("lista-carrinho");
  var totalEl = document.getElementById("valor-total");
  var horasEl = document.getElementById("qtd-horas");
  var form = document.getElementById("form-reserva");
  var btn = document.getElementById("btn-finalizar");
  var dataEl = document.getElementById("data-evento");
  var qtdLocaisEl = document.getElementById("qtd-locais");
  var locaisEl = document.getElementById("locais");
  var dispEl = document.getElementById("disp-info");

  function moeda(v) { return "R$ " + window.API.moeda(v); }
  function valorItem(i) { return Number(i.valor != null ? i.valor : i.preco) || 0; }

  function escapeHtml(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  /* Carrinho salvo antes desta versão não guardava o id do brinquedo, e sem id
     o banco não consegue conferir o preço. Esses itens precisam ser escolhidos
     de novo. */
  function itensSemId() {
    return window.Carrinho.obter().filter(function (i) { return !i.id; });
  }

  // Monta os campos de endereço conforme a quantidade de locais escolhida.
  function renderLocais() {
    var n = parseInt(qtdLocaisEl.value, 10) || 1;
    var atuais = locaisEl.querySelectorAll(".local-input");
    var valores = Array.prototype.map.call(atuais, function (i) { return i.value; });
    locaisEl.innerHTML = "";
    for (var k = 0; k < n; k++) {
      var lbl = document.createElement("label");
      lbl.textContent = "Local " + (k + 1);
      var inp = document.createElement("input");
      inp.type = "text"; inp.className = "local-input"; inp.required = true;
      inp.placeholder = "Bairro / endereço";
      if (valores[k]) inp.value = valores[k];
      lbl.appendChild(inp);
      locaisEl.appendChild(lbl);
    }
  }

  function coletarLocais() {
    return Array.prototype.map.call(
      locaisEl.querySelectorAll(".local-input"),
      function (i) { return i.value.trim(); }
    ).filter(Boolean);
  }

  async function checarDisponibilidade() {
    if (!dataEl.value) { dispEl.hidden = true; btn.disabled = false; return; }
    try {
      var d = await window.API.consultarDisponibilidade(dataEl.value);
      if (!d) { dispEl.hidden = true; return; }

      Array.prototype.forEach.call(qtdLocaisEl.options, function (opt) {
        opt.disabled = Number(opt.value) > d.livres;
      });
      dispEl.hidden = false;

      if (d.livres <= 0) {
        dispEl.className = "disp-info cheio";
        dispEl.textContent = "Sem disponibilidade nesse dia. Por favor, escolha outra data.";
        btn.disabled = true;
        return;
      }

      dispEl.className = "disp-info ok";
      dispEl.textContent = d.livres + " de " + d.capacidade + " horário(s) livre(s) nesse dia.";
      btn.disabled = false;
      if (parseInt(qtdLocaisEl.value, 10) > d.livres) {
        qtdLocaisEl.value = String(d.livres);
        renderLocais();
      }
    } catch (e) {
      dispEl.hidden = true;
    }
  }

  function calcularTotal() {
    var itens = window.Carrinho.obter();
    var total = window.API.calcularTotal(itens.map(valorItem), horasEl.value);
    totalEl.textContent = moeda(total);
    return total;
  }

  function render() {
    var itens = window.Carrinho.obter();

    if (!itens.length) {
      lista.innerHTML = '<p class="mensagem-vazio">Seu carrinho está vazio. <a href="../#inflaveis">Escolher brinquedos</a></p>';
      totalEl.textContent = moeda(0);
      return;
    }

    var aviso = "";
    if (itensSemId().length) {
      aviso = '<p class="disp-info cheio">Alguns itens foram salvos numa versão antiga do site. ' +
              'Remova e escolha de novo para finalizar o pedido.</p>';
    }

    lista.innerHTML = aviso + itens.map(function (i, idx) {
      return '<div class="carrinho-item">' +
        '<img src="' + escapeHtml(i.imagem || "") + '" alt="" onerror="this.style.display=\'none\'" />' +
        '<div class="carrinho-item-info"><h4>' + escapeHtml(i.nome) + "</h4>" +
        "<p>" + moeda(valorItem(i)) + " até 4h</p></div>" +
        '<button class="btn-remover" data-remover="' + idx + '"><i class="fa-solid fa-trash"></i></button>' +
        "</div>";
    }).join("");
    calcularTotal();
  }

  lista.addEventListener("click", function (e) {
    var rem = e.target.closest("[data-remover]");
    if (!rem) return;
    window.Carrinho.remover(Number(rem.dataset.remover));
    render();
  });

  dataEl.addEventListener("change", checarDisponibilidade);
  qtdLocaisEl.addEventListener("change", renderLocais);
  horasEl.addEventListener("input", calcularTotal);

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    var itens = window.Carrinho.obter();
    if (!itens.length) { alert("Adicione algum brinquedo primeiro!"); return; }
    if (itensSemId().length) {
      alert("Alguns itens do carrinho vieram de uma versão antiga do site. Remova e escolha de novo.");
      return;
    }

    var locais = coletarLocais();
    if (!locais.length) { alert("Informe ao menos um local."); return; }

    var dados = {
      nome_cliente: document.getElementById("nome-cliente").value.trim(),
      telefone_cliente: document.getElementById("telefone-cliente").value.trim(),
      data_evento: dataEl.value,
      hora_inicio: document.getElementById("hora-inicio").value,
      qtd_horas: parseInt(horasEl.value, 10) || 1,
    };

    btn.disabled = true;
    var textoOriginal = btn.innerHTML;
    btn.innerHTML = "Salvando pedido...";

    try {
      var resultado = await window.API.criarReserva(
        dados,
        itens.map(function (i) {
          return { id: i.id, nome: i.nome, valor_ate_4h: valorItem(i) };
        }),
        locais
      );
      window.Carrinho.limpar();
      window.open(resultado.whatsapp_url, "_blank");
      lista.innerHTML = '<p class="mensagem-vazio">Pedido enviado! Continue a conversa no WhatsApp. 🎉</p>';
      totalEl.textContent = moeda(0);
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  });

  render();
})();

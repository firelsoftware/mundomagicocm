/* Página de depoimentos: lista os aprovados e recebe novos.

   O que chega pelo formulário entra como não aprovado. Isso não depende de
   boa vontade desta tela: a policy depoimentos_envia no banco recusa qualquer
   inserção que já venha marcada como aprovada. */
(function () {
  "use strict";

  var lista = document.getElementById("lista-depoimentos");
  var form = document.getElementById("form-depoimento");
  if (!lista) return;

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function cartao(d) {
    var img = d.imagem_url
      ? '<img src="../static/' + esc(d.imagem_url) + '" alt="' + esc(d.nome) +
        '" class="depo-foto" onerror="this.style.display=\'none\'" />'
      : "";
    return '<figure class="depo-card">' + img +
      '<i class="fa-solid fa-quote-left"></i>' +
      "<blockquote>" + esc(d.texto) + "</blockquote>" +
      "<figcaption>" + esc(d.nome) + "</figcaption>" +
      "</figure>";
  }

  async function carregar() {
    if (!window.API.configurado()) {
      lista.innerHTML = '<p class="vazio">Depoimentos indisponíveis no momento.</p>';
      return;
    }
    try {
      var itens = await window.API.listarDepoimentos();
      var aprovados = itens.filter(function (d) { return d.aprovado; });
      lista.innerHTML = aprovados.length
        ? aprovados.map(cartao).join("")
        : '<p class="vazio">Seja o primeiro a contar como foi a sua festa.</p>';
    } catch (e) {
      console.error(e);
      lista.innerHTML = '<p class="vazio">Não foi possível carregar os depoimentos.</p>';
    }
  }

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var nome = document.getElementById("depo-nome");
      var texto = document.getElementById("depo-texto");
      var botao = form.querySelector('button[type="submit"]');
      var aviso = document.getElementById("depo-aviso");

      if (!nome.value.trim() || !texto.value.trim()) {
        alert("Preencha seu nome e o depoimento.");
        return;
      }

      botao.disabled = true;
      try {
        await window.API.enviarDepoimento(nome.value, texto.value);
        form.reset();
        if (aviso) {
          aviso.hidden = false;
          aviso.textContent = "Obrigado! Seu depoimento será publicado após revisão.";
        }
      } catch (erro) {
        alert(erro.message);
      } finally {
        botao.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", carregar);
})();

/* Monta as vitrines da home a partir do catálogo no Supabase.

   Antes o HTML trazia os 27 brinquedos escritos à mão; agora o container
   [data-vitrines] é preenchido aqui, então mudar preço no painel reflete no
   site sem ninguém editar arquivo. */
(function () {
  "use strict";

  /* Nome e descrição são digitados no painel. Se entrarem crus no innerHTML,
     um administrador consegue injetar script na home. */
  function esc(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function plural(n, singular, plural_) {
    return n + " " + (n === 1 ? singular : plural_);
  }

  function cartao(b, raiz) {
    var img = raiz + "static/" + (b.imagem_url || "img/mundomagicomascote.png");
    var fallback = raiz + "static/img/mundomagicomascote.png";
    return '' +
      '<article class="produto-card">' +
        '<div class="produto-img">' +
          '<img src="' + esc(img) + '" alt="' + esc(b.nome) + '" ' +
               'onerror="this.src=\'' + esc(fallback) + '\'" />' +
          (b.destaque ? '<span class="badge-destaque">Destaque</span>' : '') +
        '</div>' +
        '<div class="produto-body">' +
          '<h3>' + esc(b.nome) + '</h3>' +
          '<p class="produto-desc">' + esc(b.descricao) + '</p>' +
          '<div class="produto-rodape">' +
            '<span class="produto-preco">R$ ' + window.API.moeda(b.valor_ate_4h) + ' <small>até 4h</small></span>' +
            '<button class="btn btn-add" data-id="' + esc(b.id) + '" ' +
                    'data-nome="' + esc(b.nome) + '" ' +
                    'data-valor="' + esc(b.valor_ate_4h) + '" ' +
                    'data-imagem="' + esc(img) + '">' +
              '<i class="fa-solid fa-plus"></i> Adicionar' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function secao(categoria, itens, raiz) {
    return '' +
      '<section class="vitrine" id="' + esc(categoria.slug) + '">' +
        '<div class="vitrine-head">' +
          '<h2>' + esc(categoria.nome) + '</h2>' +
          '<p>' + plural(itens.length, "opção para a sua festa", "opções para a sua festa") + '</p>' +
        '</div>' +
        '<div class="carrossel">' +
          '<button class="carrossel-btn prev" type="button" aria-label="Anterior"><i class="fa-solid fa-chevron-left"></i></button>' +
          '<div class="produtos-trilho">' +
            itens.map(function (b) { return cartao(b, raiz); }).join("") +
          '</div>' +
          '<button class="carrossel-btn next" type="button" aria-label="Próximo"><i class="fa-solid fa-chevron-right"></i></button>' +
        '</div>' +
      '</section>';
  }

  /* Precisa rodar depois que os cards existem no DOM, senão não há trilho
     para medir nem setas para ligar. */
  function ligarCarrosseis(escopo) {
    (escopo || document).querySelectorAll(".carrossel").forEach(function (car) {
      var trilho = car.querySelector(".produtos-trilho");
      var prev = car.querySelector(".prev");
      var next = car.querySelector(".next");
      if (!trilho || !prev || !next) return;

      function passo() {
        var card = trilho.querySelector(".produto-card");
        var estilos = window.getComputedStyle(trilho);
        var gap = parseFloat(estilos.columnGap || estilos.gap) || 0;
        return card ? card.offsetWidth + gap : 320;
      }
      function quantidadeVisivel() {
        return Math.max(1, Math.round(trilho.clientWidth / passo()));
      }
      function atualizar() {
        var fim = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 4;
        prev.classList.toggle("oculto", trilho.scrollLeft <= 4);
        next.classList.toggle("oculto", fim);
      }
      prev.addEventListener("click", function () {
        trilho.scrollBy({ left: -passo() * quantidadeVisivel(), behavior: "smooth" });
      });
      next.addEventListener("click", function () {
        trilho.scrollBy({ left: passo() * quantidadeVisivel(), behavior: "smooth" });
      });
      trilho.addEventListener("scroll", atualizar);
      window.addEventListener("resize", atualizar);
      atualizar();
    });
  }

  async function montar() {
    var alvo = document.querySelector("[data-vitrines]");
    if (!alvo) return;

    var raiz = alvo.dataset.raiz || "";

    if (!window.API.configurado()) {
      alvo.innerHTML = '<p class="vitrine-aviso">Catálogo indisponível no momento.</p>';
      return;
    }

    try {
      var categorias = await window.API.listarCategorias();
      var brinquedos = await window.API.listarBrinquedos();

      var html = categorias.map(function (cat) {
        var itens = brinquedos.filter(function (b) { return b.categoria_id === cat.id && b.ativo; });
        return itens.length ? secao(cat, itens, raiz) : "";
      }).join("");

      alvo.innerHTML = html || '<p class="vitrine-aviso">Nenhum brinquedo cadastrado ainda.</p>';
      ligarCarrosseis(alvo);

      /* Quem chegou por link tipo /#mesa caiu numa página que ainda não tinha a
         seção; agora que existe, leva até ela. */
      if (window.location.hash) {
        var destino = document.querySelector(window.location.hash);
        if (destino) destino.scrollIntoView();
      }
    } catch (erro) {
      console.error(erro);
      alvo.innerHTML = '<p class="vitrine-aviso">Não foi possível carregar o catálogo. Recarregue a página.</p>';
    }
  }

  window.Vitrine = { montar: montar, ligarCarrosseis: ligarCarrosseis };
  document.addEventListener("DOMContentLoaded", montar);
})();

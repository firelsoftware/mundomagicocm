/* Carrinho do Mundo Mágico CM — guardado no navegador (localStorage).
   Carregado em todas as páginas: cuida do botão "adicionar" e do contador. */
(function () {
  "use strict";

  window.Carrinho = {
    obter: function () {
      try { return JSON.parse(localStorage.getItem("carrinho")) || []; }
      catch (e) { return []; }
    },
    salvar: function (itens) {
      localStorage.setItem("carrinho", JSON.stringify(itens));
      atualizarBadge();
    },
    adicionar: function (item) {
      var itens = this.obter();
      itens.push(item);
      this.salvar(itens);
    },
    remover: function (index) {
      var itens = this.obter();
      itens.splice(index, 1);
      this.salvar(itens);
    },
    limpar: function () { this.salvar([]); },
  };

  function atualizarBadge() {
    var n = window.Carrinho.obter().length;
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = n;
      el.classList.toggle("vazio", n === 0);
    });
  }

  function toast(texto) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = texto;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".btn-add");
    if (!btn) return;
    window.Carrinho.adicionar({
      // o id é o que permite o banco conferir o preço na hora da reserva
      id: Number(btn.dataset.id),
      nome: btn.dataset.nome,
      valor: Number(btn.dataset.valor),
      imagem: btn.dataset.imagem,
    });
    toast(btn.dataset.nome + " adicionado ao carrinho!");
  });

  document.addEventListener("DOMContentLoaded", atualizarBadge);
})();

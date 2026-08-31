/* Login. O perfil da conta decide para onde ir: equipe vai ao painel, cliente
   volta para a loja. Nada aqui protege o painel de verdade — quem protege é o
   RLS do banco; esta tela só evita mostrar uma página que não vai funcionar. */
(function () {
  "use strict";

  var form = document.getElementById("form-login");
  var aviso = document.getElementById("login-aviso");
  if (!form) return;

  function mostrarErro(texto) {
    if (!aviso) { alert(texto); return; }
    aviso.hidden = false;
    aviso.textContent = texto;
  }

  // Quem já está logado não precisa ver a tela de novo.
  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.API.configurado()) {
      mostrarErro("Login indisponível nesta versão do site.");
      return;
    }
    try {
      var p = await window.Auth.perfil();
      if (p) window.location.replace(window.Auth.destino(p, "../"));
    } catch (e) { /* sem sessão, segue na tela */ }
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!window.API.configurado()) {
      mostrarErro("Login indisponível nesta versão do site.");
      return;
    }

    var botao = form.querySelector('button[type="submit"]');
    var textoOriginal = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = "Entrando...";
    if (aviso) aviso.hidden = true;

    try {
      var perfil = await window.Auth.entrar(
        form.querySelector('[name="email"]').value,
        form.querySelector('[name="senha"]').value
      );
      window.location.href = window.Auth.destino(perfil, "../");
    } catch (erro) {
      mostrarErro(erro.message);
      botao.disabled = false;
      botao.innerHTML = textoOriginal;
    }
  });
})();

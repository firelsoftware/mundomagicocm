/* Pedido de link para redefinir a senha.

   A tela responde a mesma coisa para qualquer e-mail digitado, exista conta ou
   não. Se dissesse "não encontramos essa conta", qualquer pessoa poderia ficar
   testando endereços até descobrir quem é da equipe.

   O link chega pelo e-mail e volta para trocar-senha/, que é a mesma tela do
   primeiro acesso — de lá a pessoa já entra com a sessão aberta pelo link. */
(function () {
  "use strict";

  var form = document.getElementById("form-recuperar");
  var aviso = document.getElementById("recuperar-aviso");
  var enviado = document.getElementById("enviado");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    aviso.hidden = true;

    if (!window.API.configurado()) {
      aviso.hidden = false;
      aviso.textContent = "Indisponível no momento.";
      return;
    }

    var botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    botao.innerHTML = "Enviando...";

    /* Nem o tempo de resposta pode entregar se a conta existe: o resultado é o
       mesmo tenha o envio dado certo ou não. */
    try {
      await window.Auth.pedirRecuperacao(document.getElementById("email").value, "../");
    } catch (erro) {
      console.warn(erro);
    }

    form.hidden = true;
    enviado.hidden = false;
  });
})();

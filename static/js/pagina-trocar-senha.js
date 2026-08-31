/* Troca obrigatória da senha provisória.

   Quem cria a conta de outra pessoa define uma senha temporária e a passa por
   fora. No primeiro acesso o site para aqui: a pessoa define a senha dela, e
   quem criou a conta deixa de conhecê-la.

   A ordem importa. Primeiro troca a senha no auth; só se der certo é que o
   perfil deixa de estar marcado como provisório. Se fizesse ao contrário e a
   troca falhasse, a pessoa ficaria com a senha antiga e sem ser avisada de
   novo. */
(function () {
  "use strict";

  var form = document.getElementById("form-senha");
  var aviso = document.getElementById("senha-aviso");
  if (!form) return;

  function mostrarErro(texto) {
    aviso.hidden = false;
    aviso.textContent = texto;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    aviso.hidden = true;

    var nova = document.getElementById("senha-nova").value;
    var confirma = document.getElementById("senha-confirma").value;

    if (nova !== confirma) {
      mostrarErro("As duas senhas não são iguais.");
      return;
    }
    if (nova.length < 8) {
      mostrarErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    var botao = form.querySelector('button[type="submit"]');
    var textoOriginal = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = "Salvando...";

    try {
      var r = await window.API.client().auth.updateUser({ password: nova });
      if (r.error) throw new Error(r.error.message);

      await window.Auth.senhaDefinida();

      var p = await window.Auth.perfil();
      window.location.href = window.Auth.destino(p, "../");
    } catch (erro) {
      mostrarErro(erro.message);
      botao.disabled = false;
      botao.innerHTML = textoOriginal;
    }
  });

  /* Quando a pessoa chega pelo link do e-mail, o Supabase pendura o resultado
     no fim do endereço. Deu certo, vem a sessão e o SDK a guarda sozinho; deu
     errado, vem o motivo — e é melhor explicar do que mandar para o login sem
     dizer nada, que é como a pessoa tenta o mesmo link três vezes. */
  function erroDoLink() {
    var pedaco = window.location.hash.replace(/^#/, "");
    if (!pedaco) return null;

    var partes = new URLSearchParams(pedaco);
    if (!partes.get("error") && !partes.get("error_code")) return null;

    return partes.get("error_code") === "otp_expired"
      ? "Esse link já venceu ou já foi usado. Peça um novo."
      : "Não foi possível abrir esse link. Peça um novo.";
  }

  function trocarPorMensagem(titulo, texto) {
    form.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i>' +
      "<h1>" + titulo + "</h1>" +
      '<p class="senha-intro">' + texto + "</p>" +
      '<a href="../recuperar-senha/" class="btn btn-primary btn-block">' +
      '<i class="fa-solid fa-paper-plane"></i> Pedir novo link</a>';
  }

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.API.configurado()) {
      mostrarErro("Indisponível no momento.");
      return;
    }

    var falha = erroDoLink();
    if (falha) {
      trocarPorMensagem("Link expirado", falha);
      return;
    }

    var p = await window.Auth.perfil();
    if (!p) {
      window.location.replace("../login/");
      return;
    }

    /* Quem já definiu a própria senha não tem o que fazer aqui — mas pode ter
       chegado pelo link de recuperação ou pelo endereço direto querendo trocar
       de novo, o que é legítimo. */
    if (!p.senha_provisoria) {
      document.querySelector(".senha-intro").textContent =
        "Escolha uma nova senha para a sua conta.";
      document.querySelector("h1").textContent = "Trocar senha";
    }
  });
})();

/* Camada de dados do Mundo Mágico CM.
   Tudo que fala com o Supabase passa por aqui — as páginas só chamam funções.

   Carregue depois do SDK e do config.js:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="static/js/config.js"></script>
     <script src="static/js/api.js"></script> */
(function () {
  "use strict";

  var cfg = window.SUPABASE_CONFIG || {};
  var semConfig = !cfg.url || !cfg.anonKey || cfg.url.indexOf("COLE_AQUI") === 0;
  // O SDK vem de CDN. Se a rede do visitante bloquear ou o CDN cair, ele não
  // existe — e sem esta checagem a página inteira quebraria no createClient.
  var semSDK = !window.supabase || typeof window.supabase.createClient !== "function";
  var pendente = semConfig || semSDK;

  if (semConfig) {
    console.warn("Supabase ainda não configurado: preencha static/js/config.js.");
  } else if (semSDK) {
    console.error("SDK do Supabase não carregou.");
  }

  var client = pendente ? null : window.supabase.createClient(cfg.url, cfg.anonKey);

  /* Erro do PostgREST vem como objeto; as mensagens que o banco levanta nos
     triggers chegam em .message e são escritas para o cliente ler. */
  function falhar(erro) {
    if (!erro) return;
    throw new Error(erro.message || "Não foi possível concluir a operação.");
  }

  function exigirConfig() {
    if (pendente) throw new Error("Supabase não configurado.");
  }

  /* Mesma conta do trigger reserva_valida(): o valor cadastrado cobre até 4h e
     cada hora extra custa um quarto dele. Aqui serve só para mostrar o preço
     enquanto o cliente monta o pacote — o total que vale é o que o banco grava. */
  function calcularTotal(valores, horas) {
    var base = (window.REGRAS && window.REGRAS.horasBase) || 4;
    var qtd = Math.max(1, parseInt(horas, 10) || 1);
    var soma = valores.reduce(function (t, v) { return t + (Number(v) || 0); }, 0);
    var extras = Math.max(0, qtd - base);
    return Math.round((soma + extras * (soma / base)) * 100) / 100;
  }

  function moeda(valor) {
    return (Number(valor) || 0).toFixed(2).replace(".", ",");
  }

  function montarMensagem(dados, itens, locais, valorLocal, valorTotal) {
    var base = (window.REGRAS && window.REGRAS.horasBase) || 4;
    var extras = Math.max(0, dados.qtd_horas - base);
    function dataBR(iso) { return iso.split("-").reverse().join("/"); }
    var linhas = [
      "*NOVO PEDIDO - MUNDO MÁGICO CM*", "",
      "*Cliente:* " + dados.nome_cliente,
      "*Telefone:* " + dados.telefone_cliente,
      "*Data:* " + dataBR(dados.data_evento),
      "*Início:* " + dados.hora_inicio + " (" + dados.qtd_horas + "h de evento)",
    ];
    if (locais.length === 1) {
      linhas.push("*Local:* " + locais[0]);
    } else {
      linhas.push("*Locais (" + locais.length + ") no mesmo dia:*");
      locais.forEach(function (local, i) { linhas.push("  " + (i + 1) + ". " + local); });
    }
    linhas.push("", "*BRINQUEDOS SELECIONADOS:*");
    itens.forEach(function (item) {
      linhas.push("• " + item.nome + " (R$ " + moeda(item.valor_ate_4h) + " até 4h)");
    });
    linhas.push("");
    if (extras) linhas.push("_Inclui " + extras + "h extra(s) além das " + base + "h._");
    if (locais.length > 1) {
      linhas.push("_Valor por local: R$ " + moeda(valorLocal) + " x " + locais.length + " locais._");
    }
    linhas.push("*VALOR ESTIMADO: R$ " + moeda(valorTotal) + "*");
    linhas.push("_Valor final pode ter desconto, combinado no atendimento._");
    return linhas.join("\n");
  }

  function linkWhatsApp(mensagem) {
    return "https://wa.me/" + window.EMPRESA.whatsapp + "?text=" + encodeURIComponent(mensagem);
  }

  window.API = {
    client: function () { return client; },
    configurado: function () { return !pendente; },
    calcularTotal: calcularTotal,
    moeda: moeda,
    linkWhatsApp: linkWhatsApp,

    // ---------------------------------------------------------------- loja

    /* O RLS já filtra: visitante recebe só os ativos, admin recebe todos. */
    listarBrinquedos: async function () {
      exigirConfig();
      var r = await client
        .from("brinquedos")
        .select("id, nome, descricao, valor_ate_4h, imagem_url, destaque, ativo, categoria_id, categorias(nome, slug, ordem)")
        .order("valor_ate_4h", { ascending: false });
      falhar(r.error);
      return r.data;
    },

    listarCategorias: async function () {
      exigirConfig();
      var r = await client.from("categorias").select("id, nome, slug, ordem").order("ordem");
      falhar(r.error);
      return r.data;
    },

    listarDepoimentos: async function () {
      exigirConfig();
      var r = await client
        .from("depoimentos")
        .select("id, nome, texto, imagem_url, aprovado, criado_em")
        .order("criado_em", { ascending: false });
      falhar(r.error);
      return r.data;
    },

    /* Entra aguardando revisão; a policy do banco impede publicar direto. */
    enviarDepoimento: async function (nome, texto) {
      exigirConfig();
      var r = await client.from("depoimentos").insert({
        nome: nome.trim(), texto: texto.trim(), aprovado: false,
      });
      falhar(r.error);
    },

    consultarDisponibilidade: async function (data) {
      exigirConfig();
      var r = await client.rpc("disponibilidade", { dia: data });
      falhar(r.error);
      return (r.data && r.data[0]) || null;
    },

    /* Grava as reservas pela função criar_reserva() e monta o link do WhatsApp
       com o valor que o BANCO devolveu — não com o que esta tela somou.

       Vai por rpc e não por insert direto porque o visitante não tem permissão
       de ler a tabela de reservas, e um insert com retorno esbarraria nisso. */
    criarReserva: async function (dados, itens, locais) {
      exigirConfig();

      var r = await client.rpc("criar_reserva", {
        p_nome: dados.nome_cliente.trim(),
        p_telefone: dados.telefone_cliente.trim(),
        p_data: dados.data_evento,
        p_hora: dados.hora_inicio,
        p_horas: dados.qtd_horas,
        p_locais: locais,
        p_itens: itens.map(function (item) { return { id: item.id, nome: item.nome }; }),
      });
      falhar(r.error);

      var criadas = r.data || [];
      if (!criadas.length) throw new Error("A reserva não foi registrada. Tente novamente.");

      var valorLocal = Number(criadas[0].valor_total);
      var totalReal = criadas.reduce(function (t, x) { return t + Number(x.valor_total); }, 0);
      var mensagem = montarMensagem(dados, itens, locais, valorLocal, totalReal);

      return {
        ids: criadas.map(function (x) { return x.id; }),
        valor_local: valorLocal,
        valor_total: totalReal,
        whatsapp_url: linkWhatsApp(mensagem),
      };
    },

    // --------------------------------------------------------------- painel

    salvarBrinquedo: async function (brinquedo) {
      exigirConfig();
      var r = brinquedo.id
        ? await client.from("brinquedos").update(brinquedo).eq("id", brinquedo.id)
        : await client.from("brinquedos").insert(brinquedo);
      falhar(r.error);
    },

    excluirBrinquedo: async function (id) {
      exigirConfig();
      falhar((await client.from("brinquedos").delete().eq("id", id)).error);
    },

    listarReservas: async function () {
      exigirConfig();
      var r = await client
        .from("reservas")
        .select("id, nome_cliente, telefone_cliente, data_evento, hora_inicio, qtd_horas, local_evento, itens, valor_total, status, criado_em")
        .order("criado_em", { ascending: false });
      falhar(r.error);
      return r.data;
    },

    atualizarStatusReserva: async function (id, status) {
      exigirConfig();
      falhar((await client.from("reservas").update({ status: status }).eq("id", id)).error);
    },

    salvarDepoimento: async function (depoimento) {
      exigirConfig();
      var r = depoimento.id
        ? await client.from("depoimentos").update(depoimento).eq("id", depoimento.id)
        : await client.from("depoimentos").insert(depoimento);
      falhar(r.error);
    },

    excluirDepoimento: async function (id) {
      exigirConfig();
      falhar((await client.from("depoimentos").delete().eq("id", id)).error);
    },

    /* Equipe. Criar e apagar a CONTA em si exige a chave service_role, que não
       pode existir num site estático — então aqui o que se gerencia é o
       privilégio, não a conta. Tirar alguém é devolver para 'cliente': o RLS
       corta o acesso na mesma hora. */
    listarEquipe: async function () {
      exigirConfig();
      var r = await client
        .from("profiles")
        .select("id, nome, telefone, role, senha_provisoria, criado_em")
        .order("role")
        .order("nome");
      falhar(r.error);
      return r.data;
    },

    definirPerfil: async function (id, role) {
      exigirConfig();
      falhar((await client.from("profiles").update({ role: role }).eq("id", id)).error);
    },

    /* Usado depois de redefinir a senha de alguém no painel do Supabase: força
       a pessoa a escolher a senha dela no próximo acesso. */
    exigirTrocaDeSenha: async function (id) {
      exigirConfig();
      falhar((await client.from("profiles").update({ senha_provisoria: true }).eq("id", id)).error);
    },

    listarBloqueios: async function (ano, mes) {
      exigirConfig();
      var inicio = ano + "-" + String(mes).padStart(2, "0") + "-01";
      var fim = (mes === 12 ? ano + 1 : ano) + "-" + String(mes === 12 ? 1 : mes + 1).padStart(2, "0") + "-01";
      var r = await client
        .from("bloqueios")
        .select("id, data, dia_inteiro, slots, hora_inicio, hora_fim, motivo")
        .gte("data", inicio).lt("data", fim).order("data");
      falhar(r.error);
      return r.data;
    },

    criarBloqueio: async function (bloqueio) {
      exigirConfig();
      falhar((await client.from("bloqueios").insert(bloqueio)).error);
    },

    excluirBloqueio: async function (id) {
      exigirConfig();
      falhar((await client.from("bloqueios").delete().eq("id", id)).error);
    },
  };
})();

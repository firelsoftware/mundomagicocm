"""Views do Mundo Mágico CM (Django)."""

import calendar as cal
import json
from collections import Counter, defaultdict
from datetime import date
from urllib.parse import quote

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import user_passes_test
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.dateparse import parse_date, parse_time
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import Brinquedo, Categoria, Reserva, Depoimento, Bloqueio, calcular_total, HORAS_BASE

MAX = settings.MAX_EVENTOS_DIA
NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
             "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

staff_required = user_passes_test(lambda u: u.is_active and u.is_staff, login_url="login")


# ----------------------------- helpers -----------------------------
def whatsapp_link(mensagem):
    return f"https://wa.me/{settings.EMPRESA['whatsapp']}?text={quote(mensagem)}"


def eventos_no_dia(d):
    return Reserva.objects.filter(data_evento=d).exclude(status="cancelado").count()


def slots_bloqueados(d):
    total = 0
    for b in Bloqueio.objects.filter(data=d):
        total += MAX if b.dia_inteiro else (b.slots or 0)
    return total


def slots_livres(d):
    return max(0, MAX - eventos_no_dia(d) - slots_bloqueados(d))


def montar_mensagem(dados, itens, qtd_horas, locais, valor_local, valor_total):
    data = dados.get("data_evento", "")
    data_fmt = "/".join(reversed(data.split("-"))) if "-" in data else data
    horas_extra = max(0, qtd_horas - HORAS_BASE)
    linhas = [
        "*NOVO PEDIDO - MUNDO MÁGICO CM*", "",
        f"*Cliente:* {dados.get('nome_cliente','')}",
        f"*Telefone:* {dados.get('telefone_cliente','')}",
        f"*Data:* {data_fmt}",
        f"*Início:* {dados.get('hora_inicio','')} ({qtd_horas}h de evento)",
    ]
    if len(locais) == 1:
        linhas.append(f"*Local:* {locais[0]}")
    else:
        linhas.append(f"*Locais ({len(locais)}) no mesmo dia:*")
        for i, local in enumerate(locais, 1):
            linhas.append(f"  {i}. {local}")
    linhas += ["", "*BRINQUEDOS SELECIONADOS:*"]
    for i in itens:
        base = float(i.get("valor_ate_4h", 0))
        linhas.append(f"• {i.get('nome','')} (R$ {base:.2f} até 4h)")
    linhas.append("")
    if horas_extra:
        linhas.append(f"_Inclui {horas_extra}h extra(s) além das 4h._")
    if len(locais) > 1:
        linhas.append(f"_Valor por local: R$ {valor_local:.2f} x {len(locais)} locais._")
    linhas.append(f"*VALOR ESTIMADO: R$ {valor_total:.2f}*")
    linhas.append("_Valor final pode ter desconto, combinado no atendimento._")
    return "\n".join(linhas)


# ----------------------------- loja pública -----------------------------
def index(request):
    categorias = Categoria.objects.all()
    vitrines = []
    for cat in categorias:
        itens = list(cat.brinquedos.filter(ativo=True))
        if itens:
            vitrines.append((cat, itens))
    destaques = Brinquedo.objects.filter(destaque=True, ativo=True)
    depoimentos = Depoimento.objects.filter(aprovado=True)[:6]
    return render(request, "index.html", {
        "vitrines": vitrines, "destaques": destaques, "depoimentos": depoimentos,
    })


def sobre(request):
    return render(request, "sobre.html")


def contato(request):
    return render(request, "contato.html")


def carrinho(request):
    return render(request, "carrinho.html")


def depoimentos(request):
    if request.method == "POST":
        nome = (request.POST.get("nome") or "").strip()
        texto = (request.POST.get("texto") or "").strip()
        if not nome or not texto:
            messages.error(request, "Preencha seu nome e o depoimento.")
        else:
            Depoimento.objects.create(nome=nome, texto=texto, aprovado=False)
            messages.success(request, "Obrigado! Seu depoimento será publicado após aprovação.")
        return redirect("depoimentos")
    aprovados = Depoimento.objects.filter(aprovado=True)
    return render(request, "depoimentos.html", {"depoimentos": aprovados})


# ----------------------------- API -----------------------------
def api_brinquedos(request):
    itens = Brinquedo.objects.filter(ativo=True)
    return JsonResponse([
        {"id": b.id, "nome": b.nome, "descricao": b.descricao,
         "valor_ate_4h": b.valor, "valor_hora_extra": b.valor_hora_extra,
         "imagem_url": b.imagem_url,
         "categoria": b.categoria.nome if b.categoria else None,
         "destaque": b.destaque}
        for b in itens
    ], safe=False)


def api_disponibilidade(request):
    data_str = (request.GET.get("data") or "").strip()
    d = parse_date(data_str)
    if not d:
        return JsonResponse({"error": "Informe a data."}, status=400)
    livres = slots_livres(d)
    return JsonResponse({
        "data": data_str, "capacidade": MAX,
        "ocupados": eventos_no_dia(d), "bloqueados": slots_bloqueados(d),
        "livres": livres, "disponivel": livres > 0,
    })


@csrf_exempt
@require_POST
def api_reservas(request):
    try:
        dados = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        dados = {}
    obrig = ["nome_cliente", "telefone_cliente", "data_evento", "hora_inicio", "qtd_horas"]
    faltando = [c for c in obrig if not str(dados.get(c, "")).strip()]
    itens = dados.get("itens") or []
    locais = dados.get("locais") or [dados.get("local_evento", "")]
    locais = [str(l).strip() for l in locais if str(l).strip()][:MAX]
    if faltando or not itens or not locais:
        return JsonResponse({"error": "Preencha todos os dados, escolha ao menos um brinquedo e informe o local."}, status=400)

    d = parse_date(dados["data_evento"].strip())
    hora = parse_time(dados["hora_inicio"].strip())
    if not d or not hora:
        return JsonResponse({"error": "Data ou hora inválida."}, status=400)
    try:
        qtd_horas = max(1, int(dados.get("qtd_horas", 1)))
    except (TypeError, ValueError):
        qtd_horas = 1

    livres = slots_livres(d)
    if len(locais) > livres:
        return JsonResponse({
            "error": f"Sem disponibilidade para {len(locais)} local(is). Restam {livres} horário(s) nesse dia.",
            "livres": livres,
        }, status=409)

    valor_local = calcular_total((i.get("valor_ate_4h", 0) for i in itens), qtd_horas)
    valor_total = round(valor_local * len(locais), 2)
    mensagem = montar_mensagem(dados, itens, qtd_horas, locais, valor_local, valor_total)

    ids = []
    for local in locais:
        r = Reserva.objects.create(
            nome_cliente=dados["nome_cliente"].strip(),
            telefone_cliente=dados["telefone_cliente"].strip(),
            data_evento=d, hora_inicio=hora, qtd_horas=qtd_horas,
            local_evento=local, itens=itens, valor_total=valor_local,
            mensagem_whatsapp=mensagem, status="pendente",
        )
        ids.append(str(r.id))

    return JsonResponse({
        "ids": ids, "locais": len(locais), "valor_total": valor_total,
        "whatsapp_url": whatsapp_link(mensagem),
    }, status=201)


# ----------------------------- login / painel -----------------------------
def destino_pos_login(user):
    """O perfil decide o destino: equipe vai ao painel, cliente volta para a loja."""
    return "painel" if user.is_staff else "index"


def login_view(request):
    if request.user.is_authenticated:
        return redirect(destino_pos_login(request.user))
    if request.method == "POST":
        user = authenticate(request,
                            username=(request.POST.get("usuario") or "").strip().lower(),
                            password=request.POST.get("senha") or "")
        if user:
            login(request, user)
            proximo = request.GET.get("next") or ""
            if proximo and url_has_allowed_host_and_scheme(
                    proximo, allowed_hosts={request.get_host()}, require_https=request.is_secure()):
                return redirect(proximo)
            return redirect(destino_pos_login(user))
        messages.error(request, "E-mail ou senha inválidos.")
    return render(request, "login.html")


def logout_view(request):
    logout(request)
    return redirect("index")


@staff_required
def painel(request):
    brinquedos = Brinquedo.objects.all().order_by("nome")
    reservas = Reserva.objects.all()
    pendentes = Depoimento.objects.filter(aprovado=False)
    depoimentos = Depoimento.objects.all()
    categorias = Categoria.objects.all()
    receita = sum(float(r.valor_total) for r in reservas if r.status == "pago")
    return render(request, "painel.html", {
        "brinquedos": brinquedos, "reservas": reservas,
        "depoimentos": depoimentos, "depoimentos_pendentes": pendentes,
        "categorias": categorias,
        "receita": receita,
        "reservas_pendentes": reservas.filter(status="pendente").count(),
        "brinquedos_ativos": brinquedos.filter(ativo=True).count(),
        "depoimentos_pendentes_total": pendentes.count(),
    })


@staff_required
def relatorios(request):
    reservas = Reserva.objects.all()
    pagas = reservas.filter(status="pago")
    receita = sum(float(r.valor_total) for r in pagas)
    ticket_medio = receita / pagas.count() if pagas.count() else 0

    brinquedos_contagem = Counter()
    for reserva in reservas:
        for item in reserva.itens or []:
            nome = str(item.get("nome") or "Brinquedo").strip()
            brinquedos_contagem[nome] += 1

    meses = defaultdict(lambda: {"reservas": 0, "receita": 0})
    for reserva in reservas:
        chave = reserva.data_evento.strftime("%Y-%m")
        meses[chave]["reservas"] += 1
        if reserva.status == "pago":
            meses[chave]["receita"] += float(reserva.valor_total)
    relatorio_mensal = [
        {"mes": f"{chave[5:7]}/{chave[:4]}", **valores}
        for chave, valores in sorted(meses.items(), reverse=True)[:12]
    ]

    return render(request, "relatorios.html", {
        "total_reservas": reservas.count(),
        "reservas_pendentes": reservas.filter(status="pendente").count(),
        "reservas_pagas": pagas.count(),
        "reservas_canceladas": reservas.filter(status="cancelado").count(),
        "reservas_futuras": reservas.filter(data_evento__gte=date.today()).exclude(status="cancelado").count(),
        "receita": receita,
        "ticket_medio": ticket_medio,
        "brinquedos_total": Brinquedo.objects.count(),
        "brinquedos_ativos": Brinquedo.objects.filter(ativo=True).count(),
        "brinquedos_destaque": Brinquedo.objects.filter(destaque=True, ativo=True).count(),
        "depoimentos_total": Depoimento.objects.count(),
        "depoimentos_aprovados": Depoimento.objects.filter(aprovado=True).count(),
        "depoimentos_pendentes": Depoimento.objects.filter(aprovado=False).count(),
        "top_brinquedos": brinquedos_contagem.most_common(5),
        "relatorio_mensal": relatorio_mensal,
    })


@staff_required
def agenda(request):
    hoje = date.today()
    try:
        ano = int(request.GET.get("ano", hoje.year))
        mes = int(request.GET.get("mes", hoje.month))
    except (TypeError, ValueError):
        ano, mes = hoje.year, hoje.month

    reservas = Reserva.objects.filter(data_evento__year=ano, data_evento__month=mes).order_by("hora_inicio")
    bloqueios = Bloqueio.objects.filter(data__year=ano, data__month=mes)
    por_dia, bloq_por_dia = {}, {}
    for r in reservas:
        por_dia.setdefault(r.data_evento, []).append(r)
    for b in bloqueios:
        bloq_por_dia.setdefault(b.data, []).append(b)

    semanas = []
    for week in cal.Calendar(firstweekday=6).monthdatescalendar(ano, mes):
        cells = []
        for d in week:
            eventos = por_dia.get(d, [])
            bls = bloq_por_dia.get(d, [])
            ativos = [e for e in eventos if e.status != "cancelado"]
            bloq_slots = sum(MAX if b.dia_inteiro else (b.slots or 0) for b in bls)
            cells.append({
                "dia": d, "no_mes": d.month == mes, "hoje": d == hoje,
                "eventos": eventos, "bloqueios": bls,
                "livres": max(0, MAX - len(ativos) - bloq_slots),
            })
        semanas.append(cells)

    nav = {
        "ano_ant": ano - 1 if mes == 1 else ano, "mes_ant": 12 if mes == 1 else mes - 1,
        "ano_prox": ano + 1 if mes == 12 else ano, "mes_prox": 1 if mes == 12 else mes + 1,
    }
    return render(request, "agenda.html", {
        "ano": ano, "mes": mes, "mes_nome": NOMES_MES[mes - 1], "semanas": semanas,
        "capacidade": MAX, "nav": nav, "dias_semana": DIAS_SEMANA,
    })


# ----------------------------- ações do painel -----------------------------
def _num(value):
    try:
        return round(float(str(value).replace(",", ".")), 2)
    except (TypeError, ValueError):
        return 0


@staff_required
@require_POST
def brinquedo_criar(request):
    nome = (request.POST.get("nome") or "").strip()
    if not nome:
        messages.error(request, "Informe o nome do brinquedo.")
        return redirect("painel")
    cat_id = request.POST.get("categoria_id")
    Brinquedo.objects.create(
        nome=nome, descricao=(request.POST.get("descricao") or "").strip(),
        valor_ate_4h=_num(request.POST.get("valor_ate_4h")),
        imagem_url=(request.POST.get("imagem_url") or "").strip(),
        categoria_id=int(cat_id) if cat_id else None,
        destaque=bool(request.POST.get("destaque")), ativo=True,
    )
    messages.success(request, "Brinquedo adicionado.")
    return redirect("painel")


@staff_required
@require_POST
def brinquedo_editar(request, bid):
    b = get_object_or_404(Brinquedo, pk=bid)
    b.nome = (request.POST.get("nome") or b.nome).strip()
    b.valor_ate_4h = _num(request.POST.get("valor_ate_4h"))
    cat_id = request.POST.get("categoria_id")
    b.categoria_id = int(cat_id) if cat_id else None
    b.destaque = bool(request.POST.get("destaque"))
    b.ativo = bool(request.POST.get("ativo"))
    if request.POST.get("imagem_url") is not None:
        b.imagem_url = request.POST.get("imagem_url").strip()
    if request.POST.get("descricao") is not None:
        b.descricao = request.POST.get("descricao").strip()
    b.save()
    messages.success(request, "Brinquedo atualizado.")
    return redirect("painel")


@staff_required
@require_POST
def brinquedo_excluir(request, bid):
    get_object_or_404(Brinquedo, pk=bid).delete()
    messages.success(request, "Brinquedo removido.")
    return redirect("painel")


@staff_required
@require_POST
def reserva_status(request, rid):
    r = get_object_or_404(Reserva, pk=rid)
    novo = request.POST.get("status")
    if novo in {"pendente", "pago", "cancelado"}:
        r.status = novo
        r.save()
        messages.success(request, "Status da reserva atualizado.")
    return redirect("painel")


@staff_required
@require_POST
def depoimento_aprovar(request, did):
    d = get_object_or_404(Depoimento, pk=did)
    d.aprovado = True
    d.save()
    messages.success(request, "Depoimento aprovado.")
    return redirect("painel")


@staff_required
@require_POST
def depoimento_criar(request):
    nome = (request.POST.get("nome") or "").strip()
    texto = (request.POST.get("texto") or "").strip()
    if not nome or not texto:
        messages.error(request, "Informe o nome e o texto do depoimento.")
        return redirect("painel")
    Depoimento.objects.create(
        nome=nome,
        texto=texto,
        imagem_url=(request.POST.get("imagem_url") or "").strip(),
        aprovado=bool(request.POST.get("aprovado")),
    )
    messages.success(request, "Depoimento adicionado.")
    return redirect("painel")


@staff_required
@require_POST
def depoimento_editar(request, did):
    d = get_object_or_404(Depoimento, pk=did)
    d.nome = (request.POST.get("nome") or d.nome).strip()
    d.texto = (request.POST.get("texto") or d.texto).strip()
    d.imagem_url = (request.POST.get("imagem_url") or "").strip()
    d.aprovado = bool(request.POST.get("aprovado"))
    d.save()
    messages.success(request, "Depoimento atualizado.")
    return redirect("painel")


@staff_required
@require_POST
def depoimento_excluir(request, did):
    get_object_or_404(Depoimento, pk=did).delete()
    messages.success(request, "Depoimento removido.")
    return redirect("painel")


@staff_required
@require_POST
def bloqueio_criar(request):
    data_b = parse_date((request.POST.get("data") or "").strip())
    if not data_b:
        messages.error(request, "Informe a data do bloqueio.")
        return redirect("agenda")
    dia_inteiro = request.POST.get("tipo", "dia") == "dia"
    try:
        slots = max(1, int(request.POST.get("slots", 1)))
    except (TypeError, ValueError):
        slots = 1
    Bloqueio.objects.create(
        data=data_b, dia_inteiro=dia_inteiro, slots=0 if dia_inteiro else slots,
        hora_inicio=parse_time(request.POST.get("hora_inicio") or "") or None,
        hora_fim=parse_time(request.POST.get("hora_fim") or "") or None,
        motivo=(request.POST.get("motivo") or "").strip(),
    )
    messages.success(request, "Bloqueio adicionado à agenda.")
    return redirect(f"/painel/agenda/?ano={data_b.year}&mes={data_b.month}")


@staff_required
@require_POST
def bloqueio_excluir(request, bid):
    b = get_object_or_404(Bloqueio, pk=bid)
    ano, mes = b.data.year, b.data.month
    b.delete()
    messages.success(request, "Bloqueio removido.")
    return redirect(f"/painel/agenda/?ano={ano}&mes={mes}")

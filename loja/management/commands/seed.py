"""Popula o banco com o catálogo real do Mundo Mágico CM e cria o admin.

Uso:
    python manage.py seed            # popula se estiver vazio
    python manage.py seed --force    # recria o catálogo
"""

import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from loja.models import Categoria, Brinquedo, Depoimento

CATEGORIAS = [("Infláveis", "inflaveis", 1), ("Mesa", "mesa", 2), ("Digitais", "digitais", 3)]

CATALOGO = {
    "inflaveis": [
        ("Castelo", "castelo.jpg", 70.00, True, "O Castelo Inflável transforma a festa em um reino de diversão. Colorido, seguro e super animado para pular e brincar."),
        ("Tobogã Premium", "tobogapremium.jpg", 380.00, True, "Diversão em grande estilo. Gigante, colorido e cheio de emoção, ideal para garantir muita aventura, risadas e momentos inesquecíveis."),
        ("Toboágua", "toboagua.jpg", 180.00, True, "A diversão mais refrescante da festa, sucesso garantido nos dias de calor. As crianças adoram escorregar e curtir essa aventura."),
        ("Futebol de Sabão", "futebolsabao.jpg", 150.00, True, "Diversão e adrenalina garantidas. Escorregue, ria e dispute partidas cheias de diversão e muita bagunça boa."),
        ("Tobogã Piscina", "tobogapiscina.jpg", 160.00, False, "Diversão em dobro. O Mini Tobogã com Piscina de Bolinhas une o melhor dos dois mundos: escorregar e mergulhar em um mar de bolinhas."),
        ("Mult Play Tigrinho", "multplaytigrinho.jpg", 140.00, False, "Aventura e diversão em um só brinquedo. Combina escorregador, obstáculos e muita animação."),
        ("Kid Play Piu-Piu", "kidplaypiupiu.jpg", 130.00, False, "Um espaço inflável cheio de cores, desafios e muita diversão, com escorregador, obstáculos e personagens."),
        ("Alpinismo", "alpinismo.jpg", 110.00, False, "O Alpinismo Inflável é diversão radical. As crianças podem escalar e viver a sensação de uma verdadeira aventura com total segurança."),
        ("Mini Kid Play", "minikidplay.jpg", 95.00, False, "Um espaço inflável cheio de cores e desafios, feito sob medida para os pequenos. Seguro e perfeito para crianças menores."),
        ("Guerra de Cotonete", "guerracontonete.jpg", 90.00, False, "Pura diversão e desafio. Dois participantes duelam em uma base inflável usando cotonetes gigantes."),
        ("Cama Elástica 366", "camaelastica366.jpg", 85.00, False, "Cama Elástica Profissional de 3,66m de diâmetro. Máxima diversão e espaço para pular em segurança."),
        ("Bolão", "bolao.jpg", 80.00, False, "O Bolão Inflável é pura energia. Colorido e gigante, garante muitas risadas enquanto as crianças correm, chutam e brincam."),
        ("Mini Tobogã Jacaré", "minitobogajacare.jpg", 80.00, False, "Diversão que escorrega de alegria. Colorido, seguro e cheio de emoção, garante muitas risadas e momentos inesquecíveis."),
        ("Tombo Legal", "tombolegal.jpg", 75.00, False, "Quem será o próximo a cair? O Tombo Legal é pura diversão e gargalhada. Desafie os amigos e teste o equilíbrio."),
        ("Chute ao Gol", "chuteaogol.jpg", 60.00, False, "Brinquedo inflável que garante diversão e desafios, testando a pontaria dos participantes chutando a bola nos alvos."),
        ("Cama Elástica 244", "camaelastica244.jpg", 60.00, False, "Cama Elástica de 2,44m de diâmetro. Diversão garantida com segurança para todas as idades."),
        ("Piscina de Bolinha Leão", "piscinabolinhaleao.jpg", 60.00, False, "Diversão com o rei da selva. Piscina de Bolinhas Inflável que encanta com cores vibrantes e formato divertido."),
        ("Pula-Pula", "pulapula.jpg", 50.00, False, "Pura energia e diversão. O Mini Pula-Pula Inflável é perfeito para os pequenos se divertirem com segurança, colorido e cheio de alegria."),
        ("Cama Elástica", "camaelastica.jpg", 45.00, False, "A atração que não pode faltar. Diversão garantida com segurança, onde as crianças podem pular e gastar energia."),
        ("Piscina de Bolinha Tradicional", "piscinabolinhatrad.jpg", 40.00, False, "Piscina de bolinha simples, mas essencial para a diversão dos pequenos, segura e colorida."),
    ],
    "mesa": [
        ("Ping-Pong", "pingpong.jpg", 65.00, False, "Diversão e desafios para todas as idades. Com a mesa de Ping Pong do Mundo Mágico, a brincadeira é garantida."),
        ("Air Game", "airgame.jpg", 55.00, False, "O Air Game é pura diversão e desafio. Mesa de aero hockey interativa, onde dois jogadores disputam quem marca mais pontos."),
        ("Mini Sinuca", "minisinuca.jpg", 50.00, False, "Diversão em miniatura. A Sinuquinha do Mundo Mágico é perfeita para as crianças se sentirem verdadeiros campeões de sinuca."),
        ("Totó", "toto.jpg", 45.00, False, "Diversão clássica que nunca sai de moda. O Pebolim do Mundo Mágico garante partidas cheias de risadas e muita disputa saudável."),
        ("Tamancobol", "tamancobol.jpg", 40.00, False, "Tamancobol é um jogo de mesa para duas ou quatro pessoas que simula um jogo de golfe, testando a pontaria."),
        ("Jogo de Argolas", "jogoargolas.jpg", 35.00, False, "Um clássico que nunca sai de moda. As crianças se divertem tentando acertar as argolas no alvo, estimulando a coordenação motora e a concentração."),
    ],
    "digitais": [
        ("Fliperama", "fliperama.jpg", 95.00, True, "Diversão garantida para todas as idades. Leve o Fliperama do Mundo Mágico para o seu evento e reviva os clássicos com muitos jogos, competição e risadas."),
    ],
}

DEPOIMENTOS = [
    ("Ana Carolina", "Alugamos o castelo e o tobogã para o aniversário do meu filho. As crianças amaram e a equipe foi super pontual!", "cliente1.jpg"),
    ("Marcos Vinícius", "Atendimento excelente e brinquedos muito limpos e conservados. Recomendo demais!", "cliente2.jpg"),
    ("Juliana Prado", "Fechamos o pacote pelo WhatsApp em minutos. Festa perfeita, voltaremos a contratar!", "cliente3.jpg"),
]


class Command(BaseCommand):
    help = "Popula o catálogo e cria o usuário administrador."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true")

    def handle(self, *args, **options):
        force = options["force"]
        if Brinquedo.objects.exists() and not force:
            self.stdout.write("Banco já populado. Use --force para recriar.")
        else:
            if force:
                Brinquedo.objects.all().delete()
                Categoria.objects.all().delete()
                Depoimento.objects.all().delete()

            cats = {}
            for nome, slug, ordem in CATEGORIAS:
                cats[slug] = Categoria.objects.create(nome=nome, slug=slug, ordem=ordem)

            total = 0
            for slug, itens in CATALOGO.items():
                for nome, img, preco, destaque, desc in itens:
                    Brinquedo.objects.create(
                        nome=nome, descricao=desc, valor_ate_4h=preco,
                        imagem_url=f"img/{img}", categoria=cats[slug],
                        destaque=destaque, ativo=True,
                    )
                    total += 1

            for nome, texto, img in DEPOIMENTOS:
                Depoimento.objects.create(nome=nome, texto=texto, imagem_url=f"img/{img}", aprovado=True)

            self.stdout.write(self.style.SUCCESS(
                f"Catálogo: {len(cats)} categorias, {total} brinquedos, {len(DEPOIMENTOS)} depoimentos."))

        # Cria o administrador inicial (login validado pelo banco).
        user = os.environ.get("ADMIN_USER", "admbrinquedos@gmail.com")
        pwd = os.environ.get("ADMIN_PASSWORD", "mundomagico123")
        if not User.objects.filter(username=user).exists():
            User.objects.create_superuser(username=user, password=pwd, email=user)
            self.stdout.write(self.style.SUCCESS(f"Administrador '{user}' criado."))
        else:
            admin = User.objects.get(username=user)
            changed = False
            if not admin.is_staff or not admin.is_superuser:
                admin.is_staff = True
                admin.is_superuser = True
                changed = True
            if admin.email != user:
                admin.email = user
                changed = True
            if changed:
                admin.save(update_fields=["is_staff", "is_superuser", "email"])
            self.stdout.write(f"Administrador '{user}' já existe.")

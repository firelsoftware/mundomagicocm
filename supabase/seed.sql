-- ============================================================================
--  Mundo Mágico CM — catálogo real
--
--  Rode depois do schema.sql. Pode rodar quantas vezes quiser: nada duplica e
--  nada sobrescreve preço que você já tenha ajustado no painel.
--
--  As imagens continuam no repositório e são servidas pelo GitHub Pages;
--  aqui fica só o caminho.
-- ============================================================================

insert into public.categorias (nome, slug, ordem) values
  ('Infláveis', 'inflaveis', 1),
  ('Mesa', 'mesa', 2),
  ('Digitais', 'digitais', 3)
on conflict (slug) do update set nome = excluded.nome, ordem = excluded.ordem;


insert into public.brinquedos (nome, descricao, valor_ate_4h, imagem_url, categoria_id, destaque, ativo) values
  ('Tobogã Premium', 'Diversão em grande estilo. Gigante, colorido e cheio de emoção, ideal para garantir muita aventura, risadas e momentos inesquecíveis.', 380.00, 'img/tobogapremium.jpg', (select id from public.categorias where slug = 'inflaveis'), true, true),
  ('Toboágua', 'A diversão mais refrescante da festa, sucesso garantido nos dias de calor. As crianças adoram escorregar e curtir essa aventura.', 180.00, 'img/toboagua.jpg', (select id from public.categorias where slug = 'inflaveis'), true, true),
  ('Tobogã Piscina', 'Diversão em dobro. O Mini Tobogã com Piscina de Bolinhas une o melhor dos dois mundos: escorregar e mergulhar em um mar de bolinhas.', 160.00, 'img/tobogapiscina.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Futebol de Sabão', 'Diversão e adrenalina garantidas. Escorregue, ria e dispute partidas cheias de diversão e muita bagunça boa.', 150.00, 'img/futebolsabao.jpg', (select id from public.categorias where slug = 'inflaveis'), true, true),
  ('Mult Play Tigrinho', 'Aventura e diversão em um só brinquedo. Combina escorregador, obstáculos e muita animação.', 140.00, 'img/multplaytigrinho.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Kid Play Piu-Piu', 'Um espaço inflável cheio de cores, desafios e muita diversão, com escorregador, obstáculos e personagens.', 130.00, 'img/kidplaypiupiu.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Alpinismo', 'O Alpinismo Inflável é diversão radical. As crianças podem escalar e viver a sensação de uma verdadeira aventura com total segurança.', 110.00, 'img/alpinismo.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Mini Kid Play', 'Um espaço inflável cheio de cores e desafios, feito sob medida para os pequenos. Seguro e perfeito para crianças menores.', 95.00, 'img/minikidplay.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Fliperama', 'Diversão garantida para todas as idades. Leve o Fliperama do Mundo Mágico para o seu evento e reviva os clássicos com muitos jogos, competição e risadas.', 95.00, 'img/fliperama.jpg', (select id from public.categorias where slug = 'digitais'), true, true),
  ('Guerra de Cotonete', 'Pura diversão e desafio. Dois participantes duelam em uma base inflável usando cotonetes gigantes.', 90.00, 'img/guerracontonete.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Cama Elástica 366', 'Cama Elástica Profissional de 3,66m de diâmetro. Máxima diversão e espaço para pular em segurança.', 85.00, 'img/camaelastica366.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Bolão', 'O Bolão Inflável é pura energia. Colorido e gigante, garante muitas risadas enquanto as crianças correm, chutam e brincam.', 80.00, 'img/bolao.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Mini Tobogã Jacaré', 'Diversão que escorrega de alegria. Colorido, seguro e cheio de emoção, garante muitas risadas e momentos inesquecíveis.', 80.00, 'img/minitobogajacare.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Tombo Legal', 'Quem será o próximo a cair? O Tombo Legal é pura diversão e gargalhada. Desafie os amigos e teste o equilíbrio.', 75.00, 'img/tombolegal.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Castelo', 'O Castelo Inflável transforma a festa em um reino de diversão. Colorido, seguro e super animado para pular e brincar.', 70.00, 'img/castelo.jpg', (select id from public.categorias where slug = 'inflaveis'), true, true),
  ('Ping-Pong', 'Diversão e desafios para todas as idades. Com a mesa de Ping Pong do Mundo Mágico, a brincadeira é garantida.', 65.00, 'img/pingpong.jpg', (select id from public.categorias where slug = 'mesa'), false, true),
  ('Chute ao Gol', 'Brinquedo inflável que garante diversão e desafios, testando a pontaria dos participantes chutando a bola nos alvos.', 60.00, 'img/chuteaogol.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Cama Elástica 244', 'Cama Elástica de 2,44m de diâmetro. Diversão garantida com segurança para todas as idades.', 60.00, 'img/camaelastica244.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Piscina de Bolinha Leão', 'Diversão com o rei da selva. Piscina de Bolinhas Inflável que encanta com cores vibrantes e formato divertido.', 60.00, 'img/piscinabolinhaleao.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Air Game', 'O Air Game é pura diversão e desafio. Mesa de aero hockey interativa, onde dois jogadores disputam quem marca mais pontos.', 55.00, 'img/airgame.jpg', (select id from public.categorias where slug = 'mesa'), false, true),
  ('Pula-Pula', 'Pura energia e diversão. O Mini Pula-Pula Inflável é perfeito para os pequenos se divertirem com segurança, colorido e cheio de alegria.', 50.00, 'img/pulapula.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Mini Sinuca', 'Diversão em miniatura. A Sinuquinha do Mundo Mágico é perfeita para as crianças se sentirem verdadeiros campeões de sinuca.', 50.00, 'img/minisinuca.jpg', (select id from public.categorias where slug = 'mesa'), false, true),
  ('Cama Elástica', 'A atração que não pode faltar. Diversão garantida com segurança, onde as crianças podem pular e gastar energia.', 45.00, 'img/camaelastica.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Totó', 'Diversão clássica que nunca sai de moda. O Pebolim do Mundo Mágico garante partidas cheias de risadas e muita disputa saudável.', 45.00, 'img/toto.jpg', (select id from public.categorias where slug = 'mesa'), false, true),
  ('Piscina de Bolinha Tradicional', 'Piscina de bolinha simples, mas essencial para a diversão dos pequenos, segura e colorida.', 40.00, 'img/piscinabolinhatrad.jpg', (select id from public.categorias where slug = 'inflaveis'), false, true),
  ('Tamancobol', 'Tamancobol é um jogo de mesa para duas ou quatro pessoas que simula um jogo de golfe, testando a pontaria.', 40.00, 'img/tamancobol.jpg', (select id from public.categorias where slug = 'mesa'), false, true),
  ('Jogo de Argolas', 'Um clássico que nunca sai de moda. As crianças se divertem tentando acertar as argolas no alvo, estimulando a coordenação motora e a concentração.', 35.00, 'img/jogoargolas.jpg', (select id from public.categorias where slug = 'mesa'), false, true)
on conflict (nome) do nothing;


-- Só entra se ainda não houver nenhum depoimento, para não repetir a cada execução.
insert into public.depoimentos (nome, texto, imagem_url, aprovado)
select * from (values
  ('Juliana Prado', 'Fechamos o pacote pelo WhatsApp em minutos. Festa perfeita, voltaremos a contratar!', 'img/cliente3.jpg', true),
  ('Marcos Vinícius', 'Atendimento excelente e brinquedos muito limpos e conservados. Recomendo demais!', 'img/cliente2.jpg', true),
  ('Ana Carolina', 'Alugamos o castelo e o tobogã para o aniversário do meu filho. As crianças amaram e a equipe foi super pontual!', 'img/cliente1.jpg', true)
) as novos(nome, texto, imagem_url, aprovado)
where not exists (select 1 from public.depoimentos);

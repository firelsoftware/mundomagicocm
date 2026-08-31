# Ligar o site ao Supabase

Passo a passo do que precisa ser feito no navegador. Cada bloco é rápido, mas a
ordem importa: o schema antes do seed, e o primeiro dono antes de tentar entrar
no painel.

---

## 1. Criar o projeto

Em [supabase.com](https://supabase.com) → **New project**.

| Campo | O que usar |
|---|---|
| Name | `mundomagicocm` |
| Database password | Uma senha forte. **Guarde**: ela vai no backup e não dá para ver depois. |
| Region | `South America (São Paulo)` — é a mais perto de Brasília |
| Plan | Free |

O projeto leva uns 2 minutos para subir.

> O plano gratuito permite 2 projetos ativos. O do trabalho da faculdade
> (`qnksilqrqqwybhetyroj`) conta como um deles.

---

## 2. Criar as tabelas

**SQL Editor** → **New query** → cole o conteúdo de [`schema.sql`](schema.sql) →
**Run**.

Depois repita com [`seed.sql`](seed.sql), que carrega os 27 brinquedos, as 3
categorias e os 3 depoimentos.

O seed pode rodar quantas vezes quiser: não duplica nada e não sobrescreve preço
que você já tenha ajustado no painel.

---

## 3. Criar o primeiro dono

**Authentication** → **Users** → **Add user** → **Create new user**.

Preencha e-mail e senha, e marque **Auto Confirm User** — sem isso a conta fica
esperando confirmação por e-mail e não consegue entrar.

> Use o **e-mail de verdade** da pessoa, o que ela lê no celular. É por ele que
> chega o link de "Esqueci minha senha". O domínio `mundomagicocm.com.br` aponta
> para o GitHub Pages e **não tem caixa de entrada** — um endereço inventado
> nele funcionaria para entrar, mas deixaria a pessoa sem recuperação de senha
> para sempre.

Copie o **UID** que aparece na lista e rode no SQL Editor:

```sql
update public.profiles
   set role = 'dono', nome = 'Christiane'
 where id = 'COLE_O_UID_AQUI';
```

Toda conta nasce como `cliente`. Essa promoção só funciona pelo SQL Editor,
porque um trigger impede que qualquer pessoa mude o próprio perfil pelo site.

Os três perfis:

| role | Pode |
|---|---|
| `cliente` | Pedir orçamento e ver as próprias reservas |
| `admin` | Tudo do painel: catálogo, reservas, depoimentos, agenda |
| `dono` | Tudo do admin, mais promover e remover outros administradores |

---

## 4. Apontar o site para o projeto

**Project Settings** → **API**. Copie os dois valores para
[`../static/js/config.js`](../static/js/config.js):

```js
window.SUPABASE_CONFIG = {
  url: "https://xxxxxxxxxxxx.supabase.co",
  anonKey: "eyJhbGciOi...",
};
```

A chave `anon` fica visível no código-fonte da página e isso é esperado — ela só
consegue fazer o que as regras de RLS permitirem. A chave `service_role` ignora
todas as regras e **nunca** pode entrar em arquivo do repositório.

---

## 5. Ligar o envio de e-mail (Resend)

Serve para uma coisa só: o link de **Esqueci minha senha**. São pouquíssimos
e-mails por mês, mas sem eles quem esquece a senha depende de alguém abrir o
painel do Supabase.

O serviço embutido do Supabase não resolve — ele é limitado a poucos e-mails por
hora e, na prática, só entrega para quem é membro da organização. Por isso vamos
enviar pelo Resend, que no plano gratuito manda 3.000 e-mails por mês.

### 5.1 Verificar o domínio no Resend

Em [resend.com](https://resend.com) → crie a conta → **Domains** → **Add
Domain** → `mundomagicocm.com.br`.

O Resend mostra três registros para cadastrar no **registro.br**, na mesma tela
de DNS onde já estão os apontamentos do GitHub Pages:

| Tipo | Para que serve |
|---|---|
| `TXT` (SPF) | diz quais servidores podem enviar em nome do domínio |
| `TXT` (DKIM) | assina cada mensagem, para não cair como falsificação |
| `MX` (opcional, subdomínio `send`) | recebe os avisos de entrega do próprio Resend |

> Nenhum deles mexe no site. O Pages responde pelos registros `A`; estes são
> outros tipos e convivem sem conflito. O domínio continua **sem** caixa de
> entrada — o que estamos ligando é só o envio.

A verificação costuma sair em minutos, mas o registro.br pode levar algumas
horas para propagar.

### 5.2 Pegar as credenciais SMTP

No Resend: **API Keys** → **Create API Key** (permissão de envio). A chave
aparece **uma única vez** — copie na hora.

Os dados do SMTP ficam em **Settings** → **SMTP**:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Porta | `465` |
| Usuário | `resend` |
| Senha | a API key que você acabou de criar |

### 5.3 Apontar o Supabase para o Resend

**Authentication** → **Emails** → **SMTP Settings** → ligue **Enable Custom
SMTP** e preencha com os dados acima. No remetente use:

| Campo | Valor |
|---|---|
| Sender email | `nao-responda@mundomagicocm.com.br` |
| Sender name | `Mundo Mágico CM` |

Ainda em **Authentication** → **Emails**, abra o modelo **Reset Password** e
cole o conteúdo de [`emails/recuperar-senha.html`](emails/recuperar-senha.html).
O que vem de fábrica está em inglês e assina "Supabase Auth".

### 5.4 Autorizar o endereço de retorno

**Authentication** → **URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | `https://mundomagicocm.com.br` |
| Redirect URLs | `https://mundomagicocm.com.br/trocar-senha/` |

Sem essa autorização o link do e-mail funciona, mas descarta o destino e joga a
pessoa na raiz do site — sem a tela de escolher a senha.

> Para testar na sua máquina, acrescente também o endereço local que você usa
> (por exemplo `http://localhost:8000/trocar-senha/`).

### 5.5 Conferir

Abra `/recuperar-senha/` no site, peça o link com o seu próprio e-mail e siga
até o fim. Se o e-mail não chegar em uns minutos, o Resend mostra o que houve em
**Logs** — é lá que aparece domínio não verificado ou chave errada.

---

## 6. Ligar o keep-alive e o backup

No repositório: **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**.

| Segredo | Onde achar o valor |
|---|---|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Project Settings → API → chave `anon` `public` |
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string → URI, **porta 6543** |

Na connection string, troque `[YOUR-PASSWORD]` pela senha do passo 1.

Depois vá em **Actions** e rode os dois workflows uma vez pelo **Run workflow**,
para confirmar que passam antes de dependerem do agendamento.

O que cada um resolve:

- **Manter Supabase ativo** — projeto gratuito pausa após 1 semana parada, e
  pausado o site quebra. Roda a cada 3 dias.
- **Backup do Supabase** — o plano gratuito não tem backup automático. Roda toda
  segunda e guarda o dump por 90 dias.

> Repositório público tem os agendamentos desativados após 60 dias sem commits.
> Se acontecer, o painel do Actions oferece reativar em um clique.

---

## 7. Ligar o domínio

O DNS de `mundomagicocm.com.br` **já aponta** para o GitHub Pages, e o arquivo
`CNAME` já está no repositório. Falta só registrar o domínio no Pages:

1. **Settings** → **Pages**
2. Em **Custom domain**, digite `mundomagicocm.com.br` → **Save**
3. Espere o `DNS check successful`
4. Quando o certificado sair, marque **Enforce HTTPS**

Enquanto esse passo não for feito, o domínio redireciona para a tela de login do
GitHub em vez de abrir o site.

---

## Limitações conhecidas

- **Envio de orçamento não tem limite de taxa.** Qualquer visitante pode gravar
  reservas em sequência. O banco impede preço falso e data lotada, mas não
  impede volume. Se virar problema, o caminho é uma Edge Function com captcha.
- **O plano gratuito dorme.** O keep-alive cobre o caso normal; uma queda longa
  do GitHub Actions ainda poderia deixar passar a semana.

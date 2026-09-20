# Funções do servidor (Supabase Edge Functions)

O painel roda no navegador, e o que está no navegador pode ser lido por quem usa
o computador. Estas funções existem para o que **não pode** acontecer lá: elas
rodam na Supabase e guardam os segredos.

| Função | Para que serve | Quem chama |
|---|---|---|
| `send-recovery-email` | E-mail de recuperação de senha | Painel (tela de login) |
| `issue-bootstrap-code` | Código de primeiro acesso | Painel |
| `encrypt-totem-tef-secrets` | Cifra as chaves de TEF antes de gravar | Painel (totens) |
| `mint-derived-session` | Abre o EasyBilling já logado | Painel (menu) |
| `sso-support` | Abre o suporte já logado | Painel (menu) |
| `error-report-proxy` | Repassa o relatório de erro ao EasyGuardian | Painel (erro de tela) |
| `create-checkout` | Compra de plano | EasyBilling — **não é deste painel** |
| `stripe-webhook` | Retorno de pagamento da Stripe | Stripe — **não é deste painel** |

## ⚠️ Existe outra cópia deste código

Estes arquivos foram copiados de `easycommandpay/supabase`, que **continua
existindo**, por decisão do time. Enquanto as duas cópias existirem, vale a
regra abaixo.

**Só uma cópia pode publicar.** Seis repositórios da EasySoft apontam para o
mesmo projeto Supabase (`nyoqadtohcgiwrbhoqdo`) e existe **uma só** função
publicada com cada nome: quem publica por último sobrescreve o trabalho dos
outros, sem aviso nenhum. Já aconteceu com a função do chat de IA — três
repositórios, três versões diferentes, e a publicada ficou divergente do
código-fonte. O relato está em `functions/AI-CHAT-NAO-MORA-MAIS-AQUI.md`.

Antes de publicar qualquer coisa daqui, confirme com o time qual repositório é
o dono e se a outra cópia está igual.

## Os segredos não estão aqui

`SSO_SHARED_SECRET`, `STRIPE_SECRET_KEY`, `ERROR_REPORT_SECRET`,
`SENSITIVE_SECRET_KEY_ID` e os demais ficam guardados no projeto da Supabase,
não no repositório. Copiar a pasta não move nem duplica segredo nenhum.

## `config.toml` não é detalhe

Ele declara que `send-recovery-email` e `stripe-webhook` aceitam chamada sem
login — e precisa ser assim: quem esqueceu a senha ainda não entrou, e a Stripe
não tem conta no sistema. Publicar sem este arquivo faz as duas passarem a
exigir login, e a recuperação de senha para de funcionar para todo mundo.

## As migrações do banco não vieram

Ficaram no repositório anterior (`supabase/migrations`, 125 arquivos). Elas são
o histórico do que já foi aplicado no banco, e não são reexecutadas: duplicá-las
só criaria duas versões de uma história que precisa ser única.

## Publicar não é tarefa de código

`supabase functions deploy` é etapa de quem cuida do deploy, com a decisão de
dono resolvida antes.

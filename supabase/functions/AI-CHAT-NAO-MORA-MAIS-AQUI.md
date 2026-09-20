# A função `ai-chat` não mora mais neste repositório

Este arquivo existe para responder à pergunta "cadê a pasta `ai-chat/`?" sem que alguém precise
garimpar histórico do Git — e para impedir que ela seja recriada por engano.

## O que havia aqui

Uma cópia de `supabase/functions/ai-chat/index.ts`. Havia **três** cópias do mesmo arquivo no
ecossistema (aqui, no EasyERP-Web-API e no EasyBilling), com tamanhos e provedores diferentes —
576, 299 e 719 linhas.

E existe **uma só** função publicada com esse nome, porque os seis repositórios apontam para o
mesmo projeto Supabase (`nyoqadtohcgiwrbhoqdo`).

## Por que isso era perigoso

Quem rodasse `supabase functions deploy ai-chat` por último **sobrescrevia os outros dois, sem
aviso nenhum**. Foi o que deixou a versão publicada divergente do código-fonte, e o que faria o
chat inteiro voltar para o gateway do Lovable — descontinuado — se o deploy saísse deste repo.

Nenhum CI publicava essas funções: o deploy era manual, o que torna o acidente ainda mais fácil.

## Onde a IA vive hoje

No **EasyAI**, serviço próprio que é a porta única de IA do ecossistema (ADR-0003). Ele é dono da
credencial do provedor, do prompt, da base de conhecimento (`billing.ai_kb_topics`) e da cobrança.

Ficou fora do EasyBilling de propósito: código de IA é mais pesado e mais experimental que código
de cobrança, e um problema nele não pode derrubar a compra e a validação de licença de todos os
produtos.

- Contrato: `POST https://easyai.easysoftcloud.com.br/api/v1/chat`
- No modo API (nuvem), esta tela chama `/v1/ai/chat` da EasyFoodAPI, que encaminha para lá.
- A Edge Function publicada ainda existe e está em vias de ser aposentada — ela é o que atende
  os modos Electron e LAN. Enquanto isso, o código-fonte dela vive **só** no repositório do
  EasyBilling.

## Se você precisa mexer no assistente

Mexa no EasyAI. Se o que você precisa é ensinar o assistente sobre um módulo deste produto,
isso é **dado, não código**: uma linha em `billing.ai_kb_topics`.

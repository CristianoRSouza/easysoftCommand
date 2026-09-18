# Correção manual de NFC-e — regras e por que não está no painel

## Situação

O painel **não corrige** NFC-e. Não é funcionalidade faltando: é o limite real
do que a nuvem alcança hoje.

Corrigir uma NFC-e rejeitada significa ajustar a classificação fiscal e
**reenviar o documento à SEFAZ**. Quem fala com a SEFAZ é o serviço fiscal que
roda na loja. A nuvem recebe as notas já prontas, pela fila de sincronização.

Verificado contra o Supabase de produção:

- não existe função (RPC) de correção ou de reprocessamento;
- não existe Edge Function fiscal — as oito publicadas são de cobrança,
  sessão, recuperação de senha, SSO, relatório de erro e cifragem de segredos
  de totem;
- a view `vw_nfce_items` **aceita** gravação (PATCH devolve 204);
- a fila que vai da nuvem para a loja existe, mas só carrega contas de acesso
  (detalhe abaixo).

Esse último ponto é a armadilha. Dá para gravar a correção na cópia da nuvem.
O resultado seria uma nota **parecendo** corrigida no painel e continuando
rejeitada na SEFAZ — com o agravante de apagar o registro do que foi realmente
transmitido. O documento fiscal não é o que o painel mostra; é o que a SEFAZ
recebeu.

Por isso o painel informa a situação e não oferece o botão.

## O canal nuvem → loja existe, mas não carrega isto

Correção de uma versão anterior deste documento, que dizia não existir fila da
nuvem para a loja. Existe: `ecb_sync.outbox`, no Supabase, com os mesmos
estados do outbox da loja (`pending`, `dispatched`, `failed`).

O que ele carrega hoje, verificado nesta empresa:

| Entidade | Despachados | Pendentes |
|---|---|---|
| `public.admin_users` | 5 | 1 |
| `public.admin_user_roles` | 5 | 1 |

São contas de acesso e papéis — nada fiscal. E os dois pendentes estão parados
desde **04/08/2026**, o que sugere que o consumo dessa fila nesta loja não está
correndo.

Ou seja: o mecanismo existe, ninguém o usa para documento fiscal, e ele não
está fluindo aqui.

## O que falta para habilitar

Três peças, e nenhuma é de tela:

1. **Gravar a correção com validação no servidor** — uma Edge Function que
   aplique as regras abaixo e grave numa transação só. Validação no navegador
   é conveniência para quem digita, nunca garantia.
2. **Enfileirar o evento para a loja** — usar o `ecb_sync.outbox` da nuvem com
   uma entidade da NFC-e, que hoje ele não conhece.
3. **Fazer o serviço fiscal da loja reprocessar** — aplicar o evento no
   PostgreSQL local e recolocar a nota na fila de transmissão, que é o que o
   programa instalado faz hoje ao mudar o estado da nota.

Sem a terceira, as duas primeiras só mudam a cópia da nuvem — e a nota segue
rejeitada na SEFAZ.

## Regras

Extraídas de `saveNfceManualCorrection` do projeto anterior. Nenhuma foi
inventada.

### Quando é permitido

Somente nota em `manual_review`. Qualquer outro estado é recusa.

### O que pode mudar

Apenas classificação fiscal: **NCM, CFOP, CEST e CST/CSOSN**. Nenhum deles
entra no cálculo do total.

O valor total **não pode mudar**. Nota que sai com total diferente do que o
cliente pagou deixa de ser correção e vira outra venda.

### Itens

| Campo | Regra |
|---|---|
| NCM | exatamente 8 dígitos |
| CFOP | exatamente 4 dígitos, começando em 5 ou 6 (NFC-e é sempre saída) |
| CFOP interno | emitente e destinatário na mesma UF → faixa **5xxx** |
| CFOP interestadual | UFs diferentes → faixa **6xxx** |
| CEST | até 7 dígitos |
| CST/CSOSN | depende do regime (abaixo) |

Todos os campos aceitam **só dígitos**. Máscara que passa gera XML inválido e a
nota é rejeitada de novo, pelo mesmo motivo.

### Código de ICMS por regime tributário

- **CRT 1 ou 2** (Simples Nacional, com ou sem excesso) → **CSOSN**, 3 dígitos.
  Permitidos: `101 102 103 201 202 203 300 400 500 900`.
- **CRT 3** (Regime Normal) → **CST**, 2 dígitos.
  Permitidos: `00 10 20 30 40 41 50 51 60 70 90`.
- Regime desconhecido → aceita de 2 a 4 dígitos.

### Pagamentos

- Forma de pagamento: 2 dígitos. `01` é dinheiro.
- Valor e troco: números não negativos.
- Troco não pode ser maior que o valor.
- **Troco só existe em dinheiro** — cartão não devolve diferença.
- A soma dos pagamentos menos o troco **não pode ser menor** que o total da
  nota. Menos que isso é venda sem lastro.

Tolerância de `0,0001` para erro de ponto flutuante. Centavos são exatos.

### Destinatário

CPF até 11 dígitos, CNPJ até 14, nome e e-mail até 60 caracteres.

## Uma correção de ordem, para quem implementar

O projeto anterior aplica as alterações **e só então** confere se o valor total
mudou — devolvendo erro com os dados já modificados e sem transação para
desfazer. A nota fica corrompida e a mensagem diz que falhou.

Valide tudo antes de gravar, e grave numa transação só.

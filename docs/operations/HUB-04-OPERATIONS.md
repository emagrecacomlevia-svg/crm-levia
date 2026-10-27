# HUB-04 — Operação do backend e recuperação

Referência: missão expressamente autorizada em 25/10/2026. Este registro atualiza os procedimentos AT-040/AT-041; preserva os registros históricos.

## Implantação

As migrations canônicas foram aplicadas uma a uma pelo canal gerenciado Supabase, em transações registradas. Não foi utilizado `migration repair`, nem alterada a migration original. A conectividade IPv6/TLS da antiga estação Windows não é dependência deste canal: as funções implantadas estabeleceram conexão PostgreSQL com `rejectUnauthorized: true` e TLS 1.3.

`supabase/deployment-manifest.json` associa cada versão real do ledger ao conteúdo canônico e seu SHA-256. `scripts/stage-managed-migrations.mjs` gera uma cópia com os timestamps reais para ferramentas CLI. Nunca aplicar diretamente os timestamps canônicos históricos a este banco já migrado.

As funções `hub-authorize`, `hub-admin-write` e `hub-session` usam somente os segredos gerenciados presentes no runtime. `verify_jwt=false` é necessário para as chaves modernas; a autenticação é feita explicitamente no corpo da função e a autorização não é baseada na chave publicável ou em `user_metadata`. A função de sessão abre somente envelopes autenticados por AES-GCM; essa operação é parte do protocolo de sessão, não uma concessão de privilégio.

## Primeiro administrador

**Ativado em 26/10/2026:** após a criação manual das duas identidades com e-mails confirmados e a designação expressa do operador pelo titular, o bootstrap foi executado pelo conector como `postgres`. Há uma conta administrativa habilitada para o titular, com somente `core.read` e `users.manage` no escopo `module:core`. O operador não recebeu privilégios. A rejeição anterior à criação automatizada de credenciais permanece no histórico; as credenciais foram definidas privadamente pelo usuário.

Os testes HTTP usaram identidades explicitamente sintéticas com `app_metadata.purpose=hub04-qa-synthetic`, criado somente pela API administrativa. Seu histórico é preservado com marca de QA gerada no banco. O bootstrap real tolera exclusivamente esse histórico sintético e continua negado após qualquer bootstrap real. Nenhuma marca fornecida pelo cliente pode transformar um evento real em QA.

**Não repetir o bootstrap nem executar fixtures sintéticas neste banco real.** A verificação controlada confirmou a recusa de repetição, com contagens preservadas: uma conta, duas concessões, 11 eventos sintéticos anteriores e quatro eventos reais com snapshot de ator. Os próximos usuários devem seguir o fluxo administrativo auditado; nunca inserir grants diretamente. [Evidência atual](../evidence/hub04/first-admin-activation-20261026.json).

Não publicar credenciais no Git, PR, logs ou documentação. Links de recuperação devem ser privados e nunca usados como convite público. A rota `/activate` permite definir uma senha de 12 a 128 caracteres usando o hash de recuperação em fragmento, removido imediatamente do endereço. O login real do titular ainda precisa de validação no aplicativo; a confirmação do e-mail e a concessão no banco não substituem esse teste.

## Recuperação verificada

A linha de base anterior à primeira migration tinha **zero usuários Auth, zero objetos de Storage e zero relações de aplicação**. A preservação consiste em manter os serviços gerenciados e reconstruir somente os objetos próprios; não há dados empresariais anteriores a recuperar.

O pacote de aplicação contém SQL canônico, manifesto de versões/hashes e snapshot das quatro tabelas próprias. O snapshot desta execução contém somente catálogo estático e auditoria de QA sintética. Não contém senhas, tokens, sessões, arquivos de Storage ou dados de pessoas reais. Sua restauração ocorre em PostgreSQL 17 isolado, com stub Auth declarado como tal; o CI verifica dump custom, `pg_restore`, igualdade do digest da auditoria e RLS.

Isso comprova recuperação do **schema e dos dados de aplicação desta linha de base vazia/sintética**. Não constitui dump integral dos serviços gerenciados Auth/Storage, PITR ou backup operacional de um futuro ambiente com dados reais. Quando esses dados existirem, a política e o canal privado de backup deverão abranger seus conteúdos e dependências. Não reutilizar o fluxo público de CI para esses dados.

Após a ativação real, foi preservado um snapshot privado das quatro tabelas em `LEVIA HUB - BACKUPS OFICIAIS`, com uma conta, nove capacidades, duas concessões e 15 eventos. SHA-256 `a9cfd7e8951e7cc43a9b79cd9389056c768168da4038c817ada50a68ecdf4fd0`, 11.513 bytes, conferido após novo download. Esse snapshot não inclui credenciais Auth, sessões, Storage ou segredos gerenciados. Sua restauração exige tratar explicitamente as dependências de UUID Auth; não aplicar o snapshot sintético antigo sobre o banco atual.

## Controles e limites restantes

O cadastro público na API Auth está desabilitado. Em 26/10/2026, o GET `/auth/v1/settings` confirmou `disable_signup=true`, confirmação de e-mail exigida e login anônimo desativado. Um POST de cadastro com endereço sintético reservado `.invalid` foi rejeitado com HTTP 422 e `signup_disabled`, sem criar usuário ou enviar mensagem. [Evidência atual](../evidence/hub04/auth-settings.json). Essa pendência está encerrada; não reabilitar o cadastro para provisionar o primeiro administrador.

A política do provedor foi salva e conferida no painel em 26/10/2026: mínimo de 12 caracteres, troca segura de senha e de e-mail habilitadas. O limite máximo de 128 caracteres pertence à aplicação. [Evidência da configuração](../evidence/hub04/dashboard-security-20261026.json). O conector continua disponível independentemente da sessão do painel.

O plano Free não disponibiliza a proteção gerenciada contra senhas vazadas, conforme [documentação Supabase](https://supabase.com/docs/guides/auth/password-security). Não foi contratado plano pago. A definição de senha no aplicativo exige 12 caracteres e acesso por link privado. A migração para proteção gerenciada e MFA deve preceder uso com dados empresariais sensíveis. A consulta de 26/10/2026 às 19h34 retornou **um WARN de proteção contra senhas vazadas desabilitada** e quatro informes de RLS sem policies. A ausência desse WARN nas consultas históricas não significava que o recurso estava habilitado.

Os avisos informativos de RLS sem policies são esperados: o schema é privado e o acesso direto é intencionalmente negado. Não criar policies permissivas para eliminar esse aviso. Índices informados como ainda não utilizados em um banco recém-criado são preservados para as FKs e trilhas de auditoria.

Nenhum comando foi enviado ao agente Lovable. O código chega à branch vinculada por merge Git normal, sem rebase ou force-push. Publicação do site e configurações do Lovable não foram alteradas.

O preview requer autenticação no Lovable e o projeto continua sem publicação. A validação do login do titular depende do acesso privado ao preview e da sua credencial de aplicação. Site URL foi observado como `http://localhost:3000`, sem redirects adicionais; deve ser atualizado somente quando houver destino de aplicação homologado. Não declarar homologação operacional completa enquanto o login real e o destino dos fluxos de e-mail estiverem pendentes.

## Correção de recuperação pelo e-mail padrão (26/10/2026)

O painel real bloqueia edição de templates sem SMTP personalizado. A orientação
anterior de editar o HTML não se aplica a esta configuração. Não configurar SMTP
nem substituir contas para contornar o problema.

`/activate` agora aceita também o fragmento padrão `type=recovery&access_token=...`,
além do `token_hash` personalizado. Remove o fragmento do histórico imediatamente,
não persiste credenciais em storage e não retém refresh tokens. O backend verifica
a identidade com Supabase Auth antes de solicitar a mudança da senha e revoga a
sessão de recuperação após sucesso. Nenhuma permissão é derivada do fragmento.

Configuração manual ainda necessária no painel autenticado do titular:
Authentication → URL Configuration → Site URL:
`https://id-preview--83c750f7-9e88-4997-a06d-b86c37d59b5b.lovable.app/activate`.
Este é um destino provisório de desenvolvimento, não um domínio de produção.
Salvar, abrir o preview previamente no mesmo navegador (autenticando no Lovable
se necessário), solicitar um novo e-mail e definir a senha privadamente. Não usar
links antigos nem compartilhar links completos, tokens ou senhas.

A sincronização automática do preview precisa ser confirmada antes do teste real.
Não foi alterado Site URL via conector nem enviado e-mail nesta correção.
O reset real e o login do titular continuam pendentes; não declarar homologação.
Validação local: build de produção, TypeScript, lint e 68 testes automatizados,
incluindo fragmentos padrão/personalizado, rejeição de token inválido, recusa de
senha pelo provedor e revogação após sucesso. Sem alterações em banco, grants,
migrations ou Edge Functions.

## Recuperação confirmada e correção de autofill (27/10/2026)

Logs do projeto confirmam `user_updated_password` do titular em
2026-10-27T02:55:22Z (26/10 às 23:55:22 em São Paulo), acompanhado de PUT /user
200 e logout 204. A tentativa seguinte, às 02:55:39Z, retornou
`invalid_credentials` (POST /token 400). Não confundir o evento `login` da
verificação do link de recuperação com login por senha homologado.

A configuração de retorno deixou de bloquear essa recuperação; nenhum template
SMTP personalizado foi necessário. O preview reconheceu o fragmento padrão em
teste sintético, sem envio de senha. A atualização real foi confirmada nos logs.

Corrigida a coleta de credenciais nos formulários de login e ativação: FormData
obtém os valores presentes nos campos no instante da submissão, evitando enviar
estado React antigo quando autofill não dispara onChange. Senhas não são
normalizadas, registradas ou persistidas. Testes reproduzem alteração direta dos
campos sem eventos React, incluindo confirmação divergente. A causa da tentativa
real ainda não está comprovada; não atribuir automaticamente ao usuário ou autofill.

Validação: build de produção, TypeScript, lint dos arquivos alterados e 71 testes
aprovados. Sem mudanças em contas, banco, grants ou Edge Functions. Próxima ação
pessoal: recarregar /login e digitar privadamente a senha recém-definida, evitando
a sugestão antiga do gerenciador. A homologação depende desse login real.

## Recuperação com login verificado (27/10/2026)

As novas tentativas de 08:39:32 e 08:39:57 (São Paulo) continuaram retornando
`invalid_credentials` no projeto correto. A versão de autofill estava sincronizada
no preview. Conta confirmada, não banida, não excluída, provider email e identidade
com e-mail correspondente. Autofill não explica comprovadamente o incidente.
Não alterar credenciais via SQL nem ampliar permissões para contorná-lo.

O fluxo de recuperação agora verifica a identidade pelo Auth, salva a senha,
revoga a sessão de recuperação ANTES de criar outra e executa password grant com
a mesma senha e o e-mail verificado pelo servidor. Confere que o UUID autenticado
é o mesmo da recuperação. Somente então usa a rotina normal de sessão HttpOnly
para abrir /app, onde as verificações de autorização continuam obrigatórias.
Nenhuma permissão nova é concedida e nenhum token é retornado ao cliente.

Em falha posterior à alteração, a mensagem distingue rejeição do password grant
de falha da sessão do HUB; o formulário limpa credenciais e impede ressubmissão.
A origem da recusa anterior permanece desconhecida. Não declarar login real nem
homologação até o titular concluir o fluxo privadamente. Um NOVO link de recuperação
é necessário porque o anterior já foi usado. Esta etapa pessoal testa uma mudança
concreta, não uma nova tentativa do fluxo antigo.

Build, TypeScript, lint e 73 testes aprovados, incluindo rejeição do password grant
e bloqueio de identidade divergente. Banco, contas, grants e Edge Functions intactos.

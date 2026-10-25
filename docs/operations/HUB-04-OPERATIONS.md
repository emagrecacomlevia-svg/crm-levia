# HUB-04 — Operação do backend e recuperação

Referência: missão expressamente autorizada em 25/10/2026. Este registro atualiza os procedimentos AT-040/AT-041; preserva os registros históricos.

## Implantação

As migrations canônicas foram aplicadas uma a uma pelo canal gerenciado Supabase, em transações registradas. Não foi utilizado `migration repair`, nem alterada a migration original. A conectividade IPv6/TLS da antiga estação Windows não é dependência deste canal: as funções implantadas estabeleceram conexão PostgreSQL com `rejectUnauthorized: true` e TLS 1.3.

`supabase/deployment-manifest.json` associa cada versão real do ledger ao conteúdo canônico e seu SHA-256. `scripts/stage-managed-migrations.mjs` gera uma cópia com os timestamps reais para ferramentas CLI. Nunca aplicar diretamente os timestamps canônicos históricos a este banco já migrado.

As funções `hub-authorize`, `hub-admin-write` e `hub-session` usam somente os segredos gerenciados presentes no runtime. `verify_jwt=false` é necessário para as chaves modernas; a autenticação é feita explicitamente no corpo da função e a autorização não é baseada na chave publicável ou em `user_metadata`. A função de sessão abre somente envelopes autenticados por AES-GCM; essa operação é parte do protocolo de sessão, não uma concessão de privilégio.

## Primeiro administrador

A criação de uma identidade real foi rejeitada pela revisão automática de autorização. Não foi criada conta para o e-mail real nem enviada mensagem. O bootstrap continua privado, limitado a `postgres`, com operador e beneficiário distintos e motivo auditável. Inicializa somente `core.read` e `users.manage`, sem CRM ou poderes editoriais.

Os testes HTTP usaram identidades explicitamente sintéticas com `app_metadata.purpose=hub04-qa-synthetic`, criado somente pela API administrativa. Seu histórico é preservado com marca de QA gerada no banco. O bootstrap real tolera exclusivamente esse histórico sintético e continua negado após qualquer bootstrap real. Nenhuma marca fornecida pelo cliente pode transformar um evento real em QA.

Após autorização específica, criar a identidade do titular pelo Supabase Auth, verificar a titularidade, usar um operador independente e executar `hub_private.bootstrap_first_admin` em sessão privada. Não publicar credenciais no Git, PR, logs ou documentação. Links de recuperação devem ser privados e nunca usados como convite público. A rota `/activate` permite definir uma senha de 12 a 128 caracteres usando o hash de recuperação em fragmento, removido imediatamente do endereço e sem envio de e-mail por esta entrega.

## Recuperação verificada

A linha de base anterior à primeira migration tinha **zero usuários Auth, zero objetos de Storage e zero relações de aplicação**. A preservação consiste em manter os serviços gerenciados e reconstruir somente os objetos próprios; não há dados empresariais anteriores a recuperar.

O pacote de aplicação contém SQL canônico, manifesto de versões/hashes e snapshot das quatro tabelas próprias. O snapshot desta execução contém somente catálogo estático e auditoria de QA sintética. Não contém senhas, tokens, sessões, arquivos de Storage ou dados de pessoas reais. Sua restauração ocorre em PostgreSQL 17 isolado, com stub Auth declarado como tal; o CI verifica dump custom, `pg_restore`, igualdade do digest da auditoria e RLS.

Isso comprova recuperação do **schema e dos dados de aplicação desta linha de base vazia/sintética**. Não constitui dump integral dos serviços gerenciados Auth/Storage, PITR ou backup operacional de um futuro ambiente com dados reais. Quando esses dados existirem, a política e o canal privado de backup deverão abranger seus conteúdos e dependências. Não reutilizar o fluxo público de CI para esses dados.

## Controles e limites restantes

O cadastro público na API Auth permanece habilitado (`disable_signup=false`), com confirmação por e-mail; não há cadastro na interface nem concessão automática de acesso ao HUB. Desabilitar o cadastro no painel continua pendente: o conector não oferece escrita dessa configuração e a sessão de navegador exige autenticação. Nenhuma configuração Auth foi declarada alterada sem confirmação efetiva.

O plano Free não disponibiliza a proteção gerenciada contra senhas vazadas, conforme [documentação Supabase](https://supabase.com/docs/guides/auth/password-security). O advisor emite esse aviso; não foi contratado plano pago para suprimi-lo. A definição de senha no aplicativo exige 12 caracteres e acesso por link privado. A migração para proteção gerenciada e MFA deve preceder uso com dados empresariais sensíveis.

Os avisos informativos de RLS sem policies são esperados: o schema é privado e o acesso direto é intencionalmente negado. Não criar policies permissivas para eliminar esse aviso. Índices informados como ainda não utilizados em um banco recém-criado são preservados para as FKs e trilhas de auditoria.

Nenhum comando foi enviado ao agente Lovable. O código chega à branch vinculada por merge Git normal, sem rebase ou force-push. Publicação do site e configurações do Lovable não foram alteradas.

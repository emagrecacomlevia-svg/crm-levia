# LEVIA HUB — Security Baseline (HUB-02)

**Classificação:** repositório público, ambiente de desenvolvimento, dados exclusivamente fictícios.

## Regras obrigatórias

- Não versionar credenciais, tokens, arquivos `.env`, chaves privilegiadas ou dados de pessoas.
- Não inserir contatos comerciais, planilhas financeiras, registros clínicos, diagnósticos, prontuários nem dados de participantes de pesquisa.
- Não copiar originais do Google Drive ou materiais históricos. Referências históricas não equivalem a liberação editorial, gráfica, científica ou comercial.
- Não reutilizar ambientes, credenciais ou serviços do site institucional.
- Não configurar Supabase, Auth, RLS, migrações, jobs, publicação ou integrações externas na HUB-02.
- Revisar código, PRs, comentários, logs, artefatos e mensagens de erro antes da divulgação em repositório público.

## Superfície existente

A aplicação apresenta conteúdo estático; **não possui sistema de login nem proteção de acesso a dados**. Nenhum dado restrito pode ser colocado no bundle frontend. Componentes visuais não substituem controle de acesso.

O template preserva middleware CSRF de server functions e tratamento de erros existentes. Esta preservação não constitui auditoria de segurança do sistema.

## CI

Workflow com `contents: read`, disparado apenas por `pull_request` e `workflow_dispatch`; não realiza deploy, não acessa banco, não exige segredos e não executa comandos de terceiros por download via shell. Dependências existentes são instaladas a partir de `bun.lock` com `--frozen-lockfile`. Ações oficiais e versões fixadas exigem monitoramento futuro.

## Gates antes de produção

Revisão de ameaça e privacidade, autenticação real, autorização em backend, RLS quando aplicável, trilhas de auditoria, política de retenção, avaliação LGPD, gestão de segredos e testes de acesso. Esses itens estão **pendentes e fora do escopo da HUB-02**.

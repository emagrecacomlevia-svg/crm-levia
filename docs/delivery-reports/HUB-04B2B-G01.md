# LEVIA HUB — HUB-04B2B-G01 — Homologação da Supabase CLI

**Referências:** AT-021 e correção AT-022 (HUB-04B2B-G01-C01), 24/10/2026. **Natureza:** testes exclusivamente isolados e documentação. **DDL remoto:** proibido.

## Identidade e baseline

- Repositório: emagrecacomlevia-svg/crm-levia; ID 1431576812.
- Main auditada: 2c9db957a2282cf42029238cabf562eb2fb95048.
- Árvore auditada: 5aced0aff6841387c1230fbd984cff04d617657d.
- Migration original, não modificada: supabase/migrations/20261024130000_identity_permissions.sql.
- Blob Git: 7e954d9ce51ce0e3e96021809241a1bb9a439c59.
- Supabase de desenvolvimento: levia-hub-dev, dfhjfajbmnsgrklhqtjk, sa-east-1, PostgreSQL 17.11, Free.
- Inspeção remota exclusivamente de leitura: ACTIVE_HEALTHY; zero tabelas próprias e zero migrations registradas.

## CLI oficial e instalação isolada

- Versão fixada: **Supabase CLI 2.122.0**, release estável de 23/10/2026.
- Fonte: https://github.com/supabase/cli/releases/tag/v2.122.0
- Ubuntu 24.04 GitHub Actions: download do tarball Linux AMD64 oficial e checksums.txt, validação com sha256sum -c e instalação local do executável.
- Evidências do runner: versão 2.122.0; SHA-256 do artefato oficial OK.
- Foram executados: supabase --version, supabase --help, supabase db push --help e supabase migration list --help.
- Flags confirmadas: db push --db-url, db push --dry-run, **db push --skip-vault** e migration list --db-url. Na CLI 2.122.0, `db push --help` informa que o Vault seria atualizado a partir de config.toml antes das migrations, salvo quando `--skip-vault` está presente.
- Referências: https://supabase.com/docs/reference/cli/supabase-db-push e https://supabase.com/docs/reference/cli/supabase-migration-list.

## Isolamento e testes da migration

- Runner temporário sem SUPABASE_ACCESS_TOKEN, sem secrets, sem supabase login, sem link, sem project-ref e sem acesso a credenciais do remoto.
- PostgreSQL 17 em Docker descartável exposto somente em 127.0.0.1:55432.
- Banco, roles e auth.users inteiramente sintéticos; service_role local com BYPASSRLS. Telemetria desativada.
- O runner acessou GitHub para obter a CLI oficial; comandos de banco direcionados somente ao loopback.
- Git hash-object conferiu o blob original antes dos testes.
- O dry-run listou a versão 20261024130000 sem criar o schema de negócio. Na C01, o dry-run e **todos os cinco demais db push** foram executados com `--skip-vault` e `--db-url` local.
- Aplicação em banco descartável pela **Supabase CLI**: quatro tabelas, nove capacidades, sete FKs, índices, RLS habilitada, zero policies e permissões restritas confirmados.
- A CLI criou e preencheu o histórico real em supabase_migrations.schema_migrations: versão 20261024130000 presente uma vez.
- migration list --db-url exibiu 20261024130000 nas colunas local e remota; esta última se refere somente ao banco descartável, não ao Supabase LEVIA.
- A segunda execução do db push foi concluída como no-op: sem reaplicação nem duplicação da versão.
- Uma **cópia temporária local** contendo um erro SQL injetado foi rejeitada e produziu rollback, sem schema e sem registro de versão.
- Drift criado propositalmente em outro banco descartável (schema presente sem histórico) causou falha, preservando estado identificável para diagnóstico.
- O banco descartável foi excluído e reconstruído, e a migration original reaplicada pela CLI com histórico coerente.
- O teste reutiliza assertions anteriores cujo NOTICE menciona histórico sintético. Neste G01 o registro de versão foi criado pela CLI, não manualmente.
- A paridade com PostgREST, Auth e objetos gerenciados do Supabase remoto **não foi demonstrada**.

## Histórico de CI e correção HUB-04B2B-G01-C01 (AT-022)

### G01 original — evidências anteriores, não pertencem à C01

- HEAD auditado antes da C01 (AT-022): `b1196a72f170276d0ed83e2e6448dce84bfffd2a`.
- Execução G01 original anterior ao relatório: commit `2069ee2f97fc4c5c6e1b1d78aad6b190b92af4a5`.
- [CLI QA G01 original — success](https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40116180915).
- [Quality original — success](https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40116180917).
- [Managed Preflight original — success](https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40116181019).
- [Browser QA original — success](https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40116180877).
- Essas execuções **não** devem ser apresentadas como testes do HEAD da C01.

### C01 — controle explícito de Vault

- Commit de correção do script: `d4a4388d501512998a4c0b6db69e92c42f5dcbf9`.
- Arquivo ajustado: `scripts/qa-supabase-cli-g01.sh`; workflow preexistente inspecionado e preservado.
- O script passa `--skip-vault` em **seis de seis chamadas** de `supabase db push`: prévia `--dry-run`, aplicação, repetição, falha controlada, drift e reconstrução. Todos os destinos usam `--db-url` em `127.0.0.1`.
- A verificação `supabase db push --help | grep -F -- '--skip-vault'` é obrigatória, além da confirmação da versão exata `2.122.0`.
- Nenhum `--include-seed`, `--include-roles` ou `--include-all` foi adicionado.
- [CLI QA C01 após a alteração do script — success](https://github.com/emagrecacomlevia-svg/crm-levia/actions/runs/40117187244), executado no commit `d4a4388d501512998a4c0b6db69e92c42f5dcbf9`.
- Logs desse run confirmam a descrição da opção no `--help`, a versão, todos os cenários de regressão e a mensagem final `PASS: C01 all six CLI push scenarios used --skip-vault with --db-url localhost`.
- O sucesso em banco descartável comprova compatibilidade efetiva da flag e dos testes isolados; não garante a ausência de efeitos no Supabase gerenciado que **não foi contatado**.

### Identificação do HEAD final da C01 e evidências após este documento

O HEAD final de C01 é a versão da branch `feature/hub-04b2b-g01-cli-offline-qa` registrada no [PR Draft #7](https://github.com/emagrecacomlevia-svg/crm-levia/pull/7/commits), **posterior ao commit documental**. A SHA completa do próprio commit não pode ser inserida no conteúdo que participa de seu hash sem mudar esse hash. Para preservar rastreabilidade, a SHA final e os URLs/estados dos runs **desse HEAD** serão registrados em comentário de auditoria na [conversa do PR #7](https://github.com/emagrecacomlevia-svg/crm-levia/pull/7) depois que o GitHub finalizar os workflows.

No PR os gatilhos do novo script acionam G01 CLI QA, Managed Preflight, Quality e Browser. O workflow específico `HUB-04B1 Isolated SQL QA` filtra arquivos `supabase/**` e outros caminhos que **não foram modificados** pela C01; se não disparar, declarar **não executado neste HEAD** em vez de reaproveitar runs antigos.

### Limite de escopo da migration e do executor

**A migration do LEVIA HUB não autoriza qualquer modificação no Vault, Auth, Storage, Realtime ou objetos gerenciados fora de `hub_private`.** A presença de `--skip-vault` deve ser mantida em qualquer desenho futuro do instrumento; não é autorização para `db push` remoto. Sem essa flag, a própria documentação da CLI alerta sobre sincronização antecipada de segredos. Nenhum segredo, credencial ou configuração privada foi incluído no Git.

## Data API e bloqueio

No AT-021, o responsável informou Exposed schemas = graphql_public e public; hub_private não aparece.

**Ainda falta a evidência de persistência após Save e reabertura**, confirmando que Automatically expose new tables segue desativada e que apenas graphql_public e public continuam expostos. Nenhuma configuração foi modificada pelo Desenvolvedor.

## Recuperação Free e escolha de risco

- **Alternativa A — maior segurança:** mediante autorização própria, exportação lógica protegida seguida de ensaio de restauração isolada. Não executada.
- **Alternativa B — aceite residual:** implantar somente objetos privados vazios, depois de satisfeitos os controles técnicos e de autorização expressa, aceitando que o Free não assegura recuperação integral de objetos gerenciados. **Não foi aceita pelo responsável.**
- Backups de código/Git não equivalem a backups do banco; RPO/RTO não estão garantidos.
- Timeout ou resultado desconhecido em operação futura: **nunca repetir automaticamente**; parar, inspecionar versão e objetos somente por leitura e solicitar parecer.

## Critérios objetivos para eventual Fase B

1. Parecer independente do Consultor validando ensaio, versão e escopo.
2. Captura/declaração posterior ao Save e à reabertura confirmando persistência da Data API.
3. Escolha expressa do responsável entre A ou B, com ciência dos riscos de recuperação.
4. Revalidação de repo, HEAD, blob, projeto, roles, Data API, histórico remoto e backups.
5. Aprovação específica do papel executor, transação, instrumento e janela.
6. **Nova autorização formal e nominal** para aplicar a migration 20261024130000 no projeto dfhjfajbmnsgrklhqtjk.
7. Qualquer divergência ou resposta incerta obriga interrupção, sem migration repair, retry ou alteração improvisada.

## Governança e encerramento

Branch: feature/hub-04b2b-g01-cli-offline-qa. PR [Draft #7](https://github.com/emagrecacomlevia-svg/crm-levia/pull/7), sem merge e sem alteração na main.

**Classificação HUB-04B2B: BLOQUEADA para DDL remoto.** Instrumento CLI avaliado e homologado somente no ambiente isolado. Data API persistida e decisão de recuperação permanecem pendentes.

Não houve SQL remoto DDL/DML, apply_migration, db push remoto, migration repair, dump remoto, contas reais, mudança Data API/Lovable/Cloudflare, deployment, secrets, serviço pago ou merge.

**LEVIA HUB — HUB-04B2B-G01 — Instrumento de migration avaliado — Aguardando auditoria e decisão específica sobre execução remota.**

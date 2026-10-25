# HUB-04 — Execução WORK de 25/10/2026

**Estado:** backend de desenvolvimento implantado e validado com Auth, PostgreSQL e navegador reais. A conclusão operacional para o titular depende da criação do primeiro administrador real, bloqueada pela revisão automática da plataforma. Não há administrador real ativo. Não declarar produção homologada.

## Histórico reconciliado e pendências

Foram consultados histórico Git/PRs, registros de desenvolvimento e auditoria versionados, documentos e backups do Google Drive, metadados do projeto Lovable em leitura e o estado efetivo do Supabase. A ordem atual autoriza implementação e merge; os antigos gates de autorização dos relatórios foram preservados como histórico, sem reescrever arquivos de migrations já publicados.

| Origem                 | Pendência acumulada                                                                                                | Resultado deste ciclo                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HUB-00 / HUB-01        | Direção do produto, stack e separação de sistemas                                                                  | Monólito modular e Supabase exclusivo preservados; nenhuma conexão com site institucional, QR, dados clínicos ou financeiros.                                                                        |
| HUB-02                 | Qualidade, composição dos módulos e manifesto de rotas                                                             | Build, tipos, testes e lint executados; manifesto continua gerado e fora do Git.                                                                                                                     |
| HUB-03                 | Navegação, responsividade e evidência no navegador                                                                 | Cinco larguras, rotas públicas e negação das protegidas verificadas; navegação autenticada móvel e Escape também passaram.                                                                           |
| HUB-04A/B1             | Banco privado, capacidades e RLS apenas desenhados                                                                 | Quatro tabelas e nove capacidades implantadas; 48 operações de papéis reais negadas; Data API não expõe `hub_private`.                                                                               |
| HUB-04B2A/C01 e G01    | Conectividade/CLI/TLS não homologada na estação anterior                                                           | Aplicação pelo conector gerenciado; conexão das Edge Functions usa TLS 1.3 e verificação obrigatória do certificado. Nenhum bypass de TLS ou reparo de ledger.                                       |
| HUB-04B2B R01/R02      | Backup anterior apenas sintético e falta de recuperação do schema próprio                                          | Histórico Git copiado para Drive e conferido após download; snapshot da aplicação após QA preparado para restauração PG17 e dump/restore no CI. Auth/Storage gerenciados e PITR não estão incluídos. |
| AT-040 / AT-041        | Migrations e writers somente em branch; todas as rotas administrativas negadas                                     | Quatro migrations aplicadas individualmente e três funções implantadas. Login autorizado, escopo, escrita auditada e revogação passaram em integração real.                                          |
| Auditoria / segurança  | Perda da identificação do ator após exclusão Auth; sessão JWT reutilizável após logout; delegação além da vigência | Snapshot de ator imutável, verificação da sessão viva no banco e escrita transacional limitada pela autorização e vigência do delegante.                                                             |
| Integração SSR         | Segredo de sessão pendente no host; risco de formulário antes da hidratação                                        | Envelope AES-GCM emitido no Supabase, cookie HttpOnly/Secure; formulário POST bloqueado até hidratação. Logout local limpa cookie mesmo em indisponibilidade remota.                                 |
| Primeiro administrador | Ausência de identidade e grants reais                                                                              | Bootstrap privado preparado e testado; criação real não executada devido ao bloqueio automático descrito abaixo.                                                                                     |
| Etapas seguintes       | CRM funcional, Social Studio, catálogo, integrações empresariais                                                   | Escopo futuro HUB-05 em diante, não convertido em funcionalidade fictícia nesta entrega.                                                                                                             |

## Alterações e implantação

- Migration original preservada: blob `7e954d9ce51ce0e3e96021809241a1bb9a439c59`.
- Ledger remoto: `20261025173102`, `20261025173114`, `20261025173422`, `20261025173722`. Correspondência, arquivos e SHA-256 em [deployment-manifest.json](../../supabase/deployment-manifest.json).
- `hub-authorize`: Auth verificado, sessão viva, conta habilitada, capacidade, escopo, vigência e revogação.
- `hub-admin-write`: ator derivado de Auth, parâmetros SQL tipados, bloqueio de autoatribuição, delegação limitada e evento atômico.
- `hub-session`: cifragem autenticada AES-GCM, prazo máximo de sete dias e rejeição de sessão removida. Nenhum segredo administrativo no frontend ou novo segredo no Lovable.
- `hub04-maintenance`: endpoint temporário encerrado; responde 410 e não possui operações privilegiadas.
- Login, refresh, logout e ativação por link privado passam pelo servidor; não há envio de e-mail nesta execução.
- Git preservado sem force-push, rebase ou squash. Backup remoto da main anterior em `backup/hub04-main-at040-20261025`.

## Testes e evidências

| Verificação              | Evidência                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Build e TypeScript       | Build de produção e `tsc --noEmit` aprovados.                                                                                                                                                                                                          |
| Testes da aplicação      | 46 testes em nove arquivos aprovados.                                                                                                                                                                                                                  |
| Lint                     | Zero erros; seis avisos existentes de Fast Refresh nos componentes shadcn.                                                                                                                                                                             |
| Edge Functions           | Tipagem dos três entrypoints e sete contratos isolados; integração real documentada separadamente.                                                                                                                                                     |
| HTTP real                | [39 verificações aprovadas](../evidence/hub04/live-http-qa.json): login, refresh, autenticação falsa, escopos, desabilitação, expiração, concessão/revogação, escrita e auditoria, logout e replay.                                                    |
| Navegador com Auth real  | [Oito verificações aprovadas](../evidence/hub04/live-browser-qa.json): login, cookie, Core/CRM, negação Social, menu móvel, logout e replay.                                                                                                           |
| Navegador público        | [Relatório](../evidence/hub04/browser-qa.json): cinco larguras, 40 combinações de rota/tamanho, quatro capturas, simulação, login inválido e proteção sem JavaScript.                                                                                  |
| Banco gerenciado         | [Linha de base e ensaios](../evidence/hub04/baseline.json): 48 negativas de ACL, rollback de falha na auditoria, TLS e Data API 406.                                                                                                                   |
| Limpeza                  | [Estado final](../evidence/hub04/cleanup.json): quatro usuários sintéticos removidos; zero usuários/sessões/contas/grants; 11 eventos e snapshots de ator preservados.                                                                                 |
| Recuperação da aplicação | [Workflow PG17](../../.github/workflows/hub04-integration-qa.yml): cadeia completa, regressões históricas, dump custom, restore em banco novo, digest de auditoria, capacidades, RLS e ACL. O resultado do CI vinculado ao commit é condição do merge. |

Os scripts de integração real são opt-in e exigem fixture privada explicitamente sintética. Senhas, tokens, cookies, service role e URLs de conexão não integram este repositório. Os testes com mock não são apresentados como testes de Auth real. A rota de ativação possui testes de transporte; não foi emitido ou utilizado link para identidade real.

## Backup e rastreabilidade

[Bundle anterior à execução, no Drive oficial](https://drive.google.com/file/d/19aqrPkM50QnMHBmr5jlW9eVjGXRJRcAx/view): 412.440 bytes; SHA-256 `af785cc00778a9570895dcbe613f63161a1da46a39e8a5ad8eea26a73ca4c4b7`, conferido localmente e depois de baixar a cópia do Drive. O bundle conserva o histórico publicado completo.

O [snapshot de aplicação](../evidence/hub04/application-snapshot.json) contém nove capacidades e 11 eventos exclusivamente sintéticos, com contas e grants vazios. O SQL de restauração exige banco descartável vazio e preserva os eventos originais; nunca é aplicado sobre o Supabase gerenciado. O ledger é inventariado, não reconstruído artificialmente. A prova cobre esta linha de base sem dados empresariais; não cobre recuperação integral de Auth/Storage, PITR, SMTP ou controle do projeto.

## Impedimentos e limites reais

1. **Primeiro administrador:** a revisão automática rejeitou criar uma conta persistente para o e-mail real do titular por uma chamada administrativa com nova senha, por considerar a ordem genérica insuficiente para essa identidade privilegiada específica. A tentativa não foi repetida por outro caminho. Não existe conta real criada, concessão real nem mensagem enviada. É necessária autorização específica para essa criação e posterior bootstrap.
2. **Proteção contra senhas vazadas:** indisponível no plano Supabase Free. O aviso do advisor permanece documentado; nenhum upgrade pago foi contratado. A ativação exige senha de 12–128 caracteres. MFA e política de recuperação do titular dependem de sua identidade real e devem ser tratados antes de dados sensíveis.
3. **Recuperação futura:** RPO/RTO corporativos, custódia de chaves e backup integral de futuros dados reais não podem ser comprovados com este ambiente vazio. A recuperação do schema e dos dados sintéticos de aplicação é testável e automatizada; ela não substitui essa decisão operacional futura.
4. **Cadastro público do Auth:** `/auth/v1/settings` ainda retorna `disable_signup=false`, com confirmação por e-mail e sem acesso anônimo. Não existe formulário público de cadastro e nenhuma identidade recebe grants automaticamente, mas desabilitar o cadastro na API ainda depende do painel. O conector não expõe atualização dessa configuração; o painel foi aberto e exige login. É necessário autenticar o painel para aplicar a restrição. [Evidência](../evidence/hub04/auth-settings.json).
5. **Publicação:** Lovable consultado somente em leitura. Nenhum comando enviado ao agente e nenhuma publicação acionada. Sincronização do código por merge normal é distinta da publicação do site.

Não existem outras issues abertas além do PR #11 no momento desta execução. O estado técnico e as pendências acima substituem as indicações de backend ainda não implantado dos relatórios antigos, sem apagar a trilha histórica.

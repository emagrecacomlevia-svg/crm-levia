# LEVIA HUB — Matriz conceitual RLS e plano de testes negativos

**Etapa:** HUB-04A. **Status:** desenho preliminar para parecer do auditor; sem migrations, SQL de negócio, RLS, permissões concedidas ou dados empresariais.

## Princípio de autorização

RLS é **negação por padrão**, com tabelas empresariais futuras inicialmente inacessíveis. No caso de dados acessíveis por APIs, habilitar RLS em todos os schemas expostos e rever `GRANT` e permissões da Data API, separadamente. `authenticated` significa identidade técnica, **não** papel de negócio. A autorização proposta combina `auth.uid()`, conta ativa, concessão corrente, capacidade, escopo e vínculo ao registro, com verificações no banco/backend. Nunca confiar em `raw_user_meta_data` ou campos do request para conceder acesso.

As entidades abaixo são **hipotéticas**, não nomes aprovados de tabelas ou schemas. Não interpretar a matriz como política pronta para execução; deverá ser revisada entidade por entidade na HUB-04B.

## Matriz de operações (futura, nenhuma regra implantada)

| Entidade futura      | Operação | Condição autorizada candidata                                | Negado quando                                    | Teste positivo futuro                            | Teste negativo futuro                   |
| -------------------- | -------- | ------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------ | --------------------------------------- |
| Contatos comerciais  | SELECT   | operador/gestor ativo no escopo e carteira atribuída         | anônimo, sem papel, outro escopo, desativado     | lê contato atribuído                             | não lê contato de outra carteira        |
| Contatos comerciais  | INSERT   | operador/gestor ativo com concessão create no escopo         | escopo não atribuído ou sem concessão            | cria contato sintético no próprio escopo         | não cria em escopo alheio               |
| Contatos comerciais  | UPDATE   | operador/gestor ativo e registro designado; campos aprovados | troca de responsável/escopo ou status desativado | atualiza campo permitido                         | nega reatribuição para outra carteira   |
| Contatos comerciais  | DELETE   | negado na fase inicial; eventual procedimento especial       | qualquer usuário sem regra especial aprovada     | teste de administração específica, se autorizada | operador não apaga histórico            |
| Oportunidades        | SELECT   | carteira designada e concessão ativa                         | outra carteira, sem papel ou desativado          | lê oportunidade atribuída                        | nega oportunidade de outra equipe       |
| Oportunidades        | INSERT   | operador/gestor ativo com escopo válido                      | falta de concessão create                        | cria registro de teste no escopo                 | não cria para terceiro                  |
| Oportunidades        | UPDATE   | registro designado, transição permitida e concessão vigente  | alteração de owner/status protegidos             | atualiza fase autorizada                         | nega mudança arbitrária de proprietário |
| Oportunidades        | DELETE   | negado até política de retenção aprovada                     | operador ou gestor sem delegação específica      | caso especial só após aprovação                  | nega exclusão normal                    |
| Pautas editoriais    | SELECT   | participante designado ou revisor atribuído                  | pauta de equipe não atribuída                    | consulta pauta fictícia autorizada               | nega pauta alheia                       |
| Pautas editoriais    | INSERT   | responsável editorial habilitado                             | outro perfil ou escopo                           | cria pauta fictícia                              | revisor não cria em nome de outro       |
| Pautas editoriais    | UPDATE   | autor/revisor com etapa específica e versão editável         | versão congelada ou etapa não atribuída          | edita rascunho autorizado                        | nega alteração após aprovação           |
| Pautas editoriais    | DELETE   | negado; arquivamento formal futuro                           | todos sem rito especial                          | arquiva conforme regra futura, se aprovada       | nega exclusão física                    |
| Revisões por versão  | SELECT   | revisor atribuído e responsável autorizado                   | versão/escopo não atribuído                      | vê parecer vinculado                             | nega leitura de versão não designada    |
| Revisões por versão  | INSERT   | revisor atribuído pode emitir parecer na própria fase        | autor sem atribuição científica                  | insere parecer sintético designado               | nega parecer de terceiro                |
| Revisões por versão  | UPDATE   | somente revisão própria não finalizada e dentro do prazo     | aprovação final, parecer de terceiro             | corrige parecer antes de encerrar                | nega alterar parecer finalizado         |
| Revisões por versão  | DELETE   | negado para preservar trilha                                 | todos sem rito legal específico                  | nenhum caso inicial permitido                    | nega apagar parecer                     |
| Versões comerciais   | SELECT   | gestor/aprovador designado; consulta restrita se liberada    | sem concessão, versão não vigente ou sigilosa    | lê versão liberada do escopo                     | nega consulta à versão restrita         |
| Versões comerciais   | INSERT   | aprovador/documental com permissão de propor                 | operador comum ou fora do escopo                 | propõe versão fictícia                           | nega versão em outro escopo             |
| Versões comerciais   | UPDATE   | aprovador distinto e transição controlada de estado          | autoaprovação, versão encerrada                  | aprova versão atribuída com gates                | nega autoaprovação e vigência irregular |
| Versões comerciais   | DELETE   | negado por rastreabilidade                                   | todos fora de procedimento formal                | caso excepcional requer autorização separada     | nega exclusão de histórico              |
| Concessões de acesso | SELECT   | gestão técnica autorizada e âmbito mínimo                    | usuário consultando concessões alheias           | lê concessão sob responsabilidade                | nega listar papéis de outra unidade     |
| Concessões de acesso | INSERT   | administrador técnico delegado com aprovação registrada      | autoatribuição ou ausência de aprovador          | atribui concessão após aprovação                 | usuário não atribui admin a si mesmo    |
| Concessões de acesso | UPDATE   | gestão delegada com revogação/auditoria                      | sujeito modifica própria concessão               | revoga acesso conforme rito                      | nega elevação sem aprovação             |
| Concessões de acesso | DELETE   | negado; usar revogação lógica auditável                      | inclusive técnico fora de procedimento           | não aplicável na proposta inicial                | nega remoção de evidência               |
| Eventos de auditoria | SELECT   | auditor delegado ao escopo, menor privilégio                 | outra equipe, usuário comum                      | consulta log autorizado                          | nega acesso indevido                    |
| Eventos de auditoria | INSERT   | somente mecanismo backend controlado                         | cliente frontend ou sessão comum                 | evento aparece após ação auditável               | cliente não forja evento                |
| Eventos de auditoria | UPDATE   | negado                                                       | qualquer usuário final                           | não aplicável                                    | nega adulteração de histórico           |
| Eventos de auditoria | DELETE   | negado; retenção sob governança própria                      | qualquer usuário final                           | não aplicável                                    | nega apagamento de log                  |

## Matriz transversal de atores — cenários obrigatórios

| Ator de teste               | Leitura SELECT               | Escrita INSERT/UPDATE           | Exclusão DELETE  | Negativo obrigatório                        |
| --------------------------- | ---------------------------- | ------------------------------- | ---------------- | ------------------------------------------- |
| Sem autenticação            | negar                        | negar                           | negar            | tentar cada operação em todos os escopos    |
| Autenticado sem papel       | negar                        | negar                           | negar            | mesmo com JWT válido, ausência de concessão |
| Operador comercial ativo    | só carteira delegada         | só operações próprias           | negar            | outra carteira e elevação de papel          |
| Gestor comercial ativo      | só unidades aprovadas        | operações concedidas            | negar            | outra unidade e autoaprovação               |
| Revisor editorial ativo     | só versões designadas        | parecer apenas na própria etapa | negar            | aprovar conteúdo não designado              |
| Administrador técnico ativo | somente concessão específica | somente tarefa delegada         | negar por padrão | conteúdo de negócio sem delegação           |
| Usuário desativado          | negar                        | negar                           | negar            | JWT ainda válido após desativação           |

## Protocolo de testes a especificar na HUB-04B

1. Criar **exclusivamente** fixtures sintéticas em projeto autorizado da fase futura, com dois escopos distintos e papéis separados. Nenhuma fixture existe agora.
2. Testar cada verbo `SELECT`, `INSERT`, `UPDATE`, `DELETE` por ator, entidade, escopo e estado de conta, validando **resultado e ausência de vazamento**, não apenas status HTTP.
3. Para `UPDATE`, testar política `SELECT`, `USING` no registro anterior e `WITH CHECK` no novo; negar alteração de escopo/owner e autoaprovação.
4. Testar leitura de item individual, listagem, paginação, busca/filtro, operações em lote, relações indiretas, concorrência e erros que revelem existência de registros.
5. Testar `anon`, usuário autenticado sem concessão, JWT expirado, concessão revogada, `enabled = false` com token ainda válido e mudança de equipe sem renovação de JWT.
6. Testar escalada de privilégio: `user_metadata` forjado, atributos de request alterados, `tenant_id` arbitrário, troca de ID/owner em payload e perfil técnico sem permissão de negócio.
7. Testar separação entre revisão editorial, científica e aprovação comercial; bloquear aprovação da própria versão quando segregação exigida.
8. Verificar proteção de `service_role`/chaves secretas: jamais no frontend; também revisar funções `SECURITY DEFINER`, views e grants, se futuramente existirem.
9. Conferir testes em nível de banco e chamadas server-side; nenhum guard React/TanStack pode substituir a RLS.
10. Registrar evidências auditáveis: caso, identidade sintética, escopo, operação, resultado esperado/obtido e SHA de migration; só liberar dados após 100% dos cenários críticos aprovados.

## Critérios de bloqueio antes de qualquer esquema

- Ausência de decisão sobre origem confiável de papéis/escopos, revogação de conta, segregação de deveres e responsabilidade por auditoria.
- Tentativa de usar apenas `TO authenticated` como autorização de conteúdo.
- Tabela futura exposta sem RLS, grants e testes negativos revisados.
- Políticas de edição sem `WITH CHECK` ou possibilidade de movimentar registros entre escopos.
- Views `SECURITY DEFINER`, funções privilegiadas, `service_role` em cliente ou bypass sem aprovação expressa.
- Falta de plano mínimo de recuperação e privacidade compatível com o uso.

Referências: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth Sessions](https://supabase.com/docs/guides/auth/sessions), [API Security](https://supabase.com/docs/guides/api/securing-your-api).

**Nenhuma política foi aplicada.** Esta matriz prevê testes futuros, não é evidência de isolamento operacional.

## HUB-04B1 — testes preparados versus garantia real

A migration candidata isola quatro tabelas em `hub_private`, revoga o acesso
à Data API e mantém zero políticas permissivas. O workflow `identity-sql.yml`
executa testes **reais de PostgreSQL 17 apenas em contêiner descartável** com
schema `auth` de teste, sem rede e sem acesso ao projeto Supabase remoto.

- Estrutura: quatro tabelas, PK/FK, nove capacidades, dois índices secundários,
  RLS habilitada nas quatro e `pg_policies` vazio.
- ACL: `has_schema_privilege`, `has_table_privilege` e tentativas reais de
  leitura anônima, leitura `authenticated` e escrita no catálogo.
- Restrições: conta inicialmente desativada, FK Auth, unicidade de concessões
  não revogadas, limites de vigência, escopo incompatível e autoatribuição.
- Condição **diagnóstica**: a leitura privilegiada de dados sintéticos mostra
  que concessões expiradas, revogadas ou vinculadas a contas desabilitadas
  não satisfazem o predicado de vigência previsto.
- Ausência de acesso comercial/editorial: não há nenhuma tabela CRM ou Social
  Studio, GRANT, policy ou função privilegiada para essas áreas.

**Limite de segurança:** os testes do predicado diagnóstico não provam RLS
positiva. Como o sistema nega tudo agora, nenhum teste demonstra um usuário
legitimamente autorizado lendo um registro — isso exige políticas futuras
revisadas, com testes positivos e negativos por escopo. O registro de eventos
não é automaticamente preenchido, protegido contra todos os operadores
privilegiados ou associado atomicamente à mutação de concessões. Essa é uma
pendência bloqueante para administração real de privilégios.

Testes posteriores obrigatórios: atores reais de teste com identidade Auth,
sessão expirada, JWT antigo após desativação, concessão expirada/revogada,
escalada de privilégio, concorrência, segmentação por registro e verificação
de que todas as alterações em concessões produzem eventos completos.

## HUB-04B1-C01 — testes negativos ampliados

No PostgreSQL 17 isolado, verificar 48 operações reais: SELECT, INSERT, UPDATE e DELETE sobre as quatro tabelas, usando SET ROLE `anon`, `authenticated` e `service_role` do stub. **Cada uma precisa falhar com SQLSTATE 42501.** UPDATE/DELETE aceito com zero linhas é FALHA do teste, não prova de segurança. Verificar também 48 combinações de ACL separadas por operação, RLS habilitado e nenhuma policy permissiva.

**ACL versus RLS:** testes com roles sem USAGE no schema comprovam negação por privilégio; um GRANT temporário para SELECT/USAGE somente no PostgreSQL local, removido antes do ROLLBACK, demonstra a filtragem RLS sem políticas apesar de existirem dados. `service_role` do stub é NOLOGIN sem BYPASSRLS; a realidade do Supabase gerenciado exige auditoria posterior.

Testar cronologia de revogação, agendamento futuro, NULL, validade igual/invertida, revogador com/sem timestamp, CASCADE de conta/grants após excluir Auth e SET NULL do ator em grant/evento. O evento de auditoria é **inserido manualmente como fixture** e não comprova geração automática.

**Bloqueio operacional:** aprovação de retenção/privacidade e exclusão LGPD, autor confiável validado server-side, auditoria atômica, política positiva por escopo e homologação contra Supabase gerenciado.

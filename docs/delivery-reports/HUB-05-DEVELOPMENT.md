# HUB-05 — Catálogo referencial e campanhas

**Escopo:** desenvolvimento isolado, com dados fictícios, autorizado pelo responsável em 26/10/2026 ao solicitar a próxima etapa sem depender do login no painel Supabase. A HUB-04 permanece implantada e validada tecnicamente, com primeiro administrador real pendente. Este avanço não declara operação empresarial ou produção homologada.

## Base e resultado

O relatório técnico HUB-01, seções 7.1 e 14, define catálogo referencial, versões demonstrativas, preços fictícios e identificadores de campanha. O critério central é preservar o histórico e impedir promoção automática de versões anteriores. O relatório foi consultado integralmente nos trechos aplicáveis; referências antigas a autorização por etapa não substituem a ordem atual do responsável.

A rota pública `/catalog-demo` oferece um laboratório acessível pela home, independente de login. Todos os dados são inventados e permanecem somente na memória da página. Recarregar ou reiniciar os exemplos descarta as alterações. Não há consulta ao Supabase, escrita remota, armazenamento no navegador, importação de documentos, envio de e-mails ou publicação externa.

Funcionalidades implementadas:

- Catálogo com identidade estável por SKU e versões independentes de nome, apresentação, segmento e referência documental.
- Tabelas comerciais versionadas, público, condições, moeda BRL, preço em centavos e intervalo de validade com término exclusivo.
- Seleção explícita de tabela com motivo e histórico. A criação de uma versão, sua numeração ou suas datas não selecionam vigência. A expiração da última decisão não reativa uma tabela anterior.
- Campanhas fictícias com código único, finalidade, canal, datas e identificador UTM único. Os códigos usam o prefixo DEMO.
- Vínculos entre campanha e versões exatas de catálogo e tabela. Alterações futuras não recalculam os preços históricos vinculados.
- Interface responsiva, erros de validação, estado sem tabela vigente, reinício dos exemplos e histórico de decisões da simulação.

## Modelo de banco candidato

[`20261026033532_catalog_campaigns.sql`](../../supabase/candidates/hub05/20261026033532_catalog_campaigns.sql) foi criada por `supabase migration new catalog_campaigns`, CLI 2.122.0, e mantida fora da pasta de migrations implantadas. Ela **não foi aplicada ao Supabase remoto** e não integra o manifesto de implantação da HUB-04.

O schema privado `hub_catalog_private` contém oito tabelas: itens, versões de catálogo, versões comerciais, itens de preço, decisões de seleção, campanhas, referências e eventos de auditoria. RLS habilitada em todas; nenhuma policy positiva; nenhum privilégio para `PUBLIC`, `anon`, `authenticated` ou `service_role`. Todas as funções são `SECURITY INVOKER` com `search_path` vazio e execução revogada dos clientes.

Versões e referências são append-only; updates, deletes e truncates são rejeitados. A seleção ou referência de uma tabela sela seus preços. Bloqueios no registro pai serializam a construção e o uso da tabela; a seleção usa um bloqueio transacional comum e atribui a ordem da decisão somente depois dele. A auditoria é atômica com cada inclusão e identifica o papel de banco executor. Isso não simula uma identidade Auth real e não é uma API operacional autorizada.

A semântica de vigência é de **uma tabela selecionada por laboratório**. Público é metadado, não um mecanismo de autorização ou múltiplos catálogos ativos. Expandir essa regra para operação real exige o modelo empresarial e o vínculo de identidade/capacidade no backend.

## Dataset e verificação

[`fixture.ts`](../../src/modules/core/catalog/fixture.ts) contém dois itens inventados, duas versões de catálogo, duas tabelas com quatro preços fictícios, uma campanha e um vínculo histórico. Começa sem decisão de vigência. Não representa catálogo, produto, apresentação, preço ou campanha real da LEVIA.

Os testes unitários e de interface incluem criação imutável de versões, preços inteiros, datas impossíveis, duplicidade, referências inexistentes, seleção explícita, expiração, ausência de fallback, motivos, decisões retroativas e histórico de campanhas. A suíte local completa passou com **61 testes em 11 arquivos**. Build, tipos e formato passaram; lint mantém zero erros e os seis avisos preexistentes de Fast Refresh.

[`qa-hub05-browser.cjs`](../../scripts/qa-hub05-browser.cjs) verifica navegação, cinco larguras, criação de versões/tabelas/campanhas, vínculos fixos, expiração, duplicidade, restauração ao recarregar e ausência de chamadas ao Supabase. Capturas e resultados são produzidos em `artifacts/hub05-browser` e anexados ao CI.

[`hub05-catalog-qa.yml`](../../.github/workflows/hub05-catalog-qa.yml) aplica a candidata em PostgreSQL 17 descartável sem rede. Os ensaios verificam constraints, imutabilidade, falha de auditoria com rollback, 96 operações negadas sob três papéis (incluindo `service_role` com BYPASSRLS), RLS isoladamente e dump/restore com digest de auditoria. A execução e seu resultado devem ser conferidos no PR; a presença do workflow não constitui prova de aprovação.

## Limites e continuidade

O módulo está preparado para avaliação em desenvolvimento. A próxima integração desta mesma HUB-05 é implementar e homologar o acesso persistente com identidade real, capacidades e responsáveis definidos, usando a candidata auditada. Não criar um bypass de autenticação para disponibilizar dados empresariais. A política de senhas no painel e a primeira identidade administrativa da HUB-04 continuam pendentes; cadastro público já bloqueado e verificado.

Nenhuma etapa HUB-06 em diante foi implementada. Não houve comando ao Lovable, contratação de serviço, criação de projeto remoto, alteração do site institucional, QR, CRM funcional, dados clínicos ou financeiros. O avanço fica em branch e PR próprios, preservando o checkpoint da HUB-04 na main.

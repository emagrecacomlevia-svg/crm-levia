# HUB-05 — Homologação operacional privada (PR #13)

## Acesso ao código exato da PR, sem publicação

O preview existente no Lovable está ligado à `main` e **não** deve ser utilizado para certificar a PR #13. O teste operacional deve executar o HEAD atual da branch `dev/hub-05-integrated-catalog-20261027`, sem merge.

**Opção recomendada: Codespace pessoal e porta privada, iniciado pelo proprietário.** No GitHub, abra a branch da PR #13, selecione **Code > Codespaces > Create codespace on this branch**. O arquivo `.devcontainer/devcontainer.json` instala Bun 1.3.2 a partir do npm e dependências do `bun.lock`; aguarde a preparação e execute no terminal:

```bash
git branch --show-current
git rev-parse HEAD
bun run dev -- --host 0.0.0.0 --port 3000
```

Confirme que a branch é `dev/hub-05-integrated-catalog-20261027`. Na aba **PORTS**, garanta **Visibility = Private** e **Protocol = HTTPS**, sem compartilhar o endereço com terceiros. Abra a URL apresentada para a porta 3000 e depois `/login`. Portas privadas do Codespaces exigem login GitHub do próprio criador; nenhum app foi publicado em produção. Se o GitHub indicar cobrança ou limite de cota, **não criar Codespace**: use a alternativa local abaixo. Nenhum serviço pago está autorizado automaticamente.

**Alternativa local sem hospedagem e sem Codespaces:** em sua estação privada com Git, Bun 1.3.2 e acesso ao GitHub:

```bash
git clone https://github.com/emagrecacomlevia-svg/crm-levia.git
cd crm-levia
git switch dev/hub-05-integrated-catalog-20261027
bun install --frozen-lockfile
bun run dev -- --host 127.0.0.1 --port 3000
```

Abra `http://127.0.0.1:3000/login`. A URL é acessível apenas na própria máquina. A aplicação utiliza a URL e chave publicável do **Supabase de desenvolvimento** já configuradas no servidor; nunca inserir `service_role`, `postgres`, senha SQL ou tokens em arquivos, commits ou chats.

## Ensaio real a realizar pessoalmente

1. Entrar em `/login` com a conta administrativa principal; não compartilhar senha, bearer, cookies, refresh token ou URL privada.
2. Abrir `/app/catalog` e confirmar leitura do snapshot e da auditoria.
3. Na ação **Novo item referencial**, criar um SKU exclusivo, por exemplo `DEMO-HUB05-FINAL-20261028-A1`. Não usar dados de clientes ou produção.
4. Recarregar a página por completo e verificar a permanência do mesmo SKU.
5. Confirmar no painel a auditoria da criação; a validação definitiva é uma consulta SQL **somente leitura** que associa o novo item à identidade e `session_id` da sessão Auth, sem divulgar esses valores.
6. Fazer logout e tentar acessar diretamente `/app/catalog`: deve redirecionar para `/login` ou negar acesso. O smoke automatizado remoto já exige HTTP 401 para requisições anônimas/portadores inválidos.
7. Registrar apenas o SKU DEMO, o resultado e o horário aproximado no canal privado de evidência; não copiar credenciais ou tokens. O Auditor verifica os dados diretamente no Supabase.

**Escopo temporal:** os dois grants em DEV expiram em `2026-10-30T00:00:00Z`. Não renovar nem revogar para executar a homologação. Revogação foi testada em fixture PostgreSQL isolado; não desligar o acesso real antes de finalizar a prova operacional.

## Mitigação da exposição de UUID Auth no GitHub público

A migration histórica `20261028000351_hub05_owner_only_governance.sql` contém dois UUIDs Auth literais. **Não são segredos de autenticação**, e possuir um UUID não concede sessão, permissões ou acesso SQL. O histórico já público e os objetos Git anteriores ainda podem ser recuperados; **não afirmar que a exposição foi apagada**.

A migration aditiva `20261028005531_hub05_owner_uuid_indirection.sql` substitui somente o corpo executável da função privada para resolver o proprietário e o ator técnico original via `hub_private.admin_accounts` e eventos HUB-04 auditados, sem incluir UUIDs reais no novo SQL. Não altera grants, RLS, sessões, identidades, auditoria ou migrations anteriores. Fixtures atuais de teste usam UUIDs sintéticos, enquanto commits históricos permanecem intactos. O repositório segue público por decisão do proprietário. Avaliar restringir a visibilidade apenas mediante futura autorização expressa, caso a preocupação seja a disponibilidade permanente dos identificadores históricos.

## Estados de evidência

- Concessão real, escopo, vigência e decisão original: verificáveis no Supabase dev e auditados antes do teste.
- CI PostgreSQL, Edge, aplicação e smoke anônimo: evidência automatizada; **não** substitui login real.
- **Login real + escrita + persistência + auditoria da sessão + prova visual:** pendentes de ação do proprietário no preview privado.
- Parecer final do Auditor: pendente de comprovação acima; PR #13 continua draft, sem merge.

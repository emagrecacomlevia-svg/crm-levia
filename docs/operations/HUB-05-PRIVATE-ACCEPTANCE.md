# HUB-05 — Homologação operacional privada (PR #13)

## Acesso ao código exato da PR, sem publicação

O preview existente no Lovable está ligado à `main` e **não** deve ser usado para certificar a PR #13. O teste deve ocorrer exclusivamente na branch `dev/hub-05-integrated-catalog-20261027` (confirmar HEAD na PR antes de começar). Não alterar `main` nem tornar a prévia pública.

### Caminho mais simples para o responsável — somente cliques

1. Acesse a [PR #13](https://github.com/emagrecacomlevia-svg/crm-levia/pull/13), verifique que a branch indicada é `dev/hub-05-integrated-catalog-20261027`, e abra o repositório nessa branch.
2. Clique em **Code → Codespaces → Create codespace on this branch**, usando sua própria conta GitHub. Se o GitHub pedir pagamento ou indicar falta de cota gratuita, **não confirme nem cadastre pagamento**; relate apenas que a opção foi bloqueada.
3. O Codespace instala Bun e dependências automaticamente (`postCreateCommand`). Ao iniciar, `postStartCommand` liga a aplicação na porta 3000, sem terminal e sem comandos manuais. A prévia poderá abrir automaticamente; caso contrário, na aba **PORTS/PORTAS**, clique no ícone de abrir no navegador da porta **3000 — LEVIA HUB-05**.
4. **Antes de inserir sua senha**, confira na aba PORTS que a porta 3000 tem **Visibility = Private** e **Protocol = HTTPS**. As portas Codespaces são privadas por padrão; se aparecer diferente, ajuste por cliques. Se não for possível garantir ambas, não use a prévia e comunique o bloqueio.
5. Na nova aba privada, acesse `/login`, use sua própria conta administrativa habilitada e siga o ensaio abaixo. **Nunca compartilhe URL privada, senha, token, cookie ou código**. O envio de uma confirmação textual do SKU e do resultado basta para a verificação posterior no Supabase.
6. Após o teste, no GitHub Codespaces é possível parar ou excluir a instância pela página **Your codespaces**; não há necessidade de publicar/deployar nada.

**Custo:** Codespaces pessoais possuem cota gratuita mensal, mas não podemos verificar o saldo desta conta pela integração atual. Não incorrer em cobranças; não criar instância se o painel exigir pagamento. A execução da prévia depende da criação pessoal da instância GitHub, que não está disponível nas ações conectadas deste desenvolvedor. Não alegar ambiente ativo sem confirmação pessoal.

### Alternativa técnica reservada ao desenvolvedor (não exigida ao responsável)

Se Codespaces não estiver disponível dentro da cota gratuita, o desenvolvedor poderá conduzir a opção local isolada, sem pedir ao responsável para executar terminal ou instalar dependências. Como referência técnica (não roteiro do responsável):

```bash
git clone https://github.com/emagrecacomlevia-svg/crm-levia.git
cd crm-levia
git switch dev/hub-05-integrated-catalog-20261027
bun install --frozen-lockfile
bun run dev -- --host 127.0.0.1 --port 3000
```

O frontend usa apenas configurações **publicáveis** do Supabase de desenvolvimento. Nunca usar `service_role`, credenciais de banco ou tokens pessoais na aplicação, no histórico GitHub ou no chat.

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

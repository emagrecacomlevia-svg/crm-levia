# HUB-05 — Governança de proprietário único em desenvolvimento

## Autoridade e transparência

O responsável LEVIA confirmou formalmente que **ambas as contas Auth existentes pertencem à mesma pessoa**. O UUID da conta técnica utilizada em HUB-04 continua nos registros históricos imutáveis, mas **não é uma segunda pessoa nem aprovação independente**. Nenhuma declaração passada é reescrita. O único administrador original é a única autoridade para decisões empresariais. O Desenvolvedor executa; o Auditor revisa tecnicamente; o proprietário aprova.

Uma única migration aditiva 20261028000351 cria a decisão privada, auditável e um procedimento estrito para os pares de permissões de catálogo. Ela NÃO executa outorgas ao instalar. A autorização explícita do proprietário deste ciclo foi arquivada em pasta Drive privada; sua SHA-256 ancora o texto e metadados sem se passar por assinatura eletrônica. O prazo escolhido para a primeira outorga é 2026-10-30T00:00:00Z, limite da autorização nominal anterior e inferior a sete dias.

## Primeira outorga

Apenas o executor privado postgres, depois da autorização documental, chama `hub_private.owner_catalog_change` com a ação `initial`, UUID do único admin HUB-04 original e sessão Auth ainda válida, referência `LEVIA-OWNER-[A-Z0-9]{12,32}`, motivo, validade entre uma hora e sete dias e SHA-256 de evidência externa. Rejeita qualquer grant prévio de catálogo, qualquer outra identidade, replay e privilégio público. Insere exatamente `catalog.read` e `catalog.write` em `module:catalog` e seus eventos append-only na mesma transação.

As restrições históricas `grant_no_self_assignment` e `audit_event_subject` permanecem intactas: o executor técnico tem `granted_by_auth_user_id=NULL` e `actor_auth_user_id=NULL`, enquanto a **autoridade principal** é identificada em `owner_auth_user_id`, `owner_session_id`, `owner_ref`, evidência SHA-256 e `executor_role` tanto na decisão privada como nos eventos de auditoria. Não existe segundo aprovador humano. Uma decisão com ator SQL NULL não é um evento anônimo: há sessão Auth real e proprietário explícito no contexto e na tabela privada. O mesmo modelo aplica-se à renovação e revogação.

## Manutenção: explícita e somente quando necessário

A função Edge `hub-catalog-owner` aceita exclusivamente POST autenticado com token Supabase Auth real validado em `/auth/v1/user`; o PostgreSQL verifica sessão viva em `auth.sessions`. O corpo é estrito:

```json
{
  "action": "renew",
  "ownerRef": "LEVIA-OWNER-NOVAREFERENCIA123",
  "reason": "Justificativa nova de pelo menos 30 caracteres, específica para a manutenção.",
  "validUntil": "2026-11-01T00:00:00Z"
}
```

O exemplo não representa autorização. O endpoint também aceita `action:"revoke"` com `validUntil:null`. Ambas as decisões exigem uma nova referência única e são registradas. Uma renovação somente ocorre **após a expiração natural de ambos os grants íntegros**. Nunca reativa privilégios revogados por incidente, nem durante a vigência do par. O executor encerra historicamente as duas linhas vencidas, audita e emite duas novas, tudo na mesma transação. Revogação explícita bloqueia renovação futura automática. Não há agendamento, cron, autoalongamento ou grants mais amplos. O prazo é no máximo sete dias a cada decisão explícita.

A função legada `hub-catalog-renew-approve` e suas SQLs ficam como histórico técnico, mas **não se aplicam ao novo modelo**: requerem uma primeira outorga legada com operação `hub05-initial-catalog-grant`, que nunca ocorreu. Não utilizar a conta secundária para simular independência.

## Homologação e pendências

Os testes isolados usam PostgreSQL descartável e transações rollback; os testes remotos verificam RLS, ACL, sessão, escopo, grants e auditoria. O QA HTTP positivo requer o token bearer real da sessão do administrador, fornecido diretamente ao executor seguro da QA; não deve ser obtido do banco, Git, logs ou contas secundárias. Revisor técnico deve avaliar antes de aprovar PR #13. Não fazer merge ou publicar produção.

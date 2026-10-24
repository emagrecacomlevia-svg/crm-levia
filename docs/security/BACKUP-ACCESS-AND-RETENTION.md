# HUB-04B2B-R01 — Acesso, criptografia, retenção e descarte (AT-024)

**Escopo:** controles propostos para futuros dumps reais; nenhum backup remoto, senha, URL privada ou credencial foi disponibilizado/produzido nesta etapa.

## Classificação e custódia

Um dump real pode conter dados pessoais, identificadores, segredos materiais, tokens, conteúdo de auditoria e configurações privadas. Classificar como **RESTRITO** até avaliação formal. Nunca enviar por GitHub, PR, comentário, logs, artefatos GitHub Actions, conversa com IA, e-mail não autorizado ou links Drive públicos.

O Git bundle do AT-023 é backup **do código**, não do PostgreSQL. O Google Drive oficial de checkpoints Git não recebe por padrão dumps de banco real sem decisão explícita sobre pasta segregada, tipo de proteção e permissões.

## Acesso mínimo e separação de funções

- Responsável LEVIA define proprietário, finalidade, janela, escopo, base legal de tratamento e revisores com acesso.
- Consultor audita SHA, procedimento, resultados de restore e riscos, **sem receber** chave, senha ou conteúdo sensível.
- Executor autorizado recebe acesso temporário ao projeto exato somente em estação privada verificada, sem usar GitHub Actions nem armazenamento em conta pública.
- Chave privada ou senha de descriptografia fica fora do local do ciphertext, sob responsável distinto ou cofre aprovado; jamais anexar ao dump ou ao manifesto público.
- Auditoria de acesso ao arquivo e ao cofre: quem, quando, finalidade, expiração e revogação. Restaurar apenas em ambiente autorizado isolado; jamais reutilizar dados reais em CI.

## Criptografia e verificação

1. Exportar somente para diretório com `umask 077`; confirmar tamanho, exit code, catálogo e hash dos SQLs antes da cifragem.
2. Escolher previamente mecanismo de criptografia apropriado e verificável (por exemplo, **age com destinatários controlados** ou OpenPGP com integridade e AES256). A prova isolada R01 usa GPG AES256 e senha aleatória temporária; **não** comprova implantação organizacional de cofre/rotação.
3. Criar envelope criptografado com nomes neutros; gerar SHA-256 do ciphertext e registrá-lo em manifesto confiável fora do mesmo local quando possível. Não afirmar que SHA isolado substitui autenticação nem que ZIP sem criptografia protege dados.
4. Transferir apenas ciphertext via canal autorizado; fazer download/validação de SHA, abrir com chave separada, comparar hashes internos e testar restauração em ambiente novo.
5. Validar RLS, GRANT/REVOKE, owners, políticas, constraints, dados, dependências e migration history separadamente antes do aceite.
6. Arquivos CSV/SQL, dumps, logs com dados, scripts com credenciais, arquivos de chave, outputs de `pg_dump` e `.pgpass` **não** entram no Git ou nos artefatos de CI.

## Retenção e descarte (proposta não aprovada)

- Não estabelecer prazo arbitrário: responsável, Segurança/Privacidade e Consultor devem aprovar política antes da exportação real, incluindo finalidade, expiração, obrigação de retenção e eventual retenção legal.
- Reavaliar necessidade de manutenção após migração e após ensaios; restringir compartilhamento e registrar revogações.
- Eliminar temporários na estação e no runner privado, invalidar credenciais usadas e observar versões, snapshots e backups do destino. `rm` isoladamente não garante apagamento irreversível de SSD nem armazenamento cloud.
- Não excluir backups Git históricos do AT-023; retenção deles é independente da de dumps restritos.
- Um backup sem chave recuperável, sem teste de restauração e sem hash de origem/transferência **não passa** no portão de aceite.

## Dados no relatório público

Podem ser compartilhados somente identificadores não secretos do checkpoint, versão do software, formato de arquivo, SHA-256 do ciphertext quando não criar vazamento contextual, status de teste, contagens **agregadas não pessoais** e exceções sanitizadas. Não publicar URLs privadas com parâmetros, valores de variáveis de ambiente, dumps, nomes de clientes, linhas de dados, logs de SQL contendo registros ou conteúdo de secrets.

## Bloqueios

Exportação real requer autorização própria AT posterior, método seguro de injeção de credenciais homologado, acesso ao cofre e à chave, escopo de schemas e dependências aprovado, destino privado e retenção assinada, validação da Data API persistida e definição de responsáveis por resposta a falhas. Não criar secrets no GitHub para contornar limitações.

**AT-024 não autoriza nem exportação de dados reais nem implantação da migration.**

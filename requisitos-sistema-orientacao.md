# Documento de Requisitos — Sistema de Gestão de Orientações (TCC, Mestrado e Doutorado)

> **Instrução para a IA que vai construir:** leia este documento inteiro antes de escrever código. Construa por fases (seção 12), começando pela Fase 1. Ao terminar cada fase, pare, resuma o que foi feito e aguarde validação. Quando encontrar uma ambiguidade, adote o padrão indicado na seção 13 e registre a decisão; se não houver padrão indicado, pergunte antes de assumir.

---

## 1. Visão geral

Plataforma web para um professor orientador gerenciar seus orientandos de TCC, mestrado e doutorado. O sistema cobre:

- agendamento de reuniões integrado ao Google Calendar;
- acompanhamento da situação de cada aluno, com alertas;
- resumo de reuniões por IA a partir de transcrições coladas pelo professor;
- área própria para cada aluno acompanhar sua orientação.

**Princípio de simplicidade:** a gravação e a transcrição das reuniões acontecem **fora do sistema**, no Google Meet. O professor apenas copia a transcrição e cola (ou sobe o arquivo) no sistema. O sistema **não grava nem transcreve nada**.

## 2. Perfis de usuário

| Perfil | Descrição |
|---|---|
| **Professor (admin)** | Vê todos os alunos, define horários, cria reuniões, cola transcrições, aprova resumos, configura alertas. |
| **Aluno** | Níveis: TCC, mestrado ou doutorado. Entra com login próprio e vê **apenas** os próprios dados. |
| **Coorientador (opcional, Fase 3)** | Acesso somente leitura a alunos específicos, concedido pelo professor. |

O modelo de dados deve prever um `orientador_id` em toda entidade de aluno, para permitir vários orientadores no futuro, mesmo que a primeira versão tenha só um.

## 3. Requisitos funcionais

### 3.1 Acesso e contas
- **RF01** — Login de professor e aluno, com recuperação de senha por e-mail.
- **RF02** — O aluno só cria conta por **convite** enviado pelo professor (link com token de uso único e validade).
- **RF03** — Cada aluno acessa exclusivamente os próprios dados (isolamento por usuário em toda consulta).
- **RF04** — Na primeira entrada, o aluno vê e aceita um texto de ciência (uso de IA nos resumos, tratamento de dados). O aceite é registrado com data e hora.

### 3.2 Cadastro e acompanhamento de alunos
- **RF05** — Cadastro de aluno: nome, e-mail, nível (TCC/mestrado/doutorado), tema, data de início e prazos-chave (por exemplo qualificação, defesa, depósito).
- **RF06** — **Status manual** definido pelo professor: `ok`, `atenção`, `crítico`.
- **RF07** — **Status sugerido automático**, calculado a partir de regras (seção 5). O professor pode aceitar ou sobrescrever.
- **RF08** — Exibir **dias desde a última reunião** realizada de cada aluno.
- **RF09** — **Painel do professor** com todos os alunos, ordenável e filtrável por status, nível e dias sem reunião.
- **RF10** — **Fila "quem contatar hoje"**: lista priorizada por risco, combinando status, dias sem reunião, tarefas atrasadas e prazos próximos.
- **RF11** — **Arquivamento de egressos**: o aluno sai do painel ativo, mas o histórico é mantido.

### 3.3 Agenda e reuniões
- **RF12** — O professor define **horários livres** (recorrentes, por exemplo toda terça 14h–16h, ou avulsos) e **horários fixos por aluno** (reunião recorrente semanal, por exemplo).
- **RF13** — O aluno vê os horários livres e **agenda** a reunião. Ele informa (ou confirma) o e-mail que receberá o convite.
- **RF14** — **Sem conflito de horário**: um horário ocupado não pode ser reservado; a reserva deve ser atômica para evitar duas reservas simultâneas.
- **RF15** — Ao confirmar o agendamento, o sistema cria o evento na **agenda Google do professor** (conta dele), com o e-mail do aluno como **convidado** e **link do Google Meet** incluído.
- **RF16** — **Cancelar e remarcar** (pelo aluno, dentro de regra de antecedência, ou pelo professor) atualiza ou remove o evento no Google Calendar.
- **RF17** — **Lembretes por e-mail** ao aluno antes da reunião (padrão: 24h antes).
- **RF18** — Registro de **falta sem aviso**, que alimenta os alertas.

### 3.4 Antes da reunião
- **RF19** — **Check-in pré-reunião**: o aluno responde 3 campos curtos (o que fez desde a última reunião, dúvidas, bloqueios) até 24h antes. O professor vê as respostas na tela da reunião.
- **RF20** — A tela da reunião exibe as **tarefas em aberto** do encontro anterior.

### 3.5 Durante e depois da reunião
- **RF21** — Cada reunião guarda: data, pauta, transcrição, resumo, combinados e tarefas.
- **RF22** — **Entrada da transcrição**: o professor **cola o texto** ou **sobe um arquivo** (.txt, .docx ou .pdf). Este é o único ponto de entrada do conteúdo da reunião.
- **RF23** — **Resumo por IA**: a transcrição é enviada a um provedor de IA (Claude e Gemini configuráveis) no servidor. A IA devolve um **rascunho** em formato fixo: *decisões, combinados, dúvidas em aberto, próximos passos*.
- **RF24** — O professor **edita e publica** o resumo. **O resumo nunca fica visível ao aluno sem aprovação do professor.**
- **RF25** — **Extração automática de tarefas**: a IA propõe tarefas a partir da transcrição; o professor aprova com um clique e elas entram na lista do aluno (com responsável e prazo editáveis).
- **RF26** — **Tarefas** com prazo, status (aberta/concluída) e marcação de conclusão pelo aluno.
- **RF27** — **Notas privadas** (só o professor vê) separadas de **notas compartilhadas** (o aluno vê).
- **RF28** — **Linha do tempo por aluno**: reuniões, resumos publicados, tarefas, marcos e entregas em ordem cronológica.
- **RF29** — **Busca** em todos os resumos e notas (por exemplo, "o que combinamos sobre a metodologia").

### 3.5 Acompanhamento avançado
- **RF30** — **Alertas**: dias sem reunião, tarefa atrasada, prazo se aproximando, falta sem aviso e check-in não preenchido.
- **RF31** — **Cronograma por aluno**: marcos (qualificação, defesa, depósito) com progresso.
- **RF32** — **Termômetro de bem-estar (opcional por aluno)**: o aluno marca de 1 a 5 como está; o professor vê a tendência ao longo do tempo. O dado é sensível: visível apenas ao professor, e o aluno pode desativar o recurso a qualquer momento.

### 3.6 Trabalho e produção do aluno
- **RF33** — **Entregas com versões**: o aluno registra ou linka uma versão (Drive, Overleaf ou arquivo); o professor registra o feedback vinculado àquela versão.
- **RF34** — **Produção acadêmica**: lista de artigos por aluno com venue, status (em escrita, submetido, em revisão, aceito, publicado) e prazos de submissão.

### 3.7 Relatórios e dados
- **RF35** — **Relatório por aluno em PDF**: histórico de reuniões, marcos e produção, para uso em relatório semestral ou de programa.
- **RF36** — **Exportação e exclusão de dados** de um aluno a pedido dele (LGPD).
- **RF37** — **Coorientador** com acesso somente leitura, concedido por aluno (Fase 3).

## 4. Integrações

### 4.1 Google Calendar e Meet
- Autenticação **OAuth 2.0** com a conta Google do professor (escopo mínimo para criar, editar e excluir eventos).
- Criação de evento com `attendees` (e-mail do aluno) e `conferenceData` para gerar o link do Meet.
- Sincronizar cancelamentos e remarcações nos dois sentidos, no mínimo do sistema para o Google.
- Tratar expiração e renovação do token de acesso; avisar o professor se a conexão cair.
- O sistema **não** interage com a gravação nem com a transcrição do Meet.

### 4.2 IA para resumo
- Camada de abstração com provedor configurável (Claude ou Gemini); trocar de provedor não deve exigir mudar o resto do sistema.
- **Chaves de API ficam somente no servidor**, nunca expostas ao navegador.
- O prompt exige saída estruturada (JSON) com: decisões, combinados, dúvidas em aberto, próximos passos e lista de tarefas propostas.
- Tratar falhas, limites e transcrições longas (dividir em blocos, se necessário).
- Opção para o professor **mascarar nomes de terceiros** antes do envio.

### 4.3 E-mail
- Serviço transacional para convites, recuperação de senha e lembretes.

## 5. Regras de negócio

- **Status automático (padrões, configuráveis por nível):** vira `atenção` após 14 dias sem reunião e `crítico` após 30 dias. O professor ajusta os limites por nível (TCC, mestrado, doutorado).
- **Agendamento:** antecedência mínima padrão de 24h; limite de 1 reunião agendada por semana por aluno (configurável); cancelamento pelo aluno até 12h antes.
- **Publicação:** resumo, notas compartilhadas e tarefas só aparecem ao aluno depois de publicados pelo professor.
- **Transcrição:** visível apenas ao professor. O aluno **nunca** vê o texto bruto.
- **Bem-estar:** dado visível somente ao professor; o aluno controla se participa.
- **Fuso horário:** `America/Recife` em todas as exibições e no Calendar.

## 6. Requisitos não funcionais

- **Privacidade e LGPD:** dados mínimos, isolamento por usuário, registro de aceite, exportação e exclusão sob solicitação, **log de auditoria** de acessos a transcrições e dados sensíveis.
- **Segurança:** senhas com hash forte, convites com token de uso único, proteção contra acesso indevido entre alunos (testes específicos), HTTPS, segredos em variáveis de ambiente.
- **Transcrições e dados enviados à IA:** avisar os alunos (texto de ciência); permitir mascaramento; não usar os dados para outros fins.
- **Responsivo:** uso confortável no celular, principalmente para o aluno agendar e o professor consultar o painel.
- **Idioma:** interface em português do Brasil.
- **Confiabilidade:** backup automático do banco; operações de agendamento idempotentes.
- **Desempenho:** painel com dezenas de alunos deve carregar em menos de 2 segundos.

## 7. Modelo de dados sugerido (entidades)

`usuario`, `aluno` (com `orientador_id`, nível, tema, datas, status manual, arquivado), `convite`, `aceite_ciencia`, `horario_livre`, `horario_fixo`, `reuniao` (data, pauta, status, `google_event_id`, falta), `checkin`, `transcricao`, `resumo` (rascunho/publicado, autor, versão), `tarefa`, `nota` (privada/compartilhada), `marco`, `entrega`, `versao_entrega`, `producao_academica`, `bem_estar`, `alerta`, `configuracao_alerta` (por nível), `log_auditoria`, `conexao_google` (tokens criptografados).

Regra geral: toda consulta de aluno filtra por `aluno_id` do usuário autenticado; toda consulta de professor filtra por `orientador_id`.

## 8. Telas principais

**Professor:** painel de alunos e fila "quem contatar hoje"; ficha do aluno (linha do tempo, tarefas, marcos, entregas, produção); tela da reunião (check-in, pendências, colar transcrição, gerar e editar resumo, aprovar tarefas, notas); gestão de horários; configurações (alertas, conexão Google, provedor de IA); convites; relatórios.

**Aluno:** início (próxima reunião, tarefas, prazos); agendar reunião; check-in; histórico de reuniões e resumos publicados; tarefas; cronograma; entregas e produção; bem-estar (opcional); aceite de ciência e privacidade.

## 9. Fora do escopo

- Gravar ou transcrever reuniões (feito no Meet, fora do sistema).
- Videoconferência própria.
- Integração com sistemas acadêmicos institucionais (SIGAA e semelhantes).
- Aplicativo nativo (basta web responsiva).

## 10. Sugestão de stack (ajustável pela IA construtora)

Aplicação web full stack com banco relacional (PostgreSQL), autenticação com convites, backend próprio para chamadas ao Google Calendar e à IA, fila ou job agendado para alertas e lembretes. Escolha tecnologias comuns e bem documentadas, e justifique brevemente a escolha.

## 11. Critérios de aceite (resumo por requisito-chave)

- Aluno A **nunca** consegue ler dados do aluno B (teste automatizado).
- Dois alunos tentando reservar o mesmo horário ao mesmo tempo: apenas um consegue.
- Reserva cria evento no Google Calendar do professor com convidado e link do Meet; cancelamento remove ou atualiza o evento.
- Transcrição colada gera rascunho de resumo em formato fixo; nada chega ao aluno antes da aprovação do professor.
- Painel mostra corretamente dias sem reunião e status sugerido conforme os limites configurados.
- Chaves de API não aparecem em nenhum código ou resposta enviada ao navegador.
- Aluno consegue exportar e pedir exclusão dos próprios dados.

## 12. Fases de entrega

**Fase 1 — Núcleo (MVP)**
Login com convite (RF01–RF04), cadastro e painel de alunos com status e dias sem reunião (RF05–RF09), agenda com Google Calendar e Meet (RF12–RF16), reunião com transcrição e resumo por IA com aprovação (RF21–RF24), notas privadas e compartilhadas (RF27).

**Fase 2 — Rotina de acompanhamento**
Lembretes e faltas (RF17–RF18), check-in e pendências (RF19–RF20), tarefas e extração automática (RF25–RF26), linha do tempo e busca (RF28–RF29), alertas, fila "quem contatar hoje" e cronograma (RF10, RF30–RF31), arquivamento (RF11).

**Fase 3 — Produção e gestão**
Entregas com versões e produção acadêmica (RF33–RF34), bem-estar (RF32), relatório em PDF (RF35), exportação e exclusão de dados (RF36), coorientador (RF37).

## 13. Decisões em aberto e padrões a adotar

| Decisão | Padrão adotado se não houver resposta |
|---|---|
| Forma de login | E-mail e senha, com convite. "Entrar com Google" como opção adicional. |
| Vários orientadores | Um professor agora; modelo de dados já preparado para vários. |
| Provedor de IA | Configurável; começar com um único e deixar o outro plugável. |
| Limites de alerta | 14 dias (atenção) e 30 dias (crítico), por nível. |
| Antecedência de agendamento | 24h mínimas; cancelamento até 12h antes. |
| Formato de arquivo de transcrição | .txt, .docx e .pdf. |

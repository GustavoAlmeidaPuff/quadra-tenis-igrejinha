# Quadra Livre — Sistema de Reserva de Quadra de Tênis

Aplicação web **mobile-first** para gestão comunitária de quadras de tênis. Desenvolvida do zero com Next.js 15, Firebase e TypeScript, cobre todo o ciclo de uso: autenticação, reservas com validação de conflito, perfis sociais, desafios entre jogadores e painel de administração por quadra.

---

## Funcionalidades

### Autenticação e onboarding
- Login via Google (Firebase Auth)
- Fluxo de onboarding para novos usuários preencherem nome e dados do perfil
- Redirecionamento automático baseado no estado de autenticação

### Dashboard pessoal
- Saudação personalizada com estatísticas em tempo real
- Exibição da próxima reserva agendada
- Sugestão inteligente de horário com base no histórico do usuário
- Cards com total de horas jogadas, número de reservas e sequência de semanas ativas
- Gráfico de barras de frequência por dia da semana
- Lista de parceiros mais frequentes com link para o perfil de cada um

### Agenda e reservas
- Visualização em timeline (linha do tempo por hora) dos 7 próximos dias
- Linha vermelha indicando o horário atual na agenda
- Indicador visual nos dias que já possuem reservas
- Modal de nova reserva com seletor de data, horário e participantes
- Duração fixa de 1h30 por reserva
- Seleção de quadra disponível para o usuário
- Edição de participantes de uma reserva existente
- Cancelamento de reserva pelo criador
- Validação de conflito de horário feita no servidor (Firebase Admin SDK), com verificação de:
  - Limite de 1 reserva por dia por usuário
  - Limite de 4 reservas por semana
  - Janela máxima de 7 dias à frente
- Envio de e-mail de confirmação de reserva via Brevo

### Perfis de usuário
- Página pública de perfil com foto, nome e estatísticas resumidas
- Sub-página de **estatísticas detalhadas**:
  - Total de horas jogadas
  - Frequência por dia da semana (gráfico de barras)
  - Horas jogadas por mês (gráfico de barras)
  - Horas jogadas por semana (gráfico de barras)
  - Ranking dos parceiros mais frequentes com foto e quantidade de jogos
- Sub-página de histórico de reservas por quadra

### Feed social
- Feed de posts da comunidade
- Curtidas em posts
- Comentários com suporte a menções (`@usuario`)
- Notificação ao ser mencionado em um comentário
- Notificação ao receber curtida em um post

### Desafios entre jogadores
- Enviar um desafio para outro jogador com mensagem e horário proposto
- Aceitar ou recusar desafios recebidos diretamente pela página de notificações
- Ao aceitar, uma reserva é criada automaticamente para os dois jogadores
- Cancelar desafio enviado antes de ser respondido
- Envio de e-mail de notificação de desafio via Brevo
- Fluxo de "aceitar e marcar horário" para desafios sem horário definido

### Notificações
- Central de notificações em tempo real (Firestore `onSnapshot`)
- Tipos: desafio recebido, desafio enviado, menção em post, curtida em post
- Marcação automática como lido ao abrir a página
- Exclusão individual de notificações (soft-delete com `hiddenByUserIds`, hard-delete quando ambos os lados ocultam)

### Gestão de quadras (multi-court)
- Suporte a múltiplas quadras com tab de seleção na agenda
- Conflitos de horário verificados separadamente por quadra
- Normalização de `courtId` para compatibilidade com registros antigos (`normalizeCourtId`)
- Ícone de engrenagem na aba da quadra para chefes gerenciarem diretamente da agenda

### Painel do chefe de quadra (`/quadra/[courtId]/gerenciar`)
- Acesso restrito a gerentes da quadra (verificado via `managerIds[]` no Firestore)
- Adicionar e remover outros gerentes da quadra
- Guard de layout impedindo acesso não autorizado

### Painel do desenvolvedor (`/admin`)
- Acesso restrito ao e-mail do desenvolvedor
- Criar quadras padrão no Firestore
- Visualizar e gerenciar todas as quadras e seus chefes
- Guard de layout impedindo acesso não autorizado

---

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Linguagem | TypeScript |
| Estilização | Tailwind CSS |
| Autenticação | Firebase Auth (Google) |
| Banco de dados | Firestore (Firebase) |
| Backend/API | Next.js Route Handlers + Firebase Admin SDK |
| Upload de imagens | Firebase Storage |
| E-mail transacional | Brevo (ex-Sendinblue) |
| Ícones | Lucide React |
| Drag and drop | dnd-kit |
| Datas | date-fns |

---

## Arquitetura

```
src/
├── app/
│   ├── (auth)/                    # Páginas sem layout autenticado
│   │   ├── login/
│   │   ├── onboarding/
│   │   └── selecionar-quadra/
│   ├── (app)/                     # App autenticado (com header e nav)
│   │   ├── home/                  # Dashboard
│   │   ├── reservar/              # Agenda e nova reserva
│   │   ├── social/                # Feed de posts
│   │   ├── notificacoes/          # Central de notificações
│   │   ├── perfil/
│   │   │   └── [userId]/
│   │   │       ├── page.tsx       # Perfil público
│   │   │       ├── estatisticas/  # Gráficos e métricas
│   │   │       ├── quadras/       # Histórico por quadra
│   │   │       └── nivel/         # Nível do jogador
│   │   ├── quadra/[courtId]/
│   │   │   └── gerenciar/         # Painel do chefe de quadra
│   │   ├── aulas/
│   │   ├── cafe/
│   │   └── parceiros/
│   ├── admin/                     # Painel do desenvolvedor
│   └── api/
│       ├── reservations/          # POST, DELETE, PATCH + check-slot
│       ├── notify-challenge/      # Envio de e-mail de desafio
│       └── upload-image/          # Upload para Firebase Storage
├── components/
│   ├── layout/                    # Header, BottomNav, CourtStatus, Avatar
│   └── reserva/                   # ModalNovaReserva, ReservationDetailModal
└── lib/
    ├── firebase/                  # Client SDK e Admin SDK
    ├── queries/                   # Funções de consulta (stats, etc.)
    ├── validators/                # Validação das regras de negócio
    ├── courts.ts                  # Constantes e DEVELOPER_EMAIL
    ├── permissions.ts             # Helpers isDeveloper, isCourtManager, canManageCourt
    ├── types.ts                   # Interfaces TypeScript
    └── utils.ts                   # Funções utilitárias
```

### Coleções no Firestore

| Coleção | Descrição |
|---|---|
| `users` | Dados de perfil dos usuários |
| `reservations` | Reservas (startAt, endAt, courtId, createdById) |
| `reservationParticipants` | Participantes de cada reserva |
| `courts` | Quadras com nome e lista de gerentes (`managerIds[]`) |
| `challenges` | Desafios entre jogadores |
| `posts` | Posts do feed social |
| `notifications` | Notificações de menção e curtida |

---

## Configuração local

### Pré-requisitos
- Node.js 18+
- Projeto no Firebase com Firestore, Auth (Google) e Storage habilitados
- Conta no Brevo (para e-mails)

### Instalação

```bash
git clone <url-do-repo>
cd reservar-tennis-igrejinha
npm install
```

### Variáveis de ambiente

Crie um arquivo `.env.local` na raiz:

```env
# Firebase (client)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin (para as API routes)
# Em desenvolvimento: caminho para o arquivo JSON da chave de serviço
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
# Em produção (Vercel): conteúdo do JSON em uma única linha
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Brevo (e-mails transacionais)
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
```

> A chave de serviço do Firebase Admin é gerada em: **Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada**

### Rodando em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`

---

## Deploy (Vercel)

1. Conecte o repositório à Vercel
2. Adicione todas as variáveis `NEXT_PUBLIC_*` nas configurações
3. Para o Firebase Admin em produção, adicione a variável `FIREBASE_SERVICE_ACCOUNT_KEY` com o conteúdo do JSON minificado em uma linha (não use `FIREBASE_SERVICE_ACCOUNT_PATH` na Vercel)
4. Adicione as variáveis do Brevo
5. Faça o deploy

---

## Regras de segurança (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
    match /reservations/{reservationId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.createdById;
    }
    match /reservationParticipants/{participantId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.authorId;
    }
    match /challenges/{challengeId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == resource.data.toUserId
                    || request.auth.uid == resource.data.fromUserId;
    }
  }
}
```

---

## Primeiro uso (desenvolvedor)

1. Faça login com o e-mail configurado como `DEVELOPER_EMAIL` em `src/lib/courts.ts`
2. Acesse `/admin`
3. Clique em **"Criar quadras padrão"** para criar as quadras no Firestore
4. Adicione chefes de quadra conforme necessário

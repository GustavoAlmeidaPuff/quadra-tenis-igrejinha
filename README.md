# Quadra de Tênis - Igrejinha

Webapp mobile-first para reserva comunitária da quadra de tênis em Igrejinha, RS.

## 🎾 Funcionalidades

- **Autenticação** via Google (Firebase Auth)
- **Status em tempo real** da quadra (livre/ocupada)
- **Reservas** com horários personalizados (duração fixa de 1h30)
- **Limitações**: 1 reserva/dia, 4 reservas/semana, janela de 7 dias
- **Dashboard** com métricas individuais (horas jogadas, streak, frequência)
- **Social**: feed de posts, desafios entre jogadores
- **Perfis** com estatísticas, parceiros frequentes e histórico

## 🚀 Stack Técnica

- **Next.js 15** (App Router) + React 19
- **TypeScript**
- **Tailwind CSS** para estilização
- **Firebase Auth** para autenticação
- **Firestore** para banco de dados
- **Lucide React** para ícones

## 📦 Instalação

```bash
# Clonar repositório
git clone [url-do-repo]

# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Criar arquivo .env.local com as credenciais do Firebase:
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Para a API de reservas funcionar (criar/cancelar reservas), é obrigatório
# configurar a chave de conta de serviço do Firebase Admin:
# 1. Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada
# 2. Salve o .json na raiz do projeto (ex.: serviceAccountKey.json) e adicione ao .env.local:
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json

# Rodar em desenvolvimento
npm run dev
```

Acesse http://localhost:3000

## 📱 Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/           # Telas de autenticação
│   │   ├── login/
│   │   └── onboarding/
│   ├── (app)/            # App logado (com layout)
│   │   ├── home/         # Dashboard
│   │   ├── reservar/     # Agenda e nova reserva
│   │   ├── social/       # Feed e posts
│   │   ├── perfil/       # Perfil do usuário
│   │   └── notificacoes/ # Desafios
│   └── api/
│       └── reservations/ # Validação e criação de reservas
├── components/
│   ├── layout/           # Header, BottomNav, Avatar, CourtStatus
│   └── reserva/          # ModalNovaReserva
└── lib/
    ├── firebase/         # Client e Admin SDK
    ├── validators/       # Validação de regras de negócio
    ├── types.ts          # Interfaces TypeScript
    └── utils.ts          # Funções auxiliares
```

## 🔐 Firestore Security Rules

Configure as Security Rules no Firebase Console:

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
      allow update: if request.auth.uid == resource.data.toUserId || request.auth.uid == resource.data.fromUserId;
    }
  }
}
```

## 🎨 Design

Interface mobile-first com cores:
- **Verde primário**: #10b981 (emerald-600)
- **Fundo**: #f9fafb (gray-50)
- **Cards**: branco com bordas sutis

Componentes arredondados (rounded-xl, rounded-2xl) e sombras suaves para visual moderno.

## 📝 Regras de Negócio

1. **Duração fixa**: 1h30 por reserva
2. **Horário livre**: início personalizável (ex: 19:15)
3. **Janela**: reservas nos próximos 7 dias
4. **Limites por usuário**:
   - 1 reserva por dia
   - 4 reservas por semana
5. **Conflito**: validado no servidor (Firebase Admin SDK)

## 🔧 Próximos Passos

- [ ] Integrar criação de reservas com a API (`/api/reservations`)
- [ ] Implementar busca real de participantes nas reservas
- [ ] Adicionar notificações push (FCM)
- [ ] Implementar compartilhamento de convites
- [ ] Adicionar imagens nos posts (Firebase Storage)
- [ ] PWA completo (service worker, offline)
- [ ] Testes automatizados

## 📄 Licença

Projeto comunitário para a quadra de Igrejinha, RS.

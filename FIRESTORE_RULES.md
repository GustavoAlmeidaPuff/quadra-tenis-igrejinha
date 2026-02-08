# Security Rules do Firestore

Cole estas regras no Firebase Console (Firestore Database > Rules):

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Usuários
    match /users/{userId} {
      // Qualquer pessoa autenticada pode ler perfis públicos
      allow read: if request.auth != null;
      // Apenas o próprio usuário pode criar/editar seu perfil
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false; // Não permitir deletar usuários
    }
    
    // Reservas
    match /reservations/{reservationId} {
      // Qualquer pessoa autenticada pode ler reservas
      allow read: if request.auth != null;
      // Apenas usuários autenticados podem criar reservas
      allow create: if request.auth != null;
      // Apenas o criador pode deletar sua reserva
      allow delete: if request.auth != null && 
                      request.auth.uid == resource.data.createdById;
      // Não permitir updates diretos (usar delete + create)
      allow update: if false;
    }
    
    // Participantes de reservas
    match /reservationParticipants/{participantId} {
      // Qualquer pessoa autenticada pode ler
      allow read: if request.auth != null;
      // Apenas usuários autenticados podem criar
      allow create: if request.auth != null;
      // Apenas criadores de reservas podem deletar participantes
      allow delete: if request.auth != null;
      allow update: if false;
    }
    
    // Posts
    match /posts/{postId} {
      // Qualquer pessoa autenticada pode ler
      allow read: if request.auth != null;
      // Apenas usuários autenticados podem criar
      allow create: if request.auth != null;
      // Autor pode editar/deletar; qualquer autenticado pode atualizar só likedBy (curtir) ou commentCount (comentário)
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.authorId
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likedBy'])
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['commentCount'])
      );
      // Apenas o autor pode deletar
      allow delete: if request.auth != null && request.auth.uid == resource.data.authorId;

      // Comentários do post (subcoleção)
      match /comments/{commentId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
        allow update, delete: if request.auth != null && request.auth.uid == resource.data.authorId;
      }
    }
    
    // Desafios
    match /challenges/{challengeId} {
      // Apenas usuários autenticados podem ler desafios onde são envolvidos
      allow read: if request.auth != null;
      // Apenas usuários autenticados podem criar
      allow create: if request.auth != null;
      // Apenas destinatário ou remetente podem atualizar (aceitar/recusar)
      allow update: if request.auth != null && 
                      (request.auth.uid == resource.data.toUserId || 
                       request.auth.uid == resource.data.fromUserId);
      allow delete: if request.auth != null && 
                      request.auth.uid == resource.data.fromUserId;
    }
  }
}
```

**Como aplicar:**
1. Acesse: https://console.firebase.google.com/
2. Selecione seu projeto: **quadra-livre-igrejinha**
3. Vá em **Firestore Database** → **Rules**
4. **Substitua todo o conteúdo** do editor pelas regras do bloco acima (incluindo a parte de **Posts** com a subcoleção **comments** e a permissão de **commentCount**).
5. Clique em **Publicar**.

**Se aparecer "Missing or insufficient permissions" ao curtir ou comentar:**  
As regras no Console estão desatualizadas. É obrigatório que o bloco **Posts** tenha:
- `allow update` com `hasOnly(['likedBy'])` e `hasOnly(['commentCount'])`;
- o bloco aninhado **match /comments/{commentId}** com `allow read, create` para usuário autenticado.

Copie as regras completas deste arquivo e publique de novo no Firebase Console.

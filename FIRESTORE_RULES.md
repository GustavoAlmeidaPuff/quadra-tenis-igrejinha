# Firestore security rules

Paste these rules in the Firebase Console (Firestore Database → Rules):

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users
    match /users/{userId} {
      // Any authenticated user can read public profiles
      allow read: if request.auth != null;
      // Only the signed-in user can create/update their profile
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false; // Do not allow deleting users from the client
    }
    
    // Reservations
    match /reservations/{reservationId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && 
                      request.auth.uid == resource.data.createdById;
      // No direct updates (use delete + create)
      allow update: if false;
    }
    
    // Reservation participants
    match /reservationParticipants/{participantId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth != null;
      allow update: if false;
    }
    
    // Posts
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      // Author can edit/delete; any authenticated user can update only likedBy (like) or commentCount (comment)
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.authorId
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likedBy'])
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['commentCount'])
      );
      allow delete: if request.auth != null && request.auth.uid == resource.data.authorId;

      match /comments/{commentId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null;
        allow update, delete: if request.auth != null && request.auth.uid == resource.data.authorId;
      }
    }
    
    // Notifications (e.g. mention in post/comment, like)
    match /notifications/{notificationId} {
      allow read, delete: if request.auth != null && request.auth.uid == resource.data.toUserId;
      allow create: if request.auth != null;
      allow update: if request.auth != null && request.auth.uid == resource.data.toUserId
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
    }

    // Challenges
    match /challenges/{challengeId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
                      (request.auth.uid == resource.data.toUserId || 
                       request.auth.uid == resource.data.fromUserId);
      allow delete: if request.auth != null && 
                      request.auth.uid == resource.data.fromUserId;
    }

    // Courts
    match /courts/{courtId} {
      allow read: if request.auth != null;
      allow update: if request.auth != null
        && request.auth.uid in resource.data.managerIds;
      allow create, delete: if false;
    }

    // Landing waitlist (app store launch)
    match /waitlist/{docId} {
      allow read, update, delete: if false;
      allow create: if
        request.resource.data.keys().hasOnly(['kind','contact','store','createdAt','userAgent','source'])
        && request.resource.data.kind in ['whatsapp','email']
        && request.resource.data.contact is string
        && request.resource.data.contact.size() >= 5
        && request.resource.data.contact.size() <= 120;
    }
  }
}
```

**How to apply:**
1. Open https://console.firebase.google.com/
2. Select your project: **quadra-livre-igrejinha**
3. Go to **Firestore Database** → **Rules**
4. Replace the editor contents with the rules above (including **Posts** with nested **comments** and **commentCount** update rules).
5. Click **Publish**.

**Indexes for notifications:**  
- List notifications: query with `toUserId`, `type`, and `orderBy('createdAt', 'desc')` — use the Console link if Firestore asks for a composite index.
- Badge and mark read: query with `toUserId` and `read == false`. If Firestore requests a composite index, create it with collection `notifications`, fields `toUserId` (Ascending) and `read` (Ascending), collection scope.

**If you see “Missing or insufficient permissions” when liking or commenting:**  
The rules in the Console are outdated. The **Posts** block must include:
- `allow update` with `hasOnly(['likedBy'])` and `hasOnly(['commentCount'])`;
- nested **match /comments/{commentId}** with `allow read, create` for authenticated users.

Copy the full rules from this file and publish again in the Firebase Console.

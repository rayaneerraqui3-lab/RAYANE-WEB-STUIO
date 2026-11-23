# Security Specification — Rayane Web Studio

## 1. Data Invariants
1. A user's private PII (`email`) lives exclusively at `/users/{userId}/private/info` and can only be read/written by `userId == request.auth.uid` with `email_verified == true`.
2. Public profiles at `/users/{userId}/public/profile` never store emails or private identifiers and can only be written by the matching authenticated user.
3. A `DirectMessage` in `/conversations/{conversationId}/messages/{messageId}` cannot exist unless the sender is a verified member in `/conversations/{conversationId}/members/{request.auth.uid}` (Master Gate) and `senderId == request.auth.uid`.
4. All IDs match `^[a-zA-Z0-9_-]+$` and `<= 128` chars.
5. `createdAt` and `updatedAt` timestamps strictly equal `request.time`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated read/write**: `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified email write**: `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
3. **PII cross-user read**: User B attempts `get(/users/userA/private/info)` -> `PERMISSION_DENIED`.
4. **Shadow field on profile**: `{ uid, displayName, updatedAt, isAdmin: true }` -> `PERMISSION_DENIED`.
5. **UID spoofing on profile**: User B writes `/users/userA/public/profile` -> `PERMISSION_DENIED`.
6. **ID poisoning**: Document ID with 200+ characters or `../` -> `PERMISSION_DENIED`.
7. **Sender spoofing in message**: User A sends message with `senderId: "userB"` -> `PERMISSION_DENIED`.
8. **Non-member message read/write**: User C attempts read/write in User A <-> User B conversation -> `PERMISSION_DENIED`.
9. **Client-forged timestamp**: `createdAt: "2020-01-01T00:00:00Z"` instead of server `request.time` -> `PERMISSION_DENIED`.
10. **Oversized message payload**: `text` > 2000 chars -> `PERMISSION_DENIED`.
11. **Immutable ownerId mutation on update**: Attempting to change `ownerId` or `createdAt` on conversation update -> `PERMISSION_DENIED`.
12. **Blanket list query scrape**: Listing `/conversations` without filtering by `request.auth.uid in resource.data.participantIds` -> `PERMISSION_DENIED`.

# Content Units

A `ContentUnit` is a polymorphic entity:
```ts
type ContentUnit = 
  | { kind: 'person'; profile: Profile; ... }
  | { kind: 'category'; id: string; title: string; ... }
```
The `kind` acts as a discriminator. The server provides unified metric structures (like `overlap: 85%`) rather than ad-hoc fields, so the frontend UI can render badges generically.

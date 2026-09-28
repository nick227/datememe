# Frontend Architecture Overview

The `apps/mobile` package is cleanly partitioned into features and shared generic logic to maintain scalability.

## Core Boundaries
- **Features (`src/features/*`)**: Domain-specific logic, screen orchestrations, and API interactions. If code deals with "matches" or "categories", it belongs here.
- **Shared UI (`src/ui/*`)**: Purely presentational components, design system elements, and the agnostic Content System (`ui/content`). It should not import API hooks or know about business rules.
- **Navigation (`src/navigation/*`)**: Route definitions and Stack configs. Navigation is decoupled from screens; screens don't define their own tabs.

## Server-Driven Paradigm
The frontend avoids hardcoding how specific lists of people or categories should look. Instead, the server sends `FeedModule` instructions containing `ContentUnit`s and `suggestedStructure`s. The frontend's responsibility is executing this grammar flawlessly.

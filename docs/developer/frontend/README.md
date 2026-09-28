# Datememe Frontend Developer Documentation

Welcome to the `apps/mobile` codebase. This directory contains detailed guides on the architecture, content systems, features, and debugging workflows of the frontend application.

The frontend is a React Native + React Native Web application. It acts primarily as a presentation and interaction layer—relying on a **Server-Driven Content Philosophy** where the API prescribes layouts and capabilities rather than just sending raw data.

## Getting Started
If you are new here, start with:
1. **[Architecture Overview](architecture/overview.md)**
2. **[Content System Overview](content-system/overview.md)**
3. **[Adding Features](development/adding-features.md)**

## Documentation Structure
- **`architecture/`**: High-level boundaries, data flows, and state management.
- **`content-system/`**: The most critical UI architectural piece: how feed modules and structural UI decouple domain logic from rendering.
- **`features/`**: Detailed documentation on the core application domains (discovery, lists, admin, etc.).
- **`ui/`**: Design system tokens, layouts, and reusable generic UI cards.
- **`deep-dives/`**: Intimate line-by-line analyses of the most complex files (e.g., `DiscoverFeedScreen`, `FeedModuleRenderer`).
- **`development/`**: Playbooks on extending the app, testing, and debugging.
- **`reference/`**: Inventories, dependency maps, sharp edges, and "change this here" cheat sheets.

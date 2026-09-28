# Change This Here (Cheat Sheet)

Where to go when you need to change a specific behavior:

- **I need to change how people grids are styled:** Edit `ui/content/Grid.tsx` or `ui/content/PersonUnitCard.tsx`.
- **I need to add a new taxonomy category type:** Edit the SDK types, then add handling in `ContentUnitCard.tsx` if it requires a unique card design.
- **I need to change bottom tab icons:** Edit `navigation/AppTabs.tsx`.
- **I need to add a new screen in Discovery:** Define it in `navigation/types.ts` under `DiscoveryStackParamList`, then add the `<Stack.Screen>` to `navigation/DiscoveryStack.tsx`.
- **I need to handle a new server feed structure (e.g. Carousel):** Edit `ui/content/FeedModuleRenderer.tsx` and build the `Carousel.tsx` primitive.

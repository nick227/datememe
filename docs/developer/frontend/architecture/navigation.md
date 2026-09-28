# Navigation Model

We use `@react-navigation/native`.

## Stack Topology
- **RootNavigator**: Switches between `AuthStack` and `MainStack` based on `useCurrentUser()`.
- **MainStack**: Renders the `GlobalHeader` and the bottom `AppTabs`.
- **Nested Stacks**: Each tab represents a domain (`DiscoveryStack`, `MessagesStack`). 

## Deep Linking & Cross-Feature Navigation
Navigating across tabs requires careful `getParent()` calls to prevent pushing the wrong stack:
```tsx
(navigation.getParent()?.navigate as any)('Lists', {
  screen: 'ListBuilder',
  params: { categorySlug: unit.id },
})
```

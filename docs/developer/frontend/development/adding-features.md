# Adding a New Feature

When creating a new domain feature (e.g., "groups"):
1. Create `src/features/groups/screens/` and `src/features/groups/components/`.
2. Define navigation routes in `src/navigation/types.ts` under a new `GroupsStackParamList`.
3. Create `src/navigation/GroupsStack.tsx`.
4. Expose it in `AppTabs.tsx`.

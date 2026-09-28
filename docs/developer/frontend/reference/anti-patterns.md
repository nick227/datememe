# Anti-Patterns

- **DO NOT** use raw `<Text>` components. Always use `<Typography>`.
- **DO NOT** use raw hex colors in styling. Always use `colors.surface`, `colors.primary`, etc. from `src/theme/`.
- **DO NOT** map over `ContentUnit` directly inside a screen. Use `FeedModuleRenderer`.
- **DO NOT** use `Alert.alert` on the web without a polyfill. Prefer `ActionSheet` or inline error states.

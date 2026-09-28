# Responsive Web vs Native Architecture

Datememe targets both iOS/Android and Web using `react-native-web`.

## The `flex` vs `minHeight` problem
On mobile, `flex: 1` ensures a `ScrollView` takes available screen space. On the web, we often want the page content to grow beyond the viewport and let the native browser scrollbar take over.
- Use `Platform.OS === 'web' ? { minHeight: '100vh' } : { flex: 1 }` for root containers.

## Constraints
- Use `CANVAS_WIDTH` for centering web content on wide screens so the app doesn't stretch infinitely.
- Use `useResponsive` hooks when conditional layout is absolutely necessary (though CSS breakpoints / RN flexbox usually suffice).

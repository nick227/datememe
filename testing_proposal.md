# POC MVP Testing Proposal

## Current State Review
After reviewing the codebase (specifically `apps/mobile`), the current test coverage is essentially **0%** for product features. The only test currently present is `config.test.ts`, which appears to validate configuration rather than application logic or user interfaces. 

There are no testing frameworks installed for React Native components (such as Jest or React Native Testing Library) and no End-to-End (E2E) testing tools (like Detox or Maestro) configured. 

For a POC (Proof of Concept) MVP, we do not need 100% coverage, but we *do* need confidence that the most critical paths of the application function correctly.

---

## Proposed Testing Strategy for MVP

We propose a pragmatic testing approach focusing on **high-value, low-effort** tests. We will use two layers of testing:
1. **Integration/Component Tests:** To verify forms, business logic, and UI states.
2. **End-to-End (E2E) Tests:** To verify the app builds, opens, and the main user journey works on a real device/simulator.

### 1. Component & Integration Testing (Must Haves)
**Tools:** `jest`, `@testing-library/react-native`

We should write tests for the most critical user flows, mocking out network requests and heavy dependencies. 

**Priority Test Cases:**
* **Authentication Flow:**
  * **LoginScreen:** Renders correctly, displays validation errors for empty/invalid inputs, and successfully calls the login API/mutation on valid submit.
  * **RegisterScreen:** Renders correctly, handles password mismatch or weak password errors, and successfully submits the registration payload.
* **Core Navigation & State:**
  * Ensure a user is correctly redirected to the main app layout upon successful authentication.
  * Ensure logging out clears the state and redirects to the Auth stack.

*Why these?* If users cannot log in or register, the app is unusable. Testing these forms catches regressions early.

### 2. E2E Testing (Must Haves)
**Tool:** `Maestro` (Highly recommended for React Native MVPs due to ease of setup compared to Detox) or `Detox`.

E2E tests will run the compiled app and interact with it like a real user. For the MVP, we only need a "Happy Path" E2E suite to guarantee basic functionality.

**Priority Test Cases:**
* **The "Golden Path":**
  1. App launches successfully.
  2. User taps "Register" and creates an account (or logs in with a test account).
  3. User is navigated to the Home screen.
  4. User can interact with the primary feature (e.g., viewing a profile or list).

*Why this?* This single E2E flow verifies the entire stack (Mobile UI -> Navigation -> API -> Database) is functioning together correctly.

---

## Action Plan to Implement

1. **Setup Component Testing:**
   * Install dependencies: `pnpm add -D jest jest-expo @testing-library/react-native @testing-library/jest-native`
   * Add `jest.config.js` and setup scripts.
   * Write tests for `LoginScreen.tsx` and `RegisterScreen.tsx`.

2. **Setup E2E Testing:**
   * Install Maestro locally or configure it for CI.
   * Write a basic `.yaml` flow for the Maestro Golden Path test.
   * Add a script in `package.json` to run the E2E flow locally.

3. **CI/CD Integration (Optional for now, but recommended):**
   * Add a GitHub Action (or similar) to run the `jest` tests on every Pull Request.

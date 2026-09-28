# Capabilities

Instead of checking `if (user.isAdmin && !user.isBanned)` on the frontend, the backend returns capabilities inside context or models.
- If an entity cannot be messaged, the backend omits the message capability. The frontend simply hides the button.

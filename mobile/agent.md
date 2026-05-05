# Agent Rules for Mobile Development

## 🚨 STRICT BACKEND POLICY
1. **NO BACKEND MODIFICATIONS**: You are STRICTLY PROHIBITED from modifying, writing, or deleting any files inside the `apps/backend` directory.
2. **READ-ONLY ACCESS**: You are allowed to read (view) backend files to understand the API contracts, DTOs, and service flows, but you MUST NOT execute any commands or scripts that alter backend code.
3. **FRONTEND ONLY**: All code modifications, bug fixes, and feature implementations MUST be contained within the `apps/mobile` directory (or other designated frontend locations).

## 📌 Rationale
The backend is managed separately and has its own strict review process. Modifying backend code during a frontend task can break domain boundaries, state consistency, and database schemas. Always assume the backend API contract is fixed unless the user explicitly tells you otherwise in a completely different context. 

## 🛡️ Actionable Directives
- When the user asks for a feature that requires an API, check the `handoff/eng-review` or `apps/backend` folders to *read* the DTOs and endpoints. 
- Implement the API calls or mock data strictly inside `apps/mobile/src/...` or `apps/mobile/app/...`.
- If the backend is missing a required field or endpoint, you must ask the user for permission or instruct them on what needs to be changed, rather than modifying the backend yourself.

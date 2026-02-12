# Directive: Project Initialization

## Goal
Scaffold the "YouTube Quizzer" project structure, separating the Backend API and the Chrome Extension Frontend.

## Inputs
- `product_spec.md`: Contains the technical architecture details.

## Instructions
1.  **Directory Structure**:
    - Create `backend/` for the Node.js API.
    - Create `extension/` for the Chrome Extension.

2.  **Backend Initialization (`backend/`)**:
    - Initialize a Node.js project (`npm init -y`).
    - Install core dependencies: `fastify`, `typescript`, `@types/node`, `zod`, `dotenv`.
    - Install dev dependencies: `ts-node`, `nodemon`.
    - Create `tsconfig.json` for TypeScript configuration.
    - Create a basic `src/server.ts` entry point.

3.  **Frontend Initialization (`extension/`)**:
    - Create `manifest.json` (Manifest V3).
        - Permissions: `activeTab`, `scripting`, `storage`, `alarms`, `notifications`.
        - Host permissions: `*://*.youtube.com/*`.
    - Create basic directory structure: `src/`, `assets/`, `popup/`.
    - Create a placeholder content script (`content.js`) and background script (`background.js`).

## Outputs
- A working project skeleton in `backend/` and `extension/`.

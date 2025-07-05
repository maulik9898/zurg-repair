# Coding Guidelines

## 1. Introduction

This document provides coding guidelines for the `zurg-repair` project. The goal is to ensure the codebase is clean, maintainable, consistent, and easy to understand for both human and AI developers. Adhering to these standards is mandatory.

## 2. Core Principles

-   **Simplicity (KISS - Keep It Simple, Stupid):** Write code that is as simple as possible. Avoid unnecessary complexity. Prefer clear, straightforward logic over clever, obscure solutions.
-   **Don't Repeat Yourself (DRY):** Avoid duplicating code. Encapsulate and reuse logic in functions or classes.
-   **Clarity over Brevity:** Write code that is easy to read and understand, even if it is slightly more verbose. Use descriptive names for variables, functions, and classes.

## 3. File and Folder Structure

A logical and predictable folder structure is essential. All application source code must reside in the `src` directory.

```
/src
|-- /lib
|   |-- parser.ts         # Core HTML parsing logic
|   |-- zurg.ts           # Functions for interacting with the Zurg web UI
|   |-- logger.ts         # Logging utility
|-- /types
|   |-- torrent.ts        # TypeScript type definitions (e.g., Torrent, File)
|-- index.ts              # Main application entry point
```

-   **`lib`**: Contains the core business logic of the application, broken into modules by concern.
-   **`types`**: Contains all TypeScript type definitions and interfaces.
-   **`index.ts`**: The main entry point that orchestrates the application flow.

## 4. TypeScript Best Practices

-   **Strongly Typed:** Leverage TypeScript's type system. Avoid using `any` whenever possible.
-   **Interfaces and Types:** Define clear `interface` or `type` definitions for all data structures. For this project, we will have types like `Torrent`, `TorrentFile`, etc., in `/src/types/`.
-   **Readonly:** Use `readonly` for properties that should not be modified after initialization.

## 5. Modularity and Composability

-   **Single Responsibility Principle (SRP):** Every function, class, or module should have one, and only one, reason to change.
-   **Small Functions:** Keep functions small and focused on a single task. A good function fits on one screen and is easy to test.
-   **Pure Functions:** Prefer pure functions (functions that have no side effects and return the same output for the same input) where possible, as they are easier to reason about and test.
-   **Composition over Inheritance:** Favor composing behavior with smaller functions over creating complex class hierarchies.

## 6. Error Handling

A robust error handling strategy is critical for a reliable CLI tool.

-   **Always Handle Errors:** Never ignore a potential error. Asynchronous operations must always have a `.catch()` block or be wrapped in a `try...catch` block.
-   **Custom Error Types:** For predictable application-specific errors (e.g., "Zurg instance not reachable", "Failed to parse HTML"), create custom error classes that extend the base `Error` class. This allows for more specific error handling.
-   **Graceful Failure:** The application should handle errors gracefully. Log the error with a clear message and exit with a non-zero status code. It should not crash with an unhandled exception.
-   **Error Propagation:** Functions that can fail should either handle the error internally or throw it to be handled by the caller. Do not swallow errors.

## 7. Logging

Clear and structured logging is the primary user interface for a CLI tool. We use `pino` for logging, with `pino-pretty` for development-friendly output.

-   **Use the Central Logger:** All logging must go through the centralized `pino` logger instance defined in `src/lib/logger.ts`. Do not use `console.log`.
-   **Log Levels:** Use the standard `pino` log levels:
    -   `info`: For general status updates and progress (e.g., "Fetching torrents...", "Found 5 broken torrents.").
    -   `warn`: For non-critical issues that the application can recover from (e.g., "Could not find a repair button, skipping.").
    -   `error`: For critical errors that prevent a task from completing (e.g., "Failed to connect to Zurg.", "Failed to parse HTML.").
    -   `debug`: For verbose information useful for debugging.
-   **Structured Logging:** Log objects with additional data when it provides context. For example: `logger.info({ torrentName: '...' }, 'Repairing torrent');`
-   **Human-Readable Output:** In development, `pino-pretty` will format logs for readability. In production, logs will be JSON for easier parsing by log management systems.

## 8. Configuration

-   **Environment Variables:** All configuration variables (e.g., URLs, API keys) must be stored in a `.env` file.
-   **Validation:** Environment variables must be validated at application startup using `zod`. A schema should be defined in `src/lib/config.ts` which parses `process.env` and exports a type-safe config object. The application should exit immediately if validation fails.
-   **Example File:** A `.env.example` file must be maintained in the root of the project to show what variables are required.
-   **No Hardcoded Secrets:** Never hardcode sensitive information or configuration directly in the code.

## 9. AI-Specific Instructions

As an AI agent, you must strictly adhere to the following:

-   **Follow All Guidelines:** The rules in this document are your primary instructions for writing and modifying code.
-   **Analyze Before Coding:** Before writing any code, read the surrounding files and understand the existing patterns, conventions, and the overall architecture.
-   **No Assumptions:** Do not assume a library is available or a file exists. Verify its existence and usage first.
-   **Incremental Changes:** Make small, incremental, and verifiable changes.

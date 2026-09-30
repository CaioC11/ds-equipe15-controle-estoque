// Torna os matchers do @testing-library/jest-dom (toBeInTheDocument, etc.)
// visíveis para o TypeScript nos testes. Em runtime, são registrados por
// vitest.setup.ts; aqui apenas trazemos a augmentação de tipos.
import "@testing-library/jest-dom/vitest";

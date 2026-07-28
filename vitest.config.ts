import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "src/generated/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // O foco da cobertura é a lógica de negócio, não a UI gerada pelo shadcn.
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: ["src/lib/prisma.ts", "src/generated/**"],
    },
  },
  esbuild: {
    jsx: "automatic",
  },
})

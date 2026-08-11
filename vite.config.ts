import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localApiPlugin } from "./dev/localApiPlugin";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");

  return {
    plugins: [
      react(),
      localApiPlugin({
        environment: {
          OPENAI_API_KEY: environment.OPENAI_API_KEY,
          OPENAI_MODEL: environment.OPENAI_MODEL,
        },
      }),
    ],
  };
});

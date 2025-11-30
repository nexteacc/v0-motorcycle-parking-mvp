import { z } from "zod"
import { envClient } from "@/lib/env-client"

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
})

const serverEnvValues = serverEnvSchema.parse({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
})

export const envServer = {
  ...envClient,
  ...serverEnvValues,
}

type EnvServer = typeof envServer
export type { EnvServer }

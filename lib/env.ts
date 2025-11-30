import { z } from 'zod'

/**
 * 环境变量验证 Schema
 * 使用 zod 进行类型安全的环境变量验证
 */
const envSchema = z.object({
  // Supabase 配置（公共变量）
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL format"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase anon key is required"),
  
  // OpenAI 配置（服务器端变量）
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
})

/**
 * 验证并导出环境变量
 * 如果环境变量缺失或格式错误，会在启动时抛出错误
 */
function getEnv() {
  try {
    return envSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n')
      throw new Error(
        `❌ Environment variable validation failed:\n${missingVars}\n\n` +
        `Please check your .env file and ensure all required variables are set.\n` +
        `See .env.example for reference.`
      )
    }
    throw error
  }
}

export const env = getEnv()

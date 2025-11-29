import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    plate_number: {
      type: ["string", "null"],
      description: "识别到的车牌号，使用大写字母与数字",
    },
    confidence: {
      type: ["number", "null"],
      description: "0-1 之间的置信度",
    },
    color: {
      type: ["string", "null"],
      description: "车辆颜色，暂未启用，可返回 null",
    },
  },
  required: ["plate_number", "confidence", "color"],
  additionalProperties: false,
} as const

const PROMPT = `你是一名停车场入场登记助手。请从给定的车辆照片中识别车牌号，并按照下列要求输出：
- 如果可以确定车牌号，请返回全大写、无空格的车牌号，例如 "沪A12345"。
- 如果无法确定车牌号，请返回 null。
- confidence 字段需要在 0 到 1 之间，表示对车牌识别的置信度；无法识别时返回 0。
- color 字段目前保留，统一返回 null。
仅输出 JSON。`

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OCR API: Missing OPENAI_API_KEY environment variable")
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "服务器配置错误：缺少 OpenAI API 密钥" 
        }, 
        { status: 500 }
      )
    }

    let requestBody
    try {
      requestBody = await request.json()
    } catch (parseError) {
      console.error("OCR API: Failed to parse request body:", parseError)
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "请求格式错误：无法解析请求数据" 
        }, 
        { status: 400 }
      )
    }

    const { image } = requestBody

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "图片数据缺失，请重新上传图片" 
        }, 
        { status: 400 }
      )
    }

    // 验证 base64 图片数据
    // 确保图片数据是 data URL 格式（data:image/jpeg;base64,...）
    let imageDataUrl = image
    if (!image.startsWith("data:")) {
      // 如果不是 data URL 格式，添加前缀
      imageDataUrl = `data:image/jpeg;base64,${image}`
    }
    
    const base64 = imageDataUrl.includes(",") ? imageDataUrl.split(",")[1] : imageDataUrl
    if (!base64 || base64.length < 100) {
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "图片数据无效，请重新上传" 
        }, 
        { status: 400 }
      )
    }

    // 调用 OpenAI API
    // 根据官方文档，base64 图片应使用 image_url 字段，格式为 data URL
    let response
    try {
      response = await openai.responses.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        max_output_tokens: 300,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { 
                type: "input_image", 
                image_url: imageDataUrl, // 使用 image_url 而不是 image_base64
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "plate_detection",
            schema: RESPONSE_SCHEMA,
          },
        },
      })
    } catch (apiError: any) {
      console.error("OCR API: OpenAI API call failed:", {
        error: apiError,
        message: apiError?.message,
        status: apiError?.status,
        code: apiError?.code,
      })
      
      // 提供更具体的错误信息
      let errorMessage = "AI 识别服务暂时不可用，请稍后重试"
      if (apiError?.status === 401) {
        errorMessage = "API 密钥无效，请联系管理员"
      } else if (apiError?.status === 429) {
        errorMessage = "请求过于频繁，请稍后再试"
      } else if (apiError?.status === 500 || apiError?.status === 503) {
        errorMessage = "AI 服务暂时不可用，请稍后重试"
      } else if (apiError?.message) {
        errorMessage = `识别失败：${apiError.message}`
      }
      
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: errorMessage 
        }, 
        { status: 500 }
      )
    }

    // 解析响应
    // 根据官方 API 响应格式：output[0] 是 message 类型，content[0] 是 output_text 类型
    const outputMessage = response.output?.[0]
    if (!outputMessage || outputMessage.type !== "message") {
      console.error("OCR API: Invalid response format - no message output:", response)
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "未获取到识别结果，请重新尝试" 
        },
        { status: 200 }
      )
    }

    const textContent = outputMessage.content?.find((item: any) => item.type === "output_text")
    const rawText = textContent?.text

    if (!rawText) {
      console.error("OCR API: No text in response:", response)
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "未获取到识别结果，请重新尝试" 
        },
        { status: 200 } // 返回 200 但包含错误信息，让客户端可以处理
      )
    }

    let parsed
    try {
      parsed = JSON.parse(rawText)
    } catch (parseError) {
      console.error("OCR API: Failed to parse JSON response:", rawText, parseError)
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "识别结果格式错误，请重新尝试" 
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      plateNumber: typeof parsed.plate_number === "string" ? parsed.plate_number.toUpperCase() : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      color: parsed.color ?? null,
    })
  } catch (error: any) {
    console.error("OCR API: Unexpected error:", {
      error,
      message: error?.message,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        plateNumber: null, 
        confidence: null, 
        color: null, 
        error: error?.message || "服务器内部错误，请稍后重试" 
      }, 
      { status: 500 }
    )
  }
}

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
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const { image } = await request.json()

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "图片数据缺失" }, { status: 400 })
    }

    const base64 = image.includes(",") ? image.split(",")[1] : image

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      max_output_tokens: 300,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: PROMPT },
            { type: "input_image", image_base64: base64 },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "plate_detection",
          schema: RESPONSE_SCHEMA,
        },
      },
    })

    const jsonPayload = response.output?.[0]?.content?.[0]
    const rawText = jsonPayload?.type === "output_text" ? jsonPayload.text : undefined

    if (!rawText) {
      return NextResponse.json({ plateNumber: null, confidence: null, color: null, error: "未获取到识别结果" })
    }

    const parsed = JSON.parse(rawText)

    return NextResponse.json({
      plateNumber: typeof parsed.plate_number === "string" ? parsed.plate_number.toUpperCase() : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      color: parsed.color ?? null,
    })
  } catch (error) {
    console.error("OCR error:", error)
    return NextResponse.json({ plateNumber: null, confidence: null, color: null, error: "OCR processing failed" }, { status: 500 })
  }
}

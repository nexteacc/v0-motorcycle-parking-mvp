import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { envServer } from "@/lib/env-server"
import { OcrImageRequestSchema } from "@/lib/validations"

const openai = new OpenAI({
  apiKey: envServer.OPENAI_API_KEY,
})

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    plate_number: {
      type: ["string", "null"],
      description: "Recognized license plate number",
    },
    confidence: {
      type: ["number", "null"],
      description: "Confidence 0-1",
    },
    color: {
      type: ["string", "null"],
      description: "Vehicle color",
    },
  },
  required: ["plate_number", "confidence", "color"],
  additionalProperties: false,
} as const

const PROMPT = `Identify the license plate number from the vehicle photo. If recognizable, return the complete license plate number (maintain original format); if not recognizable, return null. confidence represents confidence (0-1), 0 if not recognizable. color returns null. Output JSON only.`

export async function POST(request: NextRequest) {
  try {
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
          error: "Request format error: Unable to parse request data" 
        }, 
        { status: 400 }
      )
    }

    const parsedPayload = OcrImageRequestSchema.safeParse(requestBody)
    if (!parsedPayload.success) {
      const message = parsedPayload.error.issues[0]?.message ?? "Invalid image data, please upload again"
      console.error("OCR API: Invalid request payload:", parsedPayload.error.flatten())
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: message
        }, 
        { status: 400 }
      )
    }

    const { image } = parsedPayload.data

    let imageDataUrl = image
    if (!image.startsWith("data:")) {
      imageDataUrl = `data:image/jpeg;base64,${image}`
    }

    let response
    try {
      response = await openai.responses.create({
        model: envServer.OPENAI_MODEL,
        max_output_tokens: 300,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { 
                type: "input_image", 
                image_url: imageDataUrl,
                detail: "auto",
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
    } catch (apiError: unknown) {
      // Type guard for error with status property
      const isErrorWithStatus = (err: unknown): err is { status?: number; message?: string; code?: string } => {
        return typeof err === 'object' && err !== null
      }
      
      const errorDetails = isErrorWithStatus(apiError) ? apiError : {}
      
      console.error("OCR API: OpenAI API call failed:", {
        error: apiError,
        message: errorDetails.message,
        status: errorDetails.status,
        code: errorDetails.code,
      })
      
      let errorMessage = "AI recognition service temporarily unavailable, please try again later"
      if (errorDetails.status === 401) {
        errorMessage = "Invalid API key, please contact administrator"
      } else if (errorDetails.status === 429) {
        errorMessage = "Too many requests, please try again later"
      } else if (errorDetails.status === 500 || errorDetails.status === 503) {
        errorMessage = "AI service temporarily unavailable, please try again later"
      } else if (errorDetails.message) {
        errorMessage = `Recognition failed: ${errorDetails.message}`
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

    const outputMessage = response.output?.[0]
    if (!outputMessage || outputMessage.type !== "message") {
      console.error("OCR API: Invalid response format - no message output:", response)
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "No recognition result obtained, please try again" 
        },
        { status: 200 }
      )
    }

    const textContent = outputMessage.content?.find((item: { type?: string }) => item.type === "output_text")
    const rawText = textContent && "text" in textContent ? textContent.text : undefined

    if (!rawText) {
      console.error("OCR API: No text in response:", response)
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "No recognition result obtained, please try again" 
        },
        { status: 200 }
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
          error: "Recognition result format error, please try again" 
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      plateNumber: typeof parsed.plate_number === "string" ? parsed.plate_number : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      color: parsed.color ?? null,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error, please try again later"
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error("OCR API: Unexpected error:", {
      error,
      message: errorMessage,
      stack: errorStack,
    })
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
}

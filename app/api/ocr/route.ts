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
    if (!process.env.OPENAI_API_KEY) {
      console.error("OCR API: Missing OPENAI_API_KEY environment variable")
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "Server configuration error: Missing OpenAI API key" 
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
          error: "Request format error: Unable to parse request data" 
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
          error: "Image data missing, please upload image again" 
        }, 
        { status: 400 }
      )
    }

    let imageDataUrl = image
    if (!image.startsWith("data:")) {
      imageDataUrl = `data:image/jpeg;base64,${image}`
    }
    
    const base64 = imageDataUrl.includes(",") ? imageDataUrl.split(",")[1] : imageDataUrl
    if (!base64 || base64.length < 100) {
      return NextResponse.json(
        { 
          plateNumber: null, 
          confidence: null, 
          color: null, 
          error: "Invalid image data, please upload again" 
        }, 
        { status: 400 }
      )
    }

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
    } catch (apiError: any) {
      console.error("OCR API: OpenAI API call failed:", {
        error: apiError,
        message: apiError?.message,
        status: apiError?.status,
        code: apiError?.code,
      })
      
      let errorMessage = "AI recognition service temporarily unavailable, please try again later"
      if (apiError?.status === 401) {
        errorMessage = "Invalid API key, please contact administrator"
      } else if (apiError?.status === 429) {
        errorMessage = "Too many requests, please try again later"
      } else if (apiError?.status === 500 || apiError?.status === 503) {
        errorMessage = "AI service temporarily unavailable, please try again later"
      } else if (apiError?.message) {
        errorMessage = `Recognition failed: ${apiError.message}`
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

    const textContent = outputMessage.content?.find((item: any) => item.type === "output_text")
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
        error: error?.message || "Internal server error, please try again later" 
      }, 
      { status: 500 }
    )
  }
}

import { type NextRequest, NextResponse } from "next/server"

// Mock OCR API - In production, integrate with a real OCR service
// like Baidu OCR, Tencent OCR, or Google Cloud Vision
export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Simulate OCR processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock response - In production, call actual OCR API
    // For demo purposes, generate a random Vietnamese-style plate number
    const mockPlates = ["59A-12345", "59B-67890", "30H-11111", "29A-22222", "51G-33333"]

    // 70% chance of successful OCR
    const success = Math.random() > 0.3

    if (success) {
      const randomPlate = mockPlates[Math.floor(Math.random() * mockPlates.length)]
      return NextResponse.json({
        plateNumber: randomPlate,
        confidence: 0.85 + Math.random() * 0.15,
      })
    } else {
      return NextResponse.json({
        plateNumber: null,
        error: "Could not detect plate number",
      })
    }
  } catch (error) {
    console.error("OCR error:", error)
    return NextResponse.json({ error: "OCR processing failed" }, { status: 500 })
  }
}

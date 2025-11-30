import { z } from "zod"

/**
 * License plate validation
 * - trims whitespace
 * - allows alphanumeric, spaces, dashes
 * - length guard to avoid absurd plates
 */
export const PlateNumberSchema = z
  .string({ required_error: "Enter plate number" })
  .trim()
  .min(1, "Enter plate number")
  .max(20, "Plate number too long")
  .regex(/^[A-Za-z0-9\-\s]+$/, "Invalid plate format")

/**
 * Data URL validation (camera/gallery capture)
 */
export const ImageDataUrlSchema = z
  .string({ required_error: "Image data missing" })
  .refine((value) => value.startsWith("data:image/"), {
    message: "Invalid image format",
  })
  .refine((value) => value.includes(","), {
    message: "Corrupted image data",
  })
  .refine((value) => {
    const base64 = value.split(",")[1]
    return Boolean(base64 && base64.length > 100)
  }, {
    message: "Image data incomplete",
  })
  .refine((value) => {
    const base64 = value.split(",")[1] ?? ""
    return base64.length < 10 * 1024 * 1024 // ~10MB
  }, {
    message: "Image too large",
  })

/**
 * Plain base64 validation (API clients may send raw base64)
 */
export const Base64ImageSchema = z
  .string({ required_error: "Image data missing" })
  .regex(/^[A-Za-z0-9+/=\n\r]+$/, "Invalid base64 data")
  .min(100, "Image data incomplete")
  .max(14 * 1024 * 1024, "Image too large")

/**
 * OCR request payload validation
 */
export const OcrImageRequestSchema = z.object({
  image: z.union([ImageDataUrlSchema, Base64ImageSchema]),
})

/**
 * QR payload validation used during exit scanning
 */
export const QRPayloadSchema = z.object({
  id: z.number({ required_error: "Invalid QR code" }).int("Invalid QR code").positive("Invalid QR code"),
})

export type ValidPlateNumber = z.infer<typeof PlateNumberSchema>

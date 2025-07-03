"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

// Initialize Supabase client
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    persistSession: false,
  },
})

// Default bucket name
const DEFAULT_BUCKET = "images"

// Helper function to add delay between requests
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper function to sanitize filenames for URL safety
function sanitizeFilename(filename: string): string {
  // Remove file extension
  const name = filename.substring(0, filename.lastIndexOf(".")) || filename

  // Replace spaces and special characters with dashes
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-") // Replace non-alphanumeric with dash
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/^-|-$/g, "") // Remove leading and trailing dashes

  // Limit length to avoid excessively long URLs
  return sanitized.substring(0, 50) // Limit to 50 chars
}

// Helper function to get appropriate MIME type
function getContentType(file: File): string {
  // Ensure we have the correct MIME type for common file extensions
  const extension = file.name.split(".").pop()?.toLowerCase()

  switch (extension) {
    case "mp3":
      return "audio/mpeg"
    case "wav":
      return "audio/wav"
    case "ogg":
      return "audio/ogg"
    case "m4a":
      return "audio/mp4"
    case "mp4":
      return "video/mp4"
    case "webm":
      return "video/webm"
    case "mov":
      return "video/quicktime"
    case "avi":
      return "video/x-msvideo"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "webp":
      return "image/webp"
    case "gif":
      return "image/gif"
    default:
      return file.type || "application/octet-stream"
  }
}

// Upload a single file
async function uploadSingleFile(file: File, folderPath: string, userId?: string) {
  try {
    // Get file extension
    const fileExt = file.name.split(".").pop()

    // Sanitize the original filename
    const sanitizedName = sanitizeFilename(file.name)

    // Create a unique filename that includes the original name
    // Format: folder/sanitized-original-name-timestamp-random.ext
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const fileName = `${folderPath ? folderPath + "/" : ""}${sanitizedName}-${uniqueId}.${fileExt}`

    // Convert file to buffer
    const buffer = await file.arrayBuffer()

    // Get the correct content type
    const contentType = getContentType(file)

    // Upload to Supabase Storage with proper configuration for large files
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .upload(fileName, buffer, {
        contentType: contentType,
        cacheControl: "3600",
        upsert: true,
        duplex: "half", // Required for large file uploads
      })

    if (storageError) {
      console.error("Storage error:", storageError)

      // Check for specific error types
      if (
        storageError.message?.includes("Request Entity Too Large") ||
        storageError.message?.includes("413") ||
        storageError.message?.includes("Payload Too Large")
      ) {
        return {
          success: false,
          error: `File too large. Maximum file size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
          fileName: file.name,
        }
      }

      return {
        success: false,
        error: storageError.message,
        fileName: file.name,
      }
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(DEFAULT_BUCKET).getPublicUrl(fileName)

    // Prepare the media data
    const mediaData: any = {
      filename: file.name,
      file_size: file.size,
      file_type: contentType,
      bucket_name: DEFAULT_BUCKET,
      storage_path: fileName,
      public_url: publicUrl,
    }

    // Only add user_id if it's provided and valid
    if (userId && userId.trim() !== "") {
      try {
        // Check if the user exists before adding the user_id
        const { data: userData, error: userError } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("id", Number.parseInt(userId))
          .single()

        if (!userError && userData) {
          mediaData.user_id = Number.parseInt(userId)
        } else {
          console.log("User not found, skipping user association")
        }
      } catch (error) {
        console.log("Error checking user existence, skipping user association:", error)
      }
    }

    // Store metadata in the media table
    const { data: dbData, error: dbError } = await supabaseAdmin.from("images").insert(mediaData).select().single()

    if (dbError) {
      console.error("Database error:", dbError)
      // Even if DB insert fails, we still uploaded the file, so return partial success
      return {
        success: true,
        warning: "File uploaded but metadata could not be saved: " + dbError.message,
        publicUrl,
        path: fileName,
        fileName: file.name,
      }
    }

    return {
      success: true,
      image: dbData,
      publicUrl,
      path: fileName,
      fileName: file.name,
    }
  } catch (error: any) {
    console.error("Upload error details:", error)

    // Check for rate limiting errors
    if (
      error.message &&
      (error.message.includes("Too Many Requests") ||
        error.message.includes("429") ||
        error.message.includes("rate limit"))
    ) {
      return {
        success: false,
        error: "Rate limit exceeded. Please try again later or upload fewer files at once.",
        fileName: file.name,
        isRateLimit: true,
      }
    }

    // Check for size-related errors
    if (
      error.message &&
      (error.message.includes("Request Entity Too Large") ||
        error.message.includes("413") ||
        error.message.includes("Payload Too Large") ||
        error.message.includes("File too large"))
    ) {
      return {
        success: false,
        error: `File too large. Maximum file size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
        fileName: file.name,
      }
    }

    // Check for JSON parsing errors (usually indicates an HTTP error response)
    if (error.message && error.message.includes("not valid JSON")) {
      return {
        success: false,
        error:
          "Server error occurred. This might be due to file size limits or server configuration. Please try a smaller file or contact support.",
        fileName: file.name,
      }
    }

    return {
      success: false,
      error: error.message || "Unknown error occurred",
      fileName: file.name,
    }
  }
}

// Create or ensure bucket exists with proper configuration
async function ensureBucketExists() {
  try {
    // First, try to get the bucket to see if it exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()

    if (listError) {
      console.error("Error listing buckets:", listError)
      return false
    }

    const bucketExists = buckets?.some((bucket) => bucket.name === DEFAULT_BUCKET)

    if (!bucketExists) {
      // Create bucket with configuration for large files
      const { data, error } = await supabaseAdmin.storage.createBucket(DEFAULT_BUCKET, {
        public: true,
        fileSizeLimit: 52428800, // 50MB in bytes
        allowedMimeTypes: [
          // Images
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          // Videos
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-msvideo",
          // Audio
          "audio/mpeg",
          "audio/wav",
          "audio/ogg",
          "audio/mp4",
        ],
      })

      if (error) {
        console.error("Error creating bucket:", error)
        return false
      }

      console.log("Bucket created successfully")
    }

    return true
  } catch (error) {
    console.error("Error ensuring bucket exists:", error)
    return false
  }
}

// Handle multiple file uploads
export async function uploadMultipleImages(formData: FormData) {
  try {
    // Ensure bucket exists with proper configuration
    await ensureBucketExists()

    const files = formData.getAll("files") as File[]
    if (!files || files.length === 0) {
      return { success: false, error: "No files provided" }
    }

    const userId = formData.get("userId") as string
    const folderPath = (formData.get("folderPath") as string) || ""

    // Check file sizes before uploading
    const maxSizeBytes = 52428800 // 50MB
    const oversizedFiles = files.filter((file) => file.size > maxSizeBytes)

    if (oversizedFiles.length > 0) {
      return {
        success: false,
        error: `Some files are too large. Maximum size is 50MB. Oversized files: ${oversizedFiles.map((f) => `${f.name} (${(f.size / (1024 * 1024)).toFixed(1)}MB)`).join(", ")}`,
      }
    }

    const results = []
    let successfulUploads = 0
    let rateLimitHit = false

    // Process files one by one with delays to avoid rate limiting
    for (let i = 0; i < files.length; i++) {
      // Add a delay between uploads to avoid rate limiting
      if (i > 0) {
        await delay(500) // Increased delay for larger files
      }

      // If we've already hit a rate limit, stop processing more files
      if (rateLimitHit) {
        results.push({
          success: false,
          error: "Upload skipped due to rate limiting",
          fileName: files[i].name,
          isRateLimit: true,
        })
        continue
      }

      const result = await uploadSingleFile(files[i], folderPath, userId)
      results.push(result)

      if (result.success) {
        successfulUploads++
      }

      // If we hit a rate limit, mark it so we can stop processing
      if (result.isRateLimit) {
        rateLimitHit = true
      }
    }

    revalidatePath("/")

    return {
      success: true,
      allSuccessful: successfulUploads === files.length,
      results,
      totalFiles: files.length,
      successfulUploads,
      rateLimitHit,
    }
  } catch (error: any) {
    console.error("Upload error:", error)

    // Check for rate limiting or JSON parsing errors
    if (
      error.message &&
      (error.message.includes("Too Many Requests") ||
        error.message.includes("429") ||
        error.message.includes("rate limit") ||
        error.message.includes("not valid JSON"))
    ) {
      return {
        success: false,
        error: "Rate limit exceeded or server error. Please try again later with fewer files.",
        isRateLimit: true,
      }
    }

    return {
      success: false,
      error: error.message || "An unknown error occurred",
    }
  }
}

// Original single file upload function (kept for backward compatibility)
export async function uploadImageSupabase(formData: FormData) {
  try {
    const file = formData.get("file") as File
    if (!file) {
      return { success: false, error: "No file provided" }
    }

    // Check file size
    const maxSizeBytes = 52428800 // 50MB
    if (file.size > maxSizeBytes) {
      return {
        success: false,
        error: `File too large. Maximum size is 50MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
      }
    }

    // Ensure bucket exists with proper configuration
    await ensureBucketExists()

    const userId = formData.get("userId") as string
    const folderPath = (formData.get("folderPath") as string) || ""

    const result = await uploadSingleFile(file, folderPath, userId)
    return result
  } catch (error: any) {
    console.error("Upload error:", error)

    // Check for rate limiting errors
    if (
      error.message &&
      (error.message.includes("Too Many Requests") ||
        error.message.includes("429") ||
        error.message.includes("rate limit"))
    ) {
      return {
        success: false,
        error: "Rate limit exceeded. Please try again later or upload fewer files at once.",
      }
    }

    return { success: false, error: error.message || "An unknown error occurred" }
  }
}

export async function getUserImages(userId?: number, limit = 10) {
  try {
    let query = supabaseAdmin.from("images").select("*").order("created_at", { ascending: false }).limit(limit)

    // Only filter by user_id if provided
    if (userId) {
      query = query.eq("user_id", userId)
    }

    const { data, error } = await query

    if (error) throw error

    return { images: data }
  } catch (error: any) {
    console.error("Error fetching images:", error)
    return { images: [], error: error.message }
  }
}

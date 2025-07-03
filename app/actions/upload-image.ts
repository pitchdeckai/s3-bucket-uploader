"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { uploadFileToS3, DEFAULT_BUCKET } from "@/lib/s3-client"

// Initialize Supabase client for database operations only
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    persistSession: false,
  },
})

export async function uploadImage(formData: FormData) {
  try {
    const file = formData.get("file") as File
    if (!file) {
      return { success: false, error: "No file provided" }
    }

    const userId = formData.get("userId") as string
    const folderPath = (formData.get("folderPath") as string) || ""

    // Create a unique file name
    const fileExt = file.name.split(".").pop()
    const fileName = `${folderPath ? folderPath + "/" : ""}${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`

    // Convert file to buffer
    const buffer = await file.arrayBuffer()

    // Upload directly to S3
    const s3Result = await uploadFileToS3(new Uint8Array(buffer), fileName, file.type, DEFAULT_BUCKET)

    if (!s3Result.success) {
      return { success: false, error: s3Result.error }
    }

    // Store metadata in the images table
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from("images")
      .insert({
        filename: file.name,
        file_size: file.size,
        file_type: file.type,
        bucket_name: DEFAULT_BUCKET,
        storage_path: fileName,
        public_url: s3Result.publicUrl,
        user_id: userId ? Number.parseInt(userId) : null,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      // Even if DB insert fails, we still uploaded the file, so return partial success
      return {
        success: true,
        warning: "File uploaded but metadata could not be saved",
        publicUrl: s3Result.publicUrl,
        path: fileName,
      }
    }

    revalidatePath("/")
    return {
      success: true,
      image: dbData,
      publicUrl: s3Result.publicUrl,
      path: fileName,
    }
  } catch (error: any) {
    console.error("Upload error:", error)
    return { success: false, error: error.message || "An unknown error occurred" }
  }
}

export async function getUserImages(userId?: number, limit = 10) {
  if (!userId) return { images: [] }

  try {
    const { data, error } = await supabaseAdmin
      .from("images")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return { images: data }
  } catch (error: any) {
    console.error("Error fetching images:", error)
    return { images: [], error: error.message }
  }
}

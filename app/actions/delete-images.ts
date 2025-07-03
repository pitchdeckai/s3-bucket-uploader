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

// Delete a single image
export async function deleteImage(imageId: number) {
  try {
    // First get the image details to know the storage path
    const { data: image, error: fetchError } = await supabaseAdmin.from("images").select("*").eq("id", imageId).single()

    if (fetchError) {
      console.error("Error fetching image:", fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!image) {
      return { success: false, error: "Image not found" }
    }

    // Delete the file from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from(image.bucket_name || DEFAULT_BUCKET)
      .remove([image.storage_path])

    if (storageError) {
      console.error("Storage delete error:", storageError)
      // We'll continue to delete the database record even if storage delete fails
    }

    // Delete the database record
    const { error: dbError } = await supabaseAdmin.from("images").delete().eq("id", imageId)

    if (dbError) {
      console.error("Database delete error:", dbError)
      return { success: false, error: dbError.message }
    }

    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Delete error:", error)
    return { success: false, error: error.message || "An unknown error occurred" }
  }
}

// Delete all images
export async function deleteAllImages(userId?: number) {
  try {
    // Get all images (optionally filtered by user)
    let query = supabaseAdmin.from("images").select("*")
    if (userId) {
      query = query.eq("user_id", userId)
    }

    const { data: images, error: fetchError } = await query

    if (fetchError) {
      console.error("Error fetching images:", fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!images || images.length === 0) {
      return { success: true, message: "No images to delete" }
    }

    // Group images by bucket for batch deletion
    const imagesByBucket: Record<string, string[]> = {}
    images.forEach((image) => {
      const bucket = image.bucket_name || DEFAULT_BUCKET
      if (!imagesByBucket[bucket]) {
        imagesByBucket[bucket] = []
      }
      imagesByBucket[bucket].push(image.storage_path)
    })

    // Delete files from storage (by bucket)
    for (const [bucket, paths] of Object.entries(imagesByBucket)) {
      // Delete in batches of 1000 to avoid hitting API limits
      for (let i = 0; i < paths.length; i += 1000) {
        const batch = paths.slice(i, i + 1000)
        const { error: storageError } = await supabaseAdmin.storage.from(bucket).remove(batch)

        if (storageError) {
          console.error(`Storage delete error for bucket ${bucket}:`, storageError)
          // Continue with other buckets even if one fails
        }
      }
    }

    // Delete all database records
    const { error: dbError } = await supabaseAdmin
      .from("images")
      .delete()
      .in(
        "id",
        images.map((img) => img.id),
      )

    if (dbError) {
      console.error("Database delete error:", dbError)
      return { success: false, error: dbError.message }
    }

    revalidatePath("/")
    return { success: true, count: images.length }
  } catch (error: any) {
    console.error("Delete all error:", error)
    return { success: false, error: error.message || "An unknown error occurred" }
  }
}

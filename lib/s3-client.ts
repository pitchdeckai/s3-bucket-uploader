import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

// Initialize S3 client with explicit credentials to avoid credential chain
export const getS3Client = () => {
  return new S3Client({
    region: process.env.SUPABASE_S3_REGION || "us-east-1",
    endpoint: process.env.SUPABASE_S3_URL,
    credentials: {
      accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: true, // Required for Supabase S3 compatibility
    // Disable credential loading from shared files
    customUserAgent: "supabase-image-uploader",
  })
}

// Default bucket name
export const DEFAULT_BUCKET = "images"

// Upload a file to S3
export async function uploadFileToS3(
  file: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
  bucketName = DEFAULT_BUCKET,
) {
  try {
    const s3Client = getS3Client()

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: file,
      ContentType: contentType,
    })

    const response = await s3Client.send(command)

    // Construct the public URL
    const baseUrl = process.env.SUPABASE_URL
    const publicUrl = `${baseUrl}/storage/v1/object/public/${bucketName}/${fileName}`

    return {
      success: true,
      publicUrl,
      path: fileName,
      response,
    }
  } catch (error: any) {
    console.error("S3 upload error:", error)
    return {
      success: false,
      error: error.message || "Failed to upload file to S3",
    }
  }
}

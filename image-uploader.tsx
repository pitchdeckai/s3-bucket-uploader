"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Check, FileImage, Loader2, Video, Music, File } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"
import { uploadImageSupabase } from "@/app/actions/upload-image-supabase"

interface MediaUploaderProps {
  userId?: number
  folderPath?: string
  onUploadComplete?: (data: any) => void
  maxSizeMB?: number
  allowedFileTypes?: string[]
}

// Helper function to get file type category
const getFileTypeCategory = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  return "file"
}

// Helper function to get appropriate icon for file type
const getFileIcon = (mimeType: string) => {
  const category = getFileTypeCategory(mimeType)
  switch (category) {
    case "image":
      return FileImage
    case "video":
      return Video
    case "audio":
      return Music
    default:
      return File
  }
}

export default function MediaUploader({
  userId,
  folderPath = "",
  onUploadComplete,
  maxSizeMB = 50,
  allowedFileTypes = [
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
}: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaPath, setMediaPath] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset states
    setError(null)
    setMediaUrl(null)
    setMediaPath(null)
    setSelectedFile(file)

    // Validate file type
    if (!allowedFileTypes.includes(file.type)) {
      setError(`File type not allowed. Please upload: ${allowedFileTypes.map((type) => type.split("/")[1]).join(", ")}`)
      return
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxSizeMB) {
      setError(`File size exceeds ${maxSizeMB}MB limit`)
      return
    }

    try {
      setUploading(true)
      setProgress(0)

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 5
        })
      }, 100)

      // Create form data for server action
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folderPath", folderPath)
      if (userId) formData.append("userId", userId.toString())

      // Use server action to upload
      const result = await uploadImageSupabase(formData)

      clearInterval(progressInterval)
      setProgress(100)

      if (!result.success) {
        throw new Error(result.error || "Upload failed")
      }

      if (result.warning) {
        console.warn(result.warning)
      }

      setMediaUrl(result.publicUrl)
      setMediaPath(result.path)

      // Call the callback if provided
      if (onUploadComplete) {
        onUploadComplete(result)
      }
    } catch (error: any) {
      setError(error.message || "An error occurred during upload")
    } finally {
      setUploading(false)
    }
  }

  const resetUpload = () => {
    setMediaUrl(null)
    setMediaPath(null)
    setError(null)
    setProgress(0)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const renderMediaPreview = () => {
    if (!selectedFile && !mediaUrl) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed p-8">
          <FileImage className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Drag and drop or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">Supports: Images, Videos, Audio files</p>
            <p className="text-xs text-muted-foreground">Max size: {maxSizeMB}MB</p>
          </div>
        </div>
      )
    }

    const file = selectedFile
    const url = mediaUrl || (file ? URL.createObjectURL(file) : null)
    const fileType = file?.type || ""
    const category = getFileTypeCategory(fileType)
    const FileIcon = getFileIcon(fileType)

    if (!url) return null

    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-md border">
        {category === "image" && (
          <Image src={url || "/placeholder.svg"} alt="Uploaded media" fill className="object-cover" />
        )}
        {category === "video" && (
          <video src={url} controls className="h-full w-full object-cover" preload="metadata">
            Your browser does not support the video tag.
          </video>
        )}
        {category === "audio" && (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 p-4">
            <Music className="h-16 w-16 text-gray-400 mb-4" />
            <audio controls className="w-full">
              <source src={url} type={fileType} />
              Your browser does not support the audio element.
            </audio>
            {file && <p className="text-xs text-muted-foreground mt-2 text-center truncate w-full">{file.name}</p>}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileImage className="h-5 w-5" />
          Media Uploader
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {renderMediaPreview()}

        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-xs text-center text-muted-foreground">{progress}% uploaded</p>
          </div>
        )}

        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="media">Select Media File</Label>
          <Input
            id="media"
            type="file"
            ref={fileInputRef}
            accept={allowedFileTypes.join(",")}
            onChange={handleFileChange}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground">
            Supports: Images, Videos (mp4, webm, mov, avi), Audio (mp3, wav, ogg, m4a) | Max size: {maxSizeMB}MB
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={resetUpload} disabled={uploading || (!mediaUrl && !error)}>
          Reset
        </Button>

        {mediaUrl && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="h-4 w-4" />
            Upload complete
          </div>
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

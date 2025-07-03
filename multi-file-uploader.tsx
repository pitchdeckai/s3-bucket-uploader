"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Check, Loader2, X, Upload, FileImage, Video, Music, File } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Image from "next/image"
import { uploadMultipleImages } from "@/app/actions/upload-image-supabase"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface MultiFileUploaderProps {
  userId?: number
  folderPath?: string
  onUploadComplete?: (data: any) => void
  maxSizeMB?: number
  allowedFileTypes?: string[]
  maxFiles?: number
}

type FileStatus = "pending" | "uploading" | "success" | "error"

interface FileWithStatus {
  file: File
  id: string
  status: FileStatus
  progress: number
  error?: string
  result?: any
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

export default function MultiFileUploader({
  userId,
  folderPath = "",
  onUploadComplete,
  maxSizeMB = 50, // Increased for video files
  allowedFileTypes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    // Videos
    "video/mp4",
    "video/webm",
    "video/quicktime", // .mov files
    "video/x-msvideo", // .avi files
    // Audio
    "audio/mpeg", // .mp3 files
    "audio/wav",
    "audio/ogg",
    "audio/mp4", // .m4a files
  ],
  maxFiles = 500,
}: MultiFileUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<FileWithStatus[]>([])
  const [error, setError] = useState<string | null>(null)
  const [rateLimitHit, setRateLimitHit] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])

    // Check if we're exceeding the max number of files
    if (files.length + selectedFiles.length > maxFiles) {
      setError(`You can only upload a maximum of ${maxFiles} files at once.`)
      return
    }

    // Reset error
    setError(null)
    setRateLimitHit(false)

    // Validate and add files
    const newFiles = selectedFiles.map((file) => {
      // Validate file type
      const isValidType = allowedFileTypes.includes(file.type)

      // Validate file size (50MB = 52428800 bytes)
      const fileSizeMB = file.size / (1024 * 1024)
      const isValidSize = fileSizeMB <= maxSizeMB

      let errorMessage = undefined
      if (!isValidType) {
        errorMessage = `Invalid file type. Allowed: ${allowedFileTypes.map((t) => t.split("/")[1]).join(", ")}`
      } else if (!isValidSize) {
        errorMessage = `File too large: ${fileSizeMB.toFixed(1)}MB. Max size: ${maxSizeMB}MB`
      }

      return {
        file,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        status: isValidType && isValidSize ? "pending" : "error",
        progress: 0,
        error: errorMessage,
      } as FileWithStatus
    })

    setFiles((prev) => [...prev, ...newFiles])

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const uploadFiles = async () => {
    if (files.length === 0 || files.every((f) => f.status === "error")) {
      setError("No valid files to upload")
      return
    }

    const validFiles = files.filter((f) => f.status === "pending")
    if (validFiles.length === 0) {
      setError("No valid files to upload")
      return
    }

    try {
      setUploading(true)
      setError(null)
      setRateLimitHit(false)

      // Update all valid files to uploading status
      setFiles((prev) => prev.map((f) => (f.status === "pending" ? { ...f, status: "uploading", progress: 0 } : f)))

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) => {
            if (f.status === "uploading" && f.progress < 95) {
              return { ...f, progress: f.progress + 5 }
            }
            return f
          }),
        )
      }, 200)

      // Recommend a smaller batch size if there are many files
      const recommendedBatchSize = 20
      if (validFiles.length > recommendedBatchSize) {
        console.log(
          `Uploading ${validFiles.length} files. Consider uploading in smaller batches for better reliability.`,
        )
      }

      // Process files in smaller batches to avoid rate limiting
      // We'll upload all files at once but let the server handle the batching
      const formData = new FormData()
      validFiles.forEach((f) => {
        formData.append("files", f.file)
      })

      formData.append("folderPath", folderPath)
      if (userId) formData.append("userId", userId.toString())

      // Upload files
      const result = await uploadMultipleImages(formData)

      clearInterval(progressInterval)

      if (!result.success) {
        throw new Error(result.error || "Upload failed")
      }

      // Check if we hit a rate limit
      if (result.rateLimitHit) {
        setRateLimitHit(true)
        setError("Rate limit exceeded. Some files were not uploaded. Please try again later with fewer files.")
      }

      // Update file statuses based on results
      setFiles((prev) => {
        const updatedFiles = [...prev]

        // Map results to files by filename
        const resultsByFilename = new Map()
        result.results.forEach((r) => {
          resultsByFilename.set(r.fileName, r)
        })

        // Update each file with its result
        return updatedFiles.map((f) => {
          const fileResult = resultsByFilename.get(f.file.name)

          if (!fileResult) {
            return f
          }

          if (fileResult.success) {
            return {
              ...f,
              status: "success",
              progress: 100,
              result: fileResult,
            }
          } else {
            return {
              ...f,
              status: "error",
              progress: 0,
              error: fileResult.error,
            }
          }
        })
      })

      // Call the callback if provided
      if (onUploadComplete) {
        onUploadComplete({
          success: true,
          successfulUploads: result.successfulUploads,
          failedUploads: result.totalFiles - result.successfulUploads,
          totalFiles: result.totalFiles,
          rateLimitHit: result.rateLimitHit,
        })
      }
    } catch (error: any) {
      // Check for rate limiting errors
      if (
        error.message &&
        (error.message.includes("Too Many Requests") ||
          error.message.includes("429") ||
          error.message.includes("rate limit") ||
          error.message.includes("not valid JSON"))
      ) {
        setError("Rate limit exceeded. Please try again later with fewer files.")
        setRateLimitHit(true)
      } else {
        setError(error.message || "An error occurred during upload")
      }

      // Mark all uploading files as error
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? {
                ...f,
                status: "error",
                error: "Upload failed",
              }
            : f,
        ),
      )
    } finally {
      setUploading(false)
    }
  }

  const resetUpload = () => {
    setFiles([])
    setError(null)
    setRateLimitHit(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Get counts for status display
  const pendingCount = files.filter((f) => f.status === "pending").length
  const successCount = files.filter((f) => f.status === "success").length
  const errorCount = files.filter((f) => f.status === "error").length
  const uploadingCount = files.filter((f) => f.status === "uploading").length

  // Recommended batch size warning
  const showBatchWarning = pendingCount > 20

  // Get file type counts
  const imageCount = files.filter((f) => getFileTypeCategory(f.file.type) === "image").length
  const videoCount = files.filter((f) => getFileTypeCategory(f.file.type) === "video").length
  const audioCount = files.filter((f) => getFileTypeCategory(f.file.type) === "audio").length

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
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

        {rateLimitHit && (
          <Alert variant="warning" className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-600">Rate Limit Warning</AlertTitle>
            <AlertDescription className="text-amber-700">
              You've hit the API rate limit. To avoid this:
              <ul className="list-disc pl-5 mt-2 text-sm">
                <li>Upload fewer files at once (20-30 is recommended)</li>
                <li>Wait a few minutes before trying again</li>
                <li>Files that failed can be retried later</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {showBatchWarning && !rateLimitHit && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-600">Large Batch Warning</AlertTitle>
            <AlertDescription className="text-blue-700">
              You're trying to upload {pendingCount} files at once. To avoid rate limiting, consider uploading 20-30
              files at a time.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="media">Select Media Files</Label>
          <div className="flex gap-2">
            <Input
              id="media"
              type="file"
              ref={fileInputRef}
              accept={allowedFileTypes.join(",")}
              onChange={handleFileChange}
              disabled={uploading}
              multiple
              className="flex-1"
            />
            <Button onClick={uploadFiles} disabled={uploading || pendingCount === 0} className="whitespace-nowrap">
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {pendingCount > 0 ? `(${pendingCount})` : ""}
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Supports: Images (jpg, png, webp, gif), Videos (mp4, webm, mov, avi), Audio (mp3, wav, ogg, m4a) | Max size:{" "}
            {maxSizeMB}MB | Max files: {maxFiles}
          </p>
        </div>

        {files.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {pendingCount > 0 && (
              <Badge variant="outline" className="bg-blue-50">
                Pending: {pendingCount}
              </Badge>
            )}
            {uploadingCount > 0 && (
              <Badge variant="outline" className="bg-yellow-50">
                Uploading: {uploadingCount}
              </Badge>
            )}
            {successCount > 0 && (
              <Badge variant="outline" className="bg-green-50">
                Uploaded: {successCount}
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="outline" className="bg-red-50">
                Failed: {errorCount}
              </Badge>
            )}
            {imageCount > 0 && (
              <Badge variant="outline" className="bg-purple-50">
                <FileImage className="h-3 w-3 mr-1" />
                Images: {imageCount}
              </Badge>
            )}
            {videoCount > 0 && (
              <Badge variant="outline" className="bg-indigo-50">
                <Video className="h-3 w-3 mr-1" />
                Videos: {videoCount}
              </Badge>
            )}
            {audioCount > 0 && (
              <Badge variant="outline" className="bg-pink-50">
                <Music className="h-3 w-3 mr-1" />
                Audio: {audioCount}
              </Badge>
            )}
          </div>
        )}

        {files.length > 0 && (
          <ScrollArea className="h-[400px] rounded-md border">
            <div className="p-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
              {files.map((fileItem) => {
                const FileIcon = getFileIcon(fileItem.file.type)
                const fileCategory = getFileTypeCategory(fileItem.file.type)
                const fileSizeMB = fileItem.file.size / (1024 * 1024)

                return (
                  <div
                    key={fileItem.id}
                    className={`relative rounded-md border p-2 ${
                      fileItem.status === "error"
                        ? "border-red-200 bg-red-50"
                        : fileItem.status === "success"
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                        {fileCategory === "image" ? (
                          <Image
                            src={URL.createObjectURL(fileItem.file) || "/placeholder.svg"}
                            alt={fileItem.file.name}
                            fill
                            className="object-cover"
                          />
                        ) : fileCategory === "video" ? (
                          <video
                            src={URL.createObjectURL(fileItem.file)}
                            className="h-full w-full object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <FileIcon className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fileSizeMB >= 1
                            ? `${fileSizeMB.toFixed(1)} MB`
                            : `${(fileItem.file.size / 1024).toFixed(1)} KB`}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {fileCategory} • {fileItem.file.type.split("/")[1]}
                        </p>

                        {fileItem.status === "error" && <p className="text-xs text-red-500 mt-1">{fileItem.error}</p>}

                        {fileItem.status === "success" && fileItem.result?.publicUrl && (
                          <a
                            href={fileItem.result.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                          >
                            View {fileCategory}
                          </a>
                        )}

                        {(fileItem.status === "uploading" || fileItem.status === "success") && (
                          <Progress value={fileItem.progress} className="h-1 mt-2" />
                        )}
                      </div>

                      {fileItem.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeFile(fileItem.id)}
                          disabled={uploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}

                      {fileItem.status === "success" && (
                        <div className="h-6 w-6 flex items-center justify-center text-green-500">
                          <Check className="h-4 w-4" />
                        </div>
                      )}

                      {fileItem.status === "error" && (
                        <div className="h-6 w-6 flex items-center justify-center text-red-500">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                      )}

                      {fileItem.status === "uploading" && (
                        <div className="h-6 w-6 flex items-center justify-center text-yellow-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={resetUpload} disabled={uploading || files.length === 0}>
          Clear All
        </Button>

        <div className="text-sm">
          {uploading ? (
            <span className="text-yellow-600 flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading files...
            </span>
          ) : successCount > 0 ? (
            <span className="text-green-600 flex items-center">
              <Check className="h-4 w-4 mr-2" />
              {successCount} file{successCount !== 1 ? "s" : ""} uploaded
              {errorCount > 0 ? `, ${errorCount} failed` : ""}
            </span>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  )
}

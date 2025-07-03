"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getUserImages } from "@/app/actions/upload-image-supabase"
import { deleteImage, deleteAllImages } from "@/app/actions/delete-images"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ExternalLink,
  FileImage,
  Calendar,
  HardDrive,
  Trash2,
  AlertTriangle,
  Link,
  Video,
  Music,
  File,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { ConfirmationDialog } from "@/components/confirmation-dialog"
import { useToast } from "@/hooks/use-toast"
import { AlertDialogDescription } from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface MediaGalleryProps {
  userId?: number
  limit?: number
  onImagesUpdated?: () => void
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

export default function MediaGallery({ userId, limit = 10, onImagesUpdated }: MediaGalleryProps) {
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<number | null>(null)
  const { toast } = useToast()

  const loadImages = async () => {
    try {
      setLoading(true)
      const result = await getUserImages(userId, limit)
      if (result.error) {
        setError(result.error)
      } else {
        setImages(result.images || [])
      }
    } catch (err: any) {
      setError(err.message || "Failed to load media")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [userId, limit])

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + " bytes"
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
    else return (bytes / 1048576).toFixed(1) + " MB"
  }

  const handleDeleteImage = async () => {
    if (imageToDelete === null) return

    try {
      const result = await deleteImage(imageToDelete)
      if (result.success) {
        toast({
          title: "Media deleted",
          description: "The media file has been successfully deleted",
        })
        // Remove the deleted image from the state
        setImages((prev) => prev.filter((img) => img.id !== imageToDelete))
        if (onImagesUpdated) onImagesUpdated()
      } else {
        toast({
          title: "Delete failed",
          description: result.error || "Failed to delete the media file",
          variant: "destructive",
        })
      }
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message || "An error occurred while deleting the media file",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAllImages = async () => {
    try {
      const result = await deleteAllImages(userId)
      if (result.success) {
        toast({
          title: "All media deleted",
          description: `Successfully deleted ${result.count || "all"} media files`,
        })
        // Clear the images state
        setImages([])
        if (onImagesUpdated) onImagesUpdated()
      } else {
        toast({
          title: "Delete failed",
          description: result.error || "Failed to delete media files",
          variant: "destructive",
        })
      }
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message || "An error occurred while deleting media files",
        variant: "destructive",
      })
    }
  }

  const openDeleteDialog = (id: number) => {
    setImageToDelete(id)
    setDeleteDialogOpen(true)
  }

  // Custom description for delete all dialog to avoid nested <p> tags
  const deleteAllDescription = (
    <div className="flex flex-col gap-2">
      <AlertTriangle className="h-5 w-5 text-red-500" />
      <AlertDialogDescription>
        Are you sure you want to delete ALL media files? This action cannot be undone.
      </AlertDialogDescription>
    </div>
  )

  // Extract original filename from storage path
  const getOriginalFilename = (storagePath: string) => {
    return storagePath.split("/").pop() || storagePath
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Media Gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Media Gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">Error loading media: {error}</div>
        </CardContent>
      </Card>
    )
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Media Gallery</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No media files uploaded yet. Use the uploader to add some!
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Media Gallery ({images.length} files)</CardTitle>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteAllDialogOpen(true)}
            className="flex items-center gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Delete All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => {
              const fileCategory = getFileTypeCategory(image.file_type)
              const FileIcon = getFileIcon(image.file_type)

              return (
                <Card key={image.id} className="overflow-hidden">
                  <div className="relative aspect-square w-full overflow-hidden">
                    {fileCategory === "image" ? (
                      <Image
                        src={image.public_url || "/placeholder.svg"}
                        alt={image.filename}
                        fill
                        className="object-cover transition-transform hover:scale-105"
                      />
                    ) : fileCategory === "video" ? (
                      <video src={image.public_url} className="h-full w-full object-cover" preload="metadata" muted />
                    ) : fileCategory === "audio" ? (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gray-100 p-4">
                        <Music className="h-12 w-12 text-gray-400 mb-2" />
                        <p className="text-xs text-center text-gray-600 truncate w-full">{image.filename}</p>
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100">
                        <FileIcon className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="font-medium text-sm truncate" title={image.filename}>
                      {image.filename}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <HardDrive className="h-3 w-3" />
                      <span>{formatFileSize(image.file_size)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(image.created_at), { addSuffix: true })}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileIcon className="h-3 w-3" />
                      <span className="capitalize">{fileCategory}</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-hidden">
                          <Link className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{getOriginalFilename(image.storage_path)}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-xs break-all">{image.storage_path}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex gap-1 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-8 text-xs"
                        onClick={() => window.open(image.public_url, "_blank")}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => openDeleteDialog(image.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>

        {/* Individual Delete Confirmation Dialog */}
        <ConfirmationDialog
          title="Delete Media"
          description="Are you sure you want to delete this media file? This action cannot be undone."
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteImage}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />

        {/* Delete All Confirmation Dialog */}
        <ConfirmationDialog
          title="Delete All Media"
          description={deleteAllDescription}
          open={deleteAllDialogOpen}
          onOpenChange={setDeleteAllDialogOpen}
          onConfirm={handleDeleteAllImages}
          confirmText="Delete All"
          cancelText="Cancel"
          variant="destructive"
        />
      </Card>
    </TooltipProvider>
  )
}

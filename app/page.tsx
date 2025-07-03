"use client"

import { useState } from "react"
import MediaUploader from "@/image-uploader"
import MultiFileUploader from "@/multi-file-uploader"
import MediaGallery from "@/image-gallery"
import ImageUrls from "@/image-urls"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

export default function Home() {
  const { toast } = useToast()
  const [refreshGallery, setRefreshGallery] = useState(0)

  const handleSingleUploadComplete = (result: any) => {
    toast({
      title: "Upload successful",
      description: "Your media file has been uploaded and saved to the database",
    })
    // Trigger gallery refresh
    setRefreshGallery((prev) => prev + 1)
  }

  const handleMultiUploadComplete = (result: any) => {
    const { successfulUploads, failedUploads, totalFiles } = result

    toast({
      title: `Upload ${successfulUploads === totalFiles ? "successful" : "completed"}`,
      description: `${successfulUploads} of ${totalFiles} files were uploaded successfully${
        failedUploads > 0 ? `, ${failedUploads} failed` : ""
      }`,
    })

    // Trigger gallery refresh
    setRefreshGallery((prev) => prev + 1)
  }

  const handleImagesUpdated = () => {
    // Trigger gallery refresh when images are deleted
    setRefreshGallery((prev) => prev + 1)
  }

  return (
    <main className="container mx-auto py-10 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6">Supabase Media Uploader</h1>
      <p className="text-muted-foreground mb-6">
        Upload and manage images, videos, and audio files with Supabase storage. Supports multiple file formats with
        preview capabilities.
      </p>

      <Tabs defaultValue="multi" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="single">Single Upload</TabsTrigger>
          <TabsTrigger value="multi">Multi Upload</TabsTrigger>
          <TabsTrigger value="gallery">Media Gallery</TabsTrigger>
          <TabsTrigger value="urls">Media URLs</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <MediaUploader folderPath="uploads/single" onUploadComplete={handleSingleUploadComplete} maxSizeMB={50} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Single File Upload</CardTitle>
                <CardDescription>Upload one media file at a time with preview</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  The single file uploader supports images, videos, and audio files. Perfect for individual uploads with
                  immediate preview.
                </p>
                <ul className="list-disc pl-5 mt-4 space-y-1 text-sm">
                  <li>Preview media before upload</li>
                  <li>Support for images, videos, and audio</li>
                  <li>Progress indicator</li>
                  <li>Validation for file type and size</li>
                  <li>Up to 50MB file size limit</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="multi">
          <div className="grid gap-8 md:grid-cols-1">
            <MultiFileUploader
              folderPath="uploads/multi"
              onUploadComplete={handleMultiUploadComplete}
              maxSizeMB={50}
              maxFiles={500}
            />
            <Card>
              <CardHeader>
                <CardTitle>Multi-File Upload Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-medium mb-2">Multi-Format Support</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload images (JPG, PNG, WebP, GIF), videos (MP4, WebM, MOV, AVI), and audio files (MP3, WAV, OGG,
                      M4A) all in one batch.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Individual Status Tracking</h3>
                    <p className="text-sm text-muted-foreground">
                      Each file has its own status indicator and preview, showing whether it's pending, uploading,
                      successful, or has encountered an error.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Large File Support</h3>
                    <p className="text-sm text-muted-foreground">
                      Support for files up to 50MB with robust error handling and rate limiting to ensure reliable
                      uploads.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gallery">
          <MediaGallery limit={24} key={refreshGallery} onImagesUpdated={handleImagesUpdated} />
        </TabsContent>

        <TabsContent value="urls">
          <ImageUrls limit={100} key={refreshGallery} />
        </TabsContent>
      </Tabs>
    </main>
  )
}

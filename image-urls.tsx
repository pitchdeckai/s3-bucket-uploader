"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getUserImages } from "@/app/actions/upload-image-supabase"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Check, Copy, ExternalLink, FileImage } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

interface ImageUrlsProps {
  userId?: number
  limit?: number
}

export default function ImageUrls({ userId, limit = 50 }: ImageUrlsProps) {
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
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
      setError(err.message || "Failed to load images")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [userId, limit])

  const copyToClipboard = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedIndex(index)
      toast({
        title: "URL copied",
        description: "Image URL has been copied to clipboard",
      })
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy URL to clipboard",
        variant: "destructive",
      })
    }
  }

  const copyAllUrls = async () => {
    try {
      const allUrls = images.map((img) => img.public_url).join("\n")
      await navigator.clipboard.writeText(allUrls)
      toast({
        title: "All URLs copied",
        description: `${images.length} URLs have been copied to clipboard`,
      })
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy URLs to clipboard",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Image URLs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
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
          <CardTitle>Image URLs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">Error loading images: {error}</div>
        </CardContent>
      </Card>
    )
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Image URLs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No images uploaded yet. Use the uploader to add some!
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Image URLs ({images.length} images)</CardTitle>
        <Button variant="outline" size="sm" onClick={copyAllUrls} className="flex items-center gap-1">
          <Copy className="h-4 w-4" />
          Copy All URLs
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {images.map((image, index) => (
              <div key={image.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  {image.file_type.startsWith("image/") ? (
                    <div className="relative h-10 w-10 rounded-md overflow-hidden flex-shrink-0">
                      <img
                        src={image.public_url || "/placeholder.svg"}
                        alt={image.filename}
                        className="object-cover h-full w-full"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <FileImage className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={image.filename}>
                      {image.filename}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={image.public_url}
                    readOnly
                    className="font-mono text-xs"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => copyToClipboard(image.public_url, index)}
                  >
                    {copiedIndex === index ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => window.open(image.public_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

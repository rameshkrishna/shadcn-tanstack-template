import { useEffect, useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { cn } from "@/lib/utils"

interface ProductThumbnailProps {
  imageUrl: string
  name: string
  className?: string
  zoomable?: boolean
}

export function ProductThumbnail({ imageUrl, name, className, zoomable = true }: ProductThumbnailProps) {
  const [errored, setErrored] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)

  useEffect(() => setErrored(false), [imageUrl])

  if (errored || !imageUrl) {
    return (
      <Avatar className={cn("h-9 w-9", className)}>
        <div className="flex h-full w-full items-center justify-center bg-primary/10 font-medium text-primary">
          {name.slice(0, 1)}
        </div>
      </Avatar>
    )
  }

  const img = (
    <img
      src={imageUrl}
      alt={name}
      className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)}
      onError={() => setErrored(true)}
    />
  )

  if (!zoomable) return img

  return (
    <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
      <HoverCard openDelay={150} closeDelay={0}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setZoomOpen(true)
            }}
            className="cursor-zoom-in rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Zoom ${name} image`}
          >
            {img}
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-auto overflow-hidden rounded-lg p-0" sideOffset={8}>
          <img
            src={imageUrl}
            alt={name}
            className="block h-64 w-64 object-cover"
          />
        </HoverCardContent>
      </HoverCard>
      <DialogContent
        className="flex max-w-[calc(100%-2rem)] items-center justify-center border-none bg-transparent p-0 shadow-none ring-0 sm:max-w-2xl"
        onClick={() => setZoomOpen(false)}
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <img
          src={imageUrl}
          alt={name}
          className="max-h-[80vh] w-full rounded-xl object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}

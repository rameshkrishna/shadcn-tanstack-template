import { useEffect, useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface ProductThumbnailProps {
  imageUrl: string
  name: string
  className?: string
}

export function ProductThumbnail({ imageUrl, name, className }: ProductThumbnailProps) {
  const [errored, setErrored] = useState(false)

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

  return (
    <img
      src={imageUrl}
      alt={name}
      className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)}
      onError={() => setErrored(true)}
    />
  )
}

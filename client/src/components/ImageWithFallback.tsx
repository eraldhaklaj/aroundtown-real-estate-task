import type { ImgHTMLAttributes } from "react";

const PLACEHOLDER = "/placeholder.svg";

export function ImageWithFallback({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={src || PLACEHOLDER}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        if (!e.currentTarget.src.endsWith(PLACEHOLDER)) e.currentTarget.src = PLACEHOLDER;
      }}
      {...props}
    />
  );
}

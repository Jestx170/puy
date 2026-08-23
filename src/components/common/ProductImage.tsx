// ============================================================
// ProductImage — แสดงรูปสินค้า ถ้าไม่มีรูปจะแสดง icon Package
// ============================================================

import { Package } from "lucide-react";

export function ProductImage({
  imageUrl,
  name,
  className = "",
  iconClassName = "size-8",
}: {
  imageUrl?: string | undefined;
  name: string;
  className?: string;
  iconClassName?: string;
}) {
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={`h-full w-full object-cover ${className}`} />;
  }
  return <Package className={`${iconClassName} text-muted-foreground`} aria-label={name} />;
}

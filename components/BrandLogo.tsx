import Image from "next/image";

export function BrandLogo({ name, logoUrl, className = "wordmark" }: { name: string; logoUrl: string | null; className?: string }) {
  if (logoUrl) return <Image src={logoUrl} alt={`${name} logo`} width={145} height={38} unoptimized style={{ width: "auto", maxWidth: 145, height: "auto", maxHeight: 38, objectFit: "contain" }} />;
  return <span className={className}>{name}</span>;
}

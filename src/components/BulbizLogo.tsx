import abeilleImg from "@/assets/abeille.png";

interface BulbizLogoProps {
  size?: number;
  showText?: boolean;
}

export function BulbizLogo({ size = 24, showText = true }: BulbizLogoProps) {
  return (
    <div className="flex items-center gap-2">
      <img src={abeilleImg} alt="Bulbiz" className="rounded-full object-cover" style={{ width: size, height: size }} />
      {showText && <span className="text-lg font-bold text-foreground">Bulbiz</span>}
    </div>
  );
}

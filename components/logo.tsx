type LogoProps = { size?: "md" | "lg" };

export function Logo({ size = "md" }: LogoProps) {
  return (
    <img
      className={size === "lg" ? "logo logo-lg" : "logo"}
      src="/logo-influx-white.png"
      alt="inFlux Got Talent"
    />
  );
}

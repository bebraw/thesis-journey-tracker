export type BadgeVariant = "neutral" | "mock" | "count";

export interface BadgeOptions {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

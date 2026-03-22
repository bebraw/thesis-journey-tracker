export type ButtonVariant =
  | "neutral"
  | "primary"
  | "primaryBlock"
  | "successBlock"
  | "dangerBlock"
  | "inline";

export type BadgeVariant = "neutral" | "mock" | "count";

export interface ButtonOptions {
  label: string;
  href?: string;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  className?: string;
  attributes?: string;
}

export interface BadgeOptions {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface FieldOptions {
  label: string;
  name?: string;
  id?: string;
  type?: string;
  value?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  attributes?: string;
}

export interface SelectFieldOptions {
  label: string;
  name?: string;
  id?: string;
  options: SelectOption[];
  value?: string;
  className?: string;
  wrapperClassName?: string;
  attributes?: string;
}

export interface TextareaFieldOptions {
  label: string;
  name?: string;
  id?: string;
  value?: string;
  rows?: number;
  className?: string;
  wrapperClassName?: string;
  required?: boolean;
  attributes?: string;
}

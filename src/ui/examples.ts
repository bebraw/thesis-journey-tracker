export type UIExampleScope = "foundation" | "app";

export interface UIExampleSection {
  id: string;
  scope: UIExampleScope;
  title: string;
  description: string;
  whenToUse?: string;
  avoidFor?: string;
  contentHtml: string;
}

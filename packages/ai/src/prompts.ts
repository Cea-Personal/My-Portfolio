import { createHash } from "node:crypto";
export interface PromptDefinition {
  name: string;
  version: number;
  template: string;
  schemaVersion: string;
  contentHash: string;
}
export class PromptRegistry {
  private readonly definitions = new Map<string, PromptDefinition>();
  register(
    name: string,
    version: number,
    template: string,
    schemaVersion: string
  ): PromptDefinition {
    const definition = {
      name,
      version,
      template,
      schemaVersion,
      contentHash: createHash("sha256").update(template).digest("hex")
    };
    this.definitions.set(`${name}@${version}`, definition);
    return definition;
  }
  resolve(name: string, version: number): PromptDefinition {
    const value = this.definitions.get(`${name}@${version}`);
    if (!value) throw new Error("Prompt version not found");
    return value;
  }
}

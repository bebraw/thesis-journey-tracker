import type { R2ListOptions, R2ListResult, R2PutOptions } from "../../src/backup";

interface StoredObject {
  key: string;
  value: string;
  options?: R2PutOptions;
}

export class MockR2Bucket {
  public objects: StoredObject[] = [];

  async put(key: string, value: string, options?: R2PutOptions): Promise<void> {
    const existingIndex = this.objects.findIndex((object) => object.key === key);
    const storedObject = { key, value, options };
    if (existingIndex >= 0) {
      this.objects[existingIndex] = storedObject;
      return;
    }

    this.objects.push(storedObject);
  }

  async get(key: string): Promise<{ text(): Promise<string> } | null> {
    const object = this.objects.find((candidate) => candidate.key === key);
    if (!object) {
      return null;
    }

    return {
      async text(): Promise<string> {
        return object.value;
      },
    };
  }

  async list(options: R2ListOptions = {}): Promise<R2ListResult> {
    const prefix = options.prefix || "";
    const matchingObjects = this.objects
      .filter((object) => object.key.startsWith(prefix))
      .sort((left, right) => left.key.localeCompare(right.key));

    const startIndex = options.cursor ? Number(options.cursor) || 0 : 0;
    const limit = options.limit ?? (matchingObjects.length || 1000);
    const objects = matchingObjects.slice(startIndex, startIndex + limit).map(({ key }) => ({ key }));
    const nextIndex = startIndex + objects.length;
    const truncated = nextIndex < matchingObjects.length;

    return {
      objects,
      truncated,
      cursor: truncated ? String(nextIndex) : undefined,
    };
  }
}

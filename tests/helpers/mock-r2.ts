import type { R2PutOptions } from "../../src/backup";

interface StoredObject {
  key: string;
  value: string;
  options?: R2PutOptions;
}

export class MockR2Bucket {
  public objects: StoredObject[] = [];

  async put(key: string, value: string, options?: R2PutOptions): Promise<void> {
    this.objects.push({ key, value, options });
  }
}

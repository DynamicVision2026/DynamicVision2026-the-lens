import type { Grade } from "../curriculum";
import type { PageResult } from "./schema";

export interface Reader {
  readonly name: string;
  read(image: Uint8Array, mime: string, grade: Grade): Promise<PageResult>;
}

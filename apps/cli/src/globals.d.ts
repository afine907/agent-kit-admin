/**
 * Global type declarations for Node.js 18+ environment
 * FormData, Blob are available globally but TypeScript doesn't know
 * about them when "DOM" lib is not included in tsconfig.
 */

declare var FormData: {
  new (form?: HTMLFormElement): FormData;
  prototype: FormData;
};

declare var Blob: {
  new (blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
  prototype: Blob;
};

interface BlobPropertyBag {
  type?: string;
  endings?: "transparent" | "native";
}

type BlobPart = BufferSource | Blob | string;

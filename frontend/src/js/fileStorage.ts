import type { RecipePictures } from "@/types/recipe";

/**
 * Structure for storing File objects in IndexedDB
 */
interface SerializedFile {
  name: string;
  blob: Blob;
  type: string;
}

interface SerializedRecipePictures {
  [recipe_uuid: string]: SerializedFile[];
}

/**
 * Convert RecipePictures (File[]) to a serializable format for IndexedDB
 */
export async function serializeRecipePictures(
  pictures: RecipePictures,
): Promise<SerializedRecipePictures> {
  const serialized: SerializedRecipePictures = {};

  for (const [uuid, files] of Object.entries(pictures)) {
    if (files && files.length > 0) {
      serialized[uuid] = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          blob: new Blob([await file.arrayBuffer()], { type: file.type }),
          type: file.type,
        })),
      );
    } else {
      serialized[uuid] = [];
    }
  }

  return serialized;
}

/**
 * Convert serialized format back to RecipePictures (File[])
 */
export function deserializeRecipePictures(
  serialized: SerializedRecipePictures,
): RecipePictures {
  const pictures: RecipePictures = {};

  for (const [uuid, serializedFiles] of Object.entries(serialized)) {
    if (serializedFiles && serializedFiles.length > 0) {
      pictures[uuid] = serializedFiles.map(
        (sf) => new File([sf.blob], sf.name, { type: sf.type }),
      );
    } else {
      pictures[uuid] = [];
    }
  }

  return pictures;
}

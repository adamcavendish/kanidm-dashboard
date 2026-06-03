import { kanidmImageValidation } from "../domain";

export async function validateKanidmImageFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!kanidmImageValidation.formats.includes(extension)) {
    return "Image must be png, jpg, gif, svg, or webp.";
  }

  if (file.size > kanidmImageValidation.maxBytes) {
    return "Image must be less than 256 KB.";
  }

  if (extension === "svg") {
    return null;
  }

  const pixels = await imagePixelCount(file);
  if (pixels > kanidmImageValidation.maxPixels) {
    return "Image dimensions must be no more than 1 megapixel.";
  }

  return null;
}

export function imagePixelCount(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.naturalWidth * image.naturalHeight);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions."));
    };
    image.src = url;
  });
}

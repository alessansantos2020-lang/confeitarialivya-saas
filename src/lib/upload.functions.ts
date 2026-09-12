import { supabase } from "@/integrations/supabase/client";
export const uploadFile = async (
  file: File,
  folder: "store" | "products" | "categories",
  storeId: string,
  maxSizeMB: number = 5,
) => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Por favor, selecione uma imagem válida.");
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`A imagem deve ter no máximo ${maxSizeMB}MB.`);
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase();
  if (!fileExt || !/^[a-z0-9]+$/.test(fileExt)) {
    throw new Error("Extensão de imagem inválida.");
  }
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${storeId}/${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage.from("public").upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadError) {
    console.error("Upload error details:", uploadError);
    if (uploadError.message?.includes("Bucket not found")) {
      throw new Error("Erro: O bucket 'public' não foi encontrado.");
    }
    throw uploadError;
  }

  const { data } = supabase.storage.from("public").getPublicUrl(filePath);

  return data.publicUrl;
};

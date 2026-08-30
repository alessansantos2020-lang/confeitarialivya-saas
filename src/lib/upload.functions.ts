import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const uploadFile = async (
  file: File,
  folder: 'store' | 'products' | 'categories',
  maxSizeMB: number = 5
) => {
  if (!file.type.startsWith('image/')) {
    throw new Error("Por favor, selecione uma imagem válida.");
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`A imagem deve ter no máximo ${maxSizeMB}MB.`);
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('public')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    console.error("Upload error details:", uploadError);
    if (uploadError.message?.includes("Bucket not found")) {
      throw new Error("Erro: O bucket 'public' não foi encontrado.");
    }
    throw uploadError;
  }

  // Since the bucket is private due to workspace policies, we must use signed URLs
  const { data, error: urlError } = await supabase.storage
    .from('public')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10); // 10 years expiration

  if (urlError) {
    console.error("Error creating signed URL:", urlError);
    // Fallback to public URL
    const { data: publicData } = supabase.storage
      .from('public')
      .getPublicUrl(filePath);
    return publicData.publicUrl;
  }

  // Double check signed URL format
  if (!data.signedUrl) {
    const { data: publicData } = supabase.storage
      .from('public')
      .getPublicUrl(filePath);
    return publicData.publicUrl;
  }

  return data.signedUrl;
};

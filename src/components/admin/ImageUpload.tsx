import React, { useState } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadFile } from "@/lib/upload.functions";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string | null | undefined;
  onChange: (url: string | null) => void;
  folder: "store" | "products" | "categories";
  storeId: string;
  maxSizeMB?: number;
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  folder,
  storeId,
  maxSizeMB,
  className,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const loadingToast = toast.loading("Fazendo upload...");

    try {
      const url = await uploadFile(file, folder, storeId, maxSizeMB);
      onChange(url);
      toast.success("Imagem enviada!", { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message || "Erro no upload", { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {value ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border bg-slate-50 flex items-center justify-center">
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error("Image failed to load:", value);
              (e.target as HTMLImageElement).src =
                "https://placehold.co/600x400?text=Erro+ao+Carregar+Imagem";
            }}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 rounded-full"
            onClick={() => onChange(null)}
          >
            <X size={14} />
          </Button>
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${isUploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {isUploading ? (
              <Loader2 className="w-8 h-8 mb-3 animate-spin text-pink-600" />
            ) : (
              <Upload className="w-8 h-8 mb-3 text-slate-400" />
            )}
            <p className="mb-2 text-sm text-slate-500">
              <span className="font-semibold">Clique para upload</span> ou arraste
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            disabled={isUploading}
            onChange={handleUpload}
          />
        </label>
      )}
    </div>
  );
}

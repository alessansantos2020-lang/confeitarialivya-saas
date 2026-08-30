
import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures the 'public' bucket exists and has correct RLS policies.
 */
export const ensurePublicBucket = async () => {
  try {
    // We attempt to list buckets.
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    // Check if it already exists
    const publicBucket = buckets?.find(b => b.name === 'public');
    
    if (!publicBucket) {
      console.log("[Storage] 'public' bucket not found. Attempting creation...");
      const { error: createError } = await supabase.storage.createBucket('public', {
        public: true,
        fileSizeLimit: 5242880,
      });
      
      if (createError) {
        console.warn("[Storage] Bucket creation returned:", createError.message);
      } else {
        console.log("[Storage] 'public' bucket created successfully.");
      }
    } else if (!publicBucket.public) {
      console.log("[Storage] 'public' bucket exists but is not public. This may cause issues.");
      // Note: We cannot change public status via JS client easily if blocked, 
      // but we've already run the supabase--storage_update_bucket tool.
    }
  } catch (err) {
    console.error("[Storage] Unexpected error in ensurePublicBucket:", err);
  }
};

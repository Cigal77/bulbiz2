import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const token = formData.get("token") as string;
    const file = formData.get("file") as File;

    if (!token || !file) {
      return new Response(
        JSON.stringify({ error: `Token et fichier requis (token: ${!!token}, file: ${!!file})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Fichier trop volumineux (max 20 MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
      "video/mp4", "video/quicktime", "video/webm", "video/3gpp",
      "audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/aac",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: `Type de fichier non autorisé : ${file.type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token
    const { data: dossier, error: dossierError } = await supabase
      .from("dossiers")
      .select("id, user_id, client_token_expires_at")
      .eq("client_token", token)
      .single();

    if (dossierError || !dossier) {
      return new Response(
        JSON.stringify({ error: "Lien invalide ou expiré" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dossier.client_token_expires_at && new Date(dossier.client_token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Ce lien a expiré" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload file using service role (bypasses storage RLS)
    const ext = file.name.split(".").pop();
    const filePath = `${dossier.user_id}/${dossier.id}/client_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("dossier-medias")
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    // Return storage path (bucket is private, signed URLs generated on read)
    return new Response(
      JSON.stringify({
        url: filePath,
        name: file.name,
        type: file.type,
        size: file.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("upload-client-media error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur lors de l'upload" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

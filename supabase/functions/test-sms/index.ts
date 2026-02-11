const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !fromPhone) {
      return new Response(JSON.stringify({ 
        error: "Twilio not configured",
        has_sid: !!accountSid,
        has_token: !!authToken,
        has_phone: !!fromPhone,
      }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const { to, message } = await req.json();
    if (!to || !message) {
      return new Response(JSON.stringify({ error: "Missing 'to' or 'message'" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Normalize phone
    let cleaned = to.replace(/[\s\-().]/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 10) cleaned = "+33" + cleaned.slice(1);
    if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
      },
      body: new URLSearchParams({ To: cleaned, From: fromPhone, Body: message }),
    });

    const result = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        status: resp.status, 
        twilio_error: result 
      }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sid: result.sid,
      to: cleaned,
      status: result.status,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNotification, type VapidDetails } from "https://deno.land/x/web_push@0.2.1/mod.ts";

// Configuration pour web-push
const vapidKeys = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
};

// Initialisation du client Supabase avec les droits d'administration
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const notificationPayload = await req.json();
    const { record } = notificationPayload;
    const userId = record.user_id;
    const title = record.title;
    const message = record.message;
    const url = record.url || "/";

    if (!userId || !title || !message) {
      return new Response("Missing required fields in notification record", { status: 400 });
    }

    const { data: subscriptionData, error: subscriptionError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId)
      .single();

    if (subscriptionError || !subscriptionData) {
      console.error(`No push subscription found for user ${userId}`, subscriptionError);
      return new Response(`Subscription not found for user ${userId}`, { status: 404 });
    }

    const subscription = subscriptionData.subscription;

    const payload = JSON.stringify({
      title,
      body: message,
      icon: "/images/icon-192x192.png",
      badge: "/images/icon-192x192.png",
      data: { url },
    });

    const vapidDetails: VapidDetails = {
      subject: "mailto:your-email@example.com",
      ...vapidKeys,
    };

    await sendNotification(subscription, payload, {
      vapidDetails: vapidDetails,
    });

    console.log(`Push notification sent successfully to user ${userId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(`Webhook error: ${error.message}`, { status: 500 });
  }
});
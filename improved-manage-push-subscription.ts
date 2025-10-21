import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("manage-push-subscription function - Multi-browser support");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, DELETE, GET, OPTIONS',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    if (req.method === 'POST') {
      // Subscribe user to push notifications (multi-browser support)
      const { userId, subscription, browserInfo } = await req.json();
      
      console.log('Received subscription request:', {
        userId: userId,
        endpoint: subscription?.endpoint?.substring(0, 50) + '...',
        browserInfo: browserInfo
      });

      // Validation
      if (!userId || !subscription?.endpoint || !subscription?.keys) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: userId, subscription.endpoint, subscription.keys'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Vérifier si cet endpoint existe déjà
      const { data: existingSubscription } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('subscription->>endpoint', subscription.endpoint)
        .single();

      if (existingSubscription) {
        // Mettre à jour l'abonnement existant (même navigateur)
        const { data, error } = await supabase
          .from('push_subscriptions')
          .update({
            user_id: userId,
            subscription: subscription,
            browser_info: browserInfo,
            last_used: new Date().toISOString()
          })
          .eq('id', existingSubscription.id);

        if (error) {
          console.error('Update error:', error);
          return new Response(JSON.stringify({
            error: 'Failed to update subscription',
            details: error.message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        console.log(`Updated existing subscription for user ${userId}`);
      } else {
        // Créer un nouvel abonnement (nouveau navigateur)
        const { data, error } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: userId,
            subscription: subscription,
            browser_info: browserInfo,
            last_used: new Date().toISOString()
          });

        if (error) {
          console.error('Insert error:', error);
          return new Response(JSON.stringify({
            error: 'Failed to create subscription',
            details: error.message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        console.log(`Created new subscription for user ${userId}`);
      }

      // Nettoyer les anciens abonnements (optionnel)
      await cleanupOldSubscriptions(supabase, userId);

      return new Response(JSON.stringify({
        success: true,
        message: 'Subscription saved successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } else if (req.method === 'DELETE') {
      // Unsubscribe specific browser or all browsers
      const { userId, endpoint, deleteAll } = await req.json();
      
      console.log('Received unsubscribe request:', { userId, endpoint, deleteAll });

      if (!userId) {
        return new Response(JSON.stringify({
          error: 'Missing userId'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      let query = supabase.from('push_subscriptions').delete().eq('user_id', userId);

      if (!deleteAll && endpoint) {
        // Supprimer seulement l'abonnement de ce navigateur
        query = query.eq('subscription->>endpoint', endpoint);
        console.log(`Deleting subscription for specific browser: ${endpoint.substring(0, 50)}...`);
      } else {
        // Supprimer tous les abonnements de l'utilisateur
        console.log(`Deleting all subscriptions for user: ${userId}`);
      }

      const { error } = await query;

      if (error) {
        console.error('Delete error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to remove subscription',
          details: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: deleteAll ? 'All subscriptions removed' : 'Subscription removed'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } else if (req.method === 'GET') {
      // Get all subscriptions for a user
      const url = new URL(req.url);
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        return new Response(JSON.stringify({
          error: 'Missing userId parameter'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('last_used', { ascending: false });

      if (error) {
        console.error('Select error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to retrieve subscriptions',
          details: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        subscriptions: subscriptions,
        count: subscriptions.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
});

// Fonction utilitaire pour nettoyer les anciens abonnements
async function cleanupOldSubscriptions(supabase: any, userId: string) {
  try {
    // Supprimer les abonnements plus anciens que 90 jours
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .lt('last_used', ninetyDaysAgo.toISOString());

    if (error) {
      console.warn('Cleanup error:', error);
    } else {
      console.log(`Cleaned up old subscriptions for user ${userId}`);
    }
  } catch (error) {
    console.warn('Cleanup failed:', error);
  }
}
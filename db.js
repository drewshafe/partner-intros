// Database Layer - Supabase Client
// Pattern matches tradeshow-tracker/db.js

(function() {
  'use strict';

  const SUPABASE_URL = CONFIG.supabaseUrl;
  const SUPABASE_ANON_KEY = CONFIG.supabaseAnonKey;
  
  // Initialize Supabase client (scoped inside IIFE)
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Expose DB operations globally
  window.DB = {
    
    // ============ MERCHANTS ============
    
    // Get all merchants by source tab
    getMerchants: async (sourceTab) => {
      try {
        const { data, error } = await sb
          .from('merchants')
          .select('*')
          .eq('source_tab', sourceTab)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching merchants:', err);
        return [];
      }
    },

    // Search merchants (like tracker's company search)
    searchMerchants: async (query, sourceTab) => {
      try {
        const { data, error } = await sb
          .from('merchants')
          .select('*')
          .eq('source_tab', sourceTab)
          .or(`name.ilike.%${query}%,contact_name.ilike.%${query}%,contact_email.ilike.%${query}%`)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error searching merchants:', err);
        return [];
      }
    },

    // Add merchant
    addMerchant: async (merchant) => {
      try {
        const { data, error } = await sb
          .from('merchants')
          .insert([merchant])
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error adding merchant:', err);
        throw err;
      }
    },

    // Update merchant
    updateMerchant: async (id, updates) => {
      try {
        const { data, error } = await sb
          .from('merchants')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error updating merchant:', err);
        throw err;
      }
    },

    // Delete merchant
    deleteMerchant: async (id) => {
      try {
        const { error } = await sb
          .from('merchants')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return true;
      } catch (err) {
        console.error('Error deleting merchant:', err);
        throw err;
      }
    },

    // Clear all merchants and activity logs for a specific tab
    clearTabData: async (tabName) => {
      try {
        // Step 1: Get all merchant IDs for this tab
        const { data: merchants, error: fetchError } = await sb
          .from('merchants')
          .select('id')
          .eq('source_tab', tabName);
        
        if (fetchError) throw fetchError;
        
        const merchantIds = merchants.map(m => m.id);
        
        if (merchantIds.length === 0) {
          return { deleted: 0 };
        }
        
        // Step 2: Delete activity logs
        const { error: logError } = await sb
          .from('activity_log')
          .delete()
          .in('merchant_id', merchantIds);
        
        if (logError) throw logError;
        
        // Step 3: Delete webhook logs
        const { error: webhookError } = await sb
          .from('webhook_log')
          .delete()
          .in('merchant_id', merchantIds);
        
        if (webhookError) throw webhookError;
        
        // Step 4: Delete merchants
        const { error: merchantError } = await sb
          .from('merchants')
          .delete()
          .eq('source_tab', tabName);
        
        if (merchantError) throw merchantError;
        
        return { deleted: merchants.length };
      } catch (err) {
        console.error('Error clearing tab data:', err);
        throw err;
      }
    },

    // Bulk upsert merchants (for CSV import)
    bulkUpsertMerchants: async (merchants) => {
      try {
        const { data, error } = await sb
          .from('merchants')
          .upsert(merchants, { onConflict: 'hubspot_id', ignoreDuplicates: false })
          .select();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error bulk upserting merchants:', err);
        throw err;
      }
    },

    // Get dashboard stats
    getStats: async (sourceTab) => {
      try {
        const { data, error } = await sb
          .from('dashboard_stats')
          .select('*')
          .eq('source_tab', sourceTab)
          .single();
        
        if (error) throw error;
        return data || { total: 0, approved: 0, asked: 0, yes_received: 0, emailed: 0 };
      } catch (err) {
        console.error('Error fetching stats:', err);
        return { total: 0, approved: 0, asked: 0, yes_received: 0, emailed: 0 };
      }
    },

    // ============ EMAIL TEMPLATES ============
    
    // Get template
    getTemplate: async (templateType) => {
      try {
        const { data, error } = await sb
          .from('email_templates')
          .select('*')
          .eq('template_type', templateType)
          .single();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error fetching template:', err);
        return null;
      }
    },

    // Update template
    updateTemplate: async (templateType, updates) => {
      try {
        const { data, error } = await sb
          .from('email_templates')
          .update(updates)
          .eq('template_type', templateType)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error updating template:', err);
        throw err;
      }
    },

    // ============ PARTNER CONFIG ============
    
    // Get partner config
    getPartnerConfig: async (partnerSlug) => {
      try {
        const { data, error } = await sb
          .from('partner_config')
          .select('*')
          .eq('partner_slug', partnerSlug)
          .single();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error fetching partner config:', err);
        return null;
      }
    },

    // Update partner config
    updatePartnerConfig: async (partnerSlug, updates) => {
      try {
        const { data, error } = await sb
          .from('partner_config')
          .upsert(
            { partner_slug: partnerSlug, ...updates },
            { onConflict: 'partner_slug' }
          )
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error updating partner config:', err);
        throw err;
      }
    },

    // ============ ACTIVITY LOG ============
    
    // Get recent activity
    getRecentActivity: async (limit = 50) => {
      try {
        const { data, error } = await sb
          .from('recent_activity')
          .select('*')
          .limit(limit);
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching activity:', err);
        return [];
      }
    },

    // ============ REAL-TIME SUBSCRIPTIONS ============
    
    // Subscribe to merchant changes (like tracker's booth updates)
    subscribeMerchants: (sourceTab, callback) => {
      const channel = sb
        .channel(`merchants:${sourceTab}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'merchants',
            filter: `source_tab=eq.${sourceTab}`
          },
          (payload) => {
            console.log('Merchant change detected:', payload);
            callback(payload);
          }
        )
        .subscribe();

      return channel;
    },

    // Unsubscribe from channel
    unsubscribe: (channel) => {
      if (channel) {
        sb.removeChannel(channel);
      }
    },

    // ============ WEBHOOK LOG ============
    
    // Get webhook logs (for debugging)
    getWebhookLogs: async (limit = 100) => {
      try {
        const { data, error } = await sb
          .from('webhook_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error('Error fetching webhook logs:', err);
        return [];
      }
    }
  };

  console.log('Database layer initialized');
})();

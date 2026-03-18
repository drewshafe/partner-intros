// Database layer - Supabase client and all DB operations
// Partner Intros - follows tradeshow-tracker patterns

const DB = (function() {
  'use strict';

  // Supabase client
  const supabaseUrl = 'https://yquqoutrnqtietntxhan.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxdXFvdXRybnF0aWV0bnR4aGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjg1NDEsImV4cCI6MjA4ODg0NDU0MX0.qMKkxYtrOHQt7Wr2Iq2NYdxP0cuQNGabcoq3RPrtWyM';
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  // Get partner configuration
  async function getPartnerConfig(slug) {
    const { data, error } = await supabase
      .from('partner_config')
      .select('*')
      .eq('partner_slug', slug)
      .single();
    
    if (error) {
      console.error('Error fetching partner config:', error);
      return null;
    }
    return data;
  }

  // Get all partner configs (for admin partner selector)
  async function getAllPartnerConfigs() {
    const { data, error } = await supabase
      .from('partner_config')
      .select('*')
      .order('partner_name');
    
    if (error) throw error;
    return data || [];
  }

  // Update partner configuration
  async function updatePartnerConfig(slug, updates) {
    const { data, error } = await supabase
      .from('partner_config')
      .update(updates)
      .eq('partner_slug', slug);
    
    if (error) throw error;
    return data;
  }

  // Get email template
  async function getTemplate(tab) {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('tab', tab)
      .single();
    
    if (error) {
      console.error('Error fetching template:', error);
      return { subject: '', body: '' };
    }
    return data;
  }

  // Update email template
  async function updateTemplate(tab, updates) {
    const { data, error } = await supabase
      .from('email_templates')
      .upsert({ tab, ...updates }, { onConflict: 'tab' });
    
    if (error) throw error;
    return data;
  }

  // Get merchants for a specific tab
  async function getMerchants(tab) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('source_tab', tab)
      .order('name');
    
    if (error) {
      console.error('Error fetching merchants:', error);
      return [];
    }
    return data || [];
  }

  // Check if partner approved a merchant
  async function isApprovedByPartner(merchantId, partnerSlug) {
    const { data, error } = await supabase
      .from('partner_approvals')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('partner_slug', partnerSlug)
      .single();
    
    if (error) return false;
    return !!data;
  }

  // Get all approvals for a partner
  async function getPartnerApprovals(partnerSlug) {
    const { data, error } = await supabase
      .from('partner_approvals')
      .select('merchant_id')
      .eq('partner_slug', partnerSlug);
    
    if (error) return [];
    return data.map(a => a.merchant_id);
  }

  // Add partner approval
  async function addPartnerApproval(merchantId, partnerSlug) {
    const { data, error } = await supabase
      .from('partner_approvals')
      .insert([{ merchant_id: merchantId, partner_slug: partnerSlug }]);
    
    if (error) throw error;
    return data;
  }

  // Add merchant
  async function addMerchant(merchant) {
    const { data, error } = await supabase
      .from('merchants')
      .insert([merchant])
      .select();
    
    if (error) throw error;
    return data;
  }

  // Update merchant
  async function updateMerchant(id, updates) {
    const { data, error } = await supabase
      .from('merchants')
      .update(updates)
      .eq('id', id);
    
    if (error) throw error;
    return data;
  }

  // Delete merchant
  async function deleteMerchant(id) {
    const { error } = await supabase
      .from('merchants')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  // Bulk upsert merchants (for CSV import)
  async function bulkUpsertMerchants(merchants) {
    const { data, error } = await supabase
      .from('merchants')
      .upsert(merchants, { 
        onConflict: 'name,contact_email',
        ignoreDuplicates: false 
      });
    
    if (error) throw error;
    return data;
  }

  // Get stats for a tab
  async function getStats(tab) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('source_tab', tab);
    
    if (error) {
      console.error('Error fetching stats:', error);
      return { total: 0, approved: 0, asked: 0, yes_received: 0, emailed: 0 };
    }
    
    const merchants = data || [];
    return {
      total: merchants.length,
      approved: merchants.filter(m => m.approved).length,
      asked: merchants.filter(m => m.asked_date).length,
      yes_received: merchants.filter(m => m.merchant_yes).length,
      emailed: merchants.filter(m => m.emailed_date).length
    };
  }

  // Clear all data for a tab
  async function clearTabData(tab) {
    // Delete merchants for this tab
    const { error } = await supabase
      .from('merchants')
      .delete()
      .eq('source_tab', tab);
    
    if (error) throw error;
    
    // Return count (we don't have it, so just return success)
    return { deleted: 1 };
  }

  // Subscribe to merchant changes
  function subscribeMerchants(tab, callback) {
    const channel = supabase
      .channel(`merchants-${tab}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchants',
          filter: `source_tab=eq.${tab}`
        },
        callback
      )
      .subscribe();
    
    return channel;
  }

  // Unsubscribe from channel
  function unsubscribe(channel) {
    if (channel) {
      supabase.removeChannel(channel);
    }
  }

  // Public API
  return {
    getPartnerConfig,
    getAllPartnerConfigs,
    updatePartnerConfig,
    getTemplate,
    updateTemplate,
    getMerchants,
    isApprovedByPartner,
    getPartnerApprovals,
    addPartnerApproval,
    addMerchant,
    updateMerchant,
    deleteMerchant,
    bulkUpsertMerchants,
    getStats,
    clearTabData,
    subscribeMerchants,
    unsubscribe
  };
})();

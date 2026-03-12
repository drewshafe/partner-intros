// Supabase Configuration
const CONFIG = {
  supabaseUrl: 'https://yquqoutrnqtietntxhan.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxdXFvdXRybnF0aWV0bnR4aGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjg1NDEsImV4cCI6MjA4ODg0NDU0MX0.qMKkxYtrOHQt7Wr2Iq2NYdxP0cuQNGabcoq3RPrtWyM',
  webhookUrl: 'https://yquqoutrnqtietntxhan.supabase.co/functions/v1/hubspot-webhook'
};

window.CONFIG = CONFIG;
// Supabase Configuration
const CONFIG = {
  supabaseUrl: 'https://yquqoutrnqtietntxhan.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxdXFvdXRybnF0aWV0bnR4aGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjg1NDEsImV4cCI6MjA4ODg0NDU0MX0.qMKkxYtrOHQt7Wr2Iq2NYdxP0cuQNGabcoq3RPrtWyM',
  webhookUrl: 'https://yquqoutrnqtietntxhan.supabase.co/functions/v1/hubspot-webhook'
};

window.CONFIG = CONFIG;// Supabase Configuration
const SUPABASE_URL = 'https://qnscnhccaedrwwmjxhuc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uKmMzyUx5EkAs8GmETBTgw_e2WsKTNn';

// Status Options
const STATUS = {
  NOT_VISITED: 'not_visited',
  COME_BACK: 'come_back',
  FOLLOW_UP_WARM: 'follow_up_warm',
  FOLLOW_UP_COLD: 'follow_up_cold',
  DEMO_BOOKED: 'demo_booked',
  NOT_INTERESTED: 'not_interested',
  DQ: 'dq',
  NOT_AT_SHOW: 'not_at_show'
};

const STATUS_LABELS = {
  [STATUS.NOT_VISITED]: 'Not Visited',
  [STATUS.COME_BACK]: 'Come Back',
  [STATUS.FOLLOW_UP_WARM]: 'Warm Follow Up',
  [STATUS.FOLLOW_UP_COLD]: 'Cold Follow Up',
  [STATUS.DEMO_BOOKED]: 'Demo Booked',
  [STATUS.NOT_INTERESTED]: 'Not Interested',
  [STATUS.DQ]: 'DQ',
  [STATUS.NOT_AT_SHOW]: 'Not at Show'
};

// Status sort priority (lower = higher priority)
const STATUS_PRIORITY = {
  [STATUS.COME_BACK]: 1,
  [STATUS.NOT_VISITED]: 2,
  [STATUS.FOLLOW_UP_WARM]: 3,
  [STATUS.FOLLOW_UP_COLD]: 4,
  [STATUS.DEMO_BOOKED]: 5,
  [STATUS.NOT_INTERESTED]: 6,
  [STATUS.DQ]: 7,
  [STATUS.NOT_AT_SHOW]: 8
};

// Form Options
const ORDER_OPTIONS = ['N/A', '0 - 500', '500 - 1,000', '1,000 - 10,000', '10,000+'];
const AOV_OPTIONS = ['N/A', '< $100', '$100 - $200', '$200 - $300', '$300 - $400', '$400 - $500', '$500+'];
const REVENUE_THRESHOLDS = [0, 50000, 100000, 200000, 300000, 500000, 1000000];

// Platform Options
const PLATFORMS = [
  'BigCommerce',
  'CommerceTools',
  'Custom Cart',
  'Magento (Adobe Commerce)',
  'NetSuite SuiteCommerce',
  'Salesforce Commerce Cloud',
  'SAP Hybris',
  'Shopify',
  'Shopify Headless',
  'Shopify Plus',
  'Shopware',
  'VTEX',
  'WooCommerce',
  '[No Platform]'
];

// Protection Options
const PROTECTION_PROVIDERS = [
  'Bolt Protect',
  'Corso',
  'Cover Genius',
  'Clyde',
  'DIY',
  'Extend',
  'Navidium',
  'Onward',
  'OrderProtection',
  'Protecht',
  'Redo',
  'Route',
  'SavedBy',
  'Seel',
  'SipTection',
  'Swap',
  'XCover',
  '[No Protection]'
];

// Returns Options
const RETURNS_PROVIDERS = [
  'AfterShip',
  'Clicksit',
  'Corso',
  'Frate (Route)',
  'Happy Returns',
  'In-House',
  'Loop',
  'Narvar',
  'Optoro',
  'ParcelLab',
  'Redo',
  'ReturnLogic',
  'ReturnsGo',
  'ReverseLogix',
  'Reversely',
  'Rich Returns',
  'Sorted',
  'Swap',
  'ZigZag Global',
  '[No Returns]'
];

// Default Shows (reps array defines who is attending each show)
const DEFAULT_SHOWS = [
  { id: 'whce2026', name: 'Western Hunting Expo', location: 'SLC', startDate: '2026-02-12', endDate: '2026-02-15', website: 'https://huntexpo.com/', exhibitorList: 'https://whce2026.smallworldlabs.com/exhibitors', reps: ['drew', 'jason', 'wyatt'], alignedRoomUrl: '' },
  { id: 'expowest2026', name: 'Expo West', location: 'Anaheim', startDate: '2026-03-03', endDate: '2026-03-06', website: 'https://www.expowest.com/en/home.html', exhibitorList: 'https://www.expowest.com/en/exhibitor-list/2026-exhibitor-list.html', reps: ['drew', 'jason', 'wyatt'], alignedRoomUrl: '' },
  { id: 'bewell2026', name: 'Be Well', location: 'NY', startDate: '2026-03-08', endDate: '2026-03-10', website: 'https://www.bewellshownewyork.com/', exhibitorList: 'https://iecscibsny2026.smallworldlabs.com/exhibitors', reps: ['drew', 'jason', 'wyatt', 'david'], alignedRoomUrl: '' },
  { id: 'asd2026', name: 'ASD', location: 'Las Vegas', startDate: '2026-03-17', endDate: '2026-03-19', website: 'https://asdonline.com/', exhibitorList: 'https://march2026.smallworldlabs.com/exhibitors', reps: ['drew', 'jason', 'wyatt', 'david'], alignedRoomUrl: '' },
  { id: 'globalpet2026', name: 'Global Pet Expo', location: 'Orlando', startDate: '2026-03-25', endDate: '2026-03-27', website: 'https://globalpetexpo.org/', exhibitorList: 'https://globalpetexpo26.mapyourshow.com/8_0/explore/exhibitor-gallery.cfm', reps: ['drew', 'jason', 'wyatt', 'david'], alignedRoomUrl: '' },
  { id: 'tpe2026', name: 'TPE', location: 'Las Vegas', startDate: '2026-03-31', endDate: '2026-04-01', website: 'https://totalproductexpo.com/', exhibitorList: 'https://tpe2026.smallworldlabs.com/exhibitors', reps: ['drew', 'jason', 'wyatt', 'david'], alignedRoomUrl: '' }
];

// Default Reps
const DEFAULT_REPS = [
  { id: 'drew', name: 'Drew', hubspotId: '769264684' },
  { id: 'jason', name: 'Jason', hubspotId: '466111025' },
  { id: 'wyatt', name: 'Wyatt', hubspotId: '440420991' },
  { id: 'david', name: 'David', hubspotId: '415804257' }
];

// HubSpot Owner ID Mapping
const HUBSPOT_OWNERS = {
  '769264684': { repId: 'drew', name: 'Drew Shafer', isTradeShowRep: true },
  '466111025': { repId: 'jason', name: 'Jason Kizerian', isTradeShowRep: true },
  '440420991': { repId: 'wyatt', name: 'Wyatt Branch', isTradeShowRep: true },
  '415804257': { repId: 'david', name: 'David Dustin', isTradeShowRep: true },
  '47558866': { repId: null, name: 'Marina H', isTradeShowRep: false },
  '79525794': { repId: null, name: 'Morgan Hirschi', isTradeShowRep: false },
  '82567118': { repId: null, name: 'David Puche', isTradeShowRep: false },
  '84255609': { repId: null, name: 'Jhofre Marquez', isTradeShowRep: false },
  '87648047': { repId: null, name: 'Lexi Kilgannon', isTradeShowRep: false },
  '88065988': { repId: null, name: 'Clara Hayes', isTradeShowRep: false },
  '213567081': { repId: null, name: 'Ship Insure', isTradeShowRep: false },
  '213597303': { repId: null, name: 'Mosie Matalon', isTradeShowRep: false },
  '226275085': { repId: null, name: 'Merchant Support', isTradeShowRep: false },
  '231531570': { repId: null, name: 'Ezra Shabot', isTradeShowRep: false },
  '444928300': { repId: null, name: 'Mark Curtis', isTradeShowRep: false },
  '482560570': { repId: null, name: 'Lauren Hong', isTradeShowRep: false },
  '489743668': { repId: null, name: 'Noah Bump', isTradeShowRep: false },
  '520676645': { repId: null, name: 'Rambo Ruiz', isTradeShowRep: false },
  '552815775': { repId: null, name: 'Nate Kane', isTradeShowRep: false },
  '1305231186': { repId: null, name: 'Corbin Ekblad', isTradeShowRep: false },
  '1342408095': { repId: null, name: 'Addison Lynch', isTradeShowRep: false },
  '1419091023': { repId: null, name: 'Dane Baker', isTradeShowRep: false },
  '1844165169': { repId: null, name: 'Peter Twomey', isTradeShowRep: false },
  '2039488175': { repId: null, name: 'Riley Sorenson', isTradeShowRep: false }
};

// List Types
const LIST_TYPES = {
  HIT_LIST: 'hit_list',
  MASTER: 'master',
  CUSTOMERS: 'customers',
  WORKING: 'working',
  OPPS: 'opps',
  INACTIVE_CUSTOMERS: 'inactive_customers',
  PEOPLE: 'people'
};

const LIST_LABELS = {
  [LIST_TYPES.HIT_LIST]: 'Hit List',
  [LIST_TYPES.MASTER]: 'Master',
  [LIST_TYPES.CUSTOMERS]: 'Customers',
  [LIST_TYPES.WORKING]: 'Working',
  [LIST_TYPES.OPPS]: 'Opps',
  [LIST_TYPES.INACTIVE_CUSTOMERS]: 'Inactive Customers',
  [LIST_TYPES.PEOPLE]: 'People'
};

// List configurations
const LIST_CONFIG = {
  [LIST_TYPES.HIT_LIST]: { hasDetail: true, showRep: true, canClaim: false, isGrid: false },
  [LIST_TYPES.MASTER]: { hasDetail: false, showRep: true, canClaim: false, isGrid: true },
  [LIST_TYPES.CUSTOMERS]: { hasDetail: false, showRep: true, canClaim: false, isGrid: true },
  [LIST_TYPES.WORKING]: { hasDetail: false, showRep: true, canClaim: false, isGrid: true, tagInHitList: 'Working' },
  [LIST_TYPES.OPPS]: { hasDetail: false, showRep: true, canClaim: false, isGrid: true, tagInHitList: 'Opps' },
  [LIST_TYPES.INACTIVE_CUSTOMERS]: { hasDetail: true, showRep: true, canClaim: true, isGrid: false },
  [LIST_TYPES.PEOPLE]: { hasDetail: false, showRep: false, canClaim: false, isGrid: true }
};

// CSV field mappings per list type
const CSV_FIELDS = {
  [LIST_TYPES.MASTER]: [
    { key: 'recordId', label: 'Record ID', required: false },
    { key: 'companyName', label: 'Company Name', required: true },
    { key: 'domain', label: 'Company Domain Name', required: false },
    { key: 'boothNumber', label: 'Booth#', required: false },
    { key: 'estimatedMonthlySales', label: 'Estimated Monthly Sales', required: false },
    { key: 'platform', label: 'Ecommerce Platform', required: false },
    { key: 'competitorInstalls', label: 'Competitor Tracking - Installs', required: false },
    { key: 'competitorUninstalls', label: 'Competitor Tracking - Uninstalls', required: false },
    { key: 'techInstalls', label: 'Tech Tracking - Installs', required: false },
    { key: 'instagramFollowers', label: 'Instagram Followers', required: false },
    { key: 'facebookFollowers', label: 'Facebook Followers', required: false },
    { key: 'monthlyVisits', label: 'Estimated Monthly Visits', required: false }
  ],
  [LIST_TYPES.CUSTOMERS]: [
    { key: 'recordId', label: 'Record ID - Company', required: false },
    { key: 'companyName', label: 'Company Name', required: true },
    { key: 'domain', label: 'Company Domain Name', required: false },
    { key: 'boothNumber', label: 'Booth#', required: false },
    { key: 'estimatedMonthlySales', label: 'Estimated Monthly Sales', required: false },
    { key: 'platform', label: 'Ecommerce Platform', required: false },
    { key: 'ownerId', label: 'Company owner', required: false },
    { key: 'appInstalled', label: 'Which App Are They Installing On?', required: false },
    { key: 'productOffering', label: 'Product Offering', required: false },
    { key: 'associatedDeal', label: 'Associated Deal', required: false },
    { key: 'associatedDealIds', label: 'Associated Deal IDs', required: false },
    { key: 'dealRecordId', label: 'Record ID - Deal', required: false },
    { key: 'dealName', label: 'Deal Name', required: false }
  ],
  [LIST_TYPES.WORKING]: [
    { key: 'recordId', label: 'Record ID', required: false },
    { key: 'companyName', label: 'Company Name', required: true },
    { key: 'domain', label: 'Company Domain Name', required: false },
    { key: 'boothNumber', label: 'Booth#', required: false },
    { key: 'estimatedMonthlySales', label: 'Estimated Monthly Sales', required: false },
    { key: 'platform', label: 'Ecommerce Platform', required: false },
    { key: 'lastContacted', label: 'Last Contacted', required: false },
    { key: 'ownerId', label: 'Company owner', required: false },
    { key: 'campaign', label: 'Campaign', required: false }
  ],
  [LIST_TYPES.OPPS]: [
    { key: 'recordId', label: 'Record ID', required: false },
    { key: 'companyName', label: 'Company Name', required: true },
    { key: 'domain', label: 'Company Domain Name', required: false },
    { key: 'boothNumber', label: 'Booth#', required: false },
    { key: 'estimatedMonthlySales', label: 'Estimated Monthly Sales', required: false },
    { key: 'platform', label: 'Ecommerce Platform', required: false },
    { key: 'lastContacted', label: 'Last Contacted', required: false },
    { key: 'ownerId', label: 'Company owner', required: false }
  ],
  [LIST_TYPES.INACTIVE_CUSTOMERS]: [
    { key: 'recordId', label: 'Record ID', required: false },
    { key: 'companyName', label: 'Company Name', required: true },
    { key: 'domain', label: 'Company Domain Name', required: false },
    { key: 'boothNumber', label: 'Booth#', required: false },
    { key: 'estimatedMonthlySales', label: 'Estimated Monthly Sales', required: false },
    { key: 'platform', label: 'Ecommerce Platform', required: false },
    { key: 'lastContacted', label: 'Last Contacted', required: false },
    { key: 'ownerId', label: 'Company owner', required: false }
  ],
  [LIST_TYPES.PEOPLE]: [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'lastName', label: 'Last Name', required: false },
    { key: 'jobTitle', label: 'Job title', required: false },
    { key: 'companyName', label: 'Company Name', required: false },
    { key: 'domain', label: 'Company domain name', required: false },
    { key: 'sales', label: 'Sales', required: false },
    { key: 'dateCompleted', label: 'Date Completed', required: false }
  ],
  [LIST_TYPES.HIT_LIST]: [
    { key: 'recordId', label: 'Record ID', required: false },
    { key: 'companyName', label: 'Company Name', required: true },
    { key: 'domain', label: 'Company Domain Name', required: false },
    { key: 'boothNumber', label: 'Booth#', required: false },
    { key: 'estimatedMonthlySales', label: 'Estimated Monthly Sales', required: false },
    { key: 'platform', label: 'Ecommerce Platform', required: false },
    { key: 'competitorInstalls', label: 'Competitor Tracking - Installs', required: false },
    { key: 'competitorUninstalls', label: 'Competitor Tracking - Uninstalls', required: false },
    { key: 'techInstalls', label: 'Tech Tracking - Installs', required: false },
    { key: 'instagramFollowers', label: 'Instagram Followers', required: false },
    { key: 'facebookFollowers', label: 'Facebook Followers', required: false },
    { key: 'monthlyVisits', label: 'Estimated Monthly Visits', required: false }
  ]
};

// Helper function to get owner name from HubSpot ID
function getOwnerName(ownerId) {
  const owner = HUBSPOT_OWNERS[String(ownerId)];
  return owner ? owner.name : ownerId || 'Unassigned';
}

// Helper function to get rep ID from HubSpot owner ID
function getRepIdFromOwner(ownerId) {
  const owner = HUBSPOT_OWNERS[String(ownerId)];
  return owner?.isTradeShowRep ? owner.repId : null;
}

// Helper function to get HubSpot owner ID from rep ID
function getHubSpotOwnerId(repId) {
  for (const [ownerId, owner] of Object.entries(HUBSPOT_OWNERS)) {
    if (owner.repId === repId) return ownerId;
  }
  return null;
}

// Helper to get rep name from rep ID
function getRepName(repId) {
  for (const owner of Object.values(HUBSPOT_OWNERS)) {
    if (owner.repId === repId) return owner.name;
  }
  return repId;
}

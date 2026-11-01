/// Supabase credentials matching `/js/config.js` in the main Cerria Town Web project.
/// Includes automatic zero-crash offline fallback when device is offline.
class CerriaSupabaseConfig {
  const CerriaSupabaseConfig._();

  static const String url = 'https://penfodwizsqxitafhfcf.supabase.co';
  static const String anonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlbmZvZHdpenNxeGl0YWZoZmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzQyMzgsImV4cCI6MjEwODYxMDIzOH0.Ym3LWe0S7zKFFsj2z2rF94uwMjII7mSA-LoKs8w7bNY';

  static String buildShopeeAffiliateUrl(String storeName, String productName) {
    final q = Uri.encodeQueryComponent('$storeName $productName Cerria Town');
    return 'https://shopee.co.id/search?keyword=$q&utm_source=cerria_town_app&utm_medium=affiliate';
  }

  static String buildTokopediaAffiliateUrl(String storeName, String productName) {
    final q = Uri.encodeQueryComponent('$storeName $productName');
    return 'https://www.tokopedia.com/search?st=product&q=$q&utm_source=cerria_town_app';
  }
}

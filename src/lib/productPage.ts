/** The product page's fixed values (owner, 31 Oct 2026). */

/**
 * The privacy policy: a static file on the product site, so it opens even while the server sleeps.
 * The app runs on its own site (app.northlist.site), which has no privacy.html, so it links the full address.
 */
export const PRIVACY_POLICY_FROM_APP = 'https://northlist.site/privacy.html';

/** The contact address, as on the privacy policy. */
export const CONTACT_EMAIL = 'nitinsirsath8855@gmail.com';

/**
 * Sign-in, on the app's own site (owner, 31 Oct 2026). The product page does not know whether
 * the visitor is signed in: a signed-in user there goes straight on to the Dashboard.
 */
export const SIGN_IN_URL = 'https://app.northlist.site/login';

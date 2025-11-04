

const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ============================================
// SafeHaven Client Assertion Generator
// ============================================

// STEP 1: UPDATE THESE VALUES
const CLIENT_ID = '248897306f83bd0ee7ef72bf68fa48cc'; // Get this from SafeHaven after uploading public key
const PRIVATE_KEY_PATH = './key.pem'; // Path to your private key file

// STEP 2: Generate unique identifiers
const jti = crypto.randomBytes(16).toString('hex'); // Unique JWT ID
const currentTime = Math.floor(Date.now() / 1000);

// STEP 3: Create JWT payload
const payload = {
  iss: CLIENT_ID,           // Issuer (your client ID)
  sub: CLIENT_ID,           // Subject (your client ID)
  aud: 'https://api.sandbox.safehavenmfb.com', // Audience (SafeHaven API)
  jti: jti,                 // Unique JWT ID
  iat: currentTime,         // Issued at
  exp: currentTime + 3600   // Expires in 1 hour
};

// STEP 4: Read your private key
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

// STEP 5: Sign the JWT with RS256 algorithm
const clientAssertion = jwt.sign(payload, privateKey, {
  algorithm: 'RS256',
  keyid: CLIENT_ID // Optional: Key ID header
});

// STEP 6: Display results
console.log('\n✅ Client Assertion Generated Successfully!\n');
console.log('═══════════════════════════════════════════════════════\n');
console.log('CLIENT_ID:');
console.log(CLIENT_ID);
console.log('\n');
console.log('CLIENT_ASSERTION (copy this entire string):');
console.log(clientAssertion);
console.log('\n═══════════════════════════════════════════════════════\n');

// STEP 7: Save to .env format
const envContent = `
# SafeHaven Credentials
SAVEHAVEN_CLIENT_ID=${CLIENT_ID}
SAVEHAVEN_CLIENT_ASSERTION=${clientAssertion}
SAVEHAVEN_BASE_URL=https://api.sandbox.safehavenmfb.com
`;

fs.writeFileSync('.env.safehaven', envContent.trim());
console.log('✅ Credentials saved to .env.safehaven\n');
console.log('Copy and paste these into your .env file!\n');
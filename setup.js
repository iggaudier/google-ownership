// File: setup.js
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const path = require('path');

// Scopes required for Google Drive access
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || path.join(__dirname, 'credentials.json');

/**
 * Setup function to generate the token.json file
 */
async function setup() {
    try {
        console.log('Starting OAuth setup process');

        // Check for credentials file
        if (!fs.existsSync(CREDENTIALS_PATH)) {
            console.error(`Error: credentials.json not found at ${CREDENTIALS_PATH}`);
            console.error('Please download your OAuth credentials from Google Cloud Console');
            process.exit(1);
        }

        // Load client secrets from credentials.json
        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        await getToken(credentials);

        console.log('\nSetup complete! You can now use the non-interactive script (index.js)');
    } catch (error) {
        console.error('Error during setup:', error.message);
        process.exit(1);
    }
}

/**
 * Get and store token after prompting for user authorization
 * @param {Object} credentials The authorization client credentials
 */
async function getToken(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent' // Force to get refresh_token
    });

    console.log('Authorize this app by visiting this URL:', authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const code = await new Promise((resolve) => {
        rl.question('\nEnter the code from that page here: ', (code) => {
            rl.close();
            resolve(code);
        });
    });

    try {
        const { tokens } = await oAuth2Client.getToken(code);

        // Store the token to disk for later program executions
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('Token stored to', TOKEN_PATH);

        return tokens;
    } catch (err) {
        console.error('Error retrieving access token:', err.message);
        throw err;
    }
}

// Run the setup
setup();
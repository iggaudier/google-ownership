const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');

// Scopes required for Google Drive access
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = process.env.CREDENTIALS_PATH || path.join(__dirname, 'credentials.json');

// Get file ID and new owner email from command line arguments or environment variables
const FILE_ID = "1xXLYKcwY4r0mViHg-Gx-AAoEpei3TKqQ";
const NEW_OWNER_EMAIL = "test.dummy05062000@gmail.com";

/**
 * Main function to initiate the ownership transfer process
 */
async function main() {
    try {
        // Validate required parameters
        if (!FILE_ID || !NEW_OWNER_EMAIL) {
            console.error('Error: File ID and new owner email are required.');
            console.error('Usage: node initiate-ownership-transfer.js [fileId] [newOwnerEmail]');
            console.error('Or set FILE_ID and NEW_OWNER_EMAIL environment variables');
            process.exit(1);
        }

        console.log('Starting ownership transfer initiation');
        console.log(`File ID: ${FILE_ID}`);
        console.log(`Prospective Owner: ${NEW_OWNER_EMAIL}`);

        // Load client secrets from credentials.json
        if (!fs.existsSync(CREDENTIALS_PATH)) {
            console.error(`Error: credentials.json not found at ${CREDENTIALS_PATH}`);
            process.exit(1);
        }

        const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        const auth = await authorize(credentials);

        await initiateOwnershipTransfer(auth, FILE_ID, NEW_OWNER_EMAIL);
        console.log('Ownership transfer initiation completed');
    } catch (error) {
        console.error('Error running the application:', error.message);
        process.exit(1);
    }
}

/**
 * Get authorization client
 * @param {Object} credentials The authorization client credentials
 */
async function authorize(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token
    try {
        if (!fs.existsSync(TOKEN_PATH)) {
            console.error('Error: No stored token found. Please run the setup script first to generate a token.');
            process.exit(1);
        }

        const token = fs.readFileSync(TOKEN_PATH, 'utf8');
        oAuth2Client.setCredentials(JSON.parse(token));
        console.log('Using stored authentication token');
        return oAuth2Client;
    } catch (err) {
        console.error('Error loading token:', err.message);
        process.exit(1);
    }
}

/**
 * Initiate ownership transfer of a file to a new user
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client
 * @param {string} fileId The ID of the file to transfer
 * @param {string} newOwnerEmail Email of the prospective owner
 */
async function initiateOwnershipTransfer(auth, fileId, newOwnerEmail) {
    const drive = google.drive({ version: 'v3', auth });

    try {
        console.log(`Initiating ownership transfer of file ${fileId} to ${newOwnerEmail}`);

        // First, check if the file exists and we have access to it
        const file = await drive.files.get({
            fileId: fileId,
            fields: 'name,owners'
        });

        console.log(`File found: ${file.data.name}`);
        console.log(`Current owner: ${file.data.owners[0].emailAddress}`);

        // Check if new owner already has permission
        let newOwnerHasPermission = false;
        let existingPermissionId = null;

        // Get the list of permissions for this file
        const permissionResponse = await drive.permissions.list({
            fileId: fileId,
            fields: 'permissions(id,emailAddress,role)'
        });

        const permissions = permissionResponse.data.permissions || [];
        console.log(`File has ${permissions.length} existing permissions`);

        // Check if the new owner already has some permission
        for (const permission of permissions) {
            if (permission.emailAddress === newOwnerEmail) {
                newOwnerHasPermission = true;
                existingPermissionId = permission.id;
                console.log(`Prospective owner already has permission with role: ${permission.role}`);
                break;
            }
        }

        // Step 1: Set the prospective owner with role=writer and pendingOwner=true
        if (existingPermissionId) {
            // Update existing permission
            console.log('Updating existing permission for prospective owner...');
            const permission = await drive.permissions.update({
                fileId: fileId,
                permissionId: existingPermissionId,
                requestBody: {
                    role: 'writer',
                    pendingOwner: true
                }
            });
            console.log(`Updated permission ID: ${permission.data.id} with pendingOwner=true`);
        } else {
            // Create new permission
            console.log('Creating new permission for prospective owner...');
            const permission = await drive.permissions.create({
                fileId: fileId,
                sendNotificationEmail: true,
                emailMessage: `I'm inviting you to become the owner of the file "${file.data.name}". To accept ownership, you'll need to run the accept-ownership.js script.`,
                requestBody: {
                    role: 'writer',
                    type: 'user',
                    emailAddress: newOwnerEmail,
                    pendingOwner: true
                }
            });
            console.log(`Created permission ID: ${permission.data.id} with pendingOwner=true`);
        }

        console.log('\nSuccessfully initiated ownership transfer!');
        console.log(`The prospective owner (${newOwnerEmail}) has been set as a pending owner.`);
        console.log(`The prospective owner will need to accept the transfer by running the accept-ownership.js script.`);

        return;
    } catch (error) {
        console.error('Error initiating ownership transfer:', error.message);
        if (error.errors) {
            console.error('API Error details:', JSON.stringify(error.errors, null, 2));
        }
        throw error;
    }
}

// Run the application
main();

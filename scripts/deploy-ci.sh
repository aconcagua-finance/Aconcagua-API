#!/usr/bin/env bash
set -e

echo "deploying..."

# echo "//registry.npmjs.org/:_authToken=${VS_GITHUB_NPM_TOKEN}" >> .npmrc
# echo "@abdalamichel:registry=https://npm.pkg.github.com/:_authToken=${VS_GITHUB_NPM_TOKEN}" >> .npmrc
# echo "@abdalamichel:registry=https://npm.pkg.github.com/:_authToken=${VS_GITHUB_NPM_TOKEN}" >> .npmrc
# echo "//npm.pkg.github.com/:_authToken=${VS_GITHUB_NPM_TOKEN}" >> .npmrc
 
 # ~/.npmrc

rm -f .npmrc
touch .npmrc

echo "//npm.pkg.github.com/:_authToken=${VS_GITHUB_NPM_TOKEN}" >> .npmrc

rm -f .env
touch .env

echo "ENVIRONMENT="${ENVIRONMENT} >> .env
echo "FIREB_PROJECT_ID="${FIREB_PROJECT_ID} >> .env
echo "FIREB_API_KEY="${FIREB_API_KEY} >> .env
echo "FIREB_AUTH_DOMAIN="${FIREB_AUTH_DOMAIN} >> .env
echo "FIREB_STORAGE_BUCKET="${FIREB_STORAGE_BUCKET} >> .env
echo "FIREB_MESSAGING_SENDER_ID="${FIREB_MESSAGING_SENDER_ID} >> .env
echo "FIREB_APP_ID="${FIREB_APP_ID} >> .env
echo "FIREB_MEASURAMENT_ID="${FIREB_MEASURAMENT_ID} >> .env

echo "SYS_ADMIN_EMAIL="${SYS_ADMIN_EMAIL} >> .env
echo "NEW_USERS_TEMP_PASSWORD="${NEW_USERS_TEMP_PASSWORD} >> .env

echo "ZOHO_CLIENT_ID="${ZOHO_CLIENT_ID} >> .env
echo "ZOHO_CLIENT_SECRET="${ZOHO_CLIENT_SECRET} >> .env
echo "ZOHO_REDIRECT_URL="${ZOHO_REDIRECT_URL} >> .env
echo "ZOHO_REFRESH_TOKEN="${ZOHO_REFRESH_TOKEN} >> .env

echo "AIRTABLE_API_KEY="${AIRTABLE_API_KEY} >> .env

echo "GOOGLE_OAUTH_CLIENT_ID="${GOOGLE_OAUTH_CLIENT_ID} >> .env
echo "GOOGLE_OAUTH_CLIENT_SECRET="${GOOGLE_OAUTH_CLIENT_SECRET} >> .env
echo "GOOGLE_OAUTH_REDIRECT_URL="${GOOGLE_OAUTH_REDIRECT_URL} >> .env
echo "GOOGLE_CALENDAR_EVENT_WEBHOOK_URL="${GOOGLE_CALENDAR_EVENT_WEBHOOK_URL} >> .env

echo "DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY="${DOLAR_HOY_DOLAR_CRIPTO_DOM_QUERY} >> .env
echo "API_USD_VALUATION="${API_USD_VALUATION} >> .env
echo "API_TOKENS_VALUATIONS="${API_TOKENS_VALUATIONS} >> .env
echo "API_EVALUATE_VAULTS=" ${API_EVALUATE_VAULTS} >> .env
echo "API_VAULT_ADMIN=" ${API_VAULT_ADMIN} >> .env

# Set Credentials
echo "${FIREBASE_SERVICE_ACCOUNT_KEY}" > /tmp/serviceAccountKey.json
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/serviceAccountKey.json
echo "Deploy proyecto $FIREB_PROJECT_ID"

firebase deploy --project $FIREB_PROJECT_ID --only functions:users,functions:admin,functions:leads,functions:products,functions:staff,functions:attachments,functions:usersByStaff,functions:userTouchpoints,functions:hookedEvents,functions:insights,functions:userProducts,functions:googleOAuth,functions:userCalendars,functions:userCalendarEvents,functions:companies,functions:companyEmployees,functions:companyClients,functions:companyProfiles,functions:companyDepartments,functions:onUserTouchpointCreate,functions:onUserTouchpointUpdate,functions:onHookedEventCreate,functions:onHookedEventUpdate,functions:onUserCalendarEventBronzeCreate,functions:vaultInstallments,functions:vaultTransactions,functions:onVaultCreate_ThenCreateCompanyClientRelationship,functions:scrapper,functions:transactionRequests,functions:cronUpdateValuations,functions:marketCap,functions:reminders,functions:emailTemplates,functions:tokenRatios,function:onRequestUpdate

echo "deploy complete!"


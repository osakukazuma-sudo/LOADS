// Read-only: reuse official EAS CLI authentication; never print credential values.
const path = require('node:path');
async function main() {
  const root = process.argv[2];
  if (!root) throw new Error('Pass the installed official eas-cli build path');
  const appId = process.env.EAS_PROJECT_ID;
  if (!appId) throw new Error('Set EAS_PROJECT_ID for the project to inspect');
  const SessionManager = require(path.join(root, 'user/sessionManager')).default;
  const { createGraphqlClient } = require(path.join(root, 'commandUtils/context/contextUtils/createGraphqlClient'));
  const session = new SessionManager({ setActor() {} });
  const client = createGraphqlClient({ accessToken: session.getAccessToken(), sessionSecret: session.getSessionSecret() });
  const response = await client.query(`query LoadsPushSecurityReview($appId: String!) {
    app { byId(appId: $appId) { id fullName ownerAccount { name pushSecurityEnabled } } }
    me { accessTokens { createdAt revokedAt note } }
  }`, { appId }).toPromise();
  if (response.error) throw new Error(response.error.message);
  const tokens = response.data.me?.accessTokens;
  console.log(JSON.stringify({ project: response.data.app.byId, accessTokenMetadataAvailable: Array.isArray(tokens), activeAccessTokenCount: tokens?.filter(t => !t.revokedAt).length, revokedAccessTokenCount: tokens?.filter(t => t.revokedAt).length }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

const path = require("path");

const config = {
  MicrosoftAppId: process.env.BOT_ID,
  MicrosoftAppType: process.env.BOT_TYPE,
  MicrosoftAppTenantId: process.env.BOT_TENANT_ID,
  MicrosoftAppPassword: process.env.BOT_PASSWORD,
  
  azureOpenAIKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,

  // AI Configuration telling the app to use an Action Planner
  planner: {
    type: "Action",
    model: "gpt-4",
    max_tokens: 1000,
    temperature: 0.0,
  },
  
  // Tells the app where to find your prompts (including the config.json below)
  promptManager: {
    promptsFolder: path.join(__dirname, "./prompts"),
  },

};

module.exports = config;

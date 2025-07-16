// for local
// require('dotenv').config({ path: './env/.env.local' });

const { MemoryStorage, MessageFactory } = require("botbuilder");
const path = require("path");
const config = require("../config");
const customSayCommand = require("./customSayCommand");
const { calculateQuoteTotal } = require("./utils/quoteUtils");

// See https://aka.ms/teams-ai-library to learn more about the Teams AI library.
const { AI, Application, ActionPlanner, OpenAIModel, PromptManager } = require("@microsoft/teams-ai");
const { GraphDataSource } = require("./graphDataSource");

const { EuroluxApiDataSource } = require("./dataSources/euroluxApiDataSource");

// Create AI components
const model = new OpenAIModel({
  azureApiKey: config.azureOpenAIKey,
  azureDefaultDeployment: config.azureOpenAIDeploymentName,
  azureEndpoint: config.azureOpenAIEndpoint,

  useSystemMessages: true,
  logRequests: true,
});
const prompts = new PromptManager({
  promptsFolder: path.join(__dirname, "../prompts"),
});

const planner = new ActionPlanner({
  model,
  prompts,
  defaultPrompt: "chat",
  allowLooping: true,
  allowMultipleActions: true
});

// Register your data source with planner
const graphDataSource = new GraphDataSource("graph-ai-search");
planner.prompts.addDataSource(graphDataSource);

const euroluxDataSource = new EuroluxApiDataSource("eurolux-products");
planner.prompts.addDataSource(euroluxDataSource);

prompts.addFunction("debugPrompt", async (context, state, planner) => {
    console.log("=== PROMPT DEBUG ===");
    console.log("Actions available:", planner.actions);
    console.log("Input:", state.temp.input);
    console.log("History:", state.temp.history);
    return "";
});

// Define storage and application
const storage = new MemoryStorage();
const app = new Application({
  storage,
  ai: {
    planner,
    enable_feedback_loop: true,
  },
  authentication: {
    settings: {
      graph: {
        scopes: ["Files.Read.All"],
        msalConfig: {
          auth: {
            clientId: process.env.AAD_APP_CLIENT_ID,
            clientSecret: process.env.AAD_APP_CLIENT_SECRET,
            authority: `${process.env.AAD_APP_OAUTH_AUTHORITY_HOST}/${process.env.AAD_APP_TENANT_ID}`
          }
        },
        signInLink: `https://${process.env.BOT_DOMAIN}/auth-start.html`,
      }
    },
    autoSignIn: true,
  }
});

// DOCS page 1100!!
app.ai.action(AI.SayCommandActionName, async (context, state, data) => {
    if (data.response) {
        await context.sendActivity(data.response);
    }
    return "response sent";
});

app.authentication.get("graph").onUserSignInSuccess(async (context, state) => {
  // Successfully logged in
  await context.sendActivity("You are successfully logged in. You can send a new message to talk to the agent.");
});

app.authentication.get("graph").onUserSignInFailure(async (context, state, error) => {
  // Failed to login
  await context.sendActivity("Failed to login");
  await context.sendActivity(`Error message: ${error.message}`);
});

app.feedbackLoop(async (context, state, feedbackLoopData) => {
  //add custom feedback process logic here
  console.log("Your feedback is " + JSON.stringify(context.activity.value));
});



// ----- DEBUG ACTION FOR TESTING -----

app.ai.action("debugSayName", async (context, state, data) => {
    try {
        console.log('🐛 DEBUG SAY NAME ACTION TRIGGERED');
        console.log('📋 Debug data received:', JSON.stringify(data, null, 2));

        // You can customize the response based on the data passed
        const userName = data.userName || "Crusader Chris";
        const customMessage = data.customMessage || null;

        let response;
        if (customMessage) {
            response = `🐛 Debug Mode: ${customMessage}`;
        } else {
            response = `🐛 Debug Mode: Hello ${userName}! Action system is working perfectly! 🎉`;
        }

        await context.sendActivity(response);
        return "debug completed";

    } catch (error) {
        console.error('❌ ERROR in debugSayName action:', error.message, error.stack);
        await context.sendActivity("Debug action failed - check logs for details.");
        return "error";
    }
});

// Alternative - more flexible debug action
app.ai.action("debugTest", async (context, state, data) => {
    try {
        console.log('🔧 ═══ DEBUG TEST ACTION TRIGGERED ═══');
        console.log('📋 Input data:', JSON.stringify(data, null, 2));
        console.log('💾 Conversation state keys:', Object.keys(state.conversation || {}));
        console.log('👤 User activity:', context.activity.text);

        const testType = data.testType || "name";
        const customValue = data.customValue || "Crusader Chris";

        let response = `🔧 **Debug Test Results**\n\n`;
        response += `**Test Type:** ${testType}\n`;
        response += `**Custom Value:** ${customValue}\n`;
        response += `**Timestamp:** ${new Date().toISOString()}\n`;
        response += `**Action Data:** ${JSON.stringify(data, null, 2)}\n`;
        
        if (state.conversation.quote) {
            response += `**Quote Items:** ${state.conversation.quote.items?.length || 0}\n`;
        }

        await context.sendActivity(response);
        return "debug test completed";

    } catch (error) {
        console.error('❌ ERROR in debugTest action:', error.message, error.stack);
        await context.sendActivity("Debug test failed - check console for details.");
        return "error";
    }
});


// SEARCH TOOLS FOR AI AGENT

// Register the searchProducts action with schema
app.ai.action("searchProducts", async (context, state, data) => {
    console.log('🔍 ═══ SEARCH PRODUCTS ACTION TRIGGERED ═══');
    console.log('📋 Search data received:', JSON.stringify(data, null, 2));
    
    try {
        const filters = {
            sku: data.sku,
            description: data.description,
            minPrice: data.minPrice,
            maxPrice: data.maxPrice,
            minLumens: data.minLumens,
            maxLumens: data.maxLumens,
            inStock: data.inStock,
            minStock: data.minStock,
            jhbStock: data.jhbStock,
            cptStock: data.cptStock,
            status: data.status,
            limit: data.limit || 10
        };

        console.log('🔧 Processed filters:', JSON.stringify(filters, null, 2));

        const products = await euroluxDataSource.searchProducts(filters);
        console.log(`✅ Search returned ${products.length} products`);
        
        if (products.length === 0) {
            console.log('❌ No products found - sending empty result message');
            await context.sendActivity("No products found matching your criteria.");
            return "no results";
        }

        let response = `Found ${products.length} product(s):\n\n`;
        products.forEach((product, index) => {
            response += `**${index + 1}. ${product.sProductDescr}** (${product.sProductCode})\n`;
            response += `   💰 Price: R${product.dListPrice || 0}\n`;
            response += `   📦 Stock - JHB: ${product.nJHBFree || 0}, CPT: ${product.nCPTFree || 0}\n`;
            if (product.nLumens) response += `   💡 Lumens: ${product.nLumens}\n`;
            response += `\n`;
        });

        console.log('📤 Sending response to user');
        await context.sendActivity(response);
        return "search completed";

    } catch (error) {
        console.error('❌ ERROR in searchProducts action:', error.message, error.stack);
        await context.sendActivity("An error occurred while searching products.");
        return "error";
    }
});

app.ai.action("getProductBySku", async (context, state, data) => {
    console.log('🔎 ═══ GET PRODUCT BY SKU ACTION TRIGGERED ═══');
    console.log('📋 SKU data received:', JSON.stringify(data, null, 2));
    
    try {
        if (!data.sku) {
            console.log('❌ No SKU provided in action data');
            await context.sendActivity("Please provide a SKU to search for.");
            return "no sku";
        }

        console.log(`🔍 Looking up SKU: "${data.sku}"`);
        const product = await euroluxDataSource.getProductBySku(data.sku);
        
        if (!product) {
            console.log(`❌ Product not found for SKU: "${data.sku}"`);
            await context.sendActivity(`Product with SKU '${data.sku}' not found.`);
            return "not found";
        }

        console.log(`✅ Product found: ${product.sProductDescr}`);
        const response = `**${product.sProductDescr}** (${product.sProductCode})\n\n` +
                        `💰 **Price:** R${product.dListPrice || 0}\n` +
                        `📦 **Stock:**\n` +
                        `   - JHB: ${product.nJHBFree || 0} units\n` +
                        `   - CPT: ${product.nCPTFree || 0} units\n` +
                        `📋 **Status:** ${product.sProductStatus || 'Unknown'}\n` +
                        (product.nLumens ? `💡 **Lumens:** ${product.nLumens}\n` : '');

        console.log('📤 Sending product details to user');
        await context.sendActivity(response);
        return "product found";

    } catch (error) {
        console.error('❌ ERROR in getProductBySku action:', error.message, error.stack);
        await context.sendActivity("An error occurred while fetching product details.");
        return "error";
    }
});

app.ai.action("getProductStats", async (context, state, data) => {
    try {
        console.log('📊 GET PRODUCT STATS ACTION TRIGGERED');

        const stats = await euroluxDataSource.getProductStats();
        
        if (!stats) {
            await context.sendActivity("Unable to retrieve product statistics.");
            return "no stats";
        }

        const response = `📊 **Eurolux Product Statistics**\n\n` +
                        `📦 **Total Products:** ${stats.totalProducts}\n` +
                        `✅ **In Stock:** ${stats.inStockCount}\n` +
                        `💰 **Average Price:** R${stats.avgPrice.toFixed(2)}\n` +
                        `🏢 **Total JHB Stock:** ${stats.totalJhbStock} units\n` +
                        `🌊 **Total CPT Stock:** ${stats.totalCptStock} units`;

        await context.sendActivity(response);
        return "stats provided";

    } catch (error) {
        console.error('❌ Error in getProductStats action:', error);
        await context.sendActivity("An error occurred while fetching statistics.");
        return "error";
    }
});


// EUROLUX API DATA
app.ai.action("addToQuote", async (context, state, data) => {
    try {
        console.log('🧾 ADD TO QUOTE ACTION TRIGGERED');

        // Ensure the Eurolux data source is available
        const euroluxDS = planner.prompts.getDataSources().find(ds => ds.name === 'eurolux-products');
        if (!euroluxDS) {
            await context.sendActivity("❌ Eurolux API data source not configured.");
            return "error";
        }

        // Initialize quote in conversation state if it doesn't exist
        if (!state.conversation.quote) {
            state.conversation.quote = { items: [] };
            console.log('🧾 Initialized new quote in conversation state.');
        }

        // The AI model should return the SKU and quantity in the 'data' object.
        // We'll need to configure the prompts for this later. For now, we'll extract it.
        let { sku, quantity = 1 } = data;

        if (!sku) { // Simple fallback extraction if AI doesn't provide SKU
            const skuMatch = context.activity.text.match(/([A-Z0-9]{3,})/i);
            if (skuMatch) sku = skuMatch[0].toUpperCase();
        }

        if (!sku) {
            await context.sendActivity("I couldn't identify a product SKU. Please specify one, like 'add 5 of B110B to the quote'.");
            return "no sku";
        }

        const product = await euroluxDS.getProductBySku(sku);

        if (!product) {
            await context.sendActivity(`❌ Product with SKU '${sku}' not found.`);
            return "product not found";
        }

        const unitPrice = product.nCPTFree || product.dListPrice || 0;
        const newItem = {
            sku: product.sProductCode,
            description: product.sProductDescr,
            quantity: parseInt(quantity),
            unitPrice: unitPrice,
            lineTotal: parseInt(quantity) * unitPrice,
        };

        state.conversation.quote.items.push(newItem);
        const total = await calculateQuoteTotal(state.conversation.quote);

        await context.sendActivity(`✅ Added **${newItem.quantity}x ${newItem.description}** to your quote.\n\nCurrent total: **R${total}**`);
        return "item added";

    } catch (error) {
        console.error('❌ Error in addToQuote action:', error);
        await context.sendActivity("I ran into an issue adding that item. Please try again.");
        return "error";
    }
});

app.ai.action("showQuote", async (context, state) => {
    try {
        console.log('🧾 SHOW QUOTE ACTION TRIGGERED');

        if (!state.conversation.quote || !state.conversation.quote.items.length) {
            await context.sendActivity("Your quote is currently empty. Try adding an item, like 'add 5 of B110B'.");
            return "quote empty";
        }

        const quote = state.conversation.quote;
        const total = await calculateQuoteTotal(quote);

        let quoteText = `📋 **Your Current Quote**\n\n`;
        quote.items.forEach((item, index) => {
            quoteText += `**${index + 1}. ${item.description}** (SKU: ${item.sku})\n`;
            quoteText += `   - Quantity: ${item.quantity} @ R${item.unitPrice.toFixed(2)} each\n`;
            quoteText += `   - Subtotal: R${item.lineTotal.toFixed(2)}\n`;
        });
        quoteText += `\n**💰 Total: R${total}**`;

        await context.sendActivity(quoteText);
        return "quote shown";

    } catch (error) {
        console.error('❌ Error in showQuote action:', error);
        await context.sendActivity("I ran into an issue showing the quote. Please try again.");
        return "error";
    }
});

app.ai.action("generateQuote", async (context, state) => {
    try {
        console.log('🧾 GENERATE QUOTE ACTION TRIGGERED');
        if (!state.conversation.quote || !state.conversation.quote.items.length) {
            await context.sendActivity("Cannot generate an empty quote. Please add some items first.");
            return "quote empty";
        }
        // In the next step, we will add the logic here to create the Excel file
        // and upload it to SharePoint.
        await context.sendActivity("✅ Quote generation is ready. The final step is to build the Excel export and SharePoint upload.");
        return "quote generated";
    } catch (error) {
        console.error('❌ Error in generateQuote action:', error);
        await context.sendActivity("I ran into an issue generating the quote. Please try again.");
        return "error";
    }
});

app.ai.action("clearQuote", async (context, state) => {
    try {
        console.log('🧾 CLEAR QUOTE ACTION TRIGGERED');
        state.conversation.quote = { items: [] }; // Reset the quote
        await context.sendActivity("🗑️ Your quote has been cleared. You can start a new one!");
        return "quote cleared";
    } catch (error) {
        console.error('❌ Error in clearQuote action:', error);
        await context.sendActivity("I ran into an issue clearing the quote. Please try again.");
        return "error";
    }
});

// ----- DEBUG & UTILITY HANDLERS -----

// Handler for '/status' command
app.message('/status', async (context, state) => {
    console.log("--- DEBUG: /status handler triggered ---");
    const hasEuroluxCredentials = !!(process.env.EUROLUX_USERNAME && process.env.EUROLUX_PASSWORD); // if missing add to env vars on Azure manually
    let statusMessage = `🤖 **Bot Status**\n\n`;
    statusMessage += `**Eurolux Credentials:** ${hasEuroluxCredentials ? '✅ -Loaded' : '❌ -Missing'}\n\n`;
    

    // Check if the Eurolux data source is registered
    const euroluxDS = euroluxDataSource
    statusMessage += `**Eurolux Data Source:** ${euroluxDS ? '✅ -Registered' : '❌ -Not Registered'}\n\n`;

    await context.sendActivity(statusMessage);
});

// Handler for '/stock {SKU}' command
app.message(/\/stock (.*)/i, async (context, state) => {
    console.log(`--- DEBUG: /stock handler triggered. Raw text: "${context.activity.text}" ---`); 
    try {
        const sku = context.activity.text.split(' ')[1];
        console.log(`--- DEBUG: Parsed SKU: "${sku}" ---`);
        if (!sku) {
            await context.sendActivity("Please provide a SKU. Usage: `/stock B110B`");
            return;
        }

        console.log(`⚙️ DEBUG: Manual stock lookup for SKU: ${sku}`);

        // Get the data source instance from the planner
        const euroluxDS = euroluxDataSource
        if (!euroluxDS) {
            await context.sendActivity("Error: The Eurolux data source is not registered.");
            return;
        }

        const product = await euroluxDS.getProductBySku(sku);
        console.log('--- DEBUG: Product found by getProductBySku:', JSON.stringify(product, null, 2));

        if (product) {
            const stockInfo = `**Stock for ${product.sProductDescr} (SKU: ${product.sProductCode})**\n\n` +
                              `**JHB:** ${product.nJHBFree || 0} units\n` +
                              `**CPT:** ${product.nCPTFree || 0} units`;
            await context.sendActivity(stockInfo);
        } else {
            await context.sendActivity(`Product with SKU '${sku}' not found.`);
        }
    } catch (error) {
        console.error(`--- DEBUG: ERROR in /stock handler: ${error.message}`, error.stack);
        await context.sendActivity("An error occurred while fetching stock information.");
    }
});

module.exports = app;

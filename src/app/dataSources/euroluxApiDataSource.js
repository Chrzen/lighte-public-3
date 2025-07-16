// src/app/dataSources/euroluxApiDataSource.js
const axios = require('axios');

class EuroluxApiDataSource {
    constructor(name) {
        this.name = name;
        this._products = null; // In-memory cache
        this._lastSync = null;
    }

    // Fetches all products from the Eurolux API
    async #fetchProductList() {
        // ... (The #fetchProductList method remains unchanged)
        const username = process.env.EUROLUX_USERNAME;
        const password = process.env.EUROLUX_PASSWORD;

        console.log(`--- DEBUG (fetchProductList): Checking credentials. User: ${!!username}, Pass: ${!!password} ---`); 

        if (!username || !password) {
            console.error('❌ Missing Eurolux credentials.');
            return [];
        }

        try {
            console.log('--- DEBUG (fetchProductList): Making axios request to Eurolux API...'); 
            const auth = Buffer.from(`${username}:${password}`).toString('base64');
            const response = await axios.get('https://www.eurolux-portal.co.za/fw/api/products/getproductlist', {
                headers: { 'Authorization': `Basic ${auth}` },
                timeout: 30000
            });

            console.log(`--- DEBUG (fetchProductList): API response status: ${response.status} ---`); 

            if (response.status === 200 && Array.isArray(response.data)) {
                console.log(`✅ Successfully fetched ${response.data.length} products.`);
                return response.data;
            }
            return [];
        } catch (error) {
            console.error(`--- DEBUG (fetchProductList): AXIOS ERROR: ${error.message}`, error.stack); 
            return [];
        }
    }

    // Ensures the product cache is loaded
    async #ensureCache() {
        // ... (The #ensureCache method remains unchanged)
        if (!this._products) {
            this._products = await this.#fetchProductList();
            this._lastSync = new Date();
        }
    }
    
    /**
     * Finds a single product by its SKU from the cached list.
     * @param {string} sku The product SKU to find.
     * @returns {Promise<object|null>} The product object or null if not found.
     */
    async getProductBySku(sku) {
        // ... (The getProductBySku method remains unchanged)
        await this.#ensureCache();
        if (!this._products) return null;
        return this._products.find(p => p.sProductCode.toLowerCase() === sku.toLowerCase()) || null;
    }

    // -------------------------------------------------------------------------------------------
    // ⬇️ ADD THIS NEW METHOD ⬇️
    // -------------------------------------------------------------------------------------------
    /**
     * This method is called by the AI planner to render data for the prompt's context.
     * It looks for SKUs in the user's input and returns formatted product data.
     */
    async searchProducts(filters = {}) {
        await this.#ensureCache();
        if (!this._products) return [];

        let results = [...this._products];

        // Filter by SKU (exact or partial match)
        if (filters.sku) {
            const skuLower = filters.sku.toLowerCase();
            results = results.filter(p => 
                p.sProductCode.toLowerCase().includes(skuLower)
            );
        }

        // Filter by description/name
        if (filters.description) {
            const descLower = filters.description.toLowerCase();
            results = results.filter(p => 
                p.sProductDescr.toLowerCase().includes(descLower)
            );
        }

        // Filter by price range
        if (filters.minPrice !== undefined) {
            results = results.filter(p => (p.dListPrice || 0) >= filters.minPrice);
        }
        if (filters.maxPrice !== undefined) {
            results = results.filter(p => (p.dListPrice || 0) <= filters.maxPrice);
        }

        // Filter by stock availability
        if (filters.inStock === true) {
            results = results.filter(p => 
                (p.nJHBFree > 0) || (p.nCPTFree > 0)
            );
        }

        // Filter by minimum stock level
        if (filters.minStock !== undefined) {
            results = results.filter(p => 
                Math.max(p.nJHBFree || 0, p.nCPTFree || 0) >= filters.minStock
            );
        }

        // Filter by location stock
        if (filters.jhbStock !== undefined) {
            results = results.filter(p => (p.nJHBFree || 0) >= filters.jhbStock);
        }
        if (filters.cptStock !== undefined) {
            results = results.filter(p => (p.nCPTFree || 0) >= filters.cptStock);
        }

        // Filter by product status
        if (filters.status) {
            results = results.filter(p => 
                p.sProductStatus?.toLowerCase() === filters.status.toLowerCase()
            );
        }

        // Filter by lumens (if this field exists in your API)
        if (filters.minLumens !== undefined) {
            results = results.filter(p => (p.nLumens || 0) >= filters.minLumens);
        }
        if (filters.maxLumens !== undefined) {
            results = results.filter(p => (p.nLumens || 0) <= filters.maxLumens);
        }

        // Limit results
        if (filters.limit) {
            results = results.slice(0, filters.limit);
        }

        return results;
    }

    /**
     * Get product statistics
     */
    async getProductStats() {
        await this.#ensureCache();
        if (!this._products) return null;

        const stats = {
            totalProducts: this._products.length,
            inStockCount: this._products.filter(p => (p.nJHBFree > 0) || (p.nCPTFree > 0)).length,
            avgPrice: this._products.reduce((sum, p) => sum + (p.dListPrice || 0), 0) / this._products.length,
            totalJhbStock: this._products.reduce((sum, p) => sum + (p.nJHBFree || 0), 0),
            totalCptStock: this._products.reduce((sum, p) => sum + (p.nCPTFree || 0), 0)
        };

        return stats;
    }

    // Simplified renderData - just provides context about what data is available
    async renderData(context, memory, tokenizer, maxTokens) {
        try {
            const query = memory.getValue("temp.input") || "";
            
            // Only provide context if the query seems product-related
            if (!query.match(/\b(product|stock|price|lumen|SKU|B110|G\d+)\b/i)) {
                return { output: "", length: 0, tooLong: false };
            }

            const contextInfo = `
<eurolux_context>
The agent has access to Eurolux product data through search tools.
Available search criteria: SKU, description, price range, stock levels, lumens, status.
Use the searchProducts or getProductBySku tools to find specific product information.
</eurolux_context>`;

            return { 
                output: contextInfo, 
                length: tokenizer.encode(contextInfo).length, 
                tooLong: false 
            };
        } catch (error) {
            console.error(`Error in renderData: ${error.message}`);
            return { output: "", length: 0, tooLong: false };
        }
    }
}

module.exports = {
    EuroluxApiDataSource,
};
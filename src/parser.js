/**
 * Arbitrage Log Parser
 * Parses arbitrage logs to extract sequences and their components
 */

class ArbitrageLogParser {
    constructor() {
        this.brokerNames = new Set();
        this.orderMap = new Map(); // Maps order IDs to their details
        this.virtualOrderMap = new Map(); // Maps virtual order IDs to their details
        this.sequences = [];
        this.currentSequence = null;
        this.brokerSettings = {};
        this.globalSettings = {};
    }
    
    /**
     * Set broker settings
     * @param {Object} settings - Broker settings
     */
    setBrokerSettings(settings) {
        this.brokerSettings = settings;
    }
    
    /**
     * Set global settings
     * @param {Object} settings - Global settings
     */
    setGlobalSettings(settings) {
        this.globalSettings = settings;
    }

    /**
     * Parse the full arbitrage log
     * @param {string} logText - The raw log text
     * @returns {Array} - Array of parsed sequences
     */
    parseLog(logText) {
        // Reset state
        this.brokerNames = new Set();
        this.orderMap = new Map();
        this.virtualOrderMap = new Map();
        this.sequences = [];
        this.currentSequence = null;

        // Split the log into lines and reverse to process chronologically (bottom to top)
        const lines = logText.split('\n').filter(line => line.trim() !== '');
        const chronologicalLines = [...lines].reverse();

        // Process each line
        for (const line of chronologicalLines) {
            this.parseLine(line);
        }

        // Finalize any incomplete sequence
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            this.finalizeCurrentSequence();
        }

        return this.sequences;
    }

    /**
     * Parse a single line of the log
     * @param {string} line - A single line from the log
     */
    parseLine(line) {
        // Extract timestamp and content
        const match = line.match(/^(\d+\.\d+\.\d+ \d+:\d+:\d+\.\d+): (.+)$/);
        if (!match) return;

        const [, timestamp, content] = match;
        
        // Check if this is a strategy start line
        if (content.includes("Strategy started")) {
            this.handleStrategyStart(timestamp, content);
            return;
        }

        // Check if this is a difference detection line
        if (content.includes("difference") && content.includes("points detected")) {
            this.handleDifferenceDetection(timestamp, content);
            return;
        }

        // Check if this is an order opening line
        if (content.includes("was opened")) {
            this.handleOrderOpened(timestamp, content);
            return;
        }

        // Check if this is an order modification line (SL/TP)
        if (content.includes("was modified") && content.includes("virtual SL=")) {
            this.handleOrderModified(timestamp, content);
            return;
        }

        // Check if this is a trailing stop modification
        if (content.includes("Modifying hidden S/L")) {
            this.handleTrailingStopModified(timestamp, content);
            return;
        }

        // Check if this is a stop loss trigger
        if (content.includes("Hidden StopLoss") && content.includes("was trigged")) {
            this.handleStopLossTrigger(timestamp, content);
            return;
        }

        // Check if this is an order locking line
        if (content.includes("was locked with order")) {
            this.handleOrderLocked(timestamp, content);
            return;
        }

        // Check if this is an order closing line
        if (content.includes("was closed by")) {
            this.handleOrderClosed(timestamp, content);
            return;
        }

        // Check if this is a virtual order creation
        if (content.includes("Virtual order") && content.includes("was created")) {
            this.handleVirtualOrderCreated(timestamp, content);
            return;
        }

        // Check if this is a virtual order removal
        if (content.includes("Virtual order") && content.includes("was removed")) {
            this.handleVirtualOrderRemoved(timestamp, content);
            return;
        }
    }

    /**
     * Handle strategy start line
     */
    handleStrategyStart(timestamp, content) {
        // Start a new sequence if we don't have one
        if (!this.currentSequence) {
            this.currentSequence = this.createNewSequence();
        }
    }

    /**
     * Handle difference detection line
     */
    handleDifferenceDetection(timestamp, content) {
        // Extract broker name
        const brokerMatch = content.match(/\[([^\]]+)\]:/);
        if (!brokerMatch) return;
        
        const broker = brokerMatch[1];
        this.brokerNames.add(broker);

        // Extract difference details
        const diffMatch = content.match(/(Buy|Sell) difference (\d+\.\d+)\((\d+\.\d+)\) points detected/);
        if (!diffMatch) return;

        const [, direction, actualDiff, thresholdDiff] = diffMatch;

        // Extract spread information
        const spreadMatch = content.match(/Spread Fast\/Slow:(\d+\.\d+)\/(\d+\.\d+)/);
        const bidMatch = content.match(/Bid Fast\/Slow:(\d+\.\d+)\/(\d+\.\d+)/);
        const askMatch = content.match(/Ask Fast\/Slow:(\d+\.\d+)\/(\d+\.\d+)/);

        // Start a new sequence part if needed
        if (!this.currentSequence) {
            this.currentSequence = this.createNewSequence();
        }
        
        // If we already have parts and the last one was completed, start a new part
        if (this.currentSequence.parts.length > 0 && 
            this.currentSequence.parts[this.currentSequence.parts.length - 1].completed) {
            this.currentSequence.parts.push(this.createNewSequencePart());
        }
        
        // If we don't have any parts yet, create the first one
        if (this.currentSequence.parts.length === 0) {
            this.currentSequence.parts.push(this.createNewSequencePart());
        }

        // Get the current part
        const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
        
        // Add the difference detection to the current part
        currentPart.differenceDetection = {
            timestamp,
            broker,
            direction,
            actualDiff: parseFloat(actualDiff),
            thresholdDiff: parseFloat(thresholdDiff),
            fastSpread: spreadMatch ? parseFloat(spreadMatch[1]) : null,
            slowSpread: spreadMatch ? parseFloat(spreadMatch[2]) : null,
            fastBid: bidMatch ? parseFloat(bidMatch[1]) : null,
            slowBid: bidMatch ? parseFloat(bidMatch[2]) : null,
            fastAsk: askMatch ? parseFloat(askMatch[1]) : null,
            slowAsk: askMatch ? parseFloat(askMatch[2]) : null
        };

        // Add the log line
        currentPart.logLines.push({ timestamp, content });
    }

    /**
     * Handle order opened line
     */
    handleOrderOpened(timestamp, content) {
        // Extract broker name
        const brokerMatch = content.match(/\[([^\]]+)\]:/);
        if (!brokerMatch) return;
        
        const broker = brokerMatch[1];
        this.brokerNames.add(broker);

        // Extract order details
        const orderMatch = content.match(/exoid:(\d+) (buy|sell) MARKET (\d+\.\d+) ([A-Z\.]+) at (\d+\.\d+)/i);
        if (!orderMatch) return;

        const [, orderId, direction, lotSize, instrument, price] = orderMatch;

        // Extract execution details
        const execTimeMatch = content.match(/Execution time:(\d+) ms/);
        const slippageMatch = content.match(/Slippage:([+-]?\d+)/);

        // Create order object
        const order = {
            id: orderId,
            broker,
            direction: direction.toLowerCase(),
            lotSize: parseFloat(lotSize),
            instrument,
            openPrice: parseFloat(price),
            openTimestamp: timestamp,
            executionTime: execTimeMatch ? parseInt(execTimeMatch[1]) : null,
            slippage: slippageMatch ? parseInt(slippageMatch[1]) : null,
            status: 'open',
            isVirtual: content.includes("Virtual order") || instrument.includes(".r")
        };

        // Store the order
        this.orderMap.set(orderId, order);

        // If we have a current sequence part, add this order to it
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            
            if (!currentPart.orders) {
                currentPart.orders = [];
            }
            
            currentPart.orders.push(order);
            currentPart.logLines.push({ timestamp, content });
        }
    }

    /**
     * Handle order modification (SL/TP)
     */
    handleOrderModified(timestamp, content) {
        // Extract order ID
        const orderIdMatch = content.match(/Order #(\d+)/);
        if (!orderIdMatch) return;

        const orderId = orderIdMatch[1];

        // Extract SL/TP values
        const slTpMatch = content.match(/SL=(\d+\.\d+) and TP=(\d+\.\d+)/);
        if (!slTpMatch) return;

        const [, stopLoss, takeProfit] = slTpMatch;

        // Update the order if we have it
        const order = this.orderMap.get(orderId);
        if (order) {
            order.stopLoss = parseFloat(stopLoss);
            order.takeProfit = parseFloat(takeProfit);
        }

        // Add to current sequence part logs
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            currentPart.logLines.push({ timestamp, content });
        }
    }

    /**
     * Handle trailing stop modification
     */
    handleTrailingStopModified(timestamp, content) {
        // Extract order ID
        const orderIdMatch = content.match(/order #(\d+)/);
        if (!orderIdMatch) return;

        const orderId = orderIdMatch[1];

        // Extract new SL and current price
        const slPriceMatch = content.match(/to (\d+\.\d+) \(Trailing\). Current price=(\d+\.\d+)/);
        if (!slPriceMatch) return;

        const [, newStopLoss, currentPrice] = slPriceMatch;

        // Update the order if we have it
        const order = this.orderMap.get(orderId);
        if (order) {
            order.stopLoss = parseFloat(newStopLoss);
            order.lastPrice = parseFloat(currentPrice);
            
            // Track trailing stop adjustments
            if (!order.trailingStopAdjustments) {
                order.trailingStopAdjustments = [];
            }
            
            order.trailingStopAdjustments.push({
                timestamp,
                stopLoss: parseFloat(newStopLoss),
                currentPrice: parseFloat(currentPrice)
            });
        }

        // Add to current sequence part logs
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            currentPart.logLines.push({ timestamp, content });
        }
    }

    /**
     * Handle stop loss trigger
     */
    handleStopLossTrigger(timestamp, content) {
        // Extract order ID
        const orderIdMatch = content.match(/order #(\d+)/);
        if (!orderIdMatch) return;

        const orderId = orderIdMatch[1];

        // Extract SL and trigger price
        const priceMatch = content.match(/StopLoss (\d+\.\d+) was trigged at price (\d+\.\d+)/);
        if (!priceMatch) return;

        const [, stopLoss, triggerPrice] = priceMatch;

        // Update the order if we have it
        const order = this.orderMap.get(orderId);
        if (order) {
            order.stopLossTriggered = true;
            order.stopLossTriggerPrice = parseFloat(triggerPrice);
        }

        // Add to current sequence part logs
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            currentPart.logLines.push({ timestamp, content });
        }
    }

    /**
     * Handle order locked
     */
    handleOrderLocked(timestamp, content) {
        // Extract order IDs
        const orderIdsMatch = content.match(/Order #(\d+) was locked with order #(\d+)/);
        if (!orderIdsMatch) return;

        const [, orderId1, orderId2] = orderIdsMatch;

        // Update the orders if we have them
        const order1 = this.orderMap.get(orderId1);
        const order2 = this.orderMap.get(orderId2);

        if (order1) {
            order1.lockedWithOrderId = orderId2;
        }

        if (order2) {
            order2.lockedWithOrderId = orderId1;
        }

        // Add to current sequence part logs
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            currentPart.logLines.push({ timestamp, content });
            currentPart.locked = true;
        }
    }

    /**
     * Handle order closed
     */
    handleOrderClosed(timestamp, content) {
        // Extract broker name if present
        let broker = null;
        const brokerMatch = content.match(/\[([^\]]+)\]:/);
        if (brokerMatch) {
            broker = brokerMatch[1];
            this.brokerNames.add(broker);
        }

        // Extract order ID
        const orderIdMatch = content.match(/Order #(\d+)/);
        if (!orderIdMatch) return;

        const orderId = orderIdMatch[1];

        // Extract close price and reason
        const priceMatch = content.match(/at price (\d+\.\d+)/);
        const closePrice = priceMatch ? parseFloat(priceMatch[1]) : null;

        // Extract execution details if present
        const execTimeMatch = content.match(/Execution time: (\d+) ms/);
        const slippageMatch = content.match(/Slippage: ([+-]?\d+)/);

        // Determine close reason
        let closeReason = 'unknown';
        if (content.includes('closed by arbitrage')) {
            closeReason = 'arbitrage';
        } else if (content.includes('closed by lock')) {
            closeReason = 'lock';
        }

        // Update the order if we have it
        const order = this.orderMap.get(orderId);
        if (order) {
            order.status = 'closed';
            order.closePrice = closePrice;
            order.closeTimestamp = timestamp;
            order.closeReason = closeReason;
            
            if (execTimeMatch) {
                order.closeExecutionTime = parseInt(execTimeMatch[1]);
            }
            
            if (slippageMatch) {
                order.closeSlippage = parseInt(slippageMatch[1]);
            }

            // Calculate profit
            if (order.openPrice && order.closePrice) {
                if (order.direction === 'buy') {
                    order.profit = (order.closePrice - order.openPrice) * 100 * order.lotSize;
                } else {
                    order.profit = (order.openPrice - order.closePrice) * 100 * order.lotSize;
                }
            }
        }

        // Add to current sequence part logs
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            currentPart.logLines.push({ timestamp, content });
            
            // Mark this part as completed if it's an arbitrage close
            if (closeReason === 'arbitrage') {
                currentPart.completed = true;
            }
        }
    }

    /**
     * Handle virtual order created
     */
    handleVirtualOrderCreated(timestamp, content) {
        // Extract order details
        const orderMatch = content.match(/exoid:(\d+) (buy|sell) MARKET (\d+\.\d+) ([A-Z\.]+) at (\d+\.\d+)/i);
        if (!orderMatch) return;

        const [, orderId, direction, lotSize, instrument, price] = orderMatch;

        // Create virtual order object
        const virtualOrder = {
            id: orderId,
            direction: direction.toLowerCase(),
            lotSize: parseFloat(lotSize),
            instrument,
            price: parseFloat(price),
            timestamp,
            isVirtual: true
        };

        // Store the virtual order
        this.virtualOrderMap.set(orderId, virtualOrder);

        // If we have a current sequence, start a new part
        if (this.currentSequence) {
            // If the last part is completed, create a new one
            if (this.currentSequence.parts.length === 0 || 
                this.currentSequence.parts[this.currentSequence.parts.length - 1].completed) {
                this.currentSequence.parts.push(this.createNewSequencePart());
            }
            
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            currentPart.virtualOrders = currentPart.virtualOrders || [];
            currentPart.virtualOrders.push(virtualOrder);
            currentPart.logLines.push({ timestamp, content });
        }
    }

    /**
     * Handle virtual order removed
     */
    handleVirtualOrderRemoved(timestamp, content) {
        // Extract order ID and profit
        const orderIdMatch = content.match(/Virtual order #(\d+) was removed/);
        if (!orderIdMatch) return;

        const orderId = orderIdMatch[1];

        // Extract profit if present
        const profitMatch = content.match(/Profit: ([+-]?\d+\.\d+)/);
        const profit = profitMatch ? parseFloat(profitMatch[1]) : null;

        // Update the virtual order if we have it
        const virtualOrder = this.virtualOrderMap.get(orderId);
        if (virtualOrder) {
            virtualOrder.removed = true;
            virtualOrder.profit = profit;
        }

        // If we have a current sequence part, mark it as completed
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            currentPart.logLines.push({ timestamp, content });
            currentPart.completed = true;
            
            // Check if this completes the sequence
            if (this.isSequenceComplete()) {
                this.finalizeCurrentSequence();
            }
        }
    }

    /**
     * Check if the current sequence is complete
     */
    isSequenceComplete() {
        if (!this.currentSequence || this.currentSequence.parts.length === 0) {
            return false;
        }

        // A sequence is complete if all parts are completed
        return this.currentSequence.parts.every(part => part.completed);
    }

    /**
     * Finalize the current sequence and prepare for the next one
     */
    finalizeCurrentSequence() {
        if (!this.currentSequence) return;

        // Calculate sequence totals
        this.calculateSequenceTotals(this.currentSequence);
        
        // Add the sequence to our list
        this.sequences.push(this.currentSequence);
        
        // Reset current sequence
        this.currentSequence = null;
    }

    /**
     * Calculate totals for a sequence
     */
    calculateSequenceTotals(sequence) {
        let totalProfit = 0;
        let totalCommission = 0;
        const brokerStats = new Map();

        // Process each part
        for (const part of sequence.parts) {
            let partProfit = 0;
            let partCommission = 0;

            // Find paired orders for arbitrage calculation
            if (part.orders && part.orders.length >= 2) {
                // Sort orders by timestamp to ensure proper pairing
                const sortedOrders = [...part.orders].sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp));
                
                // For XAUUSD arbitrage, we need to find the price difference between paired orders
                if (sortedOrders.length >= 2 && 
                    sortedOrders[0].instrument && 
                    sortedOrders[0].instrument.toUpperCase().includes('XAUUSD')) {
                    
                    // Calculate price difference between the paired orders
                    const firstOrder = sortedOrders[0];
                    const secondOrder = sortedOrders[1];
                    
                    if (firstOrder.openPrice && secondOrder.openPrice) {
                        // Calculate the price difference (absolute value)
                        const priceDiff = Math.abs(secondOrder.openPrice - firstOrder.openPrice);
                        
                        // For XAUUSD: Each 0.01 point = 1 cent per 0.01 lot
                        partProfit = priceDiff * 100 * firstOrder.lotSize;
                        
                        // Calculate commissions for both brokers (in dollars)
                        // Use broker settings if available, otherwise use defaults
                        const fpCommission = this.getBrokerCommission('FP', 6) / 100; // Convert from dollars per 1.0 lot to dollars per 0.01 lot
                        const icCommission = this.getBrokerCommission('IC', 8) / 100; // Convert from dollars per 1.0 lot to dollars per 0.01 lot
                        
                        if (firstOrder.broker === 'FP') {
                            partCommission += fpCommission;
                            console.log(`Added FP commission for first order: ${fpCommission.toFixed(2)}`);
                        } else if (firstOrder.broker === 'IC') {
                            partCommission += icCommission;
                            console.log(`Added IC commission for first order: ${icCommission.toFixed(2)}`);
                        }
                        
                        if (secondOrder.broker === 'FP') {
                            partCommission += fpCommission;
                            console.log(`Added FP commission for second order: ${fpCommission.toFixed(2)}`);
                        } else if (secondOrder.broker === 'IC') {
                            partCommission += icCommission;
                            console.log(`Added IC commission for second order: ${icCommission.toFixed(2)}`);
                        }
                        
                        console.log(`First order: ${firstOrder.broker} ${firstOrder.direction} at ${firstOrder.openPrice}`);
                        console.log(`Second order: ${secondOrder.broker} ${secondOrder.direction} at ${secondOrder.openPrice}`);
                        console.log(`Price difference: ${priceDiff}, Profit: ${partProfit}, Commission: ${partCommission}`);
                    }
                }
            } else {
                // Process regular orders if not paired
                if (part.orders) {
                    for (const order of part.orders) {
                        if (order.profit) {
                            partProfit += order.profit;
                        }
                    }
                }
            }

            // Process virtual orders
            if (part.virtualOrders) {
                for (const order of part.virtualOrders) {
                    if (order.profit) {
                        partProfit += order.profit;
                    }
                }
            }

            // Track broker stats
            if (part.orders) {
                for (const order of part.orders) {
                    if (order.broker) {
                        if (!brokerStats.has(order.broker)) {
                            brokerStats.set(order.broker, {
                                executionTimes: [],
                                slippages: [],
                                spreads: []
                            });
                        }

                        const stats = brokerStats.get(order.broker);
                        
                        if (order.executionTime) {
                            stats.executionTimes.push(order.executionTime);
                        }
                        
                        if (order.slippage !== null && order.slippage !== undefined) {
                            stats.slippages.push(order.slippage);
                        }
                    }
                }
            }

            // Store part profit and commission
            part.profit = partProfit;
            part.commission = partCommission;

            // Add to sequence totals
            totalProfit += partProfit;
            totalCommission += partCommission;

            // Store spread information from difference detection
            if (part.differenceDetection) {
                const broker = part.differenceDetection.broker;
                if (broker && part.differenceDetection.slowSpread !== null) {
                    if (!brokerStats.has(broker)) {
                        brokerStats.set(broker, {
                            executionTimes: [],
                            slippages: [],
                            spreads: []
                        });
                    }

                    const stats = brokerStats.get(broker);
                    stats.spreads.push(part.differenceDetection.slowSpread);
                }
            }
        }

        // Store sequence totals
        sequence.totalProfit = totalProfit;
        sequence.totalCommission = totalCommission;
        sequence.netProfit = totalProfit - totalCommission;
        sequence.brokerStats = Object.fromEntries(brokerStats);
    }

    /**
     * Create a new sequence object
     */
    createNewSequence() {
        return {
            id: Date.now().toString(),
            parts: [],
            totalProfit: 0,
            totalCommission: 0,
            netProfit: 0
        };
    }

    /**
     * Create a new sequence part object
     */
    createNewSequencePart() {
        return {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            orders: [],
            virtualOrders: [],
            logLines: [],
            completed: false,
            locked: false,
            profit: 0,
            commission: 0
        };
    }

    /**
     * Get the detected broker names
     */
    getBrokerNames() {
        return Array.from(this.brokerNames);
    }
    
    /**
     * Get commission rate for a broker
     * @param {string} broker - Broker name
     * @param {number} defaultRate - Default commission rate if not found
     * @returns {number} - Commission rate
     */
    getBrokerCommission(broker, defaultRate = 0) {
        if (!this.brokerSettings) return defaultRate;
        
        if (this.brokerSettings[broker]) {
            return this.brokerSettings[broker].commission || defaultRate;
        }
        
        return defaultRate;
    }
}

// Export the parser
window.ArbitrageLogParser = ArbitrageLogParser;

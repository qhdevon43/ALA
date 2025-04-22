/**
 * SHARP Trader Log Parser
 * Parses SHARP Trader arbitrage logs to extract sequences and their components
 * Compatible with BB Markets logs format
 */
class SharpTraderLogParser {
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
        // Extract timestamp and content - SHARP Trader uses DD-MM-YYYY format
        const match = line.match(/^(\d+\-\d+\-\d+ \d+:\d+:\d+\.\d+): (.+)$/);
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

        // Check if this is an order opened line
        if (content.includes("order") && content.includes("was opened")) {
            this.handleOrderOpened(timestamp, content);
            return;
        }

        // Check if this is an order modification line (SL/TP)
        if (content.includes("was modified") && content.includes("SL=") && content.includes("TP=")) {
            this.handleOrderModified(timestamp, content);
            return;
        }

        // Check if this is a trailing stop modification
        if (content.includes("Trailing stop") && content.includes("was changed")) {
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
        if (content.includes("was closed")) {
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
        // Extract broker name - SHARP Trader format: [BB1 - 5078452]:
        const brokerMatch = content.match(/\[([^\]]+)\]:/);
        if (!brokerMatch) return;
        
        // Clean broker name by removing ID number
        const fullBrokerName = brokerMatch[1];
        const broker = fullBrokerName.split('-')[0].trim();
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
        
        const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
        
        // Record the difference detection
        currentPart.differenceDetection = {
            timestamp,
            broker,
            direction,
            actualDiff: parseFloat(actualDiff),
            thresholdDiff: parseFloat(thresholdDiff),
            spread: spreadMatch ? {
                fast: parseFloat(spreadMatch[1]),
                slow: parseFloat(spreadMatch[2])
            } : null,
            bid: bidMatch ? {
                fast: parseFloat(bidMatch[1]),
                slow: parseFloat(bidMatch[2])
            } : null,
            ask: askMatch ? {
                fast: parseFloat(askMatch[1]),
                slow: parseFloat(askMatch[2])
            } : null
        };
    }

    /**
     * Handle order opened line
     */
    handleOrderOpened(timestamp, content) {
        // Extract broker name - SHARP Trader format: [BB1 - 5078452]:
        const brokerMatch = content.match(/\[([^\]]+)\]:/);
        if (!brokerMatch) return;
        
        // Clean broker name by removing ID number
        const fullBrokerName = brokerMatch[1];
        const broker = fullBrokerName.split('-')[0].trim();
        this.brokerNames.add(broker);
        
        // Extract order details
        const orderMatch = content.match(/exoid:(\d+) (buy|sell) (\w+) ([\d\.]+) ([A-Za-z0-9\.]+) at ([\d\.]+)/i);
        if (!orderMatch) return;
        
        const [, orderId, direction, orderType, volume, symbol, price] = orderMatch;
        
        // Extract execution time and slippage if available
        const executionTimeMatch = content.match(/Execution time:(\d+)/);
        const slippageMatch = content.match(/Slippage:(-?\d+)/);
        
        // If we don't have a current sequence or part, create them
        if (!this.currentSequence) {
            this.currentSequence = this.createNewSequence();
            this.currentSequence.parts.push(this.createNewSequencePart());
        } else if (this.currentSequence.parts.length === 0) {
            this.currentSequence.parts.push(this.createNewSequencePart());
        }
        
        const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
        
        // Create order object
        const order = {
            id: orderId,
            timestamp,
            broker,
            direction,
            orderType,
            volume: parseFloat(volume),
            symbol,
            price: parseFloat(price),
            executionTime: executionTimeMatch ? parseInt(executionTimeMatch[1]) : null,
            slippage: slippageMatch ? parseInt(slippageMatch[1]) : null,
            status: 'open'
        };
        
        // Store the order in the map
        this.orderMap.set(orderId, order);
        
        // Add to the current sequence part
        if (direction.toLowerCase() === 'buy') {
            currentPart.buyOrder = order;
        } else {
            currentPart.sellOrder = order;
        }
    }

    /**
     * Handle order modification (SL/TP)
     */
    handleOrderModified(timestamp, content) {
        // Extract order ID and SL/TP values
        const modMatch = content.match(/Order #(\d+).*was modified \(initial virtual SL=([\d\.]+) and TP=([\d\.]+) applied\)/);
        if (!modMatch) return;
        
        const [, orderId, stopLoss, takeProfit] = modMatch;
        
        // Update the order if it exists
        const order = this.orderMap.get(orderId);
        if (order) {
            order.stopLoss = parseFloat(stopLoss);
            order.takeProfit = parseFloat(takeProfit);
        }
    }

    /**
     * Handle trailing stop modification
     */
    handleTrailingStopModified(timestamp, content) {
        // Extract order ID and new trailing stop value
        const tsMatch = content.match(/Trailing stop for order #(\d+).*was changed to ([\d\.]+)/);
        if (!tsMatch) return;
        
        const [, orderId, trailingStop] = tsMatch;
        
        // Update the order if it exists
        const order = this.orderMap.get(orderId);
        if (order) {
            order.trailingStop = parseFloat(trailingStop);
        }
    }

    /**
     * Handle stop loss trigger
     */
    handleStopLossTrigger(timestamp, content) {
        // Extract order ID and trigger price
        const slMatch = content.match(/order #(\d+).*Hidden StopLoss ([\d\.]+) was trigged at price ([\d\.]+)/i);
        if (!slMatch) return;
        
        const [, orderId, stopLoss, triggerPrice] = slMatch;
        
        // Update the order if it exists
        const order = this.orderMap.get(orderId);
        if (order) {
            order.stopLossTriggered = true;
            order.stopLossTriggerPrice = parseFloat(triggerPrice);
        }
    }

    /**
     * Handle order locked
     */
    handleOrderLocked(timestamp, content) {
        // Extract order IDs
        const lockMatch = content.match(/Order #(\d+) was locked with order #(\d+)/);
        if (!lockMatch) return;
        
        const [, orderId1, orderId2] = lockMatch;
        
        // Update the orders if they exist
        const order1 = this.orderMap.get(orderId1);
        const order2 = this.orderMap.get(orderId2);
        
        if (order1) {
            order1.lockedWith = orderId2;
        }
        
        if (order2) {
            order2.lockedWith = orderId1;
        }
        
        // If we have both orders in the current sequence part, mark it as locked
        const currentPart = this.currentSequence && this.currentSequence.parts.length > 0 ? 
            this.currentSequence.parts[this.currentSequence.parts.length - 1] : null;
            
        if (currentPart && currentPart.buyOrder && currentPart.sellOrder) {
            if ((currentPart.buyOrder.id === orderId1 && currentPart.sellOrder.id === orderId2) ||
                (currentPart.buyOrder.id === orderId2 && currentPart.sellOrder.id === orderId1)) {
                currentPart.locked = true;
                currentPart.lockTimestamp = timestamp;
            }
        }
    }

    /**
     * Handle order closed
     */
    handleOrderClosed(timestamp, content) {
        // Extract order ID, close reason, and price
        const closeMatch = content.match(/Order #(\d+).*was closed (by lock|manually|by arbitrage|by stop loss|by take profit) at price ([\d\.]+)/i);
        if (!closeMatch) return;
        
        const [, orderId, closeReason, closePrice] = closeMatch;
        
        // Extract execution time and slippage if available
        const executionTimeMatch = content.match(/Execution time:(\d+)/);
        const slippageMatch = content.match(/Slippage:(-?\d+)/);
        
        // Update the order if it exists
        const order = this.orderMap.get(orderId);
        if (order) {
            order.status = 'closed';
            order.closeTimestamp = timestamp;
            order.closePrice = parseFloat(closePrice);
            order.closeReason = closeReason;
            order.closeExecutionTime = executionTimeMatch ? parseInt(executionTimeMatch[1]) : null;
            order.closeSlippage = slippageMatch ? parseInt(slippageMatch[1]) : null;
            
            // Calculate profit/loss
            if (order.direction.toLowerCase() === 'buy') {
                order.profit = (order.closePrice - order.price) * order.volume * 100; // Assuming 100 points per lot
            } else {
                order.profit = (order.price - order.closePrice) * order.volume * 100;
            }
            
            // Apply commission if available
            const commissionRate = this.getBrokerCommission(order.broker);
            if (commissionRate) {
                order.commission = commissionRate * order.volume;
                order.netProfit = order.profit - order.commission;
            } else {
                order.netProfit = order.profit;
            }
        }
        
        // Check if this completes a sequence part
        const currentPart = this.currentSequence && this.currentSequence.parts.length > 0 ? 
            this.currentSequence.parts[this.currentSequence.parts.length - 1] : null;
            
        if (currentPart && currentPart.buyOrder && currentPart.sellOrder) {
            if (currentPart.buyOrder.id === orderId || currentPart.sellOrder.id === orderId) {
                // Check if both orders are closed
                if ((currentPart.buyOrder.id === orderId && currentPart.sellOrder.status === 'closed') ||
                    (currentPart.sellOrder.id === orderId && currentPart.buyOrder.status === 'closed')) {
                    currentPart.completed = true;
                    currentPart.completionTimestamp = timestamp;
                    
                    // Calculate part totals
                    this.calculatePartTotals(currentPart);
                    
                    // If closed by arbitrage, don't finalize the sequence yet as there might be more parts
                    if (closeReason.includes('arbitrage')) {
                        // Don't finalize the sequence, just mark the part as completed
                        // The next difference detection will start a new part
                    } else {
                        // Check if the sequence is complete
                        if (this.isSequenceComplete()) {
                            this.finalizeCurrentSequence();
                        }
                    }
                }
            }
        }
    }

    /**
     * Handle virtual order created
     */
    handleVirtualOrderCreated(timestamp, content) {
        // Extract virtual order details
        const vOrderMatch = content.match(/Virtual order\s+exoid:(\d+) (buy|sell) (\w+) ([\d\.]+) ([A-Za-z0-9\.]+) at ([\d\.]+)/i);
        if (!vOrderMatch) return;
        
        const [, orderId, direction, orderType, volume, symbol, price] = vOrderMatch;
        
        // Create virtual order object
        const virtualOrder = {
            id: orderId,
            timestamp,
            direction,
            orderType,
            volume: parseFloat(volume),
            symbol,
            price: parseFloat(price),
            status: 'open',
            isVirtual: true
        };
        
        // Store the virtual order
        this.virtualOrderMap.set(orderId, virtualOrder);
        
        // Check if we need to start a new sequence part
        // This typically happens after an order is closed by arbitrage
        if (this.currentSequence && this.currentSequence.parts.length > 0) {
            const lastPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            if (lastPart.completed && lastPart.buyOrder && lastPart.sellOrder) {
                // If the last part was completed by arbitrage, this virtual order is likely part of a new sequence part
                const lastClosedOrder = lastPart.buyOrder.status === 'closed' && lastPart.buyOrder.closeReason === 'by arbitrage' ? 
                    lastPart.buyOrder : (lastPart.sellOrder.status === 'closed' && lastPart.sellOrder.closeReason === 'by arbitrage' ? 
                    lastPart.sellOrder : null);
                
                if (lastClosedOrder && lastClosedOrder.id === orderId) {
                    // This virtual order is related to the previous part
                    // We should be ready for a new part when the next difference is detected
                }
            }
        }
    }

    /**
     * Handle virtual order removed
     */
    handleVirtualOrderRemoved(timestamp, content) {
        // Extract virtual order ID and profit
        const vOrderRemoveMatch = content.match(/Virtual order #(\d+) was removed.*Profit: (-?[\d\.]+)/);
        if (!vOrderRemoveMatch) return;
        
        const [, orderId, profit] = vOrderRemoveMatch;
        
        // Update the virtual order if it exists
        const virtualOrder = this.virtualOrderMap.get(orderId);
        if (virtualOrder) {
            virtualOrder.status = 'removed';
            virtualOrder.removeTimestamp = timestamp;
            virtualOrder.profit = parseFloat(profit);
        }
    }

    /**
     * Check if the current sequence is complete
     */
    isSequenceComplete() {
        if (!this.currentSequence || this.currentSequence.parts.length === 0) {
            return false;
        }
        
        // A sequence is complete if all its parts are completed
        return this.currentSequence.parts.every(part => part.completed);
    }

    /**
     * Finalize the current sequence and prepare for the next one
     */
    finalizeCurrentSequence() {
        if (!this.currentSequence) return;
        
        // Calculate sequence totals
        this.calculateSequenceTotals(this.currentSequence);
        
        // Add to sequences list
        this.sequences.push(this.currentSequence);
        
        // Reset current sequence
        this.currentSequence = null;
    }

    /**
     * Calculate totals for a sequence part
     */
    calculatePartTotals(part) {
        if (!part || !part.buyOrder || !part.sellOrder) return;
        
        // Calculate spread
        part.entrySpread = Math.abs(part.buyOrder.price - part.sellOrder.price);
        part.exitSpread = part.buyOrder.closePrice && part.sellOrder.closePrice ? 
            Math.abs(part.buyOrder.closePrice - part.sellOrder.closePrice) : null;
        
        // Calculate execution times
        part.entryExecutionTime = (part.buyOrder.executionTime || 0) + (part.sellOrder.executionTime || 0);
        part.exitExecutionTime = (part.buyOrder.closeExecutionTime || 0) + (part.sellOrder.closeExecutionTime || 0);
        
        // Calculate slippage
        part.entrySlippage = (part.buyOrder.slippage || 0) + (part.sellOrder.slippage || 0);
        part.exitSlippage = (part.buyOrder.closeSlippage || 0) + (part.sellOrder.closeSlippage || 0);
        
        // Calculate profit
        part.profit = (part.buyOrder.profit || 0) + (part.sellOrder.profit || 0);
        part.commission = (part.buyOrder.commission || 0) + (part.sellOrder.commission || 0);
        part.netProfit = part.profit - part.commission;
        
        // Calculate duration
        if (part.completionTimestamp && part.differenceDetection) {
            const startTime = new Date(part.differenceDetection.timestamp.replace(/\./g, '/'));
            const endTime = new Date(part.completionTimestamp.replace(/\./g, '/'));
            part.duration = (endTime - startTime) / 1000; // Duration in seconds
        }
    }

    /**
     * Calculate totals for a sequence
     */
    calculateSequenceTotals(sequence) {
        if (!sequence || sequence.parts.length === 0) return;
        
        // Initialize totals
        sequence.totalProfit = 0;
        sequence.totalCommission = 0;
        sequence.totalNetProfit = 0;
        sequence.totalDuration = 0;
        sequence.totalEntryExecutionTime = 0;
        sequence.totalExitExecutionTime = 0;
        sequence.totalEntrySlippage = 0;
        sequence.totalExitSlippage = 0;
        
        // Sum up part totals
        for (const part of sequence.parts) {
            sequence.totalProfit += part.profit || 0;
            sequence.totalCommission += part.commission || 0;
            sequence.totalNetProfit += part.netProfit || 0;
            sequence.totalDuration += part.duration || 0;
            sequence.totalEntryExecutionTime += part.entryExecutionTime || 0;
            sequence.totalExitExecutionTime += part.exitExecutionTime || 0;
            sequence.totalEntrySlippage += part.entrySlippage || 0;
            sequence.totalExitSlippage += part.exitSlippage || 0;
        }
        
        // Calculate averages
        sequence.avgEntryExecutionTime = sequence.parts.length > 0 ? 
            sequence.totalEntryExecutionTime / sequence.parts.length : 0;
        sequence.avgExitExecutionTime = sequence.parts.length > 0 ? 
            sequence.totalExitExecutionTime / sequence.parts.length : 0;
        sequence.avgEntrySlippage = sequence.parts.length > 0 ? 
            sequence.totalEntrySlippage / sequence.parts.length : 0;
        sequence.avgExitSlippage = sequence.parts.length > 0 ? 
            sequence.totalExitSlippage / sequence.parts.length : 0;
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
            totalNetProfit: 0
        };
    }

    /**
     * Create a new sequence part object
     */
    createNewSequencePart() {
        return {
            differenceDetection: null,
            buyOrder: null,
            sellOrder: null,
            locked: false,
            completed: false,
            profit: 0,
            commission: 0,
            netProfit: 0
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
        if (!broker || !this.brokerSettings) return defaultRate;
        
        // Try to find the broker in settings
        for (const key in this.brokerSettings) {
            if (this.brokerSettings[key].name === broker) {
                return this.brokerSettings[key].commission || defaultRate;
            }
        }
        
        return defaultRate;
    }
}

// Export the parser
window.SharpTraderLogParser = SharpTraderLogParser;

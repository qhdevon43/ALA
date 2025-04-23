/**
 * SHARP Trader Log Parser v8.2
 * With fixed multi-part sequence detection
 */
class SharpTraderLogParser {
    constructor() {
        this.brokerNames = new Set();
        this.orderMap = new Map();
        this.virtualOrderMap = new Map();
        this.sequences = [];
        this.currentSequence = null;
        this.brokerSettings = {};
        this.globalSettings = {};
        this.pendingArbitrageOrderId = null;
        this.debug = false;
    }

    setDebug(debug) {
        this.debug = debug;
    }

    log(message) {
        if (this.debug) {
            console.log(message);
        }
    }

    setBrokerSettings(settings) {
        this.brokerSettings = settings;
    }

    setGlobalSettings(settings) {
        this.globalSettings = settings;
    }

    parseLog(logText) {
        this.log("Starting to parse log");
        
        // Reset state
        this.brokerNames = new Set();
        this.orderMap = new Map();
        this.virtualOrderMap = new Map();
        this.sequences = [];
        this.currentSequence = null;
        this.pendingArbitrageOrderId = null;

        // Split the log into lines and reverse to process chronologically
        const lines = logText.split('\n').filter(line => line.trim() !== '');
        const chronologicalLines = [...lines].reverse();

        // Create a new sequence
        this.currentSequence = {
            parts: [],
            totalNetProfit: 0
        };
        this.sequences.push(this.currentSequence);

        // Process each line
        for (const line of chronologicalLines) {
            // Extract timestamp and content
            const match = line.match(/^(\d+\-\d+\-\d+ \d+:\d+:\d+\.\d+): (.+)$/);
            if (!match) continue;
            
            const [, timestamp, content] = match;
            
            // Strategy started
            if (content.includes("Strategy started")) {
                this.log("Found strategy start");
                continue;
            }
            
            // Difference detection
            if (content.includes("difference") && content.includes("points detected")) {
                this.handleDifferenceDetection(timestamp, content);
                continue;
            }
            
            // Order opened
            if (content.includes("order") && content.includes("was opened")) {
                this.handleOrderOpened(timestamp, content);
                continue;
            }
            
            // Order closed
            if (content.includes("was closed")) {
                this.handleOrderClosed(timestamp, content);
                continue;
            }
            
            // Virtual order created
            if (content.includes("Virtual order") && content.includes("was created")) {
                this.handleVirtualOrderCreated(timestamp, content);
                continue;
            }
            
            // Virtual order removed
            if (content.includes("Virtual order") && content.includes("was removed")) {
                this.handleVirtualOrderRemoved(timestamp, content);
                continue;
            }
            
            // Order locked with another order
            if (content.includes("was locked with order")) {
                this.handleOrderLocked(timestamp, content);
                continue;
            }
        }
        
        // Calculate sequence totals
        this.calculateSequenceTotals();
        
        return this.sequences;
    }
    
    handleDifferenceDetection(timestamp, content) {
        // Extract broker
        const brokerMatch = content.match(/\[([^\]]+)\]:/);
        if (!brokerMatch) return;
        
        const fullBrokerName = brokerMatch[1];
        const broker = fullBrokerName.split('-')[0].trim();
        this.brokerNames.add(broker);
        
        // Extract direction
        const dirMatch = content.match(/(Buy|Sell) difference/);
        if (!dirMatch) return;
        
        const direction = dirMatch[1];
        
        // Extract actual and threshold differences
        const diffMatch = content.match(/difference (\d+\.\d+)\((\d+\.\d+)\)/);
        if (!diffMatch) return;
        
        const [, actualDiff, thresholdDiff] = diffMatch;
        
        this.log(`Found ${direction} difference detection for ${broker}`);
        
        // Extract spread, bid, ask details
        const spreadMatch = content.match(/Spread Fast\/Slow:(\d+\.\d+)\/(\d+\.\d+)/);
        const bidMatch = content.match(/Bid Fast\/Slow:(\d+\.\d+)\/(\d+\.\d+)/);
        const askMatch = content.match(/Ask Fast\/Slow:(\d+\.\d+)\/(\d+\.\d+)/);

        // Create difference detection object
        const differenceDetection = {
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

        // Check if we need to create a new part
        if (this.currentSequence.parts.length === 0) {
            // This is the first part
            const newPart = this.createNewSequencePart();
            newPart.differenceDetection = differenceDetection;
            this.currentSequence.parts.push(newPart);
            this.log("Creating part 1");
        } else if (this.pendingArbitrageOrderId) {
            // This is a second part after an arbitrage closure
            const newPart = this.createNewSequencePart();
            newPart.isSecondPart = true;
            newPart.relatedOrderId = this.pendingArbitrageOrderId;
            newPart.differenceDetection = differenceDetection;
            this.currentSequence.parts.push(newPart);
            this.log(`Creating part 2 related to order #${this.pendingArbitrageOrderId}`);
            this.pendingArbitrageOrderId = null; // Clear it after creating part 2
        } else {
            // Update existing part if not completed
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            
            if (!currentPart.completed) {
                currentPart.differenceDetection = differenceDetection;
                this.log("Updated existing part with difference detection");
            } else {
                // If the current part is completed, create a new part
                const newPart = this.createNewSequencePart();
                newPart.differenceDetection = differenceDetection;
                this.currentSequence.parts.push(newPart);
                this.log("Created new part after completed part");
            }
        }
    }

    handleOrderOpened(timestamp, content) {
        // Extract broker name
        const brokerMatch = content.match(/\[([^\]]+)\]:/);
        if (!brokerMatch) return;
        
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
        
        this.log(`Found ${direction} order opened: #${orderId} on ${broker}`);
        
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
        
        // Store the order
        this.orderMap.set(orderId, order);
        
        // Add to current part if it exists
        if (this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            
            if (!currentPart.completed) {
                if (direction.toLowerCase() === 'buy') {
                    currentPart.buyOrder = order;
                } else {
                    currentPart.sellOrder = order;
                }
                this.log(`Added ${direction} order to current part`);
            }
        }
    }

    handleOrderClosed(timestamp, content) {
        // Extract order ID and close reason
        const closeMatch = content.match(/Order #(\d+).*was closed (by lock|manually|by arbitrage|by stop loss|by take profit) at price ([\\d\\.]+)/i);
        if (!closeMatch) return;
        
        const [, orderId, closeReason, closePrice] = closeMatch;
        
        this.log(`Found order closed: #${orderId} ${closeReason}`);
        
        // Extract execution time and slippage if available
        const executionTimeMatch = content.match(/Execution time:(\d+)/);
        const slippageMatch = content.match(/Slippage:(-?\d+)/);
        
        // Update order status
        const order = this.orderMap.get(orderId);
        if (order) {
            order.status = 'closed';
            order.closeTimestamp = timestamp;
            order.closeReason = closeReason;
            order.closePrice = parseFloat(closePrice);
            
            if (executionTimeMatch) {
                order.closeExecutionTime = parseInt(executionTimeMatch[1]);
            }
            
            if (slippageMatch) {
                order.closeSlippage = parseInt(slippageMatch[1]);
            }
            
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
            
            // If closed by arbitrage, mark for potential continuation
            if (closeReason === 'by arbitrage') {
                order.closedByArbitrage = true;
                this.pendingArbitrageOrderId = orderId;
                this.log(`Order #${orderId} closed by arbitrage - marked for multi-part sequence`);
                
                // Mark the current part as completed
                if (this.currentSequence.parts.length > 0) {
                    const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
                    if ((currentPart.buyOrder && currentPart.buyOrder.id === orderId) || 
                        (currentPart.sellOrder && currentPart.sellOrder.id === orderId)) {
                        currentPart.completed = true;
                        currentPart.completionTimestamp = timestamp;
                        
                        // Store which order was closed by arbitrage
                        if (currentPart.buyOrder && currentPart.buyOrder.id === orderId) {
                            currentPart.orderClosedByArbitrage = currentPart.buyOrder;
                        } else if (currentPart.sellOrder && currentPart.sellOrder.id === orderId) {
                            currentPart.orderClosedByArbitrage = currentPart.sellOrder;
                        }
                        
                        // Calculate part totals
                        this.calculatePartTotals(currentPart);
                    }
                }
            }
        }
        
        // Check if this completes a sequence part
        if (this.currentSequence.parts.length > 0) {
            const currentPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
            
            if (currentPart.buyOrder && currentPart.sellOrder) {
                if (currentPart.buyOrder.id === orderId || currentPart.sellOrder.id === orderId) {
                    // Check if both orders are closed
                    if ((currentPart.buyOrder.id === orderId && currentPart.sellOrder.status === 'closed') ||
                        (currentPart.sellOrder.id === orderId && currentPart.buyOrder.status === 'closed')) {
                        currentPart.completed = true;
                        currentPart.completionTimestamp = timestamp;
                        
                        this.log(`Part ${this.currentSequence.parts.length} completed`);
                        
                        // Calculate part totals
                        this.calculatePartTotals(currentPart);
                    }
                }
            }
        }
    }

    handleVirtualOrderCreated(timestamp, content) {
        // Extract virtual order details
        const vOrderMatch = content.match(/Virtual order\s+exoid:(\d+) (buy|sell) (\w+) ([\d\.]+) ([A-Za-z0-9\.]+) at ([\d\.]+)/i);
        if (!vOrderMatch) return;
        
        const [, orderId, direction, orderType, volume, symbol, price] = vOrderMatch;
        
        this.log(`Found virtual order created: #${orderId} ${direction} at ${price}`);
        
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
        
        // Check if this virtual order is related to a pending arbitrage order
        if (this.pendingArbitrageOrderId === orderId) {
            virtualOrder.continuesFromOrderId = this.pendingArbitrageOrderId;
            this.log(`Virtual order #${orderId} is continuation of pending arbitrage order`);
            
            // If we don't already have a second part, create one
            if (this.currentSequence.parts.length === 1 || 
                !this.currentSequence.parts[this.currentSequence.parts.length - 1].isSecondPart) {
                const newPart = this.createNewSequencePart();
                newPart.isSecondPart = true;
                newPart.relatedOrderId = orderId;
                
                // Add the virtual order
                if (direction.toLowerCase() === 'buy') {
                    newPart.buyOrder = virtualOrder;
                } else {
                    newPart.sellOrder = virtualOrder;
                }
                
                this.currentSequence.parts.push(newPart);
                this.log(`Created new second part for virtual order #${orderId}`);
            } else {
                // Add to existing second part
                const secondPart = this.currentSequence.parts[this.currentSequence.parts.length - 1];
                if (direction.toLowerCase() === 'buy') {
                    secondPart.buyOrder = virtualOrder;
                } else {
                    secondPart.sellOrder = virtualOrder;
                }
                this.log(`Added virtual order to existing second part`);
            }
        }
    }

    handleVirtualOrderRemoved(timestamp, content) {
        // Extract virtual order ID and profit
        const vOrderRemoveMatch = content.match(/Virtual order #(\d+) was removed.*Profit:(-?[\d\.]+)/);
        if (!vOrderRemoveMatch) return;
        
        const [, orderId, profit] = vOrderRemoveMatch;
        
        this.log(`Found virtual order removed: #${orderId} profit: ${profit}`);
        
        // Update the virtual order if it exists
        const virtualOrder = this.virtualOrderMap.get(orderId);
        if (virtualOrder) {
            virtualOrder.status = 'removed';
            virtualOrder.removeTimestamp = timestamp;
            virtualOrder.profit = parseFloat(profit);
            
            // Find the part that contains this virtual order
            for (const part of this.currentSequence.parts) {
                if ((part.buyOrder && part.buyOrder.id === orderId) || 
                    (part.sellOrder && part.sellOrder.id === orderId)) {
                    
                    part.virtualOrderProfit = parseFloat(profit);
                    this.log(`Added virtual order profit ${profit} to part`);
                    
                    // Mark the part as completed
                    part.completed = true;
                    part.completionTimestamp = timestamp;
                    
                    // Calculate part totals
                    this.calculatePartTotals(part);
                    
                    break;
                }
            }
        }
    }

    handleOrderLocked(timestamp, content) {
        // Extract order IDs
        const lockMatch = content.match(/Order #(\d+) was locked with order #(\d+)/);
        if (!lockMatch) return;
        
        const [, orderId1, orderId2] = lockMatch;
        
        this.log(`Found order locked: #${orderId1} with #${orderId2}`);
        
        // Update orders if they exist
        const order1 = this.orderMap.get(orderId1);
        const order2 = this.orderMap.get(orderId2);
        
        if (order1) {
            order1.lockedWithOrderId = orderId2;
        }
        
        if (order2) {
            order2.lockedWithOrderId = orderId1;
        }
    }

    createNewSequencePart() {
        return {
            differenceDetection: null,
            buyOrder: null,
            sellOrder: null,
            completed: false,
            isSecondPart: false,
            relatedOrderId: null,
            netProfit: 0
        };
    }

    calculatePartTotals(part) {
        let totalProfit = 0;
        let totalCommission = 0;
        
        if (part.buyOrder && part.buyOrder.status === 'closed') {
            totalProfit += part.buyOrder.profit || 0;
            totalCommission += part.buyOrder.commission || 0;
        }
        
        if (part.sellOrder && part.sellOrder.status === 'closed') {
            totalProfit += part.sellOrder.profit || 0;
            totalCommission += part.sellOrder.commission || 0;
        }
        
        if (part.virtualOrderProfit) {
            totalProfit += part.virtualOrderProfit;
        }
        
        part.grossProfit = totalProfit;
        part.totalCommission = totalCommission;
        part.netProfit = totalProfit - totalCommission;
        
        this.log(`Calculated part totals: gross=${totalProfit}, commission=${totalCommission}, net=${part.netProfit}`);
    }

    calculateSequenceTotals() {
        for (const sequence of this.sequences) {
            let totalNetProfit = 0;
            
            for (const part of sequence.parts) {
                if (part.completed) {
                    totalNetProfit += part.netProfit || 0;
                }
            }
            
            sequence.totalNetProfit = totalNetProfit;
            this.log(`Calculated sequence total net profit: ${totalNetProfit}`);
        }
    }

    getBrokerNames() {
        return Array.from(this.brokerNames);
    }
    
    getBrokerCommission(broker) {
        if (this.brokerSettings[broker] && this.brokerSettings[broker].commission) {
            return this.brokerSettings[broker].commission;
        }
        return null;
    }
}

// Export the parser
window.SharpTraderLogParser = SharpTraderLogParser;

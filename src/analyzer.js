/**
 * Arbitrage Log Analyzer
 * Analyzes parsed arbitrage sequences to calculate metrics and statistics
 */

class ArbitrageLogAnalyzer {
    constructor() {
        this.brokerSettings = {};
        this.globalSettings = {};
    }

    /**
     * Set broker settings
     * @param {Object} settings - Broker settings object
     */
    setBrokerSettings(settings) {
        this.brokerSettings = settings;
    }

    /**
     * Set global settings
     * @param {Object} settings - Global settings object
     */
    setGlobalSettings(settings) {
        this.globalSettings = settings;
    }

    /**
     * Analyze parsed sequences
     * @param {Array} sequences - Array of parsed sequences
     * @returns {Object} - Analysis results
     */
    analyzeSequences(sequences) {
        if (!sequences || sequences.length === 0) {
            return {
                summary: this.createEmptySummary(),
                sequenceAnalysis: [],
                brokerAnalysis: {}
            };
        }

        // Calculate sequence-level metrics
        const sequenceAnalysis = sequences.map(sequence => this.analyzeSequence(sequence));
        
        // Calculate overall summary
        const summary = this.calculateSummary(sequenceAnalysis);
        
        // Calculate broker-specific analysis
        const brokerAnalysis = this.analyzeBrokers(sequences, sequenceAnalysis);

        return {
            summary,
            sequenceAnalysis,
            brokerAnalysis
        };
    }

    /**
     * Create an empty summary object
     * @returns {Object} - Empty summary
     */
    createEmptySummary() {
        return {
            totalSequences: 0,
            profitableSequences: 0,
            lossSequences: 0,
            breakEvenSequences: 0,
            totalProfit: 0,
            totalCommission: 0,
            netProfit: 0,
            averageProfit: 0,
            averageLoss: 0,
            profitFactor: 0,
            winRate: 0,
            largestProfit: 0,
            largestLoss: 0
        };
    }

    /**
     * Analyze a single sequence
     * @param {Object} sequence - A parsed sequence
     * @returns {Object} - Sequence analysis
     */
    analyzeSequence(sequence) {
        const analysis = {
            sequenceId: sequence.id,
            parts: [],
            totalProfit: 0,
            totalCommission: 0,
            netProfit: 0,
            brokers: new Set(),
            instruments: new Set(),
            executionTimes: [],
            slippages: [],
            spreads: [],
            differentials: [],
            trailingStopAdjustments: 0,
            stopLossHits: 0,
            duration: 0
        };

        // Process each part of the sequence
        for (const part of sequence.parts) {
            const partAnalysis = this.analyzeSequencePart(part);
            analysis.parts.push(partAnalysis);
            
            // Aggregate metrics
            analysis.totalProfit += partAnalysis.profit;
            analysis.totalCommission += partAnalysis.commission;
            
            // Collect brokers and instruments
            if (partAnalysis.brokers) {
                partAnalysis.brokers.forEach(broker => analysis.brokers.add(broker));
            }
            
            if (partAnalysis.instruments) {
                partAnalysis.instruments.forEach(instrument => analysis.instruments.add(instrument));
            }
            
            // Collect execution metrics
            if (partAnalysis.executionTimes) {
                analysis.executionTimes = analysis.executionTimes.concat(partAnalysis.executionTimes);
            }
            
            if (partAnalysis.slippages) {
                analysis.slippages = analysis.slippages.concat(partAnalysis.slippages);
            }
            
            if (partAnalysis.spreads) {
                analysis.spreads = analysis.spreads.concat(partAnalysis.spreads);
            }
            
            // Track differentials
            if (partAnalysis.differential) {
                analysis.differentials.push(partAnalysis.differential);
            }
            
            // Track trailing stop adjustments
            analysis.trailingStopAdjustments += partAnalysis.trailingStopAdjustments || 0;
            
            // Track stop loss hits
            analysis.stopLossHits += partAnalysis.stopLossHit ? 1 : 0;
        }

        // Calculate net profit
        analysis.netProfit = analysis.totalProfit - analysis.totalCommission;
        
        // Convert sets to arrays
        analysis.brokers = Array.from(analysis.brokers);
        analysis.instruments = Array.from(analysis.instruments);
        
        // Calculate duration if possible
        if (sequence.parts.length > 0) {
            const firstPart = sequence.parts[0];
            const lastPart = sequence.parts[sequence.parts.length - 1];
            
            if (firstPart.logLines && firstPart.logLines.length > 0 && 
                lastPart.logLines && lastPart.logLines.length > 0) {
                
                const firstTimestamp = this.parseTimestamp(firstPart.logLines[0].timestamp);
                const lastTimestamp = this.parseTimestamp(lastPart.logLines[lastPart.logLines.length - 1].timestamp);
                
                if (firstTimestamp && lastTimestamp) {
                    analysis.duration = (lastTimestamp - firstTimestamp) / 1000; // in seconds
                }
            }
        }

        // Calculate commissions based on broker settings
        analysis.calculatedCommission = this.calculateCommissions(analysis);
        analysis.netProfitWithCalculatedCommission = analysis.totalProfit - analysis.calculatedCommission;

        return analysis;
    }

    /**
     * Analyze a single sequence part
     * @param {Object} part - A sequence part
     * @returns {Object} - Part analysis
     */
    analyzeSequencePart(part) {
        const analysis = {
            partId: part.id,
            profit: part.profit || 0,
            commission: part.commission || 0,
            brokers: new Set(),
            instruments: new Set(),
            executionTimes: [],
            slippages: [],
            spreads: [],
            trailingStopAdjustments: 0,
            stopLossHit: false,
            locked: part.locked || false
        };

        // Process orders
        if (part.orders) {
            for (const order of part.orders) {
                // Track broker and instrument
                if (order.broker) {
                    analysis.brokers.add(order.broker);
                }
                
                if (order.instrument) {
                    analysis.instruments.add(order.instrument);
                }
                
                // Track execution metrics
                if (order.executionTime) {
                    analysis.executionTimes.push(order.executionTime);
                }
                
                if (order.slippage !== null && order.slippage !== undefined) {
                    analysis.slippages.push(order.slippage);
                }
                
                // Track trailing stop adjustments
                if (order.trailingStopAdjustments) {
                    analysis.trailingStopAdjustments += order.trailingStopAdjustments.length;
                }
                
                // Track stop loss hits
                if (order.stopLossTriggered) {
                    analysis.stopLossHit = true;
                }
            }
        }

        // Extract differential from difference detection
        if (part.differenceDetection) {
            analysis.differential = {
                broker: part.differenceDetection.broker,
                direction: part.differenceDetection.direction,
                actual: part.differenceDetection.actualDiff,
                threshold: part.differenceDetection.thresholdDiff,
                fastSpread: part.differenceDetection.fastSpread,
                slowSpread: part.differenceDetection.slowSpread
            };
            
            // Add spread information
            if (part.differenceDetection.slowSpread !== null) {
                analysis.spreads.push(part.differenceDetection.slowSpread);
            }
        }

        // Convert sets to arrays
        analysis.brokers = Array.from(analysis.brokers);
        analysis.instruments = Array.from(analysis.instruments);

        return analysis;
    }

    /**
     * Calculate commissions based on broker settings
     * @param {Object} sequenceAnalysis - Sequence analysis
     * @returns {number} - Calculated commission
     */
    calculateCommissions(sequenceAnalysis) {
        let totalCommission = 0;

        // Process each part
        for (const part of sequenceAnalysis.parts) {
            // Process each broker in the part
            for (const broker of part.brokers) {
                // Get broker commission rate
                const commissionRate = this.getBrokerCommissionRate(broker);
                
                // Find orders for this broker in the part
                const brokerOrders = part.orders ? part.orders.filter(o => o.broker === broker) : [];
                
                // Calculate commission for each order
                for (const order of brokerOrders) {
                    // Commission is based on lot size
                    const orderCommission = (order.lotSize || 0.01) * commissionRate;
                    totalCommission += orderCommission;
                }
            }
        }

        return totalCommission;
    }

    /**
     * Get commission rate for a broker
     * @param {string} broker - Broker name
     * @returns {number} - Commission rate
     */
    getBrokerCommissionRate(broker) {
        // Default to 6 if not specified
        const defaultRate = 6;
        
        // Check if we have settings for this broker
        if (this.brokerSettings && this.brokerSettings[broker]) {
            return this.brokerSettings[broker].commission || defaultRate;
        }
        
        // Check if this is broker1 or broker2
        if (this.brokerSettings.broker1 && this.brokerSettings.broker1.name === broker) {
            return this.brokerSettings.broker1.commission || defaultRate;
        }
        
        if (this.brokerSettings.broker2 && this.brokerSettings.broker2.name === broker) {
            return this.brokerSettings.broker2.commission || defaultRate;
        }
        
        return defaultRate;
    }

    /**
     * Calculate summary statistics
     * @param {Array} sequenceAnalyses - Array of sequence analyses
     * @returns {Object} - Summary statistics
     */
    calculateSummary(sequenceAnalyses) {
        const summary = {
            totalSequences: sequenceAnalyses.length,
            profitableSequences: 0,
            lossSequences: 0,
            breakEvenSequences: 0,
            totalProfit: 0,
            totalCommission: 0,
            netProfit: 0,
            averageProfit: 0,
            averageLoss: 0,
            profitFactor: 0,
            winRate: 0,
            largestProfit: 0,
            largestLoss: 0,
            averageExecutionTime: 0,
            averageSlippage: 0,
            averageSpread: 0
        };

        // Temporary arrays for calculating averages
        const profits = [];
        const losses = [];
        const executionTimes = [];
        const slippages = [];
        const spreads = [];

        // Process each sequence
        for (const analysis of sequenceAnalyses) {
            // Count profitable/loss sequences
            if (analysis.netProfitWithCalculatedCommission > 0.01) {
                summary.profitableSequences++;
                profits.push(analysis.netProfitWithCalculatedCommission);
                
                // Track largest profit
                if (analysis.netProfitWithCalculatedCommission > summary.largestProfit) {
                    summary.largestProfit = analysis.netProfitWithCalculatedCommission;
                }
            } else if (analysis.netProfitWithCalculatedCommission < -0.01) {
                summary.lossSequences++;
                losses.push(analysis.netProfitWithCalculatedCommission);
                
                // Track largest loss
                if (analysis.netProfitWithCalculatedCommission < summary.largestLoss) {
                    summary.largestLoss = analysis.netProfitWithCalculatedCommission;
                }
            } else {
                summary.breakEvenSequences++;
            }
            
            // Aggregate totals
            summary.totalProfit += analysis.totalProfit;
            summary.totalCommission += analysis.calculatedCommission;
            
            // Collect execution metrics
            executionTimes.push(...analysis.executionTimes);
            slippages.push(...analysis.slippages);
            spreads.push(...analysis.spreads);
        }

        // Calculate net profit
        summary.netProfit = summary.totalProfit - summary.totalCommission;
        
        // Calculate averages
        summary.averageProfit = profits.length > 0 ? 
            profits.reduce((sum, val) => sum + val, 0) / profits.length : 0;
            
        summary.averageLoss = losses.length > 0 ? 
            losses.reduce((sum, val) => sum + val, 0) / losses.length : 0;
            
        summary.averageExecutionTime = executionTimes.length > 0 ? 
            executionTimes.reduce((sum, val) => sum + val, 0) / executionTimes.length : 0;
            
        summary.averageSlippage = slippages.length > 0 ? 
            slippages.reduce((sum, val) => sum + val, 0) / slippages.length : 0;
            
        summary.averageSpread = spreads.length > 0 ? 
            spreads.reduce((sum, val) => sum + val, 0) / spreads.length : 0;
        
        // Calculate win rate
        summary.winRate = summary.totalSequences > 0 ? 
            summary.profitableSequences / summary.totalSequences : 0;
        
        // Calculate profit factor
        const totalProfit = profits.reduce((sum, val) => sum + val, 0);
        const totalLoss = Math.abs(losses.reduce((sum, val) => sum + val, 0));
        summary.profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

        return summary;
    }

    /**
     * Analyze broker-specific metrics
     * @param {Array} sequences - Array of parsed sequences
     * @param {Array} sequenceAnalyses - Array of sequence analyses
     * @returns {Object} - Broker analysis
     */
    analyzeBrokers(sequences, sequenceAnalyses) {
        const brokerAnalysis = {};
        
        // Collect all broker names
        const brokerNames = new Set();
        
        for (const analysis of sequenceAnalyses) {
            for (const broker of analysis.brokers) {
                brokerNames.add(broker);
            }
        }
        
        // Initialize broker analysis objects
        for (const broker of brokerNames) {
            brokerAnalysis[broker] = {
                executionTimes: [],
                slippages: [],
                spreads: [],
                differentials: [],
                stopLossHits: 0,
                orders: 0,
                profit: 0,
                commission: 0,
                netProfit: 0
            };
        }
        
        // Process each sequence
        for (const sequence of sequences) {
            // Process each part
            for (const part of sequence.parts) {
                // Process differentials
                if (part.differenceDetection) {
                    const broker = part.differenceDetection.broker;
                    
                    if (broker && brokerAnalysis[broker]) {
                        brokerAnalysis[broker].differentials.push({
                            direction: part.differenceDetection.direction,
                            actual: part.differenceDetection.actualDiff,
                            threshold: part.differenceDetection.thresholdDiff,
                            fastSpread: part.differenceDetection.fastSpread,
                            slowSpread: part.differenceDetection.slowSpread
                        });
                        
                        if (part.differenceDetection.slowSpread !== null) {
                            brokerAnalysis[broker].spreads.push(part.differenceDetection.slowSpread);
                        }
                    }
                }
                
                // Process orders
                if (part.orders) {
                    for (const order of part.orders) {
                        const broker = order.broker;
                        
                        if (broker && brokerAnalysis[broker]) {
                            // Count orders
                            brokerAnalysis[broker].orders++;
                            
                            // Track execution metrics
                            if (order.executionTime) {
                                brokerAnalysis[broker].executionTimes.push(order.executionTime);
                            }
                            
                            if (order.slippage !== null && order.slippage !== undefined) {
                                brokerAnalysis[broker].slippages.push(order.slippage);
                            }
                            
                            // Track stop loss hits
                            if (order.stopLossTriggered) {
                                brokerAnalysis[broker].stopLossHits++;
                            }
                            
                            // Track profit
                            if (order.profit) {
                                brokerAnalysis[broker].profit += order.profit;
                            }
                            
                            // Calculate commission
                            const commissionRate = this.getBrokerCommissionRate(broker);
                            const orderCommission = (order.lotSize || 0.01) * commissionRate;
                            brokerAnalysis[broker].commission += orderCommission;
                        }
                    }
                }
            }
        }
        
        // Calculate averages and net profit for each broker
        for (const broker in brokerAnalysis) {
            const analysis = brokerAnalysis[broker];
            
            analysis.averageExecutionTime = analysis.executionTimes.length > 0 ? 
                analysis.executionTimes.reduce((sum, val) => sum + val, 0) / analysis.executionTimes.length : 0;
                
            analysis.averageSlippage = analysis.slippages.length > 0 ? 
                analysis.slippages.reduce((sum, val) => sum + val, 0) / analysis.slippages.length : 0;
                
            analysis.averageSpread = analysis.spreads.length > 0 ? 
                analysis.spreads.reduce((sum, val) => sum + val, 0) / analysis.spreads.length : 0;
                
            analysis.averageDifferential = analysis.differentials.length > 0 ? 
                analysis.differentials.reduce((sum, diff) => sum + diff.actual, 0) / analysis.differentials.length : 0;
                
            analysis.netProfit = analysis.profit - analysis.commission;
        }
        
        return brokerAnalysis;
    }

    /**
     * Parse timestamp string to Date object
     * @param {string} timestamp - Timestamp string
     * @returns {Date|null} - Date object or null if invalid
     */
    parseTimestamp(timestamp) {
        if (!timestamp) return null;
        
        // Format: DD.MM.YYYY HH:MM:SS.mmm
        const match = timestamp.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+):(\d+)\.(\d+)/);
        if (!match) return null;
        
        const [, day, month, year, hours, minutes, seconds, milliseconds] = match;
        
        return new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day),
            parseInt(hours),
            parseInt(minutes),
            parseInt(seconds),
            parseInt(milliseconds)
        );
    }
}

// Export the analyzer
window.ArbitrageLogAnalyzer = ArbitrageLogAnalyzer;

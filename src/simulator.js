/**
 * Arbitrage Simulator
 * Simulates arbitrage performance with different settings
 */

class ArbitrageSimulator {
    constructor() {
        this.currentSettings = {};
        this.recommendedSettings = {};
    }

    /**
     * Set current settings
     * @param {Object} settings - Current settings object
     */
    setCurrentSettings(settings) {
        this.currentSettings = settings;
    }

    /**
     * Set recommended settings
     * @param {Object} settings - Recommended settings object
     */
    setRecommendedSettings(settings) {
        this.recommendedSettings = settings;
    }

    /**
     * Run simulation with recommended settings
     * @param {Object} analysis - Original analysis results
     * @param {Array} sequences - Original parsed sequences
     * @returns {Object} - Simulation results
     */
    runSimulation(analysis, sequences) {
        if (!sequences || sequences.length === 0 || !analysis) {
            return {
                summary: {
                    currentSettings: {},
                    recommendedSettings: {}
                },
                filteredSequences: [],
                comparison: {}
            };
        }

        // Simulate with current settings
        const currentSimulation = this.simulateWithSettings(sequences, this.currentSettings);
        
        // Simulate with recommended settings
        const recommendedSimulation = this.simulateWithSettings(sequences, this.recommendedSettings);
        
        // Generate comparison
        const comparison = this.generateComparison(currentSimulation, recommendedSimulation);
        
        // Generate filtered sequences (sequences that would be filtered out with recommended settings)
        const filteredSequences = this.identifyFilteredSequences(sequences, this.recommendedSettings);

        return {
            summary: {
                currentSettings: currentSimulation.summary,
                recommendedSettings: recommendedSimulation.summary
            },
            filteredSequences,
            comparison
        };
    }

    /**
     * Simulate arbitrage with specific settings
     * @param {Array} sequences - Original parsed sequences
     * @param {Object} settings - Settings to simulate with
     * @returns {Object} - Simulation results
     */
    simulateWithSettings(sequences, settings) {
        // Clone sequences to avoid modifying originals
        const clonedSequences = JSON.parse(JSON.stringify(sequences));
        
        // Filter sequences based on settings
        const filteredSequences = this.filterSequences(clonedSequences, settings);
        
        // Calculate metrics for filtered sequences
        const summary = this.calculateSummary(filteredSequences, settings);
        
        return {
            sequences: filteredSequences,
            summary
        };
    }

    /**
     * Filter sequences based on settings
     * @param {Array} sequences - Sequences to filter
     * @param {Object} settings - Settings to filter with
     * @returns {Array} - Filtered sequences
     */
    filterSequences(sequences, settings) {
        return sequences.filter(sequence => {
            // Check each part of the sequence
            for (const part of sequence.parts) {
                // Skip if this part doesn't have a difference detection
                if (!part.differenceDetection) continue;
                
                // Get difference detection details
                const diff = part.differenceDetection;
                
                // Check diff threshold
                if (diff.actualDiff < settings.diffThreshold) {
                    return false;
                }
                
                // Check broker-specific min spread
                const broker = diff.broker;
                let minSpread = 0;
                
                if (broker === settings.broker1?.name) {
                    minSpread = settings.broker1.minSpread;
                } else if (broker === settings.broker2?.name) {
                    minSpread = settings.broker2.minSpread;
                }
                
                if (diff.slowSpread < minSpread) {
                    return false;
                }
                
                // Check global max spread
                if (diff.slowSpread > settings.globalMaxSpread) {
                    return false;
                }
                
                // Check fast max spread
                if (diff.fastSpread > settings.fastMaxSpread) {
                    return false;
                }
            }
            
            // If we passed all checks, keep this sequence
            return true;
        });
    }

    /**
     * Calculate summary metrics for filtered sequences
     * @param {Array} sequences - Filtered sequences
     * @param {Object} settings - Settings used for filtering
     * @returns {Object} - Summary metrics
     */
    calculateSummary(sequences, settings) {
        const summary = {
            totalSequences: sequences.length,
            profitableSequences: 0,
            lossSequences: 0,
            breakEvenSequences: 0,
            totalProfit: 0,
            totalCommission: 0,
            netProfit: 0,
            winRate: 0,
            profitFactor: 0,
            averageProfit: 0
        };
        
        if (sequences.length === 0) {
            return summary;
        }
        
        // Temporary arrays for calculations
        const profits = [];
        const losses = [];
        
        // Process each sequence
        for (const sequence of sequences) {
            // Calculate profit and commission
            let sequenceProfit = 0;
            let sequenceCommission = 0;
            
            for (const part of sequence.parts) {
                // Calculate profit from orders
                if (part.orders) {
                    for (const order of part.orders) {
                        // Skip if no profit information
                        if (!order.profit) continue;
                        
                        sequenceProfit += order.profit;
                        
                        // Calculate commission based on settings
                        const broker = order.broker;
                        let commissionRate = 6; // Default
                        
                        if (broker === settings.broker1?.name) {
                            commissionRate = settings.broker1.commission;
                        } else if (broker === settings.broker2?.name) {
                            commissionRate = settings.broker2.commission;
                        }
                        
                        const orderCommission = (order.lotSize || 0.01) * commissionRate;
                        sequenceCommission += orderCommission;
                    }
                }
                
                // Calculate profit from virtual orders
                if (part.virtualOrders) {
                    for (const order of part.virtualOrders) {
                        if (order.profit) {
                            sequenceProfit += order.profit;
                        }
                    }
                }
            }
            
            // Calculate net profit
            const netProfit = sequenceProfit - sequenceCommission;
            
            // Update summary
            summary.totalProfit += sequenceProfit;
            summary.totalCommission += sequenceCommission;
            
            // Categorize sequence
            if (netProfit > 0.01) {
                summary.profitableSequences++;
                profits.push(netProfit);
            } else if (netProfit < -0.01) {
                summary.lossSequences++;
                losses.push(netProfit);
            } else {
                summary.breakEvenSequences++;
            }
        }
        
        // Calculate net profit
        summary.netProfit = summary.totalProfit - summary.totalCommission;
        
        // Calculate win rate
        summary.winRate = summary.totalSequences > 0 ? 
            summary.profitableSequences / summary.totalSequences : 0;
        
        // Calculate profit factor
        const totalProfit = profits.reduce((sum, val) => sum + val, 0);
        const totalLoss = Math.abs(losses.reduce((sum, val) => sum + val, 0));
        summary.profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
        
        // Calculate average profit
        summary.averageProfit = summary.totalSequences > 0 ? 
            summary.netProfit / summary.totalSequences : 0;
        
        return summary;
    }

    /**
     * Generate comparison between current and recommended settings
     * @param {Object} currentSimulation - Simulation with current settings
     * @param {Object} recommendedSimulation - Simulation with recommended settings
     * @returns {Object} - Comparison metrics
     */
    generateComparison(currentSimulation, recommendedSimulation) {
        const current = currentSimulation.summary;
        const recommended = recommendedSimulation.summary;
        
        // Calculate differences
        const sequenceDiff = recommended.totalSequences - current.totalSequences;
        const profitableDiff = recommended.profitableSequences - current.profitableSequences;
        const lossDiff = recommended.lossSequences - current.lossSequences;
        const netProfitDiff = recommended.netProfit - current.netProfit;
        const winRateDiff = recommended.winRate - current.winRate;
        const profitFactorDiff = recommended.profitFactor - current.profitFactor;
        
        // Calculate percentage changes
        const sequencePctChange = current.totalSequences > 0 ? 
            (sequenceDiff / current.totalSequences) * 100 : 0;
            
        const profitablePctChange = current.profitableSequences > 0 ? 
            (profitableDiff / current.profitableSequences) * 100 : 0;
            
        const lossPctChange = current.lossSequences > 0 ? 
            (lossDiff / current.lossSequences) * 100 : 0;
            
        const netProfitPctChange = current.netProfit !== 0 ? 
            (netProfitDiff / Math.abs(current.netProfit)) * 100 : 0;
            
        const winRatePctChange = current.winRate > 0 ? 
            (winRateDiff / current.winRate) * 100 : 0;
            
        const profitFactorPctChange = current.profitFactor > 0 ? 
            (profitFactorDiff / current.profitFactor) * 100 : 0;
        
        return {
            totalSequences: {
                current: current.totalSequences,
                recommended: recommended.totalSequences,
                difference: sequenceDiff,
                percentageChange: sequencePctChange
            },
            profitableSequences: {
                current: current.profitableSequences,
                recommended: recommended.profitableSequences,
                difference: profitableDiff,
                percentageChange: profitablePctChange
            },
            lossSequences: {
                current: current.lossSequences,
                recommended: recommended.lossSequences,
                difference: lossDiff,
                percentageChange: lossPctChange
            },
            netProfit: {
                current: current.netProfit,
                recommended: recommended.netProfit,
                difference: netProfitDiff,
                percentageChange: netProfitPctChange
            },
            winRate: {
                current: current.winRate,
                recommended: recommended.winRate,
                difference: winRateDiff,
                percentageChange: winRatePctChange
            },
            profitFactor: {
                current: current.profitFactor,
                recommended: recommended.profitFactor,
                difference: profitFactorDiff,
                percentageChange: profitFactorPctChange
            }
        };
    }

    /**
     * Identify sequences that would be filtered out with recommended settings
     * @param {Array} sequences - Original sequences
     * @param {Object} settings - Recommended settings
     * @returns {Array} - Filtered out sequences
     */
    identifyFilteredSequences(sequences, settings) {
        return sequences.filter(sequence => {
            // Check if this sequence would be filtered out
            for (const part of sequence.parts) {
                // Skip if this part doesn't have a difference detection
                if (!part.differenceDetection) continue;
                
                // Get difference detection details
                const diff = part.differenceDetection;
                
                // Check diff threshold
                if (diff.actualDiff < settings.diffThreshold) {
                    return true; // Would be filtered out
                }
                
                // Check broker-specific min spread
                const broker = diff.broker;
                let minSpread = 0;
                
                if (broker === settings.broker1?.name) {
                    minSpread = settings.broker1.minSpread;
                } else if (broker === settings.broker2?.name) {
                    minSpread = settings.broker2.minSpread;
                }
                
                if (diff.slowSpread < minSpread) {
                    return true; // Would be filtered out
                }
                
                // Check global max spread
                if (diff.slowSpread > settings.globalMaxSpread) {
                    return true; // Would be filtered out
                }
                
                // Check fast max spread
                if (diff.fastSpread > settings.fastMaxSpread) {
                    return true; // Would be filtered out
                }
            }
            
            // If we passed all checks, this sequence would not be filtered out
            return false;
        }).map(sequence => {
            // Add filtering reason
            const reasons = [];
            
            for (const part of sequence.parts) {
                if (!part.differenceDetection) continue;
                
                const diff = part.differenceDetection;
                
                if (diff.actualDiff < settings.diffThreshold) {
                    reasons.push(`Differential (${diff.actualDiff}) below threshold (${settings.diffThreshold})`);
                }
                
                const broker = diff.broker;
                let minSpread = 0;
                
                if (broker === settings.broker1?.name) {
                    minSpread = settings.broker1.minSpread;
                } else if (broker === settings.broker2?.name) {
                    minSpread = settings.broker2.minSpread;
                }
                
                if (diff.slowSpread < minSpread) {
                    reasons.push(`${broker} spread (${diff.slowSpread}) below min (${minSpread})`);
                }
                
                if (diff.slowSpread > settings.globalMaxSpread) {
                    reasons.push(`${broker} spread (${diff.slowSpread}) above max (${settings.globalMaxSpread})`);
                }
                
                if (diff.fastSpread > settings.fastMaxSpread) {
                    reasons.push(`Fast spread (${diff.fastSpread}) above max (${settings.fastMaxSpread})`);
                }
            }
            
            // Calculate profit information
            let profit = 0;
            let commission = 0;
            
            for (const part of sequence.parts) {
                if (part.orders) {
                    for (const order of part.orders) {
                        if (order.profit) {
                            profit += order.profit;
                        }
                        
                        const broker = order.broker;
                        let commissionRate = 6; // Default
                        
                        if (broker === settings.broker1?.name) {
                            commissionRate = settings.broker1.commission;
                        } else if (broker === settings.broker2?.name) {
                            commissionRate = settings.broker2.commission;
                        }
                        
                        const orderCommission = (order.lotSize || 0.01) * commissionRate;
                        commission += orderCommission;
                    }
                }
                
                if (part.virtualOrders) {
                    for (const order of part.virtualOrders) {
                        if (order.profit) {
                            profit += order.profit;
                        }
                    }
                }
            }
            
            const netProfit = profit - commission;
            
            return {
                sequence,
                filterReasons: reasons,
                profit,
                commission,
                netProfit
            };
        });
    }
}

// Export the simulator
window.ArbitrageSimulator = ArbitrageSimulator;

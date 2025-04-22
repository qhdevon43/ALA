/**
 * Arbitrage Recommendations Generator
 * Generates recommendations for optimizing arbitrage settings based on analysis
 */

class ArbitrageRecommendations {
    constructor() {
        this.currentSettings = {};
    }

    /**
     * Set current settings
     * @param {Object} settings - Current settings object
     */
    setCurrentSettings(settings) {
        this.currentSettings = settings;
    }

    /**
     * Generate recommendations based on analysis
     * @param {Object} analysis - Analysis results
     * @returns {Object} - Recommendations
     */
    generateRecommendations(analysis) {
        if (!analysis || !analysis.summary || !analysis.brokerAnalysis) {
            return {
                settings: this.currentSettings,
                explanations: [],
                filteringAnalysis: [],
                performanceInsights: []
            };
        }

        // Generate recommended settings
        const recommendedSettings = this.generateRecommendedSettings(analysis);
        
        // Generate explanations for recommendations
        const explanations = this.generateExplanations(analysis, recommendedSettings);
        
        // Generate filtering analysis
        const filteringAnalysis = this.generateFilteringAnalysis(analysis);
        
        // Generate performance insights
        const performanceInsights = this.generatePerformanceInsights(analysis);

        return {
            settings: recommendedSettings,
            explanations,
            filteringAnalysis,
            performanceInsights
        };
    }

    /**
     * Generate recommended settings
     * @param {Object} analysis - Analysis results
     * @returns {Object} - Recommended settings
     */
    generateRecommendedSettings(analysis) {
        // Start with current settings
        const recommended = JSON.parse(JSON.stringify(this.currentSettings));
        
        // Get broker names
        const brokerNames = Object.keys(analysis.brokerAnalysis);
        
        // Optimize diff thresholds
        const diffThresholds = this.optimizeDiffThreshold(analysis);
        recommended.diffThreshold = diffThresholds.global;
        
        // Store broker-specific diff thresholds
        if (recommended.broker1) {
            recommended.broker1.diffThreshold = diffThresholds.broker1;
        }
        
        if (recommended.broker2) {
            recommended.broker2.diffThreshold = diffThresholds.broker2;
        }
        
        // Optimize broker-specific settings
        if (brokerNames.length >= 1 && recommended.broker1) {
            const broker1Name = recommended.broker1.name;
            if (analysis.brokerAnalysis[broker1Name]) {
                recommended.broker1.minSpread = this.optimizeMinSpread(analysis, broker1Name);
            }
        }
        
        if (brokerNames.length >= 2 && recommended.broker2) {
            const broker2Name = recommended.broker2.name;
            if (analysis.brokerAnalysis[broker2Name]) {
                recommended.broker2.minSpread = this.optimizeMinSpread(analysis, broker2Name);
            }
        }
        
        // Optimize global max spread
        recommended.globalMaxSpread = this.optimizeGlobalMaxSpread(analysis);
        
        // Optimize fast max spread
        recommended.fastMaxSpread = this.optimizeFastMaxSpread(analysis);

        return recommended;
    }

    /**
     * Optimize differential threshold
     * @param {Object} analysis - Analysis results
     * @returns {Object} - Optimized thresholds for each broker and global
     */
    optimizeDiffThreshold(analysis) {
        // Start with current threshold
        let threshold = this.currentSettings.diffThreshold || 30;
        
        // Create result object with default values
        const result = {
            global: threshold,
            broker1: threshold,
            broker2: threshold
        };
        
        // Get broker-specific differentials
        const brokerDifferentials = {};
        
        for (const broker in analysis.brokerAnalysis) {
            const brokerAnalysis = analysis.brokerAnalysis[broker];
            
            if (brokerAnalysis.differentials && brokerAnalysis.differentials.length > 0) {
                brokerDifferentials[broker] = brokerAnalysis.differentials;
            }
        }
        
        // If no differentials found, return default values
        if (Object.keys(brokerDifferentials).length === 0) {
            return result;
        }
        
        // Process each broker's differentials
        for (const broker in brokerDifferentials) {
            const diffs = brokerDifferentials[broker];
            
            // Separate profitable and loss-making differentials
            const profitableDiffs = [];
            const lossDiffs = [];
            
            for (const diff of diffs) {
                // Using the actual differential value as a proxy for profitability
                if (diff.actual > diff.threshold + 5) {
                    profitableDiffs.push(diff.actual);
                } else if (diff.actual < diff.threshold + 2) {
                    lossDiffs.push(diff.actual);
                }
            }
            
            // If we have enough data, find the optimal threshold for this broker
            if (profitableDiffs.length > 0 && lossDiffs.length > 0) {
                // Sort the differentials
                profitableDiffs.sort((a, b) => a - b);
                lossDiffs.sort((a, b) => a - b);
                
                // Find a threshold that would exclude most loss-making differentials
                // while keeping most profitable ones
                const lossPercentile75 = lossDiffs[Math.floor(lossDiffs.length * 0.75)];
                const profitPercentile25 = profitableDiffs[Math.floor(profitableDiffs.length * 0.25)];
                
                // Choose a threshold between these values
                const optimalThreshold = Math.round((lossPercentile75 + profitPercentile25) / 2);
                
                // Don't change the threshold too drastically
                const maxChange = 5;
                const minThreshold = Math.max(threshold - maxChange, 20);
                const maxThreshold = Math.min(threshold + maxChange, 50);
                
                const brokerOptimalThreshold = Math.max(minThreshold, Math.min(optimalThreshold, maxThreshold));
                
                // Assign to the appropriate broker
                if (broker === this.currentSettings.broker1?.name) {
                    result.broker1 = brokerOptimalThreshold;
                } else if (broker === this.currentSettings.broker2?.name) {
                    result.broker2 = brokerOptimalThreshold;
                }
            } else {
                // If we don't have enough data, make a small adjustment based on win rate
                let adjustedThreshold = threshold;
                
                if (analysis.summary.winRate < 0.5) {
                    // Increase threshold to be more selective
                    adjustedThreshold = Math.min(threshold + 2, 50);
                } else if (analysis.summary.winRate > 0.7) {
                    // Threshold seems good or could be slightly lowered
                    adjustedThreshold = Math.max(threshold - 1, 20);
                }
                
                // Assign to the appropriate broker
                if (broker === this.currentSettings.broker1?.name) {
                    result.broker1 = adjustedThreshold;
                } else if (broker === this.currentSettings.broker2?.name) {
                    result.broker2 = adjustedThreshold;
                }
            }
        }
        
        // Calculate global threshold as average of broker thresholds
        if (result.broker1 !== threshold || result.broker2 !== threshold) {
            // If we have custom broker thresholds, use their average
            const validThresholds = [];
            if (result.broker1 !== threshold) validThresholds.push(result.broker1);
            if (result.broker2 !== threshold) validThresholds.push(result.broker2);
            
            if (validThresholds.length > 0) {
                const avgThreshold = Math.round(validThresholds.reduce((sum, val) => sum + val, 0) / validThresholds.length);
                result.global = avgThreshold;
            }
        }
        
        return result;
    }

    /**
     * Optimize minimum spread for a broker
     * @param {Object} analysis - Analysis results
     * @param {string} brokerName - Broker name
     * @returns {number} - Optimized minimum spread
     */
    optimizeMinSpread(analysis, brokerName) {
        // Start with current min spread
        let minSpread = 5;
        
        if (brokerName === this.currentSettings.broker1?.name) {
            minSpread = this.currentSettings.broker1.minSpread || 5;
        } else if (brokerName === this.currentSettings.broker2?.name) {
            minSpread = this.currentSettings.broker2.minSpread || 5;
        }
        
        // Get broker analysis
        const brokerAnalysis = analysis.brokerAnalysis[brokerName];
        
        if (!brokerAnalysis || !brokerAnalysis.spreads || brokerAnalysis.spreads.length === 0) {
            return minSpread;
        }
        
        // Calculate spread statistics
        const spreads = [...brokerAnalysis.spreads].sort((a, b) => a - b);
        const minObservedSpread = spreads[0];
        const percentile10 = spreads[Math.floor(spreads.length * 0.1)];
        const percentile25 = spreads[Math.floor(spreads.length * 0.25)];
        
        // If we have very low spreads that might be suspicious
        if (minObservedSpread < 2) {
            // Set min spread to filter out these suspicious values
            return Math.max(percentile10, 3);
        }
        
        // If the current min spread is filtering out too many opportunities
        if (minSpread > percentile25) {
            // Lower the min spread to include more opportunities
            return Math.max(percentile10, 3);
        }
        
        // If the current min spread is too low
        if (minSpread < percentile10 - 1) {
            // Raise the min spread to filter out potential issues
            return percentile10;
        }
        
        return minSpread;
    }

    /**
     * Optimize global maximum spread
     * @param {Object} analysis - Analysis results
     * @returns {number} - Optimized global max spread
     */
    optimizeGlobalMaxSpread(analysis) {
        // Start with current max spread
        const maxSpread = this.currentSettings.globalMaxSpread || 20;
        
        // Collect all spreads from all brokers
        const allSpreads = [];
        
        for (const broker in analysis.brokerAnalysis) {
            const brokerAnalysis = analysis.brokerAnalysis[broker];
            
            if (brokerAnalysis.spreads && brokerAnalysis.spreads.length > 0) {
                allSpreads.push(...brokerAnalysis.spreads);
            }
        }
        
        if (allSpreads.length === 0) {
            return maxSpread;
        }
        
        // Calculate spread statistics
        const spreads = [...allSpreads].sort((a, b) => a - b);
        const percentile75 = spreads[Math.floor(spreads.length * 0.75)];
        const percentile90 = spreads[Math.floor(spreads.length * 0.9)];
        
        // If the current max spread is filtering out too many opportunities
        if (maxSpread < percentile75) {
            // Increase the max spread to include more opportunities
            return Math.min(percentile75 + 2, 30);
        }
        
        // If the current max spread is too high
        if (maxSpread > percentile90 + 5) {
            // Lower the max spread to filter out potential issues
            return percentile90 + 2;
        }
        
        return maxSpread;
    }

    /**
     * Optimize fast maximum spread (LMAX)
     * @param {Object} analysis - Analysis results
     * @returns {number} - Optimized fast max spread
     */
    optimizeFastMaxSpread(analysis) {
        // Start with current fast max spread
        const fastMaxSpread = this.currentSettings.fastMaxSpread || 100;
        
        // Collect all fast spreads from differentials
        const fastSpreads = [];
        
        for (const broker in analysis.brokerAnalysis) {
            const brokerAnalysis = analysis.brokerAnalysis[broker];
            
            if (brokerAnalysis.differentials && brokerAnalysis.differentials.length > 0) {
                for (const diff of brokerAnalysis.differentials) {
                    if (diff.fastSpread !== null && diff.fastSpread !== undefined) {
                        fastSpreads.push(diff.fastSpread);
                    }
                }
            }
        }
        
        if (fastSpreads.length === 0) {
            return fastMaxSpread;
        }
        
        // Calculate fast spread statistics
        const spreads = [...fastSpreads].sort((a, b) => a - b);
        const percentile75 = spreads[Math.floor(spreads.length * 0.75)];
        const percentile90 = spreads[Math.floor(spreads.length * 0.9)];
        
        // If the current fast max spread is filtering out too many opportunities
        if (fastMaxSpread < percentile75) {
            // Increase the fast max spread to include more opportunities
            return Math.min(percentile75 + 10, 150);
        }
        
        // If the current fast max spread is too high
        if (fastMaxSpread > percentile90 + 20) {
            // Lower the fast max spread to filter out potential issues
            return percentile90 + 10;
        }
        
        return fastMaxSpread;
    }

    /**
     * Generate explanations for recommendations
     * @param {Object} analysis - Analysis results
     * @param {Object} recommendedSettings - Recommended settings
     * @returns {Array} - Explanations
     */
    generateExplanations(analysis, recommendedSettings) {
        const explanations = [];
        
        // Broker 1 diff threshold explanation
        if (recommendedSettings.broker1 && this.currentSettings.broker1) {
            const currentDiff = this.currentSettings.diffThreshold || 30;
            const recommendedDiff = recommendedSettings.broker1.diffThreshold;
            
            if (recommendedDiff !== currentDiff) {
                const direction = recommendedDiff > currentDiff ? 'increased' : 'decreased';
                const explanation = {
                    setting: `Diff Broker #1 ${recommendedSettings.broker1.name}`,
                    current: currentDiff,
                    recommended: recommendedDiff,
                    change: recommendedDiff - currentDiff,
                    explanation: `The differential threshold for ${recommendedSettings.broker1.name} should be ${direction} from ${currentDiff} to ${recommendedDiff} points. `
                };
                
                if (direction === 'increased') {
                    explanation.explanation += 'A higher threshold will filter out marginal opportunities that may not be profitable after accounting for execution factors.';
                } else {
                    explanation.explanation += 'A lower threshold may allow more trading opportunities while still maintaining profitability.';
                }
                
                explanations.push(explanation);
            }
        }
        
        // Broker 2 diff threshold explanation
        if (recommendedSettings.broker2 && this.currentSettings.broker2) {
            const currentDiff = this.currentSettings.diffThreshold || 30;
            const recommendedDiff = recommendedSettings.broker2.diffThreshold;
            
            if (recommendedDiff !== currentDiff) {
                const direction = recommendedDiff > currentDiff ? 'increased' : 'decreased';
                const explanation = {
                    setting: `Diff Broker #2 ${recommendedSettings.broker2.name}`,
                    current: currentDiff,
                    recommended: recommendedDiff,
                    change: recommendedDiff - currentDiff,
                    explanation: `The differential threshold for ${recommendedSettings.broker2.name} should be ${direction} from ${currentDiff} to ${recommendedDiff} points. `
                };
                
                if (direction === 'increased') {
                    explanation.explanation += 'A higher threshold will filter out marginal opportunities that may not be profitable after accounting for execution factors.';
                } else {
                    explanation.explanation += 'A lower threshold may allow more trading opportunities while still maintaining profitability.';
                }
                
                explanations.push(explanation);
            }
        }
        
        // Broker 1 min spread explanation
        if (recommendedSettings.broker1 && this.currentSettings.broker1) {
            const currentMin = this.currentSettings.broker1.minSpread || 5;
            const recommendedMin = recommendedSettings.broker1.minSpread;
            
            if (recommendedMin !== currentMin) {
                const direction = recommendedMin > currentMin ? 'increased' : 'decreased';
                const explanation = {
                    setting: `Min Spread Broker #1 ${recommendedSettings.broker1.name}`,
                    current: currentMin,
                    recommended: recommendedMin,
                    change: recommendedMin - currentMin,
                    explanation: `The minimum spread for ${recommendedSettings.broker1.name} should be ${direction} from ${currentMin} to ${recommendedMin} points. `
                };
                
                if (direction === 'increased') {
                    explanation.explanation += 'A higher minimum spread will filter out suspicious pricing that may lead to execution issues.';
                } else {
                    explanation.explanation += 'A lower minimum spread will allow more trading opportunities with this broker.';
                }
                
                explanations.push(explanation);
            }
        }
        
        // Broker 2 min spread explanation
        if (recommendedSettings.broker2 && this.currentSettings.broker2) {
            const currentMin = this.currentSettings.broker2.minSpread || 5;
            const recommendedMin = recommendedSettings.broker2.minSpread;
            
            if (recommendedMin !== currentMin) {
                const direction = recommendedMin > currentMin ? 'increased' : 'decreased';
                const explanation = {
                    setting: `Min Spread Broker #2 ${recommendedSettings.broker2.name}`,
                    current: currentMin,
                    recommended: recommendedMin,
                    change: recommendedMin - currentMin,
                    explanation: `The minimum spread for ${recommendedSettings.broker2.name} should be ${direction} from ${currentMin} to ${recommendedMin} points. `
                };
                
                if (direction === 'increased') {
                    explanation.explanation += 'A higher minimum spread will filter out suspicious pricing that may lead to execution issues.';
                } else {
                    explanation.explanation += 'A lower minimum spread will allow more trading opportunities with this broker.';
                }
                
                explanations.push(explanation);
            }
        }
        
        // Global max spread explanation
        const currentMax = this.currentSettings.globalMaxSpread || 20;
        const recommendedMax = recommendedSettings.globalMaxSpread;
        
        if (recommendedMax !== currentMax) {
            const direction = recommendedMax > currentMax ? 'increased' : 'decreased';
            const explanation = {
                setting: 'Global Max Spread Slow',
                current: currentMax,
                recommended: recommendedMax,
                change: recommendedMax - currentMax,
                explanation: `The global maximum spread should be ${direction} from ${currentMax} to ${recommendedMax} points. `
            };
            
            if (direction === 'increased') {
                explanation.explanation += 'A higher maximum spread will allow trading during more volatile conditions that may still be profitable.';
            } else {
                explanation.explanation += 'A lower maximum spread will filter out potentially risky trading conditions with excessive volatility.';
            }
            
            explanations.push(explanation);
        }
        
        // Fast max spread explanation
        const currentFastMax = this.currentSettings.fastMaxSpread || 100;
        const recommendedFastMax = recommendedSettings.fastMaxSpread;
        
        if (recommendedFastMax !== currentFastMax) {
            const direction = recommendedFastMax > currentFastMax ? 'increased' : 'decreased';
            const explanation = {
                setting: 'LMAX Max Spread',
                current: currentFastMax,
                recommended: recommendedFastMax,
                change: recommendedFastMax - currentFastMax,
                explanation: `The LMAX maximum spread should be ${direction} from ${currentFastMax} to ${recommendedFastMax} points. `
            };
            
            if (direction === 'increased') {
                explanation.explanation += 'A higher LMAX maximum spread will allow trading during more volatile market conditions that may still offer arbitrage opportunities.';
            } else {
                explanation.explanation += 'A lower LMAX maximum spread will filter out potentially risky market conditions with excessive volatility.';
            }
            
            explanations.push(explanation);
        }
        
        return explanations;
    }

    /**
     * Generate filtering analysis
     * @param {Object} analysis - Analysis results
     * @returns {Array} - Filtering analysis
     */
    generateFilteringAnalysis(analysis) {
        const filteringAnalysis = [];
        
        // Analyze stop loss hits
        const sequencesWithStopLoss = analysis.sequenceAnalysis.filter(seq => 
            seq.stopLossHits > 0
        );
        
        if (sequencesWithStopLoss.length > 0) {
            const totalSequences = analysis.sequenceAnalysis.length;
            const stopLossPercentage = (sequencesWithStopLoss.length / totalSequences) * 100;
            
            const profitableWithStopLoss = sequencesWithStopLoss.filter(seq => 
                seq.netProfitWithCalculatedCommission > 0
            ).length;
            
            const stopLossProfitPercentage = profitableWithStopLoss > 0 ? 
                (profitableWithStopLoss / sequencesWithStopLoss.length) * 100 : 0;
            
            filteringAnalysis.push({
                title: 'Stop Loss Analysis',
                content: `${sequencesWithStopLoss.length} out of ${totalSequences} sequences (${stopLossPercentage.toFixed(1)}%) had stop losses triggered. Of these, ${profitableWithStopLoss} (${stopLossProfitPercentage.toFixed(1)}%) were still profitable overall.`,
                recommendation: stopLossProfitPercentage < 30 ? 
                    'Consider increasing the differential threshold to reduce the number of trades that hit stop losses.' : 
                    'The current stop loss behavior appears acceptable.'
            });
        }
        
        // Analyze execution times
        const slowExecutions = [];
        
        for (const broker in analysis.brokerAnalysis) {
            const brokerAnalysis = analysis.brokerAnalysis[broker];
            
            if (brokerAnalysis.executionTimes && brokerAnalysis.executionTimes.length > 0) {
                const avgExecTime = brokerAnalysis.averageExecutionTime;
                
                if (avgExecTime > 100) {
                    slowExecutions.push({
                        broker,
                        avgExecTime
                    });
                }
            }
        }
        
        if (slowExecutions.length > 0) {
            const content = slowExecutions.map(item => 
                `${item.broker}: ${item.avgExecTime.toFixed(1)} ms average execution time`
            ).join('. ');
            
            filteringAnalysis.push({
                title: 'Execution Speed Analysis',
                content: `Slow execution detected: ${content}.`,
                recommendation: 'Consider increasing the differential threshold to compensate for slower execution times, which can lead to more slippage.'
            });
        }
        
        // Analyze slippage
        const highSlippage = [];
        
        for (const broker in analysis.brokerAnalysis) {
            const brokerAnalysis = analysis.brokerAnalysis[broker];
            
            if (brokerAnalysis.slippages && brokerAnalysis.slippages.length > 0) {
                const avgSlippage = brokerAnalysis.averageSlippage;
                
                if (avgSlippage > 15 || avgSlippage < -15) {
                    highSlippage.push({
                        broker,
                        avgSlippage
                    });
                }
            }
        }
        
        if (highSlippage.length > 0) {
            const content = highSlippage.map(item => 
                `${item.broker}: ${item.avgSlippage.toFixed(1)} points average slippage`
            ).join('. ');
            
            filteringAnalysis.push({
                title: 'Slippage Analysis',
                content: `High slippage detected: ${content}.`,
                recommendation: 'Consider adjusting the differential threshold to account for consistent slippage patterns.'
            });
        }
        
        // Analyze spread patterns
        const unusualSpreads = [];
        
        for (const broker in analysis.brokerAnalysis) {
            const brokerAnalysis = analysis.brokerAnalysis[broker];
            
            if (brokerAnalysis.spreads && brokerAnalysis.spreads.length > 0) {
                // Check for unusual spread patterns
                const spreads = [...brokerAnalysis.spreads].sort((a, b) => a - b);
                const minSpread = spreads[0];
                const maxSpread = spreads[spreads.length - 1];
                const spreadRange = maxSpread - minSpread;
                
                if (minSpread < 2 || spreadRange > 20) {
                    unusualSpreads.push({
                        broker,
                        minSpread,
                        maxSpread,
                        spreadRange
                    });
                }
            }
        }
        
        if (unusualSpreads.length > 0) {
            const content = unusualSpreads.map(item => 
                `${item.broker}: Spread range from ${item.minSpread.toFixed(1)} to ${item.maxSpread.toFixed(1)} points (range: ${item.spreadRange.toFixed(1)})`
            ).join('. ');
            
            filteringAnalysis.push({
                title: 'Spread Pattern Analysis',
                content: `Unusual spread patterns detected: ${content}.`,
                recommendation: 'Consider adjusting the min/max spread settings to filter out periods with abnormal spread behavior.'
            });
        }
        
        return filteringAnalysis;
    }

    /**
     * Generate performance insights
     * @param {Object} analysis - Analysis results
     * @returns {Array} - Performance insights
     */
    generatePerformanceInsights(analysis) {
        const performanceInsights = [];
        
        // Overall profitability insight
        if (analysis.summary.netProfit !== 0) {
            const profitability = analysis.summary.netProfit > 0 ? 'profitable' : 'unprofitable';
            const winRate = (analysis.summary.winRate * 100).toFixed(1);
            
            performanceInsights.push({
                title: 'Overall Profitability',
                content: `The arbitrage strategy is ${profitability} with a net profit of $${Math.abs(analysis.summary.netProfit).toFixed(2)} and a win rate of ${winRate}%.`,
                recommendation: analysis.summary.netProfit > 0 ? 
                    'The current strategy is working well. Consider fine-tuning parameters to improve profitability further.' : 
                    'The current strategy needs significant adjustment to become profitable.'
            });
        }
        
        // Broker comparison insight
        if (Object.keys(analysis.brokerAnalysis).length >= 2) {
            const brokers = Object.keys(analysis.brokerAnalysis);
            const broker1 = brokers[0];
            const broker2 = brokers[1];
            
            const broker1Analysis = analysis.brokerAnalysis[broker1];
            const broker2Analysis = analysis.brokerAnalysis[broker2];
            
            if (broker1Analysis && broker2Analysis) {
                const execTimeDiff = broker1Analysis.averageExecutionTime - broker2Analysis.averageExecutionTime;
                const slippageDiff = broker1Analysis.averageSlippage - broker2Analysis.averageSlippage;
                
                let content = `Broker comparison: ${broker1} vs ${broker2}. `;
                
                if (Math.abs(execTimeDiff) > 50) {
                    const fasterBroker = execTimeDiff > 0 ? broker2 : broker1;
                    content += `${fasterBroker} has significantly faster execution times. `;
                }
                
                if (Math.abs(slippageDiff) > 5) {
                    const betterBroker = slippageDiff > 0 ? broker2 : broker1;
                    content += `${betterBroker} has better slippage characteristics. `;
                }
                
                performanceInsights.push({
                    title: 'Broker Performance Comparison',
                    content,
                    recommendation: 'Consider adjusting broker-specific settings based on their performance characteristics.'
                });
            }
        }
        
        // Differential effectiveness insight
        const differentials = [];
        
        for (const broker in analysis.brokerAnalysis) {
            const brokerAnalysis = analysis.brokerAnalysis[broker];
            
            if (brokerAnalysis.differentials && brokerAnalysis.differentials.length > 0) {
                differentials.push(...brokerAnalysis.differentials);
            }
        }
        
        if (differentials.length > 0) {
            // Group by threshold ranges
            const thresholdRanges = {
                low: { count: 0, profitable: 0 },
                medium: { count: 0, profitable: 0 },
                high: { count: 0, profitable: 0 }
            };
            
            for (const diff of differentials) {
                // We don't have direct profit information for each differential
                // Using the actual vs threshold difference as a proxy
                const diffAboveThreshold = diff.actual - diff.threshold;
                
                if (diffAboveThreshold < 2) {
                    thresholdRanges.low.count++;
                    if (diffAboveThreshold > 0.5) thresholdRanges.low.profitable++;
                } else if (diffAboveThreshold < 5) {
                    thresholdRanges.medium.count++;
                    if (diffAboveThreshold > 1) thresholdRanges.medium.profitable++;
                } else {
                    thresholdRanges.high.count++;
                    thresholdRanges.high.profitable++;
                }
            }
            
            const lowProfitRate = thresholdRanges.low.count > 0 ? 
                (thresholdRanges.low.profitable / thresholdRanges.low.count) * 100 : 0;
                
            const mediumProfitRate = thresholdRanges.medium.count > 0 ? 
                (thresholdRanges.medium.profitable / thresholdRanges.medium.count) * 100 : 0;
                
            const highProfitRate = thresholdRanges.high.count > 0 ? 
                (thresholdRanges.high.profitable / thresholdRanges.high.count) * 100 : 0;
            
            let content = 'Differential effectiveness analysis: ';
            content += `Low differentials (0-2 points above threshold): ${lowProfitRate.toFixed(1)}% profitable. `;
            content += `Medium differentials (2-5 points above threshold): ${mediumProfitRate.toFixed(1)}% profitable. `;
            content += `High differentials (5+ points above threshold): ${highProfitRate.toFixed(1)}% profitable.`;
            
            let recommendation = '';
            
            if (lowProfitRate < 40) {
                recommendation = 'Consider increasing the differential threshold to filter out low-differential opportunities that are less likely to be profitable.';
            } else if (highProfitRate > 80 && mediumProfitRate > 60) {
                recommendation = 'The current differential threshold appears effective. High-differential opportunities show strong profitability.';
            } else {
                recommendation = 'Consider adjusting the differential threshold to optimize the balance between opportunity frequency and profitability.';
            }
            
            performanceInsights.push({
                title: 'Differential Effectiveness',
                content,
                recommendation
            });
        }
        
        return performanceInsights;
    }
}

// Export the recommendations generator
window.ArbitrageRecommendations = ArbitrageRecommendations;

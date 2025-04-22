/**
 * Arbitrage Network Analysis Logger (ANAL)
 * Main application script
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
    const parser = new ArbitrageLogParser();
    const analyzer = new ArbitrageLogAnalyzer();
    const recommendations = new ArbitrageRecommendations();
    const simulator = new ArbitrageSimulator();
    
    // Store parsed sequences and analysis results
    let parsedSequences = [];
    let analysisResults = null;
    let recommendationResults = null;
    
    // DOM elements
    const logInput = document.getElementById('log-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const clearBtn = document.getElementById('clear-btn');
    const resultsSection = document.getElementById('results-section');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const runSimulationBtn = document.getElementById('run-simulation-btn');
    
    // Broker settings inputs
    const broker1Name = document.getElementById('broker1-name');
    const broker1Commission = document.getElementById('broker1-commission');
    const broker1MinSpread = document.getElementById('broker1-min-spread');
    const broker2Name = document.getElementById('broker2-name');
    const broker2Commission = document.getElementById('broker2-commission');
    const broker2MinSpread = document.getElementById('broker2-min-spread');
    const globalMaxSpread = document.getElementById('global-max-spread');
    const fastMaxSpread = document.getElementById('fast-max-spread');
    const diffThreshold = document.getElementById('diff-threshold');
    
    // Summary elements
    const totalSequences = document.getElementById('total-sequences');
    const profitableSequences = document.getElementById('profitable-sequences');
    const lossSequences = document.getElementById('loss-sequences');
    const totalProfit = document.getElementById('total-profit');
    const broker1NameSummary = document.getElementById('summary-broker1-name');
    const broker2NameSummary = document.getElementById('summary-broker2-name');
    const broker1AvgExec = document.getElementById('broker1-avg-exec');
    const broker1AvgSlippage = document.getElementById('broker1-avg-slippage');
    const broker1AvgSpread = document.getElementById('broker1-avg-spread');
    const broker2AvgExec = document.getElementById('broker2-avg-exec');
    const broker2AvgSlippage = document.getElementById('broker2-avg-slippage');
    const broker2AvgSpread = document.getElementById('broker2-avg-spread');
    
    // Tab content containers
    const sequencesContainer = document.getElementById('sequences-container');
    const recommendedSettings = document.getElementById('recommended-settings');
    const filteringAnalysis = document.getElementById('filtering-analysis');
    const performanceInsights = document.getElementById('performance-insights');
    const simulationResults = document.getElementById('simulation-results');
    
    // Event listeners
    analyzeBtn.addEventListener('click', analyzeLog);
    clearBtn.addEventListener('click', clearAll);
    runSimulationBtn.addEventListener('click', runSimulation);
    
    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked tab
            button.classList.add('active');
            
            // Show corresponding tab pane
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
    
    /**
     * Get current settings from form inputs
     */
    function getCurrentSettings() {
        return {
            broker1: {
                name: broker1Name.value,
                commission: parseFloat(broker1Commission.value),
                minSpread: parseFloat(broker1MinSpread.value)
            },
            broker2: {
                name: broker2Name.value,
                commission: parseFloat(broker2Commission.value),
                minSpread: parseFloat(broker2MinSpread.value)
            },
            globalMaxSpread: parseFloat(globalMaxSpread.value),
            fastMaxSpread: parseFloat(fastMaxSpread.value),
            diffThreshold: parseFloat(diffThreshold.value)
        };
    }
    
    /**
     * Analyze the log
     */
    function analyzeLog() {
        const logText = logInput.value.trim();
        
        if (!logText) {
            alert('Please paste your arbitrage log first.');
            return;
        }
        
        // Parse the log
        parsedSequences = parser.parseLog(logText);
        
        // Get broker names from the log
        const brokerNames = parser.getBrokerNames();
        
        // Update broker names in the form if detected
        if (brokerNames.length >= 1 && brokerNames[0]) {
            broker1Name.value = brokerNames[0];
        }
        
        if (brokerNames.length >= 2 && brokerNames[1]) {
            broker2Name.value = brokerNames[1];
        }
        
        // Get current settings
        const settings = getCurrentSettings();
        
        // Set analyzer settings
        analyzer.setBrokerSettings({
            [settings.broker1.name]: {
                commission: settings.broker1.commission,
                minSpread: settings.broker1.minSpread
            },
            [settings.broker2.name]: {
                commission: settings.broker2.commission,
                minSpread: settings.broker2.minSpread
            }
        });
        
        analyzer.setGlobalSettings({
            globalMaxSpread: settings.globalMaxSpread,
            fastMaxSpread: settings.fastMaxSpread,
            diffThreshold: settings.diffThreshold
        });
        
        // Analyze the sequences
        analysisResults = analyzer.analyzeSequences(parsedSequences);
        
        // Set recommendations settings
        recommendations.setCurrentSettings(settings);
        
        // Generate recommendations
        recommendationResults = recommendations.generateRecommendations(analysisResults);
        
        // Set simulator settings
        simulator.setCurrentSettings(settings);
        simulator.setRecommendedSettings(recommendationResults.settings);
        
        // Update UI
        updateSummary(analysisResults.summary);
        updateSequences(analysisResults.sequenceAnalysis);
        updateRecommendations(recommendationResults);
        
        // Show results section
        resultsSection.style.display = 'block';
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    /**
     * Clear all inputs and results
     */
    function clearAll() {
        logInput.value = '';
        resultsSection.style.display = 'none';
        parsedSequences = [];
        analysisResults = null;
        recommendationResults = null;
    }
    
    /**
     * Run simulation with recommended settings
     */
    function runSimulation() {
        if (!analysisResults || !recommendationResults) {
            alert('Please analyze a log first.');
            return;
        }
        
        // Run simulation
        const simulationResults = simulator.runSimulation(analysisResults, parsedSequences);
        
        // Update UI with simulation results
        updateSimulationResults(simulationResults);
        
        // Switch to simulation tab
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        document.querySelector('[data-tab="simulation"]').classList.add('active');
        document.getElementById('simulation-tab').classList.add('active');
    }
    
    /**
     * Update summary tab with analysis results
     */
    function updateSummary(summary) {
        // Update summary stats
        totalSequences.textContent = summary.totalSequences;
        profitableSequences.textContent = summary.profitableSequences;
        lossSequences.textContent = summary.lossSequences;
        totalProfit.textContent = '$' + summary.netProfit.toFixed(2);
        totalProfit.className = summary.netProfit >= 0 ? 'profit-positive' : 'profit-negative';
        
        // Update broker names
        broker1NameSummary.textContent = broker1Name.value;
        broker2NameSummary.textContent = broker2Name.value;
        
        // Update broker stats if available
        const broker1 = broker1Name.value;
        const broker2 = broker2Name.value;
        
        if (analysisResults.brokerAnalysis[broker1]) {
            const broker1Stats = analysisResults.brokerAnalysis[broker1];
            broker1AvgExec.textContent = broker1Stats.averageExecutionTime.toFixed(1) + ' ms';
            broker1AvgSlippage.textContent = broker1Stats.averageSlippage.toFixed(1) + ' pts';
            broker1AvgSpread.textContent = broker1Stats.averageSpread.toFixed(1) + ' pts';
        }
        
        if (analysisResults.brokerAnalysis[broker2]) {
            const broker2Stats = analysisResults.brokerAnalysis[broker2];
            broker2AvgExec.textContent = broker2Stats.averageExecutionTime.toFixed(1) + ' ms';
            broker2AvgSlippage.textContent = broker2Stats.averageSlippage.toFixed(1) + ' pts';
            broker2AvgSpread.textContent = broker2Stats.averageSpread.toFixed(1) + ' pts';
        }
    }
    
    /**
     * Update sequences tab with sequence analysis
     */
    function updateSequences(sequenceAnalysis) {
        sequencesContainer.innerHTML = '';
        
        if (!sequenceAnalysis || sequenceAnalysis.length === 0) {
            sequencesContainer.innerHTML = '<p>No sequences found in the log.</p>';
            return;
        }
        
        // Create sequence cards
        sequenceAnalysis.forEach((sequence, index) => {
            const sequenceCard = document.createElement('div');
            sequenceCard.className = 'sequence-card';
            
            // Sequence header
            const sequenceHeader = document.createElement('div');
            sequenceHeader.className = 'sequence-header';
            
            const sequenceTitle = document.createElement('h4');
            sequenceTitle.textContent = `Sequence ${index + 1}`;
            
            const sequenceProfit = document.createElement('span');
            sequenceProfit.textContent = `$${sequence.netProfit.toFixed(2)}`;
            sequenceProfit.className = sequence.netProfit >= 0 ? 'profit-positive' : 'profit-negative';
            
            sequenceHeader.appendChild(sequenceTitle);
            sequenceHeader.appendChild(sequenceProfit);
            sequenceCard.appendChild(sequenceHeader);
            
            // Sequence body
            const sequenceBody = document.createElement('div');
            sequenceBody.className = 'sequence-body';
            
            // Sequence parts
            const sequenceParts = document.createElement('div');
            sequenceParts.className = 'sequence-parts';
            
            // Create part cards
            sequence.parts.forEach((part, partIndex) => {
                const partCard = document.createElement('div');
                partCard.className = 'sequence-part';
                
                const partTitle = document.createElement('h5');
                partTitle.textContent = `Part ${partIndex + 1}`;
                partCard.appendChild(partTitle);
                
                // Part details
                const detailsDiv = document.createElement('div');
                
                // Add differential info if available
                if (part.differential) {
                    addDetailRow(detailsDiv, 'Direction', part.differential.direction);
                    addDetailRow(detailsDiv, 'Differential', `${part.differential.actual.toFixed(1)} (threshold: ${part.differential.threshold.toFixed(1)})`);
                    addDetailRow(detailsDiv, 'Broker', part.differential.broker);
                    addDetailRow(detailsDiv, 'Fast Spread', part.differential.fastSpread ? part.differential.fastSpread.toFixed(1) : 'N/A');
                    addDetailRow(detailsDiv, 'Slow Spread', part.differential.slowSpread ? part.differential.slowSpread.toFixed(1) : 'N/A');
                }
                
                // Add execution metrics
                if (part.executionTimes && part.executionTimes.length > 0) {
                    const avgExecTime = part.executionTimes.reduce((sum, val) => sum + val, 0) / part.executionTimes.length;
                    addDetailRow(detailsDiv, 'Avg Execution Time', `${avgExecTime.toFixed(1)} ms`);
                }
                
                if (part.slippages && part.slippages.length > 0) {
                    const avgSlippage = part.slippages.reduce((sum, val) => sum + val, 0) / part.slippages.length;
                    addDetailRow(detailsDiv, 'Avg Slippage', `${avgSlippage.toFixed(1)} pts`);
                }
                
                // Add profit info
                addDetailRow(detailsDiv, 'Profit', `$${part.profit.toFixed(2)}`, part.profit >= 0 ? 'profit-positive' : 'profit-negative');
                
                // Add trailing stop info
                if (part.trailingStopAdjustments > 0) {
                    addDetailRow(detailsDiv, 'Trailing Adjustments', part.trailingStopAdjustments);
                }
                
                // Add stop loss hit info
                if (part.stopLossHit) {
                    addDetailRow(detailsDiv, 'Stop Loss Hit', 'Yes', 'profit-negative');
                }
                
                partCard.appendChild(detailsDiv);
                
                // Add log entries
                if (parsedSequences[index] && parsedSequences[index].parts[partIndex] && 
                    parsedSequences[index].parts[partIndex].logLines) {
                    
                    const logEntries = document.createElement('div');
                    logEntries.className = 'log-entries';
                    
                    parsedSequences[index].parts[partIndex].logLines.forEach(line => {
                        const logLine = document.createElement('div');
                        logLine.textContent = `${line.timestamp}: ${line.content}`;
                        logEntries.appendChild(logLine);
                    });
                    
                    partCard.appendChild(logEntries);
                }
                
                sequenceParts.appendChild(partCard);
            });
            
            sequenceBody.appendChild(sequenceParts);
            sequenceCard.appendChild(sequenceBody);
            sequencesContainer.appendChild(sequenceCard);
        });
    }
    
    /**
     * Add a detail row to a container
     */
    function addDetailRow(container, label, value, valueClass = '') {
        const row = document.createElement('div');
        row.className = 'detail-row';
        
        const labelSpan = document.createElement('span');
        labelSpan.className = 'detail-label';
        labelSpan.textContent = label + ':';
        
        const valueSpan = document.createElement('span');
        if (valueClass) {
            valueSpan.className = valueClass;
        }
        valueSpan.textContent = value;
        
        row.appendChild(labelSpan);
        row.appendChild(valueSpan);
        container.appendChild(row);
    }
    
    /**
     * Update recommendations tab with recommendation results
     */
    function updateRecommendations(recommendations) {
        // Update recommended settings
        recommendedSettings.innerHTML = '';
        
        if (recommendations.explanations && recommendations.explanations.length > 0) {
            recommendations.explanations.forEach(explanation => {
                const item = document.createElement('div');
                item.className = 'recommendation-item';
                
                const title = document.createElement('h5');
                title.textContent = explanation.setting;
                
                // Add change indicator
                const changeIndicator = document.createElement('span');
                changeIndicator.className = 'change-indicator';
                
                if (explanation.change > 0) {
                    changeIndicator.textContent = `+${explanation.change.toFixed(1)}`;
                    changeIndicator.classList.add('change-increase');
                } else if (explanation.change < 0) {
                    changeIndicator.textContent = `${explanation.change.toFixed(1)}`;
                    changeIndicator.classList.add('change-decrease');
                } else {
                    changeIndicator.textContent = 'No change';
                    changeIndicator.classList.add('change-neutral');
                }
                
                title.appendChild(changeIndicator);
                item.appendChild(title);
                
                const description = document.createElement('p');
                description.textContent = `${explanation.current} → ${explanation.recommended}. ${explanation.explanation}`;
                item.appendChild(description);
                
                recommendedSettings.appendChild(item);
            });
        } else {
            recommendedSettings.innerHTML = '<p>No changes recommended to current settings.</p>';
        }
        
        // Update filtering analysis
        filteringAnalysis.innerHTML = '';
        
        if (recommendations.filteringAnalysis && recommendations.filteringAnalysis.length > 0) {
            recommendations.filteringAnalysis.forEach(analysis => {
                const item = document.createElement('div');
                item.className = 'recommendation-item';
                
                const title = document.createElement('h5');
                title.textContent = analysis.title;
                item.appendChild(title);
                
                const content = document.createElement('p');
                content.textContent = analysis.content;
                item.appendChild(content);
                
                const recommendation = document.createElement('p');
                recommendation.innerHTML = `<strong>Recommendation:</strong> ${analysis.recommendation}`;
                item.appendChild(recommendation);
                
                filteringAnalysis.appendChild(item);
            });
        } else {
            filteringAnalysis.innerHTML = '<p>No filtering analysis available.</p>';
        }
        
        // Update performance insights
        performanceInsights.innerHTML = '';
        
        if (recommendations.performanceInsights && recommendations.performanceInsights.length > 0) {
            recommendations.performanceInsights.forEach(insight => {
                const item = document.createElement('div');
                item.className = 'recommendation-item';
                
                const title = document.createElement('h5');
                title.textContent = insight.title;
                item.appendChild(title);
                
                const content = document.createElement('p');
                content.textContent = insight.content;
                item.appendChild(content);
                
                const recommendation = document.createElement('p');
                recommendation.innerHTML = `<strong>Recommendation:</strong> ${insight.recommendation}`;
                item.appendChild(recommendation);
                
                performanceInsights.appendChild(item);
            });
        } else {
            performanceInsights.innerHTML = '<p>No performance insights available.</p>';
        }
    }
    
    /**
     * Update simulation results tab
     */
    function updateSimulationResults(simulation) {
        simulationResults.innerHTML = '';
        
        // Create summary section
        const summarySection = document.createElement('div');
        summarySection.className = 'simulation-summary';
        
        const summaryTitle = document.createElement('h4');
        summaryTitle.textContent = 'Simulation Summary';
        summarySection.appendChild(summaryTitle);
        
        // Create comparison table
        const comparisonTable = document.createElement('table');
        comparisonTable.className = 'comparison-table';
        
        // Table header
        const tableHeader = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        const metricHeader = document.createElement('th');
        metricHeader.textContent = 'Metric';
        headerRow.appendChild(metricHeader);
        
        const currentHeader = document.createElement('th');
        currentHeader.textContent = 'Current Settings';
        headerRow.appendChild(currentHeader);
        
        const recommendedHeader = document.createElement('th');
        recommendedHeader.textContent = 'Recommended Settings';
        headerRow.appendChild(recommendedHeader);
        
        const changeHeader = document.createElement('th');
        changeHeader.textContent = 'Change';
        headerRow.appendChild(changeHeader);
        
        tableHeader.appendChild(headerRow);
        comparisonTable.appendChild(tableHeader);
        
        // Table body
        const tableBody = document.createElement('tbody');
        
        // Add comparison rows
        addComparisonRow(tableBody, 'Total Sequences', 
            simulation.comparison.totalSequences.current, 
            simulation.comparison.totalSequences.recommended,
            simulation.comparison.totalSequences.difference,
            simulation.comparison.totalSequences.percentageChange);
            
        addComparisonRow(tableBody, 'Profitable Sequences', 
            simulation.comparison.profitableSequences.current, 
            simulation.comparison.profitableSequences.recommended,
            simulation.comparison.profitableSequences.difference,
            simulation.comparison.profitableSequences.percentageChange);
            
        addComparisonRow(tableBody, 'Loss Sequences', 
            simulation.comparison.lossSequences.current, 
            simulation.comparison.lossSequences.recommended,
            simulation.comparison.lossSequences.difference,
            simulation.comparison.lossSequences.percentageChange);
            
        addComparisonRow(tableBody, 'Net Profit', 
            '$' + simulation.comparison.netProfit.current.toFixed(2), 
            '$' + simulation.comparison.netProfit.recommended.toFixed(2),
            '$' + simulation.comparison.netProfit.difference.toFixed(2),
            simulation.comparison.netProfit.percentageChange,
            true);
            
        addComparisonRow(tableBody, 'Win Rate', 
            (simulation.comparison.winRate.current * 100).toFixed(1) + '%', 
            (simulation.comparison.winRate.recommended * 100).toFixed(1) + '%',
            (simulation.comparison.winRate.difference * 100).toFixed(1) + '%',
            simulation.comparison.winRate.percentageChange);
            
        addComparisonRow(tableBody, 'Profit Factor', 
            simulation.comparison.profitFactor.current.toFixed(2), 
            simulation.comparison.profitFactor.recommended.toFixed(2),
            simulation.comparison.profitFactor.difference.toFixed(2),
            simulation.comparison.profitFactor.percentageChange);
        
        comparisonTable.appendChild(tableBody);
        summarySection.appendChild(comparisonTable);
        simulationResults.appendChild(summarySection);
        
        // Create filtered sequences section
        if (simulation.filteredSequences && simulation.filteredSequences.length > 0) {
            const filteredSection = document.createElement('div');
            filteredSection.className = 'simulation-detail';
            
            const filteredTitle = document.createElement('h4');
            filteredTitle.textContent = `Filtered Sequences (${simulation.filteredSequences.length})`;
            filteredSection.appendChild(filteredTitle);
            
            const filteredDescription = document.createElement('p');
            filteredDescription.textContent = 'The following sequences would be filtered out with the recommended settings:';
            filteredSection.appendChild(filteredDescription);
            
            // Create filtered sequence list
            simulation.filteredSequences.forEach((filtered, index) => {
                const filteredItem = document.createElement('div');
                filteredItem.className = 'recommendation-item';
                
                const title = document.createElement('h5');
                title.textContent = `Sequence ${index + 1}`;
                
                // Add profit indicator
                const profitIndicator = document.createElement('span');
                profitIndicator.className = 'change-indicator';
                profitIndicator.textContent = `$${filtered.netProfit.toFixed(2)}`;
                profitIndicator.classList.add(filtered.netProfit >= 0 ? 'change-increase' : 'change-decrease');
                
                title.appendChild(profitIndicator);
                filteredItem.appendChild(title);
                
                // Add filter reasons
                if (filtered.filterReasons && filtered.filterReasons.length > 0) {
                    const reasonsList = document.createElement('ul');
                    
                    filtered.filterReasons.forEach(reason => {
                        const reasonItem = document.createElement('li');
                        reasonItem.textContent = reason;
                        reasonsList.appendChild(reasonItem);
                    });
                    
                    filteredItem.appendChild(reasonsList);
                }
                
                filteredSection.appendChild(filteredItem);
            });
            
            simulationResults.appendChild(filteredSection);
            
            // Add summary of filtered sequences
            const filteredSummary = document.createElement('div');
            filteredSummary.className = 'recommendation-item';
            
            const profitableFiltered = simulation.filteredSequences.filter(seq => seq.netProfit > 0).length;
            const lossFiltered = simulation.filteredSequences.filter(seq => seq.netProfit < 0).length;
            
            const totalFilteredProfit = simulation.filteredSequences.reduce((sum, seq) => sum + seq.netProfit, 0);
            
            const summaryText = document.createElement('p');
            summaryText.innerHTML = `<strong>Summary:</strong> ${simulation.filteredSequences.length} sequences would be filtered out, including ${profitableFiltered} profitable and ${lossFiltered} loss-making sequences. Total profit impact: $${totalFilteredProfit.toFixed(2)}`;
            
            filteredSummary.appendChild(summaryText);
            filteredSection.appendChild(filteredSummary);
        } else {
            const noFilteredMessage = document.createElement('p');
            noFilteredMessage.textContent = 'No sequences would be filtered out with the recommended settings.';
            simulationResults.appendChild(noFilteredMessage);
        }
    }
    
    /**
     * Add a comparison row to the table
     */
    function addComparisonRow(tableBody, label, current, recommended, difference, percentageChange, isProfit = false) {
        const row = document.createElement('tr');
        
        const labelCell = document.createElement('td');
        labelCell.textContent = label;
        row.appendChild(labelCell);
        
        const currentCell = document.createElement('td');
        currentCell.textContent = current;
        row.appendChild(currentCell);
        
        const recommendedCell = document.createElement('td');
        recommendedCell.textContent = recommended;
        row.appendChild(recommendedCell);
        
        const changeCell = document.createElement('td');
        
        // Format change with percentage
        let changeText = difference;
        if (percentageChange) {
            changeText += ` (${percentageChange >= 0 ? '+' : ''}${percentageChange.toFixed(1)}%)`;
        }
        
        changeCell.textContent = changeText;
        
        // Add color based on whether increase is good or bad
        if (difference > 0) {
            if (label === 'Loss Sequences') {
                changeCell.className = 'profit-negative';
            } else {
                changeCell.className = 'profit-positive';
            }
        } else if (difference < 0) {
            if (label === 'Loss Sequences') {
                changeCell.className = 'profit-positive';
            } else {
                changeCell.className = 'profit-negative';
            }
        }
        
        // Special case for profit
        if (isProfit) {
            if (difference > 0) {
                changeCell.className = 'profit-positive';
            } else if (difference < 0) {
                changeCell.className = 'profit-negative';
            }
        }
        
        row.appendChild(changeCell);
        tableBody.appendChild(row);
    }
});

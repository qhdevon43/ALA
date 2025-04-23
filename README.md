# Arbitrage Log Analyzer (ALA) v8.2

Version: 8.2

A comprehensive web-based tool for analyzing arbitrage trading logs. ALA helps traders identify profitable opportunities, analyze performance metrics, and optimize trading parameters.

## Overview

The Arbitrage Log Analyzer (ALA) is a client-side web application designed to parse and analyze complex arbitrage trading logs. It provides detailed insights into sequence performance, broker behavior, and profit/loss metrics without requiring any server-side processing.

## Key Features

### Log Analysis
- **Multiple Log Formats**: Supports both DAAS and SHARP Trader log formats
- **Multi-Part Sequence Detection**: Accurately identifies and analyzes complex multi-part arbitrage sequences
- **Sequence Detection**: Automatically identifies complete arbitrage sequences in log files
- **Profit Calculation**: Accurate calculation of profits, including commission deductions
- **Broker Performance**: Tracks execution times, slippage, and spread metrics by broker

### Performance Metrics
- **Sequence Analysis**: Detailed breakdown of each arbitrage sequence and its parts

## What's New in v8.2
- Fixed multi-part sequence detection to correctly identify both parts of sequences involving orders closed by arbitrage
- Enhanced virtual order handling for better sequence tracking

## What's New in v8.1
- Initial multi-part sequence detection implementation
- **Summary Statistics**: Win rate, profit factor, average profit/loss, and more
- **Broker Comparison**: Side-by-side comparison of broker performance metrics

### Optimization Tools
- **Parameter Recommendations**: AI-powered suggestions for optimizing trading parameters
- **Simulation**: Test recommended settings against historical data
- **What-If Analysis**: Explore potential outcomes with different configurations

## Getting Started

### Local Usage
1. Clone this repository
2. Open `index.html` in your web browser
3. Paste your arbitrage log into the text area
4. Click "Analyze" to process the log

### Web Server Setup
1. Clone this repository to your web server
2. Configure your web server to serve the files
3. Access the application through your web server's URL

#### Quick Start with PowerShell (Windows)
Run the included PowerShell script to start a local web server:
```powershell
.\firewall-server.ps1
```
Then access the application at: http://localhost:8090/

## Project Structure

### Core Files
- `index.html`: Main application interface
- `src/parser.js`: Log parsing logic
- `src/analyzer.js`: Analysis and metrics calculation
- `src/recommendations.js`: AI-powered recommendation engine
- `src/simulator.js`: Simulation and what-if analysis
- `src/app.js`: Application logic and UI interactions
- `src/styles.css`: Application styling

### Server Files
- `firewall-server.ps1`: PowerShell script for running a local web server

## Technical Details

### Parsing Logic
The parser identifies key log patterns including:
- Difference detections
- Order openings and closings
- Virtual orders
- Stop loss triggers
- Trailing stop adjustments

### Profit Calculation
For XAUUSD trading:
- Each 0.01 point (1 pip) is worth 1 cent per 0.01 lot
- Commission is calculated based on broker rates (typically $6 per 1.0 lot for FP, $8 per 1.0 lot for IC)

## Browser Compatibility
- Chrome (recommended)
- Firefox
- Edge
- Safari

## Privacy
All processing happens in your browser - no data is sent to any server.

## License
Copyright © 2025 Arbitrage Log Analyzer. All rights reserved.

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

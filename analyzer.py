#!/usr/bin/env python3
"""
Arbitrage Network Analysis Logger (ANAL)
Main script for analyzing arbitrage opportunities in trading logs
"""

import argparse
import os
import sys
import pandas as pd
import matplotlib.pyplot as plt
from tqdm import tqdm

# Import project modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from utils.log_parser import parse_log_file
from utils.analyzer import find_arbitrage_opportunities
from models.opportunity import ArbitrageOpportunity
from visualizer import visualize_opportunities

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Analyze trading logs for arbitrage opportunities')
    parser.add_argument('--log-file', type=str, required=True, help='Path to the log file to analyze')
    parser.add_argument('--output-dir', type=str, default='output', help='Directory to save results')
    parser.add_argument('--min-profit', type=float, default=0.01, help='Minimum profit threshold (in percentage)')
    parser.add_argument('--visualize', action='store_true', help='Generate visualizations')
    return parser.parse_args()

def main():
    """Main function to run the analysis"""
    args = parse_arguments()
    
    # Create output directory if it doesn't exist
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
    
    print(f"Analyzing log file: {args.log_file}")
    
    # Parse log file
    try:
        log_data = parse_log_file(args.log_file)
        print(f"Successfully parsed log file with {len(log_data)} entries")
    except Exception as e:
        print(f"Error parsing log file: {e}")
        return 1
    
    # Find arbitrage opportunities
    opportunities = find_arbitrage_opportunities(log_data, min_profit=args.min_profit)
    print(f"Found {len(opportunities)} arbitrage opportunities")
    
    # Save results
    results_file = os.path.join(args.output_dir, 'arbitrage_opportunities.csv')
    opportunities_df = pd.DataFrame([op.to_dict() for op in opportunities])
    opportunities_df.to_csv(results_file, index=False)
    print(f"Results saved to {results_file}")
    
    # Generate visualizations if requested
    if args.visualize and opportunities:
        print("Generating visualizations...")
        visualize_opportunities(opportunities, output_dir=args.output_dir)
        print(f"Visualizations saved to {args.output_dir}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

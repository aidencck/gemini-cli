#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BUNDLE_SIZE_LIMIT_MB = 2; // Target: Keep bundle under 2MB
const BUNDLE_SIZE_LIMIT_BYTES = BUNDLE_SIZE_LIMIT_MB * 1024 * 1024;
const BUNDLE_PATH = path.join(__dirname, '..', 'bundle', 'gemini.js');

/**
 * Analyze bundle size and performance
 */
function analyzeBundleSize() {
  try {
    const stats = fs.statSync(BUNDLE_PATH);
    const sizeBytes = stats.size;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    const sizeKB = (sizeBytes / 1024).toFixed(2);
    
    console.log('📊 Bundle Size Analysis');
    console.log('=' .repeat(50));
    console.log(`Bundle file: ${BUNDLE_PATH}`);
    console.log(`Size: ${sizeMB} MB (${sizeKB} KB)`);
    console.log(`Target: <${BUNDLE_SIZE_LIMIT_MB} MB`);
    
    // Check if bundle exceeds size limit
    if (sizeBytes > BUNDLE_SIZE_LIMIT_BYTES) {
      const excessMB = ((sizeBytes - BUNDLE_SIZE_LIMIT_BYTES) / 1024 / 1024).toFixed(2);
      console.log(`❌ Bundle exceeds size limit by ${excessMB} MB`);
      
      // Provide optimization suggestions
      console.log('\n💡 Optimization Suggestions:');
      console.log('1. Check if all dynamic imports are working correctly');
      console.log('2. Verify external dependencies are properly excluded');
      console.log('3. Review if any large dependencies can be lazy-loaded');
      console.log('4. Consider splitting the bundle into multiple chunks');
      
      process.exit(1);
    } else {
      const remainingMB = ((BUNDLE_SIZE_LIMIT_BYTES - sizeBytes) / 1024 / 1024).toFixed(2);
      console.log(`✅ Bundle is within size limit (${remainingMB} MB remaining)`);
    }
    
    // Performance analysis
    console.log('\n⚡ Performance Analysis');
    console.log('=' .repeat(50));
    
    // Estimate startup time (rough calculation)
    const estimatedStartupMs = Math.max(100, sizeBytes / 1024 / 10); // ~10KB per ms parsing
    console.log(`Estimated startup time: ~${estimatedStartupMs.toFixed(0)}ms`);
    
    // Memory usage estimate
    const estimatedMemoryMB = (sizeBytes / 1024 / 1024 * 3).toFixed(2); // Rough 3x multiplier
    console.log(`Estimated memory usage: ~${estimatedMemoryMB} MB`);
    
    // Show improvement from original size
    const originalSizeMB = 10.3; // Original bundle size
    const improvementMB = (originalSizeMB - parseFloat(sizeMB)).toFixed(2);
    const improvementPercent = ((improvementMB / originalSizeMB) * 100).toFixed(1);
    
    if (improvementMB > 0) {
      console.log(`📈 Improvement: ${improvementMB} MB smaller (${improvementPercent}% reduction)`);
    }
    
    console.log('\n✅ Bundle analysis complete!');
    
  } catch (error) {
    console.error('❌ Bundle analysis failed:', error.message);
    process.exit(1);
  }
}

/**
 * Generate bundle size report
 */
function generateReport() {
  try {
    const stats = fs.statSync(BUNDLE_PATH);
    const report = {
      timestamp: new Date().toISOString(),
      size: {
        bytes: stats.size,
        kb: (stats.size / 1024).toFixed(2),
        mb: (stats.size / 1024 / 1024).toFixed(2),
      },
      performance: {
        estimatedStartupMs: Math.max(100, stats.size / 1024 / 10),
        estimatedMemoryMB: (stats.size / 1024 / 1024 * 3).toFixed(2),
      },
      compliance: {
        withinLimit: stats.size <= BUNDLE_SIZE_LIMIT_BYTES,
        limitMB: BUNDLE_SIZE_LIMIT_MB,
        excessMB: stats.size > BUNDLE_SIZE_LIMIT_BYTES 
          ? ((stats.size - BUNDLE_SIZE_LIMIT_BYTES) / 1024 / 1024).toFixed(2)
          : 0,
      },
    };
    
    const reportPath = path.join(__dirname, '..', 'bundle-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Bundle report saved to: ${reportPath}`);
    
    return report;
    
  } catch (error) {
    console.error('❌ Failed to generate bundle report:', error.message);
    process.exit(1);
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Bundle Size Analyzer

Usage: node bundle-analyzer.js [options]

Options:
  --report, -r    Generate JSON report
  --help, -h      Show this help message

Examples:
  node bundle-analyzer.js           # Analyze bundle size
  node bundle-analyzer.js --report  # Generate report
    `);
    return;
  }
  
  if (args.includes('--report') || args.includes('-r')) {
    generateReport();
  } else {
    analyzeBundleSize();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeBundleSize, generateReport };
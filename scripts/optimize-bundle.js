#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNDLE_PATH = path.join(__dirname, '..', 'bundle', 'gemini.js');

/**
 * Optimize bundle by removing unnecessary code patterns
 */
function optimizeBundle() {
  console.log('🔧 Optimizing bundle...');
  
  try {
    let bundleContent = fs.readFileSync(BUNDLE_PATH, 'utf8');
    const originalSize = bundleContent.length;
    
    // Remove development-only code patterns
    const optimizations = [
      // Remove React DevTools references
      {
        pattern: /react-devtools-core[^}]*}/g,
        replacement: '{}',
        description: 'Remove React DevTools references'
      },
      // Remove source map references
      {
        pattern: /\/\/# sourceMappingURL=.*$/gm,
        replacement: '',
        description: 'Remove source map references'
      },
      // Remove debug comments
      {
        pattern: /\/\*\*[\s\S]*?\*\//g,
        replacement: '',
        description: 'Remove JSDoc comments'
      },
      // Remove excessive whitespace
      {
        pattern: /\n\s*\n\s*\n/g,
        replacement: '\n\n',
        description: 'Remove excessive whitespace'
      },
      // Remove console.debug statements
      {
        pattern: /console\.debug\([^)]*\);?/g,
        replacement: '',
        description: 'Remove console.debug statements'
      },
    ];
    
    let totalReduction = 0;
    optimizations.forEach(({ pattern, replacement, description }) => {
      const beforeSize = bundleContent.length;
      bundleContent = bundleContent.replace(pattern, replacement);
      const afterSize = bundleContent.length;
      const reduction = beforeSize - afterSize;
      
      if (reduction > 0) {
        totalReduction += reduction;
        console.log(`  ✅ ${description}: ${(reduction / 1024).toFixed(2)} KB reduced`);
      }
    });
    
    // Write optimized bundle
    fs.writeFileSync(BUNDLE_PATH, bundleContent);
    
    const finalSize = bundleContent.length;
    const totalReductionPercent = ((totalReduction / originalSize) * 100).toFixed(1);
    
    console.log(`\n📊 Optimization Results:`);
    console.log(`  Original size: ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`  Final size: ${(finalSize / 1024).toFixed(2)} KB`);
    console.log(`  Reduction: ${(totalReduction / 1024).toFixed(2)} KB (${totalReductionPercent}%)`);
    
    // Test gzip compression
    const gzippedSize = gzipSync(bundleContent).length;
    const gzipRatio = ((gzippedSize / finalSize) * 100).toFixed(1);
    
    console.log(`  Gzipped size: ${(gzippedSize / 1024).toFixed(2)} KB (${gzipRatio}% of original)`);
    
    return {
      originalSize,
      finalSize,
      gzippedSize,
      reduction: totalReduction,
    };
    
  } catch (error) {
    console.error('❌ Bundle optimization failed:', error.message);
    process.exit(1);
  }
}

/**
 * Analyze bundle dependencies and suggest optimizations
 */
function analyzeDependencies() {
  console.log('\n🔍 Analyzing bundle dependencies...');
  
  try {
    const bundleContent = fs.readFileSync(BUNDLE_PATH, 'utf8');
    
    // Common heavy dependency patterns
    const dependencyPatterns = [
      { name: 'React', pattern: /react[^"]*"/g },
      { name: 'Ink', pattern: /ink[^"]*"/g },
      { name: 'OpenTelemetry', pattern: /@opentelemetry[^"]*"/g },
      { name: 'Google AI', pattern: /@google\/genai[^"]*"/g },
      { name: 'Zod', pattern: /zod[^"]*"/g },
      { name: 'Simple Git', pattern: /simple-git[^"]*"/g },
    ];
    
    console.log('  📋 Dependency Analysis:');
    dependencyPatterns.forEach(({ name, pattern }) => {
      const matches = bundleContent.match(pattern);
      if (matches) {
        console.log(`    ${name}: ${matches.length} references`);
      }
    });
    
    // Check for potential optimizations
    const suggestions = [];
    
    if (bundleContent.includes('react-devtools')) {
      suggestions.push('Consider removing React DevTools in production');
    }
    
    if (bundleContent.includes('@opentelemetry')) {
      suggestions.push('Consider making telemetry completely optional');
    }
    
    if (bundleContent.includes('node_modules')) {
      suggestions.push('Some dependencies may not be properly externalized');
    }
    
    if (suggestions.length > 0) {
      console.log('\n  💡 Optimization Suggestions:');
      suggestions.forEach(suggestion => {
        console.log(`    • ${suggestion}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Dependency analysis failed:', error.message);
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Bundle Optimizer

Usage: node optimize-bundle.js [options]

Options:
  --analyze, -a   Analyze dependencies only
  --help, -h      Show this help message

Examples:
  node optimize-bundle.js           # Optimize bundle
  node optimize-bundle.js --analyze # Analyze only
    `);
    return;
  }
  
  if (args.includes('--analyze') || args.includes('-a')) {
    analyzeDependencies();
  } else {
    const results = optimizeBundle();
    analyzeDependencies();
    
    // Check if we met the target
    const targetSizeKB = 2048; // 2MB target
    const finalSizeKB = results.finalSize / 1024;
    
    if (finalSizeKB <= targetSizeKB) {
      console.log('\n✅ Bundle optimization successful! Target achieved.');
    } else {
      const excessKB = finalSizeKB - targetSizeKB;
      console.log(`\n⚠️  Bundle still ${excessKB.toFixed(2)} KB over target. Consider additional optimizations.`);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { optimizeBundle, analyzeDependencies };
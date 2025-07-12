/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, 'package.json'));

// Performance optimization: Define heavy dependencies that should be external
const externalDependencies = [
  // Keep heavy dependencies as external to be loaded dynamically
  'highlight.js',
  'lowlight',
  // Development-only dependencies that shouldn't be in production bundle
  'react-devtools-core',
  'react-devtools-shared',
  // Heavy telemetry dependencies (optional for CLI functionality)
  '@opentelemetry/otlp-transformer',
  '@opentelemetry/exporter-logs-otlp-grpc',
  '@opentelemetry/exporter-metrics-otlp-grpc',
  '@opentelemetry/exporter-trace-otlp-grpc',
  '@opentelemetry/instrumentation-http',
  '@opentelemetry/sdk-node',
  '@opentelemetry/semantic-conventions',
  '@opentelemetry/api-logs',
  '@opentelemetry/resources',
  '@opentelemetry/otlp-exporter-base',
  // Large data files and mappings
  'mime-db',
  'tr46',
  // Development/optional dependencies
  'simple-git',
  'zod',
  'bignumber.js',
  // Node.js built-ins
  'node:*',
  'fs',
  'path',
  'url',
  'util',
  'crypto',
  'os',
  'child_process',
  'stream',
  'events',
  'buffer',
  'zlib',
  'querystring',
  'net',
  'tls',
  'http',
  'https',
  'process',
  'module',
];

esbuild
  .build({
    entryPoints: ['packages/cli/index.ts'],
    bundle: true,
    outfile: 'bundle/gemini.js',
    platform: 'node',
    format: 'esm',
    target: 'node18',
    // Performance optimizations
    minify: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    treeShaking: true,
    splitting: false, // Single entry point for now
    external: externalDependencies,
    // Optimize for production
    drop: ['console', 'debugger'],
    dropLabels: ['DEV'],
    // Additional optimizations
    keepNames: false, // Reduce bundle size
    define: {
      'process.env.CLI_VERSION': JSON.stringify(pkg.version),
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    banner: {
      js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url); globalThis.__filename = require('url').fileURLToPath(import.meta.url); globalThis.__dirname = require('path').dirname(globalThis.__filename);`,
    },
    // Bundle analysis
    metafile: true,
    logLevel: 'info',
    // Resolve configuration
    mainFields: ['module', 'main'],
    conditions: ['import', 'module', 'default'],
    // Source maps for debugging (can be disabled for production)
    sourcemap: false,
    // Loader configuration
    loader: {
      '.js': 'jsx',
      '.ts': 'tsx',
      '.tsx': 'tsx',
    },
    // JSX configuration
    jsx: 'automatic',
    jsxImportSource: 'react',
  })
  .then((result) => {
    if (result.metafile) {
      // Output bundle analysis
      console.log('\n📊 Bundle Analysis:');
      const outputs = result.metafile.outputs;
      for (const [file, info] of Object.entries(outputs)) {
        const sizeKB = (info.bytes / 1024).toFixed(2);
        console.log(`  ${file}: ${sizeKB} KB`);
      }
      
      // Show top imports by size
      const inputs = Object.entries(result.metafile.inputs || {})
        .sort((a, b) => b[1].bytes - a[1].bytes)
        .slice(0, 10);
      
      console.log('\n🔍 Top imports by size:');
      inputs.forEach(([file, info]) => {
        const sizeKB = (info.bytes / 1024).toFixed(2);
        console.log(`  ${file}: ${sizeKB} KB`);
      });
    }
    
    console.log('\n✅ Bundle built successfully!');
  })
  .catch((error) => {
    console.error('❌ Build failed:', error);
    process.exit(1);
  });

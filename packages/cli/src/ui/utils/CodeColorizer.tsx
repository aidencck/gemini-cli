/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import type {
  Root,
  Element,
  Text as HastText,
  ElementContent,
  RootContent,
} from 'hast';
import { themeManager } from '../themes/theme-manager.js';
import { Theme } from '../themes/theme.js';
import {
  MaxSizedBox,
  MINIMUM_MAX_HEIGHT,
} from '../components/shared/MaxSizedBox.js';

// Lazy loading types
type LowlightInstance = {
  highlightAuto: (code: string) => Root;
  highlight: (language: string, code: string) => Root;
  registered: (language: string) => boolean;
};

// Cache for the lazy-loaded lowlight instance
let lowlightInstance: LowlightInstance | null = null;
let loadingPromise: Promise<LowlightInstance> | null = null;

// Lazy load the highlighting libraries
async function loadHighlighting(): Promise<LowlightInstance> {
  if (lowlightInstance) {
    return lowlightInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const { common, createLowlight } = await import('lowlight');
      lowlightInstance = createLowlight(common);
      return lowlightInstance;
    } catch (error) {
      console.error('[CodeColorizer] Failed to load syntax highlighting:', error);
      // Return a minimal implementation that doesn't crash
      return {
        highlightAuto: (code: string) => ({ type: 'root', children: [{ type: 'text', value: code }] }),
        highlight: (language: string, code: string) => ({ type: 'root', children: [{ type: 'text', value: code }] }),
        registered: () => false,
      };
    }
  })();

  return loadingPromise;
}

function renderHastNode(
  node: Root | Element | HastText | RootContent,
  theme: Theme,
  inheritedColor: string | undefined,
): React.ReactNode {
  if (node.type === 'text') {
    // Use the color passed down from parent element, if any
    return <Text color={inheritedColor}>{node.value}</Text>;
  }

  // Handle Element Nodes: Determine color and pass it down, don't wrap
  if (node.type === 'element') {
    const nodeClasses: string[] =
      (node.properties?.className as string[]) || [];
    let elementColor: string | undefined = undefined;

    // Find color defined specifically for this element's class
    for (let i = nodeClasses.length - 1; i >= 0; i--) {
      const color = theme.getInkColor(nodeClasses[i]);
      if (color) {
        elementColor = color;
        break;
      }
    }

    // Determine the color to pass down: Use this element's specific color
    // if found, otherwise, continue passing down the already inherited color.
    const colorToPassDown = elementColor || inheritedColor;

    // Recursively render children, passing the determined color down
    // Ensure child type matches expected HAST structure (ElementContent is common)
    const children = node.children?.map(
      (child: ElementContent, index: number) => (
        <React.Fragment key={index}>
          {renderHastNode(child, theme, colorToPassDown)}
        </React.Fragment>
      ),
    );

    // Element nodes now only group children; color is applied by Text nodes.
    // Use a React Fragment to avoid adding unnecessary elements.
    return <React.Fragment>{children}</React.Fragment>;
  }

  // Handle Root Node: Start recursion with initial inherited color
  if (node.type === 'root') {
    // Check if children array is empty - this happens when lowlight can't detect language – fallback to plain text
    if (!node.children || node.children.length === 0) {
      return null;
    }

    // Pass down the initial inheritedColor (likely undefined from the top call)
    // Ensure child type matches expected HAST structure (RootContent is common)
    return node.children?.map((child: RootContent, index: number) => (
      <React.Fragment key={index}>
        {renderHastNode(child, theme, inheritedColor)}
      </React.Fragment>
    ));
  }

  // Handle unknown or unsupported node types
  return null;
}

/**
 * Renders syntax-highlighted code for Ink applications using a selected theme.
 * Uses lazy loading to only load syntax highlighting libraries when needed.
 *
 * @param code The code string to highlight.
 * @param language The language identifier (e.g., 'javascript', 'css', 'html')
 * @returns A React.ReactNode containing Ink <Text> elements for the highlighted code.
 */
export function colorizeCode(
  code: string,
  language: string | null,
  availableHeight?: number,
  maxWidth?: number,
): React.ReactNode {
  const [highlightInstance, setHighlightInstance] = useState<LowlightInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeTheme = themeManager.getActiveTheme();

  useEffect(() => {
    loadHighlighting().then((instance) => {
      setHighlightInstance(instance);
      setIsLoading(false);
    });
  }, []);

  // Render fallback while loading or if highlighting fails
  const renderFallback = (codeToRender: string) => {
    const lines = codeToRender.split('\n');
    const padWidth = String(lines.length).length;
    
    return (
      <MaxSizedBox
        maxHeight={availableHeight}
        maxWidth={maxWidth}
        overflowDirection="top"
      >
        {lines.map((line, index) => (
          <Box key={index}>
            <Text color={activeTheme.colors.Gray}>
              {`${String(index + 1).padStart(padWidth, ' ')} `}
            </Text>
            <Text color={activeTheme.defaultColor} wrap="wrap">
              {line}
            </Text>
          </Box>
        ))}
      </MaxSizedBox>
    );
  };

  const codeToHighlight = code.replace(/\n$/, '');

  // Show loading state or fallback if highlighting not available
  if (isLoading || !highlightInstance) {
    return renderFallback(codeToHighlight);
  }

  try {
    // Render the HAST tree using the adapted theme
    // Apply the theme's default foreground color to the top-level Text element
    let lines = codeToHighlight.split('\n');
    const padWidth = String(lines.length).length; // Calculate padding width based on number of lines

    let hiddenLinesCount = 0;

    // Optimization to avoid highlighting lines that cannot possibly be displayed.
    if (availableHeight !== undefined) {
      availableHeight = Math.max(availableHeight, MINIMUM_MAX_HEIGHT);
      if (lines.length > availableHeight) {
        const sliceIndex = lines.length - availableHeight;
        hiddenLinesCount = sliceIndex;
        lines = lines.slice(sliceIndex);
      }
    }

    const getHighlightedLines = (line: string) =>
      !language || !highlightInstance.registered(language)
        ? highlightInstance.highlightAuto(line)
        : highlightInstance.highlight(language, line);

    return (
      <MaxSizedBox
        maxHeight={availableHeight}
        maxWidth={maxWidth}
        additionalHiddenLinesCount={hiddenLinesCount}
        overflowDirection="top"
      >
        {lines.map((line, index) => {
          const renderedNode = renderHastNode(
            getHighlightedLines(line),
            activeTheme,
            undefined,
          );

          const contentToRender = renderedNode !== null ? renderedNode : line;
          return (
            <Box key={index}>
              <Text color={activeTheme.colors.Gray}>
                {`${String(index + 1 + hiddenLinesCount).padStart(padWidth, ' ')} `}
              </Text>
              <Text color={activeTheme.defaultColor} wrap="wrap">
                {contentToRender}
              </Text>
            </Box>
          );
        })}
      </MaxSizedBox>
    );
  } catch (error) {
    console.error(
      `[colorizeCode] Error highlighting code for language "${language}":`,
      error,
    );
    // Fallback to plain text with default color on error
    return renderFallback(codeToHighlight);
  }
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../config/config.js';
import type {
  StartSessionEvent,
  UserPromptEvent,
  ToolCallEvent,
  ApiRequestEvent,
  ApiErrorEvent,
  ApiResponseEvent,
} from './types.js';

// Lazy loading types
type TelemetrySDK = {
  initializeTelemetry: (config: Config) => void;
  shutdownTelemetry: () => Promise<void>;
  isTelemetrySdkInitialized: () => boolean;
};

type TelemetryLoggers = {
  logCliConfiguration: (config: Config, event: StartSessionEvent) => void;
  logUserPrompt: (config: Config, event: UserPromptEvent) => void;
  logToolCall: (config: Config, event: ToolCallEvent) => void;
  logApiRequest: (config: Config, event: ApiRequestEvent) => void;
  logApiError: (config: Config, event: ApiErrorEvent) => void;
  logApiResponse: (config: Config, event: ApiResponseEvent) => void;
};

// Cache for lazy-loaded modules
let sdkModule: TelemetrySDK | null = null;
let loggersModule: TelemetryLoggers | null = null;
let loadingSdkPromise: Promise<TelemetrySDK> | null = null;
let loadingLoggersPromise: Promise<TelemetryLoggers> | null = null;

// Lazy load the telemetry SDK
async function loadTelemetrySDK(): Promise<TelemetrySDK> {
  if (sdkModule) {
    return sdkModule;
  }

  if (loadingSdkPromise) {
    return loadingSdkPromise;
  }

  loadingSdkPromise = (async () => {
    try {
      const module = await import('./sdk.js');
      sdkModule = {
        initializeTelemetry: module.initializeTelemetry,
        shutdownTelemetry: module.shutdownTelemetry,
        isTelemetrySdkInitialized: module.isTelemetrySdkInitialized,
      };
      return sdkModule;
    } catch (error) {
      console.warn('[LazyTelemetry] Failed to load telemetry SDK:', error);
      // Return a no-op implementation
      return {
        initializeTelemetry: () => {},
        shutdownTelemetry: async () => {},
        isTelemetrySdkInitialized: () => false,
      };
    }
  })();

  return loadingSdkPromise;
}

// Lazy load the telemetry loggers
async function loadTelemetryLoggers(): Promise<TelemetryLoggers> {
  if (loggersModule) {
    return loggersModule;
  }

  if (loadingLoggersPromise) {
    return loadingLoggersPromise;
  }

  loadingLoggersPromise = (async () => {
    try {
      const module = await import('./loggers.js');
      loggersModule = {
        logCliConfiguration: module.logCliConfiguration,
        logUserPrompt: module.logUserPrompt,
        logToolCall: module.logToolCall,
        logApiRequest: module.logApiRequest,
        logApiError: module.logApiError,
        logApiResponse: module.logApiResponse,
      };
      return loggersModule;
    } catch (error) {
      console.warn('[LazyTelemetry] Failed to load telemetry loggers:', error);
      // Return a no-op implementation
      return {
        logCliConfiguration: () => {},
        logUserPrompt: () => {},
        logToolCall: () => {},
        logApiRequest: () => {},
        logApiError: () => {},
        logApiResponse: () => {},
      };
    }
  })();

  return loadingLoggersPromise;
}

// Lazy-loaded telemetry functions
export async function initializeTelemetry(config: Config): Promise<void> {
  // Only load telemetry if it's enabled
  if (!config.getTelemetryEnabled()) {
    return;
  }

  const sdk = await loadTelemetrySDK();
  sdk.initializeTelemetry(config);
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdkModule) {
    await sdkModule.shutdownTelemetry();
  }
}

export function isTelemetrySdkInitialized(): boolean {
  return sdkModule?.isTelemetrySdkInitialized() || false;
}

export async function logCliConfiguration(config: Config, event: StartSessionEvent): Promise<void> {
  if (!config.getTelemetryEnabled()) {
    return;
  }

  const loggers = await loadTelemetryLoggers();
  loggers.logCliConfiguration(config, event);
}

export async function logUserPrompt(config: Config, event: UserPromptEvent): Promise<void> {
  const loggers = await loadTelemetryLoggers();
  loggers.logUserPrompt(config, event);
}

export async function logToolCall(config: Config, event: ToolCallEvent): Promise<void> {
  const loggers = await loadTelemetryLoggers();
  loggers.logToolCall(config, event);
}

export async function logApiRequest(config: Config, event: ApiRequestEvent): Promise<void> {
  const loggers = await loadTelemetryLoggers();
  loggers.logApiRequest(config, event);
}

export async function logApiError(config: Config, event: ApiErrorEvent): Promise<void> {
  const loggers = await loadTelemetryLoggers();
  loggers.logApiError(config, event);
}

export async function logApiResponse(config: Config, event: ApiResponseEvent): Promise<void> {
  const loggers = await loadTelemetryLoggers();
  loggers.logApiResponse(config, event);
}

// Check if telemetry should be loaded based on config
export function shouldLoadTelemetry(config: Config): boolean {
  return config.getTelemetryEnabled();
}
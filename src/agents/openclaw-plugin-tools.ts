import { selectApplicableRuntimeConfig } from "../config/config.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { PluginMetadataSnapshot } from "../plugins/plugin-metadata-snapshot.types.js";
import { resolvePluginTools } from "../plugins/tools.js";
import { getActiveSecretsRuntimeSnapshot } from "../secrets/runtime.js";
import { normalizeDeliveryContext } from "../utils/delivery-context.js";
import { listProfilesForProvider } from "./auth-profiles.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";
import {
  resolveOpenClawPluginToolInputs,
  type OpenClawPluginToolOptions,
} from "./openclaw-tools.plugin-context.js";
import { applyPluginToolDeliveryDefaults } from "./plugin-tool-delivery-defaults.js";
import type { PreparedOpenClawToolPlanning } from "./runtime-plan/types.js";
import type { AnyAgentTool } from "./tools/common.js";

type ResolveOpenClawPluginToolsOptions = OpenClawPluginToolOptions & {
  pluginToolAllowlist?: string[];
  currentChannelId?: string;
  currentThreadTs?: string;
  currentMessageId?: string | number;
  sandboxRoot?: string;
  modelHasVision?: boolean;
  modelProvider?: string;
  allowMediaInvokeCommands?: boolean;
  requesterAgentIdOverride?: string;
  requireExplicitMessageTarget?: boolean;
  disableMessageTool?: boolean;
  disablePluginTools?: boolean;
  authProfileStore?: AuthProfileStore;
  preparedToolPlanning?: PreparedOpenClawToolPlanning;
};

export function resolveOpenClawPluginToolsForOptions(params: {
  options?: ResolveOpenClawPluginToolsOptions;
  resolvedConfig?: OpenClawConfig;
  existingToolNames?: Set<string>;
  loadMetadataSnapshot?: () => PluginMetadataSnapshot;
  metadataSnapshot?: PluginMetadataSnapshot;
}): AnyAgentTool[] {
  if (params.options?.disablePluginTools) {
    return [];
  }

  const deliveryContext = normalizeDeliveryContext({
    channel: params.options?.agentChannel,
    to: params.options?.agentTo,
    accountId: params.options?.agentAccountId,
    threadId: params.options?.agentThreadId,
  });

  const resolveCurrentRuntimeConfig = () => {
    const currentRuntimeSnapshot = getActiveSecretsRuntimeSnapshot();
    return selectApplicableRuntimeConfig({
      inputConfig: params.resolvedConfig ?? params.options?.config,
      runtimeConfig: currentRuntimeSnapshot?.config,
      runtimeSourceConfig: currentRuntimeSnapshot?.sourceConfig,
    });
  };
  const authProfileStore = params.options?.authProfileStore;
  const pluginTools = resolvePluginTools({
    ...resolveOpenClawPluginToolInputs({
      options: params.options,
      resolvedConfig: params.resolvedConfig,
      runtimeConfig: resolveCurrentRuntimeConfig(),
      getRuntimeConfig: resolveCurrentRuntimeConfig,
    }),
    existingToolNames: params.existingToolNames ?? new Set<string>(),
    toolAllowlist: params.options?.pluginToolAllowlist,
    allowGatewaySubagentBinding: params.options?.allowGatewaySubagentBinding,
    ...(params.options?.preparedToolPlanning?.metadataSnapshot
      ? { metadataSnapshot: params.options.preparedToolPlanning.metadataSnapshot }
      : {}),
    ...(params.options?.preparedToolPlanning?.loadMetadataSnapshot
      ? { loadMetadataSnapshot: params.options.preparedToolPlanning.loadMetadataSnapshot }
      : {}),
    ...(params.metadataSnapshot ? { metadataSnapshot: params.metadataSnapshot } : {}),
    ...(params.loadMetadataSnapshot ? { loadMetadataSnapshot: params.loadMetadataSnapshot } : {}),
    ...(authProfileStore
      ? {
          hasAuthForProvider: (providerId) =>
            listProfilesForProvider(authProfileStore, providerId).length > 0,
        }
      : {}),
  });

  return applyPluginToolDeliveryDefaults({
    tools: pluginTools,
    deliveryContext,
  });
}

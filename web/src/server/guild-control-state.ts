export function mergeGuildControlState(
  defaultConfiguration: Record<string, unknown>,
  configuration: Record<string, unknown>,
  defaultRuntime: Record<string, unknown>,
  runtime: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...defaultRuntime,
    ...runtime,
    ...defaultConfiguration,
    ...configuration
  };
}

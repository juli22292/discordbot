export const AI_DELETE_COMMAND = "!delete";

export function isAiDeleteCommand(value: string): boolean {
  return value.trim().toLocaleLowerCase("en-US") === AI_DELETE_COMMAND;
}

// Default guardrail values

export const DEFAULT_BLOCKED_COMMANDS: string[] = [
  "rm -rf /",
  "rm -rf ~",
  "git push --force",
  "git push -f",
  "chmod 777",
  "chmod -R 777",
  ":(){ :|:& };:",
  "> /dev/sda",
  "mkfs.",
  "dd if=/dev/zero",
  "dd if=/dev/random",
];

export const DEFAULT_ALLOWED_WRITE_PATHS: string[] = ["**"];

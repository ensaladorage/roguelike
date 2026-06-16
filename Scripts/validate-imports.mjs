import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const SCAN_ENTRIES = [
  "main.js",
  "Core",
  "Game",
  "World",
  "UI",
  "RoomData",
  "CharacterData",
];

const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

function collectJavaScriptFiles(entry) {
  const absolute = path.join(projectRoot, entry);
  if (!fs.existsSync(absolute)) return [];

  const stat = fs.statSync(absolute);
  if (stat.isFile()) return absolute.endsWith(".js") ? [absolute] : [];

  const files = [];
  const stack = [absolute];

  while (stack.length > 0) {
    const current = stack.pop();
    const children = fs.readdirSync(current, { withFileTypes: true });

    for (const child of children) {
      const childPath = path.join(current, child.name);
      if (child.isDirectory()) {
        stack.push(childPath);
      } else if (child.isFile() && child.name.endsWith(".js")) {
        files.push(childPath);
      }
    }
  }

  return files;
}

function resolveRelativeSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;

  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.js`,
    path.join(base, "index.js"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function hasExactCase(absolutePath) {
  const relative = path.relative(projectRoot, absolutePath);
  if (relative.startsWith("..")) return false;

  let current = projectRoot;
  for (const segment of relative.split(path.sep)) {
    const entries = fs.readdirSync(current);
    if (!entries.includes(segment)) return false;
    current = path.join(current, segment);
  }

  return true;
}

function validateFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const errors = [];
  let match;

  while ((match = IMPORT_PATTERN.exec(text)) !== null) {
    const specifier = match[1] ?? match[2];
    const resolved = resolveRelativeSpecifier(file, specifier);
    if (!resolved) continue;

    if (!fs.existsSync(resolved)) {
      errors.push({
        file,
        specifier,
        message: "missing target",
      });
      continue;
    }

    if (!hasExactCase(resolved)) {
      errors.push({
        file,
        specifier,
        message: "path casing mismatch",
      });
    }
  }

  return errors;
}

const files = SCAN_ENTRIES.flatMap(collectJavaScriptFiles).sort();
const errors = files.flatMap(validateFile);

if (errors.length > 0) {
  console.error("Import validation failed:");
  for (const error of errors) {
    const file = path.relative(projectRoot, error.file);
    console.error(`- ${file}: ${error.specifier} (${error.message})`);
  }
  process.exitCode = 1;
} else {
  console.log(`Import validation passed (${files.length} files checked).`);
}

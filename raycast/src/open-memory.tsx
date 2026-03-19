import { showHUD, open, getPreferenceValues } from "@raycast/api";
import { execSync } from "child_process";
import { existsSync } from "fs";

interface Preferences {
  pythonPackagePath: string;
  pythonPath?: string;
}

interface SearchResult {
  file_path: string;
  file_name: string;
  similarity: number;
  media_category: string;
}

export default async function OpenMemory(props: { arguments: { query: string } }) {
  const { query } = props.arguments;
  const prefs = getPreferenceValues<Preferences>();
  const python = prefs.pythonPath || "python3";
  const pkgPath = prefs.pythonPackagePath;

  try {
    const output = execSync(
      `${python} -c "
import json, sys
sys.path.insert(0, '${pkgPath}')
from vector_embedded_finder import search as s
results = s.search('''${query.replace(/'/g, "\\'")}''', n_results=1)
print(json.dumps(results))
"`,
      { timeout: 10000, encoding: "utf-8" },
    );

    const results: SearchResult[] = JSON.parse(output.trim());

    if (results.length > 0 && results[0].file_path && existsSync(results[0].file_path)) {
      const r = results[0];
      const score = (r.similarity * 100).toFixed(1);
      await open(r.file_path);
      await showHUD(`Opened: ${r.file_name} (${score}% match)`);
    } else {
      await showHUD(`No matching file found for: ${query}`);
    }
  } catch {
    await showHUD("Search failed - check vector-embedded-finder is installed");
  }
}

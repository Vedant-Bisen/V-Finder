import { useState, useRef, useCallback } from "react";
import { Grid, ActionPanel, Action, Icon, Color, environment, getPreferenceValues } from "@raycast/api";
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

interface Preferences {
  pythonPackagePath: string;
  pythonPath?: string;
}

interface SearchResult {
  id: string;
  similarity: number;
  file_path: string;
  file_name: string;
  media_category: string;
  timestamp: string;
  description: string;
  source: string;
  preview: string;
}

const THUMB_DIR = join(environment.supportPath, "thumbnails");

try {
  mkdirSync(THUMB_DIR, { recursive: true });
} catch {
  // ignore
}

function getCategoryIcon(category: string): { source: Icon; tintColor: Color } {
  switch (category) {
    case "image":
      return { source: Icon.Image, tintColor: Color.Blue };
    case "audio":
      return { source: Icon.Microphone, tintColor: Color.Purple };
    case "video":
      return { source: Icon.Video, tintColor: Color.Red };
    case "document":
      return { source: Icon.Document, tintColor: Color.Orange };
    case "text":
      return { source: Icon.Text, tintColor: Color.Green };
    default:
      return { source: Icon.QuestionMarkCircle, tintColor: Color.SecondaryText };
  }
}

function getVideoThumbnail(filePath: string, fileId: string): string | null {
  const thumbPath = join(THUMB_DIR, `${fileId}.jpg`);
  if (existsSync(thumbPath)) return thumbPath;

  try {
    execSync(
      `ffmpeg -y -i "${filePath}" -ss 00:00:01 -frames:v 1 -q:v 2 "${thumbPath}" 2>/dev/null`,
      { timeout: 5000, encoding: "utf-8" },
    );
    return existsSync(thumbPath) ? thumbPath : null;
  } catch {
    return null;
  }
}

function runSearch(query: string, count: number = 20): SearchResult[] {
  if (!query.trim()) return [];

  const prefs = getPreferenceValues<Preferences>();
  const python = prefs.pythonPath || "python3";
  const pkgPath = prefs.pythonPackagePath;
  const safeQuery = query.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  try {
    const output = execSync(
      `${python} -c "
import json, sys
sys.path.insert(0, '${pkgPath}')
from vector_embedded_finder import search as s
results = s.search('${safeQuery}', n_results=${count})
print(json.dumps(results))
"`,
      { timeout: 15000, encoding: "utf-8" },
    );

    return JSON.parse(output.trim());
  } catch {
    return [];
  }
}

export default function SearchMemory() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<Map<string, SearchResult[]>>(new Map());

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!text.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const cached = cacheRef.current.get(text.trim().toLowerCase());
    if (cached) {
      setResults(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    timerRef.current = setTimeout(() => {
      const r = runSearch(text, 20);
      cacheRef.current.set(text.trim().toLowerCase(), r);
      setResults(r);
      setIsLoading(false);
    }, 400);
  }, []);

  return (
    <Grid
      columns={4}
      fit={Grid.Fit.Fill}
      inset={Grid.Inset.Zero}
      isLoading={isLoading}
      searchBarPlaceholder="Search memory..."
      onSearchTextChange={handleSearchChange}
    >
      {results.length === 0 && searchText.trim() !== "" && !isLoading ? (
        <Grid.EmptyView icon={Icon.MagnifyingGlass} title="No results found" description="Try a different query" />
      ) : null}

      {results.map((result, index) => {
        const icon = getCategoryIcon(result.media_category);
        const score = `${(result.similarity * 100).toFixed(1)}%`;
        const fileExists = result.file_path ? existsSync(result.file_path) : false;

        let contentSource: string | null = null;
        if (fileExists) {
          if (result.media_category === "image") {
            contentSource = result.file_path;
          } else if (result.media_category === "video") {
            contentSource = getVideoThumbnail(result.file_path, result.id);
          }
        }

        const content: Grid.Item.Content = contentSource
          ? { source: contentSource }
          : { source: icon.source, tintColor: icon.tintColor };

        return (
          <Grid.Item
            key={result.id || `result-${index}`}
            content={content}
            title={result.file_name || "Text snippet"}
            subtitle={`#${index + 1} - ${score}`}
            actions={
              <ActionPanel>
                {result.file_path && fileExists && (
                  <>
                    <Action.Open title="Open File" target={result.file_path} />
                    <Action.ShowInFinder path={result.file_path} />
                  </>
                )}
                <Action.CopyToClipboard
                  title="Copy Path"
                  content={result.file_path || result.preview || ""}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
                {result.preview && (
                  <Action.CopyToClipboard
                    title="Copy Preview Text"
                    content={result.preview}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  />
                )}
              </ActionPanel>
            }
          />
        );
      })}
    </Grid>
  );
}

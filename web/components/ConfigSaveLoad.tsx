"use client";

import { useRef, useState } from "react";
import { triggerDownload } from "@/lib/download";
import {
  parseScenarioConfigFile,
  serializeScenarioConfig,
  type ScenarioConfigInput,
} from "@/lib/scenarioConfig";

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 15V3M8 7l4-4 4 4M5 21h14" />
    </svg>
  );
}

const buttonClass =
  "inline-flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-accent hover:text-accent dark:border-zinc-700 dark:text-zinc-300";

// Save the current form settings to a JSON file, or load a previously saved
// one back in. Lets a user keep, share, or reproduce a scenario without
// re-running it -- and re-load the config bundled inside a completed run's
// JSON export, since both share the same nested `config` shape.
export function ConfigSaveLoad({
  config,
  onLoad,
}: {
  config: ScenarioConfigInput;
  onLoad: (config: ScenarioConfigInput) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; message: string } | null
  >(null);

  function handleSave() {
    setStatus(null);
    triggerDownload(
      `custom-run-config-${config.region}.json`,
      serializeScenarioConfig(config),
      "application/json"
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice in a row still fires
    // onChange the second time.
    e.target.value = "";
    if (!file) return;

    try {
      const parsed = parseScenarioConfigFile(await file.text());
      if (!parsed) {
        setStatus({
          kind: "error",
          message: "That file isn't a valid saved scenario.",
        });
        return;
      }
      onLoad(parsed);
      setStatus({ kind: "ok", message: `Loaded settings from ${file.name}.` });
    } catch {
      setStatus({ kind: "error", message: "Couldn't read that file." });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleSave} className={buttonClass}>
          <DownloadIcon />
          Save configuration
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={buttonClass}
        >
          <UploadIcon />
          Load configuration
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      {status && (
        <p
          className={
            status.kind === "ok"
              ? "text-xs text-zinc-500 dark:text-zinc-400"
              : "text-xs text-red-600 dark:text-red-400"
          }
        >
          {status.message}
        </p>
      )}
    </div>
  );
}

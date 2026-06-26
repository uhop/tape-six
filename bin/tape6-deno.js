#!/usr/bin/env -S deno run --allow-all --ext=js

// Deno 2.9.0 doesn't realpath a symlinked entry (denoland/deno#35551), so the
// `.bin/tape6-deno` symlink would resolve the runner's ../src imports wrong.
// Realpath this entry, then load the runner (static imports intact) beside it.
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = pathToFileURL(Deno.realPathSync(fileURLToPath(import.meta.url)));
await import(new URL('tape6-deno-main.js', here).href);

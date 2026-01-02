/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec, spawn, ChildProcess } from "child_process";
import { app, IpcMainInvokeEvent } from "electron";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { get as httpsGet } from "https";
import { join } from "path";

const DATA_DIR = "VcNarratorTTS";
const PYTHON_DIR = "python";
const SERVER_SCRIPT = "tts_server.py";
const TTS_PORT = 5550;

let serverProcess: ChildProcess | null = null;

function getDataPath(): string {
    return join(app.getPath("userData"), DATA_DIR);
}

function getPythonPath(): string {
    return join(getDataPath(), PYTHON_DIR);
}

function getPythonExe(): string {
    return join(getPythonPath(), "python.exe");
}

function getServerScriptPath(): string {
    return join(getDataPath(), SERVER_SCRIPT);
}

export function checkSetupStatus(_: IpcMainInvokeEvent) {
    const pythonExe = getPythonExe();
    const pythonInstalled = existsSync(pythonExe);
    const pywin32Path = join(getPythonPath(), "Lib", "site-packages", "win32com");
    const pywin32Installed = pythonInstalled && existsSync(pywin32Path);
    const serverScriptExists = existsSync(getServerScriptPath());

    return {
        pythonInstalled,
        pywin32Installed,
        serverScriptExists,
        ready: pythonInstalled && pywin32Installed && serverScriptExists,
        dataPath: getDataPath()
    };
}

function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(destPath);

        httpsGet(url, response => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                file.close();
                try { unlinkSync(destPath); } catch { }
                downloadFile(response.headers.location!, destPath).then(resolve).catch(reject);
                return;
            }

            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            });
        }).on("error", err => {
            file.close();
            try { unlinkSync(destPath); } catch { }
            reject(err);
        });
    });
}

function execCommand(cmd: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout);
            }
        });
    });
}

export async function performSetup(_: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string; }> {
    try {
        const dataPath = getDataPath();
        const pythonPath = getPythonPath();

        mkdirSync(dataPath, { recursive: true });
        mkdirSync(pythonPath, { recursive: true });

        const pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip";
        const pythonZipPath = join(dataPath, "python.zip");

        await downloadFile(pythonUrl, pythonZipPath);

        await execCommand(`powershell -Command "Expand-Archive -Path '${pythonZipPath}' -DestinationPath '${pythonPath}' -Force"`);

        const pthFile = join(pythonPath, "python311._pth");
        if (existsSync(pthFile)) {
            let content = readFileSync(pthFile, "utf8");
            content = content.replace("#import site", "import site");
            content += "\nLib\\site-packages\n";
            writeFileSync(pthFile, content);
        }

        mkdirSync(join(pythonPath, "Lib", "site-packages"), { recursive: true });

        const getPipUrl = "https://bootstrap.pypa.io/get-pip.py";
        const getPipPath = join(dataPath, "get-pip.py");
        await downloadFile(getPipUrl, getPipPath);
        await execCommand(`"${getPythonExe()}" "${getPipPath}"`, pythonPath);

        await execCommand(`"${getPythonExe()}" -m pip install pywin32 --target "${join(pythonPath, "Lib", "site-packages")}"`, pythonPath);

        writeFileSync(getServerScriptPath(), getServerScript());

        try {
            unlinkSync(pythonZipPath);
            unlinkSync(getPipPath);
        } catch { }

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

export function startServer(_: IpcMainInvokeEvent): { success: boolean; error?: string; } {
    try {
        if (serverProcess && !serverProcess.killed) {
            return { success: true };
        }

        const pythonExe = getPythonExe();
        const scriptPath = getServerScriptPath();

        if (!existsSync(pythonExe) || !existsSync(scriptPath)) {
            return { success: false, error: "Python or server script not found" };
        }

        serverProcess = spawn(pythonExe, [scriptPath], {
            detached: true,
            stdio: "ignore",
            windowsHide: true
        });

        serverProcess.unref();

        serverProcess.on("exit", () => {
            serverProcess = null;
        });

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || String(e) };
    }
}

export function stopServer(_: IpcMainInvokeEvent): { success: boolean; } {
    if (serverProcess) {
        try {
            serverProcess.kill();
        } catch { }
        serverProcess = null;
    }

    return { success: true };
}

export function cleanupData(_: IpcMainInvokeEvent): { success: boolean; } {
    stopServer(_);

    try {
        const dataPath = getDataPath();
        if (existsSync(dataPath)) {
            rmSync(dataPath, { recursive: true, force: true });
        }
        return { success: true };
    } catch {
        return { success: false };
    }
}

function getServerScript(): string {
    return `"""
VcNarrator SAPI5 TTS Server
"""

import http.server
import json
import urllib.parse
import threading
import sys
import os

try:
    import win32com.client
except ImportError:
    print("ERROR: pywin32 not installed")
    sys.exit(1)

PORT = ${TTS_PORT}
speaker = None
voices_cache = []

def init_sapi():
    global speaker, voices_cache
    speaker = win32com.client.Dispatch('SAPI.SpVoice')
    voices_cache = []
    for voice in speaker.GetVoices():
        voices_cache.append({
            "id": voice.Id,
            "name": voice.GetDescription()
        })

class TTSHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)
        
        if path == '/ping':
            self.send_json({"status": "ok", "server": "VcNarrator SAPI5 TTS"})
        
        elif path == '/voices':
            self.send_json({"voices": voices_cache})
        
        elif path == '/speak':
            text = params.get('text', [''])[0]
            voice_id = params.get('voice', [None])[0]
            rate = int(params.get('rate', [0])[0])
            volume = int(params.get('volume', [100])[0])
            
            if not text:
                self.send_json({"error": "No text provided"}, 400)
                return
            
            try:
                if voice_id:
                    for i, v in enumerate(speaker.GetVoices()):
                        if v.Id == voice_id:
                            speaker.Voice = speaker.GetVoices().Item(i)
                            break
                
                speaker.Rate = max(-10, min(10, rate))
                speaker.Volume = max(0, min(100, volume))
                speaker.Speak(text, 1)
                
                self.send_json({"status": "speaking"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
        
        elif path == '/stop':
            try:
                speaker.Speak("", 2)
                self.send_json({"status": "stopped"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
        
        elif path == '/shutdown':
            self.send_json({"status": "shutting down"})
            threading.Thread(target=lambda: os._exit(0)).start()
        
        else:
            self.send_json({"error": "Not found"}, 404)

def main():
    init_sapi()
    print(f"VcNarrator TTS Server starting on port {PORT}")
    print(f"Found {len(voices_cache)} voices")
    
    server = http.server.HTTPServer(('127.0.0.1', PORT), TTSHandler)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Shutting down...")
        server.shutdown()

if __name__ == '__main__':
    main()
`;
}

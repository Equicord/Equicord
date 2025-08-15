/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated, Korbo, and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const DATASTORE_KEY = "vencord-snippets";

export interface Snippet {
    id: string;
    name: string;
    description: string;
    code: string;
    runOnLaunch: boolean;
    createdAt: number;
    lastModified: number;
}

let snippets: Map<string, Snippet> = new Map();

async function loadSnippets() {
    try {
        const stored = await DataStore.get(DATASTORE_KEY) || {};
        snippets = new Map(Object.entries(stored));
    } catch (error) {
        showNotification({
            title: "Snippets",
            body: "Failed to load saved snippets",
        });
    }
}

async function saveSnippets() {
    try {
        const obj = Object.fromEntries(snippets);
        await DataStore.set(DATASTORE_KEY, obj);
    } catch (error) {
        showNotification({
            title: "Snippets",
            body: "Failed to save snippets",
        });
    }
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

async function createSnippet(name: string, description: string, code: string, runOnLaunch: boolean = false): Promise<boolean> {
    if (!name.trim()) {
        showNotification({
            title: "Snippets",
            body: "Snippet name cannot be empty",
        });
        return false;
    }

    if (!code.trim()) {
        showNotification({
            title: "Snippets",
            body: "Snippet code cannot be empty",
        });
        return false;
    }

    const id = generateId();
    const snippet: Snippet = {
        id,
        name: name.trim(),
        description: description.trim(),
        code: code.trim(),
        runOnLaunch,
        createdAt: Date.now(),
        lastModified: Date.now()
    };

    snippets.set(id, snippet);
    await saveSnippets();

    showNotification({
        title: "Snippets",
        body: `Created snippet "${name}"`,
    });

    return true;
}

async function deleteSnippet(id: string): Promise<boolean> {
    const snippet = snippets.get(id);
    if (!snippet) {
        showNotification({
            title: "Snippets",
            body: "Snippet not found",
        });
        return false;
    }

    snippets.delete(id);
    await saveSnippets();

    showNotification({
        title: "Snippets",
        body: `Deleted snippet "${snippet.name}"`,
    });

    return true;
}

function executeSnippet(code: string): { success: boolean; result?: any; error?: string; } {
    try {
        const func = new Function(code);
        const result = func();
        return { success: true, result };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

async function runSnippetById(id: string): Promise<boolean> {
    const snippet = snippets.get(id);
    if (!snippet) {
        showNotification({
            title: "Snippets",
            body: "Snippet not found",
        });
        return false;
    }

    const execution = executeSnippet(snippet.code);

    if (execution.success) {
        if (settings.store.showExecutionResults) {
            showNotification({
                title: "Snippets",
                body: `Executed snippet "${snippet.name}" successfully`,
            });
        }

        if (execution.result !== undefined) {
            console.log(`[Snippets] Result from "${snippet.name}":`, execution.result);
        }

        return true;
    } else {
        if (settings.store.showExecutionResults) {
            showNotification({
                title: "Snippets",
                body: `Error in snippet "${snippet.name}": ${execution.error}`,
            });
            console.error(`[Snippets] Error in snippet "${snippet.name}":`, execution.error);
        }
        return false;
    }
}

async function runLaunchSnippets() {
    if (!settings.store.enableLaunchSnippets) return;

    const launchSnippets = Array.from(snippets.values()).filter(s => s.runOnLaunch);

    for (const snippet of launchSnippets) {
        await runSnippetById(snippet.id);
    }
}

function listSnippets(): string {
    if (snippets.size === 0) {
        return "No snippets found. Use `/snippet-create` to create one.";
    }

    const snippetList = Array.from(snippets.values())
        .map(s => `• **${s.name}** (${s.id}): ${s.description || "No description"}${s.runOnLaunch ? " [Auto-run]" : ""}`)
        .join("\n");

    return `**Available Snippets:**\n${snippetList}`;
}

const settings = definePluginSettings({
    enableLaunchSnippets: {
        type: OptionType.BOOLEAN,
        description: "Allow snippets to run automatically at launch",
        default: true,
        restartNeeded: true
    },
    showExecutionResults: {
        type: OptionType.BOOLEAN,
        description: "Show notifications when snippets execute (success/error messages)",
        default: false
    },
    helpText: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => (
            <div style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "8px" }}>
                <strong>Available Commands:</strong><br />
                • <code>/snippet-create</code> - Create a new snippet<br />
                • <code>/snippet-list</code> - List all snippets<br />
                • <code>/snippet-run</code> - Run a snippet by ID or name<br />
                • <code>/snippet-delete</code> - Delete a snippet by ID<br />
            </div>
        )
    }
});

export default definePlugin({
    name: "Snippets",
    description: "Save JavaScript code snippets to run on demand or at launch",
    authors: [EquicordDevs.veygax],
    settings,

    async start() {
        await loadSnippets();
        setTimeout(runLaunchSnippets, 2000); // trying to wait for discord to load
    },

    commands: [
        {
            name: "snippet-create",
            description: "Create a new JavaScript snippet",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "name",
                    description: "Name of the snippet",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                {
                    name: "code",
                    description: "JavaScript code to execute",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                {
                    name: "description",
                    description: "Description of what the snippet does",
                    type: ApplicationCommandOptionType.STRING,
                    required: false
                },
                {
                    name: "run-on-launch",
                    description: "Run this snippet automatically when Discord starts",
                    type: ApplicationCommandOptionType.BOOLEAN,
                    required: false
                }
            ],
            execute: async (opts, ctx) => {
                const name = findOption(opts, "name", "");
                const code = findOption(opts, "code", "");
                const description = findOption(opts, "description", "");
                const runOnLaunch = findOption(opts, "run-on-launch", false);

                const success = await createSnippet(name, description, code, runOnLaunch);

                sendBotMessage(ctx.channel.id, {
                    content: success
                        ? `✅ Created snippet "${name}" successfully!`
                        : "❌ Failed to create snippet. Check your input and try again."
                });
            }
        },
        {
            name: "snippet-list",
            description: "List all saved snippets",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (opts, ctx) => {
                sendBotMessage(ctx.channel.id, {
                    content: listSnippets()
                });
            }
        },
        {
            name: "snippet-run",
            description: "Run a snippet by ID or name",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "identifier",
                    description: "Snippet ID or name",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: async (opts, ctx) => {
                const identifier = findOption(opts, "identifier", "");

                // Try to find by ID first, then by name
                let snippet = snippets.get(identifier);
                if (!snippet) {
                    snippet = Array.from(snippets.values()).find(s =>
                        s.name.toLowerCase() === identifier.toLowerCase()
                    );
                }

                if (!snippet) {
                    sendBotMessage(ctx.channel.id, {
                        content: `❌ Snippet "${identifier}" not found. Use \`/snippet-list\` to see available snippets.`
                    });
                    return;
                }

                const success = await runSnippetById(snippet.id);

                sendBotMessage(ctx.channel.id, {
                    content: success
                        ? `✅ Executed snippet "${snippet.name}" successfully!`
                        : `❌ Failed to execute snippet "${snippet.name}". Check the console for errors.`
                });
            }
        },
        {
            name: "snippet-delete",
            description: "Delete a snippet by ID",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "id",
                    description: "Snippet ID to delete",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: async (opts, ctx) => {
                const id = findOption(opts, "id", "");
                const success = await deleteSnippet(id);

                sendBotMessage(ctx.channel.id, {
                    content: success
                        ? "✅ Deleted snippet successfully!"
                        : "❌ Failed to delete snippet. Snippet ID not found."
                });
            }
        }
    ]
});

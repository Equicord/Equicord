/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Link } from "@components/Link";
import { Alerts, showToast, Toasts } from "@webpack/common";

import { GITHUB_URL, PluginLogger } from "./constants";


export function quickAlert(title: any, body: React.ReactNode) {
    Alerts.show({ title: title, body: body });
}

export function somethingWentWrong() {
    quickAlert("Something went wrong!", (
        <>
            During the process, a problem was ran into. This could be the simple cause of creating duplicate badges or categories. This is <b>disallowed</b>.<br /><br />
            If this isn't the problem, please check the <b><Link href="https://developer.chrome.com/docs/devtools">Chrome DevTools</Link></b> for potentially logged errors.<br /><br />
            Report an issue at the <b><Link href={GITHUB_URL}>GitHub</Link></b> of your results to debug the issue.
        </>
    ));
}

// uhh thanks holy notes

export function saveJSONFile(filename: string, data: any) {
    const jsonData = JSON.stringify(data ?? {}, null, 2);

    if (IS_WEB || IS_VESKTOP) {
        const file = new File([jsonData], filename, { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        setImmediate(() => {
            URL.revokeObjectURL(a.href);
            document.body.removeChild(a);
        });
    } else DiscordNative.fileManager.saveWithDialog(jsonData, filename);
}

export async function openJSONFile(onLoad: (data: any) => any): Promise<any> {
    if (IS_WEB || IS_VESKTOP) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json";

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return undefined;

            const reader = new FileReader();
            reader.readAsText(file);

            reader.onload = async () => {
                try {
                    const data: any = JSON.parse(reader.result as unknown as string);
                    if (!data) return undefined;

                    await onLoad(data);
                } catch (error) {
                    showToast("Failed. May contain an invalid json format.", Toasts.Type.FAILURE);
                    PluginLogger.error(error);
                }
            };
        };

        document.body.appendChild(input);
        input.click();
        setImmediate(() => document.body.removeChild(input));
    } else {
        const [file] = await DiscordNative.fileManager.openFiles({
            filters: [{
                name: "Exported",
                extensions: ["json"]
            }]
        });

        if (file) {
            try {
                const data: any = JSON.parse(new TextDecoder().decode(file.data));
                if (!data) return undefined;

                await onLoad(data);
            } catch (error) {
                showToast("Failed. May contain an invalid json format.", Toasts.Type.FAILURE);
                PluginLogger.error(error);
            }
        }
    }
}

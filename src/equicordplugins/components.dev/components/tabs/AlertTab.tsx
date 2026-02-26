/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Alerts, Button, showToast, ToastType } from "..";
import { DocPage, type PropDef } from "../DocPage";

const ALERT_PROPS: PropDef[] = [
    { name: "title", type: "string", required: true, description: "Alert dialog title." },
    { name: "body", type: "ReactNode", required: true, description: "Alert body content. Can be a string or JSX." },
    { name: "confirmText", type: "string", description: "Text for the confirm button. Defaults to a localized \"Okay\" string." },
    { name: "cancelText", type: "string", description: "Text for the cancel button. Only shown when set to a non-empty string." },
    { name: "confirmVariant", type: '"primary" | "critical-primary" | "expressive"', default: '"primary"', description: "Visual variant for the confirm button." },
    { name: "onConfirm", type: "() => void", description: "Called when the confirm button is clicked." },
    { name: "onCancel", type: "() => void", description: "Called when the cancel button is clicked." },
    { name: "onCloseCallback", type: "() => void", description: "Called when the alert closes, regardless of which button was pressed." },
    { name: "contextKey", type: "string", description: "Optional context key passed to the modal system." },
];

export default function AlertTab() {
    return (
        <DocPage
            componentName="Alerts"
            overview={"Alerts is a utility API for showing modal alert dialogs. It wraps Discord's ConfirmModal with a simple show/close/confirm interface. The confirm method returns a Promise that resolves to true or false based on the user's choice."}
            notices={[
                { type: "warn", children: "Alerts.show() opens a modal dialog that blocks user interaction with the rest of the UI. Avoid chaining multiple alerts or showing them in rapid succession." },
                { type: "info", children: "Prefer Alerts.confirm() over Alerts.show() when you need to act on the user's choice, since it returns a Promise<boolean> that cleanly integrates with async flows." },
            ]}
            importPath={'import { Alerts } from "../components";'}
            sections={[
                {
                    title: "Basic Alert",
                    description: "Simple alert with just a title and body. Only shows a confirm button.",
                    children: (
                        <Button onClick={() => {
                            Alerts.show({
                                title: "Basic Alert",
                                body: "This is a basic alert dialog with just an OK button.",
                            });
                        }}>
                            Show Basic Alert
                        </Button>
                    ),
                    code: 'Alerts.show({ title: "Done", body: "Operation completed successfully." });',
                    relevantProps: ["title", "body"]
                },
                {
                    title: "Confirm Alert",
                    description: "Alert with confirm and cancel buttons. Both fire callbacks on click.",
                    children: (
                        <Button onClick={() => {
                            Alerts.show({
                                title: "Confirm Action",
                                body: "Are you sure you want to proceed with this action?",
                                confirmText: "Yes, proceed",
                                cancelText: "Cancel",
                                onConfirm: () => showToast("Confirmed!", ToastType.SUCCESS),
                                onCancel: () => showToast("Cancelled", ToastType.MESSAGE),
                            });
                        }}>
                            Show Confirm Alert
                        </Button>
                    ),
                    relevantProps: ["confirmText", "cancelText", "onConfirm", "onCancel"]
                },
                {
                    title: "Danger Alert",
                    description: "Uses critical-primary variant for destructive actions.",
                    children: (
                        <Button variant="dangerPrimary" onClick={() => {
                            Alerts.show({
                                title: "Delete Item",
                                body: "This action cannot be undone. Are you sure you want to delete this item?",
                                confirmText: "Delete",
                                confirmVariant: "critical-primary",
                                cancelText: "Keep it",
                                onConfirm: () => showToast("Deleted!", ToastType.SUCCESS),
                            });
                        }}>
                            Show Danger Alert
                        </Button>
                    ),
                    code: 'Alerts.show({\n  title: "Delete?",\n  body: "This cannot be undone.",\n  confirmText: "Delete",\n  confirmVariant: "critical-primary",\n  cancelText: "Cancel",\n  onConfirm: () => deleteItem(),\n});',
                    relevantProps: ["confirmVariant"]
                },
                {
                    title: "Expressive Alert",
                    description: "Uses the expressive variant for premium or promotional actions.",
                    children: (
                        <Button onClick={() => {
                            Alerts.show({
                                title: "Premium Feature",
                                body: "This feature requires a premium subscription.",
                                confirmText: "Upgrade Now",
                                confirmVariant: "expressive",
                                cancelText: "Maybe Later",
                                onConfirm: () => showToast("Upgrading!", ToastType.SUCCESS),
                            });
                        }}>
                            Show Expressive Alert
                        </Button>
                    ),
                    relevantProps: ["confirmVariant"]
                },
                {
                    title: "Promise-based Confirm",
                    description: "Alerts.confirm() returns a Promise<boolean>. Resolves true on confirm, false on cancel.",
                    children: (
                        <Button onClick={async () => {
                            const result = await Alerts.confirm({
                                title: "Async Confirm",
                                body: "This uses Alerts.confirm() which returns a promise.",
                                confirmText: "Accept",
                                cancelText: "Decline",
                            });
                            showToast(result ? "Accepted!" : "Declined", result ? ToastType.SUCCESS : ToastType.MESSAGE);
                        }}>
                            Show Promise Confirm
                        </Button>
                    ),
                    code: 'const confirmed = await Alerts.confirm({\n  title: "Proceed?",\n  body: "Are you sure?",\n  confirmText: "Yes",\n  cancelText: "No",\n});\nif (confirmed) doSomething();'
                },
            ]}
            props={ALERT_PROPS}
        />
    );
}

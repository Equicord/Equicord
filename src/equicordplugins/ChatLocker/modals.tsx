/*
 * ChatLockButton – Modals & Actions
 */

import {
    openModal,
    Modal,
    React,
    useState,
    Forms,
    TextInput,
    Toasts,
    SelectedChannelStore,
} from "@webpack/common";
import {
    getHash,
    setHash,
    lock,
    unlock,
    isLocked,
    SALT,
    hasPassword,
} from "./storage";
import { updateOverlay } from "./overlay";

// ============================================================================
// Lock SVG Icon
// ============================================================================

export const LockIcon = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M6 9h1V6a5 5 0 0 1 10 0v3h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Zm9-3v3H9V6a3 3 0 1 1 6 0Zm-1 8a2 2 0 0 1-1 1.73V18a1 1 0 1 1-2 0v-2.27A2 2 0 1 1 14 14Z"
            clipRule="evenodd"
        />
    </svg>
);

// ============================================================================
// Hash function
// ============================================================================

async function hashPassword(password: string): Promise<string> {
    const data = new TextEncoder().encode(password + SALT);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

// ============================================================================
// Helper: modal actions
// ============================================================================

function modalActions(
    onConfirm: () => void,
    onCancel: () => void,
    confirmText = "Confirm",
    confirmVariant: "primary" | "secondary" | "danger" = "primary"
) {
    return [
        { text: "Cancel", variant: "secondary", onClick: onCancel },
        { text: confirmText, variant: confirmVariant, onClick: onConfirm },
    ];
}

// ============================================================================
// Refresh function (to update overlay after actions)
// ============================================================================

function refreshAll() {
    updateOverlay();
}

// ============================================================================
// Modal Components (with proper input spacing)
// ============================================================================

const inputContainerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    marginTop: "4px",
};

const errorStyle = { color: "var(--text-danger)", marginTop: 4 };

// ----------------------------------------------------------------------------
// Set Password Modal
// ----------------------------------------------------------------------------

export function SetPasswordModal({ modalProps, channelId }: { modalProps: any; channelId: string }) {
    const [pwd, setPwd] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");

    const submit = async () => {
        if (pwd.length < 4) {
            setError("Password must be at least 4 characters.");
            return;
        }
        if (pwd !== confirm) {
            setError("Passwords do not match.");
            return;
        }
        setError("");
        await setHash(channelId, await hashPassword(pwd));
        lock(channelId);
        Toasts.show({ type: Toasts.Type.SUCCESS, message: "🔒 Channel locked" });
        modalProps.onClose();
        refreshAll();
    };

    return (
        <Modal
            {...modalProps}
            title="Set Lock Password"
            actions={modalActions(submit, modalProps.onClose, "Set & Lock", "primary")}
        >
            <Forms.FormSection>
                <Forms.FormTitle>Create a password to lock this chat.</Forms.FormTitle>
                <div style={inputContainerStyle}>
                    <TextInput
                        type="password"
                        placeholder="New password (min 4 chars)"
                        value={pwd}
                        onChange={setPwd}
                        autoFocus
                    />
                    <TextInput
                        type="password"
                        placeholder="Confirm password"
                        value={confirm}
                        onChange={setConfirm}
                        onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") submit(); }}
                    />
                </div>
                {error && (
                    <Forms.FormText style={errorStyle}>
                        {error}
                    </Forms.FormText>
                )}
            </Forms.FormSection>
        </Modal>
    );
}

// ----------------------------------------------------------------------------
// Unlock Modal
// ----------------------------------------------------------------------------

export function UnlockModal({ modalProps, channelId }: { modalProps: any; channelId: string }) {
    const [pwd, setPwd] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        setError("");
        const stored = await getHash(channelId);
        if (!stored) {
            setError("No password set.");
            setBusy(false);
            return;
        }
        if ((await hashPassword(pwd)) === stored) {
            unlock(channelId);
            Toasts.show({ type: Toasts.Type.SUCCESS, message: "🔓 Unlocked" });
            modalProps.onClose();
            refreshAll();
        } else {
            setError("Incorrect password.");
            setBusy(false);
        }
    };

    return (
        <Modal
            {...modalProps}
            title="Enter Password"
            actions={modalActions(submit, modalProps.onClose, busy ? "Checking..." : "Unlock", "primary")}
        >
            <Forms.FormSection>
                <Forms.FormTitle>This chat is locked. Enter the password to unlock.</Forms.FormTitle>
                <div style={inputContainerStyle}>
                    <TextInput
                        type="password"
                        placeholder="Password"
                        value={pwd}
                        onChange={setPwd}
                        onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") submit(); }}
                        autoFocus
                    />
                </div>
                {error && (
                    <Forms.FormText style={errorStyle}>
                        {error}
                    </Forms.FormText>
                )}
            </Forms.FormSection>
        </Modal>
    );
}

// ----------------------------------------------------------------------------
// Change Password Modal
// ----------------------------------------------------------------------------

export function ChangePasswordModal({ modalProps, channelId }: { modalProps: any; channelId: string }) {
    const [oldPwd, setOldPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [confirmPwd, setConfirmPwd] = useState("");
    const [error, setError] = useState("");

    const submit = async () => {
        if (newPwd.length < 4) {
            setError("New password must be at least 4 characters.");
            return;
        }
        if (newPwd !== confirmPwd) {
            setError("New passwords do not match.");
            return;
        }
        setError("");
        const stored = await getHash(channelId);
        if (!stored || (await hashPassword(oldPwd)) !== stored) {
            setError("Current password is incorrect.");
            return;
        }
        await setHash(channelId, await hashPassword(newPwd));
        Toasts.show({ type: Toasts.Type.SUCCESS, message: "🔑 Password changed" });
        modalProps.onClose();
        refreshAll();
    };

    return (
        <Modal
            {...modalProps}
            title="Change Password"
            actions={modalActions(submit, modalProps.onClose, "Change", "primary")}
        >
            <Forms.FormSection>
                <Forms.FormTitle>Enter your current password and choose a new one.</Forms.FormTitle>
                <div style={inputContainerStyle}>
                    <TextInput
                        type="password"
                        placeholder="Current password"
                        value={oldPwd}
                        onChange={setOldPwd}
                        autoFocus
                    />
                    <TextInput
                        type="password"
                        placeholder="New password (min 4 chars)"
                        value={newPwd}
                        onChange={setNewPwd}
                    />
                    <TextInput
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPwd}
                        onChange={setConfirmPwd}
                        onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") submit(); }}
                    />
                </div>
                {error && (
                    <Forms.FormText style={errorStyle}>
                        {error}
                    </Forms.FormText>
                )}
            </Forms.FormSection>
        </Modal>
    );
}

// ----------------------------------------------------------------------------
// Remove Lock Modal
// ----------------------------------------------------------------------------

export function RemoveLockModal({ modalProps, channelId }: { modalProps: any; channelId: string }) {
    const [pwd, setPwd] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        setError("");
        const stored = await getHash(channelId);
        if (!stored) {
            setError("No password set.");
            setBusy(false);
            return;
        }
        if ((await hashPassword(pwd)) === stored) {
            await setHash(channelId, null);
            unlock(channelId);
            Toasts.show({ type: Toasts.Type.SUCCESS, message: "🔓 Password removed and channel unlocked" });
            modalProps.onClose();
            refreshAll();
        } else {
            setError("Incorrect password.");
            setBusy(false);
        }
    };

    return (
        <Modal
            {...modalProps}
            title="Remove Lock"
            actions={modalActions(submit, modalProps.onClose, busy ? "Checking..." : "Remove", "danger")}
        >
            <Forms.FormSection>
                <Forms.FormTitle>Enter the current password to permanently remove the lock from this chat.</Forms.FormTitle>
                <div style={inputContainerStyle}>
                    <TextInput
                        type="password"
                        placeholder="Current password"
                        value={pwd}
                        onChange={setPwd}
                        onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") submit(); }}
                        autoFocus
                    />
                </div>
                {error && (
                    <Forms.FormText style={errorStyle}>
                        {error}
                    </Forms.FormText>
                )}
            </Forms.FormSection>
        </Modal>
    );
}

// ============================================================================
// Actions (used by overlay and context menu)
// ============================================================================

function openModalWrap(render: (modalProps: any) => React.ReactElement) {
    openModal(modalProps => render(modalProps));
}

export const actSetLock = () => {
    const id = SelectedChannelStore.getChannelId();
    if (!id) return;
    openModalWrap(mp => <SetPasswordModal modalProps={mp} channelId={id} />);
};

export const actUnlock = () => {
    const id = SelectedChannelStore.getChannelId();
    if (!id) return;
    openModalWrap(mp => <UnlockModal modalProps={mp} channelId={id} />);
};

export const actRelock = () => {
    const id = SelectedChannelStore.getChannelId();
    if (!id) return;
    lock(id);
    Toasts.show({ type: Toasts.Type.INFO, message: "🔒 Locked" });
    refreshAll();
};

export const actChange = () => {
    const id = SelectedChannelStore.getChannelId();
    if (!id) return;
    openModalWrap(mp => <ChangePasswordModal modalProps={mp} channelId={id} />);
};

export const actRemove = () => {
    const id = SelectedChannelStore.getChannelId();
    if (!id) return;
    openModalWrap(mp => <RemoveLockModal modalProps={mp} channelId={id} />);
};
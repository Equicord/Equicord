/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { DataStore } from "@api/index";
import { EquicordDevs } from "@utils/constants";
import * as Modal from "@utils/modal";
import definePlugin from "@utils/types";
// REMOVED "Flex" from the import below
import { Button, React, Text, TextInput } from "@webpack/common";

const loginWithToken = (token: string) => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const { contentWindow } = iframe;
    if (contentWindow) {
        setInterval(() => {
            contentWindow.localStorage.token = `"${token}"`;
        }, 50);
        setTimeout(() => { location.reload(); }, 2500);
    } else {
        console.error("Failed to access iframe contentWindow");
    }
};

interface Account {
    id: string;
    token: string;
    username: string;
}

class TokenLoginManager {
    public accounts: Record<string, Account> = {};

    async init() {
        const stored = await DataStore.get("tokenLoginManager.data");
        if (stored) {
            this.accounts = stored;
        }
    }

    async save() {
        await DataStore.set("tokenLoginManager.data", this.accounts);
    }

    addAccount(account: Omit<Account, "id">) {
        const id = crypto.randomUUID();
        this.accounts[id] = { ...account, id };
        this.save();
    }

    deleteAccount(id: string) {
        delete this.accounts[id];
        this.save();
    }
}

const AddAccountModal = ({ manager, onClose, ...props }: Modal.ModalProps & {
    manager: TokenLoginManager;
    onClose: () => void;
}) => {
    const [username, setUsername] = React.useState("");
    const [token, setToken] = React.useState("");

    return (
        <Modal.ModalRoot {...props}>
            <Modal.ModalHeader separator={false}>
                <Text variant="heading-lg/semibold">Add Account</Text>
            </Modal.ModalHeader>
            <Modal.ModalContent className="token-login-modal-content">
                <div className="token-login-section">
                    <Text variant="heading-sm/medium" style={{ marginBottom: "8px" }}>Username</Text>
                    <TextInput
                        placeholder="Username"
                        value={username}
                        onChange={e => setUsername(e)}
                    />
                </div>
                <div className="token-login-section">
                    <Text variant="heading-sm/medium" style={{ marginBottom: "8px" }}>Token</Text>
                    <TextInput
                        placeholder="User Token"
                        value={token}
                        onChange={e => setToken(e)}
                    />
                </div>
            </Modal.ModalContent>
            <Modal.ModalFooter className="token-login-footer">
                {/* Replaced Flex with div */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <Button
                        color={Button.Colors.BRAND}
                        disabled={!username || !token}
                        onClick={() => {
                            manager.addAccount({ username, token });
                            onClose();
                        }}
                    >
                        Save
                    </Button>
                    <Button
                        color={Button.Colors.TRANSPARENT}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                </div>
            </Modal.ModalFooter>
        </Modal.ModalRoot>
    );
};

const AccountEntryComponent = ({ account, manager, onDelete }: {
    account: Account;
    manager: TokenLoginManager;
    onDelete: () => void;
}) => {
    const [showToken, setShowToken] = React.useState(false);

    return (
        <div className="account-entry" key={account.id}>
            <div>
                <Text variant="heading-sm/medium">{account.username}</Text>
                <Text className="token-field">{showToken ? account.token : "••••••••••••••••"}</Text>
            </div>
            <div className="account-actions">
                <Button
                    size={Button.Sizes.SMALL}
                    onClick={() => setShowToken(!showToken)}
                >
                    {showToken ? "Hide Token" : "Show Token"}
                </Button>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.BRAND}
                    onClick={() => loginWithToken(account.token)}
                >
                    Login
                </Button>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    onClick={() => {
                        manager.deleteAccount(account.id);
                        onDelete();
                    }}
                >
                    Delete
                </Button>
            </div>
        </div>
    );
};

class TokenLoginManagerUI {
    private manager: TokenLoginManager;
    private forceUpdate: () => void;

    constructor(manager: TokenLoginManager) {
        this.manager = manager;
        this.forceUpdate = () => { };
    }

    render = () => {
        const [, setUpdateKey] = React.useState({});
        this.forceUpdate = () => setUpdateKey({});

        return (
            <div className="token-login-container">
                {/* Replaced Flex with div */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text variant="heading-lg/semibold">Token Login Manager</Text>
                    <Button
                        onClick={() => {
                            Modal.openModal(props => (
                                <AddAccountModal
                                    {...props}
                                    manager={this.manager}
                                    onClose={() => {
                                        props.onClose();
                                        this.forceUpdate();
                                    }}
                                />
                            ));
                        }}
                    >
                        Add Account
                    </Button>
                </div>
                {Object.values(this.manager.accounts).map(account => (
                    <AccountEntryComponent
                        key={account.id}
                        account={account}
                        manager={this.manager}
                        onDelete={this.forceUpdate}
                    />
                ))}
            </div>
        );
    };
}

export default definePlugin({
    name: "TokenLoginManager",
    description: "Manage and login with user tokens",
    authors: [EquicordDevs.ExoDev],

    tokenLoginManager: null as TokenLoginManager | null,
    ui: null as TokenLoginManagerUI | null,

    async start() {
        this.tokenLoginManager = new TokenLoginManager();
        await this.tokenLoginManager.init();
        this.ui = new TokenLoginManagerUI(this.tokenLoginManager);

        const customSettingsSections = (
            Vencord.Plugins.plugins.Settings as any as {
                customSections: ((ID: Record<string, unknown>) => any)[];
            }
        ).customSections;

        customSettingsSections.push(_ => ({
            section: "tokenLoginManager",
            label: "Token Login Manager",
            element: this.ui!.render
        }));
    },

    stop() {
        this.tokenLoginManager = null;
        this.ui = null;
    }
});
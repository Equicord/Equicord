import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { React, VoiceStateStore } from "@webpack/common";
import { addContextMenuPatch, removeContextMenuPatch } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";

// Store degli utenti silenziati tramite SilentHim
const silencedUsers = new Set<string>();

export const settings = definePluginSettings({
    speakingColor: {
        type: OptionType.STRING,
        description: "Colore dell'icona quando l'utente silenziato parla (es. red, #ff0000)",
        default: "red",
        onChange: (val) => {
            document.documentElement.style.setProperty("--silent-him-color", val);
        }
    },
    silencedUserIds: {
        type: OptionType.STRING,
        default: "[]",
        hidden: true
    }
});

const AudioEngine = findByPropsLazy("setLocalVolume");

export default definePlugin({
    name: "SilentHim",
    description: "Silenzia gli utenti impostando il volume a 0 per continuare a vedere quando parlano.",
    authors: [EquicordDevs.dpassaggio],
    settings,
    
    styles: `
        .silent-him-speaking {
            --status-green: var(--silent-him-color, red) !important;
            --status-speaking: var(--silent-him-color, red) !important;
            --voice-speaking: var(--silent-him-color, red) !important;
            --brand-experiment: var(--silent-him-color, red) !important;
            --green-360: var(--silent-him-color, red) !important;
        }

        .silent-him-speaking [class*="avatarSpeaking"],
        .silent-him-speaking [class*="speaking"],
        .silent-him-speaking [class*="avatar-"],
        .silent-him-speaking [class*="border-"] {
            box-shadow: 0 0 0 2px var(--silent-him-color, red) !important;
            border-color: var(--silent-him-color, red) !important;
        }
        
        .silent-him-speaking rect[fill*="green"],
        .silent-him-speaking circle[fill*="green"],
        .silent-him-speaking [fill="var(--status-green)"] {
            fill: var(--silent-him-color, red) !important;
        }

        .silent-him-speaking [style*="border-color: var(--status-green)"],
        .silent-him-speaking [style*="border-color:var(--status-green)"] {
            border-color: var(--silent-him-color, red) !important;
        }
    `,

    onStart() {
        this.updateColor();
        
        try {
            const saved = JSON.parse(settings.store.silencedUserIds);
            if (Array.isArray(saved)) {
                saved.forEach(id => silencedUsers.add(id));
            }
        } catch (e) {
            console.error("[SilentHim] Errore nel caricamento utenti silenziati:", e);
        }

        addContextMenuPatch("user-context", this.patchUserContext);
    },

    onStop() {
        removeContextMenuPatch("user-context", this.patchUserContext);
    },

    updateColor() {
        document.documentElement.style.setProperty("--silent-him-color", settings.store.speakingColor);
    },

    patchUserContext(children, { user }) {
        if (!user) return;
        
        const isSilenced = silencedUsers.has(user.id);
        const { MenuCheckboxItem, MenuGroup } = Vencord.Webpack.common.Menu;

        children.push(
            React.createElement(MenuGroup, {},
                React.createElement(MenuCheckboxItem, {
                    id: "silent-him-toggle",
                    label: "SilentHim (Vol 0%)",
                    checked: isSilenced,
                    action: () => {
                        if (isSilenced) {
                            silencedUsers.delete(user.id);
                            AudioEngine.setLocalVolume(user.id, 100);
                        } else {
                            silencedUsers.add(user.id);
                            AudioEngine.setLocalVolume(user.id, 0);
                        }
                        settings.store.silencedUserIds = JSON.stringify([...silencedUsers]);
                    }
                })
            )
        );
    },

    patches: [
        {
            find: 'location:"VoiceUser"',
            replacement: {
                match: /speaking:(\i)/,
                replace: (match, speakingVar) => {
                    return `speaking:(() => {
                        try {
                            const userId = arguments[0]?.user?.id;
                            if (!userId) return ${speakingVar};
                            
                            const plugin = Vencord.Plugins.plugins.SilentHim;
                            const isSilentHim = plugin?._silencedUsers?.has(userId);
                            
                            if (isSilentHim) {
                                const SpeakingStore = Vencord.Webpack.findStore("SpeakingStore");
                                const isSpeaking = SpeakingStore.isSpeaking(userId);
                                
                                if (isSpeaking) {
                                    if (arguments[0].className && !arguments[0].className.includes("silent-him-speaking")) {
                                        arguments[0].className += " silent-him-speaking";
                                    } else if (!arguments[0].className) {
                                        arguments[0].className = "silent-him-speaking";
                                    }
                                    return true;
                                }
                            }
                        } catch (e) {}
                        return ${speakingVar};
                    })()`
                }
            }
        }
    ],

    _silencedUsers: silencedUsers
});

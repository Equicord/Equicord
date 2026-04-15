/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../styles.css";

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { Margins } from "@utils/margins";
import { openModal } from "@utils/modal";
import { OptionType } from "@utils/types";

import { cl } from "..";
import { BadgeModal } from "../components/modals/BadgeModal";
import { BadgeHandler } from "./badge/data";
import { GITHUB_URL } from "./constants";


export const pluginSettings = definePluginSettings({
    pluginButtons: {
        type: OptionType.COMPONENT,
        description: "Plugin Buttons",
        component: () => {
            return (
                <div className="section">
                    <Paragraph className={Margins.bottom16}>
                        99% of the time you won't <i>need</i> to use this. All changes should be automatically applied without reinitializing the cache.
                        It is most useful with problems that could utilize it, such as fixing the ordering of badges!
                    </Paragraph>

                    <div className={cl("button-grid")}>
                        <Button
                            variant={"primary"}
                            // color={Button.Colors.PRIMARY}
                            onClick={async () => await BadgeHandler.re_init()}
                        >
                            Reinitialize Cache
                        </Button>

                        <Button
                            onClick={() => openModal(props => <BadgeModal {...props} />)}
                        >
                            Open Badge Modal
                        </Button>

                        <Button
                            variant={"primary"}
                            // color={Button.Colors.PRIMARY}
                            onClick={async () => await VencordNative.native.openExternal(GITHUB_URL)}
                        >
                            GitHub
                        </Button>
                    </div>

                    <Paragraph className={Margins.top16}>
                        You can also enable the <code>VencordToolbox</code> plugin to have much quicker access to the badge modal!
                    </Paragraph>
                </div>
            );
        }
    }
});

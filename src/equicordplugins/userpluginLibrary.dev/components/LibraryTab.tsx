/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Notice } from "@components/Notice";
import {
     SettingsTab as STab,
     wrapTab,
} from "@components/settings/tabs/BaseTab";

import { OpenSettingsModule } from "..";
import { cl } from "../misc/constants";

function LibraryTab() {
    return <STab>
        <Flex flexDirection="column" gap="10px">
            <Notice.Warning>
                Plugins are not modified from their original repositories, regardless of the submitter. However, you may take over any plugin listing where you are listed as a plugin developer, and edit/take it down.
            </Notice.Warning>
            <Notice.Info>
                <ul className={cl("unordered-list")}>
                    <li>All UserPlugins in this section have been manually reviewed and are known to be safe to use. You can look at the safety icons next to plugin names for more info.
                        <Button variant="secondary" style={{ marginTop: "5px" }}>What does each icon mean?</Button></li>
                    <li>Looking for your installed UserPlugins? Go in the <Link onClick={() => OpenSettingsModule.openUserSettings("vencord_userplugins_panel")}>UserPlugins</Link> settings section.</li>
                </ul>

            </Notice.Info>
        </Flex>
    </STab>;
}

export default wrapTab(LibraryTab, "Plugin Library");

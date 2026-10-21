/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RenderModalProps } from "@vencord/discord-types";
import { Modal, React } from "@webpack/common";

import { sendRemix } from ".";
import { brushCanvas, canvas, cropCanvas, ctx, exportImg, shapeCanvas } from "./editor/components/Canvas";
import { Editor } from "./editor/Editor";
import { resetBounds } from "./editor/tools/crop";
import { SendIcon } from "./icons/SendIcon";

type Props = {
    modalProps: RenderModalProps;
    close: () => void;
    url?: string;
};

function reset() {
    resetBounds();

    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    brushCanvas.clearRect(0, 0, canvas.width, canvas.height);
    shapeCanvas.clearRect(0, 0, canvas.width, canvas.height);
    cropCanvas.clearRect(0, 0, canvas.width, canvas.height);
}

async function closeModal(closeFunc: () => void, save?: boolean) {
    if (save) sendRemix(await exportImg());
    reset();
    closeFunc();
}

export default function RemixModal({ modalProps, close, url }: Props) {
    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Remix"
            actions={[
                {
                    text: (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <SendIcon /> Send
                        </span>
                    ) as any,
                    variant: "primary",
                    onClick: () => closeModal(close, true)
                },
                {
                    text: "Close",
                    variant: "dangerPrimary",
                    onClick: () => closeModal(close)
                }
            ]}
        >
            <Editor url={url} />
        </Modal>
    );
}

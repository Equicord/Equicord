/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { cl } from "../utils/misc";
import { Spinner, SpinnerType } from "./Spinner";


const DEFAULT_ART = () => (
    <svg className={cl("art", "art-default")} width="52" height="52" viewBox="0 0 52 52"><title>Album</title><path d="M26 0.00100708C11.641 0.00100708 0 11.642 0 26.001C0 40.36 11.641 52.001 26 52.001C40.36 52 52 40.36 52 26C52 11.64 40.36 0.00100708 26 0.00100708ZM26 50C12.767 50 2 39.234 2 26C2 12.766 12.767 2.00001 26 2.00001C39.234 2.00001 50 12.766 50 26C50 39.234 39.234 50 26 50ZM26 18C21.582 18 18 21.582 18 26C18 30.418 21.582 34 26 34C30.418 34 34 30.418 34 26C34 21.582 30.419 18 26 18ZM26 32C22.692 32 20 29.309 20 26C20 22.691 22.692 20 26 20C29.308 20 32 22.691 32 26C32 29.309 29.309 32 26 32Z" fill="currentColor" fill-rule="evenodd"></path></svg>
);

export interface ArtProps {
    src: string | null;
    pending: boolean;
}

export function Art({ src, pending }: ArtProps) {
    if (src) {
        return <div className={cl("art")} style={{
            backgroundImage: `url(${src})`
        }} />;
    }

    if (pending) {
        return (
            <div className={cl("art", "art-loading")}>
                <Spinner type={SpinnerType.SpinningCircle} />
            </div>
        );
    }

    return DEFAULT_ART();
}

/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { quickSelectClasses } from "@equicordplugins/holyNotes";
import HelpIcon from "@equicordplugins/holyNotes/components/icons/HelpIcon";
import NoteButton from "@equicordplugins/holyNotes/components/icons/NoteButton";
import { noteHandler } from "@equicordplugins/holyNotes/NoteHandler";
import { HolyNotes } from "@equicordplugins/holyNotes/types";
import { classes } from "@utils/misc";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { ContextMenuApi, FluxDispatcher, Menu, React, TextInput } from "@webpack/common";

import Errors from "./Error";
import HelpModal from "./HelpModal";
import ManageNotebookButton from "./ManageNotebookButton";
import { CreateTabBar } from "./NoteBookTab";
import { RenderMessage } from "./RenderMessage";

const renderNotebook = ({
    notes, notebook, updateParent, sortDirection, sortType, searchInput, closeModal
}: {
    notes: Record<string, HolyNotes.Note>;
    notebook: string;
    updateParent: () => void;
    sortDirection: boolean;
    sortType: boolean;
    searchInput: string;
    closeModal: () => void;
}) => {
    let notesArray = Object.values(notes);

    if (searchInput) {
        const searchLower = searchInput.toLowerCase();
        notesArray = notesArray.filter(note =>
            note.content?.toLowerCase().includes(searchLower)
        );
    }

    if (!notesArray.length) return <Errors />;

    if (sortType) {
        notesArray.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    if (sortDirection) notesArray.reverse();

    return notesArray.map(note => (
        <RenderMessage
            key={note.id || notebook}
            note={note}
            notebook={notebook}
            updateParent={updateParent}
            fromDeleteModal={false}
            closeModal={closeModal}
        />
    ));
};

export const NoteModal = (props: ModalProps & { onClose: () => void; }) => {
    const [sortType, setSortType] = React.useState(true);
    const [searchInput, setSearch] = React.useState("");
    const [sortDirection, setSortDirection] = React.useState(true);
    const [currentNotebook, setCurrentNotebook] = React.useState("Main");

    const forceUpdate = React.useReducer(() => ({}), {})[1] as () => void;

    const notes = noteHandler.getNotes(currentNotebook);
    if (!notes) return <></>;

    const notesArray = Object.values(notes);
    const noteCount = notesArray.length;

    // Filter notes for display count
    let filteredCount = noteCount;
    if (searchInput) {
        const searchLower = searchInput.toLowerCase();
        filteredCount = notesArray.filter(note =>
            note.content?.toLowerCase().includes(searchLower)
        ).length;
    }

    const { TabBar, selectedTab } = CreateTabBar({
        tabs: noteHandler.getAllNotes(),
        firstSelectedTab: currentNotebook,
        onChangeTab: setCurrentNotebook
    });

    return (
        <ErrorBoundary>
            <ModalRoot {...props} className={classes("vc-notebook")} size={ModalSize.LARGE}>
                <Flex className={classes("vc-notebook-flex")} flexDirection="column" style={{ width: "100%", height: "100%" }}>
                    <div className={classes("vc-notebook-top-section")}>
                        <ModalHeader className={classes("vc-notebook-header-main")}>
                            <Flex alignItems="center" style={{ gap: "8px", flex: 1 }}>
                                <NoteButton className={classes("vc-notebook-icon")} />
                                <Flex flexDirection="column" style={{ gap: "4px", flex: 1 }}>
                                    <BaseText
                                        size="lg"
                                        weight="semibold"
                                        className={classes("vc-notebook-heading")}>
                                        Notebook
                                    </BaseText>
                                    <BaseText
                                        size="sm"
                                        className={classes("vc-notebook-count")}>
                                        {searchInput
                                            ? `${filteredCount} of ${noteCount} ${noteCount === 1 ? "note" : "notes"}`
                                            : `${noteCount} ${noteCount === 1 ? "note" : "notes"}`
                                        }
                                    </BaseText>
                                </Flex>
                            </Flex>
                            <Flex alignItems="center" style={{ gap: "8px" }}>
                                <div
                                    className={classes("vc-notebook-help-button")}
                                    onClick={() => openModal(HelpModal)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Help"
                                    onKeyDown={e => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            openModal(HelpModal);
                                        }
                                    }}>
                                    <HelpIcon />
                                </div>
                                <ModalCloseButton onClick={props.onClose} />
                            </Flex>
                        </ModalHeader>
                        <div className={classes("vc-notebook-search-container")}>
                            <TextInput
                                autoFocus={false}
                                placeholder="Search notes..."
                                value={searchInput}
                                onChange={e => setSearch(e)}
                                className={classes("vc-notebook-search-input")}
                            />
                        </div>
                        <div className={classes("vc-notebook-tabbar-container")}>
                            {TabBar}
                        </div>
                    </div>
                    <ModalContent
                        className={classes("vc-notebook-content")}
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            overflowX: "hidden",
                            scrollBehavior: "smooth"
                        }}>
                        <ErrorBoundary>
                            {renderNotebook({
                                notes,
                                notebook: currentNotebook,
                                updateParent: () => forceUpdate(),
                                sortDirection: sortDirection,
                                sortType: sortType,
                                searchInput: searchInput,
                                closeModal: props.onClose,
                            })}
                        </ErrorBoundary>
                    </ModalContent>
                </Flex>
                <ModalFooter className={classes("vc-notebook-footer")}>
                    <Flex style={{ width: "100%", justifyContent: "space-between", alignItems: "center" }}>
                        <ManageNotebookButton notebook={currentNotebook} setNotebook={setCurrentNotebook} />
                        <div className={classes("sort-button-container")}>
                            <Flex
                                alignItems="center"
                                className={quickSelectClasses.quickSelect}
                                role="button"
                                tabIndex={0}
                                aria-label="Sort options"
                                onClick={(event: React.MouseEvent<HTMLDivElement>) => {
                                    ContextMenuApi.openContextMenu(event, () => (
                                        <Menu.Menu
                                            navId="sort-menu"
                                            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                                            aria-label="Sort options"
                                        >
                                            <Menu.MenuItem
                                                label="Ascending / Date Added"
                                                id="ada"
                                                action={() => {
                                                    setSortDirection(true);
                                                    setSortType(true);
                                                }}
                                            />
                                            <Menu.MenuItem
                                                label="Ascending / Message Date"
                                                id="amd"
                                                action={() => {
                                                    setSortDirection(true);
                                                    setSortType(false);
                                                }}
                                            />
                                            <Menu.MenuItem
                                                label="Descending / Date Added"
                                                id="dda"
                                                action={() => {
                                                    setSortDirection(false);
                                                    setSortType(true);
                                                }}
                                            />
                                            <Menu.MenuItem
                                                label="Descending / Message Date"
                                                id="dmd"
                                                action={() => {
                                                    setSortDirection(false);
                                                    setSortType(false);
                                                }}
                                            />
                                        </Menu.Menu>
                                    ));
                                }}
                                onKeyDown={e => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        const el = e.currentTarget as HTMLElement;
                                        const rect = el.getBoundingClientRect();
                                        const evt = {
                                            clientX: rect.left + rect.width / 2,
                                            clientY: rect.top + rect.height / 2
                                        } as any;

                                        ContextMenuApi.openContextMenu(evt, () => (
                                            <Menu.Menu
                                                navId="sort-menu"
                                                onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                                                aria-label="Sort options"
                                            >
                                                <Menu.MenuItem label="Ascending / Date Added" id="ada" action={() => { setSortDirection(true); setSortType(true); }} />
                                                <Menu.MenuItem label="Ascending / Message Date" id="amd" action={() => { setSortDirection(true); setSortType(false); }} />
                                                <Menu.MenuItem label="Descending / Date Added" id="dda" action={() => { setSortDirection(false); setSortType(true); }} />
                                                <Menu.MenuItem label="Descending / Message Date" id="dmd" action={() => { setSortDirection(false); setSortType(false); }} />
                                            </Menu.Menu>
                                        ));
                                    }
                                }}
                            >
                                <BaseText className={quickSelectClasses.quickSelectLabel}>Sort:</BaseText>
                                <Flex style={{ flexGrow: 0 }} alignItems="center" className={quickSelectClasses.quickSelectClick}>
                                    <BaseText className={quickSelectClasses.quickSelectValue}>
                                        {sortDirection ? "Asc" : "Desc"} /{" "}
                                        {sortType ? "Date Added" : "Msg Date"}
                                    </BaseText>
                                    <div className={quickSelectClasses.quickSelectArrow} aria-hidden="true" />
                                </Flex>
                            </Flex>
                        </div>
                    </Flex>
                </ModalFooter>
            </ModalRoot>
        </ErrorBoundary>
    );
};

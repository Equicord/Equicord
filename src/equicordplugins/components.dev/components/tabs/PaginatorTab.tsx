/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paginator, Paragraph, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const PAGINATOR_PROPS: PropDef[] = [
    { name: "currentPage", type: "number", required: true, description: "Currently active page (1-based)." },
    { name: "totalCount", type: "number", required: true, description: "Total number of items across all pages." },
    { name: "pageSize", type: "number", required: true, description: "Number of items per page." },
    { name: "onPageChange", type: "(page: number) => void", description: "Called when the user navigates to a different page." },
    { name: "maxVisiblePages", type: "number", description: "Maximum number of page buttons visible at once." },
    { name: "hideMaxPage", type: "boolean", default: "false", description: "Hide the last page number." },
    { name: "disablePaginationGap", type: "boolean", default: "false", description: "Remove the ellipsis gaps between page numbers." },
    { name: "className", type: "string", description: "Custom CSS class." },
    { name: "renderPageWrapper", type: "(props, defaultRender) => ReactNode", description: "Custom render wrapper for each page button." },
];

function BasicDemo() {
    const [page, setPage] = useState(1);
    return (
        <div>
            <Paragraph color="text-muted" style={{ marginBottom: 8 }}>Page {page} of 10</Paragraph>
            <Paginator currentPage={page} totalCount={100} pageSize={10} onPageChange={setPage} />
        </div>
    );
}

function MaxVisibleDemo() {
    const [page3, setPage3] = useState(1);
    const [page7, setPage7] = useState(1);

    return (
        <div className="vc-compfinder-grid-vertical">
            <div>
                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>maxVisiblePages=3:</Paragraph>
                <Paginator currentPage={page3} totalCount={100} pageSize={10} maxVisiblePages={3} onPageChange={setPage3} />
            </div>
            <div>
                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>maxVisiblePages=7:</Paragraph>
                <Paginator currentPage={page7} totalCount={100} pageSize={10} maxVisiblePages={7} onPageChange={setPage7} />
            </div>
        </div>
    );
}

function OptionsDemo() {
    const [page, setPage] = useState(1);

    return (
        <div className="vc-compfinder-grid-vertical">
            <div>
                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>hideMaxPage:</Paragraph>
                <Paginator currentPage={page} totalCount={100} pageSize={10} hideMaxPage onPageChange={setPage} />
            </div>
            <div>
                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>disablePaginationGap:</Paragraph>
                <Paginator currentPage={page} totalCount={50} pageSize={10} disablePaginationGap onPageChange={setPage} />
            </div>
        </div>
    );
}

export default function PaginatorTab() {
    return (
        <DocPage
            componentName="Paginator"
            overview="Paginator provides page navigation for paginated content. Shows page numbers with back/next buttons, ellipsis gaps for large page ranges, and supports customization of visible page count and gap behavior."
            notices={[
                { type: "info", children: "Paginator is 1-based. The currentPage value starts at 1, not 0." },
            ]}
            importPath={'import { Paginator } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Standard paginator with 10 pages.",
                    children: <BasicDemo />,
                    code: `<Paginator
  currentPage={page}
  totalCount={100}
  pageSize={10}
  onPageChange={setPage}
/>`,
                    relevantProps: ["currentPage", "totalCount", "pageSize", "onPageChange"],
                },
                {
                    title: "Max Visible Pages",
                    description: "Control how many page numbers are visible before ellipsis appears.",
                    children: <MaxVisibleDemo />,
                    relevantProps: ["maxVisiblePages"],
                },
                {
                    title: "Options",
                    description: "Hide the last page number or remove ellipsis gaps entirely.",
                    children: <OptionsDemo />,
                    relevantProps: ["hideMaxPage", "disablePaginationGap"],
                },
            ]}
            props={PAGINATOR_PROPS}
        />
    );
}
